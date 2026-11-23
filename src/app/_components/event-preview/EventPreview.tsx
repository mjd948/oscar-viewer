/*
 * Copyright (c) 2024.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

'use client'

import {
    Alert,
    Box,
    Button,
    Grid,
    IconButton,
    Snackbar,
    SnackbarCloseReason,
    TextField,
    Typography
} from "@mui/material";
import OpenInFullRoundedIcon from "@mui/icons-material/OpenInFullRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import React, {useCallback, useContext, useEffect, useRef, useState} from "react";
import {DataSourceContext} from "@/app/contexts/DataSourceContext";
import {useSelector} from "react-redux";
import {
    selectEventPreview,
    setEventPreview,
    setSelectedRowId,
    setShouldForceAlarmTableDeselect
} from "@/lib/state/EventPreviewSlice";
import {selectCurrentUser} from "@/lib/state/OSCARClientSlice";
import {useAppDispatch} from "@/lib/state/Hooks";
import {useRouter} from "next/navigation";
import ConSysApi from "osh-js/source/core/datasource/consysapi/ConSysApi.datasource";
import AdjudicationData, {
    IAdjudicationData,
} from "@/lib/data/oscar/adjudication/Adjudication";
import {AdjudicationCode, AdjudicationCodes} from "@/lib/data/oscar/adjudication/models/AdjudicationConstants";
import {randomUUID} from "osh-js/source/core/utils/Utils";
import {setSelectedEvent, setAdjudicatedEventId} from "@/lib/state/EventDataSlice";
import AdjudicationSelect from "@/app/_components/adjudication/AdjudicationSelect";
import { setEventData } from "@/lib/state/EventDetailsSlice";
import EventMedia from "@/app/_components/event-preview/EventMedia";
import SecondaryInspectionSelect from "@/app/_components/adjudication/SecondaryInspectionSelect";
import {generateAdjudicationCommandJSON, sendCommand} from "@/lib/data/oscar/OSCARCommands";
import ObservationFilter from "osh-js/source/core/consysapi/observation/ObservationFilter";
import ControlStream from "osh-js/source/core/consysapi/controlstream/ControlStream";
import {isAdjudicationControlStream} from "@/lib/data/oscar/Utilities";
import { EventTableData } from "@/lib/data/oscar/TableHelpers";
import { useBreakpoint } from "@/app/providers";
import BackButton from "../BackButton";
import SuspenseLoad from "@/app/_components/SuspenseLoad";
import {useLanguage} from '@/app/contexts/LanguageContext';
import AlarmQrExportButton from "@/app/_components/alarm-transfer/AlarmQrExportButton";
import ShareOccupancyButton from "@/app/_components/event-details/ShareOccupancyButton";
import {buildEventDetailsHref, EventLookupError, resolveEventObservationId} from "@/lib/data/oscar/EventLookup";
import {
    isCurrentEventLogFiltered,
    markSessionCachedEventAdjudicated,
} from "@/lib/data/oscar/SavedEventQueries";
import VehicleIdOcr from "@/app/_components/adjudication/VehicleIdOcr";
import {
    IVehicleOcrResult,
    selectAutoFillCandidate,
} from "@/lib/data/oscar/adjudication/VehicleOcr";

export function getEventPreviewIdentityKey(
    eventData: Pick<EventTableData, "laneId" | "occupancyCount" | "startTime" | "endTime"> | null | undefined,
): string {
    if (!eventData) return "";
    const startMs = Date.parse(eventData.startTime ?? "");
    const endMs = Date.parse(eventData.endTime ?? "");
    const normStart = Number.isFinite(startMs) ? String(startMs) : (eventData.startTime ?? "");
    const normEnd = Number.isFinite(endMs) ? String(endMs) : (eventData.endTime ?? "");
    return `${eventData.laneId ?? ""}|${eventData.occupancyCount ?? ""}|${normStart}|${normEnd}`;
}

export function EventPreview() {
    const { isDesktop } = useBreakpoint();
    const {t} = useLanguage();

    const dispatch = useAppDispatch();
    const router = useRouter();
    const eventPreview = useSelector(selectEventPreview);

    const {activeViewKey, laneMapRef, laneMapReady, readyLaneNames, scopedHref} = useContext(DataSourceContext);
    const laneReady = Boolean(
        eventPreview.eventData?.laneId && readyLaneNames.has(eventPreview.eventData.laneId));
    const laneEntry = eventPreview.eventData?.laneId
        ? laneMapRef.current.get(eventPreview.eventData.laneId)
        : undefined;

    const [datasourcesReady, setDatasourcesReady] = useState<boolean>(false);
    const [loadedPreviewKey, setLoadedPreviewKey] = useState<string>("");

    // Chart Specifics
    const [gammaDatasources, setGammaDatasources] = useState<typeof ConSysApi[]>([]);
    const [neutronDatasources, setNeutronDatasources] = useState<typeof ConSysApi[]>([]);
    const [thresholdDatasources, setThresholdDatasources] = useState<typeof ConSysApi[]>([]);

    // Adjudication Specifics
    const [adjFormData, setAdjFormData] = useState<IAdjudicationData | null>();
    const [notes, setNotes] = useState<string>("");
    const [vehicleId, setVehicleId] = useState<string>("");
    const [vehicleIdTouched, setVehicleIdTouched] = useState<boolean>(false);
    const [vehicleIdAutoFilled, setVehicleIdAutoFilled] = useState<boolean>(false);
    const [ocrResults, setOcrResults] = useState<IVehicleOcrResult[]>([]);
    const [adjudicationCode, setAdjudicationCode] = useState<AdjudicationCode>(AdjudicationCodes.codes[0]);
    const [adjudication, setAdjudication] = useState<AdjudicationData | null>();
    const [secondaryInspection, setSecondaryInspection] = useState<"NONE" | "COMPLETED"| "REQUESTED" | "">("");

    const previewEventIdentityKey = getEventPreviewIdentityKey(eventPreview.eventData);
    const [syncedPreviewIdentityKey, setSyncedPreviewIdentityKey] = useState<string>(previewEventIdentityKey);
    if (syncedPreviewIdentityKey !== previewEventIdentityKey) {
        setSyncedPreviewIdentityKey(previewEventIdentityKey);
        setVehicleId("");
        setVehicleIdTouched(false);
        setVehicleIdAutoFilled(false);
        setOcrResults([]);
    }

    useEffect(() => {
        if (vehicleIdTouched || vehicleId.trim().length > 0) return;
        const confirmedEventVeh = eventPreview.eventData?.vehicleId && !eventPreview.eventData.vehicleIdFromOcr
            ? eventPreview.eventData.vehicleId.trim()
            : "";
        if (confirmedEventVeh) {
            setVehicleId(confirmedEventVeh);
            setVehicleIdAutoFilled(false);
            setAdjFormData(previous => previous ? {...previous, vehicleId: confirmedEventVeh} : previous);
            setAdjudication(previous => {
                if (!previous) return previous;
                const updated = Object.assign(
                    Object.create(Object.getPrototypeOf(previous)),
                    previous,
                ) as AdjudicationData;
                updated.setVehicleId(confirmedEventVeh);
                return updated;
            });
            return;
        }
        const candidate = selectAutoFillCandidate(ocrResults);
        if (!candidate) return;
        setVehicleId(candidate.value);
        setVehicleIdAutoFilled(true);
        setAdjFormData(previous => previous ? {...previous, vehicleId: candidate.value} : previous);
        setAdjudication(previous => {
            if (!previous) return previous;
            const updated = Object.assign(
                Object.create(Object.getPrototypeOf(previous)),
                previous,
            ) as AdjudicationData;
            updated.setVehicleId(candidate.value);
            return updated;
        });
    }, [eventPreview.eventData?.vehicleId, eventPreview.eventData?.vehicleIdFromOcr, ocrResults, vehicleId, vehicleIdTouched]);

    //snackbar
    const [adjSnackMsg, setAdjSnackMsg] = useState('');
    const [openSnack, setOpenSnack] = useState(false);
    const [colorStatus, setColorStatus] = useState('')


    const handleAdjudicationCode = (value: AdjudicationCode) => {
        let newAdjData: IAdjudicationData = {
            occupancyCount: eventPreview.eventData.occupancyCount,
            time: new Date().toISOString(),
            id: randomUUID(),
            username: "",
            feedback: notes,
            adjudicationCode: value,
            isotopes: [],
            secondaryInspectionStatus: secondaryInspection,
            filePaths: [],
            occupancyObsId: eventPreview.eventData.occupancyObsId,
            vehicleId,
        }

        let adjudicationData = new AdjudicationData(
            new Date().toISOString(),
            eventPreview.eventData.occupancyCount,
            eventPreview.eventData.occupancyObsId,
        );

        adjudicationData.setFeedback(notes);
        adjudicationData.setAdjudicationCode(value);
        adjudicationData.setVehicleId(vehicleId);

        setAdjudicationCode(value);
        setAdjFormData(newAdjData);
        setAdjudication(adjudicationData);
    }

    const handleNotes = (event: React.ChangeEvent<HTMLInputElement>) => {
        let notesValues = event.target.value;
        setNotes(notesValues);
    }

    const handleVehicleId = (event: React.ChangeEvent<HTMLInputElement>) => {
        const nextValue = event.target.value;
        setVehicleId(nextValue);
        setVehicleIdTouched(true);
        setVehicleIdAutoFilled(false);
        setAdjFormData(previous => previous ? {...previous, vehicleId: nextValue} : previous);
    }

    const handleOcrSelect = (selected: string) => {
        setVehicleId(selected);
        setVehicleIdTouched(true);
        setVehicleIdAutoFilled(false);
        setAdjFormData(previous => previous ? {...previous, vehicleId: selected} : previous);
        setAdjudication(previous => {
            if (!previous) return previous;
            const updated = Object.assign(
                Object.create(Object.getPrototypeOf(previous)),
                previous,
            ) as AdjudicationData;
            updated.setVehicleId(selected);
            return updated;
        });
    };

    const sendAdjudicationData = async () => {
        if (!adjudication) {
            setAdjSnackMsg(t('fillAdjudicationFields'));
            setColorStatus('error')
            setOpenSnack(true);
            return;
        }

        const phenomenonTime = new Date().toISOString();
        const comboData = adjudication;

        comboData.setFeedback(notes);
        comboData.setTime(phenomenonTime);
        comboData.setSecondaryInspectionStatus(secondaryInspection);
        comboData.setVehicleId(vehicleId);

        // send to server
        if (!laneEntry) {
            setAdjSnackMsg(t('eventLaneUnavailable', {lane: eventPreview.eventData.laneId}));
            setColorStatus('error');
            setOpenSnack(true);
            return;
        }
        await submitAdjudication(laneEntry, comboData)
    }


    const submitAdjudication = async(currLaneEntry: any, comboData: any) => {
        try{
            let ds = currLaneEntry.datastreams.find((ds: any) => ds.properties.id == eventPreview.eventData.dataStreamId);
            let streams = currLaneEntry.controlStreams;
            if (streams.length === 0) {
                const laneSystemIds = new Set(currLaneEntry.systems.map(
                    (system: any) => system.properties.id));
                const nodeControlStreams = await currLaneEntry.parentNode.fetchNodeControlStreams() ?? [];
                streams = nodeControlStreams.filter((stream: typeof ControlStream) =>
                    laneSystemIds.has(stream.properties["system@id"]));
            }
            let adjControlStream = streams.find((stream: typeof ControlStream) => isAdjudicationControlStream(stream));

            if (!adjControlStream){
                console.error("Failed: cannot find adjudication control stream for occupancy.");
                setAdjSnackMsg(t('adjudicationControlStreamMissing'));
                setColorStatus('error');
                setOpenSnack(true);
                return;
            }

            // If no occupancy obs ID (from live data) resolve it via canonical epoch-ms lookup before adjudicating
            if (comboData.occupancyObsId == null) {
                let resolvedObsId: string | null = null;
                try {
                    resolvedObsId = await resolveEventObservationId(eventPreview.eventData, currLaneEntry);
                } catch (lookupErr) {
                    if (!(lookupErr instanceof EventLookupError && lookupErr.code === "not-found") && ds?.searchObservations) {
                        const query = await ds.searchObservations(new ObservationFilter({
                            filter: `startTime='${eventPreview.eventData.startTime}' AND endTime='${eventPreview.eventData.endTime}'`
                        }), 1);
                        const occupancyObservation: any[] = (await query.nextPage()) ?? [];
                        resolvedObsId = occupancyObservation[0]?.id ?? null;
                    }
                }

                if (!resolvedObsId) {
                    setAdjSnackMsg(t('failedToAdjudicateRefresh'));
                    setColorStatus('error')
                    setOpenSnack(true);
                    return;
                }

                eventPreview.eventData.occupancyObsId = resolvedObsId;
                if (ds?.properties?.["system@id"]) {
                    eventPreview.eventData.rpmSystemId = ds.properties["system@id"];
                }
                comboData.occupancyObsId = resolvedObsId;
            }

            const response = await sendCommand(
                currLaneEntry.parentNode,
                adjControlStream.properties.id,
                generateAdjudicationCommandJSON(
                    comboData.feedback,
                    comboData.adjudicationCode,
                    comboData.isotopes,
                    comboData.secondaryInspectionStatus,
                    comboData.filePaths,
                    comboData.occupancyObsId,
                    comboData.vehicleId
                )
            );

            if (!response.ok) {
                setAdjSnackMsg(t('adjudicationSubmitFailed'))
                setColorStatus('error')
                return;
            }


            let updatedEvent = eventPreview.eventData;
            if (Object.isFrozen(eventPreview.eventData) || !Object.isExtensible(eventPreview.eventData)) {
                updatedEvent = Object.assign(
                    Object.create(Object.getPrototypeOf(eventPreview.eventData)),
                    eventPreview.eventData,
                    {adjudicatedData: comboData},
                );
            } else {
                eventPreview.eventData.adjudicatedData = comboData;
            }
            markSessionCachedEventAdjudicated(
                comboData.occupancyObsId,
                comboData.adjudicationCode?.code,
            );


            // Dispatch actions
            dispatch(setSelectedEvent(updatedEvent));
            dispatch(setAdjudicatedEventId(updatedEvent.id));
            // dispatch(triggerEventTableRefresh());

            setAdjSnackMsg(t('adjudicationSuccessful', {occupancyId: eventPreview.eventData.occupancyCount}));
            setColorStatus('success')

        } catch(error) {
            console.error( error)
            setAdjSnackMsg(t('adjudicationSubmitFailed'))
            setColorStatus('error')
        } finally {
            setOpenSnack(true);
        }
    }

    const resetAdjudicationData = () => {
        setAdjFormData(null);
        setAdjudication(null);
        setNotes("");
        setVehicleId("");
        setVehicleIdTouched(true);
        setVehicleIdAutoFilled(false);
        setAdjudicationCode(AdjudicationCodes.codes[0]);
    }

    const handleCloseRounded = () => {
        dispatch(setEventPreview({
            isOpen: false,
            eventData: null
        }));
        dispatch(setShouldForceAlarmTableDeselect(true))
        dispatch(setSelectedRowId(null))
        resetAdjudicationData();
    }

    const handleInspectionSelect = (value: "NONE" | "REQUESTED" | "COMPLETED") => {
        setSecondaryInspection(value);
    }

    const handleExpand = () => {
        dispatch(setEventData(eventPreview.eventData));
        dispatch(setSelectedRowId(eventPreview.eventData.id))
        dispatch(setSelectedEvent(eventPreview.eventData));

        const onEventLog = typeof window !== "undefined"
            && window.location.pathname.replace(/\/+$/, "").endsWith("/event-log");
        const fromFiltered = onEventLog && isCurrentEventLogFiltered(activeViewKey);
        const href = eventPreview.eventData.occupancyObsId
            ? buildEventDetailsHref(eventPreview.eventData.occupancyObsId, laneEntry?.parentNode.id, fromFiltered)
            : (fromFiltered ? "/event-details?fromFiltered=1" : "/event-details");
        router.push(scopedHref(href));
    }

    const currentEventRef = useRef<EventTableData | null>(eventPreview.eventData);
    currentEventRef.current = eventPreview.eventData;

    useEffect(() => {
        setDatasourcesReady(false);
        setLoadedPreviewKey("");
        setGammaDatasources([]);
        setNeutronDatasources([]);
        setThresholdDatasources([]);

        const activeEvent = currentEventRef.current;
        if (!previewEventIdentityKey || !activeEvent?.laneId || !laneReady || !laneEntry) {
            return;
        }

        let cancelled = false;
        dispatch(setEventData(activeEvent));

        (async () => {
            try {
                const datasources = await laneEntry.getDatastreamsForEventDetail(
                    activeEvent.startTime,
                    activeEvent.endTime,
                );
                if (cancelled) return;

                setGammaDatasources(datasources.get("gamma") || []);
                setNeutronDatasources(datasources.get("neutron") || []);
                setThresholdDatasources(datasources.get("gammaTrshld") || []);
                setLoadedPreviewKey(previewEventIdentityKey);
                setDatasourcesReady(true);
            } catch (error) {
                if (cancelled) return;
                console.error("Failed to load event preview data sources:", error);
                setAdjSnackMsg(t('eventDataLoadFailed'));
                setColorStatus('error');
                setOpenSnack(true);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [previewEventIdentityKey, laneEntry, laneReady, dispatch, t]);

    useEffect(() => {
        if (!datasourcesReady)
            return;

        const sources = [
            ...gammaDatasources,
            ...neutronDatasources,
            ...thresholdDatasources,
        ];
        sources.forEach((source) => {
            void Promise.resolve().then(() => source.connect()).catch((error) => {
                console.error("Unable to connect event preview datasource", error);
            });
        });

        return () => {
            sources.forEach((source) => {
                void Promise.resolve().then(() => source.disconnect()).catch((error) => {
                    console.error("Unable to disconnect event preview datasource", error);
                });
            });
        };
    }, [datasourcesReady, gammaDatasources, neutronDatasources, thresholdDatasources]);

    const handleCloseSnack = (event: React.SyntheticEvent | Event, reason?: SnackbarCloseReason) => {
        if (reason === 'clickaway') {
            return;
        }
        setOpenSnack(false);
        handleCloseRounded();
    };

    if (!eventPreview.eventData) {
        return <Alert severity="warning">{t('eventDetailsUnavailable')}</Alert>;
    }

    if (!laneReady && !laneMapReady) {
        return <SuspenseLoad />;
    }

    if (!laneEntry) {
        return <Alert severity="error">{t('eventLaneUnavailable', {lane: eventPreview.eventData.laneId})}</Alert>;
    }

    return (
        <Grid container spacing={isDesktop ? 0 : 2} gap={isDesktop ? 2 : 0} width={"100%"}>

            {/* HEADER */}
            <Grid item container xs={12} spacing={2} paddingLeft={1} justifyContent={"space-between"} width={"100%"}>
                <Grid item container spacing={2} xs alignItems={"center"}>
                    {!isDesktop && (
                        <Grid item>
                            <BackButton/>
                        </Grid>
                    )}
                    <Grid item>
                        <Typography
                            variant="h6"
                        >
                            {t('occupancyIdValue', {occupancyId: eventPreview.eventData.occupancyCount})}
                        </Typography>
                    </Grid>
                    <Grid item>
                        <IconButton
                            onClick={handleExpand}
                            aria-label={t('expand')}
                        >
                            <OpenInFullRoundedIcon
                                fontSize="small"
                            />
                        </IconButton>
                    </Grid>
                    <Grid item>
                        <ShareOccupancyButton
                            key={`${eventPreview.eventData.id}:share`}
                            event={eventPreview.eventData}
                            lane={laneEntry}
                        />
                    </Grid>
                    <Grid item>
                        <AlarmQrExportButton event={eventPreview.eventData} lane={laneEntry} iconOnly/>
                    </Grid>
                </Grid>
                {isDesktop && (
                  <Grid item>
                        <IconButton
                            onClick={handleCloseRounded}
                            aria-label={t('close')}
                        >
                            <CloseRoundedIcon fontSize="small"/>
                        </IconButton>
                    </Grid>  
                )}
            </Grid>

            {/* MEDIA */}
            <Grid item xs={12}>
                { datasourcesReady && loadedPreviewKey === previewEventIdentityKey ? (
                        <Box>
                            <EventMedia
                                key={previewEventIdentityKey}
                                selectedNode={laneEntry.parentNode}
                                datasources={{
                                    gamma: gammaDatasources[0],
                                    neutron: neutronDatasources[0],
                                    threshold: thresholdDatasources[0]
                                }}
                                mode={"preview"}
                                eventData={eventPreview.eventData}
                                laneMap={laneMapRef.current}
                            />
                        </Box>

                    ) :
                    <SuspenseLoad />
                }
            </Grid>

            {/* VEHICLE ID */}
            <Grid item xs={12}>
                <TextField
                    label={t('vehicleId')}
                    name="vehicleId"
                    value={vehicleId}
                    onChange={handleVehicleId}
                    helperText={vehicleIdAutoFilled ? t('ocrAutoFilledHelper') : undefined}
                    inputProps={{
                        autoCorrect: 'off',
                        autoCapitalize: 'none',
                        spellCheck: false,
                    }}
                    fullWidth
                />
                <VehicleIdOcr
                    event={eventPreview.eventData}
                    selectedValue={vehicleId}
                    onResults={setOcrResults}
                    onSelectValue={handleOcrSelect}
                />
            </Grid>

            {/* ADJUDICATION SELECT */}
            <Grid item xs={12}>
                <AdjudicationSelect
                    nodes={laneEntry ? [laneEntry.parentNode] : []}
                    adjCode={adjudicationCode}
                    onSelect={handleAdjudicationCode}
                />
            </Grid>

            {/* SECONDARY INSPECT SELECT */}
            <Grid item xs={12}>
                <SecondaryInspectionSelect
                    secondarySelectVal={secondaryInspection}
                    onSelect={handleInspectionSelect}
                />
            </Grid>

            {/* NOTES */}
            <Grid item xs={12}>
                <TextField
                    onChange={handleNotes}
                    id="outlined-multiline-static"
                    label={t('notes')}
                    multiline
                    rows={4}
                    fullWidth
                />
            </Grid>

            {/* BUTTONS */}
            <Grid item container xs={12} spacing={2}>
                <Grid item xs={6}>
                    <Button
                        onClick={sendAdjudicationData}
                        variant={"contained"}
                        fullWidth
                        color={"success"}
                        disabled={adjFormData === null}
                    >
                        {t('submit')}
                    </Button>
                </Grid>
                <Grid item xs={6}>
                    <Button
                        onClick={resetAdjudicationData}
                        variant={"contained"}
                        fullWidth
                        color={"secondary"}
                    >
                        {t('reset')}
                    </Button>
                </Grid>
            </Grid>            

            <Snackbar
                anchorOrigin={{ vertical:'top', horizontal:'center' }}
                open={openSnack}
                autoHideDuration={1500}
                onClose={handleCloseSnack}
                message={adjSnackMsg}
                sx={{
                    '& .MuiSnackbarContent-root': {
                        backgroundColor: colorStatus === 'success' ? 'green' : 'red',
                    },
                }}
            />

        </Grid>
    )
}
