"""
Signals that keep the Metrics singleton in sync with the Bill table.

Bill counts (total_ipd_bills / total_opd_bills) track ALL bills regardless of
payment status — incremented on creation, decremented via rebuild() on deletion.

Revenue buckets (total_cash/upi/online) accumulate money actually received:
  → PAID    : advance_paid (via advance_paid_via) +
              each partially_collected entry (via payment_method) +
              net_bill (via paid_via)
  → PARTIAL : advance_paid (via advance_paid_via) +
              each partially_collected entry (via payment_method)
  → UNPAID  : no revenue (no-op)

total_collected is always total_cash + total_upi + total_online.
total_unsettled = sum of net_bill for all PARTIAL bills (money still owed).

Any revenue transition uses the "subtract old, add new" pattern.
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
    Add (sign=+1) or subtract (sign=-1) revenue for a bill state.
    Bill counts are NOT handled here — they track ALL bills and are managed
    separately in post_save (on create) and via rebuild() (on delete).
    `state` may be a Bill instance or a pre_save snapshot dict.
    """
    if isinstance(state, dict):
        status  = state["payment_status"]
        advance = Decimal(str(state["advance_paid"]))
        adv_via = state.get("advance_paid_via") or "CASH"
        net     = Decimal(str(state["net_bill"]))
        net_via = state["paid_via"]
        pc_list = state.get("partially_collected") or []
    else:
        status  = state.payment_status
        advance = Decimal(str(state.advance_paid))
        adv_via = state.advance_paid_via or "CASH"
        net     = Decimal(str(state.net_bill))
        net_via = state.paid_via
        pc_list = state.partially_collected or []

    total_pc = sum(Decimal(str(e.get("amount", "0"))) for e in pc_list)

    if status == "PAID":
        # total_collected = total_cash + total_upi + total_online, maintained via buckets
        _add_to(updates, "total_collected", sign * (advance + total_pc + net))
        _add_to(updates, _via_field(adv_via), sign * advance)
        _add_to(updates, _via_field(net_via), sign * net)
        _apply_pc_list(updates, pc_list, sign)

    elif status == "PARTIAL":
        _add_to(updates, "total_partial_bills", sign)
        _add_to(updates, "total_unsettled",     sign * net)
        _add_to(updates, _via_field(adv_via),   sign * advance)
        _apply_pc_list(updates, pc_list, sign)
    # UNPAID → no revenue impact


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
        # Always increment the IPD/OPD count regardless of payment status
        Metrics.objects.filter(pk=1).update(
            **{_count_field(instance.bill_type): F(_count_field(instance.bill_type)) + 1}
        )
        # Only handle revenue for non-UNPAID bills
        if instance.payment_status != "UNPAID":
            revenue: dict = {}
            _apply_bill(revenue, instance, sign=1)
            if revenue:
                Metrics.objects.filter(pk=1).update(**revenue)
        return

    # ── Updated bill ──────────────────────────────────────────────────────────
    old = getattr(instance, "_pre_state", None)
    if old is None:
        Metrics.rebuild()
        return

    # Bill counts don't change on update (bill_type is immutable after creation)
    if old["payment_status"] == "UNPAID" and instance.payment_status == "UNPAID":
        return  # no revenue impact

    # Generic: subtract old revenue contribution, add new revenue contribution
    updates: dict = {}
    _apply_bill(updates, old,      sign=-1)
    _apply_bill(updates, instance, sign=+1)

    if updates:
        Metrics.objects.filter(pk=1).update(**updates)


# ── post_delete ───────────────────────────────────────────────────────────────

@receiver(post_delete, sender=Bill)
def _bill_post_delete(sender, instance, **kwargs):
    # rebuild() recounts ALL bills (handles count decrement) and recalculates
    # all revenue buckets, avoiding potential CHECK constraint violations.
    Metrics.rebuild()
