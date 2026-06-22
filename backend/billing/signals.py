"""
Signals that keep the Metrics singleton in sync with the Bill table.

Transitions handled per payment_status:

  → PAID    : count bill; add advance_paid (via advance_paid_via)
              + each partially_collected entry (via payment_method)
              + net_bill (via paid_via) to method buckets + total_collected
  → PARTIAL : count partial bill; add advance_paid (via advance_paid_via)
              + each partially_collected entry (via payment_method)
              to method buckets + total_partial_bills / total_partial_collected.
              Does NOT touch total_collected (bill not fully settled).
  → UNPAID  : no-op (or reverse whichever status it came from)

Any transition uses the "subtract old, add new" pattern.
All writes use atomic F() expressions — no read-modify-write races.
"""

from decimal import Decimal

from django.db.models import F
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from .models import Bill, Metrics


# ── Helpers ───────────────────────────────────────────────────────────────────

def _count_field(bill_type: str) -> str:
    return "total_ipd_bills" if bill_type == "IPD" else "total_opd_bills"


def _via_field(paid_via: str) -> str:
    return {"CASH": "total_cash", "UPI": "total_upi", "ONLINE": "total_online"}.get(
        paid_via, "total_upi"
    )


def _add_to(updates: dict, field: str, amount) -> None:
    """Accumulate +/- amount into an F()-based updates dict (composable, race-free)."""
    if amount:
        updates[field] = updates.get(field, F(field)) + amount


def _apply_pc_list(updates: dict, pc_list, sign: int) -> None:
    """Route each partially_collected entry to its payment-method bucket."""
    for e in (pc_list or []):
        method = e.get("payment_method", "CASH")
        amt    = Decimal(str(e.get("amount", "0")))
        _add_to(updates, _via_field(method), sign * amt)


def _apply_bill(updates: dict, state, sign: int) -> None:
    """
    Add (sign=+1) or subtract (sign=-1) all revenue & counts for a bill state.
    `state` may be a Bill instance or a pre_save snapshot dict.
    Works for PAID, PARTIAL, and UNPAID (UNPAID is a no-op).
    """
    if isinstance(state, dict):
        status    = state["payment_status"]
        bill_type = state["bill_type"]
        advance   = Decimal(str(state["advance_paid"]))
        adv_via   = state.get("advance_paid_via") or "CASH"
        net       = Decimal(str(state["net_bill"]))
        net_via   = state["paid_via"]
        pc_list   = state.get("partially_collected") or []
    else:
        status    = state.payment_status
        bill_type = state.bill_type
        advance   = Decimal(str(state.advance_paid))
        adv_via   = state.advance_paid_via or "CASH"
        net       = Decimal(str(state.net_bill))
        net_via   = state.paid_via
        pc_list   = state.partially_collected or []

    total_pc = sum(Decimal(str(e.get("amount", "0"))) for e in pc_list)

    if status == "PAID":
        # Total revenue = advance + all partial collections + remaining net
        _add_to(updates, _count_field(bill_type), sign)
        _add_to(updates, "total_collected", sign * (advance + total_pc + net))
        _add_to(updates, _via_field(adv_via), sign * advance)
        _add_to(updates, _via_field(net_via), sign * net)
        _apply_pc_list(updates, pc_list, sign)

    elif status == "PARTIAL":
        # total_unsettled tracks the outstanding net_bill (what's still owed).
        # Does NOT touch total_collected — bill is not fully settled.
        _add_to(updates, "total_partial_bills", sign)
        _add_to(updates, "total_unsettled",     sign * net)
        _add_to(updates, _via_field(adv_via),   sign * advance)
        _apply_pc_list(updates, pc_list, sign)
    # UNPAID → no-op


def _ensure() -> None:
    Metrics.objects.get_or_create(pk=1)


# ── pre_save: snapshot the row BEFORE any change ─────────────────────────────

@receiver(pre_save, sender=Bill)
def _capture_bill_state(sender, instance, **kwargs):
    if not instance.pk:
        instance._pre_state = None  # new bill — nothing to snapshot
        return
    try:
        instance._pre_state = Bill.objects.values(
            "bill_type", "net_bill", "advance_paid", "advance_paid_via",
            "payment_status", "paid_via", "partially_collected",
        ).get(pk=instance.pk)
    except Bill.DoesNotExist:
        instance._pre_state = None


# ── post_save ─────────────────────────────────────────────────────────────────

@receiver(post_save, sender=Bill)
def _bill_post_save(sender, instance, created, **kwargs):
    _ensure()

    # ── New bill ──────────────────────────────────────────────────────────────
    if created:
        if instance.payment_status == "UNPAID":
            return
        updates = {}
        _apply_bill(updates, instance, sign=1)
        if updates:
            Metrics.objects.filter(pk=1).update(**updates)
        return

    # ── Updated bill ──────────────────────────────────────────────────────────
    old = getattr(instance, "_pre_state", None)
    if old is None:
        Metrics.rebuild()
        return

    if old["payment_status"] == "UNPAID" and instance.payment_status == "UNPAID":
        return  # no metrics impact

    # Generic: subtract old contribution, add new contribution
    updates: dict = {}
    _apply_bill(updates, old,      sign=-1)
    _apply_bill(updates, instance, sign=+1)

    if updates:
        Metrics.objects.filter(pk=1).update(**updates)


# ── post_delete ───────────────────────────────────────────────────────────────

@receiver(post_delete, sender=Bill)
def _bill_post_delete(sender, instance, **kwargs):
    if instance.payment_status == "UNPAID":
        return
    # Use rebuild() rather than F()-decrement to avoid CHECK constraint
    # violations when the Metrics table is out of sync with the Bills table.
    Metrics.rebuild()
