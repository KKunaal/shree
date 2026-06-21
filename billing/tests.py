from unittest.mock import patch
import base64

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from billing.models import Bill


class TestBillApi(APITestCase):
    @staticmethod
    def _basic_auth_header(username: str, password: str) -> str:
        raw = f"{username}:{password}".encode("utf-8")
        return f"Basic {base64.b64encode(raw).decode('utf-8')}"

    @patch("billing.serializers.GoogleSheetsService.append_bill_row", return_value="Sheet1!A2:N2")
    def test_create_bill_computes_totals_and_saves(self, _mock_append):
        self.client.credentials(HTTP_AUTHORIZATION=self._basic_auth_header("reception", "reception@123"))

        payload = {
            "patient_name": "Jane Doe",
            "address": "Ambad",
            "ipd_no": "IPD-1001",
            "admitted_on": "2026-06-18",
            "discharged_on": "2026-06-20",
            "room_no": "5",
            "ward": "General",
            "total_stay": 2,
            "advance_paid": "500.00",
            "line_items": [
                {"name": "Room Charges", "rate_per_day": "2500.00", "days": 2},
                {"name": "Monitoring", "rate_per_day": "100.00", "days": 2},
            ],
        }

        response = self.client.post(reverse("bill-list-create"), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Bill.objects.count(), 1)

        bill = Bill.objects.first()
        self.assertEqual(str(bill.total_bill), "5200.00")
        self.assertEqual(str(bill.net_bill), "4700.00")
        self.assertEqual(bill.remote_row_ref, "Sheet1!A2:N2")

    def test_discharge_before_admission_returns_400(self):
        self.client.credentials(HTTP_AUTHORIZATION=self._basic_auth_header("doctor", "doctor@123"))

        payload = {
            "patient_name": "Jane Doe",
            "admitted_on": "2026-06-20",
            "discharged_on": "2026-06-18",
            "line_items": [{"name": "Room Charges", "rate_per_day": "2500.00", "days": 1}],
        }

        response = self.client.post(reverse("bill-list-create"), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("non_field_errors", response.data)

    def test_unauthenticated_request_returns_401(self):
        payload = {
            "patient_name": "Jane Doe",
            "admitted_on": "2026-06-20",
            "line_items": [{"name": "Room Charges", "rate_per_day": "2500.00", "days": 1}],
        }

        response = self.client.post(reverse("bill-list-create"), payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

