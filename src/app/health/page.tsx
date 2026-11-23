"use client";

import React, {useEffect, useMemo, useState} from "react";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
} from "@mui/material";
import {
    CampaignRounded,
    CheckCircleRounded,
    ErrorRounded,
    MonitorHeartRounded,
    RadioButtonUncheckedRounded,
    VideocamRounded,
} from "@mui/icons-material";

import {useLanguage} from "@/app/contexts/LanguageContext";
import {getIntlLocale} from "@/app/utils/LocaleUtils";
import LaneWebRelayDialog from "@/app/_components/webrelay/LaneWebRelayDialog";
import {
    getCachedSessionInfo,
    subscribeSessionInfo,
} from "@/lib/data/oscar/AuthSessionApi";
import {
    fetchLaneWebRelayStatusSafe,
    type LaneWebRelayStatusEntry,
} from "@/lib/data/oscar/WebRelayApi";
import {
    OSCAR_SANDBOX_LANES_EVENT,
    OSCAR_SANDBOX_TELEMETRY_EVENT,
} from "@/lib/data/oscar/TrainingSandboxApi";
import {
    DEFAULT_OCCUPANCY_THRESHOLD_MINUTES,
    deriveLaneHealthRows,
    formatHealthDuration,
    summarizeLaneHealth,
    useLaneHealth,
    type ComponentHealth,
    type ConnectionState,
    type TelemetryState,
} from "@/lib/data/oscar/useLaneHealth";

function StatusIndicator({component, labels}: {
    component: ComponentHealth;
    labels: Record<ConnectionState, string>;
}) {
    const color = component.state === "online" ? "success.main" : component.state === "offline" ? "error.main" : "text.disabled";
    const text = labels[component.state];

    return (
        <Tooltip title={`${component.label}: ${text}`}>
            <Chip
                size="small"
                variant="outlined"
                icon={<Box component="span" sx={{width: 9, height: 9, borderRadius: "50%", bgcolor: color}}/>}
                label={`${component.label} · ${text}`}
                sx={{
                    borderColor: component.state === "unknown" ? "divider" : color,
                    "& .MuiChip-icon": {ml: 1},
                }}
            />
        </Tooltip>
    );
}

function FaultIndicator({label, state, faultText, clearText, unknownText}: {
    label: string;
    state: TelemetryState;
    faultText: string;
    clearText: string;
    unknownText: string;
}) {
    const active = state === "active";
    const unknown = state === "unknown";
    return (
        <Chip
            size="small"
            color={active ? "error" : "default"}
            variant={active ? "filled" : "outlined"}
            icon={active ? <ErrorRounded/> : unknown ? <RadioButtonUncheckedRounded/> : <CheckCircleRounded/>}
            label={`${label}: ${active ? faultText : unknown ? unknownText : clearText}`}
            sx={{fontWeight: active ? 700 : 400, opacity: unknown ? 0.72 : 1}}
        />
    );
}

export default function HealthPage() {
    const {language, t} = useLanguage();
    const {lanes, isLoading, thresholdMinutes} = useLaneHealth();
    const [now, setNow] = useState(Date.now());
    const [isAdmin, setIsAdmin] = useState<boolean>(() => Boolean(getCachedSessionInfo()?.isAdmin));
    const [webRelayByLane, setWebRelayByLane] = useState<Map<string, LaneWebRelayStatusEntry>>(new Map());
    const [webRelayDialogOpen, setWebRelayDialogOpen] = useState(false);
    const [webRelayDialogLane, setWebRelayDialogLane] = useState<string | undefined>(undefined);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        setIsAdmin(Boolean(getCachedSessionInfo()?.isAdmin));
        return subscribeSessionInfo((sess) => {
            setIsAdmin(Boolean(sess?.isAdmin));
        });
    }, []);

    const applyWebRelayEntries = React.useCallback((entries: LaneWebRelayStatusEntry[]) => {
        const next = new Map<string, LaneWebRelayStatusEntry>();
        for (const entry of entries) {
            if (entry.laneName) {
                next.set(entry.laneName, entry);
            }
        }
        setWebRelayByLane(next);
    }, []);

    const anyLaneHasWebRelayKeyword = useMemo(
        () => lanes.some((lane) => Boolean(lane.webRelayConfigured)),
        [lanes],
    );

    useEffect(() => {
        if (!isAdmin && !anyLaneHasWebRelayKeyword) {
            return;
        }
        let active = true;
        const controller = new AbortController();
        const pollWebRelays = async () => {
            const payload = await fetchLaneWebRelayStatusSafe({signal: controller.signal});
            if (!active || !payload) return;
            setIsAdmin(Boolean(payload.isAdmin));
            applyWebRelayEntries(payload.lanes ?? []);
        };
        void pollWebRelays();
        const interval = window.setInterval(() => {
            void pollWebRelays();
        }, 30_000);
        const onSandboxMutated = () => {
            void pollWebRelays();
        };
        window.addEventListener(OSCAR_SANDBOX_LANES_EVENT, onSandboxMutated);
        window.addEventListener(OSCAR_SANDBOX_TELEMETRY_EVENT, onSandboxMutated);
        return () => {
            active = false;
            controller.abort();
            window.clearInterval(interval);
            window.removeEventListener(OSCAR_SANDBOX_LANES_EVENT, onSandboxMutated);
            window.removeEventListener(OSCAR_SANDBOX_TELEMETRY_EVENT, onSandboxMutated);
        };
    }, [anyLaneHasWebRelayKeyword, applyWebRelayEntries, isAdmin]);

    const mergedLanes = useMemo(() => {
        if (webRelayByLane.size === 0) return lanes;
        return lanes.map((lane) => {
            const wr = webRelayByLane.get(lane.laneName);
            if (!wr || !wr.enabled) return lane;
            const chips: ComponentHealth[] = [
                {
                    id: `${lane.laneName}-webrelay-primary`,
                    label: `${t("webrelayChipPrimary")} (${wr.mode})`,
                    state: wr.primaryOnline ? "online" : "offline",
                },
            ];
            if (wr.ancillaryEnabled) {
                chips.push({
                    id: `${lane.laneName}-webrelay-ancillary`,
                    label: t("webrelayChipAncillary"),
                    state: wr.ancillaryOnline ? "online" : "offline",
                });
            }
            return {
                ...lane,
                webRelays: chips,
            };
        });
    }, [lanes, t, webRelayByLane]);

    const laneRows = useMemo(
        () => deriveLaneHealthRows(mergedLanes, now, thresholdMinutes),
        [mergedLanes, now, thresholdMinutes],
    );
    const summary = useMemo(() => summarizeLaneHealth(laneRows), [laneRows]);
    const thresholdSummaryLabel = useMemo(() => {
        const thresholds = Array.from(new Set(
            laneRows.map((lane) => lane.extendedOccupancyThresholdMinutes ?? DEFAULT_OCCUPANCY_THRESHOLD_MINUTES),
        )).sort((a, b) => a - b);
        if (thresholds.length === 0) {
            return `${DEFAULT_OCCUPANCY_THRESHOLD_MINUTES} ${t("minutes")}`;
        }
        if (thresholds.length === 1) {
            return `${thresholds[0]} ${t("minutes")}`;
        }
        return `${thresholds[0]}–${thresholds[thresholds.length - 1]} ${t("minutes")}`;
    }, [laneRows, t]);

    const openWebRelayForLane = (laneName?: string) => {
        setWebRelayDialogLane(laneName);
        setWebRelayDialogOpen(true);
    };

    return (
        <Stack spacing={2} sx={{pb: 2, minInlineSize: 0}}>
            <Stack direction={{xs: "column", md: "row"}} justifyContent="space-between" alignItems={{xs: "stretch", md: "center"}} spacing={2}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <MonitorHeartRounded color="primary" sx={{fontSize: 36}}/>
                    <Box>
                        <Typography variant="h4" component="h1">{t("stateOfHealth")}</Typography>
                        <Typography variant="body2" color="text.secondary">{t("healthDescription")}</Typography>
                    </Box>
                </Stack>
                <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap>
                    {isAdmin && laneRows.length > 0 && (
                        <Button
                            type="button"
                            variant="outlined"
                            size="small"
                            startIcon={<CampaignRounded/>}
                            onClick={() => openWebRelayForLane(laneRows[0]?.laneName)}
                            data-testid="webrelay-open-header-btn"
                        >
                            {t("webrelayHeaderButton")}
                        </Button>
                    )}
                    <Paper variant="outlined" sx={{p: 1.5}} data-testid="health-threshold-summary">
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <Box>
                                <Typography variant="caption" color="text.secondary">{t("extendedOccupancyThreshold")}</Typography>
                                <Typography variant="body2">{t("configuredInAdminPerLane")}</Typography>
                            </Box>
                            <Chip
                                size="small"
                                color="primary"
                                variant="outlined"
                                label={thresholdSummaryLabel}
                                sx={{fontWeight: 600}}
                            />
                        </Stack>
                    </Paper>
                </Stack>
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip color="success" variant="outlined" label={`${t("healthyLanes")}: ${summary.healthy}`}/>
                <Chip color="error" variant="outlined" label={`${t("lanesWithFaults")}: ${summary.faulted}`}/>
                <Chip color="warning" variant="outlined" label={`${t("lanesWithDisconnections")}: ${summary.disconnected}`}/>
                <Chip variant="outlined" label={`${t("lanesAwaitingTelemetry")}: ${summary.unknown}`}/>
                <Chip variant="outlined" label={`${t("totalLanes")}: ${laneRows.length}`}/>
            </Stack>

            {isLoading && laneRows.length === 0 ? (
                <Paper variant="outlined" sx={{p: 6, textAlign: "center"}}>
                    <CircularProgress size={30}/>
                    <Typography sx={{mt: 2}} color="text.secondary">{t("loadingLaneHealth")}</Typography>
                </Paper>
            ) : laneRows.length === 0 ? (
                <Alert severity="info">{t("noLanesAvailable")}</Alert>
            ) : (
                <TableContainer component={Paper} variant="outlined" sx={{maxInlineSize: "100%", overflowX: "auto"}}>
                    <Table aria-label={t("stateOfHealth")} sx={{minWidth: 1050}}>
                        <TableHead>
                            <TableRow sx={{"& th": {whiteSpace: "nowrap"}}}>
                                <TableCell>{t("lane")}</TableCell>
                                <TableCell>{t("connections")}</TableCell>
                                <TableCell>{t("faultStatus")}</TableCell>
                                <TableCell>{t("currentOccupancy")}</TableCell>
                                <TableCell>{t("lastUpdate")}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {laneRows.map((lane) => (
                                <TableRow
                                    key={lane.laneName}
                                    data-testid={`health-lane-${lane.laneName}`}
                                    sx={{
                                        bgcolor: lane.hasFault ? "rgba(211, 47, 47, 0.055)" : lane.hasOfflineComponent ? "rgba(237, 108, 2, 0.05)" : undefined,
                                        "&:last-child td": {borderBottom: 0},
                                    }}
                                >
                                    <TableCell sx={{verticalAlign: "top", minWidth: 165}}>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            {lane.hasFault
                                                ? <ErrorRounded color="error"/>
                                                : lane.hasOfflineComponent
                                                    ? <RadioButtonUncheckedRounded color="warning"/>
                                                    : lane.hasUnknownTelemetry
                                                        ? <RadioButtonUncheckedRounded sx={{color: "text.disabled"}}/>
                                                        : <CheckCircleRounded color="success"/>}
                                            <Box>
                                                <Typography fontWeight={700}>{lane.laneName}</Typography>
                                                <Typography variant="caption" color="text.secondary">{lane.nodeName}</Typography>
                                            </Box>
                                        </Stack>
                                    </TableCell>
                                    <TableCell sx={{verticalAlign: "top", minWidth: 240}}>
                                        <Stack spacing={0.75} alignItems="flex-start">
                                            <StatusIndicator
                                                component={{...lane.rpm, label: `RPM (${lane.rpm.label})`}}
                                                labels={{online: t("online"), offline: t("offline"), unknown: t("waiting")}}
                                            />
                                            {lane.cameras.length > 0 ? lane.cameras.map((camera) => (
                                                <StatusIndicator
                                                    key={camera.id}
                                                    component={camera}
                                                    labels={{online: t("online"), offline: t("offline"), unknown: t("waiting")}}
                                                />
                                            )) : (
                                                <Chip size="small" variant="outlined" icon={<VideocamRounded/>} label={t("noCameras")}/>
                                            )}
                                            {(lane.webRelays ?? []).map((relay) => (
                                                <StatusIndicator
                                                    key={relay.id}
                                                    component={relay}
                                                    labels={{online: t("online"), offline: t("offline"), unknown: t("waiting")}}
                                                />
                                            ))}
                                            {isAdmin && (
                                                <Button
                                                    type="button"
                                                    size="small"
                                                    variant="text"
                                                    startIcon={<CampaignRounded fontSize="small"/>}
                                                    aria-label={`${t("webrelayRowAction")} — ${lane.laneName}`}
                                                    onClick={() => openWebRelayForLane(lane.laneName)}
                                                    data-testid={`webrelay-open-lane-${lane.laneName}`}
                                                    sx={{textTransform: "none", py: 0.25, px: 0.75, minHeight: 26}}
                                                >
                                                    {t("webrelayRowAction")}
                                                </Button>
                                            )}
                                        </Stack>
                                    </TableCell>
                                    <TableCell sx={{verticalAlign: "top", minWidth: 390}}>
                                        {lane.mobile ? (
                                            <Typography variant="body2" color="text.secondary" data-testid={`health-mobile-faults-${lane.laneName}`}>
                                                {t("mobileFaultsNotMonitored")}
                                            </Typography>
                                        ) : (
                                        <Stack direction="row" gap={0.75} flexWrap="wrap">
                                            <FaultIndicator label={t("gammaHigh")} state={lane.faults.gammaHigh} faultText={t("fault")} clearText={t("clear")} unknownText={t("unknown")}/>
                                            <FaultIndicator label={t("gammaLow")} state={lane.faults.gammaLow} faultText={t("fault")} clearText={t("clear")} unknownText={t("unknown")}/>
                                            <FaultIndicator label={t("neutronHigh")} state={lane.faults.neutronHigh} faultText={t("fault")} clearText={t("clear")} unknownText={t("unknown")}/>
                                            <FaultIndicator label={t("tamper")} state={lane.faults.tamper} faultText={t("fault")} clearText={t("clear")} unknownText={t("unknown")}/>
                                            <FaultIndicator label={t("extendedOccupancy")} state={lane.extendedOccupancy} faultText={t("fault")} clearText={t("clear")} unknownText={t("unknown")}/>
                                        </Stack>
                                        )}
                                    </TableCell>
                                    <TableCell sx={{verticalAlign: "top", minWidth: 150}}>
                                        {lane.occupancyState === "unknown" ? (
                                            <Typography variant="body2" color="text.secondary">{t("waitingForTelemetry")}</Typography>
                                        ) : lane.occupancyState === "clear" ? (
                                            <Stack spacing={0.25}>
                                                <Typography variant="body2" color="text.secondary">{t("notOccupied")}</Typography>
                                                <Typography variant="caption" color="text.disabled">
                                                    {`${t("threshold")}: ${lane.extendedOccupancyThresholdMinutes ?? DEFAULT_OCCUPANCY_THRESHOLD_MINUTES} ${t("minutes")}`}
                                                </Typography>
                                            </Stack>
                                        ) : lane.occupancyStartedAt == null ? (
                                            <Stack spacing={0.5}>
                                                <Typography variant="body2" color="text.secondary">{t("waitingForTelemetry")}</Typography>
                                                <Typography variant="caption" color="text.secondary">{t("occupancyInProgress")}</Typography>
                                            </Stack>
                                        ) : (
                                            <Stack spacing={0.5}>
                                                <Typography fontWeight={700} color={lane.extendedOccupancy === "active" ? "error.main" : "text.primary"}>
                                                    {formatHealthDuration(lane.occupancyDuration)}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">{t("occupancyInProgress")}</Typography>
                                                <Typography variant="caption" color="text.disabled">
                                                    {`${t("threshold")}: ${lane.extendedOccupancyThresholdMinutes ?? DEFAULT_OCCUPANCY_THRESHOLD_MINUTES} ${t("minutes")}`}
                                                </Typography>
                                            </Stack>
                                        )}
                                    </TableCell>
                                    <TableCell sx={{verticalAlign: "top", whiteSpace: "nowrap"}}>
                                        <Typography variant="body2" color="text.secondary">
                                            {lane.lastUpdatedAt ? new Date(lane.lastUpdatedAt).toLocaleTimeString(getIntlLocale(language)) : t("waitingForTelemetry")}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
            {isAdmin && (
                <LaneWebRelayDialog
                    open={webRelayDialogOpen}
                    initialLaneNameOrUid={webRelayDialogLane}
                    onClose={() => setWebRelayDialogOpen(false)}
                    onUpdated={applyWebRelayEntries}
                />
            )}
        </Stack>
    );
}
