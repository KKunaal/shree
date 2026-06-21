"""
settings/prod.py — production environment (Google Cloud Run + Cloud SQL).

Storage  : PostgreSQL via DATABASE_URL (Cloud SQL via Unix socket)
Env vars : injected by Cloud Run — no .env file, no dotenv loading
Sheets   : GOOGLE_SERVICE_ACCOUNT_JSON secret (Cloud Run Secret Manager)

Usage:
    DJANGO_SETTINGS_MODULE=hms.settings.prod  (default in wsgi.py, asgi.py, Dockerfile)
"""

import os

import dj_database_url

from .base import *  # noqa: F401, F403 — wildcard import is intentional here

# ── Core ──────────────────────────────────────────────────────────────────────
# Hard-fail if SECRET_KEY is missing — prevents silent insecure deployments
SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]
DEBUG = False
ALLOWED_HOSTS = [
    h.strip()
    for h in os.getenv("DJANGO_ALLOWED_HOSTS", "*").split(",")
    if h.strip()
]

# ── Database — Cloud SQL PostgreSQL via DATABASE_URL ──────────────────────────
# Cloud Run injects DATABASE_URL with the Cloud SQL socket connection string:
#   postgresql://USER:PASS@/DBNAME?host=/cloudsql/PROJECT:REGION:INSTANCE
DATABASES = {
    "default": dj_database_url.config(
        env="DATABASE_URL",
        conn_max_age=600,
        conn_health_checks=True,
    )
}

# ── Google Sheets — injected as Cloud Run env vars / secrets ──────────────────
GOOGLE_SHEETS_SPREADSHEET_ID     = os.environ.get("GOOGLE_SHEETS_SPREADSHEET_ID", "")
GOOGLE_SHEETS_WORKSHEET_NAME     = os.environ.get("GOOGLE_SHEETS_WORKSHEET_NAME", "IPD")
GOOGLE_SHEETS_OPD_SPREADSHEET_ID = os.environ.get(
    "GOOGLE_SHEETS_OPD_SPREADSHEET_ID",
    os.environ.get("GOOGLE_SHEETS_SPREADSHEET_ID", ""),
)
GOOGLE_SHEETS_OPD_WORKSHEET_NAME = os.environ.get("GOOGLE_SHEETS_OPD_WORKSHEET_NAME", "OPD")
GOOGLE_SERVICE_ACCOUNT_FILE      = os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE", "")
GOOGLE_SERVICE_ACCOUNT_JSON      = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")

# ── CORS — Cloud Storage hosted frontend ─────────────────────────────────────
CORS_ALLOWED_ORIGINS = [
    "https://storage.googleapis.com",
]
CORS_ALLOW_CREDENTIALS = True
