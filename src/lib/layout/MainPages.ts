/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import {buildPageFromTemplate} from "./DefaultPages";
import {PageConfig} from "./PageConfigTypes";

/**
 * The built-in dashboards, one for each of ORNL's main routes. ORNL's own links to a route (a
 * lane click opens '/lane-view', an alarm notification '/event-log', ...) open the dashboard that
 * holds it (`mainRoute`). They are ordinary dashboards otherwise: renamable and deletable. A
 * deleted one gives its route back to ORNL's original page until a dashboard built from the same
 * layout takes it over (claimMainRoute). Lane View has two: RS-350 lanes get the spectra layout,
 * as ORNL's own Lane View swaps in its RS-350 view for them.
 */
export interface MainPageSpec {
    id: string;
    route: string;
    templateId: string;
    /** i18n key; stored as the page title until the user renames it. */
    titleKey: string;
    icon: string;
    /** URL name. */
    slug: string;
    /** Listed in the sidebar. Lane View is reached by clicking a lane, as in ORNL. */
    showInNav: boolean;
    /** Sidebar test id; the training coach spotlights these. */
    navTestId?: string;
    /** Lane View variant for RS-350 lanes. */
    rs350?: boolean;
}

export const LANE_VIEW_ROUTE = '/lane-view';
const RS350_LANE_VIEW_TEMPLATE = 'rs350-lane-view';

export const MAIN_PAGES: MainPageSpec[] = [
    {id: 'main-dashboard', route: '/', templateId: 'dashboard', titleKey: 'dashboard', icon: 'dashboard', slug: 'dashboard', showInNav: true, navTestId: 'nav-item-dashboard'},
    {id: 'main-event-log', route: '/event-log', templateId: 'event-log', titleKey: 'events', icon: 'warning', slug: 'events', showInNav: true, navTestId: 'nav-item-events'},
    {id: 'main-health', route: '/health', templateId: 'state-of-health', titleKey: 'stateOfHealth', icon: 'health', slug: 'state-of-health', showInNav: true, navTestId: 'nav-item-health'},
    {id: 'main-map', route: '/map', templateId: 'map', titleKey: 'map', icon: 'map', slug: 'map', showInNav: true, navTestId: 'nav-item-map'},
    {id: 'main-national', route: '/national-view', templateId: 'national-view', titleKey: 'national', icon: 'mediation', slug: 'national', showInNav: true, navTestId: 'nav-item-national'},
    {id: 'main-report', route: '/report', templateId: 'report-generator', titleKey: 'reportGenerator', icon: 'report', slug: 'report-generator', showInNav: true, navTestId: 'nav-item-report'},
    {id: 'main-alarm-transfer', route: '/alarm-transfer', templateId: 'alarm-transfer', titleKey: 'alarmTransfer', icon: 'transfer', slug: 'alarm-transfer', showInNav: true, navTestId: 'nav-item-alarm-transfer'},
    {id: 'main-lane-view', route: LANE_VIEW_ROUTE, templateId: 'lane-view', titleKey: 'laneView', icon: 'lane', slug: 'lane-view', showInNav: false},
    {id: 'main-rs350-lane-view', route: LANE_VIEW_ROUTE, templateId: RS350_LANE_VIEW_TEMPLATE, titleKey: 'laneView', icon: 'lane', slug: 'rs350-lane-view', showInNav: false, rs350: true},
];

const MAIN_ROUTES = new Set(MAIN_PAGES.map((spec) => spec.route));

/** '/health/' and '/health' are the same route; '/' stays '/'. */
export function normalizeRoute(pathname: string | null | undefined): string {
    const path = (pathname || '/').split(/[?#]/)[0];
    return path.length > 1 ? path.replace(/\/+$/, '') : '/';
}

export function mainPageSpec(pageId: string | null | undefined): MainPageSpec | undefined {
    return MAIN_PAGES.find((spec) => spec.id === pageId);
}

/** A Lane View page's variant comes from the layout it was built from. */
function isRs350LaneView(page: PageConfig): boolean {
    return page.templateId === RS350_LANE_VIEW_TEMPLATE;
}

/**
 * The dashboard that opens for one of ORNL's main routes, or undefined when none does (the user
 * deleted it), in which case ORNL's own page renders. Home ('/') falls back to the first sidebar
 * dashboard.
 */
export function pageForRoute(pages: PageConfig[], pathname: string | null | undefined, rs350Lane = false): PageConfig | undefined {
    const route = normalizeRoute(pathname);
    if (!MAIN_ROUTES.has(route)) return undefined;
    const bound = pages.filter((p) => p.mainRoute === route);
    if (route === LANE_VIEW_ROUTE) return bound.find((p) => isRs350LaneView(p) === rs350Lane);
    if (route === '/') return bound[0] ?? pages.find((p) => p.showInNav !== false);
    return bound[0];
}

/**
 * A page built from a built-in dashboard's layout takes over that dashboard's route when no page
 * holds it, e.g. a dashboard made from "Events layout" after the built-in Events was deleted.
 */
export function claimMainRoute(pages: PageConfig[], page: PageConfig): PageConfig {
    if (page.mainRoute || !page.templateId) return page;
    const spec = MAIN_PAGES.find((s) => s.templateId === page.templateId);
    if (!spec) return page;
    const taken = pages.some((p) => p.id !== page.id && p.mainRoute === spec.route
        && (spec.route !== LANE_VIEW_ROUTE || isRs350LaneView(p) === Boolean(spec.rs350)));
    return taken ? page : {...page, mainRoute: spec.route};
}

export function buildMainPage(spec: MainPageSpec): PageConfig | undefined {
    const page = buildPageFromTemplate(spec.templateId, {id: spec.id, title: spec.titleKey, icon: spec.icon});
    return page && {...page, mainRoute: spec.route, showInNav: spec.showInNav, i18nTitle: true, slug: spec.slug};
}

/**
 * Add any missing built-in dashboard (first run, or a release that adds one) unless the user
 * deleted it. Existing pages are left exactly as the user left them.
 */
export function ensureMainPages(pages: PageConfig[], removedIds: readonly string[] = []): PageConfig[] {
    const have = new Set(pages.map((p) => p.id));
    const out = [...pages];
    for (const spec of MAIN_PAGES) {
        if (have.has(spec.id) || removedIds.includes(spec.id)) continue;
        const page = buildMainPage(spec);
        if (page) out.push(page);
    }
    return out;
}

/**
 * Schema 4: built-in dashboards join the sidebar's dashboard list (first, in ORNL's menu order)
 * instead of sitting behind ORNL's menu entries, and their names follow the language until
 * renamed. Before 4 their title was always forced to the i18n key.
 */
export function migrateMainPagesToV4(pages: PageConfig[]): PageConfig[] {
    const mains: PageConfig[] = [];
    for (const spec of MAIN_PAGES) {
        const page = pages.find((p) => p.id === spec.id);
        if (!page) continue;
        const i18nTitle = page.title === spec.titleKey;
        mains.push({...page, showInNav: spec.showInNav, i18nTitle, slug: i18nTitle ? spec.slug : page.slug});
    }
    return [...mains, ...pages.filter((p) => !mainPageSpec(p.id))];
}

// --- Names and URLs ---

/** The name to show: built-in dashboards follow the language until renamed. */
export function pageTitle(page: Pick<PageConfig, 'title' | 'i18nTitle'>, t: (key: string) => string): string {
    return page.i18nTitle ? t(page.title) : page.title;
}

// Built at runtime: the es6 compile target rejects \p{...} in a regex literal.
const NON_WORD = new RegExp('[^\\p{L}\\p{N}]+', 'gu');

/** URL name for a title: lower case, words joined by '-', any script (el/es/fr names too). */
export function slugify(title: string): string {
    const slug = title.normalize('NFKC').toLowerCase().replace(NON_WORD, '-').replace(/^-+|-+$/g, '');
    return slug || 'dashboard';
}

function baseSlug(page: PageConfig): string {
    const spec = page.i18nTitle ? mainPageSpec(page.id) : undefined;
    return spec ? spec.slug : slugify(page.title);
}

function freeSlug(base: string, taken: Set<string>): string {
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(`${base}-${n}`)) n++;
    return `${base}-${n}`;
}

/** The slug `page` would get now, unique among `pages` (other than itself). */
export function uniqueSlugFor(page: PageConfig, pages: PageConfig[]): string {
    const taken = new Set(pages.filter((p) => p.id !== page.id && p.slug).map((p) => p.slug as string));
    return freeSlug(baseSlug(page), taken);
}

/** Give every page a unique slug; an earlier page keeps its slug on a clash. */
export function withSlugs(pages: PageConfig[]): PageConfig[] {
    const taken = new Set<string>();
    return pages.map((p) => {
        const slug = p.slug && !taken.has(p.slug) ? p.slug : freeSlug(baseSlug(p), taken);
        taken.add(slug);
        return slug === p.slug ? p : {...p, slug};
    });
}

export function findPageBySlug(pages: PageConfig[], slug: string | null | undefined): PageConfig | undefined {
    return slug ? pages.find((p) => p.slug === slug) : undefined;
}

/** `/dashboard/?name=<slug>`: a real static-export file, so a hard reload works without SPA fallback. */
export function dashboardHref(page: Pick<PageConfig, 'id' | 'slug'>): string {
    return page.slug
        ? `/dashboard/?name=${encodeURIComponent(page.slug)}`
        : `/dashboard/?id=${encodeURIComponent(page.id)}`;
}

export function navTestId(page: Pick<PageConfig, 'id' | 'slug'>): string {
    return mainPageSpec(page.id)?.navTestId ?? `nav-page-${page.slug ?? page.id}`;
}
