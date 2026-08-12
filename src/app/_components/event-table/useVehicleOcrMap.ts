"use client";

/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {randomUUID} from "osh-js/source/core/utils/Utils";
import {LaneMapEntry} from "@/lib/data/oscar/LaneCollection";
import VehicleOcrResult from "@/lib/data/oscar/adjudication/VehicleOcr";
import {
    VehicleOcrByOccupancy,
    applyOcrResult,
    fetchVehicleOcrWindow,
} from "@/lib/data/oscar/stats/fetchVehicleOcrWindow";
import {LaneStreamRegistry} from "@/lib/data/oscar/streams/LaneStreamRegistry";

export type {VehicleOcrByOccupancy};

/**
 * Fallback result-time window when a caller has no bound of its own. OCR only
 * runs on alarming occupancies with a recorded clip, so this datastream is far
 * sparser than adjudication statuses — a day is cheap.
 */
export const DEFAULT_OCR_LOOKBACK_MS = 24 * 60 * 60 * 1000;

export interface VehicleOcrMapOptions {
    /**
     * Start of the result-time window (ISO). Should be no later than the oldest
     * occupancy the caller shows: OCR result time trails the occupancy by a few
     * seconds, so a window covering the rows covers their reads.
     */
    startIso?: string;
    /** End of the result-time window (ISO). Defaults to now, resolved per fetch. */
    endIso?: string;
    /** laneMap keys to cover. Omit for every lane in the map. */
    laneIds?: string[];
}

/**
 * Best OCR candidate per occupancy observation id, seeded from a bounded
 * result-time window and kept current from the lane's vehicleOcr datastream.
 *
 * Deliberately shaped like useAdjudicationMap, including the two things that
 * were harmful there and would be here too:
 *
 *  1. The seed is windowed. Unbounded paging of a datastream that grows for the
 *     life of the site is what made the OCR suggestion chips slow and eventually
 *     wrong in VehicleIdOcr.
 *
 *  2. Live updates go through the ref-counted LaneStreamRegistry, which never
 *     disconnects. Building and disconnecting a per-lane source here would hit
 *     the osh-js one-way door: MqttProvider.unsubscribe leaves the topic in its
 *     dedupe list, so a resize-driven remount would permanently kill the stream.
 *
 * The map accumulates rather than resetting between fetches, so widening the
 * window never blinks a known read back to blank while a refetch is in flight.
 */
export function useVehicleOcrMap(
    laneMap: Map<string, LaneMapEntry>,
    enabled: boolean,
    options?: VehicleOcrMapOptions,
): VehicleOcrByOccupancy {
    const [ocrMap, setOcrMap] = useState<VehicleOcrByOccupancy>(new Map());
    const mapRef = useRef<VehicleOcrByOccupancy>(new Map());
    const bundleIdRef = useRef<string>(`vehicle-ocr-map-${randomUUID()}`);

    const publishMap = useCallback(() => {
        setOcrMap(new Map(mapRef.current));
    }, []);

    const startIso = options?.startIso;
    const endIso = options?.endIso;
    // Callers rebuild the array every render; key the effects on its contents.
    const requestedLaneKey = options?.laneIds ? options.laneIds.join(',') : '';

    const laneIds = useMemo(() => {
        if (!laneMap) return [];
        if (!options?.laneIds) return [...laneMap.keys()];
        return options.laneIds.filter((id) => laneMap.has(id));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [laneMap, requestedLaneKey]);

    const laneKey = laneIds.join(',');

    // Historical seed, bounded by the result-time window.
    useEffect(() => {
        if (!enabled || laneIds.length === 0) return;

        let cancelled = false;
        const start = startIso ?? new Date(Date.now() - DEFAULT_OCR_LOOKBACK_MS).toISOString();
        const end = endIso ?? new Date().toISOString();

        (async () => {
            try {
                const fetched = await fetchVehicleOcrWindow(laneMap, laneIds, start, end, () => cancelled);
                if (cancelled) return;
                // Merge rather than replace: a live read that landed mid-fetch is
                // newer than anything the window can return.
                for (const result of fetched.values()) applyOcrResult(mapRef.current, result);
            } catch (err) {
                console.error("useVehicleOcrMap: failed to fetch OCR observations", err);
            }
            if (!cancelled) publishMap();
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, laneMap, laneKey, startIso, endIso, publishMap]);

    // Live reads via the shared, ref-counted registry channel.
    useEffect(() => {
        const bundleId = bundleIdRef.current;
        if (!enabled || laneIds.length === 0) {
            LaneStreamRegistry.release(bundleId);
            return;
        }

        LaneStreamRegistry.acquire(bundleId, laneMap, laneIds, ['vehicleOcrRT'], (_laneId, _stream, message) => {
            let changed = false;
            for (const value of message?.values ?? []) {
                const data = value?.data;
                if (!data) continue;
                applyOcrResult(mapRef.current, new VehicleOcrResult(data.timestamp, data));
                changed = true;
            }
            if (changed) publishMap();
        });

        return () => {
            LaneStreamRegistry.release(bundleId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, laneMap, laneKey, publishMap]);

    return ocrMap;
}
