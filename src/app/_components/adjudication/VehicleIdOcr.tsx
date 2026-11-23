"use client";

import React, {useContext, useEffect, useMemo, useRef, useState} from "react";
import {Box, Chip, Stack, Tooltip, Typography} from "@mui/material";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
import DirectionsCarRoundedIcon from "@mui/icons-material/DirectionsCarRounded";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import DataStream from "osh-js/source/core/consysapi/datastream/DataStream";
import ObservationFilter from "osh-js/source/core/consysapi/observation/ObservationFilter";
import {EventType} from "osh-js/source/core/event/EventType";
import {DataSourceContext} from "@/app/contexts/DataSourceContext";
import {useLanguage} from "@/app/contexts/LanguageContext";
import {
    acquireSharedConnection,
    findRealtimeDataSourceForStream,
    type SharedConnectionLease,
} from "@/lib/data/oscar/LaneCollection";
import {isVehicleOcrDataStream} from "@/lib/data/oscar/Utilities";
import {EventTableData} from "@/lib/data/oscar/TableHelpers";
import {INode} from "@/lib/data/osh/Node";
import {formatIso6346} from "@/lib/data/oscar/adjudication/Iso6346";
import {
    dedupeOcrResults,
    IVehicleOcrResult,
    VehicleOcrResult,
} from "@/lib/data/oscar/adjudication/VehicleOcr";
import {
    removeRealtimeEventSubscription,
    type RealtimeEventHandler,
} from "@/lib/data/oscar/RealtimeEventNotification";

export type OcrBucketNode = Pick<
    INode,
    | "address"
    | "port"
    | "isSecure"
    | "isDefaultNode"
    | "oshPathRoot"
    | "bucketsEndpoint"
    | "getBasicAuthHeader"
>;

export interface VehicleIdOcrProps {
    event: Pick<
        EventTableData,
        "laneId" | "occupancyObsId" | "occupancyCount" | "startTime" | "endTime"
    >;
    selectedValue?: string;
    onResults?: (results: IVehicleOcrResult[]) => void;
    onSelectValue: (value: string, result: IVehicleOcrResult) => void;
    initialResults?: readonly IVehicleOcrResult[];
    nodeOverride?: OcrBucketNode | null;
    fetchImpl?: typeof fetch;
}

const RECENT_EVENT_WINDOW_MS = 90_000;
const RETRY_POLL_DELAYS_MS = [1500, 3000, 5000, 10_000, 20_000] as const;
const MAX_EVIDENCE_CROP_BYTES = 2 * 1024 * 1024;

function buildOcrEvidenceUrl(evidencePath: string, node?: OcrBucketNode | null): string | null {
    const clean = String(evidencePath ?? "").trim().replace(/^\/+/, "");
    if (!clean || clean.includes("..")) {
        return null;
    }
    const oshRoot = node?.oshPathRoot ?? "/sensorhub";
    const bucketsEndpoint = node?.bucketsEndpoint ?? "/buckets";
    const normalizedRoot = oshRoot.endsWith("/") ? oshRoot.slice(0, -1) : oshRoot;
    const normalizedBuckets = bucketsEndpoint.startsWith("/") ? bucketsEndpoint : `/${bucketsEndpoint}`;
    const relative = `${normalizedRoot}${normalizedBuckets}/${clean}`;
    if (!node || node.isDefaultNode) {
        return relative;
    }
    const protocol = node.isSecure ? "https://" : "http://";
    return `${protocol}${node.address}:${node.port}${relative}`;
}

function matchesEventObservation(
    candidate: IVehicleOcrResult,
    event: VehicleIdOcrProps["event"],
): boolean {
    const eventObsId = String(event.occupancyObsId ?? "").trim();
    const candObsId = String(candidate.occupancyObsId ?? "").trim();
    if (eventObsId && candObsId) {
        return eventObsId === candObsId;
    }
    const startMs = Date.parse(event.startTime);
    const endMs = Date.parse(event.endTime || event.startTime);
    const candMs = Date.parse(candidate.time);
    const effectiveEndMs = Number.isFinite(endMs) && Number.isFinite(startMs)
        ? Math.max(startMs, endMs)
        : startMs;

    const eventCount = String(event.occupancyCount ?? "").trim();
    const candCount = String(candidate.occupancyCount ?? "").trim();
    if (eventCount && candCount) {
        if (eventCount !== candCount) {
            return false;
        }
        if (!Number.isFinite(startMs) || !Number.isFinite(candMs)) {
            return true;
        }
        return candMs >= startMs - 5_000 && candMs <= effectiveEndMs + 120_000;
    }

    // Live MQTT occupancy rows whose occupancyObsId is still resolving on the client can match
    // same-lane VehicleOcrResult observations whose sampleTime equals occupancy endTime (+0..2 ms).
    if (!eventObsId && Number.isFinite(startMs) && Number.isFinite(candMs)) {
        return candMs >= startMs - 2_000 && candMs <= effectiveEndMs + 5_000;
    }
    return false;
}

function canonicalCode(raw: string): string {
    return String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export default function VehicleIdOcr({
    event,
    selectedValue,
    onResults,
    onSelectValue,
    initialResults,
    nodeOverride,
    fetchImpl = fetch,
}: VehicleIdOcrProps) {
    const {t} = useLanguage();
    const context = useContext(DataSourceContext);
    const laneMapRef = context?.laneMapRef;

    const [results, setResults] = useState<IVehicleOcrResult[]>(() =>
        initialResults ? dedupeOcrResults(initialResults) : [],
    );
    const [cropObjectUrls, setCropObjectUrls] = useState<Record<string, string>>({});

    const onResultsRef = useRef(onResults);
    onResultsRef.current = onResults;

    const laneEntry = laneMapRef?.current?.get(event.laneId);
    const laneMapReady = Boolean(context?.laneMapReady);
    const isLaneReady = Boolean(event.laneId && context?.readyLaneNames?.has(event.laneId));
    const ocrStreamIdsKey = (laneEntry?.datastreams ?? [])
        .filter(isVehicleOcrDataStream)
        .map((stream: any) => String(stream?.properties?.id ?? ""))
        .join("|");
    const activeNode: OcrBucketNode | null = nodeOverride !== undefined
        ? nodeOverride
        : (laneEntry?.parentNode ?? null);

    useEffect(() => {
        if (initialResults !== undefined) {
            const next = dedupeOcrResults(initialResults);
            setResults(next);
            onResultsRef.current?.(next);
            return;
        }

        const currentLaneEntry = laneMapRef?.current?.get(event.laneId);
        const ocrStreams: Array<typeof DataStream> =
            (currentLaneEntry?.datastreams ?? []).filter(isVehicleOcrDataStream);

        // Zero overhead on lanes where OCR is disabled (no vehicleOcr datastream).
        if (!currentLaneEntry || ocrStreams.length === 0) {
            setResults([]);
            onResultsRef.current?.([]);
            return;
        }

        let active = true;
        let foundAny = false;
        const timers = new Set<number>();

        const applyRawCandidates = (incoming: readonly IVehicleOcrResult[], mergeExisting: boolean) => {
            if (!active) return;
            setResults(previous => {
                const combined = mergeExisting ? [...previous, ...incoming] : [...incoming];
                const deduped = dedupeOcrResults(combined);
                if (deduped.length > 0) {
                    foundAny = true;
                    timers.forEach(timerId => window.clearTimeout(timerId));
                    timers.clear();
                }
                onResultsRef.current?.(deduped);
                return deduped;
            });
        };

        const runQuery = async () => {
            const startMs = Date.parse(event.startTime);
            const endMs = Date.parse(event.endTime || event.startTime);
            const windowStartMs = Number.isFinite(startMs) ? startMs - 60_000 : Date.now() - 3_600_000;
            const windowEndMs = Math.max(
                Number.isFinite(endMs) ? endMs : windowStartMs,
                Date.now(),
            ) + 120_000;

            const collected: IVehicleOcrResult[] = [];
            await Promise.all(ocrStreams.map(async (stream) => {
                try {
                    const collection = await stream.searchObservations(
                        new ObservationFilter({
                            resultTime: `${new Date(windowStartMs).toISOString()}/${new Date(windowEndMs).toISOString()}`,
                            order: "desc",
                        } as any),
                        50,
                    );
                    if (!active) return;
                    const page: any[] = (await collection.nextPage()) ?? [];
                    for (const obs of page) {
                        const parsed = VehicleOcrResult.fromObservation(obs);
                        if (parsed && matchesEventObservation(parsed, event)) {
                            collected.push(parsed);
                        }
                    }
                } catch (error) {
                    if (active) {
                        console.warn("Unable to query vehicleOcr observations for event", error);
                    }
                }
            }));

            if (!active) return;
            applyRawCandidates(collected, false);
        };

        setResults([]);
        void runQuery().then(() => {
            if (!active || foundAny) return;
            const endMs = Date.parse(event.endTime || event.startTime);
            if (!Number.isFinite(endMs) || Date.now() - endMs > RECENT_EVENT_WINDOW_MS) {
                return;
            }
            let cumulativeMs = 0;
            for (const stepMs of RETRY_POLL_DELAYS_MS) {
                cumulativeMs += stepMs;
                const timerId = window.setTimeout(() => {
                    timers.delete(timerId);
                    if (active && !foundAny) {
                        void runQuery();
                    }
                }, cumulativeMs);
                timers.add(timerId);
            }
        });

        const subscriptions: Array<{
            source: any;
            handler: RealtimeEventHandler;
            lease: SharedConnectionLease;
        }> = [];

        for (const stream of ocrStreams) {
            const source = findRealtimeDataSourceForStream(currentLaneEntry, stream);
            if (!source) continue;
            const handleMessage: RealtimeEventHandler = (message: any) => {
                if (!active) return;
                const payload = message?.values?.[0]?.data ?? message;
                const parsed = VehicleOcrResult.fromObservation(payload);
                if (parsed && matchesEventObservation(parsed, event)) {
                    applyRawCandidates([parsed], true);
                }
            };
            source.subscribe(handleMessage, [EventType.DATA]);
            const lease = acquireSharedConnection(source);
            subscriptions.push({source, handler: handleMessage, lease});
            void lease.ready.catch(error => {
                console.warn("Unable to connect vehicleOcr stream", error);
            });
        }

        return () => {
            active = false;
            timers.forEach(timerId => window.clearTimeout(timerId));
            timers.clear();
            for (const {source, handler, lease} of subscriptions) {
                removeRealtimeEventSubscription(source, handler);
                void lease.release().catch(error => {
                    console.warn("Unable to release vehicleOcr stream lease", error);
                });
            }
        };
    }, [
        event.laneId,
        event.occupancyObsId,
        event.occupancyCount,
        event.startTime,
        event.endTime,
        initialResults,
        isLaneReady,
        laneMapReady,
        laneMapRef,
        ocrStreamIdsKey,
    ]);

    const evidencePathsKey = useMemo(
        () => results.map(item => item.evidenceImagePath).filter(Boolean).sort().join("|"),
        [results],
    );

    useEffect(() => {
        if (!evidencePathsKey) {
            setCropObjectUrls({});
            return;
        }
        const controller = new AbortController();
        const createdUrls: string[] = [];
        let active = true;

        const uniquePaths = Array.from(
            new Set(results.map(item => item.evidenceImagePath).filter(Boolean)),
        );

        void Promise.all(uniquePaths.map(async (path) => {
            const url = buildOcrEvidenceUrl(path, activeNode);
            if (!url) return null;
            try {
                const authHeaders = typeof activeNode?.getBasicAuthHeader === "function"
                    ? (activeNode.getBasicAuthHeader() ?? {})
                    : {};
                const response = await fetchImpl(url, {
                    credentials: "include",
                    headers: {
                        ...authHeaders,
                        Accept: "image/jpeg",
                    },
                    signal: controller.signal,
                });
                if (!response.ok) return null;
                const blob = await response.blob();
                if (!active || controller.signal.aborted || blob.size === 0 || blob.size > MAX_EVIDENCE_CROP_BYTES) {
                    return null;
                }
                const objectUrl = URL.createObjectURL(blob);
                createdUrls.push(objectUrl);
                return [path, objectUrl] as const;
            } catch {
                return null;
            }
        })).then(entries => {
            if (!active || controller.signal.aborted) return;
            const next: Record<string, string> = {};
            for (const entry of entries) {
                if (entry) {
                    next[entry[0]] = entry[1];
                }
            }
            setCropObjectUrls(next);
        });

        return () => {
            active = false;
            controller.abort();
            for (const objectUrl of createdUrls) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [activeNode, evidencePathsKey, fetchImpl, results]);

    if (results.length === 0) {
        return null;
    }

    const selectedCanonical = canonicalCode(selectedValue ?? "");

    return (
        <Box sx={{mt: 1}} data-testid="vehicle-id-ocr-suggestions">
            <Typography
                variant="caption"
                color="text.secondary"
                sx={{display: "block", mb: 0.5, fontWeight: 600}}
            >
                {t("ocrSuggestions")}
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                {results.map((candidate) => {
                    const isContainer = candidate.kind === "container";
                    const displayValue = isContainer && candidate.isoChecksumValid
                        ? formatIso6346(candidate.value)
                        : candidate.value;
                    const isSelected = Boolean(selectedCanonical)
                        && canonicalCode(candidate.value) === selectedCanonical;
                    const cropUrl = candidate.evidenceImagePath
                        ? cropObjectUrls[candidate.evidenceImagePath]
                        : undefined;
                    const confidencePct = Math.round(candidate.confidence * 100);
                    const kindLabel = isContainer ? t("ocrContainerLabel") : t("ocrPlateLabel");

                    const tooltipContent = (
                        <Stack spacing={0.5} sx={{p: 0.25, maxWidth: 260}}>
                            <Typography variant="caption" sx={{fontWeight: 700}}>
                                {kindLabel}
                                {isContainer && candidate.isoChecksumValid
                                    ? ` · ${t("ocrChecksumValid")}`
                                    : ""}
                            </Typography>
                            <Typography variant="caption">
                                {t("ocrConfidence", {
                                    confidence: confidencePct,
                                    frames: candidate.frameCount,
                                })}
                            </Typography>
                            {cropUrl && (
                                <Box
                                    component="img"
                                    src={cropUrl}
                                    alt=""
                                    sx={{
                                        display: "block",
                                        maxWidth: 240,
                                        maxHeight: 96,
                                        objectFit: "contain",
                                        borderRadius: 0.75,
                                        bgcolor: "common.black",
                                        mt: 0.5,
                                    }}
                                />
                            )}
                        </Stack>
                    );

                    return (
                        <Tooltip key={candidate.id} title={tooltipContent} arrow enterTouchDelay={0}>
                            <Chip
                                component="button"
                                type="button"
                                clickable
                                onClick={() => onSelectValue(candidate.value, candidate)}
                                color={isSelected ? "primary" : "default"}
                                variant={isSelected ? "filled" : "outlined"}
                                data-testid={`ocr-chip-${canonicalCode(candidate.value)}`}
                                avatar={cropUrl ? (
                                    <Box
                                        component="img"
                                        src={cropUrl}
                                        alt=""
                                        sx={{
                                            width: 28,
                                            height: 20,
                                            objectFit: "cover",
                                            borderRadius: 0.5,
                                        }}
                                    />
                                ) : undefined}
                                icon={!cropUrl ? (
                                    isContainer ? (
                                        <LocalShippingRoundedIcon fontSize="small" aria-hidden="true" />
                                    ) : (
                                        <DirectionsCarRoundedIcon fontSize="small" aria-hidden="true" />
                                    )
                                ) : undefined}
                                label={
                                    <Box
                                        component="span"
                                        sx={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 0.5,
                                            minInlineSize: 0,
                                            maxInlineSize: 220,
                                        }}
                                    >
                                        <Box
                                            component="span"
                                            sx={{
                                                fontFamily: "monospace",
                                                fontWeight: 600,
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                            }}
                                        >
                                            {displayValue}
                                        </Box>
                                        {isContainer && candidate.isoChecksumValid && (
                                            <VerifiedRoundedIcon
                                                aria-hidden="true"
                                                sx={{
                                                    fontSize: 15,
                                                    flexShrink: 0,
                                                    color: isSelected ? "inherit" : "success.main",
                                                }}
                                            />
                                        )}
                                    </Box>
                                }
                                sx={{
                                    minBlockSize: 32,
                                    "@media (pointer: coarse)": {
                                        minBlockSize: 44,
                                    },
                                    maxInlineSize: "100%",
                                }}
                            />
                        </Tooltip>
                    );
                })}
            </Stack>
        </Box>
    );
}
