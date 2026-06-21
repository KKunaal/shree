from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from .authentication import FixedBasicAuthentication
from .models import Bill
from .serializers import BillSerializer

_auth = {
    "authentication_classes": [FixedBasicAuthentication],
    "permission_classes": [IsAuthenticated],
}


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

