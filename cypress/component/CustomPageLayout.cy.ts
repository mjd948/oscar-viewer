import {migratePages, rehydratePageLayoutState} from "../../src/lib/layout/ConfigValidation";
import {buildPageFromTemplate, PAGE_TEMPLATE_IDS} from "../../src/lib/layout/DefaultPages";
import {
    applyColumnSettings,
    applyFieldOrder,
    resolveEventTableColumns,
    visibilityFromColumnSettings,
} from "../../src/lib/layout/EventTableColumns";
import {DEFAULT_EVENT_TABLE_COLUMNS, PAGE_CONFIG_SCHEMA_VERSION, PageConfig} from "../../src/lib/layout/PageConfigTypes";
import reducer, {addPage, resetPageToDefault} from "../../src/lib/state/PageLayoutSlice";

describe("custom widget pages on ORNL 3.11", () => {
    it("starts with no pages and never re-seeds pages over ORNL's own routes", () => {
        const initial = reducer(undefined, {type: "@@init"});
        expect(initial.pages).to.deep.equal([]);
        const rehydrated = rehydratePageLayoutState({schemaVersion: PAGE_CONFIG_SCHEMA_VERSION, pages: []});
        expect(rehydrated.pages).to.deep.equal([]);
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
        state = {...state, pages: state.pages.map((p) => ({...p, widgets: [], layouts: {}}))};
        state = reducer(state, resetPageToDefault("p1"));
        expect(state.pages[0].title).to.equal("Lane wall");
        expect(state.pages[0].icon).to.equal("star");
        expect(state.pages[0].widgets.length).to.equal(page.widgets.length);
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
