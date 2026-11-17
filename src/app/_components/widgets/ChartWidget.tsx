"use client";

/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import React, {useState} from "react";
import {Box, Typography} from "@mui/material";
import ChartLane from "@/app/_components/lane-view/ChartLane";
import {ChartWidgetConfig} from "@/lib/layout/PageConfigTypes";
import {WidgetProps} from "@/app/_components/layout/WidgetTypes";
import {useResolvedLane} from "@/app/_components/layout/useResolvedLane";
import {useLanguage} from "@/app/contexts/LanguageContext";
import {useLaneDataSources} from "@/lib/data/oscar/streams/useLaneDataSources";

/** ORNL's lane gamma/neutron chart (with its own total/per-detector toggle) for one lane. */
export default function ChartWidget({page, widget}: WidgetProps) {
    const config = widget.config as ChartWidgetConfig;
    const {t} = useLanguage();
    const lane = useResolvedLane(page, config.laneSource);
    const {gamma, neutron, threshold} = useLaneDataSources(lane, true);
    const [, setChartReady] = useState(false);

    if (!lane) {
        return (
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
                <Typography color="text.secondary">{t('noLaneSelected')}</Typography>
            </Box>
        );
    }
    return (
        <Box sx={{height: '100%', overflow: 'auto'}}>
            <ChartLane key={lane} laneName={lane} setChartReady={setChartReady} datasources={{gamma, neutron, threshold}}/>
        </Box>
    );
}
