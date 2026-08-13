/*
 * Column reordering from the grid's COLUMNS panel.
 *
 * Order lives in the widget's persisted config, not in the grid (reordering is
 * a DataGrid Pro feature), so the checks here have to survive the round trip
 * through redux-persist rather than just the in-memory grid state.
 *
 * Note the grid virtualizes columns horizontally: only the headers currently
 * in the viewport exist in the DOM, and which ones those are changes when
 * columns move. So on-screen assertions compare the RELATIVE order of two
 * neighbours, and completeness (nothing added, dropped or duplicated) is
 * asserted against the persisted config instead.
 */

const WIDGET = '[data-testid="widget-adjudication-table"]';

/** Rendered header labels of the alarm-table widget, left to right. */
const headerOrder = () =>
    cy.get(`${WIDGET} .MuiDataGrid-columnHeaderTitle`)
        .then(($els) => [...$els].map((el) => el.textContent!.trim()).filter(Boolean));

/** Asserts `first` sits left of `second`, and that both are on screen. */
const expectOrder = (headers: string[], first: string, second: string) => {
    expect(headers.indexOf(first), `${first} rendered`).to.be.greaterThan(-1);
    expect(headers.indexOf(second), `${second} rendered`).to.be.greaterThan(-1);
    expect(headers.indexOf(first), `${first} left of ${second}`)
        .to.be.lessThan(headers.indexOf(second));
};

const openColumnsPanel = () => cy.get(WIDGET).contains('button', /columns/i).click();
const closeColumnsPanel = () => cy.get('body').type('{esc}');

/** The panel row whose label is `label`. */
const panelRow = (label: string) =>
    cy.get('.MuiDataGrid-columnsManagement').contains('label', label).parent();

/** Persisted column keys for the seeded alarm-table widget, in saved order. */
const persistedKeys = () =>
    cy.window().then((win) => {
        const root = JSON.parse(win.localStorage.getItem('persist:root')!);
        const slice = JSON.parse(root.pageLayoutSlice);
        const widget = slice.pages
            .flatMap((p: any) => p.widgets)
            .find((w: any) => w.id === 'dashboard-alarm-table');
        expect(widget, 'seeded alarm-table widget').to.exist;
        return widget.config.columns.map((c: any) => c.key) as string[];
    });

const resetPage = () => {
    cy.get('[data-testid="page-menu-button"]').click();
    cy.contains('li', /reset/i).click();
    cy.get(WIDGET, {timeout: 10000}).should('exist');
};

describe('Event table column reordering', () => {

    it('reorders with the panel arrows and persists across reload', () => {
        cy.visit('/');
        cy.get(WIDGET, {timeout: 10000}).should('exist');
        headerOrder().then((before) => expectOrder(before, 'End Time', 'Max Gamma (cps)'));

        openColumnsPanel();
        panelRow('Max Gamma (cps)').find('button[aria-label="Move column up"]').click();
        closeColumnsPanel();

        headerOrder().then((after) => expectOrder(after, 'Max Gamma (cps)', 'End Time'));

        persistedKeys().then((keys) => {
            expect(keys.indexOf('maxGamma'), 'maxGamma now before endTime')
                .to.be.lessThan(keys.indexOf('endTime'));
            // A reorder permutes; it must never add, drop or duplicate.
            expect(new Set(keys).size, 'no duplicate keys').to.eq(keys.length);
            expect(keys.length, 'every schema column still present').to.eq(11);
            // The actions column has no config entry and must never gain one.
            expect(keys).to.not.include('Menu');
        });

        // The grid is handed an already-ordered array, so this only holds if
        // the new order actually reached the widget config.
        cy.reload();
        cy.get(WIDGET, {timeout: 10000}).should('exist');
        headerOrder().then((after) => expectOrder(after, 'Max Gamma (cps)', 'End Time'));

        resetPage();
        headerOrder().then((after) => expectOrder(after, 'End Time', 'Max Gamma (cps)'));
    });

    it('reorders by dragging one row onto another', () => {
        cy.visit('/');
        cy.get(WIDGET, {timeout: 10000}).should('exist');
        headerOrder().then((before) => expectOrder(before, 'Lane ID', 'Status'));

        openColumnsPanel();

        const dataTransfer = new DataTransfer();
        panelRow('Status').as('source');
        panelRow('Lane ID').as('target');

        // The handle arms the row: HTML5 dragstart cannot tell what was
        // pressed, so a row is only draggable while its handle is held.
        cy.get('@source').find('[data-testid="DragIndicatorRoundedIcon"]').trigger('pointerdown');
        cy.get('@source').trigger('dragstart', {dataTransfer});

        // clientY must be explicit: cy.trigger defaults to the element centre,
        // which would make the above/below split a coin flip.
        cy.get('@target').then(($t) => {
            const rect = $t[0].getBoundingClientRect();
            const above = {dataTransfer, clientX: rect.left + 10, clientY: rect.top + 2};
            cy.get('@target').trigger('dragover', above);
            cy.get('@target').trigger('drop', above);
        });
        cy.get('@source').trigger('dragend', {dataTransfer});

        closeColumnsPanel();
        headerOrder().then((after) => expectOrder(after, 'Status', 'Lane ID'));

        persistedKeys().then((keys) => {
            expect(keys[0], 'status dropped above laneId').to.eq('status');
            expect(new Set(keys).size).to.eq(keys.length);
            expect(keys.length).to.eq(11);
        });

        cy.reload();
        cy.get(WIDGET, {timeout: 10000}).should('exist');
        headerOrder().then((after) => expectOrder(after, 'Status', 'Lane ID'));

        resetPage();
    });

    it('offers no reordering on a table with nowhere to persist it', () => {
        // The lane-view occupancy table is the same EventTable, but standalone:
        // it gets no columnSettings, so its panel must look exactly as it did
        // before this feature.
        cy.visit('/lane-view');
        // The page opens with no lane selected; the table only mounts once one
        // is picked. (The MUI floating label is position:fixed and reports as
        // covered, so wait on the select itself.)
        cy.get('.MuiSelect-select', {timeout: 15000}).first().click();
        cy.get('li[role="option"]').first().click();

        cy.get('[data-testid="widget-status-table"] .MuiDataGrid-root', {timeout: 15000}).should('exist');
        cy.get('[data-testid="widget-status-table"]').contains('button', /columns/i).click();
        cy.get('.MuiDataGrid-columnsManagement', {timeout: 10000}).should('exist');
        cy.get('.MuiDataGrid-columnsManagement')
            .find('button[aria-label="Move column up"]').should('not.exist');
        cy.get('.MuiDataGrid-columnsManagement')
            .find('[data-testid="DragIndicatorRoundedIcon"]').should('not.exist');
        // Still a working columns panel, just without the reorder affordances.
        cy.get('.MuiDataGrid-columnsManagement').contains('label', 'Lane ID').should('exist');
        closeColumnsPanel();
    });
});
