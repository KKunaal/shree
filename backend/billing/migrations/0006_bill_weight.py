from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0005_metrics"),
    ]

    operations = [
        migrations.AddField(
            model_name="bill",
            name="weight",
            field=models.DecimalField(
                blank=True,
                decimal_places=1,
                help_text="Patient weight in kg",
                max_digits=5,
                null=True,
            ),
        ),
    ]
