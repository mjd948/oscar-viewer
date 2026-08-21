"use client";

import React, {useCallback, useContext, useEffect, useRef, useState} from "react";
import {useSelector} from "react-redux";
import {selectLaneMap} from "@/lib/state/OSCARLaneSlice";
import {EventTableData} from "@/lib/data/oscar/TableHelpers";
import {DataSourceContext} from "@/app/contexts/DataSourceContext";
import {DataGrid, GridColDef} from "@mui/x-data-grid";
import { Box, Dialog, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import {LaneMapEntry} from "@/lib/data/oscar/LaneCollection";
import DataStream from "osh-js/source/core/consysapi/datastream/DataStream";
import ObservationFilter from "osh-js/source/core/consysapi/observation/ObservationFilter";
import {IWebIdIsotope} from "@/lib/data/oscar/adjudication/WebId";
import WebIdAnalysisResult from "@/lib/data/oscar/adjudication/WebId";
import {WEB_ID_DEF} from "@/lib/data/Constants";
import {EventType} from "osh-js/source/core/event/EventType";

// WebID publishes its analysis after the occupancy closes, so bracket the event
// instead of scanning the datastream: webIdAnalysis grows without bound, and an
// unfiltered scan gets steadily slower and eventually pages past older results.
const WEB_ID_WINDOW_LEAD_MS = 60_000;
const WEB_ID_WINDOW_TRAIL_MS = 15 * 60_000;

/** Keeps the first row per (occupancy, time): a live push can restate a fetched one. */
function dedupeWebIdResults(results: WebIdAnalysisResult[]): WebIdAnalysisResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
        const key = `${result.occupancyObsId}|${result.time}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export default function WebIdAnalysis(props: { event: EventTableData; onWebIdResults?: (results: WebIdAnalysisResult[]) => void; }) {
    const laneMapRef = useContext(DataSourceContext).laneMapRef;

    const [webIdLog, setWebIdLog] = useState<WebIdAnalysisResult[]>([]);
    const [liveResults, setLiveResults] = useState<WebIdAnalysisResult[]>([]);
    // Rows that arrived over the realtime stream carry no occupancy observation
    // id (EventTable builds live rows with null), and WebID results are keyed by
    // it — so resolve it here instead of showing nothing until a page refresh.
    const [resolvedObsId, setResolvedObsId] = useState<string | null>(null);
    const [expandDialog, setExpandDialog] = useState({ open: false, title: "", text: "" });

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

    const locale = navigator.language || 'en-US';

    const MAX_CELL_LENGTH = 50;

    const renderStringCell = (headerName: string) => (params: any) => {
        const fullText = params.value != null ? String(params.value) : "";
        const truncated = fullText.length > MAX_CELL_LENGTH
            ? fullText.substring(0, MAX_CELL_LENGTH) + "..."
            : fullText;
        return (
            <div style={{ whiteSpace: "normal", wordWrap: "break-word" }}>
                {truncated}
                {fullText.length > MAX_CELL_LENGTH && (
                    <button
                        style={{ color: "#1976d2", border: "none", background: "none", cursor: "pointer", paddingLeft: 4 }}
                        onClick={() => setExpandDialog({ open: true, title: headerName, text: fullText })}
                    >
                        Read more
                    </button>
                )}
            </div>
        );
    };

    const logColumns: GridColDef<WebIdAnalysisResult>[] = [
        {
            field: 'time',
            headerName: 'Timestamp',
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
            field: 'name',
            headerName: 'Name',
            minWidth: 100,
            flex: 1,
            valueGetter: (value, row) => row.isotopes?.map((i: IWebIdIsotope) => i.name).join(', '),
            renderCell: renderStringCell('Name'),
        },
        {
            field: 'type',
            headerName: 'Type',
            minWidth: 80,
            flex: 0.8,
            valueGetter: (value, row) => row.isotopes?.map((i: IWebIdIsotope) => i.type).join(', '),
            renderCell: renderStringCell('Type'),
        },
        {
            field: 'confidence',
            headerName: 'Confidence',
            minWidth: 90,
            flex: 0.8,
            valueGetter: (value, row) => row.isotopes?.map((i: IWebIdIsotope) => i.confidence).join(', '),
            renderCell: renderStringCell('Confidence'),
        },
        {
            field: 'confidenceStr',
            headerName: 'Confidence String',
            minWidth: 120,
            flex: 1,
            valueGetter: (value, row) => row.isotopes?.map((i: IWebIdIsotope) => i.confidenceStr).join(', '),
            renderCell: renderStringCell('Confidence String'),
        },
        {
            field: 'countRate',
            headerName: 'Count Rate',
            minWidth: 90,
            flex: 0.8,
            valueGetter: (value, row) => row.isotopes?.map((i: IWebIdIsotope) => i.countRate).join(', '),
            renderCell: renderStringCell('Count Rate'),
        },
        {
            field: 'isotopeString',
            headerName: 'Isotope String',
            minWidth: 100,
            flex: 1,
            type: 'string',
            renderCell: renderStringCell('Isotope String'),
        },
        {
            field: 'numIsotopes',
            headerName: '# Isotopes',
            minWidth: 80,
            flex: 0.6,
            type: 'number',
        },
        {
            field: 'numAnalysisWarning',
            headerName: '# Warnings',
            minWidth: 80,
            flex: 0.6,
            type: 'string',
            renderCell: renderStringCell('# Warnings'),
        },
        {
            field: 'analysisWarning',
            headerName: 'Analysis Warning',
            minWidth: 120,
            flex: 1,
            type: 'string',
            renderCell: renderStringCell('Analysis Warning'),
        },
        {
            field: 'chiSquare',
            headerName: 'Chi Square',
            minWidth: 90,
            flex: 0.7,
            type: 'number',
        },
        {
            field: 'detectorResponseFunction',
            headerName: 'DRF',
            minWidth: 80,
            flex: 0.6,
            type: 'string',
            renderCell: renderStringCell('DRF'),
        },
        {
            field: 'errorMessage',
            headerName: 'Error Message',
            minWidth: 100,
            flex: 1,
            type: 'string',
            renderCell: renderStringCell('Error Message'),
        },
        {
            field: 'estimatedDose',
            headerName: 'Est. Dose',
            minWidth: 80,
            flex: 0.6,
            type: 'number',
        }
    ];

    // A live row's occupancy observation id is null until something looks it up,
    // so resolve it from the lane's occupancy datastream by time bracket.
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
                console.error("Could not resolve occupancy observation id for WebID:", err);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [props.event, laneMap]);

    const fetchData = useCallback(async (cancel: { done: boolean }) => {
        const currLaneEntry = getLaneEntry();
        if (!currLaneEntry || !occupancyObsId) return;

        const webIdDatastream: typeof DataStream = currLaneEntry.findDataStreamByObsProperty(WEB_ID_DEF);
        if (!webIdDatastream) {
            console.warn("No WebID Analysis datastream found for this lane");
            return;
        }

        const from = new Date(new Date(props.event.startTime).getTime() - WEB_ID_WINDOW_LEAD_MS);
        const to = new Date(new Date(props.event.endTime).getTime() + WEB_ID_WINDOW_TRAIL_MS);
        if (isNaN(from.getTime()) || isNaN(to.getTime())) return;

        const query = await webIdDatastream.searchObservations(new ObservationFilter({
            resultTime: `${from.toISOString()}/${to.toISOString()}`
        }), 100);

        // Accumulate across pages: observations come back oldest-first, so
        // setting state per page kept only the last page and dropped older
        // occupancies once the datastream outgrew a single page.
        const collected: WebIdAnalysisResult[] = [];
        while (query.hasNext()) {
            const obsCollection = await query.nextPage();
            if (cancel.done) return;
            collected.push(...obsCollection.map((obs: any) => new WebIdAnalysisResult(obs.resultTime, obs.result)));
        }
        if (cancel.done) return;

        setWebIdLog(collected.filter(result => result?.occupancyObsId === occupancyObsId));
    }, [props.event, occupancyObsId, laneMap]);

    useEffect(() => {
        // results are per-occupancy; drop the previous event's before refetching
        setWebIdLog([]);
        setLiveResults([]);
        if (!props.event || !occupancyObsId) return;

        const cancel = {done: false};
        fetchData(cancel).catch(err => console.error("Error fetching webIdAnalysis observations:", err));

        return () => {
            cancel.done = true;
        };
    }, [props.event, occupancyObsId]);

    // realtime: an alarm's analysis typically lands after the form opens, so
    // subscribe while this occupancy is on screen
    useEffect(() => {
        const currLaneEntry = getLaneEntry();
        if (!currLaneEntry) return;

        const webIdStream = currLaneEntry.findDataStreamByObsProperty(WEB_ID_DEF);
        if (!webIdStream) {
            console.warn("No WebID Analysis datastream found for this lane");
            return;
        }

        const webIdSource = currLaneEntry.datasourcesRealtime?.find((ds: any) => {
            const parts = ds.properties.resource?.split("/");
            return parts && parts[2] === webIdStream.properties.id;
        });
        if (!webIdSource) {
            console.warn("No WebID Analysis data source found for this lane");
            return;
        }
        if (subscribedSourceRef.current === webIdSource) return;
        subscribedSourceRef.current = webIdSource;

        const handleObservations = (msg: any) => {
            const data = msg.values?.[0]?.data;
            if (!data) return;

            const webId = new WebIdAnalysisResult(data.timestamp, data);
            if (webId.occupancyObsId !== occupancyObsIdRef.current) return;

            setLiveResults(prev => {
                const exists = prev.some(item => item.occupancyObsId === webId.occupancyObsId && item.time === webId.time);
                if (exists) return prev;
                return [webId, ...prev];
            });
        };

        webIdSource.subscribe(handleObservations, [EventType.DATA]);

        try {
            webIdSource.connect();
        } catch (err) {
            console.error("Error connecting webid source:", err);
        }
    }, [props.event, occupancyObsId, laneMap]);

    // Derived rather than state: a previously-viewed occupancy's rows must
    // never render under the current one.
    const results = dedupeWebIdResults(
        [...liveResults, ...webIdLog].filter(result => result?.occupancyObsId === occupancyObsId));

    useEffect(() => {
        if (!props.onWebIdResults) return;
        props.onWebIdResults(results);
    }, [webIdLog, liveResults]);

    return (
        <Stack spacing={2} sx={{ width: '100%' }}>
            <Stack direction={"column"} spacing={1}>
                <Typography variant="h5">
                    WebID Analysis Results
                </Typography>
            </Stack>
            <Box sx={{ width: '100%' }}>
                <DataGrid
                    rows={results}
                    columns={logColumns}
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
                open={expandDialog.open}
                onClose={() => setExpandDialog({ open: false, title: "", text: "" })}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>{expandDialog.title}</DialogTitle>
                <DialogContent>
                    <Typography whiteSpace="pre-wrap">{expandDialog.text}</Typography>
                </DialogContent>
            </Dialog>
        </Stack>
    );
}
