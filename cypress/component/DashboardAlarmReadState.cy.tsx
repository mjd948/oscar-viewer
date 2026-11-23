import React from "react";
import {configureStore} from "@reduxjs/toolkit";
import {Provider} from "react-redux";
import {AppRouterContext} from "next/dist/shared/lib/app-router-context.shared-runtime";
import {LanguageProvider} from "../../src/app/contexts/LanguageContext";
import {DataSourceContext} from "../../src/app/contexts/DataSourceContext";
import EventTable from "../../src/app/_components/event-table/EventTable";
import AlarmAudio, {getAlarmAudio, resetAlarmAudioForTest} from "../../src/app/_components/AlarmAudio";
import eventDataReducer, {
    requestDashboardAcknowledgeAll,
    setAlarmTrigger,
    setDashboardUnreadAlarmCount,
} from "../../src/lib/state/EventDataSlice";
import oscarClientReducer, {
    setAlarmAudioVolume,
    setContinuousAlarmAudio,
} from "../../src/lib/state/OSCARClientSlice";
import eventPreviewReducer from "../../src/lib/state/EventPreviewSlice";
import {EventTableData} from "../../src/lib/data/oscar/TableHelpers";
import {OCCUPANCY_PILLAR_DEF} from "../../src/lib/data/Constants";
import {
    buildDashboardAlarmReadStateUrl,
    createEventFilterWithRuleForTest,
    DashboardReadStateFetch,
    getDashboardAlarmReadKeys,
    hasRowContentFilter,
    inspectPostWatermarkReadKeys,
    isDashboardAlarmRead,
    MAX_UNREAD_RECONCILIATION_FETCH,
    parseDashboardReadStatePayload,
    UNREAD_COUNT_RECONCILIATION_CAP,
    useDashboardAlarmReadState,
} from "./dashboardReadStateTestHelpers";

describe("Site-shared per-lane Dashboard alarm read state and latching audio", () => {
    beforeEach(() => {
        window.localStorage.clear();
        window.localStorage.setItem("language", "en");
        resetAlarmAudioForTest();
    });

    it("computes dual temporal + observation read keys and distinguishes lane scope from content filters", () => {
        const msgValue = {
            occupancyCount: "104",
            startTime: "2026-11-13T20:00:01.100Z",
            endTime: "2026-11-13T20:00:05.900Z",
            maxGamma: 420,
            maxNeutron: 2,
            gammaAlarm: true,
            neutronAlarm: false,
            adjudicatedIds: [],
            videoPaths: [],
        };
        const liveEvent = new EventTableData(
            1,
            "Lane21",
            msgValue,
            "",
            "foi-lane21",
            "Node-A",
            false,
        );
        const liveKeys = getDashboardAlarmReadKeys(liveEvent);
        expect(liveKeys).to.deep.equal([
            "t:Lane21|104|2026-11-13T20:00:01.100Z|2026-11-13T20:00:05.900Z",
        ]);

        const resolvedEvent = new EventTableData(
            2,
            "Lane21",
            msgValue,
            "obs-uuid-104",
            "foi-lane21",
            "Node-A",
            false,
        );
        const resolvedKeys = getDashboardAlarmReadKeys(resolvedEvent);
        expect(resolvedKeys).to.deep.equal([
            "t:Lane21|104|2026-11-13T20:00:01.100Z|2026-11-13T20:00:05.900Z",
            "o:obs-uuid-104",
        ]);

        const parsedNodeState = parseDashboardReadStatePayload({
            schemaVersion: 1,
            revision: 3,
            updatedAt: "2026-11-13T20:00:10Z",
            lanes: {
                Lane21: {
                    acknowledgedThroughMs: 0,
                    readKeys: liveKeys,
                },
            },
        }, '"rev-3"');
        expect(parsedNodeState).to.not.equal(null);
        // Live event marked read BEFORE occupancyObsId existed remains read AFTER occupancyObsId resolves!
        expect(isDashboardAlarmRead(resolvedEvent, parsedNodeState!.lanes.get("Lane21"))).to.equal(true);

        // Live event marked read with .100Z/.900Z also matches REST-reloaded .1Z/.9Z trimmed timestamps!
        const trimmedRestEvent = new EventTableData(
            3,
            "Lane21",
            {...msgValue, startTime: "2026-11-13T20:00:01.1Z", endTime: "2026-11-13T20:00:05.9Z"},
            "",
            "foi-lane21",
            "Node-A",
            false,
        );
        expect(isDashboardAlarmRead(trimmedRestEvent, parsedNodeState!.lanes.get("Lane21"))).to.equal(true);

        expect(hasRowContentFilter(createEventFilterWithRuleForTest("laneId", "equals", "Lane21"))).to.equal(false);
        expect(hasRowContentFilter(createEventFilterWithRuleForTest("node", "equals", "Node-A"))).to.equal(false);
        expect(hasRowContentFilter(createEventFilterWithRuleForTest("status", "isAnyOf", ["Gamma"]))).to.equal(true);

        const defaultUrl = buildDashboardAlarmReadStateUrl({
            id: "node-default",
            address: "localhost",
            port: 8282,
            isSecure: false,
            isDefaultNode: true,
            oshPathRoot: "/sensorhub",
            bucketsEndpoint: "/buckets",
            getBasicAuthHeader: () => ({}),
        }, 7);
        expect(defaultUrl).to.equal("/sensorhub/buckets/adjudication/dashboard-read-state?sinceRevision=7");
    });

    it("isolates Acknowledge All to north-gate lanes while keeping south-gate lanes unread across browsers", () => {
        const serverLanes: Record<string, {acknowledgedThroughMs: number; readKeys: string[]}> = {};
        let serverRevision = 0;
        let count304 = 0;

        const mockServerFetch: DashboardReadStateFetch = async (input, init) => {
            const url = String(input);
            const method = (init?.method ?? "GET").toUpperCase();
            const headers = (init?.headers ?? {}) as Record<string, string>;

            if (method === "GET") {
                const currentEtag = `"rev-${serverRevision}"`;
                if (
                    headers["If-None-Match"] === currentEtag
                    || url.includes(`sinceRevision=${serverRevision}`)
                ) {
                    count304 += 1;
                    return new Response(null, {status: 304, headers: {ETag: currentEtag}});
                }
                return new Response(JSON.stringify({
                    schemaVersion: 1,
                    revision: serverRevision,
                    updatedAt: "2026-11-13T20:05:00Z",
                    lanes: serverLanes,
                }), {
                    status: 200,
                    headers: {ETag: currentEtag, "Content-Type": "application/json"},
                });
            }

            const body = JSON.parse(String(init?.body ?? "{}"));
            for (const [laneId, update] of Object.entries<any>(body.lanes ?? {})) {
                const prev = serverLanes[laneId] ?? {acknowledgedThroughMs: 0, readKeys: []};
                if (update.acknowledgeAll) {
                    prev.acknowledgedThroughMs = Math.max(
                        prev.acknowledgedThroughMs,
                        update.acknowledgedThroughMs ?? Date.now(),
                    );
                    prev.readKeys = [];
                }
                if (Array.isArray(update.readKeys)) {
                    prev.readKeys = Array.from(new Set([...prev.readKeys, ...update.readKeys]));
                }
                serverLanes[laneId] = prev;
            }
            serverRevision += 1;
            return new Response(JSON.stringify({
                schemaVersion: 1,
                revision: serverRevision,
                updatedAt: "2026-11-13T20:05:01Z",
                lanes: serverLanes,
            }), {
                status: 200,
                headers: {ETag: `"rev-${serverRevision}"`, "Content-Type": "application/json"},
            });
        };

        const sharedNode: any = {
            id: "node-site-1",
            address: "127.0.0.1",
            port: 8282,
            isSecure: false,
            isDefaultNode: true,
            oshPathRoot: "/sensorhub",
            bucketsEndpoint: "/buckets",
            getBasicAuthHeader: () => ({}),
        };

        const northAlarm = new EventTableData(
            1,
            "Lane21",
            {
                occupancyCount: "1",
                startTime: "2026-11-13T20:01:00Z",
                endTime: "2026-11-13T20:01:04Z",
                maxGamma: 500,
                maxNeutron: 0,
                gammaAlarm: true,
                neutronAlarm: false,
                adjudicatedIds: [],
                videoPaths: [],
            },
            "obs-north-1",
            "foi-lane21",
            "Site-1",
            false,
        );
        const southAlarm = new EventTableData(
            2,
            "Lane31",
            {
                occupancyCount: "2",
                startTime: "2026-11-13T20:01:00Z",
                endTime: "2026-11-13T20:01:04Z",
                maxGamma: 0,
                maxNeutron: 12,
                gammaAlarm: false,
                neutronAlarm: true,
                adjudicatedIds: [],
                videoPaths: [],
            },
            "obs-south-1",
            "foi-lane31",
            "Site-1",
            false,
        );

        function DualWorkstationProbe() {
            const workstationA = useDashboardAlarmReadState([sharedNode], true, mockServerFetch);
            const workstationB = useDashboardAlarmReadState([sharedNode], true, mockServerFetch);
            return (
                <div>
                    <span data-testid="wsA-north">{String(workstationA.isEventRead(northAlarm, sharedNode.id))}</span>
                    <span data-testid="wsA-south">{String(workstationA.isEventRead(southAlarm, sharedNode.id))}</span>
                    <span data-testid="wsB-north">{String(workstationB.isEventRead(northAlarm, sharedNode.id))}</span>
                    <span data-testid="wsB-south">{String(workstationB.isEventRead(southAlarm, sharedNode.id))}</span>
                    <button
                        type="button"
                        data-testid="ack-north"
                        onClick={() => workstationA.acknowledgeLanes([
                            {nodeId: sharedNode.id, laneId: "Lane21", acknowledgedThroughMs: Date.parse("2026-11-13T20:02:00Z")},
                        ])}
                    >
                        Ack North
                    </button>
                    <button
                        type="button"
                        data-testid="refresh-wsB"
                        onClick={() => void workstationB.refreshReadState()}
                    >
                        Refresh B
                    </button>
                </div>
            );
        }

        cy.mount(<DualWorkstationProbe />);
        cy.get('[data-testid="wsA-north"]').should("have.text", "false");
        cy.get('[data-testid="wsB-north"]').should("have.text", "false");
        cy.get('[data-testid="wsB-south"]').should("have.text", "false");

        cy.get('[data-testid="ack-north"]').click();
        cy.get('[data-testid="wsA-north"]').should("have.text", "true");
        cy.get('[data-testid="wsA-south"]').should("have.text", "false");

        // Wait >80ms for coalesced POST to flush to server, then refresh Workstation B.
        cy.wait(140);
        cy.get('[data-testid="refresh-wsB"]').click();
        cy.get('[data-testid="wsB-north"]').should("have.text", "true");
        cy.get('[data-testid="wsB-south"]').should("have.text", "false");

        // A second refresh with no new mutations must hit the 304 Not Modified fast-path.
        cy.get('[data-testid="refresh-wsB"]').click();
        cy.then(() => {
            expect(count304).to.be.greaterThan(0);
        });
    });

    it("renders bold unread vs normal read rows only on Dashboard alarmtable and scopes read-state mutations", () => {
        const nowMs = Date.now();
        const obsRows = [
            {
                id: "obs-lane21-1",
                properties: {"datastream@id": "ds-occ-21", "foi@id": "foi-21"},
                result: {
                    occupancyCount: "501",
                    startTime: new Date(nowMs - 60_000).toISOString(),
                    endTime: new Date(nowMs - 55_000).toISOString(),
                    maxGammaBackground: 100,
                    maxGamma: 820,
                    maxNeutron: 1,
                    gammaAlarm: true,
                    neutronAlarm: false,
                    adjudicatedIds: [],
                    videoPaths: [],
                },
            },
            {
                id: "obs-lane21-2",
                properties: {"datastream@id": "ds-occ-21", "foi@id": "foi-21"},
                result: {
                    occupancyCount: "502",
                    startTime: new Date(nowMs - 40_000).toISOString(),
                    endTime: new Date(nowMs - 35_000).toISOString(),
                    maxGammaBackground: 100,
                    maxGamma: 610,
                    maxNeutron: 0,
                    gammaAlarm: true,
                    neutronAlarm: false,
                    adjudicatedIds: [],
                    videoPaths: [],
                },
            },
            {
                id: "obs-lane22-1",
                properties: {"datastream@id": "ds-occ-22", "foi@id": "foi-22"},
                result: {
                    occupancyCount: "601",
                    startTime: new Date(nowMs - 25_000).toISOString(),
                    endTime: new Date(nowMs - 20_000).toISOString(),
                    maxGammaBackground: 100,
                    maxGamma: 110,
                    maxNeutron: 14,
                    gammaAlarm: false,
                    neutronAlarm: true,
                    adjudicatedIds: [],
                    videoPaths: [],
                },
            },
        ];

        cy.window().then(win => {
            const origFetch = win.fetch.bind(win);
            cy.stub(win, "fetch").callsFake((input: RequestInfo | URL, init?: RequestInit) => {
                const url = String(input);
                if (url.includes("/observations/count?")) {
                    const decoded = decodeURIComponent(url);
                    let count = obsRows.length;
                    if (decoded.includes("gammaAlarm=true AND neutronAlarm=true")) count = 0;
                    else if (decoded.includes("gammaAlarm=false AND neutronAlarm=true")) count = 1;
                    else if (decoded.includes("gammaAlarm=true AND neutronAlarm=false")) count = 2;
                    return Promise.resolve(new Response(JSON.stringify({count}), {
                        status: 200,
                        headers: {"Content-Type": "application/json"},
                    }));
                }
                return origFetch(input, init);
            });
        });

        const serverLanes: Record<string, {acknowledgedThroughMs: number; readKeys: string[]}> = {};
        const readStateRequests: Array<{method: string; body?: any}> = [];
        const mockReadStateFetch: DashboardReadStateFetch = async (_input, init) => {
            const method = (init?.method ?? "GET").toUpperCase();
            const parsedBody = init?.body ? JSON.parse(String(init.body)) : undefined;
            readStateRequests.push({method, body: parsedBody});
            if (parsedBody?.lanes) {
                for (const [laneId, update] of Object.entries<any>(parsedBody.lanes)) {
                    const prev = serverLanes[laneId] ?? {acknowledgedThroughMs: 0, readKeys: []};
                    if (update.acknowledgeAll) {
                        prev.acknowledgedThroughMs = Math.max(prev.acknowledgedThroughMs, update.acknowledgedThroughMs ?? Date.now());
                        prev.readKeys = [];
                    }
                    if (Array.isArray(update.readKeys)) {
                        prev.readKeys = Array.from(new Set([...prev.readKeys, ...update.readKeys]));
                    }
                    serverLanes[laneId] = prev;
                }
            }
            return new Response(JSON.stringify({
                schemaVersion: 1,
                revision: readStateRequests.length,
                updatedAt: new Date().toISOString(),
                lanes: serverLanes,
            }), {
                status: 200,
                headers: {ETag: `"rev-${readStateRequests.length}"`, "Content-Type": "application/json"},
            });
        };

        const fakeNode: any = {
            id: "node-alarm-test",
            name: "GateNode",
            address: "127.0.0.1",
            port: 8282,
            isSecure: false,
            isDefaultNode: true,
            oshPathRoot: "/sensorhub",
            bucketsEndpoint: "/buckets",
            getConnectedSystemsEndpoint: () => "https://node.example/sensorhub/api",
            getBasicAuthHeader: () => ({}),
            getObservationsApi: async () => ({
                searchObservations: async (obsFilter: any) => {
                    const filterStr = decodeURIComponent(obsFilter?.props?.filter ?? "");
                    const matched = obsRows.filter(item => {
                        if (filterStr.includes("gammaAlarm=true AND neutronAlarm=true")) return false;
                        if (filterStr.includes("gammaAlarm=false AND neutronAlarm=true")) return item.result.neutronAlarm;
                        if (filterStr.includes("gammaAlarm=true AND neutronAlarm=false")) return item.result.gammaAlarm;
                        if (filterStr.includes("gammaAlarm=false AND neutronAlarm=false")) return false;
                        return true;
                    });
                    return {
                        fetchData: async () => matched,
                    };
                },
            }),
        };

        const makeLane = (laneName: string, streamId: string): any => ({
            laneName,
            parentNode: fakeNode,
            isRS350Backpack: false,
            datastreams: [
                {
                    properties: {
                        id: streamId,
                        "system@id": `sys-${laneName}`,
                        observedProperties: [{definition: OCCUPANCY_PILLAR_DEF}],
                    },
                },
            ],
            datastreamSourceMap: new Map(),
            findDataStreamByObsProperty: () => null,
            lookupSystemIdFromDataStreamId: () => `sys-${laneName}`,
        });

        const laneMap = new Map<string, any>([
            ["Lane21", makeLane("Lane21", "ds-occ-21")],
            ["Lane22", makeLane("Lane22", "ds-occ-22")],
        ]);

        const makeStore = () => configureStore({
            reducer: {
                eventLogSlice: eventDataReducer,
                oscarClientSlice: oscarClientReducer,
                eventPreview: eventPreviewReducer,
            },
            middleware: getDefault => getDefault({serializableCheck: false}),
        });

        const mockRouter: any = {
            push: cy.stub(),
            replace: cy.stub(),
            prefetch: cy.stub(),
            back: cy.stub(),
            forward: cy.stub(),
            refresh: cy.stub(),
        };

        const store = makeStore();
        cy.mount(
            <AppRouterContext.Provider value={mockRouter}>
                <Provider store={store}>
                    <LanguageProvider>
                        <DataSourceContext.Provider value={{
                            laneMapRef: {current: laneMap},
                            activeViewKey: "north-gate",
                            viewError: null,
                            scopedHref: (href: string) => href,
                        } as any}>
                            <EventTable
                                tableMode="alarmtable"
                                laneMap={laneMap}
                                readStateFetch={mockReadStateFetch}
                            />
                        </DataSourceContext.Provider>
                    </LanguageProvider>
                </Provider>
            </AppRouterContext.Provider>,
        );

        // Redundant sub-toolbar horizon banner is absent while quick window presets remain accessible.
        cy.get('[data-testid="dashboard-alarm-window-notice"]').should("not.exist");
        cy.contains("Showing active alarms from the last").should("not.exist");
        cy.get('[data-testid="toolbar-time-window-15d"]')
            .should("be.visible")
            .and("have.attr", "aria-pressed", "true");

        // All 3 rows initially render as unread (.unread-alarm-row, bold 700, unread dot present).
        cy.contains(".MuiDataGrid-row", "501")
            .should("have.class", "unread-alarm-row")
            .find(".alarm-cell-primary")
            .first()
            .should("have.css", "font-weight", "700");
        cy.contains(".MuiDataGrid-row", "501").find(".unread-alarm-dot").should("exist");

        // 1) Clicking a row marks it Read immediately (fontWeight -> 400, dot removed).
        cy.contains(".MuiDataGrid-row", "501").find('[data-field="occupancyCount"]').click();
        cy.contains(".MuiDataGrid-row", "501")
            .should("have.class", "read-alarm-row")
            .find(".alarm-cell-primary")
            .first()
            .should("have.css", "font-weight", "400");
        cy.contains(".MuiDataGrid-row", "501").find(".unread-alarm-dot").should("not.exist");

        // 2) Selecting a second row via checkbox and clicking Acknowledge Selected marks it Read.
        cy.contains(".MuiDataGrid-row", "502").find('input[type="checkbox"]').click();
        cy.get('[data-testid="toolbar-acknowledge-selected"]').click();
        cy.contains(".MuiDataGrid-row", "502").should("have.class", "read-alarm-row");
        cy.get('[data-testid="alarm-acknowledge-status"]').should("contain.text", "1 alarms marked as read.");

        // 3) Clicking Acknowledge All marks remaining Lane22 row Read as well.
        cy.contains(".MuiDataGrid-row", "601").should("have.class", "unread-alarm-row");
        cy.get('[data-testid="toolbar-acknowledge-all"]').click();
        cy.contains(".MuiDataGrid-row", "601").should("have.class", "read-alarm-row");
        cy.then(() => {
            expect(store.getState().eventLogSlice.dashboardUnreadAlarmCount).to.equal(0);
        });

        // 4) Mounting EventTable in eventlog mode shows NO read/unread classes, dots, or acknowledge buttons
        //    and issues zero read-state network calls.
        cy.then(() => {
            const countBeforeEventLog = readStateRequests.length;
            const eventLogStore = makeStore();
            cy.mount(
                <AppRouterContext.Provider value={mockRouter}>
                    <Provider store={eventLogStore}>
                        <LanguageProvider>
                            <DataSourceContext.Provider value={{
                                laneMapRef: {current: laneMap},
                                activeViewKey: null,
                                viewError: null,
                                scopedHref: (href: string) => href,
                            } as any}>
                                <EventTable
                                    tableMode="eventlog"
                                    viewAdjudicated
                                    laneMap={laneMap}
                                    readStateFetch={mockReadStateFetch}
                                />
                            </DataSourceContext.Provider>
                        </LanguageProvider>
                    </Provider>
                </AppRouterContext.Provider>,
            );
            cy.contains(".MuiDataGrid-row", "501")
                .should("not.have.class", "unread-alarm-row")
                .and("not.have.class", "read-alarm-row");
            cy.get(".unread-alarm-dot").should("not.exist");
            cy.get('[data-testid="toolbar-acknowledge-all"]').should("not.exist");
            cy.then(() => {
                expect(readStateRequests.length).to.equal(countBeforeEventLog);
            });
        });
    });

    it("loops alarm audio while unread Dashboard alarms exist in latching mode and silences immediately on acknowledge", () => {
        const store = configureStore({
            reducer: {
                eventLogSlice: eventDataReducer,
                oscarClientSlice: oscarClientReducer,
            },
        });

        const fakeAudio = getAlarmAudio();
        let playCount = 0;
        let pauseCount = 0;
        let isPaused = true;
        Object.defineProperty(fakeAudio, "paused", {
            configurable: true,
            get: () => isPaused,
        });
        cy.stub(fakeAudio, "play").callsFake(async () => {
            playCount += 1;
            isPaused = false;
        });
        cy.stub(fakeAudio, "pause").callsFake(() => {
            pauseCount += 1;
            isPaused = true;
        });

        store.dispatch(setContinuousAlarmAudio(true));

        cy.mount(
            <Provider store={store as any}>
                <LanguageProvider>
                    <div>
                        <button type="button" data-testid="gesture-unlock">Unlock</button>
                        <AlarmAudio />
                    </div>
                </LanguageProvider>
            </Provider>,
        );

        // Unlock browser audio gesture silently; with 0 unread alarms, audio remains paused.
        cy.get('[data-testid="gesture-unlock"]').click();
        cy.then(() => {
            expect(isPaused).to.equal(true);
            expect(fakeAudio.muted).to.equal(false);
        });

        // Arrival of an unread Dashboard alarm starts continuous looping playback.
        cy.then(() => {
            store.dispatch(setDashboardUnreadAlarmCount(2));
        });
        cy.wrap(null).should(() => {
            expect(fakeAudio.loop).to.equal(true);
            expect(isPaused).to.equal(false);
            expect(playCount).to.be.greaterThan(1);
        });

        // Acknowledging all unread alarms immediately pauses playback and clears loop.
        cy.then(() => {
            store.dispatch(requestDashboardAcknowledgeAll());
        });
        cy.wrap(null).should(() => {
            expect(fakeAudio.loop).to.equal(false);
            expect(isPaused).to.equal(true);
            expect(pauseCount).to.be.greaterThan(1);
        });

        // Live portal trigger bridges into loop and also stops immediately on acknowledge.
        cy.then(() => {
            store.dispatch(setAlarmTrigger(true));
        });
        cy.wrap(null).should(() => {
            expect(fakeAudio.loop).to.equal(true);
            expect(isPaused).to.equal(false);
        });
        cy.then(() => {
            store.dispatch(requestDashboardAcknowledgeAll());
        });
        cy.wrap(null).should(() => {
            expect(fakeAudio.loop).to.equal(false);
            expect(isPaused).to.equal(true);
        });
    });

    it("updates active one-shot alarm playback volume immediately and mutes/pauses when dragged to 0 (#49)", () => {
        const store = configureStore({
            reducer: {
                eventLogSlice: eventDataReducer,
                oscarClientSlice: oscarClientReducer,
            },
        });

        const fakeAudio = getAlarmAudio();
        let isPaused = true;
        Object.defineProperty(fakeAudio, "paused", {
            configurable: true,
            get: () => isPaused,
        });
        cy.stub(fakeAudio, "play").callsFake(async () => {
            isPaused = false;
        });
        cy.stub(fakeAudio, "pause").callsFake(() => {
            isPaused = true;
        });

        store.dispatch(setContinuousAlarmAudio(false));
        store.dispatch(setAlarmAudioVolume(60));

        cy.mount(
            <Provider store={store as any}>
                <LanguageProvider>
                    <div>
                        <button type="button" data-testid="gesture-unlock-oneshot">Unlock</button>
                        <AlarmAudio />
                    </div>
                </LanguageProvider>
            </Provider>,
        );

        cy.get('[data-testid="gesture-unlock-oneshot"]').click();
        cy.then(() => {
            expect(isPaused).to.equal(true);
            expect(fakeAudio.muted).to.equal(false);
            expect(fakeAudio.volume).to.be.closeTo(0.6, 0.001);
            // Trigger one-shot alarm; triggerAlarm resets to false immediately while clip continues playing.
            store.dispatch(setAlarmTrigger(true));
        });

        cy.wrap(null).should(() => {
            expect(isPaused).to.equal(false);
            expect(store.getState().eventLogSlice.triggerAlarm).to.equal(false);
            expect(fakeAudio.volume).to.be.closeTo(0.6, 0.001);
        });

        // Adjust volume mid-playback (60 -> 25 -> 85): takes effect immediately without waiting for next trigger.
        cy.then(() => {
            store.dispatch(setAlarmAudioVolume(25));
        });
        cy.wrap(null).should(() => {
            expect(isPaused).to.equal(false);
            expect(fakeAudio.muted).to.equal(false);
            expect(fakeAudio.volume).to.be.closeTo(0.25, 0.001);
        });

        cy.then(() => {
            store.dispatch(setAlarmAudioVolume(85));
        });
        cy.wrap(null).should(() => {
            expect(isPaused).to.equal(false);
            expect(fakeAudio.muted).to.equal(false);
            expect(fakeAudio.volume).to.be.closeTo(0.85, 0.001);
        });

        // Dragging slider to 0 (mute) mid-playback immediately mutes and stops the playing clip.
        cy.then(() => {
            store.dispatch(setAlarmAudioVolume(0));
        });
        cy.wrap(null).should(() => {
            expect(fakeAudio.volume).to.equal(0);
            expect(fakeAudio.muted).to.equal(true);
            expect(isPaused).to.equal(true);
        });

        // Restoring volume above 0 unmutes for future alarms without resuming the already-stopped one-shot clip.
        cy.then(() => {
            store.dispatch(setAlarmAudioVolume(40));
        });
        cy.wrap(null).should(() => {
            expect(fakeAudio.volume).to.be.closeTo(0.4, 0.001);
            expect(fakeAudio.muted).to.equal(false);
            expect(isPaused).to.equal(true);
        });
    });

    it("inspects post-watermark readKeys safely even when custom lane names contain pipes", () => {
        const parsed = parseDashboardReadStatePayload({
            schemaVersion: 1,
            revision: 4,
            updatedAt: "2026-11-13T21:00:00Z",
            lanes: {
                "North|Gate|21": {
                    acknowledgedThroughMs: Date.parse("2026-11-13T20:10:00Z"),
                    readKeys: [
                        "t:North|Gate|21|101|2026-11-13T20:05:00Z|2026-11-13T20:05:04Z",
                        "o:obs-pre-101",
                        "t:North|Gate|21|102|2026-11-13T20:15:00Z|2026-11-13T20:15:04Z",
                        "o:obs-post-102",
                    ],
                },
                "ObsOnlyLane": {
                    acknowledgedThroughMs: 0,
                    readKeys: ["o:legacy-obs-1", "o:legacy-obs-2"],
                },
            },
        });
        expect(parsed).to.not.equal(null);

        const pipeLaneSummary = inspectPostWatermarkReadKeys(parsed!.lanes.get("North|Gate|21"));
        expect(pipeLaneSummary).to.deep.equal({
            hasPostWatermarkKeys: true,
            estimatedCount: 1,
        });

        const futureFloorSummary = inspectPostWatermarkReadKeys(
            parsed!.lanes.get("North|Gate|21"),
            Date.parse("2026-11-13T20:20:00Z"),
        );
        expect(futureFloorSummary).to.deep.equal({
            hasPostWatermarkKeys: false,
            estimatedCount: 0,
        });

        const obsOnlySummary = inspectPostWatermarkReadKeys(parsed!.lanes.get("ObsOnlyLane"));
        expect(obsOnlySummary).to.deep.equal({
            hasPostWatermarkKeys: true,
            estimatedCount: 2,
        });
        expect(UNREAD_COUNT_RECONCILIATION_CAP).to.equal(100);
        expect(MAX_UNREAD_RECONCILIATION_FETCH).to.equal(150);
    });

    it("reports uncapped >15 unread counts, caps >150 post-watermark readKey reconciliation at 100+, and supports Unread Only + cursor stability", () => {
        const nowMs = Date.now();
        const makeObsRows = (total: number) => Array.from({length: total}, (_, idx) => {
            const occ = 1001 + idx;
            const endMs = nowMs - (idx + 1) * 5_000;
            return {
                id: `obs-bulk-${occ}`,
                properties: {"datastream@id": "ds-occ-21", "foi@id": "foi-21"},
                result: {
                    occupancyCount: String(occ),
                    startTime: new Date(endMs - 3_000).toISOString(),
                    endTime: new Date(endMs).toISOString(),
                    maxGammaBackground: 100,
                    maxGamma: 700 + idx,
                    maxNeutron: 0,
                    gammaAlarm: true,
                    neutronAlarm: false,
                    adjudicatedIds: [],
                    videoPaths: [],
                },
            };
        });

        let activeObsRows = makeObsRows(42);
        const matchesMockQuery = (item: any, filterStr: string, phenomenonTimeStr: string): boolean => {
            const endMs = Date.parse(item.result.endTime);
            if (phenomenonTimeStr) {
                const startIso = phenomenonTimeStr.split("/")[0];
                const floorMs = Date.parse(startIso);
                if (Number.isFinite(floorMs) && endMs < floorMs) return false;
            }
            const gtMatch = filterStr.match(/endTime>'([^']+)'/);
            if (gtMatch) {
                const watermarkMs = Date.parse(gtMatch[1]);
                if (Number.isFinite(watermarkMs) && !(endMs > watermarkMs)) return false;
            }
            if (filterStr.includes("gammaAlarm=true AND neutronAlarm=true")) {
                return item.result.gammaAlarm && item.result.neutronAlarm;
            }
            if (filterStr.includes("gammaAlarm=false AND neutronAlarm=true")) {
                return !item.result.gammaAlarm && item.result.neutronAlarm;
            }
            if (filterStr.includes("gammaAlarm=true AND neutronAlarm=false")) {
                return item.result.gammaAlarm && !item.result.neutronAlarm;
            }
            if (filterStr.includes("gammaAlarm=false AND neutronAlarm=false")) {
                return false;
            }
            return true;
        };

        cy.window().then(win => {
            const origFetch = win.fetch.bind(win);
            cy.stub(win, "fetch").callsFake((input: RequestInfo | URL, init?: RequestInit) => {
                const url = String(input);
                if (url.includes("/observations/count?")) {
                    const parsedUrl = new URL(url);
                    const filterStr = parsedUrl.searchParams.get("filter") ?? "";
                    const phenomenonTimeStr = parsedUrl.searchParams.get("phenomenonTime") ?? "";
                    const count = activeObsRows.filter(
                        item => matchesMockQuery(item, filterStr, phenomenonTimeStr),
                    ).length;
                    return Promise.resolve(new Response(JSON.stringify({count}), {
                        status: 200,
                        headers: {"Content-Type": "application/json"},
                    }));
                }
                return origFetch(input, init);
            });
        });

        const serverLanes: Record<string, {acknowledgedThroughMs: number; readKeys: string[]}> = {};
        let revision = 0;
        const mockReadStateFetch: DashboardReadStateFetch = async (_input, init) => {
            const method = (init?.method ?? "GET").toUpperCase();
            if (method === "POST" && init?.body) {
                const parsedBody = JSON.parse(String(init.body));
                for (const [laneId, update] of Object.entries<any>(parsedBody.lanes ?? {})) {
                    const prev = serverLanes[laneId] ?? {acknowledgedThroughMs: 0, readKeys: []};
                    if (update.acknowledgeAll) {
                        prev.acknowledgedThroughMs = Math.max(
                            prev.acknowledgedThroughMs,
                            update.acknowledgedThroughMs ?? Date.now(),
                        );
                        prev.readKeys = [];
                    }
                    if (Array.isArray(update.readKeys)) {
                        prev.readKeys = Array.from(new Set([...prev.readKeys, ...update.readKeys]));
                    }
                    serverLanes[laneId] = prev;
                }
                revision += 1;
            }
            return new Response(JSON.stringify({
                schemaVersion: 1,
                revision,
                updatedAt: new Date().toISOString(),
                lanes: serverLanes,
            }), {
                status: 200,
                headers: {ETag: `"rev-${revision}"`, "Content-Type": "application/json"},
            });
        };

        const fakeNode: any = {
            id: "node-42-test",
            name: "NorthGate",
            address: "127.0.0.1",
            port: 8282,
            isSecure: false,
            isDefaultNode: true,
            oshPathRoot: "/sensorhub",
            bucketsEndpoint: "/buckets",
            getConnectedSystemsEndpoint: () => "https://node.example/sensorhub/api",
            getBasicAuthHeader: () => ({}),
            getObservationsApi: async () => ({
                searchObservations: async (obsFilter: any, limit = 15, offset = 0) => {
                    const filterStr = decodeURIComponent(obsFilter?.props?.filter ?? "");
                    const phenomenonTimeStr = String(obsFilter?.props?.phenomenonTime ?? "");
                    const matched = activeObsRows
                        .filter(item => matchesMockQuery(item, filterStr, phenomenonTimeStr))
                        .slice(offset, offset + limit);
                    return {
                        fetchData: async () => matched,
                    };
                },
            }),
        };

        const laneMap = new Map<string, any>([
            ["Lane21", {
                laneName: "Lane21",
                parentNode: fakeNode,
                isRS350Backpack: false,
                datastreams: [{
                    properties: {
                        id: "ds-occ-21",
                        "system@id": "sys-Lane21",
                        observedProperties: [{definition: OCCUPANCY_PILLAR_DEF}],
                    },
                }],
                datastreamSourceMap: new Map(),
                findDataStreamByObsProperty: () => null,
                lookupSystemIdFromDataStreamId: () => "sys-Lane21",
            }],
        ]);

        const store = configureStore({
            reducer: {
                eventLogSlice: eventDataReducer,
                oscarClientSlice: oscarClientReducer,
                eventPreview: eventPreviewReducer,
            },
            middleware: getDefault => getDefault({serializableCheck: false}),
        });

        const mockRouter: any = {
            push: cy.stub(),
            replace: cy.stub(),
            prefetch: cy.stub(),
            back: cy.stub(),
            forward: cy.stub(),
            refresh: cy.stub(),
        };

        cy.mount(
            <AppRouterContext.Provider value={mockRouter}>
                <Provider store={store}>
                    <LanguageProvider>
                        <DataSourceContext.Provider value={{
                            laneMapRef: {current: laneMap},
                            activeViewKey: null,
                            viewError: null,
                            scopedHref: (href: string) => href,
                        } as any}>
                            <EventTable
                                tableMode="alarmtable"
                                laneMap={laneMap}
                                readStateFetch={mockReadStateFetch}
                            />
                        </DataSourceContext.Provider>
                    </LanguageProvider>
                </Provider>
            </AppRouterContext.Provider>,
        );

        // 1) Initial 42 alarms (> PAGE_SIZE=15) report exact count 42 without capping.
        cy.contains(".MuiDataGrid-row", "1001").should("have.class", "unread-alarm-row");
        cy.wrap(null).should(() => {
            expect(store.getState().eventLogSlice.dashboardUnreadAlarmCount).to.equal(42);
            expect(store.getState().eventLogSlice.dashboardUnreadCountCapped).to.equal(false);
        });

        // 2) Clicking row 1001 marks it read and reconciles unread count to 41 (not 14!).
        cy.contains(".MuiDataGrid-row", "1001").find('[data-field="occupancyCount"]').click();
        cy.contains(".MuiDataGrid-row", "1001").should("have.class", "read-alarm-row");
        cy.wrap(null).should(() => {
            expect(store.getState().eventLogSlice.dashboardUnreadAlarmCount).to.equal(41);
            expect(store.getState().eventLogSlice.dashboardUnreadCountCapped).to.equal(false);
        });

        // 3) Toggling "Unread only" keeps constant label, sets aria-pressed="true",
        //    excludes read row 1001, and fills Page 0 with 15 unread rows (1002..1016).
        cy.get('[data-testid="toolbar-unread-only"]')
            .should("have.attr", "aria-pressed", "false")
            .and("contain.text", "Unread only")
            .click();
        cy.get('[data-testid="toolbar-unread-only"]')
            .should("have.attr", "aria-pressed", "true")
            .and("contain.text", "Unread only");
        cy.contains(".MuiDataGrid-row", "1001").should("not.exist");
        cy.contains(".MuiDataGrid-row", "1002").should("have.class", "unread-alarm-row");
        cy.contains(".MuiDataGrid-row", "1016").should("exist");

        // 4) Clicking row 1002 while in "Unread only" mode marks it read & decrements count to 40,
        //    while keeping row 1002 cursor-stable on the current page.
        cy.contains(".MuiDataGrid-row", "1002").find('[data-field="occupancyCount"]').click();
        cy.contains(".MuiDataGrid-row", "1002")
            .should("have.class", "read-alarm-row")
            .and("have.class", "preview-row");
        cy.wrap(null).should(() => {
            expect(store.getState().eventLogSlice.dashboardUnreadAlarmCount).to.equal(40);
        });

        // 5) Selecting row 1003 via checkbox and clicking Acknowledge Selected removes 1003 (and previously read 1002)
        //    and refills Page 0 with unread rows through 1018 (count -> 39).
        cy.contains(".MuiDataGrid-row", "1003").find('input[type="checkbox"]').click();
        cy.get('[data-testid="toolbar-acknowledge-selected"]').click();
        cy.contains(".MuiDataGrid-row", "1003").should("not.exist");
        cy.contains(".MuiDataGrid-row", "1017").should("exist");
        cy.wrap(null).should(() => {
            expect(store.getState().eventLogSlice.dashboardUnreadAlarmCount).to.equal(39);
        });

        // 6) Expanding server post-watermark backlog to 160 (>150) while post-watermark readKeys exist
        //    caps unread summary at {count: 100, capped: true} ("100+").
        cy.then(() => {
            activeObsRows = makeObsRows(160);
        });
        // Toggle Unread Only off to trigger fresh snapshot cutoff & reconciliation against 160 rows.
        cy.get('[data-testid="toolbar-unread-only"]').click();
        cy.get('[data-testid="toolbar-unread-only"]').should("have.attr", "aria-pressed", "false");
        cy.wrap(null).should(() => {
            expect(store.getState().eventLogSlice.dashboardUnreadAlarmCount).to.equal(100);
            expect(store.getState().eventLogSlice.dashboardUnreadCountCapped).to.equal(true);
        });

        // 7) Unmounting alarmtable resets ephemeral dashboardUnreadOnly and dashboardUnreadAlarmCount.
        cy.then(() => {
            cy.mount(<div data-testid="unmounted-sentinel">Done</div>);
        });
        cy.get('[data-testid="unmounted-sentinel"]').should("exist");
        cy.wrap(null).should(() => {
            expect(store.getState().eventLogSlice.dashboardUnreadOnly).to.equal(false);
            expect(store.getState().eventLogSlice.dashboardUnreadAlarmCount).to.equal(0);
        });
    });

    it("narrows alarmtable via quick temporal window presets (15m/1h/24h/15d) and scopes Acknowledge All within sub-15d windows", () => {
        const nowMs = Date.now();
        const obsRows = [
            {
                id: "obs-5m-a",
                properties: {"datastream@id": "ds-occ-21", "foi@id": "foi-21"},
                result: {
                    occupancyCount: "2001",
                    startTime: new Date(nowMs - 5 * 60_000 - 3_000).toISOString(),
                    endTime: new Date(nowMs - 5 * 60_000).toISOString(),
                    maxGammaBackground: 100,
                    maxGamma: 780,
                    maxNeutron: 0,
                    gammaAlarm: true,
                    neutronAlarm: false,
                    adjudicatedIds: [],
                    videoPaths: [],
                },
            },
            {
                id: "obs-10m-b",
                properties: {"datastream@id": "ds-occ-21", "foi@id": "foi-21"},
                result: {
                    occupancyCount: "2002",
                    startTime: new Date(nowMs - 10 * 60_000 - 3_000).toISOString(),
                    endTime: new Date(nowMs - 10 * 60_000).toISOString(),
                    maxGammaBackground: 100,
                    maxGamma: 690,
                    maxNeutron: 0,
                    gammaAlarm: true,
                    neutronAlarm: false,
                    adjudicatedIds: [],
                    videoPaths: [],
                },
            },
            {
                id: "obs-2h-old",
                properties: {"datastream@id": "ds-occ-21", "foi@id": "foi-21"},
                result: {
                    occupancyCount: "2003",
                    startTime: new Date(nowMs - 2 * 3_600_000 - 3_000).toISOString(),
                    endTime: new Date(nowMs - 2 * 3_600_000).toISOString(),
                    maxGammaBackground: 100,
                    maxGamma: 910,
                    maxNeutron: 0,
                    gammaAlarm: true,
                    neutronAlarm: false,
                    adjudicatedIds: [],
                    videoPaths: [],
                },
            },
        ];

        const matchesWindowAndPriority = (item: any, filterStr: string, phenomenonTimeStr: string): boolean => {
            const endMs = Date.parse(item.result.endTime);
            if (phenomenonTimeStr) {
                const floorMs = Date.parse(phenomenonTimeStr.split("/")[0]);
                if (Number.isFinite(floorMs) && endMs < floorMs) return false;
            }
            if (filterStr.includes("gammaAlarm=true AND neutronAlarm=true")) return false;
            if (filterStr.includes("gammaAlarm=false AND neutronAlarm=true")) return false;
            if (filterStr.includes("gammaAlarm=false AND neutronAlarm=false")) return false;
            return true;
        };

        cy.window().then(win => {
            const origFetch = win.fetch.bind(win);
            cy.stub(win, "fetch").callsFake((input: RequestInfo | URL, init?: RequestInit) => {
                const url = String(input);
                if (url.includes("/observations/count?")) {
                    const parsedUrl = new URL(url);
                    const filterStr = parsedUrl.searchParams.get("filter") ?? "";
                    const phenomenonTimeStr = parsedUrl.searchParams.get("phenomenonTime") ?? "";
                    const count = obsRows.filter(
                        item => matchesWindowAndPriority(item, filterStr, phenomenonTimeStr),
                    ).length;
                    return Promise.resolve(new Response(JSON.stringify({count}), {
                        status: 200,
                        headers: {"Content-Type": "application/json"},
                    }));
                }
                return origFetch(input, init);
            });
        });

        const serverLanes: Record<string, {acknowledgedThroughMs: number; readKeys: string[]}> = {};
        let revision = 0;
        const mockReadStateFetch: DashboardReadStateFetch = async (_input, init) => {
            const method = (init?.method ?? "GET").toUpperCase();
            if (method === "POST" && init?.body) {
                const parsedBody = JSON.parse(String(init.body));
                for (const [laneId, update] of Object.entries<any>(parsedBody.lanes ?? {})) {
                    const prev = serverLanes[laneId] ?? {acknowledgedThroughMs: 0, readKeys: []};
                    if (update.acknowledgeAll) {
                        prev.acknowledgedThroughMs = Math.max(
                            prev.acknowledgedThroughMs,
                            update.acknowledgedThroughMs ?? Date.now(),
                        );
                        prev.readKeys = [];
                    }
                    if (Array.isArray(update.readKeys)) {
                        prev.readKeys = Array.from(new Set([...prev.readKeys, ...update.readKeys]));
                    }
                    serverLanes[laneId] = prev;
                }
                revision += 1;
            }
            return new Response(JSON.stringify({
                schemaVersion: 1,
                revision,
                updatedAt: new Date().toISOString(),
                lanes: serverLanes,
            }), {
                status: 200,
                headers: {ETag: `"rev-${revision}"`, "Content-Type": "application/json"},
            });
        };

        const fakeNode: any = {
            id: "node-window-test",
            name: "GateNode",
            address: "127.0.0.1",
            port: 8282,
            isSecure: false,
            isDefaultNode: true,
            oshPathRoot: "/sensorhub",
            bucketsEndpoint: "/buckets",
            getConnectedSystemsEndpoint: () => "https://node.example/sensorhub/api",
            getBasicAuthHeader: () => ({}),
            getObservationsApi: async () => ({
                searchObservations: async (obsFilter: any, limit = 15, offset = 0) => {
                    const filterStr = decodeURIComponent(obsFilter?.props?.filter ?? "");
                    const phenomenonTimeStr = String(obsFilter?.props?.phenomenonTime ?? "");
                    const matched = obsRows
                        .filter(item => matchesWindowAndPriority(item, filterStr, phenomenonTimeStr))
                        .slice(offset, offset + limit);
                    return {
                        fetchData: async () => matched,
                    };
                },
            }),
        };

        const laneMap = new Map<string, any>([
            ["Lane21", {
                laneName: "Lane21",
                parentNode: fakeNode,
                isRS350Backpack: false,
                datastreams: [{
                    properties: {
                        id: "ds-occ-21",
                        "system@id": "sys-Lane21",
                        observedProperties: [{definition: OCCUPANCY_PILLAR_DEF}],
                    },
                }],
                datastreamSourceMap: new Map(),
                findDataStreamByObsProperty: () => null,
                lookupSystemIdFromDataStreamId: () => "sys-Lane21",
            }],
        ]);

        const store = configureStore({
            reducer: {
                eventLogSlice: eventDataReducer,
                oscarClientSlice: oscarClientReducer,
                eventPreview: eventPreviewReducer,
            },
            middleware: getDefault => getDefault({serializableCheck: false}),
        });

        const mockRouter: any = {
            push: cy.stub(),
            replace: cy.stub(),
            prefetch: cy.stub(),
            back: cy.stub(),
            forward: cy.stub(),
            refresh: cy.stub(),
        };

        cy.mount(
            <AppRouterContext.Provider value={mockRouter}>
                <Provider store={store}>
                    <LanguageProvider>
                        <DataSourceContext.Provider value={{
                            laneMapRef: {current: laneMap},
                            activeViewKey: null,
                            viewError: null,
                            scopedHref: (href: string) => href,
                        } as any}>
                            <EventTable
                                tableMode="alarmtable"
                                laneMap={laneMap}
                                readStateFetch={mockReadStateFetch}
                            />
                        </DataSourceContext.Provider>
                    </LanguageProvider>
                </Provider>
            </AppRouterContext.Provider>,
        );

        // Default 15d preset is active with aria-pressed="true" and shows all 3 alarms (including 2h-old 2003).
        cy.get('[data-testid="toolbar-time-window-group"]').should("have.attr", "role", "group");
        cy.get('[data-testid="toolbar-time-window-15d"]').should("have.attr", "aria-pressed", "true");
        cy.get('[data-testid="toolbar-time-window-15m"]').should("have.attr", "aria-pressed", "false");
        cy.contains(".MuiDataGrid-row", "2003").should("have.class", "unread-alarm-row");
        cy.wrap(null).should(() => {
            expect(store.getState().eventLogSlice.dashboardUnreadAlarmCount).to.equal(3);
        });

        // Clicking 15m switches aria-pressed mutually exclusively, shows 2001 & 2002, and excludes 2h-old 2003.
        cy.get('[data-testid="toolbar-time-window-15m"]').click();
        cy.get('[data-testid="toolbar-time-window-15m"]').should("have.attr", "aria-pressed", "true");
        cy.get('[data-testid="toolbar-time-window-15d"]').should("have.attr", "aria-pressed", "false");
        cy.contains(".MuiDataGrid-row", "2001").should("exist");
        cy.contains(".MuiDataGrid-row", "2002").should("exist");
        cy.contains(".MuiDataGrid-row", "2003").should("not.exist");
        cy.wrap(null).should(() => {
            expect(store.getState().eventLogSlice.dashboardUnreadAlarmCount).to.equal(2);
        });

        // Clicking Acknowledge All while 15m is active marks ONLY the 15m alarms read without advancing the 15d watermark.
        cy.get('[data-testid="toolbar-acknowledge-all"]').click();
        cy.contains(".MuiDataGrid-row", "2001").should("have.class", "read-alarm-row");
        cy.contains(".MuiDataGrid-row", "2002").should("have.class", "read-alarm-row");
        cy.wrap(null).should(() => {
            expect(store.getState().eventLogSlice.dashboardUnreadAlarmCount).to.equal(0);
        });

        // Switching back to 15d reveals 2h-old 2003 is STILL unread (unread count === 1) while 2001 & 2002 remain read!
        cy.get('[data-testid="toolbar-time-window-15d"]').click();
        cy.contains(".MuiDataGrid-row", "2001").should("have.class", "read-alarm-row");
        cy.contains(".MuiDataGrid-row", "2002").should("have.class", "read-alarm-row");
        cy.contains(".MuiDataGrid-row", "2003").should("have.class", "unread-alarm-row");
        cy.wrap(null).should(() => {
            expect(store.getState().eventLogSlice.dashboardUnreadAlarmCount).to.equal(1);
            expect(serverLanes.Lane21?.acknowledgedThroughMs ?? 0).to.equal(0);
        });
    });

    it("switches Dashboard between priority-category sorting and purely chronological newest-first sorting", () => {
        const nowMs = Date.now();
        const newestGammaStart = new Date(nowMs - 2 * 60_000).toISOString();
        const newestGammaEnd = new Date(nowMs - 1 * 60_000).toISOString();
        const olderNeutronStart = new Date(nowMs - 20 * 60_000).toISOString();
        const olderNeutronEnd = new Date(nowMs - 19 * 60_000).toISOString();
        const oldestBothStart = new Date(nowMs - 45 * 60_000).toISOString();
        const oldestBothEnd = new Date(nowMs - 44 * 60_000).toISOString();

        // Server returns chronological newest-first order when queried without priority buckets.
        const obsRows = [
            {
                id: "obs-gamma-new",
                properties: {id: "obs-gamma-new", "datastream@id": "ds-occ-sort"},
                phenomenonTime: newestGammaEnd,
                resultTime: newestGammaEnd,
                result: {
                    occupancyCount: 3001,
                    startTime: newestGammaStart,
                    endTime: newestGammaEnd,
                    gammaAlarm: true,
                    neutronAlarm: false,
                    maxGamma: 1850,
                    maxNeutron: 2,
                    adjudicatedIds: [],
                    videoPaths: [],
                },
            },
            {
                id: "obs-neutron-mid",
                properties: {id: "obs-neutron-mid", "datastream@id": "ds-occ-sort"},
                phenomenonTime: olderNeutronEnd,
                resultTime: olderNeutronEnd,
                result: {
                    occupancyCount: 3002,
                    startTime: olderNeutronStart,
                    endTime: olderNeutronEnd,
                    gammaAlarm: false,
                    neutronAlarm: true,
                    maxGamma: 420,
                    maxNeutron: 28,
                    adjudicatedIds: [],
                    videoPaths: [],
                },
            },
            {
                id: "obs-both-old",
                properties: {id: "obs-both-old", "datastream@id": "ds-occ-sort"},
                phenomenonTime: oldestBothEnd,
                resultTime: oldestBothEnd,
                result: {
                    occupancyCount: 3003,
                    startTime: oldestBothStart,
                    endTime: oldestBothEnd,
                    gammaAlarm: true,
                    neutronAlarm: true,
                    maxGamma: 2400,
                    maxNeutron: 31,
                    adjudicatedIds: [],
                    videoPaths: [],
                },
            },
        ];

        const observedSearchFilters: string[] = [];
        cy.intercept("GET", "**/observations/count*", {
            statusCode: 200,
            body: {count: 3},
        });

        const mockReadStateFetch: DashboardReadStateFetch = async () =>
            new Response(
                JSON.stringify({
                    schemaVersion: 1,
                    revision: 1,
                    updatedAt: new Date().toISOString(),
                    lanes: {},
                }),
                {status: 200, headers: {"Content-Type": "application/json"}},
            );

        const fakeNode: any = {
            id: "node-sort-test",
            name: "GateNode",
            address: "127.0.0.1",
            port: 8282,
            isSecure: false,
            isDefaultNode: true,
            oshPathRoot: "/sensorhub",
            bucketsEndpoint: "/buckets",
            getConnectedSystemsEndpoint: () => "https://node.example/sensorhub/api",
            getBasicAuthHeader: () => ({}),
            getObservationsApi: async () => ({
                searchObservations: async (obsFilter: any) => {
                    const filterStr = decodeURIComponent(obsFilter?.props?.filter ?? "");
                    observedSearchFilters.push(filterStr);
                    const matched = obsRows.filter(item => {
                        if (filterStr.includes("gammaAlarm=true AND neutronAlarm=true")) {
                            return item.result.gammaAlarm && item.result.neutronAlarm;
                        }
                        if (filterStr.includes("gammaAlarm=false AND neutronAlarm=true")) {
                            return !item.result.gammaAlarm && item.result.neutronAlarm;
                        }
                        if (filterStr.includes("gammaAlarm=true AND neutronAlarm=false")) {
                            return item.result.gammaAlarm && !item.result.neutronAlarm;
                        }
                        return item.result.gammaAlarm || item.result.neutronAlarm;
                    });
                    return {fetchData: async () => matched};
                },
            }),
        };

        const laneMap = new Map<string, any>([
            [
                "LaneSort",
                {
                    laneName: "LaneSort",
                    parentNode: fakeNode,
                    isRS350Backpack: false,
                    datastreams: [
                        {
                            properties: {
                                id: "ds-occ-sort",
                                "system@id": "sys-LaneSort",
                                observedProperties: [{definition: OCCUPANCY_PILLAR_DEF}],
                            },
                        },
                    ],
                    datastreamSourceMap: new Map(),
                    findDataStreamByObsProperty: () => null,
                    lookupSystemIdFromDataStreamId: () => "sys-LaneSort",
                },
            ],
        ]);

        const store = configureStore({
            reducer: {
                eventLogSlice: eventDataReducer,
                oscarClientSlice: oscarClientReducer,
                eventPreview: eventPreviewReducer,
            },
            middleware: getDefault => getDefault({serializableCheck: false}),
        });

        const mockRouter: any = {
            push: cy.stub(),
            replace: cy.stub(),
            prefetch: cy.stub(),
            back: cy.stub(),
            forward: cy.stub(),
            refresh: cy.stub(),
        };

        cy.mount(
            <AppRouterContext.Provider value={mockRouter}>
                <Provider store={store}>
                    <LanguageProvider>
                        <DataSourceContext.Provider value={{
                            laneMapRef: {current: laneMap},
                            activeViewKey: null,
                            viewError: null,
                            scopedHref: (href: string) => href,
                        } as any}>
                            <EventTable
                                tableMode="alarmtable"
                                laneMap={laneMap}
                                readStateFetch={mockReadStateFetch}
                            />
                        </DataSourceContext.Provider>
                    </LanguageProvider>
                </Provider>
            </AppRouterContext.Provider>,
        );

        // Default priority mode: Gamma & Neutron (3003) -> Neutron (3002) -> Gamma (3001)
        cy.get('[data-testid="toolbar-sort-time-only"]').should("have.attr", "aria-pressed", "false");
        cy.get(".MuiDataGrid-row").should("have.length", 3);
        cy.get(".MuiDataGrid-row").eq(0).should("contain.text", "3003");
        cy.get(".MuiDataGrid-row").eq(1).should("contain.text", "3002");
        cy.get(".MuiDataGrid-row").eq(2).should("contain.text", "3001");

        // Switch to purely chronological newest-first mode: Gamma (3001) -> Neutron (3002) -> Gamma & Neutron (3003)
        cy.then(() => {
            observedSearchFilters.length = 0;
        });
        cy.get('[data-testid="toolbar-sort-time-only"]').click();
        cy.get('[data-testid="toolbar-sort-time-only"]').should("have.attr", "aria-pressed", "true");
        cy.get('[data-testid="alarm-acknowledge-status"]').should(
            "contain.text",
            "Alarms sorted newest first by time",
        );
        cy.get(".MuiDataGrid-row").eq(0).should("contain.text", "3001");
        cy.get(".MuiDataGrid-row").eq(1).should("contain.text", "3002");
        cy.get(".MuiDataGrid-row").eq(2).should("contain.text", "3003");
        cy.wrap(null).should(() => {
            expect(observedSearchFilters).to.have.length(1);
            expect(observedSearchFilters[0]).to.not.include("gammaAlarm=true AND neutronAlarm=true");
        });

        // Switch back to priority-category mode
        cy.get('[data-testid="toolbar-sort-time-only"]').click();
        cy.get('[data-testid="toolbar-sort-time-only"]').should("have.attr", "aria-pressed", "false");
        cy.get('[data-testid="alarm-acknowledge-status"]').should(
            "contain.text",
            "Alarms sorted by priority category",
        );
        cy.get(".MuiDataGrid-row").eq(0).should("contain.text", "3003");
        cy.get(".MuiDataGrid-row").eq(1).should("contain.text", "3002");
        cy.get(".MuiDataGrid-row").eq(2).should("contain.text", "3001");

        // Also verify Events (tableMode="eventlog") exposes Newest first and places newer None/Gamma events first
        cy.then(() => {
            const newestNoneStart = new Date(nowMs - 30_000).toISOString();
            const newestNoneEnd = new Date(nowMs - 20_000).toISOString();
            obsRows.unshift({
                id: "obs-none-newest",
                properties: {id: "obs-none-newest", "datastream@id": "ds-occ-sort"},
                phenomenonTime: newestNoneEnd,
                resultTime: newestNoneEnd,
                result: {
                    occupancyCount: 3000,
                    startTime: newestNoneStart,
                    endTime: newestNoneEnd,
                    gammaAlarm: false,
                    neutronAlarm: false,
                    maxGamma: 180,
                    maxNeutron: 1,
                    adjudicatedIds: [],
                    videoPaths: [],
                },
            });
            fakeNode.getObservationsApi = async () => ({
                searchObservations: async (obsFilter: any) => {
                    const filterStr = decodeURIComponent(obsFilter?.props?.filter ?? "");
                    const matched = obsRows.filter(item => {
                        if (filterStr.includes("gammaAlarm=true AND neutronAlarm=true")) {
                            return item.result.gammaAlarm && item.result.neutronAlarm;
                        }
                        if (filterStr.includes("gammaAlarm=false AND neutronAlarm=true")) {
                            return !item.result.gammaAlarm && item.result.neutronAlarm;
                        }
                        if (filterStr.includes("gammaAlarm=true AND neutronAlarm=false")) {
                            return item.result.gammaAlarm && !item.result.neutronAlarm;
                        }
                        if (filterStr.includes("gammaAlarm=false AND neutronAlarm=false")) {
                            return !item.result.gammaAlarm && !item.result.neutronAlarm;
                        }
                        return true;
                    });
                    return {fetchData: async () => matched};
                },
            });

            cy.mount(
                <AppRouterContext.Provider value={mockRouter}>
                    <Provider store={store}>
                        <LanguageProvider>
                            <DataSourceContext.Provider value={{
                                laneMapRef: {current: laneMap},
                                activeViewKey: null,
                                viewError: null,
                                scopedHref: (href: string) => href,
                            } as any}>
                                <EventTable
                                    key="eventlog-instance"
                                    tableMode="eventlog"
                                    viewAdjudicated
                                    laneMap={laneMap}
                                />
                            </DataSourceContext.Provider>
                        </LanguageProvider>
                    </Provider>
                </AppRouterContext.Provider>,
            );
        });

        cy.get('[data-testid="toolbar-sort-time-only"]').should("have.attr", "aria-pressed", "false");
        cy.get(".MuiDataGrid-row").eq(0).should("contain.text", "3003");
        cy.get(".MuiDataGrid-row").eq(3).should("contain.text", "3000");

        cy.get('[data-testid="toolbar-sort-time-only"]').click();
        cy.get('[data-testid="toolbar-sort-time-only"]').should("have.attr", "aria-pressed", "true");
        cy.get('[data-testid="alarm-acknowledge-status"]').should(
            "contain.text",
            "Events sorted newest first by time",
        );
        cy.get(".MuiDataGrid-row").eq(0).should("contain.text", "3000");
        cy.get(".MuiDataGrid-row").eq(1).should("contain.text", "3001");
        cy.get(".MuiDataGrid-row").eq(2).should("contain.text", "3002");
        cy.get(".MuiDataGrid-row").eq(3).should("contain.text", "3003");
    });
});
