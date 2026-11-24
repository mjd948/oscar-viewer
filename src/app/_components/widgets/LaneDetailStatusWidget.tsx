"use client";

/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import React from "react";
import {Box, Typography} from "@mui/material";
import LaneStatusDetail from "@/app/_components/lane-view/LaneStatus";
import DailyFileMessage from "@/app/_components/lane-view/DailyFileMessage";
import {LaneDetailStatusWidgetConfig} from "@/lib/layout/PageConfigTypes";
import {WidgetProps} from "@/app/_components/layout/WidgetTypes";
import {useResolvedLane} from "@/app/_components/layout/useResolvedLane";
import {useLanguage} from "@/app/contexts/LanguageContext";
import {useLaneDataSources} from "@/lib/data/oscar/streams/useLaneDataSources";

export default function LaneDetailStatusWidget({page, widget}: WidgetProps) {
    const config = widget.config as LaneDetailStatusWidgetConfig;
    const {t} = useLanguage();
    const lane = useResolvedLane(page, config.laneSource);
    const {collection} = useLaneDataSources(lane);
    if (!lane || !collection) {
        return (
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
                <Typography color="text.secondary">{t('noLaneSelected')}</Typography>
            </Box>
        );
    }
    // ORNL's Lane View shows the daily-file notice under the status strip; keep it with it.
    return (
        <Box sx={{height: '100%', overflowY: 'auto', minInlineSize: 0}}>
            <LaneStatusDetail key={lane} dataSourcesByLane={collection}/>
            <DailyFileMessage key={`${lane}:daily`} dataSourcesByLane={collection}/>
        </Box>
    );
}
