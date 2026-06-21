from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("billing", "0002_servicerate"),
    ]

    operations = [
        # Bill type
        migrations.AddField(
            model_name="bill",
            name="bill_type",
            field=models.CharField(
                choices=[("IPD", "In-Patient (IPD)"), ("OPD", "Out-Patient (OPD)")],
                db_index=True,
                default="IPD",
                max_length=3,
            ),
        ),
        # admitted_on: was NOT NULL, now nullable for OPD
        migrations.AlterField(
            model_name="bill",
            name="admitted_on",
            field=models.DateField(blank=True, null=True),
        ),
        # ipd_no: allow null so we can auto-assign
        migrations.AlterField(
            model_name="bill",
            name="ipd_no",
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        # OPD fields
        migrations.AddField(
            model_name="bill",
            name="opd_no",
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name="bill",
            name="visit_date",
            field=models.DateField(blank=True, null=True),
        ),
        # Discount
        migrations.AddField(
            model_name="bill",
            name="discount",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name="bill",
            name="discount_note",
            field=models.TextField(blank=True, default=""),
        ),
        # Meta ordering
        migrations.AlterModelOptions(
            name="bill",
            options={"ordering": ["-created_at"]},
        ),
    ]
