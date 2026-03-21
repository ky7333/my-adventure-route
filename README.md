# My Adventure Route

MVP SaaS route planner for motorcycles and 4x4 vehicles with adventure-oriented routing preferences.

## What is included
- `apps/web`: React + Vite SPA (landing, auth, planner form, results shell with MapLibre)
- `apps/api`: NestJS REST API + Prisma + JWT auth
- `packages/contracts`: Shared Zod contracts and DTO types
- `packages/scoring`: Pluggable route scoring model (curvature, road class, surface, difficulty)
- `infra/docker-compose.yml`: Postgres + GraphHopper services

## Prerequisites
- Node.js 20+
- pnpm 10+
- Docker + Docker Compose

## Quick start
1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Copy environment files:
   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```
3. Download default OSM extract (Vermont):
   ```bash
   pnpm fetch:osm
   ```
4. Start infra services:
   ```bash
   pnpm docker:up
   ```
5. Generate Prisma client and run migrations:
   ```bash
   pnpm --filter @adventure/api prisma:generate
   pnpm db:migrate
   ```
6. Optional seed user:
   ```bash
   pnpm db:seed
   ```
7. Start web + api + package watchers:
   ```bash
   pnpm dev
   ```

Web: http://localhost:5173

API health: http://localhost:3001/api/health

Note: in local development, the web app uses Vite proxy (`/api` -> `http://localhost:3001`) to avoid CORS issues.
For production API runtime, use `pnpm --filter @adventure/api start:prod` (or run `node dist/main.js` directly).

## Default credentials from seed
- Email: `demo@adventureroute.dev`
- Password: set `SEED_DEMO_PASSWORD=<YOUR_DEMO_PASSWORD>` before running `pnpm db:seed`
Warning: local seed data only. Use a non-default password and remove or disable seed accounts in shared, staging, and production environments (for deployments, skip `pnpm db:seed`).

## Key API endpoints
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/health`
- `GET /api/routes/geocode?q=<address>&limit=<1-10>` (auth required)
- `POST /api/routes/plan` (auth required)
- `GET /api/routes/:id` (auth required)

## Notes on routing provider
`apps/api/.env` controls provider selection:
- `ROUTING_PROVIDER=mock` for fast local development
- `ROUTING_PROVIDER=graphhopper` to call GraphHopper
- `GRAPHHOPPER_SOURCE=local` for Docker/local GraphHopper (default base URL: `http://localhost:8989`)
- `GRAPHHOPPER_SOURCE=cloud` for graphhopper.com (default base URL: `https://graphhopper.com/api/1`)
- Optional `PHOTON_BASE_URL` override for Photon geocoding base URL
- `GRAPHHOPPER_API_KEY` is required when `GRAPHHOPPER_SOURCE=cloud`
- Optional `CORS_ORIGINS` can be set to a comma-separated allowlist for non-local frontend origins.

Example cloud config:
```bash
ROUTING_PROVIDER=graphhopper
GRAPHHOPPER_SOURCE=cloud
GRAPHHOPPER_BASE_URL=https://graphhopper.com/api/1
GRAPHHOPPER_API_KEY=your_graphhopper_account_key
GRAPHHOPPER_PROFILE=car
```

The system returns 1 to 3 ranked routes depending on provider availability.
Geocoding uses Photon (`https://photon.komoot.io/api`) through the API.

## Switching Local OSM Region
Use these commands to test other areas with local GraphHopper:

1. Download and select a region:
   ```bash
   pnpm osm:use -- https://download.geofabrik.de/north-america/us/new-york-latest.osm.pbf new-york
   ```
2. Restart infrastructure so GraphHopper imports/reuses the selected graph cache:
   ```bash
   pnpm docker:down
   pnpm docker:up
   ```

Region selection is stored in `infra/.osm-region.env` via:
- `OSM_PBF_FILE` (input `.osm.pbf` in `infra/data/osm`)
- `OSM_GRAPH_CACHE` (graph cache folder under `infra/data/graphhopper`)

Download-only helper (without switching):
```bash
pnpm fetch:osm:url -- <osm_url> [output_filename]
```

## TODOs for real routing quality
- Map sliders to GraphHopper `custom_model` settings.
- Improve alternative-route generation diversity and quality.
- Add region switching and periodic OSM import refreshes.

## Testing
Run all tests:
```bash
pnpm test
```

Run API only:
```bash
pnpm --filter @adventure/api test
```

Run web only:
```bash
pnpm --filter @adventure/web test
```

## Troubleshooting
- If GraphHopper fails on startup, ensure `infra/data/osm/vermont-latest.osm.pbf` exists.
- If you see `Couldn't load from existing folder: /data/default-gh ... DataReader wasn't specified`, your container started without `--input`; use the repo compose config (it now passes `--input` and `--graph-cache` explicitly for `israelhikingmap/graphhopper`).
- GraphHopper surface path details require `surface` in encoded values. For `israelhikingmap/graphhopper`, this is set via `JAVA_OPTS` Dropwizard override:
  - `-Ddw.graphhopper.graph.encoded_values=road_class,road_environment,max_speed,road_access,surface,car_access,car_average_speed`
- If an older broken cache exists, remove it and restart:
  ```bash
  rm -rf infra/data/graphhopper/*
  pnpm docker:down
  pnpm docker:up
  ```
- If surface still appears missing, force a full graph rebuild (this is required when encoded values change):
  ```bash
  pnpm docker:down
  rm -rf infra/data/graphhopper/<your_selected_graph_cache>
  pnpm docker:up
  ```
- Optional validation after rebuild:
  - Check `infra/data/graphhopper/<your_selected_graph_cache>/properties.txt` contains `surface` under `graph.encoded_values`.
- First GraphHopper import can take several minutes; subsequent runs should be faster due to cache.
- If Prisma migration fails, verify Postgres is running on `localhost:5432`.

## Development roadmap
See [docs/roadmap.md](docs/roadmap.md).
