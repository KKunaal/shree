from django.urls import path

from .views import (
    BillDetailAPIView,
    BillListCreateAPIView,
    ServiceRateDetailAPIView,
    ServiceRateListCreateAPIView,
)

urlpatterns = [
    # ── Bills ────────────────────────────────────────────────────────────────
    path("bills/", BillListCreateAPIView.as_view(), name="bill-list-create"),
    path("bills/<int:pk>/", BillDetailAPIView.as_view(), name="bill-detail"),
    # ── Service Rates ─────────────────────────────────────────────────────────
    path("rates/", ServiceRateListCreateAPIView.as_view(), name="rate-list-create"),
    path("rates/<int:pk>/", ServiceRateDetailAPIView.as_view(), name="rate-detail"),
]
