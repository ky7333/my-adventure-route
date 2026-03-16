#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OSM_DIR="$ROOT_DIR/infra/data/osm"
OSM_FILE="$OSM_DIR/vermont-latest.osm.pbf"
OSM_URL="https://download.geofabrik.de/north-america/us/vermont-latest.osm.pbf"

mkdir -p "$OSM_DIR"

if [[ -f "$OSM_FILE" ]]; then
  echo "OSM extract already exists: $OSM_FILE"
  exit 0
fi

echo "Downloading Vermont OSM extract..."
curl -fL "$OSM_URL" -o "$OSM_FILE"
echo "Saved: $OSM_FILE"
