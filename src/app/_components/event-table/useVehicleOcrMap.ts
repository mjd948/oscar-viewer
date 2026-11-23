"use client";

import {useEffect, useMemo, useState} from "react";
import DataStream from "osh-js/source/core/consysapi/datastream/DataStream";
import {EventType} from "osh-js/source/core/event/EventType";
import {
    acquireSharedConnection,
    findRealtimeDataSourceForStream,
    LaneMapEntry,
    type SharedConnectionLease,
} from "@/lib/data/oscar/LaneCollection";
import {
    isAdjudicationDataStream,
    isVehicleOcrDataStream,
} from "@/lib/data/oscar/Utilities";
import {
    dedupeOcrResults,
    IVehicleOcrResult,
    selectAutoFillCandidate,
    VehicleOcrResult,
} from "@/lib/data/oscar/adjudication/VehicleOcr";
import {
    extractAdjudicationObservationVehicleId,
    fetchAdjudicatedVehicleIdsWindow,
    fetchVehicleOcrWindow,
} from "@/lib/data/oscar/adjudication/fetchVehicleOcrWindow";
import {
    removeRealtimeEventSubscription,
    type RealtimeEventHandler,
} from "@/lib/data/oscar/RealtimeEventNotification";

export interface UseVehicleOcrMapOptions {
    enabled: boolean;
    lanes: readonly LaneMapEntry[];
    windowStartIso: string;
    windowEndIso?: string | null;
}

export interface VehicleOcrMapState {
    ocrByObsId: ReadonlyMap<string, IVehicleOcrResult>;
    adjudicatedVehicleIdByObsId: ReadonlyMap<string, string>;
}

const EMPTY_OCR_MAP: ReadonlyMap<string, IVehicleOcrResult> = new Map();
const EMPTY_ADJ_MAP: ReadonlyMap<string, string> = new Map();

export function useVehicleOcrMap({
    enabled,
    lanes,
    windowStartIso,
    windowEndIso,
}: UseVehicleOcrMapOptions): VehicleOcrMapState {
    const [ocrByObsId, setOcrByObsId] = useState<ReadonlyMap<string, IVehicleOcrResult>>(EMPTY_OCR_MAP);
    const [adjudicatedVehicleIdByObsId, setAdjudicatedVehicleIdByObsId] =
        useState<ReadonlyMap<string, string>>(EMPTY_ADJ_MAP);

    const streamPlan = useMemo(() => {
        if (!enabled || lanes.length === 0) {
            return {
                key: "disabled",
                ocrEntries: [] as Array<{lane: LaneMapEntry; stream: typeof DataStream}>,
                adjEntries: [] as Array<{lane: LaneMapEntry; stream: typeof DataStream}>,
            };
        }
        const ocrEntries: Array<{lane: LaneMapEntry; stream: typeof DataStream}> = [];
        const adjEntries: Array<{lane: LaneMapEntry; stream: typeof DataStream}> = [];
        const ids: string[] = [];

        for (const lane of lanes) {
            for (const stream of lane.datastreams ?? []) {
                const streamId = String(stream?.properties?.id ?? "");
                if (!streamId) continue;
                if (isVehicleOcrDataStream(stream)) {
                    ocrEntries.push({lane, stream});
                    ids.push(`ocr:${streamId}`);
                } else if (isAdjudicationDataStream(stream)) {
                    adjEntries.push({lane, stream});
                    ids.push(`adj:${streamId}`);
                }
            }
        }
        ids.sort();
        return {
            key: `${windowStartIso}|${windowEndIso ?? ""}|${ids.join(",")}`,
            ocrEntries,
            adjEntries,
        };
    }, [enabled, lanes, windowEndIso, windowStartIso]);

    useEffect(() => {
        if (!enabled) {
            setOcrByObsId(EMPTY_OCR_MAP);
            setAdjudicatedVehicleIdByObsId(EMPTY_ADJ_MAP);
            return;
        }
        const controller = new AbortController();
        let active = true;

        void Promise.all([
            fetchVehicleOcrWindow(
                streamPlan.ocrEntries.map(entry => entry.stream),
                windowStartIso,
                controller.signal,
                windowEndIso,
            ),
            fetchAdjudicatedVehicleIdsWindow(
                streamPlan.adjEntries.map(entry => entry.stream),
                windowStartIso,
                controller.signal,
                windowEndIso,
            ),
        ]).then(([ocrWindow, adjWindow]) => {
            if (!active || controller.signal.aborted) return;
            setOcrByObsId(ocrWindow);
            setAdjudicatedVehicleIdByObsId(adjWindow);
        });

        const subscriptions: Array<{
            source: any;
            handler: RealtimeEventHandler;
            lease: SharedConnectionLease;
        }> = [];

        for (const {lane, stream} of streamPlan.ocrEntries) {
            const source = findRealtimeDataSourceForStream(lane, stream);
            if (!source) continue;
            const handleMessage: RealtimeEventHandler = (message: any) => {
                if (!active) return;
                const payload = message?.values?.[0]?.data ?? message;
                const parsed = VehicleOcrResult.fromObservation(payload);
                if (!parsed || !parsed.occupancyObsId) return;
                setOcrByObsId(previous => {
                    const current = previous.get(parsed.occupancyObsId);
                    const merged = dedupeOcrResults(current ? [current, parsed] : [parsed]);
                    const chosen = selectAutoFillCandidate(merged) ?? merged[0];
                    if (!chosen || chosen === current) return previous;
                    const next = new Map(previous);
                    next.set(parsed.occupancyObsId, chosen);
                    return next;
                });
            };
            source.subscribe(handleMessage, [EventType.DATA]);
            const lease = acquireSharedConnection(source);
            subscriptions.push({source, handler: handleMessage, lease});
            void lease.ready.catch(error => {
                console.warn("Unable to connect vehicleOcr realtime stream", error);
            });
        }

        for (const {lane, stream} of streamPlan.adjEntries) {
            const source = findRealtimeDataSourceForStream(lane, stream);
            if (!source) continue;
            const handleMessage: RealtimeEventHandler = (message: any) => {
                if (!active) return;
                const payload = message?.values?.[0]?.data ?? message;
                const entry = extractAdjudicationObservationVehicleId(payload);
                if (!entry) return;
                setAdjudicatedVehicleIdByObsId(previous => {
                    if (previous.get(entry.occupancyObsId) === entry.vehicleId) return previous;
                    const next = new Map(previous);
                    next.set(entry.occupancyObsId, entry.vehicleId);
                    return next;
                });
            };
            source.subscribe(handleMessage, [EventType.DATA]);
            const lease = acquireSharedConnection(source);
            subscriptions.push({source, handler: handleMessage, lease});
            void lease.ready.catch(error => {
                console.warn("Unable to connect adjudication realtime stream", error);
            });
        }

        return () => {
            active = false;
            controller.abort();
            for (const {source, handler, lease} of subscriptions) {
                removeRealtimeEventSubscription(source, handler);
                void lease.release().catch(error => {
                    console.warn("Unable to release OCR/adjudication stream lease", error);
                });
            }
        };
    }, [enabled, streamPlan, windowStartIso]);

    return {ocrByObsId, adjudicatedVehicleIdByObsId};
}
