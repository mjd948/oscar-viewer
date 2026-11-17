"use client";

import {Alert, Button, Grid, Paper, Stack, Typography} from "@mui/material";
import {
    MarkEmailReadOutlined,
    MarkEmailUnreadOutlined,
    RestartAltOutlined,
    TuneOutlined,
    VisibilityOffOutlined,
    VisibilityOutlined,
} from "@mui/icons-material";
import LaneStatus from "../_components/dashboard/LaneStatus";

import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useSelector} from "react-redux";
import {EventType} from "osh-js/source/core/event/EventType";
import {RootState} from "@/lib/state/Store";
import {selectLaneMap} from "@/lib/state/OSCARLaneSlice";
import {
    requestDashboardAcknowledgeAll,
    selectDashboardUnreadAlarmCount,
    selectDashboardUnreadCountCapped,
    selectDashboardUnreadOnly,
    setAlarmTrigger,
    toggleDashboardUnreadOnly,
} from "@/lib/state/EventDataSlice";
import {
    selectContinuousAlarmAudio,
    selectVisualUnreadAlert,
} from "@/lib/state/OSCARClientSlice";
import {useAppDispatch} from "@/lib/state/Hooks";
import EventTable from "@/app/_components/event-table/EventTable";
import {
    acquireSharedConnection,
    findRealtimeDataSourceForStream,
    LaneDSColl,
    LaneMapEntry,
    type SharedConnectionLease,
} from "@/lib/data/oscar/LaneCollection";
import {removeRealtimeEventSubscription} from "@/lib/data/oscar/RealtimeEventNotification";
import {
    isGammaDataStream,
    isMobileGpsDataStream,
    isNeutronDataStream,
    isOccupancyDataStream,
} from "@/lib/data/oscar/Utilities";
import {
    type DashboardWidgetId,
    type DashboardWidgetVisibility,
    DEFAULT_DASHBOARD_WIDGET_VISIBILITY,
    getStoredDashboardWidgetVisibility,
    setStoredDashboardWidgetVisibility,
} from "@/app/utils/ChartUtils";
import {useLanguage} from "@/app/contexts/LanguageContext";
import {getIntlLocale} from "@/app/utils/LocaleUtils";
import dynamic from "next/dynamic";
import { useBreakpoint } from "../providers";
import SuspenseLoad from "@/app/_components/SuspenseLoad";

export default function DashboardPage() {
    const { isDesktop } = useBreakpoint();
    const { language, t } = useLanguage();
    const locale = getIntlLocale(language);
    const dispatch = useAppDispatch();

    const laneMap = useSelector((state: RootState) => selectLaneMap(state));
    const unreadAlarmCount = useSelector((state: RootState) => selectDashboardUnreadAlarmCount(state));
    const unreadCountCapped = useSelector((state: RootState) => selectDashboardUnreadCountCapped(state));
    const unreadOnly = useSelector((state: RootState) => selectDashboardUnreadOnly(state));
    const visualUnreadAlert = useSelector((state: RootState) => selectVisualUnreadAlert(state));
    const continuousAlarmAudio = useSelector((state: RootState) => selectContinuousAlarmAudio(state));
    const [dataSourcesByLane, setDataSourcesByLane] = useState<Map<string, LaneDSColl>>(new Map<string, LaneDSColl>());
    const laneCollectionsRef = useRef<Map<string, {lane: LaneMapEntry, collection: LaneDSColl}>>(new Map());
    const [widgetVisibility, setWidgetVisibility] = useState<DashboardWidgetVisibility>(
        () => getStoredDashboardWidgetVisibility(),
    );

    const updateWidgetVisibility = useCallback((next: DashboardWidgetVisibility) => {
        setWidgetVisibility(next);
        setStoredDashboardWidgetVisibility(next);
    }, []);

    const toggleWidget = useCallback((widgetId: DashboardWidgetId) => {
        setWidgetVisibility((prev) => {
            const next = {
                ...prev,
                [widgetId]: !prev[widgetId],
            };
            setStoredDashboardWidgetVisibility(next);
            return next;
        });
    }, []);

    const resetWidgets = useCallback(() => {
        updateWidgetVisibility({...DEFAULT_DASHBOARD_WIDGET_VISIBILITY});
    }, [updateWidgetVisibility]);

    const showUnreadBanner = (visualUnreadAlert || continuousAlarmAudio) && unreadAlarmCount > 0;
    const formattedUnreadCount = unreadCountCapped
        ? `${unreadAlarmCount.toLocaleString(locale)}+`
        : unreadAlarmCount.toLocaleString(locale);

    const handleBannerAcknowledgeAll = useCallback(() => {
        if (!widgetVisibility.eventTable) {
            updateWidgetVisibility({...widgetVisibility, eventTable: true});
        }
        dispatch(requestDashboardAcknowledgeAll());
    }, [dispatch, updateWidgetVisibility, widgetVisibility]);

    const handleBannerToggleUnreadOnly = useCallback(() => {
        if (!unreadOnly && !widgetVisibility.eventTable) {
            updateWidgetVisibility({...widgetVisibility, eventTable: true});
        }
        dispatch(toggleDashboardUnreadOnly());
    }, [dispatch, unreadOnly, updateWidgetVisibility, widgetVisibility]);

    const datasourceSetup = useCallback(() => {
        const laneDSMap = new Map<string, LaneDSColl>();
        const nextLaneCollections = new Map<string, {lane: LaneMapEntry, collection: LaneDSColl}>();

        for (const [laneid, lane] of laneMap.entries()) {
            const cached = laneCollectionsRef.current.get(laneid);
            const laneDSColl = cached?.lane === lane ? cached.collection : new LaneDSColl();

            laneDSMap.set(laneid, laneDSColl);
            nextLaneCollections.set(laneid, {lane, collection: laneDSColl});

            if (!cached || cached.lane !== lane) {
                // RS-350/D5 mobile lanes publish no gamma/neutron alarm-state stream; their alarms
                // arrive only as occupancies, so those are what has to sound the dashboard alarm.
                const isMobileLane = lane.datastreams.some((ds) => isMobileGpsDataStream(ds));
                lane.datastreams.forEach((ds) => {
                    const rtDS = findRealtimeDataSourceForStream(lane, ds);

                    if (!rtDS) {
                        console.warn(`Missing RT data for datastream ${ds.properties.id} in lane ${laneid}`);
                        return;
                    }

                    rtDS.properties.startTime = new Date().toISOString();
                    rtDS.properties.endTime = "2055-01-01T08:13:25.845Z";

                    if(isGammaDataStream(ds))
                        laneDSColl.addDS('gammaRT', rtDS);

                    if(isNeutronDataStream(ds))
                        laneDSColl.addDS('neutronRT', rtDS);

                    if (isMobileLane && isOccupancyDataStream(ds))
                        laneDSColl.addDS('occRT', rtDS);
                });
            }
        }
        laneCollectionsRef.current = nextLaneCollections;
        setDataSourcesByLane(laneDSMap);

    }, [laneMap]);

    useEffect(() => {
        datasourceSetup();
    }, [datasourceSetup]);

    // Keep realtime alarm audio notifications active at the Dashboard level even
    // when the operator hides the Lane Status widget.
    useEffect(() => {
        let active = true;
        const subscriptions: Array<{
            source: any;
            handler: (message: any) => void;
            lease: SharedConnectionLease;
        }> = [];
        const uniqueSources = new Set<any>();

        dataSourcesByLane.forEach((collection) => {
            const occupancySources = new Set(collection.occRT);
            [...collection.gammaRT, ...collection.neutronRT, ...collection.occRT].forEach((source) => {
                if (!source || uniqueSources.has(source))
                    return;
                uniqueSources.add(source);
                const isOccupancy = occupancySources.has(source);
                const handler = (message: any) => {
                    if (!active) return;
                    const data = message?.values?.[0]?.data;
                    const alarming = isOccupancy
                        // an occupancy already auto-adjudicated (e.g. EML non-threat) must stay silent
                        ? Boolean(data?.gammaAlarm || data?.neutronAlarm) && !(data?.adjudicatedIds?.length > 0)
                        : data?.alarmState === "Alarm";
                    if (alarming)
                        dispatch(setAlarmTrigger(true));
                };
                source.subscribe(handler, [EventType.DATA]);
                const lease = acquireSharedConnection(source);
                subscriptions.push({source, handler, lease});
                void lease.ready.catch((error) => {
                    if (active)
                        console.warn("Unable to connect dashboard alarm notification stream", error);
                });
            });
        });

        return () => {
            active = false;
            subscriptions.forEach(({source, handler, lease}) => {
                removeRealtimeEventSubscription(source, handler);
                void lease.release().catch((error) => {
                    console.warn("Unable to disconnect dashboard alarm notification stream", error);
                });
            });
        };
    }, [dataSourcesByLane, dispatch]);

    const QuickView = useMemo(() => dynamic(
        () => import('@/app/_components/dashboard/QuickView'),
        {
            loading: () => <SuspenseLoad />,
            ssr: false
        }
    ), []);

    const showLeftColumn = widgetVisibility.laneStatus || widgetVisibility.eventTable;
    const showRightColumn = isDesktop && widgetVisibility.quickView;
    const hasHiddenWidget = !widgetVisibility.laneStatus
        || !widgetVisibility.eventTable
        || (isDesktop && !widgetVisibility.quickView);

    const widgetOptions: Array<{id: DashboardWidgetId; label: string; visibleOnViewport: boolean}> = [
        {id: 'laneStatus', label: t('showLaneStatusWidget'), visibleOnViewport: true},
        {id: 'eventTable', label: t('showEventsWidget'), visibleOnViewport: true},
        {id: 'quickView', label: t('showMapPreviewWidget'), visibleOnViewport: isDesktop},
    ];

    return (
        <Grid container spacing={2} sx={{ minInlineSize: 0, height: "auto" }}>
            {showUnreadBanner && (
                <Grid item xs={12} sx={{ minInlineSize: 0 }}>
                    <Alert
                        severity="warning"
                        data-testid="dashboard-unread-alert-banner"
                        sx={{ alignItems: "center", py: 0.5 }}
                        action={
                            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                                <Button
                                    type="button"
                                    color="inherit"
                                    size="small"
                                    variant="outlined"
                                    aria-pressed={unreadOnly}
                                    startIcon={<MarkEmailUnreadOutlined fontSize="small" aria-hidden="true" />}
                                    onClick={handleBannerToggleUnreadOnly}
                                    data-testid="dashboard-banner-unread-only"
                                    sx={{
                                        textTransform: "none",
                                        whiteSpace: "nowrap",
                                        minInlineSize: "24px",
                                        minBlockSize: "24px",
                                        "@media (pointer: coarse)": { minBlockSize: "44px", minInlineSize: "44px" },
                                        "&[aria-pressed='true']": {
                                            bgcolor: "warning.dark",
                                            color: "warning.contrastText",
                                            borderColor: "warning.dark",
                                            boxShadow: "inset 0 0 0 1px currentColor",
                                            fontWeight: 700,
                                            "@media (forced-colors: active)": {
                                                bgcolor: "Highlight",
                                                color: "HighlightText",
                                                borderColor: "Highlight",
                                            },
                                        },
                                    }}
                                >
                                    {t("unreadOnly")}
                                </Button>
                                <Button
                                    type="button"
                                    color="inherit"
                                    size="small"
                                    variant="outlined"
                                    startIcon={<MarkEmailReadOutlined fontSize="small" aria-hidden="true" />}
                                    onClick={handleBannerAcknowledgeAll}
                                    data-testid="dashboard-banner-acknowledge-all"
                                    sx={{
                                        textTransform: "none",
                                        whiteSpace: "nowrap",
                                        minInlineSize: "24px",
                                        minBlockSize: "24px",
                                        "@media (pointer: coarse)": { minBlockSize: "44px", minInlineSize: "44px" },
                                    }}
                                >
                                    {t("acknowledgeAll")}
                                </Button>
                            </Stack>
                        }
                    >
                        {t("unreadAlarmsBanner", { count: formattedUnreadCount })}
                    </Alert>
                </Grid>
            )}
            <Grid item xs={12} sx={{ minInlineSize: 0 }}>
                <Paper
                    variant="outlined"
                    sx={{ px: 1.5, py: 0.75 }}
                    data-testid="dashboard-widget-customization-bar"
                >
                    <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        alignItems={{ xs: "flex-start", sm: "center" }}
                        justifyContent="space-between"
                        useFlexGap
                        flexWrap="wrap"
                    >
                        <Stack direction="row" spacing={1} alignItems="center">
                            <TuneOutlined fontSize="small" color="action" />
                            <Typography variant="body2" fontWeight={600} color="text.secondary">
                                {t("customizeDashboard")}
                            </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                            {widgetOptions
                                .filter((option) => option.visibleOnViewport)
                                .map((option) => {
                                    const active = widgetVisibility[option.id];
                                    return (
                                        <Button
                                            key={option.id}
                                            size="small"
                                            variant={active ? "contained" : "outlined"}
                                            color={active ? "primary" : "inherit"}
                                            aria-pressed={active}
                                            startIcon={
                                                active
                                                    ? <VisibilityOutlined fontSize="small" />
                                                    : <VisibilityOffOutlined fontSize="small" />
                                            }
                                            onClick={() => toggleWidget(option.id)}
                                            data-testid={`dashboard-widget-toggle-${option.id}`}
                                            sx={{ textTransform: "none" }}
                                        >
                                            {option.label}
                                        </Button>
                                    );
                                })}
                            {hasHiddenWidget && (
                                <Button
                                    size="small"
                                    variant="text"
                                    startIcon={<RestartAltOutlined fontSize="small" />}
                                    onClick={resetWidgets}
                                    data-testid="dashboard-widget-reset"
                                    sx={{ textTransform: "none" }}
                                >
                                    {t("resetDashboardWidgets")}
                                </Button>
                            )}
                        </Stack>
                    </Stack>
                </Paper>
            </Grid>

            {showLeftColumn && (
                <Grid
                    item
                    container
                    xs={12}
                    lg={showRightColumn ? 8 : 12}
                    data-testid="dashboard-left-column"
                    sx={{ gap: 2, minInlineSize: 0, height: "100%" }}
                >
                    {widgetVisibility.laneStatus && (
                        <Grid item xs={12} sx={{ minInlineSize: 0 }} data-testid="dashboard-widget-laneStatus">
                            <Paper variant="outlined" sx={{ height: "auto", minHeight: 275 }}>
                                <LaneStatus
                                    dataSourcesByLane={dataSourcesByLane}
                                    subscribeAlarmStream={false}
                                    expanded={!widgetVisibility.eventTable}
                                    onHide={() => toggleWidget("laneStatus")}
                                />
                            </Paper>
                        </Grid>
                    )}
                    {widgetVisibility.eventTable && (
                        <Grid item xs={12} sx={{ minInlineSize: 0 }} data-testid="dashboard-widget-eventTable">
                            <Paper variant="outlined" sx={{ padding: 0 }}>
                                <EventTable tableMode={"alarmtable"} laneMap={laneMap} />
                            </Paper>
                        </Grid>
                    )}
                </Grid>
            )}

            {showRightColumn && (
                <Grid
                    item
                    xs={12}
                    lg={showLeftColumn ? 4 : 12}
                    data-testid="dashboard-widget-quickView"
                    sx={{ minInlineSize: 0 }}
                >
                    <Paper variant="outlined" sx={{ padding: 1, height: "100%" }}>
                        <QuickView />
                    </Paper>
                </Grid>
            )}

            {!showLeftColumn && !showRightColumn && (
                <Grid item xs={12} data-testid="dashboard-widgets-empty">
                    <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
                        <Stack spacing={1.5} alignItems="center">
                            <Typography variant="body1" color="text.secondary">
                                {t("allDashboardWidgetsHidden")}
                            </Typography>
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<RestartAltOutlined fontSize="small" />}
                                onClick={resetWidgets}
                                data-testid="dashboard-empty-reset"
                            >
                                {t("resetDashboardWidgets")}
                            </Button>
                        </Stack>
                    </Paper>
                </Grid>
            )}
        </Grid>
    );
}
