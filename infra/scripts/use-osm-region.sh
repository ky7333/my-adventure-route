#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <osm_url> [region_slug]"
  echo "Example:"
  echo "  pnpm osm:use -- https://download.geofabrik.de/north-america/us/new-york-latest.osm.pbf new-york"
  exit 1
fi

OSM_URL="$1"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

"$ROOT_DIR/infra/scripts/fetch-osm.sh" "$OSM_URL"

OSM_FILE_NAME="$(basename "$OSM_URL")"
RAW_SLUG="${2:-${OSM_FILE_NAME%.osm.pbf}}"
REGION_SLUG="$(echo "$RAW_SLUG" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')"

if [[ -z "$REGION_SLUG" ]]; then
  echo "Failed to derive a valid region slug from: $RAW_SLUG"
  exit 1
fi

OSM_GRAPH_CACHE="adventure-${REGION_SLUG}-gh"
REGION_ENV_FILE="$ROOT_DIR/infra/.osm-region.env"

cat > "$REGION_ENV_FILE" <<EOF
OSM_PBF_FILE=$OSM_FILE_NAME
OSM_GRAPH_CACHE=$OSM_GRAPH_CACHE
EOF

echo "Updated $REGION_ENV_FILE"
echo "  OSM_PBF_FILE=$OSM_FILE_NAME"
echo "  OSM_GRAPH_CACHE=$OSM_GRAPH_CACHE"
echo
echo "Next step:"
echo "  pnpm docker:down && pnpm docker:up"
