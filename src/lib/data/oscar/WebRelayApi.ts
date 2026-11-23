/*
 * Copyright (c) 2026. Botts Innovative Research, Inc.
 * All Rights Reserved
 */

export type WebRelayOperatingMode = 'AUTO' | 'PASS_THROUGH' | 'MUTED';

export type WebRelayControlCommand =
    | 'pulse-gamma'
    | 'pulse-neutron'
    | 'pulse-all'
    | 'latch-gamma'
    | 'latch-neutron'
    | 'latch-all'
    | 'silence'
    | 'arm'
    | 'pass-through'
    | 'refresh'
    | 'set-mode';

export interface WebRelayCoilState {
    online: boolean;
    relay1: number;
    relay2: number;
    relay3: number;
    relay4: number;
    latencyMs: number;
    endpointPath: string;
    error: string;
}

export interface LaneWebRelayStatusEntry {
    laneUid: string;
    laneName: string;
    enabled: boolean;
    mode: WebRelayOperatingMode;
    primaryOnline: boolean;
    ancillaryEnabled: boolean;
    ancillaryOnline: boolean;
    // Admin-only fields
    operationalViews?: string[];
    primaryHost?: string;
    primaryPort?: number;
    ancillaryHost?: string;
    ancillaryPort?: number;
    username?: string;
    passwordConfigured?: boolean;
    alarmPulseSeconds?: number;
    suppressExtendedOccupancyGamma?: boolean;
    soundOnNeutronAlarm?: boolean;
    pollIntervalSeconds?: number;
    manualLatchActive?: boolean;
    triggeredAlarmCount?: number;
    suppressedEmlCount?: number;
    suppressedExtendedOccupancyCount?: number;
    lastActionSummary?: string;
    lastActionAt?: string;
    primaryState?: WebRelayCoilState;
    ancillaryState?: WebRelayCoilState;
}

export interface WebRelayStatusPayload {
    isAdmin: boolean;
    lanes: LaneWebRelayStatusEntry[];
}

export interface WebRelayTestConnectionResult {
    ok: boolean;
    host: string;
    port: number;
    endpointPath: string;
    latencyMs: number;
    relay1: number;
    relay2: number;
    relay3: number;
    relay4: number;
}

export interface SaveLaneWebRelayConfigPayload {
    laneUid: string;
    enabled: boolean;
    mode: WebRelayOperatingMode;
    primaryHost: string;
    primaryPort: number;
    ancillaryEnabled: boolean;
    ancillaryHost: string;
    ancillaryPort: number;
    username: string;
    password?: string;
    clearPassword?: boolean;
    alarmPulseSeconds: number;
    suppressExtendedOccupancyGamma: boolean;
    soundOnNeutronAlarm: boolean;
    pollIntervalSeconds: number;
}

export interface WebRelayMutationResponse {
    ok: boolean;
    lane: LaneWebRelayStatusEntry;
    lanes: LaneWebRelayStatusEntry[];
}

const WEBRELAY_BASES = ['/sensorhub/oscar/webrelay', '/oscar/webrelay'];

async function requestWebRelayEndpoint(subpath: string, init?: RequestInit): Promise<Response> {
    let lastResponse: Response | null = null;
    for (const base of WEBRELAY_BASES) {
        const res = await fetch(`${base}${subpath}`, {
            credentials: 'include',
            ...init,
        });
        if (res.status !== 404) {
            return res;
        }
        lastResponse = res;
    }
    return lastResponse as Response;
}

async function parseJsonOrThrow<T>(res: Response, fallbackMsg: string): Promise<T> {
    let data: any = null;
    try {
        data = await res.json();
    } catch {
        // ignore non-JSON body
    }
    if (!res.ok) {
        throw new Error(data?.error || `${fallbackMsg} (HTTP ${res.status})`);
    }
    return data as T;
}

export async function fetchLaneWebRelayStatus(
    options?: { refresh?: boolean; laneUid?: string; signal?: AbortSignal }
): Promise<WebRelayStatusPayload> {
    const params = new URLSearchParams();
    if (options?.refresh) {
        params.set('refresh', 'true');
    }
    if (options?.laneUid) {
        params.set('laneUid', options.laneUid);
    }
    const qs = params.toString();
    const res = await requestWebRelayEndpoint(`/status${qs ? `?${qs}` : ''}`, {
        method: 'GET',
        cache: 'no-store',
        signal: options?.signal,
    });
    return parseJsonOrThrow<WebRelayStatusPayload>(res, 'Unable to load lane WebRelay status');
}

export async function fetchLaneWebRelayStatusSafe(
    options?: { refresh?: boolean; laneUid?: string; signal?: AbortSignal }
): Promise<WebRelayStatusPayload | null> {
    try {
        return await fetchLaneWebRelayStatus(options);
    } catch {
        return null;
    }
}

export async function testLaneWebRelayConnection(params: {
    laneUid?: string;
    host: string;
    port: number;
    username?: string;
    password?: string;
}): Promise<WebRelayTestConnectionResult> {
    const res = await requestWebRelayEndpoint('/action', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'OSCAR-Viewer',
        },
        body: JSON.stringify({
            action: 'test-connection',
            ...params,
        }),
    });
    return parseJsonOrThrow<WebRelayTestConnectionResult>(res, 'WebRelay connection test failed');
}

export async function sendLaneWebRelayControl(params: {
    laneUid: string;
    command: WebRelayControlCommand;
    durationSeconds?: number;
    mode?: WebRelayOperatingMode;
}): Promise<WebRelayMutationResponse> {
    const res = await requestWebRelayEndpoint('/action', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'OSCAR-Viewer',
        },
        body: JSON.stringify({
            action: 'control',
            ...params,
        }),
    });
    return parseJsonOrThrow<WebRelayMutationResponse>(res, 'WebRelay control action failed');
}

export async function saveLaneWebRelayConfig(
    payload: SaveLaneWebRelayConfigPayload
): Promise<WebRelayMutationResponse> {
    const res = await requestWebRelayEndpoint('/action', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'OSCAR-Viewer',
        },
        body: JSON.stringify({
            action: 'save-config',
            ...payload,
        }),
    });
    return parseJsonOrThrow<WebRelayMutationResponse>(res, 'Unable to save lane WebRelay configuration');
}
