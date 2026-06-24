from django.urls import path

from .views import (
    BillCollectPartialAPIView,
    BillDetailAPIView,
    BillListCreateAPIView,
    BillPaymentAPIView,
    ChangePasswordAPIView,
    MetricsAPIView,
    MetricsRefreshAPIView,
    PartialCollectExecuteAPIView,
    PartialCollectRequestDetailAPIView,
    PatientBasicProfileDetailAPIView,
    PatientBasicProfileListCreateAPIView,
    QueueDetailAPIView,
    QueueListCreateAPIView,
    QueueMoveDownAPIView,
    QueueMoveUpAPIView,
    ServiceRateDetailAPIView,
    ServiceRateListCreateAPIView,
    UserDetailAPIView,
    UserListCreateAPIView,
)

urlpatterns = [
    # ── Bills ────────────────────────────────────────────────────────────────
    path("bills/", BillListCreateAPIView.as_view(), name="bill-list-create"),
    path("bills/<int:pk>/", BillDetailAPIView.as_view(), name="bill-detail"),
    path("bills/<int:pk>/payment/", BillPaymentAPIView.as_view(), name="bill-payment"),
    path("bills/<int:pk>/collect-partial/", BillCollectPartialAPIView.as_view(), name="bill-collect-partial"),
    # ── Partial Collect Requests ──────────────────────────────────────────────
    path("collect-partial/<int:pk>/", PartialCollectRequestDetailAPIView.as_view(), name="collect-partial-detail"),
    path("collect-partial/<int:pk>/execute/", PartialCollectExecuteAPIView.as_view(), name="collect-partial-execute"),
    # ── Service Rates ─────────────────────────────────────────────────────────
    path("rates/", ServiceRateListCreateAPIView.as_view(), name="rate-list-create"),
    path("rates/<int:pk>/", ServiceRateDetailAPIView.as_view(), name="rate-detail"),
    # ── Metrics ───────────────────────────────────────────────────────────────
    path("metrics/",         MetricsAPIView.as_view(),        name="metrics"),
    path("metrics/refresh/", MetricsRefreshAPIView.as_view(), name="metrics-refresh"),
    # ── Patient Basic Profile ─────────────────────────────────────────────────
    path("patients/", PatientBasicProfileListCreateAPIView.as_view(), name="patient-list-create"),
    path("patients/<int:pk>/", PatientBasicProfileDetailAPIView.as_view(), name="patient-detail"),
    # ── Queue ─────────────────────────────────────────────────────────────────
    path("queue/", QueueListCreateAPIView.as_view(), name="queue-list"),
    path("queue/<int:pk>/", QueueDetailAPIView.as_view(), name="queue-detail"),
    path("queue/<int:pk>/move-up/",   QueueMoveUpAPIView.as_view(),   name="queue-move-up"),
    path("queue/<int:pk>/move-down/", QueueMoveDownAPIView.as_view(), name="queue-move-down"),
    # ── User Management ───────────────────────────────────────────────────────
    path("users/", UserListCreateAPIView.as_view(), name="user-list-create"),
    path("users/<int:pk>/", UserDetailAPIView.as_view(), name="user-detail"),
    path("users/change-password/", ChangePasswordAPIView.as_view(), name="change-password"),
]
