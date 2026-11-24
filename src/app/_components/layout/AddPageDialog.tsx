"use client";

/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import React, {useState} from "react";
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
} from "@mui/material";
import {useRouter} from "next/dist/client/components/navigation";
import {useSelector} from "react-redux";
import {randomUUID} from "osh-js/source/core/utils/Utils";
import {useAppDispatch} from "@/lib/state/Hooks";
import {LayoutItem, PageConfig, RGLBreakpoint} from "@/lib/layout/PageConfigTypes";
import {addPage, selectPages} from "@/lib/state/PageLayoutSlice";
import {buildPageFromTemplate, PAGE_TEMPLATE_IDS, templateTitleKey} from "@/lib/layout/DefaultPages";
import {PAGE_ICONS} from "./WidgetRegistry";
import {useLanguage} from "@/app/contexts/LanguageContext";

interface AddPageDialogProps {
    open: boolean;
    onClose: () => void;
}

/** Deep-copy a page's widgets/layouts with fresh widget instance ids. */
function clonePageContents(source: PageConfig): Pick<PageConfig, 'widgets' | 'layouts' | 'laneContext'> {
    const idMap = new Map<string, string>();
    const widgets = source.widgets.map((w) => {
        const newId = `w-${randomUUID()}`;
        idMap.set(w.id, newId);
        return {...JSON.parse(JSON.stringify(w)), id: newId};
    });
    const layouts: PageConfig['layouts'] = {};
    (Object.keys(source.layouts) as RGLBreakpoint[]).forEach((bp) => {
        layouts[bp] = (source.layouts[bp] ?? [])
            .filter((item: LayoutItem) => idMap.has(item.i))
            .map((item: LayoutItem) => ({...item, i: idMap.get(item.i)!}));
    });
    return {widgets, layouts, laneContext: source.laneContext ? {...source.laneContext} : undefined};
}

export default function AddPageDialog({open, onClose}: AddPageDialogProps) {
    const dispatch = useAppDispatch();
    const router = useRouter();
    const {t} = useLanguage();
    const pages = useSelector(selectPages);

    const [name, setName] = useState('');
    const [icon, setIcon] = useState('grid');
    const [templateId, setTemplateId] = useState<string>('blank');

    const handleCreate = () => {
        const trimmed = name.trim();
        if (!trimmed) return;

        const id = `page-${randomUUID()}`;
        let page: PageConfig | undefined;
        if (templateId.startsWith('template:')) {
            // A built-in layout; the page remembers it so "Reset to default" can rebuild it.
            page = buildPageFromTemplate(templateId.slice('template:'.length), {id, title: trimmed, icon});
        } else {
            const source = templateId !== 'blank' ? pages.find((p: PageConfig) => p.id === templateId) : undefined;
            const contents = source
                ? clonePageContents(source)
                : {widgets: [], layouts: {}, laneContext: undefined};
            page = {id, title: trimmed, icon, showInNav: true, ...contents};
        }
        if (!page) return;
        dispatch(addPage(page));
        setName('');
        setTemplateId('blank');
        onClose();
        router.push(`/custom-page/?id=${id}`);
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>{t('addPage')}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{pt: 1}}>
                    <TextField
                        label={t('pageName')}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        size="small"
                        fullWidth
                        autoFocus
                    />
                    <ToggleButtonGroup
                        value={icon}
                        exclusive
                        onChange={(_e, next) => next && setIcon(next)}
                        size="small"
                        sx={{flexWrap: 'wrap'}}
                    >
                        {Object.entries(PAGE_ICONS).map(([key, node]) => (
                            <ToggleButton key={key} value={key} aria-label={key}>
                                {node}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                    <FormControl size="small" fullWidth>
                        <InputLabel id="page-template-label">{t('pageTemplate')}</InputLabel>
                        <Select
                            labelId="page-template-label"
                            label={t('pageTemplate')}
                            value={templateId}
                            onChange={(e) => setTemplateId(e.target.value)}
                        >
                            <MenuItem value="blank">{t('blankPage')}</MenuItem>
                            {PAGE_TEMPLATE_IDS.map((tid) => (
                                <MenuItem key={`template:${tid}`} value={`template:${tid}`}>
                                    {t('pageTemplateLayout', {page: t(templateTitleKey(tid) ?? tid)})}
                                </MenuItem>
                            ))}
                            {pages.map((p: PageConfig) => (
                                <MenuItem key={p.id} value={p.id}>
                                    {t('copyOf')} {p.mainRoute ? t(p.title) : p.title}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('cancel')}</Button>
                <Button onClick={handleCreate} variant="contained" disabled={!name.trim()}>
                    {t('create')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
