/*
 * Copyright (c) 2026.  Oak Ridge National Laboratory
 * All Rights Reserved
 */

import {OCR_PLATE_AUTOFILL_CONFIDENCE} from "@/lib/data/Constants";
import {isValidIso6346} from "@/lib/data/oscar/adjudication/Iso6346";

export type OcrKind = "container" | "plate" | "unknown";

export interface IVehicleOcrResult {
    id: string;
    time: string;
    frameTime?: string;
    occupancyCount: string;
    occupancyObsId: string;
    value: string;
    rawValue?: string;
    kind: OcrKind;
    confidence: number;
    isoChecksumValid: boolean;
    frameCount: number;
    evidenceImagePath: string;
    cameraId: string;
    videoPath?: string;
}

function normalizeKind(raw: unknown): OcrKind {
    const lower = String(raw ?? "").trim().toLowerCase();
    if (lower === "container" || lower === "plate") {
        return lower;
    }
    return "unknown";
}

function normalizeInstant(raw: unknown): string {
    if (typeof raw === "number" && Number.isFinite(raw)) {
        // SensorHub SWE JSON timestamps are epoch seconds (floating point) or epoch ms.
        const millis = raw > 1e11 ? raw : raw * 1000;
        return new Date(millis).toISOString();
    }
    if (typeof raw === "string" && raw.trim().length > 0) {
        const numeric = Number(raw);
        if (Number.isFinite(numeric) && /^\d+(\.\d+)?$/.test(raw.trim())) {
            const millis = numeric > 1e11 ? numeric : numeric * 1000;
            return new Date(millis).toISOString();
        }
        return raw.trim();
    }
    return new Date().toISOString();
}

export class VehicleOcrResult implements IVehicleOcrResult {
    id: string;
    time: string;
    frameTime: string;
    occupancyCount: string;
    occupancyObsId: string;
    value: string;
    rawValue: string;
    kind: OcrKind;
    confidence: number;
    isoChecksumValid: boolean;
    frameCount: number;
    evidenceImagePath: string;
    cameraId: string;
    videoPath: string;

    constructor(init: IVehicleOcrResult) {
        this.id = init.id;
        this.time = init.time;
        this.frameTime = init.frameTime ?? init.time;
        this.occupancyCount = init.occupancyCount;
        this.occupancyObsId = init.occupancyObsId;
        this.value = init.value;
        this.rawValue = init.rawValue ?? init.value;
        this.kind = init.kind;
        this.confidence = init.confidence;
        this.isoChecksumValid = init.isoChecksumValid;
        this.frameCount = init.frameCount;
        this.evidenceImagePath = init.evidenceImagePath;
        this.cameraId = init.cameraId;
        this.videoPath = init.videoPath ?? "";
    }

    static fromObservation(obs: any): VehicleOcrResult | null {
        if (!obs || typeof obs !== "object") {
            return null;
        }
        const props = obs.properties ?? obs;
        const result = props.result ?? obs.result ?? props;
        const rawText = String(
            result?.value
            ?? result?.normalizedValue
            ?? result?.ocrValue
            ?? result?.vehicleId
            ?? "",
        ).trim();
        const preferredCode = String(
            result?.normalizedValue
            || result?.value
            || result?.ocrValue
            || result?.vehicleId
            || "",
        ).trim();
        const canonicalValue = preferredCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (!canonicalValue) {
            return null;
        }
        const kind = normalizeKind(result?.idType ?? result?.ocrKind ?? result?.kind);
        const rawFrames = Number(result?.readCount ?? result?.frameCount ?? 1);
        const frameCount = Number.isFinite(rawFrames) && rawFrames >= 1 ? Math.trunc(rawFrames) : 1;
        const rawExplicitChecksum = typeof result?.checksumValid === "boolean"
            ? result.checksumValid
            : typeof result?.isoChecksumValid === "boolean"
                ? result.isoChecksumValid
                : (kind === "container" && isValidIso6346(canonicalValue));
        // Guard historical single-frame observations where a 10-character prefix had its 11th
        // check digit synthesized or overwritten without optical confirmation: keep as a clickable
        // suggestion chip (isoChecksumValid = false) rather than auto-filling Vehicle ID.
        const rawAlnum = typeof result?.value === "string"
            ? result.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
            : "";
        const singleFrameSynthesizedCheckDigit = kind === "container"
            && frameCount === 1
            && Boolean(result?.normalizedValue)
            && rawAlnum.length > 0
            && (rawAlnum.length < 11
                || (canonicalValue.length === 11
                    && rawAlnum.includes(canonicalValue.slice(0, 10))
                    && !rawAlnum.includes(canonicalValue)));
        const explicitChecksum = rawExplicitChecksum && !singleFrameSynthesizedCheckDigit;
        const rawConf = Number(result?.confidence ?? 0);
        const confidence = Number.isFinite(rawConf) ? Math.max(0, Math.min(1, rawConf)) : 0;
        const time = normalizeInstant(
            props.resultTime
            ?? props.phenomenonTime
            ?? result?.sampleTime
            ?? result?.frameTime
            ?? result?.timestamp
            ?? obs.timestamp,
        );
        const frameTime = normalizeInstant(
            result?.frameTime
            ?? result?.sampleTime
            ?? props.phenomenonTime
            ?? props.resultTime
            ?? obs.timestamp,
        );
        const occupancyObsId = String(result?.occupancyObsId ?? "").trim();
        const occupancyCount = String(result?.occupancyCount ?? "").trim();
        const id = String(obs.id ?? props.id ?? `${occupancyObsId || occupancyCount}:${canonicalValue}:${time}`);

        return new VehicleOcrResult({
            id,
            time,
            frameTime,
            occupancyCount,
            occupancyObsId,
            value: canonicalValue,
            rawValue: rawText || canonicalValue,
            kind,
            confidence,
            isoChecksumValid: explicitChecksum,
            frameCount,
            evidenceImagePath: String(result?.evidenceImagePath ?? "").trim(),
            cameraId: String(result?.cameraUid ?? result?.cameraId ?? "").trim(),
            videoPath: String(result?.videoPath ?? "").trim(),
        });
    }
}

function kindRank(result: IVehicleOcrResult): number {
    if (result.kind === "container" && result.isoChecksumValid) return 0;
    if (result.kind === "container") return 1;
    if (result.kind === "plate") return 2;
    return 3;
}

export function dedupeOcrResults(results: readonly IVehicleOcrResult[]): IVehicleOcrResult[] {
    const byCanonical = new Map<string, IVehicleOcrResult>();
    for (const item of results) {
        const canonical = String(item.value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (!canonical) continue;
        const existing = byCanonical.get(canonical);
        if (!existing) {
            byCanonical.set(canonical, item);
            continue;
        }
        const itemBetter = kindRank(item) < kindRank(existing)
            || (kindRank(item) === kindRank(existing) && item.confidence > existing.confidence)
            || (kindRank(item) === kindRank(existing)
                && item.confidence === existing.confidence
                && !existing.evidenceImagePath
                && Boolean(item.evidenceImagePath));
        if (itemBetter) {
            byCanonical.set(canonical, item);
        }
    }
    return Array.from(byCanonical.values()).sort((left, right) => {
        const rankDiff = kindRank(left) - kindRank(right);
        if (rankDiff !== 0) return rankDiff;
        if (right.confidence !== left.confidence) return right.confidence - left.confidence;
        return right.frameCount - left.frameCount;
    });
}

/**
 * Threshold-hybrid auto-fill selection:
 * 1. Highest-confidence ISO 6346 checksum-valid container code.
 * 2. Otherwise, highest-confidence license plate meeting plateMinConfidence (default 0.85).
 * Lower-confidence plates and unverified reads remain clickable suggestion chips without auto-filling.
 */
export function selectAutoFillCandidate(
    results: readonly IVehicleOcrResult[],
    plateMinConfidence: number = OCR_PLATE_AUTOFILL_CONFIDENCE,
): IVehicleOcrResult | null {
    const deduped = dedupeOcrResults(results);
    const validContainer = deduped.find(
        item => item.kind === "container" && item.isoChecksumValid,
    );
    if (validContainer) {
        return validContainer;
    }
    // Do not overwrite Vehicle ID with a background plate token when a high-confidence container
    // candidate is already ranked ahead of it as a clickable suggestion chip.
    if (deduped.some(item => item.kind === "container" && item.confidence >= 0.82)) {
        return null;
    }
    const confidentPlate = deduped.find(
        item => item.kind === "plate" && item.confidence >= plateMinConfidence,
    );
    return confidentPlate ?? null;
}
