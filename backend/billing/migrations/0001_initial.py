import decimal

from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Bill",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("patient_name", models.CharField(max_length=200)),
                ("address", models.TextField(blank=True)),
                ("ipd_no", models.CharField(blank=True, max_length=50)),
                ("admitted_on", models.DateField()),
                ("discharged_on", models.DateField(blank=True, null=True)),
                ("room_no", models.CharField(blank=True, max_length=20)),
                ("ward", models.CharField(blank=True, max_length=50)),
                ("total_stay", models.PositiveIntegerField(default=0)),
                ("line_items", models.JSONField(default=list)),
                (
                    "total_bill",
                    models.DecimalField(decimal_places=2, default=decimal.Decimal("0.00"), max_digits=12),
                ),
                (
                    "advance_paid",
                    models.DecimalField(decimal_places=2, default=decimal.Decimal("0.00"), max_digits=12),
                ),
                (
                    "net_bill",
                    models.DecimalField(decimal_places=2, default=decimal.Decimal("0.00"), max_digits=12),
                ),
                ("remote_row_ref", models.CharField(blank=True, max_length=120)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
    ]
