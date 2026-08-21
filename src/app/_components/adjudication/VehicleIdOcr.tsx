"use client";

/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import React, {useCallback, useContext, useEffect, useRef, useState} from "react";
import {useSelector} from "react-redux";
import {selectLaneMap} from "@/lib/state/OSCARLaneSlice";
import {Avatar, Box, Chip, Stack, Tooltip, Typography} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DirectionsBoatIcon from "@mui/icons-material/DirectionsBoat";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import {EventTableData} from "@/lib/data/oscar/TableHelpers";
import {DataSourceContext} from "@/app/contexts/DataSourceContext";
import {LaneMapEntry} from "@/lib/data/oscar/LaneCollection";
import DataStream from "osh-js/source/core/consysapi/datastream/DataStream";
import ObservationFilter from "osh-js/source/core/consysapi/observation/ObservationFilter";
import {OCR_DEF} from "@/lib/data/Constants";
import {EventType} from "osh-js/source/core/event/EventType";
import VehicleOcrResult, {dedupeOcrResults, IVehicleOcrResult} from "@/lib/data/oscar/adjudication/VehicleOcr";
import {isValidIso6346} from "@/lib/data/oscar/adjudication/Iso6346";
import {useLanguage} from "@/app/contexts/LanguageContext";
import {nodeFileServerUrl} from "@/lib/config/RuntimeConfig";

// OCR publishes a few seconds after the occupancy closes, so bracket the event
// instead of scanning the datastream: vehicleOcr grows without bound, and an
// unfiltered scan gets steadily slower and eventually pages past older results.
const OCR_WINDOW_LEAD_MS = 60_000;
const OCR_WINDOW_TRAIL_MS = 15 * 60_000;

// A just-alarmed occupancy is usually opened before OCR has finished, so poll
// briefly rather than relying on the realtime subscription being wired in time.
const RETRY_DELAYS_MS = [1_500, 3_000, 5_000, 10_000, 20_000];
const RECENT_EVENT_MS = 5 * 60_000;

/**
 * Camera-OCR vehicle ID suggestions for one occupancy: chips the operator can
 * click to fill the vehicleId field. Renders nothing when the lane has no
 * vehicleOcr datastream (OCR not enabled at this site/lane) or no results
 * exist for this occupancy, so non-OCR sites see an unchanged form.
 * Follows the WebIdAnalysis fetch + realtime-subscribe pattern.
 */
export default function VehicleIdOcr(props: {
    event: EventTableData;
    appliedValue?: string;
    onApply: (value: string) => void;
    onOcrResults?: (results: IVehicleOcrResult[]) => void;
}) {
    const laneMapRef = useContext(DataSourceContext).laneMapRef;
    const {t} = useLanguage();

    const [ocrLog, setOcrLog] = useState<IVehicleOcrResult[]>([]);
    const [liveResults, setLiveResults] = useState<IVehicleOcrResult[]>([]);
    // Rows that arrived over the realtime stream carry no occupancy observation
    // id (EventTable builds live rows with null), and OCR results are keyed by
    // it — so resolve it here instead of showing nothing until a page refresh.
    const [resolvedObsId, setResolvedObsId] = useState<string | null>(null);

    const occupancyObsId = props.event?.occupancyObsId ?? resolvedObsId;

    // The realtime handler is registered at most once per datasource and never
    // removed: osh-js DataSource.subscribe only appends, and unsubscribing
    // poisons the shared MQTT topic. So it reads the occupancy from a ref
    // rather than closing over the event it was created with.
    const occupancyObsIdRef = useRef<string | null>(occupancyObsId);
    occupancyObsIdRef.current = occupancyObsId;
    const subscribedSourceRef = useRef<any>(null);

    // Re-runs everything below once the lane map lands. Against a remote node it
    // regularly arrives after this mounts, and laneMapRef is a ref: without this the
    // panel bails once and stays blank until the alarm is reopened.
    const laneMap = useSelector(selectLaneMap);

    const getLaneEntry = useCallback((): LaneMapEntry | null => {
        if (!props.event?.laneId || !laneMapRef.current) return null;
        return laneMapRef.current.get(props.event.laneId) ?? null;
    }, [props.event]);

    useEffect(() => {
        setResolvedObsId(null);
        if (!props.event || props.event.occupancyObsId) return;

        const laneEntry = getLaneEntry();
        const occupancyStream: typeof DataStream = laneEntry?.findDataStreamByName("occupancy");
        if (!occupancyStream) return;

        let cancelled = false;
        (async () => {
            try {
                const query = await occupancyStream.searchObservations(new ObservationFilter({
                    filter: `startTime='${props.event.startTime}' AND endTime='${props.event.endTime}'`
                }), 1);
                const observations = await query.nextPage();
                if (!cancelled && observations?.length > 0)
                    setResolvedObsId(observations[0].id);
            } catch (err) {
                console.error("Could not resolve occupancy observation id for OCR:", err);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [props.event, laneMap]);

    const fetchData = useCallback(async (cancel: { done: boolean }): Promise<boolean> => {
        const laneEntry = getLaneEntry();
        if (!laneEntry || !occupancyObsId) return false;

        const ocrDatastream: typeof DataStream = laneEntry.findDataStreamByObsProperty(OCR_DEF);
        if (!ocrDatastream) return false; // OCR not enabled on this lane

        const from = new Date(new Date(props.event.startTime).getTime() - OCR_WINDOW_LEAD_MS);
        const to = new Date(new Date(props.event.endTime).getTime() + OCR_WINDOW_TRAIL_MS);
        if (isNaN(from.getTime()) || isNaN(to.getTime())) return false;

        const query = await ocrDatastream.searchObservations(new ObservationFilter({
            resultTime: `${from.toISOString()}/${to.toISOString()}`
        }), 100);

        const collected: IVehicleOcrResult[] = [];
        while (query.hasNext()) {
            const obsCollection = await query.nextPage();
            if (cancel.done) return false;
            collected.push(...obsCollection.map((obs: any) => new VehicleOcrResult(obs.resultTime, obs.result)));
        }
        if (cancel.done) return false;

        const forThisOccupancy = collected.filter(result => result?.occupancyObsId === occupancyObsId);
        setOcrLog(forThisOccupancy);
        return forThisOccupancy.length > 0;
    }, [props.event, occupancyObsId, laneMap]);

    useEffect(() => {
        // results are per-occupancy; drop the previous event's before refetching
        setOcrLog([]);
        setLiveResults([]);
        if (!props.event || !occupancyObsId) return;

        const cancel = {done: false};
        let timer: ReturnType<typeof setTimeout> | undefined;

        const attempt = async (n: number) => {
            let found = false;
            try {
                found = await fetchData(cancel);
            } catch (err) {
                console.error("Error fetching vehicleOcr observations:", err);
            }
            if (found || cancel.done || n >= RETRY_DELAYS_MS.length) return;

            // OCR may still be running for a just-closed occupancy
            const age = Date.now() - new Date(props.event.endTime).getTime();
            if (!Number.isFinite(age) || age > RECENT_EVENT_MS) return;

            timer = setTimeout(() => attempt(n + 1), RETRY_DELAYS_MS[n]);
        };
        attempt(0);

        return () => {
            cancel.done = true;
            if (timer) clearTimeout(timer);
        };
    }, [props.event, occupancyObsId]);

    // realtime: an alarm's OCR result typically lands a few seconds after the
    // form opens, so subscribe while this occupancy is on screen
    useEffect(() => {
        const laneEntry = getLaneEntry();
        if (!laneEntry) return;

        const ocrStream = laneEntry.findDataStreamByObsProperty(OCR_DEF);
        if (!ocrStream) return;

        const ocrSource = laneEntry.datasourcesRealtime?.find((ds: any) => {
            const parts = ds.properties.resource?.split("/");
            return parts && parts[2] === ocrStream.properties.id;
        });
        if (!ocrSource || subscribedSourceRef.current === ocrSource) return;
        subscribedSourceRef.current = ocrSource;

        const handleObservations = (msg: any) => {
            const data = msg.values?.[0]?.data;
            if (!data) return;

            const result = new VehicleOcrResult(data.timestamp, data);
            if (result.occupancyObsId !== occupancyObsIdRef.current) return;

            setLiveResults(prev => [result, ...prev]);
        };

        ocrSource.subscribe(handleObservations, [EventType.DATA]);
        try {
            ocrSource.connect();
        } catch (err) {
            console.error("Error connecting vehicleOcr source:", err);
        }
    }, [props.event, occupancyObsId, laneMap]);

    const results = dedupeOcrResults(
        [...liveResults, ...ocrLog].filter(result => result?.occupancyObsId === occupancyObsId));

    useEffect(() => {
        if (props.onOcrResults)
            props.onOcrResults(results);
    }, [ocrLog, liveResults]);

    if (results.length === 0) return null;

    const laneEntry = getLaneEntry();
    const node = laneEntry?.parentNode;
    const bucketUrl = (path: string) => node && path
        ? nodeFileServerUrl(node, path)
        : undefined;

    return (
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="body2" color="text.secondary">{t('ocrSuggestions')}:</Typography>
            {results.map(result => {
                const validated = result.checksumValid || isValidIso6346(result.normalizedValue);
                const crop = bucketUrl(result.evidenceImagePath);
                const applied = props.appliedValue === result.normalizedValue;
                return (
                    <Tooltip
                        key={`${result.idType}-${result.normalizedValue}`}
                        title={
                            <Box sx={{p: 0.5}}>
                                {crop && <img src={crop} alt={result.normalizedValue} style={{maxWidth: 280, display: 'block', marginBottom: 4}}/>}
                                <Typography variant="caption" display="block">
                                    {result.idType === 'container' ? t('ocrContainerNumber') : t('ocrLicensePlate')}
                                    {validated ? ` — ${t('ocrChecksumValid')}` : ''}
                                </Typography>
                                <Typography variant="caption" display="block">
                                    {Math.round(result.confidence * 100)}% · {result.readCount}x · {result.cameraUid}
                                </Typography>
                                <Typography variant="caption" display="block">{t('ocrApplySuggestion')}</Typography>
                            </Box>
                        }
                    >
                        <Chip
                            avatar={crop
                                ? <Avatar variant="rounded" src={crop}/>
                                : <Avatar>{result.idType === 'container' ? <DirectionsBoatIcon fontSize="small"/> : <DirectionsCarIcon fontSize="small"/>}</Avatar>}
                            label={
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                    <span>{`${result.normalizedValue} · ${Math.round(result.confidence * 100)}%`}</span>
                                    {validated && <CheckCircleIcon color="success" sx={{fontSize: 16}}/>}
                                </Stack>
                            }
                            variant={applied ? "filled" : "outlined"}
                            color={applied ? "primary" : "default"}
                            onClick={() => props.onApply(result.normalizedValue)}
                            data-testid="ocr-suggestion-chip"
                        />
                    </Tooltip>
                );
            })}
        </Stack>
    );
}
