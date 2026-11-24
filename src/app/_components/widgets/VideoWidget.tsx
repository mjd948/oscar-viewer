"use client";

/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import React, {useContext} from "react";
import {Box, Typography} from "@mui/material";
import VideoMedia from "@/app/_components/lane-view/VideoMedia";
import {getUniqueVideoControlStreams} from "@/app/_components/lane-view/VideoStreamUtils";
import {DataSourceContext} from "@/app/contexts/DataSourceContext";
import {VideoWidgetConfig} from "@/lib/layout/PageConfigTypes";
import {WidgetProps} from "@/app/_components/layout/WidgetTypes";
import {useResolvedLane} from "@/app/_components/layout/useResolvedLane";
import {useLanguage} from "@/app/contexts/LanguageContext";

/** ORNL's live lane video (viewer leases, camera cycling, auto-retry) for one lane. */
export default function VideoWidget({page, widget}: WidgetProps) {
    const config = widget.config as VideoWidgetConfig;
    const {t} = useLanguage();
    const lane = useResolvedLane(page, config.laneSource);
    const {laneMapRef, readyLaneNames} = useContext(DataSourceContext);
    // A camera-less lane (e.g. an RS-350 walker) gets ORNL's "no video" text without mounting the
    // player, which would log an error for it; ORNL's Lane View shows the RS-350 view instead.
    const entry = lane && readyLaneNames.has(lane) ? laneMapRef?.current?.get(lane) : undefined;
    if (entry && getUniqueVideoControlStreams(entry).length === 0) {
        return (
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
                <Typography color="text.secondary" data-testid="video-widget-no-video">{t('noVideoAvailable')}</Typography>
            </Box>
        );
    }
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
