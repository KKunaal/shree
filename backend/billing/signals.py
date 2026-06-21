"""
Signals that keep the Metrics singleton in sync with the Bill table.

  • Bill created  → increment the right count, add net_bill to total_collected
  • Bill updated  → diff old vs new bill_type / net_bill, apply only the delta
  • Bill deleted  → decrement the right count, subtract net_bill from total_collected

All writes are single atomic SQL UPDATE statements using F() expressions so
there are no read-modify-write races even under concurrent requests.
"""

from django.db.models import F
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from .models import Bill, Metrics


def _count_field(bill_type: str) -> str:
    """Return the Metrics field name for the given bill type."""
    return "total_ipd_bills" if bill_type == "IPD" else "total_opd_bills"


def _ensure() -> None:
    """Guarantee the singleton row exists (safety net; migration seeds it)."""
    Metrics.objects.get_or_create(pk=1)


# ── pre_save: snapshot DB state before any update ────────────────────────────

@receiver(pre_save, sender=Bill)
def _capture_bill_state(sender, instance, **kwargs):
    """
    For updates (instance.pk exists), read the current DB values so post_save
    can compute the exact delta.  Stored on the instance as _pre_state.
    """
    if not instance.pk:
        instance._pre_state = None   # new bill — nothing to diff
        return
    try:
        instance._pre_state = Bill.objects.values(
            "bill_type", "net_bill"
        ).get(pk=instance.pk)
    except Bill.DoesNotExist:
        instance._pre_state = None


# ── post_save ─────────────────────────────────────────────────────────────────

@receiver(post_save, sender=Bill)
def _bill_post_save(sender, instance, created, **kwargs):
    _ensure()

    if created:
        # ── New bill: add count + full net_bill ───────────────────────────────
        cf = _count_field(instance.bill_type)
        Metrics.objects.filter(pk=1).update(
            **{cf: F(cf) + 1},
            total_collected=F("total_collected") + instance.net_bill,
        )
        return

    # ── Existing bill updated: apply only what changed ────────────────────────
    old = getattr(instance, "_pre_state", None)
    if old is None:
        # Edge case (e.g. pk collision, bulk op) — fall back to full rebuild
        Metrics.rebuild()
        return

    updates: dict = {}

    # bill_type changed (rare, but possible)
    if old["bill_type"] != instance.bill_type:
        old_cf = _count_field(old["bill_type"])
        new_cf = _count_field(instance.bill_type)
        updates[old_cf] = F(old_cf) - 1
        updates[new_cf] = F(new_cf) + 1

    # net_bill changed
    net_delta = instance.net_bill - old["net_bill"]
    if net_delta:
        updates["total_collected"] = F("total_collected") + net_delta

    if updates:
        Metrics.objects.filter(pk=1).update(**updates)


# ── post_delete ───────────────────────────────────────────────────────────────

@receiver(post_delete, sender=Bill)
def _bill_post_delete(sender, instance, **kwargs):
    _ensure()
    cf = _count_field(instance.bill_type)
    Metrics.objects.filter(pk=1).update(
        **{cf: F(cf) - 1},
        total_collected=F("total_collected") - instance.net_bill,
    )
