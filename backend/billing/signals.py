"""
Signals that keep the Metrics singleton in sync with the Bill table.

ONLY PAID bills are counted.  Transitions handled:

  Bill created as PAID   → add count + revenue
  Bill created as UNPAID → no-op (metrics unchanged)
  UNPAID → PAID          → add count + revenue
  PAID   → UNPAID        → subtract count + revenue
  PAID   → PAID (paid_via changed)  → swap method buckets, adjust totals
  PAID   → PAID (net_bill changed)  → adjust totals + method bucket
  PAID   → PAID (bill_type changed) → swap count field
  Bill deleted (was PAID)  → subtract count + revenue
  Bill deleted (was UNPAID)→ no-op

All writes use atomic F() expressions — no read-modify-write races.
"""

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


def _ensure() -> None:
    Metrics.objects.get_or_create(pk=1)


# ── pre_save: snapshot before update ─────────────────────────────────────────

@receiver(pre_save, sender=Bill)
def _capture_bill_state(sender, instance, **kwargs):
    if not instance.pk:
        instance._pre_state = None  # new bill
        return
    try:
        instance._pre_state = Bill.objects.values(
            "bill_type", "net_bill", "payment_status", "paid_via"
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
            return  # unpaid bills don't touch metrics
        cf = _count_field(instance.bill_type)
        vf = _via_field(instance.paid_via)
        Metrics.objects.filter(pk=1).update(
            **{cf: F(cf) + 1,
               "total_collected": F("total_collected") + instance.net_bill,
               vf: F(vf) + instance.net_bill},
        )
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
        # ── UNPAID → PAID: add everything ─────────────────────────────────────
        cf = _count_field(instance.bill_type)
        vf = _via_field(instance.paid_via)
        updates[cf]               = F(cf) + 1
        updates["total_collected"] = F("total_collected") + instance.net_bill
        updates[vf]               = F(vf) + instance.net_bill

    elif was_paid and not is_paid:
        # ── PAID → UNPAID: subtract everything ───────────────────────────────
        cf = _count_field(old["bill_type"])
        vf = _via_field(old["paid_via"])
        updates[cf]               = F(cf) - 1
        updates["total_collected"] = F("total_collected") - old["net_bill"]
        updates[vf]               = F(vf) - old["net_bill"]

    else:
        # ── PAID → PAID: diff individual fields ───────────────────────────────
        old_bill_type = old["bill_type"]
        old_paid_via  = old["paid_via"]
        old_net       = old["net_bill"]
        new_net       = instance.net_bill

        # bill_type changed (rare)
        if old_bill_type != instance.bill_type:
            updates[_count_field(old_bill_type)]     = F(_count_field(old_bill_type))     - 1
            updates[_count_field(instance.bill_type)] = F(_count_field(instance.bill_type)) + 1

        if old_paid_via != instance.paid_via:
            # Method bucket swap — use old net for old bucket, new net for new bucket
            old_vf = _via_field(old_paid_via)
            new_vf = _via_field(instance.paid_via)
            updates[old_vf] = F(old_vf) - old_net
            updates[new_vf] = F(new_vf) + new_net
            # Adjust overall total for any net change
            net_delta = new_net - old_net
            if net_delta:
                updates["total_collected"] = F("total_collected") + net_delta
        else:
            # Method unchanged — just adjust delta
            net_delta = new_net - old_net
            if net_delta:
                vf = _via_field(instance.paid_via)
                updates["total_collected"] = F("total_collected") + net_delta
                updates[vf]               = F(vf) + net_delta

    if updates:
        Metrics.objects.filter(pk=1).update(**updates)


# ── post_delete ───────────────────────────────────────────────────────────────

@receiver(post_delete, sender=Bill)
def _bill_post_delete(sender, instance, **kwargs):
    if instance.payment_status != "PAID":
        return  # unpaid bills never touched metrics
    _ensure()
    cf = _count_field(instance.bill_type)
    vf = _via_field(instance.paid_via)
    Metrics.objects.filter(pk=1).update(
        **{cf: F(cf) - 1,
           "total_collected": F("total_collected") - instance.net_bill,
           vf: F(vf) - instance.net_bill},
    )
