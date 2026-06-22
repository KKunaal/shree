from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0009_bill_height"),
    ]

    operations = [
        migrations.AddField(
            model_name="bill",
            name="age",
            field=models.PositiveSmallIntegerField(
                blank=True,
                help_text="Patient age in years",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="bill",
            name="pulse_rate",
            field=models.PositiveSmallIntegerField(
                blank=True,
                help_text="Patient pulse rate in bpm",
                null=True,
            ),
        ),
    ]
