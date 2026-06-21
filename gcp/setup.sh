#!/usr/bin/env bash
# =============================================================================
# gcp/setup.sh — One-shot provisioning of Shree HMS on Google Cloud
#
# Usage:
#   chmod +x gcp/setup.sh
#   ./gcp/setup.sh
#
# Prerequisites:
#   - gcloud CLI installed and authenticated  (gcloud auth login)
#   - Billing enabled on the project
#   - service-account JSON file present locally
# =============================================================================
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
PROJECT_ID="shree-500106"
REGION="asia-south1"              # Mumbai — closest to Ambad
SERVICE_NAME="shree-hms"
REPO_NAME="shree"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}"

DB_INSTANCE="shree-db"
DB_NAME="shree_hms"
DB_USER="shree_user"

# Path to your local service-account JSON (used only to upload to Secret Manager)
SA_JSON_PATH="${1:-./shree-500106-b376469c8fbf.json}"

# ── Helpers ───────────────────────────────────────────────────────────────────
info()    { echo ""; echo "🔹 $*"; }
success() { echo "✅ $*"; }

# ── Step 0: Set active project ────────────────────────────────────────────────
info "Setting active project to ${PROJECT_ID}..."
gcloud config set project "${PROJECT_ID}"

# ── Step 1: Enable required APIs ─────────────────────────────────────────────
info "Enabling required Google Cloud APIs..."
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  servicenetworking.googleapis.com
success "APIs enabled."

# ── Step 2: Create Artifact Registry repository ───────────────────────────────
info "Creating Artifact Registry repository..."
gcloud artifacts repositories create "${REPO_NAME}" \
  --repository-format=docker \
  --location="${REGION}" \
  --description="Shree HMS Docker images" 2>/dev/null || echo "  (already exists)"
success "Artifact Registry ready."

# ── Step 3: Build & push image via Cloud Build ────────────────────────────────
info "Building and pushing Docker image with Cloud Build..."
gcloud builds submit \
  --tag "${IMAGE}:latest" \
  --project "${PROJECT_ID}" \
  .
success "Image pushed: ${IMAGE}:latest"

# ── Step 4: Create Cloud SQL PostgreSQL instance ──────────────────────────────
info "Creating Cloud SQL instance '${DB_INSTANCE}'..."
gcloud sql instances create "${DB_INSTANCE}" \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region="${REGION}" \
  --storage-size=10GB \
  --storage-auto-increase 2>/dev/null || echo "  (already exists)"

info "Creating database '${DB_NAME}'..."
gcloud sql databases create "${DB_NAME}" \
  --instance="${DB_INSTANCE}" 2>/dev/null || echo "  (already exists)"

info "Creating DB user '${DB_USER}'..."
DB_PASSWORD=$(openssl rand -base64 20)
gcloud sql users create "${DB_USER}" \
  --instance="${DB_INSTANCE}" \
  --password="${DB_PASSWORD}" 2>/dev/null || {
    echo "  (user exists — generating new password)"
    gcloud sql users set-password "${DB_USER}" \
      --instance="${DB_INSTANCE}" \
      --password="${DB_PASSWORD}"
  }
success "Cloud SQL ready."

# Cloud SQL connection name used by Cloud Run
SQL_CONN="${PROJECT_ID}:${REGION}:${DB_INSTANCE}"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${SQL_CONN}"

# ── Step 5: Store secrets in Secret Manager ───────────────────────────────────
info "Storing secrets in Secret Manager..."

DJANGO_SECRET=$(openssl rand -base64 40)

store_secret() {
  local NAME=$1
  local VALUE=$2
  echo -n "${VALUE}" | gcloud secrets create "${NAME}" \
    --data-file=- --replication-policy=automatic 2>/dev/null || \
  echo -n "${VALUE}" | gcloud secrets versions add "${NAME}" --data-file=-
}

store_secret "DJANGO_SECRET_KEY"              "${DJANGO_SECRET}"
store_secret "DATABASE_URL"                   "${DATABASE_URL}"
store_secret "GOOGLE_SHEETS_SPREADSHEET_ID"  "$(grep GOOGLE_SHEETS_SPREADSHEET_ID .env | cut -d= -f2)"
store_secret "GOOGLE_SHEETS_WORKSHEET_NAME"  "$(grep GOOGLE_SHEETS_WORKSHEET_NAME  .env | cut -d= -f2)"
store_secret "GOOGLE_SERVICE_ACCOUNT_JSON"   "$(cat "${SA_JSON_PATH}")"

success "Secrets stored."

# ── Step 6: Grant Cloud Run SA access to secrets & Cloud SQL ──────────────────
info "Configuring IAM permissions..."
PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format="value(projectNumber)")
CLOUDRUN_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Secret Manager accessor
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${CLOUDRUN_SA}" \
  --role="roles/secretmanager.secretAccessor" --quiet

# Cloud SQL client
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${CLOUDRUN_SA}" \
  --role="roles/cloudsql.client" --quiet

success "IAM configured."

# ── Step 7: Deploy to Cloud Run ───────────────────────────────────────────────
info "Deploying to Cloud Run (${REGION})..."

gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}:latest" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --port 8000 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --timeout 300 \
  --add-cloudsql-instances "${SQL_CONN}" \
  --set-env-vars "DJANGO_DEBUG=False,DJANGO_ALLOWED_HOSTS=*,GOOGLE_SERVICE_ACCOUNT_FILE=/secrets/sa.json" \
  --set-secrets "\
DJANGO_SECRET_KEY=DJANGO_SECRET_KEY:latest,\
DATABASE_URL=DATABASE_URL:latest,\
GOOGLE_SHEETS_SPREADSHEET_ID=GOOGLE_SHEETS_SPREADSHEET_ID:latest,\
GOOGLE_SHEETS_WORKSHEET_NAME=GOOGLE_SHEETS_WORKSHEET_NAME:latest"

# ── Step 8: Mount service account JSON via Secret Manager volume ──────────────
info "Patching Cloud Run to mount service-account JSON as file..."
gcloud run services update "${SERVICE_NAME}" \
  --region "${REGION}" \
  --update-secrets "/secrets/sa.json=GOOGLE_SERVICE_ACCOUNT_JSON:latest"

# ── Done ──────────────────────────────────────────────────────────────────────
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --region "${REGION}" --format="value(status.url)")

echo ""
echo "============================================================"
echo "✅ Shree HMS deployed successfully!"
echo ""
echo "  Service URL : ${SERVICE_URL}"
echo "  API base    : ${SERVICE_URL}/api/bills/"
echo ""
echo "  Test with:"
echo "  curl -u reception:reception@123 ${SERVICE_URL}/api/bills/"
echo "============================================================"
