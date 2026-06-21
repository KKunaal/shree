import json

from django.conf import settings
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build


SHEET_HEADERS = [
    "ID",
    "Patient Name",
    "Address",
    "IPD No",
    "Admitted On",
    "Discharged On",
    "Room No",
    "Ward",
    "Total Stay (Days)",
    "Line Items (JSON)",
    "Total Bill (₹)",
    "Advance Paid (₹)",
    "Net Bill (₹)",
    "Created At",
]


class GoogleSheetsService:
    SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

    def __init__(self) -> None:
        self.spreadsheet_id = settings.GOOGLE_SHEETS_SPREADSHEET_ID
        self.worksheet_name = settings.GOOGLE_SHEETS_WORKSHEET_NAME
        self.credentials_file = settings.GOOGLE_SERVICE_ACCOUNT_FILE

    def _client(self):
        if not self.spreadsheet_id:
            raise ValueError("GOOGLE_SHEETS_SPREADSHEET_ID is not configured")
        if not self.credentials_file:
            raise ValueError("GOOGLE_SERVICE_ACCOUNT_FILE is not configured")

        credentials = Credentials.from_service_account_file(
            self.credentials_file,
            scopes=self.SCOPES,
        )
        return build("sheets", "v4", credentials=credentials)

    def append_bill_row(self, bill) -> str:
        sheets = self._client()

        rows = [[
            str(bill.id),
            bill.patient_name,
            bill.address,
            bill.ipd_no,
            bill.admitted_on.isoformat() if bill.admitted_on else "",
            bill.discharged_on.isoformat() if bill.discharged_on else "",
            bill.room_no,
            bill.ward,
            str(bill.total_stay),
            json.dumps(bill.line_items, ensure_ascii=False),
            str(bill.total_bill),
            str(bill.advance_paid),
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
        Writes SHEET_HEADERS as row 1 only if row 1 is empty.
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
            return False   # headers already present

        sheets.spreadsheets().values().update(
            spreadsheetId=self.spreadsheet_id,
            range=f"{self.worksheet_name}!A1",
            valueInputOption="USER_ENTERED",
            body={"values": [SHEET_HEADERS]},
        ).execute()

        return True
