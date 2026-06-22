"""
Signals that keep the Metrics singleton in sync with the Bill table.

ONLY PAID bills are counted.  Transitions handled:

  Bill created as PAID   → add count + revenue
  Bill created as UNPAID → no-op
  UNPAID → PAID          → add count + revenue
  PAID   → UNPAID        → subtract count + revenue
  PAID   → PAID          → subtract old, add new (handles every field change)
  Bill deleted (was PAID)  → full rebuild (avoids negative-count race)
  Bill deleted (was UNPAID)→ no-op

Revenue is split by payment mode:
  advance_paid → advance_paid_via bucket  (collected by reception)
  net_bill     → paid_via bucket          (collected by doctor at checkout)

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


def _apply_revenue(updates: dict, advance: Decimal, net: Decimal,
                   adv_via: str, net_via: str, sign: int) -> None:
    """Route advance to adv_via bucket and net to net_via bucket."""
    _add_to(updates, "total_collected", sign * (advance + net))
    _add_to(updates, _via_field(adv_via), sign * advance)
    _add_to(updates, _via_field(net_via), sign * net)


def _parts(bill) -> tuple:
    """Return (advance, net, adv_via, net_via) from a Bill instance."""
    return (
        Decimal(str(bill.advance_paid)),
        Decimal(str(bill.net_bill)),
        bill.advance_paid_via or "CASH",
        bill.paid_via,
    )


def _parts_from_state(state: dict) -> tuple:
    """Return (advance, net, adv_via, net_via) from a pre_save snapshot dict.
    Uses .get() with a safe default for advance_paid_via so legacy rows
    (saved before the field was added) don't raise KeyError."""
    return (
        Decimal(str(state["advance_paid"])),
        Decimal(str(state["net_bill"])),
        state.get("advance_paid_via") or "CASH",
        state["paid_via"],
    )


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
            "payment_status", "paid_via",
        ).get(pk=instance.pk)
    except Bill.DoesNotExist:
        instance._pre_state = None


# ── post_save ─────────────────────────────────────────────────────────────────

@receiver(post_save, sender=Bill)
def _bill_post_save(sender, instance, created, **kwargs):
    _ensure()

    # ── New bill ──────────────────────────────────────────────────────────────
    if created:
        if instance.payment_status != "PAID":
            return
        advance, net, adv_via, net_via = _parts(instance)
        updates = {_count_field(instance.bill_type): F(_count_field(instance.bill_type)) + 1}
        _apply_revenue(updates, advance, net, adv_via, net_via, sign=1)
        Metrics.objects.filter(pk=1).update(**updates)
        return

    # ── Updated bill ──────────────────────────────────────────────────────────
    old = getattr(instance, "_pre_state", None)
    if old is None:
        Metrics.rebuild()
        return

    was_paid = old["payment_status"] == "PAID"
    is_paid  = instance.payment_status == "PAID"

    if not was_paid and not is_paid:
        return  # both unpaid → no metrics change

    updates: dict = {}

    if not was_paid and is_paid:
        # UNPAID → PAID: add new values
        advance, net, adv_via, net_via = _parts(instance)
        _add_to(updates, _count_field(instance.bill_type), 1)
        _apply_revenue(updates, advance, net, adv_via, net_via, sign=1)

    elif was_paid and not is_paid:
        # PAID → UNPAID: subtract old values
        advance, net, adv_via, net_via = _parts_from_state(old)
        _add_to(updates, _count_field(old["bill_type"]), -1)
        _apply_revenue(updates, advance, net, adv_via, net_via, sign=-1)

    else:
        # PAID → PAID: subtract old completely, add new completely
        # (handles any combination of field changes in one atomic op)
        old_adv, old_net, old_adv_via, old_net_via = _parts_from_state(old)
        new_adv, new_net, new_adv_via, new_net_via = _parts(instance)
        _add_to(updates, _count_field(old["bill_type"]), -1)
        _apply_revenue(updates, old_adv, old_net, old_adv_via, old_net_via, sign=-1)
        _add_to(updates, _count_field(instance.bill_type), 1)
        _apply_revenue(updates, new_adv, new_net, new_adv_via, new_net_via, sign=1)

    if updates:
        Metrics.objects.filter(pk=1).update(**updates)


# ── post_delete ───────────────────────────────────────────────────────────────

@receiver(post_delete, sender=Bill)
def _bill_post_delete(sender, instance, **kwargs):
    if instance.payment_status != "PAID":
        return
    # Use rebuild() rather than F()-decrement to avoid CHECK constraint
    # violations when the Metrics table is out of sync with the Bills table.
    Metrics.rebuild()

