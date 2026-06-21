#!/bin/bash
# Deploy frontend to Google Cloud Storage
set -e

echo "🏗️  Building frontend..."
cd frontend
rm -rf dist
npm run build

echo "☁️  Uploading to Cloud Storage..."
cd ..
gcloud storage rm -r 'gs://shree-hms-frontend/**' --project=shree-500106 2>/dev/null || true
gcloud storage cp -r frontend/dist/* gs://shree-hms-frontend/ --project=shree-500106

echo "✅ Frontend deployed!"
echo ""
echo "🌐 Production URL (add ?v=X to bypass cache):"
echo "   https://storage.googleapis.com/shree-hms-frontend/index.html"
echo ""
echo "💡 Login credentials:"
echo "   Username: reception   Password: reception@123"
echo "   Username: doctor      Password: doctor@123"
