"use client"

import {AlarmTableData, EventTableData} from "@/lib/data/oscar/TableHelpers";
import {
    acquireSharedConnection,
    findRealtimeDataSourceForStream,
    LaneMapEntry,
    type SharedConnectionLease,
} from "@/lib/data/oscar/LaneCollection";
import {Box, Button, Stack, Typography} from "@mui/material";
import {DataGrid, GridCellParams, gridClasses, GridColDef} from "@mui/x-data-grid";
import CustomToolbar from "@/app/_components/CustomToolbar";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useSelector} from "react-redux";
import {selectCurrentLane} from "@/lib/state/LaneViewSlice";
import {randomUUID} from "osh-js/source/core/utils/Utils";
import ObservationFilter from "osh-js/source/core/consysapi/observation/ObservationFilter";
import {
    isGammaDataStream,
    isNeutronDataStream,
    isOccupancyStatusDataStream,
    isTamperDataStream
} from "@/lib/data/oscar/Utilities";
import {selectNodes} from "@/lib/state/OSHSlice";
import { INode } from "@/lib/data/osh/Node";
import Observations from "osh-js/source/core/consysapi/observation/Observations";
import ConSysApi from "osh-js/source/core/datasource/consysapi/ConSysApi.datasource";
import DataStream from "osh-js/source/core/sweapi/datastream/DataStream";
import {ALARM_DEF, OCCUPANCY_STATUS_DEF, TAMPER_STATUS_DEF} from "@/lib/data/Constants";
import {EventType} from "osh-js/source/core/event/EventType";
import {convertToMap} from "@/app/utils/Utils";
import {useLanguage} from '@/app/contexts/LanguageContext';
import {getDataGridLocaleText, getIntlLocale} from '@/app/utils/LocaleUtils';
import {removeRealtimeEventSubscription} from "@/lib/data/oscar/RealtimeEventNotification";

type FaultTimeWindowPreset = "24h" | "7d" | "15d";

const FAULT_HISTORY_WINDOW_MS: Record<FaultTimeWindowPreset, number> = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "15d": 15 * 24 * 60 * 60 * 1000,
};
const STATUS_FAULT_FILTER = "tamperStatus=true OR alarmState='Fault - Neutron High' OR alarmState='Fault - Gamma High' OR alarmState='Fault - Gamma Low' OR alarmState='Fault - Extended Occupancy'";

export function statusTableEventFromObservation(
    obs: any,
    currentLane: string,
    isLive: boolean,
): AlarmTableData | undefined {
    if (!obs) return undefined;

    let newEvent: AlarmTableData | undefined;

    if (isLive) {
        if (obs?.alarmState) {
            const state = obs.alarmState;
            if (!["Scan", "Background", "Alarm", "Clear"].includes(state)) {
                newEvent = new AlarmTableData(randomUUID(), currentLane, state, obs.samplingTime ?? new Date().toISOString());
            }
        } else if (obs?.tamperStatus) {
            newEvent = new AlarmTableData(randomUUID(), currentLane, "Tamper", obs.samplingTime ?? obs.samplingtime ?? new Date().toISOString());
        }
    } else {
        const result = obs?.properties?.result;
        if (result?.alarmState && !["Scan", "Background", "Alarm", "Clear"].includes(result.alarmState)) {
            newEvent = new AlarmTableData(randomUUID(), currentLane, result.alarmState, obs.properties.resultTime);
        } else if (result?.tamperStatus) {
            newEvent = new AlarmTableData(randomUUID(), currentLane, "Tamper", obs.properties.resultTime);
        }
    }

    return newEvent;
}

interface StatusTableProps {
    currentLane: string,
    entry: LaneMapEntry
}

export default function StatusTable({currentLane, entry}: StatusTableProps){
    const {language, t} = useLanguage();
    const locale = getIntlLocale(language);

    const nodes = useSelector(selectNodes);

    const [loading, setLoading] = useState(false);
    const pageSize = 15
    const [paginationModel, setPaginationModel]= useState({page: 0, pageSize: pageSize});
    const [rowCount, setRowCount] = useState(0);
    const [data, setData] = useState<AlarmTableData[]>([]);

    const [currentPage, setCurrentPage] = useState(0);
    const [faultWindowPreset, setFaultWindowPreset] = useState<FaultTimeWindowPreset>("24h");
    const faultWindowOptions = useMemo<Array<{value: FaultTimeWindowPreset; label: string}>>(
        () => [
            {value: "24h", label: t("timeWindow24h")},
            {value: "7d", label: t("timeWindow7d")},
            {value: "15d", label: t("timeWindow15d")},
        ],
        [t],
    );
    const getRollingStatusTimeRange = useCallback(() => {
        const end = new Date();
        const start = new Date(end.getTime() - FAULT_HISTORY_WINDOW_MS[faultWindowPreset]);
        return `${start.toISOString()}/${end.toISOString()}`;
    }, [faultWindowPreset]);


    const columns: GridColDef<AlarmTableData>[] = [
        {
            field: 'laneId',
            headerName: t('laneId'),
            type: 'string',
            minWidth: 100,
            flex: 1,
        },
        {
            field: 'timestamp',
            headerName: t('timestamp'),
            valueFormatter: (params) => (new Date(params)).toLocaleString(locale, {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric'
            }),
            minWidth: 200,
            flex: 2,
        },
        {
            field: 'status',
            headerName: t('status'),
            valueFormatter: (value) => {
                const status = String(value ?? '');
                return t(`status.${status.toLowerCase().replace(/[ -]/g, '')}`);
            },
            type: 'string',
            minWidth: 150,
            flex: 1,
        },
    ];

    async function fetchTotalCount(node: INode, datastreamIds: string[]) {
        let endpoint = node.getConnectedSystemsEndpoint(false);
        const queryParams = new URLSearchParams({
            resultTime: getRollingStatusTimeRange(),
            format: "application/om+json",
            dataStream: `${datastreamIds.join(",")}`,
            filter: STATUS_FAULT_FILTER
        });
        let fullUrl = endpoint + "/observations/count?" + queryParams;

        try {
            const response = await fetch(fullUrl, {
                method: 'GET',
                headers: {
                    ...node.getBasicAuthHeader(),
                    'Content-Type': 'sml+json'
                },
                mode: "cors",
                credentials: "include"
            });

            if (!response.ok) {
                console.error("Cannot fetch total count");
                return 0;
            }
            let responseJson = await response.json();
            return responseJson.count || 0;
        } catch (error) {
            console.error("Error fetching total observation count", error);
            return 0;
        }
    }

    function eventFromObservation(obs: any, isLive: boolean): AlarmTableData | undefined {
        return statusTableEventFromObservation(obs, currentLane, isLive);
    }


    const getDatastreamIds = useCallback((node: INode) =>  {
        const datastreamIds: string[] = [];

        if (!entry) return datastreamIds;

        if (entry.parentNode.id !== node.id)
            return datastreamIds;

        const datastreams: typeof DataStream[] = entry.datastreams.filter(
            (ds: any) =>
                isGammaDataStream(ds) ||
                isNeutronDataStream(ds) ||
                isTamperDataStream(ds) ||
                isOccupancyStatusDataStream(ds)
        );

        for (const ds of datastreams) {
            datastreamIds.push(ds.properties.id);
        }

        return datastreamIds;
    }, [currentLane, entry]);


    useEffect(() => {
        const fetchAllCounts = async () => {
            const selectedNode = entry ? nodes.find((node: INode) => entry.parentNode.id === node.id) : undefined;
            if (!selectedNode) {
                setRowCount(0);
                return;
            }

            const datastreamIds = getDatastreamIds(selectedNode);
            if (datastreamIds.length === 0) {
                setRowCount(0);
                return;
            }

            const count = await fetchTotalCount(selectedNode, datastreamIds);
            setRowCount(count);
        }

        fetchAllCounts();
    }, [nodes, entry, getDatastreamIds, getRollingStatusTimeRange]);



    const totalPages = Math.ceil(rowCount / pageSize);

    const fetchPage = useCallback(async (userRequestedPage: number) => {
        setLoading(true);

        try {
            const pageOffset = userRequestedPage * pageSize;

            const allRows: AlarmTableData[] = [];

            const node = entry ? nodes.find((node: INode) => entry.parentNode.id === node.id) : undefined;

            if (!node) return;

            const datastreamIds = getDatastreamIds(node);
            if (datastreamIds.length === 0) return;

            const observationFilter = new ObservationFilter({
                dataStream: datastreamIds,
                resultTime: getRollingStatusTimeRange(),
                filter: STATUS_FAULT_FILTER,
                order: 'desc'
            });

            const obsApi: typeof Observations = await node.getObservationsApi();
            const obsCollection = await obsApi.searchObservations(observationFilter, pageSize, pageOffset);

            const results = await obsCollection.fetchData();
            for (const obs of results) {
                const evt = eventFromObservation(obs, false);
                if (evt !== undefined)
                    allRows.push(evt);
            }

            setData(allRows.filter((evt): evt is AlarmTableData => evt !== null && evt !== undefined));
            setCurrentPage(userRequestedPage);

        } catch (error) {
            console.error("Error fetching observations,", error)
            setData([])
        } finally {
            setLoading(false);
        }
    }, [entry, getDatastreamIds, getRollingStatusTimeRange, nodes, pageSize, totalPages]);


    useEffect(() => {
        if (totalPages > 0) {
            void fetchPage(paginationModel.page);
        } else {
            setData([]);
        }
    }, [fetchPage, nodes, paginationModel.page, paginationModel.pageSize, totalPages]);


    // useEffect(() => {
    //     const connectedSources: typeof ConSysApi[] = [];
    //
    //     const handleMessage = (msg: any) => {
    //         try {
    //             const obsData = msg.values?.[0]?.data || msg;
    //             const event = eventFromObservation(obsData, true);
    //
    //             if (currentPage === 0) {
    //                 setData(prev => {
    //                     return [event, ...prev].slice(0, pageSize);
    //                 });
    //                 setRowCount(prev => prev + 1);
    //             }
    //         } catch (err) {
    //             console.error("Error creating event from observation:", err);
    //         }
    //     };
    //
    //     const alarmStream: typeof DataStream = entry.findDataStreamByObsProperty(ALARM_DEF);
    //
    //     if (!alarmStream) {
    //         console.info("No alarm datastream");
    //     }
    //
    //
    //     const alarmSource = entry.datasourcesRealtime?.find((ds: any) => {
    //         const parts = ds.properties.resource?.split("/");
    //         return parts && parts[2] === alarmStream.properties.id;
    //     });
    //
    //     if (!alarmSource) {
    //         console.info("No alarm datasource");
    //     }
    //
    //     alarmSource.subscribe(handleMessage, [EventType.DATA]);
    //     try {
    //         alarmSource.connect()
    //         connectedSources.push(alarmSource);
    //     } catch (err) {
    //         console.error("Error connecting alarm source:", err);
    //     }
    // }, [entry]);
    //
    // useEffect(() => {
    //
    //     const connectedSources: typeof ConSysApi[] = [];
    //
    //     const handleMessage = (msg: any) => {
    //         try {
    //             const obsData = msg.values?.[0]?.data || msg;
    //             const event = eventFromObservation(obsData, true);
    //
    //             if (currentPage === 0) {
    //                 setData(prev => {
    //                     return [event, ...prev].slice(0, pageSize);
    //                 });
    //                 setRowCount(prev => prev + 1);
    //             }
    //         } catch (err) {
    //             console.error("Error creating event from observation:", err);
    //         }
    //     };
    //
    //
    //     const tamperStream: typeof DataStream = entry.findDataStreamByObsProperty(TAMPER_STATUS_DEF);
    //
    //     if (!tamperStream) {
    //         console.info("no tamper datastream");
    //     }
    //     const tamperSource = entry.datasourcesRealtime?.find((ds: any) => {
    //         const parts = ds.properties.resource?.split("/");
    //         return parts && parts[2] === tamperStream.properties.id;
    //     });
    //
    //     if (!tamperSource) {
    //         console.info("no tamper datasource");
    //     }
    //
    //     tamperSource.subscribe(handleMessage, [EventType.DATA]);
    //
    //     try {
    //         tamperSource.connect();
    //         connectedSources.push(tamperSource);
    //     } catch (err) {
    //         console.error("Error connecting tamper source:", err);
    //     }
    //
    // }, [entry]);


    useEffect(() => {
        if (!entry) {
            console.warn("No entry provided for realtime data");
            return;
        }

        const subscriptions: Array<{source: any; lease: SharedConnectionLease}> = [];
        const subscribedSources = new Set<any>();

        const handleMessage = (msg: any) => {
            try {
                const obsData = msg.values?.[0]?.data || msg;
                const event = eventFromObservation(obsData, true);

                // CRITICAL FIX: Check if event is defined before adding to array
                if (event) {
                    setRowCount(prev => prev + 1);
                    if (currentPage === 0) {
                        setData(prev => [event, ...prev].slice(0, pageSize));
                    }
                }
            } catch (err) {
                console.error("Error creating event from observation:", err);
            }
        };

        const subscribe = (source: any, description: string) => {
            if (!source || subscribedSources.has(source)) return;
            subscribedSources.add(source);
            source.subscribe(handleMessage, [EventType.DATA]);
            const lease = acquireSharedConnection(source);
            subscriptions.push({source, lease});
            void lease.ready.catch((error) => {
                console.error(`Error connecting ${description} source:`, error);
            });
        };

        for (const ds of entry.datastreams ?? []) {
            if (
                isGammaDataStream(ds) ||
                isNeutronDataStream(ds) ||
                isTamperDataStream(ds) ||
                isOccupancyStatusDataStream(ds)
            ) {
                const source = findRealtimeDataSourceForStream(entry, ds);
                if (source) {
                    subscribe(source, ds.properties?.name || "status");
                }
            }
        }

        return () => {
            subscriptions.forEach(({source, lease}) => {
                removeRealtimeEventSubscription(source, handleMessage);
                void lease.release().catch((error) => {
                    console.error("Error disconnecting lane status source:", error);
                });
            });
        };
    }, [entry, currentPage, pageSize]);
    return(
        <Box sx={{height: 800, width: '100%', display: 'flex', flexDirection: 'column'}}>
            <Stack
                direction={{xs: "column", sm: "row"}}
                spacing={1}
                alignItems={{xs: "flex-start", sm: "center"}}
                justifyContent="space-between"
                data-testid="lane-fault-window-bar"
                sx={{
                    px: 1.5,
                    py: 0.75,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    bgcolor: "action.hover",
                }}
            >
                <Typography variant="caption" color="text.secondary" sx={{textWrap: "pretty"}}>
                    {t("laneFaultWindowNotice", {
                        window: faultWindowOptions.find(opt => opt.value === faultWindowPreset)?.label ?? faultWindowPreset,
                    })}
                </Typography>
                <Box
                    role="group"
                    aria-label={t("laneFaultWindowGroupLabel")}
                    sx={{display: "inline-flex", alignItems: "center", gap: 0.5, flexWrap: "wrap"}}
                >
                    {faultWindowOptions.map((option) => (
                        <Button
                            key={option.value}
                            type="button"
                            size="small"
                            aria-pressed={faultWindowPreset === option.value}
                            onClick={() => {
                                setFaultWindowPreset(option.value);
                                setPaginationModel(prev => prev.page === 0 ? prev : {...prev, page: 0});
                            }}
                            data-testid={`lane-fault-window-${option.value}`}
                            sx={{
                                textTransform: "none",
                                minInlineSize: "24px",
                                minBlockSize: "24px",
                                px: 1,
                                py: 0.25,
                                borderRadius: 1,
                                border: "1px solid",
                                borderColor: "divider",
                                color: "text.primary",
                                "@media (pointer: coarse)": {minBlockSize: "44px", minInlineSize: "44px"},
                                "&[aria-pressed='true']": {
                                    bgcolor: "primary.main",
                                    color: "primary.contrastText",
                                    borderColor: "primary.dark",
                                    fontWeight: 700,
                                },
                            }}
                        >
                            {option.label}
                        </Button>
                    ))}
                </Box>
            </Stack>
            <Box sx={{flex: 1, minHeight: 0, width: "100%"}}>
            <DataGrid
                localeText={getDataGridLocaleText(language)}
                rows={data}
                paginationMode="server"
                loading={loading}
                paginationModel={paginationModel}
                onPaginationModelChange={setPaginationModel}
                rowCount={rowCount}
                columns={columns}
                pageSizeOptions={[15]}
                slots={{ toolbar: CustomToolbar }}
                initialState={{
                    sorting: {
                        sortModel: [{field: 'timestamp', sort: 'desc'}]
                    }
                }}
                autosizeOnMount
                getCellClassName={(params: GridCellParams<any, any, string>) => {
                    // Assign className for styling to 'Status' column based on value
                    if (params.value.includes("Gamma")) return "highlightGamma";
                    if (params.value.includes('Neutron')) return "highlightNeutron";
                    else if (params.value.includes("Extended Occupancy")) return "highlightExtendedOccupancy";
                    else if (params.value === "Tamper") return "highlightTamper";
                    else
                        return '';
                }}

                sx={{
                    // Assign styling to 'Status' column based on className
                    [`.${gridClasses.cell}.highlightGamma`]: {
                        backgroundColor: "error.main",
                        color: "error.contrastText",
                    },
                    [`.${gridClasses.cell}.highlightNeutron`]: {
                        backgroundColor: "info.main",
                        color: "info.contrastText",
                    },
                    [`.${gridClasses.cell}.highlightExtendedOccupancy`]: {
                        backgroundColor: "warning.main",
                        color: "warning.contrastText",
                    },
                    [`.${gridClasses.cell}.highlightTamper`]: {
                        backgroundColor: "secondary.main",
                        color: "secondary.contrastText",
                    },
                    border: "none",
                }}
            />
            </Box>
        </Box>
    )
}
