"use client";

import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    IconButton,
    Stack,
    Tooltip,
    Typography,
} from "@mui/material";
import {VisibilityOffOutlined} from "@mui/icons-material";
import React, {useContext, useEffect, useMemo, useState} from "react";
import {useRouter} from "next/navigation";
import {EventType} from "osh-js/source/core/event/EventType";
import ControlStream from "osh-js/source/core/consysapi/controlstream/ControlStream";

import LaneStatusItem from "./LaneStatusItem";
import {DataSourceContext} from "@/app/contexts/DataSourceContext";
import {useLanguage} from "@/app/contexts/LanguageContext";
import {generateManualTamperCommandJSON, sendCommand} from "@/lib/data/oscar/OSCARCommands";
import {
    acquireSharedConnection,
    LaneDSColl,
    type SharedConnectionLease,
} from "@/lib/data/oscar/LaneCollection";
import {removeRealtimeEventSubscription} from "@/lib/data/oscar/RealtimeEventNotification";
import {isTamperControlStream} from "@/lib/data/oscar/Utilities";
import {deriveLaneHealthRows, useLaneHealth, useLaneHealthClock} from "@/lib/data/oscar/useLaneHealth";
import {setAlarmTrigger} from "@/lib/state/EventDataSlice";
import {useAppDispatch} from "@/lib/state/Hooks";
import {setCurrentLane} from "@/lib/state/LaneViewSlice";

export default function LaneStatus({
    dataSourcesByLane,
    onHide,
    expanded = false,
    subscribeAlarmStream = true,
    laneNames,
    hideTitle = false,
}: {
    dataSourcesByLane?: Map<string, LaneDSColl>;
    onHide?: () => void;
    expanded?: boolean;
    subscribeAlarmStream?: boolean;
    /** Custom-page widgets: show only these lanes (undefined = all). */
    laneNames?: string[];
    /** Custom-page widgets: the widget frame already shows a title. */
    hideTitle?: boolean;
}) {
    const [tamperLaneToClear, setTamperLaneToClear] = useState<string | null>(null);
    const [isClearingTamper, setIsClearingTamper] = useState(false);
    const [clearTamperError, setClearTamperError] = useState<string | null>(null);
    const {lanes, isLoading, thresholdMinutes, refreshLaneHealth} = useLaneHealth();
    const healthClock = useLaneHealthClock(lanes, thresholdMinutes);

    const dispatch = useAppDispatch();
    const router = useRouter();
    const {t} = useLanguage();
    const {laneMapRef, scopedHref} = useContext(DataSourceContext);

    const laneRows = useMemo(() => {
        const rows = deriveLaneHealthRows(lanes, healthClock, thresholdMinutes);
        if (!laneNames) return rows;
        const keep = new Set(laneNames);
        return rows.filter((row) => keep.has(row.laneName));
    }, [healthClock, laneNames, lanes, thresholdMinutes]);

    // The batched health snapshot supplies all visual state. Keep only the
    // gamma/neutron realtime listeners required for the existing alarm sound.
    useEffect(() => {
        if (!subscribeAlarmStream || !dataSourcesByLane) return;

        let active = true;
        const subscriptions: Array<{
            source: any;
            handler: (message: any) => void;
            lease: SharedConnectionLease;
        }> = [];
        const uniqueSources = new Set<any>();

        dataSourcesByLane.forEach((collection) => {
            [...collection.gammaRT, ...collection.neutronRT].forEach((source) => {
                if (!source || uniqueSources.has(source))
                    return;
                uniqueSources.add(source);
                const handler = (message: any) => {
                    if (active && message?.values?.[0]?.data?.alarmState === "Alarm")
                        dispatch(setAlarmTrigger(true));
                };
                source.subscribe(handler, [EventType.DATA]);
                const lease = acquireSharedConnection(source);
                subscriptions.push({source, handler, lease});
                void lease.ready.catch((error) => {
                    if (active)
                        console.warn("Unable to connect dashboard alarm notification stream", error);
                });
            });
        });

        return () => {
            active = false;
            subscriptions.forEach(({source, handler, lease}) => {
                removeRealtimeEventSubscription(source, handler);
                void lease.release().catch((error) => {
                    console.warn("Unable to disconnect dashboard alarm notification stream", error);
                });
            });
        };
    }, [dataSourcesByLane, dispatch, subscribeAlarmStream]);

    const handleLaneView = (laneName: string) => {
        dispatch(setCurrentLane(laneName));
        router.push(scopedHref("/lane-view"));
    };

    const handleOpenClearTamper = (event: React.MouseEvent<HTMLButtonElement>, laneName: string) => {
        event.stopPropagation();
        setClearTamperError(null);
        setTamperLaneToClear(laneName);
    };

    const handleCloseClearTamper = () => {
        if (isClearingTamper)
            return;
        setTamperLaneToClear(null);
        setClearTamperError(null);
    };

    const handleConfirmClearTamper = async () => {
        if (!tamperLaneToClear)
            return;

        setIsClearingTamper(true);
        setClearTamperError(null);

        try {
            const laneEntry = laneMapRef.current.get(tamperLaneToClear);
            if (!laneEntry)
                throw new Error(t("unableToFindLane", {lane: tamperLaneToClear}));

            let tamperControl = laneEntry.controlStreams.find(
                (stream: typeof ControlStream) => isTamperControlStream(stream));

            if (!tamperControl) {
                const laneSystemIds = new Set(laneEntry.systems.map(
                    (system: any) => system.properties.id));
                const nodeControlStreams = await laneEntry.parentNode.fetchNodeControlStreams() ?? [];
                tamperControl = nodeControlStreams.find((stream: typeof ControlStream) =>
                    laneSystemIds.has(stream.properties["system@id"]) && isTamperControlStream(stream));
            }

            if (!tamperControl)
                throw new Error(t("noManualTamperControl", {lane: tamperLaneToClear}));

            const response = await sendCommand(
                laneEntry.parentNode,
                tamperControl.properties.id,
                generateManualTamperCommandJSON(false),
            );

            if (!response.ok)
                throw new Error(t("clearTamperCommandFailed", {status: response.status}));

            setTamperLaneToClear(null);
            void refreshLaneHealth();
        } catch (error) {
            console.error("Failed to clear tamper", error);
            setClearTamperError(error instanceof Error ? error.message : t("failedToClearTamper"));
        } finally {
            setIsClearingTamper(false);
        }
    };

    return (
        <Stack justifyContent="start" spacing={1} sx={{p: 1}}>
            {!hideTitle && <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">{t("laneStatus")}</Typography>
                {onHide && (
                    <Tooltip title={t("hideWidget")}>
                        <IconButton
                            size="small"
                            onClick={onHide}
                            aria-label={`${t("hideWidget")}: ${t("laneStatus")}`}
                            data-testid="hide-lane-status-widget"
                        >
                            <VisibilityOffOutlined fontSize="small" />
                        </IconButton>
                    </Tooltip>
                )}
            </Stack>}
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                    gap: 1,
                    overflowY: "auto",
                    maxHeight: hideTitle ? "none" : expanded ? "calc(100vh - 220px)" : 275,
                    flexGrow: 1,
                }}
            >
                {isLoading && laneRows.length === 0 ? (
                    <Typography color="text.secondary">{t("loading")}</Typography>
                ) : laneRows.map((lane) => (
                    <LaneStatusItem
                        key={lane.laneName}
                        health={lane}
                        onSelect={() => handleLaneView(lane.laneName)}
                        onClearTamper={(event) => handleOpenClearTamper(event, lane.laneName)}
                    />
                ))}
            </Box>
            <Dialog
                open={tamperLaneToClear !== null}
                onClose={handleCloseClearTamper}
                aria-labelledby="clear-tamper-dialog-title"
            >
                <DialogTitle id="clear-tamper-dialog-title">{t("clearTamperQuestion")}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {t("confirmClearTamper", {lane: tamperLaneToClear ?? ""})}
                    </DialogContentText>
                    {clearTamperError && <Alert severity="error" sx={{mt: 2}}>{clearTamperError}</Alert>}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseClearTamper} disabled={isClearingTamper}>{t("cancel")}</Button>
                    <Button
                        onClick={handleConfirmClearTamper}
                        disabled={isClearingTamper}
                        color="error"
                        variant="contained"
                    >
                        {isClearingTamper ? t("clearing") : t("clearTamper")}
                    </Button>
                </DialogActions>
            </Dialog>
        </Stack>
    );
}
