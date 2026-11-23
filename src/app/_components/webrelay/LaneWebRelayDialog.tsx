"use client";

/*
 * Copyright (c) 2026. Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import {
    fetchLaneWebRelayStatus,
    LaneWebRelayStatusEntry,
    saveLaneWebRelayConfig,
    sendLaneWebRelayControl,
    testLaneWebRelayConnection,
    WebRelayCoilState,
    WebRelayControlCommand,
    WebRelayOperatingMode,
} from '@/lib/data/oscar/WebRelayApi';
import './LaneWebRelayDialog.css';

export interface LaneWebRelayDialogProps {
    open: boolean;
    initialLaneNameOrUid?: string;
    onClose: () => void;
    onUpdated?: (lanes: LaneWebRelayStatusEntry[]) => void;
}

interface FormDraft {
    enabled: boolean;
    mode: WebRelayOperatingMode;
    primaryHost: string;
    primaryPort: string;
    ancillaryEnabled: boolean;
    ancillaryHost: string;
    ancillaryPort: string;
    username: string;
    password: string;
    clearPassword: boolean;
    alarmPulseSeconds: string;
    suppressExtendedOccupancyGamma: boolean;
    soundOnNeutronAlarm: boolean;
    pollIntervalSeconds: string;
}

function buildDraftFromLane(lane: LaneWebRelayStatusEntry | undefined): FormDraft {
    return {
        enabled: Boolean(lane?.enabled),
        mode: lane?.mode ?? 'AUTO',
        primaryHost: lane?.primaryHost ?? '',
        primaryPort: String(lane?.primaryPort ?? 80),
        ancillaryEnabled: Boolean(lane?.ancillaryEnabled),
        ancillaryHost: lane?.ancillaryHost ?? '',
        ancillaryPort: String(lane?.ancillaryPort ?? 80),
        username: lane?.username ?? '',
        password: '',
        clearPassword: false,
        alarmPulseSeconds: String(lane?.alarmPulseSeconds ?? 5),
        suppressExtendedOccupancyGamma: lane?.suppressExtendedOccupancyGamma ?? true,
        soundOnNeutronAlarm: Boolean(lane?.soundOnNeutronAlarm),
        pollIntervalSeconds: String(lane?.pollIntervalSeconds ?? 10),
    };
}

export default function LaneWebRelayDialog({
    open,
    initialLaneNameOrUid,
    onClose,
    onUpdated,
}: LaneWebRelayDialogProps) {
    const { t } = useLanguage();
    const baseId = useId();
    const dialogRef = useRef<HTMLDialogElement | null>(null);

    const [lanes, setLanes] = useState<LaneWebRelayStatusEntry[]>([]);
    const [selectedLaneUid, setSelectedLaneUid] = useState<string>('');
    const [draft, setDraft] = useState<FormDraft>(() => buildDraftFromLane(undefined));
    const [showPassword, setShowPassword] = useState(false);
    const [busy, setBusy] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [hostValidationError, setHostValidationError] = useState(false);

    const selectedLane = useMemo(
        () => lanes.find((item) => item.laneUid === selectedLaneUid) ?? lanes[0],
        [lanes, selectedLaneUid]
    );

    const syncSelectedLane = useCallback(
        (nextLanes: LaneWebRelayStatusEntry[], preferredUidOrName?: string) => {
            setLanes(nextLanes);
            if (nextLanes.length === 0) {
                setSelectedLaneUid('');
                setDraft(buildDraftFromLane(undefined));
                return;
            }
            const needle = (preferredUidOrName ?? '').trim().toLowerCase();
            const matched = needle
                ? nextLanes.find(
                      (l) =>
                          l.laneUid.toLowerCase() === needle ||
                          l.laneName.toLowerCase() === needle
                  )
                : undefined;
            const chosen = matched ?? nextLanes[0];
            setSelectedLaneUid(chosen.laneUid);
            setDraft(buildDraftFromLane(chosen));
        },
        []
    );

    const loadStatus = useCallback(
        async (refreshHardware: boolean, preferredLane?: string) => {
            setBusy(true);
            setErrorMessage('');
            try {
                const res = await fetchLaneWebRelayStatus({
                    refresh: refreshHardware,
                    laneUid: preferredLane,
                });
                syncSelectedLane(res.lanes ?? [], preferredLane);
                onUpdated?.(res.lanes ?? []);
            } catch (err: any) {
                setErrorMessage(err?.message || 'Unable to load WebRelay status');
            } finally {
                setBusy(false);
            }
        },
        [onUpdated, syncSelectedLane]
    );

    // Sync native <dialog> modal lifecycle via showModal() / close()
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        const handleNativeClose = () => {
            dialog.returnValue = '';
            onClose();
        };
        dialog.addEventListener('close', handleNativeClose);
        return () => {
            dialog.removeEventListener('close', handleNativeClose);
        };
    }, [onClose]);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (open) {
            setStatusMessage('');
            setErrorMessage('');
            setHostValidationError(false);
            setShowPassword(false);
            if (!dialog.open) {
                dialog.showModal();
            }
            void loadStatus(true, initialLaneNameOrUid);
        } else if (dialog.open) {
            dialog.close();
        }
    }, [open, initialLaneNameOrUid, loadStatus]);

    const handleLaneSelectChange = (evt: React.ChangeEvent<HTMLSelectElement>) => {
        const nextUid = evt.target.value;
        setSelectedLaneUid(nextUid);
        const found = lanes.find((item) => item.laneUid === nextUid);
        setDraft(buildDraftFromLane(found));
        setStatusMessage('');
        setErrorMessage('');
        setHostValidationError(false);
    };

    const handleControlAction = async (command: WebRelayControlCommand) => {
        if (!selectedLane) return;
        setBusy(true);
        setErrorMessage('');
        setStatusMessage('');
        try {
            const res = await sendLaneWebRelayControl({
                laneUid: selectedLane.laneUid,
                command,
            });
            setLanes(res.lanes);
            onUpdated?.(res.lanes);
            if (res.lane?.lastActionSummary) {
                setStatusMessage(res.lane.lastActionSummary);
            }
        } catch (err: any) {
            setErrorMessage(err?.message || 'Control command failed');
        } finally {
            setBusy(false);
        }
    };

    const handleTestConnection = async (target: 'primary' | 'ancillary') => {
        const host = (target === 'primary' ? draft.primaryHost : draft.ancillaryHost).trim();
        const port = Number(target === 'primary' ? draft.primaryPort : draft.ancillaryPort) || 80;
        if (!host) {
            if (target === 'primary') {
                setHostValidationError(true);
            }
            setErrorMessage(t('webrelayHostRequiredError'));
            return;
        }
        setHostValidationError(false);
        setBusy(true);
        setErrorMessage('');
        setStatusMessage('');
        try {
            const res = await testLaneWebRelayConnection({
                laneUid: selectedLane?.laneUid,
                host,
                port,
                username: draft.username.trim(),
                password: draft.password,
            });
            setStatusMessage(
                t('webrelayTestSuccess', {
                    host: res.host,
                    port: res.port,
                    path: res.endpointPath,
                    ms: res.latencyMs,
                    r1: res.relay1,
                    r2: res.relay2,
                    r3: res.relay3,
                    r4: res.relay4,
                })
            );
        } catch (err: any) {
            setErrorMessage(err?.message || 'Connection test failed');
        } finally {
            setBusy(false);
        }
    };

    const handleSaveSubmit = async (evt: React.FormEvent<HTMLFormElement>) => {
        evt.preventDefault();
        if (!selectedLane) return;
        if (draft.enabled && !draft.primaryHost.trim()) {
            setHostValidationError(true);
            setErrorMessage(t('webrelayHostRequiredError'));
            return;
        }
        if (draft.enabled && draft.ancillaryEnabled && !draft.ancillaryHost.trim()) {
            setErrorMessage(t('webrelayHostRequiredError'));
            return;
        }
        setHostValidationError(false);
        setBusy(true);
        setErrorMessage('');
        setStatusMessage('');
        try {
            const res = await saveLaneWebRelayConfig({
                laneUid: selectedLane.laneUid,
                enabled: draft.enabled,
                mode: draft.mode,
                primaryHost: draft.primaryHost.trim(),
                primaryPort: Number(draft.primaryPort) || 80,
                ancillaryEnabled: draft.ancillaryEnabled,
                ancillaryHost: draft.ancillaryHost.trim(),
                ancillaryPort: Number(draft.ancillaryPort) || 80,
                username: draft.username.trim(),
                password: draft.password,
                clearPassword: draft.clearPassword,
                alarmPulseSeconds: Number(draft.alarmPulseSeconds) || 5,
                suppressExtendedOccupancyGamma: draft.suppressExtendedOccupancyGamma,
                soundOnNeutronAlarm: draft.soundOnNeutronAlarm,
                pollIntervalSeconds: Number(draft.pollIntervalSeconds) || 10,
            });
            setLanes(res.lanes);
            setDraft(buildDraftFromLane(res.lane));
            onUpdated?.(res.lanes);
            setStatusMessage(t('webrelaySavedSuccess', { lane: res.lane.laneName }));
        } catch (err: any) {
            setErrorMessage(err?.message || 'Unable to save WebRelay settings');
        } finally {
            setBusy(false);
        }
    };

    const renderUnitBox = (title: string, coil: WebRelayCoilState | undefined, testIdPrefix: string) => {
        const online = Boolean(coil?.online);
        return (
            <div className="lane-webrelay-unit-box" data-testid={testIdPrefix}>
                <div className="lane-webrelay-unit-header">
                    <span>{title}</span>
                    <span data-testid={`${testIdPrefix}-status`}>
                        {online
                            ? `${t('online')} (${coil?.latencyMs ?? 0} ms · ${coil?.endpointPath ?? ''})`
                            : `${t('offline')}${coil?.error ? ` — ${coil.error}` : ''}`}
                    </span>
                </div>
                <div className="lane-webrelay-coils-grid">
                    <div
                        className="lane-webrelay-coil-pill"
                        data-active={String(online && coil?.relay1 === 1)}
                        data-testid={`${testIdPrefix}-r1`}
                    >
                        <span>{t('webrelayRelay1Label')}</span>
                        <span>{coil?.relay1 === 1 ? t('webrelayStateArmed') : t('webrelayStatePassThrough')}</span>
                    </div>
                    <div
                        className="lane-webrelay-coil-pill"
                        data-active={String(online && coil?.relay2 === 1)}
                        data-testid={`${testIdPrefix}-r2`}
                    >
                        <span>{t('webrelayRelay2Label')}</span>
                        <span>{coil?.relay2 === 1 ? t('webrelayStateArmed') : t('webrelayStatePassThrough')}</span>
                    </div>
                    <div
                        className="lane-webrelay-coil-pill"
                        data-alarm={String(online && coil?.relay3 === 1)}
                        data-testid={`${testIdPrefix}-r3`}
                    >
                        <span>{t('webrelayRelay3Label')}</span>
                        <span>{coil?.relay3 === 1 ? t('webrelayStateActive') : t('webrelayStateIdle')}</span>
                    </div>
                    <div
                        className="lane-webrelay-coil-pill"
                        data-alarm={String(online && coil?.relay4 === 1)}
                        data-testid={`${testIdPrefix}-r4`}
                    >
                        <span>{t('webrelayRelay4Label')}</span>
                        <span>{coil?.relay4 === 1 ? t('webrelayStateActive') : t('webrelayStateIdle')}</span>
                    </div>
                </div>
            </div>
        );
    };

    const titleId = `${baseId}-title`;
    const laneSelectId = `${baseId}-lane-select`;
    const configHeadingId = `${baseId}-config-heading`;
    const enabledId = `${baseId}-enabled`;
    const modeAutoId = `${baseId}-mode-auto`;
    const modePassId = `${baseId}-mode-pass`;
    const modeMutedId = `${baseId}-mode-muted`;
    const primaryHostId = `${baseId}-primary-host`;
    const primaryHostHintId = `${baseId}-primary-host-hint`;
    const primaryPortId = `${baseId}-primary-port`;
    const usernameId = `${baseId}-username`;
    const passwordId = `${baseId}-password`;
    const passwordHintId = `${baseId}-password-hint`;
    const clearPassId = `${baseId}-clear-pass`;
    const pulseSecId = `${baseId}-pulse-sec`;
    const pulseSecHintId = `${baseId}-pulse-sec-hint`;
    const pollSecId = `${baseId}-poll-sec`;
    const pollSecHintId = `${baseId}-poll-sec-hint`;
    const suppress9998Id = `${baseId}-suppress-9998`;
    const soundNeutronId = `${baseId}-sound-neutron`;
    const ancEnabledId = `${baseId}-anc-enabled`;
    const ancHostId = `${baseId}-anc-host`;
    const ancPortId = `${baseId}-anc-port`;

    const isGammaLatched = Boolean(
        selectedLane?.manualLatchActive && selectedLane?.primaryState?.relay3 === 1
    );
    const isNeutronLatched = Boolean(
        selectedLane?.manualLatchActive && selectedLane?.primaryState?.relay4 === 1
    );

    return (
        <dialog
            ref={dialogRef}
            className="lane-webrelay-dialog"
            aria-labelledby={titleId}
            data-testid="lane-webrelay-dialog"
        >
            <div className="lane-webrelay-header">
                <div>
                    <h2 id={titleId} className="lane-webrelay-title">
                        {t('webrelayDialogTitle')}
                    </h2>
                    <p className="lane-webrelay-subtitle">{t('webrelayDialogSubtitle')}</p>
                </div>
                <button
                    type="button"
                    className="lane-webrelay-btn"
                    onClick={() => dialogRef.current?.close()}
                    data-testid="webrelay-btn-close"
                >
                    {t('close')}
                </button>
            </div>

            <div className="lane-webrelay-body">
                <div className="lane-webrelay-toolbar">
                    <div className="lane-webrelay-field" style={{ flex: '1 1 260px' }}>
                        <label htmlFor={laneSelectId}>{t('webrelaySelectLaneLabel')}</label>
                        <select
                            id={laneSelectId}
                            name="selectedLaneUid"
                            value={selectedLane?.laneUid ?? ''}
                            onChange={handleLaneSelectChange}
                            disabled={busy || lanes.length === 0}
                            autoFocus
                            data-testid="webrelay-lane-select"
                        >
                            {lanes.map((item) => (
                                <option key={item.laneUid} value={item.laneUid}>
                                    {`${item.laneName} — ${
                                        item.enabled
                                            ? `${item.mode} (${item.primaryOnline ? t('online') : t('offline')})`
                                            : t('disabled')
                                    }`}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        type="button"
                        className="lane-webrelay-btn"
                        disabled={busy || !selectedLane}
                        onClick={() => void loadStatus(true, selectedLane?.laneUid)}
                        data-testid="webrelay-btn-refresh"
                    >
                        {t('webrelayRefreshStatus')}
                    </button>
                </div>

                {statusMessage ? (
                    <div
                        role="status"
                        aria-live="polite"
                        className="lane-webrelay-status-banner"
                        data-testid="webrelay-status-banner"
                    >
                        {statusMessage}
                    </div>
                ) : null}

                {errorMessage ? (
                    <div
                        role="alert"
                        className="lane-webrelay-error-banner"
                        data-testid="webrelay-error-banner"
                    >
                        {errorMessage}
                    </div>
                ) : null}

                <section className="lane-webrelay-card" aria-labelledby={`${baseId}-live-heading`}>
                    <h3 id={`${baseId}-live-heading`} className="lane-webrelay-section-heading">
                        {t('webrelayLiveControlsHeading')}
                    </h3>

                    {!selectedLane?.enabled ? (
                        <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.82 }}>
                            {t('webrelayDisabledBanner')}
                        </p>
                    ) : (
                        <>
                            <div className="lane-webrelay-units-grid">
                                {renderUnitBox(
                                    t('webrelayPrimaryUnitTitle'),
                                    selectedLane.primaryState,
                                    'webrelay-primary-unit'
                                )}
                                {selectedLane.ancillaryEnabled
                                    ? renderUnitBox(
                                          t('webrelayAncillaryUnitTitle'),
                                          selectedLane.ancillaryState,
                                          'webrelay-ancillary-unit'
                                      )
                                    : null}
                            </div>

                            <div className="lane-webrelay-actions-row">
                                <button
                                    type="button"
                                    className="lane-webrelay-btn lane-webrelay-btn-gamma"
                                    disabled={busy}
                                    onClick={() => void handleControlAction('pulse-gamma')}
                                    data-testid="webrelay-btn-pulse-gamma"
                                >
                                    {t('webrelayPulseGammaBtn')}
                                </button>
                                <button
                                    type="button"
                                    className="lane-webrelay-btn lane-webrelay-btn-neutron"
                                    disabled={busy}
                                    onClick={() => void handleControlAction('pulse-neutron')}
                                    data-testid="webrelay-btn-pulse-neutron"
                                >
                                    {t('webrelayPulseNeutronBtn')}
                                </button>
                                <button
                                    type="button"
                                    className="lane-webrelay-btn"
                                    disabled={busy}
                                    onClick={() => void handleControlAction('pulse-all')}
                                    data-testid="webrelay-btn-pulse-all"
                                >
                                    {t('webrelayPulseAllBtn')}
                                </button>
                                <button
                                    type="button"
                                    className="lane-webrelay-btn"
                                    disabled={busy}
                                    aria-pressed={isGammaLatched}
                                    onClick={() =>
                                        void handleControlAction(
                                            isGammaLatched ? 'silence' : 'latch-gamma'
                                        )
                                    }
                                    data-testid="webrelay-btn-latch-gamma"
                                >
                                    {t('webrelayLatchGammaBtn')}
                                </button>
                                <button
                                    type="button"
                                    className="lane-webrelay-btn"
                                    disabled={busy}
                                    aria-pressed={isNeutronLatched}
                                    onClick={() =>
                                        void handleControlAction(
                                            isNeutronLatched ? 'silence' : 'latch-neutron'
                                        )
                                    }
                                    data-testid="webrelay-btn-latch-neutron"
                                >
                                    {t('webrelayLatchNeutronBtn')}
                                </button>
                                <button
                                    type="button"
                                    className="lane-webrelay-btn"
                                    disabled={busy}
                                    onClick={() => void handleControlAction('silence')}
                                    data-testid="webrelay-btn-silence"
                                >
                                    {t('webrelaySilenceArmBtn')}
                                </button>
                                <button
                                    type="button"
                                    className="lane-webrelay-btn"
                                    disabled={busy}
                                    onClick={() => void handleControlAction('pass-through')}
                                    data-testid="webrelay-btn-passthrough"
                                >
                                    {t('webrelayPassThroughBtn')}
                                </button>
                            </div>

                            <div style={{ fontSize: '0.78rem', opacity: 0.8 }}>
                                <div>
                                    {t('webrelayCountersSummary', {
                                        triggered: selectedLane.triggeredAlarmCount ?? 0,
                                        eml: selectedLane.suppressedEmlCount ?? 0,
                                        extOcc: selectedLane.suppressedExtendedOccupancyCount ?? 0,
                                    })}
                                </div>
                                {selectedLane.lastActionSummary ? (
                                    <div>
                                        {`${t('webrelayLastActionLabel')}: ${selectedLane.lastActionSummary}`}
                                    </div>
                                ) : null}
                            </div>
                        </>
                    )}
                </section>

                <form
                    className="lane-webrelay-card"
                    method="POST"
                    action="/sensorhub/oscar/webrelay/action"
                    aria-labelledby={configHeadingId}
                    onSubmit={handleSaveSubmit}
                    data-testid="webrelay-config-form"
                >
                    <h3 id={configHeadingId} className="lane-webrelay-section-heading">
                        {t('webrelayConfigHeading')}
                    </h3>

                    <div className="lane-webrelay-checkbox-row">
                        <input
                            type="checkbox"
                            id={enabledId}
                            name="enabled"
                            checked={draft.enabled}
                            onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
                            data-testid="webrelay-input-enabled"
                        />
                        <label htmlFor={enabledId} style={{ fontWeight: 700 }}>
                            {t('webrelayEnableLabel')}
                        </label>
                    </div>

                    <fieldset className="lane-webrelay-fieldset">
                        <legend>{t('webrelayModeLegend')}</legend>

                        <div className="lane-webrelay-radio-option">
                            <input
                                type="radio"
                                id={modeAutoId}
                                name="mode"
                                value="AUTO"
                                checked={draft.mode === 'AUTO'}
                                onChange={() => setDraft((d) => ({ ...d, mode: 'AUTO' }))}
                                data-testid="webrelay-mode-auto"
                            />
                            <label htmlFor={modeAutoId} style={{ fontWeight: 600 }}>
                                {t('webrelayModeAutoLabel')}
                            </label>
                            <span className="lane-webrelay-radio-desc">
                                {t('webrelayModeAutoDesc')}
                            </span>
                        </div>

                        <div className="lane-webrelay-radio-option">
                            <input
                                type="radio"
                                id={modePassId}
                                name="mode"
                                value="PASS_THROUGH"
                                checked={draft.mode === 'PASS_THROUGH'}
                                onChange={() => setDraft((d) => ({ ...d, mode: 'PASS_THROUGH' }))}
                                data-testid="webrelay-mode-passthrough"
                            />
                            <label htmlFor={modePassId} style={{ fontWeight: 600 }}>
                                {t('webrelayModePassThroughLabel')}
                            </label>
                            <span className="lane-webrelay-radio-desc">
                                {t('webrelayModePassThroughDesc')}
                            </span>
                        </div>

                        <div className="lane-webrelay-radio-option">
                            <input
                                type="radio"
                                id={modeMutedId}
                                name="mode"
                                value="MUTED"
                                checked={draft.mode === 'MUTED'}
                                onChange={() => setDraft((d) => ({ ...d, mode: 'MUTED' }))}
                                data-testid="webrelay-mode-muted"
                            />
                            <label htmlFor={modeMutedId} style={{ fontWeight: 600 }}>
                                {t('webrelayModeMutedLabel')}
                            </label>
                            <span className="lane-webrelay-radio-desc">
                                {t('webrelayModeMutedDesc')}
                            </span>
                        </div>
                    </fieldset>

                    <div className="lane-webrelay-form-grid">
                        <div className="lane-webrelay-field">
                            <label htmlFor={primaryHostId}>{t('webrelayPrimaryHostLabel')}</label>
                            <span id={primaryHostHintId} className="lane-webrelay-hint">
                                {t('webrelayPrimaryHostHint')}
                            </span>
                            <input
                                type="text"
                                id={primaryHostId}
                                name="primaryHost"
                                value={draft.primaryHost}
                                onChange={(e) => {
                                    setHostValidationError(false);
                                    setDraft((d) => ({ ...d, primaryHost: e.target.value }));
                                }}
                                autoCorrect="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                required={draft.enabled}
                                aria-invalid={hostValidationError || undefined}
                                aria-describedby={primaryHostHintId}
                                data-testid="webrelay-input-primary-host"
                            />
                        </div>

                        <div className="lane-webrelay-field">
                            <label htmlFor={primaryPortId}>{t('webrelayPrimaryPortLabel')}</label>
                            <input
                                type="number"
                                id={primaryPortId}
                                name="primaryPort"
                                min={1}
                                max={65535}
                                value={draft.primaryPort}
                                onChange={(e) =>
                                    setDraft((d) => ({
                                        ...d,
                                        primaryPort: e.target.value,
                                    }))
                                }
                                data-testid="webrelay-input-primary-port"
                            />
                            <div>
                                <button
                                    type="button"
                                    className="lane-webrelay-btn"
                                    disabled={busy}
                                    onClick={() => void handleTestConnection('primary')}
                                    data-testid="webrelay-btn-test-primary"
                                >
                                    {t('webrelayTestPrimaryBtn')}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="lane-webrelay-form-grid">
                        <div className="lane-webrelay-field">
                            <label htmlFor={usernameId}>{t('webrelayUsernameLabel')}</label>
                            <input
                                type="text"
                                id={usernameId}
                                name="username"
                                value={draft.username}
                                onChange={(e) =>
                                    setDraft((d) => ({ ...d, username: e.target.value }))
                                }
                                autoCorrect="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                autoComplete="off"
                                data-testid="webrelay-input-username"
                            />
                        </div>

                        <div className="lane-webrelay-field">
                            <label htmlFor={passwordId}>{t('webrelayPasswordLabel')}</label>
                            {selectedLane?.passwordConfigured ? (
                                <span id={passwordHintId} className="lane-webrelay-hint">
                                    {t('webrelayPasswordSavedHint')}
                                </span>
                            ) : null}
                            <div style={{ display: 'flex', gap: '0.45rem' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id={passwordId}
                                    name="password"
                                    style={{ flex: 1 }}
                                    value={draft.password}
                                    onChange={(e) =>
                                        setDraft((d) => ({
                                            ...d,
                                            password: e.target.value,
                                            clearPassword: false,
                                        }))
                                    }
                                    autoComplete="new-password"
                                    aria-describedby={
                                        selectedLane?.passwordConfigured ? passwordHintId : undefined
                                    }
                                    data-testid="webrelay-input-password"
                                />
                                <button
                                    type="button"
                                    className="lane-webrelay-btn"
                                    aria-pressed={showPassword}
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    data-testid="webrelay-btn-toggle-password"
                                >
                                    {t('webrelayShowPasswordBtn')}
                                </button>
                            </div>
                            {selectedLane?.passwordConfigured ? (
                                <div className="lane-webrelay-checkbox-row" style={{ marginBlockStart: '0.25rem' }}>
                                    <input
                                        type="checkbox"
                                        id={clearPassId}
                                        name="clearPassword"
                                        checked={draft.clearPassword}
                                        onChange={(e) =>
                                            setDraft((d) => ({
                                                ...d,
                                                clearPassword: e.target.checked,
                                            }))
                                        }
                                    />
                                    <label htmlFor={clearPassId}>
                                        {t('webrelayClearPasswordLabel')}
                                    </label>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <fieldset className="lane-webrelay-fieldset">
                        <legend>{t('webrelayTimingLegend')}</legend>

                        <div className="lane-webrelay-form-grid">
                            <div className="lane-webrelay-field">
                                <label htmlFor={pulseSecId}>{t('webrelayPulseSecondsLabel')}</label>
                                <span id={pulseSecHintId} className="lane-webrelay-hint">
                                    {t('webrelayPulseSecondsHint')}
                                </span>
                                <input
                                    type="number"
                                    id={pulseSecId}
                                    name="alarmPulseSeconds"
                                    min={1}
                                    max={300}
                                    value={draft.alarmPulseSeconds}
                                    aria-describedby={pulseSecHintId}
                                    onChange={(e) =>
                                        setDraft((d) => ({
                                            ...d,
                                            alarmPulseSeconds: e.target.value,
                                        }))
                                    }
                                    data-testid="webrelay-input-pulse-seconds"
                                />
                            </div>

                            <div className="lane-webrelay-field">
                                <label htmlFor={pollSecId}>{t('webrelayPollSecondsLabel')}</label>
                                <span id={pollSecHintId} className="lane-webrelay-hint">
                                    {t('webrelayPollSecondsHint')}
                                </span>
                                <input
                                    type="number"
                                    id={pollSecId}
                                    name="pollIntervalSeconds"
                                    min={2}
                                    max={300}
                                    value={draft.pollIntervalSeconds}
                                    aria-describedby={pollSecHintId}
                                    onChange={(e) =>
                                        setDraft((d) => ({
                                            ...d,
                                            pollIntervalSeconds: e.target.value,
                                        }))
                                    }
                                    data-testid="webrelay-input-poll-seconds"
                                />
                            </div>
                        </div>

                        <div className="lane-webrelay-checkbox-row">
                            <input
                                type="checkbox"
                                id={suppress9998Id}
                                name="suppressExtendedOccupancyGamma"
                                checked={draft.suppressExtendedOccupancyGamma}
                                onChange={(e) =>
                                    setDraft((d) => ({
                                        ...d,
                                        suppressExtendedOccupancyGamma: e.target.checked,
                                    }))
                                }
                                data-testid="webrelay-input-suppress-9998"
                            />
                            <label htmlFor={suppress9998Id}>{t('webrelaySuppress9998Label')}</label>
                        </div>

                        <div className="lane-webrelay-checkbox-row">
                            <input
                                type="checkbox"
                                id={soundNeutronId}
                                name="soundOnNeutronAlarm"
                                checked={draft.soundOnNeutronAlarm}
                                onChange={(e) =>
                                    setDraft((d) => ({
                                        ...d,
                                        soundOnNeutronAlarm: e.target.checked,
                                    }))
                                }
                                data-testid="webrelay-input-sound-neutron"
                            />
                            <label htmlFor={soundNeutronId}>{t('webrelaySoundOnNeutronLabel')}</label>
                        </div>
                    </fieldset>

                    <div className="lane-webrelay-checkbox-row">
                        <input
                            type="checkbox"
                            id={ancEnabledId}
                            name="ancillaryEnabled"
                            checked={draft.ancillaryEnabled}
                            onChange={(e) =>
                                setDraft((d) => ({ ...d, ancillaryEnabled: e.target.checked }))
                            }
                            data-testid="webrelay-input-ancillary-enabled"
                        />
                        <label htmlFor={ancEnabledId} style={{ fontWeight: 600 }}>
                            {t('webrelayAncillaryEnableLabel')}
                        </label>
                    </div>

                    {draft.ancillaryEnabled ? (
                        <div className="lane-webrelay-form-grid">
                            <div className="lane-webrelay-field">
                                <label htmlFor={ancHostId}>{t('webrelayAncillaryHostLabel')}</label>
                                <input
                                    type="text"
                                    id={ancHostId}
                                    name="ancillaryHost"
                                    value={draft.ancillaryHost}
                                    onChange={(e) =>
                                        setDraft((d) => ({ ...d, ancillaryHost: e.target.value }))
                                    }
                                    autoCorrect="off"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    required={draft.enabled && draft.ancillaryEnabled}
                                    data-testid="webrelay-input-ancillary-host"
                                />
                            </div>

                            <div className="lane-webrelay-field">
                                <label htmlFor={ancPortId}>{t('webrelayAncillaryPortLabel')}</label>
                                <input
                                    type="number"
                                    id={ancPortId}
                                    name="ancillaryPort"
                                    min={1}
                                    max={65535}
                                    value={draft.ancillaryPort}
                                    onChange={(e) =>
                                        setDraft((d) => ({
                                            ...d,
                                            ancillaryPort: e.target.value,
                                        }))
                                    }
                                    data-testid="webrelay-input-ancillary-port"
                                />
                                <div>
                                    <button
                                        type="button"
                                        className="lane-webrelay-btn"
                                        disabled={busy}
                                        onClick={() => void handleTestConnection('ancillary')}
                                        data-testid="webrelay-btn-test-ancillary"
                                    >
                                        {t('webrelayTestAncillaryBtn')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <div className="lane-webrelay-actions-row" style={{ justifyContent: 'flex-end' }}>
                        <button
                            type="submit"
                            className="lane-webrelay-btn lane-webrelay-btn-primary"
                            disabled={busy || !selectedLane}
                            data-testid="webrelay-btn-save"
                        >
                            {t('webrelaySaveBtn')}
                        </button>
                    </div>
                </form>
            </div>
        </dialog>
    );
}
