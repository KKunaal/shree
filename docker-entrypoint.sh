#!/bin/sh
set -e

echo "==> Applying database migrations..."
python manage.py migrate --noinput

echo "==> Ensuring Google Sheet headers..."
python manage.py setup_sheet

echo "==> Starting Gunicorn..."
exec gunicorn hms.wsgi:application \
  --bind 0.0.0.0:${PORT:-8000} \
  --workers "${GUNICORN_WORKERS:-2}" \
  --threads "${GUNICORN_THREADS:-2}" \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
