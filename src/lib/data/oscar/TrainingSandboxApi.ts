/*
 * Copyright (c) 2026. Botts Innovative Research, Inc.
 * All Rights Reserved
 */

export type SandboxTrackId = "operator" | "supervisor" | "administrator";

export type SandboxScenarioId =
    | "clean_pass"
    | "gamma_alarm"
    | "neutron_alarm"
    | "gamma_neutron_alarm"
    | "norm_eml"
    | "extended_occupancy"
    | "fault_gamma_high"
    | "fault_tamper"
    | "clear_faults"
    | "stage_webrelay_demo";

export interface SandboxLoopbackEndpoints {
    rapiscanHost: string;
    rapiscanPort1: number;
    rapiscanPort2: number;
    cameraType: string;
    cameraHost: string;
    cameraPath1: string;
    cameraPath2: string;
    rtspUrl1: string;
    rtspLive: boolean;
    containerId1: string;
    containerId2: string;
    plate1: string;
    webRelayHost?: string;
    webRelayPort1?: number;
    webRelayPort2?: number;
    localUffSamplePath: string;
}

export interface SandboxSampleInfo {
    fileName: string;
    label: string;
    usedIn: string;
}

export interface SandboxVerificationSnapshot {
    configuredLaneCount: number;
    onlineLaneCount: number;
    lanesWithCameraCount: number;
    lanesWithOcrCount: number;
    operationalViewCount: number;
    operationalViews?: string[];
    totalOccupancies: number;
    gammaAlarmCount: number;
    neutronAlarmCount: number;
    emlCode9999Count: number;
    extendedCode9998Count: number;
    activeFaultOrTamper: boolean;
    operatorAdjudicatedCount: number;
    adjudicatedWithEvidenceCount: number;
    adjudicatedWithVehicleIdCount: number;
    multiPassVehicleCount: number;
    generatedReportCount: number;
    offlineMapActive: boolean;
    policyPackActive: boolean;
    cargoUffEnabled: boolean;
    cargoUffIndexedCount: number;
    webRelayConfiguredCount?: number;
    webRelayOnlineCount?: number;
}

export interface SandboxActiveStatus {
    sandboxMode: boolean;
    watermark?: string;
    activeTrack?: SandboxTrackId;
    stagingInProgress?: boolean;
    busyOccupancy?: boolean;
    stageStatusMessage?: string;
    startedEpochSeconds?: number;
    expiresEpochSeconds?: number;
    remainingSeconds?: number;
    ttlMinutes?: number;
    archiveEnabled?: boolean;
    loopbackEndpoints?: SandboxLoopbackEndpoints;
    samples?: SandboxSampleInfo[];
    verification?: SandboxVerificationSnapshot;
}

export interface SandboxHostStatus {
    agentActive: boolean;
    sandboxRunning: boolean;
    canStopOrReset?: boolean;
    httpsPort: number;
    ttlMinutes: number;
    expiresAt?: string;
    availableRamMib?: number;
    remoteDomain?: string;
    remoteSandboxUrl?: string;
    linuxStartCommand: string;
    linuxStopCommand: string;
    linuxEnableBridgeCommand: string;
    windowsStartCommand: string;
    windowsStopCommand: string;
    windowsEnableBridgeCommand: string;
    activeJob?: {
        requestId: string;
        action: string;
        state: string;
        startedAt?: string;
        message?: string;
    };
}

export interface SandboxLaunchTarget {
    url: string;
    isRemoteTunnel: boolean;
    badgeLabel: string;
}

export function resolveSandboxLaunchTarget(
    hostStatus?: Pick<SandboxHostStatus, "httpsPort" | "remoteDomain" | "remoteSandboxUrl"> | null,
    locationHostname?: string,
): SandboxLaunchTarget {
    const port = hostStatus?.httpsPort ?? 8444;
    const currentHost = (locationHostname || "").trim();
    const currentLower = currentHost.toLowerCase();
    const remoteDomain = (hostStatus?.remoteDomain || "").trim().toLowerCase();
    const remoteUrl = (hostStatus?.remoteSandboxUrl || "").trim();

    if (
        remoteDomain &&
        remoteUrl.startsWith("https://") &&
        currentLower &&
        (currentLower === remoteDomain || currentLower.endsWith(`.${remoteDomain}`))
    ) {
        try {
            const parsed = new URL(remoteUrl);
            return {
                url: parsed.origin,
                isRemoteTunnel: true,
                badgeLabel: parsed.host,
            };
        } catch {
            // Fall through to direct port target if remoteSandboxUrl is malformed
        }
    }

    const fallbackHost = currentHost || "localhost";
    return {
        url: `https://${fallbackHost}:${port}`,
        isRemoteTunnel: false,
        badgeLabel: `:${port}`,
    };
}

export interface SandboxShutdownSummary {
    remainingMinutes: number | null;
    durationText: string;
    expiresTimeText: string | null;
}

export function computeSandboxShutdownSummary(params: {
    remainingSeconds?: number;
    expiresEpochSeconds?: number;
    expiresAt?: string;
    ttlMinutes?: number;
    nowMs?: number;
}): SandboxShutdownSummary {
    const now = params.nowMs ?? Date.now();
    let targetMs: number | null = null;
    if (typeof params.expiresEpochSeconds === "number" && params.expiresEpochSeconds > 0) {
        targetMs = params.expiresEpochSeconds * 1000;
    } else if (params.expiresAt) {
        const parsed = Date.parse(params.expiresAt);
        if (!Number.isNaN(parsed)) {
            targetMs = parsed;
        }
    }

    let remainingMin: number | null = null;
    if (typeof params.remainingSeconds === "number") {
        remainingMin = Math.max(1, Math.ceil(params.remainingSeconds / 60));
    } else if (targetMs !== null) {
        remainingMin = Math.max(1, Math.ceil((targetMs - now) / 60_000));
    }

    const fallbackMin = params.ttlMinutes ?? 120;
    const mins = remainingMin ?? fallbackMin;
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    const durationText = hours > 0 ? (rem > 0 ? `${hours}h ${rem}m` : `${hours}h`) : `${mins}m`;

    let expiresTimeText: string | null = null;
    if (targetMs !== null) {
        try {
            expiresTimeText = new Date(targetMs).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            expiresTimeText = params.expiresAt ?? null;
        }
    }

    return {
        remainingMinutes: remainingMin,
        durationText,
        expiresTimeText,
    };
}

export interface CompletedLabSubmission {
    trackId: string;
    labId: string;
    title: string;
    status: "verified" | "completed";
}

export const SANDBOX_WATERMARK_TEXT = "TRAINING SANDBOX — NON-OPERATIONAL";

export const OSCAR_SANDBOX_TELEMETRY_EVENT = "oscar:sandbox-telemetry-mutated";
export const OSCAR_SANDBOX_EVENTS_EVENT = "oscar:sandbox-events-mutated";
export const OSCAR_SANDBOX_LANES_EVENT = "oscar:sandbox-lanes-changed";

export function dispatchSandboxRefreshEvents(opts: {
    telemetry?: boolean;
    events?: boolean;
    lanes?: boolean;
    resetForSandboxInjection?: boolean;
}): void {
    if (typeof window === "undefined") return;
    if (opts.lanes) {
        window.dispatchEvent(new CustomEvent(OSCAR_SANDBOX_LANES_EVENT));
    }
    if (opts.telemetry) {
        window.dispatchEvent(new CustomEvent(OSCAR_SANDBOX_TELEMETRY_EVENT));
    }
    if (opts.events) {
        window.dispatchEvent(
            new CustomEvent(OSCAR_SANDBOX_EVENTS_EVENT, {
                detail: { resetForSandboxInjection: Boolean(opts.resetForSandboxInjection) },
            }),
        );
    }
}

let runtimeSandboxActiveFlag = false;

export function isTrainingSandboxRuntimeActive(): boolean {
    return runtimeSandboxActiveFlag;
}

export function setTrainingSandboxRuntimeActiveForTests(active: boolean): void {
    runtimeSandboxActiveFlag = active;
}

const SANDBOX_BASE = "/sensorhub/oscar/sandbox";

export async function fetchSandboxActiveStatus(signal?: AbortSignal): Promise<SandboxActiveStatus> {
    const response = await fetch(`${SANDBOX_BASE}/active`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal,
    });
    if (!response.ok) {
        return { sandboxMode: false };
    }
    const parsed = (await response.json()) as SandboxActiveStatus;
    runtimeSandboxActiveFlag = Boolean(parsed?.sandboxMode);
    return parsed;
}

export async function injectSandboxScenario(
    scenario: SandboxScenarioId,
    laneSlot: 1 | 2 = 1,
): Promise<{ ok: boolean; message: string }> {
    const response = await fetch(`${SANDBOX_BASE}/inject`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ scenario, laneSlot }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : `Scenario injection failed (${response.status})`);
    }
    return payload;
}

export async function stageSandboxTrack(track: SandboxTrackId): Promise<SandboxActiveStatus> {
    const response = await fetch(`${SANDBOX_BASE}/stage-track`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ track }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : `Track staging failed (${response.status})`);
    }
    runtimeSandboxActiveFlag = Boolean(payload?.sandboxMode);
    return payload as SandboxActiveStatus;
}

export function buildSandboxSampleDownloadUrl(fileName: string): string {
    return `${SANDBOX_BASE}/samples/${encodeURIComponent(fileName)}`;
}

export async function downloadTrainingCertificatePdf(
    traineeName: string,
    completedLabs: CompletedLabSubmission[],
): Promise<void> {
    const response = await fetch(`${SANDBOX_BASE}/certificate`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ traineeName, completedLabs }),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(typeof err?.error === "string" ? err.error : `Certificate download failed (${response.status})`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    try {
        const a = document.createElement("a");
        a.href = url;
        a.download = "oscar-training-completion-record.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
    } finally {
        setTimeout(() => URL.revokeObjectURL(url), 2_000);
    }
}

export async function fetchSandboxHostStatus(signal?: AbortSignal): Promise<SandboxHostStatus | null> {
    const response = await fetch(`${SANDBOX_BASE}/host`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal,
    });
    if (!response.ok) {
        return null;
    }
    return (await response.json()) as SandboxHostStatus;
}

export async function submitSandboxHostAction(
    action: "start" | "stop" | "reset" | "refresh-status",
    httpsPort = 8444,
    ttlMinutes = 120,
): Promise<SandboxHostStatus> {
    const response = await fetch(`${SANDBOX_BASE}/host`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ action, httpsPort, ttlMinutes }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : `Host sandbox command failed (${response.status})`);
    }
    return payload as SandboxHostStatus;
}
