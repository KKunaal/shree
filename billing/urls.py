from django.urls import path

from .views import BillDetailAPIView, BillListCreateAPIView

urlpatterns = [
    path("bills/", BillListCreateAPIView.as_view(), name="bill-list-create"),
    path("bills/<int:pk>/", BillDetailAPIView.as_view(), name="bill-detail"),
]
