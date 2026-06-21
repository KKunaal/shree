from django.contrib import admin

from .models import Bill


@admin.register(Bill)
class BillAdmin(admin.ModelAdmin):
    list_display = ("id", "patient_name", "ipd_no", "admitted_on", "total_bill", "net_bill", "created_at")
    search_fields = ("patient_name", "ipd_no")
