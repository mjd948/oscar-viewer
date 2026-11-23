'use client';

import React, {createContext, MutableRefObject, ReactNode, useCallback, useEffect, useRef, useState} from "react";
import {useSelector} from "react-redux";
import {useAppDispatch} from "@/lib/state/Hooks";
import {addNode, changeConfigNode, updateNode} from "@/lib/state/OSHSlice";
import {setLaneMap} from "@/lib/state/OSCARLaneSlice";
import {clearEventPreview, setSelectedRowId} from "@/lib/state/EventPreviewSlice";
import {AppDispatch, RootState} from "@/lib/state/Store";
import {LaneMapEntry} from "@/lib/data/oscar/LaneCollection";
import {Node, NodeOptions} from "@/lib/data/osh/Node";
import {discoverLanesIncrementally} from "@/lib/data/oscar/LaneDiscovery";
import {
    mergeOperationalViewCatalogs,
    OperationalViewOption,
    parseOperationalView,
    resolveRouteForViewSwitch,
    withOperationalView,
} from "@/lib/data/oscar/OperationalView";
import {fetchCurrentSession, OscarSessionInfo} from "@/lib/data/oscar/AuthSessionApi";



interface IDataSourceContext {
    laneMapRef: MutableRefObject<Map<string, LaneMapEntry>> | undefined;
    laneMapReady: boolean;
    readyLaneNames: ReadonlySet<string>;
    activeViewKey: string | null;
    viewError: "invalid" | "empty" | "unauthorized" | null;
    availableViews: readonly OperationalViewOption[];
    totalCatalogLaneCount: number;
    refreshOperationalViews: () => Promise<void>;
    setActiveView: (nextViewKey: string | null) => void;
    scopedHref: (path: string) => string;
    currentSession: OscarSessionInfo | null;
    refreshSession: () => Promise<void>;
}

// create context with a default value of undefined (This will differ if there is a file import at page load)
const DataSourceContext = createContext<IDataSourceContext | undefined>(undefined);

export {DataSourceContext};

export function sameLaneMapSnapshot<T>(
    left: ReadonlyMap<string, T> | null | undefined,
    right: ReadonlyMap<string, T>,
): boolean {
    if (!left || left.size !== right.size)
        return false;

    for (const [key, value] of right.entries()) {
        if (!left.has(key) || left.get(key) !== value)
            return false;
    }

    return true;
}


export default function DataSourceProvider({children}: { children: ReactNode }) {

    const configNode = useSelector((state: RootState) => state.oshSlice.configNode);
    const dispatch = useAppDispatch();
    const nodes = useSelector((state: RootState) => state.oshSlice.nodes);
    const laneMapRef = useRef<Map<string, LaneMapEntry>>(new Map<string, LaneMapEntry>());
    const [laneMapReady, setLaneMapReady] = useState(false);
    const [readyLaneNames, setReadyLaneNames] = useState<Set<string>>(new Set());
    const [currentSession, setCurrentSession] = useState<OscarSessionInfo | null>(null);
    const [sessionLoaded, setSessionLoaded] = useState(false);
    const [viewSelection, setViewSelection] = useState<{
        resolved: boolean;
        key: string | null;
        error: "invalid" | null;
    }>({resolved: false, key: null, error: null});
    const [viewError, setViewError] = useState<"invalid" | "empty" | "unauthorized" | null>(null);
    const [availableViews, setAvailableViews] = useState<OperationalViewOption[]>([]);
    const [totalCatalogLaneCount, setTotalCatalogLaneCount] = useState(0);
    const [sandboxLaneReloadEpoch, setSandboxLaneReloadEpoch] = useState(0);
    const lastCatalogRefreshEpochRef = useRef(0);
    const discoveryGenerationRef = useRef(0);
    const nodesRef = useRef<Node[]>(nodes);
    nodesRef.current = nodes;

    useEffect(() => {
        const handleSandboxLanesChanged = () => {
            for (const node of nodesRef.current) {
                node?.invalidateOperationalViewCatalog?.();
            }
            setSandboxLaneReloadEpoch((prev) => prev + 1);
        };
        window.addEventListener("oscar:sandbox-lanes-changed", handleSandboxLanesChanged);
        return () => {
            window.removeEventListener("oscar:sandbox-lanes-changed", handleSandboxLanesChanged);
        };
    }, []);

    const refreshSession = useCallback(async () => {
        const session = await fetchCurrentSession();
        setCurrentSession(session);
        setSessionLoaded(true);
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        fetchCurrentSession(controller.signal)
            .then((session) => {
                setCurrentSession(session);
                setSessionLoaded(true);
            })
            .catch(() => {
                setSessionLoaded(true);
            });
        return () => controller.abort();
    }, []);

    useEffect(() => {
        const syncOperationalView = () => {
            const selection = parseOperationalView(window.location.search);
            setViewSelection((current) => (
                current.resolved &&
                current.key === selection.key &&
                current.error === selection.error
                    ? current
                    : {resolved: true, ...selection}
            ));
        };
        syncOperationalView();
        window.addEventListener("popstate", syncOperationalView);
        return () => {
            window.removeEventListener("popstate", syncOperationalView);
        };
    }, []);


    useEffect(() => {
        if (!nodes || nodes.length == 0)
            dispatch(initializeDefaultNode());
    }, [nodes]);


    const InitializeApplication = useCallback(async () => {

        if (!configNode) {
            if (nodes.length > 0) {
                const defaultNode = nodes.find((n) => n.isDefaultNode) || nodes[0];
                dispatch(changeConfigNode(defaultNode));
            }
        }
    }, [nodes, configNode]);


    const nodesConnectionKey = React.useMemo(
        () => nodes.map((n) => [
            n.id,
            n.address,
            String(n.port ?? ""),
            n.oshPathRoot ?? "",
            n.csAPIEndpoint ?? "",
            String(Boolean(n.isSecure)),
            n.authenticationMode ?? "",
            n.auth?.username ?? "",
            n.auth?.password ?? "",
            n.auth?.token ?? "",
        ].join("|")).join("\n"),
        [nodes],
    );

    const userAllowedViewsKey = React.useMemo(
        () => (currentSession?.allowedViews ?? []).join(","),
        [currentSession?.allowedViews],
    );

    const effectiveViewResolution = React.useMemo((): {
        effectiveKey: string | null;
        accessError: "invalid" | "unauthorized" | null;
    } => {
        const allowed = currentSession?.allowedViews ?? [];
        if (viewSelection.error) {
            return { effectiveKey: null, accessError: "invalid" };
        }
        if (allowed.length === 0) {
            return { effectiveKey: viewSelection.key, accessError: null };
        }
        if (!viewSelection.key) {
            return { effectiveKey: allowed[0], accessError: null };
        }
        if (!allowed.includes(viewSelection.key)) {
            return { effectiveKey: viewSelection.key, accessError: "unauthorized" };
        }
        return { effectiveKey: viewSelection.key, accessError: null };
    }, [viewSelection, currentSession?.allowedViews]);

    const testSysFetch = async (viewKey: string | null) => {
        const generation = ++discoveryGenerationRef.current;
        let publishedLaneMap: Map<string, LaneMapEntry> | null = null;
        const prevNodeIdentities = new Map<string, {name: string; uid?: string}>(
            nodes.map((n) => [n.id, {name: n.name, uid: n.serverNodeUid}]),
        );
        setLaneMapReady(false);
        setReadyLaneNames(new Set());
        laneMapRef.current = new Map();
        dispatch(setLaneMap(new Map()));

        const result = await discoverLanesIncrementally(nodes, (laneMap) => {
            if (generation !== discoveryGenerationRef.current)
                return;

            publishedLaneMap = laneMap;
            laneMapRef.current = laneMap;
            setReadyLaneNames(new Set(laneMap.keys()));
            dispatch(setLaneMap(laneMap));
        }, viewKey);

        if (generation !== discoveryGenerationRef.current)
            return;

        result.failures.forEach(({node, reason}) =>
            console.error(`Failed to initialize lane data for ${node.name}:`, reason));

        // Adopt server-configured Node Name automatically when the node still carries
        // only the generic "Local Node" placeholder and the user has not customized it.
        const adoptedById = new Map<string, Node>();
        for (const node of nodes) {
            const prev = prevNodeIdentities.get(node.id);
            const shouldAdoptServerName =
                !node.customNameSet &&
                Boolean(node.serverNodeName) &&
                (!node.name || node.name === "Local Node") &&
                node.name !== node.serverNodeName;
            if (shouldAdoptServerName) {
                const adopted = new Node({
                    ...node,
                    id: node.id,
                    name: node.serverNodeName!,
                    serverNodeUid: node.serverNodeUid,
                    serverNodeName: node.serverNodeName,
                    oscarServiceSystem: node.oscarServiceSystem,
                    laneAdjMap: node.laneAdjMap,
                });
                adoptedById.set(node.id, adopted);
                dispatch(updateNode(adopted));
            } else if (node.serverNodeUid && prev && prev.uid !== node.serverNodeUid) {
                try {
                    const storedRaw = localStorage.getItem("osh_nodes");
                    if (storedRaw) {
                        const parsed = JSON.parse(storedRaw);
                        if (Array.isArray(parsed)) {
                            const updated = parsed.map((item: any) =>
                                item.id === node.id || (item.address === node.address && item.port === node.port)
                                    ? {...item, serverNodeUid: node.serverNodeUid, serverNodeName: node.serverNodeName}
                                    : item,
                            );
                            localStorage.setItem("osh_nodes", JSON.stringify(updated));
                        }
                    }
                } catch {
                    // Ignore storage write errors in private browsing contexts
                }
            }
        }

        if (adoptedById.size > 0) {
            for (const entry of result.laneMap.values()) {
                const adopted = adoptedById.get(entry.parentNode.id);
                if (adopted) {
                    entry.parentNode = adopted;
                }
            }
            publishedLaneMap = null;
        }

        if (!sameLaneMapSnapshot(publishedLaneMap, result.laneMap)) {
            laneMapRef.current = result.laneMap;
            setReadyLaneNames(new Set(result.laneMap.keys()));
            dispatch(setLaneMap(new Map(result.laneMap)));
        }
        setViewError(viewKey && result.laneMap.size === 0 ? "empty" : null);
        setLaneMapReady(true);
    }

    useEffect(() => {
        if (!laneMapReady || laneMapRef.current.size === 0)
            return;
        const nodesById = new Map(nodes.map((n) => [n.id, n]));
        let changed = false;
        for (const entry of laneMapRef.current.values()) {
            const latest = nodesById.get(entry.parentNode.id);
            if (latest && entry.parentNode.name !== latest.name) {
                entry.parentNode = latest;
                changed = true;
            }
        }
        if (changed) {
            dispatch(setLaneMap(new Map(laneMapRef.current)));
        }
    }, [nodes, laneMapReady, dispatch]);

    useEffect(() => {
        const init = async () => {
            if (!viewSelection.resolved || !sessionLoaded)
                return;

            if (effectiveViewResolution.accessError) {
                discoveryGenerationRef.current++;
                laneMapRef.current = new Map();
                setReadyLaneNames(new Set());
                dispatch(setLaneMap(new Map()));
                setViewError(effectiveViewResolution.accessError);
                setLaneMapReady(true);
                return;
            }

            if (nodes.length === 0) {
                discoveryGenerationRef.current++;
                setLaneMapReady(false);
                setReadyLaneNames(new Set());
                return;
            }
            await InitializeApplication();
            await testSysFetch(effectiveViewResolution.effectiveKey);
        }
        init();
    }, [nodesConnectionKey, viewSelection, sessionLoaded, userAllowedViewsKey, sandboxLaneReloadEpoch]);

    const refreshOperationalViews = useCallback(async () => {
        const currentNodes = nodesRef.current;
        if (currentNodes.length === 0) {
            setAvailableViews([]);
            setTotalCatalogLaneCount(0);
            return;
        }
        const outcomes = await Promise.allSettled(
            currentNodes
                .filter((node) => typeof node?.fetchOperationalViewCatalog === "function")
                .map((node) => node.fetchOperationalViewCatalog(true)),
        );
        const catalogs = outcomes
            .filter((o): o is PromiseFulfilledResult<Awaited<ReturnType<Node["fetchOperationalViewCatalog"]>>> => o.status === "fulfilled")
            .map((o) => o.value);
        const merged = mergeOperationalViewCatalogs(catalogs);
        setAvailableViews(merged.options);
        setTotalCatalogLaneCount(merged.totalLaneCount);
    }, []);

    useEffect(() => {
        if (!sessionLoaded || (!laneMapReady && !viewError) || nodes.length === 0) {
            if (nodes.length === 0) {
                setAvailableViews([]);
                setTotalCatalogLaneCount(0);
            }
            return;
        }
        let cancelled = false;
        const forceCatalogRefresh = sandboxLaneReloadEpoch !== lastCatalogRefreshEpochRef.current;
        lastCatalogRefreshEpochRef.current = sandboxLaneReloadEpoch;
        void Promise.allSettled(
            nodes
                .filter((node) => typeof node?.fetchOperationalViewCatalog === "function")
                .map((node) => node.fetchOperationalViewCatalog(forceCatalogRefresh)),
        ).then((outcomes) => {
            if (cancelled) return;
            const catalogs = outcomes
                .filter((o): o is PromiseFulfilledResult<Awaited<ReturnType<Node["fetchOperationalViewCatalog"]>>> => o.status === "fulfilled")
                .map((o) => o.value);
            const merged = mergeOperationalViewCatalogs(catalogs);
            setAvailableViews(merged.options);
            setTotalCatalogLaneCount(merged.totalLaneCount);
            if (
                forceCatalogRefresh &&
                (currentSession?.allowedViews ?? []).length === 0 &&
                viewSelection.key &&
                !merged.options.some((opt) => opt.key === viewSelection.key)
            ) {
                setViewSelection({ resolved: true, key: null, error: null });
                if (typeof window !== "undefined") {
                    const nextUrl = resolveRouteForViewSwitch(
                        window.location.pathname,
                        window.location.search,
                        null,
                    );
                    try {
                        window.history.replaceState(window.history.state, "", nextUrl);
                    } catch {
                        // Ignore history API restrictions in embedded test harnesses
                    }
                }
            }
        });
        return () => {
            cancelled = true;
        };
    }, [laneMapReady, nodes, nodesConnectionKey, sessionLoaded, viewError, sandboxLaneReloadEpoch, currentSession?.allowedViews, viewSelection.key]);

    const setActiveView = useCallback(
        (nextViewKey: string | null) => {
            const normalized = nextViewKey && nextViewKey.trim().length > 0 ? nextViewKey.trim() : null;
            dispatch(clearEventPreview());
            dispatch(setSelectedRowId(null));
            setViewSelection({
                resolved: true,
                key: normalized,
                error: null,
            });
            if (typeof window !== "undefined") {
                const nextUrl = resolveRouteForViewSwitch(
                    window.location.pathname,
                    window.location.search,
                    normalized,
                );
                try {
                    window.history.pushState(window.history.state, "", nextUrl);
                } catch {
                    // Ignore history API restrictions in embedded test harnesses
                }
            }
        },
        [dispatch],
    );

    const scopedHref = useCallback(
        (path: string) => withOperationalView(
            path,
            viewSelection.error ? "__invalid__" : effectiveViewResolution.effectiveKey,
        ),
        [viewSelection.error, effectiveViewResolution.effectiveKey],
    );

    return (
        <DataSourceContext.Provider value={{
            laneMapRef,
            laneMapReady,
            readyLaneNames,
            activeViewKey: effectiveViewResolution.effectiveKey,
            viewError,
            availableViews,
            totalCatalogLaneCount,
            refreshOperationalViews,
            setActiveView,
            scopedHref,
            currentSession,
            refreshSession,
        }}>
            {children}
        </DataSourceContext.Provider>
    );
};

export const initializeDefaultNode = () => (dispatch: AppDispatch) => {
    const hostName = window.location.hostname;
    const isSecure = window.location.protocol === "https:";
    let port: number;

    if (window.location.port) {
        port = Number(window.location.port);
    } else {
        port = isSecure ? 443 : 80;
    }

    const initialNodeOpts: NodeOptions = {
        name: "Local Node",
        address: hostName,
        port: port ? Number(port) : (isSecure ? 443 : 80),
        oshPathRoot: "/sensorhub",
        csAPIEndpoint: "/api",
        auth: { username: "", password: "", token: "" },
        authenticationMode: "session",
        isSecure: isSecure,
        isDefaultNode: true
    };

    const defaultNode = new Node(initialNodeOpts);
    dispatch(addNode(defaultNode));
    dispatch(changeConfigNode(defaultNode));
};
