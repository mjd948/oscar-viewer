import React, {useRef} from "react";
import {configureStore} from "@reduxjs/toolkit";
import {Provider} from "react-redux";
import {AppRouterContext} from "next/dist/shared/lib/app-router-context.shared-runtime";
import {LanguageProvider} from "../../src/app/contexts/LanguageContext";
import {DataSourceContext} from "../../src/app/contexts/DataSourceContext";
import EventTable from "../../src/app/_components/event-table/EventTable";
import AdjudicationDetail from "../../src/app/_components/adjudication/AdjudicationDetail";
import {
    ADJ_DEF,
    OCCUPANCY_PILLAR_DEF,
    OCR_DEF,
    REPORT_DEF,
} from "../../src/lib/data/Constants";
import {resolveEffectiveReportCommandType} from "../../src/lib/data/oscar/OSCARCommands";
import {EventTableData} from "../../src/lib/data/oscar/TableHelpers";
import {
    buildVehicleIncidentReportSpec,
    formatVehicleIdDisplay,
    matchesVehicleIdNormalized,
    normalizeVehicleId,
    searchVehiclePassesAcrossNodes,
    serializeFederatedRemotePasses,
} from "../../src/lib/data/oscar/VehicleSearch";
import AppReducer from "../../src/lib/state/Slice";
import OSHReducer from "../../src/lib/state/OSHSlice";
import EventDataReducer from "../../src/lib/state/EventDataSlice";
import OSCARClientReducer from "../../src/lib/state/OSCARClientSlice";
import OSCARLaneReducer from "../../src/lib/state/OSCARLaneSlice";
import EventDetailsReducer from "../../src/lib/state/EventDetailsSlice";
import EventPreviewReducer from "../../src/lib/state/EventPreviewSlice";
import LaneViewReducer from "../../src/lib/state/LaneViewSlice";

const TINY_JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

function createFullTestStore(nodes: any[] = []) {
    return configureStore({
        reducer: {
            oscarClientSlice: OSCARClientReducer,
            appState: AppReducer,
            oshSlice: OSHReducer,
            eventLogSlice: EventDataReducer,
            laneSlice: OSCARLaneReducer,
            eventPreview: EventPreviewReducer,
            laneView: LaneViewReducer,
            eventDetails: EventDetailsReducer,
        },
        preloadedState: {
            oshSlice: {
                nodes,
                configNode: nodes[0] ?? null,
            } as any,
        },
        middleware: (getDefaultMiddleware) =>
            getDefaultMiddleware({serializableCheck: false}),
    });
}

function makeFakeNode(params: {
    id: string;
    name: string;
    address: string;
    port: number;
    isDefaultNode: boolean;
    adjControlStreamId: string;
    reportControlStreamId: string;
    observationsByStream?: Record<string, any[]>;
}) {
    const controlStreams = [
        {
            properties: {
                id: params.adjControlStreamId,
                controlledProperties: [{definition: ADJ_DEF}],
            },
        },
        {
            properties: {
                id: params.reportControlStreamId,
                controlledProperties: [{definition: REPORT_DEF}],
            },
        },
    ];

    return {
        id: params.id,
        name: params.name,
        address: params.address,
        port: params.port,
        isSecure: false,
        isDefaultNode: params.isDefaultNode,
        oshPathRoot: "/sensorhub",
        bucketsEndpoint: "/buckets",
        oscarServiceSystem: null,
        getConnectedSystemsEndpoint: () =>
            `http://${params.address}:${params.port}/sensorhub/api`,
        getBasicAuthHeader: () => ({Authorization: `Basic dGVzdDp0ZXN0`}),
        fetchNodeControlStreams: async () => controlStreams,
        fetchDataStreamWithObservedProperty: async () => null,
        getObservationsApi: async () => ({
            searchObservations: async (obsFilter: any, limit = 50, offset = 0) => {
                const streams: string[] = Array.isArray(obsFilter?.props?.dataStream)
                    ? obsFilter.props.dataStream
                    : String(obsFilter?.props?.dataStream ?? "")
                          .split(",")
                          .filter(Boolean);
                const collected: any[] = [];
                for (const dsId of streams) {
                    const list = params.observationsByStream?.[dsId] ?? [];
                    collected.push(...list);
                }
                return {
                    fetchData: async () => collected.slice(offset, offset + limit),
                    nextPage: async () => collected.slice(offset, offset + limit),
                };
            },
        }),
    };
}

describe("Consolidated Vehicle ID Search, Multi-Occupancy Comparison, Linked Adjudication, and Incident Reporting", () => {
    beforeEach(() => {
        window.localStorage.clear();
        window.localStorage.setItem("language", "en");
    });

    it("normalizes vehicle identifiers, formats ISO 6346 containers, and resolves multi-format VEHICLE_INCIDENT commands", () => {
        expect(normalizeVehicleId(" csqu 305438-3 ")).to.equal("CSQU3054383");
        expect(normalizeVehicleId("tn-8842 b")).to.equal("TN8842B");
        expect(normalizeVehicleId("-")).to.equal("");
        expect(normalizeVehicleId("")).to.equal("");

        expect(formatVehicleIdDisplay("csqu3054383")).to.equal("CSQU 305438 3");
        expect(formatVehicleIdDisplay("TN-8842B")).to.equal("TN-8842B");

        expect(matchesVehicleIdNormalized("CSQU 305438-3", "equals", "csqu3054383")).to.equal(true);
        expect(matchesVehicleIdNormalized("CSQU 305438-3", "contains", "305438")).to.equal(true);
        expect(matchesVehicleIdNormalized("CSQU 305438-3", "startsWith", "csqu")).to.equal(true);
        expect(matchesVehicleIdNormalized("TN-8842B", "notEquals", "CSQU3054383")).to.equal(true);
        expect(matchesVehicleIdNormalized("", "isEmpty", "")).to.equal(true);
        expect(matchesVehicleIdNormalized("TN-8842B", "isNotEmpty", "")).to.equal(true);

        expect(resolveEffectiveReportCommandType("VEHICLE_INCIDENT", "PDF")).to.equal("VEHICLE_INCIDENT");
        expect(resolveEffectiveReportCommandType("VEHICLE_INCIDENT", "CSV")).to.equal("VEHICLE_INCIDENT_CSV");
        expect(resolveEffectiveReportCommandType("VEHICLE_INCIDENT", "JSON")).to.equal("VEHICLE_INCIDENT_JSON");
        expect(resolveEffectiveReportCommandType("VEHICLE_INCIDENT", "XLSX")).to.equal("VEHICLE_INCIDENT_XLSX");

        const spec = JSON.parse(
            buildVehicleIncidentReportSpec({
                vehicleId: "CSQU 305438 3",
                matchMode: "equals",
                laneUIDs: ["urn:osh:system:lane1"],
                federatedPasses: [{nodeId: "node-rs350", occupancyObsId: "obs-rs350-9"}],
            }),
        );
        expect(spec.vehicleId).to.equal("CSQU 305438 3");
        expect(spec.matchMode).to.equal("equals");
        expect(spec.laneUID).to.equal("urn:osh:system:lane1");
        expect(spec.federatedPasses).to.have.length(1);
    });

    it("fans out across federated nodes with Promise.allSettled resilience and supports legacy 404 ConSys fallback", async () => {
        const primaryNode = makeFakeNode({
            id: "node-primary",
            name: "Primary Gate",
            address: "198.51.100.10",
            port: 8282,
            isDefaultNode: true,
            adjControlStreamId: "cs-adj-primary",
            reportControlStreamId: "cs-rep-primary",
        });

        const rs350Node = makeFakeNode({
            id: "node-rs350",
            name: "Secondary RS350",
            address: "198.51.100.20",
            port: 8282,
            isDefaultNode: false,
            adjControlStreamId: "cs-adj-rs350",
            reportControlStreamId: "cs-rep-rs350",
        });

        const offlineNode = makeFakeNode({
            id: "node-offline",
            name: "Offline East Gate",
            address: "198.51.100.30",
            port: 8282,
            isDefaultNode: false,
            adjControlStreamId: "cs-adj-offline",
            reportControlStreamId: "cs-rep-offline",
        });

        const laneMap = new Map<string, any>([
            [
                "Lane1",
                {
                    laneName: "Lane1",
                    parentNode: primaryNode,
                    isRS350Backpack: false,
                    systems: [{properties: {id: "sys-lane1", uid: "urn:osh:lane1"}}],
                    datastreams: [
                        {
                            properties: {
                                id: "ds-occ-lane1",
                                "system@id": "sys-lane1",
                                observedProperties: [{definition: OCCUPANCY_PILLAR_DEF}],
                            },
                        },
                    ],
                    controlStreams: [
                        {
                            properties: {
                                id: "cs-adj-primary",
                                controlledProperties: [{definition: ADJ_DEF}],
                            },
                        },
                    ],
                    datastreamSourceMap: new Map(),
                    lookupSystemIdFromDataStreamId: () => "sys-lane1",
                },
            ],
            [
                "RS350-Sec",
                {
                    laneName: "RS350-Sec",
                    parentNode: rs350Node,
                    isRS350Backpack: true,
                    systems: [{properties: {id: "sys-rs350", uid: "urn:osh:rs350"}}],
                    datastreams: [
                        {
                            properties: {
                                id: "ds-occ-rs350",
                                "system@id": "sys-rs350",
                                observedProperties: [{definition: OCCUPANCY_PILLAR_DEF}],
                            },
                        },
                    ],
                    controlStreams: [
                        {
                            properties: {
                                id: "cs-adj-rs350",
                                controlledProperties: [{definition: ADJ_DEF}],
                            },
                        },
                    ],
                    datastreamSourceMap: new Map(),
                    lookupSystemIdFromDataStreamId: () => "sys-rs350",
                },
            ],
            [
                "OfflineLane",
                {
                    laneName: "OfflineLane",
                    parentNode: offlineNode,
                    isRS350Backpack: false,
                    systems: [{properties: {id: "sys-off", uid: "urn:osh:offline"}}],
                    datastreams: [],
                    controlStreams: [],
                    datastreamSourceMap: new Map(),
                    lookupSystemIdFromDataStreamId: () => "sys-off",
                },
            ],
        ]);

        const mockFetch: typeof fetch = async (input) => {
            const url = String(input);
            if (url.includes("198.51.100.30")) {
                throw new Error("Connection refused");
            }
            if (url.includes("198.51.100.20") && url.includes("/adjudication/vehicle-search")) {
                return new Response(
                    JSON.stringify({
                        vehicleId: "CSQU3054383",
                        normalizedVehicleId: "CSQU3054383",
                        matchMode: "equals",
                        passes: [
                            {
                                laneUid: "urn:osh:rs350",
                                laneName: "RS350-Sec",
                                datastreamId: "ds-occ-rs350",
                                occupancyObsId: "obs-rs350-2",
                                occupancyCount: 77,
                                systemType: "RS350 Spectroscopic",
                                startTime: "2026-11-14T15:08:00.000Z",
                                endTime: "2026-11-14T15:08:25.000Z",
                                samplingTime: "2026-11-14T15:08:00.000Z",
                                durationSeconds: 25,
                                gammaAlarm: true,
                                neutronAlarm: false,
                                alarmCategoryCode: "Industrial",
                                alarmStatusLabel: "Gamma (Industrial)",
                                emlAutoReleased: false,
                                maxGammaCount: 1620,
                                maxNeutronCount: 1,
                                neutronBackground: 1,
                                vehicleId: "CSQU3054383",
                                normalizedVehicleId: "CSQU3054383",
                                vehicleIdSource: "ocr",
                                confirmedIsotopes: ["Co-60"],
                                videoPaths: [],
                                webIdAnalyses: [
                                    {
                                        obsId: "webid-1",
                                        sampleTime: "2026-11-14T15:08:12.000Z",
                                        isotopeString: "Co-60",
                                        isotopes: ["Co-60"],
                                        drf: "1x3-NaI",
                                        estimatedDose: 0.42,
                                        chi2: 1.18,
                                        errorMessage: "",
                                        warnings: [],
                                    },
                                ],
                                adjudications: [],
                            },
                        ],
                    }),
                    {status: 200, headers: {"Content-Type": "application/json"}},
                );
            }
            if (url.includes("/adjudication/vehicle-search")) {
                return new Response(
                    JSON.stringify({
                        vehicleId: "CSQU3054383",
                        normalizedVehicleId: "CSQU3054383",
                        matchMode: "equals",
                        passes: [
                            {
                                laneUid: "urn:osh:lane1",
                                laneName: "Lane1",
                                datastreamId: "ds-occ-lane1",
                                occupancyObsId: "obs-primary-1",
                                occupancyCount: 412,
                                systemType: "Rapiscan RPM",
                                startTime: "2026-11-14T15:01:00.000Z",
                                endTime: "2026-11-14T15:01:06.000Z",
                                samplingTime: "2026-11-14T15:01:00.000Z",
                                durationSeconds: 6,
                                gammaAlarm: true,
                                neutronAlarm: false,
                                alarmCategoryCode: "",
                                alarmStatusLabel: "Gamma",
                                emlAutoReleased: false,
                                maxGammaCount: 2450,
                                maxNeutronCount: 2,
                                neutronBackground: 1.1,
                                vehicleId: "CSQU3054383",
                                normalizedVehicleId: "CSQU3054383",
                                vehicleIdSource: "ocr",
                                ocr: {
                                    value: "CSQU3054383",
                                    normalizedValue: "CSQU3054383",
                                    idType: "container",
                                    confidence: 0.94,
                                    checksumValid: true,
                                    readCount: 3,
                                    cameraUid: "cam-1",
                                    frameTime: "2026-11-14T15:01:03.000Z",
                                    evidenceImagePath: "ocr/crops/obs-primary-1.jpg",
                                },
                                confirmedIsotopes: [],
                                videoPaths: [],
                                webIdAnalyses: [],
                                adjudications: [],
                            },
                        ],
                    }),
                    {status: 200, headers: {"Content-Type": "application/json"}},
                );
            }
            return new Response("Not Found", {status: 404});
        };

        const searchResult = await searchVehiclePassesAcrossNodes({
            vehicleId: "csqu 305438-3",
            matchMode: "equals",
            laneMap,
            nodes: [primaryNode, rs350Node, offlineNode] as any,
            fetchImpl: mockFetch,
        });

        expect(searchResult.normalizedVehicleId).to.equal("CSQU3054383");
        expect(searchResult.formattedVehicleId).to.equal("CSQU 305438 3");
        expect(searchResult.passes.map(p => p.occupancyObsId)).to.deep.equal([
            "obs-primary-1",
            "obs-rs350-2",
        ]);
        expect(searchResult.summary.totalPasses).to.equal(2);
        expect(searchResult.summary.alarmingPasses).to.equal(2);
        expect(searchResult.summary.openAlarmPasses).to.equal(2);
        expect(searchResult.summary.spectroscopicPasses).to.equal(1);
        expect(searchResult.summary.distinctLanes).to.equal(2);
        expect(searchResult.summary.distinctNodes).to.equal(2);
        expect(searchResult.summary.confirmedIsotopes).to.deep.equal(["Co-60"]);
        expect(searchResult.unreachableNodes).to.have.length(1);
        expect(searchResult.unreachableNodes[0].nodeName).to.equal("Offline East Gate");

        const relayed = serializeFederatedRemotePasses(searchResult.passes, "node-primary");
        expect(relayed).to.have.length(1);
        expect(relayed[0].nodeId).to.equal("node-rs350");
        expect(relayed[0].occupancyObsId).to.equal("obs-rs350-2");

        // Verify legacy 404 ConSys fallback on an older federated node lacking /adjudication/vehicle-search
        const legacyNode = makeFakeNode({
            id: "node-legacy",
            name: "Legacy Secondary",
            address: "198.51.100.40",
            port: 8282,
            isDefaultNode: false,
            adjControlStreamId: "cs-adj-legacy",
            reportControlStreamId: "cs-rep-legacy",
            observationsByStream: {
                "ds-occ-legacy": [
                    {
                        id: "obs-legacy-9",
                        resultTime: "2026-11-14T16:00:05.000Z",
                        result: {
                            occupancyCount: 88,
                            startTime: "2026-11-14T16:00:00.000Z",
                            endTime: "2026-11-14T16:00:05.000Z",
                            samplingTime: "2026-11-14T16:00:00.000Z",
                            gammaAlarm: true,
                            neutronAlarm: false,
                            maxGammaCount: 980,
                            maxNeutronCount: 1,
                            adjudicatedIds: [],
                            videoPaths: [],
                        },
                    },
                ],
                "ds-ocr-legacy": [
                    {
                        id: "ocr-legacy-1",
                        resultTime: "2026-11-14T16:00:06.000Z",
                        result: {
                            sampleTime: "2026-11-14T16:00:06.000Z",
                            occupancyObsId: "obs-legacy-9",
                            idType: "plate",
                            value: "TN-8842B",
                            normalizedValue: "TN8842B",
                            checksumValid: false,
                            confidence: 0.91,
                            readCount: 2,
                            cameraUid: "cam-legacy",
                            frameTime: "2026-11-14T16:00:03.000Z",
                            evidenceImagePath: "",
                        },
                    },
                ],
            },
        });

        const legacyLaneMap = new Map<string, any>([
            [
                "LegacyLane",
                {
                    laneName: "LegacyLane",
                    parentNode: legacyNode,
                    isRS350Backpack: false,
                    systems: [{properties: {id: "sys-legacy", uid: "urn:osh:legacy"}}],
                    datastreams: [
                        {
                            properties: {
                                id: "ds-occ-legacy",
                                "system@id": "sys-legacy",
                                observedProperties: [{definition: OCCUPANCY_PILLAR_DEF}],
                            },
                        },
                        {
                            properties: {
                                id: "ds-ocr-legacy",
                                outputName: "vehicleOcr",
                                "system@id": "sys-legacy",
                                observedProperties: [{definition: OCR_DEF}],
                            },
                            searchObservations: async () => ({
                                nextPage: async () => [
                                    {
                                        id: "ocr-legacy-1",
                                        resultTime: "2026-11-14T16:00:06.000Z",
                                        result: {
                                            sampleTime: "2026-11-14T16:00:06.000Z",
                                            occupancyObsId: "obs-legacy-9",
                                            idType: "plate",
                                            value: "TN-8842B",
                                            normalizedValue: "TN8842B",
                                            checksumValid: false,
                                            confidence: 0.91,
                                            readCount: 2,
                                            cameraUid: "cam-legacy",
                                            frameTime: "2026-11-14T16:00:03.000Z",
                                            evidenceImagePath: "",
                                        },
                                    },
                                ],
                            }),
                        },
                    ],
                    controlStreams: [],
                    datastreamSourceMap: new Map(),
                    lookupSystemIdFromDataStreamId: () => "sys-legacy",
                },
            ],
        ]);

        const legacyResult = await searchVehiclePassesAcrossNodes({
            vehicleId: "tn8842b",
            matchMode: "equals",
            laneMap: legacyLaneMap,
            nodes: [legacyNode] as any,
            startTimeIso: "2026-11-14T00:00:00.000Z",
            fetchImpl: async (input) => {
                const url = String(input);
                if (url.includes("/observations/obs-legacy-9")) {
                    return new Response(
                        JSON.stringify({
                            id: "obs-legacy-9",
                            "datastream@id": "ds-occ-legacy",
                            resultTime: "2026-11-14T16:00:05.000Z",
                            result: {
                                occupancyCount: 88,
                                startTime: "2026-11-14T16:00:00.000Z",
                                endTime: "2026-11-14T16:00:05.000Z",
                                samplingTime: "2026-11-14T16:00:00.000Z",
                                gammaAlarm: true,
                                neutronAlarm: false,
                                maxGammaCount: 980,
                                maxNeutronCount: 1,
                                adjudicatedIds: [],
                                videoPaths: [],
                            },
                        }),
                        {status: 200, headers: {"Content-Type": "application/json"}},
                    );
                }
                return new Response("Not Found", {status: 404});
            },
        });
        expect(legacyResult.passes).to.have.length(1);
        expect(legacyResult.passes[0].occupancyObsId).to.equal("obs-legacy-9");
        expect(legacyResult.passes[0].normalizedVehicleId).to.equal("TN8842B");
    });

    it("renders the Event Log <search> landmark with IME-safe Enter handling, opens multi-pass comparison, fans out linked adjudication across federated nodes, and exports VEHICLE_INCIDENT reports", () => {
        const primaryNode = makeFakeNode({
            id: "node-primary",
            name: "Primary Gate",
            address: "198.51.100.10",
            port: 8282,
            isDefaultNode: true,
            adjControlStreamId: "cs-adj-primary",
            reportControlStreamId: "cs-rep-primary",
        });

        const rs350Node = makeFakeNode({
            id: "node-rs350",
            name: "Secondary RS350",
            address: "198.51.100.20",
            port: 8282,
            isDefaultNode: false,
            adjControlStreamId: "cs-adj-rs350",
            reportControlStreamId: "cs-rep-rs350",
        });

        const laneMap = new Map<string, any>([
            [
                "Lane1",
                {
                    laneName: "Lane1",
                    parentNode: primaryNode,
                    isRS350Backpack: false,
                    systems: [{properties: {id: "sys-lane1", uid: "urn:osh:lane1"}}],
                    datastreams: [
                        {
                            properties: {
                                id: "ds-occ-lane1",
                                "system@id": "sys-lane1",
                                observedProperties: [{definition: OCCUPANCY_PILLAR_DEF}],
                            },
                        },
                    ],
                    controlStreams: [
                        {
                            properties: {
                                id: "cs-adj-primary",
                                controlledProperties: [{definition: ADJ_DEF}],
                            },
                        },
                    ],
                    datastreamSourceMap: new Map(),
                    findDataStreamByObsProperty: () => null,
                    lookupSystemIdFromDataStreamId: () => "sys-lane1",
                },
            ],
            [
                "RS350-Sec",
                {
                    laneName: "RS350-Sec",
                    parentNode: rs350Node,
                    isRS350Backpack: true,
                    systems: [{properties: {id: "sys-rs350", uid: "urn:osh:rs350"}}],
                    datastreams: [
                        {
                            properties: {
                                id: "ds-occ-rs350",
                                "system@id": "sys-rs350",
                                observedProperties: [{definition: OCCUPANCY_PILLAR_DEF}],
                            },
                        },
                    ],
                    controlStreams: [
                        {
                            properties: {
                                id: "cs-adj-rs350",
                                controlledProperties: [{definition: ADJ_DEF}],
                            },
                        },
                    ],
                    datastreamSourceMap: new Map(),
                    findDataStreamByObsProperty: () => null,
                    lookupSystemIdFromDataStreamId: () => "sys-rs350",
                },
            ],
        ]);

        const postedCommands: Array<{url: string; body: any}> = [];
        let vehicleSearchCalls = 0;
        let passesAdjudicated = false;

        cy.window().then((win) => {
            cy.stub(win, "fetch").callsFake(async (input: RequestInfo | URL, init?: RequestInit) => {
                const url = String(input);
                if (url.includes("/observations/count")) {
                    return new Response(JSON.stringify({count: 0}), {
                        status: 200,
                        headers: {"Content-Type": "application/json"},
                    });
                }
                if (url.includes("/adjudication/vehicle-search")) {
                    vehicleSearchCalls += 1;
                    const isRs350 = url.includes("198.51.100.20");
                    const passPayload = isRs350
                        ? {
                              laneUid: "urn:osh:rs350",
                              laneName: "RS350-Sec",
                              datastreamId: "ds-occ-rs350",
                              occupancyObsId: "obs-rs350-2",
                              occupancyCount: 77,
                              systemType: "RS350 Spectroscopic",
                              startTime: "2026-11-14T15:08:00.000Z",
                              endTime: "2026-11-14T15:08:25.000Z",
                              samplingTime: "2026-11-14T15:08:00.000Z",
                              durationSeconds: 25,
                              gammaAlarm: true,
                              neutronAlarm: false,
                              alarmCategoryCode: "NORM",
                              alarmStatusLabel: "Gamma (NORM)",
                              emlAutoReleased: false,
                              maxGammaCount: 1580,
                              maxNeutronCount: 1,
                              neutronBackground: 1,
                              vehicleId: "CSQU3054383",
                              normalizedVehicleId: "CSQU3054383",
                              vehicleIdSource: passesAdjudicated ? "both" : "ocr",
                              confirmedIsotopes: ["K-40"],
                              videoPaths: [],
                              webIdAnalyses: [
                                  {
                                      obsId: "webid-k40",
                                      sampleTime: "2026-11-14T15:08:10.000Z",
                                      isotopeString: "K-40",
                                      isotopes: ["K-40"],
                                      drf: "RS350",
                                      estimatedDose: 0.14,
                                      chi2: 1.05,
                                      errorMessage: "",
                                      warnings: [],
                                  },
                              ],
                              adjudications: passesAdjudicated
                                  ? [
                                        {
                                            timeUtc: "2026-11-14T15:10:00.000Z",
                                            username: "operator",
                                            adjudicationCode: 4,
                                            dispositionLabel: "Code 4: NORM Confirmed",
                                            dispositionGroup: "Real Alarm",
                                            secondaryInspectionStatus: "COMPLETED",
                                            vehicleId: "CSQU 305438 3",
                                            summary: "Confirmed K-40 fertilizer load on RS350",
                                            isotopes: ["K-40"],
                                            filePaths: [],
                                        },
                                    ]
                                  : [],
                          }
                        : {
                              laneUid: "urn:osh:lane1",
                              laneName: "Lane1",
                              datastreamId: "ds-occ-lane1",
                              occupancyObsId: "obs-primary-1",
                              occupancyCount: 412,
                              systemType: "Rapiscan RPM",
                              startTime: "2026-11-14T15:01:00.000Z",
                              endTime: "2026-11-14T15:01:06.000Z",
                              samplingTime: "2026-11-14T15:01:00.000Z",
                              durationSeconds: 6,
                              gammaAlarm: true,
                              neutronAlarm: false,
                              alarmCategoryCode: "",
                              alarmStatusLabel: "Gamma",
                              emlAutoReleased: false,
                              maxGammaCount: 2450,
                              maxNeutronCount: 2,
                              neutronBackground: 1.1,
                              vehicleId: "CSQU3054383",
                              normalizedVehicleId: "CSQU3054383",
                              vehicleIdSource: passesAdjudicated ? "both" : "ocr",
                              ocr: {
                                  value: "CSQU3054383",
                                  normalizedValue: "CSQU3054383",
                                  idType: "container",
                                  confidence: 0.94,
                                  checksumValid: true,
                                  readCount: 3,
                                  cameraUid: "cam-1",
                                  frameTime: "2026-11-14T15:01:03.000Z",
                                  evidenceImagePath: "ocr/crops/obs-primary-1.jpg",
                              },
                              confirmedIsotopes: [],
                              videoPaths: [],
                              webIdAnalyses: [],
                              adjudications: passesAdjudicated
                                  ? [
                                        {
                                            timeUtc: "2026-11-14T15:10:00.000Z",
                                            username: "operator",
                                            adjudicationCode: 4,
                                            dispositionLabel: "Code 4: NORM Confirmed",
                                            dispositionGroup: "Real Alarm",
                                            secondaryInspectionStatus: "COMPLETED",
                                            vehicleId: "CSQU 305438 3",
                                            summary: "Confirmed K-40 fertilizer load on RS350",
                                            isotopes: ["K-40"],
                                            filePaths: [],
                                        },
                                    ]
                                  : [],
                          };

                    return new Response(
                        JSON.stringify({
                            vehicleId: "CSQU3054383",
                            normalizedVehicleId: "CSQU3054383",
                            matchMode: "contains",
                            passes: [passPayload],
                        }),
                        {status: 200, headers: {"Content-Type": "application/json"}},
                    );
                }
                if (url.includes("ocr/crops/")) {
                    const copy = new Uint8Array(TINY_JPEG_BYTES.byteLength);
                    copy.set(TINY_JPEG_BYTES);
                    return new Response(copy, {
                        status: 200,
                        headers: {"Content-Type": "image/jpeg"},
                    });
                }
                if (url.includes("/controlstreams/") && (init?.method ?? "GET").toUpperCase() === "POST") {
                    const parsedBody = JSON.parse(String(init?.body ?? "{}"));
                    postedCommands.push({url, body: parsedBody});
                    if (url.includes("cs-rep-primary")) {
                        return new Response(
                            JSON.stringify({
                                statusCode: "COMPLETED",
                                results: [
                                    {
                                        data: {
                                            reportPath: "reports/vehicle-incident-CSQU3054383.pdf",
                                        },
                                    },
                                ],
                            }),
                            {status: 200, headers: {"Content-Type": "application/json"}},
                        );
                    }
                    if (postedCommands.filter(c => c.url.includes("cs-adj-")).length >= 2) {
                        passesAdjudicated = true;
                    }
                    return new Response(JSON.stringify({statusCode: "COMPLETED"}), {
                        status: 200,
                        headers: {"Content-Type": "application/json"},
                    });
                }
                return new Response(JSON.stringify({}), {
                    status: 200,
                    headers: {"Content-Type": "application/json"},
                });
            });
        });

        const store = createFullTestStore([primaryNode, rs350Node]);
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
                        <DataSourceContext.Provider
                            value={{
                                laneMapRef: {current: laneMap},
                                laneMapReady: true,
                                activeViewKey: null,
                                viewError: null,
                                scopedHref: (href: string) => href,
                            } as any}
                        >
                            <EventTable tableMode="eventlog" laneMap={laneMap} />
                        </DataSourceContext.Provider>
                    </LanguageProvider>
                </Provider>
            </AppRouterContext.Provider>,
        );

        // 1) Verify <search> landmark and non-prose identifier attributes
        cy.get('search[data-testid="vehicle-id-search-bar"]').should("exist");
        cy.get('[data-testid="vehicle-id-search-input"]')
            .should("have.attr", "autocorrect", "off")
            .and("have.attr", "autocapitalize", "none")
            .and("have.attr", "spellcheck", "false")
            .and("have.attr", "maxlength", "260");

        // 2) Verify IME composition Enter (keyCode 229) does NOT submit prematurely
        cy.get('[data-testid="vehicle-id-search-input"]').type("csqu 305438-3", {delay: 0});
        cy.get('[data-testid="vehicle-id-search-input"]').trigger("keydown", {
            key: "Enter",
            keyCode: 229,
            which: 229,
            isComposing: true,
        });
        cy.wrap(null).then(() => {
            expect(vehicleSearchCalls).to.equal(0);
        });

        // 3) Submit search and verify federated passes + Compare Passes button
        cy.get('[data-testid="vehicle-id-search-submit"]').click();
        cy.get('[data-testid="vehicle-search-compare-btn"]')
            .should("be.visible")
            .and("contain.text", "Compare Passes (2)");
        cy.contains(".MuiDataGrid-row", "412").should("exist");
        cy.contains(".MuiDataGrid-row", "77").should("exist");

        // 4) Open VehiclePassComparisonDialog and verify keyboard-scrollable table region + KPIs
        cy.get('[data-testid="vehicle-search-compare-btn"]').click();
        cy.get('[data-testid="vehicle-pass-comparison-dialog"]').should("be.visible");
        cy.get('[data-testid="vehicle-pass-table-region"]')
            .should("have.attr", "role", "region")
            .and("have.attr", "tabindex", "0");
        cy.get('[data-testid="vehicle-incident-kpi-strip"]').should("contain.text", "K-40");

        // 5) Apply confirmed spectroscopic isotopes, choose Code 4: NORM Confirmed, and batch-adjudicate across BOTH federated nodes
        cy.contains("button", "Apply spectroscopically confirmed isotopes").click();
        cy.get('[data-testid="vehicle-pass-comparison-dialog"]')
            .contains("label", "Adjudicate")
            .parent()
            .find(".MuiSelect-select")
            .click();
        cy.get('[ role="listbox"] li').contains("Code 4").click();
        cy.get('[data-testid="vehicle-batch-notes-input"]').type(
            "Confirmed K-40 fertilizer load on RS350 secondary scan",
            {delay: 0},
        );
        cy.get('[data-testid="vehicle-batch-submit-btn"]')
            .should("not.be.disabled")
            .click();

        cy.wrap(null).should(() => {
            const adjPosts = postedCommands.filter(c => c.url.includes("cs-adj-"));
            expect(adjPosts).to.have.length(2);
            expect(adjPosts.map(c => c.body.parameters.occupancyObsId).sort()).to.deep.equal([
                "obs-primary-1",
                "obs-rs350-2",
            ]);
            expect(adjPosts[0].body.parameters.isotopes).to.include("K-40");
            expect(adjPosts.some(c => c.url.includes("198.51.100.10"))).to.equal(true);
            expect(adjPosts.some(c => c.url.includes("198.51.100.20"))).to.equal(true);
        });

        // 6) Trigger 1-click PDF Vehicle Incident Report and verify federatedPasses relay
        cy.get('[data-testid="vehicle-export-pdf-btn"]').click();
        cy.get('[data-testid="vehicle-exported-report-links"]').should("be.visible");
        cy.wrap(null).then(() => {
            const repPosts = postedCommands.filter(c => c.url.includes("cs-rep-primary"));
            expect(repPosts).to.have.length(1);
            expect(repPosts[0].body.parameters.reportType).to.equal("VEHICLE_INCIDENT");
            const relayedSpec = JSON.parse(repPosts[0].body.parameters.laneUID);
            expect(relayedSpec.vehicleId).to.equal("csqu 305438-3");
            expect(relayedSpec.federatedPasses).to.have.length(1);
            expect(relayedSpec.federatedPasses[0].nodeId).to.equal("node-rs350");
            expect(relayedSpec.federatedPasses[0].occupancyObsId).to.equal("obs-rs350-2");
        });
    });

    it("automatically correlates related passes inside AdjudicationDetail and opens VehiclePassComparisonDialog", () => {
        const primaryNode = makeFakeNode({
            id: "node-primary",
            name: "Primary Gate",
            address: "198.51.100.10",
            port: 8282,
            isDefaultNode: true,
            adjControlStreamId: "cs-adj-primary",
            reportControlStreamId: "cs-rep-primary",
        });

        const laneMap = new Map<string, any>([
            [
                "Lane1",
                {
                    laneName: "Lane1",
                    parentNode: primaryNode,
                    isRS350Backpack: false,
                    systems: [{properties: {id: "sys-lane1", uid: "urn:osh:lane1"}}],
                    datastreams: [
                        {
                            properties: {
                                id: "ds-occ-lane1",
                                "system@id": "sys-lane1",
                                observedProperties: [{definition: OCCUPANCY_PILLAR_DEF}],
                            },
                        },
                    ],
                    controlStreams: [],
                    datastreamSourceMap: new Map(),
                    findDataStreamByObsProperty: () => null,
                    findDataStreamByName: () => null,
                    lookupSystemIdFromDataStreamId: () => "sys-lane1",
                },
            ],
        ]);

        const observedSearchUrls: string[] = [];
        const mockCorrelationFetch: typeof fetch = async (input) => {
            const url = String(input);
            if (url.includes("/adjudication/vehicle-search")) {
                observedSearchUrls.push(url);
                if (url.includes("profileOnlyObsIds=")) {
                    return new Response(
                        JSON.stringify({
                            vehicleId: "CSQU3054383",
                            normalizedVehicleId: "CSQU3054383",
                            matchMode: "equals",
                            passes: [
                                {
                                    occupancyObsId: "obs-pass-1",
                                    radiationProfile: [
                                        {timestampMs: 1794664800000, offsetSeconds: 0, gammaCounts: 210, neutronCounts: 1},
                                        {timestampMs: 1794664802000, offsetSeconds: 2, gammaCounts: 1890, neutronCounts: 2},
                                        {timestampMs: 1794664805000, offsetSeconds: 5, gammaCounts: 240, neutronCounts: 1},
                                    ],
                                },
                                {
                                    occupancyObsId: "obs-pass-2",
                                    radiationProfile: [
                                        {timestampMs: 1794665040000, offsetSeconds: -0.5, gammaCounts: 195, neutronCounts: 2},
                                        {timestampMs: 1794665042500, offsetSeconds: 2.0, gammaCounts: 1920, neutronCounts: 18},
                                        {timestampMs: 1794665045500, offsetSeconds: 5.0, gammaCounts: 230, neutronCounts: 2},
                                    ],
                                },
                            ],
                        }),
                        {status: 200, headers: {"Content-Type": "application/json"}},
                    );
                }
                return new Response(
                    JSON.stringify({
                        vehicleId: "CSQU3054383",
                        normalizedVehicleId: "CSQU3054383",
                        matchMode: "equals",
                        passes: [
                            {
                                laneUid: "urn:osh:lane1",
                                laneName: "Lane1",
                                datastreamId: "ds-occ-lane1",
                                occupancyObsId: "obs-pass-1",
                                occupancyCount: 101,
                                systemType: "Rapiscan RPM",
                                startTime: "2026-11-14T14:00:00.000Z",
                                endTime: "2026-11-14T14:00:06.000Z",
                                samplingTime: "2026-11-14T14:00:00.000Z",
                                durationSeconds: 6,
                                gammaAlarm: true,
                                neutronAlarm: false,
                                alarmCategoryCode: "",
                                alarmStatusLabel: "Gamma",
                                emlAutoReleased: false,
                                maxGammaCount: 1890,
                                maxNeutronCount: 1,
                                neutronBackground: 1,
                                vehicleId: "CSQU3054383",
                                normalizedVehicleId: "CSQU3054383",
                                vehicleIdSource: "ocr",
                                confirmedIsotopes: [],
                                videoPaths: [],
                                webIdAnalyses: [],
                                adjudications: [],
                            },
                            {
                                laneUid: "urn:osh:lane1",
                                laneName: "Lane1",
                                datastreamId: "ds-occ-lane1",
                                occupancyObsId: "obs-pass-2",
                                occupancyCount: 105,
                                systemType: "Rapiscan RPM",
                                startTime: "2026-11-14T14:04:00.000Z",
                                endTime: "2026-11-14T14:04:06.000Z",
                                samplingTime: "2026-11-14T14:04:00.000Z",
                                durationSeconds: 6,
                                gammaAlarm: true,
                                neutronAlarm: true,
                                alarmCategoryCode: "",
                                alarmStatusLabel: "Gamma + Neutron",
                                emlAutoReleased: false,
                                maxGammaCount: 1920,
                                maxNeutronCount: 18,
                                neutronBackground: 1,
                                vehicleId: "CSQU3054383",
                                normalizedVehicleId: "CSQU3054383",
                                vehicleIdSource: "ocr",
                                confirmedIsotopes: [],
                                videoPaths: [],
                                webIdAnalyses: [],
                                adjudications: [],
                            },
                        ],
                    }),
                    {status: 200, headers: {"Content-Type": "application/json"}},
                );
            }
            const copy = new Uint8Array(TINY_JPEG_BYTES.byteLength);
            copy.set(TINY_JPEG_BYTES);
            return new Response(copy, {status: 200, headers: {"Content-Type": "image/jpeg"}});
        };

        const event = new EventTableData(
            1,
            "Lane1",
            {
                occupancyCount: "105",
                startTime: "2026-11-14T14:04:00.000Z",
                endTime: "2026-11-14T14:04:06.000Z",
                maxGamma: 1920,
                maxNeutron: 1,
                gammaAlarm: true,
                neutronAlarm: false,
                adjudicatedIds: [],
                videoPaths: [],
            },
            "obs-pass-2",
            "foi-lane1",
            "Primary Gate",
            false,
        );

        function Harness() {
            const storeRef = useRef(createFullTestStore([primaryNode]));
            const laneMapRef = useRef(laneMap);
            return (
                <AppRouterContext.Provider
                    value={{
                        push: cy.stub(),
                        replace: cy.stub(),
                        prefetch: cy.stub(),
                        back: cy.stub(),
                        forward: cy.stub(),
                        refresh: cy.stub(),
                    } as any}
                >
                    <Provider store={storeRef.current}>
                        <LanguageProvider>
                            <DataSourceContext.Provider
                                value={{
                                    laneMapRef,
                                    laneMapReady: true,
                                    readyLaneNames: new Set(["Lane1"]),
                                    activeViewKey: null,
                                    scopedHref: (href: string) => href,
                                } as any}
                            >
                                <AdjudicationDetail
                                    event={event}
                                    ocrInitialResults={[
                                        {
                                            id: "ocr-pass-2",
                                            time: "2026-11-14T14:04:07.000Z",
                                            occupancyCount: "105",
                                            occupancyObsId: "obs-pass-2",
                                            cameraId: "cam-1",
                                            value: "CSQU3054383",
                                            kind: "container",
                                            confidence: 0.96,
                                            isoChecksumValid: true,
                                            frameCount: 3,
                                            evidenceImagePath: "",
                                        },
                                    ]}
                                    ocrFetchImpl={mockCorrelationFetch}
                                />
                            </DataSourceContext.Provider>
                        </LanguageProvider>
                    </Provider>
                </AppRouterContext.Provider>
            );
        }

        cy.mount(<Harness />);
        cy.get('[data-testid="vehicle-related-passes-banner"]', {timeout: 5000})
            .should("be.visible")
            .and("contain.text", "CSQU 305438 3");
        cy.get('[data-testid="open-vehicle-pass-comparison"]')
            .should("contain.text", "Compare Passes (2)")
            .click();
        cy.get('[data-testid="vehicle-pass-comparison-dialog"]').should("be.visible");
        cy.get('[data-testid="vehicle-load-profiles-btn"]').scrollIntoView().click();
        cy.get('[data-testid="vehicle-profile-chart"]', {timeout: 5000})
            .should("be.visible")
            .and("contain.text", "Peak G: 1920 / N: 18");
        cy.get('[data-testid="gamma-poly-1"]')
            .should("have.attr", "points")
            .and((pts: string) => {
                // Peak 1920 sample must map near top of chart (y = 20.0), not flatlined at y = 152.0
                expect(pts).to.include(",20.0");
            });
        cy.get('[data-testid="neutron-poly-1"]').should("exist");
        cy.wrap(null).then(() => {
            expect(observedSearchUrls.some(u => u.includes("startTime="))).to.equal(true);
            expect(
                observedSearchUrls.some(u => decodeURIComponent(u).includes("profileOnlyObsIds=obs-pass-1,obs-pass-2")),
            ).to.equal(true);
        });
    });
});
