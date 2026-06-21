"""
0008 — add per-method revenue columns to Metrics; recompute from PAID bills.

All three new columns default to 0.00.  The data migration also recomputes
total_ipd_bills, total_opd_bills, and total_collected so they reflect PAID
bills only (previously they counted every bill regardless of payment status).
"""

from decimal import Decimal
from django.db import migrations, models


def _recompute_from_paid(apps, schema_editor):
    """Recompute every Metrics column from PAID bills only."""
    from django.db.models import Q, Sum

    Bill = apps.get_model("billing", "Bill")
    Metrics = apps.get_model("billing", "Metrics")

    paid = Bill.objects.filter(payment_status="PAID")
    agg = paid.aggregate(
        total=Sum("net_bill"),
        cash=Sum("net_bill", filter=Q(paid_via="CASH")),
        upi=Sum("net_bill", filter=Q(paid_via="UPI")),
        online=Sum("net_bill", filter=Q(paid_via="ONLINE")),
    )
    Z = Decimal("0.00")

    Metrics.objects.update_or_create(
        pk=1,
        defaults={
            "total_ipd_bills": paid.filter(bill_type="IPD").count(),
            "total_opd_bills": paid.filter(bill_type="OPD").count(),
            "total_collected": agg["total"]  or Z,
            "total_cash":      agg["cash"]   or Z,
            "total_upi":       agg["upi"]    or Z,
            "total_online":    agg["online"] or Z,
        },
    )


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0007_bill_payment"),
    ]

    operations = [
        migrations.AddField(
            model_name="metrics",
            name="total_cash",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=14),
        ),
        migrations.AddField(
            model_name="metrics",
            name="total_upi",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=14),
        ),
        migrations.AddField(
            model_name="metrics",
            name="total_online",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=14),
        ),
        migrations.RunPython(_recompute_from_paid, migrations.RunPython.noop),
    ]
