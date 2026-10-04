#!/bin/sh
# Opens a pull request in the test browser: npm run pr -- 12
set -e
[ -n "$1" ] || { echo "Usage: npm run pr -- <pull request number>"; exit 1; }
gh pr checkout "$1"
npm install --no-audit --no-fund
exec npm run dev
