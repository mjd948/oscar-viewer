"use client";

/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import React from "react";
import {
    Box,
    Checkbox,
    Divider,
    IconButton,
    List,
    ListItem,
    ListItemText,
    Stack,
    Typography,
} from "@mui/material";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import LaneSelectionField from "./LaneSelectionField";
import {EventTableColumnSetting, EventTableWidgetConfig} from "@/lib/layout/PageConfigTypes";
import {COLUMN_LABEL_KEYS, resolveEventTableColumns} from "@/lib/layout/EventTableColumns";
import {WidgetConfigFormProps} from "@/app/_components/layout/WidgetTypes";
import {useLanguage} from "@/app/contexts/LanguageContext";

export default function EventTableConfigForm({draft, onChange}: WidgetConfigFormProps) {
    const config = draft as EventTableWidgetConfig;
    const {t} = useLanguage();

    const columns = resolveEventTableColumns(config.columns);
    const filters = config.filters ?? {lanes: {mode: 'all' as const}};

    const setColumns = (next: EventTableColumnSetting[]) => onChange({...config, columns: next});
    const setFilters = (next: EventTableWidgetConfig['filters']) => onChange({...config, filters: next});

    const moveColumn = (index: number, delta: number) => {
        const target = index + delta;
        if (target < 0 || target >= columns.length) return;
        const next = [...columns];
        [next[index], next[target]] = [next[target], next[index]];
        setColumns(next);
    };

    const toggleColumn = (index: number) => {
        const next = columns.map((c, i) => i === index ? {...c, visible: !c.visible} : c);
        setColumns(next);
    };

    return (
        <Stack spacing={2}>
            <Typography variant="subtitle2">{t('columns')}</Typography>
            <List dense disablePadding sx={{border: 1, borderColor: 'divider', borderRadius: 1, maxHeight: 260, overflowY: 'auto'}}>
                {columns.map((col, index) => (
                    <ListItem
                        key={col.key}
                        dense
                        secondaryAction={
                            <Box>
                                <IconButton edge="end" size="small" disabled={index === 0}
                                            onClick={() => moveColumn(index, -1)} aria-label="move up">
                                    <ArrowUpwardRoundedIcon fontSize="inherit"/>
                                </IconButton>
                                <IconButton edge="end" size="small" disabled={index === columns.length - 1}
                                            onClick={() => moveColumn(index, 1)} aria-label="move down">
                                    <ArrowDownwardRoundedIcon fontSize="inherit"/>
                                </IconButton>
                            </Box>
                        }
                    >
                        <Checkbox
                            size="small"
                            checked={col.visible}
                            onChange={() => toggleColumn(index)}
                        />
                        <ListItemText primary={t(COLUMN_LABEL_KEYS[col.key] ?? col.key)}/>
                    </ListItem>
                ))}
            </List>

            <Divider/>
            <Typography variant="subtitle2">{t('filters')}</Typography>

            <LaneSelectionField
                value={filters.lanes ?? {mode: 'all'}}
                onChange={(lanes) => setFilters({...filters, lanes})}
            />

            <Typography variant="caption" color="text.secondary">{t('eventTableWidgetFilterHint')}</Typography>
        </Stack>
    );
}
