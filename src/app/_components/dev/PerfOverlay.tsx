"use client";

/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import React, {useEffect, useState} from "react";
import {
    broadcastChannelStats,
    heapMb,
    initPerfProbes,
    isPerfEnabled,
    longTaskStats,
    snapshotRenderCounts,
} from "./perfProbe";

// Armed at import time (Navbar is in the root layout) so the BroadcastChannel
// probe is in place before the map and the osh-js datasources open any.
initPerfProbes();

const SAMPLE_MS = 1000;
const LONG_TASK_WINDOW_MS = 10_000;

interface Sample {
    rendersPerSec: [string, number][];
    tasks: ReturnType<typeof longTaskStats>;
    channels: ReturnType<typeof broadcastChannelStats>;
    heap: number | null;
    uptimeSec: number;
}

/**
 * Live diagnostics panel, rendered only when the page URL carries `?perf=1`.
 *
 * Reports the three things that distinguish the viewer's failure modes:
 * per-component renders/sec (re-render storms), long-task time (main-thread
 * blocking, e.g. video transmuxing), and live BroadcastChannel count (the
 * Leaflet layer leak — a healthy page holds this flat, a leaking one climbs).
 */
export default function PerfOverlay() {
    const enabled = isPerfEnabled();
    const [sample, setSample] = useState<Sample | null>(null);

    useEffect(() => {
        if (!enabled) return;
        const startedAt = Date.now();
        let previous = snapshotRenderCounts();
        let previousAt = Date.now();

        const id = setInterval(() => {
            const now = Date.now();
            const current = snapshotRenderCounts();
            const elapsedSec = Math.max(0.001, (now - previousAt) / 1000);

            const rendersPerSec: [string, number][] = [];
            for (const [name, count] of current) {
                const delta = count - (previous.get(name) ?? 0);
                rendersPerSec.push([name, delta / elapsedSec]);
            }
            rendersPerSec.sort((a, b) => b[1] - a[1]);

            previous = current;
            previousAt = now;

            setSample({
                rendersPerSec,
                tasks: longTaskStats(LONG_TASK_WINDOW_MS),
                channels: broadcastChannelStats(),
                heap: heapMb(),
                uptimeSec: Math.round((now - startedAt) / 1000),
            });
        }, SAMPLE_MS);

        return () => clearInterval(id);
    }, [enabled]);

    if (!enabled || !sample) return null;

    const {rendersPerSec, tasks, channels, heap, uptimeSec} = sample;

    return (
        <div
            data-testid="perf-overlay"
            style={{
                position: 'fixed',
                right: 8,
                bottom: 8,
                zIndex: 4000,
                minWidth: 250,
                padding: '8px 10px',
                borderRadius: 6,
                background: 'rgba(0,0,0,0.82)',
                color: '#e0e0e0',
                font: '11px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace',
                pointerEvents: 'none',
                whiteSpace: 'pre',
            }}
        >
            <div style={{color: '#90caf9', fontWeight: 700}}>PERF · {formatUptime(uptimeSec)}</div>
            <Row
                label="long tasks/10s"
                value={tasks.supported
                    ? `${tasks.count} · ${Math.round(tasks.blockedMs)}ms blocked · worst ${Math.round(tasks.worstMs)}ms`
                    : 'unsupported'}
                warn={tasks.blockedMs > 500}
            />
            <Row
                label="broadcast chans"
                value={`${channels.live} live (${channels.opened} opened)`}
                warn={channels.live > 200}
            />
            {heap !== null && <Row label="js heap" value={`${heap.toFixed(1)} MB`} warn={heap > 700}/>}
            <div style={{color: '#90caf9', marginTop: 4}}>renders/sec</div>
            {rendersPerSec.length === 0 && <div style={{color: '#757575'}}>  (none instrumented)</div>}
            {rendersPerSec.map(([name, rate]) => (
                <Row key={name} label={`  ${name}`} value={rate.toFixed(1)} warn={rate >= 5}/>
            ))}
        </div>
    );
}

function Row({label, value, warn}: { label: string, value: string, warn?: boolean }) {
    return (
        <div style={{display: 'flex', justifyContent: 'space-between', gap: 12}}>
            <span style={{color: '#9e9e9e'}}>{label}</span>
            <span style={{color: warn ? '#ef5350' : '#e0e0e0'}}>{value}</span>
        </div>
    );
}

function formatUptime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m${String(s).padStart(2, '0')}s` : `${s}s`;
}
