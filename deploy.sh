#!/usr/bin/env bash
#
# Deploy ilmkhona0 on the Lightsail instance.
#
# Real stack on the server (ilmkhona-web, 18.197.206.85):
#   nginx :80/:443  ->  next-server :3000  ->  managed by pm2
#   repo: /home/ubuntu/ilmkhona0
#
# Run by hand any time:   cd ~/ilmkhona0 && bash deploy.sh
#
# GitHub Actions (.github/workflows/deploy.yml) pipes this file in over SSH on
# every push to main, so the server always runs the version from the newest
# commit — you never update this script on the server separately.
#
# Overrides:
#   APP_DIR   repo location   (default /home/ubuntu/ilmkhona0)
#   BRANCH    branch          (default main)
#   PM2_APP   pm2 process     (default: auto-detected, falls back to "all")
#   FORCE=1   rebuild even with no new commits

set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/ilmkhona0}"
BRANCH="${BRANCH:-main}"

log() { printf '\n==> %s\n' "$*"; }

cd "$APP_DIR"

log "Checking origin/$BRANCH"
git fetch --prune origin "$BRANCH"

LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"

if [ "$LOCAL" = "$REMOTE" ] && [ "${FORCE:-0}" != "1" ]; then
  log "Already at $(git rev-parse --short HEAD) — nothing to deploy."
  exit 0
fi

log "Updating $(git rev-parse --short HEAD) -> $(git rev-parse --short "origin/$BRANCH")"
# Hard reset, not merge: the server is a deploy target, never a place to edit
# code, so the branch always wins. This does NOT touch untracked/ignored files,
# so .env.production and public/uploads/ survive untouched.
git reset --hard "origin/$BRANCH"

log "Installing dependencies"
# npm ci is reproducible and much faster than npm install here.
npm ci --no-audit --no-fund

log "Building"
# 911 MB RAM + 4 GB swap. The heap cap keeps Node from assuming it has the whole
# machine; the swap absorbs the overflow so the build completes instead of being
# OOM-killed. Slower than a big box, but reliable.
NODE_OPTIONS="--max-old-space-size=1536" npm run build

# ---- Restart under pm2 ----
# Auto-detect the process name so this works regardless of what it was called.
if [ -z "${PM2_APP:-}" ]; then
  PM2_APP="$(pm2 jlist 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const a=JSON.parse(s);console.log(a.length===1?a[0].name:"")}catch{console.log("")}})' \
    || true)"
fi
PM2_APP="${PM2_APP:-all}"

log "Restarting pm2 process: $PM2_APP"
pm2 restart "$PM2_APP" --update-env || pm2 start npm --name ilmkhona0 -- start
pm2 save

log "Deployed $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"
log "Live check: curl -sI -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000"
