# Shree Bal Rugnalaya — Hospital Management System

Full-stack billing system with IPD/OPD support, Google Sheets sync, and service rate configuration.

## 🌐 Live Deployment

- **Frontend**: https://storage.googleapis.com/shree-hms-frontend/index.html
- **Backend API**: https://shree-hms-750926008347.asia-south1.run.app
- **Google Sheet (IPD)**: Tab `IPD` in [spreadsheet](https://docs.google.com/spreadsheets/d/1xVCBLJCrJZFVkyIwe6XpqY9SWM66es0J9McdWT-CBY8)
- **Google Sheet (OPD)**: Tab `OPD` in [spreadsheet](https://docs.google.com/spreadsheets/d/1xVCBLJCrJZFVkyIwe6XpqY9SWM66es0J9McdWT-CBY8/edit#gid=444430599)

## 🔑 Login Credentials

| User | Username | Password |
|------|----------|----------|
| Reception | `reception` | `reception@123` |
| Doctor | `doctor` | `doctor@123` |

## 🚀 Quick Start

### Access the deployed app
Just open: **https://storage.googleapis.com/shree-hms-frontend/index.html**

### Run locally
```bash
# Backend
cd backend
python -m venv ../.venv
source ../.venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_rates
python manage.py runserver

# Frontend (separate terminal)
cd frontend
npm install
npm run dev  # Opens on http://localhost:5173
```

## 📦 Features

- **IPD/OPD Bill Types** — Separate workflows for in-patient & out-patient billing
- **Auto-increment Bill Numbers** — IPD no (1,2,3...) and OPD no (1,2,3...) auto-assigned
- **Discount Support** — Doctor can add discount with optional note
- **Google Sheets Sync** — Bills auto-saved to IPD/OPD tabs on creation
- **Service Rate Management** — Configure default rates by category
- **Print Bills** — Clean print layout for both IPD and OPD
- **Search & Filter** — By patient name, bill number, bill type

## 📤 Deployment

### Frontend
```bash
./deploy-frontend.sh
```

### Backend
```bash
cd backend
gcloud builds submit --project=shree-500106 \
  --tag=asia-south1-docker.pkg.dev/shree-500106/shree/shree-hms:latest .
gcloud run deploy shree-hms --image=...latest --region=asia-south1 --quiet
```

## 📊 Tech Stack

**Backend**: Django 5.1 + DRF + PostgreSQL 15 + Google Sheets API + Cloud Run  
**Frontend**: React 18 + Vite 5 + Tailwind CSS 3 + Cloud Storage

## 📝 API Documentation

All endpoints require Basic Auth.

### Bills
- `GET /api/bills/` — List all
- `POST /api/bills/` — Create (auto-assigns ipd_no or opd_no)
- `PATCH /api/bills/:id/` — Update
- `DELETE /api/bills/:id/` — Delete

### Service Rates
- `GET /api/rates/?category=OPD&is_active=true` — List (filterable)
- `POST /api/rates/` — Create
- `PATCH /api/rates/:id/` — Update
- `DELETE /api/rates/:id/` — Delete

## 🧪 Testing

```bash
cd backend
python manage.py test billing -v 2  # 25 tests
```

## 📞 Support

For Shree Bal Rugnalaya, Ambad, Jalna.
