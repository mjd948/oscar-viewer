import React from "react";
import { LanguageProvider } from "../../src/app/contexts/LanguageContext";
import UsbBackupManager from "../../src/app/_components/usb-backups/UsbBackupManager";

describe("Continual & Occasional USB NVMe Backup Admin Panel", () => {
    beforeEach(() => {
        window.localStorage.clear();
        window.localStorage.setItem("language", "en");
    });

    it("blocks non-administrator sessions from accessing host USB backup controls", () => {
        cy.intercept({ method: "GET", pathname: "/sensorhub/session" }, {
            statusCode: 200,
            body: {
                username: "gate.operator",
                displayName: "Gate Operator",
                primaryRole: "operator",
                roles: ["operator"],
                isAdmin: false,
                canAdjudicate: true,
                isReadOnly: false,
                allowedViews: [],
                mustChangePassword: false,
            },
        }).as("getSession");

        cy.mount(
            <LanguageProvider>
                <UsbBackupManager />
            </LanguageProvider>,
        );

        cy.wait("@getSession");
        cy.contains("Administrator privileges are required").should("be.visible");
        cy.contains("Safely Eject USB Drive").should("not.exist");
    });

    it("initializes an external USB NVMe SSD via the native modal dialog, switches modes, safely ejects, and re-attaches", () => {
        let currentStatus: any = {
            agentActive: true,
            hostPlatform: "linux",
            configured: false,
            mode: "unconfigured",
            intervalMinutes: 15,
            mountPath: "",
            filesystem: "ntfs",
            fsUuid: "",
            timerActive: false,
            driveState: "UNCONFIGURED",
            backupKeyPresent: false,
            driveTotalBytes: 0,
            driveFreeBytes: 0,
            backupUsedBytes: 0,
            latestSnapshot: null,
            candidateDrives: [
                {
                    device: "/dev/sda",
                    partition: "/dev/sda1",
                    model: "External NVMe 2TB",
                    transport: "usb",
                    sizeBytes: 2000398934016,
                    sizeHuman: "2.00 TB",
                    fstype: "",
                    label: "",
                    uuid: "",
                    mountpoint: "",
                    isConfiguredCarrier: false,
                },
            ],
            activeJob: null,
        };

        cy.intercept({ method: "GET", pathname: "/sensorhub/session" }, {
            statusCode: 200,
            body: {
                username: "admin",
                displayName: "Site Admin",
                primaryRole: "admin",
                roles: ["admin"],
                isAdmin: true,
                canAdjudicate: true,
                isReadOnly: false,
                allowedViews: [],
                mustChangePassword: false,
            },
        }).as("getAdminSession");

        cy.intercept({ method: "GET", pathname: "/sensorhub/session/admin/usb-backup/status" }, (req) => {
            req.reply({ statusCode: 200, body: currentStatus });
        }).as("getStatus");

        cy.intercept({ method: "POST", pathname: "/sensorhub/session/admin/usb-backup/action" }, (req) => {
            const body = req.body;
            if (body.action === "prepare-drive") {
                expect(body.device).to.equal("/dev/sda");
                expect(body.confirm).to.equal("FORMAT");
                expect(body.filesystem).to.equal("ntfs");
                currentStatus = {
                    ...currentStatus,
                    configured: true,
                    mode: "continual",
                    intervalMinutes: 15,
                    mountPath: "/srv/oscar-usb-backup",
                    filesystem: "ntfs",
                    fsUuid: "5E2A-9901",
                    timerActive: true,
                    driveState: "ATTACHED",
                    backupKeyPresent: true,
                    driveTotalBytes: 2000398934016,
                    driveFreeBytes: 1946711842816,
                    backupUsedBytes: 53687091200,
                    latestSnapshot: {
                        snapshotId: "20261119T153000Z-a1b2c3d4",
                        createdAt: "2026-11-19T15:30:00Z",
                        postgresLsn: "0/1A2B3C4D",
                        archivePackCount: 14,
                        statePackCount: 2,
                        immutableStateFileCount: 18420,
                    },
                    activeJob: {
                        requestId: "req-prep-1",
                        action: "prepare-drive",
                        state: "SUCCEEDED",
                        startedAt: "2026-11-19T15:29:00Z",
                        finishedAt: "2026-11-19T15:30:02Z",
                        message: "Prepared OSCAR USB backup carrier at /srv/oscar-usb-backup (mode=continual, filesystem=ntfs).",
                    },
                };
            } else if (body.action === "set-mode") {
                currentStatus = {
                    ...currentStatus,
                    mode: body.mode,
                    intervalMinutes: body.intervalMinutes,
                    timerActive: body.mode === "continual",
                    activeJob: {
                        requestId: "req-mode-1",
                        action: "set-mode",
                        state: "SUCCEEDED",
                        startedAt: "2026-11-19T15:31:00Z",
                        finishedAt: "2026-11-19T15:31:01Z",
                        message: `Switched backup mode -> ${String(body.mode).toUpperCase()}.`,
                    },
                };
            } else if (body.action === "eject") {
                currentStatus = {
                    ...currentStatus,
                    driveState: "SAFE_TO_UNPLUG",
                    activeJob: {
                        requestId: "req-eject-1",
                        action: "eject",
                        state: "SUCCEEDED",
                        startedAt: "2026-11-19T15:32:00Z",
                        finishedAt: "2026-11-19T15:32:04Z",
                        message: "SAFE TO UNPLUG: /srv/oscar-usb-backup has been flushed and cleanly unmounted.",
                    },
                };
            } else if (body.action === "attach") {
                currentStatus = {
                    ...currentStatus,
                    driveState: "ATTACHED",
                    latestSnapshot: {
                        ...currentStatus.latestSnapshot,
                        snapshotId: "20261119T154500Z-f9e8d7c6",
                        statePackCount: 3,
                    },
                    activeJob: {
                        requestId: "req-attach-1",
                        action: "attach",
                        state: "SUCCEEDED",
                        startedAt: "2026-11-19T15:44:50Z",
                        finishedAt: "2026-11-19T15:45:01Z",
                        message: "Incremental backup sync COMPLETE: snapshot=20261119T154500Z-f9e8d7c6 (portal downtime: 0s)",
                    },
                };
            }
            req.reply({ statusCode: 200, body: currentStatus });
        }).as("postAction");

        cy.intercept({ method: "POST", pathname: "/sensorhub/session/admin/usb-backup/backup-key" }, {
            statusCode: 200,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
            body: "TEST_ESCROW_BACKUP_KEY_MATERIAL_BASE64\n",
        }).as("downloadKey");

        cy.mount(
            <LanguageProvider>
                <UsbBackupManager />
            </LanguageProvider>,
        );

        cy.wait("@getAdminSession");
        cy.wait("@getStatus");

        cy.contains("NOT CONFIGURED").should("be.visible");
        cy.contains("External NVMe 2TB (/dev/sda — 2.00 TB)").should("exist");

        // Open native modal <dialog>
        cy.contains("button", "Format & Initialize Selected USB Drive...").click();
        cy.get("dialog.usb-native-dialog").should("have.attr", "open");

        // Safe Cancel button has autofocus; submitting wrong confirmation triggers inline validation
        cy.get("#usb-format-confirm-input").type("wrong").blur();
        cy.contains("Enter the exact word FORMAT in uppercase").should("be.visible");

        // Typing clears the error immediately, then FORMAT succeeds
        cy.get("#usb-format-confirm-input").clear().type("FORMAT");
        cy.contains("Enter the exact word FORMAT in uppercase").should("not.exist");
        cy.contains("button", "Erase & Initialize USB Drive").click();

        cy.wait("@postAction");
        cy.get("dialog.usb-native-dialog").should("not.have.attr", "open");
        cy.contains("ATTACHED & ONLINE").should("be.visible");
        cy.contains("20261119T153000Z-a1b2c3d4").should("be.visible");

        // Switch mode to Occasional via visible radio button + explicit form submit
        cy.get("#usb-mode-occasional").check();
        cy.contains("button", "Save Mode & Schedule").click();
        cy.wait("@postAction");
        cy.contains("OCCASIONAL").should("be.visible");

        // Safely eject USB drive for visiting data admin laptop copy
        cy.contains("button", "Safely Eject USB Drive").click();
        cy.wait("@postAction");
        cy.contains("SAFE TO UNPLUG NOW").should("be.visible");
        cy.contains("SAFE TO UNPLUG: USB NVMe SSD Flushed & Unmounted").should("be.visible");

        // Re-attach & catch up after field copy
        cy.contains("button", "Re-Attach & Sync Catch-Up").click();
        cy.wait("@postAction");
        cy.contains("ATTACHED & ONLINE").should("be.visible");
        cy.contains("20261119T154500Z-f9e8d7c6").should("be.visible");

        // Download off-site recovery key
        cy.contains("button", "Download Off-Site Recovery Key").click();
        cy.wait("@downloadKey");
        cy.contains("Downloaded oscar-backup-key.txt").should("be.visible");
    });
});
