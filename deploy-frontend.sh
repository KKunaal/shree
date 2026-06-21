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
gcloud storage cp -r frontend/dist/* gs://shree-hms-frontend/ --project=shree-500106

echo "✅  Frontend deployed!"
echo "    URL: https://storage.googleapis.com/shree-hms-frontend/index.html"

echo ""
echo "🌐 Production URL (add ?v=X to bypass cache):"
echo "   https://storage.googleapis.com/shree-hms-frontend/index.html"
echo ""
echo "💡 Login credentials:"
echo "   Username: reception   Password: reception@123"
echo "   Username: doctor      Password: doctor@123"
