import {Dispatch, MutableRefObject, SetStateAction, useCallback, useEffect, useRef, useState} from "react";

import {runWithConcurrency} from "@/lib/data/oscar/BulkAdjudication";
import {eventSelectionKey} from "@/lib/data/oscar/EventFilter";
import {LaneMapEntry} from "@/lib/data/oscar/LaneCollection";
import {EventTableData, sortEventsByAlarmPriority} from "@/lib/data/oscar/TableHelpers";
import {isTunnelAuthReloadPending} from "@/lib/data/oscar/TunnelSessionSelfHeal";

export interface EventQueryPlan {
    key: string;
    node: LaneMapEntry["parentNode"];
    datastreamIds: string[];
    filter: string;
    minTimestampMs?: number;
}

export const ACTIVE_ALARM_WINDOW_DAYS = 15;
export const ACTIVE_ALARM_WINDOW_MS = ACTIVE_ALARM_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export type AlarmTimeWindowPreset = "15m" | "1h" | "24h" | "15d";

export const ALARM_TIME_WINDOW_PRESET_MS: Record<AlarmTimeWindowPreset, number> = {
    "15m": 15 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "15d": ACTIVE_ALARM_WINDOW_MS,
};

export function computeActiveAlarmWindowStartIso(
    cutoffIso: string,
    windowMs = ACTIVE_ALARM_WINDOW_MS,
): string | undefined {
    const cutoffMs = Date.parse(cutoffIso);
    if (!Number.isFinite(cutoffMs)) return undefined;
    return new Date(cutoffMs - windowMs).toISOString();
}

export function computeActiveAlarmPhenomenonTime(
    cutoffIso: string,
    windowMs = ACTIVE_ALARM_WINDOW_MS,
    minTimestampMs?: number,
): string | undefined {
    const cutoffMs = Date.parse(cutoffIso);
    if (!Number.isFinite(cutoffMs)) return undefined;
    const windowStartMs = cutoffMs - windowMs;
    const watermarkFloorMs = typeof minTimestampMs === "number"
        && Number.isFinite(minTimestampMs)
        && minTimestampMs > 0
        ? Math.max(0, minTimestampMs - 60_000)
        : 0;
    const startMs = Math.max(windowStartMs, watermarkFloorMs);
    return `${new Date(startMs).toISOString()}/..`;
}

export interface CountFetchOptions {
    signal?: AbortSignal;
    lowPriority?: boolean;
    phenomenonTime?: string;
}

export const deduplicateEvents = (events: EventTableData[]): EventTableData[] => {
    const result = new Map<string, EventTableData>();
    events.forEach(event => result.set(eventSelectionKey(event), event));
    return Array.from(result.values());
};

export function isAbortRequestError(error: unknown): boolean {
    if (!error) return false;
    if (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError") {
        return true;
    }
    return typeof error === "object" && "name" in error && (error as {name?: unknown}).name === "AbortError";
}

export async function fetchCollectionDataWithSignal(collection: any, signal?: AbortSignal): Promise<any[]> {
    if (!signal || typeof collection?.url !== "string" || typeof collection?.filter?.toQueryString !== "function") {
        return collection.fetchData();
    }
    const queryString = `${collection.filter.toQueryString()}&offset=${collection.pageOffset}&limit=${collection.pageSize}`;
    const fullUrl = `${collection.url}?${queryString}`;
    const response = await fetch(fullUrl, {
        method: "GET",
        credentials: "include",
        headers: collection.headers ?? {},
        signal,
    });
    if (!response.ok) {
        const err = new Error(`Got ${response.status} response from ${fullUrl}`) as Error & {response?: Response};
        err.response = response;
        throw err;
    }
    const payload = collection.responseFormat === "arraybuffer"
        ? await response.arrayBuffer()
        : await response.json();
    return collection.parseResponse(payload);
}

export async function fetchObservationPlanCount(
    plan: EventQueryPlan,
    cutoff: string,
    strict = false,
    options?: CountFetchOptions,
): Promise<number> {
    const params = new URLSearchParams({
        resultTime: `../${cutoff}`,
        format: "application/om+json",
        dataStream: plan.datastreamIds.join(","),
    });
    if (options?.phenomenonTime) params.set("phenomenonTime", options.phenomenonTime);
    if (plan.filter) params.set("filter", plan.filter);
    try {
        const requestInit: RequestInit = {
            headers: {...plan.node.getBasicAuthHeader(), "Content-Type": "sml+json"},
            credentials: "include",
            signal: options?.signal,
            ...(options?.lowPriority ? ({priority: "low"} as RequestInit) : {}),
        };
        const response = await fetch(`${plan.node.getConnectedSystemsEndpoint(false)}/observations/count?${params}`, requestInit);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return Number((await response.json()).count) || 0;
    } catch (error) {
        if (options?.signal?.aborted || isAbortRequestError(error)) {
            if (strict) throw error;
            return 0;
        }
        console.error("Error fetching filtered event count", error);
        if (strict) throw error;
        return 0;
    }
}

export interface HydratedEventQuerySnapshot {
    cacheKey: string;
    rows: EventTableData[];
    rowCount: number;
    page: number;
    pageLoadedTime: string;
    bucketCounts?: number[] | null;
}

export interface UseAbortableEventQueriesArgs {
    queryPlans: EventQueryPlan[];
    pageQueryPlans: EventQueryPlan[];
    page: number;
    pageSize: number;
    pageLoadedTime: string;
    phenomenonTimeForCutoff?: (cutoff: string, plan?: EventQueryPlan) => string | undefined;
    rowFilter?: (row: EventTableData) => boolean;
    sortComparator?: (left: EventTableData, right: EventTableData) => number;
    extraFetchRows?: number;
    filterModeActive?: boolean;
    /**
     * True when `pageQueryPlans` partitions the total query strictly in priority
     * order into pairwise-disjoint buckets (e.g. non-RS350 Gamma&Neutron -> Neutron -> Gamma -> None),
     * enabling O(pageSize) offset/limit slicing on page >= 1 instead of fetching `(page + 1) * pageSize`
     * rows from every priority bucket.
     */
    disjointPriorityPlans?: boolean;
    /**
     * When true alongside `disjointPriorityPlans`, lazily pre-warms per-bucket counts
     * at low priority once Page 0 has rendered and `rowCount > pageSize`, so clicking
     * Next (`>`) to Page 2+ slices immediately without waiting on count round-trips.
     */
    prewarmBucketCounts?: boolean;
    /**
     * When true, prefetches adjacent `page + 1` rows in the background once the current
     * page finishes rendering and additional rows exist, issuing zero `/observations/count`
     * requests and reusing any resolved or in-flight prefetch `Promise` on Next-page click.
     */
    prefetchNextPage?: boolean;
    pageChangeDebounceMs?: number;
    cachedSnapshot?: HydratedEventQuerySnapshot | null;
    fetchPlanRows: (
        plan: EventQueryPlan,
        limit: number,
        offset: number,
        cutoff?: string,
        signal?: AbortSignal,
    ) => Promise<EventTableData[]>;
}

const DEFAULT_PAGE_CHANGE_DEBOUNCE_MS = 120;
const BUCKET_COUNTS_PREWARM_DELAY_MS = 0;
const MAX_VISITED_PAGE_CACHE_ENTRIES = 64;

function buildBucketCountsCacheKey(
    effectiveCutoff: string,
    plans: EventQueryPlan[],
    phenomenonTimeForCutoff?: (cutoff: string, plan?: EventQueryPlan) => string | undefined,
): string {
    return `${effectiveCutoff}\u001e${plans
        .map(plan => `${plan.key}\u001f${plan.datastreamIds.join(",")}\u001f${plan.filter}\u001f${phenomenonTimeForCutoff?.(effectiveCutoff, plan) ?? ""}`)
        .join("\u001d")}`;
}

function buildNextPagePrefetchKey(args: {
    targetPage: number;
    pageSize: number;
    effectiveCutoff: string;
    plans: EventQueryPlan[];
    phenomenonTimeForCutoff?: (cutoff: string, plan?: EventQueryPlan) => string | undefined;
    disjointPriorityPlans: boolean;
    filterModeActive: boolean;
    boundedExtra: number;
    invalidationVersion: number;
}): string {
    const {
        targetPage,
        pageSize,
        effectiveCutoff,
        plans,
        phenomenonTimeForCutoff,
        disjointPriorityPlans,
        filterModeActive,
        boundedExtra,
        invalidationVersion,
    } = args;
    return [
        String(targetPage),
        String(pageSize),
        effectiveCutoff,
        disjointPriorityPlans ? "disjoint" : "merged",
        filterModeActive ? `filtered:${boundedExtra}` : "unfiltered",
        String(invalidationVersion),
        plans
            .map(plan => `${plan.key}\u001f${plan.datastreamIds.join(",")}\u001f${plan.filter}\u001f${phenomenonTimeForCutoff?.(effectiveCutoff, plan) ?? ""}`)
            .join("\u001d"),
    ].join("\u001e");
}

function sliceDisjointBucketPlans(
    plans: EventQueryPlan[],
    bucketCounts: number[],
    targetPage: number,
    pageSize: number,
): Array<{plan: EventQueryPlan; offset: number; limit: number}> {
    const winStart = targetPage * pageSize;
    const winEnd = winStart + pageSize;
    const slicePlans: Array<{plan: EventQueryPlan; offset: number; limit: number}> = [];
    let prefix = 0;
    for (let i = 0; i < plans.length; i++) {
        const bucketCount = Math.max(0, bucketCounts[i] ?? 0);
        const bucketStart = prefix;
        const bucketEnd = prefix + bucketCount;
        prefix = bucketEnd;
        const overlapStart = Math.max(winStart, bucketStart);
        const overlapEnd = Math.min(winEnd, bucketEnd);
        if (overlapStart < overlapEnd) {
            slicePlans.push({
                plan: plans[i],
                offset: overlapStart - bucketStart,
                limit: overlapEnd - overlapStart,
            });
        }
    }
    return slicePlans;
}

interface NextPagePrefetchEntry {
    key: string;
    targetPage: number;
    rows: EventTableData[] | null;
    promise: Promise<EventTableData[] | null>;
    controller: AbortController;
}

export interface UseAbortableEventQueriesResult {
    rows: EventTableData[];
    setRows: Dispatch<SetStateAction<EventTableData[]>>;
    rowCount: number;
    setRowCount: Dispatch<SetStateAction<number>>;
    loading: boolean;
    setLoading: Dispatch<SetStateAction<boolean>>;
    countQueryError: boolean;
    pageQueryError: boolean;
    currentPageRef: MutableRefObject<number>;
    getCachedBucketCounts: () => number[] | null;
    invalidatePrefetch: () => void;
    fetchPlanCount: (
        plan: EventQueryPlan,
        cutoff?: string,
        strict?: boolean,
        options?: CountFetchOptions,
    ) => Promise<number>;
    refreshCounts: (cutoffOverride?: string) => Promise<void>;
    fetchPage: (targetPage: number, cutoffOverride?: string, minExtraRows?: number) => Promise<void>;
}

export function useAbortableEventQueries({
    queryPlans,
    pageQueryPlans,
    page,
    pageSize,
    pageLoadedTime,
    phenomenonTimeForCutoff,
    rowFilter,
    sortComparator = sortEventsByAlarmPriority,
    extraFetchRows = 0,
    filterModeActive = false,
    disjointPriorityPlans = false,
    prewarmBucketCounts = false,
    prefetchNextPage = false,
    pageChangeDebounceMs = DEFAULT_PAGE_CHANGE_DEBOUNCE_MS,
    cachedSnapshot = null,
    fetchPlanRows,
}: UseAbortableEventQueriesArgs): UseAbortableEventQueriesResult {
    const [rows, setRows] = useState<EventTableData[]>(() => cachedSnapshot?.rows ?? []);
    const [rowCount, setRowCount] = useState(() => cachedSnapshot?.rowCount ?? 0);
    const [loading, setLoading] = useState(false);
    const [countQueryError, setCountQueryError] = useState(false);
    const [pageQueryError, setPageQueryError] = useState(false);
    const [prefetchEpoch, setPrefetchEpoch] = useState(0);
    const currentPageRef = useRef(page);
    const previousPageRef = useRef(page);
    const pageRef = useRef(page);
    const renderedPageRef = useRef<number | null>(cachedSnapshot ? cachedSnapshot.page : null);
    const cachedSnapshotRef = useRef(cachedSnapshot);
    const activeCutoffRef = useRef(pageLoadedTime);
    const countSettledRef = useRef(cachedSnapshot !== null);
    const loadingRef = useRef(loading);
    const pageQueryErrorRef = useRef(pageQueryError);
    const rowCountRef = useRef(rowCount);
    const rowsLengthRef = useRef(rows.length);
    pageRef.current = page;
    cachedSnapshotRef.current = cachedSnapshot;
    loadingRef.current = loading;
    pageQueryErrorRef.current = pageQueryError;
    rowCountRef.current = rowCount;
    rowsLengthRef.current = rows.length;
    const lastPageChangeMsRef = useRef(-Infinity);
    const countRequestRef = useRef(0);
    const pageRequestRef = useRef(0);
    const prefetchInvalidationRef = useRef(0);
    const countAbortRef = useRef<AbortController | null>(null);
    const pageAbortRef = useRef<AbortController | null>(null);
    const pageDebounceTimerRef = useRef<number | null>(null);
    const prewarmTimerRef = useRef<number | null>(null);
    const bucketCountsCacheRef = useRef<{key: string; counts: number[]} | null>(null);
    const bucketCountsInFlightRef = useRef<{
        key: string;
        promise: Promise<number[]>;
        controller: AbortController;
    } | null>(null);
    const nextPagePrefetchRef = useRef<NextPagePrefetchEntry | null>(null);
    const visitedPagesCacheRef = useRef<Map<string, EventTableData[]>>(new Map());
    const navigationDirectionRef = useRef<1 | -1>(1);
    const maybeStartNextPagePrefetchRef = useRef<() => void>(() => {});
    const rowFilterRef = useRef(rowFilter);
    const sortComparatorRef = useRef(sortComparator);
    const extraFetchRowsRef = useRef(extraFetchRows);
    rowFilterRef.current = rowFilter;
    sortComparatorRef.current = sortComparator;
    extraFetchRowsRef.current = extraFetchRows;

    const cacheVisitedPage = useCallback((cacheKey: string | null, pageRows: EventTableData[]) => {
        if (!prefetchNextPage || !cacheKey) return;
        const map = visitedPagesCacheRef.current;
        map.delete(cacheKey);
        map.set(cacheKey, pageRows);
        while (map.size > MAX_VISITED_PAGE_CACHE_ENTRIES) {
            const oldestKey = map.keys().next().value;
            if (oldestKey === undefined) break;
            map.delete(oldestKey);
        }
    }, [prefetchNextPage]);

    const clearPendingPageDebounce = useCallback(() => {
        if (pageDebounceTimerRef.current !== null && typeof window !== "undefined") {
            window.clearTimeout(pageDebounceTimerRef.current);
            pageDebounceTimerRef.current = null;
        }
    }, []);

    const clearNextPagePrefetch = useCallback(() => {
        if (nextPagePrefetchRef.current) {
            nextPagePrefetchRef.current.controller.abort();
            nextPagePrefetchRef.current = null;
        }
    }, []);

    const invalidatePrefetch = useCallback(() => {
        prefetchInvalidationRef.current += 1;
        visitedPagesCacheRef.current.clear();
        clearNextPagePrefetch();
        if (prefetchNextPage) {
            setPrefetchEpoch(previous => previous + 1);
        }
    }, [clearNextPagePrefetch, prefetchNextPage]);

    const clearPendingBucketPrewarm = useCallback(() => {
        if (prewarmTimerRef.current !== null && typeof window !== "undefined") {
            window.clearTimeout(prewarmTimerRef.current);
            prewarmTimerRef.current = null;
        }
        if (bucketCountsInFlightRef.current) {
            bucketCountsInFlightRef.current.controller.abort();
            bucketCountsInFlightRef.current = null;
        }
    }, []);

    useEffect(() => () => {
        clearPendingPageDebounce();
        clearPendingBucketPrewarm();
        clearNextPagePrefetch();
        countAbortRef.current?.abort();
        pageAbortRef.current?.abort();
    }, [clearNextPagePrefetch, clearPendingPageDebounce, clearPendingBucketPrewarm]);

    const fetchPlanCount = useCallback(
        (
            plan: EventQueryPlan,
            cutoff = pageLoadedTime,
            strict = false,
            options?: CountFetchOptions,
        ) => {
            const phenomenonTime = options?.phenomenonTime ?? phenomenonTimeForCutoff?.(cutoff, plan);
            const mergedOptions = phenomenonTime && options?.phenomenonTime === undefined
                ? {...options, phenomenonTime}
                : options;
            return fetchObservationPlanCount(plan, cutoff, strict, mergedOptions);
        },
        [pageLoadedTime, phenomenonTimeForCutoff],
    );

    const refreshCounts = useCallback(async (cutoffOverride?: string) => {
        if (cutoffOverride !== undefined) {
            activeCutoffRef.current = cutoffOverride;
            prefetchInvalidationRef.current += 1;
            visitedPagesCacheRef.current.clear();
            clearNextPagePrefetch();
        }
        const effectiveCutoff = cutoffOverride ?? activeCutoffRef.current;
        countSettledRef.current = false;
        countAbortRef.current?.abort();
        const requestId = ++countRequestRef.current;
        if (queryPlans.length === 0) {
            countAbortRef.current = null;
            countSettledRef.current = true;
            rowCountRef.current = 0;
            setRowCount(0);
            setCountQueryError(false);
            return;
        }
        const controller = new AbortController();
        countAbortRef.current = controller;
        try {
            const counts = await runWithConcurrency(
                queryPlans,
                6,
                plan => fetchPlanCount(plan, effectiveCutoff, true, {
                    signal: controller.signal,
                    lowPriority: true,
                }),
            );
            if (controller.signal.aborted || requestId !== countRequestRef.current) return;
            const total = counts.reduce((sum, count) => sum + count, 0);
            countSettledRef.current = true;
            rowCountRef.current = total;
            setRowCount(total);
            setCountQueryError(false);
        } catch (error) {
            if (
                controller.signal.aborted
                || isAbortRequestError(error)
                || isTunnelAuthReloadPending()
                || requestId !== countRequestRef.current
            ) return;
            console.error("Error fetching filtered event counts", error);
            setCountQueryError(true);
        } finally {
            if (countAbortRef.current === controller) {
                countAbortRef.current = null;
            }
        }
    }, [clearNextPagePrefetch, queryPlans, fetchPlanCount]);

    const fetchPage = useCallback(async (targetPage: number, cutoffOverride?: string, minExtraRows = 0) => {
        clearPendingPageDebounce();
        if (cutoffOverride !== undefined) {
            activeCutoffRef.current = cutoffOverride;
            prefetchInvalidationRef.current += 1;
            visitedPagesCacheRef.current.clear();
            clearNextPagePrefetch();
        } else if (minExtraRows > 0) {
            prefetchInvalidationRef.current += 1;
            visitedPagesCacheRef.current.clear();
            clearNextPagePrefetch();
        }
        const effectiveCutoff = cutoffOverride ?? activeCutoffRef.current;
        pageAbortRef.current?.abort();
        const requestId = ++pageRequestRef.current;
        if (pageQueryPlans.length === 0) {
            pageAbortRef.current = null;
            clearNextPagePrefetch();
            renderedPageRef.current = targetPage;
            rowsLengthRef.current = 0;
            loadingRef.current = false;
            pageQueryErrorRef.current = false;
            setRows([]);
            setLoading(false);
            setPageQueryError(false);
            return;
        }

        const requestedExtra = Math.max(extraFetchRowsRef.current || 0, minExtraRows || 0);
        const boundedExtra = filterModeActive
            ? Math.max(0, Math.min(requestedExtra, 50))
            : 0;
        const expectedPrefetchKey = cutoffOverride === undefined && minExtraRows <= 0
            ? buildNextPagePrefetchKey({
                targetPage,
                pageSize,
                effectiveCutoff,
                plans: pageQueryPlans,
                phenomenonTimeForCutoff,
                disjointPriorityPlans,
                filterModeActive,
                boundedExtra,
                invalidationVersion: prefetchInvalidationRef.current,
            })
            : null;

        if (prefetchNextPage && targetPage >= 1 && expectedPrefetchKey) {
            const cachedVisited = visitedPagesCacheRef.current.get(expectedPrefetchKey);
            if (cachedVisited !== undefined) {
                cacheVisitedPage(expectedPrefetchKey, cachedVisited);
                if (nextPagePrefetchRef.current && nextPagePrefetchRef.current.key !== expectedPrefetchKey) {
                    clearNextPagePrefetch();
                } else if (nextPagePrefetchRef.current?.key === expectedPrefetchKey) {
                    nextPagePrefetchRef.current = null;
                }
                pageAbortRef.current = null;
                renderedPageRef.current = targetPage;
                currentPageRef.current = targetPage;
                rowsLengthRef.current = cachedVisited.length;
                loadingRef.current = false;
                pageQueryErrorRef.current = false;
                setRows(cachedVisited);
                setPageQueryError(false);
                setLoading(false);
                setPrefetchEpoch(previous => previous + 1);
                return;
            }
        }

        const matchingPrefetch = expectedPrefetchKey && nextPagePrefetchRef.current?.key === expectedPrefetchKey
            ? nextPagePrefetchRef.current
            : null;
        if (nextPagePrefetchRef.current && !matchingPrefetch) {
            clearNextPagePrefetch();
        }

        if (matchingPrefetch && matchingPrefetch.rows !== null) {
            const prefetchedRows = matchingPrefetch.rows;
            if (targetPage >= 1) {
                cacheVisitedPage(expectedPrefetchKey, prefetchedRows);
            }
            pageAbortRef.current = null;
            nextPagePrefetchRef.current = null;
            renderedPageRef.current = targetPage;
            currentPageRef.current = targetPage;
            rowsLengthRef.current = prefetchedRows.length;
            loadingRef.current = false;
            pageQueryErrorRef.current = false;
            setRows(prefetchedRows);
            setPageQueryError(false);
            setLoading(false);
            if (prefetchNextPage) {
                setPrefetchEpoch(previous => previous + 1);
            }
            return;
        }

        const controller = new AbortController();
        pageAbortRef.current = controller;
        loadingRef.current = true;
        setLoading(true);
        try {
            if (matchingPrefetch) {
                const onAbort = () => matchingPrefetch.controller.abort();
                controller.signal.addEventListener("abort", onAbort, {once: true});
                try {
                    const awaitedRows = await matchingPrefetch.promise;
                    if (controller.signal.aborted || requestId !== pageRequestRef.current) return;
                    if (awaitedRows !== null) {
                        if (targetPage >= 1) {
                            cacheVisitedPage(expectedPrefetchKey, awaitedRows);
                        }
                        renderedPageRef.current = targetPage;
                        currentPageRef.current = targetPage;
                        rowsLengthRef.current = awaitedRows.length;
                        pageQueryErrorRef.current = false;
                        setRows(awaitedRows);
                        setPageQueryError(false);
                        return;
                    }
                } catch (prefetchErr) {
                    if (
                        controller.signal.aborted
                        || isAbortRequestError(prefetchErr)
                        || requestId !== pageRequestRef.current
                    ) {
                        return;
                    }
                } finally {
                    controller.signal.removeEventListener("abort", onAbort);
                    if (nextPagePrefetchRef.current === matchingPrefetch) {
                        nextPagePrefetchRef.current = null;
                    }
                }
            }
            if (pageQueryPlans.length === 1 && !filterModeActive) {
                const pageRows = await fetchPlanRows(
                    pageQueryPlans[0],
                    pageSize,
                    targetPage * pageSize,
                    effectiveCutoff,
                    controller.signal,
                );
                if (controller.signal.aborted || requestId !== pageRequestRef.current) return;
                const deduped = deduplicateEvents(pageRows);
                if (targetPage >= 1) {
                    cacheVisitedPage(expectedPrefetchKey, deduped);
                }
                renderedPageRef.current = targetPage;
                currentPageRef.current = targetPage;
                rowsLengthRef.current = deduped.length;
                pageQueryErrorRef.current = false;
                setRows(deduped);
                setPageQueryError(false);
                return;
            }
            if (disjointPriorityPlans && !filterModeActive && targetPage >= 1 && pageQueryPlans.length > 1) {
                const cacheKey = buildBucketCountsCacheKey(effectiveCutoff, pageQueryPlans, phenomenonTimeForCutoff);
                let bucketCounts = bucketCountsCacheRef.current?.key === cacheKey
                    ? bucketCountsCacheRef.current.counts
                    : null;
                if (!bucketCounts && bucketCountsInFlightRef.current?.key === cacheKey) {
                    try {
                        const awaitedCounts = await bucketCountsInFlightRef.current.promise;
                        if (controller.signal.aborted || requestId !== pageRequestRef.current) return;
                        bucketCounts = awaitedCounts;
                    } catch (prewarmErr) {
                        if (controller.signal.aborted || requestId !== pageRequestRef.current) {
                            return;
                        }
                        if (!isAbortRequestError(prewarmErr)) {
                            bucketCounts = null;
                        }
                    }
                }
                if (!bucketCounts) {
                    try {
                        const fetchedCounts = await runWithConcurrency(
                            pageQueryPlans,
                            6,
                            plan => fetchPlanCount(plan, effectiveCutoff, true, {
                                signal: controller.signal,
                            }),
                        );
                        if (controller.signal.aborted || requestId !== pageRequestRef.current) return;
                        bucketCounts = fetchedCounts;
                        bucketCountsCacheRef.current = {key: cacheKey, counts: fetchedCounts};
                    } catch (countErr) {
                        if (controller.signal.aborted || isAbortRequestError(countErr) || requestId !== pageRequestRef.current) {
                            return;
                        }
                        bucketCounts = null;
                    }
                }
                if (bucketCounts) {
                    const slicePlans = sliceDisjointBucketPlans(pageQueryPlans, bucketCounts, targetPage, pageSize);
                    if (slicePlans.length === 0) {
                        if (controller.signal.aborted || requestId !== pageRequestRef.current) return;
                        cacheVisitedPage(expectedPrefetchKey, []);
                        renderedPageRef.current = targetPage;
                        currentPageRef.current = targetPage;
                        rowsLengthRef.current = 0;
                        pageQueryErrorRef.current = false;
                        setRows([]);
                        setPageQueryError(false);
                        return;
                    }
                    const sliceResults = await runWithConcurrency(
                        slicePlans,
                        6,
                        slice => fetchPlanRows(
                            slice.plan,
                            slice.limit,
                            slice.offset,
                            effectiveCutoff,
                            controller.signal,
                        ),
                    );
                    if (controller.signal.aborted || requestId !== pageRequestRef.current) return;
                    const slicedRows = deduplicateEvents(sliceResults.flat()).slice(0, pageSize);
                    cacheVisitedPage(expectedPrefetchKey, slicedRows);
                    renderedPageRef.current = targetPage;
                    currentPageRef.current = targetPage;
                    rowsLengthRef.current = slicedRows.length;
                    pageQueryErrorRef.current = false;
                    setRows(slicedRows);
                    setPageQueryError(false);
                    return;
                }
            }
            const required = (targetPage + 1) * pageSize;
            const fetchLimit = required + boundedExtra;
            const results = await runWithConcurrency(
                pageQueryPlans,
                6,
                plan => fetchPlanRows(plan, fetchLimit, 0, effectiveCutoff, controller.signal),
            );
            if (controller.signal.aborted || requestId !== pageRequestRef.current) return;
            const deduped = deduplicateEvents(results.flat());
            const activeRowFilter = filterModeActive ? rowFilterRef.current : undefined;
            const filtered = activeRowFilter ? deduped.filter(activeRowFilter) : deduped;
            const merged = filtered.sort(sortComparatorRef.current);
            const pageSlice = merged.slice(targetPage * pageSize, required);
            if (targetPage >= 1) {
                cacheVisitedPage(expectedPrefetchKey, pageSlice);
            }
            renderedPageRef.current = targetPage;
            currentPageRef.current = targetPage;
            rowsLengthRef.current = pageSlice.length;
            pageQueryErrorRef.current = false;
            setRows(pageSlice);
            setPageQueryError(false);
        } catch (error) {
            if (
                controller.signal.aborted
                || isAbortRequestError(error)
                || isTunnelAuthReloadPending()
                || requestId !== pageRequestRef.current
            ) return;
            console.error("Error fetching filtered events", error);
            pageQueryErrorRef.current = true;
            if (renderedPageRef.current === null) {
                rowsLengthRef.current = 0;
                setRows([]);
            }
            setPageQueryError(true);
        } finally {
            if (pageAbortRef.current === controller) {
                pageAbortRef.current = null;
            }
            if (!controller.signal.aborted && requestId === pageRequestRef.current) {
                loadingRef.current = false;
                setLoading(false);
            }
        }
    }, [
        cacheVisitedPage,
        clearNextPagePrefetch,
        clearPendingPageDebounce,
        disjointPriorityPlans,
        fetchPlanCount,
        fetchPlanRows,
        filterModeActive,
        pageQueryPlans,
        pageSize,
        phenomenonTimeForCutoff,
        prefetchNextPage,
    ]);

    const maybeStartNextPagePrefetch = useCallback(() => {
        const snap = cachedSnapshotRef.current;
        const currentPage = pageRef.current;
        if (
            !prefetchNextPage
            || typeof window === "undefined"
            || loadingRef.current
            || pageQueryErrorRef.current
            || renderedPageRef.current !== currentPage
            || pageQueryPlans.length === 0
            || (snap !== null && snap.pageLoadedTime === pageLoadedTime && snap.page === currentPage)
        ) {
            return;
        }

        const direction = navigationDirectionRef.current;
        const nextPage = direction < 0 ? currentPage - 1 : currentPage + 1;
        if (nextPage < 1) {
            return;
        }
        const singlePlanUnfiltered = pageQueryPlans.length === 1 && !filterModeActive;
        const hasKnownMoreRows = rowCountRef.current > nextPage * pageSize;
        const hasPendingCountFullPage = !countSettledRef.current && (
            (singlePlanUnfiltered && rowsLengthRef.current >= pageSize)
            || nextPage < currentPage
        );
        if (!hasKnownMoreRows && !hasPendingCountFullPage) {
            return;
        }

        const effectiveCutoff = activeCutoffRef.current;
        const requestedExtra = extraFetchRowsRef.current || 0;
        const boundedExtra = filterModeActive
            ? Math.max(0, Math.min(requestedExtra, 50))
            : 0;
        const prefetchKey = buildNextPagePrefetchKey({
            targetPage: nextPage,
            pageSize,
            effectiveCutoff,
            plans: pageQueryPlans,
            phenomenonTimeForCutoff,
            disjointPriorityPlans,
            filterModeActive,
            boundedExtra,
            invalidationVersion: prefetchInvalidationRef.current,
        });

        if (
            visitedPagesCacheRef.current.has(prefetchKey)
            || nextPagePrefetchRef.current?.key === prefetchKey
        ) {
            return;
        }

        if (disjointPriorityPlans && !filterModeActive && pageQueryPlans.length > 1) {
            const bucketKey = buildBucketCountsCacheKey(effectiveCutoff, pageQueryPlans, phenomenonTimeForCutoff);
            const hasCachedBuckets = bucketCountsCacheRef.current?.key === bucketKey;
            const hasInFlightBuckets = bucketCountsInFlightRef.current?.key === bucketKey;
            if (!hasCachedBuckets && !hasInFlightBuckets) {
                return;
            }
        }

        clearNextPagePrefetch();
        const prefetchController = new AbortController();
        const entry: NextPagePrefetchEntry = {
            key: prefetchKey,
            targetPage: nextPage,
            rows: null,
            promise: Promise.resolve(null),
            controller: prefetchController,
        };

        const runPrefetch = async (): Promise<EventTableData[] | null> => {
            if (prefetchController.signal.aborted) return null;
            if (singlePlanUnfiltered) {
                const pageRows = await fetchPlanRows(
                    pageQueryPlans[0],
                    pageSize,
                    nextPage * pageSize,
                    effectiveCutoff,
                    prefetchController.signal,
                );
                if (prefetchController.signal.aborted) return null;
                return deduplicateEvents(pageRows);
            }
            if (disjointPriorityPlans && !filterModeActive && pageQueryPlans.length > 1) {
                const bucketKey = buildBucketCountsCacheKey(effectiveCutoff, pageQueryPlans, phenomenonTimeForCutoff);
                let bucketCounts = bucketCountsCacheRef.current?.key === bucketKey
                    ? bucketCountsCacheRef.current.counts
                    : null;
                if (!bucketCounts && bucketCountsInFlightRef.current?.key === bucketKey) {
                    bucketCounts = await bucketCountsInFlightRef.current.promise;
                }
                if (prefetchController.signal.aborted || !bucketCounts) {
                    return null;
                }
                const slicePlans = sliceDisjointBucketPlans(pageQueryPlans, bucketCounts, nextPage, pageSize);
                if (slicePlans.length === 0) {
                    return [];
                }
                const sliceResults = await runWithConcurrency(
                    slicePlans,
                    6,
                    slice => fetchPlanRows(
                        slice.plan,
                        slice.limit,
                        slice.offset,
                        effectiveCutoff,
                        prefetchController.signal,
                    ),
                );
                if (prefetchController.signal.aborted) return null;
                return deduplicateEvents(sliceResults.flat()).slice(0, pageSize);
            }
            const required = (nextPage + 1) * pageSize;
            const fetchLimit = required + boundedExtra;
            const results = await runWithConcurrency(
                pageQueryPlans,
                6,
                plan => fetchPlanRows(plan, fetchLimit, 0, effectiveCutoff, prefetchController.signal),
            );
            if (prefetchController.signal.aborted) return null;
            const deduped = deduplicateEvents(results.flat());
            const activeRowFilter = filterModeActive ? rowFilterRef.current : undefined;
            const filtered = activeRowFilter ? deduped.filter(activeRowFilter) : deduped;
            const merged = filtered.sort(sortComparatorRef.current);
            return merged.slice(nextPage * pageSize, required);
        };

        entry.promise = runPrefetch()
            .then(prefetchedRows => {
                if (!prefetchController.signal.aborted && nextPagePrefetchRef.current === entry && prefetchedRows !== null) {
                    entry.rows = prefetchedRows;
                }
                return prefetchedRows;
            })
            .catch((err): EventTableData[] | null => {
                if (nextPagePrefetchRef.current === entry) {
                    nextPagePrefetchRef.current = null;
                }
                if (prefetchController.signal.aborted || isAbortRequestError(err)) {
                    return null;
                }
                throw err;
            });
        void entry.promise.catch(() => {});
        nextPagePrefetchRef.current = entry;
    }, [
        clearNextPagePrefetch,
        disjointPriorityPlans,
        fetchPlanRows,
        filterModeActive,
        pageLoadedTime,
        pageQueryPlans,
        pageSize,
        phenomenonTimeForCutoff,
        prefetchNextPage,
    ]);
    maybeStartNextPagePrefetchRef.current = maybeStartNextPagePrefetch;

    useEffect(() => {
        clearPendingPageDebounce();
        clearPendingBucketPrewarm();
        clearNextPagePrefetch();
        visitedPagesCacheRef.current.clear();
        navigationDirectionRef.current = 1;
        activeCutoffRef.current = pageLoadedTime;
        lastPageChangeMsRef.current = -Infinity;
        const snap = cachedSnapshotRef.current;
        if (
            snap
            && snap.pageLoadedTime === pageLoadedTime
            && snap.page === pageRef.current
            && pageQueryPlans.length > 0
        ) {
            countAbortRef.current?.abort();
            pageAbortRef.current?.abort();
            countAbortRef.current = null;
            pageAbortRef.current = null;
            ++countRequestRef.current;
            ++pageRequestRef.current;
            if (snap.bucketCounts && snap.bucketCounts.length === pageQueryPlans.length) {
                bucketCountsCacheRef.current = {
                    key: buildBucketCountsCacheKey(pageLoadedTime, pageQueryPlans, phenomenonTimeForCutoff),
                    counts: snap.bucketCounts,
                };
            } else {
                bucketCountsCacheRef.current = null;
            }
            if (snap.page >= 1) {
                const requestedExtra = extraFetchRowsRef.current || 0;
                const boundedExtra = filterModeActive
                    ? Math.max(0, Math.min(requestedExtra, 50))
                    : 0;
                const snapKey = buildNextPagePrefetchKey({
                    targetPage: snap.page,
                    pageSize,
                    effectiveCutoff: pageLoadedTime,
                    plans: pageQueryPlans,
                    phenomenonTimeForCutoff,
                    disjointPriorityPlans,
                    filterModeActive,
                    boundedExtra,
                    invalidationVersion: prefetchInvalidationRef.current,
                });
                cacheVisitedPage(snapKey, snap.rows);
            }
            countSettledRef.current = true;
            renderedPageRef.current = snap.page;
            previousPageRef.current = snap.page;
            currentPageRef.current = snap.page;
            rowsLengthRef.current = snap.rows.length;
            rowCountRef.current = snap.rowCount;
            loadingRef.current = false;
            pageQueryErrorRef.current = false;
            setRows(snap.rows);
            setRowCount(snap.rowCount);
            setCountQueryError(false);
            setPageQueryError(false);
            setLoading(false);
            return;
        }
        bucketCountsCacheRef.current = null;
        renderedPageRef.current = null;
        const targetPage = pageRef.current;
        previousPageRef.current = targetPage;
        currentPageRef.current = targetPage;
        void refreshCounts();
        void fetchPage(targetPage);
    }, [
        cacheVisitedPage,
        clearNextPagePrefetch,
        clearPendingPageDebounce,
        clearPendingBucketPrewarm,
        disjointPriorityPlans,
        filterModeActive,
        refreshCounts,
        fetchPage,
        pageLoadedTime,
        pageQueryPlans,
        pageSize,
        phenomenonTimeForCutoff,
    ]);

    useEffect(() => {
        const snap = cachedSnapshotRef.current;
        if (
            !prewarmBucketCounts
            || !disjointPriorityPlans
            || filterModeActive
            || pageQueryPlans.length <= 1
            || rowCount <= pageSize
            || typeof window === "undefined"
            || (snap !== null && snap.pageLoadedTime === pageLoadedTime && !snap.bucketCounts)
        ) {
            return;
        }
        const effectiveCutoff = activeCutoffRef.current;
        const cacheKey = buildBucketCountsCacheKey(effectiveCutoff, pageQueryPlans, phenomenonTimeForCutoff);
        if (
            bucketCountsCacheRef.current?.key === cacheKey
            || bucketCountsInFlightRef.current?.key === cacheKey
        ) {
            return;
        }
        if (prewarmTimerRef.current !== null) {
            window.clearTimeout(prewarmTimerRef.current);
        }
        prewarmTimerRef.current = window.setTimeout(() => {
            prewarmTimerRef.current = null;
            if (
                bucketCountsCacheRef.current?.key === cacheKey
                || bucketCountsInFlightRef.current?.key === cacheKey
            ) {
                return;
            }
            const prewarmController = new AbortController();
            const promise = runWithConcurrency(
                pageQueryPlans,
                6,
                plan => fetchPlanCount(plan, effectiveCutoff, true, {
                    signal: prewarmController.signal,
                    lowPriority: true,
                }),
            );
            bucketCountsInFlightRef.current = {
                key: cacheKey,
                promise,
                controller: prewarmController,
            };
            maybeStartNextPagePrefetchRef.current();
            void promise
                .then(counts => {
                    if (!prewarmController.signal.aborted) {
                        bucketCountsCacheRef.current = {key: cacheKey, counts};
                        maybeStartNextPagePrefetchRef.current();
                    }
                })
                .catch(() => {
                    // Fallback interactive bucket-count path handles any prewarm error on page >= 1.
                })
                .finally(() => {
                    if (bucketCountsInFlightRef.current?.controller === prewarmController) {
                        bucketCountsInFlightRef.current = null;
                    }
                });
        }, BUCKET_COUNTS_PREWARM_DELAY_MS);
        return () => {
            if (prewarmTimerRef.current !== null && typeof window !== "undefined") {
                window.clearTimeout(prewarmTimerRef.current);
                prewarmTimerRef.current = null;
            }
        };
    }, [
        prewarmBucketCounts,
        disjointPriorityPlans,
        filterModeActive,
        pageQueryPlans,
        rowCount,
        pageSize,
        pageLoadedTime,
        phenomenonTimeForCutoff,
        fetchPlanCount,
        prefetchEpoch,
    ]);

    useEffect(() => {
        const previousPage = previousPageRef.current;
        previousPageRef.current = page;
        currentPageRef.current = page;
        if (page !== previousPage) {
            navigationDirectionRef.current = page < previousPage ? -1 : 1;
            const snap = cachedSnapshotRef.current;
            if (snap && snap.pageLoadedTime === pageLoadedTime && snap.page === page && pageQueryPlans.length > 0) {
                clearPendingPageDebounce();
                pageAbortRef.current?.abort();
                pageAbortRef.current = null;
                ++pageRequestRef.current;
                renderedPageRef.current = snap.page;
                rowsLengthRef.current = snap.rows.length;
                rowCountRef.current = snap.rowCount;
                loadingRef.current = false;
                pageQueryErrorRef.current = false;
                setRows(snap.rows);
                setRowCount(snap.rowCount);
                setPageQueryError(false);
                setLoading(false);
                return;
            }
            const hadPendingDebounce = pageDebounceTimerRef.current !== null;
            const hadActiveFetch = pageAbortRef.current !== null;
            const now = typeof performance !== "undefined" ? performance.now() : Date.now();
            const rapidFollowUp =
                hadPendingDebounce
                || hadActiveFetch
                || now - lastPageChangeMsRef.current < pageChangeDebounceMs;
            lastPageChangeMsRef.current = now;
            clearPendingPageDebounce();
            pageAbortRef.current?.abort();
            pageAbortRef.current = null;
            ++pageRequestRef.current;
            if (pageQueryPlans.length === 0) {
                clearNextPagePrefetch();
                renderedPageRef.current = page;
                rowsLengthRef.current = 0;
                loadingRef.current = false;
                setRows([]);
                setLoading(false);
                return;
            }
            // Instant 0ms render without debounce if targetPage >= 1 is already in visitedPagesCacheRef or resolved in nextPagePrefetchRef
            if (prefetchNextPage && page >= 1) {
                const requestedExtra = extraFetchRowsRef.current || 0;
                const boundedExtra = filterModeActive
                    ? Math.max(0, Math.min(requestedExtra, 50))
                    : 0;
                const targetKey = buildNextPagePrefetchKey({
                    targetPage: page,
                    pageSize,
                    effectiveCutoff: activeCutoffRef.current,
                    plans: pageQueryPlans,
                    phenomenonTimeForCutoff,
                    disjointPriorityPlans,
                    filterModeActive,
                    boundedExtra,
                    invalidationVersion: prefetchInvalidationRef.current,
                });
                if (
                    visitedPagesCacheRef.current.has(targetKey)
                    || (nextPagePrefetchRef.current?.key === targetKey && nextPagePrefetchRef.current.rows !== null)
                ) {
                    void fetchPage(page);
                    return;
                }
            }
            if (pageChangeDebounceMs <= 0 || typeof window === "undefined" || !rapidFollowUp) {
                void fetchPage(page);
                return;
            }
            loadingRef.current = true;
            setLoading(true);
            pageDebounceTimerRef.current = window.setTimeout(() => {
                pageDebounceTimerRef.current = null;
                void fetchPage(page);
            }, pageChangeDebounceMs);
        }
        return () => {
            clearPendingPageDebounce();
        };
    }, [
        page,
        fetchPage,
        clearNextPagePrefetch,
        clearPendingPageDebounce,
        disjointPriorityPlans,
        filterModeActive,
        pageChangeDebounceMs,
        pageLoadedTime,
        pageQueryPlans,
        pageSize,
        phenomenonTimeForCutoff,
        prefetchNextPage,
    ]);

    useEffect(() => {
        maybeStartNextPagePrefetch();
    }, [
        maybeStartNextPagePrefetch,
        loading,
        pageQueryError,
        page,
        rowCount,
        rows.length,
        extraFetchRows,
        prefetchEpoch,
    ]);

    const getCachedBucketCounts = useCallback((): number[] | null => {
        const cacheKey = buildBucketCountsCacheKey(activeCutoffRef.current, pageQueryPlans, phenomenonTimeForCutoff);
        return bucketCountsCacheRef.current?.key === cacheKey
            ? bucketCountsCacheRef.current.counts
            : null;
    }, [pageQueryPlans, phenomenonTimeForCutoff]);

    return {
        rows,
        setRows,
        rowCount,
        setRowCount,
        loading,
        setLoading,
        countQueryError,
        pageQueryError,
        currentPageRef,
        getCachedBucketCounts,
        invalidatePrefetch,
        fetchPlanCount,
        refreshCounts,
        fetchPage,
    };
}
