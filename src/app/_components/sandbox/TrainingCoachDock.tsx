"use client";

import * as React from "react";
import {
    Alert,
    Box,
    Button,
    Chip,
    Divider,
    IconButton,
    LinearProgress,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import GpsFixedRoundedIcon from "@mui/icons-material/GpsFixedRounded";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import SplitscreenRoundedIcon from "@mui/icons-material/SplitscreenRounded";
import StopCircleOutlinedIcon from "@mui/icons-material/StopCircleOutlined";
import { useLanguage } from "@/app/contexts/LanguageContext";
import {
    PLATFORM_ICONS,
    PlatformIconBadge,
    renderTextWithIconsAndCode,
    triggerPlatformSpotlight,
} from "@/app/_components/common/PlatformIcons";
import {
    getVideoGuideBySlug,
    getVideoGuideCaptionTracks,
    syncVideoElementCaptionLocale,
} from "@/lib/data/oscar/VideoGuidesCatalog";
import {
    buildSandboxSampleDownloadUrl,
    CompletedLabSubmission,
    computeSandboxShutdownSummary,
    dispatchSandboxRefreshEvents,
    resolveSandboxLaunchTarget,
    downloadTrainingCertificatePdf,
    fetchSandboxActiveStatus,
    fetchSandboxHostStatus,
    injectSandboxScenario,
    SandboxActiveStatus,
    SandboxHostStatus,
    SandboxScenarioId,
    SandboxTrackId,
    SandboxVerificationSnapshot,
    stageSandboxTrack,
    submitSandboxHostAction,
} from "@/lib/data/oscar/TrainingSandboxApi";
import {
    TRAINING_COACH_UI,
    TRAINING_LABS,
    TRAINING_TRACKS,
    TrainingLabDefinition,
} from "@/lib/data/oscar/TrainingCurriculum";
import "./TrainingCoachDock.css";

const EMPTY_VERIFICATION: SandboxVerificationSnapshot = {
    configuredLaneCount: 0,
    onlineLaneCount: 0,
    lanesWithCameraCount: 0,
    lanesWithOcrCount: 0,
    operationalViewCount: 0,
    totalOccupancies: 0,
    gammaAlarmCount: 0,
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
    cargoUffEnabled: false,
    cargoUffIndexedCount: 0,
};

const STORAGE_KEY_MANUAL_LABS = "oscar.sandbox.manualCompletedLabs.v1";

function renderInlineCode(text: string): React.ReactNode {
    if (!text) return text;
    if (!text.includes("`") && !text.includes("{{icon:")) return text;
    return renderTextWithIconsAndCode(text);
}

function normalizeViewerRoute(route?: string): string {
    if (!route) return "/";
    const qIdx = route.indexOf("?");
    const rawPath = qIdx >= 0 ? route.slice(0, qIdx) : route;
    const trimmed = rawPath.trim().replace(/\/+$/, "");
    return trimmed === "" ? "/" : trimmed;
}

export interface TrainingCoachDockProps {
    status: SandboxActiveStatus;
    activePathname?: string;
    onStatusUpdated: (next: SandboxActiveStatus) => void;
    onRefreshRequested: () => void;
    onNavigateRoute: (route: string) => void;
    splitAdminOpen: boolean;
    onToggleSplitAdmin: (open: boolean) => void;
    onMinimize: () => void;
}

export default function TrainingCoachDock({
    status,
    activePathname,
    onStatusUpdated,
    onRefreshRequested,
    onNavigateRoute,
    splitAdminOpen,
    onToggleSplitAdmin,
    onMinimize,
}: TrainingCoachDockProps) {
    const { language: locale } = useLanguage();
    const ui = TRAINING_COACH_UI[locale] ?? TRAINING_COACH_UI.en;
    const refresherMode = !status.sandboxMode;
    const verification = status.verification ?? EMPTY_VERIFICATION;

    const [selectedTrack, setSelectedTrack] = React.useState<SandboxTrackId>(
        status.activeTrack ?? "operator",
    );
    const trackLabs = React.useMemo(
        () => TRAINING_LABS.filter((lab) => lab.trackId === selectedTrack),
        [selectedTrack],
    );
    const [selectedLabId, setSelectedLabId] = React.useState<string>("op-1");
    const [manualCompletedIds, setManualCompletedIds] = React.useState<string[]>([]);
    const [busyAction, setBusyAction] = React.useState<boolean>(false);
    const [transitInProgress, setTransitInProgress] = React.useState<boolean>(false);
    const transitPollCleanupRef = React.useRef<(() => void) | null>(null);
    const spotlightPollCleanupRef = React.useRef<(() => void) | null>(null);
    const [hostStatus, setHostStatus] = React.useState<SandboxHostStatus | null>(null);
    const [hostBusy, setHostBusy] = React.useState<boolean>(false);
    const [pendingHostAction, setPendingHostAction] = React.useState<{
        action: "start" | "stop" | "reset";
        requestId?: string;
        deadlineMs: number;
    } | null>(null);
    const [feedbackBanner, setFeedbackBanner] = React.useState<{
        severity: "success" | "info" | "error";
        text: string;
    } | null>(null);
    const [traineeName, setTraineeName] = React.useState<string>("");
    const [liveAnnouncement, setLiveAnnouncement] = React.useState<string>("");
    const previouslyVerifiedRef = React.useRef<Set<string>>(new Set());

    React.useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const saved = window.sessionStorage.getItem(STORAGE_KEY_MANUAL_LABS);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    setManualCompletedIds(parsed.filter((x) => typeof x === "string"));
                }
            }
        } catch {
            // Ignore storage errors in restricted browsing modes
        }
    }, []);

    React.useEffect(() => {
        if (!refresherMode) return;
        const controller = new AbortController();
        fetchSandboxHostStatus(controller.signal)
            .then((st) => {
                if (st) setHostStatus(st);
            })
            .catch(() => {});
        return () => controller.abort();
    }, [refresherMode]);

    const jobInFlight =
        hostStatus?.activeJob?.state === "QUEUED" || hostStatus?.activeJob?.state === "RUNNING";
    const hostStarting =
        (!hostStatus?.sandboxRunning && jobInFlight) ||
        pendingHostAction?.action === "start" ||
        pendingHostAction?.action === "reset";
    const shouldPollHost = refresherMode && (jobInFlight || pendingHostAction !== null);

    React.useEffect(() => {
        if (!shouldPollHost) return;
        const timer = setInterval(() => {
            fetchSandboxHostStatus()
                .then((st) => {
                    if (!st) return;
                    setHostStatus(st);
                    const jobState = st.activeJob?.state;
                    if (jobState === "FAILED") {
                        setPendingHostAction(null);
                        setFeedbackBanner({
                            severity: "error",
                            text: st.activeJob?.message ?? "Training Sandbox operation failed.",
                        });
                        return;
                    }
                    if (pendingHostAction) {
                        const matchedDone =
                            jobState === "COMPLETED" &&
                            (!pendingHostAction.requestId || st.activeJob?.requestId === pendingHostAction.requestId);
                        const startReady =
                            pendingHostAction.action === "start" && st.sandboxRunning && jobState !== "RUNNING" && jobState !== "QUEUED";
                        const stopDone =
                            pendingHostAction.action === "stop" && !st.sandboxRunning && jobState !== "RUNNING" && jobState !== "QUEUED";
                        const resetDone =
                            pendingHostAction.action === "reset" && matchedDone && st.sandboxRunning;
                        if (matchedDone || startReady || stopDone || resetDone) {
                            setPendingHostAction(null);
                            setFeedbackBanner({
                                severity: "success",
                                text:
                                    st.activeJob?.message ??
                                    (st.sandboxRunning
                                        ? `Training Sandbox ready on port ${st.httpsPort ?? 8444}.`
                                        : "Training Sandbox stopped and flushed."),
                            });
                            return;
                        }
                        if (Date.now() > pendingHostAction.deadlineMs) {
                            setPendingHostAction(null);
                        }
                    }
                })
                .catch(() => {});
        }, 2_500);
        return () => clearInterval(timer);
    }, [shouldPollHost, pendingHostAction]);

    React.useEffect(() => {
        if (status.activeTrack && status.activeTrack !== selectedTrack) {
            setSelectedTrack(status.activeTrack);
        }
    }, [status.activeTrack]);

    React.useEffect(() => {
        if (!trackLabs.some((l) => l.id === selectedLabId) && trackLabs.length > 0) {
            setSelectedLabId(trackLabs[0].id);
        }
    }, [trackLabs, selectedLabId]);

    // Polite screen-reader announcement when any lab objective transitions to Auto-Verified
    React.useEffect(() => {
        if (refresherMode) return;
        for (const lab of TRAINING_LABS) {
            const nowVerified = lab.isAutoVerified(verification);
            if (nowVerified && !previouslyVerifiedRef.current.has(lab.id)) {
                previouslyVerifiedRef.current.add(lab.id);
                setLiveAnnouncement(`${ui.verifiedBadgeLabel}: ${lab.badge} ${lab.title}`);
            }
        }
    }, [refresherMode, verification, ui.verifiedBadgeLabel]);

    const activeLab: TrainingLabDefinition =
        trackLabs.find((l) => l.id === selectedLabId) ?? trackLabs[0] ?? TRAINING_LABS[0];
    const activeLabIndex = trackLabs.findIndex((l) => l.id === activeLab.id);
    const nextLabInTrack =
        activeLabIndex >= 0 && activeLabIndex + 1 < trackLabs.length
            ? trackLabs[activeLabIndex + 1]
            : null;

    const activeTrackDef =
        TRAINING_TRACKS.find((t) => t.id === selectedTrack) ?? TRAINING_TRACKS[0];
    const videoGuide = getVideoGuideBySlug(activeLab.videoGuideSlug);
    const coachVideoRef = React.useRef<HTMLVideoElement | null>(null);

    React.useEffect(() => {
        const videoEl = coachVideoRef.current;
        if (!videoEl || !videoGuide) return;
        const applySync = () => syncVideoElementCaptionLocale(videoEl, locale);
        applySync();
        const textTracks = videoEl.textTracks;
        textTracks?.addEventListener?.("addtrack", applySync);
        return () => {
            textTracks?.removeEventListener?.("addtrack", applySync);
        };
    }, [locale, videoGuide]);

    const resolvedSpotlights = React.useMemo(() => {
        if (activeLab.spotlights && activeLab.spotlights.length > 0) {
            return activeLab.spotlights;
        }
        if (activeLab.spotlightSelector) {
            return [
                {
                    id: "primary",
                    selector: activeLab.spotlightSelector,
                    label: activeLab.spotlightLabel ?? ui.showMeWhereLabel,
                },
            ];
        }
        return [];
    }, [activeLab.spotlightLabel, activeLab.spotlightSelector, activeLab.spotlights, ui.showMeWhereLabel]);

    const isLabVerified = (lab: TrainingLabDefinition): boolean =>
        !refresherMode && lab.isAutoVerified(verification);
    const isLabDone = (lab: TrainingLabDefinition): boolean =>
        isLabVerified(lab) || manualCompletedIds.includes(lab.id);

    const completedInTrackCount = trackLabs.filter(isLabDone).length;

    const sandboxPort = hostStatus?.httpsPort ?? 8444;
    const sandboxTtl = hostStatus?.ttlMinutes ?? status.ttlMinutes ?? 120;
    const launchTarget = React.useMemo(
        () =>
            resolveSandboxLaunchTarget(
                hostStatus,
                typeof window !== "undefined" ? window.location.hostname : undefined,
            ),
        [hostStatus],
    );
    const sandboxUrl = launchTarget.url;

    const activeShutdownSummary = React.useMemo(
        () =>
            computeSandboxShutdownSummary({
                remainingSeconds: status.remainingSeconds,
                expiresEpochSeconds: status.expiresEpochSeconds,
                ttlMinutes: status.ttlMinutes ?? 120,
            }),
        [status.expiresEpochSeconds, status.remainingSeconds, status.ttlMinutes],
    );

    const hostShutdownSummary = React.useMemo(
        () =>
            computeSandboxShutdownSummary({
                expiresAt: hostStatus?.expiresAt,
                ttlMinutes: sandboxTtl,
            }),
        [hostStatus?.expiresAt, sandboxTtl],
    );

    const handleHostAction = async (action: "start" | "stop" | "reset") => {
        setHostBusy(true);
        setFeedbackBanner(null);
        try {
            const next = await submitSandboxHostAction(action, sandboxPort, sandboxTtl);
            setHostStatus(next);
            const jobState = next.activeJob?.state;
            const stillInProgress =
                jobState === "QUEUED" ||
                jobState === "RUNNING" ||
                (action === "start" && !next.sandboxRunning && jobState !== "FAILED") ||
                (action === "stop" && next.sandboxRunning && jobState !== "FAILED");
            if (stillInProgress) {
                setPendingHostAction({
                    action,
                    requestId: next.activeJob?.requestId,
                    deadlineMs: Date.now() + 120_000,
                });
                setFeedbackBanner({
                    severity: "info",
                    text: next.activeJob?.message ?? `Executing sandbox '${action}'...`,
                });
            } else {
                setPendingHostAction(null);
                setFeedbackBanner({
                    severity: jobState === "FAILED" ? "error" : "success",
                    text: next.activeJob?.message ?? `Completed '${action}' on host sandbox agent.`,
                });
            }
        } catch (err: any) {
            setPendingHostAction(null);
            setFeedbackBanner({
                severity: "error",
                text: err?.message ?? "Host sandbox request failed.",
            });
        } finally {
            setHostBusy(false);
        }
    };

    React.useEffect(() => {
        return () => {
            transitPollCleanupRef.current?.();
            spotlightPollCleanupRef.current?.();
        };
    }, []);

    const activateLabAndSyncRoute = React.useCallback(
        (lab: TrainingLabDefinition) => {
            setSelectedLabId(lab.id);
            setFeedbackBanner(null);
            if (!lab.splitPaneAdmin && splitAdminOpen) {
                onToggleSplitAdmin(false);
            }
            if (
                !refresherMode &&
                !lab.splitPaneAdmin &&
                activePathname !== undefined &&
                normalizeViewerRoute(activePathname) !== normalizeViewerRoute(lab.route)
            ) {
                onNavigateRoute(lab.route);
            }
        },
        [activePathname, onNavigateRoute, onToggleSplitAdmin, refresherMode, splitAdminOpen],
    );

    const handleSelectTrack = async (trackId: SandboxTrackId) => {
        setSelectedTrack(trackId);
        const firstLab = TRAINING_LABS.find((l) => l.trackId === trackId);
        if (firstLab) {
            activateLabAndSyncRoute(firstLab);
        }
        if (refresherMode) {
            return;
        }
        if (status.activeTrack !== trackId) {
            setBusyAction(true);
            setFeedbackBanner(null);
            try {
                const updated = await stageSandboxTrack(trackId);
                onStatusUpdated(updated);
                dispatchSandboxRefreshEvents({ lanes: true, telemetry: true, events: true, resetForSandboxInjection: true });
                setTimeout(() => {
                    dispatchSandboxRefreshEvents({ lanes: true, telemetry: true, events: true, resetForSandboxInjection: true });
                    onRefreshRequested();
                }, 1_200);
                setFeedbackBanner({
                    severity: "success",
                    text: updated.stageStatusMessage ?? `Staged ${trackId} environment.`,
                });
            } catch (err: any) {
                setFeedbackBanner({
                    severity: "error",
                    text: err?.message ?? "Unable to stage training track.",
                });
            } finally {
                setBusyAction(false);
            }
        }
    };

    const handleRestageCurrentTrack = async () => {
        setBusyAction(true);
        setFeedbackBanner(null);
        try {
            const updated = await stageSandboxTrack(selectedTrack);
            onStatusUpdated(updated);
            dispatchSandboxRefreshEvents({ lanes: true, telemetry: true, events: true, resetForSandboxInjection: true });
            setTimeout(() => {
                dispatchSandboxRefreshEvents({ lanes: true, telemetry: true, events: true, resetForSandboxInjection: true });
                onRefreshRequested();
            }, 1_200);
            setFeedbackBanner({
                severity: "success",
                text: updated.stageStatusMessage ?? "Track environment reset.",
            });
        } catch (err: any) {
            setFeedbackBanner({
                severity: "error",
                text: err?.message ?? "Unable to reset track.",
            });
        } finally {
            setBusyAction(false);
        }
    };

    const handleInject = async (scenario: SandboxScenarioId, laneSlot: 1 | 2 = 1) => {
        transitPollCleanupRef.current?.();
        transitPollCleanupRef.current = null;
        setBusyAction(true);
        setFeedbackBanner(null);

        const baselineTotal = verification.totalOccupancies;
        try {
            const res = await injectSandboxScenario(scenario, laneSlot);

            if (scenario === "stage_webrelay_demo") {
                if (splitAdminOpen) onToggleSplitAdmin(false);
                if (activePathname !== undefined && normalizeViewerRoute(activePathname) !== "/health") {
                    onNavigateRoute("/health");
                }
                dispatchSandboxRefreshEvents({ lanes: true, telemetry: true });
                onRefreshRequested();
                setTimeout(() => {
                    dispatchSandboxRefreshEvents({ lanes: true, telemetry: true });
                    onRefreshRequested();
                }, 700);
                setFeedbackBanner({
                    severity: "success",
                    text: `${res.message} Click 'Lights & Sound' on DemoLane01 to test coil modes and pulses.`,
                });
                return;
            }

            const isInstantFaultControl =
                scenario === "fault_gamma_high" ||
                scenario === "fault_tamper" ||
                scenario === "clear_faults";

            if (isInstantFaultControl) {
                if (splitAdminOpen) onToggleSplitAdmin(false);
                if (
                    activePathname !== undefined &&
                    normalizeViewerRoute(activePathname) !== "/health" &&
                    normalizeViewerRoute(activePathname) !== "/"
                ) {
                    onNavigateRoute("/health");
                }
                const faultExplain =
                    scenario === "fault_gamma_high"
                        ? "Injected Fault - Gamma High (GH) on DemoLane01 — observe the red 'Fault - Gamma High' badge on Status of Health (/health) and Dashboard (/)."
                        : scenario === "fault_tamper"
                            ? "Injected Tamper Alarm (TT) on DemoLane01 — observe the red 'Tamper: Active' badge on Status of Health (/health)."
                            : "Cleared faults and tamper state (TC + GB/NB) on DemoLane01 — lane restored to Online.";
                setFeedbackBanner({
                    severity: scenario === "clear_faults" ? "success" : "info",
                    text: faultExplain,
                });
                for (const delayMs of [250, 950]) {
                    setTimeout(() => {
                        dispatchSandboxRefreshEvents({ telemetry: true });
                        onRefreshRequested();
                    }, delayMs);
                }
                return;
            }

            // Occupancy transit scenario: navigate immediately to the page where the resulting row appears!
            if (splitAdminOpen) onToggleSplitAdmin(false);
            const requiresEventLog =
                scenario === "norm_eml" ||
                scenario === "extended_occupancy" ||
                scenario === "clean_pass";
            const currentNorm = normalizeViewerRoute(activePathname);
            if (activePathname !== undefined) {
                if (requiresEventLog && currentNorm !== "/event-log") {
                    onNavigateRoute("/event-log");
                } else if (!requiresEventLog && currentNorm !== "/" && currentNorm !== "/event-log") {
                    onNavigateRoute(activeLab.route);
                }
            }

            const inFlightText =
                scenario === "norm_eml"
                    ? "Simulating ~4s balanced 4-panel NORM cargo transit on DemoLane01 — opening Events (/event-log) where EML auto-adjudicates Code 9999..."
                    : scenario === "extended_occupancy"
                        ? "Simulating ~10s stalled vehicle hold on DemoLane01 — Fault - Extended Occupancy fires at 8s, then exits into Events (/event-log) as Code 9998..."
                        : scenario === "clean_pass"
                            ? "Simulating ~4s non-alarm Clean Pass on DemoLane01 — opening Events (/event-log)..."
                            : scenario === "neutron_alarm"
                                ? "Simulating ~4s Neutron Alarm transit on DemoLane01 — watch EML refuse auto-release..."
                                : "Simulating ~4s alarm transit on DemoLane01 — watch the lane pulse red as radiation counts spike...";

            const completionText =
                scenario === "norm_eml"
                    ? "Distributed NORM pass complete! Auto-adjudicated at t=0 as 'Code 9999: EML Non-Threat' — shown at row #1 of Events (/event-log) and intentionally suppressed from the Dashboard (/) active alarm queue."
                    : scenario === "extended_occupancy"
                        ? "Extended Hold complete! Auto-adjudicated on exit as 'Code 9998: Extended Occupancy Gamma Alarm' — shown at row #1 of Events (/event-log) and suppressed from the Dashboard (/) active alarm queue."
                        : scenario === "clean_pass"
                            ? "Clean Pass complete! Recorded at row #1 of Events (/event-log) with Status 'None' (routine non-alarm traffic never enters the Dashboard alarm queue)."
                            : scenario === "neutron_alarm"
                                ? "Neutron Alarm recorded at row #1 (Unadjudicated)! Notice EML refused to auto-release it — Neutron triggers always demand human secondary inspection."
                                : "New Alarm recorded at row #1 on DemoLane01! Click the bold alarm row in the table to inspect its 5 camera frames and submit an adjudication.";

            setTransitInProgress(true);
            setFeedbackBanner({ severity: "info", text: inFlightText });
            setTimeout(() => {
                dispatchSandboxRefreshEvents({ telemetry: true });
            }, 600);

            const startedMs = Date.now();
            const maxWaitMs = scenario === "extended_occupancy" ? 14_500 : 7_800;
            const minTransitMs = scenario === "extended_occupancy" ? 8_500 : 2_200;
            let finished = false;
            let followUpTimer: ReturnType<typeof setTimeout> | null = null;

            const finishTransit = (finalStatus?: SandboxActiveStatus) => {
                if (finished) return;
                finished = true;
                clearInterval(pollTimer);
                setTransitInProgress(false);
                if (finalStatus?.sandboxMode) {
                    onStatusUpdated(finalStatus);
                } else {
                    onRefreshRequested();
                }
                dispatchSandboxRefreshEvents({
                    telemetry: true,
                    events: true,
                    resetForSandboxInjection: true,
                });
                setFeedbackBanner({ severity: "success", text: completionText });
                setLiveAnnouncement(completionText);
                followUpTimer = setTimeout(() => {
                    dispatchSandboxRefreshEvents({
                        telemetry: true,
                        events: true,
                        resetForSandboxInjection: true,
                    });
                    onRefreshRequested();
                }, 1_100);
            };

            const pollTimer = setInterval(() => {
                const elapsed = Date.now() - startedMs;
                fetchSandboxActiveStatus()
                    .then((polled) => {
                        if (finished) return;
                        if (!polled.sandboxMode) {
                            if (elapsed >= maxWaitMs) {
                                finishTransit();
                            }
                            return;
                        }
                        onStatusUpdated(polled);
                        const nextTotal = polled.verification?.totalOccupancies ?? 0;
                        const transitSettled =
                            elapsed >= minTransitMs &&
                            !polled.busyOccupancy &&
                            (nextTotal > baselineTotal || elapsed >= maxWaitMs);
                        if (transitSettled || elapsed >= maxWaitMs) {
                            finishTransit(polled);
                        }
                    })
                    .catch(() => {
                        if (!finished && elapsed >= maxWaitMs) {
                            finishTransit();
                        }
                    });
            }, 650);

            transitPollCleanupRef.current = () => {
                finished = true;
                clearInterval(pollTimer);
                if (followUpTimer) clearTimeout(followUpTimer);
            };
        } catch (err: any) {
            setTransitInProgress(false);
            setFeedbackBanner({
                severity: "error",
                text: err?.message ?? "Practice event injection failed.",
            });
        } finally {
            setBusyAction(false);
        }
    };

    const handleToggleManualDone = (labId: string) => {
        setManualCompletedIds((prev) => {
            const next = prev.includes(labId) ? prev.filter((x) => x !== labId) : [...prev, labId];
            if (typeof window !== "undefined") {
                try {
                    window.sessionStorage.setItem(STORAGE_KEY_MANUAL_LABS, JSON.stringify(next));
                } catch {
                    // Ignore storage quota errors
                }
            }
            return next;
        });
    };

    const handleSpotlight = (selector?: string) => {
        if (!selector || typeof document === "undefined") return;
        spotlightPollCleanupRef.current?.();
        spotlightPollCleanupRef.current = null;

        if (triggerPlatformSpotlight(selector)) {
            return;
        }

        const needsViewerPage = !selector.includes("split-admin");
        if (needsViewerPage && splitAdminOpen) {
            onToggleSplitAdmin(false);
        }
        if (
            needsViewerPage &&
            !activeLab.splitPaneAdmin &&
            (activePathname === undefined ||
                normalizeViewerRoute(activePathname) !== normalizeViewerRoute(activeLab.route))
        ) {
            onNavigateRoute(activeLab.route);
        }

        let attempts = 0;
        const timer = setInterval(() => {
            attempts += 1;
            if (triggerPlatformSpotlight(selector)) {
                clearInterval(timer);
                spotlightPollCleanupRef.current = null;
                return;
            }
            if (attempts >= 18) {
                clearInterval(timer);
                spotlightPollCleanupRef.current = null;
                setFeedbackBanner({
                    severity: "info",
                    text:
                        activeLab.id === "adm-5" && verification.configuredLaneCount === 0
                            ? "Click 'Stage DemoLane01 + Loopback WebRelay' below first so a lane is visible on Status of Health (/health)."
                            : `Open ${activeLab.route} so the highlighted control is visible on screen.`,
                });
            }
        }, 120);
        spotlightPollCleanupRef.current = () => clearInterval(timer);
    };

    const handleCopy = async (value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setFeedbackBanner({ severity: "success", text: `${ui.copiedNotice}: ${value}` });
        } catch {
            setFeedbackBanner({ severity: "info", text: value });
        }
    };

    const handleDownloadCertificate = async () => {
        setBusyAction(true);
        setFeedbackBanner(null);
        try {
            const submissions: CompletedLabSubmission[] = TRAINING_LABS.filter(isLabDone).map((lab) => ({
                trackId: lab.trackId,
                labId: lab.badge,
                title: lab.title,
                status: isLabVerified(lab) ? "verified" : "completed",
            }));
            await downloadTrainingCertificatePdf(traineeName, submissions);
            setFeedbackBanner({
                severity: "success",
                text: "Downloaded 1-page PDF Training Completion Record.",
            });
        } catch (err: any) {
            setFeedbackBanner({
                severity: "error",
                text: err?.message ?? "Failed generating PDF completion record.",
            });
        } finally {
            setBusyAction(false);
        }
    };

    return (
        <aside
            className="oscar-training-coach-aside"
            aria-label={refresherMode ? ui.walkthroughButtonLabel : ui.coachButtonLabel}
            data-testid="training-coach-dock"
        >
            <div className="oscar-sr-only" role="status" aria-live="polite">
                {liveAnnouncement}
            </div>

            {/* Header */}
            <Box
                sx={{
                    px: 1.75,
                    py: 1.25,
                    bgcolor: "#0f172a",
                    color: "#f8fafc",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    minInlineSize: 0,
                }}
            >
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minInlineSize: 0 }}>
                    <SchoolRoundedIcon sx={{ color: "#fbbf24", flexShrink: 0 }} fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={700} noWrap>
                        {refresherMode ? ui.walkthroughButtonLabel : ui.coachButtonLabel}
                    </Typography>
                    {refresherMode && (
                        <Chip
                            size="small"
                            label={ui.refresherBadge}
                            data-testid="coach-refresher-badge"
                            sx={{
                                height: 20,
                                fontSize: "0.66rem",
                                fontWeight: 700,
                                bgcolor: "rgba(56, 189, 248, 0.22)",
                                color: "#bae6fd",
                            }}
                        />
                    )}
                    <Chip
                        size="small"
                        label={`${completedInTrackCount}/${trackLabs.length}`}
                        sx={{
                            height: 20,
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            bgcolor: "rgba(251, 191, 36, 0.2)",
                            color: "#fde68a",
                        }}
                    />
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
                    {!refresherMode && (
                        <Tooltip title={ui.resetTrackLabel}>
                            <span>
                                <IconButton
                                    size="small"
                                    sx={{ color: "#e2e8f0" }}
                                    aria-label={ui.resetTrackLabel}
                                    disabled={busyAction}
                                    onClick={handleRestageCurrentTrack}
                                    data-testid="training-coach-restage-track"
                                >
                                    <RefreshRoundedIcon fontSize="small" />
                                </IconButton>
                            </span>
                        </Tooltip>
                    )}
                    <Tooltip title={ui.hideCoachLabel}>
                        <IconButton
                            size="small"
                            sx={{ color: "#e2e8f0" }}
                            aria-label={ui.hideCoachLabel}
                            onClick={onMinimize}
                            data-testid="training-coach-minimize"
                        >
                            <CloseRoundedIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Box>

            {(busyAction || transitInProgress || hostBusy || hostStarting || status.stagingInProgress || status.busyOccupancy) && (
                <LinearProgress color="warning" />
            )}

            {/* Scrollable Body (overscroll-behavior: contain; scrollbar-gutter: stable) */}
            <div className="oscar-training-coach-scroll">
                {refresherMode ? (
                    <details
                        className="oscar-coach-orientation"
                        open
                        data-testid="coach-refresher-orientation"
                    >
                        <summary className="oscar-coach-summary">
                            <span>{ui.refresherOrientationSummary}</span>
                        </summary>
                        <div className="oscar-coach-accordion-body">
                            <Typography
                                variant="body2"
                                sx={{ fontSize: "0.79rem", lineHeight: 1.4, mb: 1, color: "#1e293b" }}
                            >
                                {ui.refresherSafeNote}
                            </Typography>
                            <Box
                                sx={{
                                    p: 1.1,
                                    borderRadius: 1.5,
                                    bgcolor: "#ffffff",
                                    border: "1px solid #fcd34d",
                                }}
                                data-testid="coach-sandbox-launcher"
                            >
                                <Typography
                                    variant="caption"
                                    fontWeight={700}
                                    sx={{ display: "block", color: "#92400e", mb: 0.5 }}
                                >
                                    {ui.practiceCardTitle}
                                </Typography>
                                <Box component="ul" sx={{ m: 0, pl: 2, mb: 1 }}>
                                    <Typography
                                        component="li"
                                        variant="caption"
                                        sx={{ display: "list-item", lineHeight: 1.38, mb: 0.4, color: "#334155" }}
                                    >
                                        {ui.practiceIsolationBullet}
                                    </Typography>
                                    <Typography
                                        component="li"
                                        variant="caption"
                                        sx={{ display: "list-item", lineHeight: 1.38, mb: 0.4, color: "#334155" }}
                                    >
                                        {ui.practiceShutdownBullet(sandboxTtl)}
                                    </Typography>
                                    <Typography
                                        component="li"
                                        variant="caption"
                                        sx={{ display: "list-item", lineHeight: 1.38, color: "#334155" }}
                                    >
                                        {ui.practiceSignInBullet}
                                    </Typography>
                                </Box>

                                <Typography
                                    variant="caption"
                                    fontWeight={700}
                                    sx={{
                                        display: "block",
                                        mb: 0.75,
                                        color: hostStatus?.sandboxRunning ? "#15803d" : "#475569",
                                    }}
                                    data-testid="coach-sandbox-host-status"
                                >
                                    {hostStatus?.sandboxRunning
                                        ? ui.practiceRunningStatus(
                                              hostShutdownSummary.durationText,
                                              hostShutdownSummary.expiresTimeText,
                                          )
                                        : ui.practiceStoppedStatus(sandboxTtl)}
                                </Typography>

                                {hostStatus?.sandboxRunning ? (
                                    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                                        <Button
                                            component="a"
                                            href={sandboxUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            size="small"
                                            variant="contained"
                                            color="success"
                                            endIcon={<OpenInNewRoundedIcon fontSize="small" />}
                                            data-testid="coach-sandbox-open-btn"
                                            sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.76rem" }}
                                        >
                                            {ui.openPracticeBtn(launchTarget.badgeLabel)}
                                        </Button>
                                        {hostStatus.canStopOrReset && (
                                            <>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    disabled={hostBusy}
                                                    startIcon={<RestartAltRoundedIcon fontSize="small" />}
                                                    onClick={() => handleHostAction("reset")}
                                                    data-testid="coach-sandbox-reset-btn"
                                                    sx={{ textTransform: "none", fontSize: "0.74rem" }}
                                                >
                                                    Reset
                                                </Button>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    color="error"
                                                    disabled={hostBusy}
                                                    startIcon={<StopCircleOutlinedIcon fontSize="small" />}
                                                    onClick={() => handleHostAction("stop")}
                                                    data-testid="coach-sandbox-stop-btn"
                                                    sx={{ textTransform: "none", fontSize: "0.74rem" }}
                                                >
                                                    Stop
                                                </Button>
                                            </>
                                        )}
                                    </Stack>
                                ) : hostStatus?.agentActive ? (
                                    <Button
                                        size="small"
                                        variant="contained"
                                        color="warning"
                                        disabled={hostBusy || hostStarting}
                                        startIcon={<PlayArrowRoundedIcon fontSize="small" />}
                                        onClick={() => handleHostAction("start")}
                                        data-testid="coach-sandbox-launch-btn"
                                        sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.76rem" }}
                                    >
                                        {hostStarting
                                            ? ui.startingPracticeBtn
                                            : ui.launchPracticeBtn(launchTarget.badgeLabel)}
                                    </Button>
                                ) : (
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{ display: "block", lineHeight: 1.35 }}
                                        data-testid="coach-sandbox-bridge-hint"
                                    >
                                        {renderInlineCode(ui.practiceBridgeHint)}
                                    </Typography>
                                )}
                            </Box>
                        </div>
                    </details>
                ) : (
                    <Alert
                        severity="warning"
                        data-testid="coach-sandbox-session-banner"
                        sx={{
                            mb: 1.25,
                            py: 0.4,
                            "& .MuiAlert-message": { fontSize: "0.76rem", lineHeight: 1.38 },
                        }}
                    >
                        {ui.activeSandboxShutdownBanner(
                            activeShutdownSummary.durationText,
                            activeShutdownSummary.expiresTimeText,
                        )}
                    </Alert>
                )}

                {/* Role Track Switcher */}
                <Stack direction="row" spacing={0.75} sx={{ mb: 1.25, minInlineSize: 0 }}>
                    {TRAINING_TRACKS.map((track) => {
                        const selected = track.id === selectedTrack;
                        return (
                            <Button
                                key={track.id}
                                variant={selected ? "contained" : "outlined"}
                                size="small"
                                color={selected ? "primary" : "inherit"}
                                disabled={busyAction}
                                onClick={() => handleSelectTrack(track.id)}
                                data-testid={`training-track-btn-${track.id}`}
                                sx={{
                                    flex: "1 1 0%",
                                    minInlineSize: 0,
                                    textTransform: "none",
                                    fontSize: "0.76rem",
                                    px: 0.75,
                                    py: 0.5,
                                    fontWeight: selected ? 700 : 500,
                                }}
                            >
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {track.shortLabel[locale] ?? track.shortLabel.en}
                                </span>
                            </Button>
                        );
                    })}
                </Stack>

                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.25, lineHeight: 1.35 }}>
                    {renderInlineCode(activeTrackDef.subtitle[locale] ?? activeTrackDef.subtitle.en)}
                </Typography>

                {/* Lab Pills within Track */}
                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mb: 1.5 }}>
                    {trackLabs.map((lab) => {
                        const active = lab.id === activeLab.id;
                        const verified = isLabVerified(lab);
                        const done = isLabDone(lab);
                        return (
                            <Chip
                                key={lab.id}
                                clickable
                                size="small"
                                icon={done ? <CheckCircleRoundedIcon fontSize="small" /> : undefined}
                                label={`${lab.badge} ${lab.title.split(" ")[0].replace(/[,:;]+$/, "")}`}
                                color={active ? "primary" : verified ? "success" : done ? "info" : "default"}
                                variant={active ? "filled" : "outlined"}
                                onClick={() => activateLabAndSyncRoute(lab)}
                                data-testid={`training-lab-chip-${lab.id}`}
                                sx={{ fontWeight: active ? 700 : 500 }}
                            />
                        );
                    })}
                </Stack>

                {feedbackBanner && (
                    <Alert
                        severity={feedbackBanner.severity}
                        onClose={() => setFeedbackBanner(null)}
                        sx={{ mb: 1.25, py: 0.25, "& .MuiAlert-message": { fontSize: "0.78rem" } }}
                    >
                        {feedbackBanner.text}
                    </Alert>
                )}

                {/* Active Lab Header Card */}
                <Box
                    sx={{
                        p: 1.25,
                        mb: 1.25,
                        borderRadius: 2,
                        bgcolor: "#ffffff",
                        border: "1px solid #cbd5e1",
                        minInlineSize: 0,
                    }}
                >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                        <Chip
                            size="small"
                            label={`Lab ${activeLab.badge} · ${activeLab.durationEstimate}`}
                            sx={{ fontWeight: 700, bgcolor: "#e0f2fe", color: "#0369a1", height: 22 }}
                        />
                        <Chip
                            size="small"
                            icon={isLabDone(activeLab) ? <CheckCircleRoundedIcon fontSize="small" /> : undefined}
                            label={
                                isLabVerified(activeLab)
                                    ? ui.verifiedBadgeLabel
                                    : isLabDone(activeLab)
                                        ? ui.completedBadgeLabel
                                        : ui.pendingBadgeLabel
                            }
                            color={isLabVerified(activeLab) ? "success" : isLabDone(activeLab) ? "info" : "warning"}
                            variant={isLabDone(activeLab) ? "filled" : "outlined"}
                            data-testid="training-active-lab-status"
                            sx={{ height: 22, fontWeight: 600 }}
                        />
                    </Stack>

                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
                        {activeLab.pageIconKey && (
                            <PlatformIconBadge iconKey={activeLab.pageIconKey} size="card" />
                        )}
                        <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.28 }}>
                            {renderInlineCode(activeLab.title)}
                        </Typography>
                    </Stack>

                    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                        {activeLab.splitPaneAdmin ? (
                            refresherMode ? (
                                hostStatus?.canStopOrReset && (
                                    <Button
                                        component="a"
                                        href="/sensorhub/admin"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        size="small"
                                        variant="outlined"
                                        color="secondary"
                                        endIcon={<OpenInNewRoundedIcon fontSize="small" />}
                                        data-testid="training-refresher-admin-link"
                                        sx={{ textTransform: "none" }}
                                    >
                                        {ui.refresherAdminTabLabel}
                                    </Button>
                                )
                            ) : (
                                <Button
                                    size="small"
                                    variant={splitAdminOpen ? "outlined" : "contained"}
                                    color="secondary"
                                    startIcon={<SplitscreenRoundedIcon fontSize="small" />}
                                    onClick={() => onToggleSplitAdmin(!splitAdminOpen)}
                                    data-testid="training-toggle-split-admin"
                                    sx={{ textTransform: "none" }}
                                >
                                    {splitAdminOpen ? ui.closeSplitAdminLabel : ui.openSplitAdminLabel}
                                </Button>
                            )
                        ) : (
                            <Button
                                size="small"
                                variant="contained"
                                startIcon={<LaunchRoundedIcon fontSize="small" />}
                                onClick={() => {
                                    if (splitAdminOpen) onToggleSplitAdmin(false);
                                    onNavigateRoute(activeLab.route);
                                }}
                                data-testid="training-open-lab-page"
                                sx={{ textTransform: "none" }}
                            >
                                {ui.openPageLabel} ({activeLab.route})
                            </Button>
                        )}
                        {resolvedSpotlights.map((sp, spIdx) => {
                            const iconDef = sp.iconKey ? PLATFORM_ICONS[sp.iconKey] : undefined;
                            const IconComp = iconDef?.Icon;
                            const buttonLabel = iconDef?.highlightLabel[locale] ?? sp.label ?? ui.showMeWhereLabel;
                            return (
                                <Button
                                    key={sp.id}
                                    size="small"
                                    variant="outlined"
                                    startIcon={
                                        IconComp ? (
                                            <IconComp fontSize="small" aria-hidden="true" />
                                        ) : (
                                            <GpsFixedRoundedIcon fontSize="small" aria-hidden="true" />
                                        )
                                    }
                                    endIcon={
                                        IconComp ? (
                                            <GpsFixedRoundedIcon sx={{ fontSize: "14px !important", opacity: 0.78 }} aria-hidden="true" />
                                        ) : undefined
                                    }
                                    onClick={() => handleSpotlight(sp.selector)}
                                    data-testid={spIdx === 0 ? "training-spotlight-btn" : `training-spotlight-btn-${sp.id}`}
                                    data-spotlight-id={sp.id}
                                    sx={{ textTransform: "none", fontSize: "0.76rem" }}
                                >
                                    {buttonLabel}
                                </Button>
                            );
                        })}
                    </Stack>
                </Box>

                {/* Non-Exclusive Accordion 1: Hands-On Steps & Practice Controls (open by default) */}
                <details className="oscar-coach-accordion" open>
                    <summary className="oscar-coach-summary">
                        <span>{ui.stepsSummary}</span>
                    </summary>
                    <div className="oscar-coach-accordion-body">
                        <Box component="ol" sx={{ m: 0, pl: 2.25, mb: 1.25 }}>
                            {activeLab.steps.map((step, idx) => (
                                <Typography
                                    key={idx}
                                    component="li"
                                    variant="body2"
                                    sx={{ fontSize: "0.82rem", mb: 0.75, lineHeight: 1.42 }}
                                >
                                    {renderInlineCode(step)}
                                </Typography>
                            ))}
                        </Box>

                        {!refresherMode && activeLab.injectActions && activeLab.injectActions.length > 0 && (
                            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
                                {activeLab.injectActions.map((act) => (
                                    <Button
                                        key={act.scenario}
                                        size="small"
                                        variant="contained"
                                        color="warning"
                                        disabled={busyAction}
                                        startIcon={<PlayArrowRoundedIcon fontSize="small" />}
                                        onClick={() => handleInject(act.scenario, act.laneSlot ?? 1)}
                                        data-testid={`training-inject-${act.scenario}`}
                                        sx={{ textTransform: "none", fontSize: "0.76rem" }}
                                    >
                                        {act.label}
                                    </Button>
                                ))}
                            </Stack>
                        )}

                        {!refresherMode && activeLab.sampleFiles && activeLab.sampleFiles.length > 0 && (
                            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
                                {activeLab.sampleFiles.map((sample) => (
                                    <Button
                                        key={sample.fileName}
                                        component="a"
                                        href={buildSandboxSampleDownloadUrl(sample.fileName)}
                                        download={sample.fileName}
                                        size="small"
                                        variant="outlined"
                                        startIcon={<DownloadRoundedIcon fontSize="small" />}
                                        data-testid={`training-sample-${sample.fileName}`}
                                        sx={{ textTransform: "none", fontSize: "0.76rem" }}
                                    >
                                        {sample.buttonLabel}
                                    </Button>
                                ))}
                            </Stack>
                        )}

                        {refresherMode &&
                            ((activeLab.injectActions && activeLab.injectActions.length > 0) ||
                                (activeLab.sampleFiles && activeLab.sampleFiles.length > 0)) && (
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ display: "block", mb: 1, fontStyle: "italic" }}
                                    data-testid="training-refresher-simulation-note"
                                >
                                    {ui.refresherSimulationNote}
                                </Typography>
                            )}

                        {activeLab.copySnippets && activeLab.copySnippets.length > 0 && (
                            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
                                {activeLab.copySnippets.map((snip) => (
                                    <Button
                                        key={snip.label}
                                        size="small"
                                        variant="outlined"
                                        color="inherit"
                                        startIcon={<ContentCopyRoundedIcon fontSize="small" />}
                                        onClick={() => handleCopy(snip.value)}
                                        sx={{ textTransform: "none", fontSize: "0.74rem" }}
                                    >
                                        <span>{snip.label}:&nbsp;</span>
                                        <code className="oscar-coach-code">{snip.value}</code>
                                    </Button>
                                ))}
                            </Stack>
                        )}

                        <Box
                            sx={{
                                mt: 1,
                                p: 1,
                                borderRadius: 1.5,
                                bgcolor: isLabVerified(activeLab) ? "#ecfdf5" : "#f8fafc",
                                border: "1px solid",
                                borderColor: isLabVerified(activeLab) ? "#6ee7b7" : "#e2e8f0",
                            }}
                        >
                            <Typography variant="caption" sx={{ display: "block", fontWeight: 600, color: "#334155" }}>
                                {ui.objectivePrefix} {renderInlineCode(activeLab.objectiveSummary)}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                                {!isLabVerified(activeLab) ? (
                                    <Button
                                        size="small"
                                        variant="text"
                                        onClick={() => handleToggleManualDone(activeLab.id)}
                                        data-testid="training-manual-complete-btn"
                                        sx={{ p: 0, textTransform: "none", fontSize: "0.76rem" }}
                                    >
                                        {manualCompletedIds.includes(activeLab.id) ? "✓ " : ""}
                                        {ui.markCompleteLabel}
                                    </Button>
                                ) : (
                                    <span />
                                )}
                                {nextLabInTrack && (
                                    <Button
                                        size="small"
                                        variant={isLabDone(activeLab) ? "contained" : "outlined"}
                                        color={isLabDone(activeLab) ? "primary" : "inherit"}
                                        onClick={() => activateLabAndSyncRoute(nextLabInTrack)}
                                        data-testid="training-next-lab-btn"
                                        sx={{ textTransform: "none", fontSize: "0.75rem", py: 0.25 }}
                                    >
                                        Next Lab ({nextLabInTrack.badge}) →
                                    </Button>
                                )}
                            </Stack>
                        </Box>
                    </div>
                </details>

                {/* Non-Exclusive Accordion 2: Bite-Sized 1080p Video Guide + Closed Captions */}
                {videoGuide && (
                    <details className="oscar-coach-accordion">
                        <summary className="oscar-coach-summary">
                            <span>
                                {ui.watchVideoSummary} · #{videoGuide.badge} ({videoGuide.durationLabel})
                            </span>
                        </summary>
                        <div className="oscar-coach-accordion-body">
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
                                {videoGuide.titles[locale] ?? videoGuide.titles.en}
                            </Typography>
                            <video
                                ref={coachVideoRef}
                                key={videoGuide.slug}
                                className="oscar-coach-video"
                                width={1920}
                                height={1080}
                                controls
                                preload="none"
                                playsInline
                                data-testid="training-coach-video"
                            >
                                <source src={videoGuide.mp4Url} type="video/mp4" />
                                {getVideoGuideCaptionTracks(videoGuide).map((track) => (
                                    <track
                                        key={track.locale}
                                        kind="captions"
                                        srcLang={track.locale}
                                        label={track.label}
                                        src={track.src}
                                        default={locale === track.locale}
                                    />
                                ))}
                            </video>
                        </div>
                    </details>
                )}

                {/* Non-Exclusive Accordion 3: Annotated 1920x1080 Reference Screenshot & Operational Why */}
                <details className="oscar-coach-accordion">
                    <summary className="oscar-coach-summary">
                        <span>{ui.referenceImageSummary}</span>
                    </summary>
                    <div className="oscar-coach-accordion-body">
                        <Typography variant="body2" sx={{ fontSize: "0.8rem", mb: 1, lineHeight: 1.4 }}>
                            <strong>{ui.whyItMattersLabel}</strong> {renderInlineCode(activeLab.whyItMatters)}
                        </Typography>
                        <img
                            className="oscar-coach-screenshot"
                            src={`/manual-screenshots/${activeLab.screenshotFile}`}
                            alt={activeLab.screenshotCaption}
                            width={1920}
                            height={1080}
                            loading="lazy"
                            decoding="async"
                            data-testid="training-coach-screenshot"
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                            {activeLab.screenshotCaption}
                        </Typography>
                    </div>
                </details>

                {!refresherMode && (
                    <>
                        <Divider sx={{ my: 1.5 }} />

                        {/* 1-Page PDF Training Completion Record */}
                        <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: "#ffffff", border: "1px solid #cbd5e1" }}>
                            <TextField
                                size="small"
                                fullWidth
                                label={ui.traineeNamePlaceholder}
                                value={traineeName}
                                onChange={(e) => setTraineeName(e.target.value)}
                                inputProps={{ maxLength: 80, "data-testid": "training-trainee-name-input" }}
                                sx={{ mb: 1 }}
                            />
                            <Button
                                fullWidth
                                size="small"
                                variant="outlined"
                                startIcon={<DownloadRoundedIcon fontSize="small" />}
                                disabled={busyAction}
                                onClick={handleDownloadCertificate}
                                data-testid="training-download-certificate-btn"
                                sx={{ textTransform: "none", fontWeight: 600 }}
                            >
                                {ui.certificateButtonLabel}
                            </Button>
                        </Box>
                    </>
                )}
            </div>
        </aside>
    );
}
