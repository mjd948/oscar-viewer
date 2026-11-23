export interface SystemUpdateReleaseInfo {
    checkedAt: string;
    requiresGitHubLogin: boolean;
    latestVersion: string;
    currentVersion: string;
    tagName: string;
    releaseTitle: string;
    publishedAt?: string;
    notesSummary?: string;
    releasePageUrl: string;
    assetFileName: string;
    downloadUrl: string;
    assetAvailable: boolean;
    expectedSha256?: string;
    downloadBytes?: number;
    fromCache?: boolean;
    comparison: number;
    updateAvailable: boolean;
    upToDate: boolean;
    inPlaceCompatible: boolean;
}

export interface SystemUpdateStagedBundle {
    fileName: string;
    sizeBytes: number;
    stagedAt: string;
    sha256?: string;
    version?: string;
}

export interface SystemUpdateActiveJob {
    requestId: string;
    action: string;
    state: string;
    stage?: string;
    progressPercent?: number;
    targetVersion?: string;
    message?: string;
    startedAt?: string;
    updatedAt?: string;
}

export interface SystemUpdateStatusResponse {
    agentActive: boolean;
    guiUpdateEnabled: boolean;
    sandboxMode: boolean;
    requiresGitHubLogin: boolean;
    backupPossible?: boolean;
    state: 'IDLE' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'ROLLED_BACK' | 'FAILED' | string;
    stage: string;
    progressPercent: number;
    currentVersion: string;
    targetVersion?: string;
    releaseDir?: string;
    availableDiskGib: number;
    updatedAt?: string;
    message?: string;
    logTail?: string;
    activeJob?: SystemUpdateActiveJob;
    stagedBundle?: SystemUpdateStagedBundle;
    latestRelease?: SystemUpdateReleaseInfo;
    linuxCheckCommand: string;
    linuxUpgradeCommand: string;
    linuxEnableBridgeCommand: string;
    windowsCheckCommand: string;
    windowsUpgradeCommand: string;
    windowsEnableBridgeCommand: string;
    error?: string;
    offlineUploadAvailable?: boolean;
    stagedOnly?: boolean;
    stagedVersion?: string;
    stagedSha256?: string;
    stagedFileName?: string;
}

export class SystemUpdateOfflineError extends Error {
    readonly statusPayload?: SystemUpdateStatusResponse;

    constructor(message: string, statusPayload?: SystemUpdateStatusResponse) {
        super(message);
        this.name = 'SystemUpdateOfflineError';
        this.statusPayload = statusPayload;
    }
}

export class SystemUpdateRestartingError extends Error {
    readonly httpStatus: number;

    constructor(httpStatus: number) {
        super(`Gateway restarting (HTTP ${httpStatus})`);
        this.name = 'SystemUpdateRestartingError';
        this.httpStatus = httpStatus;
    }
}

const BASE_PATH = '/sensorhub/oscar/system-update';

export async function fetchSystemUpdateStatus(): Promise<SystemUpdateStatusResponse> {
    let res: Response;
    try {
        res = await fetch(`${BASE_PATH}/status`, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
            headers: { Accept: 'application/json' },
        });
    } catch {
        throw new SystemUpdateRestartingError(0);
    }

    if (res.status === 502 || res.status === 503 || res.status === 504) {
        throw new SystemUpdateRestartingError(res.status);
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(body?.error || `HTTP ${res.status}`);
    }
    return body as SystemUpdateStatusResponse;
}

export async function checkGitHubSystemUpdate(force = true): Promise<SystemUpdateStatusResponse> {
    const res = await fetch(`${BASE_PATH}/check`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            Accept: 'application/json',
        },
        body: JSON.stringify({ force }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 502 && body?.offlineUploadAvailable) {
        throw new SystemUpdateOfflineError(
            body.error || 'GitHub Releases unreachable from this portal; use Offline Release .zip Upload.',
            body as SystemUpdateStatusResponse,
        );
    }
    if (!res.ok) {
        throw new Error(body?.error || `Update check failed (HTTP ${res.status})`);
    }
    return body as SystemUpdateStatusResponse;
}

export async function applyGitHubSystemUpdate(options: {
    targetVersion: string;
    expectedSha256?: string;
    createBackupFirst?: boolean;
}): Promise<SystemUpdateStatusResponse> {
    const res = await fetch(`${BASE_PATH}/apply`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            Accept: 'application/json',
        },
        body: JSON.stringify({
            targetVersion: options.targetVersion,
            expectedSha256: options.expectedSha256 || '',
            createBackupFirst: Boolean(options.createBackupFirst),
        }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(body?.error || `Could not start system update (HTTP ${res.status})`);
    }
    return body as SystemUpdateStatusResponse;
}

export async function uploadOfflineReleaseBundle(options: {
    file: File;
    expectedSha256?: string;
    createBackupFirst?: boolean;
    applyImmediately?: boolean;
}): Promise<SystemUpdateStatusResponse> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/zip',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Oscar-Bundle-Filename': options.file.name,
        'X-Oscar-Backup-First': options.createBackupFirst ? 'true' : 'false',
        'X-Oscar-Apply-Immediately': options.applyImmediately !== false ? 'true' : 'false',
        Accept: 'application/json',
    };
    if (options.expectedSha256 && options.expectedSha256.trim()) {
        headers['X-Oscar-Expected-Sha256'] = options.expectedSha256.trim();
    }
    const res = await fetch(`${BASE_PATH}/upload-bundle`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: options.file,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(body?.error || `Bundle upload failed (HTTP ${res.status})`);
    }
    return body as SystemUpdateStatusResponse;
}
