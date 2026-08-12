/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

// Vehicle ID column regression.
//
// The column reads from a map keyed by occupancy observation id. Two separate
// defects kept it blank until the operator reloaded the page:
//
//  1. EventTable built realtime rows with `occupancyObsId = null`, so a live
//     alarm could never join its OCR read. Fixed by back-filling the id from
//     the lane's occupancy datastream after the row is inserted.
//  2. Enrichment mutated row objects in place. MUI DataGrid memoizes each row
//     on object identity (fastMemo), so even once the value was found the cell
//     did not repaint. Fixed by cloning the row.
//
// Test 1 below covers defect 2 deterministically against existing history: the
// rows are already on screen when the OCR map first publishes, which is the
// exact path a late-arriving read takes. Test 2 covers defect 1 and needs a
// live alarm, so it is slow and belongs in the scheduled suite.
//
// Requires the same-origin verification proxy:
//   STATIC_ROOT=web PORT=8090 node serve-proxy.js
//   npx cypress run --spec cypress/e2e/AlarmTableVehicleIdLive.cy.tsx \
//     --config baseUrl=http://localhost:8090 --env nodePort=8090

const NODE_PORT = Number(Cypress.env('nodePort') || 8090);
const API = `http://localhost:${NODE_PORT}/sensorhub/api`;
const AUTH = {user: 'admin', pass: 'oscar'};

const LOCAL_NODE = [{
    name: 'cypress-local',
    address: 'localhost',
    port: NODE_PORT,
    oshPathRoot: '/sensorhub',
    csAPIEndpoint: '/api',
    bucketsEndpoint: '/buckets',
    auth: {username: 'admin', password: 'oscar'},
    isSecure: false,
    isDefaultNode: true,
}];

function visitEventLog() {
    cy.visit('/event-log', {
        auth: {username: 'admin', password: 'oscar'},
        onBeforeLoad(win) {
            win.localStorage.setItem('osh_nodes', JSON.stringify(LOCAL_NODE));
            win.localStorage.removeItem('persist:root');
        },
    });
}

/** Turns the Vehicle ID column on through the grid's own column panel. */
function showVehicleIdColumn() {
    cy.get('button[aria-label="Select columns"]').first().click();
    cy.get('.MuiDataGrid-panel').contains('label', 'VehicleId')
        .find('input[type="checkbox"]').check({force: true});
    cy.get('body').type('{esc}');
}

describe('Vehicle ID column', () => {
    let hasOcrHistory = false;

    before(() => {
        // Any lane with a vehicleOcr datastream holding at least one result is
        // enough; which lane it is does not matter to the assertions. Skip
        // rather than fail on a node that has never run OCR.
        cy.request({url: `${API}/datastreams?limit=400`, auth: AUTH}).then((res: any) => {
            const ocrStreams = (res.body.items || [])
                .filter((ds: any) => /ocr/i.test(ds.name || ''));
            ocrStreams.forEach((ds: any) => cy.request({
                url: `${API}/datastreams/${ds.id}/observations?limit=1`,
                auth: AUTH,
                failOnStatusCode: false,
            }).then((obs: any) => {
                if ((obs.body?.items || []).length > 0) hasOcrHistory = true;
            }));
        });
    });

    it('fills the column on rows that are already rendered, with no reload', function () {
        if (!hasOcrHistory) this.skip();

        visitEventLog();
        cy.get('.MuiDataGrid-row', {timeout: 30000}).should('exist');

        // Column hidden: nothing is subscribed and no cell carries a read.
        cy.contains('.MuiDataGrid-cell', '(OCR)').should('not.exist');

        // Turning it on mounts useVehicleOcrMap against rows that already
        // exist — the same sequence a late OCR result produces.
        showVehicleIdColumn();

        // `exist`, not `be.visible`: the grid scrolls horizontally at this
        // viewport and Vehicle ID is the last column, so it is off-screen.
        cy.contains('.MuiDataGrid-cell', '(OCR)', {timeout: 30000}).should('exist');
        cy.url().should('include', '/event-log');
    });

    // Opt-in: waits for the lanes to replay an alarming occupancy and for OCR
    // to finish reading its clip, so it runs for minutes. Enable with
    // `--env nodePort=8090,liveAlarms=1` in the scheduled run.
    it('fills a live alarm row without a reload', function () {
        if (!hasOcrHistory || !Cypress.env('liveAlarms')) this.skip();

        visitEventLog();
        cy.get('.MuiDataGrid-row', {timeout: 30000}).should('exist');
        showVehicleIdColumn();

        cy.get('.MuiDataGrid-row').then(($rows) => {
            const before = new Set([...$rows].map(row => row.getAttribute('data-id')));

            // No `.first()` between get and should — a chained command would
            // drop back to the 4s default and never see the alarm.
            cy.get('.MuiDataGrid-row', {timeout: 420000}).should(($now) => {
                const fresh = [...$now].filter(row => !before.has(row.getAttribute('data-id')));
                expect(fresh.length, 'a live occupancy row arrived').to.be.greaterThan(0);
            });

            cy.get('.MuiDataGrid-row', {timeout: 180000}).should(($now) => {
                const fresh = [...$now].filter(row => !before.has(row.getAttribute('data-id')));
                const filled = fresh.filter(row =>
                    (row.querySelector('[data-field="vehicleId"]')?.textContent ?? '').trim() !== '');
                expect(filled.length, 'the live row picked up its OCR read').to.be.greaterThan(0);
            });
        });
    });
});
