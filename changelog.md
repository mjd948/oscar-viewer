# OSCAR Viewer Change Log
All notable changes to this project will be documented in this file. 

## 3.11.10

### Fixed

- Fixed Scoped View dropdown (`DataSourceContext.tsx`, `Node.ts`, `Navbar.tsx`, `TrainingCoachDock.tsx`) retaining the cached initial `north-gate`-only Operational View catalog when switching from **Operator Track** to **Supervisor Track** (or adding/removing lanes in **Administrator Track**) inside the Hands-On Training Sandbox—`south-gate` now appears immediately without refreshing the browser.

### Changed

- Standardized password input `minLength` (`14`) and localized labels/descriptions (`14+` characters across `en`, `es`, `fr`, `el`) on `/users` (`UsersAccessManager.tsx`) to match `OscarIdentityStore.validateNewPassword` and `oscar init`.
- Synchronized operator quick-guide titles, support-bundle fallback metadata, System Update fallback version (`3.11.10`), Video Guide `#31` summary asset names, and hardware-replacement recovery checklist references with **OSCAR 3.11.10**.

## 3.11.9

### Changed

- Added Video Guides **#30** (`30-zero-login-github-system-update`, contextual on `/users`) and **#31** (`31-bare-metal-autoinstall-usb-creator`) with 4-language (`en`, `es`, `fr`, `el`) WebVTT closed-caption tracks (`31` bundled guides / `248` subtitle files total).
- Synchronized operator quick-guide titles, support-bundle fallback metadata, System Update fallback version (`3.11.9`), and hardware-replacement recovery checklist references with **OSCAR 3.11.9** (`oscar-3.11.9.zip` and standalone `oscar-3.11.9-autoinstall-usb-creator.zip`).

## 3.11.8

### Added

- Added **Zero-Login GitHub & Offline Bundle System Update Console** (`SystemUpdateApi.ts`, `SystemUpdateCard.tsx`, `SystemUpdateDialog.css`, `UsersAccessManager.tsx` `/users?tab=update`, `HelpDialog.tsx` across `en`, `es`, `fr`, `el`): allows Administrators to check public `ORNL/oscar` GitHub Releases anonymously without any GitHub account or token, inspect release notes and expected SHA-256 digests, upload offline/air-gapped `oscar-<version>.zip` bundles, confirm upgrades inside a native `<dialog>` modal (`showModal()`, safe `Cancel` focus), monitor live host-agent stages via a native `<progress>` bar and polite `role="status"` live region across container cutover (`502`/`503` reconnect handling), and reload onto the verified release (or inspect automatic rollback diagnostics).
- Added **Destination-Aware Training Sandbox Action Navigation, Live Occupancy Transit Feedback & Loopback `WebRelay-Quad` Lab (`3.5`)** (`TrainingCoachDock.tsx`, `TrainingCurriculum.ts`, `TrainingSandboxApi.ts`, `EventTable.tsx`, `HealthPage.tsx` across `en`, `es`, `fr`, `el`):
  - Selecting any Lab chip, Track tab, or the new **`Next Lab (<badge>) ->`** button inside `:8444` automatically opens `lab.route` so trainees are always on the matching page before clicking an action.
  - Clicking **Inject NORM (`Code 9999`)**, **Inject Extended Occupancy (`Code 9998`)**, or **Inject Clean Pass** automatically navigates to **Events (`/event-log`)**, displays live occupancy transit progress while `busyOccupancy` is active, resets pagination to `page 0`, enables the **`Adjudication Code`** column by default on `/event-log`, renders **`Code 9998`** alongside **`Code 9999`** badges, and explains why automated non-threat dispositions appear in `/event-log` while remaining suppressed from the active Dashboard (`/`) threat queue.
  - Clicking **Fault: Gamma High**, **Fault: Tamper**, **Clear Faults**, or Lab `3.5`'s new **Stage `DemoLane01` + Loopback WebRelay (`127.0.0.1:10180`)** automatically navigates to **Status of Health (`/health`)** and reconciles `WebRelay (AUTO) · Online` chips immediately; off-page **Highlight Control** actions also navigate to `lab.route` before applying the spotlight ring.
- Re-synchronized `VideoGuidesCatalog.ts` with all **29 human-paced `1080p` `30 fps` CFR workflow video guides** and their 232 4-language (`en`, `es`, `fr`, `el`) `.vtt` / `.srt` caption files (smooth cursor glide, pre-click hover preview ring, human typing cadence, `<= 115 WPM` narration pacing, and `>= 4.5 s` post-action steady screen holds).

### Fixed

- Eliminated unused cross-route `<link rel="preload" as="style">` console warnings in Chromium/Chrome by disabling automatic RSC route prefetching (`prefetch={false}`) across the 11 left-navigation `<Link>` items and account button in `Navbar.tsx`.
- Updated operator help titles, glossary entries (adding `Side-by-Side CAS RPM Edge Proxy`), support-bundle fallback metadata, and hardware-replacement recovery checklist references to `OSCAR 3.11.8` (`oscar-3.11.8.zip`).

## 3.11.7

### Added

- Added **Adjacent Next-Page (`page + 1`) Background Prefetch & In-Flight Promise Reuse** (`useAbortableEventQueries` in `EventTableRequests.ts`, `EventTable.tsx`): as soon as the active page finishes rendering and additional rows exist (`rowCount > (page + 1) * pageSize`), prefetches `page + 1` in the background using the exact query key (filters, node scope, operational view, sort mode, temporal window, and cutoff timestamp) with zero `/observations/count` calls, reuses resolved or in-flight prefetch promises on **Next page** clicks to keep 50-lane Dashboard pagination well within the `1,500 ms` SLO, and invalidates stale prefetches immediately on filter/sort/view/node changes, adjudications, manual retries, or live matching alarm arrivals.
- Added **4-Language (`en`, `es`, `fr`, `el`) WebVTT Closed-Caption `<track>` Synchronization** across all 29 bundled how-to video guides (`VideoGuidesCatalog.ts`, `HelpDialog.tsx`, `TrainingCoachDock.tsx`), rendering `English`, `Español`, `Français`, and `Ελληνικά` caption tracks with live `HTMLMediaElement.textTracks` mode synchronization whenever the UI language changes.
- Added **Platform-Wide Visual Symbol Introductions & 1-Click Icon Spotlights** (`PlatformIcons.tsx`, `Navbar.tsx`, `LanguageSelector.tsx`, `TrainingCurriculum.ts`, `TrainingCoachDock.tsx`, `HelpDialog.tsx`, and console page headers): pairs every left-drawer route and top-bar tool with deterministic `data-testid` spotlight targets, inline `{{icon:...}}` MUI symbol badges plus plain-language symbol descriptions across all 13 Training Coach labs and all 11 localized `Help (?)` Console Page cards (`en`, `es`, `fr`, `el`), and contextual **Highlight Icon** buttons (including **Highlight Status of Health Icon** on Lab `1.1`).

### Changed

- Upgraded GitHub Actions workflow steps (`.github/workflows/gradle_build.yml`) to Node 24-ready `actions/checkout@v5` and `actions/setup-node@v5`, and updated operator help titles, support-bundle fallback metadata, and hardware-replacement recovery checklist references to `OSCAR 3.11.7` (`oscar-3.11.7.zip`).

## 3.11.6

### Added

- Added **Zero-Refresh Live Training Sandbox Reactivity** across both host lifecycle actions (`TrainingSandboxLauncherCard.tsx`, `TrainingCoachDock.tsx` live `2.5 s` polling with `cache: "no-store"` across `start`, `stop`, and `reset`) and all in-sandbox training controls (`TrainingSandboxApi.ts`, `useLaneHealth.ts`, `EventTable.tsx`, `DataSourceContext.tsx`, `Navbar.tsx`): clicking `Clear Faults`, `Fault: Gamma High`, `Fault: Tamper`, occupancy/alarm scenario injections, track staging/reset, or closing Split-Pane `/sensorhub/admin` now reconciles `/health`, the Priority Alarm Queue (`/`), `/event-log`, scoped operational views, and auto-verified lab badges immediately without refreshing the browser.

### Changed

- Aligned the Guided Academy curriculum (`TrainingCurriculum.ts`) with the moving tractor-trailer sandbox camera feed and full `2048×600` 16-bit Beer-Lambert WCO `UFF 3.0.0` truck NII package (`SCFU8572724` / `SWT03`, UUID `dfb985c4-eb26-41ab-938b-ad2a1f5966d4`), synchronized `VideoGuidesCatalog.ts` with all 29 re-recorded `30 fps` CFR workflow guides, and updated operator help titles, support-bundle fallback metadata, and hardware-replacement recovery checklist references to `OSCAR 3.11.6` (`oscar-3.11.6.zip`).

## 3.11.5

### Added

- Added context-aware **Remote Zero-Trust Subdomain Practice Sandbox Launching** (`resolveSandboxLaunchTarget` in `TrainingSandboxApi.ts`, `TrainingSandboxLauncherCard.tsx`, `TrainingCoachDock.tsx`, `TrainingCurriculum.ts` across `en`, `es`, `fr`, `el`): automatically opens `https://<site>-sandbox.<hub>` over standard HTTPS `:443` (with Let's Encrypt TLS and shared parent-domain Passkey `rpId`) whenever a user accesses OSCAR through a Federation Hub tunnel (`<site>.<hub>`), while preserving direct `https://<host>:8444` launching on local LAN, VPN, and Tailscale connections.

### Changed

- Updated operator help titles, support-bundle fallback metadata, and hardware-replacement recovery checklist references to `OSCAR 3.11.5` (`oscar-3.11.5.zip`).

## 3.11.4

### Added

- Added per-lane **ControlByWeb WebRelay-Quad (`X-WR-4R3-E` / `X-410`) Physical RPM Lights & Sound Control** (`WebRelayApi.ts`, `LaneWebRelayDialog.tsx`, `LaneWebRelayDialog.css`, `health/page.tsx`, `lane-view/page.tsx`, `useLaneHealth.ts`, `HelpDialog.tsx`, `VideoGuidesCatalog.ts` across `807` locale keys in `en`, `es`, `fr`, `el`): remains 100% invisible on unconfigured operator views (`0` extra chips when `enabled === false`), displays live `WebRelay` / `WebRelay Aux` online/offline telemetry chips on enabled lanes in **Status of Health (`/health`)** and **Lane View (`/lane-view`)**, and provides an Administrator modal dialog (native `<dialog>` with `showModal()`) to switch lanes, inspect live `R1–R4` coil states and EML (`Code 9999`) / Extended Occupancy (`Code 9998`) suppression counters, trigger hardware-timed pulses or latched walk-around overrides on **Gamma Light + Sound** and **Neutron Blue Light**, silence/arm or release to `0,0,0,0` hardware pass-through, test HTTP/XML connectivity (`stateFull.xml` / `state.xml`), and persist per-lane `AUTO` / `PASS_THROUGH` / `MUTED` settings, alongside bundled how-to video guide `#29` (`29-lane-webrelay-lights-and-sound`).
- Added an anytime **Guided Walkthrough** button in the live operational console (`Navbar.tsx`, `TrainingCoachDock.tsx`, `TrainingSandboxLauncherCard.tsx`, `TrainingCurriculum.ts`, `TrainingSandboxApi.ts` across `en`, `es`, `fr`, `el`): opens `TrainingCoachDock` on demand in **Read-Only Refresher Mode** (`0` background polling when closed, `0` simulated alarm injections or `/stage-track` mutations on `:443`) across **13 role-based labs** (including Lab `3.5` for per-lane WebRelay-Quad lights & sound), clearly explains live-console read-only boundaries, `120-minute` automatic shutdown & volume wipe timing, one-way credential/Passkey seeding, and `TRAINING SANDBOX — NON-OPERATIONAL` watermarking, and provides 1-click idempotent `:8444` Practice Sandbox launch/open for any signed-in user (while keeping early `Stop` / `Reset` Administrator-only).

### Changed

- Updated operator help titles, support-bundle fallback metadata, and hardware-replacement recovery checklist references to `OSCAR 3.11.4` (`oscar-3.11.4.zip`).

## 3.11.3

### Added

- Added the **Hands-On Training Sandbox & Guided Academy (`oscar-sandbox`)** console experience (`TrainingSandboxApi.ts`, `TrainingCurriculum.ts`, `TrainingCoachDock.tsx`, `TrainingCoachDock.css`, `TrainingSandboxLauncherCard.tsx`, `Navbar.tsx`, `HelpDialog.tsx`, `AlarmQrTransfer.ts`, `VideoGuidesCatalog.ts` across `en`, `es`, `fr`, `el`): remains 100% inert on operational deployments (`0` extra banners, `0` background polling, and `0` screen clutter when `sandboxMode === false`), exposes cross-platform CLI commands and an optional Administrator 1-click host launcher inside **Help (`?`)**, renders a single-row high-contrast **`TRAINING SANDBOX`** top indicator and collapsible multi-modal **Training Coach** inside the isolated `:8444` sandbox (`Watch · Read · Do · Auto-Verify` across 12 Operator, Supervisor, and Split-Pane SensorHub Admin labs with offline 1080p `.mp4`/`.vtt` videos, `1920×1080` manual screenshots, 1-click practice fault/alarm/NORM/Extended Occupancy injection, downloadable `.csv`/`.n42`/`.uff`/`.pmtiles`/`.json` practice files, `[data-testid]` spotlight highlighting, live API outcome auto-verification, `TRAINING SANDBOX — NON-OPERATIONAL` QR/report watermarks, and 1-page vector PDF Completion Records), and bundles how-to video guide `#28` (`28-hands-on-training-sandbox`).

### Changed

- Updated operator help titles, support-bundle fallback metadata, and hardware-replacement recovery checklist references to `OSCAR 3.11.3` (`oscar-3.11.3.zip`).

## 3.11.2

### Added

- Added optional **Cargo Non-Intrusive Inspection (WCO `UFF 2.0` & `UFF 3.0.0`)** integration (`CargoUffApi.ts`, `Tiff16Decoder.ts`, `UffClientArchive.ts`, `CargoUffViewerDialog.tsx`, `CargoUffSmbPickerDialog.tsx`, `RuntimeExtensionsManager.tsx`, `AdjudicationDetail.tsx`, `AdjudicationLog.tsx`, `EventTable.tsx`, `VehiclePassComparisonDialog.tsx`, `HelpDialog.tsx`, `VideoGuidesCatalog.ts` across `745` locale keys in `en`, `es`, `fr`, `el`): ships disabled by default (`0` extra UI controls, `0` background threads, and `0` network requests when disabled), supports direct browser `.uff` file uploads (`up to 200 MB`) with automatic embedded `.n42` WebID extraction, provides a read-only SMBv2/SMBv3 share connector tab in **Runtime Extensions (`/extensions`)**, enables scanner/time-window browsing, 1-character fuzzy OCR container/plate correlation (`OCR ±1`), Tier-1 UFF UUID / `.uff` filename / UNC share-path lookup in **Events (`/event-log`)**, zero-dependency 16-bit `uint16` grayscale TIFF (`WebGL2` `R16UI` + `Uint32Array[65536]` LUT fallback) and palettized **HEMD** atomic-number (`Z_eff`) inspection aligned with the RPM gamma/neutron count profile, zero-download NAS adjudication linking (`.uffref.json`), and bundled how-to video guide `#27` (`27-cargo-uff-smb-and-xray-inspection`).

### Changed

- Updated operator help titles, support-bundle fallback metadata, and hardware-replacement recovery checklist references to `OSCAR 3.11.2` (`oscar-3.11.2.zip`).

## 3.11.1

### Changed

- Updated operator help titles, support-bundle fallback metadata, and hardware-replacement recovery checklist references to `OSCAR 3.11.1` (`oscar-3.11.1.zip`) in alignment with the `3.11.1 (Amber)` security and bare-metal provisioning release.

## 3.11.0

### Added

- Event Details now queries the authenticated event-scoped retained-media API by occupancy UUID and displays exactly five labeled JPEG evidence frames per camera with source ordinals and video timestamps.
- Added keyboard-accessible per-camera galleries, isolated missing/corrupt-frame handling, localized loading and error feedback, and focused API/fallback/rendering regression tests.
- Added strict catalog-transfer, per-frame, and event-wide byte, dimension, and decoded-pixel budgets. Response bodies are stopped at their streaming limits even when `Content-Length` is absent or incorrect.
- Added **EML Non-Threat** automated adjudication support across the Viewer (`en`, `es`, `fr`, `el`): non-threat EML occupancies (`eml-non-threat` / disposition code `9999`) are suppressed from Dashboard alarm notifications, queryable in the Event Log (`Adjudicated = EML Non-Threat`), and rendered in Event Details with an **EML Automated Analysis** summary card (verdict, release/investigate probabilities, model, collimation, lane width, fallback state, and per-source scores) plus formatted `EML_METADATA` feedback in the Adjudication Log.
- Added site-shared per-lane Dashboard alarm read/unread state (`/sensorhub/buckets/adjudication/dashboard-read-state`), watermark-scoped unread alarm banner counts (`100+` cap), synchronized **Unread only** toggle, quick temporal window presets (`15m`, `1h`, `24h`, `15d`), and optional latching alarm audio (`en`, `es`, `fr`, `el`).
- Added a bounded browser diagnostic flight recorder (`SupportDiagnostics.ts`), contextual route-aware click-to-play inline workflow video playback (`VideoGuidesCatalog.ts`, `/video-guides/videos/*.mp4` with synchronized `.vtt` closed captions and zero idle preload overhead), and 1-click **Export Support Bundle** action in **Help (`?`)** (`HelpDialog.tsx`, `en`, `es`, `fr`, `el`, bundling all 26 captioned 1080p how-to video guides locally for offline/air-gapped workstations) that merges redacted client diagnostics with `/sensorhub/buckets/reports/support-bundle` into `oscar-support-<UTC>.zip` (or downloads `oscar-client-support-<UTC>.zip` with CLI fallback guidance when the backend is unreachable).
- Added optional per-lane **Container & License Plate OCR** auto-fill and suggestion chips (`VehicleIdOcr.tsx`, `VehicleOcr.ts`, `Iso6346.ts`, `useVehicleOcrMap.ts`, `en`, `es`, `fr`, `el`): on lanes with `ocrConfig.enabled = true`, **Vehicle ID** in Dashboard Quick Adjudication (`EventPreview.tsx`) and Event Details (`AdjudicationDetail.tsx`) automatically fills ISO 6346 checksum-valid container codes or high-confidence (`>= 85%`) license plates unless edited by the operator, renders clickable suggestion chips with authenticated JPEG evidence crop previews (`/sensorhub/buckets/ocr/crops/<YYYY-MM-DD>/`, retained alongside `frame-03.jpg` with `ocrCropRetentionDays = 365` and held/adjudicated protection while `vehicleOcr` observations tier to `PARQUET_PRIMARY`), and exposes an optional hidden-by-default **Vehicle ID** column in `EventTable.tsx` (`0` extra network queries or MQTT leases when disabled/hidden).
- Added normalized **Vehicle ID Search, Multi-Occupancy Pass Comparison, Linked/Batch Adjudication, and Consolidated Vehicle Incident Reporting (`VEHICLE_INCIDENT`)** across single-node and federated multi-node deployments (`VehicleSearch.ts`, `VehiclePassComparisonDialog.tsx`, `EventTable.tsx`, `AdjudicationDetail.tsx`, `Report.tsx`, `en`, `es`, `fr`, `el` across `737` locale keys): exposes a semantic `<search>` bar and nested `vehicleId` filter on **Events** (`/event-log`), automatically surfaces a **Related Vehicle Passes** correlation banner in **Event Details** when multiple confirmation re-scans or gross-counting -> RS350 spectroscopic secondary transits match the normalized Vehicle ID, aligns chronological passes with visual continuity keyframes/OCR crops and fast `profileOnlyObsIds` on-demand overlaid gamma/neutron radiation profile charts, supports cross-node **Linked Adjudication** (with 1-click spectroscopic isotope carry-over), and generates **Vehicle Incident Reports** (`PDF`, `CSV`, `JSON`, `Excel (.xlsx)`), including browser-relayed remote pass bundles when federated nodes are configured.
- Added multi-format secondary-inspection gamma spectroscopy upload (`.n42`, Ortec ASCII `.spe`, Ortec/Canberra binary `.spc`, and `.xml`), offline photopeak isotope identification fallback and polynomial keV energy calibration resolution (`AdjudicationDetail.tsx`, `WebIdAnalysis.tsx`, `DetectorResponseFunction.tsx`, `IsotopeMapping.ts`, `N42Detail.tsx`), logarithmic-by-default gamma energy spectrograms (`Counts (Log)`) with an accessible 1-click `Log` / `Linear` segmented toggle and clickable Y-axis label (`SpectrumScaleControl.tsx`, `N42Chart.tsx`, `N42ChartPlayback.tsx`, `Rs350ChartPlayback.tsx`), and interactive **UpSet Co-Occurrence** intersection plots (`UpSetPlot.tsx` on `/event-log` and JSON report previews in `/report`).
- Added **Saved Queries** bookmarks (`SavedEventQueries.ts`, `SavedQueriesPopover.tsx`), instant zero-API **Back to Filtered Events** session restoration between `/event-log` and `/event-details`, collapsible on-demand Event Log **UpSet Co-Occurrence** loading (`EventTable.tsx`), secondary-inspection upload pre-toggling (`SecondaryInspectionSelect.tsx`, `AdjudicationDetail.tsx`), and multi-isotope lookup/filtering (`IsotopeMapping.ts`, `EventTableRequests.ts`) across all four locales.
- Added the localized **Users & Access (`/users`)** console (`UsersAccessManager.tsx`, `OnboardingInviteDialogs.tsx`, `AuthSessionApi.ts`, `TunnelSessionSelfHeal.ts`, `Node.ts`, `NodeForm.tsx`, `DataSourceContext.tsx`, `Navbar.tsx` across `735` locale keys in `en`, `es`, `fr`, `el`): self-service offline WebAuthn / FIDO2 Passkey enrollment/renaming/removal (with WebAuthn Signal API synchronization) and local PBKDF2 password updates, non-IT Administrator management of `Administrator`, `Operator`, and read-only `Viewer` accounts, **Bulk Enroll (CSV / Paste)** roster import (`parseBulkUserRoster`) generating ready-to-send startup text messages, printable onboarding cards, and crisp client-rendered 1-tap Passkey/Password setup QR codes (`/login/enroll?token=oscar_inv_...`) plus readable fallback codes for phone-free workstations, Operational View user scoping (`allowedViews`), persistent "Stay Signed In Until Logout" vs. Shift Kiosk session policy controls, optional Corporate OIDC + PKCE and Trusted Zero Trust Tunnel SSO configuration with 24/7 automatic tunnel session self-healing (`TunnelSessionSelfHeal.ts`), URL-normalizing server host entry (`NodeForm.tsx`), human-readable multi-node `nodeName` attribution in Consolidated Vehicle Incident Report previews (`Report.tsx`), downloadable hardware-replacement recovery checklists, and scoped **Federation Service Tokens** (`oscar_fed_<shortId>_<secret>` authenticating both HTTP `Bearer` and HiveMQ WebSocket MQTT `svc-fed-<shortId>` in **Nodes**).

- Added the localized **USB Backups (`/usb-backups`)** zero-shell administrator workspace (`UsbBackupManager.tsx`, `UsbBackupApi.ts`) for initializing external USB 3.x NVMe SSDs (`NTFS`/`ext4`, hardware-excluding OS/active OSCAR disks), switching between `continual`, `occasional`, and `disabled` modes, triggering immediate `0.0 s`-downtime delta syncs, safely ejecting drives (`SAFE_TO_UNPLUG`) for field laptop offloads, and downloading `oscar-backup-key.txt` for off-site escrow.
- Added the localized **Pluggable Runtime Extensions & Regional Packs (`/extensions`)** workspace (`RuntimeExtensionsManager.tsx`, `RuntimeExtensionsApi.ts`, `PmTilesLayerFactory.ts`, `MapComponent.tsx` across `737` locale keys in `en`, `es`, `fr`, `el`): manages upgrade-safe custom **Vehicle OCR** packs (`plate-rules.json`, `.onnx` weights, or `OcrEngine` `.jar` SPI), **Offline Regional Basemaps** (`.pmtiles` v3 vector `MVT` via local-canvas `protomaps-leaflet` and raster `PNG`/`JPEG`/`WEBP` via `pmtiles` over authenticated `HTTP 206` byte-range requests with zero external CDN requests), **Secondary Spectroscopy** (`isotope-library.json` or `SpectroscopyIdentificationAlgorithm` `.jar`), **Trusted Enterprise CAs** (`.pem`/`.crt`), **Agency Adjudication Policy Packs** (`policy-pack.json`), and **EML Alarm Assessment**, with 1-click **Reset to Shipped Default** across every subsystem.

### Changed

- Retained-media manifest validation now accepts Java `Instant.MAX` (`+1000000000-12-31T23:59:59.999999999Z`) provisional `rollbackDeleteAfter` timestamps emitted before the 24-hour MP4 rollback grace clock begins, while continuing to reject malformed signed-year timestamps.
- Event Details adjudication logs now discover all adjudication datastreams associated with a lane, merge historical observations matched either by the occupancy's `adjudicatedIds` array or by `occupancyObsId` with live MQTT entries, refresh deterministically after adjudication submission, and deduplicate entries by observation ID and timestamp.
- National Statistics refresh now follows its durable command status through `PENDING` to terminal
  completion, keeps the controls busy for the complete operation, and fetches the exact observation
  ID returned by that command instead of accepting a stale latest row. Terminal failures remain
  visible, node or operational-view changes cancel stale UI work, and scoped range scans run
  sequentially to avoid multiplying database load.
- Events without a retained-media manifest continue to use their legacy MP4 paths after the API returns `404`. Unexpected API or schema failures are visible to the operator and still offer the MP4 when available.
- During the retained-media rollback grace period, the original hot MP4 remains playable beneath the five-frame evidence gallery. Only each camera's selected JPEG is fetched initially, at most three frame requests run concurrently, loaded frames are reused in memory, and object URLs are revoked on navigation.
- The reviewed MQTT MessagePort source is pinned directly to the immutable upstream `ORNL/osh-js` commit and lockfile integrity hash, removing the personal packaging-fork dependency from clean builds.
- Status of Health and Dashboard snapshots now request at most 10 streams per batch, retain two global workers and a 10-second deadline, and recover independently when one batch stalls. This keeps browser and server work bounded against large accumulated observation histories.
- Live HLS playback in Lane Details now attaches per-viewer session headers (`X-OSCAR-HLS-Viewer` and `X-OSCAR-HLS-Viewer-State`) with periodic heartbeat and immediate unload/navigation release so multiple operators can view the same lane concurrently without interrupting each other, while stripping redundant `videos/` bucket prefixes from returned `streamPath` values.
- Localized occupancy alarm status values in `EventTable` and `AlarmTransferImport`, custom disposition code prefixes in `AdjudicationSelect` and `AdjudicationLog`, and Status of Health timestamps across English, Spanish, French, and Greek; refined domain terminology (`διέλευση`, `αξιολόγηση`, singular `Ανιχνευτής`, `Adjugé`, `fallos`) and sized table headers and navigation drawers so labels fit cleanly without clipping.

## 3.10.0

### Added

- Added configurable custom disposition codes in Event Details and bulk adjudication workflows.
- Added alarm priority sorting (`Gamma-Neutron` > `Neutron` > `Gamma`), shareable occupancy observation-ID links, live and historical Daily File RPM message displays, and individual detector charting in Lane View.

## 3.9.1

### Upgrade notes

- This release adds operator-facing navigation and URL-scoped operational views. Validate workstation URLs and train operators before production rollout.

### Added

- Added exact Event UUID lookup, fresh-session Event Details deep links, copyable node-qualified URLs, and visible UUID metadata in printed/PDF and alarm-transfer workflows.
- Added a localized Status of Health page for lane RPM and camera connectivity, radiation and tamper faults, and configurable extended-occupancy alerts.
- Added URL-scoped operational views that consistently limit lane discovery, dashboards, maps, reports, notifications, and health monitoring to assigned lanes.
- Added compact alarm QR export from the dashboard and Event Details, including adaptively downsampled gamma, neutron, and threshold series.
- Added an offline Alarm Transfer page that scans a camera or saved QR image, imports portable alarm files, verifies transfer integrity, redraws charts, and downloads or shares the alarm package.
- Added complete English, Spanish, French, and Greek interface translations for the transfer workflow.

### Changed

- Dashboard lane cards now show compact, independently labeled RPM and camera connection indicators plus gamma-high, gamma-low, neutron-high, tamper, and extended-occupancy fault indicators. They share the bounded Status of Health snapshot instead of adding per-lane health subscriptions.
- Viewer installs no longer pull the unused HTML tag injector, legacy browser-polyfill stack, or deprecated patch and test tooling.
- Alarm Transfer camera scanning now keeps a visible framed preview, reports camera and validation state, supports selecting among available cameras, preserves native scan pixels for dense alarm codes, and closes the camera immediately after stopping or importing.
- Alarm QR images now use integer module-aligned raster and display sizes so saved images and on-screen codes do not acquire decoder-breaking fractional pixel boundaries.
- Status of Health now refreshes latest observations in globally limited batches of at most 50 streams on entry and every 30 seconds instead of using per-stream real-time MQTT feeds, with a 10-second request deadline so stalled nodes cannot block later work, preventing oversized requests and bounding CPU and server load at large sites.
- Event filtering, counts, pagination, and bulk selection now query the complete matching server-side result set rather than only the currently loaded page.
- Lane Details now shows localized live-video preparation and terminal error states, retries transient playlist and media failures within fixed bounds, and offers a Retry action that safely starts one fresh server stream.
- Live-video URLs now honor each node's configured bucket endpoint, normalize platform-specific path separators, and remain same-origin for the default node.

### Security

- Alarm QR payloads are compressed Base45 documents with a SHA-256 corruption check and strict import limits. They are not encrypted or digitally signed, so the interface warns operators to confirm the source independently.
- Migrated the static Viewer to Next.js 16 and React 19, and migrated component tests to Cypress 16 with Vite 8. Removed the obsolete standalone Webpack toolchain, browser polyfills, and vulnerable patch tooling; the MQTT MessagePort fix is now pinned to its reviewed `osh-js` source commit.
- Clean installs now contain no known npm audit advisories or deprecated locked packages, and CI rejects future advisories at every severity.

## 3.8.4

### Added

- Added nested AND/OR filtering across all event columns on the dashboard and Events page.
- Added cross-page alarm selection, selection of all filtered alarms, and bulk adjudication with progress and per-event failure isolation.

### Changed

- Event counts, pages, live updates, and bulk selection now use the same filter definition.
- Occupancy ID, Max Gamma, and Max Neutron filters now default to inclusive minimum/maximum comparisons.
- Server requests and adjudication commands use bounded concurrency to protect multi-lane deployments.


## 3.0.0 - 2025-11-11
### Added
- Added MQTT to DataSources to allow client to receive messages through a single persistent websocket instead of opening multiple websockets per lane.
- 


## [2.0.0] - 2025-10-14
### Removed
- Inserting DataStreams and Systems from client
### Changed
- Updated charts to handle Aspect Occupancy events
- 
- National View Page styling and handling of data from client to backend
- Video Playback changed to use html elements rather than osh-js
- Updated osh-js to 3.1.0
- 
### Added
- Implemented Report Generation Page
- Button to export as PDF to Event Details Page
- Added SiteMap diagram to Map components
