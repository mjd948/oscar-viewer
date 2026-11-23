/*
 * Copyright (c) 2026. Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import { INode } from '@/lib/data/osh/Node';

export interface HemdZMapBand {
    name: string;
    paletteStart: number;
    paletteEnd: number;
    effectiveZStart: number;
    effectiveZEnd: number;
}

export interface XRayFileInfo {
    fileId: string;
    entryPath: string;
    sizeBytes: number;
    view: string;
    modality: string;
    scanningMode: string;
    energiesMeV: number[];
    horizontalPixelSizeMm?: number | null;
    verticalPixelSizeMm?: number | null;
    averageSpeedMmPerSec?: number | null;
    hemdEntryPath: string;
    hemdSizeBytes: number;
    zMaps: HemdZMapBand[];
}

export interface UffOcrResultInfo {
    ocrType: string;
    value: string;
    normalizedValue: string;
    confidence?: number | null;
    plateLocation: string;
    view: string;
    imageEntryPath: string;
    containerType: string;
}

export interface UffDeclarationInfo {
    customsId: string;
    consignorName: string;
    consignorLocation: string;
    consigneeName: string;
    consigneeLocation: string;
    hsCode: string;
    goodsDescription: string;
    unit: string;
    quantity?: number | null;
}

export interface UffAnnotationInfo {
    annotationId: string;
    description: string;
    comment: string;
    confidence?: number | null;
    fileUri: string;
    shape: string;
    top: number;
    left: number;
    bottom: number;
    right: number;
}

export interface UffRadiationFileInfo {
    fileId: string;
    entryPath: string;
    sizeBytes: number;
    type: string;
}

export interface UffCaseMetadata {
    uffUuid: string;
    uffVersion: string;
    archiveFileName: string;
    relativePath: string;
    archiveSizeBytes: number;
    archiveMtimeMillis: number;
    scannerId: string;
    scannerManufacturer: string;
    scannerModel: string;
    scannerSerial: string;
    scannerCaseId: string;
    country: string;
    latitude?: number | null;
    longitude?: number | null;
    scanTimestamp: string;
    scanEpochMillis: number;
    scanDurationMs?: number | null;
    containerNum: string;
    frontPlateNum: string;
    vehicleType: string;
    containerWeightKg?: number | null;
    vehicleWeightKg?: number | null;
    containerLengthFt?: number | null;
    allNormalizedVehicleIds: string[];
    allDisplayVehicleIds: string[];
    ocrResults: UffOcrResultInfo[];
    declaration?: UffDeclarationInfo | null;
    manifestEntryPath: string;
    manifestSizeBytes: number;
    radiationFiles: UffRadiationFileInfo[];
    xrayFiles: XRayFileInfo[];
    analysisAssessment: string;
    analysisResult: string;
    analysisAlgorithmName: string;
    analysisVendor: string;
    annotations: UffAnnotationInfo[];
    previewEntryPath: string;
    previewSizeBytes: number;
}

export interface UffSearchMatch {
    uffUuid: string;
    uffVersion: string;
    archiveFileName: string;
    relativePath: string;
    archiveSizeBytes: number;
    scannerId: string;
    scannerManufacturer: string;
    scannerModel: string;
    scanTimestamp: string;
    scanEpochMillis: number;
    containerNum: string;
    frontPlateNum: string;
    displayVehicleIds: string[];
    hsCode: string;
    goodsDescription: string;
    containerWeightKg?: number | null;
    hasPreview: boolean;
    hasHemd: boolean;
    hasManifestPdf: boolean;
    hasRadiationN42: boolean;
    annotationCount: number;
    analysisResult: string;
    fuzzyMatch: boolean;
    matchedIdentifier: string;
    timeDeltaSeconds?: number | null;
}

export interface CargoUffAdminStatus {
    enabled: boolean;
    customActive: boolean;
    activeSource: 'disabled' | 'custom' | string;
    sourceType: 'smb' | 'local' | string;
    shareUrl: string;
    subPath: string;
    localPath: string;
    domain: string;
    username: string;
    passwordConfigured: boolean;
    correlationWindowMinutes: number;
    allowFuzzyOcrMatch: boolean;
    updatedAt: string;
    indexedCount: number;
    uff2Count: number;
    uff3Count: number;
    scanners: string[];
    lastRefreshAt: string;
    lastRefreshDurationMs: number;
    lastError: string;
}

export interface ActiveCargoUffInfo {
    enabled: boolean;
    sourceType?: string;
    correlationWindowMinutes?: number;
    allowFuzzyOcrMatch?: boolean;
    indexedCount?: number;
    scanners?: string[];
    lastRefreshAt?: string;
    lastError?: string;
}

export interface CargoUffSearchResponse {
    enabled: boolean;
    matches: UffSearchMatch[];
    totalIndexed?: number;
    scanners: string[];
    lastError?: string;
}

export interface StagedCargoUffResult {
    ok: boolean;
    uffUuid: string;
    referenceKey: string;
    referenceUri: string;
    manifestUri: string;
    n42Uri: string;
    n42FileName: string;
    n42ContentBase64: string;
    stagedUris: string[];
    caseMetadata: UffCaseMetadata;
}

export interface CargoUffConnectionTestResult {
    ok: boolean;
    sourceType: string;
    target: string;
    discoveredUffCount: number;
    latencyMs: number;
    sampleUffUuid?: string;
    sampleUffVersion?: string;
    sampleScannerId?: string;
}

const UUID_REGEX = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
const ACTIVE_CACHE_TTL_MS = 30_000;

interface CachedActiveEntry {
    expiresAt: number;
    promise: Promise<ActiveCargoUffInfo>;
}

const activeCacheByBase = new Map<string, CachedActiveEntry>();

export function invalidateCargoUffActiveCache(): void {
    activeCacheByBase.clear();
}

export function isCargoUffAttachmentPath(rawPath: string | null | undefined): boolean {
    if (!rawPath) return false;
    const clean = rawPath.trim().split(/[?#]/, 1)[0]?.toLowerCase() ?? '';
    return clean.endsWith('.uff') || clean.endsWith('.uffref.json');
}

/**
 * Extracts a lowercase UFF UUID when an operator pastes a raw UUID, `<uuid>.uff` filename,
 * `uff-link-<uuid>.uffref.json`, Windows UNC path (`\\nas\uff\2026\11\20\SCANNER\<uuid>.uff`),
 * mapped drive path (`Z:\2026\11\20\...`), or POSIX path.
 */
export function extractUffUuidFromOmniboxInput(raw: string | null | undefined): string {
    if (!raw) return '';
    const trimmed = raw.trim();
    if (!trimmed) return '';
    const lower = trimmed.toLowerCase();
    const looksLikeUffOrUuid =
        lower.endsWith('.uff') ||
        lower.endsWith('.uffref.json') ||
        lower.includes('\\') ||
        lower.includes('/') ||
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
    if (!looksLikeUffOrUuid) return '';

    const normalized = trimmed.replace(/\\/g, '/');
    const leaf = normalized.slice(normalized.lastIndexOf('/') + 1);
    const match = UUID_REGEX.exec(leaf);
    return match ? match[1].toLowerCase() : '';
}

function resolveUffServletBase(node?: INode | null): string {
    if (!node || !node.address) {
        return '/sensorhub/oscar/extensions/uff';
    }
    const protocol = node.isSecure ? 'https://' : 'http://';
    const portSuffix = node.port ? `:${node.port}` : '';
    const root = (node.oshPathRoot || '/sensorhub').replace(/\/+$/, '');
    if (typeof window !== 'undefined') {
        const sameHost = window.location.hostname === node.address;
        const winPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
        const nodePort = String(node.port || (node.isSecure ? 443 : 80));
        if (sameHost && winPort === nodePort) {
            return `${root}/oscar/extensions/uff`;
        }
    }
    return `${protocol}${node.address}${portSuffix}${root}/oscar/extensions/uff`;
}

function buildAuthHeaders(node?: INode | null, extra?: Record<string, string>): HeadersInit {
    const base: Record<string, string> = { ...(extra || {}) };
    if (node && typeof node.getBasicAuthHeader === 'function') {
        const nodeHeaders = node.getBasicAuthHeader() as Record<string, string> | undefined;
        if (nodeHeaders) {
            Object.assign(base, nodeHeaders);
        }
    }
    return base;
}

export async function fetchActiveCargoUffInfo(
    node?: INode | null,
    fetchImpl: typeof fetch = fetch,
): Promise<ActiveCargoUffInfo> {
    const base = resolveUffServletBase(node);
    const useCache = fetchImpl === fetch;
    const now = Date.now();
    if (useCache) {
        const cached = activeCacheByBase.get(base);
        if (cached && cached.expiresAt > now) {
            return cached.promise;
        }
    }
    const promise = (async (): Promise<ActiveCargoUffInfo> => {
        try {
            const resp = await fetchImpl(`${base}/active`, {
                method: 'GET',
                credentials: 'include',
                headers: buildAuthHeaders(node, { Accept: 'application/json' }),
            });
            if (!resp.ok) {
                return { enabled: false };
            }
            const parsed = (await resp.json()) as Partial<ActiveCargoUffInfo> | null;
            return {
                ...(parsed || {}),
                enabled: Boolean(parsed?.enabled),
            };
        } catch {
            return { enabled: false };
        }
    })();
    if (useCache) {
        activeCacheByBase.set(base, { expiresAt: now + ACTIVE_CACHE_TTL_MS, promise });
    }
    return promise;
}

export async function searchCargoUff(
    params: {
        uffId?: string;
        vehicleId?: string;
        scannerId?: string;
        nearTime?: string;
        windowMinutes?: number;
        fuzzy?: boolean;
        limit?: number;
    },
    node?: INode | null,
    signal?: AbortSignal,
    fetchImpl: typeof fetch = fetch,
): Promise<CargoUffSearchResponse> {
    const base = resolveUffServletBase(node);
    const qs = new URLSearchParams();
    if (params.uffId) qs.set('uffId', params.uffId);
    if (params.vehicleId) qs.set('vehicleId', params.vehicleId);
    if (params.scannerId) qs.set('scannerId', params.scannerId);
    if (params.nearTime) qs.set('nearTime', params.nearTime);
    if (typeof params.windowMinutes === 'number') qs.set('windowMinutes', String(params.windowMinutes));
    if (typeof params.fuzzy === 'boolean') qs.set('fuzzy', String(params.fuzzy));
    if (typeof params.limit === 'number') qs.set('limit', String(params.limit));

    const resp = await fetchImpl(`${base}/search?${qs.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: buildAuthHeaders(node, { Accept: 'application/json' }),
        signal,
    });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Cargo UFF search failed (HTTP ${resp.status})`);
    }
    return (await resp.json()) as CargoUffSearchResponse;
}

export async function fetchCargoUffCase(
    params: { uffUuid?: string; bucketKey?: string },
    node?: INode | null,
    signal?: AbortSignal,
): Promise<UffCaseMetadata> {
    const base = resolveUffServletBase(node);
    const qs = new URLSearchParams();
    if (params.uffUuid) qs.set('uffUuid', params.uffUuid);
    if (params.bucketKey) qs.set('bucketKey', params.bucketKey);

    const resp = await fetch(`${base}/case?${qs.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: buildAuthHeaders(node, { Accept: 'application/json' }),
        signal,
    });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Cargo UFF package lookup failed (HTTP ${resp.status})`);
    }
    return (await resp.json()) as UffCaseMetadata;
}

export function buildCargoUffEntryUrl(
    params: { uffUuid?: string; bucketKey?: string; entry: string },
    node?: INode | null,
): string {
    const base = resolveUffServletBase(node);
    const qs = new URLSearchParams();
    if (params.uffUuid) qs.set('uffUuid', params.uffUuid);
    if (params.bucketKey) qs.set('bucketKey', params.bucketKey);
    qs.set('entry', params.entry);
    return `${base}/entry?${qs.toString()}`;
}

export async function fetchCargoUffEntryBytes(
    params: { uffUuid?: string; bucketKey?: string; entry: string },
    node?: INode | null,
    signal?: AbortSignal,
): Promise<Uint8Array> {
    const url = buildCargoUffEntryUrl(params, node);
    const resp = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: buildAuthHeaders(node),
        signal,
    });
    if (!resp.ok) {
        throw new Error(`Failed streaming UFF entry '${params.entry}' (HTTP ${resp.status})`);
    }
    const buf = await resp.arrayBuffer();
    return new Uint8Array(buf);
}

export async function fetchCargoUffEntryBlobUrl(
    params: { uffUuid?: string; bucketKey?: string; entry: string; mimeType?: string },
    node?: INode | null,
    signal?: AbortSignal,
): Promise<string> {
    const url = buildCargoUffEntryUrl(params, node);
    const resp = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: buildAuthHeaders(node),
        signal,
    });
    if (!resp.ok) {
        throw new Error(`Failed loading UFF entry '${params.entry}' (HTTP ${resp.status})`);
    }
    const blob = await resp.blob();
    const typed = params.mimeType ? new Blob([blob], { type: params.mimeType }) : blob;
    return URL.createObjectURL(typed);
}

export async function stageCargoUffForAdjudication(
    uffUuid: string,
    node?: INode | null,
): Promise<StagedCargoUffResult> {
    const base = resolveUffServletBase(node);
    const resp = await fetch(`${base}/stage-adjudication`, {
        method: 'POST',
        credentials: 'include',
        headers: buildAuthHeaders(node, {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Requested-With': 'OSCAR-Viewer',
        }),
        body: JSON.stringify({ uffUuid }),
    });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Failed linking Cargo UFF scan (HTTP ${resp.status})`);
    }
    return (await resp.json()) as StagedCargoUffResult;
}

export async function testCargoUffConnection(payload: {
    sourceType: 'smb' | 'local';
    shareUrl?: string;
    subPath?: string;
    localPath?: string;
    domain?: string;
    username?: string;
    password?: string;
}): Promise<CargoUffConnectionTestResult> {
    const resp = await fetch('/sensorhub/oscar/extensions/uff/action', {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Requested-With': 'OSCAR-Viewer',
        },
        body: JSON.stringify({ action: 'test-connection', ...payload }),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        throw new Error(body.error || `SMB connection test failed (HTTP ${resp.status})`);
    }
    return body as CargoUffConnectionTestResult;
}
