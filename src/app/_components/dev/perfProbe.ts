"use client";

/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

/**
 * Opt-in runtime diagnostics for the viewer, enabled with `?perf=1`.
 *
 * Everything here is inert unless that flag is present: no observers are
 * constructed, no counters are incremented, and `BroadcastChannel` is left
 * alone. The flag is read once and cached, so the disabled path costs one
 * boolean check per call.
 *
 * Exists because the dashboard's slow paths are invisible in the UI — a widget
 * re-rendering 20x/second and a Leaflet layer leak both look exactly like
 * "it feels sluggish". These are the three numbers that tell them apart:
 * renders/sec per component, long-task time, and live BroadcastChannel count.
 */

let cachedEnabled: boolean | null = null;

export function isPerfEnabled(): boolean {
    if (cachedEnabled === null) {
        try {
            cachedEnabled = typeof window !== 'undefined'
                && new URLSearchParams(window.location.search).get('perf') === '1';
        } catch {
            cachedEnabled = false;
        }
    }
    return cachedEnabled;
}

// ---- render counters ----

const renderCounts = new Map<string, number>();

/**
 * Count one render of `name`. Deliberately NOT a hook — it calls none, so the
 * disabled early-return is safe to place anywhere in a component body.
 */
export function countRender(name: string) {
    if (!isPerfEnabled()) return;
    renderCounts.set(name, (renderCounts.get(name) ?? 0) + 1);
}

export function snapshotRenderCounts(): Map<string, number> {
    return new Map(renderCounts);
}

// ---- BroadcastChannel census ----
//
// osh-js `View.addLayer` opens two channels per datasource per layer and never
// closes them, so a leaking map shows up here as a live count that only climbs.

let bcOpened = 0;
let bcClosed = 0;

export function broadcastChannelStats() {
    return {opened: bcOpened, closed: bcClosed, live: bcOpened - bcClosed};
}

function installBroadcastChannelProbe() {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    const Native = BroadcastChannel;
    if ((Native as any).__oscarPerfProbe) return;

    class CountedBroadcastChannel extends Native {
        private _oscarClosed = false;

        constructor(name: string) {
            super(name);
            bcOpened++;
        }

        close() {
            if (!this._oscarClosed) {
                this._oscarClosed = true;
                bcClosed++;
            }
            super.close();
        }
    }

    (CountedBroadcastChannel as any).__oscarPerfProbe = true;
    (window as any).BroadcastChannel = CountedBroadcastChannel;
}

// ---- long tasks ----

interface LongTaskSample {
    at: number;
    duration: number;
}

const longTasks: LongTaskSample[] = [];
let longTaskObserver: PerformanceObserver | null = null;

function installLongTaskObserver() {
    if (typeof PerformanceObserver === 'undefined' || longTaskObserver) return;
    try {
        longTaskObserver = new PerformanceObserver((list) => {
            const now = Date.now();
            for (const entry of list.getEntries()) {
                longTasks.push({at: now, duration: entry.duration});
            }
            // Bounded ring: the overlay only ever reports a rolling window.
            if (longTasks.length > 2000) longTasks.splice(0, longTasks.length - 2000);
        });
        longTaskObserver.observe({entryTypes: ['longtask']});
    } catch {
        // longtask is Chromium-only; the rest of the overlay still works.
        longTaskObserver = null;
    }
}

export function longTaskStats(windowMs: number) {
    const cutoff = Date.now() - windowMs;
    let count = 0;
    let blockedMs = 0;
    let worstMs = 0;
    for (let i = longTasks.length - 1; i >= 0; i--) {
        const sample = longTasks[i];
        if (sample.at < cutoff) break;
        count++;
        // "Blocking time" is the portion past the 50ms long-task threshold —
        // the same definition Lighthouse's TBT uses.
        blockedMs += Math.max(0, sample.duration - 50);
        if (sample.duration > worstMs) worstMs = sample.duration;
    }
    return {count, blockedMs, worstMs, supported: longTaskObserver !== null};
}

export function heapMb(): number | null {
    const mem = (performance as any)?.memory;
    if (!mem?.usedJSHeapSize) return null;
    return mem.usedJSHeapSize / (1024 * 1024);
}

/**
 * Everything the overlay shows, in one object — also hung off
 * `window.__oscarPerf` so it can be sampled from the DevTools console or from
 * a headless soak run without scraping the overlay's DOM.
 */
export function perfSnapshot(windowMs: number = 10_000) {
    return {
        renders: Object.fromEntries(snapshotRenderCounts()),
        tasks: longTaskStats(windowMs),
        channels: broadcastChannelStats(),
        heapMb: heapMb(),
        at: Date.now(),
    };
}

/** Idempotent; called from the overlay's module scope so probes are armed
 *  before the map and the datasources start creating channels. */
export function initPerfProbes() {
    if (!isPerfEnabled()) return;
    installBroadcastChannelProbe();
    installLongTaskObserver();
    (window as any).__oscarPerf = {snapshot: perfSnapshot};
}
