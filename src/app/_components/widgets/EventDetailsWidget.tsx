"use client";

/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import React, {useCallback, useContext, useEffect, useRef, useState} from "react";
import {useSelector} from "react-redux";
import Link from "next/link";
import {Alert, Box, Button, Grid, Paper, Stack, Typography} from "@mui/material";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import ConSysApi from "osh-js/source/core/datasource/consysapi/ConSysApi.datasource";
import DataRow from "@/app/_components/event-details/DataRow";
import MiscTable from "@/app/_components/event-details/MiscTable";
import EventMedia from "@/app/_components/event-preview/EventMedia";
import {getEventPreviewIdentityKey} from "@/app/_components/event-preview/EventPreview";
import DailyFileTable from "@/app/_components/event-preview/DailyFileTable";
import AdjudicationDetail from "@/app/_components/adjudication/AdjudicationDetail";
import ShareOccupancyButton from "@/app/_components/event-details/ShareOccupancyButton";
import AlarmQrExportButton from "@/app/_components/alarm-transfer/AlarmQrExportButton";
import SuspenseLoad from "@/app/_components/SuspenseLoad";
import {DataSourceContext} from "@/app/contexts/DataSourceContext";
import {useLanguage} from "@/app/contexts/LanguageContext";
import {WidgetProps} from "@/app/_components/layout/WidgetTypes";
import {useAppDispatch} from "@/lib/state/Hooks";
import {selectEventPreview, setEventPreview, setSelectedRowId} from "@/lib/state/EventPreviewSlice";
import {setSelectedEvent} from "@/lib/state/EventDataSlice";
import {setEventData} from "@/lib/state/EventDetailsSlice";
import {EventTableData} from "@/lib/data/oscar/TableHelpers";
import {buildEventDetailsHref, EventLookupError, resolveEventObservationId} from "@/lib/data/oscar/EventLookup";

type LiveIdentityState = "idle" | "resolving" | "failed";

// Same policy as ORNL's event details page.
const LIVE_IDENTITY_LOOKUP_ATTEMPTS = 5;
const LIVE_IDENTITY_RETRY_DELAY_MS = 1000;
const LIVE_IDENTITY_REQUEST_TIMEOUT_MS = 2500;

function waitForRetry(signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
            signal.removeEventListener("abort", onAbort);
            resolve();
        }, LIVE_IDENTITY_RETRY_DELAY_MS);
        const onAbort = () => {
            window.clearTimeout(timeoutId);
            reject(new DOMException("The event identity lookup was cancelled.", "AbortError"));
        };
        signal.addEventListener("abort", onAbort, {once: true});
    });
}

/**
 * ORNL's event details (summary, gamma/neutron charts and video, misc and daily-file tables,
 * adjudication, share and QR export) for the event selected in any alarm or event table on the
 * page. Built from ORNL's parts rather than the /event-details page, which rewrites the address
 * bar and so cannot be embedded; "Open full page" leads there (print/PDF lives on that page).
 */
export default function EventDetailsWidget(_props: WidgetProps) {
    const {t} = useLanguage();
    const dispatch = useAppDispatch();
    const eventPreview = useSelector(selectEventPreview);
    const {laneMapRef, laneMapReady, readyLaneNames, scopedHref} = useContext(DataSourceContext);
    const eventData: EventTableData | null = eventPreview.eventData ?? null;
    const laneReady = Boolean(eventData?.laneId && readyLaneNames.has(eventData.laneId));
    const laneEntry = eventData?.laneId ? laneMapRef?.current?.get(eventData.laneId) : undefined;

    const [liveIdentityState, setLiveIdentityState] = useState<LiveIdentityState>("idle");
    const [liveIdentityRetryKey, setLiveIdentityRetryKey] = useState(0);
    const [datasourcesReady, setDatasourcesReady] = useState(false);
    const [dataSourceError, setDataSourceError] = useState(false);
    const [loadedEvent, setLoadedEvent] = useState<EventTableData | null>(null);
    const [gamma, setGamma] = useState<typeof ConSysApi[]>([]);
    const [neutron, setNeutron] = useState<typeof ConSysApi[]>([]);
    const [threshold, setThreshold] = useState<typeof ConSysApi[]>([]);
    const laneMapSnapshot = useRef(laneMapRef?.current);
    laneMapSnapshot.current = laneMapRef?.current;

    const retryLiveIdentity = useCallback(() => {
        setLiveIdentityState("resolving");
        setLiveIdentityRetryKey((k) => k + 1);
    }, []);

    // Live rows arrive without their database id; resolve it as ORNL's page does, then publish the
    // identified event so the share/QR/adjudication parts (and other widgets) can use it.
    useEffect(() => {
        if (!eventData || eventData.occupancyObsId) {
            setLiveIdentityState("idle");
            return;
        }
        if (!laneEntry) return;
        const controller = new AbortController();
        setLiveIdentityState("resolving");
        const resolve = async () => {
            for (let attempt = 0; attempt < LIVE_IDENTITY_LOOKUP_ATTEMPTS; attempt += 1) {
                try {
                    const occupancyObsId = await resolveEventObservationId(
                        eventData, laneEntry, fetch, controller.signal, LIVE_IDENTITY_REQUEST_TIMEOUT_MS);
                    if (controller.signal.aborted) return;
                    const identified = Object.assign(
                        Object.create(Object.getPrototypeOf(eventData)), eventData, {occupancyObsId},
                    ) as EventTableData;
                    dispatch(setEventPreview({isOpen: eventPreview.isOpen, eventData: identified}));
                    dispatch(setSelectedRowId(identified.id));
                    dispatch(setSelectedEvent(identified));
                    dispatch(setEventData(identified));
                    setLiveIdentityState("idle");
                    return;
                } catch (error) {
                    if (controller.signal.aborted) return;
                    const canRetry = error instanceof EventLookupError
                        && (error.code === "not-found" || error.code === "unavailable")
                        && attempt + 1 < LIVE_IDENTITY_LOOKUP_ATTEMPTS;
                    if (!canRetry) {
                        console.error("Unable to resolve the live event observation ID", error);
                        setLiveIdentityState("failed");
                        return;
                    }
                    try {
                        await waitForRetry(controller.signal);
                    } catch {
                        return;
                    }
                }
            }
        };
        void resolve();
        return () => controller.abort();
        // eventPreview.isOpen is read, not tracked: toggling the quick view must not restart a lookup.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, eventData, laneEntry, liveIdentityRetryKey]);

    useEffect(() => {
        setDatasourcesReady(false);
        setDataSourceError(false);
        setGamma([]);
        setNeutron([]);
        setThreshold([]);
        if (!eventData || !laneEntry || !laneReady) return;
        let cancelled = false;
        const collect = async () => {
            try {
                const sources = await laneEntry.getDatastreamsForEventDetail(eventData.startTime, eventData.endTime);
                if (cancelled) return;
                setGamma(sources.get("gamma") || []);
                setNeutron(sources.get("neutron") || []);
                setThreshold(sources.get("gammaTrshld") || []);
                setLoadedEvent(eventData);
                setDatasourcesReady(true);
            } catch (error) {
                if (cancelled) return;
                console.error("Failed to load event detail data sources:", error);
                setDataSourceError(true);
            }
        };
        void collect();
        return () => { cancelled = true; };
    }, [eventData, laneEntry, laneReady]);

    useEffect(() => {
        if (!datasourcesReady) return;
        const sources = [...gamma, ...neutron, ...threshold];
        sources.forEach((source) => {
            void Promise.resolve().then(() => source.connect()).catch((error) =>
                console.error("Unable to connect event detail datasource", error));
        });
        return () => {
            sources.forEach((source) => {
                void Promise.resolve().then(() => source.disconnect()).catch((error) =>
                    console.error("Unable to disconnect event detail datasource", error));
            });
        };
    }, [datasourcesReady, gamma, neutron, threshold]);

    if (!eventData) {
        return (
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', p: 2, textAlign: 'center'}}>
                <Typography color="text.secondary" data-testid="event-details-widget-empty">{t('selectEventForDetails')}</Typography>
            </Box>
        );
    }

    const fullPageHref = eventData.occupancyObsId
        ? scopedHref(buildEventDetailsHref(eventData.occupancyObsId, laneEntry?.parentNode?.id))
        : null;

    return (
        <Box data-testid="event-details-widget" sx={{height: '100%', overflowY: 'auto', minInlineSize: 0, p: 1}}>
            {laneMapReady && !laneEntry ? (
                <Alert severity="error">{t('eventLaneUnavailable', {lane: eventData.laneId})}</Alert>
            ) : !laneEntry ? (
                <SuspenseLoad/>
            ) : (
                <Grid container spacing={1.5}>
                    <Grid item xs={12}>
                        <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
                            <ShareOccupancyButton key={`${eventData.id}:share`} event={eventData} lane={laneEntry}/>
                            <AlarmQrExportButton event={eventData} lane={laneEntry}/>
                            {fullPageHref && (
                                <Button component={Link} href={fullPageHref} size="small" variant="outlined"
                                        startIcon={<OpenInNewRoundedIcon/>} data-testid="event-details-widget-open-page">
                                    {t('openFullPage')}
                                </Button>
                            )}
                        </Stack>
                    </Grid>
                    <Grid item xs={12}>
                        <Paper variant="outlined">
                            <DataRow
                                eventData={eventData}
                                nodeId={laneEntry.parentNode.id}
                                identityResolutionState={eventData.occupancyObsId
                                    ? undefined
                                    : liveIdentityState === "failed" ? "failed" : "resolving"}
                                onRetryIdentity={retryLiveIdentity}
                            />
                        </Paper>
                    </Grid>
                    <Grid item xs={12}>
                        {dataSourceError ? (
                            <Alert severity="error">{t('eventDataLoadFailed')}</Alert>
                        ) : datasourcesReady && loadedEvent === eventData ? (
                            <EventMedia
                                key={getEventPreviewIdentityKey(eventData) || String(eventData.id)}
                                selectedNode={laneEntry.parentNode}
                                datasources={{gamma: gamma[0], neutron: neutron[0], threshold: threshold[0]}}
                                mode="details"
                                eventData={eventData}
                                laneMap={laneMapSnapshot.current}
                            />
                        ) : <SuspenseLoad/>}
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Paper variant="outlined" sx={{height: '100%'}}>
                            <MiscTable key={eventData.id} eventData={eventData} currentTime={eventData.startTime}/>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Paper variant="outlined" sx={{height: '100%'}}>
                            <DailyFileTable event={eventData}/>
                        </Paper>
                    </Grid>
                    <Grid item xs={12}>
                        <AdjudicationDetail key={eventData.occupancyObsId || eventData.id} event={eventData}/>
                    </Grid>
                </Grid>
            )}
        </Box>
    );
}
