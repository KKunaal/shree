#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-frontend.sh
#
# Build with .env.production (VITE_API_URL = Cloud Run URL) and upload to
# Google Cloud Storage for public hosting.
#
# Usage:
#   ./deploy-frontend.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

echo "🏗️  Building frontend (production mode, using .env.production)…"
cd frontend
rm -rf dist
npm run build   # Vite picks up .env.production automatically

echo "☁️  Uploading to Cloud Storage…"
cd ..
gcloud storage rm -r 'gs://shree-hms-frontend/**' --project=shree-500106 2>/dev/null || true

# Hashed assets (JS/CSS) — cache for 1 year; filenames change with every build
gcloud storage cp -r frontend/dist/assets gs://shree-hms-frontend/assets \
  --project=shree-500106 \
  --cache-control="public, max-age=31536000, immutable"

# index.html — never cache; browser must always fetch the latest version
gcloud storage cp frontend/dist/index.html gs://shree-hms-frontend/index.html \
  --project=shree-500106 \
  --cache-control="no-cache, no-store, must-revalidate"

# Any other root files (favicon, etc.)
shopt -s nullglob
for f in frontend/dist/*; do
  [[ "$f" == "frontend/dist/index.html" || "$f" == "frontend/dist/assets" ]] && continue
  gcloud storage cp "$f" "gs://shree-hms-frontend/$(basename "$f")" \
    --project=shree-500106 \
    --cache-control="no-cache, no-store, must-revalidate"
done

echo "✅  Frontend deployed!"
echo "    URL: https://storage.googleapis.com/shree-hms-frontend/index.html"

echo ""
echo "🌐 Production URL (add ?v=X to bypass cache):"
echo "   https://storage.googleapis.com/shree-hms-frontend/index.html"
echo ""
echo "💡 Login credentials:"
echo "   Username: reception   Password: reception@123"
echo "   Username: doctor      Password: doctor@123"
