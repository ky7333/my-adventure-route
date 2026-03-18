#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
"$ROOT_DIR/infra/scripts/fetch-osm.sh" \
  "https://download.geofabrik.de/north-america/us/vermont-latest.osm.pbf" \
  "vermont-latest.osm.pbf"
