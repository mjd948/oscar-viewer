import {strFromU8, strToU8, unzipSync, zipSync, Zippable} from "fflate";
import {INode} from "@/lib/data/osh/Node";

export const SUPPORT_DIAGNOSTICS_SCHEMA_VERSION = 1;
export const MAX_SUPPORT_DIAGNOSTIC_EVENTS = 400;
export const MAX_DIAGNOSTIC_MESSAGE_LENGTH = 600;
export const SLOW_FETCH_THRESHOLD_MS = 2_500;
export const DEFAULT_BACKEND_TIMEOUT_MS = 10_000;
export const DEFAULT_BACKEND_TAIL_LINES = 2_500;
export const MAX_BACKEND_ZIP_BYTES = 20 * 1024 * 1024;

export const REDACTED = "[REDACTED]";

export type SupportDiagnosticCategory = "console" | "runtime" | "network" | "app";
export type SupportDiagnosticLevel = "info" | "warn" | "error";

export interface SupportDiagnosticEvent {
    timestamp: string;
    category: SupportDiagnosticCategory;
    level: SupportDiagnosticLevel;
    message: string;
    details?: Record<string, string | number | boolean | null>;
}

export type SupportBundleNode = Pick<
    INode,
    | "id"
    | "name"
    | "address"
    | "port"
    | "isSecure"
    | "isDefaultNode"
    | "oshPathRoot"
    | "bucketsEndpoint"
    | "getBasicAuthHeader"
>;

export interface SupportClientStateSummary {
    configuredNodeCount?: number;
    activeViewKey?: string | null;
    viewError?: string | null;
    unreadAlarmCount?: number;
    authenticatedUserPresent?: boolean;
}

export interface ExportSupportBundleOptions {
    nodes?: readonly SupportBundleNode[];
    route?: string;
    search?: string;
    stateSummary?: SupportClientStateSummary;
    tailLines?: number;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
    now?: Date;
    skipBrowserDownload?: boolean;
}

export interface SupportBundleExportResult {
    fileName: string;
    zipBytes: Uint8Array;
    bundleSource: "combined" | "client-only";
    backendIncluded: boolean;
    backendFetchError?: string;
    eventCount: number;
    clientRedactions: number;
}

interface NavigatorUABrandVersion {
    brand: string;
    version: string;
}

interface NavigatorUADataLike {
    brands?: readonly NavigatorUABrandVersion[];
    mobile?: boolean;
    platform?: string;
}

interface RecorderState {
    installed: boolean;
    events: SupportDiagnosticEvent[];
    redactionsApplied: number;
    suppressCapture: boolean;
}

const RECORDER_GLOBAL_KEY = "__oscarSupportDiagnosticsState__";

const URI_USERINFO_RE = /([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^/@\s"'<>]+)@/g;
const AUTH_HEADER_RE = /(\bAuthorization\s*[:=]\s*(?:Basic|Bearer|Digest|Token)\s+)([^\s,;"']+)/gi;
const STANDALONE_AUTH_RE = /\b(Bearer|Basic)\s+([A-Za-z0-9._~+/=-]{12,})/gi;
const COOKIE_HEADER_RE = /(\b(?:Cookie|Set-Cookie)\s*:\s*)([A-Za-z0-9._-]+)=([^;\s"',]+)((?:\s*;\s*[A-Za-z0-9._-]+=[^;\s"',]+)*)/gi;
const COOKIE_PAIR_RE = /([A-Za-z0-9._-]+)=([^;\s"',]+)/g;
const SESSION_COOKIE_RE = /\b(OSCAR_SESSION|JSESSIONID)\s*=\s*([^;\s"',]+)/gi;
const QUERY_SECRET_RE = /([?&](?:password|passwd|pwd|token|access_token|refresh_token|api_key|apikey|secret|auth|session|sig|signature)=)([^&\s"'#]+)/gi;
const KEY_VALUE_SECRET_RE = /("?\b(?:password|passwd|pwd|secret|api[_-]?key|(?:(?:access|refresh|id|auth|session|csrf|api)[_-]?)?token|private[_-]?key|passphrase)\b"?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;}\]"']+)/gi;
const EMAIL_RE = /\b([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;
const SENSITIVE_KEY_RE = /(?:password|passwd|pwd|secret|token|api[_-]?key|authorization|cookie|oscar_session|jsessionid|private[_-]?key|passphrase)/i;
const SAFE_KEY_ALLOWLIST = new Set(["cookiename", "keyalias", "authmethod", "securecookie"]);

function getRecorderState(): RecorderState {
    const host = globalThis as unknown as Record<string, RecorderState | undefined>;
    let existing = host[RECORDER_GLOBAL_KEY];
    if (!existing) {
        existing = {
            installed: false,
            events: [],
            redactionsApplied: 0,
            suppressCapture: false,
        };
        host[RECORDER_GLOBAL_KEY] = existing;
    }
    return existing;
}

export function redactSupportText(
    raw: string,
    counter?: {count: number},
): string {
    if (!raw) return "";
    let redactions = 0;
    let out = raw;

    out = out.replace(URI_USERINFO_RE, (_match, scheme: string) => {
        redactions += 1;
        return `${scheme}${REDACTED}@`;
    });

    out = out.replace(AUTH_HEADER_RE, (_match, prefix: string) => {
        redactions += 1;
        return `${prefix}${REDACTED}`;
    });

    out = out.replace(STANDALONE_AUTH_RE, (_match, scheme: string) => {
        redactions += 1;
        return `${scheme} ${REDACTED}`;
    });

    out = out.replace(
        COOKIE_HEADER_RE,
        (_match, prefix: string, name: string, _val: string, rest: string) => {
            redactions += 1;
            const tail = rest ? rest.replace(COOKIE_PAIR_RE, `$1=${REDACTED}`) : "";
            return `${prefix}${name}=${REDACTED}${tail}`;
        },
    );

    out = out.replace(SESSION_COOKIE_RE, (_match, cookieName: string) => {
        redactions += 1;
        return `${cookieName}=${REDACTED}`;
    });

    out = out.replace(QUERY_SECRET_RE, (_match, prefix: string) => {
        redactions += 1;
        return `${prefix}${REDACTED}`;
    });

    out = out.replace(KEY_VALUE_SECRET_RE, (fullMatch, prefix: string, valueToken: string) => {
        if (
            !valueToken
            || valueToken === '""'
            || valueToken === "''"
            || valueToken.includes(REDACTED)
        ) {
            return fullMatch;
        }
        redactions += 1;
        if (valueToken.startsWith('"') && valueToken.endsWith('"') && valueToken.length >= 2) {
            return `${prefix}"${REDACTED}"`;
        }
        if (valueToken.startsWith("'") && valueToken.endsWith("'") && valueToken.length >= 2) {
            return `${prefix}'${REDACTED}'`;
        }
        return `${prefix}${REDACTED}`;
    });

    out = out.replace(EMAIL_RE, (_match, firstChar: string, domain: string) => {
        redactions += 1;
        return `${firstChar}***@${domain}`;
    });

    if (counter) {
        counter.count += redactions;
    }
    return out;
}

export function redactSupportUrl(
    rawUrl: string,
    counter?: {count: number},
): string {
    if (!rawUrl) return "";
    return redactSupportText(rawUrl, counter);
}

function truncateDiagnosticText(raw: string, maxLen = MAX_DIAGNOSTIC_MESSAGE_LENGTH): string {
    if (raw.length <= maxLen) return raw;
    return `${raw.slice(0, maxLen)}...`;
}

function stringifyDiagnosticArg(arg: unknown, counter: {count: number}, depth = 0): string {
    if (arg === null) return "null";
    if (arg === undefined) return "undefined";
    if (typeof arg === "string") return redactSupportText(arg, counter);
    if (typeof arg === "number" || typeof arg === "boolean" || typeof arg === "bigint") {
        return String(arg);
    }
    if (arg instanceof Error) {
        const base = `${arg.name}: ${arg.message}`;
        const stackFirstLine = typeof arg.stack === "string"
            ? arg.stack.split(/\r?\n/).slice(0, 4).join(" | ")
            : base;
        return redactSupportText(stackFirstLine || base, counter);
    }
    if (depth > 2) {
        return "[Object]";
    }
    if (Array.isArray(arg)) {
        const items = arg.slice(0, 8).map(item => stringifyDiagnosticArg(item, counter, depth + 1));
        return `[${items.join(", ")}${arg.length > 8 ? ", ..." : ""}]`;
    }
    if (typeof arg === "object") {
        try {
            const entries = Object.entries(arg as Record<string, unknown>).slice(0, 12);
            const parts = entries.map(([key, val]) => {
                const lower = key.toLowerCase();
                if (!SAFE_KEY_ALLOWLIST.has(lower) && SENSITIVE_KEY_RE.test(lower)) {
                    counter.count += 1;
                    return `${key}: "${REDACTED}"`;
                }
                return `${key}: ${stringifyDiagnosticArg(val, counter, depth + 1)}`;
            });
            return `{${parts.join(", ")}}`;
        } catch {
            return "[UnserializableObject]";
        }
    }
    return String(arg);
}

export function recordSupportDiagnosticEvent(
    event: Omit<SupportDiagnosticEvent, "timestamp"> & {timestamp?: string},
): void {
    const state = getRecorderState();
    if (state.suppressCapture) return;

    const counter = {count: 0};
    const sanitizedMessage = truncateDiagnosticText(
        redactSupportText(event.message || "", counter),
    );
    let sanitizedDetails: Record<string, string | number | boolean | null> | undefined;
    if (event.details) {
        sanitizedDetails = {};
        for (const [key, value] of Object.entries(event.details)) {
            const lower = key.toLowerCase();
            if (!SAFE_KEY_ALLOWLIST.has(lower) && SENSITIVE_KEY_RE.test(lower)) {
                counter.count += 1;
                sanitizedDetails[key] = REDACTED;
            } else if (typeof value === "string") {
                sanitizedDetails[key] = truncateDiagnosticText(
                    redactSupportText(value, counter),
                    300,
                );
            } else {
                sanitizedDetails[key] = value;
            }
        }
    }

    state.redactionsApplied += counter.count;
    state.events.push({
        timestamp: event.timestamp ?? new Date().toISOString(),
        category: event.category,
        level: event.level,
        message: sanitizedMessage,
        ...(sanitizedDetails ? {details: sanitizedDetails} : {}),
    });

    while (state.events.length > MAX_SUPPORT_DIAGNOSTIC_EVENTS) {
        state.events.shift();
    }
}

export function getSupportDiagnosticEventsSnapshot(): {
    events: SupportDiagnosticEvent[];
    redactionsApplied: number;
} {
    const state = getRecorderState();
    return {
        events: [...state.events],
        redactionsApplied: state.redactionsApplied,
    };
}

export function clearSupportDiagnosticEventsForTesting(): void {
    const state = getRecorderState();
    state.events = [];
    state.redactionsApplied = 0;
}

function extractRequestUrl(input: RequestInfo | URL): string {
    if (typeof input === "string") return input;
    if (typeof URL !== "undefined" && input instanceof URL) return input.toString();
    if (typeof Request !== "undefined" && input instanceof Request) return input.url;
    return String(input);
}

function extractRequestMethod(input: RequestInfo | URL, init?: RequestInit): string {
    if (init?.method) return init.method.toUpperCase();
    if (typeof Request !== "undefined" && input instanceof Request && input.method) {
        return input.method.toUpperCase();
    }
    return "GET";
}

function isAbortError(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;
    const name = (error as {name?: string}).name;
    return name === "AbortError";
}

function isSupportBundleEndpointUrl(url: string): boolean {
    return url.includes("/buckets/reports/support-bundle");
}

/**
 * Installs a lightweight, idempotent client flight recorder capturing console warnings/errors,
 * uncaught runtime exceptions, unhandled rejections, and failed or slow fetch metadata.
 */
export function installSupportDiagnosticsRecorder(): void {
    if (typeof window === "undefined") return;
    const state = getRecorderState();
    if (state.installed) return;
    state.installed = true;

    const origWarn = console.warn;
    const origError = console.error;

    console.warn = (...args: unknown[]) => {
        try {
            if (!state.suppressCapture) {
                const counter = {count: 0};
                const msg = args.map(arg => stringifyDiagnosticArg(arg, counter)).join(" ");
                state.redactionsApplied += counter.count;
                recordSupportDiagnosticEvent({
                    category: "console",
                    level: "warn",
                    message: msg,
                });
            }
        } catch {
            // Never interfere with application logging.
        }
        origWarn.apply(console, args);
    };

    console.error = (...args: unknown[]) => {
        try {
            if (!state.suppressCapture) {
                const counter = {count: 0};
                const msg = args.map(arg => stringifyDiagnosticArg(arg, counter)).join(" ");
                state.redactionsApplied += counter.count;
                recordSupportDiagnosticEvent({
                    category: "console",
                    level: "error",
                    message: msg,
                });
            }
        } catch {
            // Never interfere with application logging.
        }
        origError.apply(console, args);
    };

    window.addEventListener("error", (event: ErrorEvent) => {
        try {
            const message = event.message || "Uncaught window error";
            recordSupportDiagnosticEvent({
                category: "runtime",
                level: "error",
                message,
                details: {
                    filename: event.filename || null,
                    lineno: typeof event.lineno === "number" ? event.lineno : null,
                    colno: typeof event.colno === "number" ? event.colno : null,
                },
            });
        } catch {
            // Ignore diagnostic hook errors.
        }
    });

    window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
        try {
            const counter = {count: 0};
            const reasonText = stringifyDiagnosticArg(event.reason, counter);
            state.redactionsApplied += counter.count;
            recordSupportDiagnosticEvent({
                category: "runtime",
                level: "error",
                message: `Unhandled promise rejection: ${reasonText}`,
            });
        } catch {
            // Ignore diagnostic hook errors.
        }
    });

    if (typeof window.fetch === "function") {
        const origFetch = window.fetch.bind(window);
        window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            const rawUrl = extractRequestUrl(input);
            if (state.suppressCapture || isSupportBundleEndpointUrl(rawUrl)) {
                return origFetch(input, init);
            }
            const method = extractRequestMethod(input, init);
            const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
            try {
                const response = await origFetch(input, init);
                const elapsedMs = Math.round(
                    (typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt,
                );
                if (!response.ok || elapsedMs >= SLOW_FETCH_THRESHOLD_MS) {
                    const level: SupportDiagnosticLevel = response.status >= 500
                        ? "error"
                        : "warn";
                    const summary = !response.ok
                        ? `HTTP ${response.status} on ${method} ${rawUrl} (${elapsedMs} ms)`
                        : `Slow HTTP ${response.status} on ${method} ${rawUrl} (${elapsedMs} ms)`;
                    recordSupportDiagnosticEvent({
                        category: "network",
                        level,
                        message: summary,
                        details: {
                            method,
                            url: rawUrl,
                            status: response.status,
                            durationMs: elapsedMs,
                        },
                    });
                }
                return response;
            } catch (error) {
                if (!isAbortError(error)) {
                    const elapsedMs = Math.round(
                        (typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt,
                    );
                    const errName = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
                    recordSupportDiagnosticEvent({
                        category: "network",
                        level: "error",
                        message: `Network failure on ${method} ${rawUrl}: ${errName}`,
                        details: {
                            method,
                            url: rawUrl,
                            status: 0,
                            durationMs: elapsedMs,
                        },
                    });
                }
                throw error;
            }
        };
    }
}

function normalizeConfiguredPath(path: string | undefined, fallback: string): string {
    const input = (path || fallback).replace(/\\/g, "/");
    const segments = input.split("/").filter(segment => segment && segment !== ".");
    if (segments.some(segment => segment === "..")) {
        throw new Error("Unsafe bucket endpoint path");
    }
    return `/${segments.map(segment => encodeURIComponent(segment)).join("/")}`;
}

export function buildSupportBundleUrl(
    node?: SupportBundleNode,
    tailLines = DEFAULT_BACKEND_TAIL_LINES,
): string {
    const clampedTail = Math.max(100, Math.min(10_000, Math.floor(tailLines)));
    if (!node) {
        return `/sensorhub/buckets/reports/support-bundle?tailLines=${clampedTail}`;
    }
    const root = normalizeConfiguredPath(node.oshPathRoot, "/sensorhub");
    const buckets = normalizeConfiguredPath(node.bucketsEndpoint, "/buckets");
    const relative = `${root}${buckets}/reports/support-bundle?tailLines=${clampedTail}`;
    if (node.isDefaultNode) {
        return relative;
    }
    return `${node.isSecure ? "https" : "http"}://${node.address}:${node.port}${relative}`;
}

function selectTargetNode(nodes?: readonly SupportBundleNode[]): SupportBundleNode | undefined {
    if (!nodes || nodes.length === 0) return undefined;
    return nodes.find(node => node.isDefaultNode) ?? nodes[0];
}

function collectClientEnvironment(): Record<string, unknown> {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
        return {runtime: "non-browser"};
    }

    const navWithUaData = navigator as Navigator & {userAgentData?: NavigatorUADataLike};
    const uaData = navWithUaData.userAgentData;

    // Prefer low-entropy User-Agent Client Hints + feature detection over raw high-entropy UA string.
    const clientHints = uaData
        ? {
            brands: Array.isArray(uaData.brands)
                ? uaData.brands.map(item => ({brand: item.brand, version: item.version}))
                : [],
            mobile: Boolean(uaData.mobile),
            platform: uaData.platform || null,
        }
        : null;

    let coarseBrowserFamily: string | null = null;
    if (!clientHints && typeof navigator.userAgent === "string") {
        if (navigator.userAgent.includes("Firefox/")) coarseBrowserFamily = "Firefox";
        else if (navigator.userAgent.includes("Edg/")) coarseBrowserFamily = "Edge";
        else if (navigator.userAgent.includes("Chrome/")) coarseBrowserFamily = "Chromium/Chrome";
        else if (navigator.userAgent.includes("Safari/")) coarseBrowserFamily = "Safari";
        else coarseBrowserFamily = "Browser";
    }

    let timezone: string | null = null;
    try {
        timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch {
        timezone = null;
    }

    return {
        clientHints,
        ...(coarseBrowserFamily ? {browserFamily: coarseBrowserFamily} : {}),
        language: navigator.language || null,
        onLine: typeof navigator.onLine === "boolean" ? navigator.onLine : null,
        timezone,
        viewport: {
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio || 1,
        },
        features: {
            serviceWorker: "serviceWorker" in navigator,
            mediaSource: typeof window.MediaSource !== "undefined",
            webRtc: typeof window.RTCPeerConnection !== "undefined",
            clipboard: Boolean(navigator.clipboard),
        },
    };
}

function formatArchiveTimestampUtc(date: Date): string {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function triggerBrowserZipDownload(fileName: string, zipBytes: Uint8Array): void {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const copy = new Uint8Array(zipBytes.byteLength);
    copy.set(zipBytes);
    const blob = new Blob([copy], {type: "application/zip"});
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
    }, 10_000);
}

function safeParseJsonObject(bytes: Uint8Array | undefined): Record<string, unknown> | null {
    if (!bytes) return null;
    try {
        const parsed = JSON.parse(strFromU8(bytes));
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : null;
    } catch {
        return null;
    }
}

export async function exportSupportBundle(
    options: ExportSupportBundleOptions = {},
): Promise<SupportBundleExportResult> {
    const state = getRecorderState();
    const now = options.now ?? new Date();
    const generatedAt = now.toISOString();
    const tsCompact = formatArchiveTimestampUtc(now);
    const effectiveFetch: typeof fetch = options.fetchImpl
        ?? ((input, init) => fetch(input, init));

    const targetNode = selectTargetNode(options.nodes);
    const backendUrl = buildSupportBundleUrl(
        targetNode,
        options.tailLines ?? DEFAULT_BACKEND_TAIL_LINES,
    );

    const authHeaderObj = targetNode?.getBasicAuthHeader?.();
    const headers: Record<string, string> = {
        Accept: "application/zip, application/json",
    };
    if (authHeaderObj && typeof authHeaderObj.Authorization === "string" && authHeaderObj.Authorization) {
        headers.Authorization = authHeaderObj.Authorization;
    }

    let backendEntries: Record<string, Uint8Array> | null = null;
    let backendFetchError: string | undefined;

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? DEFAULT_BACKEND_TIMEOUT_MS;
    const timeoutId = typeof setTimeout === "function"
        ? setTimeout(() => controller.abort(), timeoutMs)
        : undefined;

    state.suppressCapture = true;
    try {
        const response = await effectiveFetch(backendUrl, {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers,
            signal: controller.signal,
        });
        if (!response.ok) {
            backendFetchError = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
        } else {
            const buffer = await response.arrayBuffer();
            if (buffer.byteLength <= 0 || buffer.byteLength > MAX_BACKEND_ZIP_BYTES) {
                backendFetchError = `Backend archive size (${buffer.byteLength} bytes) is outside diagnostic bounds`;
            } else {
                backendEntries = unzipSync(new Uint8Array(buffer));
            }
        }
    } catch (error) {
        const counter = {count: 0};
        const rawErr = isAbortError(error)
            ? `Timed out after ${timeoutMs} ms waiting for backend support bundle`
            : (error instanceof Error ? `${error.name}: ${error.message}` : String(error));
        backendFetchError = redactSupportText(rawErr, counter);
        state.redactionsApplied += counter.count;
    } finally {
        state.suppressCapture = false;
        if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
        }
    }

    const snapshot = getSupportDiagnosticEventsSnapshot();
    const routeCounter = {count: 0};
    const rawRoute = options.route
        ?? (typeof window !== "undefined" ? window.location.pathname : "/");
    const rawSearch = options.search
        ?? (typeof window !== "undefined" ? window.location.search : "");
    const sanitizedRoute = redactSupportUrl(`${rawRoute}${rawSearch}`, routeCounter);
    const totalClientRedactions = snapshot.redactionsApplied + routeCounter.count;

    const countsByLevel: Record<SupportDiagnosticLevel, number> = {
        info: 0,
        warn: 0,
        error: 0,
    };
    const countsByCategory: Record<SupportDiagnosticCategory, number> = {
        console: 0,
        runtime: 0,
        network: 0,
        app: 0,
    };
    for (const item of snapshot.events) {
        countsByLevel[item.level] = (countsByLevel[item.level] ?? 0) + 1;
        countsByCategory[item.category] = (countsByCategory[item.category] ?? 0) + 1;
    }

    const sanitizedNodes = (options.nodes ?? []).map(node => ({
        id: node.id,
        name: node.name,
        isDefaultNode: Boolean(node.isDefaultNode),
        isSecure: Boolean(node.isSecure),
        endpointRoot: node.oshPathRoot || "/sensorhub",
    }));

    const clientDiagnosticsPayload = {
        schemaVersion: SUPPORT_DIAGNOSTICS_SCHEMA_VERSION,
        capturedAt: generatedAt,
        route: sanitizedRoute,
        environment: collectClientEnvironment(),
        stateSummary: {
            configuredNodeCount: options.stateSummary?.configuredNodeCount ?? sanitizedNodes.length,
            activeViewKey: options.stateSummary?.activeViewKey ?? null,
            viewError: options.stateSummary?.viewError ?? null,
            unreadAlarmCount: options.stateSummary?.unreadAlarmCount ?? null,
            authenticatedUserPresent: options.stateSummary?.authenticatedUserPresent ?? null,
        },
        nodes: sanitizedNodes,
        eventCounts: {
            total: snapshot.events.length,
            byLevel: countsByLevel,
            byCategory: countsByCategory,
        },
        redactionsApplied: totalClientRedactions,
        events: snapshot.events,
    };

    const backendIncluded = backendEntries !== null;
    const bundleSource: "combined" | "client-only" = backendIncluded ? "combined" : "client-only";
    const backendSummary = backendEntries ? safeParseJsonObject(backendEntries["summary.json"]) : null;
    const backendRedactionReport = backendEntries
        ? safeParseJsonObject(backendEntries["redaction-report.json"])
        : null;

    const oscarVersion = (backendSummary && typeof backendSummary.oscarVersion === "string")
        ? backendSummary.oscarVersion
        : "3.11.15";

    const combinedSummary: Record<string, unknown> = {
        schemaVersion: SUPPORT_DIAGNOSTICS_SCHEMA_VERSION,
        bundleType: "oscar-support-bundle",
        bundleSource,
        backendIncluded,
        generatedAt,
        oscarVersion,
        ...(backendFetchError ? {
            backendFetchError,
            serverCliFallback: {
                linux: "./oscar.sh support-bundle",
                windows: "oscar.bat support-bundle",
            },
        } : {}),
        client: {
            route: sanitizedRoute,
            diagnosticEventCount: snapshot.events.length,
            errorCount: countsByLevel.error,
            warnCount: countsByLevel.warn,
            redactionsApplied: totalClientRedactions,
        },
        ...(backendSummary ? {backend: backendSummary} : {}),
    };

    const backendTotalRedactions = (() => {
        const counts = backendRedactionReport?.counts;
        if (counts && typeof counts === "object" && !Array.isArray(counts)) {
            const total = (counts as Record<string, unknown>).totalRedactions;
            if (typeof total === "number" && Number.isFinite(total)) return total;
        }
        return 0;
    })();

    const mergedRedactionReport: Record<string, unknown> = {
        schemaVersion: SUPPORT_DIAGNOSTICS_SCHEMA_VERSION,
        generatedAt,
        policy: "automatic-edge-redaction",
        bundleSource,
        neverCollected: [
            "passwords",
            "Authorization headers",
            "session cookies (OSCAR_SESSION / JSESSIONID)",
            "RTSP / HTTP URI userinfo credentials",
            "/run/secrets/*",
            "tls/*.key",
        ],
        clientRedactions: totalClientRedactions,
        backendRedactions: backendTotalRedactions,
        totalRedactions: totalClientRedactions + backendTotalRedactions,
        ...(backendRedactionReport ? {backendReport: backendRedactionReport} : {}),
    };

    const zipInput: Zippable = {
        "summary.json": strToU8(`${JSON.stringify(combinedSummary, null, 2)}\n`),
        "redaction-report.json": strToU8(`${JSON.stringify(mergedRedactionReport, null, 2)}\n`),
        "client/client-diagnostics.json": strToU8(`${JSON.stringify(clientDiagnosticsPayload, null, 2)}\n`),
    };

    if (backendEntries) {
        for (const [entryName, entryBytes] of Object.entries(backendEntries)) {
            if (entryName === "summary.json" || entryName === "redaction-report.json") {
                continue;
            }
            zipInput[entryName] = entryBytes;
        }
    }

    const zipBytes = zipSync(zipInput, {level: 6});
    const fileName = backendIncluded
        ? `oscar-support-${tsCompact}.zip`
        : `oscar-client-support-${tsCompact}.zip`;

    if (!options.skipBrowserDownload) {
        triggerBrowserZipDownload(fileName, zipBytes);
    }

    return {
        fileName,
        zipBytes,
        bundleSource,
        backendIncluded,
        ...(backendFetchError ? {backendFetchError} : {}),
        eventCount: snapshot.events.length,
        clientRedactions: totalClientRedactions,
    };
}
