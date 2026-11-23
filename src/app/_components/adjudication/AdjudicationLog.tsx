"use client";

import React, {useCallback, useContext, useEffect, useState} from "react";
import dynamic from "next/dynamic";
import AdjudicationData from "@/lib/data/oscar/adjudication/Adjudication";
import {isCargoUffAttachmentPath} from "@/lib/data/oscar/CargoUffApi";

const CargoUffViewerDialog = dynamic(
    () => import("@/app/_components/uff/CargoUffViewerDialog"),
    {ssr: false},
);
import {EventTableData} from "@/lib/data/oscar/TableHelpers";
import {DataSourceContext} from "@/app/contexts/DataSourceContext";
import {DataGrid, GridColDef} from "@mui/x-data-grid";
import { Box, Stack, Typography} from "@mui/material";
import {LaneMapEntry} from "@/lib/data/oscar/LaneCollection";
import {isAdjudicationControlStream} from "@/lib/data/oscar/Utilities";
import ControlStream from "osh-js/source/core/consysapi/controlstream/ControlStream";
import {
    AdjudicationCodes,
    EML_NON_THREAT_CODE,
    EXTENDED_OCCUPANCY_GAMMA_CODE,
} from "@/lib/data/oscar/adjudication/models/AdjudicationConstants";
import {useCustomAdjudicationCodes} from "@/app/hooks/useCustomAdjudicationCodes";
import {resolveAdjudicationCode} from "@/lib/data/oscar/adjudication/CustomAdjudicationCodes";
import {
    isSyntheticAdjudicationMarker,
    parseAdjudicationFeedbackWithEmlMetadata,
} from "@/lib/data/oscar/adjudication/EmlMetadata";
import ControlStreamFilter from "osh-js/source/core/consysapi/controlstream/ControlStreamFilter";
import { Dialog, DialogTitle, DialogContent } from "@mui/material";
import {useLanguage} from "@/app/contexts/LanguageContext";
import {INode} from "@/lib/data/osh/Node";
import {EventType} from "osh-js/source/core/event/EventType";
import {getDataGridLocaleText, getIntlLocale} from '@/app/utils/LocaleUtils';
import {removeRealtimeEventSubscription} from "@/lib/data/oscar/RealtimeEventNotification";

type LaneMapReference = {current: Map<string, LaneMapEntry>};
type AdjudicationLogSource = {
    lane: LaneMapEntry;
    controlStream: typeof ControlStream;
};

export async function waitForAdjudicationLogSource(
    laneMapRef: LaneMapReference,
    laneId: string,
    options: {attempts?: number; delayMs?: number; cancelled?: () => boolean} = {},
): Promise<AdjudicationLogSource | null> {
    const attempts = options.attempts ?? 120;
    const delayMs = options.delayMs ?? 250;
    const cancelled = options.cancelled ?? (() => false);

    for (let attempt = 0; attempt < attempts && !cancelled(); attempt++) {
        const lane = laneMapRef.current.get(laneId);
        if (lane) {
            let controlStream: typeof ControlStream | undefined = lane.controlStreams
                .find((stream) => isAdjudicationControlStream(stream));
            if (!controlStream) {
                try {
                    const laneSystemIds = new Set(lane.systems.map(
                        (system: any) => system.properties.id));
                    const nodeControlStreams = await lane.parentNode.fetchNodeControlStreams() ?? [];
                    controlStream = nodeControlStreams.find((stream: typeof ControlStream) =>
                        laneSystemIds.has(stream.properties["system@id"]) &&
                        isAdjudicationControlStream(stream));
                } catch {
                    // Discovery may still be hydrating immediately after a reload. Retry below.
                }
            }
            if (controlStream) return {lane, controlStream};
        }
        if (attempt + 1 < attempts && !cancelled()) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
    return null;
}


function normalizeAdjudicationTimestamp(rawTime?: string): string {
    if (!rawTime) return "";
    const trimmed = String(rawTime).trim();
    const parsedMs = Date.parse(trimmed);
    if (!Number.isNaN(parsedMs)) {
        return new Date(Math.floor(parsedMs / 1000) * 1000).toISOString();
    }
    return trimmed;
}

function splitAttachmentSegments(rawPath: string): string[] {
    const clean = String(rawPath ?? "").trim().split(/[?#]/, 1)[0] ?? "";
    return clean.split(/[\\/]+/).filter(Boolean);
}

export function formatAdjudicationAttachmentLabel(rawPath: string): string {
    const trimmed = String(rawPath ?? "").trim();
    if (!trimmed) return "";
    const segments = splitAttachmentSegments(trimmed);
    return segments[segments.length - 1] ?? trimmed;
}

export function formatAdjudicationAttachmentLabels(paths: readonly string[]): string[] {
    const baseLabels = paths.map((path) => formatAdjudicationAttachmentLabel(path));
    const hrefSetByBase = new Map<string, Set<string>>();
    paths.forEach((rawPath, index) => {
        const base = baseLabels[index] ?? "";
        const normalizedHref = String(rawPath ?? "").trim();
        let seen = hrefSetByBase.get(base);
        if (!seen) {
            seen = new Set<string>();
            hrefSetByBase.set(base, seen);
        }
        seen.add(normalizedHref);
    });

    return paths.map((rawPath, index) => {
        const base = baseLabels[index] ?? "";
        if ((hrefSetByBase.get(base)?.size ?? 0) <= 1) return base;
        const segments = splitAttachmentSegments(rawPath);
        if (segments.length >= 2) {
            return `${segments[segments.length - 2]}/${segments[segments.length - 1]}`;
        }
        return String(rawPath ?? "").trim() || base;
    });
}

export function adjudicationLogKey(entry: AdjudicationData): string {
    const isotopes = Array.isArray(entry.isotopes)
        ? entry.isotopes.join(",")
        : String(entry.isotopes ?? "");
    const filePaths = Array.isArray(entry.filePaths)
        ? entry.filePaths.join(",")
        : String(entry.filePaths ?? "");
    return [
        entry.occupancyObsId ?? "",
        normalizeAdjudicationTimestamp(entry.time),
        entry.adjudicationCode?.code ?? "",
        entry.username ?? "",
        entry.feedback ?? "",
        entry.secondaryInspectionStatus ?? "",
        entry.vehicleId ?? "",
        isotopes,
        filePaths,
    ].join("|");
}

export function mergeAdjudicationLogs(
    existing: AdjudicationData[],
    incoming: AdjudicationData[],
): AdjudicationData[] {
    const merged = new Map<string, AdjudicationData>();
    const commandIdToKey = new Map<string, string>();
    for (const item of [...existing, ...incoming]) {
        if (!item) continue;
        const cmdId = item.commandId ? String(item.commandId).trim() : "";
        const contentKey = adjudicationLogKey(item);
        const mappedKey = cmdId ? commandIdToKey.get(cmdId) : undefined;
        let key = mappedKey || contentKey;
        const previous = merged.get(key);
        if (previous) {
            const prevCmdId = previous.commandId ? String(previous.commandId).trim() : "";
            if (prevCmdId && cmdId && prevCmdId !== cmdId) {
                // Distinct commandId means a separate immutable adjudication record appended to the list.
                key = `cmd:${cmdId}`;
                if (!item.id) {
                    item.id = cmdId;
                }
                commandIdToKey.set(cmdId, key);
                merged.set(key, item);
                continue;
            }
            // Preserve the existing immutable adjudication record; only hydrate commandId if the
            // earlier entry arrived optimistically before its commandId was known.
            if (!previous.commandId && cmdId) {
                previous.commandId = cmdId;
                commandIdToKey.set(cmdId, key);
            }
            continue;
        }
        if (!item.id) {
            item.id = cmdId || key;
        }
        if (cmdId) {
            commandIdToKey.set(cmdId, key);
        }
        merged.set(key, item);
    }
    return Array.from(merged.values());
}

function buildAdjudicationData(
    reportTime: string,
    occupancyCount: string,
    results: any,
    preferredId?: string,
    commandId?: string,
): AdjudicationData {
    const data = new AdjudicationData(reportTime, occupancyCount, results.occupancyObsId);
    data.setFeedback(results.feedback);
    data.setIsotopes(results.isotopes ?? NaN);
    data.setSecondaryInspectionStatus(results.secondaryInspectionStatus);
    data.setAdjudicationCode(resolveAdjudicationCode(results.adjudicationCode, []));
    data.setVehicleId(results.vehicleId ?? NaN);
    data.setFilePaths(results.filePaths ?? NaN);
    data.setTime(reportTime);
    data.setOccupancyCount(occupancyCount);
    data.setOccupancyObsId(results.occupancyObsId);
    data.setUser(results.username ?? NaN);
    if (commandId) {
        data.commandId = String(commandId);
    }
    data.id = commandId || preferredId || adjudicationLogKey(data);
    return data;
}

const ADJUDICATION_COMMAND_CONCURRENCY = 4;

function mapStatusItemsToAdjudications(
    items: any[],
    occupancyCount: string,
    fallbackCommandId?: string,
): AdjudicationData[] {
    return items.map((obs: any) => {
        if (!obs?.results?.[0]?.data)
            return null;
        const commandId = obs["command@id"] ?? fallbackCommandId;
        return buildAdjudicationData(
            obs.reportTime,
            occupancyCount,
            obs.results[0].data,
            obs.id ?? commandId,
            commandId,
        );
    }).filter((value: AdjudicationData | null): value is AdjudicationData => value !== null);
}

/**
 * Resolves COMPLETED adjudication command statuses for an occupancy event in O(k)
 * HTTP requests by reading result.adjudicatedIds from /observations/{occupancyObsId}
 * and querying /controlstreams/{csId}/commands/{cmdId}/status directly, with an
 * AbortSignal-aware fallback to controlStream.searchStatus when unavailable.
 */
export async function fetchOccupancyAdjudicationStatuses(options: {
    event: Pick<EventTableData, "occupancyObsId" | "occupancyCount"> & {adjudicatedIds?: string[]};
    node?: Partial<Pick<INode, "getConnectedSystemsEndpoint" | "getBasicAuthHeader">> | null;
    source: AdjudicationLogSource;
    signal?: AbortSignal;
    cancelled?: () => boolean;
    fetchImpl?: typeof fetch;
}): Promise<AdjudicationData[]> {
    const fetchFn = options.fetchImpl ?? fetch;
    const isStopped = () => Boolean(options.cancelled?.() || options.signal?.aborted);
    if (isStopped()) return [];

    const restNode = options.source.lane?.parentNode ?? options.node;
    const controlStreamId = options.source.controlStream?.properties?.id;
    const occupancyObsId = String(options.event?.occupancyObsId ?? "").trim();

    if (
        occupancyObsId.length > 0 &&
        typeof controlStreamId === "string" &&
        controlStreamId.length > 0 &&
        typeof restNode?.getConnectedSystemsEndpoint === "function"
    ) {
        try {
            const endpoint = String(restNode.getConnectedSystemsEndpoint(false)).replace(/\/+$/, "");
            const authHeaders = typeof restNode.getBasicAuthHeader === "function"
                ? (restNode.getBasicAuthHeader() ?? {})
                : {};
            const obsResponse = await fetchFn(
                `${endpoint}/observations/${encodeURIComponent(occupancyObsId)}`,
                {
                    method: "GET",
                    credentials: "include",
                    headers: {Accept: "application/om+json", ...authHeaders},
                    signal: options.signal,
                },
            );
            if (isStopped()) return [];
            if (obsResponse.ok) {
                const obsPayload = await obsResponse.json();
                const obsResult = obsPayload?.properties?.result ?? obsPayload?.result;
                if (obsResult && Array.isArray(obsResult.adjudicatedIds)) {
                    const combinedIds = [
                        ...obsResult.adjudicatedIds,
                        ...(Array.isArray(options.event?.adjudicatedIds) ? options.event.adjudicatedIds : []),
                    ];
                    const commandIds = Array.from(new Set(
                        combinedIds
                            .map((value: unknown) => String(value ?? "").trim())
                            .filter((value: string) => value.length > 0 && !isSyntheticAdjudicationMarker(value)),
                    ));
                    if (commandIds.length === 0) {
                        return [];
                    }

                    const perCommandResults: AdjudicationData[][] = new Array(commandIds.length).fill([]);
                    let nextIndex = 0;
                    const workers = Array.from(
                        {length: Math.min(ADJUDICATION_COMMAND_CONCURRENCY, commandIds.length)},
                        async () => {
                            while (!isStopped()) {
                                const currentIndex = nextIndex++;
                                if (currentIndex >= commandIds.length) return;
                                const commandId = commandIds[currentIndex];
                                const statusUrl =
                                    `${endpoint}/controlstreams/${encodeURIComponent(controlStreamId)}` +
                                    `/commands/${encodeURIComponent(commandId)}/status` +
                                    `?statusCode=COMPLETED&format=application/json&offset=0&limit=100`;
                                const statusResponse = await fetchFn(statusUrl, {
                                    method: "GET",
                                    credentials: "include",
                                    headers: authHeaders,
                                    signal: options.signal,
                                });
                                if (isStopped()) return;
                                if (statusResponse.status === 404) {
                                    perCommandResults[currentIndex] = [];
                                    continue;
                                }
                                if (!statusResponse.ok) {
                                    throw new Error(`Command status ${commandId} returned ${statusResponse.status}`);
                                }
                                const statusPayload = await statusResponse.json();
                                const items = Array.isArray(statusPayload?.items)
                                    ? statusPayload.items
                                    : (Array.isArray(statusPayload) ? statusPayload : []);
                                perCommandResults[currentIndex] = mapStatusItemsToAdjudications(
                                    items,
                                    options.event.occupancyCount,
                                    commandId,
                                );
                            }
                        },
                    );
                    await Promise.all(workers);
                    return isStopped() ? [] : perCommandResults.flat();
                }
            }
        } catch (error: any) {
            if (isStopped() || error?.name === "AbortError") {
                return [];
            }
            // Fall through to full control-stream status pagination if direct lookup is unsupported.
        }
    }

    const commandStatuses = await options.source.controlStream.searchStatus(
        new ControlStreamFilter({statusCode: "COMPLETED"}),
        100,
    );
    const adjudications: AdjudicationData[] = [];

    if (
        typeof commandStatuses?.url === "string" &&
        typeof commandStatuses?.filter?.toQueryString === "function" &&
        typeof commandStatuses?.parseResponse === "function"
    ) {
        let pageOffset = 0;
        const pageSize = Number(commandStatuses.pageSize) || 100;
        while (!isStopped()) {
            const queryString = `${commandStatuses.filter.toQueryString()}&offset=${pageOffset}&limit=${pageSize}`;
            const response = await fetchFn(`${commandStatuses.url}?${queryString}`, {
                method: "GET",
                credentials: "include",
                headers: commandStatuses.headers ?? {},
                signal: options.signal,
            });
            if (isStopped()) return [];
            if (!response.ok) {
                throw new Error(`Got ${response.status} response from ${commandStatuses.url}`);
            }
            const payload = await response.json();
            const cmdRes = Array.isArray(payload?.items)
                ? payload.items
                : await commandStatuses.parseResponse(payload);
            adjudications.push(...mapStatusItemsToAdjudications(cmdRes, options.event.occupancyCount));
            if (!Array.isArray(cmdRes) || cmdRes.length < pageSize) {
                break;
            }
            pageOffset += pageSize;
        }
        return isStopped() ? [] : adjudications;
    }

    while (!isStopped() && commandStatuses.hasNext()) {
        const cmdRes = await commandStatuses.nextPage();
        if (isStopped()) return [];
        adjudications.push(...mapStatusItemsToAdjudications(cmdRes, options.event.occupancyCount));
    }
    return isStopped() ? [] : adjudications;
}

export default function AdjudicationLog(props: {
    event: EventTableData;
    node: INode;
    shouldFetch?: boolean;
    onFetchComplete?: () => void;
    onAdjudicationsChange?: (entries: AdjudicationData[]) => void;
}) {
    const { language, t } = useLanguage();
    const locale = getIntlLocale(language);
    const {codes: customCodes} = useCustomAdjudicationCodes(props.node ? [props.node] : []);
    const laneMapRef = useContext(DataSourceContext).laneMapRef;
    const [adjLog, setAdjLog] = useState<AdjudicationData[]>([]);
    const [filteredLog, setFilteredLog] = useState<AdjudicationData[]>([]);
    const [feedbackDialog, setFeedbackDialog] = useState({
        open: false,
        text: ""
    });
    const [nodeEndpoint, setNodeEndpoint] = useState<string | null>(null);
    const [openUffBucketKey, setOpenUffBucketKey] = useState<string | null>(null);

    const logColumns: GridColDef<AdjudicationData>[] = [
        {
            field: 'occupancyCount',
            headerName: t('occupancyId'),
            minWidth: 115,
            flex: 1,
            type: 'string',
        },
        {
            field: 'time',
            headerName: t('timestamp'),
            minWidth: 140,
            flex: 1,
            type: 'string',
            valueFormatter: (params) => (new Date(params)).toLocaleString(locale, {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric'
            }),
        },
        {
            field: 'username',
            headerName: t('user'),
            minWidth: 80,
            flex: 0.8,
            type: 'string',
        },
        {
            field: 'adjudicationCode',
            headerName: t('adjudicationCode'),
            minWidth: 150,
            flex: 1.5,
            valueGetter: (value, row) => {
                const code = row.adjudicationCode.code;
                if (code === EML_NON_THREAT_CODE)
                    return t(`adjudicationCode.${EML_NON_THREAT_CODE}`);
                if (code === EXTENDED_OCCUPANCY_GAMMA_CODE)
                    return t(`adjudicationCode.${EXTENDED_OCCUPANCY_GAMMA_CODE}`);
                if (code <= 11)
                    return t(`adjudicationCode.${code}`);
                const custom = customCodes.find(item => item.code === code);
                return custom
                    ? t("customAdjudicationCodeLabel", {code, label: custom.label})
                    : t("customAdjudicationCodeFallback", {code});
            }
        },
        {
            field: 'feedback',
            headerName: t('feedback'),
            minWidth: 120,
            flex: 1,
            type: 'string',
            renderCell: (params) => {
                const {summaryText, emlMetadata} = parseAdjudicationFeedbackWithEmlMetadata(params.value);
                const maxLength = 50;

                const truncated = summaryText.length > maxLength
                    ? summaryText.substring(0, maxLength) + "..."
                    : summaryText;
                const dialogText = emlMetadata
                    ? `${summaryText}\n\n${JSON.stringify(emlMetadata, null, 2)}`
                    : summaryText;

                return (
                    <div style={{ whiteSpace: "normal", wordWrap: "break-word" }}>
                        {truncated}
                        {(summaryText.length > maxLength || emlMetadata !== null) && (
                            <button
                                className="no-print"
                                style={{ color: "#1976d2", border: "none", background: "none", cursor: "pointer" }}
                                onClick={() => setFeedbackDialog({ open: true, text: dialogText })}
                            >
                                {t('readMore')}
                            </button>
                        )}
                    </div>
                );
            }
        },
        {
            field: 'isotopes',
            headerName: t('isotopes'),
            minWidth: 100,
            flex: 1,
            valueGetter: (value) => {
                if (value === "") return t('unknown');
                else return value;
            }
        },
        {
            field: 'filePaths',
            headerName: t('filePaths'),
            minWidth: 140,
            flex: 1,
            renderCell: (params) => {
                const paths: string[] = Array.isArray(params.value) ? params.value : [];
                if (paths.length === 0) return null;
                const labels = formatAdjudicationAttachmentLabels(paths);
                return (
                    <span>
                        {paths.map((path, index) =>

                            <React.Fragment key={index}>
                                {index > 0 && ', '}
                                {isCargoUffAttachmentPath(path) ? (
                                    <button
                                        type="button"
                                        onClick={() => setOpenUffBucketKey(path)}
                                        data-testid={`adjudication-log-uff-link-${index}`}
                                        style={{
                                            color: '#1976d2',
                                            textDecoration: 'underline',
                                            background: 'none',
                                            border: 'none',
                                            padding: 0,
                                            cursor: 'pointer',
                                            font: 'inherit',
                                        }}
                                    >
                                        {labels[index]}
                                    </button>
                                ) : nodeEndpoint ? (
                                    <a
                                        href={nodeEndpoint + path}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: '#1976d2', textDecoration: 'underline' }}
                                    >
                                        {labels[index]}
                                    </a>
                                ) : labels[index]}
                            </React.Fragment>
                        )}
                    </span>
                );
            }
        },
        {
            field: 'secondaryInspectionStatus',
            headerName: t('secondaryInspection'),
            minWidth: 185,
            flex: 1.2,
            valueFormatter: (value) => value ? t(`secondaryInspection.${String(value).toLowerCase()}`) : '',
        },
        {
            field: 'vehicleId',
            headerName: t('vehicleId'),
            minWidth: 115,
            flex: 0.9,
            valueGetter: (value) => {
                if (value === "") return t('unknown');
                else return value;
            }
        },
    ];

    useEffect(() => {
        if (props.node == null || !props.node.address || !props.node.port)
            return;
        const protocol = props.node.isSecure ? 'https://' : 'http://';
        const endpoint =  `${protocol}${props.node.address}:${props.node.port}${props.node.oshPathRoot}${props.node.bucketsEndpoint}/`

        setNodeEndpoint(endpoint)
    }, [props.node]);


    const fetchStatuses = useCallback(async (cancelled: () => boolean, signal?: AbortSignal) => {
        const isStopped = () => Boolean(cancelled() || signal?.aborted);
        const source = await waitForAdjudicationLogSource(
            laneMapRef,
            props.event.laneId,
            {cancelled: isStopped},
        );
        if (!source || isStopped()) {
            if (!isStopped()) console.warn(
                "Cannot load adjudication statuses: lane/control stream is unavailable:",
                props.event.laneId,
            );
            return;
        }
        const adjudications = await fetchOccupancyAdjudicationStatuses({
            event: props.event,
            node: props.node,
            source,
            cancelled: isStopped,
            signal,
        });
        if (!isStopped()) setAdjLog((prev) => mergeAdjudicationLogs(prev, adjudications));
    }, [laneMapRef, props.event, props.node]);

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();
        if (props.event) void fetchStatuses(() => cancelled, controller.signal).catch((error) => {
            if (!cancelled && !controller.signal.aborted && error?.name !== "AbortError") {
                console.error("Error loading adjudication statuses:", error);
            }
        });
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [props.event, fetchStatuses]);

    useEffect(() => {
        if (!props.shouldFetch) return;
        let cancelled = false;
        const controller = new AbortController();
        void fetchStatuses(() => cancelled, controller.signal)
            .catch((error) => {
                if (!cancelled && !controller.signal.aborted && error?.name !== "AbortError") {
                    console.error("Error refreshing adjudication statuses:", error);
                }
            })
            .finally(() => {
                if (!cancelled && !controller.signal.aborted) props.onFetchComplete?.();
            });
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [props.shouldFetch, props.onFetchComplete, fetchStatuses]);

    useEffect(() => {
        let cancelled = false;
        let controlSource: any = null;

        const handleStatuses = (data: any) => {
            const newAdjData: AdjudicationData[] = [];

            const values = data?.values ?? [];
            for (const value of values) {
                const statusData = value?.data;
                if (!statusData?.results) continue;
                if (statusData.statusCode && statusData.statusCode !== "COMPLETED") continue;

                for (const result of statusData.results) {
                    const results = result?.data;
                    if (!results) continue;

                    newAdjData.push(
                        buildAdjudicationData(
                            statusData.reportTime,
                            props.event.occupancyCount,
                            results,
                            statusData.id ?? statusData["command@id"],
                            statusData["command@id"],
                        ),
                    );
                }
            }
            setAdjLog((prev) => mergeAdjudicationLogs(prev, newAdjData));
        }

        void (async () => {
            const source = await waitForAdjudicationLogSource(
                laneMapRef,
                props.event.laneId,
                {cancelled: () => cancelled},
            );
            if (!source || cancelled) {
                if (!cancelled) console.warn(
                    "Cannot subscribe to adjudication statuses: lane/control stream is unavailable:",
                    props.event.laneId,
                );
                return;
            }
            controlSource = source.lane.createRealTimeConSysApi(source.controlStream);
            if (!controlSource) {
                console.warn("Cannot create rt datasource for adjudication control stream");
                return;
            }
            controlSource.subscribe(handleStatuses, [EventType.DATA]);
            await controlSource.connect();
        })().catch((error) => {
            if (!cancelled) console.error("Error connecting adjudication source:", error);
        });

        return () => {
            cancelled = true;
            if (controlSource) {
                removeRealtimeEventSubscription(controlSource, handleStatuses);
                void Promise.resolve().then(() => controlSource.disconnect()).catch((error) => {
                    console.error("Error disconnecting adjudication source:", error);
                });
            }
        };
    }, [laneMapRef, props.event]);

    useEffect(() => {
        const nextFiltered = adjLog.filter((adjData) => adjData?.occupancyObsId == props.event.occupancyObsId);
        setFilteredLog(nextFiltered);
        props.onAdjudicationsChange?.(nextFiltered);
    }, [adjLog, props.event.occupancyObsId, props.onAdjudicationsChange]);


    return (
        <Stack spacing={2} sx={{ width: '100%' }}>
            <Stack direction={"column"} spacing={1}>
                <Typography variant="h5">{t('loggedAdjudications')}</Typography>
            </Stack>
            <Box sx={{ width: '100%' }}>
                <DataGrid
                    localeText={getDataGridLocaleText(language)}
                    rows={filteredLog}
                    columns={logColumns}
                    sx={{
                        '& .MuiDataGrid-footerContainer': {
                            '@media print': { display: 'none' },
                        },
                    }}
                    initialState={{
                        pagination: {
                            paginationModel: {
                                pageSize: 10
                            }
                        }
                    }}
                    pageSizeOptions={[5, 10, 25, 50, 100]}
                    disableRowSelectionOnClick={true}
                />
            </Box>
            <Dialog
                open={feedbackDialog.open}
                onClose={() => setFeedbackDialog({ open: false, text: "" })}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>{t('feedback')}</DialogTitle>
                <DialogContent>
                    <Typography whiteSpace="pre-wrap">
                        {feedbackDialog.text}
                    </Typography>
                </DialogContent>
            </Dialog>
            {openUffBucketKey && (
                <CargoUffViewerDialog
                    open={Boolean(openUffBucketKey)}
                    onClose={() => setOpenUffBucketKey(null)}
                    bucketKey={openUffBucketKey}
                    node={props.node ?? null}
                    occupancyObsId={props.event?.occupancyObsId ?? null}
                />
            )}
        </Stack>
    );
}
