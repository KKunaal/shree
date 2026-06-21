#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/start-dev.sh
#
# Start the full local development environment:
#   • Django backend  on http://127.0.0.1:8000   (hms.settings.dev, SQLite)
#   • Vite frontend   on http://localhost:5173    (/api proxied → :8000)
#
# Usage:
#   ./scripts/start-dev.sh
#
# Prerequisites:
#   • .venv/ exists:  python -m venv .venv && .venv/bin/pip install -r backend/requirements.txt
#   • .env.dev exists: cp backend/.env.dev.example backend/.env.dev  (then fill values)
#   • node_modules:   cd frontend && npm install
# ─────────────────────────────────────────────────────────────────────────────
set -e
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ── Backend ──────────────────────────────────────────────────────────────────
echo "🔧  Starting Django dev server (hms.settings.dev) on :8000 …"
DJANGO_SETTINGS_MODULE=hms.settings.dev \
  "$REPO_ROOT/.venv/bin/python" "$REPO_ROOT/backend/manage.py" runserver 127.0.0.1:8000 &
BACKEND_PID=$!

# Brief pause so Django has time to print its startup banner before Vite
sleep 1

# ── Frontend ─────────────────────────────────────────────────────────────────
echo "⚡  Starting Vite dev server on :5173 …"
cd "$REPO_ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

# ── Cleanup on Ctrl-C ────────────────────────────────────────────────────────
trap 'echo ""; echo "Stopping…"; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0' INT TERM

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Backend  →  http://127.0.0.1:8000"
echo "  Frontend →  http://localhost:5173"
echo "  Press Ctrl-C to stop both."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

wait $BACKEND_PID $FRONTEND_PID
