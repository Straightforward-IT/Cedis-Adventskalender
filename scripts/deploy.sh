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
#   3. Push nach GitHub (origin/main) → Cloudflare Pages baut das Frontend automatisch.
#   4. Push nach Heroku (Remote „heroku“) → Heroku baut und startet das Backend.
#
# Einmalig einrichten (siehe README, „Veröffentlichen“):
#   heroku login
#   heroku git:remote -a <app-name>      # legt den Remote „heroku“ an
#   Cloudflare Pages mit dem GitHub-Repository verbinden
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BRANCH="main"
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
say "Push nach GitHub ($BRANCH) – Cloudflare Pages baut das Frontend"
git push -u origin "$BRANCH"

if git remote get-url heroku >/dev/null 2>&1; then
  say "Push nach Heroku – Backend wird gebaut"
  git push heroku "$BRANCH"
else
  warn "Kein Heroku-Remote – Backend nicht veröffentlicht. Einmalig: heroku login && heroku git:remote -a <app-name>"
fi

say "Fertig 🎄"
