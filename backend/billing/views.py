from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from .authentication import FixedBasicAuthentication
from .models import Bill, ServiceRate
from .serializers import BillSerializer, ServiceRateSerializer

_auth = {
    "authentication_classes": [FixedBasicAuthentication],
    "permission_classes": [IsAuthenticated],
}


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
    queryset = Bill.objects.all().order_by("-created_at")
    serializer_class = BillSerializer
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated]


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

