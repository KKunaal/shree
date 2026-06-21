from decimal import Decimal

from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .authentication import FixedBasicAuthentication
from .models import Bill, Metrics, ServiceRate
from .serializers import BillSerializer, ServiceRateSerializer

_auth = {
    "authentication_classes": [FixedBasicAuthentication],
    "permission_classes": [IsAuthenticated],
}


class BillPagination(PageNumberPagination):
    """Return 10 bills per page; consumer can override via ?page_size=N (max 100)."""
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


class ServiceRateListCreateAPIView(generics.ListCreateAPIView):
    """
    GET  /api/rates/  → list all service rates
                         ?category=OPD|IPD|ROOM|PROCEDURE|NURSING|OTHER
                         ?is_active=true|false
    POST /api/rates/  → create a new service rate
    """
    serializer_class = ServiceRateSerializer
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated]

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
    GET    /api/rates/<id>/  → retrieve
    PUT    /api/rates/<id>/  → full update
    PATCH  /api/rates/<id>/  → partial update
    DELETE /api/rates/<id>/  → delete
    """
    queryset = ServiceRate.objects.all()
    serializer_class = ServiceRateSerializer
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated]


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
    GET    /api/bills/<id>/  → retrieve a single bill
    PUT    /api/bills/<id>/  → full update (recomputes totals)
    PATCH  /api/bills/<id>/  → partial update
    DELETE /api/bills/<id>/  → delete bill (local DB only)
    """
    queryset = Bill.objects.all()
    serializer_class = BillSerializer
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated]


class MetricsAPIView(APIView):
    """
    GET /api/metrics/

    Returns two groups of metrics:
    • Cumulative (all-time): read from the Metrics singleton table, which is
      kept in sync by post_save / post_delete signals on Bill.
    • Today: computed on-the-fly from the Bills table filtered by today's date.
    """
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        m = Metrics.instance()

        today_qs = Bill.objects.filter(created_at__date=today)
        today_ipd = today_qs.filter(bill_type="IPD").count()
        today_opd = today_qs.filter(bill_type="OPD").count()
        today_collected = today_qs.aggregate(s=Sum("net_bill"))["s"] or Decimal("0.00")

        return Response({
            # ── cumulative (from Metrics table) ──────────────────────────────
            "total_ipd_bills":   m.total_ipd_bills,
            "total_opd_bills":   m.total_opd_bills,
            "total_collected":   str(m.total_collected),
            # ── today (live from Bills table) ────────────────────────────────
            "today_ipd_bills":   today_ipd,
            "today_opd_bills":   today_opd,
            "today_collected":   str(today_collected),
            # ── meta ─────────────────────────────────────────────────────────
            "as_of":             today.isoformat(),
            "metrics_updated_at": m.updated_at,
        })
