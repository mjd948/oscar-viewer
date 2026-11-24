"use client";

/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import React, {useContext} from "react";
import {useSelector} from "react-redux";
import {Box, CircularProgress, Typography} from "@mui/material";
import RS350BackpackView from "@/app/_components/lane-view/RS350BackpackView";
import {DataSourceContext} from "@/app/contexts/DataSourceContext";
import {RS350SpectrumWidgetConfig} from "@/lib/layout/PageConfigTypes";
import {WidgetProps} from "@/app/_components/layout/WidgetTypes";
import {useResolvedLane} from "@/app/_components/layout/useResolvedLane";
import {useLanguage} from "@/app/contexts/LanguageContext";
import {RootState} from "@/lib/state/Store";
import {selectLaneMap} from "@/lib/state/OSCARLaneSlice";

function Centered({children}: {children: React.ReactNode}) {
    return (
        <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', p: 2, textAlign: 'center'}}>
            {children}
        </Box>
    );
}

/**
 * ORNL's RS-350 lane view (foreground, background and alarm spectra, live status). ORNL's Lane
 * View shows it instead of the portal layout for RS-350 lanes; here it is a widget for one lane.
 */
export default function RS350SpectrumWidget({page, widget}: WidgetProps) {
    const config = widget.config as RS350SpectrumWidgetConfig;
    const {t} = useLanguage();
    const lane = useResolvedLane(page, config.laneSource);
    const laneMap = useSelector((state: RootState) => selectLaneMap(state));
    const {laneMapRef, readyLaneNames} = useContext(DataSourceContext);

    if (!lane) return <Centered><Typography color="text.secondary">{t('noLaneSelected')}</Typography></Centered>;
    const entry = readyLaneNames.has(lane) ? laneMapRef.current?.get(lane) : undefined;
    if (!entry) return <Centered><CircularProgress size={24}/></Centered>;
    if (!entry.isRS350Backpack) {
        return (
            <Centered>
                <Typography color="text.secondary" data-testid="rs350-spectrum-not-rs350">
                    {t('rs350SpectrumOnly', {lane})}
                </Typography>
            </Centered>
        );
    }
    return (
        <Box data-testid="rs350-spectrum-widget" sx={{height: '100%', overflowY: 'auto', minInlineSize: 0, px: 1}}>
            <RS350BackpackView key={lane} entry={entry} currentLane={lane} laneMap={laneMap}/>
        </Box>
    );
}
