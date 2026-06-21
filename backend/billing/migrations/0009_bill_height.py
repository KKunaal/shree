from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0008_metrics_payment_breakdown"),
    ]

    operations = [
        migrations.AddField(
            model_name="bill",
            name="height",
            field=models.DecimalField(
                blank=True,
                decimal_places=1,
                help_text="Patient height in cm",
                max_digits=5,
                null=True,
            ),
        ),
    ]
