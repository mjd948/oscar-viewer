"use client";

/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import React from "react";
import dynamic from "next/dynamic";
import {Box, CircularProgress} from "@mui/material";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import LocationOnRoundedIcon from "@mui/icons-material/LocationOnRounded";
import MediationIcon from "@mui/icons-material/Mediation";
import InsertChartIcon from "@mui/icons-material/InsertChart";
import TableRowsRoundedIcon from "@mui/icons-material/TableRowsRounded";
import GavelRoundedIcon from "@mui/icons-material/GavelRounded";
import VideocamRoundedIcon from "@mui/icons-material/VideocamRounded";
import BarChartRoundedIcon from "@mui/icons-material/BarChartRounded";
import MonitorHeartRoundedIcon from "@mui/icons-material/MonitorHeartRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import PreviewRoundedIcon from "@mui/icons-material/PreviewRounded";
import QueryStatsRoundedIcon from "@mui/icons-material/QueryStatsRounded";
import GridViewRoundedIcon from "@mui/icons-material/GridViewRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import DirectionsCarRoundedIcon from "@mui/icons-material/DirectionsCarRounded";
import HealthAndSafetyRoundedIcon from "@mui/icons-material/HealthAndSafetyRounded";
import SummarizeRoundedIcon from "@mui/icons-material/SummarizeRounded";
import QrCodeScannerRoundedIcon from "@mui/icons-material/QrCodeScannerRounded";
import ArticleRoundedIcon from "@mui/icons-material/ArticleRounded";
import ManageSearchRoundedIcon from "@mui/icons-material/ManageSearchRounded";
import SsidChartRoundedIcon from "@mui/icons-material/SsidChartRounded";
import {WidgetType} from "@/lib/layout/PageConfigTypes";
import {WidgetComponent, WidgetConfigFormComponent} from "./WidgetTypes";

import SystemStatusWidget from "@/app/_components/widgets/SystemStatusWidget";
import EventTableWidget from "@/app/_components/widgets/EventTableWidget";
import AdjudicationTableWidget from "@/app/_components/widgets/AdjudicationTableWidget";
import LaneDetailStatusWidget from "@/app/_components/widgets/LaneDetailStatusWidget";
import StatusTableWidget from "@/app/_components/widgets/StatusTableWidget";
import EventLookupWidget from "@/app/_components/widgets/EventLookupWidget";

import SystemStatusConfigForm from "@/app/_components/widgets/config/SystemStatusConfigForm";
import EventTableConfigForm from "@/app/_components/widgets/config/EventTableConfigForm";
import StatusTableConfigForm from "@/app/_components/widgets/config/StatusTableConfigForm";
import LaneDetailStatusConfigForm from "@/app/_components/widgets/config/LaneDetailStatusConfigForm";
import AlarmStatsConfigForm from "@/app/_components/widgets/config/AlarmStatsConfigForm";

const widgetLoading = () => (
    <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
        <CircularProgress size={24}/>
    </Box>
);

// Browser-only widgets (Leaflet, HLS, chart.js canvas, event preview media)
// load client-side only — the static export prerender must not touch them.
const MapWidget = dynamic(() => import("@/app/_components/widgets/MapWidget"), {ssr: false, loading: widgetLoading});
const VideoWidget = dynamic(() => import("@/app/_components/widgets/VideoWidget"), {ssr: false, loading: widgetLoading});
const ChartWidget = dynamic(() => import("@/app/_components/widgets/ChartWidget"), {ssr: false, loading: widgetLoading});
const QuickViewWidget = dynamic(() => import("@/app/_components/widgets/QuickViewWidget"), {ssr: false, loading: widgetLoading});
const NationalStatsWidget = dynamic(() => import("@/app/_components/widgets/NationalStatsWidget"), {ssr: false, loading: widgetLoading});
const AlarmStatsWidget = dynamic(() => import("@/app/_components/widgets/AlarmStatsWidget"), {ssr: false, loading: widgetLoading});
// Whole ORNL views: client-only like their pages (camera/QR scanning, chart.js, report download).
const StateOfHealthWidget = dynamic(() => import("@/app/_components/widgets/StateOfHealthWidget"), {ssr: false, loading: widgetLoading});
const ReportGeneratorWidget = dynamic(() => import("@/app/_components/widgets/ReportGeneratorWidget"), {ssr: false, loading: widgetLoading});
const AlarmTransferWidget = dynamic(() => import("@/app/_components/widgets/AlarmTransferWidget"), {ssr: false, loading: widgetLoading});
const EventDetailsWidget = dynamic(() => import("@/app/_components/widgets/EventDetailsWidget"), {ssr: false, loading: widgetLoading});
const RS350SpectrumWidget = dynamic(() => import("@/app/_components/widgets/RS350SpectrumWidget"), {ssr: false, loading: widgetLoading});

export interface WidgetRegistryEntry {
    component: WidgetComponent;
    ConfigForm?: WidgetConfigFormComponent;
    /** i18n key for the default widget title. */
    titleKey: string;
    icon: React.ReactNode;
}

export const WIDGET_REGISTRY: Record<WidgetType, WidgetRegistryEntry> = {
    'system-status': {
        component: SystemStatusWidget,
        ConfigForm: SystemStatusConfigForm,
        titleKey: 'laneStatus',
        icon: <MonitorHeartRoundedIcon/>,
    },
    'map': {
        component: MapWidget as WidgetComponent,
        ConfigForm: undefined,
        titleKey: 'map',
        icon: <LocationOnRoundedIcon/>,
    },
    'event-table': {
        component: EventTableWidget,
        ConfigForm: EventTableConfigForm,
        titleKey: 'events',
        icon: <TableRowsRoundedIcon/>,
    },
    'adjudication-table': {
        component: AdjudicationTableWidget,
        ConfigForm: EventTableConfigForm,
        titleKey: 'alarmTable',
        icon: <GavelRoundedIcon/>,
    },
    'video': {
        component: VideoWidget as WidgetComponent,
        ConfigForm: LaneDetailStatusConfigForm,
        titleKey: 'videoStream',
        icon: <VideocamRoundedIcon/>,
    },
    'chart': {
        component: ChartWidget as WidgetComponent,
        ConfigForm: LaneDetailStatusConfigForm,
        titleKey: 'countChart',
        icon: <BarChartRoundedIcon/>,
    },
    'national-stats': {
        component: NationalStatsWidget as WidgetComponent,
        ConfigForm: undefined,
        titleKey: 'national',
        icon: <MediationIcon/>,
    },
    'lane-detail-status': {
        component: LaneDetailStatusWidget,
        ConfigForm: LaneDetailStatusConfigForm,
        titleKey: 'laneStatus',
        icon: <FactCheckRoundedIcon/>,
    },
    'status-table': {
        component: StatusTableWidget,
        ConfigForm: StatusTableConfigForm,
        titleKey: 'laneLog',
        icon: <TableRowsRoundedIcon/>,
    },
    'quick-view': {
        component: QuickViewWidget as WidgetComponent,
        ConfigForm: undefined,
        titleKey: 'quickView',
        icon: <PreviewRoundedIcon/>,
    },
    'alarm-stats': {
        component: AlarmStatsWidget as WidgetComponent,
        ConfigForm: AlarmStatsConfigForm,
        titleKey: 'alarmStats',
        icon: <QueryStatsRoundedIcon/>,
    },
    'state-of-health': {
        component: StateOfHealthWidget as WidgetComponent,
        ConfigForm: undefined,
        titleKey: 'stateOfHealth',
        icon: <HealthAndSafetyRoundedIcon/>,
    },
    'report-generator': {
        component: ReportGeneratorWidget as WidgetComponent,
        ConfigForm: undefined,
        titleKey: 'reportGenerator',
        icon: <SummarizeRoundedIcon/>,
    },
    'alarm-transfer': {
        component: AlarmTransferWidget as WidgetComponent,
        ConfigForm: undefined,
        titleKey: 'alarmTransfer',
        icon: <QrCodeScannerRoundedIcon/>,
    },
    'event-details': {
        component: EventDetailsWidget as WidgetComponent,
        ConfigForm: undefined,
        titleKey: 'eventDetails',
        icon: <ArticleRoundedIcon/>,
    },
    'event-lookup': {
        component: EventLookupWidget,
        ConfigForm: undefined,
        titleKey: 'eventLookup',
        icon: <ManageSearchRoundedIcon/>,
    },
    'rs350-spectrum': {
        component: RS350SpectrumWidget as WidgetComponent,
        ConfigForm: LaneDetailStatusConfigForm,
        titleKey: 'rs350Spectrum',
        icon: <SsidChartRoundedIcon/>,
    },
};

/** Curated icon set for pages (nav drawer + Add Page dialog). */
export const PAGE_ICONS: Record<string, React.ReactNode> = {
    dashboard: <DashboardRoundedIcon/>,
    warning: <WarningRoundedIcon/>,
    map: <LocationOnRoundedIcon/>,
    mediation: <MediationIcon/>,
    chart: <InsertChartIcon/>,
    grid: <GridViewRoundedIcon/>,
    video: <VideocamRoundedIcon/>,
    table: <TableRowsRoundedIcon/>,
    globe: <PublicRoundedIcon/>,
    star: <StarRoundedIcon/>,
    bolt: <BoltRoundedIcon/>,
    shield: <ShieldRoundedIcon/>,
    lane: <DirectionsCarRoundedIcon/>,
    health: <HealthAndSafetyRoundedIcon/>,
    report: <SummarizeRoundedIcon/>,
    transfer: <QrCodeScannerRoundedIcon/>,
};

export function getPageIcon(iconKey: string | undefined): React.ReactNode {
    return PAGE_ICONS[iconKey ?? ''] ?? <GridViewRoundedIcon/>;
}
