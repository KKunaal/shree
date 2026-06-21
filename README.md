# Hospital Billing API (DRF + Google Sheets)

This is a simple Django REST Framework app for entering in-patient bill details and saving them to:

1. Local Django DB (`sqlite3`) for API records.
2. Google Spreadsheet (used as remote data store).

## What this API stores

Based on your bill form image, each bill captures:

- Patient details: name, address, IPD number
- Admission details: admitted/discharged dates, room no, ward, total stay
- Billing lines (`line_items`): charge type, charge/day, days, computed amount
- Totals: total bill, advance, net bill

## Quick setup

1. Create and activate a Python virtual environment.
2. Install dependencies:

   - `pip install -r requirements.txt`

3. Create `.env` file from `.env.example` and fill values.
4. Run migrations:

   - `python manage.py migrate`

5. Start server:

   - `python manage.py runserver`

## Google Sheets setup

> Important: Public sheet visibility is not enough for write access.
> For appending rows, use a **Google service account** and share the sheet with the service account email as **Editor**.

1. Create a Google Cloud project.
2. Enable **Google Sheets API**.
3. Create a service account and download JSON key.
4. Put key file path in `.env` as `GOOGLE_SERVICE_ACCOUNT_FILE`.
5. Put spreadsheet ID in `.env` as `GOOGLE_SHEETS_SPREADSHEET_ID`.
6. Share your target spreadsheet with service account email (Editor role).

## API endpoint

- `POST /api/bills/` → create bill, compute totals, append to Google Sheet
- `GET /api/bills/` → list bills saved in local DB

### Authentication

All `/api/bills/` requests require **HTTP Basic Authentication**.

Fixed users configured:

- `reception` / `reception@123`
- `doctor` / `doctor@123`

## Sample request body

```json
{
  "patient_name": "John Doe",
  "address": "Ambad",
  "ipd_no": "IPD-101",
  "admitted_on": "2026-06-18",
  "discharged_on": "2026-06-20",
  "room_no": "12",
  "ward": "General",
  "total_stay": 2,
  "advance_paid": "500.00",
  "line_items": [
    {"name": "Room Charges", "rate_per_day": "2500", "days": 2},
    {"name": "I.P.D Charges", "rate_per_day": "1400", "days": 2},
    {"name": "Monitoring", "rate_per_day": "100", "days": 2},
    {"name": "Neocan", "rate_per_day": "300", "days": 1}
  ]
}
```

## Notes

- `amount` per line is computed as `rate_per_day * days`.
- `total_bill` is sum of line amounts.
- `net_bill = total_bill - advance_paid`.
