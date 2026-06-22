from decimal import Decimal

from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated, BasePermission
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .authentication import FixedBasicAuthentication
from .models import Bill, Metrics, PatientBasicProfile, Queue, ServiceRate
from .serializers import (
    BillPaymentSerializer, BillSerializer,
    PatientBasicProfileSerializer, QueueSerializer, ServiceRateSerializer,
)

_auth = {
    "authentication_classes": [FixedBasicAuthentication],
    "permission_classes": [IsAuthenticated],
}


class IsDoctor(BasePermission):
    """Allow access only to users with role == 'doctor'."""
    message = "Only doctors can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "role", None) == "doctor"
        )


class BillPagination(PageNumberPagination):
    """Return 10 bills per page; consumer can override via ?page_size=N (max 100)."""
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


class ServiceRateListCreateAPIView(generics.ListCreateAPIView):
    """
    GET  /api/rates/  → list all service rates          (doctor only)
    POST /api/rates/  → create a new service rate       (doctor only)
    """
    serializer_class = ServiceRateSerializer
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated, IsDoctor]

    def get_queryset(self):
        qs = ServiceRate.objects.all()
        category = self.request.query_params.get("category")
        is_active = self.request.query_params.get("is_active")
        if category:
            qs = qs.filter(category=category.upper())
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == "true")
        return qs


class ServiceRateDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/rates/<id>/  → retrieve        (doctor only)
    PUT    /api/rates/<id>/  → full update     (doctor only)
    PATCH  /api/rates/<id>/  → partial update  (doctor only)
    DELETE /api/rates/<id>/  → delete          (doctor only)
    """
    queryset = ServiceRate.objects.all()
    serializer_class = ServiceRateSerializer
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated, IsDoctor]


class BillListCreateAPIView(generics.ListCreateAPIView):
    """
    GET  /api/bills/          → paginated list (10/page)
                                ?page=N          — page number (default 1)
                                ?search=q        — filter by patient_name / ipd_no /
                                                   opd_no / mobile_no (case-insensitive)
                                ?bill_type=IPD|OPD — filter by type
    POST /api/bills/          → create a new bill
    """
    serializer_class = BillSerializer
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated]
    pagination_class = BillPagination

    def get_queryset(self):
        qs = Bill.objects.all().order_by("-created_at")

        bill_type = self.request.query_params.get("bill_type", "").upper()
        if bill_type in ("IPD", "OPD"):
            qs = qs.filter(bill_type=bill_type)

        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(patient_name__icontains=search)
                | Q(ipd_no__icontains=search)
                | Q(opd_no__icontains=search)
                | Q(mobile_no__icontains=search)
            )

        return qs

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        # Append overall counts (unaffected by search / bill_type filter)
        # so the frontend can always show accurate tab-pill totals.
        response.data["summary"] = {
            "ipd": Bill.objects.filter(bill_type="IPD").count(),
            "opd": Bill.objects.filter(bill_type="OPD").count(),
        }
        return response


class BillDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/bills/<id>/  → retrieve             (doctor + reception)
    PUT    /api/bills/<id>/  → full update           (doctor + reception)
    PATCH  /api/bills/<id>/  → partial update        (doctor + reception)
    DELETE /api/bills/<id>/  → delete bill           (doctor only)
    """
    queryset = Bill.objects.all()
    serializer_class = BillSerializer
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated]

    def destroy(self, request, *args, **kwargs):
        if not getattr(request.user, "is_doctor", False):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only doctors can delete bills.")
        return super().destroy(request, *args, **kwargs)


class MetricsAPIView(APIView):
    """
    GET /api/metrics/   (doctor only)
    """
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated, IsDoctor]

    def get(self, request):
        today = timezone.localdate()
        m = Metrics.instance()

        today_paid = Bill.objects.filter(created_at__date=today, payment_status="PAID")
        today_agg = today_paid.aggregate(
            total=Sum("net_bill"),
            cash=Sum("net_bill", filter=Q(paid_via="CASH")),
            upi=Sum("net_bill", filter=Q(paid_via="UPI")),
            online=Sum("net_bill", filter=Q(paid_via="ONLINE")),
        )
        Z = Decimal("0.00")

        return Response({
            # ── all-time (from Metrics table, PAID only) ──────────────────────
            "total_ipd_bills":  m.total_ipd_bills,
            "total_opd_bills":  m.total_opd_bills,
            "total_collected":  str(m.total_collected),
            "total_cash":       str(m.total_cash),
            "total_upi":        str(m.total_upi),
            "total_online":     str(m.total_online),
            # ── today (live, PAID only) ───────────────────────────────────────
            "today_ipd_bills":  today_paid.filter(bill_type="IPD").count(),
            "today_opd_bills":  today_paid.filter(bill_type="OPD").count(),
            "today_collected":  str(today_agg["total"]  or Z),
            "today_cash":       str(today_agg["cash"]   or Z),
            "today_upi":        str(today_agg["upi"]    or Z),
            "today_online":     str(today_agg["online"] or Z),
            # ── meta ──────────────────────────────────────────────────────────
            "as_of":            today.isoformat(),
            "metrics_updated_at": m.updated_at,
        })


class BillPaymentAPIView(APIView):
    """
    PATCH /api/bills/<id>/payment/

    Update only payment_status and/or paid_via for a single bill.
    Returns the full updated bill so the frontend can refresh its local state
    in a single round-trip.

    Body (all fields optional):
        { "payment_status": "PAID" | "UNPAID",
          "paid_via":       "CASH" | "UPI" | "ONLINE" }
    """
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        from django.shortcuts import get_object_or_404
        bill = get_object_or_404(Bill, pk=pk)
        payment_ser = BillPaymentSerializer(bill, data=request.data, partial=True)
        payment_ser.is_valid(raise_exception=True)
        payment_ser.save()
        # Return the full bill so the frontend can update its state directly
        return Response(BillSerializer(bill).data)


class MetricsRefreshAPIView(APIView):
    """
    GET /api/metrics/refresh/   (doctor only)
    """
    CACHE_TTL_SECONDS = 60
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated, IsDoctor]

    def get(self, request):
        from datetime import timedelta

        m = Metrics.instance()
        age_seconds = (timezone.now() - m.updated_at).total_seconds()

        if age_seconds <= self.CACHE_TTL_SECONDS:
            from_cache = True
        else:
            m = Metrics.rebuild()
            from_cache = False

        today = timezone.localdate()
        today_paid = Bill.objects.filter(created_at__date=today, payment_status="PAID")
        today_agg = today_paid.aggregate(
            total=Sum("net_bill"),
            cash=Sum("net_bill", filter=Q(paid_via="CASH")),
            upi=Sum("net_bill", filter=Q(paid_via="UPI")),
            online=Sum("net_bill", filter=Q(paid_via="ONLINE")),
        )
        Z = Decimal("0.00")

        return Response({
            # ── all-time (freshly rebuilt or from cache) ──────────────────────
            "total_ipd_bills":  m.total_ipd_bills,
            "total_opd_bills":  m.total_opd_bills,
            "total_collected":  str(m.total_collected),
            "total_cash":       str(m.total_cash),
            "total_upi":        str(m.total_upi),
            "total_online":     str(m.total_online),
            # ── today (always live) ───────────────────────────────────────────
            "today_ipd_bills":  today_paid.filter(bill_type="IPD").count(),
            "today_opd_bills":  today_paid.filter(bill_type="OPD").count(),
            "today_collected":  str(today_agg["total"]  or Z),
            "today_cash":       str(today_agg["cash"]   or Z),
            "today_upi":        str(today_agg["upi"]    or Z),
            "today_online":     str(today_agg["online"] or Z),
            # ── meta ──────────────────────────────────────────────────────────
            "as_of":            today.isoformat(),
            "metrics_updated_at": m.updated_at,
            "from_cache":       from_cache,
            "cache_ttl_seconds": self.CACHE_TTL_SECONDS,
        })


# ── Patient Basic Profile ──────────────────────────────────────────────────


class PatientBasicProfileListCreateAPIView(generics.ListCreateAPIView):
    """
    GET  /api/patients/   → list all profiles  (?search=name/mobile)
    POST /api/patients/   → create profile + auto-add to today's queue
    """
    serializer_class = PatientBasicProfileSerializer
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = PatientBasicProfile.objects.all()
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(patient_name__icontains=search) | Q(mobile_no__icontains=search)
            )
        return qs

    def perform_create(self, serializer):
        profile = serializer.save()
        Queue.objects.create(
            patient=profile,
            queue_number=Queue.next_number_for_today(),
        )


class PatientBasicProfileDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/patients/<pk>/  → retrieve
    PATCH  /api/patients/<pk>/  → partial update
    DELETE /api/patients/<pk>/  → delete
    """
    queryset = PatientBasicProfile.objects.all()
    serializer_class = PatientBasicProfileSerializer
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated]


# ── Queue ──────────────────────────────────────────────────────────────────


class QueueListCreateAPIView(generics.ListCreateAPIView):
    """
    GET  /api/queue/   → today's queue  (?date=YYYY-MM-DD  ?status=WAITING)
    POST /api/queue/   → manually create a queue entry (rarely needed)
    """
    serializer_class = QueueSerializer
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        date_str = self.request.query_params.get("date")
        date = date_str or str(timezone.localdate())
        qs = Queue.objects.filter(date=date).select_related("patient")
        status = self.request.query_params.get("status")
        if status:
            qs = qs.filter(status=status.upper())
        return qs


class QueueDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/queue/<pk>/  → retrieve
    PATCH  /api/queue/<pk>/  → update status / patient
    DELETE /api/queue/<pk>/  → remove from queue
    """
    queryset = Queue.objects.select_related("patient").all()
    serializer_class = QueueSerializer
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated]

