"use client";

import {useCallback, useContext, useEffect, useMemo, useRef, useState} from "react";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Snackbar,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import {useSelector} from "react-redux";
import {
    DataGrid,
    GRID_CHECKBOX_SELECTION_FIELD,
    GridActionsCellItem,
    GridCellParams,
    gridClasses,
    GridColDef,
    GridColumnOrderChangeParams,
    GridColumnResizeParams,
    GridColumnVisibilityModel,
    useGridApiRef,
    GridRowParams,
    GridRowSelectionModel,
    GridSortModel,
} from "@mui/x-data-grid";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import CompareArrowsRoundedIcon from "@mui/icons-material/CompareArrowsRounded";
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import LayersRoundedIcon from "@mui/icons-material/LayersRounded";
import dynamic from "next/dynamic";
import DataStream from "osh-js/source/core/sweapi/datastream/DataStream.js";
import ObservationFilter from "osh-js/source/core/sweapi/observation/ObservationFilter";
import Observations from "osh-js/source/core/consysapi/observation/Observations";
import {EventType} from "osh-js/source/core/event/EventType";
import {useRouter} from "next/navigation";

import {
    acquireSharedConnection,
    findRealtimeDataSourceForStream,
    LaneMapEntry,
    type SharedConnectionLease,
} from "@/lib/data/oscar/LaneCollection";
import {EventTableData, sortEventsByAlarmPriority, sortEventsByTimeDesc} from "@/lib/data/oscar/TableHelpers";
import {
    adjudicationCodeMarker,
    AdjudicationCodes,
} from "@/lib/data/oscar/adjudication/models/AdjudicationConstants";
import {
    extractLatestAdjudicationCode,
    hasEmlNonThreatMarker,
    hasExtendedOccupancyGammaMarker,
} from "@/lib/data/oscar/adjudication/EmlMetadata";
import {
    buildUpSetCoOccurrenceFromEvents,
    computeEventUpSetMask,
    isUpSetFilterValidForData,
    matchesUpSetFilter,
    UpSetFilterSelection,
} from "@/lib/data/oscar/adjudication/IsotopeMapping";
import UpSetPlot from "@/app/_components/common/UpSetPlot";
import {useCustomAdjudicationCodes} from "@/app/hooks/useCustomAdjudicationCodes";
import {isOccupancyDataStream, isThresholdDataStream} from "@/lib/data/oscar/Utilities";
import {convertToMap} from "@/app/utils/Utils";
import {OCCUPANCY_PILLAR_DEF} from "@/lib/data/Constants";
import {getObservations} from "@/app/utils/ChartUtils";
import {useAppDispatch} from "@/lib/state/Hooks";
import {
    selectSelectedRowId,
    setEventPreview,
    setLatestGB,
    setSelectedRowId,
} from "@/lib/state/EventPreviewSlice";
import {
    selectAdjudicatedEventId,
    selectDashboardAcknowledgeNonce,
    selectDashboardUnreadOnly,
    setAdjudicatedEventId,
    setDashboardUnreadAlarmCount,
    setDashboardUnreadAlarmSummary,
    setDashboardUnreadOnly,
    setSelectedEvent,
    toggleDashboardUnreadOnly,
} from "@/lib/state/EventDataSlice";
import {
    DashboardReadStateFetch,
    hasRowContentFilter,
    inspectPostWatermarkReadKeys,
    MAX_UNREAD_RECONCILIATION_FETCH,
    parseAlarmTimestampMs,
    ScopedLaneTarget,
    UNREAD_COUNT_RECONCILIATION_CAP,
    useDashboardAlarmReadState,
} from "@/lib/data/oscar/DashboardAlarmReadState";
import {useLanguage} from "@/app/contexts/LanguageContext";
import {NotificationService, NotificationTemplates} from "../notifications/NotificationService";
import {formatOccupancyStatus, getDataGridLocaleText, getIntlLocale} from "@/app/utils/LocaleUtils";
import {DataSourceContext} from "@/app/contexts/DataSourceContext";
import CustomToolbar, {ToolbarTimeWindowOption} from "@/app/_components/CustomToolbar";
import NestedEventFilterDialog from "@/app/_components/event-table/NestedEventFilterDialog";
import BulkAdjudicationDialog, {BulkAdjudicationSummary} from "@/app/_components/event-table/BulkAdjudicationDialog";
import {
    combineServerFilters,
    compileEventFilterForLane,
    countEventFilterRules,
    createEventFilterGroup,
    EventFilterGroup,
    eventMatchesFilter,
    eventSelectionKey,
    extractPrimaryVehicleIdRule,
    hasVehicleIdFilterRule,
} from "@/lib/data/oscar/EventFilter";
import VehiclePassComparisonDialog from "@/app/_components/vehicle/VehiclePassComparisonDialog";
import {
    extractUffUuidFromOmniboxInput,
    fetchActiveCargoUffInfo,
    searchCargoUff,
    UffSearchMatch,
} from "@/lib/data/oscar/CargoUffApi";

const CargoUffViewerDialog = dynamic(
    () => import("@/app/_components/uff/CargoUffViewerDialog"),
    {ssr: false},
);
import {
    DEFAULT_VEHICLE_SEARCH_LIMIT_PER_NODE,
    FederatedVehicleSearchResult,
    normalizeVehicleId,
    searchVehiclePassesAcrossNodes,
    VEHICLE_SEARCH_WINDOW_MS,
    VehicleSearchMatchMode,
    VehicleSearchWindowPreset,
} from "@/lib/data/oscar/VehicleSearch";
import {
    adjudicateEvents,
    BulkAdjudicationOutcome,
    BulkAdjudicationValues,
    runWithConcurrency,
} from "@/lib/data/oscar/BulkAdjudication";
import {
    buildEventDetailsHref,
    createEventFromOccupancyObservation,
} from "@/lib/data/oscar/EventLookup";
import {
    removeRealtimeEventSubscription,
    resolveRealtimeEventForNotification,
    type RealtimeEventHandler,
} from "@/lib/data/oscar/RealtimeEventNotification";
import {
    ACTIVE_ALARM_WINDOW_MS,
    ALARM_TIME_WINDOW_PRESET_MS,
    AlarmTimeWindowPreset,
    computeActiveAlarmPhenomenonTime,
    deduplicateEvents,
    EventQueryPlan,
    fetchCollectionDataWithSignal,
    isAbortRequestError,
    useAbortableEventQueries,
} from "@/lib/data/oscar/EventTableRequests";
import {formatIso6346} from "@/lib/data/oscar/adjudication/Iso6346";
import {useVehicleOcrMap} from "@/app/_components/event-table/useVehicleOcrMap";
import SavedQueriesPopover from "@/app/_components/event-table/SavedQueriesPopover";
import {EventTableColumnSetting} from "@/lib/layout/PageConfigTypes";
import {
    applyColumnSettings,
    applyFieldOrder,
    resolveEventTableColumns,
    visibilityFromColumnSettings,
} from "@/lib/layout/EventTableColumns";
import {
    CachedEventLogQuerySnapshot,
    clearFilteredEventLogSnapshot,
    deleteSavedEventQueryBookmark,
    EventLogQueryCriteria,
    getFilteredEventLogRestoreState,
    hasActiveEventLogCriteria,
    loadSavedEventQueries,
    SavedEventQueryBookmark,
    saveEventQueryBookmark,
    setCurrentEventLogFilteredFlag,
    setFilteredEventLogSnapshot,
    summarizeEventLogQuery,
} from "@/lib/data/oscar/SavedEventQueries";

export {fetchCollectionDataWithSignal, isAbortRequestError};

interface TableProps {
    tableMode: "eventlog" | "alarmtable" | "lanelog";
    viewSecondary?: boolean;
    currentLane?: string;
    viewMenu?: boolean;
    viewLane?: boolean;
    viewAdjudicated?: boolean;
    laneMap: Map<string, LaneMapEntry>;
    setEvents?: unknown;
    readStateFetch?: DashboardReadStateFetch;
    restoreFiltered?: boolean;
    /**
     * Custom-page widgets only: persisted column visibility/order/width. ORNL's own pages pass
     * nothing and keep the default columns. Changes made in the grid are reported through
     * onColumnSettingsChange so the widget can persist them.
     */
    columnSettings?: EventTableColumnSetting[];
    onColumnSettingsChange?: (columns: EventTableColumnSetting[]) => void;
    /** Custom-page widgets only: fill the parent's height instead of the fixed page heights. */
    fillHeight?: boolean;
}

type QueryPlan = EventQueryPlan;

const PAGE_SIZE = 15;
const BULK_FETCH_SIZE = 5000;
const MAX_UPSET_SUMMARY_EVENTS = 1000;
const REALTIME_ID_RESOLUTION_TIMEOUT_MS = 12_000;
const MAX_EVENT_CACHE_ENTRIES = 1000;

const EVENT_PRIORITY_FILTERS = [
    "gammaAlarm=true AND neutronAlarm=true",
    "gammaAlarm=false AND neutronAlarm=true",
    "gammaAlarm=true AND neutronAlarm=false",
    "gammaAlarm=false AND neutronAlarm=false",
];

export default function EventTable({
    tableMode,
    viewAdjudicated = false,
    laneMap,
    currentLane,
    readStateFetch,
    restoreFiltered,
    columnSettings,
    onColumnSettingsChange,
    fillHeight = false,
}: TableProps) {
    const isAlarmTable = tableMode === "alarmtable";
    const isEventLog = tableMode === "eventlog";
    const selectedRowId = useSelector(selectSelectedRowId);
    const adjudicatedEventId = useSelector(selectAdjudicatedEventId);
    const dashboardAcknowledgeNonce = useSelector(selectDashboardAcknowledgeNonce);
    const unreadOnly = useSelector(selectDashboardUnreadOnly);
    const effectiveUnreadOnly = isAlarmTable && unreadOnly;
    const lastHandledAckNonceRef = useRef(dashboardAcknowledgeNonce);
    const [ackStatusMessage, setAckStatusMessage] = useState("");
    const [sortByTimeOnly, setSortByTimeOnly] = useState(false);
    const supportsSortByTimeToggle = isAlarmTable || isEventLog;
    const effectiveSortByTimeOnly = supportsSortByTimeToggle && sortByTimeOnly;
    const effectiveSortByTimeOnlyRef = useRef(effectiveSortByTimeOnly);
    effectiveSortByTimeOnlyRef.current = effectiveSortByTimeOnly;
    const [sortModel, setSortModel] = useState<GridSortModel>([{field: "status", sort: "asc"}]);
    const [timeWindowPreset, setTimeWindowPreset] = useState<AlarmTimeWindowPreset>("15d");
    const activeAlarmWindowMs = isAlarmTable
        ? ALARM_TIME_WINDOW_PRESET_MS[timeWindowPreset]
        : ACTIVE_ALARM_WINDOW_MS;
    const [unreadReconcileEpoch, setUnreadReconcileEpoch] = useState(0);
    const [scopedUnreadSummary, setScopedUnreadSummary] = useState<{count: number; capped: boolean}>({
        count: 0,
        capped: false,
    });
    const [scopedUnreadReady, setScopedUnreadReady] = useState(false);
    const dispatch = useAppDispatch();
    const router = useRouter();
    const {activeViewKey, scopedHref} = useContext(DataSourceContext);
    const {language, t} = useLanguage();
    const locale = getIntlLocale(language);

    const [initialHydration] = useState(() => {
        if (!isEventLog) return null;
        const shouldRestore = restoreFiltered === true
            || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("restore") === "1");
        if (!shouldRestore) return null;
        return getFilteredEventLogRestoreState(activeViewKey);
    });

    const [restoredSnapshot, setRestoredSnapshot] = useState<CachedEventLogQuerySnapshot | null>(
        () => initialHydration?.snapshot ?? null,
    );
    const restoredSnapshotRef = useRef<CachedEventLogQuerySnapshot | null>(restoredSnapshot);
    restoredSnapshotRef.current = restoredSnapshot;
    const [savedBookmarks, setSavedBookmarks] = useState<SavedEventQueryBookmark[]>(
        () => (isEventLog ? loadSavedEventQueries() : []),
    );
    const [savedQueriesAnchorEl, setSavedQueriesAnchorEl] = useState<HTMLElement | null>(null);

    const stableLaneMap = useMemo(() => convertToMap(laneMap), [laneMap]);
    const [paginationModel, setPaginationModel] = useState(() => ({
        page: initialHydration?.snapshot?.page ?? 0,
        pageSize: PAGE_SIZE,
    }));
    const [columnVisibilityModel, setColumnVisibilityModel] = useState<GridColumnVisibilityModel>(() => ({
        adjudicatedIds: viewAdjudicated,
        adjudicationCode: viewAdjudicated,
        vehicleId: Boolean(initialHydration?.criteria.vehicleSearch),
        ...(columnSettings ? visibilityFromColumnSettings(columnSettings) : {}),
    }));
    const gridApiRef = useGridApiRef();
    const [syncedViewAdjudicated, setSyncedViewAdjudicated] = useState(viewAdjudicated);
    if (syncedViewAdjudicated !== viewAdjudicated) {
        setSyncedViewAdjudicated(viewAdjudicated);
        setColumnVisibilityModel(previous => ({
            ...previous,
            adjudicatedIds: viewAdjudicated,
            adjudicationCode: viewAdjudicated,
        }));
    }
    const [filterEpoch, setFilterEpoch] = useState(0);
    const [filter, setFilter] = useState<EventFilterGroup>(
        () => initialHydration?.criteria.filter ?? createEventFilterGroup(),
    );
    const [filterDialogOpen, setFilterDialogOpen] = useState(false);
    const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
    const [bulkSelectionError, setBulkSelectionError] = useState(false);
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const [allFilteredSelected, setAllFilteredSelected] = useState(false);
    const [allFilteredTotal, setAllFilteredTotal] = useState(0);
    const [excludedKeys, setExcludedKeys] = useState<Set<string>>(new Set());
    const [postSelectionKeys, setPostSelectionKeys] = useState<Set<string>>(new Set());

    // Vehicle ID search & multi-pass comparison state
    const [vehicleSearchInput, setVehicleSearchInput] = useState(
        () => initialHydration?.criteria.vehicleSearch?.query ?? "",
    );
    const [vehicleSearchMatchMode, setVehicleSearchMatchMode] = useState<"contains" | "equals" | "startsWith">(
        () => initialHydration?.criteria.vehicleSearch?.matchMode ?? "contains",
    );
    const [vehicleSearchWindow, setVehicleSearchWindow] = useState<VehicleSearchWindowPreset>(
        () => initialHydration?.criteria.vehicleSearch?.window ?? "30d",
    );
    const [submittedVehicleQuery, setSubmittedVehicleQuery] = useState<{
        query: string;
        matchMode: VehicleSearchMatchMode;
        window: VehicleSearchWindowPreset;
        nonce: number;
    } | null>(() =>
        initialHydration?.criteria.vehicleSearch
            ? {
                query: initialHydration.criteria.vehicleSearch.query,
                matchMode: initialHydration.criteria.vehicleSearch.matchMode,
                window: initialHydration.criteria.vehicleSearch.window,
                nonce: 0,
            }
            : null,
    );
    const [vehicleSearchResult, setVehicleSearchResult] = useState<FederatedVehicleSearchResult | null>(
        () => initialHydration?.snapshot?.vehicleSearchResult ?? null,
    );
    const [vehicleSearchLoading, setVehicleSearchLoading] = useState(false);
    const [vehicleSearchError, setVehicleSearchError] = useState<string | null>(null);
    const [comparisonDialogState, setComparisonDialogState] = useState<{
        vehicleId: string;
        matchMode: VehicleSearchMatchMode;
        highlightObsId?: string | null;
        initialResult?: FederatedVehicleSearchResult | null;
    } | null>(null);
    const [uffOmniboxMatches, setUffOmniboxMatches] = useState<UffSearchMatch[]>([]);
    const [eventLogUffViewerUuid, setEventLogUffViewerUuid] = useState<string | null>(null);
    const primaryEventLogNode = useMemo(
        () => Array.from(stableLaneMap.values())[0]?.parentNode ?? null,
        [stableLaneMap],
    );

    const filterVehicleRule = useMemo(() => extractPrimaryVehicleIdRule(filter), [filter]);
    const hasFilterVehicleRule = useMemo(() => hasVehicleIdFilterRule(filter), [filter]);
    const activeVehicleQuery = useMemo(() => {
        if (submittedVehicleQuery) {
            return {
                vehicleId: submittedVehicleQuery.query,
                matchMode: submittedVehicleQuery.matchMode,
                window: submittedVehicleQuery.window,
                nonce: submittedVehicleQuery.nonce,
            };
        }
        if (filterVehicleRule) {
            return {
                vehicleId: filterVehicleRule.value,
                matchMode: filterVehicleRule.matchMode,
                window: "all" as VehicleSearchWindowPreset,
                nonce: filterEpoch,
            };
        }
        return null;
    }, [filterEpoch, filterVehicleRule, submittedVehicleQuery]);

    const isVehicleSearchMode = Boolean(activeVehicleQuery);
    const wantsVehicleIdColumn = Boolean(columnVisibilityModel.vehicleId) || isVehicleSearchMode || hasFilterVehicleRule;

    useEffect(() => {
        if ((isVehicleSearchMode || hasFilterVehicleRule) && !columnVisibilityModel.vehicleId) {
            setColumnVisibilityModel(previous => ({...previous, vehicleId: true}));
        }
    }, [columnVisibilityModel.vehicleId, hasFilterVehicleRule, isVehicleSearchMode]);

    const [syncedUnreadOnly, setSyncedUnreadOnly] = useState(effectiveUnreadOnly);
    if (syncedUnreadOnly !== effectiveUnreadOnly) {
        setSyncedUnreadOnly(effectiveUnreadOnly);
        if (paginationModel.page !== 0) {
            setPaginationModel(previous => ({...previous, page: 0}));
        }
        setFilterEpoch(previous => previous + 1);
        setSelectedKeys(new Set());
        setExcludedKeys(new Set());
        setPostSelectionKeys(new Set());
        setAllFilteredSelected(false);
        setAllFilteredTotal(0);
    }

    const latestCutoffRef = useRef<string>(
        initialHydration?.snapshot?.latestCutoff
        ?? initialHydration?.snapshot?.pageLoadedTime
        ?? new Date().toISOString(),
    );
    // Stamp the REST snapshot upper bound when discovered lanes hydrate (or when filters
    // are re-applied), rather than at empty initial mount before MQTT subscriptions exist.
    const pageLoadedTime = useMemo(
        () => {
            const snap = restoredSnapshotRef.current;
            if (isEventLog && snap && stableLaneMap.size > 0) {
                latestCutoffRef.current = snap.latestCutoff || snap.pageLoadedTime;
                return snap.pageLoadedTime;
            }
            const now = new Date().toISOString();
            latestCutoffRef.current = now;
            return now;
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [stableLaneMap, filterEpoch, isEventLog],
    );
    const allFilteredCutoffRef = useRef<string | null>(null);
    const eventCacheRef = useRef<Map<string, EventTableData>>(new Map());
    const selectedKeysRef = useRef<Set<string>>(selectedKeys);
    const selectedRowIdRef = useRef(selectedRowId);
    const realtimeResolutionJobsRef = useRef<Set<{
        controller: AbortController;
        cancelledByCleanup: boolean;
        timeout: number;
    }>>(new Set());
    const failedBulkRef = useRef<EventTableData[]>([]);

    const nodeOptions = useMemo(() => Array.from(new Set(Array.from(stableLaneMap.values()).map(lane => lane.parentNode.name))).sort(), [stableLaneMap]);
    const laneOptions = useMemo(() => Array.from(new Set(Array.from(stableLaneMap.values()).map(lane => lane.laneName))).sort(), [stableLaneMap]);

    const customCodeNodes = useMemo(() => {
        if (!viewAdjudicated && !filterDialogOpen) return [];
        const unique = new Map<string, any>();
        for (const lane of stableLaneMap.values()) {
            const node = lane.parentNode as any;
            if (
                node?.id &&
                typeof node.getConnectedSystemsEndpoint === "function" &&
                typeof node.fetchDataStreamWithObservedProperty === "function" &&
                typeof node.createRealtimeObservationSource === "function"
            ) {
                unique.set(node.id, node);
            }
        }
        return Array.from(unique.values());
    }, [filterDialogOpen, stableLaneMap, viewAdjudicated]);
    const {codes: customAdjudicationCodes} = useCustomAdjudicationCodes(customCodeNodes, {mode: "union"});

    const formatAdjudicationCodeLabel = useCallback((code: number): string => {
        const builtIn = AdjudicationCodes.codes.find(entry => entry.code === code && entry.code > 0);
        if (builtIn) return t(`adjudicationCode.${builtIn.code}`);
        const custom = customAdjudicationCodes.find(entry => entry.code === code);
        if (custom) return t("customAdjudicationCodeLabel", {code: custom.code, label: custom.label});
        return t("customAdjudicationCodeLabel", {code, label: `${code}`});
    }, [customAdjudicationCodes, t]);

    const adjudicationCodeOptions = useMemo(() => [
        ...AdjudicationCodes.codes
            .filter(entry => entry.code > 0)
            .map(entry => ({
                value: String(entry.code),
                label: t(`adjudicationCode.${entry.code}`),
            })),
        ...customAdjudicationCodes.map(entry => ({
            value: String(entry.code),
            label: t("customAdjudicationCodeLabel", {code: entry.code, label: entry.label}),
        })),
    ], [customAdjudicationCodes, t]);

    const baseServerFilter = useMemo(() => {
        if (tableMode === "alarmtable")
            return "(gammaAlarm=true OR neutronAlarm=true) AND adjudicatedIdsCount=0";
        return "";
    }, [tableMode]);

    useEffect(() => {
        allFilteredCutoffRef.current = null;
        failedBulkRef.current = [];
    }, [syncedUnreadOnly]);

    const laneByDataStreamId = useMemo(() => {
        const index = new Map<string, LaneMapEntry>();
        for (const lane of stableLaneMap.values()) {
            for (const stream of lane.datastreams as any[]) {
                const streamId = stream?.properties?.id;
                if (typeof streamId === "string" && streamId.length > 0 && !index.has(streamId)) {
                    index.set(streamId, lane);
                }
            }
        }
        return index;
    }, [stableLaneMap]);

    const findLaneByDataStreamId = useCallback(
        (datastreamId: string): LaneMapEntry | undefined => laneByDataStreamId.get(datastreamId),
        [laneByDataStreamId],
    );

    const readStateNodes = useMemo(() => {
        if (!isAlarmTable) return [];
        const unique = new Map<string, any>();
        for (const lane of stableLaneMap.values()) {
            const node = lane.parentNode as any;
            if (node?.id && !unique.has(node.id)) {
                unique.set(node.id, node);
            }
        }
        return Array.from(unique.values());
    }, [isAlarmTable, stableLaneMap]);

    const {
        nodeStates,
        getLaneReadState,
        isEventRead,
        markEventsRead,
        acknowledgeLanes,
    } = useDashboardAlarmReadState(readStateNodes, isAlarmTable, readStateFetch);

    const resolveEventNodeId = useCallback(
        (event: EventTableData): string | undefined =>
            findLaneByDataStreamId(event.dataStreamId)?.parentNode.id
            ?? stableLaneMap.get(event.laneId)?.parentNode.id,
        [findLaneByDataStreamId, stableLaneMap],
    );

    const isRowUnread = useCallback(
        (row: EventTableData): boolean => {
            if (!isAlarmTable) return false;
            if (row.status === "None" || (row.adjudicatedIds?.length ?? 0) > 0) return false;
            return !isEventRead(row, resolveEventNodeId(row));
        },
        [isAlarmTable, isEventRead, resolveEventNodeId],
    );

    const isEventReadRef = useRef(isEventRead);
    const markEventsReadRef = useRef(markEventsRead);
    const isRowUnreadRef = useRef(isRowUnread);
    const activeAlarmWindowMsRef = useRef(activeAlarmWindowMs);
    const effectiveUnreadOnlyRef = useRef(effectiveUnreadOnly);
    isEventReadRef.current = isEventRead;
    markEventsReadRef.current = markEventsRead;
    isRowUnreadRef.current = isRowUnread;
    activeAlarmWindowMsRef.current = activeAlarmWindowMs;
    effectiveUnreadOnlyRef.current = effectiveUnreadOnly;

    const laneWatermarksSignature = useMemo(() => {
        if (!isAlarmTable) return "";
        const parts: string[] = [];
        for (const lane of stableLaneMap.values()) {
            const ackMs = nodeStates.get(lane.parentNode.id)?.lanes.get(lane.laneName)?.acknowledgedThroughMs ?? 0;
            if (ackMs > 0) {
                parts.push(`${lane.parentNode.id}\u001f${lane.laneName}\u001f${ackMs}`);
            }
        }
        parts.sort();
        return parts.join("\u001e");
    }, [isAlarmTable, nodeStates, stableLaneMap]);

    const laneWatermarksByKey = useMemo(() => {
        const map = new Map<string, number>();
        if (!laneWatermarksSignature) return map;
        for (const entry of laneWatermarksSignature.split("\u001e")) {
            const sep = entry.lastIndexOf("\u001f");
            if (sep <= 0) continue;
            const key = entry.slice(0, sep);
            const ackMs = Number(entry.slice(sep + 1));
            if (Number.isFinite(ackMs) && ackMs > 0) {
                map.set(key, ackMs);
            }
        }
        return map;
    }, [laneWatermarksSignature]);

    const readKeysSignature = useMemo(() => {
        if (!isAlarmTable) return "";
        const parts: string[] = [];
        for (const lane of stableLaneMap.values()) {
            const laneState = nodeStates.get(lane.parentNode.id)?.lanes.get(lane.laneName);
            if (laneState && laneState.readKeys.length > 0) {
                parts.push(
                    `${lane.parentNode.id}\u001f${lane.laneName}\u001f${laneState.readKeys.length}\u001f${laneState.readKeys[laneState.readKeys.length - 1]}`,
                );
            }
        }
        parts.sort();
        return parts.join("\u001e");
    }, [isAlarmTable, nodeStates, stableLaneMap]);

    const baseQueryPlans = useMemo<QueryPlan[]>(() => {
        const grouped = new Map<string, QueryPlan>();
        for (const lane of stableLaneMap.values()) {
            if (tableMode === "lanelog" && currentLane && lane.laneName !== currentLane) continue;
            const compiled = compileEventFilterForLane(filter, {
                nodeId: lane.parentNode.id,
                nodeName: lane.parentNode.name,
                laneId: lane.laneName,
            });
            if (compiled === false) continue;
            const serverFilter = combineServerFilters(baseServerFilter, compiled || "");
            const groupKey = `${lane.parentNode.id}\u001f${serverFilter}`;
            let plan = grouped.get(groupKey);
            if (!plan) {
                plan = {key: groupKey, node: lane.parentNode, datastreamIds: [], filter: serverFilter};
                grouped.set(groupKey, plan);
            }
            lane.datastreams
                .filter((stream: typeof DataStream) => isOccupancyDataStream(stream))
                .forEach((stream: typeof DataStream) => plan!.datastreamIds.push(stream.properties.id));
        }
        return Array.from(grouped.values())
            .map(plan => ({...plan, datastreamIds: Array.from(new Set(plan.datastreamIds))}))
            .filter(plan => plan.datastreamIds.length > 0);
    }, [stableLaneMap, tableMode, currentLane, filter, baseServerFilter]);

    const unreadScopePlanBundle = useMemo<{plans: QueryPlan[]; hasPositiveWatermark: boolean}>(() => {
        if (!isAlarmTable) return {plans: [], hasPositiveWatermark: false};
        const cutoffMs = Date.parse(pageLoadedTime);
        const windowStartMs = Number.isFinite(cutoffMs) ? Math.max(0, cutoffMs - activeAlarmWindowMs) : 0;
        const grouped = new Map<string, QueryPlan>();
        let hasPositiveWatermark = false;

        for (const lane of stableLaneMap.values()) {
            const compiled = compileEventFilterForLane(filter, {
                nodeId: lane.parentNode.id,
                nodeName: lane.parentNode.name,
                laneId: lane.laneName,
            });
            if (compiled === false) continue;

            const rawAckMs = laneWatermarksByKey.get(`${lane.parentNode.id}\u001f${lane.laneName}`) ?? 0;
            const effectiveAckMs = rawAckMs > 0 && (windowStartMs <= 0 || rawAckMs >= Math.max(0, windowStartMs - 60_000))
                ? rawAckMs
                : 0;
            if (effectiveAckMs > 0) {
                hasPositiveWatermark = true;
            }
            const watermarkFilter = effectiveAckMs > 0
                ? `endTime>'${new Date(effectiveAckMs).toISOString()}'`
                : "";
            const serverFilter = combineServerFilters(baseServerFilter, compiled || "", watermarkFilter);
            const groupKey = `${lane.parentNode.id}\u001f${serverFilter}\u001f${effectiveAckMs}`;
            let plan = grouped.get(groupKey);
            if (!plan) {
                plan = {
                    key: groupKey,
                    node: lane.parentNode,
                    datastreamIds: [],
                    filter: serverFilter,
                    ...(effectiveAckMs > 0 ? {minTimestampMs: effectiveAckMs} : {}),
                };
                grouped.set(groupKey, plan);
            }
            lane.datastreams
                .filter((stream: typeof DataStream) => isOccupancyDataStream(stream))
                .forEach((stream: typeof DataStream) => plan!.datastreamIds.push(stream.properties.id));
        }

        const plans = Array.from(grouped.values())
            .map(plan => ({...plan, datastreamIds: Array.from(new Set(plan.datastreamIds))}))
            .filter(plan => plan.datastreamIds.length > 0);
        return {plans, hasPositiveWatermark};
    }, [activeAlarmWindowMs, baseServerFilter, filter, isAlarmTable, laneWatermarksByKey, pageLoadedTime, stableLaneMap]);

    const postWatermarkReadKeysSummary = useMemo(() => {
        if (!isAlarmTable) return {hasPostWatermarkKeys: false, totalEstimatedCount: 0};
        const cutoffMs = Date.parse(pageLoadedTime);
        const windowStartMs = Number.isFinite(cutoffMs) ? Math.max(0, cutoffMs - activeAlarmWindowMs) : 0;
        let hasPostWatermarkKeys = false;
        let totalEstimatedCount = 0;

        for (const lane of stableLaneMap.values()) {
            const compiled = compileEventFilterForLane(filter, {
                nodeId: lane.parentNode.id,
                nodeName: lane.parentNode.name,
                laneId: lane.laneName,
            });
            if (compiled === false) continue;
            const summary = inspectPostWatermarkReadKeys(
                getLaneReadState(lane.parentNode.id, lane.laneName),
                windowStartMs,
            );
            if (summary.hasPostWatermarkKeys) {
                hasPostWatermarkKeys = true;
                totalEstimatedCount += summary.estimatedCount;
            }
        }
        return {hasPostWatermarkKeys, totalEstimatedCount};
    }, [activeAlarmWindowMs, filter, getLaneReadState, isAlarmTable, pageLoadedTime, stableLaneMap]);

    const queryPlans = effectiveUnreadOnly ? unreadScopePlanBundle.plans : baseQueryPlans;

    const hasRS350Lane = useMemo(() => {
        for (const lane of stableLaneMap.values()) {
            if (tableMode === "lanelog" && currentLane && lane.laneName !== currentLane) continue;
            if (lane.isRS350Backpack) return true;
        }
        return false;
    }, [stableLaneMap, tableMode, currentLane]);

    const pageQueryPlans = useMemo<QueryPlan[]>(() => {
        if (effectiveSortByTimeOnly) {
            return queryPlans.map(plan => ({
                ...plan,
                key: `${plan.key}\u001ftime-desc`,
            }));
        }
        const priorities = tableMode === "alarmtable"
            ? EVENT_PRIORITY_FILTERS.slice(0, 3)
            : EVENT_PRIORITY_FILTERS;
        return queryPlans.flatMap(plan => priorities.map(priorityFilter => ({
            ...plan,
            key: `${plan.key}\u001f${priorityFilter}`,
            filter: combineServerFilters(plan.filter, priorityFilter),
        })));
    }, [effectiveSortByTimeOnly, queryPlans, tableMode]);

    const bulkQueryPlans = useMemo<QueryPlan[]>(() => queryPlans.map(plan => ({
        ...plan,
        key: `${plan.key}\u001fbulk-eligible`,
        filter: combineServerFilters(plan.filter, "gammaAlarm=true OR neutronAlarm=true", "adjudicatedIdsCount=0"),
    })), [queryPlans]);

    const phenomenonTimeForCutoff = useCallback(
        (cutoff: string, plan?: QueryPlan): string | undefined =>
            tableMode === "alarmtable"
                ? computeActiveAlarmPhenomenonTime(cutoff, activeAlarmWindowMs, plan?.minTimestampMs)
                : undefined,
        [activeAlarmWindowMs, tableMode],
    );

    const notificationServiceRef = useRef<NotificationService | null>(null);
    useEffect(() => {
        if (!notificationServiceRef.current) notificationServiceRef.current = new NotificationService();
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.ready.then(registration => notificationServiceRef.current?.init(registration));
        }
    }, []);

    useEffect(() => {
        selectedRowIdRef.current = selectedRowId;
    }, [selectedRowId]);

    useEffect(() => {
        selectedKeysRef.current = selectedKeys;
    }, [selectedKeys]);

    const advanceSnapshotCutoff = useCallback((candidateTime?: string): string => {
        const nowIso = new Date().toISOString();
        let next = latestCutoffRef.current > nowIso ? latestCutoffRef.current : nowIso;
        if (candidateTime && candidateTime > next) {
            next = candidateTime;
        }
        latestCutoffRef.current = next;
        return next;
    }, []);

    const cacheEventBounded = useCallback((key: string, event: EventTableData) => {
        eventCacheRef.current.delete(key);
        eventCacheRef.current.set(key, event);
        if (eventCacheRef.current.size > MAX_EVENT_CACHE_ENTRIES) {
            for (const candidateKey of eventCacheRef.current.keys()) {
                if (!selectedKeysRef.current.has(candidateKey)) {
                    eventCacheRef.current.delete(candidateKey);
                    if (eventCacheRef.current.size <= MAX_EVENT_CACHE_ENTRIES) break;
                }
            }
        }
    }, []);

    const cancelRealtimeResolutionJobs = useCallback(() => {
        realtimeResolutionJobsRef.current.forEach(job => {
            job.cancelledByCleanup = true;
            window.clearTimeout(job.timeout);
            job.controller.abort();
        });
        realtimeResolutionJobsRef.current.clear();
    }, []);

    useEffect(() => () => cancelRealtimeResolutionJobs(), [cancelRealtimeResolutionJobs]);

    const sendNotification = useCallback(async (event: EventTableData, nodeId: string): Promise<void> => {
        if (event.status === "None" || !notificationServiceRef.current?.isReady()) return;
        try {
            await notificationServiceRef.current.showNotification(NotificationTemplates.newAlarm(event, {
                title: t("newAlarmTitle", {status: t(event.status === "Gamma & Neutron" ? "gammaAndNeutron" : event.status.toLowerCase())}),
                body: t("newAlarmBody", {lane: event.laneId, occupancyId: event.occupancyCount ?? ""}),
                viewAlarm: t("viewAlarm"),
                events: t("events"),
                dismiss: t("dismiss"),
            }, activeViewKey, nodeId));
        } catch (error) {
            console.error("Unable to show alarm notification", error);
        }
    }, [t, activeViewKey]);

    const eventFromObservation = useCallback((observation: any, lane: LaneMapEntry, live: boolean, cacheRow = true): EventTableData => {
        const event = createEventFromOccupancyObservation(observation, lane, !live);
        if (cacheRow) {
            cacheEventBounded(eventSelectionKey(event), event);
        }
        return event;
    }, [cacheEventBounded]);

    const fetchPlanRows = useCallback(async (
        plan: QueryPlan,
        limit: number,
        offset: number,
        cutoff = pageLoadedTime,
        signal?: AbortSignal,
        cacheRows = true,
    ) => {
        const effectiveCutoff = cutoff === pageLoadedTime && offset === 0 && limit <= PAGE_SIZE && latestCutoffRef.current > cutoff
            ? latestCutoffRef.current
            : cutoff;
        const phenomenonTime = phenomenonTimeForCutoff(effectiveCutoff, plan);
        const observationFilter = new ObservationFilter({
            dataStream: plan.datastreamIds,
            ...(phenomenonTime ? {phenomenonTime} : {}),
            resultTime: `../${effectiveCutoff}`,
            filter: plan.filter ? encodeURIComponent(plan.filter) : undefined,
            order: "desc",
        });
        const api: typeof Observations = await plan.node.getObservationsApi();
        const collection = await api.searchObservations(observationFilter, limit, offset);
        if (signal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
        }
        const observations = await fetchCollectionDataWithSignal(collection, signal);
        return observations.flatMap((observation: any) => {
            const lane = findLaneByDataStreamId(observation.properties["datastream@id"]);
            return lane ? [eventFromObservation(observation, lane, false, cacheRows)] : [];
        });
    }, [eventFromObservation, findLaneByDataStreamId, pageLoadedTime, phenomenonTimeForCutoff]);

    const effectiveQueryPlans = useMemo<QueryPlan[]>(
        () => (isEventLog && isVehicleSearchMode ? [] : queryPlans),
        [isEventLog, isVehicleSearchMode, queryPlans],
    );
    const effectivePageQueryPlans = useMemo<QueryPlan[]>(
        () => (isEventLog && isVehicleSearchMode ? [] : pageQueryPlans),
        [isEventLog, isVehicleSearchMode, pageQueryPlans],
    );

    const {
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
    } = useAbortableEventQueries({
        queryPlans: effectiveQueryPlans,
        pageQueryPlans: effectivePageQueryPlans,
        page: paginationModel.page,
        pageSize: paginationModel.pageSize,
        pageLoadedTime,
        phenomenonTimeForCutoff,
        rowFilter: isRowUnread,
        sortComparator: effectiveSortByTimeOnly ? sortEventsByTimeDesc : sortEventsByAlarmPriority,
        extraFetchRows: effectiveUnreadOnly ? postWatermarkReadKeysSummary.totalEstimatedCount : 0,
        filterModeActive: effectiveUnreadOnly,
        disjointPriorityPlans: !hasRS350Lane && effectiveQueryPlans.length === 1 && effectivePageQueryPlans.length > 1,
        prewarmBucketCounts: !hasRS350Lane && effectiveQueryPlans.length === 1 && effectivePageQueryPlans.length > 1,
        prefetchNextPage: true,
        cachedSnapshot: isEventLog ? restoredSnapshot : null,
        fetchPlanRows,
    });

    const replaceRealtimeEventIdentity = useCallback((original: EventTableData, resolved: EventTableData) => {
        if (!resolved.occupancyObsId || resolved === original) return;

        const originalKey = eventSelectionKey(original);
        const resolvedKey = eventSelectionKey(resolved);
        if (eventCacheRef.current.get(originalKey) === original)
            eventCacheRef.current.delete(originalKey);
        cacheEventBounded(resolvedKey, resolved);
        setRows(previous => deduplicateEvents(previous.map(row => row === original ? resolved : row)));

        const replaceKey = (previous: Set<string>) => {
            if (!previous.has(originalKey)) return previous;
            const next = new Set(previous);
            next.delete(originalKey);
            next.add(resolvedKey);
            return next;
        };
        setSelectedKeys(replaceKey);
        setExcludedKeys(replaceKey);
        setPostSelectionKeys(replaceKey);

        if (selectedRowIdRef.current === original.id) {
            dispatch(setEventPreview({isOpen: true, eventData: resolved}));
            dispatch(setSelectedEvent(resolved));
        }

        if (isAlarmTable && isEventReadRef.current(original, resolveEventNodeId(original))) {
            markEventsReadRef.current([resolved], resolveEventNodeId);
        }
    }, [cacheEventBounded, dispatch, isAlarmTable, resolveEventNodeId, setRows]);

    const resolveIdentityAndNotify = useCallback((event: EventTableData, lane: LaneMapEntry) => {
        if (event.status === "None" || (event.adjudicatedIds?.length ?? 0) > 0) return;

        // Alarm delivery is immediate. Until the durable observation exists,
        // the honest action opens Events; a successful resolution replaces
        // this notification with the direct Event Details action.
        const fallbackDelivery = sendNotification(event, lane.parentNode.id);

        const controller = new AbortController();
        const job = {
            controller,
            cancelledByCleanup: false,
            timeout: window.setTimeout(() => controller.abort(), REALTIME_ID_RESOLUTION_TIMEOUT_MS),
        };
        realtimeResolutionJobsRef.current.add(job);

        void resolveRealtimeEventForNotification(event, lane, controller.signal)
            .then(async resolved => {
                if (job.cancelledByCleanup) return;
                if (!resolved.occupancyObsId || resolved === event) return;
                replaceRealtimeEventIdentity(event, resolved);
                if ((resolved.adjudicatedIds?.length ?? 0) > 0) return;
                await fallbackDelivery;
                if (job.cancelledByCleanup) return;
                await sendNotification(resolved, lane.parentNode.id);
            })
            .catch(error => {
                if (job.cancelledByCleanup) return;
                console.error("Unable to resolve realtime event identity before notification", error);
            })
            .finally(() => {
                window.clearTimeout(job.timeout);
                realtimeResolutionJobsRef.current.delete(job);
            });
    }, [replaceRealtimeEventIdentity, sendNotification]);

    const rowPassesLocalFilters = useCallback((event: EventTableData, lane: LaneMapEntry): boolean => {
        if (tableMode === "alarmtable") {
            if (event.status === "None" || event.adjudicatedIds?.length > 0) return false;
            const endTimeMs = Date.parse(event.endTime || event.startTime);
            const cutoffMs = Date.parse(latestCutoffRef.current);
            if (
                Number.isFinite(endTimeMs)
                && Number.isFinite(cutoffMs)
                && endTimeMs < cutoffMs - activeAlarmWindowMsRef.current
            ) {
                return false;
            }
            if (effectiveUnreadOnlyRef.current && isEventReadRef.current(event, lane.parentNode.id)) {
                return false;
            }
        }
        if (tableMode === "lanelog" && currentLane && event.laneId !== currentLane) return false;
        return eventMatchesFilter(filter, event, {
            nodeId: lane.parentNode.id,
            nodeName: lane.parentNode.name,
            laneId: lane.laneName,
        });
    }, [tableMode, currentLane, filter]);

    useEffect(() => {
        if (stableLaneMap.size === 0) return;
        let active = true;
        const subscriptions: Array<{
            source: any;
            handler: RealtimeEventHandler;
            lease: SharedConnectionLease;
        }> = [];
        for (const lane of stableLaneMap.values()) {
            const occupancyStream: typeof DataStream = lane.findDataStreamByObsProperty(OCCUPANCY_PILLAR_DEF);
            if (!occupancyStream) continue;
            const source = findRealtimeDataSourceForStream(lane, occupancyStream);
            if (!source) continue;
            const handleMessage = (message: any) => {
                if (!active) return;
                try {
                    const event = eventFromObservation(message.values?.[0]?.data || message, lane, true);
                    event.setDataStreamId(occupancyStream.properties.id);
                    event.setRPMSystemId(occupancyStream.properties["system@id"]);
                    advanceSnapshotCutoff(event.endTime);
                    resolveIdentityAndNotify(event, lane);
                    const isLiveAlarm = isAlarmTable
                        && event.status !== "None"
                        && !event.adjudicatedIds?.length
                        && !isEventReadRef.current(event, lane.parentNode.id);
                    if (isLiveAlarm) {
                        const eventMs = parseAlarmTimestampMs(event);
                        const cutoffMs = Date.parse(latestCutoffRef.current);
                        const inActiveWindow = eventMs === null
                            || !Number.isFinite(cutoffMs)
                            || eventMs >= cutoffMs - activeAlarmWindowMsRef.current;
                        const matchesFilter = eventMatchesFilter(filter, event, {
                            nodeId: lane.parentNode.id,
                            nodeName: lane.parentNode.name,
                            laneId: lane.laneName,
                        });
                        if (inActiveWindow && matchesFilter) {
                            setScopedUnreadSummary(previous => (
                                previous.capped ? previous : {count: previous.count + 1, capped: false}
                            ));
                        }
                    }
                    if (!rowPassesLocalFilters(event, lane)) return;
                    invalidatePrefetch();
                    if (allFilteredCutoffRef.current && event.status !== "None" && !event.adjudicatedIds?.length) {
                        setPostSelectionKeys(previous => new Set(previous).add(eventSelectionKey(event)));
                    }
                    setRowCount(previous => previous + 1);
                    if (currentPageRef.current !== 0) return;
                    setRows(previous => deduplicateEvents([event, ...previous])
                        .sort(effectiveSortByTimeOnlyRef.current ? sortEventsByTimeDesc : sortEventsByAlarmPriority)
                        .slice(0, PAGE_SIZE));
                } catch (error) {
                    console.error("Error processing live occupancy event", error);
                }
            };
            source.subscribe(handleMessage, [EventType.DATA]);
            const lease = acquireSharedConnection(source);
            subscriptions.push({source, handler: handleMessage, lease});
            void lease.ready.catch((error) => {
                console.error("Error connecting occupancy source", error);
            });
        }
        return () => {
            active = false;
            cancelRealtimeResolutionJobs();
            subscriptions.forEach(({source, handler, lease}) => {
                removeRealtimeEventSubscription(source, handler);
                void lease.release().catch((error) => {
                    console.error("Error disconnecting occupancy source", error);
                });
            });
        };
    }, [
        stableLaneMap,
        eventFromObservation,
        rowPassesLocalFilters,
        resolveIdentityAndNotify,
        cancelRealtimeResolutionJobs,
        advanceSnapshotCutoff,
        currentPageRef,
        filter,
        invalidatePrefetch,
        isAlarmTable,
        setRowCount,
        setRows,
    ]);

    useEffect(() => {
        if (!adjudicatedEventId || tableMode !== "alarmtable") return;
        invalidatePrefetch();
        setRows(previous => previous.filter(row => row.id !== adjudicatedEventId));
        setRowCount(previous => Math.max(0, previous - 1));
        setUnreadReconcileEpoch(previous => previous + 1);
        dispatch(setAdjudicatedEventId(null));
        const cutoff = advanceSnapshotCutoff();
        void refreshCounts(cutoff);
        void fetchPage(currentPageRef.current, cutoff);
    }, [adjudicatedEventId, tableMode, dispatch, advanceSnapshotCutoff, invalidatePrefetch, refreshCounts, fetchPage, currentPageRef, setRowCount, setRows]);

    useEffect(() => {
        if (stableLaneMap.size === 0) return;
        const reconcileAfterReconnect = (evt?: Event) => {
            const resetForSandbox =
                evt instanceof CustomEvent && Boolean(evt.detail?.resetForSandboxInjection);
            invalidatePrefetch();
            if (resetForSandbox) {
                restoredSnapshotRef.current = null;
                setRestoredSnapshot(null);
                if (currentPageRef.current !== 0) {
                    setPaginationModel(previous => ({...previous, page: 0}));
                }
            }
            const cutoff = advanceSnapshotCutoff();
            setUnreadReconcileEpoch(previous => previous + 1);
            void refreshCounts(cutoff);
            if (resetForSandbox || currentPageRef.current === 0) {
                void fetchPage(0, cutoff);
            }
        };
        window.addEventListener("online", reconcileAfterReconnect);
        window.addEventListener("oscar:sandbox-events-mutated", reconcileAfterReconnect);
        return () => {
            window.removeEventListener("online", reconcileAfterReconnect);
            window.removeEventListener("oscar:sandbox-events-mutated", reconcileAfterReconnect);
        };
    }, [stableLaneMap.size, advanceSnapshotCutoff, invalidatePrefetch, refreshCounts, fetchPage, currentPageRef]);

    const clearSelection = useCallback(() => {
        setSelectedKeys(new Set());
        setExcludedKeys(new Set());
        setPostSelectionKeys(new Set());
        setAllFilteredSelected(false);
        setAllFilteredTotal(0);
        allFilteredCutoffRef.current = null;
        failedBulkRef.current = [];
    }, []);

    const applyFilter = (next: EventFilterGroup) => {
        restoredSnapshotRef.current = null;
        setRestoredSnapshot(null);
        if (isEventLog && countEventFilterRules(next) === 0 && !submittedVehicleQuery) {
            clearFilteredEventLogSnapshot(activeViewKey);
        }
        setFilter(next);
        setFilterDialogOpen(false);
        setPaginationModel(previous => ({...previous, page: 0}));
        setFilterEpoch(previous => previous + 1);
        clearSelection();
    };

    const handleSelectTimeWindowPreset = useCallback((nextPreset: AlarmTimeWindowPreset) => {
        if (nextPreset === timeWindowPreset) return;
        setTimeWindowPreset(nextPreset);
        setPaginationModel(previous => (previous.page === 0 ? previous : {...previous, page: 0}));
        setFilterEpoch(previous => previous + 1);
        clearSelection();
    }, [clearSelection, timeWindowPreset]);

    const handleToggleUnreadOnly = useCallback(() => {
        dispatch(toggleDashboardUnreadOnly());
    }, [dispatch]);

    const handleToggleSortByTimeOnly = useCallback(() => {
        const next = !sortByTimeOnly;
        restoredSnapshotRef.current = null;
        setRestoredSnapshot(null);
        setSortByTimeOnly(next);
        setSortModel(next ? [{field: "startTime", sort: "desc"}] : [{field: "status", sort: "asc"}]);
        setPaginationModel(previous => (previous.page === 0 ? previous : {...previous, page: 0}));
        setFilterEpoch(previous => previous + 1);
        setAckStatusMessage(
            next
                ? t(isAlarmTable ? "dashboardSortedByTimeAnnouncement" : "eventsSortedByTimeAnnouncement")
                : t(isAlarmTable ? "dashboardSortedByPriorityAnnouncement" : "eventsSortedByPriorityAnnouncement"),
        );
    }, [isAlarmTable, sortByTimeOnly, t]);

    const timeWindowOptions = useMemo<ToolbarTimeWindowOption[]>(
        () => [
            {value: "15m", label: t("timeWindow15m")},
            {value: "1h", label: t("timeWindow1h")},
            {value: "24h", label: t("timeWindow24h")},
            {value: "15d", label: t("timeWindow15d")},
        ],
        [t],
    );

    useEffect(() => {
        if (!activeVehicleQuery) {
            setVehicleSearchResult(null);
            setVehicleSearchLoading(false);
            setVehicleSearchError(null);
            setUffOmniboxMatches([]);
            return;
        }

        const controller = new AbortController();
        const omniboxUffUuid = isEventLog ? extractUffUuidFromOmniboxInput(activeVehicleQuery.vehicleId) : "";

        // When in Event Log and a search is explicitly active, query Cargo UFF if enabled on the node.
        // Zero requests are issued when no search is submitted or when Cargo UFF is disabled.
        const uffLookupPromise: Promise<UffSearchMatch[]> = isEventLog
            ? fetchActiveCargoUffInfo(primaryEventLogNode)
                .then(async info => {
                    if (!info.enabled || controller.signal.aborted) return [];
                    const uffRes = await searchCargoUff(
                        omniboxUffUuid
                            ? {uffId: activeVehicleQuery.vehicleId, limit: 5}
                            : {
                                vehicleId: activeVehicleQuery.vehicleId,
                                windowMinutes: 0,
                                fuzzy: true,
                                limit: 5,
                            },
                        primaryEventLogNode,
                        controller.signal,
                    );
                    return uffRes.matches ?? [];
                })
                .catch((): UffSearchMatch[] => [])
            : Promise.resolve([]);

        void uffLookupPromise.then(matches => {
            if (!controller.signal.aborted) {
                setUffOmniboxMatches(matches);
            }
        });

        if (stableLaneMap.size === 0) {
            return () => controller.abort();
        }

        const snapVehicle = isEventLog ? restoredSnapshotRef.current?.vehicleSearchResult : null;
        if (snapVehicle) {
            for (const pass of snapVehicle.passes) {
                cacheEventBounded(eventSelectionKey(pass.eventRow), pass.eventRow);
            }
            setVehicleSearchResult(snapVehicle);
            setVehicleSearchLoading(false);
            setVehicleSearchError(null);
            return () => controller.abort();
        }

        setVehicleSearchLoading(true);
        setVehicleSearchError(null);

        const startTimeIso =
            activeVehicleQuery.window === "all"
                ? null
                : new Date(Date.now() - VEHICLE_SEARCH_WINDOW_MS[activeVehicleQuery.window]).toISOString();

        void (async () => {
            try {
                let effectiveVehicleId = activeVehicleQuery.vehicleId;
                let effectiveMatchMode = activeVehicleQuery.matchMode;
                if (omniboxUffUuid) {
                    const uffMatches = await uffLookupPromise;
                    if (controller.signal.aborted) return;
                    if (uffMatches.length > 0) {
                        const correlatedId = uffMatches[0]?.displayVehicleIds?.[0];
                        if (correlatedId) {
                            effectiveVehicleId = correlatedId;
                            effectiveMatchMode = "equals";
                        } else {
                            setVehicleSearchResult({
                                rawVehicleId: activeVehicleQuery.vehicleId,
                                normalizedVehicleId: normalizeVehicleId(activeVehicleQuery.vehicleId),
                                formattedVehicleId: uffMatches[0]!.archiveFileName || omniboxUffUuid,
                                matchMode: activeVehicleQuery.matchMode,
                                passes: [],
                                summary: {
                                    totalPasses: 0,
                                    alarmingPasses: 0,
                                    openAlarmPasses: 0,
                                    emlAutoReleasePasses: 0,
                                    spectroscopicPasses: 0,
                                    distinctLanes: 0,
                                    distinctNodes: 0,
                                    confirmedIsotopes: [],
                                    latestDisposition: "",
                                },
                                truncated: false,
                                unreachableNodes: [],
                            });
                            return;
                        }
                    }
                }

                const res = await searchVehiclePassesAcrossNodes({
                    vehicleId: effectiveVehicleId,
                    matchMode: effectiveMatchMode,
                    laneMap: stableLaneMap,
                    activeViewKey,
                    startTimeIso,
                    signal: controller.signal,
                });
                if (controller.signal.aborted) return;
                for (const pass of res.passes) {
                    cacheEventBounded(eventSelectionKey(pass.eventRow), pass.eventRow);
                }
                setVehicleSearchResult(res);
            } catch (err) {
                if (controller.signal.aborted || (err instanceof Error && err.name === "AbortError")) return;
                setVehicleSearchError(err instanceof Error ? err.message : String(err));
            } finally {
                if (!controller.signal.aborted) {
                    setVehicleSearchLoading(false);
                }
            }
        })();

        return () => controller.abort();
    }, [activeVehicleQuery, activeViewKey, cacheEventBounded, isEventLog, primaryEventLogNode, stableLaneMap]);

    const vehicleFilteredRows = useMemo<EventTableData[]>(() => {
        if (!isVehicleSearchMode || !vehicleSearchResult) return [];
        const matched: EventTableData[] = [];
        for (const pass of vehicleSearchResult.passes) {
            if (tableMode === "lanelog" && currentLane && pass.laneName !== currentLane) continue;
            if (
                tableMode === "alarmtable"
                && (pass.eventRow.status === "None" || (pass.eventRow.adjudicatedIds?.length ?? 0) > 0)
            ) {
                continue;
            }
            if (
                !eventMatchesFilter(filter, pass.eventRow, {
                    nodeId: pass.nodeId,
                    nodeName: pass.nodeName,
                    laneId: pass.laneName,
                })
            ) {
                continue;
            }
            matched.push(pass.eventRow);
        }
        matched.sort((left, right) => right.getStartTimeNum() - left.getStartTimeNum());
        return matched;
    }, [currentLane, filter, isVehicleSearchMode, tableMode, vehicleSearchResult]);

    const vehiclePageRows = useMemo<EventTableData[]>(() => {
        if (!isVehicleSearchMode) return [];
        const startIdx = paginationModel.page * PAGE_SIZE;
        return vehicleFilteredRows.slice(startIdx, startIdx + PAGE_SIZE);
    }, [isVehicleSearchMode, paginationModel.page, vehicleFilteredRows]);

    const activePageSourceRows = isVehicleSearchMode ? vehiclePageRows : rows;

    const handleVehicleSearchSubmit = useCallback(
        (event?: React.FormEvent) => {
            event?.preventDefault();
            restoredSnapshotRef.current = null;
            setRestoredSnapshot(null);
            const trimmed = vehicleSearchInput.trim();
            if (!trimmed || normalizeVehicleId(trimmed).length === 0) {
                setSubmittedVehicleQuery(null);
                return;
            }
            setPaginationModel(previous => (previous.page === 0 ? previous : {...previous, page: 0}));
            clearSelection();
            setSubmittedVehicleQuery(previous => ({
                query: trimmed,
                matchMode: vehicleSearchMatchMode,
                window: vehicleSearchWindow,
                nonce: (previous?.nonce ?? 0) + 1,
            }));
        },
        [clearSelection, vehicleSearchInput, vehicleSearchMatchMode, vehicleSearchWindow],
    );

    const handleVehicleSearchClear = useCallback(() => {
        restoredSnapshotRef.current = null;
        setRestoredSnapshot(null);
        if (isEventLog && countEventFilterRules(filter) === 0) {
            clearFilteredEventLogSnapshot(activeViewKey);
        }
        setVehicleSearchInput("");
        setSubmittedVehicleQuery(null);
        setVehicleSearchResult(null);
        setVehicleSearchError(null);
        setUffOmniboxMatches([]);
        setPaginationModel(previous => (previous.page === 0 ? previous : {...previous, page: 0}));
        clearSelection();
    }, [activeViewKey, clearSelection, filter, isEventLog]);

    const visibleSelectionModel = useMemo<GridRowSelectionModel>(() => activePageSourceRows
        .filter(row => row.status !== "None" && !row.adjudicatedIds?.length)
        .filter(row => allFilteredSelected
            ? !excludedKeys.has(eventSelectionKey(row)) && !postSelectionKeys.has(eventSelectionKey(row))
            : selectedKeys.has(eventSelectionKey(row)))
        .map(eventSelectionKey), [activePageSourceRows, allFilteredSelected, excludedKeys, postSelectionKeys, selectedKeys]);

    const handleSelectionChange = (model: GridRowSelectionModel) => {
        const visible = new Set(model.map(String));
        if (allFilteredSelected) {
            setExcludedKeys(previous => {
                const next = new Set(previous);
                activePageSourceRows.filter(row => row.status !== "None" && !row.adjudicatedIds?.length).forEach(row => {
                    const key = eventSelectionKey(row);
                    if (visible.has(key)) next.delete(key); else next.add(key);
                });
                return next;
            });
        } else {
            setSelectedKeys(previous => {
                const next = new Set(previous);
                activePageSourceRows.filter(row => row.status !== "None" && !row.adjudicatedIds?.length).forEach(row => {
                    const key = eventSelectionKey(row);
                    if (visible.has(key)) next.add(key); else next.delete(key);
                });
                return next;
            });
        }
    };

    const selectedCount = allFilteredSelected ? Math.max(0, allFilteredTotal - excludedKeys.size) : selectedKeys.size;

    const unreadVisibleCount = useMemo(
        () => (isAlarmTable ? rows.reduce((sum, row) => sum + (isRowUnread(row) ? 1 : 0), 0) : 0),
        [isAlarmTable, rows, isRowUnread],
    );

    const canUseZeroQueryTotalCount = isAlarmTable
        && !effectiveUnreadOnly
        && !unreadScopePlanBundle.hasPositiveWatermark
        && !postWatermarkReadKeysSummary.hasPostWatermarkKeys;

    const canUseZeroQueryPage0VisibleCount = isAlarmTable
        && !loading
        && paginationModel.page === 0
        && rowCount <= PAGE_SIZE
        && rows.length <= rowCount
        && (
            effectiveUnreadOnly
            || rows.length === rowCount
        );

    const canUseZeroQueryUnreadOnlyCount = isAlarmTable
        && effectiveUnreadOnly
        && !postWatermarkReadKeysSummary.hasPostWatermarkKeys;

    const canUseZeroQueryPage0VisibleCountRef = useRef(canUseZeroQueryPage0VisibleCount);
    canUseZeroQueryPage0VisibleCountRef.current = canUseZeroQueryPage0VisibleCount;

    useEffect(() => {
        if (!canUseZeroQueryPage0VisibleCount) return;
        setScopedUnreadSummary({count: unreadVisibleCount, capped: false});
        setScopedUnreadReady(true);
    }, [canUseZeroQueryPage0VisibleCount, unreadVisibleCount]);

    useEffect(() => {
        if (!isAlarmTable) return;
        if (canUseZeroQueryTotalCount || canUseZeroQueryUnreadOnlyCount) {
            setScopedUnreadReady(false);
            return;
        }
        if (canUseZeroQueryPage0VisibleCountRef.current) {
            return;
        }
        if (unreadScopePlanBundle.plans.length === 0) {
            setScopedUnreadSummary({count: 0, capped: false});
            setScopedUnreadReady(true);
            return;
        }

        const controller = new AbortController();
        const effectiveCutoff = latestCutoffRef.current > pageLoadedTime
            ? latestCutoffRef.current
            : pageLoadedTime;

        void (async () => {
            try {
                const planCounts = await runWithConcurrency(
                    unreadScopePlanBundle.plans,
                    6,
                    plan => fetchPlanCount(plan, effectiveCutoff, true, {
                        signal: controller.signal,
                        lowPriority: true,
                    }),
                );
                if (controller.signal.aborted) return;
                const serverPostWatermarkCount = planCounts.reduce((sum, count) => sum + count, 0);

                if (!postWatermarkReadKeysSummary.hasPostWatermarkKeys || serverPostWatermarkCount === 0) {
                    setScopedUnreadSummary({count: serverPostWatermarkCount, capped: false});
                    setScopedUnreadReady(true);
                    return;
                }

                const fetchLimitPerPlan = Math.min(serverPostWatermarkCount, MAX_UNREAD_RECONCILIATION_FETCH);
                const sampledByPlan = await runWithConcurrency(
                    unreadScopePlanBundle.plans,
                    6,
                    async (plan, index) => {
                        const planCount = planCounts[index] ?? 0;
                        if (planCount <= 0) return [];
                        return fetchPlanRows(
                            plan,
                            Math.min(planCount, fetchLimitPerPlan),
                            0,
                            effectiveCutoff,
                            controller.signal,
                            false,
                        );
                    },
                );
                if (controller.signal.aborted) return;

                const sampledEvents = deduplicateEvents(sampledByPlan.flat());
                const unreadInSample = sampledEvents.reduce(
                    (sum, event) => sum + (isRowUnreadRef.current(event) ? 1 : 0),
                    0,
                );

                if (serverPostWatermarkCount <= MAX_UNREAD_RECONCILIATION_FETCH) {
                    setScopedUnreadSummary({count: unreadInSample, capped: false});
                    setScopedUnreadReady(true);
                    return;
                }

                if (unreadInSample > UNREAD_COUNT_RECONCILIATION_CAP) {
                    setScopedUnreadSummary({count: UNREAD_COUNT_RECONCILIATION_CAP, capped: true});
                    setScopedUnreadReady(true);
                    return;
                }

                const unseenCount = Math.max(0, serverPostWatermarkCount - sampledEvents.length);
                const estimatedUnread = Math.max(
                    unreadInSample,
                    serverPostWatermarkCount - postWatermarkReadKeysSummary.totalEstimatedCount,
                );
                if (
                    estimatedUnread > UNREAD_COUNT_RECONCILIATION_CAP
                    || unreadInSample + unseenCount > UNREAD_COUNT_RECONCILIATION_CAP
                ) {
                    setScopedUnreadSummary({count: UNREAD_COUNT_RECONCILIATION_CAP, capped: true});
                } else {
                    setScopedUnreadSummary({count: estimatedUnread, capped: false});
                }
                setScopedUnreadReady(true);
            } catch (error) {
                if (controller.signal.aborted || isAbortRequestError(error)) return;
                console.error("Unable to reconcile unread dashboard alarm count", error);
            }
        })();

        return () => {
            controller.abort();
        };
    }, [
        canUseZeroQueryTotalCount,
        canUseZeroQueryUnreadOnlyCount,
        fetchPlanCount,
        fetchPlanRows,
        isAlarmTable,
        pageLoadedTime,
        postWatermarkReadKeysSummary,
        readKeysSignature,
        unreadReconcileEpoch,
        unreadScopePlanBundle,
    ]);

    const effectiveUnreadSummary = useMemo<{count: number; capped: boolean}>(() => {
        if (!isAlarmTable) return {count: 0, capped: false};
        if (canUseZeroQueryTotalCount) {
            return {count: rowCount, capped: false};
        }
        if (canUseZeroQueryPage0VisibleCount) {
            return {count: unreadVisibleCount, capped: false};
        }
        if (canUseZeroQueryUnreadOnlyCount) {
            return {count: rowCount, capped: false};
        }
        if (scopedUnreadReady) {
            return scopedUnreadSummary;
        }
        return {count: unreadVisibleCount, capped: false};
    }, [
        canUseZeroQueryPage0VisibleCount,
        canUseZeroQueryTotalCount,
        canUseZeroQueryUnreadOnlyCount,
        isAlarmTable,
        rowCount,
        scopedUnreadReady,
        scopedUnreadSummary,
        unreadVisibleCount,
    ]);

    const effectiveRowCount = useMemo(() => {
        if (!effectiveUnreadOnly) return rowCount;
        if (!postWatermarkReadKeysSummary.hasPostWatermarkKeys) return rowCount;
        if (!loading && paginationModel.page === 0 && rowCount <= PAGE_SIZE && rows.length <= rowCount) {
            return rows.length;
        }
        const estimated = scopedUnreadReady
            ? (scopedUnreadSummary.capped
                ? Math.max(0, rowCount - postWatermarkReadKeysSummary.totalEstimatedCount)
                : scopedUnreadSummary.count)
            : Math.max(0, rowCount - postWatermarkReadKeysSummary.totalEstimatedCount);
        return Math.max(rows.length, estimated);
    }, [
        effectiveUnreadOnly,
        loading,
        paginationModel.page,
        postWatermarkReadKeysSummary,
        rowCount,
        rows.length,
        scopedUnreadReady,
        scopedUnreadSummary,
    ]);

    useEffect(() => {
        if (!isAlarmTable) return;
        dispatch(setDashboardUnreadAlarmSummary(effectiveUnreadSummary));
    }, [isAlarmTable, effectiveUnreadSummary, dispatch]);

    useEffect(() => {
        if (!isAlarmTable) return;
        return () => {
            dispatch(setDashboardUnreadAlarmCount(0));
            dispatch(setDashboardUnreadOnly(false));
        };
    }, [isAlarmTable, dispatch]);

    const getLatestGB = async (event: EventTableData) => {
        for (const lane of stableLaneMap.values()) {
            const threshold = lane.datastreams
                .filter((stream: any) => isThresholdDataStream(stream))
                .find((stream: typeof DataStream) => stream.properties["system@id"] === event.rpmSystemId);
            if (threshold) dispatch(setLatestGB(await getObservations(event.startTime, event.endTime, threshold)));
        }
    };

    const previewEvent = (event: EventTableData, navigate = false) => {
        if (isAlarmTable) {
            const wasUnread = isRowUnread(event);
            markEventsRead([event], resolveEventNodeId);
            if (wasUnread) {
                if (effectiveUnreadOnly) {
                    invalidatePrefetch();
                }
                setScopedUnreadSummary({
                    count: effectiveUnreadSummary.capped
                        ? effectiveUnreadSummary.count
                        : Math.max(0, effectiveUnreadSummary.count - 1),
                    capped: effectiveUnreadSummary.capped,
                });
                setScopedUnreadReady(true);
            }
        }
        dispatch(setEventPreview({isOpen: true, eventData: event}));
        dispatch(setSelectedRowId(event.id));
        dispatch(setSelectedEvent(event));
        getLatestGB(event);
        if (navigate) {
            const lane = stableLaneMap.get(event.laneId);
            const fromFiltered = isEventLog && hasActiveQueryRef.current;
            const href = event.occupancyObsId
                ? buildEventDetailsHref(event.occupancyObsId, lane?.parentNode.id, fromFiltered)
                : (fromFiltered ? "/event-details?fromFiltered=1" : "/event-details");
            router.push(scopedHref(href));
        }
    };

    const enumerateAllFiltered = useCallback(async (): Promise<EventTableData[]> => {
        if (isVehicleSearchMode) {
            return vehicleFilteredRows
                .filter(event => event.status !== "None" && !event.adjudicatedIds?.length)
                .filter(event => !effectiveUnreadOnly || isRowUnread(event))
                .filter(event => !excludedKeys.has(eventSelectionKey(event)));
        }
        const cutoff = allFilteredCutoffRef.current ?? advanceSnapshotCutoff();
        const planRows = await runWithConcurrency(bulkQueryPlans, 4, async plan => {
            const count = await fetchPlanCount(plan, cutoff, true);
            const collected: EventTableData[] = [];
            for (let offset = 0; offset < count; offset += BULK_FETCH_SIZE)
                collected.push(...await fetchPlanRows(plan, BULK_FETCH_SIZE, offset, cutoff, undefined, false));
            return collected;
        });
        return deduplicateEvents(planRows.flat())
            .filter(event => !effectiveUnreadOnly || isRowUnread(event))
            .filter(event => !excludedKeys.has(eventSelectionKey(event)));
    }, [advanceSnapshotCutoff, bulkQueryPlans, effectiveUnreadOnly, excludedKeys, fetchPlanCount, fetchPlanRows, isRowUnread, isVehicleSearchMode, vehicleFilteredRows]);

    const computeScopedAcknowledgeTargets = useCallback((): ScopedLaneTarget[] => {
        let maxVisibleMs = Date.now();
        for (const row of rows) {
            const ms = parseAlarmTimestampMs(row);
            if (ms !== null && ms > maxVisibleMs) {
                maxVisibleMs = ms;
            }
        }
        const targets: ScopedLaneTarget[] = [];
        for (const lane of stableLaneMap.values()) {
            const compiled = compileEventFilterForLane(filter, {
                nodeId: lane.parentNode.id,
                nodeName: lane.parentNode.name,
                laneId: lane.laneName,
            });
            if (compiled === false) continue;
            targets.push({
                nodeId: lane.parentNode.id,
                laneId: lane.laneName,
                acknowledgedThroughMs: maxVisibleMs,
            });
        }
        return targets;
    }, [filter, rows, stableLaneMap]);

    const acknowledgeAllScopedAlarms = useCallback(async () => {
        if (!isAlarmTable) return;
        const useLaneWatermarkAcknowledge = !hasRowContentFilter(filter) && timeWindowPreset === "15d";
        if (useLaneWatermarkAcknowledge) {
            const targets = computeScopedAcknowledgeTargets();
            advanceSnapshotCutoff();
            acknowledgeLanes(targets);
            setScopedUnreadSummary({count: 0, capped: false});
            setScopedUnreadReady(true);
            if (effectiveUnreadOnly) {
                setRows([]);
            }
            clearSelection();
            setAckStatusMessage(t("acknowledgedAllScopedStatus"));
            return;
        }
        setLoading(true);
        try {
            const matching = await enumerateAllFiltered();
            markEventsRead(matching, resolveEventNodeId);
            setScopedUnreadSummary({count: 0, capped: false});
            setScopedUnreadReady(true);
            if (effectiveUnreadOnly) {
                setRows([]);
                void fetchPage(
                    0,
                    advanceSnapshotCutoff(),
                    postWatermarkReadKeysSummary.totalEstimatedCount + matching.length,
                );
            }
            clearSelection();
            setAckStatusMessage(t("acknowledgedAlarmsStatus", {count: matching.length}));
        } catch (error) {
            console.error("Unable to acknowledge filtered alarms", error);
            setBulkSelectionError(true);
        } finally {
            setLoading(false);
        }
    }, [
        acknowledgeLanes,
        advanceSnapshotCutoff,
        clearSelection,
        computeScopedAcknowledgeTargets,
        effectiveUnreadOnly,
        enumerateAllFiltered,
        fetchPage,
        filter,
        isAlarmTable,
        markEventsRead,
        postWatermarkReadKeysSummary.totalEstimatedCount,
        resolveEventNodeId,
        setLoading,
        setRows,
        t,
        timeWindowPreset,
    ]);

    const acknowledgeSelectedAlarms = useCallback(async () => {
        if (!isAlarmTable) return;
        if (allFilteredSelected && excludedKeys.size === 0) {
            await acknowledgeAllScopedAlarms();
            return;
        }
        if (allFilteredSelected) {
            setLoading(true);
            try {
                const matching = await enumerateAllFiltered();
                const newlyReadCount = matching.filter(isRowUnread).length;
                markEventsRead(matching, resolveEventNodeId);
                if (newlyReadCount > 0) {
                    setScopedUnreadSummary({
                        count: effectiveUnreadSummary.capped
                            ? effectiveUnreadSummary.count
                            : Math.max(0, effectiveUnreadSummary.count - newlyReadCount),
                        capped: effectiveUnreadSummary.capped,
                    });
                    setScopedUnreadReady(true);
                }
                if (effectiveUnreadOnly) {
                    setRows(previous => previous.filter(row => excludedKeys.has(eventSelectionKey(row))));
                    void fetchPage(
                        currentPageRef.current,
                        advanceSnapshotCutoff(),
                        postWatermarkReadKeysSummary.totalEstimatedCount + newlyReadCount,
                    );
                }
                clearSelection();
                setAckStatusMessage(t("acknowledgedAlarmsStatus", {count: matching.length}));
            } catch (error) {
                console.error("Unable to acknowledge selected filtered alarms", error);
                setBulkSelectionError(true);
            } finally {
                setLoading(false);
            }
            return;
        }
        const rowsByKey = new Map(rows.map(row => [eventSelectionKey(row), row]));
        const selectedEvents = Array.from(selectedKeys).flatMap(key => {
            const event = eventCacheRef.current.get(key) ?? rowsByKey.get(key);
            return event ? [event] : [];
        });
        const newlyReadCount = selectedEvents.filter(isRowUnread).length;
        markEventsRead(selectedEvents, resolveEventNodeId);
        if (newlyReadCount > 0) {
            setScopedUnreadSummary({
                count: effectiveUnreadSummary.capped
                    ? effectiveUnreadSummary.count
                    : Math.max(0, effectiveUnreadSummary.count - newlyReadCount),
                capped: effectiveUnreadSummary.capped,
            });
            setScopedUnreadReady(true);
        }
        if (effectiveUnreadOnly && selectedEvents.length > 0) {
            const acknowledgedKeySet = new Set(selectedKeys);
            setRows(previous => previous.filter(row => !acknowledgedKeySet.has(eventSelectionKey(row))));
            void fetchPage(
                currentPageRef.current,
                advanceSnapshotCutoff(),
                postWatermarkReadKeysSummary.totalEstimatedCount + newlyReadCount,
            );
        }
        clearSelection();
        setAckStatusMessage(t("acknowledgedAlarmsStatus", {count: selectedEvents.length}));
    }, [
        acknowledgeAllScopedAlarms,
        advanceSnapshotCutoff,
        allFilteredSelected,
        clearSelection,
        currentPageRef,
        effectiveUnreadOnly,
        effectiveUnreadSummary,
        enumerateAllFiltered,
        excludedKeys,
        fetchPage,
        isAlarmTable,
        isRowUnread,
        markEventsRead,
        postWatermarkReadKeysSummary.totalEstimatedCount,
        resolveEventNodeId,
        rows,
        selectedKeys,
        setLoading,
        setRows,
        t,
    ]);

    useEffect(() => {
        if (dashboardAcknowledgeNonce === lastHandledAckNonceRef.current) return;
        lastHandledAckNonceRef.current = dashboardAcknowledgeNonce;
        if (!isAlarmTable) return;
        void acknowledgeAllScopedAlarms();
    }, [dashboardAcknowledgeNonce, isAlarmTable, acknowledgeAllScopedAlarms]);

    const selectAllFilteredAlarms = async () => {
        const cutoff = advanceSnapshotCutoff();
        if (isVehicleSearchMode) {
            const total = vehicleFilteredRows
                .filter(event => event.status !== "None" && !event.adjudicatedIds?.length)
                .filter(event => !effectiveUnreadOnly || isRowUnread(event))
                .length;
            allFilteredCutoffRef.current = cutoff;
            setAllFilteredTotal(total);
            setAllFilteredSelected(true);
            setSelectedKeys(new Set());
            setExcludedKeys(new Set());
            setPostSelectionKeys(new Set());
            return;
        }
        setLoading(true);
        try {
            const counts = await runWithConcurrency(bulkQueryPlans, 6, plan => fetchPlanCount(plan, cutoff, true));
            let total = counts.reduce((sum, count) => sum + count, 0);
            if (
                effectiveUnreadOnly
                && postWatermarkReadKeysSummary.hasPostWatermarkKeys
                && total > 0
                && total <= BULK_FETCH_SIZE
            ) {
                const planRows = await runWithConcurrency(bulkQueryPlans, 4, async (plan, index) => {
                    const count = counts[index] ?? 0;
                    if (count <= 0) return [];
                    return fetchPlanRows(plan, count, 0, cutoff, undefined, false);
                });
                total = deduplicateEvents(planRows.flat()).filter(isRowUnread).length;
            }
            allFilteredCutoffRef.current = cutoff;
            setAllFilteredTotal(total);
            setAllFilteredSelected(true);
            setSelectedKeys(new Set());
            setExcludedKeys(new Set());
            setPostSelectionKeys(new Set());
        } catch (error) {
            console.error("Unable to select all filtered alarms", error);
            clearSelection();
            setBulkSelectionError(true);
        } finally {
            setLoading(false);
        }
    };

    const handleBulkSubmit = async (
        values: BulkAdjudicationValues,
        retryFailures: boolean,
        onProgress: (complete: number, total: number) => void,
    ): Promise<BulkAdjudicationSummary> => {
        let events: EventTableData[];
        if (retryFailures) {
            events = failedBulkRef.current;
        } else if (allFilteredSelected) {
            events = await enumerateAllFiltered();
        } else {
            events = Array.from(selectedKeys).flatMap(key => {
                const event = eventCacheRef.current.get(key);
                return event ? [event] : [];
            });
            if (events.length !== selectedKeys.size)
                throw new Error("One or more selected events are no longer available");
        }
        const outcomes: BulkAdjudicationOutcome[] = await adjudicateEvents(events, stableLaneMap, values, onProgress);
        const successful = outcomes.filter(outcome => outcome.ok);
        const failed = outcomes.filter(outcome => !outcome.ok);
        failedBulkRef.current = failed.map(outcome => outcome.event);
        const successfulKeys = new Set(successful.map(outcome => eventSelectionKey(outcome.event)));
        if (tableMode === "alarmtable") {
            if (successful.length > 0) {
                markEventsRead(successful.map(outcome => outcome.event), resolveEventNodeId);
            }
            setRows(previous => previous.filter(event => !successfulKeys.has(eventSelectionKey(event))));
            setRowCount(previous => Math.max(0, previous - successful.length));
            if (successful.length > 0) {
                const cutoff = advanceSnapshotCutoff();
                setUnreadReconcileEpoch(previous => previous + 1);
                void refreshCounts(cutoff);
                void fetchPage(currentPageRef.current, cutoff);
            }
        } else {
            setRows(previous => previous.map(event => {
                if (successfulKeys.has(eventSelectionKey(event))) {
                    event.adjudicatedIds = [
                        "bulk-adjudicated",
                        adjudicationCodeMarker(values.adjudicationCode.code),
                    ];
                }
                return event;
            }));
        }
        if (isVehicleSearchMode && successful.length > 0) {
            if (submittedVehicleQuery) {
                setSubmittedVehicleQuery(previous => previous ? {...previous, nonce: previous.nonce + 1} : previous);
            } else {
                setFilterEpoch(previous => previous + 1);
            }
        }
        setAllFilteredSelected(false);
        setAllFilteredTotal(0);
        allFilteredCutoffRef.current = null;
        setExcludedKeys(new Set());
        setPostSelectionKeys(new Set());
        const failedSelectionKeys = new Set<string>();
        for (const outcome of failed) {
            const key = eventSelectionKey(outcome.event);
            failedSelectionKeys.add(key);
            if (failedSelectionKeys.size <= MAX_EVENT_CACHE_ENTRIES) {
                cacheEventBounded(key, outcome.event);
            }
        }
        setSelectedKeys(failedSelectionKeys);
        return {success: successful.length, failed: failed.length};
    };

    const visibleOcrLanes = useMemo<LaneMapEntry[]>(() => {
        if (!wantsVehicleIdColumn) return [];
        const result: LaneMapEntry[] = [];
        for (const lane of stableLaneMap.values()) {
            if (tableMode === "lanelog" && currentLane && lane.laneName !== currentLane) continue;
            result.push(lane);
        }
        return result;
    }, [currentLane, stableLaneMap, tableMode, wantsVehicleIdColumn]);

    const ocrWindowStartIso = useMemo(() => {
        if (!wantsVehicleIdColumn) return pageLoadedTime;
        let earliestMs = Number.POSITIVE_INFINITY;
        for (const row of rows) {
            const ms = Date.parse(row.startTime || row.endTime);
            if (Number.isFinite(ms) && ms < earliestMs) {
                earliestMs = ms;
            }
        }
        if (Number.isFinite(earliestMs)) {
            const bucketedMs = Math.floor(Math.max(0, earliestMs - 60_000) / 900_000) * 900_000;
            return new Date(bucketedMs).toISOString();
        }
        const fallbackBaseMs = Date.parse(pageLoadedTime);
        const baseMs = Number.isFinite(fallbackBaseMs) ? fallbackBaseMs : Date.now();
        return new Date(Math.max(0, baseMs - 86_400_000)).toISOString();
    }, [pageLoadedTime, rows, wantsVehicleIdColumn]);

    const ocrWindowEndIso = useMemo(() => {
        if (!wantsVehicleIdColumn || paginationModel.page === 0 || rows.length === 0) {
            return null;
        }
        let latestMs = Number.NEGATIVE_INFINITY;
        for (const row of rows) {
            const ms = Date.parse(row.endTime || row.startTime);
            if (Number.isFinite(ms) && ms > latestMs) {
                latestMs = ms;
            }
        }
        if (!Number.isFinite(latestMs)) {
            return null;
        }
        const paddedUpperMs = Math.ceil((latestMs + 15 * 60_000) / 900_000) * 900_000;
        return new Date(paddedUpperMs).toISOString();
    }, [paginationModel.page, rows, wantsVehicleIdColumn]);

    const {ocrByObsId, adjudicatedVehicleIdByObsId} = useVehicleOcrMap({
        enabled: wantsVehicleIdColumn && !isVehicleSearchMode,
        lanes: visibleOcrLanes,
        windowStartIso: ocrWindowStartIso,
        windowEndIso: ocrWindowEndIso,
    });

    const pendingQuietResolutionIdsRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        if (!wantsVehicleIdColumn || rows.length === 0) return;
        const unresolved = rows.filter(
            row => !row.occupancyObsId && !pendingQuietResolutionIdsRef.current.has(eventSelectionKey(row)),
        );
        if (unresolved.length === 0) return;
        const controller = new AbortController();
        let active = true;
        for (const row of unresolved) {
            const lane = findLaneByDataStreamId(row.dataStreamId) ?? stableLaneMap.get(row.laneId);
            if (!lane) continue;
            const rowKey = eventSelectionKey(row);
            pendingQuietResolutionIdsRef.current.add(rowKey);
            void resolveRealtimeEventForNotification(row, lane, controller.signal)
                .then(resolved => {
                    if (!active || controller.signal.aborted) return;
                    if (resolved.occupancyObsId && resolved !== row) {
                        replaceRealtimeEventIdentity(row, resolved);
                    }
                })
                .catch((): void => {})
                .finally(() => {
                    pendingQuietResolutionIdsRef.current.delete(rowKey);
                });
        }
        return () => {
            active = false;
            controller.abort();
        };
    }, [findLaneByDataStreamId, replaceRealtimeEventIdentity, rows, stableLaneMap, wantsVehicleIdColumn]);

    const enrichRowsWithVehicleId = useCallback((sourceRows: EventTableData[]): EventTableData[] => {
        if (!wantsVehicleIdColumn) return sourceRows;
        if (ocrByObsId.size === 0 && adjudicatedVehicleIdByObsId.size === 0) return sourceRows;
        let changed = false;
        const mapped = sourceRows.map(row => {
            const obsId = row.occupancyObsId;
            if (!obsId) return row;
            const adjVehicleId = adjudicatedVehicleIdByObsId.get(obsId);
            if (adjVehicleId) {
                if (row.vehicleId === adjVehicleId && !row.vehicleIdFromOcr) return row;
                changed = true;
                const clone = row.clone();
                clone.setVehicleId(adjVehicleId, false);
                return clone;
            }
            const ocrCandidate = ocrByObsId.get(obsId);
            if (ocrCandidate?.value) {
                const formatted = ocrCandidate.kind === "container" && ocrCandidate.isoChecksumValid
                    ? formatIso6346(ocrCandidate.value)
                    : ocrCandidate.value;
                if (row.vehicleId === formatted && row.vehicleIdFromOcr) return row;
                changed = true;
                const clone = row.clone();
                clone.setVehicleId(formatted, true);
                return clone;
            }
            return row;
        });
        return changed ? mapped : sourceRows;
    }, [adjudicatedVehicleIdByObsId, ocrByObsId, wantsVehicleIdColumn]);

    const displayRows = useMemo<EventTableData[]>(() => {
        if (isVehicleSearchMode) return vehiclePageRows;
        return enrichRowsWithVehicleId(rows);
    }, [enrichRowsWithVehicleId, isVehicleSearchMode, rows, vehiclePageRows]);

    const [upSetExpanded, setUpSetExpanded] = useState(false);
    const [selectedUpSetFilter, setSelectedUpSetFilter] = useState<UpSetFilterSelection | null>(null);
    const [upSetRefreshNonce, setUpSetRefreshNonce] = useState(0);
    const [upSetFetchState, setUpSetFetchState] = useState<{
        loading: boolean;
        error: boolean;
        events: EventTableData[];
        totalAlarmCount: number;
        capped: boolean;
    }>({
        loading: false,
        error: false,
        events: [],
        totalAlarmCount: 0,
        capped: false,
    });

    const activeCriteria = useMemo<EventLogQueryCriteria>(() => ({
        filter,
        vehicleSearch: submittedVehicleQuery
            ? {
                query: submittedVehicleQuery.query,
                matchMode:
                    submittedVehicleQuery.matchMode === "equals"
                    || submittedVehicleQuery.matchMode === "startsWith"
                        ? submittedVehicleQuery.matchMode
                        : "contains",
                window: submittedVehicleQuery.window,
            }
            : null,
    }), [filter, submittedVehicleQuery]);

    const hasActiveQuery = useMemo(
        () => isEventLog && hasActiveEventLogCriteria(activeCriteria),
        [activeCriteria, isEventLog],
    );
    const hasActiveQueryRef = useRef<boolean>(hasActiveQuery);
    hasActiveQueryRef.current = hasActiveQuery;

    // Seed bounded row cache when hydrating from the single-slot return snapshot
    useEffect(() => {
        if (!isEventLog || !restoredSnapshot) return;
        for (const row of restoredSnapshot.rows) {
            cacheEventBounded(eventSelectionKey(row), row);
        }
        if (restoredSnapshot.vehicleSearchResult) {
            for (const pass of restoredSnapshot.vehicleSearchResult.passes) {
                cacheEventBounded(eventSelectionKey(pass.eventRow), pass.eventRow);
            }
        }
    }, [cacheEventBounded, isEventLog, restoredSnapshot]);

    const applyCriteriaAndSnapshot = useCallback(
        (criteria: EventLogQueryCriteria, snapshot: CachedEventLogQuerySnapshot | null) => {
            restoredSnapshotRef.current = snapshot;
            setRestoredSnapshot(snapshot);
            setFilter(criteria.filter ?? createEventFilterGroup());
            setPaginationModel({page: snapshot?.page ?? 0, pageSize: PAGE_SIZE});
            if (criteria.vehicleSearch) {
                setVehicleSearchInput(criteria.vehicleSearch.query);
                setVehicleSearchMatchMode(criteria.vehicleSearch.matchMode);
                setVehicleSearchWindow(criteria.vehicleSearch.window);
                setSubmittedVehicleQuery({
                    query: criteria.vehicleSearch.query,
                    matchMode: criteria.vehicleSearch.matchMode,
                    window: criteria.vehicleSearch.window,
                    nonce: snapshot ? 0 : Date.now(),
                });
                setVehicleSearchResult(snapshot?.vehicleSearchResult ?? null);
                setVehicleSearchError(null);
            } else {
                setVehicleSearchInput("");
                setSubmittedVehicleQuery(null);
                setVehicleSearchResult(null);
                setVehicleSearchError(null);
                setUffOmniboxMatches([]);
            }
            setUpSetExpanded(false);
            setSelectedUpSetFilter(null);
            setUpSetFetchState({loading: false, error: false, events: [], totalAlarmCount: 0, capped: false});
            clearSelection();
            setFilterEpoch(previous => previous + 1);
        },
        [clearSelection],
    );

    const handleApplyBookmark = useCallback(
        (criteria: EventLogQueryCriteria) => {
            applyCriteriaAndSnapshot(criteria, null);
        },
        [applyCriteriaAndSnapshot],
    );

    const handleResetEventLogQuery = useCallback(() => {
        clearFilteredEventLogSnapshot(activeViewKey);
        applyCriteriaAndSnapshot({}, null);
        if (typeof window !== "undefined" && window.location.search.includes("restore=")) {
            const url = new URL(window.location.href);
            url.searchParams.delete("restore");
            window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
        }
    }, [activeViewKey, applyCriteriaAndSnapshot]);

    useEffect(() => {
        if (!isEventLog) return;
        setCurrentEventLogFilteredFlag(activeViewKey, hasActiveQuery);
        return () => {
            setCurrentEventLogFilteredFlag(activeViewKey, false);
        };
    }, [activeViewKey, hasActiveQuery, isEventLog]);

    const prevRestoreFilteredRef = useRef<boolean | undefined>(restoreFiltered);
    useEffect(() => {
        if (!isEventLog) return;
        const prev = prevRestoreFilteredRef.current;
        prevRestoreFilteredRef.current = restoreFiltered;
        if (restoreFiltered === undefined || prev === restoreFiltered) return;
        if (restoreFiltered) {
            const restored = getFilteredEventLogRestoreState(activeViewKey);
            if (restored) {
                applyCriteriaAndSnapshot(restored.criteria, restored.snapshot);
            }
        } else if (prev === true && hasActiveQueryRef.current) {
            handleResetEventLogQuery();
        }
    }, [activeViewKey, applyCriteriaAndSnapshot, handleResetEventLogQuery, isEventLog, restoreFiltered]);

    // Update the single-slot return snapshot when a filtered /event-log query settles
    useEffect(() => {
        if (!isEventLog || !hasActiveQuery || stableLaneMap.size === 0) return;
        if (isVehicleSearchMode) {
            if (vehicleSearchLoading || vehicleSearchError || !vehicleSearchResult) return;
            setFilteredEventLogSnapshot(activeViewKey, {
                criteria: activeCriteria,
                rows: [],
                rowCount: vehicleFilteredRows.length,
                page: paginationModel.page,
                pageLoadedTime,
                latestCutoff: latestCutoffRef.current,
                bucketCounts: null,
                vehicleSearchResult,
            });
            return;
        }
        if (loading || countQueryError || pageQueryError) return;
        if (currentPageRef.current !== paginationModel.page) return;
        setFilteredEventLogSnapshot(activeViewKey, {
            criteria: activeCriteria,
            rows,
            rowCount,
            page: paginationModel.page,
            pageLoadedTime,
            latestCutoff: latestCutoffRef.current,
            bucketCounts: getCachedBucketCounts(),
            vehicleSearchResult: null,
        });
    }, [
        activeCriteria,
        activeViewKey,
        countQueryError,
        currentPageRef,
        getCachedBucketCounts,
        hasActiveQuery,
        isEventLog,
        isVehicleSearchMode,
        loading,
        pageLoadedTime,
        pageQueryError,
        paginationModel.page,
        rowCount,
        rows,
        stableLaneMap.size,
        vehicleFilteredRows.length,
        vehicleSearchError,
        vehicleSearchLoading,
        vehicleSearchResult,
    ]);

    const handleSaveBookmark = useCallback(
        (name: string) => {
            if (!hasActiveQuery) return;
            setSavedBookmarks(saveEventQueryBookmark(name, activeCriteria));
        },
        [activeCriteria, hasActiveQuery],
    );

    const handleDeleteBookmark = useCallback((id: string) => {
        setSavedBookmarks(deleteSavedEventQueryBookmark(id));
    }, []);

    const defaultBookmarkName = useMemo(
        () => (hasActiveQuery ? summarizeEventLogQuery(activeCriteria, t) : ""),
        [activeCriteria, hasActiveQuery, t],
    );

    const upSetAlarmQueryPlans = useMemo<QueryPlan[]>(() => {
        if (!isEventLog || !upSetExpanded || isVehicleSearchMode) return [];
        return queryPlans.map(plan => ({
            ...plan,
            key: `${plan.key}\u001fupset-alarms`,
            filter: combineServerFilters(plan.filter, "gammaAlarm=true OR neutronAlarm=true"),
        }));
    }, [isEventLog, isVehicleSearchMode, queryPlans, upSetExpanded]);

    useEffect(() => {
        if (!isEventLog || !upSetExpanded || isVehicleSearchMode) {
            setUpSetFetchState(previous => (
                previous.loading || previous.error || previous.events.length > 0 || previous.totalAlarmCount > 0
                    ? {loading: false, error: false, events: [], totalAlarmCount: 0, capped: false}
                    : previous
            ));
            return;
        }
        if (upSetAlarmQueryPlans.length === 0) {
            setUpSetFetchState({loading: false, error: false, events: [], totalAlarmCount: 0, capped: false});
            return;
        }

        const controller = new AbortController();
        const cutoff = latestCutoffRef.current > pageLoadedTime ? latestCutoffRef.current : pageLoadedTime;
        setUpSetFetchState(previous => ({...previous, loading: true, error: false}));

        void (async () => {
            try {
                const perPlanCap = Math.max(1, Math.ceil(MAX_UPSET_SUMMARY_EVENTS / upSetAlarmQueryPlans.length));
                const collectedBatches = await runWithConcurrency(
                    upSetAlarmQueryPlans,
                    4,
                    plan => fetchPlanRows(plan, perPlanCap, 0, cutoff, controller.signal, false),
                );
                if (controller.signal.aborted) return;

                const deduped = deduplicateEvents(collectedBatches.flat())
                    .sort(sortEventsByAlarmPriority)
                    .slice(0, MAX_UPSET_SUMMARY_EVENTS);
                for (const ev of deduped.slice(0, MAX_EVENT_CACHE_ENTRIES)) {
                    cacheEventBounded(eventSelectionKey(ev), ev);
                }

                const hitCap = collectedBatches.some(batch => batch.length >= perPlanCap)
                    || deduped.length >= MAX_UPSET_SUMMARY_EVENTS;
                setUpSetFetchState({
                    loading: false,
                    error: false,
                    events: deduped,
                    totalAlarmCount: deduped.length,
                    capped: hitCap,
                });

                if (hitCap) {
                    const planCounts = await runWithConcurrency(
                        upSetAlarmQueryPlans,
                        4,
                        plan => fetchPlanCount(plan, cutoff, false, {
                            signal: controller.signal,
                            lowPriority: true,
                        }),
                    );
                    if (controller.signal.aborted) return;
                    const exactTotal = planCounts.reduce((sum, count) => sum + count, 0);
                    if (exactTotal >= deduped.length) {
                        setUpSetFetchState(previous => ({
                            ...previous,
                            totalAlarmCount: exactTotal,
                            capped: exactTotal > deduped.length,
                        }));
                    }
                }
            } catch (error) {
                if (controller.signal.aborted || isAbortRequestError(error)) return;
                console.error("Unable to summarize filtered events for UpSet plot", error);
                setUpSetFetchState({loading: false, error: true, events: [], totalAlarmCount: 0, capped: false});
            }
        })();

        return () => {
            controller.abort();
        };
    }, [
        cacheEventBounded,
        fetchPlanCount,
        fetchPlanRows,
        isEventLog,
        isVehicleSearchMode,
        pageLoadedTime,
        upSetAlarmQueryPlans,
        upSetExpanded,
        upSetRefreshNonce,
    ]);

    const upSetSourceEvents = useMemo<EventTableData[]>(() => {
        if (!isEventLog || !upSetExpanded) return [];
        if (isVehicleSearchMode) return vehicleFilteredRows;
        if (!hasFilterVehicleRule) return upSetFetchState.events;
        const enriched = enrichRowsWithVehicleId(upSetFetchState.events);
        return enriched.filter(ev => {
            const lane = findLaneByDataStreamId(ev.dataStreamId) ?? stableLaneMap.get(ev.laneId);
            return eventMatchesFilter(filter, ev, {
                nodeId: lane?.parentNode.id ?? "",
                nodeName: lane?.parentNode.name ?? ev.parentNode,
                laneId: lane?.laneName ?? ev.laneId,
            });
        });
    }, [
        enrichRowsWithVehicleId,
        filter,
        findLaneByDataStreamId,
        hasFilterVehicleRule,
        isEventLog,
        isVehicleSearchMode,
        stableLaneMap,
        upSetExpanded,
        upSetFetchState.events,
        vehicleFilteredRows,
    ]);

    const eventLogUpSetData = useMemo(
        () => (isEventLog && upSetExpanded ? buildUpSetCoOccurrenceFromEvents(upSetSourceEvents) : null),
        [isEventLog, upSetExpanded, upSetSourceEvents],
    );

    const upSetSummaryLoading = isEventLog && upSetExpanded && (isVehicleSearchMode ? vehicleSearchLoading : upSetFetchState.loading);

    useEffect(() => {
        if (selectedUpSetFilter == null) return;
        if (!upSetExpanded) {
            setSelectedUpSetFilter(null);
            return;
        }
        if (!upSetSummaryLoading && !isUpSetFilterValidForData(eventLogUpSetData, selectedUpSetFilter)) {
            setSelectedUpSetFilter(null);
        }
    }, [eventLogUpSetData, selectedUpSetFilter, upSetExpanded, upSetSummaryLoading]);

    const upSetMatchedRows = useMemo<EventTableData[]>(() => {
        if (!isEventLog || !upSetExpanded || selectedUpSetFilter == null) return [];
        return upSetSourceEvents.filter(row => matchesUpSetFilter(computeEventUpSetMask(row), selectedUpSetFilter));
    }, [isEventLog, selectedUpSetFilter, upSetExpanded, upSetSourceEvents]);

    const effectiveDisplayRows = useMemo<EventTableData[]>(() => {
        if (!isEventLog || !upSetExpanded || selectedUpSetFilter == null) return displayRows;
        const startIdx = paginationModel.page * PAGE_SIZE;
        const sliced = upSetMatchedRows.slice(startIdx, startIdx + PAGE_SIZE);
        return isVehicleSearchMode ? sliced : enrichRowsWithVehicleId(sliced);
    }, [displayRows, enrichRowsWithVehicleId, isEventLog, isVehicleSearchMode, paginationModel.page, selectedUpSetFilter, upSetExpanded, upSetMatchedRows]);

    const renderCompactHeader = useCallback((label: string) => {
        const unitMatch = label.match(/^(.*?)\s*(\([^)]+\))$/);
        if (unitMatch) {
            return (
                <Box sx={{display: "flex", flexDirection: "column", lineHeight: 1.15, py: 0.25, minWidth: 0}}>
                    <Box component="span" sx={{fontWeight: 600, fontSize: "0.78rem", whiteSpace: "nowrap"}}>{unitMatch[1]}</Box>
                    <Box component="span" sx={{fontSize: "0.68rem", color: "text.secondary", fontWeight: 500, whiteSpace: "nowrap"}}>{unitMatch[2]}</Box>
                </Box>
            );
        }
        return (
            <Box
                component="span"
                sx={{
                    fontWeight: 600,
                    fontSize: "0.78rem",
                    lineHeight: 1.15,
                    whiteSpace: "normal",
                    wordBreak: "normal",
                    overflowWrap: "normal",
                }}
            >
                {label}
            </Box>
        );
    }, []);

    const renderCompactTimestamp = useCallback((rawValue: unknown) => {
        if (!rawValue) return null;
        const date = rawValue instanceof Date ? rawValue : new Date(String(rawValue));
        if (Number.isNaN(date.getTime())) return String(rawValue);
        return (
            <Box sx={{display: "flex", flexDirection: "column", justifyContent: "center", py: 0.25, minWidth: 0, fontVariantNumeric: "tabular-nums"}}>
                <Box component="span" className="alarm-cell-primary" sx={{fontWeight: 500, fontSize: "0.81rem", lineHeight: 1.2, whiteSpace: "nowrap"}}>
                    {date.toLocaleTimeString(locale)}
                </Box>
                <Box component="span" sx={{fontSize: "0.71rem", color: "text.secondary", lineHeight: 1.15, whiteSpace: "nowrap"}}>
                    {date.toLocaleDateString(locale)}
                </Box>
            </Box>
        );
    }, [locale]);

    const columns = useMemo<GridColDef<EventTableData>[]>(() => [
        {
            field: "laneId",
            headerName: t("laneId"),
            minWidth: 76,
            flex: 0.7,
            renderHeader: () => renderCompactHeader(t("laneId")),
            renderCell: params => {
                const unread = isRowUnread(params.row);
                return (
                    <Box sx={{display: "flex", flexDirection: "column", justifyContent: "center", py: 0.5, minWidth: 0}}>
                        <Box sx={{display: "flex", alignItems: "center", gap: 0.65, minWidth: 0}}>
                            {unread && (
                                <>
                                    <Box
                                        component="span"
                                        className="unread-alarm-dot"
                                        aria-hidden="true"
                                        sx={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: "50%",
                                            bgcolor: "primary.main",
                                            border: "1px solid transparent",
                                            flexShrink: 0,
                                        }}
                                    />
                                    <Box component="span" className="visually-hidden">
                                        {`${t("unreadAlarm")} `}
                                    </Box>
                                </>
                            )}
                            <Box component="span" className="alarm-cell-primary" sx={{fontWeight: 600, fontSize: "0.83rem", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis"}}>
                                {params.row.laneId}
                            </Box>
                        </Box>
                        <Box component="span" sx={{fontSize: "0.71rem", color: "text.secondary", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis"}}>{params.row.parentNode}</Box>
                    </Box>
                );
            },
        },
        {
            field: "occupancyCount",
            headerName: t("occupancyId"),
            minWidth: 78,
            flex: 0.58,
            renderHeader: () => renderCompactHeader(t("occupancyId")),
            renderCell: params => (
                <Box component="span" className="alarm-cell-primary" sx={{fontVariantNumeric: "tabular-nums", fontWeight: 600, fontSize: "0.83rem"}}>
                    {params.value}
                </Box>
            ),
        },
        {
            field: "startTime",
            headerName: t("startTime"),
            minWidth: 88,
            flex: 0.78,
            type: "dateTime",
            renderHeader: () => renderCompactHeader(t("startTime")),
            valueGetter: value => new Date(value),
            valueFormatter: value => new Date(value).toLocaleString(locale),
            renderCell: params => renderCompactTimestamp(params.value ?? params.row.startTime),
        },
        {
            field: "endTime",
            headerName: t("endTime"),
            minWidth: 88,
            flex: 0.78,
            type: "dateTime",
            renderHeader: () => renderCompactHeader(t("endTime")),
            valueGetter: value => new Date(value),
            valueFormatter: value => new Date(value).toLocaleString(locale),
            renderCell: params => renderCompactTimestamp(params.value ?? params.row.endTime),
        },
        {
            field: "maxGamma",
            headerName: t("maxGamma"),
            minWidth: 90,
            flex: 0.68,
            renderHeader: () => renderCompactHeader(t("maxGamma")),
            renderCell: params => (
                <Box component="span" className="alarm-cell-primary" sx={{fontVariantNumeric: "tabular-nums", fontWeight: 600, fontSize: "0.83rem"}}>
                    {params.value}
                </Box>
            ),
        },
        {
            field: "maxNeutron",
            headerName: t("maxNeutron"),
            minWidth: 96,
            flex: 0.72,
            renderHeader: () => renderCompactHeader(t("maxNeutron")),
            renderCell: params => (
                <Box component="span" className="alarm-cell-primary" sx={{fontVariantNumeric: "tabular-nums", fontWeight: 600, fontSize: "0.83rem"}}>
                    {params.value}
                </Box>
            ),
        },
        {
            field: "status",
            headerName: t("status"),
            minWidth: 126,
            flex: 0.98,
            renderHeader: () => renderCompactHeader(t("status")),
            valueFormatter: (value: string) => formatOccupancyStatus(value, t),
            renderCell: params => {
                const rawStatus = String(params.value ?? "None");
                const isGamma = rawStatus === "Gamma";
                const isNeutron = rawStatus === "Neutron";
                const isGammaNeutron = rawStatus === "Gamma & Neutron" || (rawStatus !== "None" && !isGamma && !isNeutron);
                return (
                    <Box
                        component="span"
                        className="status-pill"
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            px: 1.15,
                            py: 0.35,
                            borderRadius: "999px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            lineHeight: 1.2,
                            letterSpacing: "0.01em",
                            whiteSpace: "nowrap",
                            maxWidth: "100%",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            ...(isGamma && {
                                bgcolor: "error.main",
                                color: "error.contrastText",
                            }),
                            ...(isNeutron && {
                                bgcolor: "info.main",
                                color: "info.contrastText",
                            }),
                            ...(isGammaNeutron && {
                                bgcolor: "secondary.main",
                                color: "secondary.contrastText",
                            }),
                            ...(!isGamma && !isNeutron && !isGammaNeutron && {
                                bgcolor: "action.hover",
                                color: "text.secondary",
                                border: "1px solid",
                                borderColor: "divider",
                            }),
                        }}
                    >
                        {params.formattedValue ?? formatOccupancyStatus(rawStatus, t)}
                    </Box>
                );
            },
            sortComparator: (_left, _right, leftCellParams, rightCellParams) =>
                sortEventsByAlarmPriority(
                    leftCellParams.api.getRow(leftCellParams.id),
                    rightCellParams.api.getRow(rightCellParams.id),
                ),
        },
        {
            field: "adjudicatedIds",
            headerName: t("adjudicated"),
            minWidth: 86,
            flex: 0.65,
            renderHeader: () => renderCompactHeader(t("adjudicated")),
            valueFormatter: (value: any) => hasEmlNonThreatMarker(value)
                ? t("emlNonThreat")
                : hasExtendedOccupancyGammaMarker(value)
                    ? "Code 9998"
                    : (value?.length > 0 ? t("yes") : t("no")),
            renderCell: params => {
                const isAuto = hasEmlNonThreatMarker(params.value) || hasExtendedOccupancyGammaMarker(params.value);
                const isYes = !isAuto && (params.value?.length ?? 0) > 0;
                return (
                    <Box
                        component="span"
                        sx={{
                            fontSize: "0.8rem",
                            fontWeight: isAuto || isYes ? 600 : 400,
                            color: isAuto ? "info.main" : isYes ? "success.main" : "text.secondary",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }}
                    >
                        {params.formattedValue}
                    </Box>
                );
            },
        },
        {
            field: "adjudicationCode",
            headerName: t("adjudicationCode"),
            minWidth: 132,
            flex: 1.05,
            renderHeader: () => renderCompactHeader(t("adjudicationCode")),
            valueGetter: (_value, row) => extractLatestAdjudicationCode(row.adjudicatedIds),
            valueFormatter: (value: number | null) => value === null || value === undefined ? "—" : formatAdjudicationCodeLabel(value),
        },
        {
            field: "vehicleId",
            headerName: t("vehicleId"),
            minWidth: 124,
            flex: 0.9,
            sortable: false,
            filterable: false,
            renderHeader: () => renderCompactHeader(t("vehicleId")),
            valueGetter: (_value, row) => row.vehicleId ?? "",
            renderCell: params => {
                const value = params.row.vehicleId;
                if (!value) {
                    return (
                        <Box component="span" sx={{color: "text.secondary", fontSize: "0.8rem"}}>
                            —
                        </Box>
                    );
                }
                const label = params.row.vehicleIdFromOcr ? `${value} (${t("ocrShort")})` : value;
                const tooltipTitle = params.row.vehicleIdFromOcr
                    ? `${t("ocrTablePendingHint")} — ${t("vehicleCompareTooltip")}`
                    : t("vehicleCompareTooltip");
                return (
                    <Tooltip title={tooltipTitle} arrow enterTouchDelay={0}>
                        <Box
                            component="button"
                            type="button"
                            aria-label={t("vehicleCompareActionLabel", {vehicleId: value})}
                            data-testid="event-row-vehicle-id-btn"
                            onClick={event => {
                                event.stopPropagation();
                                setComparisonDialogState({
                                    vehicleId: value,
                                    matchMode: "equals",
                                    highlightObsId: params.row.occupancyObsId,
                                });
                            }}
                            sx={{
                                appearance: "none",
                                background: "none",
                                border: "1px solid transparent",
                                borderRadius: 1,
                                px: 0.5,
                                py: 0.25,
                                cursor: "pointer",
                                fontFamily: "monospace",
                                fontStyle: params.row.vehicleIdFromOcr ? "italic" : "normal",
                                fontWeight: params.row.vehicleIdFromOcr ? 500 : 600,
                                fontSize: "0.8rem",
                                color: params.row.vehicleIdFromOcr ? "text.secondary" : "primary.main",
                                textDecoration: "underline",
                                textDecorationStyle: "dotted",
                                textUnderlineOffset: "2px",
                                minInlineSize: 0,
                                maxWidth: "100%",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                "&:hover": {
                                    bgcolor: "action.hover",
                                    borderColor: "divider",
                                },
                                "&:focus-visible": {
                                    outline: "2px solid",
                                    outlineColor: "primary.main",
                                    outlineOffset: "1px",
                                },
                            }}
                        >
                            {label}
                        </Box>
                    </Tooltip>
                );
            },
        },
        {
            field: "Menu",
            headerName: "",
            type: "actions",
            width: 40,
            minWidth: 40,
            maxWidth: 40,
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            getActions: params => [<GridActionsCellItem key="details" icon={<VisibilityRoundedIcon />} label={t("details")} onClick={() => previewEvent(params.row, true)} showInMenu />],
        },
    ], [formatAdjudicationCodeLabel, isRowUnread, locale, renderCompactHeader, renderCompactTimestamp, t]);

    const resolvedColumnSettings = useMemo(
        () => (columnSettings ? resolveEventTableColumns(columnSettings) : undefined),
        [columnSettings],
    );
    const displayColumns = useMemo(
        () => (resolvedColumnSettings ? applyColumnSettings(columns, resolvedColumnSettings) : columns),
        [columns, resolvedColumnSettings],
    );
    const reportColumnSettings = (next: EventTableColumnSetting[]) => {
        if (onColumnSettingsChange)
            onColumnSettingsChange(next);
    };
    const handleColumnVisibilityChange = (model: GridColumnVisibilityModel) => {
        setColumnVisibilityModel(model);
        if (resolvedColumnSettings)
            reportColumnSettings(resolvedColumnSettings.map((c) =>
                c.key in model ? {...c, visible: model[c.key] !== false} : c));
    };
    const handleColumnOrderChange = (params: GridColumnOrderChangeParams) => {
        if (!resolvedColumnSettings) return;
        const fields = gridApiRef.current?.getAllColumns?.().map((c) => c.field) ?? [];
        // The grid has already applied the move; read its order back rather than replaying indices
        // (the checkbox column shifts them).
        reportColumnSettings(applyFieldOrder(resolvedColumnSettings, fields.length ? fields : [params.column.field]));
    };
    const handleColumnWidthChange = (params: GridColumnResizeParams) => {
        if (!resolvedColumnSettings) return;
        reportColumnSettings(resolvedColumnSettings.map((c) =>
            c.key === params.colDef.field ? {...c, width: Math.round(params.width)} : c));
    };

    const getColumnList = () => columns
        .filter(column => viewAdjudicated || (column.field !== "adjudicatedIds" && column.field !== "adjudicationCode"))
        .map(column => column.field);

    const retryEventQueries = () => {
        invalidatePrefetch();
        restoredSnapshotRef.current = null;
        setRestoredSnapshot(null);
        const cutoff = advanceSnapshotCutoff();
        setUnreadReconcileEpoch(previous => previous + 1);
        void refreshCounts(cutoff);
        void fetchPage(paginationModel.page, cutoff);
        if (isVehicleSearchMode) {
            if (submittedVehicleQuery) {
                setSubmittedVehicleQuery(previous => previous ? {...previous, nonce: previous.nonce + 1} : previous);
            } else {
                setFilterEpoch(previous => previous + 1);
            }
        }
    };

    const activeVehicleStartTimeIso = useMemo(() => {
        if (!activeVehicleQuery || activeVehicleQuery.window === "all") return null;
        return new Date(Date.now() - VEHICLE_SEARCH_WINDOW_MS[activeVehicleQuery.window]).toISOString();
    }, [activeVehicleQuery]);

    const isUpSetMaskFiltered = isEventLog && upSetExpanded && selectedUpSetFilter != null;
    const tableRowCount = isUpSetMaskFiltered
        ? upSetMatchedRows.length
        : (isVehicleSearchMode ? vehicleFilteredRows.length : effectiveRowCount);
    const tableLoading = isVehicleSearchMode ? vehicleSearchLoading : loading;

    return (
        <Box sx={{display: "flex", flexDirection: "column", ...(fillHeight ? {height: "100%"} : isEventLog ? {minHeight: 860} : {height: 800}), width: "100%"}}>
            {supportsSortByTimeToggle && (
                <Box
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    className="visually-hidden"
                    data-testid="alarm-acknowledge-status"
                >
                    {ackStatusMessage}
                </Box>
            )}
            {isEventLog && (
                <Box
                    component="search"
                    aria-label={t("vehicleSearchLandmark")}
                    data-testid="vehicle-id-search-bar"
                    sx={{
                        mb: 1,
                        p: 1.25,
                        borderRadius: 1,
                        border: "1px solid",
                        borderColor: "divider",
                        bgcolor: "background.paper",
                    }}
                >
                    <Box
                        component="form"
                        onSubmit={handleVehicleSearchSubmit}
                        sx={{display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1}}
                    >
                        <TextField
                            size="small"
                            label={t("vehicleSearchInputLabel")}
                            placeholder={t("vehicleSearchPlaceholder")}
                            value={vehicleSearchInput}
                            onChange={event => setVehicleSearchInput(event.target.value)}
                            onKeyDown={event => {
                                if (
                                    event.key === "Enter"
                                    && (event.nativeEvent.isComposing || event.keyCode === 229)
                                ) {
                                    event.preventDefault();
                                }
                            }}
                            inputProps={{
                                autoCorrect: "off",
                                autoCapitalize: "none",
                                spellCheck: false,
                                maxLength: 260,
                                "data-testid": "vehicle-id-search-input",
                            }}
                            sx={{
                                minWidth: {xs: "100%", sm: 240},
                                flex: {sm: "1 1 240px", md: "0 1 320px"},
                            }}
                        />
                        <FormControl size="small" sx={{minWidth: 144}}>
                            <InputLabel id="vehicle-search-match-mode-label">
                                {t("vehicleSearchMatchModeLabel")}
                            </InputLabel>
                            <Select
                                labelId="vehicle-search-match-mode-label"
                                label={t("vehicleSearchMatchModeLabel")}
                                value={vehicleSearchMatchMode}
                                onChange={event =>
                                    setVehicleSearchMatchMode(
                                        event.target.value as "contains" | "equals" | "startsWith",
                                    )
                                }
                                data-testid="vehicle-id-match-mode"
                            >
                                <MenuItem value="contains">{t("filterOperator.contains")}</MenuItem>
                                <MenuItem value="equals">{t("filterOperator.equals")}</MenuItem>
                                <MenuItem value="startsWith">{t("filterOperator.startsWith")}</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{minWidth: 132}}>
                            <InputLabel id="vehicle-search-window-label">
                                {t("vehicleSearchWindowLabel")}
                            </InputLabel>
                            <Select
                                labelId="vehicle-search-window-label"
                                label={t("vehicleSearchWindowLabel")}
                                value={vehicleSearchWindow}
                                onChange={event =>
                                    setVehicleSearchWindow(event.target.value as VehicleSearchWindowPreset)
                                }
                                data-testid="vehicle-id-search-window"
                            >
                                <MenuItem value="24h">{t("timeWindow24h")}</MenuItem>
                                <MenuItem value="15d">{t("timeWindow15d")}</MenuItem>
                                <MenuItem value="30d">{t("timeWindow30d")}</MenuItem>
                                <MenuItem value="all">{t("timeWindowAll")}</MenuItem>
                            </Select>
                        </FormControl>
                        <Button
                            type="submit"
                            variant="contained"
                            size="small"
                            startIcon={<SearchRoundedIcon />}
                            disabled={vehicleSearchLoading}
                            data-testid="vehicle-id-search-submit"
                        >
                            {t("vehicleSearchButton")}
                        </Button>
                        {(vehicleSearchInput.length > 0 || isVehicleSearchMode) && (
                            <Button
                                type="button"
                                variant="outlined"
                                size="small"
                                startIcon={<ClearRoundedIcon />}
                                onClick={handleVehicleSearchClear}
                                data-testid="vehicle-id-search-clear"
                            >
                                {t("clear")}
                            </Button>
                        )}
                        {(isVehicleSearchMode && (vehicleSearchResult || uffOmniboxMatches.length > 0)) && (
                            <Stack
                                direction="row"
                                spacing={1}
                                alignItems="center"
                                useFlexGap
                                flexWrap="wrap"
                                sx={{ml: {md: "auto"}}}
                            >
                                {uffOmniboxMatches.length > 0 && (
                                    <Stack
                                        direction="row"
                                        spacing={0.75}
                                        alignItems="center"
                                        useFlexGap
                                        flexWrap="wrap"
                                        data-testid="event-log-uff-match-strip"
                                    >
                                        <Chip
                                            size="small"
                                            color="secondary"
                                            variant="outlined"
                                            label={t("uffOmniboxMatchedChip", {
                                                version: uffOmniboxMatches[0]!.uffVersion,
                                                scanner: uffOmniboxMatches[0]!.scannerId || "NII",
                                                count: uffOmniboxMatches.length,
                                            })}
                                            data-testid="event-log-uff-match-chip"
                                        />
                                        <Button
                                            type="button"
                                            variant="contained"
                                            color="primary"
                                            size="small"
                                            startIcon={<LayersRoundedIcon />}
                                            onClick={() => setEventLogUffViewerUuid(uffOmniboxMatches[0]!.uffUuid)}
                                            data-testid="event-log-open-uff-btn"
                                        >
                                            {t("openCargoXray")}
                                        </Button>
                                    </Stack>
                                )}
                                {vehicleSearchResult && (
                                    <Chip
                                        size="small"
                                        color={vehicleFilteredRows.length > 0 ? "primary" : "default"}
                                        variant="outlined"
                                        label={t("vehicleSearchSummaryChip", {
                                            passes: vehicleFilteredRows.length,
                                            lanes: vehicleSearchResult.summary.distinctLanes,
                                            nodes: vehicleSearchResult.summary.distinctNodes,
                                        })}
                                        data-testid="vehicle-search-summary-chip"
                                    />
                                )}
                                {vehicleSearchResult && vehicleSearchResult.passes.length > 0 && (
                                    <Button
                                        type="button"
                                        variant="contained"
                                        color="secondary"
                                        size="small"
                                        startIcon={<CompareArrowsRoundedIcon />}
                                        onClick={() =>
                                            setComparisonDialogState({
                                                vehicleId: activeVehicleQuery?.vehicleId ?? vehicleSearchInput,
                                                matchMode: activeVehicleQuery?.matchMode ?? vehicleSearchMatchMode,
                                                initialResult: vehicleSearchResult,
                                            })
                                        }
                                        data-testid="vehicle-search-compare-btn"
                                    >
                                        {t("vehicleComparePassesButton", {
                                            count: vehicleSearchResult.passes.length,
                                        })}
                                    </Button>
                                )}
                            </Stack>
                        )}
                    </Box>
                    {vehicleSearchError && (
                        <Alert severity="error" sx={{mt: 1}}>
                            {vehicleSearchError}
                        </Alert>
                    )}
                    {vehicleSearchResult && vehicleSearchResult.unreachableNodes.length > 0 && (
                        <Alert severity="warning" sx={{mt: 1}}>
                            {t("vehicleUnreachableNodesWarning", {
                                nodes: vehicleSearchResult.unreachableNodes
                                    .map(node => node.nodeName)
                                    .join(", "),
                            })}
                        </Alert>
                    )}
                    {isVehicleSearchMode && vehicleSearchResult?.truncated && (
                        <Alert
                            severity="info"
                            role="status"
                            data-testid="vehicle-search-truncated-notice"
                            sx={{mt: 1, "& .MuiAlert-message": {textWrap: "pretty"}}}
                        >
                            {t("vehicleSearchTruncatedNotice", {
                                limit: (vehicleSearchResult.limitPerNode ?? DEFAULT_VEHICLE_SEARCH_LIMIT_PER_NODE).toLocaleString(locale),
                                shown: vehicleFilteredRows.length.toLocaleString(locale),
                            })}
                        </Alert>
                    )}
                </Box>
            )}
            {!isEventLog && isVehicleSearchMode && vehicleSearchResult && vehicleSearchResult.passes.length > 0 && (
                <Alert
                    severity="info"
                    role="status"
                    sx={{mb: 1}}
                    action={
                        <Button
                            type="button"
                            color="inherit"
                            size="small"
                            startIcon={<CompareArrowsRoundedIcon />}
                            onClick={() =>
                                setComparisonDialogState({
                                    vehicleId: activeVehicleQuery?.vehicleId ?? "",
                                    matchMode: activeVehicleQuery?.matchMode ?? "contains",
                                    initialResult: vehicleSearchResult,
                                })
                            }
                            data-testid="vehicle-search-compare-btn"
                        >
                            {t("vehicleComparePassesButton", {
                                count: vehicleSearchResult.passes.length,
                            })}
                        </Button>
                    }
                >
                    <Stack spacing={0.25}>
                        <span>
                            {t("vehicleSearchSummaryChip", {
                                passes: vehicleFilteredRows.length,
                                lanes: vehicleSearchResult.summary.distinctLanes,
                                nodes: vehicleSearchResult.summary.distinctNodes,
                            })}
                        </span>
                        {vehicleSearchResult.truncated && (
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                data-testid="vehicle-search-truncated-notice"
                                sx={{textWrap: "pretty"}}
                            >
                                {t("vehicleSearchTruncatedNotice", {
                                    limit: (vehicleSearchResult.limitPerNode ?? DEFAULT_VEHICLE_SEARCH_LIMIT_PER_NODE).toLocaleString(locale),
                                    shown: vehicleFilteredRows.length.toLocaleString(locale),
                                })}
                            </Typography>
                        )}
                    </Stack>
                </Alert>
            )}
            {(countQueryError || pageQueryError) && !isVehicleSearchMode && (
                <Alert
                    severity="error"
                    role="alert"
                    action={<Button type="button" color="inherit" size="small" onClick={retryEventQueries}>{t("retry")}</Button>}
                    sx={{mb: 1}}
                >
                    {t("eventQueryLoadFailed")}
                </Alert>
            )}
            {isEventLog && (
                <Box
                    component="details"
                    open={upSetExpanded}
                    onToggle={event => {
                        if (event.target !== event.currentTarget) return;
                        const nextOpen = (event.currentTarget as HTMLDetailsElement).open;
                        if (nextOpen && !upSetExpanded && !isVehicleSearchMode) {
                            setUpSetFetchState(previous => ({...previous, loading: true, error: false}));
                        }
                        setUpSetExpanded(nextOpen);
                        if (!nextOpen && selectedUpSetFilter !== null) {
                            setSelectedUpSetFilter(null);
                            setPaginationModel(previous => (previous.page === 0 ? previous : {...previous, page: 0}));
                        }
                    }}
                    data-testid="event-log-upset-section"
                    sx={{
                        mb: 1,
                        px: 1.25,
                        py: 0.75,
                        borderRadius: 1,
                        border: "1px solid",
                        borderColor: "divider",
                        bgcolor: "background.paper",
                        "& > summary": {
                            cursor: "pointer",
                            fontWeight: 600,
                            fontSize: "0.875rem",
                            py: 0.5,
                            userSelect: "none",
                        },
                    }}
                >
                    <summary data-testid="event-log-upset-summary">
                        <Box component="span">{t("eventLogUpSetSummaryToggle")}</Box>
                        {!upSetExpanded && (
                            <Box
                                component="span"
                                sx={{ml: 1, fontWeight: 400, fontSize: "0.8rem", color: "text.secondary"}}
                            >
                                — {t("eventLogUpSetExpandHint")}
                            </Box>
                        )}
                    </summary>
                    {upSetExpanded && (
                        <Box sx={{pt: 1}}>
                            {upSetSummaryLoading ? (
                                <Stack
                                    direction="row"
                                    spacing={1.25}
                                    alignItems="center"
                                    sx={{py: 1.5}}
                                    data-testid="event-log-upset-loading"
                                >
                                    <CircularProgress size={16} />
                                    <Typography variant="body2" color="text.secondary">
                                        {t("eventLogUpSetLoading")}
                                    </Typography>
                                </Stack>
                            ) : upSetFetchState.error ? (
                                <Alert
                                    severity="error"
                                    action={
                                        <Button
                                            type="button"
                                            color="inherit"
                                            size="small"
                                            onClick={() => setUpSetRefreshNonce(previous => previous + 1)}
                                        >
                                            {t("retry")}
                                        </Button>
                                    }
                                >
                                    {t("eventQueryLoadFailed")}
                                </Alert>
                            ) : !eventLogUpSetData || eventLogUpSetData.totalOccupancies === 0 ? (
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{py: 1}}
                                    data-testid="event-log-upset-empty"
                                >
                                    {t("eventLogUpSetNoAlarms")}
                                </Typography>
                            ) : (
                                <Stack spacing={0.75}>
                                    {!isVehicleSearchMode && !hasFilterVehicleRule && upSetFetchState.capped && (
                                        <Typography variant="caption" color="text.secondary">
                                            {t("eventLogUpSetCappedNote", {
                                                sampled: upSetSourceEvents.length.toLocaleString(locale),
                                                total: upSetFetchState.totalAlarmCount.toLocaleString(locale),
                                            })}
                                        </Typography>
                                    )}
                                    <UpSetPlot
                                        data={eventLogUpSetData}
                                        selectedFilter={selectedUpSetFilter}
                                        onSelectFilter={nextFilter => {
                                            setSelectedUpSetFilter(nextFilter);
                                            setPaginationModel(previous => (
                                                previous.page === 0 ? previous : {...previous, page: 0}
                                            ));
                                        }}
                                        testId="event-log-upset-plot"
                                    />
                                </Stack>
                            )}
                        </Box>
                    )}
                </Box>
            )}
            <Box sx={{...(isEventLog && !fillHeight ? {height: 680} : {flex: 1, minHeight: 0}), width: "100%"}}>
                <DataGrid
                    localeText={getDataGridLocaleText(language)}
                    rows={effectiveDisplayRows}
                    getRowId={eventSelectionKey}
                    apiRef={gridApiRef}
                    columns={displayColumns}
                    columnVisibilityModel={columnVisibilityModel}
                    onColumnVisibilityModelChange={handleColumnVisibilityChange}
                    onColumnOrderChange={handleColumnOrderChange}
                    onColumnWidthChange={handleColumnWidthChange}
                    columnHeaderHeight={48}
                    rowHeight={48}
                    loading={tableLoading}
                    paginationMode="server"
                    filterMode="server"
                    paginationModel={paginationModel}
                    onPaginationModelChange={model => {
                        if (isEventLog && model.page !== paginationModel.page) {
                            restoredSnapshotRef.current = null;
                            setRestoredSnapshot(null);
                        }
                        setPaginationModel(model);
                    }}
                    rowCount={tableRowCount}
                    pageSizeOptions={[PAGE_SIZE]}
                    checkboxSelection
                    isRowSelectable={params => params.row.status !== "None" && !params.row.adjudicatedIds?.length}
                    disableRowSelectionOnClick
                    keepNonExistentRowsSelected
                    rowSelectionModel={visibleSelectionModel}
                    onRowSelectionModelChange={handleSelectionChange}
                    onRowClick={(params, event) => {
                        const cell = (event.target as HTMLElement).closest("[data-field]");
                        const field = cell?.getAttribute("data-field");
                        if (
                            field !== GRID_CHECKBOX_SELECTION_FIELD
                            && field !== "Menu"
                            && !(field === "vehicleId" && params.row.vehicleId)
                        ) {
                            previewEvent(params.row);
                        }
                    }}
                    onRowDoubleClick={(params: GridRowParams<EventTableData>) => previewEvent(params.row, true)}
                    slots={{toolbar: CustomToolbar}}
                    slotProps={{
                        toolbar: {
                            activeFilterCount: countEventFilterRules(filter),
                            selectedCount,
                            rowCount: tableRowCount,
                            allFilteredSelected,
                            filterLabel: t("advancedFilters"),
                            selectAllFilteredLabel: t("selectAllFiltered"),
                            clearSelectionLabel: t("clearSelection"),
                            bulkAdjudicateLabel: t("bulkAdjudicateSelected", {count: selectedCount}),
                            acknowledgeSelectedLabel: t("acknowledgeSelected", {count: selectedCount}),
                            acknowledgeAllLabel: t("acknowledgeAll"),
                            onOpenFilters: () => setFilterDialogOpen(true),
                            ...(isEventLog
                                ? {
                                    savedQueriesLabel: t("savedQueriesLabel"),
                                    savedQueryCount: savedBookmarks.length,
                                    resetQueryLabel: t("resetQueryButton"),
                                    hasActiveQuery,
                                    onOpenSavedQueries: (anchor: HTMLElement) => setSavedQueriesAnchorEl(anchor),
                                    onResetQuery: handleResetEventLogQuery,
                                }
                                : {}),
                            onSelectAllFiltered: selectAllFilteredAlarms,
                            onClearSelection: clearSelection,
                            onBulkAdjudicate: () => setBulkDialogOpen(true),
                            ...(supportsSortByTimeToggle
                                ? {
                                    sortByTimeOnly: effectiveSortByTimeOnly,
                                    sortByTimeOnlyLabel: t("newestFirst"),
                                    onToggleSortByTimeOnly: handleToggleSortByTimeOnly,
                                }
                                : {}),
                            ...(isAlarmTable
                                ? {
                                    unreadOnly: effectiveUnreadOnly,
                                    unreadOnlyLabel: t("unreadOnly"),
                                    onToggleUnreadOnly: handleToggleUnreadOnly,
                                    timeWindowPreset,
                                    timeWindowOptions,
                                    timeWindowGroupLabel: t("alarmTimeWindow"),
                                    onSelectTimeWindowPreset: handleSelectTimeWindowPreset,
                                    onAcknowledgeSelected: () => {
                                        void acknowledgeSelectedAlarms();
                                    },
                                    onAcknowledgeAll: () => {
                                        void acknowledgeAllScopedAlarms();
                                    },
                                }
                                : {}),
                        },
                        columnsManagement: {getTogglableColumns: getColumnList},
                    }}
                    sortModel={sortModel}
                    onSortModelChange={setSortModel}
                    getCellClassName={(params: GridCellParams<any, any, string>) => {
                        if (params.value === "Gamma") return "highlightGamma";
                        if (params.value === "Neutron") return "highlightNeutron";
                        if (params.value === "Gamma & Neutron" || (params.value !== "None" && params.field === "status")) return "highlightGammaNeutron";
                        return "";
                    }}
                    getRowClassName={params => {
                        const classes: string[] = [];
                        if (params.row.id === selectedRowId) classes.push("preview-row");
                        if (isAlarmTable) {
                            classes.push(isRowUnread(params.row) ? "unread-alarm-row" : "read-alarm-row");
                        }
                        return classes.join(" ");
                    }}
                    sx={{
                        [`.${gridClasses.row}.preview-row`]: {
                            boxShadow: "inset 3px 0 0 #1976d2",
                            "@media (forced-colors: active)": {
                                outline: "2px solid Highlight",
                                outlineOffset: "-2px",
                            },
                        },
                        [`.${gridClasses.row}.unread-alarm-row`]: {
                            fontWeight: 700,
                        },
                        [`.${gridClasses.row}.unread-alarm-row .alarm-cell-primary`]: {
                            fontWeight: 700,
                        },
                        [`.${gridClasses.row}.read-alarm-row`]: {
                            fontWeight: 400,
                        },
                        [`.${gridClasses.row}.read-alarm-row .alarm-cell-primary`]: {
                            fontWeight: 400,
                        },
                        [`& .unread-alarm-dot`]: {
                            "@media (forced-colors: active)": {
                                backgroundColor: "Highlight",
                                borderColor: "Highlight",
                            },
                        },
                        [`& .${gridClasses.columnHeader}, & .${gridClasses.cell}`]: {px: 0.75},
                        [`& .${gridClasses.cell}`]: {display: "flex", alignItems: "center"},
                        [`& .${gridClasses.columnHeaderTitleContainer}`]: {flex: 1, minWidth: 0, overflow: "visible"},
                        [`& .${gridClasses.columnHeaderTitleContainerContent}`]: {overflow: "visible", minWidth: 0},
                        [`& .${gridClasses.menuIcon}`]: {
                            display: "none",
                            width: 0,
                            mr: 0,
                        },
                        [`& .${gridClasses.columnHeader}:hover .${gridClasses.menuIcon}, & .${gridClasses.menuOpen}`]: {
                            display: "flex",
                            width: "auto",
                            visibility: "visible",
                        },
                        [`& .${gridClasses.iconButtonContainer}`]: {
                            display: "none",
                            width: 0,
                        },
                        [`& .${gridClasses.columnHeader}:hover .${gridClasses.iconButtonContainer}, & .${gridClasses.columnHeader}--sorted .${gridClasses.iconButtonContainer}`]: {
                            display: "flex",
                            width: "auto",
                            visibility: "visible",
                        },
                        [`& .${gridClasses.actionsCell}`]: {
                            gridGap: 0,
                        },
                        [`& [data-field="Menu"]`]: {
                            px: 0,
                            justifyContent: "center",
                            overflow: "hidden",
                        },
                        [`& .${gridClasses.cellCheckbox}, & .${gridClasses.columnHeaderCheckbox}`]: {
                            px: 0.5,
                        },
                        border: "none",
                    }}
                />
            </Box>
            {comparisonDialogState && (
                <VehiclePassComparisonDialog
                    open={Boolean(comparisonDialogState)}
                    onClose={() => setComparisonDialogState(null)}
                    vehicleId={comparisonDialogState.vehicleId}
                    matchMode={comparisonDialogState.matchMode}
                    laneMap={stableLaneMap}
                    activeViewKey={activeViewKey}
                    startTimeIso={comparisonDialogState.initialResult ? activeVehicleStartTimeIso : null}
                    initialResult={comparisonDialogState.initialResult ?? null}
                    highlightOccupancyObsId={comparisonDialogState.highlightObsId ?? null}
                    onAdjudicationComplete={retryEventQueries}
                />
            )}
            {eventLogUffViewerUuid && (
                <CargoUffViewerDialog
                    open={Boolean(eventLogUffViewerUuid)}
                    onClose={() => setEventLogUffViewerUuid(null)}
                    uffUuid={eventLogUffViewerUuid}
                    node={primaryEventLogNode}
                    occupancyObsId={vehicleFilteredRows[0]?.occupancyObsId ?? null}
                />
            )}
            <NestedEventFilterDialog
                open={filterDialogOpen}
                filter={filter}
                nodeOptions={nodeOptions}
                laneOptions={laneOptions}
                adjudicationCodeOptions={adjudicationCodeOptions}
                t={t}
                onClose={() => setFilterDialogOpen(false)}
                onApply={applyFilter}
            />
            {isEventLog && (
                <SavedQueriesPopover
                    anchorEl={savedQueriesAnchorEl}
                    hasActiveQuery={hasActiveQuery}
                    defaultBookmarkName={defaultBookmarkName}
                    bookmarks={savedBookmarks}
                    onClose={() => setSavedQueriesAnchorEl(null)}
                    onApplyBookmark={handleApplyBookmark}
                    onSaveBookmark={handleSaveBookmark}
                    onDeleteBookmark={handleDeleteBookmark}
                />
            )}
            <BulkAdjudicationDialog
                nodes={allFilteredSelected ? bulkQueryPlans.map(plan => plan.node) :
                    Array.from(selectedKeys).flatMap(key => {
                        const event = eventCacheRef.current.get(key);
                        const lane = event && findLaneByDataStreamId(event.dataStreamId);
                        return lane ? [lane.parentNode] : [];
                    })}
                open={bulkDialogOpen}
                count={selectedCount}
                allFiltered={allFilteredSelected}
                t={t}
                onClose={() => setBulkDialogOpen(false)}
                onSubmit={handleBulkSubmit}
            />
            <Snackbar open={bulkSelectionError} autoHideDuration={6000} onClose={() => setBulkSelectionError(false)}>
                <Alert severity="error" onClose={() => setBulkSelectionError(false)}>{t("bulkSelectionLoadFailed")}</Alert>
            </Snackbar>
        </Box>
    );
}
