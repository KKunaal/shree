from rest_framework import serializers

from billing.models import Bill, PatientBasicProfile, PatientObservation, PatientPrescription, PatientVisit
from billing.serializers import PatientBasicProfileSerializer


class PatientObservationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientObservation
        fields = ["observation_id", "patient", "observation", "created_at", "updated_at"]
        read_only_fields = ("observation_id", "created_at", "updated_at")


class PatientPrescriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientPrescription
        fields = ["prescription_id", "patient", "items", "created_at", "updated_at"]
        read_only_fields = ("prescription_id", "created_at", "updated_at")


class BillSummarySerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.patient_name", read_only=True)

    class Meta:
        model = Bill
        fields = [
            "id", "bill_type", "ipd_no", "opd_no",
            "line_items", "total_bill", "advance_paid", "net_bill",
            "payment_status", "paid_via", "created_at", "patient_name",
        ]


class PatientVisitSerializer(serializers.ModelSerializer):
    observation = PatientObservationSerializer(read_only=True)
    prescription = PatientPrescriptionSerializer(read_only=True)
    bill = BillSummarySerializer(read_only=True)
    queue_item_id = serializers.SerializerMethodField()

    class Meta:
        model = PatientVisit
        fields = [
            "visit_id", "patient", "queue_item_id",
            "observation", "prescription", "bill",
            "created_at", "updated_at",
        ]

    def get_queue_item_id(self, obj):
        return obj.queue_item.queue_item_id if obj.queue_item else None


class PatientProfileResponseSerializer(serializers.Serializer):
    """Shape returned by GET /api/profile/?queue_item_id=X"""
    patient = PatientBasicProfileSerializer()
    visit_id = serializers.IntegerField(allow_null=True)
    observation = PatientObservationSerializer(allow_null=True)
    prescription = PatientPrescriptionSerializer(allow_null=True)
