from decimal import Decimal

from django.db import models


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

    remote_row_ref = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        if self.bill_type == "OPD":
            return f"{self.patient_name} (OPD #{self.opd_no})"
        return f"{self.patient_name} (IPD #{self.ipd_no})"
