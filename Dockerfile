# ── Stage 1: dependency builder ──────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /app

# gcc needed by some google libs
RUN apt-get update && apt-get install -y --no-install-recommends gcc && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --prefix=/install --no-cache-dir -r requirements.txt


# ── Stage 2: runtime image ────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application source
COPY . .

# Create non-root user + writable dirs for SQLite (local) and static files
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser && \
    mkdir -p /data /app/staticfiles && chown -R appuser:appgroup /data /app/staticfiles

# Collect static files (uses a dummy key — no DB needed at build time)
RUN DJANGO_SECRET_KEY=build-time-only \
    DJANGO_DEBUG=False \
    DATABASE_URL=sqlite:////tmp/build.db \
    GOOGLE_SHEETS_SPREADSHEET_ID=x \
    GOOGLE_SHEETS_WORKSHEET_NAME=x \
    GOOGLE_SERVICE_ACCOUNT_FILE=/dev/null \
    python manage.py collectstatic --noinput

RUN chmod +x docker-entrypoint.sh

USER appuser

EXPOSE 8000

ENTRYPOINT ["./docker-entrypoint.sh"]
