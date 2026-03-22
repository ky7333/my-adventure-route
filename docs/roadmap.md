# Adventure Route MVP Roadmap

Last reviewed: March 21, 2026

Status legend:
- `Done`: Implemented in the codebase.
- `In Progress`: Partial implementation exists.
- `Not Started`: Planned but not yet implemented.

## Current Snapshot
- `Done`: Monorepo architecture is in place (`apps/web`, `apps/api`, `packages/contracts`, `packages/scoring`).
- `Done`: JWT email/password auth is live with protected planner routes.
- `Done`: Route planning persists `RouteRequest` + ranked `RouteOption` records in Postgres.
- `Done`: Planner and results are unified in the `/plan` page with MapLibre route visualization and surface overlays.
- `Done`: Routing provider abstraction supports GraphHopper primary + mock fallback.
- `In Progress`: GraphHopper preference tuning and alternative route quality controls are implemented but still need refinement.
- `Not Started`: History/collections UI, GPX/JSON export, and share/replay links.
- `Not Started`: API rate limiting, production monitoring dashboards, and deployment automation.

## Phase 1: Bootstrap + UX Skeleton
- `Done`: Monorepo setup with web, API, shared contracts, and scoring package.
- `Done`: JWT auth, planner flow, and map-based results UX.
- `Done`: GraphHopper adapter with fallback routing flow.

## Phase 2: GraphHopper Quality Tuning
- `Done`: Preference sliders are translated into GraphHopper `custom_model` priorities.
- `In Progress`: Alternative route diversity exists (provider alternatives + ranking/selection logic), but quality heuristics need more tuning and validation.
- `In Progress`: Provider diagnostics exist (debug payload logs and per-route provider metadata), but full telemetry/quality analytics are not in place yet.

## Phase 3: Persistence, History, and Export
- `In Progress`: Backend persistence of planned routes is complete, but user-facing history/collections views are not built yet.
- `Not Started`: GPX and JSON export endpoints/download UX.
- `Not Started`: Route replay/share links.

## Phase 4: Profiles and Difficulty Refinement
- `In Progress`: Route profile presets exist (for example: Balanced Adventure, Twisty Paved, Scenic Backroads, Dual-Sport Mixed Surface, Easy Cruise).
- `In Progress`: Difficulty scoring uses vehicle profile + surface/road-class-aware segments, but does not yet incorporate grade/elevation transitions.
- `Not Started`: Post-ride user feedback capture and scoring feedback loop.

## Phase 5: Production Hardening
- `Not Started`: API rate limits and abuse protections.
- `In Progress`: Basic operational guardrails are present (input validation, CORS allowlist, auth guards), but structured observability and alerting are not implemented.
- `In Progress`: Local infra scripts support OSM region switching; production deployment pipeline and scheduled data refresh automation are still pending.

## Next Priority Backlog
1. Build route history endpoint(s) and `/history` page (list + reopen prior route requests).
2. Add export support (`.gpx` and `.json`) for selected route options.
3. Add shareable route links (read-only tokenized route view).
4. Add API throttling/rate limiting and request abuse protections.
5. Add structured logging + error monitoring integration.
