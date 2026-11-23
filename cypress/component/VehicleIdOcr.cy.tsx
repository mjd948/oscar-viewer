import React, {useRef, useState} from "react";
import {configureStore} from "@reduxjs/toolkit";
import {Provider} from "react-redux";
import {LanguageProvider} from "../../src/app/contexts/LanguageContext";
import {DataSourceContext} from "../../src/app/contexts/DataSourceContext";
import AdjudicationDetail from "../../src/app/_components/adjudication/AdjudicationDetail";
import {EventTableData} from "../../src/lib/data/oscar/TableHelpers";
import {
    computeIso6346CheckDigit,
    formatIso6346,
    isValidIso6346,
} from "../../src/lib/data/oscar/adjudication/Iso6346";
import {
    dedupeOcrResults,
    IVehicleOcrResult,
    selectAutoFillCandidate,
    VehicleOcrResult,
} from "../../src/lib/data/oscar/adjudication/VehicleOcr";
import AppReducer from "../../src/lib/state/Slice";
import OSHReducer from "../../src/lib/state/OSHSlice";
import EventDataReducer from "../../src/lib/state/EventDataSlice";
import OSCARClientReducer from "../../src/lib/state/OSCARClientSlice";
import OSCARLaneReducer from "../../src/lib/state/OSCARLaneSlice";
import EventDetailsReducer from "../../src/lib/state/EventDetailsSlice";
import EventPreviewReducer from "../../src/lib/state/EventPreviewSlice";
import LaneViewReducer from "../../src/lib/state/LaneViewSlice";

function createTestStore() {
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
        middleware: (getDefaultMiddleware) =>
            getDefaultMiddleware({serializableCheck: false}),
    });
}

function makeEvent(params: {
    id: number;
    laneId: string;
    occupancyCount: string;
    startTime: string;
    endTime: string;
    occupancyObsId?: string;
}): EventTableData {
    return new EventTableData(
        params.id,
        params.laneId,
        {
            occupancyCount: params.occupancyCount,
            startTime: params.startTime,
            endTime: params.endTime,
            maxGamma: 480,
            maxNeutron: 1,
            gammaAlarm: true,
            neutronAlarm: false,
            adjudicatedIds: [],
            videoPaths: [],
        },
        params.occupancyObsId ?? "",
        `foi-${params.laneId}`,
        "Node-A",
        false,
    );
}

const TINY_JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

const mockCropFetch: typeof fetch = async () => {
    const copy = new Uint8Array(TINY_JPEG_BYTES.byteLength);
    copy.set(TINY_JPEG_BYTES);
    return new Response(copy, {
        status: 200,
        headers: {"Content-Type": "image/jpeg"},
    });
};

function AdjudicationHarness({
    initialEvent,
    initialOcr,
}: {
    initialEvent: EventTableData;
    initialOcr: readonly IVehicleOcrResult[];
}) {
    const [event, setEvent] = useState<EventTableData>(initialEvent);
    const [ocr, setOcr] = useState<readonly IVehicleOcrResult[]>(initialOcr);
    const storeRef = useRef(createTestStore());
    const laneMapRef = useRef(new Map());

    (window as any).__setTestOcr = setOcr;
    (window as any).__setTestEvent = setEvent;

    return (
        <Provider store={storeRef.current}>
            <LanguageProvider>
                <DataSourceContext.Provider
                    value={{
                        laneMapRef,
                        laneMapReady: true,
                        readyLaneNames: new Set([event.laneId]),
                        activeViewKey: null,
                        scopedHref: (href: string) => href,
                    } as any}
                >
                    <AdjudicationDetail
                        event={event}
                        ocrInitialResults={ocr}
                        ocrFetchImpl={mockCropFetch}
                    />
                </DataSourceContext.Provider>
            </LanguageProvider>
        </Provider>
    );
}

describe("Vehicle ID OCR ISO 6346 validation, threshold-hybrid auto-fill, and chip selection", () => {
    beforeEach(() => {
        window.localStorage.clear();
        window.localStorage.setItem("language", "en");
    });

    it("validates ISO 6346 container check digits, deduplicates candidates, and enforces the threshold-hybrid auto-fill policy", () => {
        expect(computeIso6346CheckDigit("CSQU305438")).to.equal(3);
        expect(isValidIso6346("CSQU3054383")).to.equal(true);
        expect(isValidIso6346("CSQU 305438-3")).to.equal(true);
        expect(isValidIso6346("CSQU3054389")).to.equal(false);
        expect(formatIso6346("CSQU3054383")).to.equal("CSQU 305438 3");

        const parsedObs = VehicleOcrResult.fromObservation({
            id: "ocr-obs-1",
            resultTime: "2026-11-14T00:00:05Z",
            result: {
                sampleTime: "2026-11-14T00:00:05.000Z",
                occupancyObsId: "obs-42",
                idType: "container",
                value: "csqu 305438-3",
                normalizedValue: "CSQU3054383",
                checksumValid: true,
                confidence: 0.74,
                readCount: 2,
                cameraUid: "urn:osh:sensor:ffmpeg:cam50",
                frameTime: "2026-11-14T00:00:03.500Z",
                evidenceImagePath: "ocr/crops/2026-11-14/obs-42_CSQU3054383.jpg",
            },
        });
        expect(parsedObs).to.not.equal(null);
        expect(parsedObs!.value).to.equal("CSQU3054383");
        expect(parsedObs!.kind).to.equal("container");
        expect(parsedObs!.isoChecksumValid).to.equal(true);
        expect(parsedObs!.frameCount).to.equal(2);
        expect(parsedObs!.cameraId).to.equal("urn:osh:sensor:ffmpeg:cam50");

        // Single-frame 10-character synthesized check digits must stay clickable chips without auto-filling.
        const singleFrameSynthesized = VehicleOcrResult.fromObservation({
            id: "ocr-obs-synth",
            resultTime: "2026-11-14T00:00:06Z",
            result: {
                occupancyObsId: "obs-42",
                idType: "container",
                value: "EMCU 385408",
                normalizedValue: "EMCU3854084",
                checksumValid: true,
                confidence: 0.94,
                readCount: 1,
            },
        });
        expect(singleFrameSynthesized).to.not.equal(null);
        expect(singleFrameSynthesized!.value).to.equal("EMCU3854084");
        expect(singleFrameSynthesized!.isoChecksumValid).to.equal(false);
        expect(selectAutoFillCandidate([singleFrameSynthesized!])).to.equal(null);

        const lowPlate: IVehicleOcrResult = {
            id: "p-low",
            time: "2026-11-14T00:00:06Z",
            occupancyCount: "42",
            occupancyObsId: "obs-42",
            cameraId: "cam_50",
            value: "TN8842B",
            kind: "plate",
            confidence: 0.72,
            isoChecksumValid: false,
            frameCount: 1,
            evidenceImagePath: "",
        };
        const invalidContainer: IVehicleOcrResult = {
            id: "c-bad",
            time: "2026-11-14T00:00:06Z",
            occupancyCount: "42",
            occupancyObsId: "obs-42",
            cameraId: "cam_50",
            value: "CSQU3054389",
            kind: "container",
            confidence: 0.96,
            isoChecksumValid: false,
            frameCount: 3,
            evidenceImagePath: "",
        };
        // Neither an invalid-checksum container nor a <0.85 plate should auto-fill.
        expect(selectAutoFillCandidate([lowPlate, invalidContainer])).to.equal(null);

        const highPlate: IVehicleOcrResult = {
            ...lowPlate,
            id: "p-high",
            value: "TN9911K",
            confidence: 0.91,
        };
        expect(selectAutoFillCandidate([lowPlate, highPlate])?.value).to.equal("TN9911K");

        // ISO 6346 checksum-valid container takes priority over even a higher-confidence plate.
        const deduped = dedupeOcrResults([highPlate, parsedObs!]);
        expect(deduped[0].value).to.equal("CSQU3054383");
        expect(selectAutoFillCandidate(deduped)?.value).to.equal("CSQU3054383");
    });

    it("auto-fills ISO 6346 checksum-valid containers and lets operators switch via suggestion chips", () => {
        const event = makeEvent({
            id: 1,
            laneId: "Lane50",
            occupancyCount: "501",
            startTime: "2026-11-14T00:10:00.000Z",
            endTime: "2026-11-14T00:10:06.000Z",
            occupancyObsId: "obs-501",
        });

        const candidates: IVehicleOcrResult[] = [
            {
                id: "ocr-c1",
                time: "2026-11-14T00:10:07.000Z",
                occupancyCount: "501",
                occupancyObsId: "obs-501",
                cameraId: "cam_50",
                value: "CSQU3054383",
                kind: "container",
                confidence: 0.78,
                isoChecksumValid: true,
                frameCount: 3,
                evidenceImagePath: "ocr/crops/2026-11-14/obs-501_CSQU3054383.jpg",
            },
            {
                id: "ocr-p1",
                time: "2026-11-14T00:10:07.500Z",
                occupancyCount: "501",
                occupancyObsId: "obs-501",
                cameraId: "cam_50",
                value: "TN8842B",
                kind: "plate",
                confidence: 0.72,
                isoChecksumValid: false,
                frameCount: 1,
                evidenceImagePath: "",
            },
        ];

        cy.mount(<AdjudicationHarness initialEvent={event} initialOcr={candidates} />);

        cy.get('input[name="vehicleId"]')
            .should("have.value", "CSQU3054383")
            .and("have.attr", "autocorrect", "off")
            .and("have.attr", "autocapitalize", "none")
            .and("have.attr", "spellcheck", "false");

        cy.contains("Auto-filled from lane OCR").should("be.visible");
        cy.get('[data-testid="ocr-chip-CSQU3054383"]')
            .should("contain.text", "CSQU 305438 3")
            .and("have.attr", "type", "button");

        // Clicking the alternate plate suggestion chip replaces the value and clears the auto-fill hint.
        cy.get('[data-testid="ocr-chip-TN8842B"]').click();
        cy.get('input[name="vehicleId"]').should("have.value", "TN8842B");
        cy.contains("Auto-filled from lane OCR").should("not.exist");
    });

    it("does not auto-fill low-confidence plates, respects operator edits across live UUID resolution, and resets on new occupancy", () => {
        const liveEvent = makeEvent({
            id: 2,
            laneId: "Lane50",
            occupancyCount: "502",
            startTime: "2026-11-14T00:12:00.000Z",
            endTime: "2026-11-14T00:12:05.000Z",
            occupancyObsId: "",
        });

        const lowConfidencePlate: IVehicleOcrResult = {
            id: "ocr-low",
            time: "2026-11-14T00:12:06.000Z",
            occupancyCount: "502",
            occupancyObsId: "",
            cameraId: "cam_50",
            value: "TN7712A",
            kind: "plate",
            confidence: 0.72,
            isoChecksumValid: false,
            frameCount: 1,
            evidenceImagePath: "",
        };

        cy.mount(<AdjudicationHarness initialEvent={liveEvent} initialOcr={[lowConfidencePlate]} />);

        // Low-confidence plate renders chip without auto-filling.
        cy.get('[data-testid="ocr-chip-TN7712A"]').should("be.visible");
        cy.get('input[name="vehicleId"]').should("have.value", "");

        // Operator types a manual Vehicle ID before late high-confidence OCR and before live UUID resolves.
        cy.get('input[name="vehicleId"]').type("MANUAL-99");
        cy.get('input[name="vehicleId"]').should("have.value", "MANUAL-99");

        // Late-arriving ISO-valid container OCR must NOT overwrite operator input.
        cy.window().then((win: any) => {
            win.__setTestOcr([
                lowConfidencePlate,
                {
                    id: "ocr-late-c",
                    time: "2026-11-14T00:12:09.000Z",
                    occupancyCount: "502",
                    occupancyObsId: "obs-502",
                    cameraId: "cam_50",
                    value: "CSQU3054383",
                    kind: "container",
                    confidence: 0.95,
                    isoChecksumValid: true,
                    frameCount: 3,
                    evidenceImagePath: "",
                },
            ]);
        });
        cy.get('[data-testid="ocr-chip-CSQU3054383"]').should("be.visible");
        cy.get('input[name="vehicleId"]').should("have.value", "MANUAL-99");

        // Live occupancyObsId resolution on the SAME occupancy must NOT clear operator input.
        cy.window().then((win: any) => {
            const resolvedSameOccupancy = makeEvent({
                id: 2,
                laneId: "Lane50",
                occupancyCount: "502",
                startTime: "2026-11-14T00:12:00.000Z",
                endTime: "2026-11-14T00:12:05.000Z",
                occupancyObsId: "obs-502",
            });
            win.__setTestEvent(resolvedSameOccupancy);
        });
        cy.get('input[name="vehicleId"]').should("have.value", "MANUAL-99");

        // Navigating to a NEW occupancy resets touched state and auto-fills its high-confidence plate.
        cy.window().then((win: any) => {
            const nextOccupancy = makeEvent({
                id: 3,
                laneId: "Lane50",
                occupancyCount: "503",
                startTime: "2026-11-14T00:15:00.000Z",
                endTime: "2026-11-14T00:15:06.000Z",
                occupancyObsId: "obs-503",
            });
            win.__setTestEvent(nextOccupancy);
            win.__setTestOcr([
                {
                    id: "ocr-next-plate",
                    time: "2026-11-14T00:15:07.000Z",
                    occupancyCount: "503",
                    occupancyObsId: "obs-503",
                    cameraId: "cam_50",
                    value: "TN9911K",
                    kind: "plate",
                    confidence: 0.92,
                    isoChecksumValid: false,
                    frameCount: 2,
                    evidenceImagePath: "",
                },
            ]);
        });
        cy.get('input[name="vehicleId"]').should("have.value", "TN9911K");
        cy.contains("Auto-filled from lane OCR").should("be.visible");
    });

    it("auto-populates Vehicle ID once readyLaneNames finishes hydrating a late-loading OCR lane on direct Event Details links", () => {
        const directEvent = makeEvent({
            id: 42,
            laneId: "Lane42",
            occupancyCount: "942",
            startTime: "2026-11-19T00:41:20.000Z",
            endTime: "2026-11-19T00:41:26.000Z",
            occupancyObsId: "0i9btj4704",
        });

        function DelayedLaneHydrationHarness() {
            const storeRef = useRef(createTestStore());
            const laneMapRef = useRef<Map<string, any>>(new Map());
            const [readyLanes, setReadyLanes] = useState<Set<string>>(() => new Set(["Lane01"]));

            (window as any).__hydrateLane42 = () => {
                laneMapRef.current.set("Lane42", {
                    laneName: "Lane42",
                    parentNode: {
                        id: "node-1",
                        address: "127.0.0.1",
                        port: 8282,
                        isSecure: false,
                        isDefaultNode: true,
                        oshPathRoot: "/sensorhub",
                        bucketsEndpoint: "/buckets",
                        getConnectedSystemsEndpoint: () => "https://node.example/sensorhub/api",
                        getBasicAuthHeader: () => ({}),
                    },
                    datastreams: [
                        {
                            properties: {
                                id: "ds-ocr-42",
                                outputName: "vehicleOcr",
                                observedProperties: [{definition: "http://www.opengis.net/def/VehicleOCR"}],
                            },
                            searchObservations: async () => ({
                                nextPage: async () => [
                                    {
                                        id: "ocr-obs-42",
                                        resultTime: "2026-11-19T00:41:27.561Z",
                                        result: {
                                            value: "FCI0971023 5",
                                            normalizedValue: "FCIU9710235",
                                            idType: "container",
                                            checksumValid: true,
                                            confidence: 0.9478,
                                            readCount: 1,
                                            occupancyObsId: "0i9btj4704",
                                            sampleTime: "2026-11-19T00:41:27.561Z",
                                            evidenceImagePath: "",
                                        },
                                    },
                                ],
                            }),
                        },
                    ],
                    datastreamSourceMap: new Map(),
                });
                setReadyLanes(new Set(["Lane01", "Lane42"]));
            };

            return (
                <Provider store={storeRef.current}>
                    <LanguageProvider>
                        <DataSourceContext.Provider
                            value={{
                                laneMapRef,
                                laneMapReady: true,
                                readyLaneNames: readyLanes,
                                activeViewKey: null,
                                scopedHref: (href: string) => href,
                            } as any}
                        >
                            <AdjudicationDetail event={directEvent} ocrFetchImpl={mockCropFetch} />
                        </DataSourceContext.Provider>
                    </LanguageProvider>
                </Provider>
            );
        }

        cy.mount(<DelayedLaneHydrationHarness />);
        cy.get('input[name="vehicleId"]').should("have.value", "");

        cy.window().then((win: any) => {
            win.__hydrateLane42();
        });
        cy.get('input[name="vehicleId"]').should("have.value", "FCIU9710235");
        cy.contains("Auto-filled from lane OCR").should("be.visible");
    });
});
