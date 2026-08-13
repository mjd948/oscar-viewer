"use client";

/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import * as React from "react";
import {Box, Checkbox, FormControlLabel, IconButton, TextField, Tooltip} from "@mui/material";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import {
    GridColDef,
    GridColumnVisibilityModel,
    gridClasses,
    gridColumnDefinitionsSelector,
    gridColumnVisibilityModelSelector,
    useGridApiContext,
    useGridRootProps,
    useGridSelector,
} from "@mui/x-data-grid";
import {useLanguage} from "@/app/contexts/LanguageContext";

declare module "@mui/x-data-grid" {
    interface ColumnsManagementPropsOverrides {
        /**
         * Fires on drop / arrow click with the complete new order of the fields
         * the panel shows. Omit to render the panel without any reordering
         * affordance — that is how the tables with nowhere to persist an order
         * keep their existing behaviour.
         */
        onReorderColumns?: (fields: string[]) => void;
    }
}

interface EventTableColumnsPanelProps {
    getTogglableColumns?: (columns: GridColDef[]) => string[];
    onReorderColumns?: (fields: string[]) => void;
}

/** Where a dragged row would land: above or below the row under the cursor. */
interface DropTarget {
    field: string;
    below: boolean;
}

const searchPredicate = (column: GridColDef, search: string) =>
    (column.headerName || column.field).toLowerCase().indexOf(search) > -1;

/** Only `false` hides a column; a missing key and `true` both mean visible. */
const sameVisibility = (a: GridColumnVisibilityModel, b: GridColumnVisibilityModel) => {
    const hidden = (m: GridColumnVisibilityModel) => Object.keys(m).filter((k) => m[k] === false).sort();
    const [x, y] = [hidden(a), hidden(b)];
    return x.length === y.length && x.every((k, i) => k === y[i]);
};

const sameOrder = (a: string[], b: string[]) =>
    a.length === b.length && a.every((f, i) => f === b[i]);

/**
 * The grid's COLUMNS panel, with reordering.
 *
 * Replaces MUI's `columnsManagement` slot rather than the `columnsPanel` that
 * wraps it: the wrapper is six lines of focus trap and panel chrome worth
 * inheriting, and `slotProps.columnsManagement.getTogglableColumns` — which
 * decides what the panel may show — is already wired through it.
 *
 * Column reordering is a DataGrid Pro feature, so the order lives in the
 * widget's own config instead (see EventTableColumns.applyFieldOrder) and the
 * grid only ever sees an already-ordered `columns` array. Visibility, by
 * contrast, still goes through the grid: its model is controlled, so
 * `setColumnVisibility` here surfaces as `onColumnVisibilityModelChange` on
 * the grid and is persisted by the same path it always was.
 */
export default function EventTableColumnsPanel(
    {getTogglableColumns, onReorderColumns}: EventTableColumnsPanelProps) {

    const apiRef = useGridApiContext();
    const rootProps = useGridRootProps();
    const {t} = useLanguage();

    const columns = useGridSelector(apiRef, gridColumnDefinitionsSelector);
    const columnVisibilityModel = useGridSelector(apiRef, gridColumnVisibilityModelSelector);

    const [search, setSearch] = React.useState('');
    const searchInputRef = React.useRef<HTMLInputElement>(null);
    React.useEffect(() => searchInputRef.current?.focus(), []);

    // The panel shows the columns the host allows, in the grid's own order —
    // which is the persisted order, since the grid is handed pre-ordered
    // columns. Search narrows the list without disturbing that order.
    const togglable = React.useMemo(() => {
        const allowed = getTogglableColumns?.(columns);
        return allowed ? columns.filter((c) => allowed.includes(c.field)) : columns;
    }, [columns, getTogglableColumns]);

    const currentColumns = React.useMemo(() => {
        if (!search) return togglable;
        return togglable.filter((c) => searchPredicate(c, search.toLowerCase()));
    }, [togglable, search]);

    // Reset means "undo what I did since opening the panel", so it has to
    // capture the order as well as the visibility it restores.
    const initialRef = React.useRef<{model: GridColumnVisibilityModel; fields: string[]} | null>(null);
    if (initialRef.current === null)
        initialRef.current = {
            model: {...columnVisibilityModel},
            fields: togglable.map((c) => c.field),
        };
    const initial = initialRef.current;

    const fields = React.useMemo(() => togglable.map((c) => c.field), [togglable]);
    const canReorder = !!onReorderColumns && !search && fields.length > 1;

    const [dragField, setDragField] = React.useState<string | null>(null);
    const [dropTarget, setDropTarget] = React.useState<DropTarget | null>(null);
    // HTML5 drag has no way to say "only from the handle": dragstart's target is
    // the draggable element, not whatever was pressed. So the row is only
    // draggable while its handle is held down.
    const [armedField, setArmedField] = React.useState<string | null>(null);

    const clearDrag = () => {
        setDragField(null);
        setDropTarget(null);
        setArmedField(null);
    };

    const emitOrder = (next: string[]) => {
        if (!sameOrder(next, fields)) onReorderColumns?.(next);
    };

    const moveColumn = (field: string, delta: number) => {
        const from = fields.indexOf(field);
        const to = from + delta;
        if (from < 0 || to < 0 || to >= fields.length) return;
        const next = [...fields];
        [next[from], next[to]] = [next[to], next[from]];
        emitOrder(next);
    };

    const handleDrop = (target: DropTarget) => {
        if (!dragField) return;
        const next = fields.filter((f) => f !== dragField);
        const at = next.indexOf(target.field);
        if (at < 0) return clearDrag();
        next.splice(at + (target.below ? 1 : 0), 0, dragField);
        emitOrder(next);
        clearDrag();
    };

    const toggleColumn = (field: string) =>
        apiRef.current.setColumnVisibility(field, columnVisibilityModel[field] === false);

    const hideableColumns = React.useMemo(
        () => currentColumns.filter((c) => c.hideable !== false), [currentColumns]);
    const allVisible = hideableColumns.every((c) => columnVisibilityModel[c.field] !== false);
    const allHidden = hideableColumns.every((c) => columnVisibilityModel[c.field] === false);

    const toggleAllColumns = (visible: boolean) => {
        const next: GridColumnVisibilityModel = {...gridColumnVisibilityModelSelector(apiRef)};
        for (const col of columns) {
            if (col.hideable === false || !fields.includes(col.field)) continue;
            // Deleting rather than setting `true` keeps the model in the shape
            // the grid produces itself.
            if (visible) delete next[col.field];
            else next[col.field] = false;
        }
        apiRef.current.setColumnVisibilityModel(next);
    };

    const resetDisabled = sameVisibility(columnVisibilityModel, initial.model)
        && sameOrder(fields, initial.fields);

    const handleReset = () => {
        apiRef.current.setColumnVisibilityModel(initial.model);
        if (onReorderColumns) emitOrder(initial.fields);
    };

    return (
        <>
            <Box className={gridClasses.columnsManagementHeader} sx={{px: 2, pt: 1.5, pb: 1}}>
                <TextField
                    inputRef={searchInputRef}
                    className={gridClasses.columnsManagementSearchInput}
                    placeholder={apiRef.current.getLocaleText('columnsManagementSearchTitle')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    variant="outlined"
                    size="small"
                    type="search"
                    autoComplete="off"
                    fullWidth
                    inputProps={{'aria-label': apiRef.current.getLocaleText('columnsManagementSearchTitle')}}
                    InputProps={{
                        startAdornment: <SearchRoundedIcon fontSize="small" sx={{mr: 0.5, color: 'action.active'}}/>,
                        endAdornment: (
                            <IconButton
                                aria-label={apiRef.current.getLocaleText('columnsManagementDeleteIconLabel')}
                                size="small"
                                tabIndex={-1}
                                sx={{visibility: search ? 'visible' : 'hidden'}}
                                onClick={() => {
                                    setSearch('');
                                    searchInputRef.current?.focus();
                                }}
                            >
                                <ClearRoundedIcon fontSize="small"/>
                            </IconButton>
                        ),
                    }}
                />
            </Box>

            <Box
                className={gridClasses.columnsManagement}
                onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(null);
                }}
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    overflow: 'auto',
                    flex: '1 1',
                    maxHeight: 400,
                    px: 2,
                    pb: 1.5,
                }}
            >
                {currentColumns.map((column) => {
                    const isDropTarget = dropTarget?.field === column.field;
                    const index = fields.indexOf(column.field);
                    return (
                        <Box
                            key={column.field}
                            draggable={canReorder && armedField === column.field}
                            onDragStart={(e) => {
                                // Firefox aborts a drag that carries no data.
                                e.dataTransfer.setData('text/plain', column.field);
                                e.dataTransfer.effectAllowed = 'move';
                                setDragField(column.field);
                            }}
                            onDragOver={(e) => {
                                if (!dragField) return;
                                // Without preventDefault the drop never fires.
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                                const rect = e.currentTarget.getBoundingClientRect();
                                const below = e.clientY > rect.top + rect.height / 2;
                                // dragover repeats at frame rate; only re-render
                                // when the indicator would actually move.
                                if (!isDropTarget || dropTarget?.below !== below)
                                    setDropTarget({field: column.field, below});
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                const rect = e.currentTarget.getBoundingClientRect();
                                handleDrop({
                                    field: column.field,
                                    below: e.clientY > rect.top + rect.height / 2,
                                });
                            }}
                            onDragEnd={clearDrag}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                width: '100%',
                                opacity: dragField === column.field ? 0.4 : 1,
                                // A 2px marker rather than a moved row: nothing
                                // reflows until the drop is committed.
                                borderTop: 2,
                                borderBottom: 2,
                                borderColor: 'transparent',
                                borderTopColor: isDropTarget && !dropTarget?.below ? 'primary.main' : 'transparent',
                                borderBottomColor: isDropTarget && dropTarget?.below ? 'primary.main' : 'transparent',
                            }}
                        >
                            {canReorder && (
                                <Tooltip title={t('dragToReorder')}>
                                    <Box
                                        component="span"
                                        aria-hidden
                                        onPointerDown={() => setArmedField(column.field)}
                                        onPointerUp={() => setArmedField(null)}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            cursor: 'grab',
                                            color: 'action.active',
                                            '&:active': {cursor: 'grabbing'},
                                        }}
                                    >
                                        <DragIndicatorRoundedIcon fontSize="small"/>
                                    </Box>
                                </Tooltip>
                            )}
                            <FormControlLabel
                                className={gridClasses.columnsManagementRow}
                                // ml:0 cancels FormControlLabel's -11px default,
                                // which would otherwise pull the checkbox's
                                // full-size invisible input over the drag handle
                                // and swallow the grab.
                                sx={{flex: 1, minWidth: 0, mx: 0}}
                                control={
                                    <Checkbox
                                        {...rootProps.slotProps?.baseCheckbox}
                                        size="small"
                                        disabled={column.hideable === false}
                                        checked={columnVisibilityModel[column.field] !== false}
                                        onClick={() => toggleColumn(column.field)}
                                        name={column.field}
                                        sx={{p: 0.5}}
                                    />
                                }
                                label={column.headerName || column.field}
                            />
                            {canReorder && (
                                <>
                                    <IconButton
                                        size="small"
                                        sx={{p: 0.25}}
                                        aria-label={t('moveColumnUp')}
                                        title={t('moveColumnUp')}
                                        disabled={index <= 0}
                                        onClick={() => moveColumn(column.field, -1)}
                                    >
                                        <ArrowUpwardRoundedIcon fontSize="inherit"/>
                                    </IconButton>
                                    <IconButton
                                        size="small"
                                        sx={{p: 0.25}}
                                        aria-label={t('moveColumnDown')}
                                        title={t('moveColumnDown')}
                                        disabled={index < 0 || index >= fields.length - 1}
                                        onClick={() => moveColumn(column.field, 1)}
                                    >
                                        <ArrowDownwardRoundedIcon fontSize="inherit"/>
                                    </IconButton>
                                </>
                            )}
                        </Box>
                    );
                })}
                {currentColumns.length === 0 && (
                    <Box sx={{py: 0.5, color: 'text.disabled'}}>
                        {apiRef.current.getLocaleText('columnsManagementNoColumns')}
                    </Box>
                )}
            </Box>

            {currentColumns.length > 0 && (
                <Box
                    className={gridClasses.columnsManagementFooter}
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderTop: 1,
                        borderColor: 'divider',
                        px: 2,
                        py: 0.5,
                    }}
                >
                    <FormControlLabel
                        control={
                            <Checkbox
                                {...rootProps.slotProps?.baseCheckbox}
                                size="small"
                                disabled={hideableColumns.length === 0}
                                checked={allVisible}
                                indeterminate={!allVisible && !allHidden}
                                onClick={() => toggleAllColumns(!allVisible)}
                                sx={{p: 0.5}}
                            />
                        }
                        label={apiRef.current.getLocaleText('columnsManagementShowHideAllText')}
                    />
                    <IconButton
                        size="small"
                        sx={{fontSize: '0.8125rem', borderRadius: 1, px: 1}}
                        disabled={resetDisabled}
                        onClick={handleReset}
                    >
                        {apiRef.current.getLocaleText('columnsManagementReset')}
                    </IconButton>
                </Box>
            )}
        </>
    );
}
