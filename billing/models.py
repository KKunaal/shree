from decimal import Decimal

from django.db import models


class Bill(models.Model):
    patient_name = models.CharField(max_length=200)
    address = models.TextField(blank=True)
    ipd_no = models.CharField(max_length=50, blank=True)
    admitted_on = models.DateField()
    discharged_on = models.DateField(null=True, blank=True)
    room_no = models.CharField(max_length=20, blank=True)
    ward = models.CharField(max_length=50, blank=True)
    total_stay = models.PositiveIntegerField(default=0)

    line_items = models.JSONField(default=list)

    total_bill = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    advance_paid = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    net_bill = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    remote_row_ref = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.patient_name} ({self.ipd_no})"
