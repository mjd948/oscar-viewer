/*
 * Copyright (c) 2026. Botts Innovative Research, Inc.
 * All Rights Reserved
 */

export type UsbBackupMode = 'continual' | 'occasional' | 'disabled' | 'unconfigured';

export type UsbDriveState = 'ATTACHED' | 'SAFE_TO_UNPLUG' | 'DETACHED' | 'UNCONFIGURED';

export type UsbJobState = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface UsbCandidateDrive {
    device: string;
    partition: string;
    model: string;
    transport: string;
    sizeBytes: number;
    sizeHuman: string;
    fstype: string;
    label: string;
    uuid: string;
    mountpoint: string;
    isConfiguredCarrier: boolean;
}

export interface UsbSnapshotMetadata {
    snapshotId: string;
    backupEpochId?: string;
    deploymentId?: string;
    oscarVersion?: string;
    backupMode?: string;
    createdAt: string;
    postgresLsn: string;
    archivePackCount: number;
    statePackCount: number;
    immutableStateFileCount: number;
}

export interface UsbActiveJob {
    requestId: string;
    action: string;
    state: UsbJobState;
    startedAt: string;
    finishedAt?: string;
    requestedBy?: string;
    message?: string;
}

export interface UsbBackupStatusResponse {
    agentActive: boolean;
    hostPlatform?: 'linux' | 'windows' | string;
    updatedAt?: string;
    configured: boolean;
    mode: UsbBackupMode;
    intervalMinutes: number;
    mountPath?: string;
    filesystem?: string;
    fsUuid?: string;
    timerActive?: boolean;
    driveState: UsbDriveState;
    backupKeyPresent: boolean;
    driveTotalBytes?: number;
    driveFreeBytes?: number;
    backupUsedBytes?: number;
    latestSnapshot?: UsbSnapshotMetadata | null;
    candidateDrives: UsbCandidateDrive[];
    activeJob?: UsbActiveJob | null;
}

export type UsbBackupActionPayload =
    | {
          action: 'prepare-drive';
          device?: string;
          adoptUuid?: string;
          noFormat?: boolean;
          confirm?: string;
          filesystem?: 'ntfs' | 'ext4';
          mode?: 'continual' | 'occasional';
          intervalMinutes?: number;
      }
    | {
          action: 'set-mode';
          mode: 'continual' | 'occasional' | 'disabled';
          intervalMinutes: number;
      }
    | {
          action: 'sync';
          quiesce?: boolean;
      }
    | {
          action: 'eject';
          noSync?: boolean;
      }
    | {
          action: 'attach';
      }
    | {
          action: 'verify';
          deep?: boolean;
      }
    | {
          action: 'refresh-status';
      };

const USB_BACKUP_BASES = ['/sensorhub/session/admin/usb-backup', '/session/admin/usb-backup'];

async function requestUsbEndpoint(subpath: string, init?: RequestInit): Promise<Response> {
    let lastResponse: Response | null = null;
    for (const base of USB_BACKUP_BASES) {
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

function normalizeStatusPayload(raw: any): UsbBackupStatusResponse {
    const modeRaw = String(raw?.mode || 'unconfigured').toLowerCase();
    const mode: UsbBackupMode =
        modeRaw === 'continual' || modeRaw === 'occasional' || modeRaw === 'disabled'
            ? modeRaw
            : 'unconfigured';

    const dsRaw = String(raw?.driveState || 'UNCONFIGURED').toUpperCase();
    const driveState: UsbDriveState =
        dsRaw === 'ATTACHED' || dsRaw === 'SAFE_TO_UNPLUG' || dsRaw === 'DETACHED'
            ? dsRaw
            : 'UNCONFIGURED';

    return {
        agentActive: Boolean(raw?.agentActive),
        hostPlatform: raw?.hostPlatform || 'linux',
        updatedAt: raw?.updatedAt || undefined,
        configured: Boolean(raw?.configured),
        mode,
        intervalMinutes: Number(raw?.intervalMinutes || 15),
        mountPath: raw?.mountPath || '',
        filesystem: raw?.filesystem || 'ntfs',
        fsUuid: raw?.fsUuid || '',
        timerActive: Boolean(raw?.timerActive),
        driveState,
        backupKeyPresent: Boolean(raw?.backupKeyPresent),
        driveTotalBytes: Number(raw?.driveTotalBytes || 0),
        driveFreeBytes: Number(raw?.driveFreeBytes || 0),
        backupUsedBytes: Number(raw?.backupUsedBytes || 0),
        latestSnapshot: raw?.latestSnapshot && typeof raw.latestSnapshot === 'object' ? raw.latestSnapshot : null,
        candidateDrives: Array.isArray(raw?.candidateDrives) ? raw.candidateDrives.flat() : [],
        activeJob: raw?.activeJob && typeof raw.activeJob === 'object' ? raw.activeJob : null,
    };
}

export async function fetchUsbBackupStatus(signal?: AbortSignal): Promise<UsbBackupStatusResponse> {
    const response = await requestUsbEndpoint('/status', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal,
    });
    let payload: any = null;
    try {
        payload = await response.json();
    } catch {
        payload = null;
    }
    if (!response.ok) {
        throw new Error(payload?.error || `Failed loading USB backup status (HTTP ${response.status})`);
    }
    return normalizeStatusPayload(payload);
}

export async function submitUsbBackupAction(actionPayload: UsbBackupActionPayload): Promise<UsbBackupStatusResponse> {
    const response = await requestUsbEndpoint('/action', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(actionPayload),
    });
    let payload: any = null;
    try {
        payload = await response.json();
    } catch {
        payload = null;
    }
    if (!response.ok) {
        throw new Error(payload?.error || `USB backup operation failed (HTTP ${response.status})`);
    }
    return normalizeStatusPayload(payload);
}

export async function downloadUsbBackupEscrowKey(): Promise<{ filename: string; content: string }> {
    const response = await requestUsbEndpoint('/backup-key', {
        method: 'POST',
        headers: {
            Accept: 'text/plain, application/json',
            'Content-Type': 'application/json',
        },
        body: '{}',
    });
    if (!response.ok) {
        let errMessage = `Backup key download failed (HTTP ${response.status})`;
        try {
            const errJson = await response.json();
            if (errJson?.error) {
                errMessage = errJson.error;
            }
        } catch {
            // ignore non-JSON body
        }
        throw new Error(errMessage);
    }
    const content = await response.text();
    return {
        filename: 'oscar-backup-key.txt',
        content,
    };
}
