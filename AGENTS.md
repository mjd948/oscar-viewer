# AI Agent & Contributor Guide — `ORNL/oscar-viewer`

`ORNL/oscar-viewer` is the Next.js / React / TypeScript operator console packaged into the [`ORNL/oscar`](https://github.com/ORNL/oscar) radiation portal monitoring (RPM), mobile radiation detection, and cargo non-intrusive inspection (NII) platform.

Both human contributors and AI coding agents (`Codex`, `Claude Code`, `Gemini` / `Antigravity`, `Cursor`, `Copilot`) **must** follow the architectural invariants below before modifying routes, hooks, components, or Redux slices. Read [`ORNL/oscar/AGENTS.md`](https://github.com/ORNL/oscar/blob/main/AGENTS.md) and [`ORNL/oscar/docs/ARCHITECTURAL_ROADMAP.md`](https://github.com/ORNL/oscar/blob/main/docs/ARCHITECTURAL_ROADMAP.md) for cross-repository roadmap and release governance.

---

## 1. Non-Negotiable UI, Safety & 50-Lane Scale Invariants

1. **Canonical Operator Routes & Regression Selector Contracts:**
   - The 8 canonical operator routes (`/`, `/map`, `/event-log`, `/lane-view`, `/report-view`, `/health`, `/servers`, `/users`) and their `data-testid` / `aria-label` contracts are continuously verified by [`ORNL/oscar-regression`](https://github.com/ORNL/oscar-regression) (`25` E2E scenarios) and [`ORNL/oscar-video-guides`](https://github.com/ORNL/oscar-video-guides) (`29` localized MP4 workflow guides + `54` operator manual screenshots).
   - **Never** remove, replace, or redirect away from canonical routes by default. New navigation views (such as `v3.12.0` Custom Dashboards) **must** be **opt-in and additive** (e.g., `/dashboards`).
2. **Safety-Critical Global `AlarmAudio` Singleton (`src/app/Providers.tsx`):**
   - [`AlarmAudio`](src/app/_components/AlarmAudio.tsx) **must** remain mounted once inside [`Providers.tsx`](src/app/Providers.tsx) so audible Gamma (`gamma.mp3`) and Neutron (`neutron.mp3`) radiation alarms sound on **every** route in the application and never instantiate duplicate overlapping audio players inside individual widgets.
3. **Bounded ConSys API & DuckDB Concurrency at 50-Lane Scale:**
   - SensorHub's `PARQUET_PRIMARY` storage engine caps concurrent DuckDB Parquet scan sessions at `2` per JVM. Never mount background `setInterval` loops or per-lane `searchObservations` fan-out across 50 lanes for Parquet-backed high-rate streams (`gammaGrossCount`, `neutronGrossCount`, `LiveDriverLocationOutput`, spectra).
   - Always bound observation queries by time window:
     - `Observations` collection API (`/sensorhub/api/observations`): bound with `phenomenonTime` or `resultTime="latest"` in small batches (`HEALTH_QUERY_BATCH_SIZE = 10`, `HEALTH_QUERY_CONCURRENCY = 2`; see [`useLaneHealth.ts`](src/lib/data/oscar/useLaneHealth.ts)).
     - `osh-js` `DataStream.searchObservations(filter, pageSize)`: note that `osh-js` `DataStream.js` excludes `phenomenonTime` from its query string (`toQueryString([], ['phenomenonTime'])`), so always pass `resultTime: "<startIso>/<endIso>"` alongside any CQL `filter` (see [`WebIdAnalysis.tsx`](src/app/_components/adjudication/WebIdAnalysis.tsx)).
4. **Realtime WebSocket Lease Discipline (`SharedConnectionPool`):**
   - Acquire realtime `osh-js` stream connections exclusively via [`acquireSharedConnection`](src/lib/data/oscar/SharedConnectionPool.ts) and release both the callback (`removeRealtimeEventSubscription`) and lease (`lease.release()`) in `useEffect` cleanup. Never call `source.connect()` / `source.disconnect()` directly on shared lane datasources.
5. **Scoped Multi-View Navigation (`scopedHref`):**
   - Preserve `?view=<scope>` query parameters across internal navigation using `scopedHref(...)` in [`Navbar.tsx`](src/app/_components/Navbar.tsx) and route links so scoped operator accounts keep their assigned lane view.
6. **4-Locale Translation Parity (`en`, `es`, `fr`, `el`):**
   - Every user-visible string added to `public/locales/en/*.json` **must** have matching keys in `es`, `fr`, and `el`, verified by `npm run validate:locales`.
7. **Repository Hygiene:**
   - Never commit `.DS_Store`, scratch files, credentials, private RFC1918 lab IPs, or internal `.local` hostnames.

---

## 2. Planned `v3.12.0` Feature Blueprints

### A. Mobile Detector System UI (`ORNL/oscar-viewer#49`)
Collaborate on shared branch `feat/v3.12.0-mobile-detector-system` rebased onto `main` (`v3.11.15`+):
- Keep the hardened `main` implementations of [`HLSVideoComponent.tsx`](src/app/_components/video/HLSVideoComponent.tsx) (`enableWorker: false` + `[5s, 15s, 30s, 60s]` backoff) and [`WebIdAnalysis.tsx`](src/app/_components/adjudication/WebIdAnalysis.tsx) (`resultTime`-bounded CQL `occupancyObsId` lookup).
- Reuse [`SharedConnectionPool`](src/lib/data/oscar/SharedConnectionPool.ts) for mobile GPS / spectrum streams, bound historical breadcrumb queries by explicit `phenomenonTime` / `resultTime` window + `limit`, and add `en`/`es`/`fr`/`el` locale keys + Cypress component specs.

### B. Opt-In Custom Widget Dashboards (`ORNL/oscar-viewer#50`)
Collaborate on shared branch `feat/v3.12.0-custom-dashboards` rebased onto `main` (`v3.11.15`+):
- **Additive Opt-In Route (`/dashboards`):** Preserve all 8 canonical routes (`/`, `/map`, `/event-log`, `/lane-view`, `/report-view`, `/health`, `/servers`, `/users`) untouched as the default operator experience, and expose Custom Dashboards as an additive opt-in workspace (`/dashboards`) in [`Navbar.tsx`](src/app/_components/Navbar.tsx) (wrapping links in `scopedHref`).
- **Keep `AlarmAudio` Global Only:** Do not mount `<AlarmAudio />` inside widget components; if a visual alarm-banner widget is offered, render visual state only while global audio stays in [`Providers.tsx`](src/app/Providers.tsx).
- **Widget Guardrails:** Enforce maximum simultaneous live-video (`<= 4`) and live-chart (`<= 6`) widgets per custom dashboard so operators cannot accidentally exhaust browser WebSockets or DuckDB sessions, and namespace `redux-persist` storage keys cleanly.

---

## 3. Branch Workflow & Required Local Verification

Review-group developers have **Write (branch-maintainer)** access to push and collaborate directly on shared feature/fix branches in `ORNL/oscar-viewer` (`feat/*`, `fix/*`), running `.github/workflows/ci.yml` automatically. Merging to `main` and pushing `v*` tags are restricted to the Repository Admin.

Run before opening or updating a PR:

```bash
npm run validate:locales
npm run lint
npm run build
npx cypress run --component --browser chrome
```
