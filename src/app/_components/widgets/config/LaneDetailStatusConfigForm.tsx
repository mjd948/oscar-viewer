"use client";

/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import React from "react";
import LaneSourceField from "./LaneSourceField";
import {LaneDetailStatusWidgetConfig} from "@/lib/layout/PageConfigTypes";
import {WidgetConfigFormProps} from "@/app/_components/layout/WidgetTypes";

/** Lane-source picker; shared by every single-lane widget (status, video, chart). */
export default function LaneDetailStatusConfigForm({draft, onChange}: WidgetConfigFormProps) {
    const config = draft as LaneDetailStatusWidgetConfig & Record<string, unknown>;
    return (
        <LaneSourceField
            value={config.laneSource ?? {source: 'page'}}
            onChange={(laneSource) => onChange({...config, laneSource})}
        />
    );
}
