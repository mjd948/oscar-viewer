"use client";

/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import React from "react";
import {Box} from "@mui/material";
import NationalViewPage from "@/app/national-view/page";
import {WidgetProps} from "@/app/_components/layout/WidgetTypes";

/** ORNL's national statistics view (its queries live in the page component itself). */
export default function NationalStatsWidget(_props: WidgetProps) {
    return (
        <Box sx={{height: '100%', overflowY: 'auto'}}>
            <NationalViewPage/>
        </Box>
    );
}
