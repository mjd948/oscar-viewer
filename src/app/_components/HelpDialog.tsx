"use client";

import * as React from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    LinearProgress,
    Paper,
    Stack,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tabs,
    Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import GpsFixedRoundedIcon from '@mui/icons-material/GpsFixedRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded';
import SystemUpdateAltRoundedIcon from '@mui/icons-material/SystemUpdateAltRounded';
import Link from 'next/link';
import { Locale, useLanguage } from '@/app/contexts/LanguageContext';
import {
    CONSOLE_PAGE_CARD_ICON_KEYS,
    PLATFORM_ICONS,
    PlatformIconBadge,
    PlatformIconKey,
    renderTextWithIconsAndCode,
    TOP_BAR_TOOL_ICON_KEYS,
    triggerPlatformSpotlight,
} from '@/app/_components/common/PlatformIcons';
import {
    exportSupportBundle,
    SupportBundleExportResult,
    SupportBundleNode,
    SupportClientStateSummary,
} from '@/lib/data/oscar/SupportDiagnostics';
import {
    CONSOLE_PAGE_CARD_GUIDE_SLUGS,
    getContextualVideoGuidesForPath,
    getVideoGuideBySlug,
    getVideoGuideCaptionTracks,
    GLOSSARY_INDEX_GUIDE_SLUGS,
    REPORT_CARD_GUIDE_SLUGS,
    resolveVideoGuidesBySlugs,
    syncVideoElementCaptionLocale,
    VIDEO_GUIDE_UI_STRINGS,
    VIDEO_GUIDES_CATALOG,
    VideoGuideEntry,
    VideoGuideTrackId,
} from '@/lib/data/oscar/VideoGuidesCatalog';
import TrainingSandboxLauncherCard from '@/app/_components/sandbox/TrainingSandboxLauncherCard';

const SYSTEM_UPDATE_SHORTCUT_COPY: Record<Locale, { title: string; desc: string; button: string }> = {
    en: {
        title: 'Zero-Login GitHub & Offline System Update (Administrators)',
        desc: 'Check ORNL/oscar GitHub Releases anonymously without any GitHub account or token, verify SHA-256 checksums, and upgrade OSCAR in place (with automatic rollback) — or upload an offline release .zip.',
        button: 'Open System Update',
    },
    es: {
        title: 'Actualización del sistema desde GitHub sin cuenta (Administradores)',
        desc: 'Consulte ORNL/oscar en GitHub Releases sin iniciar sesión ni usar tokens, verifique SHA-256 y actualice OSCAR en el lugar — o cargue un archivo .zip sin conexión.',
        button: 'Abrir actualización del sistema',
    },
    fr: {
        title: 'Mise à jour système GitHub sans compte (Administrateurs)',
        desc: 'Vérifiez anonymement les versions GitHub ORNL/oscar sans compte ni jeton, contrôlez le SHA-256 et mettez à jour OSCAR sur place — ou importez un fichier .zip hors ligne.',
        button: 'Ouvrir la mise à jour système',
    },
    el: {
        title: 'Ενημέρωση συστήματος GitHub χωρίς σύνδεση λογαριασμού (Διαχειριστές)',
        desc: 'Ελέγξτε ανώνυμα τις εκδόσεις ORNL/oscar στο GitHub χωρίς λογαριασμό ή διακριτικό, επαληθεύστε το SHA-256 και αναβαθμίστε το OSCAR επιτόπου — ή μεταφορτώστε αρχείο .zip εκτός σύνδεσης.',
        button: 'Άνοιγμα ενημέρωσης συστήματος',
    },
};

const TOP_BAR_TOOLS_CARD_TITLE: Record<Locale, string> = {
    en: 'Top-Bar Console Controls & Visual Symbols',
    es: 'Controles y símbolos visuales de la barra superior',
    fr: 'Commandes et symboles visuels de la barre supérieure',
    el: 'Στοιχεία ελέγχου & οπτικά σύμβολα επάνω γραμμής',
};

interface HelpSectionItem {
    title: string;
    summary: string;
}

interface GlossaryEntry {
    term: string;
    meaning: string;
}

interface LocalizedHelpContent {
    dialogTitle: string;
    dialogSubtitle: string;
    tabs: {
        pages: string;
        reports: string;
        glossary: string;
        links: string;
    };
    pagesIntro: string;
    pages: HelpSectionItem[];
    reportsIntro: string;
    reports: HelpSectionItem[];
    formatsTitle: string;
    formats: HelpSectionItem[];
    glossaryIntro: string;
    glossaryTermHeader: string;
    glossaryMeaningHeader: string;
    glossary: GlossaryEntry[];
    linksIntro: string;
    adminLinkLabel: string;
    adminLinkDesc: string;
    videoGuidesLinkLabel: string;
    videoGuidesLinkDesc: string;
    supportBundleTitle: string;
    supportBundleDesc: string;
    supportBundlePrivacyNote: string;
    supportBundleButtonLabel: string;
    supportBundleCombinedSuccess: (fileName: string) => string;
    supportBundleClientFallback: (fileName: string) => string;
    supportBundleUnexpectedError: string;
    closeLabel: string;
}

const HELP_CONTENT: Record<Locale, LocalizedHelpContent> = {
    en: {
        dialogTitle: 'OSCAR 3.11.15 Operator Quick Guide & Glossary',
        dialogSubtitle: 'Plain-language reference for console workflows, multi-format reports, and radiation portal terminology.',
        tabs: {
            pages: 'Console Pages',
            reports: 'Reports & Exports',
            glossary: 'Key Terms Explained',
            links: 'Manual & Video Guides',
        },
        pagesIntro: 'Use the left navigation drawer to switch between OSCAR operator views:',
        pages: [
            {
                title: 'Dashboard (`/`)',
                summary: 'Real-time lane status grid, site map, live alarm feed, Customize Dashboard layout control, and quick adjudication preview drawer. Unread Dashboard alarms appear in bold with an indicator dot and are shared per lane across workstations; use the ephemeral Unread only toggle (in the banner or toolbar) or quick time-window presets (`15m`, `1h`, `24h`, `15d`) to focus the active queue, click an alarm row, Acknowledge Selected, or Acknowledge All (scoped to the active Operational View, time window, and filters) to mark read, and optionally enable Unread alarm banner (with full watermark-scoped counts and `100+` cap) or Latching alarm audio in Settings.',
            },
            {
                title: 'Events (`/event-log`)',
                summary: 'Searchable historical log of all occupancies, alarms, and faults. Search by normalized Vehicle / ISO 6346 Container ID (or paste a WCO UFF scan UUID / `.uff` filename / share path when Cargo NII is enabled) across local and federated nodes to open Multi-Pass Vehicle Comparison or 16-bit Cargo X-Ray inspection, filter by Event UUID, lane, time window, Adjudication Code (`Code 9998: Extended Occupancy Gamma Alarm`, `Code 9999: EML Non-Threat`, built-in `1–11`, and custom codes), or nested AND/OR rules, or select multiple alarms for bulk adjudication.',
            },
            {
                title: 'Status of Health (`/health`)',
                summary: 'Live connection state (Online, Offline, Waiting) for every RPM and camera, plus Gamma High/Low, Neutron High, Tamper, and Extended Occupancy (`Fault - Extended Occupancy` + `Code 9998` gamma-only auto-adjudication) fault indicators.',
            },
            {
                title: 'Map (`/map`)',
                summary: 'Full-screen georeferenced site diagram or tile map (including air-gapped regional `.pmtiles` vector/raster basemaps under `Offline: <Layer Name>`) with live color-coded lane markers.',
            },
            {
                title: 'National (`/national-view`)',
                summary: 'Multi-node summary grid comparing occupancies, gamma/neutron alarms, and faults across local and federated OSCAR nodes.',
            },
            {
                title: 'Report Generator (`/report`)',
                summary: 'On-demand report generation across Entire Node, Operational View, or Specific Lanes in PDF, CSV, JSON, and Excel (.xlsx) formats.',
            },
            {
                title: 'Alarm Transfer (`/alarm-transfer`)',
                summary: 'Air-gapped QR code and `.oscar-alarm.json` export/import for sharing verified compact alarm summaries and count curves offline.',
            },
            {
                title: 'Users & Access (`/users`)',
                summary: 'Self-service account management for registering offline FIDO2 / WebAuthn Passkeys (Face ID, Touch ID, Windows Hello, YubiKey) and changing local passwords (independent from Octelium Zero-Trust tunnel credentials), plus non-IT Administrator controls for Users & Roles (`Administrator`, `Operator`, `Viewer`), Bulk CSV/Paste User Enrollment with ready-to-send startup messages and 1-tap Passkey/Password setup QR codes (`/login/enroll?token=oscar_inv_...`), Operational View user scoping, phone-free temporary passwords, Federation Service Tokens (`oscar_fed_...`) with 1-click launch into `/servers?auth=bearer`, Corporate or Self-Hosted (`ORNL/oscar-federation-hub`) OIDC / Trusted Tunnel SSO policy (`X-Octelium-Groups`, optional private-CA PEM trust, and 1-click Open Federated User Console), and the Backup & Hardware Replacement checklist.',
            },
            {
                title: 'Servers (`/servers`)',
                summary: 'Connect federated remote OSCAR sites for National View (`/national-view`) and Multi-Pass Vehicle Search (`/event-log`): click "Use Federation Token (oscar_fed_...)" (or set Authentication Method to Federation Service Token), check HTTPS (port 443), and paste the `oscar_fed_...` token minted on the remote site under Users & Access -> Federation Tokens.',
            },
            {
                title: 'USB Backups (`/usb-backups`)',
                summary: 'Administrator manager for zero-downtime (`0.0 s` portal outage) incremental backups to an external USB 3.x NVMe SSD (`NTFS` default), supporting Continual Background Sync (with automatic USB reconnect catch-up), Occasional / On-Demand Visit Sync, 1-click Safely Eject USB Drive (`SAFE_TO_UNPLUG`), SHA-256 verification, and off-site `oscar-backup-key.txt` escrow download.',
            },
            {
                title: 'Runtime Extensions (`/extensions`)',
                summary: 'Upgrade-safe administrator hub for hot-swapping regional OCR model & Unicode plate-rule packs, air-gapped `.pmtiles` v3 regional basemaps, secondary-inspection spectroscopy isotope libraries, trusted enterprise X.509 CA certificates, disposition policy packs, EML plugins, and optional read-only SMBv2/SMBv3 Cargo NII (WCO UFF 2.0 / 3.0) shares while preserving OSCAR’s shipped built-in defaults.',
            },
        ],
        reportsIntro: 'Every report request generates a fresh file and overwrites any earlier file with the same parameters:',
        reports: [
            {
                title: 'RDS Site Report (`RDS_SITE`)',
                summary: 'Executive site KPI summary, alarm and automated disposition rates (`Code 9998: Extended Occupancy Gamma Alarm`, `Code 9999: EML Non-Threat`, and `Operator Review Required`), fault totals, storage capacity, and per-lane summary table.',
            },
            {
                title: 'Lane Report (`LANE`)',
                summary: 'Per-lane operational KPIs, alarm and automated disposition (`9998`/`9999`) rates, fault breakdown, and daily time-series activity for the selected scope.',
            },
            {
                title: 'Event Report (`EVENT`)',
                summary: 'Daily time-series charts and tables for Alarms & Occupancies, Alarms Only, or State of Health (`Gamma High`, `Gamma Low`, `Neutron High`, `Tamper`).',
            },
            {
                title: 'Adjudication Report (`ADJUDICATION`)',
                summary: 'Starts with the All Selected Lanes (`ALL_LANES`) UpSet Alarm & Source-Category Co-Occurrence chart (populated categories listed first and rare SNM intersections rolled into a crimson `Other SNM` bar summing to the exact SNM total) plus summed Disposition and Isotope Results tables, followed by per-lane breakdowns.',
            },
            {
                title: 'Adjudication Details Extract (`ADJUDICATION_DETAILS`)',
                summary: 'Complete line-by-line audit table of every submitted adjudication (Submission Time, Lane, Username, Occupancy Count, Code, Feedback, Secondary Inspection, Isotopes, Vehicle ID, File Paths, Occupancy ID).',
            },
            {
                title: 'Vehicle Incident Report (`VEHICLE_INCIDENT`)',
                summary: 'Consolidated multi-pass incident package correlating confirmation re-scans and gross-count-to-spectroscopic (RS350 / WebID) secondary passes for a Vehicle or ISO 6346 Container ID across local and federated nodes, including Enhanced Machine Learning (EML) classifications, radiation profile charts, OCR evidence, and disposition audit trail.',
            },
        ],
        formatsTitle: 'Supported Export Formats',
        formats: [
            {
                title: 'PDF (`.pdf`)',
                summary: 'Formatted executive document with KPI cards, charts, and styled tables rendered directly in the browser preview.',
            },
            {
                title: 'CSV (`.csv`)',
                summary: 'Universal comma-separated text with metadata headers and section tables; previews inline and opens in any spreadsheet or script.',
            },
            {
                title: 'JSON (`.json`)',
                summary: 'Structured machine-readable payload containing report metadata, sections, headers, and typed rows.',
            },
            {
                title: 'Excel (`.xlsx`)',
                summary: 'Multi-worksheet OpenXML workbook with a Metadata sheet and dedicated formatted sheets for each report section.',
            },
        ],
        glossaryIntro: 'Plain-language definitions of technical terms used across OSCAR:',
        glossaryTermHeader: 'Term / Acronym',
        glossaryMeaningHeader: 'Plain-Language Meaning',
        glossary: [
            {
                term: 'Occupancy',
                meaning: 'One complete passage of a vehicle, container, or pedestrian through a detection lane between entry (`GS`) and exit (`GX`).',
            },
            {
                term: 'CPS (Counts Per Second)',
                meaning: 'Raw radiation detector count rate measured each sampling interval during background or occupancy.',
            },
            {
                term: 'NSIGMA (N-Sigma)',
                meaning: 'Number of standard deviations (σ) that the gamma count rate rises above recent background; used to trigger gamma alarms consistently.',
            },
            {
                term: 'NORM',
                meaning: 'Naturally Occurring Radioactive Material — benign cargo containing natural isotopes (such as potassium-40 in fertilizer, kitty litter, or ceramics, or thorium/uranium in granite).',
            },
            {
                term: 'EML & Code 9999',
                meaning: 'Enhanced Machine Learning — Rapiscan algorithm comparing gamma energy windows to distinguish benign NORM cargo from threat sources. Non-threat NORM alarms are auto-adjudicated as `Code 9999: EML Non-Threat`.',
            },
            {
                term: 'Extended Occupancy (`Fault - Extended Occupancy`) & Code 9998',
                meaning: 'When a vehicle occupies a lane for at least its configured threshold (`extendedOccupancyThresholdMinutes`, default 1 min), OSCAR publishes `Fault - Extended Occupancy`. If it completes with a gamma-only alarm (no neutron alarm), OSCAR suppresses it from the live Dashboard queue and auto-adjudicates it as `Code 9998: Extended Occupancy Gamma Alarm`. Neutron alarms are never auto-adjudicated.',
            },
            {
                term: 'WebID & DRF',
                meaning: 'WebID is the Sandia Full Spectrum isotope identification service for uploaded spectra (`N42`/SPC). The DRF (Detector Response Function) specifies the detector model and geometry.',
            },
            {
                term: 'Daily File Codes (`GB`, `GS`, `GA`, `NS`, `GX`, `SG1`–`SG3`, `SN1`–`SN2`)',
                meaning: 'Raw RPM daily CSV record codes: `GB`/`NB` = gamma/neutron background, `GS` = occupancy start, `GC`/`NC` = count profile, `GA`/`NA`/`NS` = gamma/neutron alarm, `GX` = occupancy end, `TT`/`TC` = tamper fault/clear, `SG1`–`SG3`/`SN1`–`SN2` = daily gamma/neutron setup parameters (auto-synced to `config.json`).',
            },
            {
                term: 'Event UUID',
                meaning: 'Globally unique identifier assigned to each occupancy event for exact searching, QR transfer, and cross-referencing.',
            },
            {
                term: 'Operational View (`?view=<key>`)',
                meaning: 'Named workstation filter (such as `north-gate`) selectable from the top-bar Scoped View dropdown (or via `?view=<key>` URLs) that scopes Dashboard, Events, Status of Health, Map, and Reports to assigned lanes while respecting account `allowedViews` permissions.',
            },
            {
                term: 'Retained 5-Frame Media',
                meaning: 'Five evenly spaced JPEG snapshots (`frame-01.jpg`–`frame-05.jpg`) extracted from each alarm clip. After 30 days, secondary frames are pruned while the midpoint keyframe (`frame-03.jpg`) is kept.',
            },
            {
                term: 'Parquet Cold Tier (`PARQUET_PRIMARY`)',
                meaning: 'Default storage mode where completed 30-minute PostgreSQL staging partitions across all 22 operational and evidentiary outputs (including `vehicleOcr`) are exported to ZSTD-compressed Apache Parquet files for compact long-term retention.',
            },
            {
                term: 'Container & License Plate OCR (`ocrConfig`)',
                meaning: 'Optional per-lane asynchronous background OCR (disabled by default). When enabled on a lane, OSCAR samples occupancy frames as CPU/heap resources allow, tiers `vehicleOcr` candidates to `PARQUET_PRIMARY`, retains date-partitioned JPEG evidence crops alongside retained `frame-03.jpg` media (`ocrCropRetentionDays = 365`, preserving held and operator-adjudicated events and deleting transient non-alarm clips immediately when `Alarms Only` is off), auto-fills ISO 6346 check-digit-verified container codes (or high-confidence plates) into untouched Vehicle ID fields, and displays click-to-apply suggestion chips with crop thumbnails.',
            },
            {
                term: 'Passkeys (WebAuthn / FIDO2) & Persistent Sessions',
                meaning: 'Phishing-resistant public-key sign-in using Face ID, Touch ID, Windows Hello, or hardware security keys (such as YubiKey) verified locally by OSCAR with zero internet dependency. Sessions persist across browser restarts, server reboots, and `oscar upgrade` until explicit Log Out or administrator revocation; facilities prohibiting personal electronics can use individual PBKDF2 local passwords.',
            },
            {
                term: 'Federation Service Tokens (`oscar_fed_...`)',
                meaning: 'Scoped Bearer / MQTT credentials for multi-site National View (`/national-view`) and Multi-Pass Vehicle Search (`/event-log`) without sharing human passwords: 1) create the token on the remote target site in Users & Access (`/users`) -> Federation Tokens (`Viewer` read-only or `Operator` role); 2) paste it on the monitoring site in Servers (`/servers`) -> Add Server -> Authentication Method: Federation Service Token.',
            },
            {
                term: 'Pluggable Runtime Extensions & Regional Packs (`/extensions`)',
                meaning: 'Upgrade-safe administrator hub for hot-swapping regional OCR model/plate-rule packs (`OcrEngine` SPI or ONNX `.zip`), offline regional `.pmtiles` vector/raster basemaps (`/var/lib/oscar/extensions/maps-storage/`), secondary-inspection spectroscopy isotope libraries, trusted enterprise X.509 CA certificates, disposition policy packs, and EML plugins without overwriting OSCAR’s shipped built-in defaults.',
            },
            {
                term: 'Continual & Occasional USB NVMe Backups (`/usb-backups`)',
                meaning: 'Zero-downtime (`0.0 s` portal outage) content-addressed incremental backup to an external USB 3.x NVMe SSD (`NTFS` default, readable on Windows, macOS, and Linux laptops). Supports Continual Background Sync (with automatic catch-up on USB reconnect), Occasional Visit Sync, 1-click Safely Eject (`SAFE_TO_UNPLUG`), laptop delta copy (`COPY-TO-ANOTHER-DRIVE.bat` / `./copy-to-another-drive.sh`), and cold-iron recovery (`oscar usb-backup restore`).',
            },
            {
                term: 'WCO UFF 2.0 / 3.0 & HEMD Cargo Radiographs (`/extensions` -> Cargo NII)',
                meaning: 'World Customs Organization Unified File Format (`.uff`) packages produced by non-intrusive cargo X-ray scanners (disabled by default for zero screen clutter). Operators can always inspect local `.uff` files via Upload Files in Secondary Inspection, or an administrator can connect a read-only SMBv2/SMBv3 share in `/extensions` for scanner/time-window browsing, UFF UUID lookup, 1-character fuzzy container OCR correlation, 16-bit `uint16` TIFF window/level & HEMD atomic-number (`Z_eff`) inspection aligned with the RPM gamma/neutron count strip, and zero-download adjudication linking.',
            },
            {
                term: 'Hands-On Training Sandbox & Guided Academy (`oscar-sandbox`)',
                meaning: 'Isolated ephemeral `:8444` training environment (`sudo bash oscar.sh sandbox start` / `.\\oscar.bat sandbox start`) reusing the installed OSCAR image with `archive.enabled = false`, zero writes to production PostgreSQL/Parquet/`config.json`, a built-in loopback Rapiscan + RTSP + OCR + Cargo UFF + `WebRelay-Quad` (`127.0.0.1:10180`) micro-emulator, a multi-modal Training Coach (4-language videos, screenshots, destination-aware 1-click fault/alarm injection that opens `/event-log` for `Code 9999` / `Code 9998` / `Clean Pass` and `/health` for faults, Split-Pane SensorHub Admin, outcome auto-verification, and 1-page PDF Completion Record), and complete `< 2 s` flush on exit.',
            },
            {
                term: 'RPM Lights & Sound (`webRelayConfig` — WebRelay-Quad)',
                meaning: 'Optional per-lane network relay control (`enabled = false` by default) for ControlByWeb WebRelay-Quad (`X-WR-4R3-E` / `X-410`) HTTP/XML modules (`stateFull.xml` / `state.xml`) across a Primary Pillar unit and optional Ancillary Dry-Contact unit. Supports Automatic (`AUTO`) occupancy/EML gatekeeping (arming `R1=1, R2=1`, suppressing `Code 9999: EML Non-Threat` and optionally `Code 9998: Extended Occupancy Gamma Alarm`, pulsing `R3` Gamma Red Light + Siren and/or `R4` Neutron Blue Light on actionable alarms, and failing safe to `0,0,0,0` pass-through when stopped), `PASS_THROUGH`, `MUTED`, and live Administrator manual controls in `/health`, `/lane-view`, and `/sensorhub/admin`.',
            },
            {
                term: 'Side-by-Side CAS RPM Edge Proxy (`oscar-rpm-proxy`)',
                meaning: 'Optional isolated Docker stack (`sudo bash oscar.sh rpm-proxy` / `.\\oscar.bat rpm-proxy`) for portals operating OSCAR alongside an existing Central Alarm Station (CAS). Fans out `1–50` single-client Rapiscan RPM TCP streams simultaneously at `< 1 ms` latency using Port-Mapped (`11601..11650`) or Ubuntu 24.04 Transparent Virtual-IP `:1600` mode, replays cached `SG1..SG3` / `SN1..SN2` setup frames, keeps CAS connected across OSCAR restarts/upgrades, and propagates physical RPM disconnects to both systems in `<= 4.0 s`.',
            },
        ],
        linksIntro: 'Open the full administrator manual in SensorHub Admin or watch the bite-sized how-to video guides:',
        adminLinkLabel: 'Open SensorHub Admin & In-UI Operator Manual (`/sensorhub/admin`)',
        adminLinkDesc: 'Requires administrator sign-in. Select OSCAR Service or any sensor module and open its README tab for the localized manual.',
        videoGuidesLinkLabel: 'Open OSCAR How-To Video Guides (`ORNL/oscar-video-guides`)',
        videoGuidesLinkDesc: '29 bite-sized (< 2 min) narrated/captioned screen recordings covering Ubuntu & Windows field setup, Hands-On Training Sandbox, per-lane WebRelay RPM Lights & Sound control, USB NVMe backups, pluggable extensions, offline .pmtiles maps, WCO Cargo UFF 16-bit X-ray inspection, lane setup, adjudication, EML, Vehicle OCR, Users & Passkeys, federation, support bundles, and multi-format reports.',
        supportBundleTitle: 'Troubleshooting & Support Bundle (`.zip`)',
        supportBundleDesc: 'Downloads a single diagnostic `.zip` combining recent browser console/network diagnostics with OSCAR server logs, module states, and JVM/storage health. If the server cannot be reached or fails to start, run `./oscar.sh support-bundle` (Linux) or `oscar.bat support-bundle` (Windows) on the host.',
        supportBundlePrivacyNote: 'Privacy & security: collected only to diagnose technical issues; passwords, tokens, session cookies, RTSP credentials, and private keys are automatically scrubbed.',
        supportBundleButtonLabel: 'Export Support Bundle',
        supportBundleCombinedSuccess: (fileName: string) => `Downloaded ${fileName} (client + server diagnostics, secrets redacted).`,
        supportBundleClientFallback: (fileName: string) => `Server bundle unreachable; downloaded client diagnostics (${fileName}). Run ./oscar.sh support-bundle or oscar.bat support-bundle on the server for host/container logs.`,
        supportBundleUnexpectedError: 'Unable to export the browser support bundle. Run ./oscar.sh support-bundle or oscar.bat support-bundle on the server.',
        closeLabel: 'Close',
    },
    es: {
        dialogTitle: 'Guía rápida y glosario del operador de OSCAR 3.11.15',
        dialogSubtitle: 'Referencia en lenguaje claro para flujos de consola, informes multiformato y terminología de pórticos de radiación.',
        tabs: {
            pages: 'Páginas de consola',
            reports: 'Informes y formatos',
            glossary: 'Términos explicados',
            links: 'Manual y videoguías',
        },
        pagesIntro: 'Use el menú lateral izquierdo para cambiar entre las vistas operativas de OSCAR:',
        pages: [
            {
                title: 'Panel (`/`)',
                summary: 'Cuadrícula en tiempo real del estado de carriles, mapa del sitio, flujo de alarmas, control Personalizar panel y adjudicación rápida. Las alarmas no leídas se muestran en negrita con punto indicador (compartidas por carril entre estaciones); use el conmutador efímero Solo no leídas o las ventanas temporales rápidas (`15m`, `1h`, `24h`, `15d`) en la barra de herramientas, pulse una fila, Reconocer seleccionadas o Reconocer todas para marcarlas como leídas, y active opcionalmente el aviso visual (con recuento completo y límite `100+`) o el audio continuo en Configuración.',
            },
            {
                title: 'Eventos (`/event-log`)',
                summary: 'Registro histórico de ocupaciones, alarmas y fallos con búsqueda normalizada por ID de vehículo / contenedor ISO 6346 (o pegado de UUID / archivo `.uff` cuando Carga NII está activa), comparación multipasada, filtros por Código de adjudicación (`Código 9998`, `Código 9999`, `1–11` y personalizados) y adjudicación masiva.',
            },
            {
                title: 'Estado de salud (`/health`)',
                summary: 'Estado en vivo de conexión (En línea, Sin conexión, Esperando) de cada RPM y cámara, e indicadores de fallos, manipulación y ocupación prolongada (`Fault - Extended Occupancy` + `Código 9998`).',
            },
            {
                title: 'Mapa (`/map`)',
                summary: 'Plano georreferenciado del sitio o mapa de teselas a pantalla completa con marcadores de carril en vivo.',
            },
            {
                title: 'Nacional (`/national-view`)',
                summary: 'Resumen multinodo de ocupaciones, alarmas gamma/neutrones y fallos en nodos locales y federados.',
            },
            {
                title: 'Generador de informes (`/report`)',
                summary: 'Generación de informes por Nodo completo, Vista operativa o Carriles específicos en formatos PDF, CSV, JSON y Excel (.xlsx).',
            },
            {
                title: 'Transferencia de alarmas (`/alarm-transfer`)',
                summary: 'Exportación e importación de códigos QR y archivos `.oscar-alarm.json` para entornos aislados sin conexión.',
            },
            {
                title: 'Usuarios y acceso (`/users`)',
                summary: 'Gestión de cuenta personal para registrar llaves de acceso FIDO2 / WebAuthn sin internet (Face ID, Touch ID, Windows Hello, YubiKey) y cambiar contraseñas locales (independientes del túnel Octelium Zero-Trust), además de controles administrativos para Usuarios y roles (`Administrador`, `Operador`, `Visor`), inscripción masiva CSV/pegado con códigos QR (`/login/enroll?token=oscar_inv_...`), alcance por Vista operativa, tokens de federación (`oscar_fed_...`) con acceso en 1 clic a `/servers?auth=bearer`, directiva SSO OIDC / túnel (`ORNL/oscar-federation-hub`, `X-Octelium-Groups`, CA PEM privada y acceso directo a la consola externa) y guía de copia de seguridad.',
            },
            {
                title: 'Servidores (`/servers`)',
                summary: 'Conexión de sitios OSCAR remotos federados para Vista Nacional (`/national-view`) y Búsqueda multipasada (`/event-log`): pulse "Usar token de federación (oscar_fed_...)" (o elija Token de servicio de federación), active HTTPS (puerto 443) y pegue el token creado en el sitio remoto en Usuarios y acceso -> Tokens de federación.',
            },
            {
                title: 'Copias USB (`/usb-backups`)',
                summary: 'Gestión administrativa de copias incrementales sin interrupción (`0.0 s`) en unidades externas SSD NVMe USB 3.x (`NTFS` predeterminado), con Sincronización Continua Automática, Sincronización Ocasional, Expulsión Segura con 1 clic (`SEGURO PARA DESCONECTAR`), verificación SHA-256 y descarga de `oscar-backup-key.txt`.',
            },
            {
                title: 'Extensiones de ejecución (`/extensions`)',
                summary: 'Centro administrativo persistente ante actualizaciones para cambiar en caliente modelos y reglas regionales OCR, mapas regionales sin conexión `.pmtiles` v3, bibliotecas de espectroscopia secundaria, certificados CA X.509, paquetes de códigos de adjudicación, complementos EML y recursos SMBv2/SMBv3 opcionales de solo lectura para Carga NII (WCO UFF 2.0 / 3.0) conservando los valores predeterminados integrados.',
            },
        ],
        reportsIntro: 'Cada solicitud genera un archivo nuevo y sobrescribe cualquier archivo previo con los mismos parámetros:',
        reports: [
            {
                title: 'Informe del sitio RDS (`RDS_SITE`)',
                summary: 'Resumen ejecutivo del sitio, tasas de alarma y supresión EML (`Código 9999` frente a `Revisión de operador`), fallos, almacenamiento y tabla por carril.',
            },
            {
                title: 'Informe de carril (`LANE`)',
                summary: 'Indicadores operativos por carril, tasas de alarmas y EML, desglose de fallos y actividad diaria.',
            },
            {
                title: 'Informe de eventos (`EVENT`)',
                summary: 'Gráficos y tablas diarias de Alarmas y ocupaciones, Solo alarmas o Estado de salud.',
            },
            {
                title: 'Informe de adjudicación (`ADJUDICATION`)',
                summary: 'Comienza con las tablas sumadas de Todos los carriles seleccionados (`ALL_LANES`) (Disposición e Isótopos), seguidas del desglose individual de cada carril.',
            },
            {
                title: 'Extracto detallado de adjudicación (`ADJUDICATION_DETAILS`)',
                summary: 'Tabla de auditoría línea por línea de cada adjudicación enviada (hora, carril, usuario, conteo, código, notas, inspección secundaria, isótopos, vehículo, archivos e ID de ocupación).',
            },
            {
                title: 'Informe de incidente de vehículo (`VEHICLE_INCIDENT`)',
                summary: 'Paquete consolidado multipasada que correlaciona reescaneos de confirmación y pasadas secundarias espectroscópicas (RS350 / WebID) para un ID de vehículo o contenedor ISO 6346 en nodos locales y federados, con clasificaciones de Aprendizaje Automático Mejorado (EML), trazas de radiación, evidencia OCR e historial de adjudicación.',
            },
        ],
        formatsTitle: 'Formatos de exportación compatibles',
        formats: [
            {
                title: 'PDF (`.pdf`)',
                summary: 'Documento ejecutivo con tarjetas KPI, gráficos y tablas con estilo visualizado directamente en el navegador.',
            },
            {
                title: 'CSV (`.csv`)',
                summary: 'Texto separado por comas con encabezados de metadatos y vista previa tabular integrada.',
            },
            {
                title: 'JSON (`.json`)',
                summary: 'Estructura legible por máquina con metadatos, secciones, encabezados y filas tipadas.',
            },
            {
                title: 'Excel (`.xlsx`)',
                summary: 'Libro OpenXML con múltiples hojas de cálculo para metadatos y cada sección del informe.',
            },
        ],
        glossaryIntro: 'Definiciones en lenguaje claro de los términos técnicos utilizados en OSCAR:',
        glossaryTermHeader: 'Término / Sigla',
        glossaryMeaningHeader: 'Significado en lenguaje claro',
        glossary: [
            {
                term: 'Ocupación (Occupancy)',
                meaning: 'Un paso completo de un vehículo, contenedor o peatón por un carril entre el inicio (`GS`) y el fin (`GX`).',
            },
            {
                term: 'CPS (Conteos por segundo)',
                meaning: 'Tasa bruta de conteo del detector de radiación medida en cada intervalo de muestreo.',
            },
            {
                term: 'NSIGMA (N-Sigma)',
                meaning: 'Número de desviaciones estándar (σ) que el conteo gamma supera al promedio reciente de fondo.',
            },
            {
                term: 'NORM',
                meaning: 'Material radiactivo de origen natural: carga benigna con isótopos naturales (fertilizantes, arena para gatos, cerámica, granito).',
            },
            {
                term: 'EML y Código 9999',
                meaning: 'Aprendizaje automático mejorado (Enhanced Machine Learning) en pórticos Rapiscan para distinguir carga NORM benigna de amenazas. Las alarmas NORM no amenazantes se auto-adjudican como `Código 9999: EML sin amenaza`.',
            },
            {
                term: 'Ocupación prolongada (`Fault - Extended Occupancy`) y Código 9998',
                meaning: 'Cuando un vehículo ocupa un carril al menos su umbral configurado (`extendedOccupancyThresholdMinutes`, predeterminado 1 min), OSCAR publica `Fault - Extended Occupancy`. Si finaliza con alarma solo gamma (sin alarma de neutrones), se suprime del panel y se auto-adjudica como `Código 9998: Alarma gamma de ocupación prolongada`.',
            },
            {
                term: 'WebID y DRF',
                meaning: 'Servicio Sandia Full Spectrum para identificar isótopos en espectros. La DRF indica el modelo y geometría del detector.',
            },
            {
                term: 'Códigos de archivo diario (`GB`, `GS`, `GA`, `NS`, `GX`, `SG1`–`SG3`, `SN1`–`SN2`)',
                meaning: '`GB`/`NB` = fondo gamma/neutrones, `GS` = inicio de ocupación, `GC`/`NC` = conteos, `GA`/`NA`/`NS` = alarma, `GX` = fin de ocupación, `TT`/`TC` = manipulación, `SG1`–`SG3`/`SN1`–`SN2` = parámetros diarios sincronizados en `config.json`.',
            },
            {
                term: 'UUID de evento',
                meaning: 'Identificador único global asignado a cada evento de ocupación para búsqueda exacta y transferencia QR.',
            },
            {
                term: 'Vista operativa (`?view=<clave>`)',
                meaning: 'Filtro con nombre seleccionable desde el menú desplegable Vista operativa de la barra superior (o mediante URLs `?view=<clave>`) que limita la consola a los carriles asignados respetando los permisos `allowedViews` del usuario.',
            },
            {
                term: 'Medios retenidos de 5 fotogramas',
                meaning: 'Cinco instantáneas JPEG (`frame-01.jpg`–`frame-05.jpg`) por alarma. Tras 30 días se conservan el fotograma central (`frame-03.jpg`) y se depuran los secundarios.',
            },
            {
                term: 'Nivel frío Parquet (`PARQUET_PRIMARY`)',
                meaning: 'Modo predeterminado donde las particiones de 30 minutos de PostgreSQL de las 22 salidas operativas y probatorias (incluido `vehicleOcr`) se exportan a archivos Apache Parquet comprimidos con ZSTD.',
            },
            {
                term: 'OCR de contenedores y matrículas (`ocrConfig`)',
                meaning: 'OCR asíncrono en segundo plano opcional por carril (desactivado de forma predeterminada). Cuando se activa, muestrea fotogramas según CPU y memoria, archiva `vehicleOcr` en `PARQUET_PRIMARY`, conserva recortes JPEG particionados por fecha junto con `frame-03.jpg` (`ocrCropRetentionDays = 365`, preservando eventos retenidos o adjudicados por el operador y eliminando al instante clips sin alarma cuando `Solo alarmas` está desactivado), completa automáticamente contenedores ISO 6346 válidos o matrículas de alta confianza en Vehículo si no se ha editado y ofrece sugerencias clicables.',
            },
            {
                term: 'Llaves de acceso (WebAuthn / FIDO2) y sesiones persistentes',
                meaning: 'Inicio de sesión con clave pública resistente al phishing mediante Face ID, Touch ID, Windows Hello o llaves físicas de seguridad (como YubiKey), verificado localmente por OSCAR sin depender de internet. Las sesiones persisten tras reinicios del navegador, del servidor y `oscar upgrade` hasta cerrar sesión o revocación administrativa; los recintos sin teléfonos pueden usar contraseñas locales PBKDF2 individuales.',
            },
            {
                term: 'Tokens de servicio de federación (`oscar_fed_...`)',
                meaning: 'Credenciales Bearer / MQTT con alcance limitado emitidas en Usuarios y acceso (`/users`) para federación multisitio de Vista Nacional y búsqueda multipasada de vehículos sin compartir contraseñas de administrador (rol `Visor` de solo lectura o `Operador`).',
            },
            {
                term: 'Extensiones de ejecución y paquetes regionales (`/extensions`)',
                meaning: 'Panel administrativo persistente ante actualizaciones para intercambiar en caliente modelos y reglas regionales OCR, mapas base regionales sin conexión `.pmtiles` (`/var/lib/oscar/extensions/maps-storage/`), bibliotecas de isótopos de espectroscopia secundaria, certificados CA X.509 empresariales, paquetes de códigos de adjudicación y complementos EML conservando los valores predeterminados integrados.',
            },
            {
                term: 'Copias de seguridad USB NVMe continuas y ocasionales (`/usb-backups`)',
                meaning: 'Copia incremental sin tiempo de inactividad (`0.0 s`) en un SSD externo USB 3.x NVMe (`NTFS` predeterminado, compatible con Windows, macOS y Linux), con sincronización continua o bajo demanda, expulsión segura en 1 clic (`SAFE_TO_UNPLUG`), copia diferencial en portátil y restauración completa (`oscar usb-backup restore`).',
            },
            {
                term: 'WCO UFF 2.0 / 3.0 y radiografías de carga HEMD (`/extensions` -> Carga NII)',
                meaning: 'Paquetes Unified File Format (`.uff`) de la Organización Mundial de Aduanas generados por escáneres de rayos X de carga no intrusivos (desactivado de forma predeterminada para no añadir controles innecesarios). Permite inspeccionar archivos `.uff` locales desde Subir archivos o conectar un recurso SMBv2/SMBv3 de solo lectura en `/extensions` para exploración por escáner/ventana temporal, búsqueda por UUID, correlación OCR difusa de 1 carácter, radiografía TIFF de 16 bits con bandas atómicas HEMD (`Z_eff`) alineada al perfil RPM y vinculación sin descarga completa.',
            },
            {
                term: 'Entorno práctico de formación y academia guiada (`oscar-sandbox`)',
                meaning: 'Entorno efímero aislado en `:8444` (`sudo bash oscar.sh sandbox start` / `.\\oscar.bat sandbox start`) con `archive.enabled = false`, cero impacto en PostgreSQL/Parquet/`config.json` reales, microemulador local Rapiscan + RTSP + OCR + UFF + `WebRelay-Quad` (`127.0.0.1:10180`), Guía de Práctica multimodal (vídeos en 4 idiomas, inyección guiada que abre `/event-log` para `Code 9999` / `Code 9998` / `Clean Pass` y `/health` para fallos), SensorHub Admin en pantalla dividida, verificación automática, certificado PDF de 1 página y purga completa en `< 2 s` al salir.',
            },
            {
                term: 'Luces y sonido del RPM (`webRelayConfig` — WebRelay-Quad)',
                meaning: 'Control opcional de relés en red por carril (`enabled = false` por defecto) para módulos ControlByWeb WebRelay-Quad (`X-WR-4R3-E` / `X-410`) mediante HTTP/XML (`stateFull.xml` / `state.xml`) en unidad primaria y unidad auxiliar opcional de contactos secos. Admite modo Automático (`AUTO`) (arma `R1=1, R2=1`, suprime `Code 9999` y opcionalmente `Code 9998`, pulsa `R3` luz roja gamma + sirena y/o `R4` luz azul de neutrones en alarmas reales y vuelve a `0,0,0,0` al detenerse), `PASS_THROUGH`, `MUTED` y controles manuales para administradores en `/health`, `/lane-view` y `/sensorhub/admin`.',
            },
            {
                term: 'Proxy de borde RPM para operación paralela con CAS (`oscar-rpm-proxy`)',
                meaning: 'Pila Docker aislada opcional (`sudo bash oscar.sh rpm-proxy` / `.\\oscar.bat rpm-proxy`) para operar OSCAR en paralelo con una estación central de alarmas (CAS) existente. Distribuye `1–50` flujos TCP Rapiscan RPM en tiempo real (`< 1 ms`) mediante puertos mapeados (`11601..11650`) o IP virtual transparente `:1600` en Ubuntu 24.04, reproduce tramas `SG1..SG3` / `SN1..SN2`, mantiene la CAS conectada durante reinicios/actualizaciones de OSCAR y propaga desconexiones reales del RPM en `<= 4,0 s`.',
            },
        ],
        linksIntro: 'Abra el manual completo de administración o consulte las videoguías prácticas:',
        adminLinkLabel: 'Abrir administración de SensorHub y manual integrado (`/sensorhub/admin`)',
        adminLinkDesc: 'Requiere cuenta de administrador. Seleccione el Servicio OSCAR o cualquier módulo y abra la pestaña README.',
        videoGuidesLinkLabel: 'Abrir videoguías prácticas de OSCAR (`ORNL/oscar-video-guides`)',
        videoGuidesLinkDesc: '29 vídeos cortos (< 2 min) con subtítulos sobre preparación de campo Ubuntu/Windows, entorno práctico de formación, luces y sonido RPM por carril (WebRelay-Quad), copias USB NVMe, extensiones, mapas .pmtiles sin conexión, radiografías WCO Cargo UFF de 16 bits, carriles, adjudicación, EML, OCR de vehículos, usuarios y Passkeys, federación, soporte e informes.',
        supportBundleTitle: 'Diagnóstico y paquete de soporte (`.zip`)',
        supportBundleDesc: 'Descarga un archivo `.zip` de diagnóstico que combina eventos recientes del navegador con registros del servidor OSCAR, estado de módulos y salud de JVM/almacenamiento. Si el servidor no responde o no arranca, ejecute `./oscar.sh support-bundle` (Linux) u `oscar.bat support-bundle` (Windows) en el servidor.',
        supportBundlePrivacyNote: 'Privacidad y seguridad: se recopila únicamente para diagnosticar incidencias técnicas; contraseñas, tokens, cookies de sesión, credenciales RTSP y claves privadas se redactan automáticamente.',
        supportBundleButtonLabel: 'Exportar paquete de soporte',
        supportBundleCombinedSuccess: (fileName: string) => `Se descargó ${fileName} (diagnóstico de cliente y servidor con secretos redactados).`,
        supportBundleClientFallback: (fileName: string) => `Servidor no disponible; se descargó el diagnóstico del navegador (${fileName}). Ejecute ./oscar.sh support-bundle u oscar.bat support-bundle en el servidor.`,
        supportBundleUnexpectedError: 'No se pudo exportar el paquete de soporte del navegador. Ejecute ./oscar.sh support-bundle u oscar.bat support-bundle en el servidor.',
        closeLabel: 'Cerrar',
    },
    fr: {
        dialogTitle: 'Guide rapide opérateur et glossaire OSCAR 3.11.15',
        dialogSubtitle: 'Référence en langage clair pour les flux de console, les rapports multiformats et la terminologie des portiques.',
        tabs: {
            pages: 'Pages de la console',
            reports: 'Rapports et exports',
            glossary: 'Termes expliqués',
            links: 'Manuel et guides vidéo',
        },
        pagesIntro: 'Utilisez le tiroir de navigation gauche pour basculer entre les vues OSCAR :',
        pages: [
            {
                title: 'Tableau de bord (`/`)',
                summary: 'Grille d’état des voies en temps réel, carte du site, flux d’alarmes en direct, personnalisation des cartes et tiroir d’adjudication rapide. Les alarmes non lues s’affichent en gras avec un point indicateur (état partagé par voie entre les postes) ; utilisez le filtre temporaire Non lues uniquement ou les fenêtres temporelles rapides (`15m`, `1h`, `24h`, `15j`), cliquez sur une ligne, Acquitter la sélection ou Tout acquitter pour marquer comme lu, et activez en option le bandeau (avec décompte complet et plafond `100+`) ou l’audio continu dans Paramètres.',
            },
            {
                title: 'Événements (`/event-log`)',
                summary: 'Journal historique consultable des occupations, alarmes et défauts avec recherche normalisée par ID de véhicule / conteneur ISO 6346 (ou collage d’UUID / fichier `.uff` lorsque Fret NII est activé), comparaison multipassage, filtres par Code d’adjudication (`Code 9998`, `Code 9999`, `1–11` et personnalisés) et adjudication groupée.',
            },
            {
                title: 'État de santé (`/health`)',
                summary: 'État de connexion en direct (En ligne, Hors ligne, En attente) des RPM et caméras, et indicateurs de défauts, sabotage et occupation prolongée (`Fault - Extended Occupancy` + `Code 9998`).',
            },
            {
                title: 'Carte (`/map`)',
                summary: 'Plan du site géoréférencé ou carte plein écran avec marqueurs de voies en direct.',
            },
            {
                title: 'National (`/national-view`)',
                summary: 'Synthèse multi-nœuds comparant occupations, alarmes gamma/neutrons et défauts.',
            },
            {
                title: 'Générateur de rapports (`/report`)',
                summary: 'Génération de rapports à la demande (Nœud entier, Vue opérationnelle ou Voies spécifiques) en PDF, CSV, JSON et Excel (.xlsx).',
            },
            {
                title: 'Transfert d’alarme (`/alarm-transfer`)',
                summary: 'Exportation et importation hors ligne par code QR et fichier `.oscar-alarm.json`.',
            },
            {
                title: 'Utilisateurs et accès (`/users`)',
                summary: 'Gestion du compte personnel pour enregistrer des clés d’accès FIDO2 / WebAuthn hors ligne (Face ID, Touch ID, Windows Hello, YubiKey) et modifier le mot de passe local (indépendant du tunnel Octelium Zero-Trust), ainsi que les contrôles administrateur pour Utilisateurs et rôles (`Administrateur`, `Opérateur`, `Lecteur`), l’inscription groupée CSV avec codes QR (`/login/enroll?token=oscar_inv_...`), le périmètre par Vue opérationnelle, les jetons de fédération (`oscar_fed_...`) avec lien direct vers `/servers?auth=bearer`, la politique SSO OIDC / tunnel (`ORNL/oscar-federation-hub`, `X-Octelium-Groups`, CA PEM privée et raccourci vers la console externe) et le guide de sauvegarde.',
            },
            {
                title: 'Serveurs (`/servers`)',
                summary: 'Connexion des sites OSCAR distants fédérés pour la Vue Nationale (`/national-view`) et la Recherche multipassage (`/event-log`) : cliquez sur « Utiliser un jeton de fédération (oscar_fed_...) », cochez HTTPS (port 443) et collez le jeton créé sur le site distant dans Utilisateurs et accès -> Jetons de fédération.',
            },
            {
                title: 'Sauvegardes USB (`/usb-backups`)',
                summary: 'Gestion administrateur des sauvegardes incrémentielles sans interruption (`0,0 s`) sur SSD externe USB 3.x NVMe (`NTFS` par défaut), avec synchronisation continue ou occasionnelle, éjection sécurisée en 1 clic (`PRÊT À DÉBRANCHER`), vérification SHA-256 et téléchargement de `oscar-backup-key.txt`.',
            },
            {
                title: 'Extensions d’exécution (`/extensions`)',
                summary: 'Espace administrateur persistant lors des mises à niveau pour remplacer à chaud les modèles et règles OCR régionaux, les fonds de carte `.pmtiles` v3 hors ligne, les bibliothèques spectroscopiques, les certificats CA X.509, les packs de codes d’adjudication, les modules EML et les partages SMBv2/SMBv3 optionnels en lecture seule pour le Fret NII (OMD UFF 2.0 / 3.0) tout en conservant les solutions par défaut intégrées.',
            },
        ],
        reportsIntro: 'Chaque demande génère un nouveau fichier et remplace tout rapport antérieur portant les mêmes paramètres :',
        reports: [
            {
                title: 'Rapport de site RDS (`RDS_SITE`)',
                summary: 'Synthèse exécutive du site, taux d’alarme et de suppression EML (`Code 9999` vs `Examen opérateur`), défauts, stockage et tableau par voie.',
            },
            {
                title: 'Rapport de voie (`LANE`)',
                summary: 'Indicateurs opérationnels par voie, taux d’alarmes et EML, défauts et activité quotidienne.',
            },
            {
                title: 'Rapport d’événements (`EVENT`)',
                summary: 'Graphiques et tableaux quotidiens pour Alarmes et occupations, Alarmes seules ou État de santé.',
            },
            {
                title: 'Rapport d’adjudication (`ADJUDICATION`)',
                summary: 'Commence par les tableaux cumulés Toutes les voies sélectionnées (`ALL_LANES`) (Disposition et Isotopes), suivis du détail par voie.',
            },
            {
                title: 'Extraction détaillée des adjudications (`ADJUDICATION_DETAILS`)',
                summary: 'Tableau d’audit ligne par ligne de chaque décision soumise (heure, voie, utilisateur, compteur, code, notes, inspection secondaire, isotopes, véhicule, fichiers et ID d’occupation).',
            },
            {
                title: 'Rapport d’incident de véhicule (`VEHICLE_INCIDENT`)',
                summary: 'Dossier consolidé multipassage corrélant les contrôles de confirmation et les passages secondaires spectroscopiques (RS350 / WebID) pour un ID de véhicule ou conteneur ISO 6346 sur les nœuds locaux et fédérés, avec classifications d’Apprentissage Automatique Amélioré (EML), traces radiologiques, preuves OCR et historique d’adjudication.',
            },
        ],
        formatsTitle: 'Formats d’exportation pris en charge',
        formats: [
            {
                title: 'PDF (`.pdf`)',
                summary: 'Document exécutif mis en forme avec cartes KPI, graphiques et tableaux affiché directement dans le navigateur.',
            },
            {
                title: 'CSV (`.csv`)',
                summary: 'Texte séparé par des virgules avec en-têtes de métadonnées et aperçu tabulaire intégré.',
            },
            {
                title: 'JSON (`.json`)',
                summary: 'Charge utile structurée lisible par machine contenant métadonnées, sections, en-têtes et lignes.',
            },
            {
                title: 'Excel (`.xlsx`)',
                summary: 'Classeur OpenXML multi-feuilles avec feuille de métadonnées et feuilles dédiées par section.',
            },
        ],
        glossaryIntro: 'Définitions en langage clair des termes techniques utilisés dans OSCAR :',
        glossaryTermHeader: 'Terme / Acronyme',
        glossaryMeaningHeader: 'Signification en langage clair',
        glossary: [
            {
                term: 'Occupation (Occupancy)',
                meaning: 'Passage complet d’un véhicule, conteneur ou piéton dans une voie entre l’entrée (`GS`) et la sortie (`GX`).',
            },
            {
                term: 'CPS (Coups par seconde)',
                meaning: 'Taux de comptage brut du détecteur mesuré à chaque intervalle d’échantillonnage.',
            },
            {
                term: 'NSIGMA (N-Sigma)',
                meaning: 'Nombre d’écarts-types (σ) dont le taux gamma dépasse la moyenne récente du bruit de fond.',
            },
            {
                term: 'NORM',
                meaning: 'Matière radioactive d’origine naturelle : fret bénin contenant des isotopes naturels (engrais, litière, céramique, granit).',
            },
            {
                term: 'EML et Code 9999',
                meaning: 'Apprentissage automatique amélioré (Enhanced Machine Learning) — algorithme Rapiscan comparant les fenêtres d’énergie gamma pour distinguer le fret NORM bénin des menaces. Les alarmes non menaçantes sont auto-adjugées en `Code 9999 : EML sans menace`.',
            },
            {
                term: 'Occupation prolongée (`Fault - Extended Occupancy`) et Code 9998',
                meaning: 'Lorsqu’un véhicule occupe une voie au moins pendant son seuil configuré (`extendedOccupancyThresholdMinutes`, défaut 1 min), OSCAR publie `Fault - Extended Occupancy`. Si elle se termine par une alarme gamma seule (sans alarme neutron), elle est masquée du tableau de bord et auto-adjugée en `Code 9998 : Alarme gamma d’occupation prolongée`.',
            },
            {
                term: 'WebID et DRF',
                meaning: 'Service Sandia Full Spectrum d’identification isotopique. La DRF précise le modèle et la géométrie du détecteur.',
            },
            {
                term: 'Codes de fichier quotidien (`GB`, `GS`, `GA`, `NS`, `GX`, `SG1`–`SG3`, `SN1`–`SN2`)',
                meaning: '`GB`/`NB` = fond gamma/neutrons, `GS` = début d’occupation, `GC`/`NC` = comptages, `GA`/`NA`/`NS` = alarme, `GX` = fin d’occupation, `TT`/`TC` = sabotage, `SG1`–`SG3`/`SN1`–`SN2` = paramètres quotidiens synchronisés dans `config.json`.',
            },
            {
                term: 'UUID d’événement',
                meaning: 'Identifiant unique global attribué à chaque occupation pour la recherche exacte et le transfert QR.',
            },
            {
                term: 'Vue opérationnelle (`?view=<clé>`)',
                meaning: 'Filtre nommé sélectionnable depuis le menu déroulant Vue opérationnelle de la barre supérieure (ou via `?view=<clé>`) limitant la console aux voies affectées dans le respect des permissions `allowedViews` du compte.',
            },
            {
                term: 'Médias conservés à 5 images',
                meaning: 'Cinq instantanés JPEG (`frame-01.jpg`–`frame-05.jpg`) extraits par alarme. Après 30 jours, l’image centrale (`frame-03.jpg`) est conservée.',
            },
            {
                term: 'Niveau froid Parquet (`PARQUET_PRIMARY`)',
                meaning: 'Mode par défaut où les partitions PostgreSQL de 30 minutes des 22 flux opérationnels et probants (dont `vehicleOcr`) sont exportées en fichiers Apache Parquet compressés ZSTD.',
            },
            {
                term: 'OCR conteneurs et plaques (`ocrConfig`)',
                meaning: 'OCR asynchrone en arrière-plan optionnel par voie (désactivé par défaut). Lorsqu’il est activé, OSCAR analyse les images selon la disponibilité CPU/mémoire, archive `vehicleOcr` dans `PARQUET_PRIMARY`, conserve les vignettes JPEG partitionnées par date avec `frame-03.jpg` (`ocrCropRetentionDays = 365`, en préservant les événements sous rétention ou adjugés par un opérateur et en supprimant immédiatement les clips hors alarme lorsque `Alarmes uniquement` est désactivé), préremplit les conteneurs ISO 6346 valides ou plaques à haute confiance et affiche des suggestions cliquables.',
            },
            {
                term: 'Clés d’accès (WebAuthn / FIDO2) et sessions persistantes',
                meaning: 'Connexion par clé publique résistante à l’hameçonnage via Face ID, Touch ID, Windows Hello ou clés physiques de sécurité (comme YubiKey), vérifiée localement par OSCAR sans internet. Les sessions persistent après redémarrage du navigateur, du serveur et `oscar upgrade` jusqu’à déconnexion explicite ou révocation ; les sites sans téléphones peuvent utiliser des mots de passe locaux PBKDF2 individuels.',
            },
            {
                term: 'Jetons de service de fédération (`oscar_fed_...`)',
                meaning: 'Identifiants Bearer / MQTT à périmètre restreint créés dans Utilisateurs et accès (`/users`) pour la fédération multi-sites de la Vue Nationale et de la recherche multipassage de véhicules sans partager de mots de passe administrateur (rôle `Lecteur` ou `Opérateur`).',
            },
            {
                term: 'Extensions d’exécution et packs régionaux (`/extensions`)',
                meaning: 'Espace administrateur persistant lors des mises à niveau permettant de remplacer à chaud les modèles et règles OCR régionaux, les fonds de carte `.pmtiles` hors ligne (`/var/lib/oscar/extensions/maps-storage/`), les bibliothèques spectroscopiques, les certificats CA X.509 d’entreprise, les packs de codes d’adjudication et les modules EML tout en préservant les solutions par défaut intégrées.',
            },
            {
                term: 'Sauvegardes USB NVMe continues et occasionnelles (`/usb-backups`)',
                meaning: 'Sauvegarde incrémentielle sans coupure (`0,0 s`) sur SSD externe USB 3.x NVMe (`NTFS` par défaut, lisible sous Windows, macOS et Linux), avec synchronisation continue ou à la demande, éjection sécurisée en 1 clic (`SAFE_TO_UNPLUG`), copie delta sur portable et restauration complète (`oscar usb-backup restore`).',
            },
            {
                term: 'OMD UFF 2.0 / 3.0 et radiographies fret HEMD (`/extensions` -> Fret NII)',
                meaning: 'Archives Unified File Format (`.uff`) de l’Organisation mondiale des douanes produites par les scanners à rayons X de fret (désactivé par défaut pour ne pas surcharger l’écran). Permet d’inspecter un fichier `.uff` local via Téléverser des fichiers ou de connecter un partage SMBv2/SMBv3 en lecture seule dans `/extensions` pour parcourir par scanner/plage horaire, rechercher par UUID, corréler par OCR tolérant à 1 caractère, inspecter les radiographies TIFF 16 bits et bandes atomiques HEMD (`Z_eff`) alignées au profil RPM et lier sans téléchargement complet.',
            },
            {
                term: 'Bac à sable de formation pratique et académie guidée (`oscar-sandbox`)',
                meaning: 'Environnement éphémère isolé sur `:8444` (`sudo bash oscar.sh sandbox start` / `.\\oscar.bat sandbox start`) avec `archive.enabled = false`, zéro écriture dans PostgreSQL/Parquet/`config.json` réels, micro-émulateur local Rapiscan + RTSP + OCR + UFF + `WebRelay-Quad` (`127.0.0.1:10180`), Coach Formation multimodal (vidéos en 4 langues, injection guidée ouvrant `/event-log` pour `Code 9999` / `Code 9998` / `Clean Pass` et `/health` pour les défauts), SensorHub Admin en vue partagée, auto-vérification, certificat PDF d’une page et purge complète en `< 2 s` à la fermeture.',
            },
            {
                term: 'Feux et sirène du RPM (`webRelayConfig` — WebRelay-Quad)',
                meaning: 'Commande réseau facultative par voie (`enabled = false` par défaut) pour modules ControlByWeb WebRelay-Quad (`X-WR-4R3-E` / `X-410`) via HTTP/XML (`stateFull.xml` / `state.xml`) sur unité primaire et unité auxiliaire facultative à contacts secs. Prend en charge le mode Automatique (`AUTO`) (armement `R1=1, R2=1`, masquage `Code 9999` et en option `Code 9998`, impulsion `R3` feu rouge gamma + sirène et/ou `R4` feu bleu neutron sur alarme réelle, retour de sécurité `0,0,0,0` à l’arrêt), `PASS_THROUGH`, `MUTED` et les commandes manuelles administrateur dans `/health`, `/lane-view` et `/sensorhub/admin`.',
            },
            {
                term: 'Proxy de périphérie RPM en parallèle avec une CAS (`oscar-rpm-proxy`)',
                meaning: 'Pile Docker isolée facultative (`sudo bash oscar.sh rpm-proxy` / `.\\oscar.bat rpm-proxy`) pour exploiter OSCAR en parallèle d’une station centrale d’alarmes (CAS) existante. Diffuse `1–50` flux TCP Rapiscan RPM en temps réel (`< 1 ms`) en mode ports mappés (`11601..11650`) ou IP virtuelle transparente `:1600` sous Ubuntu 24.04, rejoue les trames `SG1..SG3` / `SN1..SN2`, maintient la CAS connectée lors des redémarrages/mises à niveau d’OSCAR et propage les déconnexions physiques du RPM en `<= 4,0 s`.',
            },
        ],
        linksIntro: 'Ouvrez le manuel complet d’administration ou consultez les guides vidéo pratiques :',
        adminLinkLabel: 'Ouvrir l’administration SensorHub et le manuel intégré (`/sensorhub/admin`)',
        adminLinkDesc: 'Connexion administrateur requise. Sélectionnez le Service OSCAR ou un module et ouvrez l’onglet README.',
        videoGuidesLinkLabel: 'Ouvrir les guides vidéo pratiques OSCAR (`ORNL/oscar-video-guides`)',
        videoGuidesLinkDesc: '29 courtes vidéos (< 2 min) sous-titrées couvrant préparation terrain Ubuntu/Windows, bac à sable de formation, feux et sirène RPM par voie (WebRelay-Quad), sauvegardes USB NVMe, extensions, cartes .pmtiles hors ligne, radiographies OMD UFF 16 bits, voies, adjudication, EML, OCR véhicules, utilisateurs et Passkeys, fédération, assistance et rapports.',
        supportBundleTitle: 'Dépannage et archive d’assistance (`.zip`)',
        supportBundleDesc: 'Télécharge une archive `.zip` réunissant les diagnostics récents du navigateur et les journaux du serveur OSCAR, l’état des modules et la santé JVM/stockage. Si le serveur est injoignable ou ne démarre pas, exécutez `./oscar.sh support-bundle` (Linux) ou `oscar.bat support-bundle` (Windows) sur l’hôte.',
        supportBundlePrivacyNote: 'Confidentialité et sécurité : collecté uniquement pour le diagnostic technique ; mots de passe, jetons, cookies de session, identifiants RTSP et clés privées sont automatiquement masqués.',
        supportBundleButtonLabel: 'Exporter l’archive d’assistance',
        supportBundleCombinedSuccess: (fileName: string) => `${fileName} téléchargé (diagnostics client + serveur, secrets masqués).`,
        supportBundleClientFallback: (fileName: string) => `Serveur injoignable ; diagnostics navigateur téléchargés (${fileName}). Exécutez ./oscar.sh support-bundle ou oscar.bat support-bundle sur le serveur.`,
        supportBundleUnexpectedError: 'Impossible d’exporter l’archive d’assistance du navigateur. Exécutez ./oscar.sh support-bundle ou oscar.bat support-bundle sur le serveur.',
        closeLabel: 'Fermer',
    },
    el: {
        dialogTitle: 'Γρήγορος οδηγός χειριστή & γλωσσάριο OSCAR 3.11.15',
        dialogSubtitle: 'Αναφορά σε απλή γλώσσα για τις ροές εργασίας κονσόλας, τις αναφορές πολλαπλών μορφών και την ορολογία πυλών ακτινοβολίας.',
        tabs: {
            pages: 'Σελίδες κονσόλας',
            reports: 'Αναφορές & εξαγωγές',
            glossary: 'Επεξήγηση όρων',
            links: 'Εγχειρίδιο & βίντεο',
        },
        pagesIntro: 'Χρησιμοποιήστε το αριστερό μενού πλοήγησης για εναλλαγή μεταξύ των προβολών του OSCAR:',
        pages: [
            {
                title: 'Πίνακας ελέγχου (`/`)',
                summary: 'Πλέγμα κατάστασης λωρίδων σε πραγματικό χρόνο, χάρτης εγκατάστασης, ροή συναγερμών, προσαρμογή καρτών και γρήγορη αξιολόγηση. Οι μη αναγνωσμένοι συναγερμοί εμφανίζονται με έντονη γραφή και κουκκίδα ένδειξης (κοινόχρηστοι ανά λωρίδα μεταξύ σταθμών)· χρησιμοποιήστε το προσωρινό φίλτρο Μόνο μη αναγνωσμένοι ή τα γρήγορα χρονικά παράθυρα (`15λ`, `1ώ`, `24ώ`, `15η`), επιλέξτε γραμμή, Επιβεβαίωση επιλεγμένων ή Επιβεβαίωση όλων για επισήμανση ως αναγνωσμένων, και ενεργοποιήστε προαιρετικά την ειδοποίηση (με πλήρη καταμέτρηση και όριο `100+`) ή τον συνεχή ήχο στις Ρυθμίσεις.',
            },
            {
                title: 'Συμβάντα (`/event-log`)',
                summary: 'Ιστορικό διελεύσεων, συναγερμών και βλαβών με κανονικοποιημένη αναζήτηση ID οχήματος / εμπορευματοκιβωτίου ISO 6346 (ή επικόλληση UUID / αρχείου `.uff` όταν το Φορτίο NII είναι ενεργό), σύγκριση πολλαπλών διελεύσεων, φίλτρα Κωδικού αξιολόγησης (`Κωδικός 9998`, `Κωδικός 9999`, `1–11` και προσαρμοσμένοι) και μαζική αξιολόγηση.',
            },
            {
                title: 'Κατάσταση υγείας (`/health`)',
                summary: 'Ζωντανή κατάσταση σύνδεσης (Σε σύνδεση, Εκτός σύνδεσης, Αναμονή) για κάθε RPM και κάμερα, καθώς και ενδείξεις βλαβών, παραβίασης και παρατεταμένης διέλευσης (`Fault - Extended Occupancy` + `Κωδικός 9998`).',
            },
            {
                title: 'Χάρτης (`/map`)',
                summary: 'Γεωαναφερθέν διάγραμμα εγκατάστασης ή χάρτης πλήρους οθόνης με ζωντανούς δείκτες λωρίδων.',
            },
            {
                title: 'Εθνική προβολή (`/national-view`)',
                summary: 'Συγκεντρωτικός πίνακας πολλαπλών κόμβων για διελεύσεις, συναγερμούς γάμμα/νετρονίων και βλάβες.',
            },
            {
                title: 'Δημιουργία αναφορών (`/report`)',
                summary: 'Δημιουργία αναφορών ανά Ολόκληρο κόμβο, Λειτουργική προβολή ή Συγκεκριμένες λωρίδες σε μορφές PDF, CSV, JSON και Excel (.xlsx).',
            },
            {
                title: 'Μεταφορά συναγερμού (`/alarm-transfer`)',
                summary: 'Εξαγωγή και εισαγωγή κωδικών QR και αρχείων `.oscar-alarm.json` για απομονωμένα περιβάλλοντα χωρίς δίκτυο.',
            },
            {
                title: 'Χρήστες & πρόσβαση (`/users`)',
                summary: 'Αυτοδιαχείριση λογαριασμού για εγγραφή κλειδιών πρόσβασης FIDO2 / WebAuthn εκτός δικτύου (Face ID, Touch ID, Windows Hello, YubiKey) και αλλαγή τοπικού κωδικού (ανεξάρτητου από τη σήραγγα Octelium Zero-Trust), καθώς και έλεγχοι διαχειριστή για Χρήστες & ρόλους (`Διαχειριστής`, `Χειριστής`, `Θεατής`), μαζική εγγραφή CSV με κωδικούς QR (`/login/enroll?token=oscar_inv_...`), ανάθεση Λειτουργικών προβολών, διακριτικά ομοσπονδίας (`oscar_fed_...`) με άνοιγμα 1 κλικ στο `/servers?auth=bearer`, πολιτική SSO OIDC / σήραγγας (`ORNL/oscar-federation-hub`, `X-Octelium-Groups`, ιδιωτική CA PEM και εξωτερική κονσόλα χρηστών) και οδηγό αντιγράφων ασφαλείας.',
            },
            {
                title: 'Διακομιστές (`/servers`)',
                summary: 'Σύνδεση απομακρυσμένων ομόσπονδων κόμβων OSCAR για Εθνική Προβολή (`/national-view`) και Αναζήτηση πολλαπλών διελεύσεων (`/event-log`): πατήστε «Χρήση διακριτικού ομοσπονδίας (oscar_fed_...)», ενεργοποιήστε HTTPS (θύρα 443) και επικολλήστε το διακριτικό που εκδόθηκε στον απομακρυσμένο κόμβο στη σελίδα Χρήστες & πρόσβαση -> Διακριτικά ομοσπονδίας.',
            },
            {
                title: 'Αντίγραφα USB (`/usb-backups`)',
                summary: 'Διαχείριση αυξητικών αντιγράφων ασφαλείας μηδενικής διακοπής (`0,0 s`) σε εξωτερικό SSD USB 3.x NVMe (`NTFS` προεπιλογή), με Συνεχή ή Περιστασιακό Συγχρονισμό, Ασφαλή Εξαγωγή 1 κλικ (`ΑΣΦΑΛΗΣ ΑΠΟΣΥΝΔΕΣΗ`), επαλήθευση SHA-256 και λήψη του `oscar-backup-key.txt`.',
            },
            {
                title: 'Επεκτάσεις εκτέλεσης (`/extensions`)',
                summary: 'Μόνιμο κέντρο διαχειριστή (προστατευμένο σε αναβαθμίσεις) για άμεση αντικατάσταση μοντέλων/κανόνων OCR, τοπικών χαρτών `.pmtiles` v3 εκτός δικτύου, βιβλιοθηκών φασματοσκοπίας ισοτόπων, πιστοποιητικών CA X.509, πακέτων κωδίκων κρίσης, προσθέτων EML και προαιρετικών κοινόχρηστων πόρων SMBv2/SMBv3 μόνο ανάγνωσης για Φορτίο NII (WCO UFF 2.0 / 3.0) διατηρώντας τις ενσωματωμένες προεπιλογές.',
            },
        ],
        reportsIntro: 'Κάθε αίτημα δημιουργεί νέο αρχείο και αντικαθιστά τυχόν προηγούμενο αρχείο με τις ίδιες παραμέτρους:',
        reports: [
            {
                title: 'Αναφορά εγκατάστασης RDS (`RDS_SITE`)',
                summary: 'Συνοπτικοί δείκτες εγκατάστασης, ποσοστά συναγερμών και καταστολής EML (`Κωδικός 9999` έναντι `Έλεγχος χειριστή`), βλάβες, χωρητικότητα δίσκου και πίνακας ανά λωρίδα.',
            },
            {
                title: 'Αναφορά λωρίδας (`LANE`)',
                summary: 'Λειτουργικοί δείκτες ανά λωρίδα, ποσοστά συναγερμών/EML, βλάβες και ημερήσια δραστηριότητα.',
            },
            {
                title: 'Αναφορά συμβάντων (`EVENT`)',
                summary: 'Ημερήσια γραφήματα και πίνακες για Συναγερμούς & διελεύσεις, Μόνο συναγερμούς ή Κατάσταση υγείας.',
            },
            {
                title: 'Αναφορά αξιολόγησης (`ADJUDICATION`)',
                summary: 'Ξεκινά με τους αθροιστικούς πίνακες Όλες οι επιλεγμένες λωρίδες (`ALL_LANES`) (Διάθεση και Αποτελέσματα ισοτόπων), ακολουθούμενους από την ανάλυση κάθε επιμέρους λωρίδας.',
            },
            {
                title: 'Αναλυτική εξαγωγή αξιολογήσεων (`ADJUDICATION_DETAILS`)',
                summary: 'Πίνακας ελέγχου γραμμή προς γραμμή για κάθε υποβληθείσα αξιολόγηση (ώρα, λωρίδα, χρήστης, αριθμός διέλευσης, κωδικός, σχόλια, δευτερεύων έλεγχος, ισότοπα, όχημα, αρχεία και ID διέλευσης).',
            },
            {
                title: 'Αναφορά συμβάντος οχήματος (`VEHICLE_INCIDENT`)',
                summary: 'Ενοποιημένο πακέτο πολλαπλών διελεύσεων που συσχετίζει επαναληπτικούς ελέγχους επιβεβαίωσης και φασματοσκοπικές δευτερεύουσες διελεύσεις (RS350 / WebID) για αναγνωριστικό οχήματος ή εμπορευματοκιβωτίου ISO 6346 σε τοπικούς και ομόσπονδους κόμβους, με ταξινομήσεις Ενισχυμένης Μηχανικής Μάθησης (EML), καμπύλες ακτινοβολίας, τεκμήρια OCR και ιστορικό αξιολόγησης.',
            },
        ],
        formatsTitle: 'Υποστηριζόμενες μορφές εξαγωγής',
        formats: [
            {
                title: 'PDF (`.pdf`)',
                summary: 'Μορφοποιημένο έγγραφο με κάρτες δεικτών, γραφήματα και πίνακες που προβάλλεται απευθείας στον περιηγητή.',
            },
            {
                title: 'CSV (`.csv`)',
                summary: 'Κείμενο διαχωρισμένο με κόμματα με κεφαλίδες μεταδεδομένων και ενσωματωμένη προεπισκόπηση πίνακα.',
            },
            {
                title: 'JSON (`.json`)',
                summary: 'Δομημένο αρχείο αναγνώσιμο από μηχανή με μεταδεδομένα, ενότητες, κεφαλίδες και γραμμές.',
            },
            {
                title: 'Excel (`.xlsx`)',
                summary: 'Βιβλίο εργασίας OpenXML πολλαπλών φύλλων για μεταδεδομένα και κάθε ενότητα αναφοράς.',
            },
        ],
        glossaryIntro: 'Ορισμοί σε απλή γλώσσα των τεχνικών όρων που χρησιμοποιούνται στο OSCAR:',
        glossaryTermHeader: 'Όρος / Ακρωνύμιο',
        glossaryMeaningHeader: 'Σημασία σε απλή γλώσσα',
        glossary: [
            {
                term: 'Διέλευση (Occupancy)',
                meaning: 'Μία πλήρης διέλευση οχήματος, εμπορευματοκιβωτίου ή πεζού από λωρίδα ανίχνευσης μεταξύ εισόδου (`GS`) και εξόδου (`GX`).',
            },
            {
                term: 'CPS (Μετρήσεις ανά δευτερόλεπτο)',
                meaning: 'Ακατέργαστος ρυθμός καταμέτρησης του ανιχνευτή ακτινοβολίας σε κάθε διάστημα δειγματοληψίας.',
            },
            {
                term: 'NSIGMA (N-Sigma)',
                meaning: 'Αριθμός τυπικών αποκλίσεων (σ) κατά τον οποίο ο ρυθμός γάμμα υπερβαίνει τον πρόσφατο μέσο όρο υποβάθρου.',
            },
            {
                term: 'NORM',
                meaning: 'Φυσικώς απαντώμενο ραδιενεργό υλικό — ακίνδυνο φορτίο με φυσικά ισότοπα (λιπάσματα, άμμος υγιεινής, κεραμικά, γρανίτης).',
            },
            {
                term: 'EML & Κωδικός 9999',
                meaning: 'Ενισχυμένη μηχανική μάθηση (Enhanced Machine Learning) — αλγόριθμος Rapiscan που συγκρίνει ενεργειακά παράθυρα γάμμα για διάκριση ακίνδυνου φορτίου NORM από απειλές. Οι μη απειλητικοί συναγερμοί αξιολογούνται αυτόματα ως `Κωδ. 9999: EML μη απειλή`.',
            },
            {
                term: 'Παρατεταμένη διέλευση (`Fault - Extended Occupancy`) & Κωδικός 9998',
                meaning: 'Όταν ένα όχημα παραμένει σε λωρίδα τουλάχιστον για το ρυθμισμένο όριο (`extendedOccupancyThresholdMinutes`, προεπιλογή 1 λεπτό), το OSCAR δημοσιεύει `Fault - Extended Occupancy`. Αν ολοκληρωθεί με συναγερμό μόνο γάμμα (χωρίς συναγερμό νετρονίων), αποκρύπτεται από τον πίνακα και αξιολογείται αυτόματα ως `Κωδικός 9998: Συναγερμός γάμμα παρατεταμένης διέλευσης`.',
            },
            {
                term: 'WebID & DRF',
                meaning: 'Υπηρεσία Sandia Full Spectrum για ταυτοποίηση ισοτόπων από φάσματα. Το DRF καθορίζει το μοντέλο και τη γεωμετρία του ανιχνευτή.',
            },
            {
                term: 'Κωδικοί ημερήσιου αρχείου (`GB`, `GS`, `GA`, `NS`, `GX`, `SG1`–`SG3`, `SN1`–`SN2`)',
                meaning: '`GB`/`NB` = υπόβαθρο γάμμα/νετρονίων, `GS` = έναρξη διέλευσης, `GC`/`NC` = μετρήσεις, `GA`/`NA`/`NS` = συναγερμός, `GX` = λήξη διέλευσης, `TT`/`TC` = παραβίαση, `SG1`–`SG3`/`SN1`–`SN2` = ημερήσιες παράμετροι που συγχρονίζονται στο `config.json`.',
            },
            {
                term: 'UUID συμβάντος',
                meaning: 'Παγκοσμίως μοναδικό αναγνωριστικό για κάθε διέλευση για ακριβή αναζήτηση και μεταφορά QR.',
            },
            {
                term: 'Λειτουργική προβολή (`?view=<κλειδί>`)',
                meaning: 'Επώνυμο φίλτρο επιλέξιμο από το αναπτυσσόμενο μενού Λειτουργική προβολή της επάνω γραμμής (ή μέσω URL `?view=<κλειδί>`) που περιορίζει την κονσόλα στις ανατεθειμένες λωρίδες βάσει των δικαιωμάτων `allowedViews`.',
            },
            {
                term: 'Διατηρούμενα πολυμέσα 5 καρέ',
                meaning: 'Πέντε στιγμιότυπα JPEG (`frame-01.jpg`–`frame-05.jpg`) ανά συναγερμό. Μετά από 30 ημέρες διατηρείται το κεντρικό καρέ (`frame-03.jpg`).',
            },
            {
                term: 'Ψυχρό επίπεδο Parquet (`PARQUET_PRIMARY`)',
                meaning: 'Προεπιλεγμένη λειτουργία όπου τα τμήματα 30 λεπτών της PostgreSQL για όλες τις 22 λειτουργικές και αποδεικτικές ροές (συμπεριλαμβανομένου του `vehicleOcr`) εξάγονται σε αρχεία Apache Parquet συμπιεσμένα με ZSTD.',
            },
            {
                term: 'OCR εμπορευματοκιβωτίων & πινακίδων (`ocrConfig`)',
                meaning: 'Προαιρετικό ασύγχρονο OCR παρασκηνίου ανά λωρίδα (απενεργοποιημένο από προεπιλογή). Όταν ενεργοποιηθεί, αναλύει καρέ ανάλογα με CPU/μνήμη, αρχειοθετεί το `vehicleOcr` στο `PARQUET_PRIMARY`, διατηρεί μικρογραφίες JPEG ανά ημερομηνία μαζί με το `frame-03.jpg` (`ocrCropRetentionDays = 365`, προστατεύοντας συμβάντα σε δέσμευση ή αξιολογημένα από χειριστή και διαγράφοντας αμέσως προσωρινά κλιπ εκτός συναγερμού όταν το `Μόνο συναγερμοί` είναι ανενεργό), συμπληρώνει αυτόματα έγκυρους κωδικούς ISO 6346 ή πινακίδες υψηλής εμπιστοσύνης και εμφανίζει επιλέξιμες προτάσεις.',
            },
            {
                term: 'Κλειδιά πρόσβασης (WebAuthn / FIDO2) & μόνιμες συνεδρίες',
                meaning: 'Σύνδεση δημόσιου κλειδιού ανθεκτική στο phishing μέσω Face ID, Touch ID, Windows Hello ή φυσικών κλειδιών ασφαλείας (όπως YubiKey), που επαληθεύεται τοπικά από το OSCAR χωρίς διαδίκτυο. Οι συνεδρίες διατηρούνται μετά από επανεκκίνηση περιηγητή, διακομιστή και `oscar upgrade` έως την αποσύνδεση ή ανάκληση· εγκαταστάσεις χωρίς τηλέφωνα χρησιμοποιούν ατομικούς τοπικούς κωδικούς PBKDF2.',
            },
            {
                term: 'Διακριτικά υπηρεσίας ομοσπονδίας (`oscar_fed_...`)',
                meaning: 'Περιορισμένα διαπιστευτήρια Bearer / MQTT που εκδίδονται στη σελίδα Χρήστες & πρόσβαση (`/users`) για ομοσπονδία Εθνικής προβολής και αναζήτησης πολλαπλών διελεύσεων οχημάτων χωρίς κοινή χρήση κωδικών διαχειριστή (ρόλος `Θεατής` μόνο ανάγνωσης ή `Χειριστής`).',
            },
            {
                term: 'Επεκτάσεις εκτέλεσης & τοπικά πακέτα (`/extensions`)',
                meaning: 'Μόνιμο κέντρο διαχείρισης (προστατευμένο κατά τις αναβαθμίσεις) για άμεση αντικατάσταση μοντέλων/κανόνων OCR, τοπικών χαρτών `.pmtiles` εκτός σύνδεσης (`/var/lib/oscar/extensions/maps-storage/`), βιβλιοθηκών φασματοσκοπίας ισοτόπων, πιστοποιητικών CA X.509, πακέτων κωδίκων κρίσης και προσθέτων EML διατηρώντας τις ενσωματωμένες προεπιλογές.',
            },
            {
                term: 'Συνεχή & περιστασιακά αντίγραφα ασφαλείας USB NVMe (`/usb-backups`)',
                meaning: 'Αυξητικά αντίγραφα ασφαλείας μηδενικής διακοπής (`0,0 s`) σε εξωτερικό SSD USB 3.x NVMe (`NTFS` προεπιλογή, συμβατό με Windows, macOS και Linux), με συνεχή ή κατ’ απαίτηση συγχρονισμό, ασφαλή εξαγωγή 1 κλικ (`SAFE_TO_UNPLUG`), μεταφορά σε φορητό υπολογιστή και πλήρη επαναφορά (`oscar usb-backup restore`).',
            },
            {
                term: 'WCO UFF 2.0 / 3.0 & ακτινογραφίες φορτίου HEMD (`/extensions` -> Φορτίο NII)',
                meaning: 'Πακέτα Unified File Format (`.uff`) του Παγκόσμιου Οργανισμού Τελωνείων από συστήματα ακτίνων X φορτίου (απενεργοποιημένα από προεπιλογή για μηδενική οπτική επιβάρυνση). Υποστηρίζουν τοπική επιθεώρηση αρχείων `.uff` στη Δευτερεύουσα Επιθεώρηση ή σύνδεση κοινόχρηστου πόρου SMBv2/SMBv3 μόνο ανάγνωσης στις `/extensions` για περιήγηση ανά σαρωτή/χρονικό παράθυρο, αναζήτηση UUID, ασαφή συσχέτιση OCR 1 χαρακτήρα, προβολή TIFF 16-bit με ατομικές ζώνες HEMD (`Z_eff`) ευθυγραμμισμένες στο προφίλ RPM και σύνδεση χωρίς πλήρη μεταφόρτωση.',
            },
            {
                term: 'Πρακτικό περιβάλλον εκπαίδευσης & καθοδηγούμενη ακαδημία (`oscar-sandbox`)',
                meaning: 'Απομονωμένο προσωρινό περιβάλλον εκπαίδευσης στη θύρα `:8444` (`sudo bash oscar.sh sandbox start` / `.\\oscar.bat sandbox start`) με `archive.enabled = false`, μηδενική εγγραφή στην παραγωγική PostgreSQL/Parquet/`config.json`, τοπικό μικρο-εξομοιωτή Rapiscan + RTSP + OCR + UFF + `WebRelay-Quad` (`127.0.0.1:10180`), πολυτροπικό Οδηγό Εκπαίδευσης (βίντεο 4 γλωσσών, έξυπνη έγχυση που ανοίγει το `/event-log` για `Code 9999` / `Code 9998` / `Clean Pass` και το `/health` για σφάλματα), διπλή προβολή SensorHub Admin, αυτόματη επαλήθευση, PDF ολοκλήρωσης 1 σελίδας και πλήρη εκκαθάριση σε `< 2 s`.',
            },
            {
                term: 'Φώτα και ήχος RPM (`webRelayConfig` — WebRelay-Quad)',
                meaning: 'Προαιρετικός δικτυακός έλεγχος ρελέ ανά λωρίδα (`enabled = false` από προεπιλογή) για μονάδες ControlByWeb WebRelay-Quad (`X-WR-4R3-E` / `X-410`) μέσω HTTP/XML (`stateFull.xml` / `state.xml`) σε κύρια και προαιρετική βοηθητική μονάδα ξηρών επαφών. Υποστηρίζει Αυτόματη λειτουργία (`AUTO`) (όπλιση `R1=1, R2=1`, καταστολή `Code 9999` και προαιρετικά `Code 9998`, παλμό `R3` κόκκινου φωτός γάμμα + σειρήνας ή/και `R4` μπλε φωτός νετρονίων σε πραγματικούς συναγερμούς και ασφαλή επαναφορά `0,0,0,0` κατά τη διακοπή), `PASS_THROUGH`, `MUTED` και ζωντανό χειροκίνητο έλεγχο διαχειριστή στις σελίδες `/health`, `/lane-view` και `/sensorhub/admin`.',
            },
            {
                term: 'Διαμεσολαβητής άκρου RPM για παράλληλη λειτουργία με CAS (`oscar-rpm-proxy`)',
                meaning: 'Προαιρετική απομονωμένη στοίβα Docker (`sudo bash oscar.sh rpm-proxy` / `.\\oscar.bat rpm-proxy`) για παράλληλη λειτουργία του OSCAR με υπάρχοντα Κεντρικό Σταθμό Συναγερμών (CAS). Διανέμει `1–50` ροές TCP Rapiscan RPM σε πραγματικό χρόνο (`< 1 ms`) μέσω χαρτογραφημένων θυρών (`11601..11650`) ή διαφανούς εικονικής IP `:1600` στο Ubuntu 24.04, αναπαράγει πλαίσια `SG1..SG3` / `SN1..SN2`, διατηρεί τον CAS συνδεδεμένο σε επανεκκινήσεις/αναβαθμίσεις του OSCAR και μεταδίδει φυσικές αποσυνδέσεις RPM σε `<= 4,0 s`.',
            },
        ],
        linksIntro: 'Ανοίξτε το πλήρες εγχειρίδιο διαχειριστή ή παρακολουθήστε τους σύντομους βιντεοοδηγούς:',
        adminLinkLabel: 'Άνοιγμα διαχείρισης SensorHub & ενσωματωμένου εγχειριδίου (`/sensorhub/admin`)',
        adminLinkDesc: 'Απαιτείται σύνδεση διαχειριστή. Επιλέξτε την Υπηρεσία OSCAR ή οποιαδήποτε μονάδα και ανοίξτε την καρτέλα README.',
        videoGuidesLinkLabel: 'Άνοιγμα βιντεοοδηγών εργασιών OSCAR (`ORNL/oscar-video-guides`)',
        videoGuidesLinkDesc: '29 σύντομα βίντεο (< 2 λεπ.) με υπότιτλους για εγκατάσταση πεδίου Ubuntu/Windows, περιβάλλον εκπαίδευσης, έλεγχο φώτων & ήχου RPM ανά λωρίδα (WebRelay-Quad), αντίγραφα USB NVMe, επεκτάσεις, χάρτες .pmtiles εκτός σύνδεσης, ακτινογραφίες φορτίου WCO UFF 16-bit, λωρίδες, αξιολόγηση, EML, OCR οχημάτων, χρήστες & Passkeys, ομοσπονδία, πακέτα υποστήριξης και αναφορές.',
        supportBundleTitle: 'Αντιμετώπιση προβλημάτων & πακέτο υποστήριξης (`.zip`)',
        supportBundleDesc: 'Λήψη ενιαίου διαγνωστικού αρχείου `.zip` που συνδυάζει συμβάντα του περιηγητή με αρχεία καταγραφής διακομιστή OSCAR, κατάσταση μονάδων και υγεία JVM/αποθήκευσης. Εάν ο διακομιστής δεν αποκρίνεται ή δεν εκκινεί, εκτελέστε `./oscar.sh support-bundle` (Linux) ή `oscar.bat support-bundle` (Windows) στον κεντρικό υπολογιστή.',
        supportBundlePrivacyNote: 'Απόρρητο & ασφάλεια: συλλέγονται αποκλειστικά για τεχνική διάγνωση· κωδικοί, διακριτικά, cookies συνεδρίας, διαπιστευτήρια RTSP και ιδιωτικά κλειδιά αφαιρούνται αυτόματα.',
        supportBundleButtonLabel: 'Εξαγωγή πακέτου υποστήριξης',
        supportBundleCombinedSuccess: (fileName: string) => `Ελήφθη το ${fileName} (διαγνωστικά πελάτη + διακομιστή, με απόκρυψη μυστικών).`,
        supportBundleClientFallback: (fileName: string) => `Ο διακομιστής δεν είναι προσβάσιμος· ελήφθησαν τα διαγνωστικά περιηγητή (${fileName}). Εκτελέστε ./oscar.sh support-bundle ή oscar.bat support-bundle στον διακομιστή.`,
        supportBundleUnexpectedError: 'Αδυναμία εξαγωγής πακέτου υποστήριξης περιηγητή. Εκτελέστε ./oscar.sh support-bundle ή oscar.bat support-bundle στον διακομιστή.',
        closeLabel: 'Κλείσιμο',
    },
};

const touchSafeButtonSx = {
    minInlineSize: 24,
    minBlockSize: 24,
    '@media (pointer: coarse)': {
        minInlineSize: 44,
        minBlockSize: 44,
    },
} as const;

const detailsTrackSx = {
    border: 1,
    borderColor: 'divider',
    borderRadius: 1,
    bgcolor: 'background.paper',
    '&[open] > summary': {
        borderBottom: 1,
        borderColor: 'divider',
    },
} as const;

const summaryTrackSx = {
    px: 2,
    py: 1.25,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.875rem',
    userSelect: 'none',
    '&:focus-visible': {
        outline: '2px solid',
        outlineColor: 'primary.main',
        outlineOffset: -2,
    },
} as const;

const TRACK_ORDER: readonly VideoGuideTrackId[] = ['A', 'B', 'C'];

export default function HelpDialog({
    open,
    onClose,
    activePathname,
    nodes,
    stateSummary,
    fetchImpl,
    skipBrowserDownload,
    onBundleExported,
    onOpenGuidedWalkthrough,
}: {
    open: boolean;
    onClose: () => void;
    activePathname?: string;
    nodes?: readonly SupportBundleNode[];
    stateSummary?: SupportClientStateSummary;
    fetchImpl?: typeof fetch;
    skipBrowserDownload?: boolean;
    onBundleExported?: (result: SupportBundleExportResult) => void;
    onOpenGuidedWalkthrough?: () => void;
}) {
    const { language } = useLanguage();
    const activeLocale: Locale = HELP_CONTENT[language] ? language : 'en';
    const content = HELP_CONTENT[activeLocale];
    const videoUi = VIDEO_GUIDE_UI_STRINGS[activeLocale];
    const tracksHeadingId = React.useId();
    const activeVideoHeadingId = React.useId();
    const [tabIndex, setTabIndex] = React.useState(0);
    const [activeGuideSlug, setActiveGuideSlug] = React.useState<string | null>(null);
    const [focusPendingSlug, setFocusPendingSlug] = React.useState<string | null>(null);
    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const playerContainerRef = React.useRef<HTMLDivElement | null>(null);
    const lastTriggerButtonRef = React.useRef<HTMLButtonElement | null>(null);
    const [exporting, setExporting] = React.useState(false);
    const [exportOutcome, setExportOutcome] = React.useState<{
        severity: 'success' | 'warning' | 'error';
        message: string;
    } | null>(null);

    const effectivePathname = React.useMemo(() => {
        if (activePathname) return activePathname;
        if (typeof window !== 'undefined') return window.location.pathname;
        return '/';
    }, [activePathname]);

    const contextualGuides = React.useMemo(
        () => getContextualVideoGuidesForPath(effectivePathname),
        [effectivePathname],
    );

    const activeGuide = React.useMemo(
        () => (activeGuideSlug ? getVideoGuideBySlug(activeGuideSlug) ?? null : null),
        [activeGuideSlug],
    );

    React.useEffect(() => {
        if (!open) {
            videoRef.current?.pause();
            setActiveGuideSlug(null);
            setFocusPendingSlug(null);
            setExportOutcome(null);
            setExporting(false);
        }
    }, [open]);

    React.useEffect(() => {
        if (open && focusPendingSlug && activeGuide?.slug === focusPendingSlug) {
            playerContainerRef.current?.focus();
            setFocusPendingSlug(null);
        }
    }, [activeGuide, focusPendingSlug, open]);

    React.useEffect(() => {
        const videoEl = videoRef.current;
        if (!open || !videoEl || !activeGuide) return;
        const applySync = () => syncVideoElementCaptionLocale(videoEl, activeLocale);
        applySync();
        const textTracks = videoEl.textTracks;
        textTracks?.addEventListener?.('addtrack', applySync);
        return () => {
            textTracks?.removeEventListener?.('addtrack', applySync);
        };
    }, [activeGuide, activeLocale, open]);

    const handleHighlightControl = React.useCallback(
        (iconKey: PlatformIconKey) => {
            const def = PLATFORM_ICONS[iconKey];
            if (!def) return;
            onClose();
            triggerPlatformSpotlight(def.spotlightSelector, { delayMs: 80 });
        },
        [onClose],
    );

    const handleCloseActiveVideo = React.useCallback((restoreTriggerFocus = true) => {
        videoRef.current?.pause();
        setActiveGuideSlug(null);
        setFocusPendingSlug(null);
        if (restoreTriggerFocus) {
            const trigger = lastTriggerButtonRef.current;
            if (trigger && trigger.isConnected) {
                window.requestAnimationFrame(() => trigger.focus());
            }
        }
    }, []);

    const handleToggleGuide = React.useCallback(
        (guide: VideoGuideEntry, event: React.MouseEvent<HTMLButtonElement>) => {
            lastTriggerButtonRef.current = event.currentTarget;
            if (activeGuideSlug === guide.slug) {
                videoRef.current?.pause();
                setActiveGuideSlug(null);
                setFocusPendingSlug(null);
                return;
            }
            videoRef.current?.pause();
            setActiveGuideSlug(guide.slug);
            setFocusPendingSlug(guide.slug);
        },
        [activeGuideSlug],
    );

    const renderWatchButtons = React.useCallback(
        (guides: readonly VideoGuideEntry[], contextTitle?: string, testIdPrefix = 'help-watch-guide') => {
            if (guides.length === 0) return null;
            return (
                <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1 }}>
                    {guides.map((guide) => {
                        const visibleLabel = videoUi.watchButtonLabel(guide.badge, guide.durationLabel);
                        const localizedTitle = guide.titles[activeLocale];
                        const isSelected = activeGuideSlug === guide.slug;
                        return (
                            <Button
                                key={guide.slug}
                                type="button"
                                variant={isSelected ? 'contained' : 'outlined'}
                                size="small"
                                color="primary"
                                startIcon={<PlayCircleOutlineRoundedIcon fontSize="small" aria-hidden="true" />}
                                aria-pressed={isSelected}
                                aria-label={videoUi.watchButtonAriaLabel(visibleLabel, localizedTitle, contextTitle)}
                                onClick={(event) => handleToggleGuide(guide, event)}
                                data-testid={`${testIdPrefix}-${guide.badge}`}
                                sx={{ ...touchSafeButtonSx, textTransform: 'none' }}
                            >
                                {visibleLabel}
                            </Button>
                        );
                    })}
                </Stack>
            );
        },
        [activeGuideSlug, activeLocale, handleToggleGuide, videoUi],
    );

    const handleExportSupportBundle = React.useCallback(async () => {
        if (exporting) return;
        setExporting(true);
        setExportOutcome(null);
        try {
            const result = await exportSupportBundle({
                nodes,
                stateSummary,
                fetchImpl,
                skipBrowserDownload,
            });
            onBundleExported?.(result);
            if (result.backendIncluded) {
                setExportOutcome({
                    severity: 'success',
                    message: content.supportBundleCombinedSuccess(result.fileName),
                });
            } else {
                setExportOutcome({
                    severity: 'warning',
                    message: content.supportBundleClientFallback(result.fileName),
                });
            }
        } catch {
            setExportOutcome({
                severity: 'error',
                message: content.supportBundleUnexpectedError,
            });
        } finally {
            setExporting(false);
        }
    }, [content, exporting, fetchImpl, nodes, onBundleExported, skipBrowserDownload, stateSummary]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            aria-labelledby="oscar-operator-help-title"
        >
            <DialogTitle id="oscar-operator-help-title" sx={{ pb: 1 }}>
                <Typography variant="h6" component="div" fontWeight={700}>
                    {content.dialogTitle}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {content.dialogSubtitle}
                </Typography>
            </DialogTitle>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
                <Tabs
                    value={tabIndex}
                    onChange={(_event, nextValue: number) => setTabIndex(nextValue)}
                    variant="scrollable"
                    scrollButtons="auto"
                >
                    <Tab label={content.tabs.pages} />
                    <Tab label={content.tabs.reports} />
                    <Tab label={content.tabs.glossary} />
                    <Tab label={content.tabs.links} />
                </Tabs>
            </Box>
            <DialogContent dividers sx={{ minHeight: 380 }}>
                {contextualGuides.length > 0 && (
                    <Paper
                        variant="outlined"
                        data-testid="help-contextual-video-strip"
                        sx={{ px: 1.5, py: 1, mb: 2, bgcolor: 'action.hover' }}
                    >
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            alignItems={{ xs: 'flex-start', sm: 'center' }}
                            justifyContent="space-between"
                        >
                            <Typography variant="caption" fontWeight={700} color="text.secondary">
                                {videoUi.contextualStripLabel}
                            </Typography>
                            <Stack direction="row" flexWrap="wrap" gap={0.75}>
                                {contextualGuides.map((guide) => {
                                    const visibleLabel = `${videoUi.watchButtonLabel(guide.badge, guide.durationLabel)}: ${guide.titles[activeLocale]}`;
                                    const isSelected = activeGuideSlug === guide.slug;
                                    return (
                                        <Button
                                            key={guide.slug}
                                            type="button"
                                            variant={isSelected ? 'contained' : 'outlined'}
                                            size="small"
                                            startIcon={<PlayCircleOutlineRoundedIcon fontSize="small" aria-hidden="true" />}
                                            aria-pressed={isSelected}
                                            onClick={(event) => handleToggleGuide(guide, event)}
                                            data-testid={`help-contextual-guide-${guide.badge}`}
                                            sx={{ ...touchSafeButtonSx, textTransform: 'none', textAlign: 'left' }}
                                        >
                                            {visibleLabel}
                                        </Button>
                                    );
                                })}
                            </Stack>
                        </Stack>
                    </Paper>
                )}

                {activeGuide && (
                    <Paper
                        ref={playerContainerRef}
                        tabIndex={-1}
                        variant="outlined"
                        role="region"
                        aria-labelledby={activeVideoHeadingId}
                        data-testid="help-inline-video-player"
                        sx={{
                            p: 1.75,
                            mb: 2,
                            borderColor: 'primary.main',
                            '&:focus-visible': {
                                outline: '2px solid',
                                outlineColor: 'primary.main',
                                outlineOffset: 2,
                            },
                        }}
                    >
                        <Stack spacing={1.25}>
                            <Stack
                                direction="row"
                                spacing={1}
                                alignItems="flex-start"
                                justifyContent="space-between"
                            >
                                <Box>
                                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                        <Chip
                                            label={`#${activeGuide.badge} · ${activeGuide.durationLabel} · ${activeGuide.sizeLabel}`}
                                            size="small"
                                            color="primary"
                                        />
                                        <Typography
                                            id={activeVideoHeadingId}
                                            variant="subtitle2"
                                            component="h3"
                                            fontWeight={700}
                                        >
                                            {activeGuide.titles[activeLocale]}
                                        </Typography>
                                    </Stack>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                        {activeGuide.summaries[activeLocale]}
                                    </Typography>
                                </Box>
                                <Button
                                    type="button"
                                    variant="text"
                                    size="small"
                                    startIcon={<CloseRoundedIcon fontSize="small" aria-hidden="true" />}
                                    onClick={() => handleCloseActiveVideo(true)}
                                    data-testid="help-close-video-player"
                                    sx={{ ...touchSafeButtonSx, flexShrink: 0, textTransform: 'none' }}
                                >
                                    {videoUi.closeVideoLabel}
                                </Button>
                            </Stack>
                            <Box
                                sx={{
                                    '& > video': {
                                        width: '100%',
                                        height: 'auto',
                                        aspectRatio: '16 / 9',
                                        bgcolor: 'common.black',
                                        borderRadius: 1,
                                        display: 'block',
                                    },
                                }}
                            >
                                <video
                                    ref={videoRef}
                                    key={activeGuide.slug}
                                    controls
                                    width={1280}
                                    height={720}
                                    preload="metadata"
                                    playsInline
                                    data-testid="help-video-element"
                                >
                                    <source src={activeGuide.mp4Url} type="video/mp4" />
                                    {getVideoGuideCaptionTracks(activeGuide).map((track) => (
                                        <track
                                            key={track.locale}
                                            kind="captions"
                                            src={track.src}
                                            srcLang={track.locale}
                                            label={track.label}
                                            default={activeLocale === track.locale}
                                        />
                                    ))}
                                </video>
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                                {videoUi.captionsNote}
                            </Typography>
                        </Stack>
                    </Paper>
                )}

                {tabIndex === 0 && (
                    <Stack spacing={1.5}>
                        <Typography variant="body2" color="text.secondary">
                            {content.pagesIntro}
                        </Typography>
                        {content.pages.map((item, pageIndex) => {
                            const pageGuides = resolveVideoGuidesBySlugs(
                                CONSOLE_PAGE_CARD_GUIDE_SLUGS[pageIndex] ?? [],
                            );
                            const pageIconKey = CONSOLE_PAGE_CARD_ICON_KEYS[pageIndex];
                            const iconDef = pageIconKey ? PLATFORM_ICONS[pageIconKey] : undefined;
                            const IconComp = iconDef?.Icon;
                            return (
                                <Paper key={item.title} variant="outlined" sx={{ p: 1.5 }}>
                                    <Stack
                                        direction="row"
                                        justifyContent="space-between"
                                        alignItems="center"
                                        spacing={1}
                                        useFlexGap
                                        flexWrap="wrap"
                                    >
                                        <Stack direction="row" spacing={1} alignItems="center" sx={{ minInlineSize: 0 }}>
                                            {pageIconKey && <PlatformIconBadge iconKey={pageIconKey} size="card" />}
                                            <Typography variant="subtitle2" fontWeight={700}>
                                                {renderTextWithIconsAndCode(item.title)}
                                            </Typography>
                                        </Stack>
                                        {pageIconKey && iconDef && IconComp && (
                                            <Button
                                                type="button"
                                                size="small"
                                                variant="outlined"
                                                startIcon={<IconComp fontSize="small" aria-hidden="true" />}
                                                endIcon={<GpsFixedRoundedIcon sx={{ fontSize: '14px !important', opacity: 0.78 }} aria-hidden="true" />}
                                                onClick={() => handleHighlightControl(pageIconKey)}
                                                data-testid={`help-highlight-page-${pageIconKey}`}
                                                sx={{ ...touchSafeButtonSx, textTransform: 'none', fontSize: '0.76rem' }}
                                            >
                                                {iconDef.highlightLabel[activeLocale]}
                                            </Button>
                                        )}
                                    </Stack>
                                    {pageIconKey && iconDef && (
                                        <Typography
                                            variant="caption"
                                            color="primary.main"
                                            data-testid={`help-page-symbol-note-${pageIconKey}`}
                                            sx={{ display: 'block', mt: 0.65, fontWeight: 600 }}
                                        >
                                            <PlatformIconBadge iconKey={pageIconKey} size="inline" />
                                            {iconDef.locationNote[activeLocale]}
                                        </Typography>
                                    )}
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                        {renderTextWithIconsAndCode(item.summary)}
                                    </Typography>
                                    {renderWatchButtons(pageGuides, item.title, `help-page-${pageIndex}-guide`)}
                                </Paper>
                            );
                        })}
                        <Paper variant="outlined" sx={{ p: 1.5 }} data-testid="help-top-bar-tools-card">
                            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                                {TOP_BAR_TOOLS_CARD_TITLE[activeLocale]}
                            </Typography>
                            <Stack spacing={1}>
                                {TOP_BAR_TOOL_ICON_KEYS.map((toolKey) => {
                                    const toolDef = PLATFORM_ICONS[toolKey];
                                    const ToolIcon = toolDef.Icon;
                                    return (
                                        <Stack
                                            key={toolKey}
                                            direction="row"
                                            justifyContent="space-between"
                                            alignItems="center"
                                            spacing={1}
                                            useFlexGap
                                            flexWrap="wrap"
                                        >
                                            <Typography variant="body2" color="text.secondary">
                                                <PlatformIconBadge iconKey={toolKey} size="inline" />
                                                {toolDef.locationNote[activeLocale]}
                                            </Typography>
                                            <Button
                                                type="button"
                                                size="small"
                                                variant="text"
                                                startIcon={<ToolIcon fontSize="small" aria-hidden="true" />}
                                                endIcon={<GpsFixedRoundedIcon sx={{ fontSize: '14px !important', opacity: 0.78 }} aria-hidden="true" />}
                                                onClick={() => handleHighlightControl(toolKey)}
                                                data-testid={`help-highlight-tool-${toolKey}`}
                                                sx={{ ...touchSafeButtonSx, textTransform: 'none', fontSize: '0.76rem' }}
                                            >
                                                {toolDef.highlightLabel[activeLocale]}
                                            </Button>
                                        </Stack>
                                    );
                                })}
                            </Stack>
                        </Paper>
                    </Stack>
                )}

                {tabIndex === 1 && (
                    <Stack spacing={2}>
                        <Typography variant="body2" color="text.secondary">
                            {content.reportsIntro}
                        </Typography>
                        <Stack spacing={1.25}>
                            {content.reports.map((item, reportIndex) => {
                                const reportGuides = resolveVideoGuidesBySlugs(
                                    REPORT_CARD_GUIDE_SLUGS[reportIndex] ?? [],
                                );
                                return (
                                    <Paper key={item.title} variant="outlined" sx={{ p: 1.5 }}>
                                        <Typography variant="subtitle2" fontWeight={700}>
                                            {item.title}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                            {item.summary}
                                        </Typography>
                                        {renderWatchButtons(
                                            reportGuides,
                                            item.title,
                                            `help-report-${reportIndex}-guide`,
                                        )}
                                    </Paper>
                                );
                            })}
                        </Stack>
                        <Divider />
                        <Typography variant="subtitle1" fontWeight={700}>
                            {content.formatsTitle}
                        </Typography>
                        <Stack direction="row" flexWrap="wrap" gap={1.25}>
                            {content.formats.map((format) => (
                                <Paper
                                    key={format.title}
                                    variant="outlined"
                                    sx={{ p: 1.5, flex: '1 1 220px' }}
                                >
                                    <Chip label={format.title} size="small" color="primary" sx={{ mb: 0.75 }} />
                                    <Typography variant="body2" color="text.secondary">
                                        {format.summary}
                                    </Typography>
                                </Paper>
                            ))}
                        </Stack>
                    </Stack>
                )}

                {tabIndex === 2 && (
                    <Stack spacing={1.5}>
                        <Typography variant="body2" color="text.secondary">
                            {content.glossaryIntro}
                        </Typography>
                        <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 700, width: '32%' }}>
                                            {content.glossaryTermHeader}
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>
                                            {content.glossaryMeaningHeader}
                                        </TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {content.glossary.map((entry, glossaryIndex) => {
                                        const glossaryGuides = resolveVideoGuidesBySlugs(
                                            GLOSSARY_INDEX_GUIDE_SLUGS[glossaryIndex] ?? [],
                                        );
                                        return (
                                            <TableRow key={entry.term} hover>
                                                <TableCell sx={{ fontWeight: 600, verticalAlign: 'top' }}>
                                                    {entry.term}
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2">{entry.meaning}</Typography>
                                                    {renderWatchButtons(
                                                        glossaryGuides,
                                                        entry.term,
                                                        `help-glossary-${glossaryIndex}-guide`,
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Stack>
                )}

                {tabIndex === 3 && (
                    <Stack spacing={2}>
                        <Typography variant="body2" color="text.secondary">
                            {content.linksIntro}
                        </Typography>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Stack spacing={1} alignItems="flex-start">
                                <Typography variant="subtitle2" fontWeight={700}>
                                    {content.adminLinkLabel}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {content.adminLinkDesc}
                                </Typography>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    endIcon={<OpenInNewRoundedIcon fontSize="small" aria-hidden="true" />}
                                    component="a"
                                    href="/sensorhub/admin"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    sx={touchSafeButtonSx}
                                >
                                    /sensorhub/admin
                                </Button>
                            </Stack>
                        </Paper>
                        <Paper variant="outlined" sx={{ p: 2 }} data-testid="help-video-guides-card">
                            <Stack spacing={1.25} alignItems="stretch">
                                <Box>
                                    <Typography variant="subtitle2" fontWeight={700}>
                                        {videoUi.localCatalogCardTitle}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                        {videoUi.localCatalogCardDesc}
                                    </Typography>
                                </Box>
                                <Stack direction="row" flexWrap="wrap" gap={1}>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        endIcon={<OpenInNewRoundedIcon fontSize="small" aria-hidden="true" />}
                                        component="a"
                                        href="/video-guides/index.html"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        data-testid="help-open-local-video-guides"
                                        sx={{ ...touchSafeButtonSx, textTransform: 'none' }}
                                    >
                                        {videoUi.openLocalCatalogButtonLabel}
                                    </Button>
                                    <Button
                                        variant="text"
                                        size="small"
                                        endIcon={<OpenInNewRoundedIcon fontSize="small" aria-hidden="true" />}
                                        component="a"
                                        href="https://github.com/ORNL/oscar-video-guides"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        data-testid="help-open-github-video-guides"
                                        sx={{ ...touchSafeButtonSx, textTransform: 'none' }}
                                    >
                                        {videoUi.openGithubCatalogButtonLabel}
                                    </Button>
                                </Stack>
                                <Divider />
                                <Box component="section" aria-labelledby={tracksHeadingId}>
                                    <Typography
                                        id={tracksHeadingId}
                                        variant="subtitle2"
                                        component="h3"
                                        fontWeight={700}
                                    >
                                        {videoUi.inAppCatalogHeading}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                        {videoUi.inAppCatalogHint}
                                    </Typography>
                                    <Stack spacing={1}>
                                        {TRACK_ORDER.map((trackId) => {
                                            const trackGuides = VIDEO_GUIDES_CATALOG.filter(
                                                (entry) => entry.track === trackId,
                                            );
                                            return (
                                                <Box
                                                    key={trackId}
                                                    component="details"
                                                    data-testid={`help-video-track-${trackId}`}
                                                    sx={detailsTrackSx}
                                                >
                                                    <Box component="summary" sx={summaryTrackSx}>
                                                        {videoUi.tracks[trackId]}
                                                    </Box>
                                                    <Stack spacing={1.25} sx={{ p: 1.5 }}>
                                                        {trackGuides.map((guide) => {
                                                            const visibleLabel = videoUi.watchButtonLabel(
                                                                guide.badge,
                                                                guide.durationLabel,
                                                            );
                                                            const localizedTitle = guide.titles[activeLocale];
                                                            const isSelected = activeGuideSlug === guide.slug;
                                                            return (
                                                                <Paper
                                                                    key={guide.slug}
                                                                    variant="outlined"
                                                                    sx={{ p: 1.25 }}
                                                                    data-testid={`help-catalog-item-${guide.badge}`}
                                                                >
                                                                    <Stack
                                                                        direction={{ xs: 'column', sm: 'row' }}
                                                                        spacing={1}
                                                                        alignItems={{ xs: 'flex-start', sm: 'center' }}
                                                                        justifyContent="space-between"
                                                                    >
                                                                        <Box sx={{ minInlineSize: 0 }}>
                                                                            <Typography variant="body2" fontWeight={700}>
                                                                                #{guide.badge} · {localizedTitle}{' '}
                                                                                <Typography
                                                                                    component="span"
                                                                                    variant="caption"
                                                                                    color="text.secondary"
                                                                                >
                                                                                    ({guide.durationLabel} · {guide.sizeLabel})
                                                                                </Typography>
                                                                            </Typography>
                                                                            <Typography
                                                                                variant="caption"
                                                                                color="text.secondary"
                                                                                sx={{ display: 'block', mt: 0.25 }}
                                                                            >
                                                                                {guide.summaries[activeLocale]}
                                                                            </Typography>
                                                                        </Box>
                                                                        <Button
                                                                            type="button"
                                                                            variant={isSelected ? 'contained' : 'outlined'}
                                                                            size="small"
                                                                            startIcon={
                                                                                <PlayCircleOutlineRoundedIcon
                                                                                    fontSize="small"
                                                                                    aria-hidden="true"
                                                                                />
                                                                            }
                                                                            aria-pressed={isSelected}
                                                                            aria-label={videoUi.watchButtonAriaLabel(
                                                                                visibleLabel,
                                                                                localizedTitle,
                                                                            )}
                                                                            onClick={(event) => handleToggleGuide(guide, event)}
                                                                            data-testid={`help-catalog-watch-${guide.badge}`}
                                                                            sx={{
                                                                                ...touchSafeButtonSx,
                                                                                flexShrink: 0,
                                                                                textTransform: 'none',
                                                                            }}
                                                                        >
                                                                            {visibleLabel}
                                                                        </Button>
                                                                    </Stack>
                                                                </Paper>
                                                            );
                                                        })}
                                                    </Stack>
                                                </Box>
                                            );
                                        })}
                                    </Stack>
                                </Box>
                            </Stack>
                        </Paper>
                        <TrainingSandboxLauncherCard
                            locale={activeLocale}
                            onOpenGuidedWalkthrough={onOpenGuidedWalkthrough}
                        />
                        <Paper variant="outlined" sx={{ p: 2 }} data-testid="help-system-update-card">
                            <Stack spacing={1} alignItems="flex-start">
                                <Typography variant="subtitle2" fontWeight={700}>
                                    {(SYSTEM_UPDATE_SHORTCUT_COPY[activeLocale] || SYSTEM_UPDATE_SHORTCUT_COPY.en).title}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {(SYSTEM_UPDATE_SHORTCUT_COPY[activeLocale] || SYSTEM_UPDATE_SHORTCUT_COPY.en).desc}
                                </Typography>
                                <Button
                                    component={Link}
                                    href="/users?tab=update"
                                    prefetch={false}
                                    variant="outlined"
                                    size="small"
                                    startIcon={<SystemUpdateAltRoundedIcon fontSize="small" aria-hidden="true" />}
                                    onClick={onClose}
                                    data-testid="help-open-system-update-btn"
                                    sx={touchSafeButtonSx}
                                >
                                    {(SYSTEM_UPDATE_SHORTCUT_COPY[activeLocale] || SYSTEM_UPDATE_SHORTCUT_COPY.en).button}
                                </Button>
                            </Stack>
                        </Paper>
                        <Paper variant="outlined" sx={{ p: 2 }} data-testid="help-support-bundle-card">
                            <Stack spacing={1} alignItems="flex-start">
                                <Typography variant="subtitle2" fontWeight={700}>
                                    {content.supportBundleTitle}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {content.supportBundleDesc}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {content.supportBundlePrivacyNote}
                                </Typography>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<DownloadRoundedIcon fontSize="small" aria-hidden="true" />}
                                    disabled={exporting}
                                    onClick={handleExportSupportBundle}
                                    data-testid="help-card-export-support-bundle"
                                    sx={touchSafeButtonSx}
                                >
                                    {content.supportBundleButtonLabel}
                                </Button>
                            </Stack>
                        </Paper>
                    </Stack>
                )}
            </DialogContent>
            {exporting && (
                <LinearProgress
                    data-testid="help-support-bundle-progress"
                    sx={{ minHeight: 4, flexShrink: 0 }}
                />
            )}
            <Box
                aria-live="polite"
                aria-atomic="true"
                data-testid="help-support-bundle-status"
                sx={{ px: 3, pt: exportOutcome ? 1.5 : 0 }}
            >
                {exportOutcome && (
                    <Alert
                        severity={exportOutcome.severity}
                        role={exportOutcome.severity === 'error' ? 'alert' : 'status'}
                        onClose={() => setExportOutcome(null)}
                    >
                        {exportOutcome.message}
                    </Alert>
                )}
            </Box>
            <DialogActions
                sx={{
                    px: 3,
                    py: 1.5,
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 1.5,
                }}
            >
                <Stack spacing={0.25} alignItems="flex-start" sx={{ flex: '1 1 280px' }}>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<DownloadRoundedIcon fontSize="small" aria-hidden="true" />}
                        disabled={exporting}
                        onClick={handleExportSupportBundle}
                        data-testid="help-export-support-bundle"
                        sx={touchSafeButtonSx}
                    >
                        {content.supportBundleButtonLabel}
                    </Button>
                    <Typography variant="caption" color="text.secondary">
                        {content.supportBundlePrivacyNote}
                    </Typography>
                </Stack>
                <Button onClick={onClose} variant="contained" sx={touchSafeButtonSx}>
                    {content.closeLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
