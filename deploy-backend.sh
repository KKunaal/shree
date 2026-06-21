#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-backend.sh
#
# Build the Docker image and deploy to Google Cloud Run (production).
# Settings used inside the container: hms.settings.prod
#
# Usage:
#   ./deploy-backend.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

PROJECT=shree-500106
REGION=asia-south1
SERVICE=shree-hms
IMAGE="$REGION-docker.pkg.dev/$PROJECT/shree/$SERVICE:latest"

echo "🏗️  Building Docker image and pushing to Artifact Registry…"
gcloud builds submit \
  --project="$PROJECT" \
  --tag="$IMAGE" \
  backend/

echo "🚀  Deploying to Cloud Run ($REGION)…"
gcloud run deploy "$SERVICE" \
  --project="$PROJECT" \
  --region="$REGION" \
  --image="$IMAGE" \
  --platform=managed

echo "✅  Backend deployed!"
echo "    URL: $(gcloud run services describe $SERVICE --project=$PROJECT --region=$REGION --format='value(status.url)')"
