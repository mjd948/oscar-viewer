"use client";

/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import React from "react";
import {Box} from "@mui/material";
import EventUuidLookup from "@/app/_components/event-table/EventUuidLookup";
import {WidgetProps} from "@/app/_components/layout/WidgetTypes";

/** ORNL's event-ID lookup from the Events page; a match opens that event's details page. */
export default function EventLookupWidget(_props: WidgetProps) {
    return (
        <Box data-testid="event-lookup-widget" sx={{
            height: '100%', overflow: 'auto', display: 'flex', alignItems: 'center', p: 1.5,
            // ORNL sizes the field for the Events page header; let it flex to the widget instead.
            '& > .MuiStack-root': {width: '100%'},
            '& .MuiTextField-root': {minWidth: 0, flex: 1},
        }}>
            <EventUuidLookup/>
        </Box>
    );
}
