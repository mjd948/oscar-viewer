"use client";

import * as React from "react";
import {
    Alert,
    Box,
    Button,
    Chip,
    LinearProgress,
    Paper,
    Stack,
    Typography,
} from "@mui/material";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import StopCircleOutlinedIcon from "@mui/icons-material/StopCircleOutlined";
import { Locale } from "@/app/contexts/LanguageContext";
import {
    computeSandboxShutdownSummary,
    fetchSandboxActiveStatus,
    fetchSandboxHostStatus,
    resolveSandboxLaunchTarget,
    SandboxHostStatus,
    submitSandboxHostAction,
} from "@/lib/data/oscar/TrainingSandboxApi";

interface LauncherCopy {
    title: string;
    badge: string;
    desc: string;
    safetyNote: string;
    whatToKnowTitle: string;
    shutdownStopped: (ttl: number) => string;
    shutdownRunning: (dur: string, at: string | null) => string;
    credentialsNote: string;
    insideSandboxAlert: string;
    walkthroughBtn: string;
    launchBtn: (badgeLabel: string) => string;
    startingBtn: string;
    openSandboxBtn: (badgeLabel: string) => string;
    resetBtn: string;
    stopBtn: string;
    copyLinuxBtn: string;
    copyWindowsBtn: string;
    bridgeNote: string;
    copiedMsg: string;
}

const LAUNCHER_COPY: Record<Locale, LauncherCopy> = {
    en: {
        title: "Guided Walkthrough (:443) & Hands-On Training Sandbox (`oscar-sandbox` :8444)",
        badge: "Zero Production Impact",
        desc: "Open the side-by-side Read-Only Guided Walkthrough anytime on this console, or launch the isolated :8444 Practice Sandbox to practice SensorHub Admin lane setup, CSV import, detector faults, 16-bit WCO UFF cargo radiographs, .n42 spectra, and alarm adjudication against a built-in loopback Rapiscan + RTSP micro-emulator — with 100% zero writes to live PostgreSQL, Parquet archives, or config.json.",
        safetyNote: "Isolation guarantee: :8444 runs in disposable containers (`archive.enabled = false`) and permanently wipes all practice data (`down -v` in < 2s) when stopped or when its auto-shutdown timer expires.",
        whatToKnowTitle: "What to Expect & When It Shuts Down:",
        shutdownStopped: (ttl) => `• Auto-Shutdown Timer: STOPPED right now — once launched, :8444 automatically shuts down and wipes all practice data after ${ttl} minutes (requires ≥ 3.5 GiB free server RAM).`,
        shutdownRunning: (dur, at) => `• Active Session Countdown: RUNNING — automatically shuts down and erases all practice data in ${dur}${at ? ` (at ${at})` : ""}. Export your 1-page PDF Completion Record before shutdown.`,
        credentialsNote: "• Sign-In, HTTPS & Watermarks: Opens https://<host>:8444 on LAN/VPN (or https://<site>-sandbox.<hub> with Let's Encrypt HTTPS over remote Federation Hub tunnels) using your existing OSCAR username/password, SSO, or Passkey (one-way read-only copy). Every sandbox export is stamped TRAINING SANDBOX — NON-OPERATIONAL.",
        insideSandboxAlert: "Active session: You are currently inside the ephemeral Hands-On Training Sandbox. Click 'Training Coach' in the top bar to switch tracks, inject practice events, or download your 1-page PDF Completion Record before auto-shutdown.",
        walkthroughBtn: "Open Guided Walkthrough (Read-Only Refresher)",
        launchBtn: (b) => `Launch Sandbox (${b})`,
        startingBtn: "Starting Sandbox (~20–40s)...",
        openSandboxBtn: (b) => `Open Training Sandbox (${b})`,
        resetBtn: "Reset Sandbox",
        stopBtn: "Stop & Flush",
        copyLinuxBtn: "Copy Linux Start Command",
        copyWindowsBtn: "Copy Windows Start Command",
        bridgeNote: "Optional 1-click browser launch: an Administrator can enable the host watcher once with",
        copiedMsg: "Copied command:",
    },
    es: {
        title: "Recorrido guiado (:443) y entorno práctico de formación (`oscar-sandbox` :8444)",
        badge: "Cero impacto en producción",
        desc: "Abra en cualquier momento el Recorrido guiado de solo lectura en esta consola, o inicie el entorno aislado :8444 para practicar configuración de carriles, CSV, fallos, radiografías WCO UFF de 16 bits, espectros .n42 y adjudicación con microemulador local — sin escribir jamás en PostgreSQL real, Parquet ni config.json.",
        safetyNote: "Aislamiento garantizado: :8444 se ejecuta en contenedores desechables (`archive.enabled = false`) y se purga por completo (`down -v` en < 2 s) al detenerse o expirar el temporizador.",
        whatToKnowTitle: "Qué esperar y cuándo se apaga:",
        shutdownStopped: (ttl) => `• Apagado automático: DETENIDO ahora — tras iniciar, :8444 se apaga automáticamente y borra todos los datos de práctica a los ${ttl} minutos (requiere ≥ 3.5 GiB de RAM libre).`,
        shutdownRunning: (dur, at) => `• Cuenta atrás activa: EN EJECUCIÓN — se apaga y purga automáticamente en ${dur}${at ? ` (a las ${at})` : ""}. Descargue su PDF de finalización antes del apagado.`,
        credentialsNote: "• Acceso, HTTPS y marcas: Abre https://<host>:8444 en LAN/VPN (o https://<sitio>-sandbox.<hub> con Let's Encrypt en túneles remotos) con su usuario/contraseña, SSO o Passkey actual. Toda exportación lleva TRAINING SANDBOX — NON-OPERATIONAL.",
        insideSandboxAlert: "Sesión activa: está dentro del entorno efímero de práctica. Pulse 'Guía de Práctica' en la barra superior para cambiar de bloque o descargar su PDF antes del apagado.",
        walkthroughBtn: "Abrir recorrido guiado (repaso solo lectura)",
        launchBtn: (b) => `Iniciar entorno (${b})`,
        startingBtn: "Iniciando entorno (~20–40 s)...",
        openSandboxBtn: (b) => `Abrir entorno (${b})`,
        resetBtn: "Reiniciar entorno",
        stopBtn: "Detener y purgar",
        copyLinuxBtn: "Copiar comando Linux",
        copyWindowsBtn: "Copiar comando Windows",
        bridgeNote: "Inicio opcional en 1 clic desde el navegador:",
        copiedMsg: "Comando copiado:",
    },
    fr: {
        title: "Parcours guidé (:443) et bac à sable de formation pratique (`oscar-sandbox` :8444)",
        badge: "Zéro impact en production",
        desc: "Ouvrez à tout moment le Parcours guidé en lecture seule sur cette console, ou lancez le bac à sable isolé :8444 pour pratiquer la configuration Admin, l’import CSV, les défauts, les radiographies UFF 16 bits, les spectres .n42 et l’adjudication — sans aucune écriture dans PostgreSQL réel, Parquet ou config.json.",
        safetyNote: "Isolation garantie : :8444 tourne sur des conteneurs jetables (`archive.enabled = false`) et est intégralement purgé (`down -v` en < 2 s) à l’arrêt ou à l’expiration du minuteur.",
        whatToKnowTitle: "Fonctionnement et extinction automatique :",
        shutdownStopped: (ttl) => `• Extinction automatique : ARRÊTÉ actuellement — une fois lancé, :8444 s’éteint et efface toutes les données d’exercice après ${ttl} minutes (≥ 3,5 Gio de RAM libre requis).`,
        shutdownRunning: (dur, at) => `• Compte à rebours actif : EN COURS — arrêt et purge automatiques dans ${dur}${at ? ` (à ${at})` : ""}. Téléchargez votre PDF de réussite avant l’arrêt.`,
        credentialsNote: "• Connexion, HTTPS et filigranes : Ouvre https://<hôte>:8444 sur LAN/VPN (ou https://<site>-sandbox.<hub> avec Let's Encrypt via tunnel distant) avec vos identifiants, SSO ou Passkey habituels. Chaque export porte TRAINING SANDBOX — NON-OPERATIONAL.",
        insideSandboxAlert: "Session active : vous êtes dans le bac à sable éphémère de formation. Cliquez sur « Coach Formation » en haut pour choisir un parcours ou exporter votre PDF avant l’extinction.",
        walkthroughBtn: "Ouvrir le parcours guidé (lecture seule)",
        launchBtn: (b) => `Lancer le bac à sable (${b})`,
        startingBtn: "Démarrage en cours (~20–40 s)...",
        openSandboxBtn: (b) => `Ouvrir le bac à sable (${b})`,
        resetBtn: "Réinitialiser",
        stopBtn: "Arrêter et purger",
        copyLinuxBtn: "Copier la commande Linux",
        copyWindowsBtn: "Copier la commande Windows",
        bridgeNote: "Lancement optionnel en 1 clic :",
        copiedMsg: "Commande copiée :",
    },
    el: {
        title: "Καθοδηγούμενη περιήγηση (:443) & πρακτικό περιβάλλον εκπαίδευσης (`oscar-sandbox` :8444)",
        badge: "Μηδενική επίδραση στην παραγωγή",
        desc: "Ανοίξτε ανά πάσα στιγμή την Καθοδηγούμενη περιήγηση μόνο για ανάγνωση σε αυτή την κονσόλα ή εκκινήστε το απομονωμένο περιβάλλον :8444 για πρακτική εξάσκηση σε λωρίδες, CSV, σφάλματα, ακτινογραφίες WCO UFF 16-bit, φάσματα .n42 και αξιολόγηση συναγερμών — χωρίς καμία εγγραφή στην PostgreSQL παραγωγής, στα Parquet ή στο config.json.",
        safetyNote: "Εγγύηση απομόνωσης: το :8444 εκτελείται σε αναλώσιμα κοντέινερ (`archive.enabled = false`) και διαγράφεται πλήρως (`down -v` σε < 2 δευτ.) στον τερματισμό ή στη λήξη του χρονομέτρου.",
        whatToKnowTitle: "Τι να γνωρίζετε & πότε τερματίζεται:",
        shutdownStopped: (ttl) => `• Αυτόματος τερματισμός: ΑΝΕΝΕΡΓΟ τώρα — μετά την εκκίνηση, το :8444 τερματίζεται αυτόματα και διαγράφει όλα τα δεδομένα εξάσκησης σε ${ttl} λεπτά (απαιτεί ≥ 3,5 GiB ελεύθερη RAM).`,
        shutdownRunning: (dur, at) => `• Αντίστροφη μέτρηση: ΕΝΕΡΓΟ — αυτόματος τερματισμός και εκκαθάριση σε ${dur}${at ? ` (στις ${at})` : ""}. Εξαγάγετε το PDF ολοκλήρωσης πριν από τη λήξη.`,
        credentialsNote: "• Σύνδεση, HTTPS & υδατογραφήματα: Ανοίγει το https://<host>:8444 σε LAN/VPN (ή https://<site>-sandbox.<hub> με Let's Encrypt σε απομακρυσμένη σύνδεση) με τα υπάρχοντα στοιχεία, SSO ή Passkey σας. Κάθε εξαγωγή φέρει TRAINING SANDBOX — NON-OPERATIONAL.",
        insideSandboxAlert: "Ενεργή συνεδρία: βρίσκεστε στο προσωρινό περιβάλλον εκπαίδευσης. Πατήστε «Οδηγός Εκπαίδευσης» στην επάνω γραμμή.",
        walkthroughBtn: "Άνοιγμα καθοδηγούμενης περιήγησης (μόνο ανάγνωση)",
        launchBtn: (b) => `Εκκίνηση περιβάλλοντος (${b})`,
        startingBtn: "Εκκίνηση περιβάλλοντος (~20–40 δευτ.)...",
        openSandboxBtn: (b) => `Άνοιγμα περιβάλλοντος (${b})`,
        resetBtn: "Επαναφορά",
        stopBtn: "Τερματισμός & εκκαθάριση",
        copyLinuxBtn: "Αντιγραφή εντολής Linux",
        copyWindowsBtn: "Αντιγραφή εντολής Windows",
        bridgeNote: "Προαιρετική εκκίνηση με 1 κλικ:",
        copiedMsg: "Αντιγράφηκε:",
    },
};

export default function TrainingSandboxLauncherCard({
    locale,
    onOpenGuidedWalkthrough,
}: {
    locale: Locale;
    onOpenGuidedWalkthrough?: () => void;
}) {
    const copy = LAUNCHER_COPY[locale] ?? LAUNCHER_COPY.en;
    const [insideSandbox, setInsideSandbox] = React.useState(false);
    const [hostStatus, setHostStatus] = React.useState<SandboxHostStatus | null>(null);
    const [busy, setBusy] = React.useState(false);
    const [pendingAction, setPendingAction] = React.useState<{
        action: "start" | "stop" | "reset";
        requestId?: string;
        deadlineMs: number;
    } | null>(null);
    const [notice, setNotice] = React.useState<{ severity: "success" | "info" | "error"; text: string } | null>(null);

    React.useEffect(() => {
        const controller = new AbortController();
        fetchSandboxActiveStatus(controller.signal)
            .then((active) => setInsideSandbox(Boolean(active.sandboxMode)))
            .catch(() => {});
        fetchSandboxHostStatus(controller.signal)
            .then((st) => {
                if (st) setHostStatus(st);
            })
            .catch(() => {});
        return () => controller.abort();
    }, []);

    const jobInFlight =
        hostStatus?.activeJob?.state === "QUEUED" || hostStatus?.activeJob?.state === "RUNNING";
    const hostStarting =
        (!hostStatus?.sandboxRunning && jobInFlight) ||
        pendingAction?.action === "start" ||
        pendingAction?.action === "reset";
    const shouldPollHost = !insideSandbox && (jobInFlight || pendingAction !== null);

    React.useEffect(() => {
        if (!shouldPollHost) return;
        const timer = setInterval(() => {
            fetchSandboxHostStatus()
                .then((st) => {
                    if (!st) return;
                    setHostStatus(st);
                    const jobState = st.activeJob?.state;
                    if (jobState === "FAILED") {
                        setPendingAction(null);
                        setNotice({
                            severity: "error",
                            text: st.activeJob?.message ?? "Training Sandbox operation failed.",
                        });
                        return;
                    }
                    if (pendingAction) {
                        const matchedDone =
                            jobState === "COMPLETED" &&
                            (!pendingAction.requestId || st.activeJob?.requestId === pendingAction.requestId);
                        const startReady =
                            pendingAction.action === "start" && st.sandboxRunning && jobState !== "RUNNING" && jobState !== "QUEUED";
                        const stopDone =
                            pendingAction.action === "stop" && !st.sandboxRunning && jobState !== "RUNNING" && jobState !== "QUEUED";
                        const resetDone =
                            pendingAction.action === "reset" && matchedDone && st.sandboxRunning;
                        if (matchedDone || startReady || stopDone || resetDone) {
                            setPendingAction(null);
                            setNotice({
                                severity: "success",
                                text:
                                    st.activeJob?.message ??
                                    (st.sandboxRunning
                                        ? `Training Sandbox ready on port ${st.httpsPort ?? 8444}.`
                                        : "Training Sandbox stopped and flushed."),
                            });
                            return;
                        }
                        if (Date.now() > pendingAction.deadlineMs) {
                            setPendingAction(null);
                        }
                    }
                })
                .catch(() => {});
        }, 2_500);
        return () => clearInterval(timer);
    }, [insideSandbox, shouldPollHost, pendingAction]);

    const linuxStart = hostStatus?.linuxStartCommand ?? "sudo bash oscar.sh sandbox start --port 8444";
    const winStart = hostStatus?.windowsStartCommand ?? ".\\oscar.bat sandbox start --port 8444";
    const sandboxPort = hostStatus?.httpsPort ?? 8444;
    const sandboxTtl = hostStatus?.ttlMinutes ?? 120;
    const canStopOrReset = hostStatus?.canStopOrReset !== false;

    const shutdownSummary = React.useMemo(
        () =>
            computeSandboxShutdownSummary({
                expiresAt: hostStatus?.expiresAt,
                ttlMinutes: sandboxTtl,
            }),
        [hostStatus?.expiresAt, sandboxTtl],
    );

    const launchTarget = React.useMemo(
        () =>
            resolveSandboxLaunchTarget(
                hostStatus,
                typeof window !== "undefined" ? window.location.hostname : undefined,
            ),
        [hostStatus],
    );
    const sandboxUrl = launchTarget.url;

    const handleCopyCmd = async (cmd: string) => {
        try {
            await navigator.clipboard.writeText(cmd);
            setNotice({ severity: "success", text: `${copy.copiedMsg} ${cmd}` });
        } catch {
            setNotice({ severity: "info", text: cmd });
        }
    };

    const handleHostAction = async (action: "start" | "stop" | "reset") => {
        setBusy(true);
        setNotice(null);
        try {
            const next = await submitSandboxHostAction(action, sandboxPort, hostStatus?.ttlMinutes ?? 120);
            setHostStatus(next);
            const jobState = next.activeJob?.state;
            const stillInProgress =
                jobState === "QUEUED" ||
                jobState === "RUNNING" ||
                (action === "start" && !next.sandboxRunning && jobState !== "FAILED") ||
                (action === "stop" && next.sandboxRunning && jobState !== "FAILED");
            if (stillInProgress) {
                setPendingAction({
                    action,
                    requestId: next.activeJob?.requestId,
                    deadlineMs: Date.now() + 120_000,
                });
                setNotice({
                    severity: "info",
                    text: next.activeJob?.message ?? `Executing sandbox '${action}'...`,
                });
            } else {
                setPendingAction(null);
                setNotice({
                    severity: jobState === "FAILED" ? "error" : "success",
                    text: next.activeJob?.message ?? `Completed '${action}' on host sandbox agent.`,
                });
            }
        } catch (err: any) {
            setPendingAction(null);
            setNotice({
                severity: "error",
                text: err?.message ?? "Host sandbox request failed.",
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <Paper
            variant="outlined"
            sx={{ p: 2, borderColor: "#f59e0b", bgcolor: "rgba(251, 191, 36, 0.04)" }}
            data-testid="help-training-sandbox-card"
        >
            <Stack spacing={1.25}>
                <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                    <SchoolRoundedIcon color="warning" fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={700}>
                        {copy.title}
                    </Typography>
                    <Chip size="small" color="warning" label={copy.badge} sx={{ fontWeight: 700, height: 22 }} />
                </Stack>

                <Typography variant="body2" color="text.secondary">
                    {copy.desc}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {copy.safetyNote}
                </Typography>

                {(busy || hostStarting) && <LinearProgress color="warning" />}

                {insideSandbox ? (
                    <Alert severity="success" data-testid="help-sandbox-active-alert">
                        {copy.insideSandboxAlert}
                    </Alert>
                ) : (
                    <>
                        <Box
                            sx={{
                                p: 1.25,
                                borderRadius: 1.5,
                                bgcolor: "rgba(255, 255, 255, 0.88)",
                                border: "1px solid rgba(245, 158, 11, 0.45)",
                            }}
                            data-testid="help-sandbox-what-to-know"
                        >
                            <Typography variant="caption" fontWeight={700} sx={{ display: "block", mb: 0.5 }}>
                                {copy.whatToKnowTitle}
                            </Typography>
                            <Typography
                                variant="caption"
                                sx={{
                                    display: "block",
                                    mb: 0.35,
                                    fontWeight: hostStatus?.sandboxRunning ? 700 : 500,
                                    color: hostStatus?.sandboxRunning ? "success.main" : "text.secondary",
                                }}
                                data-testid="help-sandbox-shutdown-info"
                            >
                                {hostStatus?.sandboxRunning
                                    ? copy.shutdownRunning(
                                          shutdownSummary.durationText,
                                          shutdownSummary.expiresTimeText,
                                      )
                                    : copy.shutdownStopped(sandboxTtl)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                {copy.credentialsNote}
                            </Typography>
                        </Box>

                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                            {onOpenGuidedWalkthrough && (
                                <Button
                                    size="small"
                                    variant="contained"
                                    color="primary"
                                    startIcon={<SchoolRoundedIcon fontSize="small" />}
                                    onClick={onOpenGuidedWalkthrough}
                                    data-testid="help-open-walkthrough-btn"
                                    sx={{ textTransform: "none" }}
                                >
                                    {copy.walkthroughBtn}
                                </Button>
                            )}
                            {hostStatus?.sandboxRunning ? (
                                <>
                                    <Button
                                        component="a"
                                        href={sandboxUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        size="small"
                                        variant="contained"
                                        color="success"
                                        endIcon={<OpenInNewRoundedIcon fontSize="small" />}
                                        data-testid="help-sandbox-open-btn"
                                        sx={{ textTransform: "none" }}
                                    >
                                        {copy.openSandboxBtn(launchTarget.badgeLabel)}
                                    </Button>
                                    {canStopOrReset && (
                                        <>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                disabled={busy}
                                                startIcon={<RestartAltRoundedIcon fontSize="small" />}
                                                onClick={() => handleHostAction("reset")}
                                                data-testid="help-sandbox-reset-btn"
                                                sx={{ textTransform: "none" }}
                                            >
                                                {copy.resetBtn}
                                            </Button>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                color="error"
                                                disabled={busy}
                                                startIcon={<StopCircleOutlinedIcon fontSize="small" />}
                                                onClick={() => handleHostAction("stop")}
                                                data-testid="help-sandbox-stop-btn"
                                                sx={{ textTransform: "none" }}
                                            >
                                                {copy.stopBtn}
                                            </Button>
                                        </>
                                    )}
                                </>
                            ) : (
                                hostStatus?.agentActive && (
                                    <Button
                                        size="small"
                                        variant="contained"
                                        color="warning"
                                        disabled={busy || hostStarting}
                                        startIcon={<PlayArrowRoundedIcon fontSize="small" />}
                                        onClick={() => handleHostAction("start")}
                                        data-testid="help-sandbox-launch-btn"
                                        sx={{ textTransform: "none" }}
                                    >
                                        {hostStarting ? copy.startingBtn : copy.launchBtn(launchTarget.badgeLabel)}
                                    </Button>
                                )
                            )}
                        </Stack>

                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<ContentCopyRoundedIcon fontSize="small" />}
                                onClick={() => handleCopyCmd(linuxStart)}
                                data-testid="help-sandbox-copy-linux-btn"
                                sx={{ textTransform: "none" }}
                            >
                                {copy.copyLinuxBtn}: <code>{linuxStart}</code>
                            </Button>
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<ContentCopyRoundedIcon fontSize="small" />}
                                onClick={() => handleCopyCmd(winStart)}
                                data-testid="help-sandbox-copy-windows-btn"
                                sx={{ textTransform: "none" }}
                            >
                                {copy.copyWindowsBtn}: <code>{winStart}</code>
                            </Button>
                        </Stack>

                        {hostStatus && !hostStatus.agentActive && (
                            <Typography variant="caption" color="text.secondary">
                                {copy.bridgeNote} <code>{hostStatus.linuxEnableBridgeCommand}</code> /{" "}
                                <code>{hostStatus.windowsEnableBridgeCommand}</code>
                            </Typography>
                        )}
                    </>
                )}

                {notice && (
                    <Alert severity={notice.severity} onClose={() => setNotice(null)}>
                        {notice.text}
                    </Alert>
                )}
            </Stack>
        </Paper>
    );
}
