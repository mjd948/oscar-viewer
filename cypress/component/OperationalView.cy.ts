import {
    buildOperationalViewCatalog,
    getOperationalViewKeys,
    mergeOperationalViewCatalogs,
    parseOperationalView,
    resolveRouteForViewSwitch,
    resolveScopedViewDropdownState,
    systemMatchesOperationalView,
    withOperationalView,
} from "../../src/lib/data/oscar/OperationalView";
import {Node} from "../../src/lib/data/osh/Node";
import {shouldClearUnavailablePreview} from "../../src/lib/data/oscar/PreviewAvailability";
import {resolveReportScope} from "../../src/lib/data/oscar/ReportScope";
import {isNationalControlStream} from "../../src/lib/data/oscar/Utilities";
import {END_DEF, REPORT_DEF, START_DEF} from "../../src/lib/data/Constants";

function geoJsonSystem(id: string, uid: string, name: string) {
    return {
        properties: {
            id,
            properties: {uid, name},
        },
    };
}

describe("operational view scoping", () => {
    const laneSystem = {
        properties: {
            properties: {
                keywords: ["oscar:view:north-gate", "unrelated", "oscar:view:secondary"],
            },
        },
    };

    it("treats an absent view as the unscoped application", () => {
        expect(parseOperationalView("")).to.deep.equal({key: null, error: null});
        expect(systemMatchesOperationalView(laneSystem, null)).to.equal(true);
    });

    it("accepts valid workstation keys and matches SensorML keywords", () => {
        expect(parseOperationalView("?view=north-gate")).to.deep.equal({key: "north-gate", error: null});
        expect(getOperationalViewKeys(laneSystem)).to.deep.equal(["north-gate", "secondary"]);
        expect(systemMatchesOperationalView(laneSystem, "north-gate")).to.equal(true);
        expect(systemMatchesOperationalView(laneSystem, "south-gate")).to.equal(false);
    });

    it("fails closed for empty, uppercase, and malformed keys", () => {
        ["?view=", "?view=North", "?view=-north", "?view=north_1", "?view=north&view=south"].forEach((search) => {
            expect(parseOperationalView(search)).to.deep.equal({key: null, error: "invalid"});
        });
    });

    it("preserves the scope on internal links", () => {
        expect(withOperationalView("/event-details?eventId=42", "north-gate"))
            .to.equal("/event-details?eventId=42&view=north-gate");
        expect(withOperationalView("/event-log", "")).to.equal("/event-log?view=");
        expect(withOperationalView("/event-log", null)).to.equal("/event-log");
    });

    it("clears a persisted preview only after its lane is known to be unavailable", () => {
        const preview = {isOpen: true, eventData: {laneId: "lane37"}};

        expect(shouldClearUnavailablePreview(preview, false, new Set(["lane1", "lane24"])))
            .to.equal(false);
        expect(shouldClearUnavailablePreview(preview, true, new Set(["lane1", "lane24"])))
            .to.equal(true);
        expect(shouldClearUnavailablePreview(
            {isOpen: true, eventData: {laneId: "lane1"}},
            true,
            new Set(["lane1", "lane24"]),
        )).to.equal(false);
    });

    it("loads SensorML keywords before filtering GeoJSON lane systems", async () => {
        const northLane = geoJsonSystem("north-id", "urn:osh:system:lane:lane1", "lane1");
        const southLane = geoJsonSystem("south-id", "urn:osh:system:lane:lane2", "lane2");
        const node: any = Object.create(Node.prototype);

        node.checkForEndpoint = cy.stub().resolves(true);
        node.fetchSystems = cy.stub().resolves([northLane, southLane]);
        node.systemsApi = {
            getSystemById: cy.stub().callsFake((id: string, filter: any) => {
                expect(filter.props.format).to.equal("application/sml+json");
                return Promise.resolve({
                    properties: {
                        keywords: [`oscar:view:${id === "north-id" ? "north-gate" : "south-gate"}`],
                    },
                });
            }),
        };

        const lanes = await node.fetchLaneSystemsAndSubsystems("north-gate");

        expect(node.systemsApi.getSystemById).to.have.been.calledTwice;
        expect(lanes.size).to.equal(1);
        expect(lanes.has("lane1")).to.equal(true);
        expect(lanes.has("lane2")).to.equal(false);
        expect(northLane.properties.properties.keywords).to.deep.equal(["oscar:view:north-gate"]);
    });

    it("builds and caches the report catalog for every operational view", async () => {
        const northLane = geoJsonSystem("north-id", "urn:osh:system:lane:lane1", "Lane 1");
        const sharedLane = geoJsonSystem("shared-id", "urn:osh:system:lane:lane2", "Lane 2");
        const node: any = Object.create(Node.prototype);

        node.fetchSystems = cy.stub().resolves([northLane, sharedLane]);
        node.systemsApi = {
            getSystemById: cy.stub().callsFake((id: string) => Promise.resolve({
                properties: {
                    keywords: id === "north-id"
                        ? ["oscar:view:north-gate"]
                        : ["oscar:view:north-gate", "oscar:view:secondary"],
                },
            })),
        };

        const catalog = await node.fetchOperationalViewCatalog();
        const cachedCatalog = await node.fetchOperationalViewCatalog();

        expect(node.fetchSystems).to.have.been.calledOnce;
        expect(cachedCatalog).to.equal(catalog);
        expect(catalog.lanes.map((lane: any) => lane.uid)).to.deep.equal([
            "urn:osh:system:lane:lane1",
            "urn:osh:system:lane:lane2",
        ]);
        expect(catalog.views.get("north-gate").map((lane: any) => lane.uid)).to.deep.equal([
            "urn:osh:system:lane:lane1",
            "urn:osh:system:lane:lane2",
        ]);
        expect(catalog.views.get("secondary").map((lane: any) => lane.uid)).to.deep.equal([
            "urn:osh:system:lane:lane2",
        ]);
    });

    it("resolves operational-view and explicit-lane report scopes", () => {
        const lane1 = geoJsonSystem("lane-1", "urn:osh:system:lane:lane1", "Lane 1");
        const lane2 = geoJsonSystem("lane-2", "urn:osh:system:lane:lane2", "Lane 2");
        lane1.properties.properties.keywords = ["oscar:view:north-gate"];
        lane2.properties.properties.keywords = ["oscar:view:south-gate"];
        const catalog = buildOperationalViewCatalog([lane1, lane2]);

        expect(resolveReportScope("OPERATIONAL_VIEW", "RDS_SITE", "north-gate", [], catalog))
            .to.deep.equal({laneUIDs: ["urn:osh:system:lane:lane1"], error: null});
        expect(resolveReportScope("LANES", "EVENT", "", ["urn:osh:system:lane:lane2"], catalog))
            .to.deep.equal({laneUIDs: ["urn:osh:system:lane:lane2"], error: null});
        expect(resolveReportScope("NODE", "LANE", "", [], catalog))
            .to.deep.equal({
                laneUIDs: ["urn:osh:system:lane:lane1", "urn:osh:system:lane:lane2"],
                error: null,
            });
        expect(resolveReportScope("NODE", "ADJUDICATION_DETAILS", "", [], catalog))
            .to.deep.equal({
                laneUIDs: ["urn:osh:system:lane:lane1", "urn:osh:system:lane:lane2"],
                error: null,
            });
    });

    it("recognizes statistics controls with the optional lane scope field", () => {
        const controlStream = {
            properties: {
                controlledProperties: [
                    {definition: START_DEF},
                    {definition: END_DEF},
                    {definition: "http://www.opengis.net/def/property/OGC/0/LaneUID"},
                ],
            },
        } as any;

        expect(isNationalControlStream(controlStream)).to.equal(true);

        const reportControl = {
            properties: {
                controlledProperties: [
                    {definition: START_DEF},
                    {definition: END_DEF},
                    {definition: REPORT_DEF},
                ],
            },
        } as any;
        expect(isNationalControlStream(reportControl)).to.equal(false);
    });

    it("does not request SensorML descriptions for the default unscoped view", async () => {
        const lane = geoJsonSystem("lane-id", "urn:osh:system:lane:lane1", "lane1");
        const node: any = Object.create(Node.prototype);

        node.checkForEndpoint = cy.stub().resolves(true);
        node.fetchSystems = cy.stub().resolves([lane]);
        node.systemsApi = {getSystemById: cy.stub().resolves({})};

        const lanes = await node.fetchLaneSystemsAndSubsystems();

        expect(node.systemsApi.getSystemById).not.to.have.been.called;
        expect(lanes.has("lane1")).to.equal(true);
    });

    it("excludes a lane when its SensorML assignment cannot be verified", async () => {
        const lane: any = geoJsonSystem("lane-id", "urn:osh:system:lane:lane1", "lane1");
        const node: any = Object.create(Node.prototype);
        const warn = cy.stub(console, "warn");

        lane.properties.properties.keywords = ["oscar:view:north-gate"];
        node.checkForEndpoint = cy.stub().resolves(true);
        node.fetchSystems = cy.stub().resolves([lane]);
        node.systemsApi = {getSystemById: cy.stub().rejects(new Error("metadata unavailable"))};

        const lanes = await node.fetchLaneSystemsAndSubsystems("north-gate");

        expect(lanes.size).to.equal(0);
        expect(lane.properties.properties.keywords).to.deep.equal([]);
        expect(warn).to.have.been.called;
    });

    it("merges multi-node catalogs and computes RBAC-aware navbar dropdown states", () => {
        const nodeALane1: any = geoJsonSystem("a-1", "urn:osh:system:lane:lane1", "Lane 1");
        const nodeALane2: any = geoJsonSystem("a-2", "urn:osh:system:lane:lane2", "Lane 2");
        nodeALane1.properties.properties.keywords = ["oscar:view:north-gate"];
        nodeALane2.properties.properties.keywords = ["oscar:view:north-gate", "oscar:view:truck-portal"];

        const nodeBLane1: any = geoJsonSystem("b-1", "urn:osh:system:lane:lane1", "Remote Lane 1");
        nodeBLane1.properties.properties.keywords = ["oscar:view:south-gate"];

        const merged = mergeOperationalViewCatalogs([
            buildOperationalViewCatalog([nodeALane1, nodeALane2]),
            buildOperationalViewCatalog([nodeBLane1]),
        ]);

        expect(merged.totalLaneCount).to.equal(3);
        expect(merged.options).to.deep.equal([
            {key: "north-gate", laneCount: 2},
            {key: "south-gate", laneCount: 1},
            {key: "truck-portal", laneCount: 1},
        ]);

        // Hidden when no views are configured and unscoped
        expect(resolveScopedViewDropdownState({
            availableViews: [],
            allowedViews: [],
            activeViewKey: null,
            viewError: null,
        })).to.deep.equal({
            mode: "hidden",
            includeAllLanes: true,
            options: [],
        });

        // Unrestricted user gets All Lanes + all configured views
        expect(resolveScopedViewDropdownState({
            availableViews: merged.options,
            allowedViews: [],
            activeViewKey: "north-gate",
            viewError: null,
        })).to.deep.equal({
            mode: "dropdown",
            includeAllLanes: true,
            options: merged.options,
        });

        // Single-view restricted user gets a non-interactive badge (no All Lanes)
        expect(resolveScopedViewDropdownState({
            availableViews: merged.options,
            allowedViews: ["north-gate"],
            activeViewKey: "north-gate",
            viewError: null,
        })).to.deep.equal({
            mode: "badge",
            includeAllLanes: false,
            options: [{key: "north-gate", laneCount: 2}],
        });

        // Multi-view restricted user gets a dropdown strictly limited to allowedViews (no All Lanes)
        expect(resolveScopedViewDropdownState({
            availableViews: merged.options,
            allowedViews: ["north-gate", "truck-portal"],
            activeViewKey: "north-gate",
            viewError: null,
        })).to.deep.equal({
            mode: "dropdown",
            includeAllLanes: false,
            options: [
                {key: "north-gate", laneCount: 2},
                {key: "truck-portal", laneCount: 1},
            ],
        });
    });

    it("resolves safe route targets when switching scoped views", () => {
        expect(resolveRouteForViewSwitch("/event-log", "?restore=1", "north-gate"))
            .to.equal("/event-log?restore=1&view=north-gate");
        expect(resolveRouteForViewSwitch("/event-log", "?restore=1&view=north-gate", null))
            .to.equal("/event-log?restore=1");
        expect(resolveRouteForViewSwitch("/lane-view", "?view=north-gate", "south-gate"))
            .to.equal("/?view=south-gate");
        expect(resolveRouteForViewSwitch("/event-details", "?eventId=abc&view=north-gate", null))
            .to.equal("/event-log");
    });

    it("invalidates cached operational view catalog so sandbox track switches immediately surface south-gate", async () => {
        const laneNorth: any = geoJsonSystem("lane-1", "urn:osh:system:lane:demo-lane-01", "DemoLane01");
        const laneSouth: any = geoJsonSystem("lane-2", "urn:osh:system:lane:demo-lane-02", "DemoLane02");
        let activeSystems = [laneNorth];

        const node: any = Object.create(Node.prototype);
        node.operationalViewCatalogPromise = null;
        node.fetchSystems = cy.stub().callsFake(async () => activeSystems.map((s) => JSON.parse(JSON.stringify(s))));
        node.systemsApi = {
            getSystemById: cy.stub().callsFake(async (id: string) => ({
                properties: {
                    keywords: id === "lane-2" ? ["oscar:view:south-gate"] : ["oscar:view:north-gate"],
                },
            })),
        };

        // Operator Track: only north-gate is staged initially
        const operatorMerged = mergeOperationalViewCatalogs([await node.fetchOperationalViewCatalog()]);
        expect(operatorMerged.totalLaneCount).to.equal(1);
        expect(operatorMerged.options).to.deep.equal([{key: "north-gate", laneCount: 1}]);

        // Switching to Supervisor Track adds DemoLane02 (south-gate)
        activeSystems = [laneNorth, laneSouth];

        // Without invalidation, memoized promise returns stale Operator catalog
        const cachedMerged = mergeOperationalViewCatalogs([await node.fetchOperationalViewCatalog()]);
        expect(cachedMerged.options).to.deep.equal([{key: "north-gate", laneCount: 1}]);

        // Invalidating (or passing forceRefresh=true on oscar:sandbox-lanes-changed) surfaces south-gate immediately
        node.invalidateOperationalViewCatalog();
        const supervisorMerged = mergeOperationalViewCatalogs([await node.fetchOperationalViewCatalog()]);
        expect(supervisorMerged.totalLaneCount).to.equal(2);
        expect(supervisorMerged.options).to.deep.equal([
            {key: "north-gate", laneCount: 1},
            {key: "south-gate", laneCount: 1},
        ]);
    });
});
