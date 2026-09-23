#!/bin/sh
# Déploie l'image correspondant à la version versionnée, sans Node ni pnpm.
set -eu

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$PROJECT_ROOT"

VERSION=$(sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' package.json | head -n 1)
if [ -z "$VERSION" ]; then
  echo "Impossible de lire la version dans package.json." >&2
  exit 1
fi

ENV_FILE=.env
TEMP_FILE=$(mktemp "${ENV_FILE}.tmp.XXXXXX")
cleanup() { rm -f "$TEMP_FILE"; }
trap cleanup EXIT HUP INT TERM

if [ -f "$ENV_FILE" ]; then
  awk -v line="APP_VERSION=$VERSION" '
    /^APP_VERSION=/ {
      if (!written++) print line
      next
    }
    { print }
    END { if (!written) print line }
  ' "$ENV_FILE" > "$TEMP_FILE"
else
  printf 'APP_VERSION=%s\n' "$VERSION" > "$TEMP_FILE"
fi

mv "$TEMP_FILE" "$ENV_FILE"
trap - EXIT HUP INT TERM

echo "Déploiement de ghcr.io/automathproject/openyourmath:$VERSION"
docker compose pull app
docker compose up -d app --force-recreate
docker compose ps app
echo "\nVérification conseillée :"
echo "  curl --fail --silent --show-error https://openyourmath.org/api/health"
