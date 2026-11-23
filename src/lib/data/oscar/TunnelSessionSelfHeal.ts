/*
 * Copyright (c) 2026. Botts Innovative Research, Inc.
 * All Rights Reserved
 */

export const TUNNEL_RELOAD_STORAGE_KEY = "oscar.tunnelAuthReloadAt";
export const TUNNEL_RELOAD_COOLDOWN_MS = 60_000;
export const TUNNEL_HEARTBEAT_INTERVAL_MS = 5 * 60_000;
export const TUNNEL_VISIBILITY_MIN_GAP_MS = 60_000;

interface TunnelSelfHealState {
    installed: boolean;
    reloadPending: boolean;
    hadAuthenticatedSession: boolean;
    lastProbeAtMs: number;
    heartbeatTimer: number | null;
}

const SELF_HEAL_GLOBAL_KEY = "__oscarTunnelSelfHealState__";

function getSelfHealState(): TunnelSelfHealState {
    const host = globalThis as unknown as Record<string, TunnelSelfHealState | undefined>;
    let existing = host[SELF_HEAL_GLOBAL_KEY];
    if (!existing) {
        existing = {
            installed: false,
            reloadPending: false,
            hadAuthenticatedSession: false,
            lastProbeAtMs: 0,
            heartbeatTimer: null,
        };
        host[SELF_HEAL_GLOBAL_KEY] = existing;
    }
    return existing;
}

function resolveRequestUrl(input: RequestInfo | URL, baseOrigin: string): URL | null {
    try {
        if (typeof input === "string") {
            return new URL(input, baseOrigin);
        }
        if (typeof URL !== "undefined" && input instanceof URL) {
            return input;
        }
        if (typeof Request !== "undefined" && input instanceof Request) {
            return new URL(input.url, baseOrigin);
        }
        return new URL(String(input), baseOrigin);
    } catch {
        return null;
    }
}

export function isLoginPathname(pathname: string): boolean {
    return pathname === "/login" || pathname.startsWith("/login/");
}

export function isSameOriginSensorHubApiUrl(
    input: RequestInfo | URL,
    currentOrigin: string,
): URL | null {
    const parsed = resolveRequestUrl(input, currentOrigin);
    if (!parsed || parsed.origin !== currentOrigin) {
        return null;
    }
    if (!parsed.pathname.startsWith("/sensorhub/")) {
        return null;
    }
    if (
        parsed.pathname.startsWith("/sensorhub/login")
        || parsed.pathname.startsWith("/sensorhub/logout")
    ) {
        return null;
    }
    return parsed;
}

export function hasOcteliumUnauthorizedHeader(headers: Pick<Headers, "get"> | null | undefined): boolean {
    if (!headers || typeof headers.get !== "function") {
        return false;
    }
    const raw = headers.get("x-octelium-unauthorized");
    return typeof raw === "string" && raw.trim().toLowerCase() === "true";
}

export function canAttemptTunnelReload(
    nowMs = Date.now(),
    storage?: Pick<Storage, "getItem" | "setItem"> | null,
    cooldownMs = TUNNEL_RELOAD_COOLDOWN_MS,
): boolean {
    const effectiveStorage = storage ?? (typeof window !== "undefined" ? window.sessionStorage : null);
    if (!effectiveStorage) {
        return true;
    }
    try {
        const prevRaw = effectiveStorage.getItem(TUNNEL_RELOAD_STORAGE_KEY);
        const prevMs = prevRaw ? Number(prevRaw) : NaN;
        if (Number.isFinite(prevMs) && nowMs - prevMs < cooldownMs) {
            return false;
        }
        effectiveStorage.setItem(TUNNEL_RELOAD_STORAGE_KEY, String(nowMs));
        return true;
    } catch {
        return true;
    }
}

export function isTunnelAuthReloadPending(): boolean {
    return getSelfHealState().reloadPending;
}

export interface HandleSameOriginAuthResponseOptions {
    input: RequestInfo | URL;
    response: Pick<Response, "status" | "headers" | "ok">;
    currentOrigin?: string;
    currentPathname?: string;
    nowMs?: number;
    storage?: Pick<Storage, "getItem" | "setItem"> | null;
    reloadFn?: () => void;
}

/**
 * Inspects a same-origin `/sensorhub/*` response and triggers a single loop-guarded
 * top-level browser reload when an Octelium Zero-Trust per-service cookie rotates
 * (`HTTP 401` + `x-octelium-unauthorized: true`) or when an established `/sensorhub/session`
 * cookie expires while on a non-login route.
 */
export function inspectSameOriginAuthResponse({
    input,
    response,
    currentOrigin = typeof window !== "undefined" ? window.location.origin : "",
    currentPathname = typeof window !== "undefined" ? window.location.pathname : "/",
    nowMs = Date.now(),
    storage,
    reloadFn,
}: HandleSameOriginAuthResponseOptions): boolean {
    if (!currentOrigin || isLoginPathname(currentPathname)) {
        return false;
    }
    const targetUrl = isSameOriginSensorHubApiUrl(input, currentOrigin);
    if (!targetUrl) {
        return false;
    }

    const state = getSelfHealState();
    const isSessionProbe = targetUrl.pathname === "/sensorhub/session";
    if (isSessionProbe && response.status === 200) {
        state.hadAuthenticatedSession = true;
        return false;
    }

    if (response.status !== 401) {
        return false;
    }

    const tunnelCookieExpired = hasOcteliumUnauthorizedHeader(response.headers);
    const establishedSessionExpired = isSessionProbe && state.hadAuthenticatedSession;
    if (!tunnelCookieExpired && !establishedSessionExpired) {
        return false;
    }

    if (state.reloadPending) {
        return true;
    }
    if (!canAttemptTunnelReload(nowMs, storage)) {
        return false;
    }

    state.reloadPending = true;
    const triggerReload = reloadFn ?? (() => {
        if (typeof window !== "undefined") {
            window.location.reload();
        }
    });
    triggerReload();
    return true;
}

export async function probeTunnelSessionOnce(
    fetchImpl: typeof fetch = typeof window !== "undefined" ? window.fetch.bind(window) : fetch,
): Promise<void> {
    if (typeof window === "undefined" || isLoginPathname(window.location.pathname)) {
        return;
    }
    const state = getSelfHealState();
    if (state.reloadPending) {
        return;
    }
    state.lastProbeAtMs = Date.now();
    try {
        const res = await fetchImpl("/sensorhub/session", {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {Accept: "application/json"},
        });
        inspectSameOriginAuthResponse({
            input: "/sensorhub/session",
            response: res,
        });
    } catch {
        // Network offline/transient blip: leave current view intact and retry on next heartbeat.
    }
}

export function resetTunnelSelfHealStateForTesting(): void {
    const state = getSelfHealState();
    if (state.heartbeatTimer !== null && typeof window !== "undefined") {
        window.clearInterval(state.heartbeatTimer);
    }
    state.installed = false;
    state.reloadPending = false;
    state.hadAuthenticatedSession = false;
    state.lastProbeAtMs = 0;
    state.heartbeatTimer = null;
}

/**
 * Installs an idempotent same-origin `window.fetch` interceptor and 5-minute passive
 * wallboard liveness heartbeat so 24/7 Octelium Zero-Trust browser tabs automatically
 * rotate expired 4-hour service cookies via a top-level HTML navigation instead of
 * stalling background `fetch()` / WebSocket calls with `HTTP 401`.
 */
export function installTunnelSessionSelfHeal(): void {
    if (typeof window === "undefined" || typeof window.fetch !== "function") {
        return;
    }
    const state = getSelfHealState();
    if (state.installed) {
        return;
    }
    state.installed = true;

    const origFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const response = await origFetch(input, init);
        try {
            inspectSameOriginAuthResponse({input, response});
        } catch {
            // Never disrupt application fetch pipeline.
        }
        return response;
    };

    state.heartbeatTimer = window.setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
            return;
        }
        void probeTunnelSessionOnce(window.fetch);
    }, TUNNEL_HEARTBEAT_INTERVAL_MS);

    if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState !== "visible") {
                return;
            }
            if (Date.now() - state.lastProbeAtMs >= TUNNEL_VISIBILITY_MIN_GAP_MS) {
                void probeTunnelSessionOnce(window.fetch);
            }
        });
    }
}
