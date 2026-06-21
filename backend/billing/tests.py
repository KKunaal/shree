from unittest.mock import patch
import base64

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from billing.models import Bill, ServiceRate


class TestBillApi(APITestCase):
    @staticmethod
    def _basic_auth_header(username: str, password: str) -> str:
        raw = f"{username}:{password}".encode("utf-8")
        return f"Basic {base64.b64encode(raw).decode('utf-8')}"

    # ── IPD create ────────────────────────────────────────────────────────────

    @patch("billing.serializers.GoogleSheetsService.append_bill_row", return_value="Shree!A2:P2")
    def test_create_ipd_bill_computes_totals_and_saves(self, _mock):
        self.client.credentials(HTTP_AUTHORIZATION=self._basic_auth_header("reception", "reception@123"))

        payload = {
            "bill_type": "IPD",
            "patient_name": "Jane Doe",
            "address": "Ambad",
            "admitted_on": "2026-06-18",
            "discharged_on": "2026-06-20",
            "room_no": "5",
            "ward": "General",
            "total_stay": 2,
            "advance_paid": "500.00",
            "line_items": [
                {"name": "Room Charges", "rate_per_day": "2500.00", "days": 2},
                {"name": "Monitoring",   "rate_per_day": "100.00",  "days": 2},
            ],
        }
        response = self.client.post(reverse("bill-list-create"), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        bill = Bill.objects.first()
        self.assertEqual(str(bill.total_bill), "5200.00")
        self.assertEqual(str(bill.net_bill),   "4700.00")
        self.assertEqual(bill.bill_type,       "IPD")
        self.assertEqual(bill.ipd_no,          "1")   # auto-assigned

    @patch("billing.serializers.GoogleSheetsService.append_bill_row", return_value="Shree!A2:P2")
    def test_ipd_no_is_auto_incremented(self, _mock):
        self.client.credentials(HTTP_AUTHORIZATION=self._basic_auth_header("reception", "reception@123"))
        base = {"bill_type": "IPD", "patient_name": "P", "admitted_on": "2026-01-01",
                "advance_paid": "0", "line_items": [{"name": "x", "rate_per_day": "100", "days": 1}]}
        self.client.post(reverse("bill-list-create"), base, format="json")
        self.client.post(reverse("bill-list-create"), {**base, "patient_name": "Q"}, format="json")
        nos = list(Bill.objects.order_by("id").values_list("ipd_no", flat=True))
        self.assertEqual(nos, ["1", "2"])

    # ── OPD create ────────────────────────────────────────────────────────────

    @patch("billing.serializers.GoogleSheetsService.append_bill_row", return_value="OPD!A2:M2")
    def test_create_opd_bill_saves(self, _mock):
        self.client.credentials(HTTP_AUTHORIZATION=self._basic_auth_header("reception", "reception@123"))
        payload = {
            "bill_type": "OPD",
            "patient_name": "Ravi Kumar",
            "address": "Ambad",
            "visit_date": "2026-06-21",
            "advance_paid": "0",
            "line_items": [{"name": "OPD First Visit", "rate_per_day": "300.00", "days": 1}],
        }
        response = self.client.post(reverse("bill-list-create"), payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        bill = Bill.objects.first()
        self.assertEqual(bill.bill_type, "OPD")
        self.assertEqual(bill.opd_no,    "1")
        self.assertEqual(str(bill.total_bill), "300.00")

    @patch("billing.serializers.GoogleSheetsService.append_bill_row", return_value="OPD!A2:M2")
    def test_opd_missing_visit_date_returns_400(self, _mock):
        self.client.credentials(HTTP_AUTHORIZATION=self._basic_auth_header("reception", "reception@123"))
        payload = {
            "bill_type": "OPD",
            "patient_name": "Ravi Kumar",
            "advance_paid": "0",
            "line_items": [{"name": "OPD Visit", "rate_per_day": "300.00", "days": 1}],
        }
        response = self.client.post(reverse("bill-list-create"), payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Discount ──────────────────────────────────────────────────────────────

    @patch("billing.serializers.GoogleSheetsService.append_bill_row", return_value="Shree!A2:P2")
    def test_discount_reduces_net_bill(self, _mock):
        self.client.credentials(HTTP_AUTHORIZATION=self._basic_auth_header("doctor", "doctor@123"))
        payload = {
            "bill_type": "IPD",
            "patient_name": "Discount Patient",
            "admitted_on": "2026-06-18",
            "advance_paid": "0",
            "discount": "200.00",
            "discount_note": "Doctor concession",
            "line_items": [{"name": "Room Charges", "rate_per_day": "1000.00", "days": 1}],
        }
        response = self.client.post(reverse("bill-list-create"), payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(str(response.data["net_bill"]), "800.00")  # 1000 - 0 - 200

    # ── Validation ────────────────────────────────────────────────────────────

    def test_discharge_before_admission_returns_400(self):
        self.client.credentials(HTTP_AUTHORIZATION=self._basic_auth_header("doctor", "doctor@123"))
        payload = {
            "bill_type": "IPD",
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
            "bill_type": "IPD",
            "patient_name": "Jane Doe",
            "admitted_on": "2026-06-20",
            "line_items": [{"name": "Room Charges", "rate_per_day": "2500.00", "days": 1}],
        }
        response = self.client.post(reverse("bill-list-create"), payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _make_bill(self):
        return Bill.objects.create(
            bill_type="IPD",
            patient_name="Test Patient",
            address="Ambad",
            ipd_no="1",
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

    # ── PATCH ─────────────────────────────────────────────────────────────────

    def test_patch_updates_patient_name(self):
        bill = self._make_bill()
        self.client.credentials(HTTP_AUTHORIZATION=self._basic_auth_header("reception", "reception@123"))
        response = self.client.patch(
            reverse("bill-detail", kwargs={"pk": bill.pk}),
            {"patient_name": "Updated Patient"}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        bill.refresh_from_db()
        self.assertEqual(bill.patient_name, "Updated Patient")

    def test_patch_advance_recomputes_net_bill(self):
        bill = self._make_bill()
        self.client.credentials(HTTP_AUTHORIZATION=self._basic_auth_header("doctor", "doctor@123"))
        response = self.client.patch(
            reverse("bill-detail", kwargs={"pk": bill.pk}),
            {"advance_paid": "1000.00"}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        bill.refresh_from_db()
        self.assertEqual(str(bill.net_bill), "4000.00")

    def test_patch_discount_recomputes_net_bill(self):
        bill = self._make_bill()
        self.client.credentials(HTTP_AUTHORIZATION=self._basic_auth_header("doctor", "doctor@123"))
        response = self.client.patch(
            reverse("bill-detail", kwargs={"pk": bill.pk}),
            {"discount": "500.00", "discount_note": "Special concession"}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        bill.refresh_from_db()
        self.assertEqual(str(bill.net_bill), "4000.00")  # 5000 - 500 (advance) - 500 (discount)

    # ── PUT ───────────────────────────────────────────────────────────────────

    def test_put_replaces_line_items_and_recomputes_totals(self):
        bill = self._make_bill()
        self.client.credentials(HTTP_AUTHORIZATION=self._basic_auth_header("reception", "reception@123"))
        payload = {
            "patient_name": "Test Patient",
            "admitted_on": "2026-06-18",
            "total_stay": 2,
            "advance_paid": "0.00",
            "line_items": [
                {"name": "Room Charges",    "rate_per_day": "2500.00", "days": 2},
                {"name": "Nursing Charges", "rate_per_day": "300.00",  "days": 2},
            ],
        }
        response = self.client.put(
            reverse("bill-detail", kwargs={"pk": bill.pk}), payload, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        bill.refresh_from_db()
        self.assertEqual(str(bill.total_bill), "5600.00")
        self.assertEqual(str(bill.net_bill),   "5600.00")

    # ── DELETE ────────────────────────────────────────────────────────────────

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


class TestServiceRateApi(APITestCase):
    @staticmethod
    def _auth():
        raw = b"reception:reception@123"
        return f"Basic {base64.b64encode(raw).decode()}"

    def setUp(self):
        self.client.credentials(HTTP_AUTHORIZATION=self._auth())

    def _make_rate(self, **kwargs):
        defaults = {
            "name": "Test Service",
            "category": "IPD",
            "default_rate": "500.00",
            "unit": "per day",
        }
        defaults.update(kwargs)
        return ServiceRate.objects.create(**defaults)

    # ── create ────────────────────────────────────────────────────────────────

    def test_create_rate_returns_201(self):
        payload = {
            "name": "Room Charges",
            "category": "ROOM",
            "default_rate": "2500.00",
            "unit": "per day",
        }
        response = self.client.post(reverse("rate-list-create"), payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ServiceRate.objects.count(), 1)
        self.assertEqual(response.data["default_rate"], "2500.00")

    def test_duplicate_name_returns_400(self):
        self._make_rate(name="Room Charges")
        payload = {"name": "Room Charges", "category": "ROOM", "default_rate": "3000.00", "unit": "per day"}
        response = self.client.post(reverse("rate-list-create"), payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── list & filter ─────────────────────────────────────────────────────────

    def test_list_returns_all_rates(self):
        self._make_rate(name="Service A", category="OPD")
        self._make_rate(name="Service B", category="IPD")
        response = self.client.get(reverse("rate-list-create"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_filter_by_category(self):
        self._make_rate(name="Service A", category="OPD")
        self._make_rate(name="Service B", category="IPD")
        response = self.client.get(reverse("rate-list-create"), {"category": "OPD"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["category"], "OPD")

    def test_filter_by_is_active_false(self):
        self._make_rate(name="Active",   is_active=True)
        self._make_rate(name="Inactive", is_active=False)
        response = self.client.get(reverse("rate-list-create"), {"is_active": "false"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertFalse(response.data[0]["is_active"])

    # ── retrieve ──────────────────────────────────────────────────────────────

    def test_retrieve_rate_returns_200(self):
        rate = self._make_rate()
        response = self.client.get(reverse("rate-detail", kwargs={"pk": rate.pk}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Test Service")

    # ── update ────────────────────────────────────────────────────────────────

    def test_patch_updates_rate(self):
        rate = self._make_rate()
        response = self.client.patch(
            reverse("rate-detail", kwargs={"pk": rate.pk}),
            {"default_rate": "750.00"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rate.refresh_from_db()
        self.assertEqual(str(rate.default_rate), "750.00")

    def test_patch_deactivate_rate(self):
        rate = self._make_rate(is_active=True)
        response = self.client.patch(
            reverse("rate-detail", kwargs={"pk": rate.pk}),
            {"is_active": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rate.refresh_from_db()
        self.assertFalse(rate.is_active)

    # ── delete ────────────────────────────────────────────────────────────────

    def test_delete_rate_returns_204(self):
        rate = self._make_rate()
        response = self.client.delete(reverse("rate-detail", kwargs={"pk": rate.pk}))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(ServiceRate.objects.count(), 0)

    def test_delete_nonexistent_rate_returns_404(self):
        response = self.client.delete(reverse("rate-detail", kwargs={"pk": 9999}))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # ── auth ──────────────────────────────────────────────────────────────────

    def test_unauthenticated_rate_request_returns_401(self):
        self.client.credentials()   # clear
        response = self.client.get(reverse("rate-list-create"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
