from django.contrib import admin

from .models import Bill


@admin.register(Bill)
class BillAdmin(admin.ModelAdmin):
    list_display = ("id", "get_patient_name", "ipd_no", "admitted_on", "total_bill", "net_bill", "created_at")
    search_fields = ("patient__patient_name", "ipd_no")
    
    def get_patient_name(self, obj):
        return obj.patient.patient_name if obj.patient else ""
    get_patient_name.short_description = "Patient Name"
    get_patient_name.admin_order_field = "patient__patient_name"

