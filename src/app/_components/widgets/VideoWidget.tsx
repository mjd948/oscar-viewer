"use client";

/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import React from "react";
import {Box, Typography} from "@mui/material";
import VideoMedia from "@/app/_components/lane-view/VideoMedia";
import {VideoWidgetConfig} from "@/lib/layout/PageConfigTypes";
import {WidgetProps} from "@/app/_components/layout/WidgetTypes";
import {useResolvedLane} from "@/app/_components/layout/useResolvedLane";
import {useLanguage} from "@/app/contexts/LanguageContext";

/** ORNL's live lane video (viewer leases, camera cycling, auto-retry) for one lane. */
export default function VideoWidget({page, widget}: WidgetProps) {
    const config = widget.config as VideoWidgetConfig;
    const {t} = useLanguage();
    const lane = useResolvedLane(page, config.laneSource);
    if (!lane) {
        return (
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
                <Typography color="text.secondary">{t('noLaneSelected')}</Typography>
            </Box>
        );
    }
    return (
        <Box sx={{height: '100%', overflow: 'hidden'}}>
            <VideoMedia key={lane} currentLane={lane} fillHeight/>
        </Box>
    );
}
