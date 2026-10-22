#!/usr/bin/env bash
# Copy JSON Schemas from a vault-family-core checkout into public/schemas/,
# so vcav.io serves them at their $id URLs (https://vcav.io/schemas/<file>).
# Usage: scripts/sync-vfc-schemas.sh <path-to-vault-family-core>
set -euo pipefail

vfc="${1:?usage: $0 <path-to-vault-family-core>}"
dest="$(dirname "$0")/../public/schemas"

rm -f "$dest"/*.schema.json
cp "$vfc"/schemas/*.schema.json "$dest"/
echo "Synced $(ls "$dest"/*.schema.json | wc -l | tr -d ' ') schemas from $vfc"
