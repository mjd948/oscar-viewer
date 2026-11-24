import {migratePages, rehydratePageLayoutState} from "../../src/lib/layout/ConfigValidation";
import {buildPageFromTemplate, PAGE_TEMPLATE_IDS} from "../../src/lib/layout/DefaultPages";
import {
    applyColumnSettings,
    applyFieldOrder,
    resolveEventTableColumns,
    visibilityFromColumnSettings,
} from "../../src/lib/layout/EventTableColumns";
import {
    buildDefaultWidgetConfig,
    DEFAULT_EVENT_TABLE_COLUMNS,
    KNOWN_WIDGET_TYPES,
    PAGE_CONFIG_SCHEMA_VERSION,
    PageConfig,
    WidgetType,
} from "../../src/lib/layout/PageConfigTypes";
import reducer, {addPage, importPages, removePage, renamePage, resetPageToDefault} from "../../src/lib/state/PageLayoutSlice";
import {
    claimMainRoute,
    dashboardHref,
    MAIN_PAGES,
    navTestId,
    pageForRoute,
    pageTitle,
    slugify,
} from "../../src/lib/layout/MainPages";

const MAIN_IDS = MAIN_PAGES.map((m) => m.id);
const LANE_VIEW_IDS = ["main-lane-view", "main-rs350-lane-view"];
const reload = (state: unknown) => rehydratePageLayoutState(JSON.parse(JSON.stringify(state)));

describe("custom widget pages on ORNL 3.11", () => {
    it("starts with the built-in dashboards in the sidebar list (Lane Views reached by a lane click)", () => {
        const initial = reducer(undefined, {type: "@@init"});
        expect(initial.pages.map((p) => p.id)).to.deep.equal(MAIN_IDS);
        expect(initial).not.to.have.property("mainPagesMode");
        initial.pages.forEach((p) => {
            expect(p.mainRoute, p.id).to.be.a("string");
            expect(p.i18nTitle, p.id).to.equal(true);
            expect(p.slug, p.id).to.be.a("string");
            expect(p.showInNav, p.id).to.equal(!LANE_VIEW_IDS.includes(p.id));
            expect(p.widgets.length, p.id).to.be.greaterThan(0);
        });
        expect(initial.pages.map((p) => p.slug)).to.deep.equal([
            "dashboard", "events", "state-of-health", "map", "national", "report-generator", "alarm-transfer",
            "lane-view", "rs350-lane-view",
        ]);
        // The training coach spotlights the built-ins by their old menu test ids.
        expect(navTestId(initial.pages[0])).to.equal("nav-item-dashboard");
        expect(navTestId(initial.pages[2])).to.equal("nav-item-health");
        const rehydrated = rehydratePageLayoutState({schemaVersion: PAGE_CONFIG_SCHEMA_VERSION, pages: []});
        expect(rehydrated.pages.map((p) => p.id)).to.deep.equal(MAIN_IDS);
    });

    it("opens ORNL's main routes on the dashboard that holds them", () => {
        const {pages} = reducer(undefined, {type: "@@init"});
        expect(pageForRoute(pages, "/")?.id).to.equal("main-dashboard");
        expect(pageForRoute(pages, "/health/")?.id).to.equal("main-health");
        expect(pageForRoute(pages, "/event-log")?.id).to.equal("main-event-log");
        expect(pageForRoute(pages, "/lane-view")?.id).to.equal("main-lane-view");
        expect(pageForRoute(pages, "/lane-view/", true)?.id).to.equal("main-rs350-lane-view");
        expect(pageForRoute(pages, "/event-details")).to.equal(undefined);
        expect(pageForRoute(pages, "/users")).to.equal(undefined);
        expect(pageForRoute(pages, "/dashboard/")).to.equal(undefined);
        expect(dashboardHref(pages[2])).to.equal("/dashboard/?name=state-of-health");
    });

    it("deletes a built-in for good; its route goes back to ORNL until a page from its layout claims it", () => {
        let state = reducer(undefined, removePage("main-event-log"));
        state = reducer(state, removePage("main-rs350-lane-view"));
        state = reducer(state, removePage("main-dashboard"));
        expect(state.pages.map((p) => p.id)).not.to.include.members(["main-event-log", "main-dashboard"]);
        expect(state.removedSeededPageIds).to.deep.equal(["main-event-log", "main-rs350-lane-view", "main-dashboard"]);
        // ORNL's page renders for a route without a dashboard; home falls back to the first sidebar dashboard.
        expect(pageForRoute(state.pages, "/event-log")).to.equal(undefined);
        expect(pageForRoute(state.pages, "/lane-view", true)).to.equal(undefined);
        expect(pageForRoute(state.pages, "/lane-view", false)?.id).to.equal("main-lane-view");
        expect(pageForRoute(state.pages, "/")?.id).to.equal("main-health");

        // Stays deleted across a reload and a replace-all import.
        state = reload(state);
        expect(state.pages.some((p) => p.id === "main-event-log")).to.equal(false);
        const mine = buildPageFromTemplate("map", {id: "mine", title: "My map"})!;
        state = reducer(state, importPages({pages: [mine], mode: "replace-all"}));
        expect(state.pages.some((p) => p.id === "main-event-log")).to.equal(false);
        expect(state.pages.some((p) => p.id === "main-map")).to.equal(true);

        // A dashboard made from "Events layout" takes notifications back; a second one does not.
        const events = buildPageFromTemplate("event-log", {id: "ev", title: "Alarms"})!;
        state = reducer(state, addPage(events));
        expect(state.pages.find((p) => p.id === "ev")?.mainRoute).to.equal("/event-log");
        expect(pageForRoute(state.pages, "/event-log")?.id).to.equal("ev");
        const second = buildPageFromTemplate("event-log", {id: "ev2", title: "More alarms"})!;
        expect(claimMainRoute(state.pages, second).mainRoute).to.equal(undefined);
        // A map layout while the built-in Map exists claims nothing.
        expect(state.pages.find((p) => p.id === "mine")?.mainRoute).to.equal(undefined);
    });

    it("renames any dashboard: a literal name and a new unique URL name", () => {
        let state = reducer(undefined, {type: "@@init"});
        const t = (key: string) => `T(${key})`;
        expect(pageTitle(state.pages.find((p) => p.id === "main-map")!, t)).to.equal("T(map)");
        state = reducer(state, renamePage({pageId: "main-map", title: "Gate Ops"}));
        let map = state.pages.find((p) => p.id === "main-map")!;
        expect(map.i18nTitle).to.equal(undefined);
        expect(pageTitle(map, t)).to.equal("Gate Ops");
        expect(map.slug).to.equal("gate-ops");
        expect(map.mainRoute).to.equal("/map");
        state = reducer(state, renamePage({pageId: "main-national", title: "gate ops!"}));
        expect(state.pages.find((p) => p.id === "main-national")?.slug).to.equal("gate-ops-2");
        state = reload(state);
        map = state.pages.find((p) => p.id === "main-map")!;
        expect(map.title).to.equal("Gate Ops");
        expect(map.slug).to.equal("gate-ops");
        expect(slugify("Πύλη Βορράς")).to.equal("πύλη-βορράς");
        expect(slugify("Contrôle d'accès")).to.equal("contrôle-d-accès");
        expect(slugify("???")).to.equal("dashboard");
        // A new page with a taken name gets the next free one.
        state = reducer(state, addPage({id: "p-x", title: "Map", widgets: [], layouts: {}, showInNav: true}));
        state = reducer(state, addPage({id: "p-y", title: "Map", widgets: [], layouts: {}, showInNav: true}));
        expect(state.pages.find((p) => p.id === "p-x")?.slug).to.equal("map");
        expect(state.pages.find((p) => p.id === "p-y")?.slug).to.equal("map-2");
    });

    it("moves a live 3.11 state (schema 3) to v4: built-ins first and listed, ORNL switch dropped", () => {
        const initial = reducer(undefined, {type: "@@init"});
        const v3Main = (id: string) => {
            const p = initial.pages.find((m) => m.id === id)!;
            const {i18nTitle: _i, slug: _s, ...rest} = p;
            return {...rest, showInNav: false};
        };
        const ops = {...buildPageFromTemplate("dashboard", {id: "page-ops", title: "Ops wall"})!, showInNav: true};
        const named = {...buildPageFromTemplate("map", {id: "page-map", title: "Dashboard"})!, showInNav: true};
        const live = {
            schemaVersion: 3,
            pages: [ops, named, ...MAIN_IDS.map(v3Main)],
            removedSeededPageIds: ["main-map"],
            editModePageId: null,
            mainPagesMode: "ornl",
        };
        const state = reload(live);
        expect(state).not.to.have.property("mainPagesMode");
        expect(state.schemaVersion).to.equal(PAGE_CONFIG_SCHEMA_VERSION);
        expect(state.pages.map((p) => p.id)).to.deep.equal([...MAIN_IDS, "page-ops", "page-map"]);
        // Before v4 nothing could be deleted; the unused field is not trusted.
        expect(state.removedSeededPageIds).to.deep.equal([]);
        const health = state.pages.find((p) => p.id === "main-health")!;
        expect(health.showInNav).to.equal(true);
        expect(health.i18nTitle).to.equal(true);
        expect(health.slug).to.equal("state-of-health");
        expect(state.pages.find((p) => p.id === "main-lane-view")?.showInNav).to.equal(false);
        expect(state.pages.find((p) => p.id === "page-ops")?.slug).to.equal("ops-wall");
        // The built-in Dashboard keeps "dashboard"; the user's page named Dashboard gets the next one.
        expect(state.pages.find((p) => p.id === "page-map")?.slug).to.equal("dashboard-2");
    });

    it("Reset to default keeps the name, URL, route and sidebar listing", () => {
        let state = reducer(undefined, renamePage({pageId: "main-map", title: "Yard"}));
        state = {...state, pages: state.pages.map((p) => p.id === "main-map" ? {...p, widgets: [], layouts: {}} : p)};
        state = reducer(state, resetPageToDefault("main-map"));
        const map = state.pages.find((p) => p.id === "main-map")!;
        expect(map.mainRoute).to.equal("/map");
        expect(map.showInNav).to.equal(true);
        expect(map.title).to.equal("Yard");
        expect(map.slug).to.equal("yard");
        expect(map.widgets.length).to.be.greaterThan(0);
        state = reducer(state, resetPageToDefault("main-lane-view"));
        expect(state.pages.find((p) => p.id === "main-lane-view")?.showInNav).to.equal(false);
        expect(state.pages.find((p) => p.id === "main-lane-view")?.i18nTitle).to.equal(true);
    });

    it("turns a legacy seeded page (schema 2) into an ordinary custom page", () => {
        const legacy = {
            ...buildPageFromTemplate("dashboard", {id: "dashboard", title: "dashboard"})!,
            seededRoute: "/",
            templateId: undefined,
        } as PageConfig;
        const [page] = migratePages([legacy], 2);
        expect(page.seededRoute).to.equal(undefined);
        expect(page.title).to.equal("Dashboard");
        expect(page.templateId).to.equal("dashboard");
        expect(page.showInNav).to.equal(true);
        expect(page.widgets.map((w) => w.type)).to.deep.equal(["system-status", "adjudication-table", "quick-view"]);
    });

    it("builds every template and resets a page back to its template layout", () => {
        PAGE_TEMPLATE_IDS.forEach((id) => {
            const page = buildPageFromTemplate(id, {id: `p-${id}`, title: id});
            expect(page, id).to.exist;
            expect(page!.seededRoute, id).to.equal(undefined);
            expect(page!.widgets.length, id).to.be.greaterThan(0);
        });

        const page = buildPageFromTemplate("lane-view", {id: "p1", title: "Lane wall", icon: "star"})!;
        let state = reducer(undefined, addPage(page));
        state = {...state, pages: state.pages.map((p) => p.id === "p1" ? {...p, widgets: [], layouts: {}} : p)};
        state = reducer(state, resetPageToDefault("p1"));
        const reset = state.pages.find((p) => p.id === "p1")!;
        expect(reset.title).to.equal("Lane wall");
        expect(reset.icon).to.equal("star");
        expect(reset.widgets.length).to.equal(page.widgets.length);
    });

    it("offers a template for every ORNL view and keeps every template valid", () => {
        const expected: Record<string, string[]> = {
            "event-log": ["event-lookup", "event-table"],
            "state-of-health": ["state-of-health"],
            "report-generator": ["report-generator"],
            "alarm-transfer": ["alarm-transfer"],
        };
        Object.entries(expected).forEach(([id, types]) => {
            const page = buildPageFromTemplate(id, {id: `p-${id}`, title: id})!;
            expect(page.widgets.map((w) => w.type), id).to.deep.equal(types);
        });
        // Validation drops a whole page with an unknown widget type: every template must survive it.
        const pages = PAGE_TEMPLATE_IDS.map((id) => buildPageFromTemplate(id, {id: `v-${id}`, title: id})!);
        const rehydrated = rehydratePageLayoutState({schemaVersion: PAGE_CONFIG_SCHEMA_VERSION, pages});
        expect(rehydrated.pages.map((p) => p.id)).to.include.members(pages.map((p) => p.id));
        ["state-of-health", "report-generator", "alarm-transfer", "event-details", "event-lookup", "rs350-spectrum"]
            .forEach((type) => {
                expect(KNOWN_WIDGET_TYPES, type).to.include(type);
                expect(buildDefaultWidgetConfig(type as WidgetType), type).to.exist;
            });
    });

    it("resolves saved event-table columns against ORNL's columns", () => {
        const saved = [
            {key: "status", visible: true, width: 140},
            {key: "adjudicationGroup", visible: true},   // pre-3.11 column, gone
            {key: "laneId", visible: false},
        ] as any;
        const resolved = resolveEventTableColumns(saved);
        expect(resolved.map((c) => c.key).slice(0, 2)).to.deep.equal(["status", "laneId"]);
        expect(resolved.some((c) => (c.key as string) === "adjudicationGroup")).to.equal(false);
        expect(resolved).to.have.length(DEFAULT_EVENT_TABLE_COLUMNS.length);
        expect(visibilityFromColumnSettings(saved).laneId).to.equal(false);

        const columns = [
            {field: "laneId", flex: 1}, {field: "status", flex: 1}, {field: "maxGamma", flex: 1}, {field: "Menu", width: 40},
        ];
        const applied = applyColumnSettings(columns, resolved);
        expect(applied.map((c) => c.field)).to.deep.equal(["status", "laneId", "maxGamma", "Menu"]);
        expect(applied[0]).to.include({width: 140});
        expect(applied[0].flex).to.equal(undefined);
        expect(applied[1].flex).to.equal(1);
    });

    it("folds a grid drag back into the saved column order", () => {
        const resolved = resolveEventTableColumns();
        const gridOrder = ["__check__", "startTime", "laneId", "occupancyCount", "endTime"];
        const next = applyFieldOrder(resolved, gridOrder).map((c) => c.key);
        expect(next.slice(0, 4)).to.deep.equal(["startTime", "laneId", "occupancyCount", "endTime"]);
        expect(next).to.have.length(resolved.length);
    });
});
