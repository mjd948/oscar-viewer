"use client"
import { Suspense } from "react";
import { Grid, Paper, Stack, Typography } from "@mui/material";
import { useSearchParams } from "next/navigation";
import EventTable from "@/app/_components/event-table/EventTable";
import {useSelector} from "react-redux";
import {RootState} from "@/lib/state/Store";
import {selectLaneMap} from "@/lib/state/OSCARLaneSlice";
import {LaneMapEntry} from "@/lib/data/oscar/LaneCollection";
import {useLanguage} from "@/app/contexts/LanguageContext";
import EventUuidLookup from "@/app/_components/event-table/EventUuidLookup";
import {PlatformIconBadge} from "@/app/_components/common/PlatformIcons";

function EventLogTableWithParams({laneMap}: {laneMap: Map<string, LaneMapEntry>}) {
    const searchParams = useSearchParams();
    const restoreFiltered = searchParams.get("restore") === "1";
    return (
        <EventTable
            tableMode={"eventlog"}
            viewLane
            viewAdjudicated
            laneMap={laneMap}
            restoreFiltered={restoreFiltered}
        />
    );
}

export default function EventLogPage() {
    const { t } = useLanguage();
    const laneMap = useSelector((state: RootState) => selectLaneMap(state));

    return (
        <Grid container spacing={2} sx={{ minInlineSize: 0 }}>
            <Grid item xs={12} sx={{ minInlineSize: 0 }}>
                <Stack
                    direction={{xs: "column", md: "row"}}
                    spacing={2}
                    justifyContent="space-between"
                    alignItems={{md: "flex-start"}}
                >
                    <Stack direction="row" spacing={1.25} alignItems="center">
                        <PlatformIconBadge iconKey="events" size="header" />
                        <Typography variant="h4">
                            { t('events') }
                        </Typography>
                    </Stack>
                    <EventUuidLookup/>
                </Stack>
            </Grid>

            <Grid item xs={12} sx={{ gap: 2, minInlineSize: 0 }}>
                <Paper variant='outlined' sx={{ padding: 0 }}>
                    <Suspense fallback={null}>
                        <EventLogTableWithParams laneMap={laneMap} />
                    </Suspense>
                </Paper>
            </Grid>
        </Grid>
    );
}
