/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import {
    DEFAULT_EVENT_TABLE_COLUMNS,
    EventTableColumnSetting,
} from "./PageConfigTypes";

/**
 * Shared column-settings helpers for the event/alarm tables.
 *
 * `EventTableWidgetConfig.columns` is the single persisted unit for both column
 * ORDER (array position) and VISIBILITY (the `visible` flag). Everything that
 * reads or rewrites it — the widget config form, the widget's persistence
 * handler, and the grid's own columns panel — goes through here so the three
 * cannot drift apart.
 *
 * Note that the schema of record is DEFAULT_EVENT_TABLE_COLUMNS, not the live
 * GridColDef array: a grid column with no EventTableColumnKey entry can be
 * neither ordered nor persisted, so it is deliberately invisible to all of
 * this rather than half-supported.
 */

/**
 * A saved widget config only knows the columns that existed when it was
 * written. Union it with the current schema — saved order first, columns added
 * later appended at their default visibility — or a newly added column is
 * unreachable from both the config form and the grid's columns panel: present
 * in the table but impossible to switch on without recreating the widget.
 */
export function resolveEventTableColumns(
    saved?: EventTableColumnSetting[],
): EventTableColumnSetting[] {
    const base = saved?.length ? saved : DEFAULT_EVENT_TABLE_COLUMNS;
    const seen = new Set<string>(base.map((c) => c.key));
    return [
        ...base.map((c) => ({...c})),
        ...DEFAULT_EVENT_TABLE_COLUMNS.filter((c) => !seen.has(c.key)).map((c) => ({...c})),
    ];
}

/**
 * Reorders `settings` so the entries whose key appears in `fields` take
 * `fields` order. Entries missing from `fields` keep their current index, so a
 * panel showing only a subset of the columns can never drop or shuffle what it
 * does not show.
 *
 * Total and subset-safe by construction: it never inserts, never deletes, and
 * never emits a key that was not already in `settings` — which is what keeps
 * the grid's `Menu` actions column out of the persisted config even if a
 * caller hands us its field.
 */
export function applyFieldOrder(
    settings: EventTableColumnSetting[],
    fields: string[],
): EventTableColumnSetting[] {
    const byKey = new Map<string, EventTableColumnSetting>(
        settings.map((s) => [s.key as string, s]));
    const queue = fields
        .map((f) => byKey.get(f))
        .filter((s): s is EventTableColumnSetting => s !== undefined);
    const moving = new Set<string>(queue.map((s) => s.key));
    let next = 0;
    return settings.map((s) => (moving.has(s.key) ? queue[next++] : s));
}

/** i18n keys for column labels, matching the EventTable headers. */
export const COLUMN_LABEL_KEYS: Record<string, string> = {
    laneId: 'laneId',
    occupancyCount: 'occupancyId',
    startTime: 'startTime',
    endTime: 'endTime',
    maxGamma: 'maxGamma',
    maxNeutron: 'maxNeutron',
    status: 'status',
    adjudicatedIds: 'adjudicated',
    adjudicationGroup: 'adjudicationStatus',
    secondaryInspection: 'secondaryInspection',
    vehicleId: 'vehicleId',
};
