/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import {buildPageFromTemplate} from "./DefaultPages";
import {MainPagesMode, PageConfig} from "./PageConfigTypes";

/**
 * ORNL's main sidebar routes and the built-in editable widget page that replaces each one while
 * "Editable main pages" is on. Lane View has two: RS-350 lanes get the spectra layout, as ORNL's
 * own Lane View swaps in its RS-350 view for them.
 */
export interface MainPageSpec {
    id: string;
    route: string;
    templateId: string;
    /** i18n key; also stored as the page title. */
    titleKey: string;
    icon: string;
    /** Lane View variant for RS-350 lanes. */
    rs350?: boolean;
}

export const MAIN_PAGES: MainPageSpec[] = [
    {id: 'main-dashboard', route: '/', templateId: 'dashboard', titleKey: 'dashboard', icon: 'dashboard'},
    {id: 'main-event-log', route: '/event-log', templateId: 'event-log', titleKey: 'events', icon: 'warning'},
    {id: 'main-health', route: '/health', templateId: 'state-of-health', titleKey: 'stateOfHealth', icon: 'health'},
    {id: 'main-map', route: '/map', templateId: 'map', titleKey: 'map', icon: 'map'},
    {id: 'main-national', route: '/national-view', templateId: 'national-view', titleKey: 'national', icon: 'mediation'},
    {id: 'main-report', route: '/report', templateId: 'report-generator', titleKey: 'reportGenerator', icon: 'report'},
    {id: 'main-alarm-transfer', route: '/alarm-transfer', templateId: 'alarm-transfer', titleKey: 'alarmTransfer', icon: 'transfer'},
    {id: 'main-lane-view', route: '/lane-view', templateId: 'lane-view', titleKey: 'laneView', icon: 'lane'},
    {id: 'main-rs350-lane-view', route: '/lane-view', templateId: 'rs350-lane-view', titleKey: 'laneView', icon: 'lane', rs350: true},
];

export const DEFAULT_MAIN_PAGES_MODE: MainPagesMode = 'widget';

/** '/health/' and '/health' are the same route; '/' stays '/'. */
export function normalizeRoute(pathname: string | null | undefined): string {
    const path = (pathname || '/').split(/[?#]/)[0];
    return path.length > 1 ? path.replace(/\/+$/, '') : '/';
}

export function mainPageSpec(pageId: string | null | undefined): MainPageSpec | undefined {
    return MAIN_PAGES.find((spec) => spec.id === pageId);
}

/** The editable page that replaces an ORNL route, or undefined if the route has none. */
export function mainPageForRoute(pathname: string | null | undefined, rs350Lane = false): MainPageSpec | undefined {
    const route = normalizeRoute(pathname);
    const candidates = MAIN_PAGES.filter((spec) => spec.route === route);
    if (candidates.length <= 1) return candidates[0];
    return candidates.find((spec) => Boolean(spec.rs350) === rs350Lane) ?? candidates[0];
}

export function customPageHref(pageId: string): string {
    return `/custom-page/?id=${encodeURIComponent(pageId)}`;
}

export function buildMainPage(spec: MainPageSpec): PageConfig | undefined {
    const page = buildPageFromTemplate(spec.templateId, {id: spec.id, title: spec.titleKey, icon: spec.icon});
    return page && {...page, mainRoute: spec.route, showInNav: false};
}

/**
 * Add any missing built-in main page (first run, or a release that adds one) and keep the
 * main-page markers on existing ones. User layouts of existing main pages are left alone.
 */
export function ensureMainPages(pages: PageConfig[]): PageConfig[] {
    const byId = new Map(pages.map((p) => [p.id, p]));
    const out = pages.map((p) => {
        const spec = mainPageSpec(p.id);
        return spec ? {...p, mainRoute: spec.route, showInNav: false, title: spec.titleKey} : p;
    });
    for (const spec of MAIN_PAGES) {
        if (byId.has(spec.id)) continue;
        const page = buildMainPage(spec);
        if (page) out.push(page);
    }
    return out;
}

export function isMainPage(page: Pick<PageConfig, 'mainRoute'> | undefined | null): boolean {
    return Boolean(page?.mainRoute);
}
