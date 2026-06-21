from django.urls import path

from .views import (
    BillDetailAPIView,
    BillListCreateAPIView,
    BillPaymentAPIView,
    MetricsAPIView,
    MetricsRefreshAPIView,
    ServiceRateDetailAPIView,
    ServiceRateListCreateAPIView,
)

urlpatterns = [
    # ── Bills ────────────────────────────────────────────────────────────────
    path("bills/", BillListCreateAPIView.as_view(), name="bill-list-create"),
    path("bills/<int:pk>/", BillDetailAPIView.as_view(), name="bill-detail"),
    path("bills/<int:pk>/payment/", BillPaymentAPIView.as_view(), name="bill-payment"),
    # ── Service Rates ─────────────────────────────────────────────────────────
    path("rates/", ServiceRateListCreateAPIView.as_view(), name="rate-list-create"),
    path("rates/<int:pk>/", ServiceRateDetailAPIView.as_view(), name="rate-detail"),
    # ── Metrics ───────────────────────────────────────────────────────────────
    path("metrics/",         MetricsAPIView.as_view(),        name="metrics"),
    path("metrics/refresh/", MetricsRefreshAPIView.as_view(), name="metrics-refresh"),
]
