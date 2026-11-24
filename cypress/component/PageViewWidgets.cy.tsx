import React from "react";
import {configureStore} from "@reduxjs/toolkit";
import {Provider} from "react-redux";
import {LanguageProvider} from "../../src/app/contexts/LanguageContext";
import {DataSourceContext} from "../../src/app/contexts/DataSourceContext";
import laneReducer from "../../src/lib/state/OSCARLaneSlice";
import laneViewReducer from "../../src/lib/state/LaneViewSlice";
import eventPreviewReducer from "../../src/lib/state/EventPreviewSlice";
import eventLogReducer from "../../src/lib/state/EventDataSlice";
import eventDetailsReducer from "../../src/lib/state/EventDetailsSlice";
import EventDetailsWidget from "../../src/app/_components/widgets/EventDetailsWidget";
import RS350SpectrumWidget from "../../src/app/_components/widgets/RS350SpectrumWidget";
import StateOfHealthWidget from "../../src/app/_components/widgets/StateOfHealthWidget";
import VideoWidget from "../../src/app/_components/widgets/VideoWidget";
import {PageConfig, WidgetInstance} from "../../src/lib/layout/PageConfigTypes";

function harness(content: React.ReactNode, lanes: Map<string, any> = new Map(), ready: string[] = [...lanes.keys()]) {
    const store = configureStore({
        reducer: {
            laneSlice: laneReducer,
            laneView: laneViewReducer,
            eventPreview: eventPreviewReducer,
            eventLogSlice: eventLogReducer,
            eventDetails: eventDetailsReducer,
        },
    });
    const context = {
        laneMapRef: {current: lanes},
        laneMapReady: true,
        readyLaneNames: new Set(ready),
        activeViewKey: null,
        viewError: null,
        scopedHref: (path: string) => path,
    };
    return (
        <Provider store={store as any}>
            <LanguageProvider>
                <DataSourceContext.Provider value={context as any}>
                    <div style={{width: 640, height: 400}}>{content}</div>
                </DataSourceContext.Provider>
            </LanguageProvider>
        </Provider>
    );
}

const page = (lane?: string): PageConfig => ({
    id: "p", title: "Wall", widgets: [], layouts: {},
    ...(lane ? {laneContext: {mode: "fixed", lane}} : {}),
} as PageConfig);
const spectrum: WidgetInstance = {id: "w", type: "rs350-spectrum", config: {laneSource: {source: "page"}}};
const details: WidgetInstance = {id: "d", type: "event-details", config: {}};
const health: WidgetInstance = {id: "h", type: "state-of-health", config: {}};

describe("widgets for ORNL's remaining views", () => {
    it("event details asks for a selection until a table row is chosen", () => {
        cy.mount(harness(<EventDetailsWidget page={page()} widget={details}/>));
        cy.get('[data-testid="event-details-widget-empty"]')
            .should("contain.text", "Select an event in an alarm or event table");
    });

    it("RS-350 spectra: no lane, lane still loading, and a lane that is not an RS-350", () => {
        cy.mount(harness(<RS350SpectrumWidget page={page()} widget={spectrum}/>));
        cy.contains("No lane selected").should("exist");

        const lanes = new Map<string, any>([["Marshall", {isRS350Backpack: false}]]);
        cy.mount(harness(<RS350SpectrumWidget page={page("Marshall")} widget={spectrum}/>, lanes, []));
        cy.get('[role="progressbar"]').should("exist");

        cy.mount(harness(<RS350SpectrumWidget page={page("Marshall")} widget={spectrum}/>, lanes));
        cy.get('[data-testid="rs350-spectrum-not-rs350"]').should("contain.text", "Marshall is not an RS-350 lane");
    });

    it("state of health keeps ORNL's view but not its page heading", () => {
        cy.mount(harness(<StateOfHealthWidget page={page()} widget={health}/>));
        cy.get('[data-testid="state-of-health-widget"] h1').should("exist").and("not.be.visible");
        cy.get('[data-testid="state-of-health-widget"]').should("contain.text", "Live connection and fault status for eve");
    });

    it("video says there is no video for a camera-less lane instead of starting the player", () => {
        const video: WidgetInstance = {id: "v", type: "video", config: {laneSource: {source: "page"}}};
        const lanes = new Map<string, any>([["Patrol 1", {isRS350Backpack: true, controlStreams: []}]]);
        cy.mount(harness(<VideoWidget page={page("Patrol 1")} widget={video}/>, lanes));
        cy.get('[data-testid="video-widget-no-video"]').should("exist");
        cy.get("video").should("not.exist");
    });
});
