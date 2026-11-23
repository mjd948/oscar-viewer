import React from "react";
import { LanguageProvider } from "../../src/app/contexts/LanguageContext";
import LaneWebRelayDialog from "../../src/app/_components/webrelay/LaneWebRelayDialog";
import {
    getContextualVideoGuidesForPath,
    getVideoGuideBySlug,
} from "../../src/lib/data/oscar/VideoGuidesCatalog";

describe("Per-Lane RPM Lights & Sound Control (WebRelay-Quad) Dialog", () => {
    beforeEach(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.localStorage.setItem("language", "en");
    });

    it("registers Video Guide #29 contextually on /health and /lane-view", () => {
        const guide29 = getVideoGuideBySlug("29-lane-webrelay-lights-and-sound");
        expect(guide29).to.not.equal(undefined);
        expect(guide29?.badge).to.equal("29");

        const healthSlugs = getContextualVideoGuidesForPath("/health").map((g) => g.slug);
        const laneViewSlugs = getContextualVideoGuidesForPath("/lane-view").map((g) => g.slug);
        expect(healthSlugs).to.include("29-lane-webrelay-lights-and-sound");
        expect(laneViewSlugs).to.include("29-lane-webrelay-lights-and-sound");
    });

    it("opens as a native modal <dialog>, renders R1-R4 telemetry, executes manual controls, tests connection, and saves settings", () => {
        const lane01Armed = {
            laneUid: "urn:osh:system:lane:lane-01",
            laneName: "Lane01",
            enabled: true,
            mode: "AUTO",
            primaryOnline: true,
            ancillaryEnabled: false,
            ancillaryOnline: false,
            primaryHost: "198.51.100.21",
            primaryPort: 80,
            ancillaryHost: "",
            ancillaryPort: 80,
            username: "admin",
            passwordConfigured: true,
            alarmPulseSeconds: 5,
            suppressExtendedOccupancyGamma: true,
            soundOnNeutronAlarm: false,
            pollIntervalSeconds: 10,
            manualLatchActive: false,
            triggeredAlarmCount: 3,
            suppressedEmlCount: 7,
            suppressedExtendedOccupancyCount: 2,
            lastActionSummary: "Set operating mode to AUTO",
            lastActionAt: "2026-11-21T20:00:00Z",
            primaryState: {
                online: true,
                relay1: 1,
                relay2: 1,
                relay3: 0,
                relay4: 0,
                latencyMs: 1,
                endpointPath: "/stateFull.xml",
                error: "",
            },
            ancillaryState: {
                online: false,
                relay1: 0,
                relay2: 0,
                relay3: 0,
                relay4: 0,
                latencyMs: 0,
                endpointPath: "",
                error: "Disabled",
            },
        };

        const lane02Disabled = {
            laneUid: "urn:osh:system:lane:lane-02",
            laneName: "Lane02",
            enabled: false,
            mode: "AUTO",
            primaryOnline: false,
            ancillaryEnabled: false,
            ancillaryOnline: false,
            primaryHost: "",
            primaryPort: 80,
            ancillaryHost: "",
            ancillaryPort: 80,
            username: "",
            passwordConfigured: false,
            alarmPulseSeconds: 5,
            suppressExtendedOccupancyGamma: true,
            soundOnNeutronAlarm: false,
            pollIntervalSeconds: 10,
            manualLatchActive: false,
            triggeredAlarmCount: 0,
            suppressedEmlCount: 0,
            suppressedExtendedOccupancyCount: 0,
            lastActionSummary: "",
            lastActionAt: "",
        };

        cy.intercept("GET", "/sensorhub/oscar/webrelay/status*", {
            statusCode: 200,
            body: {
                isAdmin: true,
                lanes: [lane01Armed, lane02Disabled],
            },
        }).as("loadStatus");

        cy.intercept("POST", "/sensorhub/oscar/webrelay/action", (req) => {
            const body = req.body;
            if (body.action === "test-connection") {
                req.reply({
                    statusCode: 200,
                    body: {
                        ok: true,
                        host: body.host,
                        port: body.port,
                        endpointPath: "/stateFull.xml",
                        latencyMs: 2,
                        relay1: 1,
                        relay2: 1,
                        relay3: 0,
                        relay4: 0,
                    },
                });
                return;
            }
            if (body.action === "control" && body.command === "latch-gamma") {
                const updated = {
                    ...lane01Armed,
                    manualLatchActive: true,
                    lastActionSummary: "Latched ON: Gamma Light & Sound",
                    primaryState: { ...lane01Armed.primaryState, relay3: 1 },
                };
                req.reply({
                    statusCode: 200,
                    body: { ok: true, lane: updated, lanes: [updated, lane02Disabled] },
                });
                return;
            }
            if (body.action === "save-config") {
                const saved = {
                    ...lane01Armed,
                    mode: body.mode,
                    alarmPulseSeconds: body.alarmPulseSeconds,
                    suppressExtendedOccupancyGamma: body.suppressExtendedOccupancyGamma,
                };
                req.reply({
                    statusCode: 200,
                    body: { ok: true, lane: saved, lanes: [saved, lane02Disabled] },
                });
                return;
            }
            req.reply({
                statusCode: 200,
                body: {
                    ok: true,
                    lane: { ...lane01Armed, lastActionSummary: `Executed ${body.command}` },
                    lanes: [lane01Armed, lane02Disabled],
                },
            });
        }).as("webrelayAction");

        const onClose = cy.stub().as("onCloseStub");
        cy.viewport(1280, 900);
        cy.mount(
            <LanguageProvider>
                <LaneWebRelayDialog
                    open
                    initialLaneNameOrUid="Lane01"
                    onClose={onClose}
                />
            </LanguageProvider>
        );

        cy.wait("@loadStatus");

        // Native modal <dialog> without redundant role="dialog" or aria-modal
        cy.get('[data-testid="lane-webrelay-dialog"]').should(($dlg) => {
            expect($dlg[0]?.hasAttribute("open")).to.equal(true);
            expect($dlg[0]?.hasAttribute("role")).to.equal(false);
            expect($dlg[0]?.hasAttribute("aria-modal")).to.equal(false);
        });

        // R1 & R2 armed, R3 & R4 idle, suppression counters visible
        cy.get('[data-testid="webrelay-primary-unit-status"]').should("contain.text", "/stateFull.xml");
        cy.get('[data-testid="webrelay-primary-unit-r1"]').should("contain.text", "ARMED");
        cy.get('[data-testid="webrelay-primary-unit-r3"]').should("contain.text", "IDLE");
        cy.contains("Suppressed EML (9999): 7").should("be.visible");
        cy.contains("Suppressed Ext-Occ (9998): 2").should("be.visible");

        // Latch Gamma + Sound toggles aria-pressed="true" and R3 -> ACTIVE
        cy.get('[data-testid="webrelay-btn-latch-gamma"]')
            .should("have.attr", "aria-pressed", "false")
            .click();
        cy.wait("@webrelayAction").its("request.body").should("deep.include", {
            action: "control",
            command: "latch-gamma",
        });
        cy.get('[data-testid="webrelay-btn-latch-gamma"]').should("have.attr", "aria-pressed", "true");
        cy.get('[data-testid="webrelay-primary-unit-r3"]').should("contain.text", "ACTIVE");

        // Test connection button uses type="button" without submitting the form
        cy.get('[data-testid="webrelay-btn-test-primary"]').click();
        cy.wait("@webrelayAction").its("request.body").should("deep.include", {
            action: "test-connection",
            host: "198.51.100.21",
        });
        cy.get('[data-testid="webrelay-status-banner"]').should("contain.text", "/stateFull.xml");

        // Switch radio to MUTED and submit form
        cy.get('[data-testid="webrelay-mode-muted"]').check();
        cy.get('[data-testid="webrelay-input-pulse-seconds"]').clear().type("8");
        cy.get('[data-testid="webrelay-btn-save"]').click();
        cy.wait("@webrelayAction").its("request.body").should("deep.include", {
            action: "save-config",
            mode: "MUTED",
            alarmPulseSeconds: 8,
        });
        cy.get('[data-testid="webrelay-status-banner"]').should(
            "contain.text",
            "Saved WebRelay settings for Lane01."
        );

        // Close button closes native dialog and triggers onClose
        cy.get('[data-testid="webrelay-btn-close"]').click();
        cy.get("@onCloseStub").should("have.been.calledOnce");
    });
});
