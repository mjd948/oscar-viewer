"use client";

/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import React from "react";
import {Box} from "@mui/material";
import ReportGeneratorView from "@/app/_components/reportgen/Report";
import {WidgetProps} from "@/app/_components/layout/WidgetTypes";

/** ORNL's Report Generator (report type, range, lanes, format, generate and download). */
export default function ReportGeneratorWidget(_props: WidgetProps) {
    return (
        <Box data-testid="report-generator-widget" sx={{height: '100%', overflowY: 'auto', minInlineSize: 0, p: 1}}>
            <ReportGeneratorView/>
        </Box>
    );
}
