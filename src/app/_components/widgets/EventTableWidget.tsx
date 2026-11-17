"use client";

/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import React, {useMemo} from "react";
import {useSelector} from "react-redux";
import {Box} from "@mui/material";
import EventTable from "@/app/_components/event-table/EventTable";
import {RootState} from "@/lib/state/Store";
import {selectLaneMap} from "@/lib/state/OSCARLaneSlice";
import {EventTableColumnSetting, EventTableWidgetConfig} from "@/lib/layout/PageConfigTypes";
import {updateWidgetConfig} from "@/lib/state/PageLayoutSlice";
import {useAppDispatch} from "@/lib/state/Hooks";
import {WidgetProps} from "@/app/_components/layout/WidgetTypes";
import {resolveLaneSelection} from "@/lib/data/oscar/streams/LaneStreamRegistry";
import {LaneMapEntry} from "@/lib/data/oscar/LaneCollection";

/**
 * ORNL's EventTable inside a widget tile. The widget adds two things: a lane scope (the table
 * only sees the selected lanes) and persisted column visibility/order/width. Everything else -
 * filters, saved queries, bulk and inline adjudication - is ORNL's table as-is.
 * `adjudicationMode` runs the table in alarm mode (ORNL's unadjudicated-alarm queue).
 */
export function ConfigurableEventTable({page, widget, adjudicationMode}: WidgetProps & { adjudicationMode?: boolean }) {
    const config = widget.config as EventTableWidgetConfig;
    const laneMap = useSelector((state: RootState) => selectLaneMap(state)) as Map<string, LaneMapEntry>;
    const dispatch = useAppDispatch();

    const lanes = config.filters?.lanes ?? {mode: 'all' as const};
    const scopedLaneMap = useMemo(() => {
        if (lanes.mode === 'all' || !(laneMap instanceof Map)) return laneMap;
        const keep = new Set(resolveLaneSelection(lanes, laneMap));
        return new Map([...laneMap].filter(([name]) => keep.has(name)));
    }, [laneMap, lanes]);

    const handleColumnSettingsChange = (columns: EventTableColumnSetting[]) => {
        dispatch(updateWidgetConfig({pageId: page.id, widgetId: widget.id, config: {...config, columns}}));
    };

    return (
        <Box sx={{height: '100%', overflow: 'auto'}}>
            <EventTable
                tableMode={adjudicationMode ? 'alarmtable' : 'eventlog'}
                laneMap={scopedLaneMap}
                viewLane={!adjudicationMode}
                viewAdjudicated={!adjudicationMode}
                columnSettings={config.columns}
                onColumnSettingsChange={handleColumnSettingsChange}
                fillHeight
            />
        </Box>
    );
}

export default function EventTableWidget(props: WidgetProps) {
    return <ConfigurableEventTable {...props}/>;
}
