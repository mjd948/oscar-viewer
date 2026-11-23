"use client";

import React, {useEffect, useId, useState} from "react";
import {
    Box,
    Button,
    Divider,
    IconButton,
    Popover,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import BookmarkAddOutlinedIcon from "@mui/icons-material/BookmarkAddOutlined";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {useLanguage} from "@/app/contexts/LanguageContext";
import {
    EventLogQueryCriteria,
    MAX_BOOKMARK_NAME_LENGTH,
    MAX_SAVED_EVENT_QUERIES,
    SavedEventQueryBookmark,
    summarizeEventLogQuery,
} from "@/lib/data/oscar/SavedEventQueries";

export interface SavedQueriesPopoverProps {
    anchorEl: HTMLElement | null;
    hasActiveQuery: boolean;
    defaultBookmarkName: string;
    bookmarks: readonly SavedEventQueryBookmark[];
    onClose: () => void;
    onApplyBookmark: (criteria: EventLogQueryCriteria) => void;
    onSaveBookmark: (name: string) => void;
    onDeleteBookmark: (id: string) => void;
}

export default function SavedQueriesPopover({
    anchorEl,
    hasActiveQuery,
    defaultBookmarkName,
    bookmarks,
    onClose,
    onApplyBookmark,
    onSaveBookmark,
    onDeleteBookmark,
}: SavedQueriesPopoverProps) {
    const {t} = useLanguage();
    const headingId = useId();
    const nameInputId = useId();
    const nameErrorId = useId();

    const open = Boolean(anchorEl);
    const [bookmarkName, setBookmarkName] = useState("");
    const [nameError, setNameError] = useState<string | null>(null);
    const [statusAnnouncement, setStatusAnnouncement] = useState("");

    useEffect(() => {
        if (open) {
            setBookmarkName(defaultBookmarkName.slice(0, MAX_BOOKMARK_NAME_LENGTH));
            setNameError(null);
        }
    }, [defaultBookmarkName, open]);

    const handleSaveSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmed = bookmarkName.trim();
        if (!trimmed) {
            setNameError(t("savedQueryNameRequired"));
            return;
        }
        onSaveBookmark(trimmed);
        setNameError(null);
        setStatusAnnouncement(t("savedQuerySavedAnnouncement", {name: trimmed}));
    };

    return (
        <Popover
            open={open}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{vertical: "bottom", horizontal: "left"}}
            transformOrigin={{vertical: "top", horizontal: "left"}}
            slotProps={{
                paper: {
                    "aria-labelledby": headingId,
                    "data-testid": "saved-queries-popover",
                    sx: {
                        p: 1.5,
                        width: 340,
                        maxWidth: "calc(100vw - 24px)",
                        maxBlockSize: "min(520px, calc(100dvh - 32px))",
                        overflowY: "auto",
                    },
                } as Record<string, unknown>,
            }}
        >
            <Box
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="visually-hidden"
            >
                {statusAnnouncement}
            </Box>

            <Stack spacing={1.25}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={0.75} alignItems="center">
                        <Typography id={headingId} variant="subtitle2" sx={{fontWeight: 700}}>
                            {t("savedQueriesLabel")}
                        </Typography>
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            data-testid="saved-queries-count-badge"
                            sx={{fontVariantNumeric: "tabular-nums"}}
                        >
                            {`(${t("savedQueriesCountBadge", {
                                count: bookmarks.length,
                                max: MAX_SAVED_EVENT_QUERIES,
                            })})`}
                        </Typography>
                    </Stack>
                    <IconButton
                        type="button"
                        size="small"
                        onClick={onClose}
                        aria-label={t("cancel")}
                    >
                        <CloseRoundedIcon fontSize="small" aria-hidden="true" />
                    </IconButton>
                </Stack>

                {hasActiveQuery && bookmarks.length >= MAX_SAVED_EVENT_QUERIES && (
                    <Typography
                        variant="caption"
                        color="warning.main"
                        role="status"
                        data-testid="saved-queries-cap-note"
                        sx={{textWrap: "pretty"}}
                    >
                        {t("savedQueriesLimitReplaceNotice", {max: MAX_SAVED_EVENT_QUERIES})}
                    </Typography>
                )}

                {hasActiveQuery && (
                    <Box component="form" onSubmit={handleSaveSubmit} noValidate>
                        <Stack spacing={0.75}>
                            <TextField
                                id={nameInputId}
                                size="small"
                                fullWidth
                                label={t("savedQueryNameLabel")}
                                value={bookmarkName}
                                onChange={event => {
                                    setBookmarkName(event.target.value);
                                    if (nameError && event.target.value.trim().length > 0) {
                                        setNameError(null);
                                    }
                                }}
                                onBlur={() => {
                                    if (bookmarkName.length > 0 && bookmarkName.trim().length === 0) {
                                        setNameError(t("savedQueryNameRequired"));
                                    }
                                }}
                                onKeyDown={event => {
                                    if (event.key === "Enter" && event.nativeEvent.isComposing) {
                                        event.preventDefault();
                                    }
                                }}
                                error={Boolean(nameError)}
                                helperText={nameError ?? undefined}
                                FormHelperTextProps={nameError ? {id: nameErrorId} : undefined}
                                inputProps={{
                                    maxLength: MAX_BOOKMARK_NAME_LENGTH,
                                    "aria-invalid": Boolean(nameError),
                                    "aria-describedby": nameError ? nameErrorId : undefined,
                                    "data-testid": "saved-query-name-input",
                                }}
                            />
                            <Button
                                type="submit"
                                size="small"
                                variant="contained"
                                startIcon={<BookmarkAddOutlinedIcon fontSize="small" aria-hidden="true" />}
                                data-testid="confirm-save-event-query-btn"
                                sx={{textTransform: "none", alignSelf: "flex-start"}}
                            >
                                {t("saveCurrentQueryButton")}
                            </Button>
                        </Stack>
                    </Box>
                )}

                {hasActiveQuery && bookmarks.length > 0 && <Divider />}

                {bookmarks.length > 0 ? (
                    <Stack spacing={0.5}>
                        {bookmarks.map(bookmark => (
                            <Stack
                                key={bookmark.id}
                                direction="row"
                                alignItems="center"
                                spacing={0.5}
                                sx={{
                                    px: 0.75,
                                    py: 0.4,
                                    borderRadius: 1,
                                    border: "1px solid",
                                    borderColor: "divider",
                                    bgcolor: "action.hover",
                                }}
                            >
                                <Button
                                    type="button"
                                    size="small"
                                    onClick={() => {
                                        onApplyBookmark(bookmark.criteria);
                                        onClose();
                                    }}
                                    data-testid="saved-query-bookmark-btn"
                                    sx={{
                                        flex: 1,
                                        justifyContent: "flex-start",
                                        textAlign: "left",
                                        textTransform: "none",
                                        minWidth: 0,
                                        py: 0.25,
                                    }}
                                >
                                    <Box sx={{minWidth: 0, overflow: "hidden"}}>
                                        <Typography variant="body2" noWrap sx={{fontWeight: 600}}>
                                            {bookmark.name}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" noWrap display="block">
                                            {summarizeEventLogQuery(bookmark.criteria, t)}
                                        </Typography>
                                    </Box>
                                </Button>
                                <IconButton
                                    type="button"
                                    size="small"
                                    onClick={() => {
                                        onDeleteBookmark(bookmark.id);
                                        setStatusAnnouncement(t("savedQueryDeletedAnnouncement", {name: bookmark.name}));
                                    }}
                                    aria-label={t("deleteSavedQuery", {name: bookmark.name})}
                                    data-testid="delete-saved-query-btn"
                                >
                                    <CloseRoundedIcon sx={{fontSize: 16}} aria-hidden="true" />
                                </IconButton>
                            </Stack>
                        ))}
                    </Stack>
                ) : !hasActiveQuery ? (
                    <Typography variant="body2" color="text.secondary">
                        {t("savedQueriesEmptyHint")}
                    </Typography>
                ) : null}
            </Stack>
        </Popover>
    );
}
