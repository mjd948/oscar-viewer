import {
    selectDashboardAcknowledgeNonce,
    selectDashboardUnreadAlarmCount,
    selectTriggeredAlarm,
    setAlarmTrigger,
} from "@/lib/state/EventDataSlice";
import { RootState } from "@/lib/state/Store";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Box from "@mui/material/Box";
import { Alert } from "@mui/material";
import {
    selectAlarmAudioVolume,
    selectContinuousAlarmAudio,
} from "@/lib/state/OSCARClientSlice";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { attemptMediaPlayback } from "@/lib/media/MediaPlayback";

const PORTAL_ALARM_BRIDGE_MS = 8_000;

let alarmAudio: HTMLAudioElement | null = null;
let gestureUnlockInFlight = false;

export function clampAlarmVolume(volumePercent: number): number {
    if (!Number.isFinite(volumePercent)) {
        return 0;
    }
    return Math.max(0, Math.min(1, volumePercent / 100));
}

export function applyAlarmAudioVolume(volumePercent: number): void {
    if (!alarmAudio) {
        return;
    }
    const normalized = clampAlarmVolume(volumePercent);
    alarmAudio.volume = normalized;
    if (!gestureUnlockInFlight) {
        alarmAudio.muted = normalized <= 0;
        if (normalized <= 0) {
            alarmAudio.loop = false;
            if (!alarmAudio.paused) {
                alarmAudio.pause();
            }
            alarmAudio.currentTime = 0;
        }
    }
}

export function getAlarmAudio() {
    if (!alarmAudio) {
        alarmAudio = new Audio("/alarm_sound.wav");
        alarmAudio.preload = "auto";
    }
    return alarmAudio;
}

export function resetAlarmAudioForTest() {
    gestureUnlockInFlight = false;
    if (alarmAudio) {
        alarmAudio.loop = false;
        alarmAudio.pause();
        alarmAudio.currentTime = 0;
    }
    alarmAudio = null;
}

export default function AlarmAudio() {
    const { t } = useLanguage();
    const dispatch = useDispatch();
    const savedVolume = useSelector(selectAlarmAudioVolume);
    const continuousAlarmAudio = useSelector(selectContinuousAlarmAudio);
    const triggerAlarm = useSelector((state: RootState) => selectTriggeredAlarm(state));
    const unreadCount = useSelector((state: RootState) => selectDashboardUnreadAlarmCount(state));
    const acknowledgeNonce = useSelector((state: RootState) => selectDashboardAcknowledgeNonce(state));

    const [soundLocked, setSoundLocked] = useState(true);
    const [portalLatchActive, setPortalLatchActive] = useState(false);
    const portalBridgeTimerRef = useRef<number | null>(null);
    const prevUnreadCountRef = useRef<number>(unreadCount);
    const prevAckNonceRef = useRef<number>(acknowledgeNonce);
    const wasLoopingRef = useRef<boolean>(false);
    const savedVolumeRef = useRef<number>(savedVolume);
    savedVolumeRef.current = savedVolume;

    const clearPortalBridge = () => {
        if (portalBridgeTimerRef.current !== null) {
            window.clearTimeout(portalBridgeTimerRef.current);
            portalBridgeTimerRef.current = null;
        }
        setPortalLatchActive(false);
    };

    useEffect(() => () => {
        if (portalBridgeTimerRef.current !== null) {
            window.clearTimeout(portalBridgeTimerRef.current);
            portalBridgeTimerRef.current = null;
        }
        if (alarmAudio && wasLoopingRef.current) {
            alarmAudio.loop = false;
            alarmAudio.pause();
            alarmAudio.currentTime = 0;
            wasLoopingRef.current = false;
        }
    }, []);

    // Apply volume and mute changes immediately mid-playback (including non-looping one-shot alarms).
    useEffect(() => {
        applyAlarmAudioVolume(savedVolume);
    }, [savedVolume]);

    useEffect(() => {
        if (!soundLocked) {
            return;
        }

        let unlockInFlight = false;

        const unlockAudio = async () => {
            if (unlockInFlight) {
                return;
            }

            unlockInFlight = true;
            gestureUnlockInFlight = true;
            const audio = getAlarmAudio();
            audio.muted = true;
            audio.volume = clampAlarmVolume(savedVolumeRef.current);

            try {
                const result = await attemptMediaPlayback(audio);
                if (result.status === "started") {
                    audio.pause();
                    audio.currentTime = 0;
                    setSoundLocked(false);
                    document.removeEventListener("click", unlockAudio);
                } else if (result.status === "failed") {
                    console.error("Unable to initialize alarm audio", result.error);
                }
            } finally {
                gestureUnlockInFlight = false;
                applyAlarmAudioVolume(savedVolumeRef.current);
                unlockInFlight = false;
            }
        };

        document.addEventListener("click", unlockAudio);
        return () => document.removeEventListener("click", unlockAudio);
    }, [soundLocked]);

    // Clear transient portal-entry bridge as soon as the occupancy arrives as an unread row,
    // transitions back to 0 unread rows, or an operator clicks Acknowledge All.
    useEffect(() => {
        const unreadCleared = prevUnreadCountRef.current > 0 && unreadCount === 0;
        const ackRequested = acknowledgeNonce !== prevAckNonceRef.current;
        prevUnreadCountRef.current = unreadCount;
        prevAckNonceRef.current = acknowledgeNonce;

        if (unreadCount > 0 || unreadCleared || ackRequested || !continuousAlarmAudio) {
            clearPortalBridge();
        }
    }, [unreadCount, acknowledgeNonce, continuousAlarmAudio]);

    // Handle live alarm trigger pulses (one-shot when continuous mode is off; portal bridge when on).
    useEffect(() => {
        if (!triggerAlarm) {
            return;
        }

        if (continuousAlarmAudio) {
            setPortalLatchActive(true);
            if (portalBridgeTimerRef.current !== null) {
                window.clearTimeout(portalBridgeTimerRef.current);
            }
            portalBridgeTimerRef.current = window.setTimeout(() => {
                portalBridgeTimerRef.current = null;
                setPortalLatchActive(false);
            }, PORTAL_ALARM_BRIDGE_MS);
            dispatch(setAlarmTrigger(false));
            return;
        }

        if (soundLocked || savedVolume <= 0) {
            dispatch(setAlarmTrigger(false));
            return;
        }

        const audio = getAlarmAudio();
        audio.loop = false;
        applyAlarmAudioVolume(savedVolume);

        void attemptMediaPlayback(audio).then(result => {
            if (result.status === "blocked") {
                setSoundLocked(true);
            } else if (result.status === "failed") {
                console.error("Unable to play alarm audio", result.error);
            }
        }).finally(() => dispatch(setAlarmTrigger(false)));
    }, [triggerAlarm, continuousAlarmAudio, savedVolume, soundLocked, dispatch]);

    // Maintain latching loop playback while continuousAlarmAudio is enabled and unread alarms exist.
    useEffect(() => {
        const shouldLoop = continuousAlarmAudio
            && !soundLocked
            && savedVolume > 0
            && (unreadCount > 0 || portalLatchActive);

        if (shouldLoop) {
            const audio = getAlarmAudio();
            applyAlarmAudioVolume(savedVolume);
            audio.loop = true;
            wasLoopingRef.current = true;
            if (audio.paused) {
                void attemptMediaPlayback(audio).then(result => {
                    if (result.status === "blocked") {
                        setSoundLocked(true);
                    } else if (result.status === "failed") {
                        console.error("Unable to loop alarm audio", result.error);
                    }
                });
            }
            return;
        }

        if (wasLoopingRef.current && alarmAudio) {
            alarmAudio.loop = false;
            if (!alarmAudio.paused) {
                alarmAudio.pause();
            }
            alarmAudio.currentTime = 0;
            wasLoopingRef.current = false;
        }
    }, [continuousAlarmAudio, soundLocked, savedVolume, unreadCount, portalLatchActive]);

    return (
        <Box sx={{ width: 200, padding: 1 }}>
            {soundLocked && (
                <Alert severity="info" sx={{ mb: 2, fontSize: "0.8rem" }}>
                    {t('enableAlarmSound')}
                </Alert>
            )}
        </Box>
    );
}
