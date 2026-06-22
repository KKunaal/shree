from decimal import Decimal

from django.db import models
from django.utils import timezone


class ServiceRate(models.Model):
    """Configurable master list of hospital service charges."""

    class Category(models.TextChoices):
        OPD = "OPD", "OPD"
        IPD = "IPD", "IPD"
        ROOM = "ROOM", "Room"
        PROCEDURE = "PROCEDURE", "Procedure"
        NURSING = "NURSING", "Nursing"
        OTHER = "OTHER", "Other"

    name = models.CharField(max_length=200, unique=True)
    category = models.CharField(
        max_length=20, choices=Category.choices, default=Category.OTHER
    )
    default_rate = models.DecimalField(max_digits=12, decimal_places=2)
    unit = models.CharField(
        max_length=50,
        default="per visit",
        help_text='e.g. "per visit", "per day", "per procedure"',
    )
    is_active = models.BooleanField(default=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["category", "name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.category}) – ₹{self.default_rate}"


class Bill(models.Model):
    class BillType(models.TextChoices):
        IPD = "IPD", "In-Patient (IPD)"
        OPD = "OPD", "Out-Patient (OPD)"

    bill_type = models.CharField(
        max_length=3, choices=BillType.choices, default=BillType.IPD, db_index=True
    )
    patient_name = models.CharField(max_length=200)
    address = models.TextField(blank=True)
    mobile_no = models.CharField(max_length=15, blank=True)

    class Gender(models.TextChoices):
        MALE   = "M", "Male"
        FEMALE = "F", "Female"
        OTHER  = "O", "Other"

    gender = models.CharField(
        max_length=1, choices=Gender.choices, blank=True, default=""
    )
    weight = models.DecimalField(
        max_digits=5, decimal_places=1,
        null=True, blank=True,
        help_text="Patient weight in kg",
    )
    height = models.DecimalField(
        max_digits=5, decimal_places=1,
        null=True, blank=True,
        help_text="Patient height in cm",
    )
    age = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text="Patient age in years",
    )
    pulse_rate = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text="Patient pulse rate in bpm",
    )

    # ── IPD-specific ──────────────────────────────────────────────────────────
    ipd_no = models.CharField(max_length=50, blank=True, null=True)
    admitted_on = models.DateField(null=True, blank=True)
    discharged_on = models.DateField(null=True, blank=True)
    room_no = models.CharField(max_length=20, blank=True)
    ward = models.CharField(max_length=50, blank=True)
    total_stay = models.PositiveIntegerField(default=0)

    # ── OPD-specific ──────────────────────────────────────────────────────────
    opd_no = models.CharField(max_length=50, blank=True, null=True)
    visit_date = models.DateField(null=True, blank=True)

    # ── Billing ───────────────────────────────────────────────────────────────
    line_items = models.JSONField(default=list)
    total_bill = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    advance_paid = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    discount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    discount_note = models.TextField(blank=True)
    net_bill = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    # ── Partial collections ───────────────────────────────────────────────────
    # Each entry: {amount, payment_method, payment_text, collected_at}
    partially_collected = models.JSONField(
        default=list,
        help_text="Audit list of partial payments collected via reception.",
    )
    # Sum of all amounts in partially_collected (denormalised for fast reads)
    total_partially_collected = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )

    # ── Payment ───────────────────────────────────────────────────────────────
    class PaymentStatus(models.TextChoices):
        UNPAID  = "UNPAID",  "Unpaid"
        PARTIAL = "PARTIAL", "Partially Paid"
        PAID    = "PAID",    "Paid"

    class PaidVia(models.TextChoices):
        CASH   = "CASH",   "Cash"
        UPI    = "UPI",    "UPI"
        ONLINE = "ONLINE", "Online"

    payment_status = models.CharField(
        max_length=10, choices=PaymentStatus.choices, default=PaymentStatus.UNPAID
    )
    paid_via = models.CharField(
        max_length=10, choices=PaidVia.choices, default=PaidVia.UPI
    )
    # Payment mode used for the advance (may differ from paid_via when reception
    # collected the advance separately before the doctor settled the balance).
    advance_paid_via = models.CharField(
        max_length=10, choices=PaidVia.choices, default=PaidVia.CASH, blank=True
    )
    # Partial payment — amount and mode (populated only when payment_status=PARTIAL)
    partial_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    partial_amount_via = models.CharField(
        max_length=10, choices=PaidVia.choices, default=PaidVia.CASH, blank=True
    )

    remote_row_ref = models.CharField(max_length=120, blank=True)
    # Auto-managed callout: "Partially collected" or "Bill settled"
    callout = models.CharField(max_length=100, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        if self.bill_type == "OPD":
            return f"{self.patient_name} (OPD #{self.opd_no})"
        return f"{self.patient_name} (IPD #{self.ipd_no})"


class PartialCollectRequest(models.Model):
    """
    Doctor-created request to collect a specific amount from a bill.
    Reception executes it (choosing payment method) which deducts the amount
    from the bill's net_bill and marks the bill as PARTIAL.
    Deleted after execution.
    """
    bill = models.ForeignKey(
        Bill,
        on_delete=models.CASCADE,
        related_name="partial_collect_requests",
    )
    collect_amount = models.DecimalField(max_digits=12, decimal_places=2)
    collect_label  = models.CharField(max_length=200, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.bill} — collect ₹{self.collect_amount}"


class Metrics(models.Model):
    """
    Singleton table (pk always = 1).
    Tracks PAID bills only — kept in sync by post_save/post_delete signals.
    Use Metrics.rebuild() to fully recompute from the Bills table.
    """

    # ── Bill counts (PAID only) ───────────────────────────────────────────────
    total_ipd_bills = models.PositiveIntegerField(default=0)
    total_opd_bills = models.PositiveIntegerField(default=0)

    # ── Revenue totals (PAID only, advance_paid + net_bill) ──────────────────
    total_collected = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0.00")
    )
    total_cash   = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    total_upi    = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    total_online = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))

    # ── Partially-paid bills (PARTIAL status) — outstanding balance ──────────
    total_partial_bills = models.PositiveIntegerField(default=0)
    total_unsettled     = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0.00"),
        help_text="Sum of net_bill across all PARTIAL bills (money still owed).",
    )

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "metrics"

    # ── helpers ───────────────────────────────────────────────────────────────

    @classmethod
    def instance(cls):
        """Return the single metrics row, creating it (with zeros) if absent."""
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    @classmethod
    def _sum_pc_by_method(cls, pc_list, via_map, totals):
        """Distribute partial-collection entries into the method buckets."""
        for e in (pc_list or []):
            field = via_map.get(e.get("payment_method", "CASH"), "total_upi")
            totals[field] += Decimal(str(e.get("amount", "0")))

    @classmethod
    def rebuild(cls):
        """
        Recompute every cumulative field from the Bills table. Idempotent.

        PAID:    advance_paid + each partially_collected entry + net_bill
                 → total_collected + method buckets
        PARTIAL: advance_paid + each partially_collected entry
                 → method buckets (not total_collected — bill not fully settled)
                 net_bill → total_unsettled (outstanding balance still owed)
        """
        Z = Decimal("0.00")
        via_map = {"CASH": "total_cash", "UPI": "total_upi", "ONLINE": "total_online"}

        totals = {
            "total_ipd_bills": 0, "total_opd_bills": 0,
            "total_collected": Z,
            "total_cash": Z, "total_upi": Z, "total_online": Z,
            "total_partial_bills": 0, "total_unsettled": Z,
        }

        for b in Bill.objects.filter(payment_status="PAID").values(
            "bill_type", "advance_paid", "advance_paid_via",
            "net_bill", "paid_via", "partially_collected",
        ):
            adv  = Decimal(str(b["advance_paid"] or "0"))
            net  = Decimal(str(b["net_bill"] or "0"))
            pc   = b.get("partially_collected") or []
            t_pc = sum(Decimal(str(e.get("amount", "0"))) for e in pc)
            totals["total_collected"] += adv + t_pc + net
            totals["total_ipd_bills" if b["bill_type"] == "IPD" else "total_opd_bills"] += 1
            totals[via_map.get(b.get("advance_paid_via") or "CASH", "total_upi")] += adv
            totals[via_map.get(b.get("paid_via") or "UPI", "total_upi")] += net
            cls._sum_pc_by_method(pc, via_map, totals)

        for b in Bill.objects.filter(payment_status="PARTIAL").values(
            "advance_paid", "advance_paid_via",
            "net_bill", "partially_collected",
        ):
            adv = Decimal(str(b["advance_paid"] or "0"))
            totals["total_partial_bills"] += 1
            totals["total_unsettled"] += Decimal(str(b.get("net_bill") or "0"))
            totals[via_map.get(b.get("advance_paid_via") or "CASH", "total_upi")] += adv
            cls._sum_pc_by_method(b.get("partially_collected"), via_map, totals)

        obj = cls.instance()
        for field, value in totals.items():
            setattr(obj, field, value)
        obj.save()
        return obj


# ─────────────────────────────────────────────────────────────────────────────
# Patient Basic Profile
# ─────────────────────────────────────────────────────────────────────────────

class PatientBasicProfile(models.Model):
    class Gender(models.TextChoices):
        MALE   = "M", "Male"
        FEMALE = "F", "Female"
        OTHER  = "O", "Other"

    # ── Core info ─────────────────────────────────────────────────────────────
    patient_name = models.CharField(max_length=200)
    address      = models.TextField(blank=True)
    mobile_no    = models.CharField(max_length=15, blank=True)
    gender       = models.CharField(max_length=1, choices=Gender.choices, blank=True, default="")
    age          = models.PositiveSmallIntegerField(null=True, blank=True)
    weight       = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    height       = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    pulse_rate   = models.PositiveSmallIntegerField(null=True, blank=True)

    # ── Pre-existing conditions ────────────────────────────────────────────────
    has_diabetes        = models.BooleanField(default=False)
    has_high_bp         = models.BooleanField(default=False)
    has_heart_disease   = models.BooleanField(default=False)
    has_asthma          = models.BooleanField(default=False)
    has_recent_surgery  = models.BooleanField(default=False)
    is_pregnant         = models.BooleanField(default=False)
    has_thyroid         = models.BooleanField(default=False)
    has_kidney_disease  = models.BooleanField(default=False)
    # free-text notes (allergies, medications, other conditions, etc.)
    condition_notes     = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.patient_name} ({self.mobile_no or '—'})"


# ─────────────────────────────────────────────────────────────────────────────
# Queue
# ─────────────────────────────────────────────────────────────────────────────

class Queue(models.Model):
    class Status(models.TextChoices):
        WAITING     = "WAITING",     "Waiting"
        WITH_DOCTOR = "WITH_DOCTOR", "With Doctor"
        DONE        = "DONE",        "Done"

    patient = models.ForeignKey(
        PatientBasicProfile,
        on_delete=models.CASCADE,
        related_name="queue_entries",
    )
    queue_number = models.PositiveIntegerField(
        help_text="Sequential number within the day",
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.WAITING
    )
    date   = models.DateField(default=timezone.localdate)

    # ── Reception advance collection ──────────────────────────────────────
    reception_bill_type = models.CharField(
        max_length=3,
        choices=[("OPD", "OPD"), ("IPD", "IPD")],
        default="OPD",
        blank=True,
    )
    reception_line_items = models.JSONField(default=list, blank=True)
    reception_amount_collected = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    reception_paid_via = models.CharField(
        max_length=10,
        choices=[("CASH", "Cash"), ("UPI", "UPI"), ("ONLINE", "Online")],
        default="CASH",
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["date", "queue_number"]
        unique_together = [("date", "queue_number")]

    def __str__(self) -> str:
        return f"Q#{self.queue_number} – {self.patient.patient_name} [{self.status}]"

    @classmethod
    def next_number_for_today(cls):
        """Return the next available queue number for today."""
        today = timezone.localdate()
        result = cls.objects.filter(date=today).aggregate(
            max_no=models.Max("queue_number")
        )
        return (result["max_no"] or 0) + 1
