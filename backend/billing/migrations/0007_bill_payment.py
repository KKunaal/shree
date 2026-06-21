from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0006_bill_weight"),
    ]

    operations = [
        migrations.AddField(
            model_name="bill",
            name="payment_status",
            field=models.CharField(
                choices=[("UNPAID", "Unpaid"), ("PAID", "Paid")],
                default="UNPAID",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="bill",
            name="paid_via",
            field=models.CharField(
                choices=[("CASH", "Cash"), ("UPI", "UPI"), ("ONLINE", "Online")],
                default="UPI",
                max_length=10,
            ),
        ),
    ]
