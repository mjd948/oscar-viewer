"use client"

import {EventTableData} from "@/lib/data/oscar/TableHelpers";
import {LaneMapEntry} from "@/lib/data/oscar/LaneCollection";
import {
    DailyFileMessageItem,
    DailyFileSliceFetch,
    DEFAULT_DAILY_FILE_SLICE_LIMIT,
    fetchDailyFileSlice,
    mergeDailyFileItems,
    shouldFetchDailyFileSlice,
} from "@/lib/data/oscar/DailyFileSlice";
import {Alert, Box, Stack, Typography} from "@mui/material";
import React, {useContext, useEffect, useState} from "react";
import ObservationFilter from "osh-js/source/core/consysapi/observation/ObservationFilter";
import {
    isDailyFileDataStream,
} from "@/lib/data/oscar/Utilities";
import DataStream from "osh-js/source/core/sweapi/datastream/DataStream";
import {DataSourceContext} from "@/app/contexts/DataSourceContext";
import {Download} from "@mui/icons-material";
import IconButton from "@mui/material/IconButton";
import {useLanguage} from "@/app/contexts/LanguageContext";
import {getIntlLocale} from "@/app/utils/LocaleUtils";


export default function DailyFileTable(props: { event: EventTableData; fetchImpl?: DailyFileSliceFetch }) {
    const {language, t} = useLanguage();
    const locale = getIntlLocale(language);
    const [logs, setLogs] = useState<string[]>([]);
    const [isTruncated, setIsTruncated] = useState(false);

    const laneMapRef = useContext(DataSourceContext).laneMapRef;

    useEffect(() => {
        const controller = new AbortController();
        const {signal} = controller;

        const loadMessages = async () => {
            const currentLane = props.event.laneId;
            const currLaneEntry: LaneMapEntry | undefined = laneMapRef.current.get(currentLane);
            if (!currLaneEntry) {
                console.warn("Cannot load daily file: lane entry is unavailable:", currentLane);
                if (!signal.aborted) {
                    setLogs([]);
                    setIsTruncated(false);
                }
                return;
            }

            const datastream: typeof DataStream | undefined = currLaneEntry.datastreams?.find(
                (ds) => isDailyFileDataStream(ds),
            );
            const hotItems: DailyFileMessageItem[] = [];
            let hotTruncated = false;

            if (datastream) {
                try {
                    const observations = await datastream.searchObservations(new ObservationFilter({
                        resultTime: `${props.event.startTime}/${props.event.endTime}`,
                        order: 'asc',
                    }), DEFAULT_DAILY_FILE_SLICE_LIMIT);

                    while (!signal.aborted && observations.hasNext()) {
                        if (hotItems.length >= DEFAULT_DAILY_FILE_SLICE_LIMIT) {
                            hotTruncated = true;
                            break;
                        }
                        const page = await observations.nextPage();
                        if (signal.aborted)
                            return;
                        for (const observation of page) {
                            const result = observation?.result
                                ?? observation?.properties?.result
                                ?? observation?.results?.[0]?.data;
                            const message = result?.rpmMessage ?? result?.rapiscanMessage ?? result?.aspectMessage;
                            const timestamp = observation?.resultTime
                                ?? observation?.properties?.resultTime
                                ?? observation?.timestamp;
                            if (message && timestamp) {
                                hotItems.push({
                                    message: String(message),
                                    timestamp: String(timestamp),
                                });
                            }
                        }
                    }
                    if (hotItems.length > DEFAULT_DAILY_FILE_SLICE_LIMIT) {
                        hotTruncated = true;
                    }
                } catch (error) {
                    if (signal.aborted)
                        return;
                    console.warn("Failed to load hot daily-file observations; attempting cold slice fallback:", error);
                }
            } else if (!currLaneEntry.parentNode) {
                console.warn("No daily file datastream found for this lane");
                if (!signal.aborted) {
                    setLogs([]);
                    setIsTruncated(false);
                }
                return;
            }

            if (signal.aborted)
                return;

            let sliceItems: DailyFileMessageItem[] = [];
            let sliceTruncated = false;
            if (currLaneEntry.parentNode && shouldFetchDailyFileSlice(hotItems, props.event.startTime)) {
                const laneUid = currLaneEntry.laneSystem?.properties?.properties?.uid
                    ?? currLaneEntry.laneSystem?.properties?.uid;
                try {
                    const sliceResponse = await fetchDailyFileSlice({
                        node: currLaneEntry.parentNode,
                        laneUid: typeof laneUid === "string" ? laneUid : undefined,
                        laneName: currentLane,
                        startTime: props.event.startTime,
                        endTime: props.event.endTime,
                        limit: DEFAULT_DAILY_FILE_SLICE_LIMIT,
                    }, props.fetchImpl, signal);
                    if (signal.aborted)
                        return;
                    sliceItems = sliceResponse?.items ?? [];
                    sliceTruncated = Boolean(sliceResponse?.truncated);
                } catch (error) {
                    if (signal.aborted)
                        return;
                    console.error("Failed to load daily-file slice:", error);
                }
            }

            if (!signal.aborted) {
                const unboundedMerged = mergeDailyFileItems(
                    hotItems,
                    sliceItems,
                    DEFAULT_DAILY_FILE_SLICE_LIMIT + 1,
                );
                setIsTruncated(
                    hotTruncated
                    || sliceTruncated
                    || unboundedMerged.length > DEFAULT_DAILY_FILE_SLICE_LIMIT,
                );
                setLogs(unboundedMerged.slice(0, DEFAULT_DAILY_FILE_SLICE_LIMIT));
            }
        };

        void loadMessages();
        return () => controller.abort();
    }, [props.event, props.fetchImpl, laneMapRef]);

    function handleDownload(){
        const csvContent = logs.join('\n');
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `exported_dailyfile_${props.event.startTime}_${props.event.endTime}.csv`);
        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    return(
        <Box sx={{
            height: 300,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            minInlineSize: 0,
            '@media print': { height: 'auto', overflow: 'visible' },
        }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1, pt: 0.5 }}>
                <Typography variant="h5" sx={{ textWrap: 'balance' }}>
                    {t('dailyFileOccupancy')}
                </Typography>
                <IconButton
                    aria-label="download"
                    sx={{ displayPrint: 'none' }}
                    onClick={() => {
                        handleDownload()
                    }}
                >
                    <Download />
                </IconButton>
            </Stack>
            {isTruncated && (
                <Alert
                    severity="info"
                    role="status"
                    data-testid="daily-file-truncated-notice"
                    sx={{ mx: 1, my: 0.5, py: 0, "& .MuiAlert-message": { textWrap: "pretty" } }}
                >
                    {t('dailyFileSliceTruncatedNotice', {
                        limit: DEFAULT_DAILY_FILE_SLICE_LIMIT.toLocaleString(locale),
                    })}
                </Alert>
            )}
            <Box
                component="pre"
                sx={{
                    flexGrow: 1,
                    height: 'calc(100% - 40px)',
                    overflowY: 'auto',
                    padding: '10px',
                    margin: 0,
                    boxSizing: 'border-box',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    '@media print': {
                        height: 'auto',
                        overflow: 'visible',
                    },
                }}
            >
                {logs.join('\n')}
            </Box>
        </Box>
    )
}
