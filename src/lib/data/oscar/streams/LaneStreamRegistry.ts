/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import {EventType} from "osh-js/source/core/event/EventType";
import {
    acquireSharedConnection,
    findRealtimeDataSourceForStream,
    LaneMapEntry,
    type SharedConnectionLease,
} from "@/lib/data/oscar/LaneCollection";
import {removeRealtimeEventSubscription} from "@/lib/data/oscar/RealtimeEventNotification";
import {
    isConnectionDataStream,
    isD5RadiometricStatusDataStream,
    isGammaDataStream,
    isMobileGpsDataStream,
    isNeutronDataStream,
    isOccupancyDataStream,
    isTamperDataStream,
    isThresholdDataStream,
    isVehicleOcrDataStream,
} from "@/lib/data/oscar/Utilities";
import {LaneSelection} from "@/lib/layout/PageConfigTypes";

export type LaneStreamName =
    'connectionRT' | 'gammaRT' | 'neutronRT' | 'tamperRT' | 'gammaTrshldRT' |
    'occRT' | 'locRT' | 'radStatusRT' | 'vehicleOcrRT';

export type LaneStreamHandler = (laneId: string, stream: LaneStreamName, message: any) => void;

const STREAM_MATCHERS: Record<LaneStreamName, (datastream: any) => boolean> = {
    connectionRT: isConnectionDataStream,
    gammaRT: isGammaDataStream,
    neutronRT: isNeutronDataStream,
    tamperRT: isTamperDataStream,
    gammaTrshldRT: isThresholdDataStream,
    occRT: isOccupancyDataStream,
    locRT: isMobileGpsDataStream,
    radStatusRT: isD5RadiometricStatusDataStream,
    vehicleOcrRT: isVehicleOcrDataStream,
};

interface Binding {
    source: any;
    handler: (message: any) => void;
    lease: SharedConnectionLease;
}

/**
 * Handler bundles over the lane-map's shared realtime datasources, for widgets that listen
 * to several lanes at once (Alarm Stats). On ORNL 3.11 connection ownership is ORNL's
 * ref-counted acquireSharedConnection lease and handlers come off with
 * removeRealtimeEventSubscription, so this only groups those per bundle; it no longer keeps
 * its own never-disconnect channel table (the pre-3.11 workaround for osh-js lacking both).
 */
class LaneStreamRegistryImpl {
    private bundles = new Map<string, Binding[]>();

    /** Register a handler bundle for the given lanes/streams; the same id replaces the bundle. */
    acquire(
        bundleId: string,
        laneMap: Map<string, LaneMapEntry>,
        laneIds: string[],
        streams: LaneStreamName[],
        handler: LaneStreamHandler,
    ) {
        this.release(bundleId);
        const bindings: Binding[] = [];
        for (const laneId of laneIds) {
            const lane = laneMap.get(laneId);
            if (!lane) continue;
            for (const datastream of lane.datastreams ?? []) {
                for (const stream of streams) {
                    if (!STREAM_MATCHERS[stream](datastream)) continue;
                    const source = findRealtimeDataSourceForStream(lane, datastream);
                    if (!source) continue;
                    if (source.properties?.mqttOpts)
                        source.properties.mqttOpts.shared = true;
                    const bound = (message: any) => {
                        try {
                            handler(laneId, stream, message);
                        } catch (e) {
                            console.error(`[LaneStreamRegistry] handler error for ${laneId}/${stream}:`, e);
                        }
                    };
                    source.subscribe(bound, [EventType.DATA]);
                    const lease = acquireSharedConnection(source);
                    void lease.ready.catch((e) =>
                        console.warn(`[LaneStreamRegistry] connect failed for ${laneId}/${stream}:`, e));
                    bindings.push({source, handler: bound, lease});
                }
            }
        }
        this.bundles.set(bundleId, bindings);
    }

    /** Detach a bundle's handlers and release its connection leases. */
    release(bundleId: string) {
        const bindings = this.bundles.get(bundleId);
        if (!bindings) return;
        this.bundles.delete(bundleId);
        for (const {source, handler, lease} of bindings) {
            removeRealtimeEventSubscription(source, handler);
            void lease.release().catch((e) =>
                console.warn("[LaneStreamRegistry] disconnect failed:", e));
        }
    }
}

export const LaneStreamRegistry = new LaneStreamRegistryImpl();

export function resolveLaneSelection(selection: LaneSelection, laneMap: Map<string, LaneMapEntry>): string[] {
    if (!laneMap) return [];
    if (selection.mode === 'all') return [...laneMap.keys()];
    return selection.lanes.filter((l) => laneMap.has(l));
}
