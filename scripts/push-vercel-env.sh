#!/usr/bin/env bash
# Push every variable in .env.vercel.local to a Vercel environment.
#
#   bash scripts/push-vercel-env.sh                 # -> production
#   bash scripts/push-vercel-env.sh preview         # -> preview
#
# Requires the Vercel CLI, linked to this project:
#   npm i -g vercel && vercel link
#
# Existing values are removed first, because `vercel env add` will not
# overwrite a variable that already exists.

set -euo pipefail

TARGET="${1:-production}"
FILE=".env.vercel.local"

if [ ! -f "$FILE" ]; then
  echo "Missing $FILE. Nothing to push." >&2
  exit 1
fi

if ! command -v vercel >/dev/null 2>&1; then
  echo "The Vercel CLI is not installed. Run: npm i -g vercel" >&2
  exit 1
fi

pushed=0
while IFS= read -r line || [ -n "$line" ]; do
  # Skip blanks and comments.
  case "$line" in ''|\#*) continue ;; esac

  key="${line%%=*}"
  value="${line#*=}"
  # Strip one layer of surrounding double quotes.
  value="${value%\"}"
  value="${value#\"}"

  [ -z "$key" ] && continue

  # Remove any existing value so the add cannot be rejected as a duplicate.
  vercel env rm "$key" "$TARGET" --yes >/dev/null 2>&1 || true

  printf '%s' "$value" | vercel env add "$key" "$TARGET" >/dev/null
  echo "  set $key"
  pushed=$((pushed + 1))
done < "$FILE"

echo
echo "Pushed $pushed variables to $TARGET."
echo "Vercel only applies environment variables at build time, so redeploy now:"
echo "  vercel --prod"
