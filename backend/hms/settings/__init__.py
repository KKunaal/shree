# This package exposes two settings modules:
#   hms.settings.dev   — local development (SQLite, DEBUG=True, loads .env.dev)
#   hms.settings.prod  — production (PostgreSQL, DEBUG=False, reads Cloud Run env)
#
# The active module is selected by DJANGO_SETTINGS_MODULE:
#   manage.py          defaults to  hms.settings.dev
#   wsgi.py / asgi.py  default to   hms.settings.prod
#   Dockerfile         sets         hms.settings.prod
