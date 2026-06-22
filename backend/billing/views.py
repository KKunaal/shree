from decimal import Decimal

from django.db.models import DecimalField, ExpressionWrapper, F, Q, Sum
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

# Revenue per bill = advance already collected + remaining balance paid.
# This equals total_bill - discount (net of discount only, not advance).
_REVENUE = ExpressionWrapper(
    F("advance_paid") + F("net_bill"),
    output_field=DecimalField(max_digits=14, decimal_places=2),
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
        today_partial = Bill.objects.filter(created_at__date=today, payment_status="PARTIAL")

        today_agg = today_paid.aggregate(
            total=Sum(_REVENUE),
            cash_adv=Sum("advance_paid", filter=Q(advance_paid_via="CASH")),
            upi_adv=Sum("advance_paid",  filter=Q(advance_paid_via="UPI")),
            online_adv=Sum("advance_paid", filter=Q(advance_paid_via="ONLINE")),
            cash_net=Sum("net_bill", filter=Q(paid_via="CASH")),
            upi_net=Sum("net_bill",  filter=Q(paid_via="UPI")),
            online_net=Sum("net_bill", filter=Q(paid_via="ONLINE")),
        )
        partial_agg = today_partial.aggregate(
            total_partial=Sum("advance_paid"),
            cash_adv=Sum("advance_paid", filter=Q(advance_paid_via="CASH")),
            upi_adv=Sum("advance_paid",  filter=Q(advance_paid_via="UPI")),
            online_adv=Sum("advance_paid", filter=Q(advance_paid_via="ONLINE")),
        )
        Z = Decimal("0.00")

        return Response({
            # ── all-time (from Metrics table) ─────────────────────────────────
            "total_ipd_bills":          m.total_ipd_bills,
            "total_opd_bills":          m.total_opd_bills,
            "total_collected":          str(m.total_collected),
            "total_cash":               str(m.total_cash),
            "total_upi":                str(m.total_upi),
            "total_online":             str(m.total_online),
            "total_partial_bills":      m.total_partial_bills,
            "total_partial_collected":  str(m.total_partial_collected),
            # ── today (live) ─────────────────────────────────────────────────
            "today_ipd_bills":    today_paid.filter(bill_type="IPD").count(),
            "today_opd_bills":    today_paid.filter(bill_type="OPD").count(),
            "today_collected":    str(today_agg["total"] or Z),
            "today_cash":         str((today_agg["cash_adv"] or Z) + (today_agg["cash_net"] or Z)
                                      + (partial_agg["cash_adv"] or Z)),
            "today_upi":          str((today_agg["upi_adv"]  or Z) + (today_agg["upi_net"]  or Z)
                                      + (partial_agg["upi_adv"] or Z)),
            "today_online":       str((today_agg["online_adv"] or Z) + (today_agg["online_net"] or Z)
                                      + (partial_agg["online_adv"] or Z)),
            "today_partial_bills":     today_partial.count(),
            "today_partial_collected": str(partial_agg["total_partial"] or Z),
            # ── meta ─────────────────────────────────────────────────────────
            "as_of":              today.isoformat(),
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


class BillCollectPartialAPIView(APIView):
    """
    POST /api/bills/<id>/collect-partial/   (doctor only)

    Splits a bill's net payable into two parts:
      • Original bill: total_bill & net_bill each reduced by `amount`,
                       payment_status → PARTIAL
      • New bill:      duplicate patient info, single line item for `amount`,
                       net_bill = amount, payment_status = UNPAID

    Body: { "amount": "250.00" }
    Returns: { "original": <bill>, "new_bill": <bill> }

    Constraints:
      - bill must be UNPAID
      - 0 < amount < bill.net_bill
    """
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated, IsDoctor]

    def post(self, request, pk):
        from django.db import transaction
        from django.shortcuts import get_object_or_404

        bill = get_object_or_404(Bill, pk=pk)

        if bill.payment_status != Bill.PaymentStatus.UNPAID:
            return Response(
                {"detail": "Only UNPAID bills can be split. Change status to UNPAID first."},
                status=400,
            )

        try:
            amount = Decimal(str(request.data.get("amount") or "0")).quantize(Decimal("0.01"))
        except Exception:
            return Response({"detail": "Invalid amount."}, status=400)

        if amount <= Decimal("0"):
            return Response({"detail": "Amount must be greater than zero."}, status=400)

        net = Decimal(str(bill.net_bill))
        if amount >= net:
            return Response(
                {"detail": f"Amount must be less than the net payable of {net}."},
                status=400,
            )

        with transaction.atomic():
            # ── 1. Reduce original bill & mark PARTIAL ────────────────────────
            # Reduce both total_bill and net_bill so the invariant
            # net_bill = total_bill - advance_paid - discount stays intact.
            bill.total_bill = (Decimal(str(bill.total_bill)) - amount).quantize(Decimal("0.01"))
            bill.net_bill   = (net - amount).quantize(Decimal("0.01"))
            bill.payment_status = Bill.PaymentStatus.PARTIAL
            bill.save()  # pre_save/post_save signals update Metrics

            # ── 2. Auto-assign next bill number ───────────────────────────────
            field = "ipd_no" if bill.bill_type == "IPD" else "opd_no"
            existing = (
                Bill.objects
                .filter(bill_type=bill.bill_type)
                .exclude(**{f"{field}__isnull": True})
                .select_for_update()
                .values_list(field, flat=True)
            )
            max_val = 0
            for val in existing:
                try:
                    max_val = max(max_val, int(val))
                except (ValueError, TypeError):
                    pass
            new_bill_no = str(max_val + 1)

            # ── 3. Create new UNPAID bill for the split amount ─────────────────
            new_kwargs = dict(
                bill_type       = bill.bill_type,
                patient_name    = bill.patient_name,
                address         = bill.address,
                mobile_no       = bill.mobile_no,
                gender          = bill.gender,
                age             = bill.age,
                weight          = bill.weight,
                height          = bill.height,
                pulse_rate      = bill.pulse_rate,
                line_items      = [{
                    "name":         f"Partial Collection for {bill.bill_type} #{bill.opd_no if bill.bill_type == 'OPD' else bill.ipd_no}",
                    "rate_per_day": str(amount),
                    "days":         1,
                    "amount":       str(amount),
                }],
                total_bill      = amount,
                advance_paid    = Decimal("0.00"),
                advance_paid_via= bill.advance_paid_via,
                net_bill        = amount,
                payment_status  = Bill.PaymentStatus.UNPAID,
                paid_via        = bill.paid_via,
            )
            if bill.bill_type == "IPD":
                new_kwargs.update(
                    ipd_no       = new_bill_no,
                    admitted_on  = bill.admitted_on,
                    discharged_on= bill.discharged_on,
                    room_no      = bill.room_no,
                    ward         = bill.ward,
                    total_stay   = bill.total_stay,
                )
            else:
                new_kwargs.update(
                    opd_no    = new_bill_no,
                    visit_date= bill.visit_date,
                )

            new_bill = Bill.objects.create(**new_kwargs)
            # new_bill is UNPAID → no Metrics update fired

        return Response(
            {
                "original": BillSerializer(bill).data,
                "new_bill": BillSerializer(new_bill).data,
            },
            status=201,
        )


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
        today_paid    = Bill.objects.filter(created_at__date=today, payment_status="PAID")
        today_partial = Bill.objects.filter(created_at__date=today, payment_status="PARTIAL")

        today_agg = today_paid.aggregate(
            total=Sum(_REVENUE),
            cash_adv=Sum("advance_paid", filter=Q(advance_paid_via="CASH")),
            upi_adv=Sum("advance_paid",  filter=Q(advance_paid_via="UPI")),
            online_adv=Sum("advance_paid", filter=Q(advance_paid_via="ONLINE")),
            cash_net=Sum("net_bill", filter=Q(paid_via="CASH")),
            upi_net=Sum("net_bill",  filter=Q(paid_via="UPI")),
            online_net=Sum("net_bill", filter=Q(paid_via="ONLINE")),
        )
        partial_agg = today_partial.aggregate(
            total_partial=Sum("advance_paid"),
            cash_adv=Sum("advance_paid", filter=Q(advance_paid_via="CASH")),
            upi_adv=Sum("advance_paid",  filter=Q(advance_paid_via="UPI")),
            online_adv=Sum("advance_paid", filter=Q(advance_paid_via="ONLINE")),
        )
        Z = Decimal("0.00")

        return Response({
            # ── all-time (freshly rebuilt or from cache) ──────────────────────
            "total_ipd_bills":          m.total_ipd_bills,
            "total_opd_bills":          m.total_opd_bills,
            "total_collected":          str(m.total_collected),
            "total_cash":               str(m.total_cash),
            "total_upi":                str(m.total_upi),
            "total_online":             str(m.total_online),
            "total_partial_bills":      m.total_partial_bills,
            "total_partial_collected":  str(m.total_partial_collected),
            # ── today (always live) ───────────────────────────────────────────
            "today_ipd_bills":    today_paid.filter(bill_type="IPD").count(),
            "today_opd_bills":    today_paid.filter(bill_type="OPD").count(),
            "today_collected":    str(today_agg["total"] or Z),
            "today_cash":         str((today_agg["cash_adv"] or Z) + (today_agg["cash_net"] or Z)
                                      + (partial_agg["cash_adv"] or Z)),
            "today_upi":          str((today_agg["upi_adv"]  or Z) + (today_agg["upi_net"]  or Z)
                                      + (partial_agg["upi_adv"] or Z)),
            "today_online":       str((today_agg["online_adv"] or Z) + (today_agg["online_net"] or Z)
                                      + (partial_agg["online_adv"] or Z)),
            "today_partial_bills":     today_partial.count(),
            "today_partial_collected": str(partial_agg["total_partial"] or Z),
            # ── meta ──────────────────────────────────────────────────────────
            "as_of":              today.isoformat(),
            "metrics_updated_at": m.updated_at,
            "from_cache":         from_cache,
            "cache_ttl_seconds":  self.CACHE_TTL_SECONDS,
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
        q = self.request.data.get("queue", {})
        Queue.objects.create(
            patient=profile,
            queue_number=Queue.next_number_for_today(),
            reception_bill_type=q.get("reception_bill_type", "OPD"),
            reception_line_items=q.get("reception_line_items", []),
            reception_amount_collected=q.get("reception_amount_collected") or "0.00",
            reception_paid_via=q.get("reception_paid_via", "CASH"),
        )

    def create(self, request, *args, **kwargs):
        """Override to return the created Queue entry (with nested patient) instead of
        just the PatientBasicProfile, so the frontend gets queue_id and reception data."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        queue_entry = (
            Queue.objects.select_related("patient")
            .filter(patient=serializer.instance)
            .order_by("-created_at")
            .first()
        )
        return Response(QueueSerializer(queue_entry).data, status=201)


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


class QueueMoveUpAPIView(APIView):
    """
    POST /api/queue/<pk>/move-up/
    Swap this entry's queue_number with the entry immediately above it
    (same date, next-lower queue_number).
    Returns { moved, displaced } — the two updated entries.
    """
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        from django.db import transaction
        from django.shortcuts import get_object_or_404
        from django.db.models import Max

        item = get_object_or_404(Queue.objects.select_related("patient"), pk=pk)

        # Entry immediately above: same date, highest queue_number still below item's
        prev = (
            Queue.objects.filter(date=item.date, queue_number__lt=item.queue_number)
            .order_by("-queue_number")
            .first()
        )

        if prev is None:
            return Response({"detail": "Already first in queue."}, status=400)

        with transaction.atomic():
            # Temp number far above any real number to sidestep unique_together
            temp = (
                Queue.objects.filter(date=item.date)
                .aggregate(max_no=Max("queue_number"))["max_no"]
                + 1000
            )
            orig_item_no = item.queue_number
            orig_prev_no = prev.queue_number

            item.queue_number = temp
            item.save(update_fields=["queue_number"])
            prev.queue_number = orig_item_no
            prev.save(update_fields=["queue_number"])
            item.queue_number = orig_prev_no
            item.save(update_fields=["queue_number"])

        # Re-fetch with patient select_related so serializer has full data
        item = Queue.objects.select_related("patient").get(pk=item.pk)
        prev = Queue.objects.select_related("patient").get(pk=prev.pk)

        return Response({
            "moved":     QueueSerializer(item).data,
            "displaced": QueueSerializer(prev).data,
        })


class QueueMoveDownAPIView(APIView):
    """
    POST /api/queue/<pk>/move-down/
    Swap this entry's queue_number with the entry immediately below it
    (same date, next-higher queue_number).
    Returns { moved, displaced } — the two updated entries.
    """
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        from django.db import transaction
        from django.shortcuts import get_object_or_404
        from django.db.models import Max

        item = get_object_or_404(Queue.objects.select_related("patient"), pk=pk)

        # Entry immediately below: same date, lowest queue_number still above item's
        nxt = (
            Queue.objects.filter(date=item.date, queue_number__gt=item.queue_number)
            .order_by("queue_number")
            .first()
        )

        if nxt is None:
            return Response({"detail": "Already last in queue."}, status=400)

        with transaction.atomic():
            temp = (
                Queue.objects.filter(date=item.date)
                .aggregate(max_no=Max("queue_number"))["max_no"]
                + 1000
            )
            orig_item_no = item.queue_number
            orig_nxt_no  = nxt.queue_number

            item.queue_number = temp
            item.save(update_fields=["queue_number"])
            nxt.queue_number = orig_item_no
            nxt.save(update_fields=["queue_number"])
            item.queue_number = orig_nxt_no
            item.save(update_fields=["queue_number"])

        item = Queue.objects.select_related("patient").get(pk=item.pk)
        nxt  = Queue.objects.select_related("patient").get(pk=nxt.pk)

        return Response({
            "moved":     QueueSerializer(item).data,
            "displaced": QueueSerializer(nxt).data,
        })

