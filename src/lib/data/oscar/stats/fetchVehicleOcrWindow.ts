/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import DataStream from "osh-js/source/core/consysapi/datastream/DataStream";
import ObservationFilter from "osh-js/source/core/consysapi/observation/ObservationFilter";
import {LaneMapEntry} from "@/lib/data/oscar/LaneCollection";
import {isVehicleOcrDataStream} from "@/lib/data/oscar/Utilities";
import VehicleOcrResult, {IVehicleOcrResult} from "@/lib/data/oscar/adjudication/VehicleOcr";
import {ADJ_PAGE_SIZE, POOL} from "./alarmStatsTypes";

export type VehicleOcrByOccupancy = Map<string, IVehicleOcrResult>;

/**
 * Same ordering the adjudication suggestion chips use: a validated ISO 6346
 * check digit outranks raw confidence. Note this is a weak discriminator —
 * roughly one misread in eleven still validates — so the winner is a suggestion,
 * never a fact.
 */
function ranksHigher(candidate: IVehicleOcrResult, incumbent: IVehicleOcrResult): boolean {
    if (candidate.checksumValid !== incumbent.checksumValid) return candidate.checksumValid;
    return candidate.confidence > incumbent.confidence;
}

/** Best candidate wins for a given occupancy. */
export function applyOcrResult(map: VehicleOcrByOccupancy, result: IVehicleOcrResult) {
    const key = result?.occupancyObsId;
    if (!key) return;
    const existing = map.get(key);
    if (!existing || ranksHigher(result, existing)) {
        map.set(key, result);
    }
}

/**
 * Best OCR candidate per occupancy for the given lanes, bounded to a result-time
 * window. Mirrors fetchAdjudicationWindow, which the event table already uses to
 * decorate rows from a second source.
 *
 * Fetched per datastream rather than through the node-level
 * `/observations?dataStream=<csv>` route: measured on the reference node, that
 * route took 7.9s for limit=2 across five datastreams, against 0.27s for
 * limit=1000 per datastream over the same window.
 *
 * Result time is when OCR finished, a few seconds after the occupancy closed, so
 * a window chosen to cover the visible rows covers their OCR results too. Lanes
 * with OCR disabled have no vehicleOcr datastream and cost nothing here.
 */
export async function fetchVehicleOcrWindow(
    laneMap: Map<string, LaneMapEntry>,
    laneIds: string[],
    startIso: string,
    endIso: string,
    isCancelled: () => boolean,
): Promise<VehicleOcrByOccupancy> {
    const map: VehicleOcrByOccupancy = new Map();

    async function drainLane(laneId: string) {
        const entry = laneMap.get(laneId);
        if (!entry) return;

        const ocrStreams: (typeof DataStream)[] =
            entry.datastreams?.filter((ds: any) => isVehicleOcrDataStream(ds)) ?? [];

        for (const ds of ocrStreams) {
            try {
                const observations = await ds.searchObservations(
                    new ObservationFilter({resultTime: `${startIso}/${endIso}`}),
                    ADJ_PAGE_SIZE,
                );

                while (observations.hasNext()) {
                    if (isCancelled()) return;
                    const page = await observations.nextPage();
                    for (const obs of page ?? [])
                        applyOcrResult(map, new VehicleOcrResult(obs.resultTime, obs.result));
                }
            } catch (err) {
                console.warn(`[vehicleOcr] observation fetch failed for lane ${laneId}`, err);
            }
        }
    }

    for (let i = 0; i < laneIds.length; i += POOL) {
        if (isCancelled()) return map;
        await Promise.all(laneIds.slice(i, i + POOL).map(drainLane));
    }

    return map;
}
