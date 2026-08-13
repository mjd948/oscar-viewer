/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

// The nastier half of comm-failure detection: the MODULE is running fine and
// happily publishing connectionStatus{isConnected:true} at 1 Hz, but the
// DEVICE behind it went away (simulator stopped / cable pulled / host down),
// so no real data has arrived in hours. The RS-350 module cannot be trusted to
// notice — RS350Sensor.heartbeat() tests
// `messageHandler.getTimeSinceLastMessage() < reconnectPeriod`, and
// MessageHandler.timeSinceLastMessage is assigned 0 once and never updated, so
// the test is always true and the module reports "connected" forever. Before
// this fix the viewer counted that heartbeat as proof of life and showed a
// pulsing green heart for a detector that had been silent for 22 minutes.
//
// This spec asks the API what is actually true and then requires the UI to
// agree, so it is valid whether or not the simulator happens to be running:
//   npx cypress run --spec cypress/e2e/CommFailureSilentDevice.cy.tsx \
//     --config baseUrl=http://127.0.0.1:8090,testIsolation=true --env nodePort=8090

import {
    DEVICE_LIVE_MAX_MS, PATROL, WALKER_NORMAL, WALKER_OFFLINE,
    laneChip, patrolDeviceAges, visitDashboard,
} from './commFailureShared';

describe('Comm failure when the module is up but the device is silent', () => {

    it('UI liveness matches device data, not the module heartbeat', () => {
        patrolDeviceAges().then((ages: any) => {
            const deviceSilent = ages.locationMs > DEVICE_LIVE_MAX_MS;
            cy.log(`location age ${Math.round(ages.locationMs / 1000)}s, ` +
                `connectionStatus age ${Math.round(ages.connectionMs / 1000)}s ` +
                `= ${JSON.stringify(ages.connectionResult)}`);

            visitDashboard();

            if (deviceSilent) {
                // The exact trap: a fresh, cheerful connectionStatus while the
                // device is gone. When it is fresh AND true, the assertions
                // below are proof the viewer ignored it.
                if (ages.connectionMs < DEVICE_LIVE_MAX_MS) {
                    expect(ages.connectionResult?.isConnected,
                        'module still claims connected while the device is silent').to.be.true;
                }
                laneChip(PATROL).find('[data-testid="CloseIcon"]', {timeout: 40000}).should('exist');
                laneChip(PATROL).find('[data-testid="FavoriteIcon"]').should('not.exist');
                cy.get(WALKER_OFFLINE, {timeout: 30000}).should('exist');
            } else {
                laneChip(PATROL).find('[data-testid="FavoriteIcon"]', {timeout: 60000}).should('exist');
                cy.get(WALKER_NORMAL, {timeout: 60000}).should('exist');
            }

            // Regression guard for the same change: dropping connectionStatus
            // as a liveness source must NOT strand healthy RPM lanes, whose
            // ~1 Hz gamma/neutron counts are now what keeps them alive.
            // Asserted as "not comm-failed" rather than "shows a heart": these
            // lanes legitimately render alarm/scan/tamper icons whenever the
            // sim drives an occupancy, which is orthogonal to liveness.
            for (const lane of ['AFM Gate', 'Marshall']) {
                laneChip(lane).find('[data-testid="CloseIcon"]', {timeout: 60000}).should('not.exist');
            }
        });
    });
});
