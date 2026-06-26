"""
0025 – Add queue_item_id to Queue; create PatientObservation,
       PatientPrescription, and PatientVisit tables.
"""
import django.db.models.deletion
from django.db import migrations, models


def backfill_queue_item_id(apps, schema_editor):
    """Set queue_item_id = pk for every existing Queue row."""
    Queue = apps.get_model("billing", "Queue")
    for q in Queue.objects.filter(queue_item_id__isnull=True):
        q.queue_item_id = q.pk
        q.save(update_fields=["queue_item_id"])


class Migration(migrations.Migration):
    dependencies = [
        ("billing", "0024_bill_patient_fk"),
    ]

    operations = [
        # ── Queue: add queue_item_id ─────────────────────────────────────────
        migrations.AddField(
            model_name="queue",
            name="queue_item_id",
            field=models.BigIntegerField(db_index=True, null=True, unique=True),
        ),
        migrations.RunPython(backfill_queue_item_id, migrations.RunPython.noop),

        # ── PatientObservation ───────────────────────────────────────────────
        migrations.CreateModel(
            name="PatientObservation",
            fields=[
                ("observation_id", models.BigAutoField(primary_key=True, serialize=False)),
                ("observation", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "patient",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="observations",
                        to="billing.patientbasicprofile",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),

        # ── PatientPrescription ──────────────────────────────────────────────
        migrations.CreateModel(
            name="PatientPrescription",
            fields=[
                ("prescription_id", models.BigAutoField(primary_key=True, serialize=False)),
                ("items", models.JSONField(default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "patient",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="prescriptions",
                        to="billing.patientbasicprofile",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),

        # ── PatientVisit ─────────────────────────────────────────────────────
        migrations.CreateModel(
            name="PatientVisit",
            fields=[
                ("visit_id", models.BigAutoField(primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "patient",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="visits",
                        to="billing.patientbasicprofile",
                    ),
                ),
                (
                    "queue_item",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="visit",
                        to="billing.queue",
                    ),
                ),
                (
                    "observation",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="visit",
                        to="billing.patientobservation",
                    ),
                ),
                (
                    "prescription",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="visit",
                        to="billing.patientprescription",
                    ),
                ),
                (
                    "bill",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="visit",
                        to="billing.bill",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
