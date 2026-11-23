"use client";

import React, {useCallback, useContext, useEffect, useId, useMemo, useState} from "react";
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
    IconButton,
    Paper,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CompareArrowsRoundedIcon from "@mui/icons-material/CompareArrowsRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import ShowChartRoundedIcon from "@mui/icons-material/ShowChartRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import LayersRoundedIcon from "@mui/icons-material/LayersRounded";
import dynamic from "next/dynamic";
import ControlStream from "osh-js/source/core/consysapi/controlstream/ControlStream";
import {useRouter} from "next/navigation";

import {DataSourceContext} from "@/app/contexts/DataSourceContext";
import {useLanguage} from "@/app/contexts/LanguageContext";
import {getIntlLocale} from "@/app/utils/LocaleUtils";
import AdjudicationSelect from "@/app/_components/adjudication/AdjudicationSelect";
import IsotopeSelect from "@/app/_components/adjudication/IsotopeSelect";
import SecondaryInspectionSelect from "@/app/_components/adjudication/SecondaryInspectionSelect";
import UpSetPlot from "@/app/_components/common/UpSetPlot";
import {
    buildUpSetCoOccurrenceFromVehiclePasses,
    computeVehiclePassUpSetMask,
    isUpSetFilterValidForData,
    matchesUpSetFilter,
    UpSetFilterSelection,
} from "@/lib/data/oscar/adjudication/IsotopeMapping";
import {
    AdjudicationCode,
    AdjudicationCodes,
} from "@/lib/data/oscar/adjudication/models/AdjudicationConstants";
import {buildEventDetailsHref} from "@/lib/data/oscar/EventLookup";
import {LaneMapEntry} from "@/lib/data/oscar/LaneCollection";
import {
    generateAdjudicationCommandJSON,
    ReportOutputFormat,
    sendCommand,
} from "@/lib/data/oscar/OSCARCommands";
import {isAdjudicationControlStream} from "@/lib/data/oscar/Utilities";
import {
    buildNodeBucketBaseUrl,
    DEFAULT_VEHICLE_SEARCH_LIMIT_PER_NODE,
    FederatedVehicleSearchResult,
    hydrateVehiclePassProfiles,
    isPassAlarming,
    isPassOpenAlarm,
    isPassSpectroscopic,
    MAX_HYDRATED_PROFILE_PASSES,
    normalizeVehicleId,
    searchVehiclePassesAcrossNodes,
    submitVehicleIncidentReport,
    VehiclePassItem,
    VehicleSearchMatchMode,
} from "@/lib/data/oscar/VehicleSearch";
import {
    fetchRetainedEventMedia,
    fetchRetainedMediaAsset,
} from "@/lib/media/RetainedMedia";
import {INode} from "@/lib/data/osh/Node";
import {
    fetchActiveCargoUffInfo,
    searchCargoUff,
    UffSearchMatch,
} from "@/lib/data/oscar/CargoUffApi";

const CargoUffViewerDialog = dynamic(
    () => import("@/app/_components/uff/CargoUffViewerDialog"),
    {ssr: false},
);

export interface VehiclePassComparisonDialogProps {
    open: boolean;
    onClose: () => void;
    vehicleId: string;
    matchMode?: VehicleSearchMatchMode;
    laneMap: Map<string, LaneMapEntry>;
    nodes?: readonly INode[];
    activeViewKey?: string | null;
    startTimeIso?: string | null;
    endTimeIso?: string | null;
    initialResult?: FederatedVehicleSearchResult | null;
    highlightOccupancyObsId?: string | null;
    onAdjudicationComplete?: () => void;
    fetchImpl?: typeof fetch;
}

const TRACE_COLORS = [
    "#d32f2f",
    "#1976d2",
    "#2e7d32",
    "#ed6c02",
    "#7b1fa2",
    "#00838f",
];

const MAX_THUMBNAIL_BYTES = 4 * 1024 * 1024;

function resolvePassEpochMs(pass: Pick<VehiclePassItem, "startTime" | "samplingTime" | "endTime">): number {
    for (const candidate of [pass.startTime, pass.samplingTime, pass.endTime]) {
        if (!candidate) continue;
        const ms = Date.parse(candidate);
        if (Number.isFinite(ms)) return ms;
    }
    return 0;
}

function formatElapsedOffset(deltaSeconds: number): string {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return "+0s";
    const rounded = Math.round(deltaSeconds);
    if (rounded < 60) return `+${rounded}s`;
    const mins = Math.floor(rounded / 60);
    const secs = rounded % 60;
    if (mins < 60) return secs > 0 ? `+${mins}m ${secs}s` : `+${mins}m`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hours < 24) return remMins > 0 ? `+${hours}h ${remMins}m` : `+${hours}h`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return remHours > 0 ? `+${days}d ${remHours}h` : `+${days}d`;
}

async function resolveAdjudicationControlStreamId(pass: VehiclePassItem): Promise<string | null> {
    const lane = pass.laneEntry;
    const node = pass.node ?? lane?.parentNode ?? null;
    if (!node) return null;

    if (lane && Array.isArray(lane.controlStreams) && lane.controlStreams.length > 0) {
        const match = lane.controlStreams.find((s: typeof ControlStream) => isAdjudicationControlStream(s));
        if (match?.properties?.id) return String(match.properties.id);
    }

    const nodeStreams = (await node.fetchNodeControlStreams()) ?? [];
    if (lane && Array.isArray(lane.systems) && lane.systems.length > 0) {
        const systemIds = new Set(
            lane.systems
                .map((sys: any) => sys?.properties?.id)
                .filter((id: unknown): id is string => typeof id === "string" && id.length > 0),
        );
        const scoped = nodeStreams.find(
            (s: any) => systemIds.has(s?.properties?.["system@id"]) && isAdjudicationControlStream(s),
        );
        if (scoped?.properties?.id) return String(scoped.properties.id);
    }

    const fallback = nodeStreams.find((s: any) => isAdjudicationControlStream(s));
    return fallback?.properties?.id ? String(fallback.properties.id) : null;
}

export default function VehiclePassComparisonDialog({
    open,
    onClose,
    vehicleId,
    matchMode = "equals",
    laneMap,
    nodes,
    activeViewKey,
    startTimeIso,
    endTimeIso,
    initialResult,
    highlightOccupancyObsId,
    onAdjudicationComplete,
    fetchImpl = fetch,
}: VehiclePassComparisonDialogProps) {
    const {language, t} = useLanguage();
    const locale = getIntlLocale(language);
    const router = useRouter();
    const {scopedHref} = useContext(DataSourceContext);
    const dialogTitleId = useId();
    const tableCaptionId = useId();

    const [result, setResult] = useState<FederatedVehicleSearchResult | null>(initialResult ?? null);
    const [loading, setLoading] = useState(false);
    const [loadingProfiles, setLoadingProfiles] = useState(false);
    const [profilesLoaded, setProfilesLoaded] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    const [thumbnailsByKey, setThumbnailsByKey] = useState<
        Record<string, {url: string; source: "ocr" | "retained"}>
    >({});

    // Linked / batch adjudication state
    const [selectedPassKeys, setSelectedPassKeys] = useState<Set<string>>(new Set());
    const [adjCode, setAdjCode] = useState<AdjudicationCode>(AdjudicationCodes.codes[0]);
    const [isotopes, setIsotopes] = useState<string[]>([]);
    const [secondaryStatus, setSecondaryStatus] = useState<string>("NONE");
    const [batchVehicleId, setBatchVehicleId] = useState<string>("");
    const [notes, setNotes] = useState<string>("");
    const [submittingBatch, setSubmittingBatch] = useState<boolean>(false);
    const [batchStatus, setBatchStatus] = useState<{
        severity: "success" | "warning" | "error";
        message: string;
    } | null>(null);

    // Consolidated report export state
    const [exportingFormat, setExportingFormat] = useState<ReportOutputFormat | null>(null);
    const [exportedReport, setExportedReport] = useState<{
        reportUrl: string;
        downloadUrl: string;
        format: ReportOutputFormat;
    } | null>(null);
    const [exportError, setExportError] = useState<string | null>(null);
    const [selectedUpSetFilter, setSelectedUpSetFilter] = useState<UpSetFilterSelection | null>(null);
    const [correlatedUffMatch, setCorrelatedUffMatch] = useState<UffSearchMatch | null>(null);
    const [openUffViewer, setOpenUffViewer] = useState<boolean>(false);
    const primaryComparisonNode = useMemo(
        () => nodes?.[0] ?? Array.from(laneMap.values())[0]?.parentNode ?? null,
        [laneMap, nodes],
    );

    useEffect(() => {
        if (!open) {
            setCorrelatedUffMatch(null);
            setOpenUffViewer(false);
            return;
        }
        if (initialResult && laneMap.size === 0 && (!nodes || nodes.length === 0)) {
            return;
        }
        const normalized = normalizeVehicleId(vehicleId);
        if (normalized.length < 3) {
            setCorrelatedUffMatch(null);
            return;
        }
        const ctrl = new AbortController();
        void fetchActiveCargoUffInfo(primaryComparisonNode, fetchImpl)
            .then(async info => {
                if (!info.enabled || ctrl.signal.aborted) {
                    setCorrelatedUffMatch(null);
                    return;
                }
                const uffRes = await searchCargoUff(
                    {vehicleId, windowMinutes: 0, fuzzy: true, limit: 3},
                    primaryComparisonNode,
                    ctrl.signal,
                    fetchImpl,
                );
                if (!ctrl.signal.aborted) {
                    setCorrelatedUffMatch(uffRes.matches?.[0] ?? null);
                }
            })
            .catch(() => {
                if (!ctrl.signal.aborted) setCorrelatedUffMatch(null);
            });
        return () => ctrl.abort();
    }, [fetchImpl, initialResult, laneMap.size, nodes, open, primaryComparisonNode, vehicleId]);

    const runSearch = useCallback(
        async (includeProfiles: boolean, signal?: AbortSignal) => {
            if (includeProfiles) {
                setLoadingProfiles(true);
            } else {
                setLoading(true);
            }
            setSearchError(null);
            try {
                const next = await searchVehiclePassesAcrossNodes({
                    vehicleId,
                    matchMode,
                    laneMap,
                    nodes,
                    activeViewKey,
                    startTimeIso,
                    endTimeIso,
                    includeProfiles,
                    signal,
                    fetchImpl,
                });
                if (signal?.aborted) return;
                setResult(next);
                if (includeProfiles) {
                    setProfilesLoaded(true);
                }
                const openKeys = new Set(
                    next.passes.filter(isPassOpenAlarm).map(p => p.compositeKey),
                );
                setSelectedPassKeys(openKeys);
                setBatchVehicleId(prev => prev.trim() || next.formattedVehicleId || vehicleId.trim());
            } catch (err) {
                if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) return;
                setSearchError(err instanceof Error ? err.message : String(err));
            } finally {
                if (!signal?.aborted) {
                    setLoading(false);
                    setLoadingProfiles(false);
                }
            }
        },
        [activeViewKey, endTimeIso, fetchImpl, laneMap, matchMode, nodes, startTimeIso, vehicleId],
    );

    useEffect(() => {
        if (!open) {
            setProfilesLoaded(false);
            setBatchStatus(null);
            setExportedReport(null);
            setExportError(null);
            setSelectedUpSetFilter(null);
            return;
        }
        setSelectedUpSetFilter(null);

        const normTarget = normalizeVehicleId(vehicleId);
        if (
            initialResult
            && initialResult.normalizedVehicleId === normTarget
            && initialResult.matchMode === matchMode
        ) {
            setResult(initialResult);
            setSelectedPassKeys(
                new Set(initialResult.passes.filter(isPassOpenAlarm).map(p => p.compositeKey)),
            );
            setBatchVehicleId(initialResult.formattedVehicleId || vehicleId.trim());
            setProfilesLoaded(initialResult.passes.some(p => p.radiationProfile.length > 0));
            return;
        }

        const controller = new AbortController();
        void runSearch(false, controller.signal);
        return () => controller.abort();
    }, [initialResult, matchMode, open, runSearch, vehicleId]);

    // Load authenticated OCR crop or retained midpoint keyframe thumbnails per pass
    useEffect(() => {
        if (!open || !result || result.passes.length === 0) {
            setThumbnailsByKey({});
            return;
        }
        const controller = new AbortController();
        const createdUrls: string[] = [];
        let active = true;

        void Promise.all(
            result.passes.slice(-MAX_HYDRATED_PROFILE_PASSES).map(async (pass) => {
                const node = pass.node;
                if (!node) return null;

                // 1. Prefer OCR evidence image crop if present
                const cropPath = pass.ocr?.evidenceImagePath?.trim().replace(/^\/+/, "") ?? "";
                if (cropPath && !cropPath.includes("..")) {
                    try {
                        const url = `${buildNodeBucketBaseUrl(node)}/${cropPath}`;
                        const resp = await fetchImpl(url, {
                            credentials: "include",
                            headers: {
                                ...(node.getBasicAuthHeader?.() ?? {}),
                                Accept: "image/jpeg",
                            },
                            signal: controller.signal,
                        });
                        if (resp.ok) {
                            const blob = await resp.blob();
                            if (active && !controller.signal.aborted && blob.size > 0 && blob.size <= MAX_THUMBNAIL_BYTES) {
                                const objUrl = URL.createObjectURL(blob);
                                createdUrls.push(objUrl);
                                return [pass.compositeKey, {url: objUrl, source: "ocr" as const}] as const;
                            }
                        }
                    } catch {
                        // Fall through to retained media lookup
                    }
                }

                // 2. Fallback to retained 5-frame midpoint keyframe (frame-03.jpg)
                if (pass.occupancyObsId) {
                    try {
                        const catalog = await fetchRetainedEventMedia(
                            pass.occupancyObsId,
                            node,
                            fetchImpl,
                            controller.signal,
                        );
                        const firstSet = catalog?.mediaSets?.[0];
                        const preferred = firstSet?.assets.find(
                            a => a.asset.position === "MIDDLE" && a.asset.state === "PUBLISHED",
                        ) ?? firstSet?.assets.find(a => a.asset.state === "PUBLISHED");
                        if (preferred) {
                            const blob = await fetchRetainedMediaAsset(
                                preferred,
                                pass.occupancyObsId,
                                node,
                                fetchImpl,
                                controller.signal,
                            );
                            if (active && !controller.signal.aborted && blob.size > 0) {
                                const objUrl = URL.createObjectURL(blob);
                                createdUrls.push(objUrl);
                                return [pass.compositeKey, {url: objUrl, source: "retained" as const}] as const;
                            }
                        }
                    } catch {
                        // Ignore legacy events without retained media
                    }
                }
                return null;
            }),
        ).then((entries) => {
            if (!active || controller.signal.aborted) return;
            const next: Record<string, {url: string; source: "ocr" | "retained"}> = {};
            for (const entry of entries) {
                if (entry) {
                    next[entry[0]] = entry[1];
                }
            }
            setThumbnailsByKey(next);
        });

        return () => {
            active = false;
            controller.abort();
            for (const url of createdUrls) {
                URL.revokeObjectURL(url);
            }
        };
    }, [fetchImpl, open, result]);

    const passes = result?.passes ?? [];
    const summary = result?.summary;
    const firstPassEpochMs = passes.length > 0 ? resolvePassEpochMs(passes[0]) : 0;

    const vehicleUpSetData = useMemo(
        () => buildUpSetCoOccurrenceFromVehiclePasses(passes),
        [passes],
    );

    useEffect(() => {
        if (selectedUpSetFilter === null || loading) return;
        if (!isUpSetFilterValidForData(vehicleUpSetData, selectedUpSetFilter)) {
            setSelectedUpSetFilter(null);
        }
    }, [loading, selectedUpSetFilter, vehicleUpSetData]);

    const displayedPassEntries = useMemo(
        () =>
            passes
                .map((pass, idx) => ({pass, idx}))
                .filter(
                    ({pass}) =>
                        selectedUpSetFilter === null
                        || matchesUpSetFilter(computeVehiclePassUpSetMask(pass), selectedUpSetFilter),
                ),
        [passes, selectedUpSetFilter],
    );

    const openAlarmPasses = useMemo(
        () => passes.filter(isPassOpenAlarm),
        [passes],
    );

    const selectedPasses = useMemo(
        () => openAlarmPasses.filter(p => selectedPassKeys.has(p.compositeKey)),
        [openAlarmPasses, selectedPassKeys],
    );

    const selectedNodes = useMemo<INode[]>(() => {
        const byId = new Map<string, INode>();
        const sourcePasses = selectedPasses.length > 0 ? selectedPasses : openAlarmPasses;
        for (const pass of sourcePasses) {
            if (pass.node?.id && !byId.has(pass.node.id)) {
                byId.set(pass.node.id, pass.node);
            }
        }
        return Array.from(byId.values());
    }, [openAlarmPasses, selectedPasses]);

    const hostReportNode = useMemo<INode | null>(() => {
        const candidateNodes: INode[] = [];
        if (nodes && nodes.length > 0) {
            candidateNodes.push(...nodes);
        }
        for (const lane of laneMap.values()) {
            if (lane.parentNode) candidateNodes.push(lane.parentNode);
        }
        for (const pass of passes) {
            if (pass.node) candidateNodes.push(pass.node);
        }
        return candidateNodes.find(n => n.isDefaultNode) ?? candidateNodes[0] ?? null;
    }, [laneMap, nodes, passes]);

    const handleTogglePass = (compositeKey: string) => {
        setSelectedPassKeys((prev) => {
            const next = new Set(prev);
            if (next.has(compositeKey)) {
                next.delete(compositeKey);
            } else {
                next.add(compositeKey);
            }
            return next;
        });
    };

    const handleToggleAllOpen = () => {
        if (selectedPasses.length === openAlarmPasses.length) {
            setSelectedPassKeys(new Set());
        } else {
            setSelectedPassKeys(new Set(openAlarmPasses.map(p => p.compositeKey)));
        }
    };

    const handleBatchAdjudicate = async () => {
        if (selectedPasses.length === 0) return;
        if (!adjCode || adjCode.code === 0) {
            setBatchStatus({
                severity: "error",
                message: t("selectValidAdjudicationCode"),
            });
            return;
        }

        setSubmittingBatch(true);
        setBatchStatus(null);
        const targetVehicleId = batchVehicleId.trim() || result?.formattedVehicleId || vehicleId.trim();
        let successCount = 0;
        let failCount = 0;

        for (const pass of selectedPasses) {
            try {
                const node = pass.node ?? pass.laneEntry?.parentNode ?? null;
                const csId = await resolveAdjudicationControlStreamId(pass);
                if (!node || !csId || !pass.occupancyObsId) {
                    failCount += 1;
                    continue;
                }
                const resp = await sendCommand(
                    node,
                    csId,
                    generateAdjudicationCommandJSON(
                        notes,
                        adjCode,
                        isotopes,
                        secondaryStatus || "NONE",
                        [],
                        pass.occupancyObsId,
                        targetVehicleId,
                    ),
                );
                if (resp.ok) {
                    successCount += 1;
                } else {
                    failCount += 1;
                }
            } catch {
                failCount += 1;
            }
        }

        setSubmittingBatch(false);
        if (failCount === 0) {
            setBatchStatus({
                severity: "success",
                message: t("vehicleBatchAdjudicateSuccess", {count: successCount}),
            });
        } else {
            setBatchStatus({
                severity: successCount > 0 ? "warning" : "error",
                message: t("vehicleBatchAdjudicatePartial", {
                    success: successCount,
                    failed: failCount,
                }),
            });
        }

        if (successCount > 0) {
            await runSearch(profilesLoaded);
            onAdjudicationComplete?.();
        }
    };

    const handleExportReport = async (format: ReportOutputFormat) => {
        if (!hostReportNode) return;
        setExportingFormat(format);
        setExportError(null);
        setExportedReport(null);

        try {
            let effectiveStart = startTimeIso ?? "";
            let effectiveEnd = endTimeIso ?? "";
            if (!effectiveStart || !effectiveEnd) {
                const epochs = passes.map(resolvePassEpochMs).filter(ms => ms > 0);
                if (epochs.length > 0) {
                    const minMs = Math.min(...epochs) - 60 * 60 * 1000;
                    const maxMs = Math.max(...epochs, Date.now()) + 5 * 60 * 1000;
                    effectiveStart = effectiveStart || new Date(minMs).toISOString();
                    effectiveEnd = effectiveEnd || new Date(maxMs).toISOString();
                } else {
                    effectiveStart = new Date(Date.now() - 30 * 86_400_000).toISOString();
                    effectiveEnd = new Date().toISOString();
                }
            }

            const reportOutcome = await submitVehicleIncidentReport({
                hostNode: hostReportNode,
                startTimeIso: effectiveStart,
                endTimeIso: effectiveEnd,
                format,
                vehicleId: result?.rawVehicleId || vehicleId,
                matchMode,
                remotePasses: passes,
            });
            setExportedReport(reportOutcome);
        } catch (err) {
            setExportError(err instanceof Error ? err.message : String(err));
        } finally {
            setExportingFormat(null);
        }
    };

    const handleLoadRadiationProfiles = useCallback(async () => {
        if (!result || result.passes.length === 0) {
            await runSearch(true);
            return;
        }
        setLoadingProfiles(true);
        setSearchError(null);
        try {
            const outcome = await hydrateVehiclePassProfiles({
                passes: result.passes,
                vehicleId: result.rawVehicleId || vehicleId,
                fetchImpl,
            });
            if (outcome.usedFastPath) {
                setResult(prev => (prev ? {...prev, passes: outcome.passes} : prev));
                setProfilesLoaded(true);
            } else {
                await runSearch(true);
            }
        } catch (err) {
            if (err instanceof Error && err.name === "AbortError") return;
            setSearchError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoadingProfiles(false);
        }
    }, [fetchImpl, result, runSearch, vehicleId]);

    // Build SVG trace paths when profilesLoaded is true (cap to 16 newest sampled passes for legibility)
    const profileChartData = useMemo(() => {
        const allWithSamples = passes
            .map((pass, index) => ({pass, index}))
            .filter(entry => entry.pass.radiationProfile.length > 0);
        if (allWithSamples.length === 0) return null;
        const withSamples = allWithSamples.slice(-16);

        let minOffset = 0;
        let maxOffset = 1;
        let maxGamma = 10;
        let maxNeutron = 0;
        let hasNeutronAlarm = false;
        for (const {pass} of withSamples) {
            if (pass.neutronAlarm) hasNeutronAlarm = true;
            for (const pt of pass.radiationProfile) {
                if (pt.offsetSeconds < minOffset) minOffset = pt.offsetSeconds;
                if (pt.offsetSeconds > maxOffset) maxOffset = pt.offsetSeconds;
                if (pt.gammaCounts > maxGamma) maxGamma = pt.gammaCounts;
                if (pt.neutronCounts > maxNeutron) maxNeutron = pt.neutronCounts;
            }
        }
        const spanOffset = Math.max(0.5, maxOffset - minOffset);
        const showNeutronTraces = maxNeutron > 0 && (hasNeutronAlarm || maxNeutron >= 5);
        return {
            withSamples,
            minOffset,
            maxOffset,
            spanOffset,
            maxGamma,
            maxNeutron: Math.max(5, maxNeutron),
            showNeutronTraces,
        };
    }, [passes]);

    const displayVehicleTitle = result?.formattedVehicleId || vehicleId || "—";

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="xl"
            aria-labelledby={dialogTitleId}
            data-testid="vehicle-pass-comparison-dialog"
        >
            <DialogTitle
                id={dialogTitleId}
                sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, pb: 1}}
            >
                <Stack direction="row" spacing={1.25} alignItems="center" sx={{minInlineSize: 0}}>
                    <CompareArrowsRoundedIcon color="primary" aria-hidden="true" />
                    <Box sx={{minInlineSize: 0}}>
                        <Typography variant="h6" component="span" sx={{fontWeight: 700}}>
                            {t("vehiclePassComparisonTitle")}{" "}
                        </Typography>
                        <Chip
                            label={displayVehicleTitle}
                            color="primary"
                            size="small"
                            sx={{fontFamily: "monospace", fontWeight: 700, ml: 0.5}}
                        />
                    </Box>
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                    {correlatedUffMatch && (
                        <Button
                            type="button"
                            size="small"
                            variant="contained"
                            color="primary"
                            startIcon={<LayersRoundedIcon />}
                            onClick={() => setOpenUffViewer(true)}
                            data-testid="vehicle-comparison-open-uff-btn"
                        >
                            {t("openCargoXray")}
                        </Button>
                    )}
                    <Button
                        type="button"
                        size="small"
                        startIcon={<RefreshRoundedIcon />}
                        onClick={() => void runSearch(profilesLoaded)}
                        disabled={loading || loadingProfiles}
                    >
                        {t("refresh")}
                    </Button>
                    <IconButton aria-label={t("close")} onClick={onClose}>
                        <CloseRoundedIcon />
                    </IconButton>
                </Stack>
            </DialogTitle>

            <DialogContent dividers>
                <Stack spacing={2.5}>
                    {searchError && (
                        <Alert severity="error" role="alert">
                            {searchError}
                        </Alert>
                    )}

                    {result && result.unreachableNodes.length > 0 && (
                        <Alert severity="warning" data-testid="vehicle-unreachable-nodes-alert">
                            {t("vehicleUnreachableNodesWarning", {
                                nodes: result.unreachableNodes.map(n => n.nodeName).join(", "),
                            })}
                        </Alert>
                    )}

                    {/* KPI Summary Cards */}
                    {summary && (
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))",
                                gap: 1.25,
                            }}
                            data-testid="vehicle-incident-kpi-strip"
                        >
                            <Paper variant="outlined" sx={{p: 1.25}}>
                                <Typography variant="caption" color="text.secondary">
                                    {t("vehicleTotalPasses")}
                                </Typography>
                                <Typography variant="h6" sx={{fontVariantNumeric: "tabular-nums", fontWeight: 700}}>
                                    {summary.totalPasses}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {t("vehicleLanesAndNodes", {
                                        lanes: summary.distinctLanes,
                                        nodes: summary.distinctNodes,
                                    })}
                                </Typography>
                            </Paper>

                            <Paper variant="outlined" sx={{p: 1.25}}>
                                <Typography variant="caption" color="text.secondary">
                                    {t("vehicleAlarmingPasses")}
                                </Typography>
                                <Typography
                                    variant="h6"
                                    color={summary.alarmingPasses > 0 ? "error.main" : "text.primary"}
                                    sx={{fontVariantNumeric: "tabular-nums", fontWeight: 700}}
                                >
                                    {summary.alarmingPasses}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {t("vehicleOpenAndEmlCounts", {
                                        open: summary.openAlarmPasses,
                                        eml: summary.emlAutoReleasePasses,
                                    })}
                                </Typography>
                            </Paper>

                            <Paper variant="outlined" sx={{p: 1.25}}>
                                <Typography variant="caption" color="text.secondary">
                                    {t("vehicleSpectroscopicPasses")}
                                </Typography>
                                <Typography variant="h6" sx={{fontVariantNumeric: "tabular-nums", fontWeight: 700}}>
                                    {summary.spectroscopicPasses}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {summary.confirmedIsotopes.length > 0
                                        ? summary.confirmedIsotopes.join(", ")
                                        : t("noIsotopes")}
                                </Typography>
                            </Paper>

                            <Paper variant="outlined" sx={{p: 1.25}}>
                                <Typography variant="caption" color="text.secondary">
                                    {t("vehicleLatestDisposition")}
                                </Typography>
                                <Typography
                                    variant="subtitle2"
                                    sx={{fontWeight: 700, mt: 0.25, wordBreak: "break-word"}}
                                >
                                    {summary.latestDisposition}
                                </Typography>
                            </Paper>
                        </Box>
                    )}

                    {!loading && result?.truncated && (
                        <Alert
                            severity="info"
                            role="status"
                            data-testid="vehicle-comparison-truncated-notice"
                            sx={{"& .MuiAlert-message": {textWrap: "pretty"}}}
                        >
                            {t("vehicleSearchTruncatedNotice", {
                                limit: (result.limitPerNode ?? DEFAULT_VEHICLE_SEARCH_LIMIT_PER_NODE).toLocaleString(locale),
                                shown: passes.length.toLocaleString(locale),
                            })}
                        </Alert>
                    )}

                    {/* Loading indicator */}
                    {loading && (
                        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" py={3}>
                            <CircularProgress size={22} />
                            <Typography variant="body2" color="text.secondary">
                                {t("vehicleSearchingNodes")}
                            </Typography>
                        </Stack>
                    )}

                    {/* Multi-Pass Alarm & Source-Category Co-Occurrence UpSet Plot (in-memory, zero extra queries) */}
                    {!loading && vehicleUpSetData.totalOccupancies > 0 && (
                        <UpSetPlot
                            data={vehicleUpSetData}
                            title={t("vehicleHistoryUpSetTitle")}
                            selectedFilter={selectedUpSetFilter}
                            onSelectFilter={setSelectedUpSetFilter}
                            testId="vehicle-history-upset-plot"
                        />
                    )}

                    {/* Cross-Lane Chronological Pass Comparison Table */}
                    {!loading && passes.length === 0 ? (
                        <Alert severity="info" data-testid="vehicle-no-passes-alert">
                            {t("vehicleNoPassesFound", {vehicleId: displayVehicleTitle})}
                        </Alert>
                    ) : (
                        <Box
                            role="region"
                            aria-labelledby={tableCaptionId}
                            tabIndex={0}
                            data-testid="vehicle-pass-table-region"
                            sx={{
                                overflow: "auto",
                                maxInlineSize: "100%",
                                maxBlockSize: "min(420px, 55dvh)",
                                border: "1px solid",
                                borderColor: "divider",
                                borderRadius: 1.5,
                                "& table": {
                                    inlineSize: "100%",
                                    borderCollapse: "separate",
                                    borderSpacing: 0,
                                    fontSize: "0.84rem",
                                },
                                "& caption": {
                                    textAlign: "start",
                                    fontWeight: 600,
                                    px: 1.5,
                                    py: 1,
                                    borderBlockEnd: "1px solid",
                                    borderColor: "divider",
                                },
                                "& thead": {
                                    position: "sticky",
                                    insetBlockStart: 0,
                                    zIndex: 3,
                                    bgcolor: "background.paper",
                                },
                                "& th, & td": {
                                    px: 1.25,
                                    py: 1,
                                    textAlign: "start",
                                    verticalAlign: "middle",
                                    borderBlockEnd: "1px solid",
                                    borderColor: "divider",
                                },
                                "& thead th": {
                                    fontWeight: 700,
                                    bgcolor: "action.hover",
                                    whiteSpace: "nowrap",
                                },
                                "& tbody th": {
                                    position: "sticky",
                                    insetInlineStart: 0,
                                    zIndex: 2,
                                    fontWeight: 700,
                                    bgcolor: "background.paper",
                                    whiteSpace: "nowrap",
                                    borderInlineEnd: "1px solid",
                                    borderInlineEndColor: "divider",
                                },
                            }}
                        >
                            <table>
                                <caption id={tableCaptionId}>
                                    {t("vehicleComparisonTableCaption", {
                                        vehicleId: displayVehicleTitle,
                                        count: displayedPassEntries.length,
                                    })}
                                </caption>
                                <thead>
                                    <tr>
                                        <th scope="col">
                                            <Stack direction="row" spacing={0.5} alignItems="center">
                                                {openAlarmPasses.length > 0 && (
                                                    <Checkbox
                                                        size="small"
                                                        checked={
                                                            openAlarmPasses.length > 0
                                                            && selectedPasses.length === openAlarmPasses.length
                                                        }
                                                        indeterminate={
                                                            selectedPasses.length > 0
                                                            && selectedPasses.length < openAlarmPasses.length
                                                        }
                                                        onChange={handleToggleAllOpen}
                                                        inputProps={{
                                                            "aria-label": t("vehicleSelectAllOpenAlarms"),
                                                        }}
                                                    />
                                                )}
                                                <span>{t("vehiclePassColumn")}</span>
                                            </Stack>
                                        </th>
                                        <th scope="col">{t("vehicleNodeAndLaneColumn")}</th>
                                        <th scope="col">{t("vehicleTransitTimeColumn")}</th>
                                        <th scope="col">{t("status")}</th>
                                        <th scope="col">{t("vehiclePeakCountsColumn")}</th>
                                        <th scope="col">{t("vehicleFindingsColumn")}</th>
                                        <th scope="col">{t("vehicleIdSourceColumn")}</th>
                                        <th scope="col">{t("vehicleDispositionColumn")}</th>
                                        <th scope="col">{t("details")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedPassEntries.map(({pass, idx}) => {
                                        const passMs = resolvePassEpochMs(pass);
                                        const deltaSeconds =
                                            idx === 0 || firstPassEpochMs <= 0 || passMs <= 0
                                                ? 0
                                                : Math.max(0, (passMs - firstPassEpochMs) / 1000);
                                        const isOpen = isPassOpenAlarm(pass);
                                        const isAlarm = isPassAlarming(pass);
                                        const isHighlighted = Boolean(
                                            highlightOccupancyObsId
                                            && pass.occupancyObsId === highlightOccupancyObsId,
                                        );
                                        const latestAdj = pass.adjudications[pass.adjudications.length - 1];
                                        const isSpectroscopic = isPassSpectroscopic(pass);

                                        return (
                                            <tr
                                                key={pass.compositeKey}
                                                data-testid={`vehicle-pass-row-${idx + 1}`}
                                                style={
                                                    isHighlighted
                                                        ? {backgroundColor: "rgba(25, 118, 210, 0.08)"}
                                                        : undefined
                                                }
                                            >
                                                <th scope="row">
                                                    <Stack direction="row" spacing={0.5} alignItems="center">
                                                        {isOpen ? (
                                                            <Checkbox
                                                                size="small"
                                                                checked={selectedPassKeys.has(pass.compositeKey)}
                                                                onChange={() => handleTogglePass(pass.compositeKey)}
                                                                inputProps={{
                                                                    "aria-label": `${t("vehiclePassColumn")} #${idx + 1}`,
                                                                }}
                                                            />
                                                        ) : null}
                                                        <Box
                                                            component="span"
                                                            sx={{fontVariantNumeric: "tabular-nums"}}
                                                        >
                                                            {`#${idx + 1}`}
                                                        </Box>
                                                    </Stack>
                                                </th>
                                                <td>
                                                    <Stack spacing={0.25}>
                                                        <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
                                                            <Typography variant="body2" sx={{fontWeight: 600}}>
                                                                {pass.laneName}
                                                            </Typography>
                                                            <Chip
                                                                size="small"
                                                                variant="outlined"
                                                                color={isSpectroscopic ? "secondary" : "default"}
                                                                label={pass.systemType}
                                                                sx={{height: 20, fontSize: "0.7rem"}}
                                                            />
                                                            {pass.federatedRemote && (
                                                                <Chip
                                                                    size="small"
                                                                    color="info"
                                                                    label={t("vehicleFederatedBadge")}
                                                                    sx={{height: 20, fontSize: "0.7rem"}}
                                                                />
                                                            )}
                                                        </Stack>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {`${pass.nodeName} · #${pass.occupancyCount}`}
                                                        </Typography>
                                                    </Stack>
                                                </td>
                                                <td style={{fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap"}}>
                                                    <Stack spacing={0.15}>
                                                        <Typography variant="body2" sx={{fontVariantNumeric: "tabular-nums"}}>
                                                            {passMs > 0
                                                                ? new Date(passMs).toLocaleString(locale)
                                                                : pass.startTime || "—"}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {idx === 0
                                                                ? `${t("vehicleInitialPass")} (${pass.durationSeconds.toFixed(1)}s)`
                                                                : `${formatElapsedOffset(deltaSeconds)} (${pass.durationSeconds.toFixed(1)}s)`}
                                                        </Typography>
                                                    </Stack>
                                                </td>
                                                <td>
                                                    <Chip
                                                        size="small"
                                                        color={
                                                            pass.emlAutoReleased
                                                                ? "info"
                                                                : isAlarm
                                                                    ? "error"
                                                                    : "default"
                                                        }
                                                        variant={isAlarm || pass.emlAutoReleased ? "filled" : "outlined"}
                                                        label={pass.alarmStatusLabel}
                                                    />
                                                </td>
                                                <td style={{fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap"}}>
                                                    <Typography variant="body2" sx={{fontWeight: 600, fontVariantNumeric: "tabular-nums"}}>
                                                        {`G: ${pass.maxGammaCount.toLocaleString(locale)} / N: ${pass.maxNeutronCount.toLocaleString(locale)}`}
                                                    </Typography>
                                                    {pass.neutronBackground > 0 && (
                                                        <Typography variant="caption" color="text.secondary">
                                                            {`NB: ${pass.neutronBackground.toFixed(1)}`}
                                                        </Typography>
                                                    )}
                                                </td>
                                                <td>
                                                    <Stack spacing={0.25}>
                                                        {pass.eml?.decision && (
                                                            <Typography variant="caption">
                                                                {`EML: ${pass.eml.decision}`}
                                                                {pass.eml.sourceType ? ` (${pass.eml.sourceType})` : ""}
                                                            </Typography>
                                                        )}
                                                        {pass.webIdAnalyses.map((w, wIdx) => (
                                                            <Typography key={`${w.obsId}-${wIdx}`} variant="caption" color="secondary.main" sx={{fontWeight: 600}}>
                                                                {`WebID: ${w.isotopeString || w.isotopes.join(", ") || "—"}`}
                                                                {w.drf ? ` [${w.drf}]` : ""}
                                                            </Typography>
                                                        ))}
                                                        {pass.confirmedIsotopes.length > 0 && (
                                                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                                                {pass.confirmedIsotopes.map(iso => (
                                                                    <Chip
                                                                        key={iso}
                                                                        size="small"
                                                                        color="secondary"
                                                                        variant="outlined"
                                                                        label={iso}
                                                                        sx={{height: 20, fontSize: "0.7rem"}}
                                                                    />
                                                                ))}
                                                            </Stack>
                                                        )}
                                                        {!pass.eml?.decision
                                                            && pass.webIdAnalyses.length === 0
                                                            && pass.confirmedIsotopes.length === 0 && (
                                                            <Typography variant="caption" color="text.secondary">
                                                                —
                                                            </Typography>
                                                        )}
                                                    </Stack>
                                                </td>
                                                <td>
                                                    <Stack spacing={0.15}>
                                                        <Typography variant="body2" sx={{fontFamily: "monospace", fontWeight: 600}}>
                                                            {pass.vehicleId || "—"}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {pass.vehicleIdSource === "both"
                                                                ? t("vehicleSourceBoth")
                                                                : pass.vehicleIdSource === "ocr"
                                                                    ? `${t("ocrShort")}${pass.ocr ? ` (${Math.round(pass.ocr.confidence * 100)}%)` : ""}`
                                                                    : t("vehicleSourceAdjudicated")}
                                                        </Typography>
                                                    </Stack>
                                                </td>
                                                <td>
                                                    {latestAdj ? (
                                                        <Stack spacing={0.15}>
                                                            <Typography variant="body2" sx={{fontWeight: 600}}>
                                                                {latestAdj.dispositionLabel || `Code ${latestAdj.adjudicationCode}`}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {latestAdj.username}
                                                            </Typography>
                                                        </Stack>
                                                    ) : pass.emlAutoReleased ? (
                                                        <Chip size="small" color="info" label={t("emlNonThreat")} />
                                                    ) : isOpen ? (
                                                        <Chip size="small" color="warning" label={t("vehicleOpenAlarmBadge")} />
                                                    ) : (
                                                        <Typography variant="caption" color="text.secondary">
                                                            —
                                                        </Typography>
                                                    )}
                                                </td>
                                                <td>
                                                    {pass.occupancyObsId ? (
                                                        <Button
                                                            type="button"
                                                            size="small"
                                                            variant="outlined"
                                                            onClick={() => {
                                                                const href = buildEventDetailsHref(
                                                                    pass.occupancyObsId,
                                                                    pass.nodeId,
                                                                );
                                                                onClose();
                                                                router.push(scopedHref(href));
                                                            }}
                                                        >
                                                            {t("view")}
                                                        </Button>
                                                    ) : (
                                                        "—"
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </Box>
                    )}

                    {/* Visual Continuity Filmstrip (OCR Crops & Retained Keyframes) */}
                    {Object.keys(thumbnailsByKey).length > 0 && (
                        <Box data-testid="vehicle-visual-filmstrip">
                            <Typography variant="subtitle2" sx={{mb: passes.length > MAX_HYDRATED_PROFILE_PASSES ? 0.25 : 1, fontWeight: 700}}>
                                {t("vehicleVisualContinuityTitle")}
                            </Typography>
                            {passes.length > MAX_HYDRATED_PROFILE_PASSES && (
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    data-testid="vehicle-filmstrip-truncated-note"
                                    sx={{display: "block", mb: 1, textWrap: "pretty"}}
                                >
                                    {t("vehicleRecentSubsetNotice", {
                                        max: MAX_HYDRATED_PROFILE_PASSES,
                                        total: passes.length.toLocaleString(locale),
                                    })}
                                </Typography>
                            )}
                            <Stack
                                direction="row"
                                spacing={1.5}
                                sx={{overflowX: "auto", pb: 0.75}}
                            >
                                {passes.map((pass, idx) => {
                                    const thumb = thumbnailsByKey[pass.compositeKey];
                                    if (!thumb) return null;
                                    return (
                                        <Paper
                                            key={`thumb-${pass.compositeKey}`}
                                            variant="outlined"
                                            sx={{p: 1, minWidth: 190, maxWidth: 220, flexShrink: 0}}
                                        >
                                            <Box
                                                component="img"
                                                src={thumb.url}
                                                alt={`${pass.laneName} #${idx + 1}`}
                                                sx={{
                                                    display: "block",
                                                    width: "100%",
                                                    height: 104,
                                                    objectFit: "cover",
                                                    borderRadius: 0.75,
                                                    bgcolor: "common.black",
                                                }}
                                            />
                                            <Typography variant="caption" sx={{display: "block", fontWeight: 700, mt: 0.5}}>
                                                {`#${idx + 1} · ${pass.laneName}`}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {thumb.source === "ocr"
                                                    ? t("vehicleThumbOcrCrop")
                                                    : t("vehicleThumbRetainedFrame")}
                                            </Typography>
                                        </Paper>
                                    );
                                })}
                            </Stack>
                        </Box>
                    )}

                    {/* On-Demand Radiation Profile Comparison */}
                    {passes.length > 0 && (
                        <Paper variant="outlined" sx={{p: 1.75}}>
                            <Stack
                                direction={{xs: "column", sm: "row"}}
                                spacing={1}
                                alignItems={{xs: "flex-start", sm: "center"}}
                                justifyContent="space-between"
                            >
                                <Box>
                                    <Typography variant="subtitle2" sx={{fontWeight: 700}}>
                                        {t("vehicleProfileComparisonTitle")}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {t("vehicleProfileComparisonSubtitle")}
                                    </Typography>
                                    {passes.length > MAX_HYDRATED_PROFILE_PASSES && (
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            data-testid="vehicle-profile-truncated-note"
                                            sx={{display: "block", textWrap: "pretty"}}
                                        >
                                            {t("vehicleRecentSubsetNotice", {
                                                max: MAX_HYDRATED_PROFILE_PASSES,
                                                total: passes.length.toLocaleString(locale),
                                            })}
                                        </Typography>
                                    )}
                                </Box>
                                {!profilesLoaded && (
                                    <Button
                                        type="button"
                                        size="small"
                                        variant="outlined"
                                        startIcon={
                                            loadingProfiles ? (
                                                <CircularProgress size={16} />
                                            ) : (
                                                <ShowChartRoundedIcon />
                                            )
                                        }
                                        disabled={loadingProfiles}
                                        onClick={() => void handleLoadRadiationProfiles()}
                                        data-testid="vehicle-load-profiles-btn"
                                    >
                                        {t("vehicleLoadRadiationTraces")}
                                    </Button>
                                )}
                            </Stack>

                            {profilesLoaded && (
                                <Box sx={{mt: 1.5}} data-testid="vehicle-profile-chart">
                                    {profileChartData ? (
                                        <Stack spacing={1}>
                                            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                                                {profileChartData.withSamples.map(({pass, index}, seriesIdx) => {
                                                    const sampleMaxG = pass.radiationProfile.reduce(
                                                        (m, pt) => Math.max(m, pt.gammaCounts),
                                                        0,
                                                    );
                                                    const sampleMaxN = pass.radiationProfile.reduce(
                                                        (m, pt) => Math.max(m, pt.neutronCounts),
                                                        0,
                                                    );
                                                    const peakG = Math.max(pass.maxGammaCount, sampleMaxG);
                                                    const peakN = Math.max(pass.maxNeutronCount, sampleMaxN);
                                                    return (
                                                        <Stack
                                                            key={`legend-${pass.compositeKey}`}
                                                            direction="row"
                                                            spacing={0.75}
                                                            alignItems="center"
                                                        >
                                                            <Box
                                                                component="span"
                                                                sx={{
                                                                    width: 12,
                                                                    height: 12,
                                                                    borderRadius: "50%",
                                                                    bgcolor: TRACE_COLORS[seriesIdx % TRACE_COLORS.length],
                                                                    display: "inline-block",
                                                                }}
                                                            />
                                                            <Typography variant="caption" sx={{fontWeight: 600}}>
                                                                {peakN > 0 && profileChartData.showNeutronTraces
                                                                    ? `#${index + 1} ${pass.laneName} (Peak G: ${peakG} / N: ${peakN})`
                                                                    : `#${index + 1} ${pass.laneName} (Peak G: ${peakG})`}
                                                            </Typography>
                                                        </Stack>
                                                    );
                                                })}
                                            </Stack>
                                            <Box
                                                component="svg"
                                                viewBox="0 0 720 180"
                                                role="img"
                                                aria-label={t("vehicleProfileComparisonTitle")}
                                                sx={{
                                                    width: "100%",
                                                    maxHeight: 200,
                                                    bgcolor: "action.hover",
                                                    borderRadius: 1,
                                                    p: 0.5,
                                                }}
                                            >
                                                <line x1="48" y1="16" x2="48" y2="152" stroke="currentColor" strokeOpacity="0.3" />
                                                <line x1="48" y1="152" x2="684" y2="152" stroke="currentColor" strokeOpacity="0.3" />
                                                {profileChartData.minOffset < 0 && (
                                                    <line
                                                        x1={
                                                            48 +
                                                            ((0 - profileChartData.minOffset) /
                                                                profileChartData.spanOffset) *
                                                                636
                                                        }
                                                        y1="16"
                                                        x2={
                                                            48 +
                                                            ((0 - profileChartData.minOffset) /
                                                                profileChartData.spanOffset) *
                                                                636
                                                        }
                                                        y2="152"
                                                        stroke="currentColor"
                                                        strokeOpacity="0.18"
                                                        strokeDasharray="3 3"
                                                    />
                                                )}
                                                <text x="8" y="24" fontSize="10" fill="currentColor">
                                                    {Math.round(profileChartData.maxGamma)}
                                                </text>
                                                <text x="20" y="152" fontSize="10" fill="currentColor">
                                                    0
                                                </text>
                                                <text x="48" y="170" fontSize="10" fill="currentColor">
                                                    {`${profileChartData.minOffset.toFixed(1).replace(/\.0$/, "")}s`}
                                                </text>
                                                <text x="652" y="170" fontSize="10" fill="currentColor">
                                                    {`${profileChartData.maxOffset.toFixed(1)}s`}
                                                </text>
                                                {profileChartData.showNeutronTraces && (
                                                    <text x="688" y="24" fontSize="10" fill="currentColor">
                                                        {`N:${Math.round(profileChartData.maxNeutron)}`}
                                                    </text>
                                                )}
                                                {profileChartData.withSamples.map(({pass}, seriesIdx) => {
                                                    const color = TRACE_COLORS[seriesIdx % TRACE_COLORS.length];
                                                    const coords = pass.radiationProfile.map((pt) => {
                                                        const x =
                                                            48 +
                                                            ((pt.offsetSeconds - profileChartData.minOffset) /
                                                                profileChartData.spanOffset) *
                                                                636;
                                                        const yGamma =
                                                            152 -
                                                            (Math.max(0, pt.gammaCounts) /
                                                                Math.max(1, profileChartData.maxGamma)) *
                                                                132;
                                                        const yNeutron =
                                                            152 -
                                                            (Math.max(0, pt.neutronCounts) /
                                                                Math.max(1, profileChartData.maxNeutron)) *
                                                                132;
                                                        return {x, yGamma, yNeutron, pt};
                                                    });
                                                    const gammaPts = coords
                                                        .map(c => `${c.x.toFixed(1)},${c.yGamma.toFixed(1)}`)
                                                        .join(" ");
                                                    const neutronPts = coords
                                                        .map(c => `${c.x.toFixed(1)},${c.yNeutron.toFixed(1)}`)
                                                        .join(" ");
                                                    const hasPassNeutron =
                                                        profileChartData.showNeutronTraces &&
                                                        pass.radiationProfile.some(pt => pt.neutronCounts > 0);
                                                    return (
                                                        <g key={`series-${pass.compositeKey}`}>
                                                            {coords.length >= 2 && (
                                                                <polyline
                                                                    data-testid={`gamma-poly-${seriesIdx}`}
                                                                    fill="none"
                                                                    stroke={color}
                                                                    strokeWidth="2.25"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    points={gammaPts}
                                                                />
                                                            )}
                                                            {coords.length <= 12 &&
                                                                coords.map((c, ptIdx) => (
                                                                    <circle
                                                                        key={`g-dot-${ptIdx}`}
                                                                        cx={c.x.toFixed(1)}
                                                                        cy={c.yGamma.toFixed(1)}
                                                                        r={coords.length === 1 ? "3.5" : "2.2"}
                                                                        fill={color}
                                                                    />
                                                                ))}
                                                            {hasPassNeutron && coords.length >= 2 && (
                                                                <polyline
                                                                    data-testid={`neutron-poly-${seriesIdx}`}
                                                                    fill="none"
                                                                    stroke={color}
                                                                    strokeWidth="1.6"
                                                                    strokeDasharray="4 3"
                                                                    strokeOpacity="0.82"
                                                                    points={neutronPts}
                                                                />
                                                            )}
                                                        </g>
                                                    );
                                                })}
                                            </Box>
                                        </Stack>
                                    ) : (
                                        <Typography variant="caption" color="text.secondary">
                                            {t("vehicleNoProfileSamples")}
                                        </Typography>
                                    )}
                                </Box>
                            )}
                        </Paper>
                    )}

                    {/* Linked / Batch Adjudication Panel for Open Alarms */}
                    {openAlarmPasses.length > 0 && (
                        <Paper variant="outlined" sx={{p: 2}} data-testid="vehicle-batch-adjudication-panel">
                            <Stack spacing={1.75}>
                                <Stack
                                    direction={{xs: "column", sm: "row"}}
                                    spacing={1}
                                    alignItems={{xs: "flex-start", sm: "center"}}
                                    justifyContent="space-between"
                                >
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <FactCheckRoundedIcon color="success" aria-hidden="true" />
                                        <Typography variant="subtitle1" sx={{fontWeight: 700}}>
                                            {t("vehicleLinkedAdjudicationTitle", {
                                                selected: selectedPasses.length,
                                                open: openAlarmPasses.length,
                                            })}
                                        </Typography>
                                    </Stack>
                                    {summary && summary.confirmedIsotopes.length > 0 && (
                                        <Button
                                            type="button"
                                            size="small"
                                            variant="outlined"
                                            color="secondary"
                                            onClick={() => setIsotopes(summary.confirmedIsotopes)}
                                        >
                                            {t("vehicleApplyConfirmedIsotopes")}
                                        </Button>
                                    )}
                                </Stack>

                                {batchStatus && (
                                    <Alert severity={batchStatus.severity}>{batchStatus.message}</Alert>
                                )}

                                <Grid container spacing={1.5}>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <AdjudicationSelect
                                            adjCode={adjCode}
                                            onSelect={setAdjCode}
                                            nodes={selectedNodes}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <IsotopeSelect
                                            isotopeValue={isotopes}
                                            onSelect={setIsotopes}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <SecondaryInspectionSelect
                                            secondarySelectVal={secondaryStatus}
                                            onSelect={setSecondaryStatus}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <TextField
                                            size="small"
                                            fullWidth
                                            label={t("vehicleId")}
                                            value={batchVehicleId}
                                            onChange={e => setBatchVehicleId(e.target.value)}
                                            inputProps={{
                                                autoCorrect: "off",
                                                autoCapitalize: "none",
                                                spellCheck: false,
                                                "data-testid": "vehicle-batch-id-input",
                                            }}
                                        />
                                    </Grid>
                                    <Grid item xs={12}>
                                        <TextField
                                            size="small"
                                            fullWidth
                                            multiline
                                            rows={2}
                                            label={t("notes")}
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                            inputProps={{
                                                "data-testid": "vehicle-batch-notes-input",
                                            }}
                                        />
                                    </Grid>
                                </Grid>

                                <Box sx={{display: "flex", justifyContent: "flex-end"}}>
                                    <Button
                                        type="button"
                                        variant="contained"
                                        color="success"
                                        disabled={submittingBatch || selectedPasses.length === 0}
                                        onClick={() => void handleBatchAdjudicate()}
                                        data-testid="vehicle-batch-submit-btn"
                                    >
                                        {submittingBatch
                                            ? t("submitting")
                                            : t("vehicleLinkedAdjudicateSubmit", {
                                                  count: selectedPasses.length,
                                              })}
                                    </Button>
                                </Box>
                            </Stack>
                        </Paper>
                    )}

                    {/* 1-Click Consolidated Vehicle Incident Report Export */}
                    {passes.length > 0 && hostReportNode && (
                        <Paper variant="outlined" sx={{p: 2}} data-testid="vehicle-incident-export-panel">
                            <Stack spacing={1.25}>
                                <Stack
                                    direction={{xs: "column", md: "row"}}
                                    spacing={1.5}
                                    alignItems={{xs: "flex-start", md: "center"}}
                                    justifyContent="space-between"
                                >
                                    <Box>
                                        <Typography variant="subtitle2" sx={{fontWeight: 700}}>
                                            {t("vehicleIncidentReportTitle")}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {t("vehicleIncidentReportSubtitle")}
                                        </Typography>
                                    </Box>
                                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                        {(["PDF", "XLSX", "CSV", "JSON"] as ReportOutputFormat[]).map((fmt) => (
                                            <Button
                                                key={fmt}
                                                type="button"
                                                size="small"
                                                variant={fmt === "PDF" ? "contained" : "outlined"}
                                                startIcon={
                                                    exportingFormat === fmt ? (
                                                        <CircularProgress size={14} color="inherit" />
                                                    ) : (
                                                        <DownloadRoundedIcon />
                                                    )
                                                }
                                                disabled={exportingFormat !== null}
                                                onClick={() => void handleExportReport(fmt)}
                                                data-testid={`vehicle-export-${fmt.toLowerCase()}-btn`}
                                            >
                                                {fmt === "XLSX" ? "Excel (.xlsx)" : fmt}
                                            </Button>
                                        ))}
                                    </Stack>
                                </Stack>

                                {exportError && (
                                    <Alert severity="error">{exportError}</Alert>
                                )}

                                {exportedReport && (
                                    <>
                                        <Divider />
                                        <Stack
                                            direction={{xs: "column", sm: "row"}}
                                            spacing={1}
                                            alignItems={{xs: "stretch", sm: "center"}}
                                            justifyContent="space-between"
                                            data-testid="vehicle-exported-report-links"
                                        >
                                            <Typography variant="body2" color="success.main" sx={{fontWeight: 600}}>
                                                {t("reportCreated")} ({exportedReport.format})
                                            </Typography>
                                            <Stack direction="row" spacing={1}>
                                                {exportedReport.format !== "XLSX" && (
                                                    <Button
                                                        component="a"
                                                        href={exportedReport.reportUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        size="small"
                                                        variant="outlined"
                                                        startIcon={<OpenInNewRoundedIcon />}
                                                    >
                                                        {`${t("openReport")} (${exportedReport.format})`}
                                                    </Button>
                                                )}
                                                <Button
                                                    component="a"
                                                    href={exportedReport.downloadUrl}
                                                    download
                                                    size="small"
                                                    variant="contained"
                                                    startIcon={<DownloadRoundedIcon />}
                                                >
                                                    {`${t("downloadReport")} (${exportedReport.format})`}
                                                </Button>
                                            </Stack>
                                        </Stack>
                                    </>
                                )}
                            </Stack>
                        </Paper>
                    )}
                </Stack>
            </DialogContent>

            <DialogActions>
                <Button type="button" onClick={onClose}>
                    {t("close")}
                </Button>
            </DialogActions>
            {openUffViewer && correlatedUffMatch && (
                <CargoUffViewerDialog
                    open={openUffViewer}
                    onClose={() => setOpenUffViewer(false)}
                    uffUuid={correlatedUffMatch.uffUuid}
                    node={primaryComparisonNode}
                    occupancyObsId={result?.passes?.[0]?.occupancyObsId ?? null}
                    initialRadiationProfile={result?.passes?.[0]?.radiationProfile ?? null}
                />
            )}
        </Dialog>
    );
}
