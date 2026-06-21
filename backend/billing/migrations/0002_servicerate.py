from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("billing", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ServiceRate",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("name", models.CharField(max_length=200, unique=True)),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("OPD", "OPD"),
                            ("IPD", "IPD"),
                            ("ROOM", "Room"),
                            ("PROCEDURE", "Procedure"),
                            ("NURSING", "Nursing"),
                            ("OTHER", "Other"),
                        ],
                        default="OTHER",
                        max_length=20,
                    ),
                ),
                (
                    "default_rate",
                    models.DecimalField(decimal_places=2, max_digits=12),
                ),
                (
                    "unit",
                    models.CharField(
                        default="per visit",
                        help_text='e.g. "per visit", "per day", "per procedure"',
                        max_length=50,
                    ),
                ),
                ("is_active", models.BooleanField(default=True)),
                ("description", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["category", "name"],
            },
        ),
    ]
