"use client";

/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import React from "react";
import {Box} from "@mui/material";
import AlarmTransferImport from "@/app/_components/alarm-transfer/AlarmTransferImport";
import {WidgetProps} from "@/app/_components/layout/WidgetTypes";

/** ORNL's Alarm Transfer import (camera/image QR scan, alarm file, pasted payload). */
export default function AlarmTransferWidget(_props: WidgetProps) {
    return (
        <Box data-testid="alarm-transfer-widget" sx={{height: '100%', overflowY: 'auto', minInlineSize: 0, p: 2}}>
            <AlarmTransferImport/>
        </Box>
    );
}
