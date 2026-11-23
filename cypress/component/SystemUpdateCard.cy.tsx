import React from "react";
import { LanguageProvider } from "../../src/app/contexts/LanguageContext";
import SystemUpdateCard from "../../src/app/_components/update/SystemUpdateCard";

const BASE_STATUS = {
    agentActive: true,
    guiUpdateEnabled: true,
    sandboxMode: false,
    requiresGitHubLogin: false,
    backupPossible: true,
    state: "IDLE",
    stage: "IDLE",
    progressPercent: 0,
    currentVersion: "3.11.8",
    availableDiskGib: 64.2,
    linuxCheckCommand: "sudo bash oscar.sh update check",
    linuxUpgradeCommand: "sudo bash oscar.sh update apply",
    linuxEnableBridgeCommand: "sudo bash oscar.sh update enable-ui-bridge",
    windowsCheckCommand: ".\\oscar.bat update check",
    windowsUpgradeCommand: ".\\oscar.bat update apply",
    windowsEnableBridgeCommand: ".\\oscar.bat update enable-ui-bridge",
};

const SAMPLE_SHA256 = "a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0";

describe("SystemUpdateCard — Zero-Login GitHub & Offline Bundle Updater", () => {
    beforeEach(() => {
        window.localStorage.clear();
        window.localStorage.setItem("language", "en");
    });

    it("does not render for non-administrator users", () => {
        cy.mount(
            <LanguageProvider>
                <SystemUpdateCard isAdmin={false} />
            </LanguageProvider>,
        );
        cy.get('[data-testid="system-update-card"]').should("not.exist");
    });

    it("checks GitHub with zero login, opens native <dialog> confirmation, survives 502 container restart, and completes", () => {
        let pollCount = 0;

        cy.intercept("GET", "/sensorhub/oscar/system-update/status", (req) => {
            pollCount += 1;
            if (pollCount === 1) {
                req.reply({ statusCode: 200, body: BASE_STATUS });
                return;
            }
            if (pollCount === 2) {
                // Simulate nginx 502 Bad Gateway while oscar container restarts onto 3.11.9
                req.reply({ statusCode: 502, body: "Bad Gateway" });
                return;
            }
            req.reply({
                statusCode: 200,
                body: {
                    ...BASE_STATUS,
                    state: "COMPLETED",
                    stage: "COMPLETED",
                    progressPercent: 100,
                    currentVersion: "3.11.9",
                    targetVersion: "3.11.9",
                },
            });
        }).as("getStatus");

        cy.intercept("POST", "/sensorhub/oscar/system-update/check", {
            statusCode: 200,
            body: {
                ...BASE_STATUS,
                latestRelease: {
                    checkedAt: "2026-11-23T04:00:00Z",
                    requiresGitHubLogin: false,
                    latestVersion: "3.11.9",
                    currentVersion: "3.11.8",
                    tagName: "v3.11.9",
                    releaseTitle: "Release v3.11.9 (Amber)",
                    notesSummary: "- Zero-login GUI GitHub updater\n- Automatic fail-safe rollback",
                    releasePageUrl: "https://github.com/ORNL/oscar/releases/tag/v3.11.9",
                    assetFileName: "oscar-3.11.9.zip",
                    downloadUrl: "https://github.com/ORNL/oscar/releases/download/v3.11.9/oscar-3.11.9.zip",
                    assetAvailable: true,
                    expectedSha256: SAMPLE_SHA256,
                    downloadBytes: 98_566_144,
                    comparison: 1,
                    updateAvailable: true,
                    upToDate: false,
                    inPlaceCompatible: true,
                },
            },
        }).as("checkGitHub");

        cy.intercept("POST", "/sensorhub/oscar/system-update/apply", (req) => {
            expect(req.headers["x-requested-with"]).to.equal("XMLHttpRequest");
            expect(req.body.targetVersion).to.equal("3.11.9");
            expect(req.body.expectedSha256).to.equal(SAMPLE_SHA256);
            req.reply({
                statusCode: 200,
                body: {
                    ...BASE_STATUS,
                    state: "RUNNING",
                    stage: "DOWNLOADING",
                    progressPercent: 38,
                    targetVersion: "3.11.9",
                },
            });
        }).as("applyUpgrade");

        cy.mount(
            <LanguageProvider>
                <SystemUpdateCard isAdmin={true} />
            </LanguageProvider>,
        );

        cy.wait("@getStatus");
        cy.get('[data-testid="system-update-zero-login-badge"]').should("contain.text", "No GitHub Login Required");
        cy.get('[data-testid="system-update-installed-chip"]').should("contain.text", "3.11.8");

        cy.get('[data-testid="system-update-check-btn"]').click();
        cy.wait("@checkGitHub");
        cy.get('[data-testid="system-update-expected-sha256"]').should("contain.text", SAMPLE_SHA256);

        cy.get('[data-testid="system-update-open-confirm-btn"]').click();
        cy.get('[data-testid="system-update-native-dialog"]').should("have.attr", "open");
        cy.get('[data-testid="system-update-native-dialog"]').should("not.have.attr", "role");
        cy.get('[data-testid="system-update-native-dialog"]').should("not.have.attr", "aria-modal");
        cy.get('[data-testid="system-update-cancel-btn"]').should("be.focused");

        cy.get('[data-testid="system-update-confirm-start-btn"]').click();
        cy.wait("@applyUpgrade");
        cy.get('[data-testid="system-update-native-progress"]').should("have.attr", "value", "38");

        // Wait across simulated 502 restart -> COMPLETED on 3.11.9
        cy.get('[data-testid="system-update-completed-alert"]', { timeout: 8000 }).should(
            "contain.text",
            "OSCAR 3.11.9",
        );
        cy.get('[data-testid="system-update-reload-btn"]').should("be.visible");
    });

    it("enforces read-only guard in Training Sandbox (:8444) and supports staging an offline release .zip", () => {
        cy.intercept("GET", "/sensorhub/oscar/system-update/status", {
            statusCode: 200,
            body: BASE_STATUS,
        }).as("getNormalStatus");

        cy.intercept("POST", "/sensorhub/oscar/system-update/upload-bundle", (req) => {
            expect(req.headers["x-oscar-bundle-filename"]).to.equal("oscar-3.11.9.zip");
            expect(req.headers["x-oscar-apply-immediately"]).to.equal("false");
            req.reply({
                statusCode: 200,
                body: {
                    ...BASE_STATUS,
                    stagedOnly: true,
                    stagedFileName: "oscar-3.11.9.zip",
                    stagedVersion: "3.11.9",
                    stagedSha256: SAMPLE_SHA256,
                },
            });
        }).as("uploadStage");

        cy.mount(
            <LanguageProvider>
                <SystemUpdateCard isAdmin={true} />
            </LanguageProvider>,
        );
        cy.wait("@getNormalStatus");

        cy.get('[data-testid="system-update-zip-input"]').selectFile(
            {
                contents: Cypress.Buffer.from("PK\x03\x04mockzipcontent"),
                fileName: "oscar-3.11.9.zip",
                mimeType: "application/zip",
            },
            { force: true },
        );
        cy.get('[data-testid="system-update-upload-stage-btn"]').click();
        cy.wait("@uploadStage");
        cy.contains("Verified and staged oscar-3.11.9.zip").should("be.visible");
    });
});
