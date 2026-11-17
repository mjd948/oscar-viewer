/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import {
    LayoutItem,
    PageConfig,
    RGL_COLS,
    RGLBreakpoint,
    WIDGET_SIZES,
    WidgetInstance,
    WidgetType,
} from './PageConfigTypes';

function widget(id: string, type: WidgetType, config: WidgetInstance['config']): WidgetInstance {
    return {id, type, config};
}

function item(i: string, type: WidgetType, x: number, y: number, w: number, h: number): LayoutItem {
    const {minSize} = WIDGET_SIZES[type];
    return {i, x, y, w, h, minW: minSize.w, minH: minSize.h};
}

/**
 * Stack widgets vertically full-width for the narrower breakpoints, keeping
 * each widget's lg height.
 */
function stacked(bp: RGLBreakpoint, entries: { i: string; type: WidgetType; h: number }[]): LayoutItem[] {
    const cols = RGL_COLS[bp];
    let y = 0;
    return entries.map((e) => {
        const it = item(e.i, e.type, 0, y, cols, e.h);
        y += e.h;
        return it;
    });
}

/**
 * Page templates reproducing the widget-era layouts of the fixed pages. On ORNL 3.11 the
 * fixed routes stay ORNL's own pages; these only seed new custom pages (Add Page →
 * "Start from"). Deterministic widget ids so a reset rebuilds the same layout.
 */
function buildTemplatePages(): PageConfig[] {
    // --- Dashboard: lane status grid + alarm table, quick view on the right ---
    const dashStatus = widget('dashboard-system-status', 'system-status', {lanes: {mode: 'all'}});
    const dashAlarms = widget('dashboard-alarm-table', 'adjudication-table', {
        columns: [
            {key: 'laneId', visible: true},
            {key: 'occupancyCount', visible: true},
            {key: 'startTime', visible: true},
            {key: 'endTime', visible: true},
            {key: 'maxGamma', visible: true},
            {key: 'maxNeutron', visible: true},
            {key: 'status', visible: true},
            {key: 'adjudicatedIds', visible: true},
            {key: 'adjudicationGroup', visible: true},
            {key: 'secondaryInspection', visible: false},
        ],
        filters: {lanes: {mode: 'all'}, adjudicated: 'any'},
    });
    const dashQuickView = widget('dashboard-quick-view', 'quick-view', {});

    const dashboard: PageConfig = {
        id: 'dashboard',
        title: 'dashboard',
        icon: 'dashboard',
        seededRoute: '/',
        showInNav: true,
        widgets: [dashStatus, dashAlarms, dashQuickView],
        layouts: {
            lg: [
                item(dashStatus.id, 'system-status', 0, 0, 8, 15),
                item(dashAlarms.id, 'adjudication-table', 0, 15, 8, 24),
                item(dashQuickView.id, 'quick-view', 8, 0, 4, 39),
            ],
            md: stacked('md', [
                {i: dashStatus.id, type: 'system-status', h: 15},
                {i: dashAlarms.id, type: 'adjudication-table', h: 24},
                {i: dashQuickView.id, type: 'quick-view', h: 24},
            ]),
            sm: stacked('sm', [
                {i: dashStatus.id, type: 'system-status', h: 15},
                {i: dashAlarms.id, type: 'adjudication-table', h: 24},
                {i: dashQuickView.id, type: 'quick-view', h: 24},
            ]),
        },
    };

    // --- Event Log: single full-width event table ---
    const eventTable = widget('event-log-table', 'event-table', {
        columns: [
            {key: 'laneId', visible: true},
            {key: 'occupancyCount', visible: true},
            {key: 'startTime', visible: true},
            {key: 'endTime', visible: true},
            {key: 'maxGamma', visible: true},
            {key: 'maxNeutron', visible: true},
            {key: 'status', visible: true},
            {key: 'adjudicatedIds', visible: true},
            {key: 'adjudicationGroup', visible: true},
            {key: 'secondaryInspection', visible: true},
        ],
        filters: {lanes: {mode: 'all'}, adjudicated: 'any'},
    });
    const eventLog: PageConfig = {
        id: 'event-log',
        title: 'events',
        icon: 'warning',
        seededRoute: '/event-log/',
        showInNav: true,
        widgets: [eventTable],
        layouts: {
            lg: [item(eventTable.id, 'event-table', 0, 0, 12, 42)],
            md: [item(eventTable.id, 'event-table', 0, 0, 8, 42)],
            sm: [item(eventTable.id, 'event-table', 0, 0, 4, 42)],
        },
    };

    // --- Map: single full-page map ---
    const mapWidget = widget('map-main', 'map', {lanes: {mode: 'all'}});
    const map: PageConfig = {
        id: 'map',
        title: 'map',
        icon: 'map',
        seededRoute: '/map/',
        showInNav: true,
        widgets: [mapWidget],
        layouts: {
            lg: [item(mapWidget.id, 'map', 0, 0, 12, 42)],
            md: [item(mapWidget.id, 'map', 0, 0, 8, 42)],
            sm: [item(mapWidget.id, 'map', 0, 0, 4, 36)],
        },
    };

    // --- National View: stats table with time range controls ---
    const nationalStats = widget('national-view-stats', 'national-stats', {});
    const nationalView: PageConfig = {
        id: 'national-view',
        title: 'national',
        icon: 'mediation',
        seededRoute: '/national-view/',
        showInNav: true,
        widgets: [nationalStats],
        layouts: {
            lg: [item(nationalStats.id, 'national-stats', 0, 0, 12, 42)],
            md: [item(nationalStats.id, 'national-stats', 0, 0, 8, 42)],
            sm: [item(nationalStats.id, 'national-stats', 0, 0, 4, 42)],
        },
    };

    // --- Lane View: status strip, video + gamma/neutron charts, event table ---
    const laneStatus = widget('lane-view-status', 'lane-detail-status', {laneSource: {source: 'page'}});
    const laneVideo = widget('lane-view-video', 'video', {laneSource: {source: 'page'}});
    // ORNL's lane chart draws gamma and neutron together (with its own per-detector toggle), and two
    // of them on one lane do not both receive data, so the template carries one chart.
    const laneChart = widget('lane-view-gamma-chart', 'chart', {laneSource: {source: 'page'}});
    const laneTable = widget('lane-view-status-table', 'status-table', {
        laneSource: {source: 'page'}, defaultView: 'occupancy',
    });
    const laneView: PageConfig = {
        id: 'lane-view',
        title: 'laneView',
        icon: 'lane',
        seededRoute: '/lane-view/',
        showInNav: false,
        laneContext: {mode: 'global'},
        widgets: [laneStatus, laneVideo, laneChart, laneTable],
        layouts: {
            lg: [
                item(laneStatus.id, 'lane-detail-status', 0, 0, 12, 6),
                item(laneVideo.id, 'video', 0, 6, 6, 24),
                item(laneChart.id, 'chart', 6, 6, 6, 24),
                item(laneTable.id, 'status-table', 0, 30, 12, 24),
            ],
            md: stacked('md', [
                {i: laneStatus.id, type: 'lane-detail-status', h: 6},
                {i: laneVideo.id, type: 'video', h: 24},
                {i: laneChart.id, type: 'chart', h: 24},
                {i: laneTable.id, type: 'status-table', h: 24},
            ]),
            sm: stacked('sm', [
                {i: laneStatus.id, type: 'lane-detail-status', h: 6},
                {i: laneVideo.id, type: 'video', h: 18},
                {i: laneChart.id, type: 'chart', h: 24},
                {i: laneTable.id, type: 'status-table', h: 24},
            ]),
        },
    };

    return [dashboard, eventLog, map, nationalView, laneView];
}

/** Template ids offered when creating a page, in display order (i18n key = title). */
export const PAGE_TEMPLATE_IDS = ['dashboard', 'lane-view', 'map', 'national-view', 'event-log'] as const;
export type PageTemplateId = typeof PAGE_TEMPLATE_IDS[number];

/** English titles for the legacy seeded pages, whose title was an i18n key. */
export const LEGACY_SEEDED_TITLES: Record<string, string> = {
    dashboard: 'Dashboard',
    events: 'Events',
    map: 'Map',
    national: 'National',
    laneView: 'Lane view',
};

/** A template's layout as a new custom page with the given id/title/icon. */
export function buildPageFromTemplate(templateId: string, page: {id: string; title: string; icon?: string}): PageConfig | undefined {
    const template = buildTemplatePages().find((p) => p.id === templateId);
    if (!template) return undefined;
    const {seededRoute: _route, ...rest} = template;
    return {...rest, id: page.id, title: page.title, icon: page.icon ?? template.icon, showInNav: true, templateId};
}

/** The template's own title (an i18n key). */
export function templateTitleKey(templateId: string): string | undefined {
    return buildTemplatePages().find((p) => p.id === templateId)?.title;
}
