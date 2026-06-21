from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from .authentication import FixedBasicAuthentication
from .models import Bill
from .serializers import BillSerializer


class BillListCreateAPIView(generics.ListCreateAPIView):
    queryset = Bill.objects.all().order_by("-created_at")
    serializer_class = BillSerializer
    authentication_classes = [FixedBasicAuthentication]
    permission_classes = [IsAuthenticated]

