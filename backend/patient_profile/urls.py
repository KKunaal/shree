from django.urls import path

from .views import (
    ObservationCreateView,
    ObservationDetailView,
    PatientProfileView,
    PatientVisitCreateView,
    PatientVisitDetailView,
    PatientVisitListView,
    PrescriptionCreateView,
    PrescriptionDetailView,
)

urlpatterns = [
    # Profile lookup by queue_item_id
    path("", PatientProfileView.as_view(), name="patient-profile"),
    # Observation
    path("observation/", ObservationCreateView.as_view(), name="observation-create"),
    path("observation/<int:obs_id>/", ObservationDetailView.as_view(), name="observation-detail"),
    # Prescription
    path("prescription/", PrescriptionCreateView.as_view(), name="prescription-create"),
    path("prescription/<int:presc_id>/", PrescriptionDetailView.as_view(), name="prescription-detail"),
    # Visits
    path("visits/", PatientVisitListView.as_view(), name="visit-list"),
    path("visits/create/", PatientVisitCreateView.as_view(), name="visit-create"),
    path("visits/<int:visit_id>/", PatientVisitDetailView.as_view(), name="visit-detail"),
]
