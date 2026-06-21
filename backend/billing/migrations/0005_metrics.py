from decimal import Decimal
from django.db import migrations, models


def seed_metrics(apps, schema_editor):
    """Populate the singleton row from existing bills (safe on empty DB too)."""
    Bill = apps.get_model("billing", "Bill")
    Metrics = apps.get_model("billing", "Metrics")
    from django.db.models import Sum

    ipd = Bill.objects.filter(bill_type="IPD").count()
    opd = Bill.objects.filter(bill_type="OPD").count()
    total = Bill.objects.aggregate(s=Sum("net_bill"))["s"] or Decimal("0.00")
    Metrics.objects.update_or_create(
        pk=1,
        defaults={
            "total_ipd_bills": ipd,
            "total_opd_bills": opd,
            "total_collected": total,
        },
    )


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0004_bill_gender_mobile"),
    ]

    operations = [
        migrations.CreateModel(
            name="Metrics",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("total_ipd_bills", models.PositiveIntegerField(default=0)),
                ("total_opd_bills", models.PositiveIntegerField(default=0)),
                (
                    "total_collected",
                    models.DecimalField(
                        decimal_places=2,
                        default=Decimal("0.00"),
                        max_digits=14,
                    ),
                ),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name_plural": "metrics",
            },
        ),
        migrations.RunPython(seed_metrics, migrations.RunPython.noop),
    ]
