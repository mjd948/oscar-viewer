/*
 * Copyright (c) 2026.  Oak Ridge National Laboratory
 * All Rights Reserved
 */

import DataStream from "osh-js/source/core/consysapi/datastream/DataStream";
import ObservationFilter from "osh-js/source/core/consysapi/observation/ObservationFilter";
import {
    dedupeOcrResults,
    IVehicleOcrResult,
    selectAutoFillCandidate,
    VehicleOcrResult,
} from "@/lib/data/oscar/adjudication/VehicleOcr";
import {runWithConcurrency} from "@/lib/data/oscar/BulkAdjudication";

const MAX_WINDOW_RESULTS_PER_STREAM = 500;
const WINDOW_QUERY_CONCURRENCY = 4;

export function buildBoundedResultTimeRange(
    windowStartIso: string,
    windowEndIso?: string | null,
): string {
    const end = typeof windowEndIso === "string" ? windowEndIso.trim() : "";
    if (!end) {
        return `${windowStartIso}/..`;
    }
    const startMs = Date.parse(windowStartIso);
    const endMs = Date.parse(end);
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs < startMs) {
        return `${end}/${windowStartIso}`;
    }
    return `${windowStartIso}/${end}`;
}

export async function fetchVehicleOcrWindow(
    datastreams: Array<typeof DataStream>,
    windowStartIso: string,
    signal?: AbortSignal,
    windowEndIso?: string | null,
): Promise<Map<string, IVehicleOcrResult>> {
    if (datastreams.length === 0 || signal?.aborted) {
        return new Map();
    }
    const grouped = new Map<string, IVehicleOcrResult[]>();
    const resultTime = buildBoundedResultTimeRange(windowStartIso, windowEndIso);

    await runWithConcurrency(datastreams, WINDOW_QUERY_CONCURRENCY, async (stream) => {
        if (signal?.aborted) return;
        try {
            const collection = await stream.searchObservations(
                new ObservationFilter({
                    resultTime,
                    order: "desc",
                } as any),
                MAX_WINDOW_RESULTS_PER_STREAM,
            );
            if (signal?.aborted) return;
            const page: any[] = (await collection.nextPage()) ?? [];
            for (const obs of page) {
                const parsed = VehicleOcrResult.fromObservation(obs);
                if (!parsed || !parsed.occupancyObsId) continue;
                const list = grouped.get(parsed.occupancyObsId) ?? [];
                list.push(parsed);
                grouped.set(parsed.occupancyObsId, list);
            }
        } catch (error) {
            if (!signal?.aborted) {
                console.warn("Unable to query vehicleOcr window", error);
            }
        }
    });

    const bestByObsId = new Map<string, IVehicleOcrResult>();
    for (const [obsId, items] of grouped.entries()) {
        const deduped = dedupeOcrResults(items);
        const preferred = selectAutoFillCandidate(deduped) ?? deduped[0];
        if (preferred) {
            bestByObsId.set(obsId, preferred);
        }
    }
    return bestByObsId;
}

export function extractAdjudicationObservationVehicleId(obs: any): {
    occupancyObsId: string;
    vehicleId: string;
    timeMs: number;
} | null {
    if (!obs || typeof obs !== "object") return null;
    const props = obs.properties ?? obs;
    const result = props.result ?? obs.result ?? props;
    const occupancyObsId = String(result?.occupancyObsId ?? "").trim();
    const vehicleId = String(result?.vehicleId ?? "").trim();
    if (!occupancyObsId || !vehicleId) return null;
    const rawTime = props.resultTime ?? props.phenomenonTime ?? result?.timestamp ?? obs.timestamp;
    const parsedMs = typeof rawTime === "number"
        ? (rawTime > 1e11 ? rawTime : rawTime * 1000)
        : Date.parse(String(rawTime ?? ""));
    return {
        occupancyObsId,
        vehicleId,
        timeMs: Number.isFinite(parsedMs) ? parsedMs : 0,
    };
}

export async function fetchAdjudicatedVehicleIdsWindow(
    datastreams: Array<typeof DataStream>,
    windowStartIso: string,
    signal?: AbortSignal,
    windowEndIso?: string | null,
): Promise<Map<string, string>> {
    if (datastreams.length === 0 || signal?.aborted) {
        return new Map();
    }
    const latestByObsId = new Map<string, {vehicleId: string; timeMs: number}>();
    const resultTime = buildBoundedResultTimeRange(windowStartIso, windowEndIso);

    await runWithConcurrency(datastreams, WINDOW_QUERY_CONCURRENCY, async (stream) => {
        if (signal?.aborted) return;
        try {
            const collection = await stream.searchObservations(
                new ObservationFilter({
                    resultTime,
                    order: "desc",
                } as any),
                MAX_WINDOW_RESULTS_PER_STREAM,
            );
            if (signal?.aborted) return;
            const page: any[] = (await collection.nextPage()) ?? [];
            for (const obs of page) {
                const entry = extractAdjudicationObservationVehicleId(obs);
                if (!entry) continue;
                const prev = latestByObsId.get(entry.occupancyObsId);
                if (!prev || entry.timeMs >= prev.timeMs) {
                    latestByObsId.set(entry.occupancyObsId, {
                        vehicleId: entry.vehicleId,
                        timeMs: entry.timeMs,
                    });
                }
            }
        } catch (error) {
            if (!signal?.aborted) {
                console.warn("Unable to query adjudication vehicleId window", error);
            }
        }
    });

    const out = new Map<string, string>();
    for (const [obsId, entry] of latestByObsId.entries()) {
        out.set(obsId, entry.vehicleId);
    }
    return out;
}
