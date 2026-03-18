#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <osm_url> [output_filename]"
  exit 1
fi

OSM_URL="$1"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OSM_DIR="$ROOT_DIR/infra/data/osm"

DEFAULT_FILE_NAME="$(basename "$OSM_URL")"
OSM_FILE_NAME="${2:-$DEFAULT_FILE_NAME}"
OSM_FILE="$OSM_DIR/$OSM_FILE_NAME"

mkdir -p "$OSM_DIR"

if [[ -f "$OSM_FILE" ]]; then
  echo "OSM extract already exists: $OSM_FILE"
  exit 0
fi

echo "Downloading OSM extract..."
echo "URL: $OSM_URL"
curl -fL "$OSM_URL" -o "$OSM_FILE"
echo "Saved: $OSM_FILE"
