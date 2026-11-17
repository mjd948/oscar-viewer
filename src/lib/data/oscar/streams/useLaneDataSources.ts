/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import {useContext, useEffect, useMemo} from "react";
import {DataSourceContext} from "@/app/contexts/DataSourceContext";
import {
    acquireSharedConnection,
    findRealtimeDataSourceForStream,
    LaneDSColl,
    LaneMapEntry,
} from "@/lib/data/oscar/LaneCollection";
import {
    isDailyFileDataStream,
    isGammaDataStream,
    isNeutronDataStream,
    isTamperDataStream,
    isThresholdDataStream,
} from "@/lib/data/oscar/Utilities";

export interface LaneDataSources {
    entry?: LaneMapEntry;
    collection: LaneDSColl | null;
    gamma?: any;
    neutron?: any;
    threshold?: any;
    tamper?: any;
}

/**
 * One lane's shared realtime datasources, collected the way ORNL's lane-view page does it
 * (bound to datastreams by resource id, MQTT shared), for custom-page lane widgets.
 *
 * With `connect`, the widget also holds a connection lease on the count/threshold feeds for
 * as long as it is mounted, like ORNL's lane-view Media block; leases are ref-counted, so
 * several widgets on one lane share one connection.
 */
export function useLaneDataSources(laneName: string | undefined, connect = false): LaneDataSources {
    const {laneMapRef, laneMapReady} = useContext(DataSourceContext) as any;

    const sources = useMemo<LaneDataSources>(() => {
        const entry: LaneMapEntry | undefined = laneName ? laneMapRef?.current?.get(laneName) : undefined;
        if (!entry) return {collection: null};
        const collection = new LaneDSColl();
        const found: LaneDataSources = {entry, collection};
        for (const ds of entry.datastreams ?? []) {
            const rt = findRealtimeDataSourceForStream(entry, ds);
            if (!rt) continue;
            const share = () => {
                if (rt.properties?.mqttOpts) rt.properties.mqttOpts.shared = true;
            };
            if (isGammaDataStream(ds)) { share(); collection.addDS('gammaRT', rt); found.gamma = rt; }
            if (isNeutronDataStream(ds)) { share(); collection.addDS('neutronRT', rt); found.neutron = rt; }
            if (isTamperDataStream(ds)) { share(); collection.addDS('tamperRT', rt); found.tamper = rt; }
            if (isThresholdDataStream(ds)) { share(); collection.addDS('gammaTrshldRT', rt); found.threshold = rt; }
            if (isDailyFileDataStream(ds)) { share(); collection.addDS('dailyFileRT', rt); }
        }
        return found;
        // laneMapReady flips when discovery (re)populates laneMapRef
    }, [laneName, laneMapRef, laneMapReady]);

    useEffect(() => {
        if (!connect) return;
        const feeds = [sources.gamma, sources.neutron, sources.threshold].filter(Boolean);
        let active = true;
        const leases = feeds.map((source) => {
            const lease = acquireSharedConnection(source);
            void lease.ready.catch((error) => {
                if (active) console.warn("Unable to connect lane widget stream", error);
            });
            return lease;
        });
        return () => {
            active = false;
            leases.forEach((lease) => void lease.release().catch((error) =>
                console.warn("Unable to disconnect lane widget stream", error)));
        };
    }, [connect, sources]);

    return sources;
}
