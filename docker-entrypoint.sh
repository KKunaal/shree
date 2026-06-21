#!/bin/sh
set -e

echo "==> Applying database migrations..."
python manage.py migrate --noinput

echo "==> Seeding default service rates..."
python manage.py seed_rates || echo "   (seed_rates failed non-fatally, continuing)"

echo "==> Ensuring Google Sheet headers..."
# If the service-account file is not yet mounted (e.g. first boot before secret
# volume is attached), skip gracefully rather than crashing the container.
if [ -f "${GOOGLE_SERVICE_ACCOUNT_FILE:-}" ]; then
  python manage.py setup_sheet || echo "   (setup_sheet failed non-fatally, continuing)"
else
  echo "   Service account file not found at '${GOOGLE_SERVICE_ACCOUNT_FILE}', skipping setup_sheet."
fi

echo "==> Starting Gunicorn..."
exec gunicorn hms.wsgi:application \
  --bind 0.0.0.0:${PORT:-8000} \
  --workers "${GUNICORN_WORKERS:-2}" \
  --threads "${GUNICORN_THREADS:-2}" \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
