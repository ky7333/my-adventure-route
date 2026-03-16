# Adventure Route MVP Roadmap

## Phase 1: Bootstrap + UX Skeleton (Now)
- Monorepo setup with web, API, shared contracts, and scoring package.
- JWT auth (email/password), planner form, and results shell with MapLibre.
- Routing provider abstraction with GraphHopper adapter + mock fallback.

## Phase 2: Real GraphHopper Tuning
- Translate preference sliders into GraphHopper custom model tuning.
- Improve alternatives quality using diversity constraints and ranking experiments.
- Expand provider telemetry for debugging route generation quality.

## Phase 3: Persistence and Export
- Add route history pages and saved route collections.
- Export generated routes as GPX and JSON downloads.
- Add route replay/share links.

## Phase 4: Difficulty + Profile Refinement
- Profile presets for beginner/intermediate/expert riders and drivers.
- Better difficulty estimation using grade, surface transitions, and road class blends.
- Collect user feedback signals on route outcomes.

## Phase 5: Production Hardening
- Add API rate limits and abuse protection.
- Add structured logs, error monitoring, and dashboards.
- Finalize deployment pipeline and OSM/GraphHopper update automation.
