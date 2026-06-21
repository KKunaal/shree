import json

from django.conf import settings
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build


IPD_HEADERS = [
    "ID", "Patient Name", "Address", "IPD No",
    "Admitted On", "Discharged On", "Room No", "Ward", "Total Stay (Days)",
    "Line Items (JSON)",
    "Total Bill (₹)", "Advance Paid (₹)", "Discount (₹)", "Discount Note", "Net Bill (₹)",
    "Created At",
]

OPD_HEADERS = [
    "ID", "Patient Name", "Address", "OPD No", "Visit Date",
    "Line Items (JSON)",
    "Total Bill (₹)", "Advance Paid (₹)", "Discount (₹)", "Discount Note", "Net Bill (₹)",
    "Created At",
]

# Keep backward-compat alias
SHEET_HEADERS = IPD_HEADERS


class GoogleSheetsService:
    SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

    def __init__(self, bill_type: str = "IPD") -> None:
        self.bill_type = bill_type

        if bill_type == "OPD":
            self.spreadsheet_id = settings.GOOGLE_SHEETS_OPD_SPREADSHEET_ID
            self.worksheet_name = settings.GOOGLE_SHEETS_OPD_WORKSHEET_NAME
        else:
            self.spreadsheet_id = settings.GOOGLE_SHEETS_SPREADSHEET_ID
            self.worksheet_name = settings.GOOGLE_SHEETS_WORKSHEET_NAME

    @property
    def headers(self):
        return OPD_HEADERS if self.bill_type == "OPD" else IPD_HEADERS

    def _client(self):
        if not self.spreadsheet_id:
            raise ValueError(
                f"GOOGLE_SHEETS_{'OPD_' if self.bill_type == 'OPD' else ''}SPREADSHEET_ID is not configured"
            )

        # Support both file path and JSON content
        service_account_file = getattr(settings, 'GOOGLE_SERVICE_ACCOUNT_FILE', None)
        service_account_json = getattr(settings, 'GOOGLE_SERVICE_ACCOUNT_JSON', None)

        if service_account_file:
            # Use file path (local dev)
            credentials = Credentials.from_service_account_file(
                service_account_file,
                scopes=self.SCOPES,
            )
        elif service_account_json:
            # Use JSON content (Cloud Run)
            info = json.loads(service_account_json)
            credentials = Credentials.from_service_account_info(info, scopes=self.SCOPES)
        else:
            raise ValueError("Neither GOOGLE_SERVICE_ACCOUNT_FILE nor GOOGLE_SERVICE_ACCOUNT_JSON is configured")

        return build("sheets", "v4", credentials=credentials)

    def append_bill_row(self, bill) -> str:
        sheets = self._client()
        disc = str(bill.discount) if bill.discount is not None else ""

        if self.bill_type == "OPD":
            rows = [[
                str(bill.id),
                bill.patient_name,
                bill.address,
                bill.opd_no or "",
                bill.visit_date.isoformat() if bill.visit_date else "",
                json.dumps(bill.line_items, ensure_ascii=False),
                str(bill.total_bill),
                str(bill.advance_paid),
                disc,
                bill.discount_note,
                str(bill.net_bill),
                bill.created_at.isoformat(),
            ]]
        else:
            rows = [[
                str(bill.id),
                bill.patient_name,
                bill.address,
                bill.ipd_no or "",
                bill.admitted_on.isoformat() if bill.admitted_on else "",
                bill.discharged_on.isoformat() if bill.discharged_on else "",
                bill.room_no,
                bill.ward,
                str(bill.total_stay),
                json.dumps(bill.line_items, ensure_ascii=False),
                str(bill.total_bill),
                str(bill.advance_paid),
                disc,
                bill.discount_note,
                str(bill.net_bill),
                bill.created_at.isoformat(),
            ]]

        response = (
            sheets.spreadsheets()
            .values()
            .append(
                spreadsheetId=self.spreadsheet_id,
                range=f"{self.worksheet_name}!A:Z",
                valueInputOption="USER_ENTERED",
                insertDataOption="INSERT_ROWS",
                body={"values": rows},
            )
            .execute()
        )

        return response.get("updates", {}).get("updatedRange", "")

    def ensure_headers(self) -> bool:
        """
        Writes headers as row 1 only if row 1 is empty.
        Returns True if headers were written, False if they already existed.
        """
        sheets = self._client()

        existing = (
            sheets.spreadsheets()
            .values()
            .get(
                spreadsheetId=self.spreadsheet_id,
                range=f"{self.worksheet_name}!A1:Z1",
            )
            .execute()
        )

        if existing.get("values"):
            return False

        sheets.spreadsheets().values().update(
            spreadsheetId=self.spreadsheet_id,
            range=f"{self.worksheet_name}!A1",
            valueInputOption="USER_ENTERED",
            body={"values": [self.headers]},
        ).execute()

        return True

