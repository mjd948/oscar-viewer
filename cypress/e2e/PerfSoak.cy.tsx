/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 *
 * Not a pass/fail regression spec — a measurement harness. Boots the dashboard
 * with ?perf=1, lets it run against live realtime traffic, and dumps the
 * perfProbe numbers to cypress/perf-<label>.json so a before/after pair can be
 * compared. Run it explicitly:
 *
 *   STATIC_ROOT=web PORT=8090 node serve-proxy.js &
 *   npx cypress run --spec cypress/e2e/PerfSoak.cy.tsx \
 *     --config baseUrl=http://127.0.0.1:8090 --env perfLabel=before,soakSec=180
 */

import {LOCAL_NODE} from './commFailureShared';

const SOAK_SEC = Number(Cypress.env('soakSec') || 180);
const LABEL = String(Cypress.env('perfLabel') || 'run');
// 'dashboard' = the seeded page (lane status + alarm table + map).
// 'lane-view' = the page that actually carries a video widget and two charts,
// which is the only way to measure the hls.js transmuxing change here.
const PAGE = String(Cypress.env('perfPage') || 'dashboard');
// Let lane discovery, the historical fetches and the video handshakes settle
// before the measured window opens, so startup cost isn't charged to steady state.
const WARMUP_SEC = 30;
const SAMPLE_SEC = 15;

describe(`Perf soak (${LABEL})`, () => {
    it(`collects ${SOAK_SEC}s of dashboard steady-state metrics`, () => {
        cy.visit(`/?perf=1&cb=${Date.now()}`, {
            onBeforeLoad(win) {
                win.localStorage.setItem('osh_nodes', JSON.stringify(LOCAL_NODE));
            },
        });

        // The dashboard is up once the alarm table has rendered rows.
        cy.get('.MuiDataGrid-root', {timeout: 60000}).should('be.visible');
        cy.get('[data-testid="perf-overlay"]', {timeout: 30000}).should('exist');

        if (PAGE === 'lane-view') {
            // Client-side nav (a chip click), not cy.visit: a second document
            // load would re-arm the probes and throw away the counters, and the
            // lane the page renders comes from redux, which a reload drops.
            cy.get('[data-testid="widget-system-status"] .MuiPaper-root p', {timeout: 60000})
                .first().click();
            cy.location('pathname', {timeout: 30000}).should('include', 'lane-view');
            cy.get('video', {timeout: 60000}).should('exist');
        }

        cy.wait(WARMUP_SEC * 1000);

        const samples: any[] = [];
        cy.window().then((win: any) => {
            expect(win.__oscarPerf, 'perf probe installed').to.exist;
            samples.push({...win.__oscarPerf.snapshot(), tag: 'warm'});
        });

        const rounds = Math.max(1, Math.floor(SOAK_SEC / SAMPLE_SEC));
        for (let i = 0; i < rounds; i++) {
            cy.wait(SAMPLE_SEC * 1000);
            cy.window().then((win: any) => {
                samples.push({...win.__oscarPerf.snapshot(), tag: `t+${(i + 1) * SAMPLE_SEC}s`});
            });
        }

        // Direct evidence that transmuxing went off-thread: hls.js falls back to
        // inline (main-thread) transmuxing silently on any worker failure, so
        // "the config says enableWorker" proves nothing. A resource-timing entry
        // for the worker script does.
        let hlsWorker: string | null = null;
        cy.window().then((win: any) => {
            const hit = win.performance.getEntriesByType('resource')
                .find((e: any) => String(e.name).includes('hls.worker.js'));
            hlsWorker = hit ? 'loaded' : 'absent';
        });

        cy.then(() => {
            const first = samples[0];
            const last = samples[samples.length - 1];
            const elapsedSec = (last.at - first.at) / 1000;

            const rendersPerSec: Record<string, number> = {};
            for (const name of Object.keys(last.renders)) {
                const delta = last.renders[name] - (first.renders[name] ?? 0);
                rendersPerSec[name] = Number((delta / elapsedSec).toFixed(2));
            }

            const report = {
                label: LABEL,
                page: PAGE,
                hlsWorker,
                elapsedSec: Number(elapsedSec.toFixed(1)),
                rendersPerSec,
                longTasks: {
                    // rolling 10s window at the end of the soak
                    countPer10s: last.tasks.count,
                    blockedMsPer10s: Math.round(last.tasks.blockedMs),
                    worstMs: Math.round(last.tasks.worstMs),
                    supported: last.tasks.supported,
                },
                broadcastChannels: {
                    liveAtStart: first.channels.live,
                    liveAtEnd: last.channels.live,
                    growth: last.channels.live - first.channels.live,
                },
                heapMb: {
                    start: first.heapMb === null ? null : Number(first.heapMb.toFixed(1)),
                    end: last.heapMb === null ? null : Number(last.heapMb.toFixed(1)),
                },
                samples,
            };

            cy.writeFile(`cypress/perf-${LABEL}.json`, report);
            // eslint-disable-next-line no-console
            cy.log(JSON.stringify(report, null, 2));
        });
    });
});
