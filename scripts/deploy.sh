#!/usr/bin/env bash
#
# Veröffentlicht die Weihnachtsstraße.
#
#   ./scripts/deploy.sh "Commit-Nachricht"
#   ./scripts/deploy.sh --skip-checks "Commit-Nachricht"   # ohne Tests/Build vorab
#
# Ablauf:
#   1. Lint, Tests und Build laufen lokal – schlägt etwas fehl, wird nichts veröffentlicht.
#   2. Alle Änderungen werden mit der Nachricht committet.
#   3. Push nach GitHub (origin/main) → Cloudflare baut das Frontend (frontend/wrangler.jsonc).
#   4. Push nach Heroku (Remote „heroku“) → Heroku baut und startet das Backend.
#   5. Kurzer Gesundheitscheck des Backends (/healthz).
#
# Einmalig einrichten (siehe README, „Veröffentlichen“):
#   heroku login
#   heroku git:remote -a cedis-adventskalender   # legt den Remote „heroku“ an
#   Cloudflare-Worker mit dem GitHub-Repository verbinden (README, „Frontend auf Cloudflare“)
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BRANCH="main"
HEROKU_APP="cedis-adventskalender"
BACKEND_URL="https://cedis-adventskalender-2500ece77636.herokuapp.com"
REPO_URL="https://github.com/Straightforward-IT/Cedis-Adventskalender.git"

say() { printf '\n\033[1;32m▸ %s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33m! %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

SKIP_CHECKS=false
if [[ "${1:-}" == "--skip-checks" ]]; then
  SKIP_CHECKS=true
  shift
fi
MESSAGE="${1:-}"
[[ -n "$MESSAGE" ]] || fail "Bitte eine Commit-Nachricht angeben: ./scripts/deploy.sh \"Was sich geändert hat\""

# --- Git vorbereiten (beim ersten Mal) ------------------------------------------------
if [[ ! -d .git ]]; then
  say "Lege Git-Repository an"
  git init -q -b "$BRANCH"
fi
if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "$REPO_URL"
fi
current="$(git symbolic-ref --short HEAD 2>/dev/null || echo "")"
[[ "$current" == "$BRANCH" ]] || fail "Bitte auf dem Branch „$BRANCH“ deployen (aktuell: „${current:-unbekannt}“)."

# --- Prüfen ---------------------------------------------------------------------------
if [[ "$SKIP_CHECKS" == false ]]; then
  say "Lint"
  npm run --silent lint
  say "Tests"
  npm run --silent test
  say "Build"
  npm run --silent build
fi

# --- Committen ------------------------------------------------------------------------
say "Committe Änderungen"
git add -A
# Sicherheitsnetz: Geheimnisse dürfen nie mit ins Repository.
if git diff --cached --name-only | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$' | grep -q .; then
  fail ".env-Datei im Commit gefunden – bitte aus dem Index nehmen (git reset <datei>)."
fi
if git diff --cached --quiet; then
  warn "Keine Änderungen zu committen – veröffentliche den aktuellen Stand."
else
  git commit -q -m "$MESSAGE"
  git log -1 --oneline
fi

# --- Veröffentlichen ------------------------------------------------------------------
say "Push nach GitHub ($BRANCH) – Cloudflare baut das Frontend"
git push -u origin "$BRANCH"

if git remote get-url heroku >/dev/null 2>&1; then
  say "Push nach Heroku – Backend wird gebaut"
  git push heroku "$BRANCH"

  say "Prüfe Backend ($BACKEND_URL/healthz)"
  ok=false
  for _ in 1 2 3 4 5 6; do
    if curl -fsS --max-time 10 "$BACKEND_URL/healthz" >/dev/null 2>&1; then ok=true; break; fi
    sleep 5
  done
  if [[ "$ok" == true ]]; then
    printf '  Backend antwortet.\n'
  else
    warn "Backend antwortet nicht – Logs: heroku logs --tail -a $HEROKU_APP"
  fi
else
  warn "Kein Heroku-Remote – Backend nicht veröffentlicht. Einmalig: heroku login && heroku git:remote -a $HEROKU_APP"
fi

say "Fertig 🎄"
