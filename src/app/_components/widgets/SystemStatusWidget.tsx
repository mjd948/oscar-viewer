"use client";

/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import React, {useMemo} from "react";
import {useSelector} from "react-redux";
import LaneStatus from "@/app/_components/dashboard/LaneStatus";
import {SystemStatusWidgetConfig} from "@/lib/layout/PageConfigTypes";
import {WidgetProps} from "@/app/_components/layout/WidgetTypes";
import {RootState} from "@/lib/state/Store";
import {selectLaneMap} from "@/lib/state/OSCARLaneSlice";
import {resolveLaneSelection} from "@/lib/data/oscar/streams/LaneStreamRegistry";

/** ORNL's dashboard lane-health grid, optionally limited to some lanes. */
export default function SystemStatusWidget({widget}: WidgetProps) {
    const config = widget.config as SystemStatusWidgetConfig;
    const laneMap = useSelector((state: RootState) => selectLaneMap(state));
    const selection = config.lanes ?? {mode: 'all' as const};
    const laneNames = useMemo(
        () => (selection.mode === 'all' ? undefined : resolveLaneSelection(selection, laneMap)),
        [laneMap, selection],
    );
    return <LaneStatus laneNames={laneNames} hideTitle subscribeAlarmStream={false}/>;
}
