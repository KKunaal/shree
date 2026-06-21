#!/bin/bash
# Deploy frontend to Google Cloud Storage
set -e

echo "🏗️  Building frontend..."
cd frontend
npm run build

echo "☁️  Uploading to Cloud Storage..."
gcloud storage cp -r dist/* gs://shree-hms-frontend/ --project=shree-500106

echo "✅ Frontend deployed!"
echo "🌐 URL: https://storage.googleapis.com/shree-hms-frontend/index.html"
