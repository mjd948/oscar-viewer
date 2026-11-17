"use client";

/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import React from "react";
import MapComponent from "@/app/_components/maps/MapComponent";
import {WidgetProps} from "@/app/_components/layout/WidgetTypes";

/** ORNL's map (lanes, walkers, mobile alarm markers) filling the tile. */
export default function MapWidget({widget}: WidgetProps) {
    // Unique, stable DOM id per widget instance: Leaflet containers collide otherwise.
    return <MapComponent containerId={`map-widget-${widget.id}`} height="100%"/>;
}
