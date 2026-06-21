"""
settings/dev.py — local development environment.

Storage  : SQLite  (backend/db.sqlite3)
Env file : backend/.env.dev  (gitignored; copy .env.dev.example to create it)
Frontend : Vite dev server on :5173 proxies /api → Django :8000
Sheets   : optional — won't crash if credentials aren't configured

Usage:
    DJANGO_SETTINGS_MODULE=hms.settings.dev  (default in manage.py)
"""

import os
from dotenv import load_dotenv
from .base import *  # noqa: F401, F403 — wildcard import is intentional here

# ── Load .env.dev  (falls back to .env for backward compatibility) ─────────────
_env_dev = BASE_DIR / ".env.dev"   # noqa: F405  BASE_DIR comes from base.*
_env_legacy = BASE_DIR / ".env"
load_dotenv(_env_dev if _env_dev.exists() else _env_legacy, override=True)

# ── Core ──────────────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-only-insecure-secret-do-not-use-in-prod")
DEBUG = True
ALLOWED_HOSTS = ["*"]

# ── Database — SQLite, local file ─────────────────────────────────────────────
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",   # noqa: F405
    }
}

# ── Google Sheets — optional in dev ──────────────────────────────────────────
# Leave blank to skip Sheets sync; the API will still work fine.
GOOGLE_SHEETS_SPREADSHEET_ID     = os.getenv("GOOGLE_SHEETS_SPREADSHEET_ID", "")
GOOGLE_SHEETS_WORKSHEET_NAME     = os.getenv("GOOGLE_SHEETS_WORKSHEET_NAME", "IPD")
GOOGLE_SHEETS_OPD_SPREADSHEET_ID = os.getenv(
    "GOOGLE_SHEETS_OPD_SPREADSHEET_ID",
    os.getenv("GOOGLE_SHEETS_SPREADSHEET_ID", ""),
)
GOOGLE_SHEETS_OPD_WORKSHEET_NAME = os.getenv("GOOGLE_SHEETS_OPD_WORKSHEET_NAME", "OPD")
GOOGLE_SERVICE_ACCOUNT_FILE      = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "")
GOOGLE_SERVICE_ACCOUNT_JSON      = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "")

# ── CORS — Vite dev server ports ──────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
]
CORS_ALLOW_CREDENTIALS = True
