import React from "react";
import { LanguageProvider } from "../../src/app/contexts/LanguageContext";
import HelpDialog from "../../src/app/_components/HelpDialog";
import TrainingCoachDock from "../../src/app/_components/sandbox/TrainingCoachDock";
import { TRAINING_LABS, TRAINING_TRACKS } from "../../src/lib/data/oscar/TrainingCurriculum";
import {
    resolveSandboxLaunchTarget,
    SandboxActiveStatus,
    SANDBOX_WATERMARK_TEXT,
    setTrainingSandboxRuntimeActiveForTests,
} from "../../src/lib/data/oscar/TrainingSandboxApi";
import { getVideoGuideBySlug, VIDEO_GUIDES_CATALOG } from "../../src/lib/data/oscar/VideoGuidesCatalog";

describe("Hands-On Training Sandbox Coach, Curriculum & Help Launcher", () => {
    beforeEach(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.localStorage.setItem("language", "en");
        setTrainingSandboxRuntimeActiveForTests(false);
    });

    it("maps all 13 curriculum labs across 3 role tracks to valid 31-guide catalog entries", () => {
        expect(VIDEO_GUIDES_CATALOG.length).to.equal(31);
        expect(getVideoGuideBySlug("30-zero-login-github-system-update")?.badge).to.equal("30");
        expect(getVideoGuideBySlug("31-bare-metal-autoinstall-usb-creator")?.badge).to.equal("31");
        const guide28 = getVideoGuideBySlug("28-hands-on-training-sandbox");
        expect(guide28).to.not.equal(undefined);
        expect(guide28?.badge).to.equal("28");
        const guide29 = getVideoGuideBySlug("29-lane-webrelay-lights-and-sound");
        expect(guide29).to.not.equal(undefined);
        expect(guide29?.badge).to.equal("29");

        expect(TRAINING_TRACKS.map((t) => t.id)).to.deep.equal([
            "operator",
            "supervisor",
            "administrator",
        ]);
        expect(TRAINING_LABS.length).to.equal(13);
        for (const lab of TRAINING_LABS) {
            const matchedGuide = getVideoGuideBySlug(lab.videoGuideSlug);
            expect(matchedGuide, `Video guide for ${lab.id}`).to.not.equal(undefined);
            expect(lab.screenshotFile).to.match(/\.png$/);
        }
    });

    it("renders accessible non-exclusive accordions, explicit media dimensions, scenario injection, and outcome auto-verification", () => {
        cy.intercept("POST", "/sensorhub/oscar/sandbox/inject", {
            statusCode: 200,
            body: { ok: true, message: "Started practice scenario 'fault_gamma_high' on DemoLane01" },
        }).as("injectScenario");

        cy.intercept("POST", "/sensorhub/oscar/sandbox/stage-track", (req) => {
            req.reply({
                statusCode: 200,
                body: {
                    sandboxMode: true,
                    watermark: SANDBOX_WATERMARK_TEXT,
                    activeTrack: req.body.track,
                    stageStatusMessage: `Staged ${req.body.track} track`,
                    verification: {
                        configuredLaneCount: req.body.track === "administrator" ? 0 : 1,
                        onlineLaneCount: req.body.track === "administrator" ? 0 : 1,
                        lanesWithCameraCount: 1,
                        lanesWithOcrCount: 1,
                        operationalViewCount: 1,
                        totalOccupancies: 2,
                        gammaAlarmCount: 1,
                        neutronAlarmCount: 0,
                        emlCode9999Count: 0,
                        extendedCode9998Count: 0,
                        activeFaultOrTamper: false,
                        operatorAdjudicatedCount: 0,
                        adjudicatedWithEvidenceCount: 0,
                        adjudicatedWithVehicleIdCount: 0,
                        multiPassVehicleCount: 0,
                        generatedReportCount: 0,
                        offlineMapActive: false,
                        policyPackActive: false,
                        cargoUffEnabled: true,
                        cargoUffIndexedCount: 2,
                    },
                },
            });
        }).as("stageTrack");

        const initialStatus: SandboxActiveStatus = {
            sandboxMode: true,
            watermark: SANDBOX_WATERMARK_TEXT,
            activeTrack: "operator",
            remainingSeconds: 7100,
            ttlMinutes: 120,
            verification: {
                configuredLaneCount: 1,
                onlineLaneCount: 1,
                lanesWithCameraCount: 1,
                lanesWithOcrCount: 1,
                operationalViewCount: 1,
                totalOccupancies: 1,
                gammaAlarmCount: 1,
                neutronAlarmCount: 0,
                emlCode9999Count: 0,
                extendedCode9998Count: 0,
                activeFaultOrTamper: false,
                operatorAdjudicatedCount: 0,
                adjudicatedWithEvidenceCount: 0,
                adjudicatedWithVehicleIdCount: 0,
                multiPassVehicleCount: 0,
                generatedReportCount: 0,
                offlineMapActive: false,
                policyPackActive: false,
                cargoUffEnabled: true,
                cargoUffIndexedCount: 2,
            },
        };

        const Wrapper = () => {
            const [st, setSt] = React.useState<SandboxActiveStatus>(initialStatus);
            const [splitOpen, setSplitOpen] = React.useState(false);
            return (
                <LanguageProvider>
                    <div>
                        <button type="button" data-testid="nav-item-health">
                            Health Target
                        </button>
                        <button type="button" data-testid="nav-item-dashboard">
                            Dashboard Target
                        </button>
                        <button type="button" data-testid="nav-item-report">
                            Report Target
                        </button>
                        <button type="button" data-testid="nav-item-users">
                            Users Target
                        </button>
                        <button type="button" data-testid="nav-item-extensions">
                            Extensions Target
                        </button>
                        <button type="button" data-testid="navbar-help-button">
                            Help Target
                        </button>
                        <TrainingCoachDock
                            status={st}
                            onStatusUpdated={setSt}
                            onRefreshRequested={() => {}}
                            onNavigateRoute={() => {}}
                            splitAdminOpen={splitOpen}
                            onToggleSplitAdmin={setSplitOpen}
                            onMinimize={() => {}}
                        />
                    </div>
                </LanguageProvider>
            );
        };

        cy.mount(<Wrapper />);

        // Verify Lab 1.1 auto-verified because onlineLaneCount >= 1 && totalOccupancies >= 1
        cy.get('[data-testid="training-active-lab-status"]').should("contain.text", "Auto-Verified");
        cy.get('[data-testid="coach-sandbox-session-banner"]')
            .should("be.visible")
            .and("contain.text", "Auto-shutdown in");

        // Verify zero headings inside <summary> and non-exclusive <details> (no name attribute)
        cy.get(".oscar-coach-accordion").should("have.length", 3).each(($details) => {
            expect($details.attr("name")).to.equal(undefined);
            expect($details.find("summary h1, summary h2, summary h3, summary h4, summary h5, summary h6").length).to.equal(0);
        });

        // Open video & screenshot accordions simultaneously (non-exclusive)
        cy.get(".oscar-coach-accordion").eq(1).find("summary").click();
        cy.get(".oscar-coach-accordion").eq(2).find("summary").click();
        cy.get(".oscar-coach-accordion[open]").should("have.length", 3);

        cy.get('[data-testid="training-coach-video"]')
            .should("have.attr", "width", "1920")
            .and("have.attr", "height", "1080")
            .and("have.attr", "preload", "none");
        cy.get('[data-testid="training-coach-video"] track').should("have.length", 4);
        cy.get('[data-testid="training-coach-video"] track[srclang="en"]')
            .should("have.attr", "kind", "captions")
            .and("have.prop", "default", true);
        cy.get('[data-testid="training-coach-video"] track[srclang="es"]')
            .should("have.attr", "src", "/video-guides/captions/es/15-status-of-health-and-site-map.vtt");
        cy.get('[data-testid="training-coach-video"] track[srclang="fr"]')
            .should("have.attr", "src", "/video-guides/captions/fr/15-status-of-health-and-site-map.vtt");
        cy.get('[data-testid="training-coach-video"] track[srclang="el"]')
            .should("have.attr", "src", "/video-guides/captions/el/15-status-of-health-and-site-map.vtt");
        cy.get('[data-testid="training-coach-screenshot"]')
            .should("have.attr", "width", "1920")
            .and("have.attr", "height", "1080")
            .and("have.attr", "loading", "lazy");

        // Verify Lab 1.1 inline visual symbol introductions + Status of Health / Dashboard / Help spotlight buttons
        cy.get('[data-testid="training-coach-dock"]')
            .should("contain.text", "heart-pulse monitor icon")
            .and("contain.text", "four-tile grid icon");
        cy.get('[data-testid="training-coach-dock"] .oscar-inline-platform-icon[data-platform-icon="health"]')
            .should("exist");
        cy.get('[data-testid="training-coach-dock"] .oscar-inline-platform-icon[data-platform-icon="dashboard"]')
            .should("exist");

        // Inject scenario & spotlight Status of Health + Help buttons
        cy.get('[data-testid="training-inject-fault_gamma_high"]').click();
        cy.wait("@injectScenario");
        cy.get('[data-testid="training-spotlight-btn"]')
            .should("contain.text", "Highlight Status of Health Icon")
            .click();
        cy.get('[data-testid="nav-item-health"]').should("have.attr", "data-oscar-coach-spotlight", "true");
        cy.get('[data-testid="training-spotlight-btn-dashboard"]')
            .should("contain.text", "Highlight Dashboard Icon")
            .click();
        cy.get('[data-testid="nav-item-dashboard"]').should("have.attr", "data-oscar-coach-spotlight", "true");
        cy.get('[data-testid="training-spotlight-btn-help"]')
            .should("contain.text", "Highlight Help (?) Icon")
            .click();
        cy.get('[data-testid="navbar-help-button"]').should("have.attr", "data-oscar-coach-spotlight", "true");

        // Switch to Administrator track, verify Lab 3.3 / 3.4 icon buttons & inline symbols, and toggle Split-Pane Admin
        cy.get('[data-testid="training-track-btn-administrator"]').click();
        cy.wait("@stageTrack");
        cy.get('[data-testid="training-toggle-split-admin"]').should("contain.text", "Open Split-Pane SensorHub Admin").click();
        cy.get('[data-testid="training-toggle-split-admin"]').should("contain.text", "Return to Viewer Page");
        cy.get('[data-testid="training-lab-chip-adm-3"]').click();
        cy.get('[data-testid="training-coach-dock"]').should("contain.text", "person-and-gear icon");
        cy.get('[data-testid="training-spotlight-btn"]')
            .should("contain.text", "Highlight Users & Access Icon")
            .click();
        cy.get('[data-testid="nav-item-users"]').should("have.attr", "data-oscar-coach-spotlight", "true");
        cy.get('[data-testid="training-lab-chip-adm-4"]').click();
        cy.get('[data-testid="training-coach-dock"]').should("contain.text", "puzzle-piece icon");
        cy.get('[data-testid="training-spotlight-btn"]')
            .should("contain.text", "Highlight Runtime Extensions Icon")
            .click();
        cy.get('[data-testid="nav-item-extensions"]').should("have.attr", "data-oscar-coach-spotlight", "true");
    });

    it("surfaces the Training Sandbox launcher and Video Guide #28 inside Help (?)", () => {
        cy.intercept("GET", "/sensorhub/oscar/sandbox/active", {
            statusCode: 200,
            body: { sandboxMode: false },
        });
        cy.intercept("GET", "/sensorhub/oscar/sandbox/host", {
            statusCode: 200,
            body: {
                agentActive: true,
                sandboxRunning: false,
                httpsPort: 8444,
                ttlMinutes: 120,
                linuxStartCommand: "sudo bash oscar.sh sandbox start --port 8444",
                linuxStopCommand: "sudo bash oscar.sh sandbox stop",
                linuxEnableBridgeCommand: "sudo bash oscar.sh sandbox enable-ui-bridge",
                windowsStartCommand: ".\\oscar.bat sandbox start --port 8444",
                windowsStopCommand: ".\\oscar.bat sandbox stop",
                windowsEnableBridgeCommand: ".\\oscar.bat sandbox enable-ui-bridge",
            },
        });

        cy.mount(
            <LanguageProvider>
                <HelpDialog
                    open={true}
                    onClose={() => {}}
                    activePathname="/"
                    nodes={[]}
                    stateSummary={{
                        configuredNodeCount: 1,
                        activeViewKey: null,
                        viewError: null,
                        unreadAlarmCount: 0,
                        authenticatedUserPresent: true,
                    }}
                />
            </LanguageProvider>,
        );

        cy.contains("OSCAR 3.11.10 Operator Quick Guide & Glossary").should("be.visible");
        cy.contains('[role="tab"]', "Manual & Video Guides").click();
        cy.get('[data-testid="help-training-sandbox-card"]').should("be.visible");
        cy.get('[data-testid="help-sandbox-launch-btn"]').should("be.visible");
        cy.get('[data-testid="help-video-track-C"] > summary').click();
        cy.get('[data-testid="help-catalog-watch-28"]').should("be.visible").click();
        cy.get('[data-testid="help-video-element"] source')
            .should("have.attr", "src", "/video-guides/videos/28-hands-on-training-sandbox.mp4");
    });

    it("supports safe Read-Only Refresher Mode on live console (:443) with orientation, auto-shutdown countdown, and 1-click :8444 launch", () => {
        let stageCalls = 0;
        cy.intercept("POST", "/sensorhub/oscar/sandbox/stage-track", (req) => {
            stageCalls += 1;
            req.reply({ statusCode: 403, body: { error: "Disabled on operational node" } });
        });

        cy.intercept("GET", "/sensorhub/oscar/sandbox/host", {
            statusCode: 200,
            body: {
                agentActive: true,
                sandboxRunning: false,
                canStopOrReset: false,
                httpsPort: 8444,
                ttlMinutes: 120,
                linuxStartCommand: "sudo bash oscar.sh sandbox start --port 8444",
                linuxStopCommand: "sudo bash oscar.sh sandbox stop",
                linuxEnableBridgeCommand: "sudo bash oscar.sh sandbox enable-ui-bridge",
                windowsStartCommand: ".\\oscar.bat sandbox start --port 8444",
                windowsStopCommand: ".\\oscar.bat sandbox stop",
                windowsEnableBridgeCommand: ".\\oscar.bat sandbox enable-ui-bridge",
            },
        }).as("getHostStopped");

        cy.intercept("POST", "/sensorhub/oscar/sandbox/host", {
            statusCode: 200,
            body: {
                agentActive: true,
                sandboxRunning: true,
                canStopOrReset: false,
                httpsPort: 8444,
                ttlMinutes: 120,
                expiresAt: new Date(Date.now() + 118 * 60_000).toISOString(),
                linuxStartCommand: "sudo bash oscar.sh sandbox start --port 8444",
                linuxStopCommand: "sudo bash oscar.sh sandbox stop",
                linuxEnableBridgeCommand: "sudo bash oscar.sh sandbox enable-ui-bridge",
                windowsStartCommand: ".\\oscar.bat sandbox start --port 8444",
                windowsStopCommand: ".\\oscar.bat sandbox stop",
                windowsEnableBridgeCommand: ".\\oscar.bat sandbox enable-ui-bridge",
                activeJob: {
                    requestId: "req-1",
                    action: "start",
                    state: "COMPLETED",
                    message: "Training Sandbox ready on port 8444.",
                },
            },
        }).as("startHostSandbox");

        cy.mount(
            <LanguageProvider>
                <TrainingCoachDock
                    status={{ sandboxMode: false }}
                    onStatusUpdated={() => {}}
                    onRefreshRequested={() => {}}
                    onNavigateRoute={() => {}}
                    splitAdminOpen={false}
                    onToggleSplitAdmin={() => {}}
                    onMinimize={() => {}}
                />
            </LanguageProvider>,
        );

        cy.wait("@getHostStopped");
        cy.get('[data-testid="coach-refresher-badge"]').should("contain.text", "READ-ONLY REFRESHER");
        cy.get('[data-testid="training-coach-restage-track"]').should("not.exist");
        cy.get('[data-testid="training-inject-fault_gamma_high"]').should("not.exist");
        cy.get('[data-testid="training-download-certificate-btn"]').should("not.exist");
        cy.get('[data-testid="coach-refresher-orientation"]')
            .should("be.visible")
            .and("contain.text", "120 minutes");

        // Switching tracks in Refresher Mode is 100% local (zero POST /stage-track calls)
        cy.get('[data-testid="training-track-btn-administrator"]').click();
        cy.get('[data-testid="training-lab-chip-adm-5"]').should("be.visible").click();
        cy.contains("Per-Lane Physical RPM Lights & Sound").should("be.visible");
        cy.then(() => {
            expect(stageCalls).to.equal(0);
        });

        // Operator can launch :8444 in 1 click, sees Open button + live countdown, and does NOT see Stop/Reset
        cy.get('[data-testid="coach-sandbox-launch-btn"]').should("be.visible").click();
        cy.wait("@startHostSandbox");
        cy.get('[data-testid="coach-sandbox-open-btn"]')
            .should("be.visible")
            .and("have.attr", "href")
            .and("include", ":8444");
        cy.get('[data-testid="coach-sandbox-host-status"]').should("contain.text", "Auto-shuts down & wipes in");
        cy.get('[data-testid="coach-sandbox-stop-btn"]').should("not.exist");
        cy.get('[data-testid="coach-sandbox-reset-btn"]').should("not.exist");
    });

    it("resolves isolated <site>-sandbox.<hub> HTTPS URL on remote tunnel hosts while keeping :8444 on LAN hosts", () => {
        const remoteTarget = resolveSandboxLaunchTarget(
            {
                httpsPort: 8444,
                remoteDomain: "hub.example.org",
                remoteSandboxUrl: "https://north-gate-sandbox.hub.example.org",
            },
            "north-gate.hub.example.org",
        );
        expect(remoteTarget.isRemoteTunnel).to.equal(true);
        expect(remoteTarget.url).to.equal("https://north-gate-sandbox.hub.example.org");
        expect(remoteTarget.badgeLabel).to.equal("north-gate-sandbox.hub.example.org");

        const lanTarget = resolveSandboxLaunchTarget(
            {
                httpsPort: 8444,
                remoteDomain: "hub.example.org",
                remoteSandboxUrl: "https://north-gate-sandbox.hub.example.org",
            },
            "oscar.ubuntu",
        );
        expect(lanTarget.isRemoteTunnel).to.equal(false);
        expect(lanTarget.url).to.equal("https://oscar.ubuntu:8444");
        expect(lanTarget.badgeLabel).to.equal(":8444");
    });

    it("auto-navigates to /event-log on NORM Code 9999 injection, polls live completion, and supports Lab 3.5 loopback WebRelay", () => {
        let activePollCount = 0;
        cy.intercept("POST", "/sensorhub/oscar/sandbox/inject", (req) => {
            req.reply({
                statusCode: 200,
                body: {
                    ok: true,
                    scenario: req.body.scenario,
                    laneSlot: 1,
                    message:
                        req.body.scenario === "stage_webrelay_demo"
                            ? "Staged DemoLane01 with live loopback WebRelay-Quad (Primary 127.0.0.1:10180)."
                            : `Started '${req.body.scenario}'`,
                },
            });
        }).as("injectCall");

        cy.intercept("GET", "/sensorhub/oscar/sandbox/active", (req) => {
            activePollCount += 1;
            req.reply({
                statusCode: 200,
                body: {
                    sandboxMode: true,
                    watermark: SANDBOX_WATERMARK_TEXT,
                    activeTrack: "operator",
                    busyOccupancy: activePollCount < 2,
                    verification: {
                        configuredLaneCount: 1,
                        onlineLaneCount: 1,
                        lanesWithCameraCount: 1,
                        lanesWithOcrCount: 1,
                        operationalViewCount: 1,
                        totalOccupancies: activePollCount < 2 ? 1 : 2,
                        gammaAlarmCount: 2,
                        neutronAlarmCount: 0,
                        emlCode9999Count: activePollCount < 2 ? 0 : 1,
                        extendedCode9998Count: 0,
                        activeFaultOrTamper: false,
                        operatorAdjudicatedCount: 0,
                        adjudicatedWithEvidenceCount: 0,
                        adjudicatedWithVehicleIdCount: 0,
                        multiPassVehicleCount: 0,
                        generatedReportCount: 0,
                        offlineMapActive: false,
                        policyPackActive: false,
                        cargoUffEnabled: true,
                        cargoUffIndexedCount: 2,
                        webRelayConfiguredCount: 1,
                        webRelayOnlineCount: 1,
                    },
                },
            });
        }).as("pollSandboxActive");

        const navigatedRoutes: string[] = [];
        const Harness = () => {
            const [route, setRoute] = React.useState<string>("/");
            const [st, setSt] = React.useState<SandboxActiveStatus>({
                sandboxMode: true,
                watermark: SANDBOX_WATERMARK_TEXT,
                activeTrack: "operator",
                verification: {
                    configuredLaneCount: 1,
                    onlineLaneCount: 1,
                    lanesWithCameraCount: 1,
                    lanesWithOcrCount: 1,
                    operationalViewCount: 1,
                    totalOccupancies: 1,
                    gammaAlarmCount: 1,
                    neutronAlarmCount: 0,
                    emlCode9999Count: 0,
                    extendedCode9998Count: 0,
                    activeFaultOrTamper: false,
                    operatorAdjudicatedCount: 0,
                    adjudicatedWithEvidenceCount: 0,
                    adjudicatedWithVehicleIdCount: 0,
                    multiPassVehicleCount: 0,
                    generatedReportCount: 0,
                    offlineMapActive: false,
                    policyPackActive: false,
                    cargoUffEnabled: true,
                    cargoUffIndexedCount: 2,
                    webRelayConfiguredCount: 0,
                    webRelayOnlineCount: 0,
                },
            });
            return (
                <LanguageProvider>
                    <div>
                        <div data-testid="current-route-readout">{route}</div>
                        <TrainingCoachDock
                            status={st}
                            activePathname={route}
                            onStatusUpdated={setSt}
                            onRefreshRequested={() => {}}
                            onNavigateRoute={(r) => {
                                navigatedRoutes.push(r);
                                setRoute(r);
                            }}
                            splitAdminOpen={false}
                            onToggleSplitAdmin={() => {}}
                            onMinimize={() => {}}
                        />
                    </div>
                </LanguageProvider>
            );
        };

        cy.mount(<Harness />);
        // Selecting Lab 1.3 while on "/" automatically navigates to "/event-log"
        cy.get('[data-testid="training-lab-chip-op-3"]').click();
        cy.get('[data-testid="current-route-readout"]').should("have.text", "/event-log");

        // Injecting norm_eml shows in-flight status then Code 9999 completion explanation and auto-verifies Lab 1.3
        cy.get('[data-testid="training-inject-norm_eml"]').click();
        cy.wait("@injectCall");
        cy.contains("Simulating ~4s balanced 4-panel NORM cargo transit").should("be.visible");
        cy.contains("Code 9999: EML Non-Threat", { timeout: 6000 }).should("be.visible");
        cy.get('[data-testid="training-active-lab-status"]').should("contain.text", "Auto-Verified");
    });
});
