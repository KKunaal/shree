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

    # ── Helpers shared by update/delete tests ─────────────────────────────────

    def _make_bill(self):
        """Create a bill directly in DB (no Sheets call needed)."""
        return Bill.objects.create(
            patient_name="Test Patient",
            address="Ambad",
            ipd_no="IPD-TEMP",
            admitted_on="2026-06-18",
            discharged_on="2026-06-20",
            room_no="3",
            ward="General",
            total_stay=2,
            line_items=[{"name": "Room Charges", "rate_per_day": "2500.00", "days": 2, "amount": "5000.00"}],
            total_bill="5000.00",
            advance_paid="500.00",
            net_bill="4500.00",
        )

    # ── Retrieve ──────────────────────────────────────────────────────────────

    def test_retrieve_bill_returns_200(self):
        bill = self._make_bill()
        self.client.credentials(HTTP_AUTHORIZATION=self._basic_auth_header("reception", "reception@123"))

        response = self.client.get(reverse("bill-detail", kwargs={"pk": bill.pk}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["patient_name"], "Test Patient")

    # ── Partial update (PATCH) ────────────────────────────────────────────────

    def test_patch_updates_patient_name(self):
        bill = self._make_bill()
        self.client.credentials(HTTP_AUTHORIZATION=self._basic_auth_header("reception", "reception@123"))

        response = self.client.patch(
            reverse("bill-detail", kwargs={"pk": bill.pk}),
            {"patient_name": "Updated Patient"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        bill.refresh_from_db()
        self.assertEqual(bill.patient_name, "Updated Patient")

    def test_patch_advance_recomputes_net_bill(self):
        bill = self._make_bill()
        self.client.credentials(HTTP_AUTHORIZATION=self._basic_auth_header("doctor", "doctor@123"))

        response = self.client.patch(
            reverse("bill-detail", kwargs={"pk": bill.pk}),
            {"advance_paid": "1000.00"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        bill.refresh_from_db()
        self.assertEqual(str(bill.advance_paid), "1000.00")
        self.assertEqual(str(bill.net_bill), "4000.00")   # 5000 - 1000

    # ── Full update (PUT) ─────────────────────────────────────────────────────

    def test_put_replaces_line_items_and_recomputes_totals(self):
        bill = self._make_bill()
        self.client.credentials(HTTP_AUTHORIZATION=self._basic_auth_header("reception", "reception@123"))

        payload = {
            "patient_name": "Test Patient",
            "admitted_on": "2026-06-18",
            "discharged_on": "2026-06-20",
            "total_stay": 2,
            "advance_paid": "0.00",
            "line_items": [
                {"name": "Room Charges",    "rate_per_day": "2500.00", "days": 2},
                {"name": "Nursing Charges", "rate_per_day": "300.00",  "days": 2},
            ],
        }

        response = self.client.put(
            reverse("bill-detail", kwargs={"pk": bill.pk}),
            payload,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        bill.refresh_from_db()
        self.assertEqual(str(bill.total_bill), "5600.00")  # (2500+300)*2
        self.assertEqual(str(bill.net_bill),   "5600.00")

    # ── Delete ────────────────────────────────────────────────────────────────

    def test_delete_removes_bill(self):
        bill = self._make_bill()
        self.client.credentials(HTTP_AUTHORIZATION=self._basic_auth_header("reception", "reception@123"))

        response = self.client.delete(reverse("bill-detail", kwargs={"pk": bill.pk}))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Bill.objects.count(), 0)

    def test_delete_nonexistent_returns_404(self):
        self.client.credentials(HTTP_AUTHORIZATION=self._basic_auth_header("reception", "reception@123"))

        response = self.client.delete(reverse("bill-detail", kwargs={"pk": 9999}))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

