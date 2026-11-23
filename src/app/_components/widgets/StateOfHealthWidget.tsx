"use client";

/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import React from "react";
import {Box} from "@mui/material";
import HealthPage from "@/app/health/page";
import {WidgetProps} from "@/app/_components/layout/WidgetTypes";

/**
 * ORNL's State of Health view (lane health grid, extended-occupancy and fault state, WebRelay
 * settings for admins), hosted unchanged. The widget frame carries the title, so the page's own
 * heading and its large icon are hidden here rather than by editing ORNL's page.
 */
export default function StateOfHealthWidget(_props: WidgetProps) {
    return (
        <Box
            data-testid="state-of-health-widget"
            sx={{
                height: '100%', overflowY: 'auto', minInlineSize: 0, p: 1,
                '& h1': {display: 'none'},
                '& svg[data-testid="MonitorHeartRoundedIcon"]': {display: 'none'},
            }}
        >
            <HealthPage/>
        </Box>
    );
}
