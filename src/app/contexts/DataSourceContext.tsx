'use client';

import React, {createContext, MutableRefObject, ReactNode, useCallback, useEffect, useRef} from "react";
import {useSelector} from "react-redux";
import {useAppDispatch} from "@/lib/state/Hooks";
import {addNode, changeConfigNode, setNodes} from "@/lib/state/OSHSlice";
import {setLaneMap} from "@/lib/state/OSCARLaneSlice";
import {AppDispatch, RootState} from "@/lib/state/Store";
import {LaneMapEntry} from "@/lib/data/oscar/LaneCollection";
import {INode, Node, NodeOptions} from "@/lib/data/osh/Node";
import {loadRuntimeConfig, isDesktopClient, registerUpstreams} from "@/lib/config/RuntimeConfig";



interface IDataSourceContext {
    laneMapRef: MutableRefObject<Map<string, LaneMapEntry>> | undefined
}

// create context with a default value of undefined (This will differ if there is a file import at page load)
const DataSourceContext = createContext<IDataSourceContext | undefined>(undefined);

export {DataSourceContext};


export default function DataSourceProvider({children}: { children: ReactNode }) {

    const configNode = useSelector((state: RootState) => state.oshSlice.configNode);
    const dispatch = useAppDispatch();
    const nodes = useSelector((state: RootState) => state.oshSlice.nodes);
    const laneMapRef = useRef<Map<string, LaneMapEntry>>(new Map<string, LaneMapEntry>());


    // Seeding the node list now involves an async fetch of the runtime config, and this
    // effect re-runs on every change to `nodes` - including the one the seeding itself
    // causes. Without a guard the in-flight load would be started repeatedly and could
    // add the default node more than once.
    const bootstrapping = useRef(false);

    useEffect(() => {
        if (nodes && nodes.length > 0) return;
        if (bootstrapping.current) return;

        bootstrapping.current = true;
        Promise.resolve(dispatch(initializeDefaultNode()))
            .catch((err) => console.error("[init] could not seed the default node:", err))
            .finally(() => { bootstrapping.current = false; });
    }, [nodes]);


    const InitializeApplication = useCallback(async () => {

        if (!configNode) {
            // if no default node, then just grab the first node in the list and try to use that
            if (nodes.length > 0) {
                const defaultNode = nodes.find((n) => n.isDefaultNode || nodes[0])

                dispatch(changeConfigNode(defaultNode))
            }
        }
    }, [nodes, configNode]);


    const testSysFetch = async () => {

        let allLanes: Map<string, LaneMapEntry> = new Map();

        await Promise.all(nodes.map(async (node: INode) => {
            let nodeLaneMap = await node.fetchLaneSystemsAndSubsystems();
            if(!nodeLaneMap) return;

            await node.fetchDataStreams(nodeLaneMap);
            await node.fetchLaneControlStreams(nodeLaneMap);


            for (const [key, mapEntry] of nodeLaneMap.entries()) {
                try {
                    mapEntry.addDefaultConSysApis();
                } catch (e) {
                    console.error(`[ERROR] addDefaultConSysApis failed for ${key}:`, e);
                }
            }

            nodeLaneMap.forEach((value: LaneMapEntry, key: string) => {
                if (allLanes.has(key)) {
                    const prefixedKey = `${node.name} - ${key}`;
                    value.setLaneName(prefixedKey);
                    allLanes.set(prefixedKey, value);

                    const existing = allLanes.get(key);
                    if (existing) {
                        const existingPrefixedKey = `${existing.parentNode.name} - ${key}`;
                        existing.setLaneName(existingPrefixedKey);
                        allLanes.set(existingPrefixedKey, existing);
                        allLanes.delete(key);
                    }
                } else {
                    allLanes.set(key, value);
                }
            });
        }));

        dispatch(setLaneMap(allLanes));
        laneMapRef.current = allLanes;
    }

    useEffect(() => {
        const init = async () => {
            await InitializeApplication();
            // Before any fetch: in the desktop client the local server routes by node id
            // and supplies the credentials, and it only knows the table once told.
            await registerUpstreams(nodes as any);
            await testSysFetch();
        }
        init();
    }, [nodes]);

    return (
        <DataSourceContext.Provider value={{laneMapRef}}>
            {children}
        </DataSourceContext.Provider>
    );
};

/**
 * Seeds the node list on first run, when localStorage holds nothing yet.
 *
 * Prefers the endpoint an installer wrote to oscar-config.json, and falls back to
 * deriving it from the current origin - which is correct whenever the node is serving
 * this app, and wrong when anything else is (notably the desktop client).
 *
 * Credentials deliberately come only from the runtime config. They used to be
 * hardcoded here as admin/oscar, which compiled the default administrator password
 * into the shipped JavaScript bundle where anyone who could load the page could read
 * it. With none configured the node answers 401 and the app routes to the Servers
 * page, which is the correct place to enter them.
 */
export const initializeDefaultNode = () => async (dispatch: AppDispatch) => {
    const runtime = await loadRuntimeConfig();
    const configured = runtime?.node;

    // In the desktop client the window.location fallback below would name this app's own
    // local server, which it would then be asked to forward to - itself. With nothing
    // configured there is no node to guess at, so leave the list empty and let the
    // Servers page take the address.
    if (!configured && isDesktopClient()) return;

    const initialNodeOpts: NodeOptions = configured
        ? {
            name: configured.name ?? "Local Node",
            address: configured.address,
            port: configured.port,
            oshPathRoot: configured.oshPathRoot ?? "/sensorhub",
            csAPIEndpoint: configured.csAPIEndpoint ?? "/api",
            auth: configured.auth ?? undefined,
            isSecure: configured.isSecure ?? false,
            isDefaultNode: true
        }
        : {
            name: "Local Node",
            address: window.location.hostname,
            port: Number(window.location.port),
            oshPathRoot: "/sensorhub",
            csAPIEndpoint: "/api",
            isSecure: window.location.protocol === "https:",
            isDefaultNode: true
        };

    const defaultNode = new Node(initialNodeOpts);
    dispatch(addNode(defaultNode));
    dispatch(changeConfigNode(defaultNode));
};