import {INode} from "@/lib/data/osh/Node";

// OSM's tile policy requires this exact hostname. Do not restore Leaflet's
// historical a/b/c subdomains; OSM may return policy-block tiles for them.
export const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const SITE_DIAGRAM_PANE = "site-diagram";
export const LANE_MARKER_PANE = "lane-markers";

// Leaflet renders tiles at 200, ordinary image overlays at 400, and markers at
// 600. Keeping site diagrams at 450 makes them the top raster layer without
// hiding lane markers or their popups.
export const SITE_DIAGRAM_PANE_Z_INDEX = 450;
export const LANE_MARKER_PANE_Z_INDEX = 650;

// Zero padding and fractional zoom make the initial viewport the tightest
// possible fit for the coordinates supplied when the diagram was uploaded.
export const SITE_DIAGRAM_FIT_OPTIONS = {
    animate: false,
    padding: [0, 0] as [number, number],
};

export const LANE_MARKER_ICON_SIZE: [number, number] = [24, 24];
export const LANE_MARKER_ICON_ANCHOR: [number, number] = [12, 12];

// Keep padding to the 12px marker radius plus 2px clearance so outermost lane
// icons are never clipped by the map border while maximizing fractional zoom.
export const LANE_EXTENT_FIT_OPTIONS = {
    animate: false,
    padding: [14, 14] as [number, number],
    maxZoom: 18,
};

export type SiteDiagramBounds = [
    [latitude: number, longitude: number],
    [latitude: number, longitude: number]
];

interface GeographicPoint {
    lat: number;
    lon: number;
}

interface SiteBoundingBox {
    lowerLeftBound: GeographicPoint;
    upperRightBound: GeographicPoint;
}

export interface LaneMapLocation {
    lat: number;
    lon: number;
    alt: number;
}

type SiteDiagramNode = Pick<INode,
    "address" | "port" | "isSecure" | "oshPathRoot" | "bucketsEndpoint">;

function normalizeUrlPath(path: string, fallback: string): string {
    const normalized = (path || fallback).replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    return normalized ? `/${normalized}` : "";
}

export function buildSiteDiagramUrl(path: string, node: SiteDiagramNode): string {
    if (/^https?:\/\//i.test(path))
        return path;

    const protocol = node.isSecure ? "https" : "http";
    const rootPath = normalizeUrlPath(node.oshPathRoot, "/sensorhub");
    const bucketPath = normalizeUrlPath(node.bucketsEndpoint, "/buckets");
    const bucketPathWithoutLeadingSlash = bucketPath.substring(1);
    let resourcePath = path.replace(/\\/g, "/").replace(/^\/+/, "");

    // Accept either the relative value published by the service
    // (sitemap/file.png) or a value that already includes the bucket endpoint.
    if (resourcePath === bucketPathWithoutLeadingSlash)
        resourcePath = "";
    else if (resourcePath.startsWith(`${bucketPathWithoutLeadingSlash}/`))
        resourcePath = resourcePath.substring(bucketPathWithoutLeadingSlash.length + 1);

    const resourceSuffix = resourcePath ? `/${resourcePath}` : "";
    return `${protocol}://${node.address}:${node.port}${rootPath}${bucketPath}${resourceSuffix}`;
}

export function toLeafletSiteDiagramBounds(siteBoundingBox: SiteBoundingBox): SiteDiagramBounds | null {
    const lowerLeft = siteBoundingBox?.lowerLeftBound;
    const upperRight = siteBoundingBox?.upperRightBound;
    const coordinates = [lowerLeft?.lat, lowerLeft?.lon, upperRight?.lat, upperRight?.lon];

    if (!coordinates.every(Number.isFinite))
        return null;

    if (Math.abs(lowerLeft.lat) > 90 || Math.abs(upperRight.lat) > 90 ||
        Math.abs(lowerLeft.lon) > 180 || Math.abs(upperRight.lon) > 180)
        return null;

    if (lowerLeft.lat >= upperRight.lat || lowerLeft.lon >= upperRight.lon)
        return null;

    return [
        [lowerLeft.lat, lowerLeft.lon],
        [upperRight.lat, upperRight.lon],
    ];
}

export function toLaneMapLocation(result: unknown): LaneMapLocation | null {
    // Fixed lanes publish {location}; the RS-350 and Kromek D5 GPS outputs publish {sensorLocation}.
    const record = result as {
        location?: {lat?: unknown; lon?: unknown; alt?: unknown};
        sensorLocation?: {lat?: unknown; lon?: unknown; alt?: unknown};
    } | null | undefined;
    const location = record?.location ?? record?.sensorLocation;
    const lat = location?.lat;
    const lon = location?.lon;
    const alt = location?.alt ?? 0;

    if (typeof lat !== "number" || typeof lon !== "number" || typeof alt !== "number" ||
        !Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(alt))
        return null;

    if (Math.abs(lat) > 90 || Math.abs(lon) > 180)
        return null;

    return {lat, lon, alt};
}

export function toLaneMapLocationFromSystem(system: unknown): LaneMapLocation | null {
    const rawSystem = system as {
        geometry?: unknown;
        properties?: {
            geometry?: unknown;
            properties?: {geometry?: unknown};
        };
    };
    const geometryCandidates = [
        rawSystem?.geometry,
        rawSystem?.properties?.geometry,
        rawSystem?.properties?.properties?.geometry,
    ];

    for (const candidate of geometryCandidates) {
        const geometry = candidate as {type?: unknown; coordinates?: unknown};
        if (geometry?.type !== "Point" || !Array.isArray(geometry.coordinates))
            continue;

        // GeoJSON point coordinates are ordered longitude, latitude, altitude.
        const [lon, lat, rawAlt = 0] = geometry.coordinates;
        const alt = rawAlt ?? 0;
        if (typeof lat !== "number" || typeof lon !== "number" || typeof alt !== "number" ||
            !Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(alt))
            continue;
        if (Math.abs(lat) > 90 || Math.abs(lon) > 180)
            continue;

        return {lat, lon, alt};
    }

    return null;
}

export function isValidGeographicCoordinate(lat: unknown, lon: unknown): boolean {
    return typeof lat === "number" &&
        typeof lon === "number" &&
        Number.isFinite(lat) &&
        Number.isFinite(lon) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lon) <= 180;
}

export function isUnconfiguredNullIsland(location: Pick<LaneMapLocation, "lat" | "lon">): boolean {
    return Math.abs(location.lat) < 1e-6 && Math.abs(location.lon) < 1e-6;
}

export function resolveLaneMapLocation(
    observationResult: unknown,
    systemLocation: LaneMapLocation | null,
): LaneMapLocation | null {
    const observationLocation = toLaneMapLocation(observationResult);
    if (!observationLocation)
        return systemLocation;

    if (isUnconfiguredNullIsland(observationLocation) &&
        systemLocation &&
        !isUnconfiguredNullIsland(systemLocation)) {
        return systemLocation;
    }

    return observationLocation;
}

export function toLeafletLaneExtentBounds(
    locations: ReadonlyArray<Pick<LaneMapLocation, "lat" | "lon">>,
): SiteDiagramBounds | null {
    const validLocations = locations.filter((location) =>
        isValidGeographicCoordinate(location?.lat, location?.lon));
    if (validLocations.length === 0)
        return null;

    const configuredLocations = validLocations.filter((location) =>
        !isUnconfiguredNullIsland(location));
    const effectiveLocations = configuredLocations.length > 0
        ? configuredLocations
        : validLocations;

    let minLat = effectiveLocations[0].lat;
    let maxLat = effectiveLocations[0].lat;
    let minLon = effectiveLocations[0].lon;
    let maxLon = effectiveLocations[0].lon;

    for (const location of effectiveLocations) {
        if (location.lat < minLat)
            minLat = location.lat;
        if (location.lat > maxLat)
            maxLat = location.lat;
        if (location.lon < minLon)
            minLon = location.lon;
        if (location.lon > maxLon)
            maxLon = location.lon;
    }

    return [
        [minLat, minLon],
        [maxLat, maxLon],
    ];
}

export function buildLaneExtentSignature(
    markers: ReadonlyArray<{laneName: string; location: Pick<LaneMapLocation, "lat" | "lon">}>,
): string {
    if (markers.length === 0)
        return "";

    return [...markers]
        .filter(({location}) => isValidGeographicCoordinate(location?.lat, location?.lon))
        .sort((a, b) => a.laneName.localeCompare(b.laneName))
        .map(({laneName, location}) => `${laneName}:${location.lat.toFixed(6)},${location.lon.toFixed(6)}`)
        .join("|");
}

/* ------------------------------------------------------------------------------------------
 * Mobile detectors (RS-350 backpack, Kromek D5 walker)
 * ---------------------------------------------------------------------------------------- */

/** How long a walker stays red after a live alarm occupancy. */
export const MOBILE_ALARM_FLASH_MS = 30_000;
/** Walkers silent for longer than this are drawn offline (GPS publishes at ~1 Hz). */
export const MOBILE_SILENCE_THRESHOLD_MS = 15_000;
/** Portal lanes whose ~1 Hz gamma/neutron counts stop arriving for this long are drawn offline. */
export const LANE_SILENCE_THRESHOLD_MS = 15_000;
/** Re-evaluation cadence for walker silence and alarm flashes. */
export const MOBILE_SWEEP_MS = 5_000;
/** Refresh cadence for the unadjudicated mobile alarm layer. */
export const MOBILE_ALARM_REFRESH_MS = 30_000;
/** Server-side CQL for alarms an operator still has to adjudicate. */
export const UNADJUDICATED_ALARM_FILTER = "(gammaAlarm=true OR neutronAlarm=true) AND adjudicatedIdsCount=0";

export type WalkerState = "normal" | "alarm" | "offline";

const WALKER_COLORS: Record<WalkerState, string> = {
    normal: "#1565c0",
    alarm: "#d32f2f",
    offline: "#9e9e9e",
};
export const MOBILE_ALARM_COLOR = WALKER_COLORS.alarm;

/**
 * Alarm outranks offline: an unacknowledged radiation alarm must never be visually
 * downgraded because the walker's comms went quiet. Silence is measured from the browser's
 * arrival time of the last fix, so node/browser clock skew cannot fake it.
 */
export function walkerState(
    lastFixArrivalMs: number | null | undefined,
    alarmUntilMs: number | null | undefined,
    reportedOffline: boolean,
    now: number,
): WalkerState {
    if (alarmUntilMs != null && alarmUntilMs > now) return "alarm";
    if (reportedOffline) return "offline";
    if (lastFixArrivalMs == null || now - lastFixArrivalMs > MOBILE_SILENCE_THRESHOLD_MS) return "offline";
    return "normal";
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"}[c]!));
}

/** Ringed walker glyph; the title carries "no data since" when offline. */
export function walkerIconHtml(state: WalkerState, title: string): string {
    const color = WALKER_COLORS[state];
    return `<div data-walker-state="${state}" title="${escapeHtml(title)}" style="width:30px;height:30px;border-radius:50%;background:#ffffff;border:3px solid ${color};box-shadow:0 1px 4px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;${state === "offline" ? "opacity:.8;" : ""}">`
        + `<svg viewBox="0 0 24 24" width="20" height="20" fill="${color}"><path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/></svg>`
        + `</div>`;
}

/** Position stamped on a mobile alarm occupancy by the RS-350/D5 occupancy process, if any. */
export function mobileAlarmPosition(result: any): LaneMapLocation | null {
    const lat = result?.latitude;
    const lon = result?.longitude;
    if (typeof lat !== "number" || typeof lon !== "number") return null;
    if (lat === 0 && lon === 0) return null;
    if (!isValidGeographicCoordinate(lat, lon)) return null;
    return {lat, lon, alt: 0};
}

/** Local midnight today, as the start of the mobile alarm layer's window. */
export function startOfLocalDayIso(now: Date = new Date()): string {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    return day.toISOString();
}
