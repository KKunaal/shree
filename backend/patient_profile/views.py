from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from billing.authentication import FixedBasicAuthentication
from billing.models import (
    PatientBasicProfile,
    PatientObservation,
    PatientPrescription,
    PatientVisit,
    Queue,
)
from billing.serializers import PatientBasicProfileSerializer

from .serializers import (
    PatientObservationSerializer,
    PatientPrescriptionSerializer,
    PatientVisitSerializer,
)


class VisitPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/profile/?queue_item_id=<id>
# ─────────────────────────────────────────────────────────────────────────────

class PatientProfileView(APIView):
    """
    Returns the patient's basic profile, plus the observation and prescription
    linked to the PatientVisit associated with the given queue_item_id.
    Also returns visit_id so the frontend can save obs/prescription back.
    """
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queue_item_id = request.query_params.get("queue_item_id")
        if not queue_item_id:
            return Response({"error": "queue_item_id is required"}, status=400)

        # queue_item_id == pk (set by post_save signal)
        queue = get_object_or_404(
            Queue.objects.select_related("patient"),
            pk=queue_item_id,
        )

        # Get (or auto-create) the PatientVisit for this queue entry
        visit = (
            PatientVisit.objects
            .select_related("observation", "prescription", "bill")
            .filter(queue_item=queue)
            .first()
        )

        return Response({
            "patient": PatientBasicProfileSerializer(queue.patient).data,
            "visit_id": visit.visit_id if visit else None,
            "observation": (
                PatientObservationSerializer(visit.observation).data
                if visit and visit.observation else None
            ),
            "prescription": (
                PatientPrescriptionSerializer(visit.prescription).data
                if visit and visit.prescription else None
            ),
        })


# ─────────────────────────────────────────────────────────────────────────────
# Observation endpoints
# ─────────────────────────────────────────────────────────────────────────────

class ObservationCreateView(APIView):
    """POST /api/profile/observation/  → create and link to visit"""
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        visit_id = request.data.get("visit_id")
        patient_id = request.data.get("patient_id")
        observation_text = request.data.get("observation", "")

        patient = get_object_or_404(PatientBasicProfile, pk=patient_id)
        visit = get_object_or_404(PatientVisit, pk=visit_id)

        obs = PatientObservation.objects.create(
            patient=patient,
            observation=observation_text,
        )
        visit.observation = obs
        visit.save(update_fields=["observation", "updated_at"])

        return Response(PatientObservationSerializer(obs).data, status=201)


class ObservationDetailView(APIView):
    """PATCH /api/profile/observation/<obs_id>/  → update text"""
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated]

    def patch(self, request, obs_id):
        obs = get_object_or_404(PatientObservation, pk=obs_id)
        obs.observation = request.data.get("observation", obs.observation)
        obs.save(update_fields=["observation", "updated_at"])
        return Response(PatientObservationSerializer(obs).data)


# ─────────────────────────────────────────────────────────────────────────────
# Prescription endpoints
# ─────────────────────────────────────────────────────────────────────────────

class PrescriptionCreateView(APIView):
    """POST /api/profile/prescription/  → create and link to visit"""
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        visit_id = request.data.get("visit_id")
        patient_id = request.data.get("patient_id")
        items = request.data.get("items", [])

        patient = get_object_or_404(PatientBasicProfile, pk=patient_id)
        visit = get_object_or_404(PatientVisit, pk=visit_id)

        prescription = PatientPrescription.objects.create(patient=patient, items=items)
        visit.prescription = prescription
        visit.save(update_fields=["prescription", "updated_at"])

        return Response(PatientPrescriptionSerializer(prescription).data, status=201)


class PrescriptionDetailView(APIView):
    """PATCH /api/profile/prescription/<presc_id>/  → update items"""
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated]

    def patch(self, request, presc_id):
        prescription = get_object_or_404(PatientPrescription, pk=presc_id)
        if "items" in request.data:
            prescription.items = request.data["items"]
        prescription.save(update_fields=["items", "updated_at"])
        return Response(PatientPrescriptionSerializer(prescription).data)


# ─────────────────────────────────────────────────────────────────────────────
# Visit endpoints
# ─────────────────────────────────────────────────────────────────────────────

class PatientVisitListView(generics.ListAPIView):
    """GET /api/profile/visits/?patient_id=<id>  → paginated visit history"""
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = PatientVisitSerializer
    pagination_class = VisitPagination

    def get_queryset(self):
        patient_id = self.request.query_params.get("patient_id")
        if not patient_id:
            return PatientVisit.objects.none()
        return (
            PatientVisit.objects
            .filter(patient_id=patient_id)
            .select_related("observation", "prescription", "bill", "queue_item")
            .order_by("-created_at")
        )


class PatientVisitDetailView(generics.RetrieveAPIView):
    """GET /api/profile/visits/<visit_id>/  → single visit with all nested data"""
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = PatientVisitSerializer
    queryset = (
        PatientVisit.objects
        .select_related("observation", "prescription", "bill", "queue_item")
        .all()
    )
    lookup_field = "visit_id"


class PatientVisitCreateView(APIView):
    """POST /api/profile/visits/  → manually create a visit"""
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        patient_id = request.data.get("patient_id")
        queue_item_id = request.data.get("queue_item_id")

        patient = get_object_or_404(PatientBasicProfile, pk=patient_id)
        queue = (
            get_object_or_404(Queue, pk=queue_item_id)
            if queue_item_id else None
        )

        visit, _ = PatientVisit.objects.get_or_create(
            queue_item=queue,
            defaults={"patient": patient},
        ) if queue else (PatientVisit.objects.create(patient=patient), True)

        return Response(PatientVisitSerializer(visit).data, status=201)
