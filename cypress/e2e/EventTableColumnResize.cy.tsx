/*
 * Column resizing.
 *
 * The grid stores a resize in its own column state, but recomputes that state
 * from `props.columns` whenever their identity changes — every render here —
 * and a column with `flex > 0` gets its flex share regardless of any stored
 * width. So the interesting assertion is not "does the drag work" but "is the
 * width still there after the table has re-rendered", which live rows arriving
 * every few seconds make happen on their own.
 */

const WIDGET = '[data-testid="widget-adjudication-table"]';

const colWidth = (field: string) =>
    cy.get(`${WIDGET} .MuiDataGrid-columnHeader[data-field="${field}"]`)
        .then(($c) => Math.round($c[0].getBoundingClientRect().width));

/** Drags `field`'s resize separator by `dx` px and releases. */
const dragResize = (field: string, dx: number) =>
    cy.get(`${WIDGET} .MuiDataGrid-columnHeader[data-field="${field}"] .MuiDataGrid-columnSeparator--resizable`)
        .then(($s) => {
            const r = $s[0].getBoundingClientRect();
            const x = r.left + r.width / 2, y = r.top + r.height / 2;
            cy.wrap($s).trigger('mousedown', {button: 0, clientX: x, clientY: y, force: true});
            // buttons:1 — the move handler treats buttons:0 as a dropped mouseup.
            cy.document().trigger('mousemove', {button: 0, buttons: 1, clientX: x + dx, clientY: y});
            cy.document().trigger('mouseup', {button: 0, clientX: x + dx, clientY: y});
        });

/** Persisted width for one column of the seeded alarm-table widget. */
const persistedWidth = (key: string) =>
    cy.window().then((win) => {
        const root = JSON.parse(win.localStorage.getItem('persist:root')!);
        const slice = JSON.parse(root.pageLayoutSlice);
        const widget = slice.pages.flatMap((p: any) => p.widgets)
            .find((w: any) => w.id === 'dashboard-alarm-table');
        return widget.config.columns.find((c: any) => c.key === key)?.width ?? null;
    });

const resetPage = () => {
    cy.get('[data-testid="page-menu-button"]').click();
    cy.contains('li', /reset/i).click();
    cy.get(WIDGET, {timeout: 10000}).should('exist');
};

describe('Event table column resizing', () => {

    it('keeps a resized width across re-renders and reload', () => {
        cy.visit('/');
        cy.get(WIDGET, {timeout: 10000}).should('exist');

        colWidth('status').then((before) => {
            dragResize('status', 80);
            colWidth('status').then((after) => {
                expect(after, 'drag widened the column').to.be.greaterThan(before + 40);

                // The regression this guards: the width used to survive the drag
                // and then snap back to its flex share on the next live row.
                cy.wait(8000);
                colWidth('status').then((later) => {
                    expect(later, 'width survived re-renders').to.be.closeTo(after, 2);
                });

                persistedWidth('status').then((w) => {
                    expect(w, 'width written to the widget config').to.be.closeTo(after, 2);
                });

                cy.reload();
                cy.get(WIDGET, {timeout: 10000}).should('exist');
                colWidth('status').then((afterReload) => {
                    expect(afterReload, 'width survived reload').to.be.closeTo(after, 2);
                });
            });
        });

        resetPage();
        persistedWidth('status').then((w) => expect(w, 'reset clears the width').to.eq(null));
    });

    it('narrows a column again, and stops at its minWidth', () => {
        cy.visit('/');
        cy.get(WIDGET, {timeout: 10000}).should('exist');

        // Every column in this widget starts pinned at its minWidth, so give
        // status some slack first, then take it back — narrowing is the
        // direction that would silently flex back up.
        dragResize('status', 80);
        colWidth('status').then((wide) => {
            dragResize('status', -50);
            colWidth('status').then((narrow) => {
                expect(narrow, 'narrowed').to.be.lessThan(wide - 30);
                cy.wait(6000);
                colWidth('status').then((later) =>
                    expect(later, 'stayed narrow').to.be.closeTo(narrow, 2));
            });
        });

        // minWidth is still the floor: a big drag left cannot shrink it past it.
        dragResize('status', -400);
        colWidth('status').then((floored) => expect(floored, 'clamped at minWidth').to.eq(125));

        resetPage();
    });

    it('keeps widths per session on a table with no widget config', () => {
        cy.visit('/lane-view');
        cy.get('.MuiSelect-select', {timeout: 15000}).first().click();
        cy.get('li[role="option"]').first().click();
        const LANE = '[data-testid="widget-status-table"]';
        cy.get(`${LANE} .MuiDataGrid-columnHeader[data-field="status"]`, {timeout: 15000}).should('exist');

        cy.get(`${LANE} .MuiDataGrid-columnHeader[data-field="status"]`)
            .then(($c) => {
                const before = Math.round($c[0].getBoundingClientRect().width);
                cy.get(`${LANE} .MuiDataGrid-columnHeader[data-field="status"] .MuiDataGrid-columnSeparator--resizable`)
                    .then(($s) => {
                        const r = $s[0].getBoundingClientRect();
                        const x = r.left + r.width / 2, y = r.top + r.height / 2;
                        cy.wrap($s).trigger('mousedown', {button: 0, clientX: x, clientY: y, force: true});
                        cy.document().trigger('mousemove', {button: 0, buttons: 1, clientX: x + 70, clientY: y});
                        cy.document().trigger('mouseup', {button: 0, clientX: x + 70, clientY: y});
                    });
                cy.wait(6000);
                cy.get(`${LANE} .MuiDataGrid-columnHeader[data-field="status"]`).then(($after) => {
                    expect(Math.round($after[0].getBoundingClientRect().width),
                        'held without a config to persist to').to.be.greaterThan(before + 40);
                });
            });
    });
});
