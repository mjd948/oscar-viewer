/*
 * Copyright (c) 2026. Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import { CargoUffAdminStatus } from '@/lib/data/oscar/CargoUffApi';

export type ExtensionDomain =
    | 'ocr'
    | 'maps'
    | 'spectroscopy'
    | 'trusted-certs'
    | 'policy-packs'
    | 'eml'
    | 'uff';

export interface OcrExtensionStatus {
    activeSource: 'builtin' | 'custom' | string;
    customActive: boolean;
    packageKind: string;
    fileName: string;
    sha256: string;
    engineId: string;
    versionId: string;
    fastRoiSupported: boolean;
    plateRuleSetId: string;
    plateRuleDescription: string;
    modelFiles: string[];
    loadedAt: string;
    lastError: string;
}

export interface PmTilesHeaderInfo {
    specVersion: number;
    tileType: 'mvt' | 'png' | 'jpeg' | 'webp' | 'avif' | string;
    tileTypeCode: number;
    tileCompression: string;
    minZoom: number;
    maxZoom: number;
    minLon: number;
    minLat: number;
    maxLon: number;
    maxLat: number;
    centerZoom: number;
    centerLon: number;
    centerLat: number;
    addressedTilesCount: number;
    tileEntriesCount: number;
}

export interface StoredMapPackInfo {
    fileName: string;
    displayName: string;
    sizeBytes: number;
    sha256: string;
    header: PmTilesHeaderInfo | null;
    uploadedAt: string;
}

export interface OfflineMapsAdminStatus {
    activeSource: 'builtin' | 'custom' | string;
    customActive: boolean;
    builtinDefaultLabel: string;
    activeFileName: string;
    displayName: string;
    defaultBasemap: boolean;
    sizeBytes: number;
    sha256: string;
    activatedAt: string;
    header: PmTilesHeaderInfo | null;
    tileUrl: string;
    storedPacks: StoredMapPackInfo[];
    lastError: string;
}

export interface ActiveOfflineMapInfo {
    active: boolean;
    fileName?: string;
    displayName?: string;
    defaultBasemap?: boolean;
    sizeBytes?: number;
    tileUrl?: string;
    tileType?: 'mvt' | 'png' | 'jpeg' | 'webp' | 'avif' | string;
    tileCompression?: string;
    minZoom?: number;
    maxZoom?: number;
    bounds?: [[number, number], [number, number]];
    center?: { lat: number; lon: number; zoom: number };
}

export interface SpectroscopyExtensionStatus {
    activeSource: 'builtin' | 'custom' | string;
    customActive: boolean;
    packageKind: string;
    fileName: string;
    sha256: string;
    algorithmId: string;
    versionId: string;
    executionMode: 'fallback' | 'override' | 'webid-primary' | string;
    isotopeCount: number;
    loadedAt: string;
    lastError: string;
}

export interface TrustedCertEntry {
    id: string;
    fileName: string;
    subject: string;
    issuer: string;
    serialHex: string;
    notBefore: string;
    notAfter: string;
    sha256Fingerprint: string;
    caCertificate: boolean;
}

export interface TrustedCertsExtensionStatus {
    activeSource: 'builtin' | 'custom' | string;
    customActive: boolean;
    systemTrustedIssuerCount: number;
    customCertificateCount: number;
    customCertificates: TrustedCertEntry[];
    generation: number;
    lastError: string;
}

export interface PolicyCodeEntry {
    code: number;
    label: string;
    labels?: Record<string, string>;
}

export interface ActivePolicyPackInfo {
    packId: string;
    version: string;
    agencyName: string;
    fileName: string;
    sha256: string;
    codes: PolicyCodeEntry[];
    operatorChecklist: string[];
    activatedAt: string;
}

export interface PolicyPacksExtensionStatus {
    activeSource: 'builtin' | 'custom' | string;
    customActive: boolean;
    builtinSummary: string;
    baseConfiguredCount: number;
    effectiveCustomCodes: Array<{ code: number; label: string }>;
    activePack: ActivePolicyPackInfo | null;
    lastError: string;
}

export interface EmlExtensionStatus {
    loaded: boolean;
    customActive: boolean;
    activeSource: string;
    fileName: string;
    sha256: string;
    versionId: string;
    collimatedModelId: string;
    uncollimatedModelId: string;
    loadedAt: string;
    lastError: string;
}

export interface RuntimeExtensionsFullStatus {
    ocr: OcrExtensionStatus;
    maps: OfflineMapsAdminStatus;
    spectroscopy: SpectroscopyExtensionStatus;
    trustedCerts: TrustedCertsExtensionStatus;
    policyPacks: PolicyPacksExtensionStatus;
    eml: EmlExtensionStatus;
    uff?: CargoUffAdminStatus;
}

const EXTENSIONS_BASES = ['/sensorhub/oscar/extensions', '/oscar/extensions'];

async function requestExtensionsEndpoint(subpath: string, init?: RequestInit): Promise<Response> {
    let lastResponse: Response | null = null;
    for (const base of EXTENSIONS_BASES) {
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
        // non-json error fallback
    }
    if (!res.ok) {
        throw new Error(data?.error || `${fallbackMsg} (HTTP ${res.status})`);
    }
    return data as T;
}

export async function fetchRuntimeExtensionsStatus(): Promise<RuntimeExtensionsFullStatus> {
    const res = await requestExtensionsEndpoint('/status', {
        method: 'GET',
        cache: 'no-store',
    });
    return parseJsonOrThrow<RuntimeExtensionsFullStatus>(res, 'Unable to load runtime extensions status');
}

export async function fetchActiveOfflineMapInfo(): Promise<ActiveOfflineMapInfo> {
    try {
        const res = await requestExtensionsEndpoint('/maps/active', {
            method: 'GET',
            cache: 'no-store',
        });
        if (!res.ok) {
            return { active: false };
        }
        const data = await res.json();
        return data && typeof data.active === 'boolean' ? (data as ActiveOfflineMapInfo) : { active: false };
    } catch {
        return { active: false };
    }
}

export async function submitRuntimeExtensionAction(
    domain: ExtensionDomain,
    payload: Record<string, unknown>
): Promise<RuntimeExtensionsFullStatus> {
    const res = await requestExtensionsEndpoint(`/${domain}/action`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'OSCAR-Viewer',
        },
        body: JSON.stringify(payload),
    });
    return parseJsonOrThrow<RuntimeExtensionsFullStatus>(res, `Runtime extension action failed on ${domain}`);
}

export function uploadRuntimeExtensionWithProgress(
    domain: ExtensionDomain,
    file: File,
    extraParams?: Record<string, string>,
    onProgress?: (percent: number | null) => void
): Promise<RuntimeExtensionsFullStatus> {
    return new Promise((resolve, reject) => {
        const params = new URLSearchParams({ filename: file.name, ...(extraParams ?? {}) });
        const url = `${EXTENSIONS_BASES[0]}/${domain}/upload?${params.toString()}`;

        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.withCredentials = true;
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.setRequestHeader('X-Requested-With', 'OSCAR-Viewer');
        xhr.setRequestHeader('X-File-Name', file.name);

        if (xhr.upload && onProgress) {
            xhr.upload.onprogress = (evt: ProgressEvent) => {
                if (evt.lengthComputable && evt.total > 0) {
                    onProgress(Math.min(100, Math.round((evt.loaded / evt.total) * 100)));
                } else {
                    onProgress(null);
                }
            };
        }

        xhr.onload = () => {
            let parsed: any = null;
            try {
                parsed = JSON.parse(xhr.responseText || '{}');
            } catch {
                // ignore parse error
            }
            if (xhr.status >= 200 && xhr.status < 300 && parsed) {
                resolve(parsed as RuntimeExtensionsFullStatus);
            } else {
                reject(new Error(parsed?.error || `Upload failed (HTTP ${xhr.status})`));
            }
        };

        xhr.onerror = () => {
            reject(new Error('Network error while uploading runtime extension package'));
        };

        xhr.send(file);
    });
}

export async function downloadExtensionArtifact(subpath: string, fallbackFileName: string): Promise<void> {
    const res = await requestExtensionsEndpoint(subpath, {
        method: 'GET',
        cache: 'no-store',
    });
    if (!res.ok) {
        let errText = '';
        try {
            const data = await res.json();
            errText = data?.error || '';
        } catch {
            // ignore
        }
        throw new Error(errText || `Download failed (HTTP ${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    try {
        const a = document.createElement('a');
        a.href = url;
        a.download = fallbackFileName;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } finally {
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}
