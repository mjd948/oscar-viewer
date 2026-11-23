"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import FolderSharedRoundedIcon from '@mui/icons-material/FolderSharedRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import { Locale, useLanguage } from '@/app/contexts/LanguageContext';
import { INode } from '@/lib/data/osh/Node';
import {
    extractUffUuidFromOmniboxInput,
    fetchCargoUffEntryBlobUrl,
    searchCargoUff,
    UffSearchMatch,
} from '@/lib/data/oscar/CargoUffApi';

export interface CargoUffSmbPickerDialogProps {
    open: boolean;
    onClose: () => void;
    node?: INode | null;
    alarmTimestampIso?: string | null;
    initialVehicleId?: string | null;
    onInspectUff: (uffUuid: string) => void;
    onLinkUff: (uffUuid: string) => Promise<void> | void;
    linkingUuid?: string | null;
}

interface PickerCopy {
    title: string;
    subtitle: string;
    omniboxLabel: string;
    omniboxHint: string;
    scannerLabel: string;
    allScanners: string;
    windowLabel: string;
    win30m: string;
    win2h: string;
    win24h: string;
    winAll: string;
    searchBtn: string;
    clearBtn: string;
    noMatches: string;
    inspectBtn: string;
    linkBtn: string;
    linkingLabel: string;
    closeBtn: string;
    fuzzyBadge: string;
    sparseBadge: string;
}

const PICKER_COPY: Record<Locale, PickerCopy> = {
    en: {
        title: 'Browse & Link Cargo NII Scan (SMB / WCO UFF)',
        subtitle:
            'Paste a UFF UUID, .uff filename, or share path for unlabelled scans, or browse by portal scanner folder, Container/Plate ID, and alarm time window.',
        omniboxLabel: 'UFF UUID, .uff Filename, Share Path, or Container / Plate ID',
        omniboxHint: 'Examples: 67c041a5-3500-415a-b571-1e805de813f5.uff, Z:\\2026\\11\\20\\..., or MSMU6484193',
        scannerLabel: 'Scanner / Portal',
        allScanners: 'All Scanners',
        windowLabel: 'Alarm Time Window',
        win30m: '±30 min of Alarm',
        win2h: '±2 hours of Alarm',
        win24h: '±24 hours of Alarm',
        winAll: 'All Indexed Scans',
        searchBtn: 'Find Scans',
        clearBtn: 'Clear',
        noMatches: 'No Cargo UFF packages matched the current filter.',
        inspectBtn: 'Inspect X-Ray',
        linkBtn: 'Link to Adjudication',
        linkingLabel: 'Linking...',
        closeBtn: 'Close',
        fuzzyBadge: '1-Char OCR Match',
        sparseBadge: 'No OCR / Unlabelled',
    },
    es: {
        title: 'Explorar y vincular escaneo NII de carga (SMB / WCO UFF)',
        subtitle:
            'Pegue un UUID UFF, nombre .uff o ruta de red para escaneos sin OCR, o filtre por escáner, ID de contenedor/placa y ventana temporal.',
        omniboxLabel: 'UUID UFF, archivo .uff, ruta SMB o ID de contenedor / placa',
        omniboxHint: 'Ejemplos: 67c041a5-3500-415a-b571-1e805de813f5.uff o MSMU6484193',
        scannerLabel: 'Escáner / Portal',
        allScanners: 'Todos los escáneres',
        windowLabel: 'Ventana temporal',
        win30m: '±30 min de la alarma',
        win2h: '±2 horas de la alarma',
        win24h: '±24 horas de la alarma',
        winAll: 'Todos los escaneos',
        searchBtn: 'Buscar',
        clearBtn: 'Limpiar',
        noMatches: 'Ningún paquete UFF coincidió con el filtro actual.',
        inspectBtn: 'Inspeccionar rayos X',
        linkBtn: 'Vincular a adjudicación',
        linkingLabel: 'Vinculando...',
        closeBtn: 'Cerrar',
        fuzzyBadge: 'Coincidencia OCR ±1',
        sparseBadge: 'Sin OCR / Sin etiqueta',
    },
    fr: {
        title: 'Parcourir et lier un scan cargo NII (SMB / OMD UFF)',
        subtitle:
            'Collez un UUID UFF, un nom .uff ou un chemin réseau pour les scans sans OCR, ou filtrez par portique, ID conteneur/plaque et fenêtre temporelle.',
        omniboxLabel: 'UUID UFF, fichier .uff, chemin SMB ou ID conteneur / plaque',
        omniboxHint: 'Exemples : 67c041a5-3500-415a-b571-1e805de813f5.uff ou MSMU6484193',
        scannerLabel: 'Scanner / Portique',
        allScanners: 'Tous les scanners',
        windowLabel: 'Fenêtre temporelle',
        win30m: '±30 min de l’alarme',
        win2h: '±2 h de l’alarme',
        win24h: '±24 h de l’alarme',
        winAll: 'Tous les scans indexés',
        searchBtn: 'Rechercher',
        clearBtn: 'Effacer',
        noMatches: 'Aucun paquet UFF ne correspond aux critères sélectionnés.',
        inspectBtn: 'Inspecter rayons X',
        linkBtn: 'Lier à l’adjudication',
        linkingLabel: 'Liaison...',
        closeBtn: 'Fermer',
        fuzzyBadge: 'Tolérance OCR ±1',
        sparseBadge: 'Sans OCR',
    },
    el: {
        title: 'Αναζήτηση & Σύνδεση Σάρωσης Φορτίου NII (SMB / WCO UFF)',
        subtitle:
            'Επικολλήστε UUID UFF, όνομα αρχείου .uff ή διαδρομή SMB, ή φιλτράρετε ανά σαρωτή, ID εμπορευματοκιβωτίου και χρονικό παράθυρο.',
        omniboxLabel: 'UUID UFF, αρχείο .uff, διαδρομή SMB ή ID οχήματος',
        omniboxHint: 'Παράδειγμα: 67c041a5-3500-415a-b571-1e805de813f5.uff ή MSMU6484193',
        scannerLabel: 'Σαρωτής / Πύλη',
        allScanners: 'Όλοι οι σαρωτές',
        windowLabel: 'Χρονικό παράθυρο',
        win30m: '±30 λεπτά',
        win2h: '±2 ώρες',
        win24h: '±24 ώρες',
        winAll: 'Όλες οι σαρώσεις',
        searchBtn: 'Αναζήτηση',
        clearBtn: 'Καθαρισμός',
        noMatches: 'Δεν βρέθηκαν πακέτα Cargo UFF για το τρέχον φίλτρο.',
        inspectBtn: 'Επιθεώρηση Ακτινογραφίας',
        linkBtn: 'Σύνδεση στην Κρίση',
        linkingLabel: 'Σύνδεση...',
        closeBtn: 'Κλείσιμο',
        fuzzyBadge: 'Προσέγγιση OCR ±1',
        sparseBadge: 'Χωρίς OCR',
    },
};

function formatDeltaLabel(deltaSec?: number | null): string {
    if (deltaSec == null || !Number.isFinite(deltaSec)) return '';
    const sign = deltaSec >= 0 ? '+' : '-';
    const abs = Math.abs(Math.round(deltaSec));
    if (abs < 60) return `${sign}${abs}s`;
    const mins = Math.floor(abs / 60);
    if (mins < 60) return `${sign}${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remM = mins % 60;
    return `${sign}${hrs}h ${remM}m`;
}

export default function CargoUffSmbPickerDialog({
    open,
    onClose,
    node,
    alarmTimestampIso,
    initialVehicleId,
    onInspectUff,
    onLinkUff,
    linkingUuid,
}: CargoUffSmbPickerDialogProps) {
    const { language } = useLanguage();
    const copy = PICKER_COPY[language] ?? PICKER_COPY.en;
    const titleId = useId();
    const inputId = useId();
    const hintId = useId();
    const scannerLabelId = useId();
    const winLabelId = useId();

    const [queryText, setQueryText] = useState('');
    const [scannerFilter, setScannerFilter] = useState('');
    const [windowMin, setWindowMin] = useState<number>(0); // default All Indexed so historical + live lab shares immediately show results
    const [scanners, setScanners] = useState<string[]>([]);
    const [matches, setMatches] = useState<UffSearchMatch[]>([]);
    const [thumbs, setThumbs] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const thumbUrlsRef = useRef<string[]>([]);

    const runSearch = useCallback(
        async (overrideQuery?: string, overrideScanner?: string, overrideWin?: number) => {
            const q = (overrideQuery ?? queryText).trim();
            const sc = overrideScanner ?? scannerFilter;
            const wm = overrideWin ?? windowMin;
            const extractedUuid = extractUffUuidFromOmniboxInput(q);

            setLoading(true);
            setErrorMsg(null);
            try {
                const res = await searchCargoUff(
                    {
                        uffId: extractedUuid ? q : undefined,
                        vehicleId: !extractedUuid && q ? q : undefined,
                        scannerId: sc || undefined,
                        nearTime: alarmTimestampIso || undefined,
                        windowMinutes: wm,
                        fuzzy: true,
                        limit: 48,
                    },
                    node,
                );
                setMatches(res.matches ?? []);
                if (Array.isArray(res.scanners)) {
                    setScanners(res.scanners);
                }
            } catch (err: any) {
                setErrorMsg(err?.message || 'Unable to query Cargo UFF share');
            } finally {
                setLoading(false);
            }
        },
        [queryText, scannerFilter, windowMin, alarmTimestampIso, node],
    );

    useEffect(() => {
        if (!open) {
            for (const u of thumbUrlsRef.current) {
                URL.revokeObjectURL(u);
            }
            thumbUrlsRef.current = [];
            setThumbs({});
            return;
        }
        const seedVeh = initialVehicleId?.trim() ?? '';
        setQueryText(seedVeh);
        void runSearch(seedVeh, '', 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Lazily load lightweight ~40 KB preview.jpg thumbnails for visible matches
    useEffect(() => {
        if (!open || matches.length === 0) return;
        let cancelled = false;
        const slice = matches.slice(0, 16);
        for (const m of slice) {
            if (!m.hasPreview || thumbs[m.uffUuid]) continue;
            fetchCargoUffEntryBlobUrl({ uffUuid: m.uffUuid, entry: 'preview.jpg', mimeType: 'image/jpeg' }, node)
                .then((url) => {
                    if (cancelled) {
                        URL.revokeObjectURL(url);
                        return;
                    }
                    thumbUrlsRef.current.push(url);
                    setThumbs((prev) => ({ ...prev, [m.uffUuid]: url }));
                })
                .catch(() => {});
        }
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, matches, node]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="lg"
            aria-labelledby={titleId}
            data-testid="cargo-uff-smb-picker-dialog"
        >
            <DialogTitle id={titleId} sx={{ pr: 6 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <FolderSharedRoundedIcon color="secondary" />
                    <Typography variant="h6" component="span" fontWeight={700}>
                        {copy.title}
                    </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    {copy.subtitle}
                </Typography>
                <IconButton
                    type="button"
                    aria-label={copy.closeBtn}
                    onClick={onClose}
                    sx={{ position: 'absolute', right: 8, top: 8 }}
                >
                    <CloseRoundedIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent dividers>
                <Box component="search" sx={{ mb: 2 }}>
                    <Box
                        component="form"
                        onSubmit={(e) => {
                            e.preventDefault();
                            void runSearch();
                        }}
                    >
                        <Stack spacing={1.25}>
                            <Typography id={hintId} variant="caption" color="text.secondary">
                                {copy.omniboxHint}
                            </Typography>
                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems={{ md: 'center' }}>
                                <TextField
                                    id={inputId}
                                    size="small"
                                    fullWidth
                                    sx={{ flex: '1 1 260px', minWidth: 200 }}
                                    label={copy.omniboxLabel}
                                    value={queryText}
                                    onChange={(e) => {
                                        setQueryText(e.target.value);
                                        if (errorMsg) setErrorMsg(null);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) {
                                            e.preventDefault();
                                        }
                                    }}
                                    inputProps={{
                                        autoCorrect: 'off',
                                        autoCapitalize: 'none',
                                        spellCheck: false,
                                        maxLength: 260,
                                        'aria-describedby': hintId,
                                        'data-testid': 'uff-smb-picker-search-input',
                                    }}
                                />

                                <FormControl size="small" sx={{ minWidth: 185 }}>
                                    <InputLabel id={scannerLabelId}>{copy.scannerLabel}</InputLabel>
                                    <Select
                                        labelId={scannerLabelId}
                                        label={copy.scannerLabel}
                                        value={scannerFilter}
                                        onChange={(e) => {
                                            const next = String(e.target.value);
                                            setScannerFilter(next);
                                            void runSearch(queryText, next, windowMin);
                                        }}
                                        data-testid="uff-smb-picker-scanner-select"
                                    >
                                        <MenuItem value="">{copy.allScanners}</MenuItem>
                                        {scanners.map((sc) => (
                                            <MenuItem key={sc} value={sc}>
                                                {sc}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <FormControl size="small" sx={{ minWidth: 180 }}>
                                    <InputLabel id={winLabelId}>{copy.windowLabel}</InputLabel>
                                    <Select
                                        labelId={winLabelId}
                                        label={copy.windowLabel}
                                        value={windowMin}
                                        onChange={(e) => {
                                            const next = Number(e.target.value);
                                            setWindowMin(next);
                                            void runSearch(queryText, scannerFilter, next);
                                        }}
                                        data-testid="uff-smb-picker-window-select"
                                    >
                                        <MenuItem value={30}>{copy.win30m}</MenuItem>
                                        <MenuItem value={120}>{copy.win2h}</MenuItem>
                                        <MenuItem value={1440}>{copy.win24h}</MenuItem>
                                        <MenuItem value={0}>{copy.winAll}</MenuItem>
                                    </Select>
                                </FormControl>

                                <Button
                                    type="submit"
                                    variant="contained"
                                    startIcon={<SearchRoundedIcon />}
                                    disabled={loading}
                                    sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                                    data-testid="uff-smb-picker-submit"
                                >
                                    {copy.searchBtn}
                                </Button>
                                {queryText && (
                                    <Button
                                        type="button"
                                        variant="outlined"
                                        startIcon={<ClearRoundedIcon />}
                                        sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                                        onClick={() => {
                                            setQueryText('');
                                            void runSearch('', scannerFilter, windowMin);
                                        }}
                                        data-testid="uff-smb-picker-clear"
                                    >
                                        {copy.clearBtn}
                                    </Button>
                                )}
                            </Stack>
                        </Stack>
                    </Box>
                </Box>

                {errorMsg && (
                    <Alert severity="error" role="alert" sx={{ mb: 2 }}>
                        {errorMsg}
                    </Alert>
                )}

                {loading ? (
                    <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" sx={{ py: 5 }}>
                        <CircularProgress size={22} />
                        <Typography variant="body2">Querying Cargo UFF share...</Typography>
                    </Stack>
                ) : matches.length === 0 ? (
                    <Alert severity="info" role="status" data-testid="uff-smb-picker-empty">
                        {copy.noMatches}
                    </Alert>
                ) : (
                    <Stack spacing={1.25} data-testid="uff-smb-picker-results">
                        {matches.map((m) => (
                            <Paper
                                key={m.uffUuid}
                                variant="outlined"
                                data-testid={`uff-smb-match-${m.uffUuid}`}
                                sx={{ p: 1.25 }}
                            >
                                <Stack
                                    direction={{ xs: 'column', md: 'row' }}
                                    spacing={1.5}
                                    alignItems={{ md: 'center' }}
                                    justifyContent="space-between"
                                >
                                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                                        {thumbs[m.uffUuid] ? (
                                            <img
                                                src={thumbs[m.uffUuid]}
                                                alt={`Cargo scan preview ${m.uffUuid}`}
                                                style={{
                                                    width: 148,
                                                    height: 44,
                                                    objectFit: 'cover',
                                                    borderRadius: 4,
                                                    border: '1px solid #cbd5e1',
                                                    flexShrink: 0,
                                                }}
                                            />
                                        ) : (
                                            <Box
                                                sx={{
                                                    width: 148,
                                                    height: 44,
                                                    bgcolor: 'action.hover',
                                                    borderRadius: 1,
                                                    flexShrink: 0,
                                                }}
                                            />
                                        )}

                                        <Box sx={{ minWidth: 0 }}>
                                            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                                                <Chip size="small" color="primary" label={`UFF ${m.uffVersion}`} />
                                                {m.scannerId && (
                                                    <Chip size="small" variant="outlined" label={m.scannerId} />
                                                )}
                                                {m.displayVehicleIds.length > 0 ? (
                                                    m.displayVehicleIds.map((vid) => (
                                                        <Chip key={vid} size="small" color="secondary" label={vid} />
                                                    ))
                                                ) : (
                                                    <Chip size="small" variant="outlined" label={copy.sparseBadge} />
                                                )}
                                                {m.fuzzyMatch && (
                                                    <Chip size="small" color="warning" label={copy.fuzzyBadge} />
                                                )}
                                                {m.hasManifestPdf && (
                                                    <Chip size="small" color="info" variant="outlined" label="Manifest PDF" />
                                                )}
                                                {m.hasRadiationN42 && (
                                                    <Chip size="small" color="success" variant="outlined" label="N42" />
                                                )}
                                                {m.timeDeltaSeconds != null && alarmTimestampIso && (
                                                    <Chip
                                                        size="small"
                                                        variant="outlined"
                                                        label={`Δt ${formatDeltaLabel(m.timeDeltaSeconds)}`}
                                                    />
                                                )}
                                            </Stack>
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                display="block"
                                                noWrap
                                                sx={{ fontFamily: 'monospace', mt: 0.4 }}
                                            >
                                                {m.uffUuid} · {m.scanTimestamp}
                                                {m.goodsDescription ? ` · HS ${m.hsCode}: ${m.goodsDescription}` : ''}
                                            </Typography>
                                        </Box>
                                    </Stack>

                                    <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                                        <Button
                                            type="button"
                                            size="small"
                                            variant="outlined"
                                            startIcon={<VisibilityRoundedIcon />}
                                            onClick={() => onInspectUff(m.uffUuid)}
                                            data-testid={`uff-smb-inspect-${m.uffUuid}`}
                                        >
                                            {copy.inspectBtn}
                                        </Button>
                                        <Button
                                            type="button"
                                            size="small"
                                            variant="contained"
                                            color="secondary"
                                            startIcon={<LinkRoundedIcon />}
                                            disabled={linkingUuid === m.uffUuid}
                                            onClick={() => onLinkUff(m.uffUuid)}
                                            data-testid={`uff-smb-link-${m.uffUuid}`}
                                        >
                                            {linkingUuid === m.uffUuid ? copy.linkingLabel : copy.linkBtn}
                                        </Button>
                                    </Stack>
                                </Stack>
                            </Paper>
                        ))}
                    </Stack>
                )}
            </DialogContent>

            <DialogActions>
                <Button type="button" onClick={onClose}>
                    {copy.closeBtn}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
