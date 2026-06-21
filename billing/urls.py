from django.urls import path

from .views import BillListCreateAPIView

urlpatterns = [
    path("bills/", BillListCreateAPIView.as_view(), name="bill-list-create"),
]
