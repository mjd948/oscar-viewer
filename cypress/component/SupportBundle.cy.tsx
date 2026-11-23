import React from "react";
import {strFromU8, strToU8, unzipSync, zipSync} from "fflate";
import {LanguageProvider, useLanguage} from "../../src/app/contexts/LanguageContext";
import HelpDialog from "../../src/app/_components/HelpDialog";
import {getVideoGuideBySlug} from "../../src/lib/data/oscar/VideoGuidesCatalog";
import {
    clearSupportDiagnosticEventsForTesting,
    getSupportDiagnosticEventsSnapshot,
    installSupportDiagnosticsRecorder,
    MAX_SUPPORT_DIAGNOSTIC_EVENTS,
    recordSupportDiagnosticEvent,
    redactSupportText,
    SupportBundleExportResult,
} from "../../src/lib/data/oscar/SupportDiagnostics";

describe("Troubleshooting Support Bundle diagnostics & HelpDialog export", () => {
    beforeEach(() => {
        window.localStorage.clear();
        window.localStorage.setItem("language", "en");
        clearSupportDiagnosticEventsForTesting();
        installSupportDiagnosticsRecorder();
    });

    it("scrubs secrets at capture time and enforces the 400-event ring buffer cap", () => {
        const counter = {count: 0};
        const sanitized = redactSupportText(
            "Camera error rtsp://cam_user:CamSecret99@192.168.1.25:554/stream1?token=QuerySecret123 " +
            "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.SecretPayload " +
            "Cookie: OSCAR_SESSION=sess_secret_value_12345 token=StandaloneToken987 operator=alice.smith@ornl.gov",
            counter,
        );
        expect(sanitized).not.to.include("CamSecret99");
        expect(sanitized).not.to.include("QuerySecret123");
        expect(sanitized).not.to.include("SecretPayload");
        expect(sanitized).not.to.include("sess_secret_value_12345");
        expect(sanitized).not.to.include("StandaloneToken987");
        expect(sanitized).not.to.include("alice.smith@ornl.gov");
        expect(sanitized).to.include("rtsp://[REDACTED]@192.168.1.25:554/stream1?token=[REDACTED]");
        expect(sanitized).to.include("a***@ornl.gov");
        expect(counter.count).to.be.greaterThan(4);

        for (let i = 0; i < MAX_SUPPORT_DIAGNOSTIC_EVENTS + 25; i++) {
            recordSupportDiagnosticEvent({
                category: "app",
                level: "info",
                message: `Event #${i}`,
                details: {
                    password: "ShouldNeverRemainInMemory",
                    index: i,
                },
            });
        }

        const snapshot = getSupportDiagnosticEventsSnapshot();
        expect(snapshot.events).to.have.length(MAX_SUPPORT_DIAGNOSTIC_EVENTS);
        expect(snapshot.events[0].message).to.equal("Event #25");
        expect(snapshot.events[MAX_SUPPORT_DIAGNOSTIC_EVENTS - 1].message).to.equal(
            `Event #${MAX_SUPPORT_DIAGNOSTIC_EVENTS + 24}`,
        );
        expect(JSON.stringify(snapshot.events)).not.to.include("ShouldNeverRemainInMemory");
    });

    it("merges client flight-recorder diagnostics with backend support ZIP via HelpDialog", () => {
        console.error(
            "Simulated stream failure on rtsp://admin:StreamSecret77@10.0.0.12:554/live",
            {apiKey: "TopSecretKey888"},
        );

        const fakeBackendZip = zipSync({
            "summary.json": strToU8(JSON.stringify({
                schemaVersion: 1,
                bundleSource: "backend",
                oscarVersion: "3.11.0",
                nodeId: "default",
                logs: {errorLineCount: 2, warnLineCount: 1},
            })),
            "redaction-report.json": strToU8(JSON.stringify({
                schemaVersion: 1,
                counts: {totalRedactions: 5},
            })),
            "backend/oscar.log": strToU8("2026-11-13 22:00:00.000 ERROR Lane50 - Simulated backend log\n"),
            "backend/modules.json": strToU8(JSON.stringify({schemaVersion: 1, modules: []})),
        });

        let exportedResult: SupportBundleExportResult | null = null;
        let releaseBackendResponse: (() => void) | null = null;
        const mockFetch: typeof fetch = async () => {
            await new Promise<void>(resolve => {
                releaseBackendResponse = resolve;
            });
            const bodyCopy = new Uint8Array(fakeBackendZip.byteLength);
            bodyCopy.set(fakeBackendZip);
            return new Response(bodyCopy, {
                status: 200,
                headers: {"Content-Type": "application/zip"},
            });
        };

        cy.mount(
            <LanguageProvider>
                <HelpDialog
                    open
                    onClose={() => {}}
                    stateSummary={{
                        configuredNodeCount: 1,
                        activeViewKey: "north-gate",
                        unreadAlarmCount: 3,
                        authenticatedUserPresent: true,
                    }}
                    fetchImpl={mockFetch}
                    skipBrowserDownload
                    onBundleExported={(res) => {
                        exportedResult = res;
                    }}
                />
            </LanguageProvider>,
        );

        cy.get('[data-testid="help-export-support-bundle"]').should("be.visible").click();
        cy.get('[data-testid="help-support-bundle-progress"]')
            .should("be.visible")
            .and("have.attr", "role", "progressbar")
            .then(() => {
                releaseBackendResponse?.();
            });

        cy.get('[data-testid="help-support-bundle-status"]')
            .should("contain.text", "client + server diagnostics, secrets redacted")
            .then(() => {
                expect(exportedResult).to.not.equal(null);
                const result = exportedResult!;
                expect(result.bundleSource).to.equal("combined");
                expect(result.backendIncluded).to.equal(true);
                expect(result.fileName).to.match(/^oscar-support-\d{8}T\d{6}Z\.zip$/);

                const entries = unzipSync(result.zipBytes);
                expect(Object.keys(entries)).to.include.members([
                    "summary.json",
                    "redaction-report.json",
                    "client/client-diagnostics.json",
                    "backend/oscar.log",
                    "backend/modules.json",
                ]);

                const fullText = Object.values(entries).map(bytes => strFromU8(bytes)).join("\n");
                expect(fullText).not.to.include("StreamSecret77");
                expect(fullText).not.to.include("TopSecretKey888");
                expect(fullText).to.include("Simulated backend log");

                const summary = JSON.parse(strFromU8(entries["summary.json"]));
                expect(summary.bundleSource).to.equal("combined");
                expect(summary.backendIncluded).to.equal(true);
                expect(summary.client.errorCount).to.be.greaterThan(0);

                const clientDiag = JSON.parse(strFromU8(entries["client/client-diagnostics.json"]));
                expect(clientDiag.stateSummary.activeViewKey).to.equal("north-gate");
                expect(clientDiag.stateSummary.unreadAlarmCount).to.equal(3);
            });
    });

    it("falls back cleanly to client-only support ZIP with host CLI instructions when backend returns 502", () => {
        recordSupportDiagnosticEvent({
            category: "network",
            level: "error",
            message: "HTTP 502 on GET /sensorhub/api/systems (18 ms)",
        });

        let exportedResult: SupportBundleExportResult | null = null;
        const failingFetch: typeof fetch = async () =>
            new Response("Bad Gateway", {status: 502, statusText: "Bad Gateway"});

        cy.mount(
            <LanguageProvider>
                <HelpDialog
                    open
                    onClose={() => {}}
                    fetchImpl={failingFetch}
                    skipBrowserDownload
                    onBundleExported={(res) => {
                        exportedResult = res;
                    }}
                />
            </LanguageProvider>,
        );

        cy.contains('[role="tab"]', "Manual & Video Guides").click();
        cy.get('[data-testid="help-card-export-support-bundle"]').should("be.visible").click();

        cy.get('[data-testid="help-support-bundle-status"]')
            .should("contain.text", "./oscar.sh support-bundle")
            .and("contain.text", "oscar.bat support-bundle")
            .then(() => {
                expect(exportedResult).to.not.equal(null);
                const result = exportedResult!;
                expect(result.bundleSource).to.equal("client-only");
                expect(result.backendIncluded).to.equal(false);
                expect(result.fileName).to.match(/^oscar-client-support-\d{8}T\d{6}Z\.zip$/);

                const entries = unzipSync(result.zipBytes);
                const summary = JSON.parse(strFromU8(entries["summary.json"]));
                expect(summary.bundleSource).to.equal("client-only");
                expect(summary.backendFetchError).to.include("HTTP 502");
                expect(summary.serverCliFallback.linux).to.equal("./oscar.sh support-bundle");
                expect(summary.serverCliFallback.windows).to.equal("oscar.bat support-bundle");
            });
    });

    it("surfaces route-aware contextual video guides, click-to-play WebVTT player, and 26-module offline catalog", () => {
        window.localStorage.setItem("language", "es");

        let closeCount = 0;
        const LanguageSwitchHarness = () => {
            const {setLanguage} = useLanguage();
            return (
                <div>
                    <button type="button" data-testid="nav-item-health">
                        Estado de salud
                    </button>
                    <button type="button" data-testid="switch-lang-fr" onClick={() => setLanguage("fr")}>
                        FR
                    </button>
                    <HelpDialog
                        open
                        onClose={() => {
                            closeCount += 1;
                        }}
                        activePathname="/alarm-transfer/"
                        skipBrowserDownload
                    />
                </div>
            );
        };

        cy.mount(
            <LanguageProvider>
                <LanguageSwitchHarness />
            </LanguageProvider>,
        );

        const guide14 = getVideoGuideBySlug("14-airgapped-alarm-qr-transfer");
        expect(guide14?.durationLabel).to.equal("27s");

        // Verify Console Pages cards display actual platform icons, localized symbol descriptions, and Highlight buttons
        cy.get('[data-testid="help-page-symbol-note-health"]')
            .should("be.visible")
            .and("contain.text", "icono de monitor de pulso cardíaco")
            .find('[data-platform-icon="health"]')
            .should("exist");
        cy.get('[data-testid="help-top-bar-tools-card"]').should("be.visible");
        cy.get('[data-testid="help-highlight-page-health"]').should("be.visible").click();
        cy.get('[data-testid="nav-item-health"]').should("have.attr", "data-oscar-coach-spotlight", "true");
        cy.then(() => {
            expect(closeCount).to.equal(1);
        });

        cy.get('[data-testid="help-inline-video-player"]').should("not.exist");
        cy.get('[data-testid="help-contextual-guide-14"]')
            .should("be.visible")
            .and("have.attr", "aria-pressed", "false")
            .and("contain.text", `Ver #14 (${guide14!.durationLabel})`)
            .click();

        cy.get('[data-testid="help-contextual-guide-14"]').should("have.attr", "aria-pressed", "true");
        cy.get('[data-testid="help-inline-video-player"]')
            .should("be.visible")
            .and("contain.text", "English, Español, Français, Ελληνικά");
        cy.get('[data-testid="help-video-element"]')
            .should("have.attr", "width", "1280")
            .and("have.attr", "height", "720")
            .and("have.attr", "preload", "metadata");
        cy.get('[data-testid="help-video-element"] source')
            .should("have.attr", "src", "/video-guides/videos/14-airgapped-alarm-qr-transfer.mp4");
        cy.get('[data-testid="help-video-element"] track').should("have.length", 4);
        cy.get('[data-testid="help-video-element"] track[srclang="en"]')
            .should("have.attr", "kind", "captions")
            .and("have.attr", "src", "/video-guides/captions/14-airgapped-alarm-qr-transfer.vtt")
            .and("have.prop", "default", false);
        cy.get('[data-testid="help-video-element"] track[srclang="es"]')
            .should("have.attr", "kind", "captions")
            .and("have.attr", "src", "/video-guides/captions/es/14-airgapped-alarm-qr-transfer.vtt")
            .and("have.prop", "default", true);
        cy.get('[data-testid="help-video-element"] track[srclang="fr"]')
            .should("have.attr", "kind", "captions")
            .and("have.attr", "src", "/video-guides/captions/fr/14-airgapped-alarm-qr-transfer.vtt")
            .and("have.prop", "default", false);
        cy.get('[data-testid="help-video-element"] track[srclang="el"]')
            .should("have.attr", "kind", "captions")
            .and("have.attr", "src", "/video-guides/captions/el/14-airgapped-alarm-qr-transfer.vtt")
            .and("have.prop", "default", false);
        cy.get('[data-testid="help-video-element"]').then(($video) => {
            const videoEl = $video[0] as HTMLVideoElement;
            const modesByLang: Record<string, string> = {};
            for (let i = 0; i < videoEl.textTracks.length; i++) {
                const tr = videoEl.textTracks[i]!;
                modesByLang[tr.language] = tr.mode;
            }
            expect(modesByLang).to.deep.equal({
                en: "disabled",
                es: "showing",
                fr: "disabled",
                el: "disabled",
            });
        });

        // Live language switch while video is open updates textTracks immediately
        cy.get('[data-testid="switch-lang-fr"]').click({force: true});
        cy.get('[data-testid="help-video-element"]').should(($video) => {
            const videoEl = $video[0] as HTMLVideoElement;
            const modesByLang: Record<string, string> = {};
            for (let i = 0; i < videoEl.textTracks.length; i++) {
                const tr = videoEl.textTracks[i]!;
                modesByLang[tr.language] = tr.mode;
            }
            expect(modesByLang.fr).to.equal("showing");
            expect(modesByLang.es).to.equal("disabled");
        });

        cy.get('[data-testid="help-close-video-player"]').click();
        cy.get('[data-testid="help-inline-video-player"]').should("not.exist");
        cy.get('[data-testid="help-contextual-guide-14"]').should("have.focus");

        cy.get('[data-testid="help-page-1-guide-17"]').then(($btn) => {
            const visible = $btn.text().trim();
            const ariaLabel = $btn.attr("aria-label") ?? "";
            expect(ariaLabel.startsWith(visible)).to.equal(true);
        });

        cy.contains('[role="tab"]', "Manuel et guides vidéo").click();
        cy.get('[data-testid="help-open-local-video-guides"]')
            .should("have.attr", "href", "/video-guides/index.html");
        cy.get('[data-testid="help-video-track-C"]').should("not.have.attr", "open");
        cy.get('[data-testid="help-video-track-C"] > summary').click();
        cy.get('[data-testid="help-video-track-C"]').should("have.attr", "open");
        cy.get('[data-testid="help-catalog-watch-17"]').should("be.visible").click();
        cy.get('[data-testid="help-video-element"] source')
            .should("have.attr", "src", "/video-guides/videos/17-vehicle-ocr-and-adjudication.mp4");
        cy.get('[data-testid="help-catalog-watch-19"]').should("be.visible").click();
        cy.get('[data-testid="help-video-element"] source')
            .should("have.attr", "src", "/video-guides/videos/19-viewer-users-passkeys-and-access.mp4");
        cy.get('[data-testid="help-catalog-watch-20"]').should("be.visible").click();
        cy.get('[data-testid="help-video-element"] source')
            .should("have.attr", "src", "/video-guides/videos/20-multi-node-federation-vehicle-search-and-report.mp4");
        cy.get('[data-testid="help-catalog-watch-24"]').should("be.visible").click();
        cy.get('[data-testid="help-video-element"] source')
            .should("have.attr", "src", "/video-guides/videos/24-continual-and-occasional-usb-backups.mp4");
        cy.get('[data-testid="help-catalog-watch-25"]').should("be.visible").click();
        cy.get('[data-testid="help-video-element"] source')
            .should("have.attr", "src", "/video-guides/videos/25-pluggable-runtime-extensions-and-pmtiles.mp4");
        cy.get('[data-testid="help-catalog-watch-27"]').should("be.visible").click();
        cy.get('[data-testid="help-video-element"] source')
            .should("have.attr", "src", "/video-guides/videos/27-cargo-uff-smb-and-xray-inspection.mp4");
    });
});
