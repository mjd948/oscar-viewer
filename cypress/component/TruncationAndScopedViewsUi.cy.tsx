import React, {useRef} from "react";
import DailyFileTable from "../../src/app/_components/event-preview/DailyFileTable";
import SavedQueriesPopover from "../../src/app/_components/event-table/SavedQueriesPopover";
import ChartTimeHighlight from "../../src/app/_components/event-preview/ChartTimeHighlight";
import {DataSourceContext} from "../../src/app/contexts/DataSourceContext";
import {LanguageProvider} from "../../src/app/contexts/LanguageContext";
import {buildBoundedResultTimeRange} from "../../src/lib/data/oscar/adjudication/fetchVehicleOcrWindow";
import {createEventFilterGroup} from "../../src/lib/data/oscar/EventFilter";
import {MAX_SAVED_EVENT_QUERIES, SavedEventQueryBookmark} from "../../src/lib/data/oscar/SavedEventQueries";

function MockDataSourceWrapper({
    laneMap,
    children,
}: {
    laneMap: Map<string, any>;
    children: React.ReactNode;
}) {
    const laneMapRef = useRef(laneMap);
    laneMapRef.current = laneMap;
    return (
        <DataSourceContext.Provider
            value={{
                laneMapRef,
                laneMapReady: true,
                readyLaneNames: new Set(laneMap.keys()),
                activeViewKey: null,
                viewError: null,
                availableViews: [],
                totalCatalogLaneCount: laneMap.size,
                setActiveView: () => {},
                scopedHref: (p: string) => p,
                currentSession: null,
                refreshSession: async () => {},
            }}
        >
            {children}
        </DataSourceContext.Provider>
    );
}

describe("truncation indicators and bounded query windows", () => {
    beforeEach(() => {
        localStorage.setItem("language", "en");
    });

    it("bounds historical Vehicle OCR page lookups while keeping page 0 open-ended", () => {
        expect(buildBoundedResultTimeRange("2026-11-01T00:00:00.000Z", null))
            .to.equal("2026-11-01T00:00:00.000Z/..");
        expect(buildBoundedResultTimeRange("2026-11-01T00:00:00.000Z", "2026-11-01T12:00:00.000Z"))
            .to.equal("2026-11-01T00:00:00.000Z/2026-11-01T12:00:00.000Z");
    });

    it("displays a status notice in DailyFileTable only when daily-file messages are truncated", () => {
        const fakeNode: any = {
            id: "node-1",
            address: "oscar.local",
            port: 443,
            oshPathRoot: "/sensorhub",
            isSecure: true,
            getBasicAuthHeader: () => ({}),
        };
        const laneMap = new Map<string, any>([
            [
                "Lane 1",
                {
                    parentNode: fakeNode,
                    laneSystem: {properties: {properties: {uid: "urn:osh:system:lane:lane1"}}},
                    datastreams: [],
                },
            ],
        ]);
        const sampleEvent: any = {
            id: 1,
            laneId: "Lane 1",
            startTime: "2026-11-18T10:00:00.000Z",
            endTime: "2026-11-18T10:10:00.000Z",
        };

        const truncatedFetch: any = async () =>
            new Response(
                JSON.stringify({
                    schemaVersion: 1,
                    laneUid: "urn:osh:system:lane:lane1",
                    startTime: sampleEvent.startTime,
                    endTime: sampleEvent.endTime,
                    truncated: true,
                    items: [{timestamp: "2026-11-18T10:00:01.000Z", message: "GX,100"}],
                }),
                {status: 200, headers: {"Content-Type": "application/json"}},
            );

        cy.mount(
            <LanguageProvider>
                <MockDataSourceWrapper laneMap={laneMap}>
                    <DailyFileTable event={sampleEvent} fetchImpl={truncatedFetch} />
                </MockDataSourceWrapper>
            </LanguageProvider>,
        );
        cy.get('[data-testid="daily-file-truncated-notice"]')
            .should("be.visible")
            .and("have.attr", "role", "status")
            .and("contain.text", "1,000");

        const completeFetch: any = async () =>
            new Response(
                JSON.stringify({
                    schemaVersion: 1,
                    laneUid: "urn:osh:system:lane:lane1",
                    startTime: sampleEvent.startTime,
                    endTime: sampleEvent.endTime,
                    truncated: false,
                    items: [{timestamp: "2026-11-18T10:00:01.000Z", message: "GX,100"}],
                }),
                {status: 200, headers: {"Content-Type": "application/json"}},
            );

        cy.mount(
            <LanguageProvider>
                <MockDataSourceWrapper laneMap={laneMap}>
                    <DailyFileTable event={{...sampleEvent, id: 2}} fetchImpl={completeFetch} />
                </MockDataSourceWrapper>
            </LanguageProvider>,
        );
        cy.contains("GX,100").should("exist");
        cy.get('[data-testid="daily-file-truncated-notice"]').should("not.exist");
    });

    it("displays bookmark count and oldest-replacement notice at 25/25 saved queries", () => {
        const fullBookmarks: SavedEventQueryBookmark[] = Array.from(
            {length: MAX_SAVED_EVENT_QUERIES},
            (_, idx) => ({
                id: `bm-${idx + 1}`,
                name: `Saved Query ${idx + 1}`,
                createdAt: "2026-11-18T00:00:00.000Z",
                criteria: {filter: createEventFilterGroup(), vehicleSearch: null},
            }),
        );
        const anchor = document.createElement("button");
        document.body.appendChild(anchor);

        cy.mount(
            <LanguageProvider>
                <SavedQueriesPopover
                    anchorEl={anchor}
                    hasActiveQuery={true}
                    defaultBookmarkName="New Query"
                    bookmarks={fullBookmarks}
                    onClose={() => {}}
                    onApplyBookmark={() => {}}
                    onSaveBookmark={() => {}}
                    onDeleteBookmark={() => {}}
                />
            </LanguageProvider>,
        );
        cy.get('[data-testid="saved-queries-count-badge"]').should("contain.text", "(25/25)");
        cy.get('[data-testid="saved-queries-cap-note"]')
            .should("be.visible")
            .and("contain.text", "25/25");
    });

    it("warns when an extended occupancy exceeds the 1,500-sample event chart buffer", () => {
        const shortEvent: any = {
            id: 10,
            laneId: "Lane 1",
            occupancyCount: "10",
            startTime: "2026-11-18T12:00:00.000Z",
            endTime: "2026-11-18T12:00:15.000Z",
            status: "Gamma",
        };
        const extendedEvent: any = {
            ...shortEvent,
            id: 11,
            endTime: "2026-11-18T12:10:00.000Z",
        };

        cy.mount(
            <LanguageProvider>
                <ChartTimeHighlight
                    modeType="preview"
                    datasources={{gamma: null as any, neutron: null as any, threshold: null as any}}
                    eventData={shortEvent}
                    latestGB={100}
                    currentTime={null}
                />
            </LanguageProvider>,
        );
        cy.get('[data-testid="event-chart-sample-cap-notice"]').should("not.exist");

        cy.mount(
            <LanguageProvider>
                <ChartTimeHighlight
                    modeType="preview"
                    datasources={{gamma: null as any, neutron: null as any, threshold: null as any}}
                    eventData={extendedEvent}
                    latestGB={100}
                    currentTime={null}
                />
            </LanguageProvider>,
        );
        cy.get('[data-testid="event-chart-sample-cap-notice"]')
            .should("be.visible")
            .and("contain.text", "1,500");
    });
});
