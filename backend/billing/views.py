from decimal import Decimal

from django.db.models import Q
from django.utils import timezone
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated, BasePermission
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .authentication import FixedBasicAuthentication
from .models import Bill, Metrics, PatientBasicProfile, PartialCollectRequest, Queue, ServiceRate
from .serializers import (
    BillSerializer,
    PartialCollectRequestSerializer,
    PatientBasicProfileSerializer, QueueSerializer, ServiceRateSerializer,
)

_auth = {
    "authentication_classes": [FixedBasicAuthentication],
    "permission_classes": [IsAuthenticated],
}


def _today_stats(today):
    """
    Compute today's metrics by iterating bills in Python.

    Counts : ALL bills created today regardless of payment status.
    Collected: cash + upi + online actually received today (PAID + PARTIAL).
               today_collected is derived as the sum of the three method buckets.
    """
    Z = Decimal("0.00")
    _via = {"CASH": "today_cash", "UPI": "today_upi", "ONLINE": "today_online"}

    s = {
        "today_ipd_bills":     0,
        "today_opd_bills":     0,
        "today_collected":     Z,
        "today_cash":          Z,
        "today_upi":           Z,
        "today_online":        Z,
        "today_partial_bills": 0,
        "today_unsettled":     Z,
    }

    # ── Count ALL bills created today (any payment status) ───────────────────
    for b in Bill.objects.filter(created_at__date=today).values("bill_type"):
        s["today_ipd_bills" if b["bill_type"] == "IPD" else "today_opd_bills"] += 1

    # ── Revenue from PAID bills ───────────────────────────────────────────────
    for b in Bill.objects.filter(
        created_at__date=today, payment_status="PAID"
    ).values(
        "advance_paid", "advance_paid_via",
        "net_bill", "paid_via", "partially_collected",
    ):
        adv = Decimal(str(b["advance_paid"] or "0"))
        net = Decimal(str(b["net_bill"] or "0"))
        s[_via.get(b.get("advance_paid_via") or "CASH", "today_upi")] += adv
        s[_via.get(b.get("paid_via") or "UPI", "today_upi")] += net
        for e in (b.get("partially_collected") or []):
            s[_via.get(e.get("payment_method", "CASH"), "today_upi")] += Decimal(str(e.get("amount", "0")))

    # ── Revenue from PARTIAL bills ────────────────────────────────────────────
    for b in Bill.objects.filter(
        created_at__date=today, payment_status="PARTIAL"
    ).values(
        "advance_paid", "advance_paid_via",
        "partially_collected", "net_bill",
    ):
        adv = Decimal(str(b["advance_paid"] or "0"))
        s["today_partial_bills"] += 1
        s["today_unsettled"] += Decimal(str(b.get("net_bill") or "0"))
        s[_via.get(b.get("advance_paid_via") or "CASH", "today_upi")] += adv
        for e in (b.get("partially_collected") or []):
            s[_via.get(e.get("payment_method", "CASH"), "today_upi")] += Decimal(str(e.get("amount", "0")))

    # ── Total collected = all money actually received through any method ──────
    s["today_collected"] = s["today_cash"] + s["today_upi"] + s["today_online"]
    return s


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
    GET  /api/rates/  → list all service rates   (any authenticated user)
    POST /api/rates/  → create a new service rate (doctor only)
    """
    serializer_class = ServiceRateSerializer
    authentication_classes = [FixedBasicAuthentication]

    def get_permissions(self):
        if self.request.method in ("GET", "HEAD", "OPTIONS"):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsDoctor()]

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
    GET    /api/rates/<id>/  → retrieve        (any authenticated user)
    PUT    /api/rates/<id>/  → full update     (doctor only)
    PATCH  /api/rates/<id>/  → partial update  (doctor only)
    DELETE /api/rates/<id>/  → delete          (doctor only)
    """
    queryset = ServiceRate.objects.all()
    serializer_class = ServiceRateSerializer
    authentication_classes = [FixedBasicAuthentication]

    def get_permissions(self):
        if self.request.method in ("GET", "HEAD", "OPTIONS"):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsDoctor()]


class BillListCreateAPIView(generics.ListCreateAPIView):
    """
    GET  /api/bills/          → paginated list (10/page)
                                ?page=N               — page number (default 1)
                                ?search=q             — filter by patient_name / ipd_no /
                                                        opd_no / mobile_no (case-insensitive)
                                ?bill_type=IPD|OPD    — filter by type
                                ?payment_status=PAID|UNPAID|PARTIAL — filter by payment status
                                ?date=YYYY-MM-DD      — filter bills created on a specific date
                                ?date_from=YYYY-MM-DD — filter bills created on or after date
                                ?date_to=YYYY-MM-DD   — filter bills created on or before date
    POST /api/bills/          → create a new bill
    """
    serializer_class = BillSerializer
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated]
    pagination_class = BillPagination

    def get_queryset(self):
        from datetime import date as _date
        qs = Bill.objects.all().order_by("-created_at")

        bill_type = self.request.query_params.get("bill_type", "").upper()
        if bill_type in ("IPD", "OPD"):
            qs = qs.filter(bill_type=bill_type)

        payment_status = self.request.query_params.get("payment_status", "").upper()
        if payment_status in ("PAID", "UNPAID", "PARTIAL"):
            qs = qs.filter(payment_status=payment_status)

        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(patient_name__icontains=search)
                | Q(ipd_no__icontains=search)
                | Q(opd_no__icontains=search)
                | Q(mobile_no__icontains=search)
            )

        date_str = self.request.query_params.get("date", "").strip()
        date_from_str = self.request.query_params.get("date_from", "").strip()
        date_to_str = self.request.query_params.get("date_to", "").strip()

        if date_str:
            try:
                qs = qs.filter(created_at__date=_date.fromisoformat(date_str))
            except ValueError:
                pass
        else:
            if date_from_str:
                try:
                    qs = qs.filter(created_at__date__gte=_date.fromisoformat(date_from_str))
                except ValueError:
                    pass
            if date_to_str:
                try:
                    qs = qs.filter(created_at__date__lte=_date.fromisoformat(date_to_str))
                except ValueError:
                    pass

        return qs

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        # Append overall counts (unaffected by search / active filters)
        # so the frontend can always show accurate quick-filter totals.
        response.data["summary"] = {
            "ipd":     Bill.objects.filter(bill_type="IPD").count(),
            "opd":     Bill.objects.filter(bill_type="OPD").count(),
            "paid":    Bill.objects.filter(payment_status="PAID").count(),
            "unpaid":  Bill.objects.filter(payment_status="UNPAID").count(),
            "partial": Bill.objects.filter(payment_status="PARTIAL").count(),
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
        t = _today_stats(today)

        return Response({
            # ── all-time (from Metrics table) ─────────────────────────────────
            "total_ipd_bills":          m.total_ipd_bills,
            "total_opd_bills":          m.total_opd_bills,
            "total_collected":          str(m.total_collected),
            "total_cash":               str(m.total_cash),
            "total_upi":                str(m.total_upi),
            "total_online":             str(m.total_online),
            "total_partial_bills":      m.total_partial_bills,
            "total_unsettled":          str(m.total_unsettled),
            # ── today (live) ─────────────────────────────────────────────────
            "today_ipd_bills":         t["today_ipd_bills"],
            "today_opd_bills":         t["today_opd_bills"],
            "today_collected":         str(t["today_collected"]),
            "today_cash":              str(t["today_cash"]),
            "today_upi":               str(t["today_upi"]),
            "today_online":            str(t["today_online"]),
            "today_partial_bills":     t["today_partial_bills"],
            "today_unsettled":         str(t["today_unsettled"]),
            # ── meta ─────────────────────────────────────────────────────────
            "as_of":              today.isoformat(),
            "metrics_updated_at": m.updated_at,
        })


class BillPaymentAPIView(APIView):
    """
    PATCH /api/bills/<id>/payment/

    Update payment_status and/or paid_via for a single bill.
    Also recomputes net_bill to guarantee it reflects the correct formula:
        net_bill = total_bill − advance_paid − discount − total_partially_collected
    Fires pre_save/post_save signals exactly ONCE then calls Metrics.rebuild()
    for a guaranteed-correct metrics state.
    Returns the full updated bill.

    Body (all fields optional):
        { "payment_status": "PAID" | "UNPAID",
          "paid_via":       "CASH" | "UPI" | "ONLINE" }
    """
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        from django.shortcuts import get_object_or_404

        bill = get_object_or_404(Bill, pk=pk)

        # ── Validate + apply incoming fields ─────────────────────────────────
        payment_status = request.data.get("payment_status")
        paid_via       = request.data.get("paid_via")

        if payment_status is not None:
            if payment_status not in Bill.PaymentStatus.values:
                return Response({"detail": "Invalid payment_status."}, status=400)
            bill.payment_status = payment_status

        if paid_via is not None:
            if paid_via not in Bill.PaidVia.values:
                return Response({"detail": "Invalid paid_via."}, status=400)
            bill.paid_via = paid_via

        # ── Auto-manage callout ───────────────────────────────────────────────
        if bill.payment_status == Bill.PaymentStatus.PAID:
            bill.callout = "Bill settled"
        elif bill.callout == "Bill settled":
            bill.callout = ""

        # ── Recompute net_bill (guarantees formula correctness) ───────────────
        # net_bill = positive charges − advance − discount − partial collections
        pos_total = sum(
            Decimal(str(i.get("amount", "0")))
            for i in (bill.line_items or [])
            if Decimal(str(i.get("amount", "0"))) > Decimal("0")
        )
        advance   = Decimal(str(bill.advance_paid or "0"))
        discount  = Decimal(str(bill.discount or "0"))
        total_pc  = Decimal(str(bill.total_partially_collected or "0"))
        bill.total_bill = pos_total.quantize(Decimal("0.01"))
        bill.net_bill   = (pos_total - advance - discount - total_pc).quantize(Decimal("0.01"))

        # ── Single save: fires pre_save + post_save signals once ──────────────
        bill.save()

        # Explicit full rebuild guarantees metrics correctness regardless of
        # incremental signal state (cold worker, stale snapshot, etc.)
        Metrics.rebuild()

        # Refresh to get the authoritative DB state before responding
        bill.refresh_from_db()
        return Response(BillSerializer(bill).data)


class BillCollectPartialAPIView(APIView):
    """
    POST /api/bills/<id>/collect-partial/   (doctor only)

    Creates a PartialCollectRequest for the bill. The doctor sets the amount;
    reception later executes it choosing payment method.

    Body:   { "amount": "250.00" }
    Returns: updated bill (with new PCR nested in partial_collect_requests)

    Constraints:  bill must not be PAID · 0 < amount < bill.net_bill
    """
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated, IsDoctor]

    def post(self, request, pk):
        from django.shortcuts import get_object_or_404

        bill = get_object_or_404(Bill, pk=pk)

        if bill.payment_status == Bill.PaymentStatus.PAID:
            return Response(
                {"detail": "Cannot add a collect request to an already-paid bill."},
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

        orig_no = bill.opd_no if bill.bill_type == "OPD" else bill.ipd_no
        label   = f"Partial Collection for {bill.bill_type} #{orig_no}"

        PartialCollectRequest.objects.create(
            bill=bill,
            collect_amount=amount,
            collect_label=label,
        )
        bill.refresh_from_db()
        return Response(BillSerializer(bill).data, status=201)


class PartialCollectRequestDetailAPIView(APIView):
    """
    PATCH  /api/collect-partial/<id>/   (doctor only) — update amount
    DELETE /api/collect-partial/<id>/   (doctor only) — cancel request
    """
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated, IsDoctor]

    def patch(self, request, pk):
        from django.shortcuts import get_object_or_404

        pcr = get_object_or_404(PartialCollectRequest, pk=pk)
        try:
            amount = Decimal(str(request.data.get("amount") or "0")).quantize(Decimal("0.01"))
        except Exception:
            return Response({"detail": "Invalid amount."}, status=400)

        if amount <= Decimal("0"):
            return Response({"detail": "Amount must be greater than zero."}, status=400)

        net = Decimal(str(pcr.bill.net_bill))
        if amount >= net:
            return Response(
                {"detail": f"Amount must be less than the net payable of {net}."},
                status=400,
            )

        orig_no = pcr.bill.opd_no if pcr.bill.bill_type == "OPD" else pcr.bill.ipd_no
        pcr.collect_amount = amount
        pcr.collect_label  = f"Partial Collection for {pcr.bill.bill_type} #{orig_no}"
        pcr.save()
        pcr.bill.refresh_from_db()
        return Response(BillSerializer(pcr.bill).data)

    def delete(self, request, pk):
        from django.shortcuts import get_object_or_404

        pcr  = get_object_or_404(PartialCollectRequest, pk=pk)
        bill = pcr.bill
        pcr.delete()
        bill.refresh_from_db()
        return Response(BillSerializer(bill).data)


class PartialCollectExecuteAPIView(APIView):
    """
    POST /api/collect-partial/<id>/execute/   (doctor + reception)

    Executes a pending PartialCollectRequest:
      • Appends a negative audit line item to bill.line_items
      • Appends an entry to bill.partially_collected  {amount, payment_method, payment_text, collected_at}
      • Increments bill.total_partially_collected
      • Recomputes bill.total_bill (positive items only) and bill.net_bill
      • Sets bill.payment_status → PARTIAL
      • Sets bill.callout → "Partially collected"
      • Deletes the PartialCollectRequest
      • Calls Metrics.rebuild() to keep metrics in sync

    Body: { "paid_via": "CASH" | "UPI" | "ONLINE" }
    Returns: updated bill
    """
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        from django.shortcuts import get_object_or_404

        pcr  = get_object_or_404(PartialCollectRequest, pk=pk)
        bill = pcr.bill

        if bill.payment_status == Bill.PaymentStatus.PAID:
            return Response({"detail": "Bill is already paid."}, status=400)

        paid_via = request.data.get("paid_via", "CASH")
        if paid_via not in ("CASH", "UPI", "ONLINE"):
            return Response({"detail": "Invalid paid_via."}, status=400)

        amount = Decimal(str(pcr.collect_amount))
        net    = Decimal(str(bill.net_bill))

        if amount >= net:
            return Response(
                {"detail": f"Collect amount {amount} exceeds current net payable {net}."},
                status=400,
            )

        label = pcr.collect_label or "Partial collection"

        # ── 1. Audit line item (negative, for display) ────────────────────────
        bill.line_items = list(bill.line_items) + [{
            "name":         label,
            "rate_per_day": str(-amount),
            "days":         1,
            "amount":       str(-amount),
        }]

        # ── 2. Record in partially_collected list ─────────────────────────────
        entry = {
            "amount":         str(amount),
            "payment_method": paid_via,
            "payment_text":   label,
            "collected_at":   timezone.now().isoformat(),
        }
        bill.partially_collected = list(bill.partially_collected or []) + [entry]

        # ── 3. Update total_partially_collected ───────────────────────────────
        new_total_pc = (
            Decimal(str(bill.total_partially_collected or "0")) + amount
        ).quantize(Decimal("0.01"))
        bill.total_partially_collected = new_total_pc

        # ── 4. Recompute total_bill (positive items only) and net_bill ────────
        pos_total = sum(
            Decimal(str(i.get("amount", "0")))
            for i in bill.line_items
            if Decimal(str(i.get("amount", "0"))) > Decimal("0")
        )
        bill.total_bill = pos_total.quantize(Decimal("0.01"))
        discount = Decimal(str(bill.discount or "0"))
        advance  = Decimal(str(bill.advance_paid or "0"))
        bill.net_bill = (pos_total - advance - discount - new_total_pc).quantize(Decimal("0.01"))

        # ── 5. Status + callout ───────────────────────────────────────────────
        bill.payment_status = Bill.PaymentStatus.PARTIAL
        bill.callout        = "Partially collected"
        bill.save()  # fires pre_save/post_save signals

        # Explicit full rebuild guarantees correctness regardless of signal state
        Metrics.rebuild()

        pcr.delete()
        return Response(BillSerializer(bill).data)


class MetricsRefreshAPIView(APIView):
    """
    GET /api/metrics/refresh/   (doctor only)
    """
    CACHE_TTL_SECONDS = 60
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated, IsDoctor]

    def get(self, request):
        m = Metrics.instance()
        age_seconds = (timezone.now() - m.updated_at).total_seconds()

        if age_seconds <= self.CACHE_TTL_SECONDS:
            from_cache = True
        else:
            m = Metrics.rebuild()
            from_cache = False

        today = timezone.localdate()
        t = _today_stats(today)

        return Response({
            # ── all-time (freshly rebuilt or from cache) ──────────────────────
            "total_ipd_bills":          m.total_ipd_bills,
            "total_opd_bills":          m.total_opd_bills,
            "total_collected":          str(m.total_collected),
            "total_cash":               str(m.total_cash),
            "total_upi":                str(m.total_upi),
            "total_online":             str(m.total_online),
            "total_partial_bills":      m.total_partial_bills,
            "total_unsettled":          str(m.total_unsettled),
            # ── today (always live) ───────────────────────────────────────────
            "today_ipd_bills":         t["today_ipd_bills"],
            "today_opd_bills":         t["today_opd_bills"],
            "today_collected":         str(t["today_collected"]),
            "today_cash":              str(t["today_cash"]),
            "today_upi":               str(t["today_upi"]),
            "today_online":            str(t["today_online"]),
            "today_partial_bills":     t["today_partial_bills"],
            "today_unsettled":         str(t["today_unsettled"]),
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
    GET  /api/queue/   → today's queue
                         ?date=YYYY-MM-DD                 — defaults to today
                         ?status=WAITING|WITH_DOCTOR|DONE — filter by status
    POST /api/queue/   → manually create a queue entry (rarely needed)
    """
    serializer_class = QueueSerializer
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        date_str = self.request.query_params.get("date")
        date = date_str or str(timezone.localdate())
        qs = Queue.objects.filter(date=date).select_related("patient")
        status = self.request.query_params.get("status", "").upper()
        if status in ("WAITING", "WITH_DOCTOR", "DONE"):
            qs = qs.filter(status=status)
        return qs

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        date_str = request.query_params.get("date")
        date = date_str or str(timezone.localdate())
        base = Queue.objects.filter(date=date)
        summary = {
            "all":         base.count(),
            "waiting":     base.filter(status="WAITING").count(),
            "with_doctor": base.filter(status="WITH_DOCTOR").count(),
            "done":        base.filter(status="DONE").count(),
        }
        # Without pagination, response.data is a plain list — wrap it into a dict
        # so the frontend can read both results and summary from the same response.
        if isinstance(response.data, list):
            response.data = {"results": response.data, "summary": summary}
        else:
            response.data["summary"] = summary
        return response


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

