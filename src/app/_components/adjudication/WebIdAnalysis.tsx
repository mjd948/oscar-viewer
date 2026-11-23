"use client";

import React, {useCallback, useContext, useEffect, useState} from "react";
import {EventTableData} from "@/lib/data/oscar/TableHelpers";
import {DataSourceContext} from "@/app/contexts/DataSourceContext";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { Alert, Box, Dialog, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import {
    acquireSharedConnection,
    findRealtimeDataSourceForStream,
    LaneMapEntry,
} from "@/lib/data/oscar/LaneCollection";
import DataStream from "osh-js/source/core/consysapi/datastream/DataStream";
import ObservationFilter from "osh-js/source/core/consysapi/observation/ObservationFilter";
import {IWebIdIsotope} from "@/lib/data/oscar/adjudication/WebId";
import WebIdAnalysisResult from "@/lib/data/oscar/adjudication/WebId";
import {WEB_ID_DEF} from "@/lib/data/Constants";
import {EventType} from "osh-js/source/core/event/EventType";
import {useLanguage} from '@/app/contexts/LanguageContext';
import {getDataGridLocaleText, getIntlLocale} from '@/app/utils/LocaleUtils';
import {removeRealtimeEventSubscription} from "@/lib/data/oscar/RealtimeEventNotification";


export default function WebIdAnalysis(props: {
    event: EventTableData;
    occupancyObsIdOverride?: string;
    refreshNonce?: number;
    onWebIdResults?: (results: WebIdAnalysisResult[]) => void;
}) {
    const {language, t} = useLanguage();
    const laneMapRef = useContext(DataSourceContext).laneMapRef;

    const [webIdLog, setWebIdLog] = useState<any[]>([]);
    const [filteredLog, setFilteredLog] = useState<any[]>([]);
    const [webIdHistoryCapped, setWebIdHistoryCapped] = useState(false);
    const [expandDialog, setExpandDialog] = useState({ open: false, title: "", text: "" });

    const locale = getIntlLocale(language);

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
                        {t('readMore')}
                    </button>
                )}
            </div>
        );
    };

    const logColumns: GridColDef<WebIdAnalysisResult>[] = [
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
            field: 'name',
            headerName: t('name'),
            minWidth: 100,
            flex: 1,
            valueGetter: (value, row) => row.isotopes?.map((i: IWebIdIsotope) => i.name).join(', '),
            renderCell: renderStringCell(t('name')),
        },
        {
            field: 'type',
            headerName: t('type'),
            minWidth: 80,
            flex: 0.8,
            valueGetter: (value, row) => row.isotopes?.map((i: IWebIdIsotope) => i.type).join(', '),
            renderCell: renderStringCell(t('type')),
        },
        {
            field: 'confidence',
            headerName: t('confidence'),
            minWidth: 105,
            flex: 0.8,
            valueGetter: (value, row) => row.isotopes?.map((i: IWebIdIsotope) => i.confidence).join(', '),
            renderCell: renderStringCell(t('confidence')),
        },
        {
            field: 'confidenceStr',
            headerName: t('confidenceString'),
            minWidth: 155,
            flex: 1,
            valueGetter: (value, row) => row.isotopes?.map((i: IWebIdIsotope) => i.confidenceStr).join(', '),
            renderCell: renderStringCell(t('confidenceString')),
        },
        {
            field: 'countRate',
            headerName: t('countRate'),
            minWidth: 130,
            flex: 0.8,
            valueGetter: (value, row) => row.isotopes?.map((i: IWebIdIsotope) => i.countRate).join(', '),
            renderCell: renderStringCell(t('countRate')),
        },
        {
            field: 'isotopeString',
            headerName: t('isotopeString'),
            minWidth: 145,
            flex: 1,
            type: 'string',
            renderCell: renderStringCell(t('isotopeString')),
        },
        {
            field: 'numIsotopes',
            headerName: t('isotopeCount'),
            minWidth: 115,
            flex: 0.7,
            type: 'number',
        },
        {
            field: 'numAnalysisWarnings',
            headerName: t('warningCount'),
            minWidth: 120,
            flex: 0.7,
            type: 'number',
            valueGetter: (value, row) => row.numAnalysisWarnings ?? (Array.isArray(row.analysisWarnings) ? row.analysisWarnings.length : 0),
        },
        {
            field: 'analysisWarnings',
            headerName: t('analysisWarning'),
            minWidth: 155,
            flex: 1,
            type: 'string',
            valueGetter: (value, row) => Array.isArray(row.analysisWarnings) ? row.analysisWarnings.join('; ') : String(row.analysisWarnings ?? ''),
            renderCell: renderStringCell(t('analysisWarning')),
        },
        {
            field: 'chiSquare',
            headerName: t('chiSquare'),
            minWidth: 120,
            flex: 0.7,
            type: 'number',
        },
        {
            field: 'detectorResponseFunction',
            headerName: t('drf'),
            minWidth: 95,
            flex: 0.6,
            type: 'string',
            renderCell: renderStringCell(t('drf')),
        },
        {
            field: 'errorMessage',
            headerName: t('errorMessage'),
            minWidth: 140,
            flex: 1,
            type: 'string',
            renderCell: renderStringCell(t('errorMessage')),
        },
        {
            field: 'estimatedDose',
            headerName: t('estimatedDose'),
            minWidth: 115,
            flex: 0.7,
            type: 'number',
        }
    ];

    const targetOccupancyObsId = props.occupancyObsIdOverride || props.event?.occupancyObsId;
    const currentLane = props.event?.laneId;

    const fetchData = useCallback(async() => {
        if (!currentLane) {
            setWebIdLog([]);
            return;
        }
        const currLaneEntry: LaneMapEntry = laneMapRef.current.get(currentLane);
        if (!currLaneEntry) {
            console.warn("Cannot load WebID data: lane entry is unavailable:", currentLane);
            return;
        }

        let webIdDatastream: typeof DataStream = currLaneEntry.findDataStreamByObsProperty(WEB_ID_DEF);
        if(!webIdDatastream) {
            console.warn("No WebID Analysis datastream found for this lane");
            return;
        }

        const MAX_SCAN_PAGES = 25;
        const PAGE_BATCH_SIZE = 100;
        const readQueryPages = async (filter: typeof ObservationFilter | undefined, maxPages: number) => {
            const items: WebIdAnalysisResult[] = [];
            const query = await webIdDatastream.searchObservations(filter, PAGE_BATCH_SIZE);
            let pagesRead = 0;
            while (query.hasNext() && pagesRead < maxPages) {
                pagesRead += 1;
                const obsCollection = await query.nextPage();
                for (const obs of obsCollection) {
                    items.push(new WebIdAnalysisResult(obs.resultTime, obs.result));
                }
            }
            const capped = pagesRead >= maxPages && Boolean(query.hasNext());
            return { items, capped };
        };

        const startMs = Date.parse(props.event?.startTime ?? "");
        const endMs = Date.parse(props.event?.endTime ?? "");
        let accumulated: WebIdAnalysisResult[] = [];
        let capped = false;

        // Exact match first: ask the server for this occupancy's results only. The unfiltered scan
        // returns the stream oldest-first and stops after 25 pages, so on a busy node recent
        // events' analyses were never read; the occupancy filter also keeps a secondary-inspection
        // upload made hours after the event.
        if (targetOccupancyObsId) {
            try {
                const exact = await readQueryPages(new ObservationFilter({
                    filter: `occupancyObsId='${String(targetOccupancyObsId).replace(/'/g, "''")}'`,
                }), MAX_SCAN_PAGES);
                accumulated = exact.items;
                capped = exact.capped;
            } catch (error) {
                console.warn("Filtered WebID query failed; falling back to a time window", error);
            }
        }

        if (accumulated.length === 0 && Number.isFinite(startMs) && Number.isFinite(endMs)) {
            try {
                const windowStartIso = new Date(Math.max(0, Math.min(startMs, endMs) - 5 * 60_000)).toISOString();
                const windowEndIso = new Date(Math.max(startMs, endMs) + 30 * 60_000).toISOString();
                const scoped = await readQueryPages(
                    new ObservationFilter({ resultTime: `${windowStartIso}/${windowEndIso}` }),
                    MAX_SCAN_PAGES,
                );
                const hasTargetMatch = targetOccupancyObsId
                    ? scoped.items.some((item) => item?.occupancyObsId == targetOccupancyObsId)
                    : scoped.items.length > 0;
                if (hasTargetMatch) {
                    accumulated = scoped.items;
                    capped = scoped.capped;
                }
            } catch {
                // Fall back to lane-wide scan if the server rejects resultTime on this stream
            }
        }

        if (accumulated.length === 0) {
            const fallback = await readQueryPages(undefined, MAX_SCAN_PAGES);
            accumulated = fallback.items;
            capped = fallback.capped;
        }

        accumulated.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        setWebIdHistoryCapped(capped);
        setWebIdLog(accumulated);
    }, [currentLane, laneMapRef, props.event?.endTime, props.event?.startTime, targetOccupancyObsId]);

    useEffect(() => {
        if (props.event && targetOccupancyObsId) {
            void fetchData();
        } else {
            setFilteredLog([]);
        }
    }, [props.event, targetOccupancyObsId, props.refreshNonce, fetchData]);

    useEffect(() => {
        if (!currentLane || !targetOccupancyObsId) {
            return;
        }
        const currLaneEntry: LaneMapEntry = laneMapRef.current.get(currentLane);
        if (!currLaneEntry) {
            console.warn("Cannot subscribe to WebID data: lane entry is unavailable:", currentLane);
            return;
        }

        let webIdStream = currLaneEntry.findDataStreamByObsProperty(WEB_ID_DEF);
        if(!webIdStream) {
            console.warn("No WebID Analysis datastream found for this lane");
            return;
        }

        const webIdSource = findRealtimeDataSourceForStream(currLaneEntry, webIdStream);
        if (!webIdSource) {
            console.warn("No WebID Analysis data source found for this lane");
            return;
        }

        const handleObservations = (msg: any) => {
            const data = msg.values?.[0]?.data;
            if (!data) return;

            const webId = new WebIdAnalysisResult(data.timestamp ?? data.sampleTime, data);
            if (webId.occupancyObsId !== targetOccupancyObsId) return;

            setWebIdLog(prev => {
                const exists = prev.some(item => item.occupancyObsId === webId.occupancyObsId && item.time === webId.time);
                if (exists) return prev;
                return [webId, ...prev];
            });
        };

        webIdSource.subscribe(handleObservations, [EventType.DATA]);
        const lease = acquireSharedConnection(webIdSource);
        void lease.ready.catch((err) => {
            console.error("Error connecting webid source:", err);
        });

        return () => {
            removeRealtimeEventSubscription(webIdSource, handleObservations);
            void lease.release().catch((error) => {
                console.error("Error disconnecting webid source:", error);
            });
        };
    }, [currentLane, targetOccupancyObsId, laneMapRef]);


    useEffect(() => {
        if (!targetOccupancyObsId) {
            setFilteredLog([]);
            return;
        }
        const matched = webIdLog.filter((data) => data?.occupancyObsId == targetOccupancyObsId);
        setFilteredLog(matched);
    }, [webIdLog, targetOccupancyObsId]);

    useEffect(() => {
        if (!props.onWebIdResults) return;
        props.onWebIdResults(filteredLog);
    }, [filteredLog, props.onWebIdResults]);

    return (
        <Stack spacing={2} sx={{ width: '100%' }} data-testid="webid-analysis-section">
            <Stack direction={"column"} spacing={1}>
                <Typography variant="h5">
                    {t('webIdAnalysisResults')}
                </Typography>
                {webIdHistoryCapped && (
                    <Alert
                        severity="info"
                        role="status"
                        data-testid="webid-history-cap-notice"
                        sx={{ py: 0.25, "& .MuiAlert-message": { textWrap: "pretty" } }}
                    >
                        {t('webIdHistoryCapNotice', { max: (2500).toLocaleString(locale) })}
                    </Alert>
                )}
            </Stack>
            <Box sx={{ width: '100%' }}>
                <DataGrid
                    localeText={getDataGridLocaleText(language)}
                    rows={filteredLog}
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
