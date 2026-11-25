## Summary
<!-- Concise explanation of the UI/data behavior solved or introduced, and why this design protects 50-lane performance and operator workflows. -->

## Related Issues / Coordinated PRs
- Roadmap / Tracking Issue:
- Matching `ORNL/oscar` / `ORNL/osh-oakridge-modules` branch (if cross-repo):

## Architectural, Safety & 50-Lane Scale Checklist
Please verify against [`AGENTS.md`](../AGENTS.md) before marking Ready for Review:
- [ ] **Canonical Routes & Selectors:** Preserves all 8 canonical routes (`/`, `/map`, `/event-log`, `/lane-view`, `/report-view`, `/health`, `/servers`, `/users`), `scopedHref` query propagation, and `data-testid` contracts used by `ORNL/oscar-regression`.
- [ ] **Global `AlarmAudio` Invariant:** `AlarmAudio` remains mounted exclusively in `src/app/Providers.tsx` (never duplicated per widget/view).
- [ ] **Bounded Queries & Realtime Leases:** Observation queries are time-bounded (`phenomenonTime` or `resultTime`) without 50-lane DuckDB fan-out; realtime WebSocket subscriptions use `acquireSharedConnection` with full `useEffect` teardown.
- [ ] **4-Locale Parity & Hygiene:** `npm run validate:locales` (`en`, `es`, `fr`, `el`) passes; zero `.DS_Store`, private RFC1918 lab IPs, or internal `.local` hostnames.

## Verification
- [ ] `npm run validate:locales && npm run lint && npm run build`
- [ ] `npx cypress run --component --browser chrome`
