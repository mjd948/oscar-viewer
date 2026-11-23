"use client";

import * as React from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Chip,
    Divider,
    FormControlLabel,
    Grid,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import ExtensionRoundedIcon from '@mui/icons-material/ExtensionRounded';
import DocumentScannerRoundedIcon from '@mui/icons-material/DocumentScannerRounded';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import MemoryRoundedIcon from '@mui/icons-material/MemoryRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import FolderSharedRoundedIcon from '@mui/icons-material/FolderSharedRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import { Locale, useLanguage } from '@/app/contexts/LanguageContext';
import { fetchCurrentSession, OscarSessionInfo } from '@/lib/data/oscar/AuthSessionApi';
import {
    CargoUffConnectionTestResult,
    invalidateCargoUffActiveCache,
    testCargoUffConnection,
} from '@/lib/data/oscar/CargoUffApi';
import {
    downloadExtensionArtifact,
    ExtensionDomain,
    fetchRuntimeExtensionsStatus,
    RuntimeExtensionsFullStatus,
    submitRuntimeExtensionAction,
    uploadRuntimeExtensionWithProgress,
} from '@/lib/data/oscar/RuntimeExtensionsApi';
import './RuntimeExtensionsManager.css';

interface ExtUiCopy {
    pageTitle: string;
    pageSubtitle: string;
    adminRequired: string;
    upgradeSafeNote: string;
    tablistLabel: string;
    refreshBtn: string;
    shippedDefaultBadge: string;
    customOverrideBadge: string;
    notLoadedBadge: string;
    resetToDefaultBtn: string;
    uploadBtn: string;
    uploadingLabel: string;
    cancelBtn: string;
    confirmResetTitle: string;
    confirmResetBody: string;
    confirmResetAction: string;
    tabs: Record<ExtensionDomain, string>;
}

const EXT_COPY: Record<Locale, ExtUiCopy> = {
    en: {
        pageTitle: 'Pluggable Runtime Extensions & Regional Packs',
        pageSubtitle:
            'Ship ready-to-use built-in defaults out of the box while allowing air-gapped sites to hot-swap OCR models, offline .pmtiles regional basemaps, secondary spectroscopy libraries, enterprise CA certificates, disposition policy packs, and EML plugins.',
        adminRequired: 'Administrator privileges are required to manage runtime extensions and regional packs.',
        upgradeSafeNote:
            'Upgrade-Safe Guarantee: All uploaded packs and certificates are stored in persistent state volumes (/var/lib/oscar/extensions/ including /var/lib/oscar/extensions/maps-storage/) and are never overwritten during OSCAR version upgrades. Resetting any tab immediately restores OSCAR’s shipped built-in default.',
        tablistLabel: 'Runtime extension categories',
        refreshBtn: 'Refresh Status',
        shippedDefaultBadge: 'SHIPPED DEFAULT ACTIVE',
        customOverrideBadge: 'CUSTOM OVERRIDE (UPGRADE-SAFE)',
        notLoadedBadge: 'OPTIONAL (NOT LOADED)',
        resetToDefaultBtn: 'Reset to Shipped Default',
        uploadBtn: 'Select Package to Upload',
        uploadingLabel: 'Uploading & validating extension package',
        cancelBtn: 'Cancel',
        confirmResetTitle: 'Restore Shipped Built-In Default?',
        confirmResetBody:
            'OSCAR will immediately revert this capability to its shipped built-in default with zero portal downtime.',
        confirmResetAction: 'Restore Default',
        tabs: {
            ocr: 'OCR Models & Engines',
            maps: 'Offline Maps (.pmtiles)',
            spectroscopy: 'Spectroscopy / Nuclide ID',
            'trusted-certs': 'Trusted CA Certificates',
            'policy-packs': 'Adjudication Policy Packs',
            eml: 'EML Alarm Assessment',
            uff: 'Cargo NII (WCO UFF)',
        },
    },
    es: {
        pageTitle: 'Extensiones de ejecución y paquetes regionales',
        pageSubtitle:
            'Incluye valores predeterminados listos para usar y permite actualizar modelos OCR, mapas sin conexión .pmtiles, bibliotecas de espectroscopia, certificados CA empresariales, políticas de adjudicación y complementos EML.',
        adminRequired: 'Se requieren privilegios de administrador para gestionar las extensiones del sistema.',
        upgradeSafeNote:
            'Garantía ante actualizaciones: Todos los paquetes cargados se conservan en volúmenes persistentes y nunca se sobrescriben al actualizar OSCAR. Restablecer cualquier pestaña restaura de inmediato el valor predeterminado integrado.',
        tablistLabel: 'Categorías de extensiones de ejecución',
        refreshBtn: 'Actualizar estado',
        shippedDefaultBadge: 'PREDETERMINADO INTEGRADO ACTIVO',
        customOverrideBadge: 'PERSONALIZADO ACTIVO (PERSISTENTE)',
        notLoadedBadge: 'OPCIONAL (NO CARGADO)',
        resetToDefaultBtn: 'Restaurar predeterminado integrado',
        uploadBtn: 'Seleccionar paquete para cargar',
        uploadingLabel: 'Cargando y validando paquete de extensión',
        cancelBtn: 'Cancelar',
        confirmResetTitle: '¿Restaurar el valor predeterminado integrado?',
        confirmResetBody:
            'OSCAR restaurará de inmediato esta función a su configuración predeterminada integrada sin tiempo de inactividad.',
        confirmResetAction: 'Restaurar predeterminado',
        tabs: {
            ocr: 'Modelos y motores OCR',
            maps: 'Mapas sin conexión (.pmtiles)',
            spectroscopy: 'Espectroscopia / Isótopos',
            'trusted-certs': 'Certificados CA de confianza',
            'policy-packs': 'Paquetes de códigos de adjudicación',
            eml: 'Evaluación de alarmas EML',
            uff: 'Carga NII (WCO UFF)',
        },
    },
    fr: {
        pageTitle: 'Extensions d’exécution et packs régionaux',
        pageSubtitle:
            'Fournit des solutions intégrées prêtes à l’emploi tout en permettant le remplacement à chaud des modèles OCR, fonds de carte .pmtiles hors ligne, bibliothèques spectroscopiques, certificats CA, politiques d’adjudication et modules EML.',
        adminRequired: 'Les privilèges administrateur sont requis pour gérer les extensions système.',
        upgradeSafeNote:
            'Protection lors des mises à niveau : Les extensions téléversées sont stockées dans les volumes persistants et ne sont jamais écrasées lors des mises à niveau d’OSCAR. La réinitialisation rétablit immédiatement la configuration intégrée.',
        tablistLabel: 'Catégories d’extensions d’exécution',
        refreshBtn: 'Actualiser l’état',
        shippedDefaultBadge: 'DÉFAUT INTÉGRÉ ACTIF',
        customOverrideBadge: 'PERSONNALISÉ ACTIF (PERSISTANT)',
        notLoadedBadge: 'OPTIONNEL (NON CHARGÉ)',
        resetToDefaultBtn: 'Rétablir le défaut intégré',
        uploadBtn: 'Choisir un paquet à téléverser',
        uploadingLabel: 'Téléversement et validation en cours',
        cancelBtn: 'Annuler',
        confirmResetTitle: 'Rétablir la solution intégrée par défaut ?',
        confirmResetBody:
            'OSCAR rétablira immédiatement la configuration par défaut intégrée sans aucune interruption du portail.',
        confirmResetAction: 'Rétablir le défaut',
        tabs: {
            ocr: 'Modèles et moteurs OCR',
            maps: 'Cartes hors ligne (.pmtiles)',
            spectroscopy: 'Spectroscopie / Nucléides',
            'trusted-certs': 'Certificats CA approuvés',
            'policy-packs': 'Packs de codes d’adjudication',
            eml: 'Évaluation d’alarme EML',
            uff: 'Fret NII (OMD UFF)',
        },
    },
    el: {
        pageTitle: 'Επεκτάσεις εκτέλεσης και τοπικά πακέτα',
        pageSubtitle:
            'Περιλαμβάνει έτοιμες προεπιλογές εκκίνησης ενώ επιτρέπει την άμεση αντικατάσταση μοντέλων OCR, χαρτών .pmtiles εκτός σύνδεσης, βιβλιοθηκών φασματοσκοπίας, πιστοποιητικών CA, πακέτων κωδίκων κρίσης και προσθέτων EML.',
        adminRequired: 'Απαιτούνται δικαιώματα διαχειριστή για τη διαχείριση επεκτάσεων.',
        upgradeSafeNote:
            'Εγγύηση αναβάθμισης: Όλα τα μεταφορτωμένα πακέτα αποθηκεύονται σε μόνιμους τόμους και δεν αντικαθίστανται ποτέ κατά τις αναβαθμίσεις του OSCAR. Η επαναφορά αποκαθιστά αμέσως την ενσωματωμένη προεπιλογή.',
        tablistLabel: 'Κατηγορίες επεκτάσεων εκτέλεσης',
        refreshBtn: 'Ανανέωση κατάστασης',
        shippedDefaultBadge: 'ΕΝΣΩΜΑΤΩΜΕΝΗ ΠΡΟΕΠΙΛΟΓΗ ΕΝΕΡΓΗ',
        customOverrideBadge: 'ΠΡΟΣΑΡΜΟΣΜΕΝΟ ΕΝΕΡΓΟ (ΜΟΝΙΜΟ)',
        notLoadedBadge: 'ΠΡΟΑΙΡΕΤΙΚΟ (ΜΗ ΦΟΡΤΩΜΕΝΟ)',
        resetToDefaultBtn: 'Επαναφορά ενσωματωμένης προεπιλογής',
        uploadBtn: 'Επιλογή πακέτου για μεταφόρτωση',
        uploadingLabel: 'Μεταφόρτωση και επαλήθευση πακέτου',
        cancelBtn: 'Ακύρωση',
        confirmResetTitle: 'Επαναφορά ενσωματωμένης προεπιλογής;',
        confirmResetBody:
            'Το OSCAR θα επαναφέρει αμέσως αυτή τη λειτουργία στην ενσωματωμένη προεπιλογή χωρίς διακοπή λειτουργίας.',
        confirmResetAction: 'Επαναφορά προεπιλογής',
        tabs: {
            ocr: 'Μοντέλα & μηχανές OCR',
            maps: 'Χάρτες εκτός σύνδεσης (.pmtiles)',
            spectroscopy: 'Φασματοσκοπία / Ισότοπα',
            'trusted-certs': 'Έμπιστα πιστοποιητικά CA',
            'policy-packs': 'Πακέτα κωδίκων κρίσης',
            eml: 'Αξιολόγηση συναγερμών EML',
            uff: 'Φορτίο NII (WCO UFF)',
        },
    },
};

const TAB_ORDER: ExtensionDomain[] = [
    'ocr',
    'maps',
    'spectroscopy',
    'trusted-certs',
    'policy-packs',
    'eml',
    'uff',
];

function formatBytes(bytes?: number): string {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let idx = 0;
    let val = bytes;
    while (val >= 1024 && idx < units.length - 1) {
        val /= 1024;
        idx++;
    }
    return `${val.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
}

function splitFileStemAndExt(name: string): { stem: string; ext: string } {
    if (!name) return { stem: '', ext: '' };
    const lower = name.toLowerCase();
    if (lower.endsWith('.tar.gz')) {
        return { stem: name.slice(0, -7), ext: name.slice(-7) };
    }
    const dot = name.lastIndexOf('.');
    if (dot <= 0) return { stem: name, ext: '' };
    return { stem: name.slice(0, dot), ext: name.slice(dot) };
}

function FilenameDisplay({ value }: { value: string }) {
    const { stem, ext } = splitFileStemAndExt(value);
    return (
        <span className="oscar-ext-filename">
            <span>{stem}</span>
            {ext}
        </span>
    );
}

interface PendingConfirmAction {
    domain: ExtensionDomain;
    payload: Record<string, unknown>;
    title: string;
    body: string;
    confirmLabel: string;
}

export default function RuntimeExtensionsManager() {
    const { language } = useLanguage();
    const copy = EXT_COPY[language] ?? EXT_COPY.en;

    const baseId = React.useId();
    const progressId = `${baseId}-upload-progress`;
    const dialogTitleId = `${baseId}-confirm-title`;

    const [session, setSession] = React.useState<OscarSessionInfo | null>(null);
    const [status, setStatus] = React.useState<RuntimeExtensionsFullStatus | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [activeTab, setActiveTab] = React.useState<ExtensionDomain>('ocr');
    const [uploading, setUploading] = React.useState(false);
    const [uploadPercent, setUploadPercent] = React.useState<number | null>(null);
    const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
    const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
    const [dragOverDomain, setDragOverDomain] = React.useState<ExtensionDomain | null>(null);

    // Map-specific form inputs
    const [mapDisplayName, setMapDisplayName] = React.useState('');
    const [mapDefaultChecked, setMapDefaultChecked] = React.useState(true);

    // Spectroscopy execution mode
    const [specMode, setSpecMode] = React.useState<'fallback' | 'override'>('fallback');

    // Cargo NII (WCO UFF) SMB / Local share form state
    const [uffEnabled, setUffEnabled] = React.useState(false);
    const [uffSourceType, setUffSourceType] = React.useState<'smb' | 'local'>('smb');
    const [uffShareUrl, setUffShareUrl] = React.useState('');
    const [uffSubPath, setUffSubPath] = React.useState('');
    const [uffLocalPath, setUffLocalPath] = React.useState('');
    const [uffDomain, setUffDomain] = React.useState('');
    const [uffUsername, setUffUsername] = React.useState('');
    const [uffPassword, setUffPassword] = React.useState('');
    const [showUffPassword, setShowUffPassword] = React.useState(false);
    const [uffWindowMin, setUffWindowMin] = React.useState(60);
    const [uffFuzzyOcr, setUffFuzzyOcr] = React.useState(true);
    const [uffTesting, setUffTesting] = React.useState(false);
    const [uffSaving, setUffSaving] = React.useState(false);
    const [uffTestResult, setUffTestResult] = React.useState<CargoUffConnectionTestResult | null>(null);

    const tabRefs = React.useRef<Record<ExtensionDomain, HTMLButtonElement | null>>({
        ocr: null,
        maps: null,
        spectroscopy: null,
        'trusted-certs': null,
        'policy-packs': null,
        eml: null,
        uff: null,
    });
    const panelRefs = React.useRef<Record<ExtensionDomain, HTMLDivElement | null>>({
        ocr: null,
        maps: null,
        spectroscopy: null,
        'trusted-certs': null,
        'policy-packs': null,
        eml: null,
        uff: null,
    });
    const fileInputRefs = React.useRef<Record<ExtensionDomain, HTMLInputElement | null>>({
        ocr: null,
        maps: null,
        spectroscopy: null,
        'trusted-certs': null,
        'policy-packs': null,
        eml: null,
        uff: null,
    });

    const dialogRef = React.useRef<HTMLDialogElement | null>(null);
    const pendingConfirmRef = React.useRef<PendingConfirmAction | null>(null);
    const [pendingConfirm, setPendingConfirm] = React.useState<PendingConfirmAction | null>(null);

    const loadAll = React.useCallback(async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            const sess = await fetchCurrentSession();
            setSession(sess);
            if (sess && sess.isAdmin === false) {
                setLoading(false);
                return;
            }
            const full = await fetchRuntimeExtensionsStatus();
            setStatus(full);
            if (full.spectroscopy?.executionMode === 'override') {
                setSpecMode('override');
            } else {
                setSpecMode('fallback');
            }
            if (full.uff) {
                setUffEnabled(Boolean(full.uff.enabled));
                setUffSourceType(full.uff.sourceType === 'local' ? 'local' : 'smb');
                setUffShareUrl(full.uff.shareUrl || '');
                setUffSubPath(full.uff.subPath || '');
                setUffLocalPath(full.uff.localPath || '');
                setUffDomain(full.uff.domain || '');
                setUffUsername(full.uff.username || '');
                setUffPassword('');
                setUffWindowMin(full.uff.correlationWindowMinutes || 60);
                setUffFuzzyOcr(full.uff.allowFuzzyOcrMatch !== false);
            }
        } catch (err: any) {
            setErrorMsg(err?.message || 'Unable to load runtime extensions status');
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void loadAll();
    }, [loadAll]);

    // Sync tab selection when find-in-page reveals a hidden="until-found" panel (modern-web-guidance: tabs)
    React.useEffect(() => {
        const cleanups: Array<() => void> = [];
        for (const domain of TAB_ORDER) {
            const el = panelRefs.current[domain];
            if (!el) continue;
            const onBeforeMatch = () => {
                setActiveTab(domain);
            };
            el.addEventListener('beforematch', onBeforeMatch);
            cleanups.push(() => el.removeEventListener('beforematch', onBeforeMatch));
        }
        return () => cleanups.forEach((fn) => fn());
    }, [status]);

    const selectTab = (domain: ExtensionDomain, moveFocus = false) => {
        setActiveTab(domain);
        setErrorMsg(null);
        setSuccessMsg(null);
        const btn = tabRefs.current[domain];
        if (btn) {
            if (moveFocus) {
                btn.focus();
            }
            try {
                btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            } catch {
                // ignore in older test environments
            }
        }
    };

    const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
        let nextIdx: number | null = null;
        if (e.key === 'ArrowRight') {
            nextIdx = (idx + 1) % TAB_ORDER.length;
        } else if (e.key === 'ArrowLeft') {
            nextIdx = (idx - 1 + TAB_ORDER.length) % TAB_ORDER.length;
        } else if (e.key === 'Home') {
            nextIdx = 0;
        } else if (e.key === 'End') {
            nextIdx = TAB_ORDER.length - 1;
        }
        if (nextIdx !== null) {
            e.preventDefault();
            selectTab(TAB_ORDER[nextIdx], true);
        }
    };

    const openConfirmDialog = (action: PendingConfirmAction) => {
        pendingConfirmRef.current = action;
        setPendingConfirm(action);
        const dlg = dialogRef.current;
        if (dlg && typeof dlg.showModal === 'function' && !dlg.open) {
            dlg.returnValue = '';
            dlg.showModal();
        }
    };

    const handleDialogClose = async () => {
        const dlg = dialogRef.current;
        const choice = dlg?.returnValue || '';
        if (dlg) {
            dlg.returnValue = '';
        }
        const action = pendingConfirmRef.current;
        pendingConfirmRef.current = null;
        setPendingConfirm(null);
        if (choice !== 'confirm' || !action) {
            return;
        }
        setErrorMsg(null);
        setSuccessMsg(null);
        try {
            const updated = await submitRuntimeExtensionAction(action.domain, action.payload);
            setStatus(updated);
            setSuccessMsg(`${copy.tabs[action.domain]}: updated.`);
        } catch (err: any) {
            setErrorMsg(err?.message || 'Action failed');
        }
    };

    const handleFileUpload = async (domain: ExtensionDomain, file: File | null | undefined) => {
        if (!file) return;
        setUploading(true);
        setUploadPercent(0);
        setErrorMsg(null);
        setSuccessMsg(null);
        try {
            const extra: Record<string, string> = {};
            if (domain === 'maps') {
                if (mapDisplayName.trim()) {
                    extra.displayName = mapDisplayName.trim();
                }
                extra.defaultBasemap = mapDefaultChecked ? 'true' : 'false';
            } else if (domain === 'spectroscopy') {
                extra.executionMode = specMode;
            }
            const updated = await uploadRuntimeExtensionWithProgress(domain, file, extra, (pct) => {
                setUploadPercent(pct);
            });
            setStatus(updated);
            setMapDisplayName('');
            setSuccessMsg(`Activated "${file.name}" for ${copy.tabs[domain]}.`);
        } catch (err: any) {
            setErrorMsg(err?.message || 'Package validation or upload failed');
        } finally {
            setUploading(false);
            setUploadPercent(null);
            const inp = fileInputRefs.current[domain];
            if (inp) inp.value = '';
        }
    };

    const renderSourceChip = (customActive: boolean, optionalUnloaded = false) => {
        if (customActive) {
            return (
                <Chip
                    icon={<ExtensionRoundedIcon />}
                    label={copy.customOverrideBadge}
                    color="primary"
                    size="small"
                    data-testid="ext-source-chip-custom"
                />
            );
        }
        if (optionalUnloaded) {
            return (
                <Chip
                    label={copy.notLoadedBadge}
                    variant="outlined"
                    size="small"
                    data-testid="ext-source-chip-unloaded"
                />
            );
        }
        return (
            <Chip
                icon={<CheckCircleRoundedIcon />}
                label={copy.shippedDefaultBadge}
                color="success"
                variant="outlined"
                size="small"
                data-testid="ext-source-chip-builtin"
            />
        );
    };

    const renderDropzone = (domain: ExtensionDomain, accept: string, hintText: string) => {
        const inputId = `${baseId}-file-${domain}`;
        return (
            <div
                className="oscar-ext-dropzone"
                data-dragover={dragOverDomain === domain ? 'true' : 'false'}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverDomain(domain);
                }}
                onDragLeave={() => setDragOverDomain(null)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragOverDomain(null);
                    const f = e.dataTransfer?.files?.[0];
                    if (f) void handleFileUpload(domain, f);
                }}
            >
                <input
                    ref={(el) => {
                        fileInputRefs.current[domain] = el;
                    }}
                    id={inputId}
                    type="file"
                    accept={accept}
                    hidden
                    onChange={(e) => void handleFileUpload(domain, e.target.files?.[0])}
                />
                <Stack spacing={1.25} alignItems="center">
                    <CloudUploadRoundedIcon color="primary" fontSize="large" aria-hidden="true" />
                    <Typography variant="body2" color="text.secondary">
                        {hintText}
                    </Typography>
                    <Button
                        variant="contained"
                        type="button"
                        disabled={uploading}
                        onClick={() => fileInputRefs.current[domain]?.click()}
                        data-testid={`ext-upload-btn-${domain}`}
                    >
                        {copy.uploadBtn}
                    </Button>
                </Stack>
            </div>
        );
    };

    const tabIcon = (domain: ExtensionDomain) => {
        switch (domain) {
            case 'ocr':
                return <DocumentScannerRoundedIcon fontSize="small" aria-hidden="true" />;
            case 'maps':
                return <MapRoundedIcon fontSize="small" aria-hidden="true" />;
            case 'spectroscopy':
                return <ScienceRoundedIcon fontSize="small" aria-hidden="true" />;
            case 'trusted-certs':
                return <SecurityRoundedIcon fontSize="small" aria-hidden="true" />;
            case 'policy-packs':
                return <FactCheckRoundedIcon fontSize="small" aria-hidden="true" />;
            case 'eml':
                return <MemoryRoundedIcon fontSize="small" aria-hidden="true" />;
            case 'uff':
                return <FolderSharedRoundedIcon fontSize="small" aria-hidden="true" />;
        }
    };

    if (session && session.isAdmin === false) {
        return (
            <main className="oscar-ext-page">
                <Alert severity="warning" data-testid="ext-admin-required-alert">
                    {copy.adminRequired}
                </Alert>
            </main>
        );
    }

    return (
        <main className="oscar-ext-page" data-testid="runtime-extensions-page">
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                spacing={2}
                sx={{ mb: 2 }}
            >
                <Box sx={{ minInlineSize: 0 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <ExtensionRoundedIcon color="primary" aria-hidden="true" sx={{ fontSize: 34, flexShrink: 0 }} />
                        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
                            {copy.pageTitle}
                        </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {copy.pageSubtitle}
                    </Typography>
                </Box>
                <Button
                    variant="outlined"
                    type="button"
                    startIcon={<RefreshRoundedIcon />}
                    onClick={() => void loadAll()}
                    disabled={loading || uploading}
                    data-testid="ext-refresh-btn"
                >
                    {copy.refreshBtn}
                </Button>
            </Stack>

            <Alert severity="info" sx={{ mb: 2.5 }}>
                {copy.upgradeSafeNote}
            </Alert>

            {uploading && (
                <Box sx={{ mb: 2 }}>
                    <label htmlFor={progressId} style={{ display: 'block', fontSize: '0.875rem', marginBottom: 6 }}>
                        {copy.uploadingLabel}
                        {uploadPercent !== null ? ` (${uploadPercent}%)` : ''}
                    </label>
                    <progress
                        id={progressId}
                        className="oscar-ext-progress"
                        max={100}
                        {...(uploadPercent !== null ? { value: uploadPercent } : {})}
                    />
                </Box>
            )}

            {errorMsg && (
                <Alert severity="error" role="alert" sx={{ mb: 2 }} onClose={() => setErrorMsg(null)}>
                    {errorMsg}
                </Alert>
            )}

            <div role="status" aria-live="polite">
                {successMsg && (
                    <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg(null)}>
                        {successMsg}
                    </Alert>
                )}
            </div>

            <div role="tablist" aria-label={copy.tablistLabel} className="oscar-ext-tablist">
                {TAB_ORDER.map((domain, idx) => {
                    const selected = activeTab === domain;
                    return (
                        <button
                            key={domain}
                            ref={(el) => {
                                tabRefs.current[domain] = el;
                            }}
                            id={`${baseId}-tab-${domain}`}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            tabIndex={selected ? 0 : -1}
                            className="oscar-ext-tab"
                            onClick={() => selectTab(domain, false)}
                            onKeyDown={(e) => handleTabKeyDown(e, idx)}
                            data-testid={`ext-tab-${domain}`}
                        >
                            {tabIcon(domain)}
                            <span>{copy.tabs[domain]}</span>
                        </button>
                    );
                })}
            </div>

            {status && (
                <>
                    {/* 1. OCR Models & Engines */}
                    <div
                        ref={(el) => {
                            panelRefs.current.ocr = el;
                        }}
                        id={`${baseId}-panel-ocr`}
                        role="tabpanel"
                        aria-labelledby={`${baseId}-tab-ocr`}
                        className="oscar-ext-tabpanel"
                        {...(activeTab !== 'ocr' ? ({ hidden: 'until-found' } as any) : {})}
                    >
                        <div className="oscar-ext-panel-inner">
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                                                <Typography variant="h6" component="h2">
                                                    Active OCR Engine &amp; Plate Rules
                                                </Typography>
                                                {renderSourceChip(status.ocr.customActive)}
                                            </Stack>
                                            <Divider sx={{ mb: 1.5 }} />
                                            <Stack spacing={1}>
                                                <Typography variant="body2">
                                                    <strong>Engine:</strong> {status.ocr.engineId} (v{status.ocr.versionId})
                                                </Typography>
                                                <Typography variant="body2">
                                                    <strong>Package:</strong> <FilenameDisplay value={status.ocr.fileName} />
                                                </Typography>
                                                <Typography variant="body2">
                                                    <strong>Plate Filter Rules:</strong> {status.ocr.plateRuleDescription} (<code>{status.ocr.plateRuleSetId}</code>)
                                                </Typography>
                                                <Typography variant="body2">
                                                    <strong>Fast Oriented ROI + PARSeq Pass:</strong>{' '}
                                                    {status.ocr.fastRoiSupported ? 'Enabled' : 'Standard DBNet Only'}
                                                </Typography>
                                                {status.ocr.modelFiles?.length > 0 && (
                                                    <Typography variant="body2">
                                                        <strong>Active Model Files:</strong>{' '}
                                                        <code>{status.ocr.modelFiles.join(', ')}</code>
                                                    </Typography>
                                                )}
                                            </Stack>
                                            <Stack direction="row" spacing={1.5} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    type="button"
                                                    startIcon={<DownloadRoundedIcon />}
                                                    onClick={() =>
                                                        void downloadExtensionArtifact(
                                                            '/templates/ocr-pack.zip',
                                                            'oscar-ocr-pack-template.zip'
                                                        )
                                                    }
                                                    data-testid="ext-ocr-template-btn"
                                                >
                                                    Download Starter Pack (.zip)
                                                </Button>
                                                {status.ocr.customActive && (
                                                    <Button
                                                        variant="outlined"
                                                        color="warning"
                                                        size="small"
                                                        type="button"
                                                        startIcon={<RestartAltRoundedIcon />}
                                                        onClick={() =>
                                                            openConfirmDialog({
                                                                domain: 'ocr',
                                                                payload: { action: 'reset' },
                                                                title: copy.confirmResetTitle,
                                                                body: copy.confirmResetBody,
                                                                confirmLabel: copy.confirmResetAction,
                                                            })
                                                        }
                                                        data-testid="ext-ocr-reset-btn"
                                                    >
                                                        {copy.resetToDefaultBtn}
                                                    </Button>
                                                )}
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
                                                Upload Compliant OCR Model Pack or SPI Engine
                                            </Typography>
                                            {renderDropzone(
                                                'ocr',
                                                '.zip,.tar.gz,.tgz,.tar,.jar,.json',
                                                'Drop a Data-Only ONNX + plate-rules.json pack (.zip/.tar.gz), standalone plate-rules.json, or an OcrEngine SPI .jar (max 256 MiB).'
                                            )}
                                            <details className="oscar-ext-details">
                                                <summary>Compliant OCR Model &amp; Rule Pack Specification</summary>
                                                <Typography variant="body2" sx={{ mt: 1 }}>
                                                    Include <code>manifest.json</code>, optional regional <code>plate-rules.json</code> (Unicode Cyrillic/Greek/Arabic or numeric plates), and ONNX weights (<code>det.onnx</code>, <code>rec.onnx</code>, <code>dict.txt</code>). Omitted ONNX files automatically inherit OSCAR’s shipped models when <code>inheritBuiltinModels: true</code>.
                                                </Typography>
                                                <pre className="oscar-ext-codeblock" tabIndex={0} role="region" aria-label="OCR plate-rules.json example">
                                                    <code>{`{
  "ruleSetId": "cyrillic-and-numeric-v1",
  "minLength": 5,
  "maxLength": 10,
  "asciiOnly": false,
  "requireLetter": false,
  "requireDigit": true
}`}</code>
                                                </pre>
                                            </details>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </div>
                    </div>

                    {/* 2. Offline Regional Maps (.pmtiles) */}
                    <div
                        ref={(el) => {
                            panelRefs.current.maps = el;
                        }}
                        id={`${baseId}-panel-maps`}
                        role="tabpanel"
                        aria-labelledby={`${baseId}-tab-maps`}
                        className="oscar-ext-tabpanel"
                        {...(activeTab !== 'maps' ? ({ hidden: 'until-found' } as any) : {})}
                    >
                        <div className="oscar-ext-panel-inner">
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                                                <Typography variant="h6" component="h2">
                                                    Active Basemap Configuration
                                                </Typography>
                                                {renderSourceChip(status.maps.customActive)}
                                            </Stack>
                                            <Divider sx={{ mb: 1.5 }} />
                                            <Stack spacing={1}>
                                                <Typography variant="body2">
                                                    <strong>Active Display Name:</strong> {status.maps.displayName}
                                                </Typography>
                                                {status.maps.customActive && status.maps.header && (
                                                    <>
                                                        <Typography variant="body2">
                                                            <strong>Archive File:</strong>{' '}
                                                            <FilenameDisplay value={status.maps.activeFileName} /> (
                                                            {formatBytes(status.maps.sizeBytes)})
                                                        </Typography>
                                                        <Typography variant="body2">
                                                            <strong>PMTiles v3 Format:</strong>{' '}
                                                            <code>{status.maps.header.tileType.toUpperCase()}</code> (compression:{' '}
                                                            <code>{status.maps.header.tileCompression}</code>, zoom{' '}
                                                            {status.maps.header.minZoom}–{status.maps.header.maxZoom})
                                                        </Typography>
                                                        <Typography variant="body2">
                                                            <strong>Geographic Bounds:</strong> [{status.maps.header.minLat.toFixed(3)},{' '}
                                                            {status.maps.header.minLon.toFixed(3)}] to [
                                                            {status.maps.header.maxLat.toFixed(3)},{' '}
                                                            {status.maps.header.maxLon.toFixed(3)}]
                                                        </Typography>
                                                        <FormControlLabel
                                                            control={
                                                                <Checkbox
                                                                    checked={status.maps.defaultBasemap}
                                                                    onChange={(e) =>
                                                                        void submitRuntimeExtensionAction('maps', {
                                                                            action: 'set-default',
                                                                            defaultBasemap: e.target.checked,
                                                                        }).then(setStatus)
                                                                    }
                                                                />
                                                            }
                                                            label="Use as default basemap on Map view (prevents outbound internet tile requests on air-gapped networks)"
                                                        />
                                                    </>
                                                )}
                                            </Stack>

                                            {status.maps.customActive && (
                                                <Box sx={{ mt: 2 }}>
                                                    <Button
                                                        variant="outlined"
                                                        color="warning"
                                                        size="small"
                                                        type="button"
                                                        startIcon={<RestartAltRoundedIcon />}
                                                        onClick={() =>
                                                            openConfirmDialog({
                                                                domain: 'maps',
                                                                payload: { action: 'reset' },
                                                                title: copy.confirmResetTitle,
                                                                body: copy.confirmResetBody,
                                                                confirmLabel: copy.confirmResetAction,
                                                            })
                                                        }
                                                        data-testid="ext-maps-reset-btn"
                                                    >
                                                        {copy.resetToDefaultBtn}
                                                    </Button>
                                                </Box>
                                            )}

                                            {status.maps.storedPacks?.length > 0 && (
                                                <Box sx={{ mt: 2.5 }}>
                                                    <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
                                                        Stored Regional Archives (/var/lib/oscar/extensions/maps-storage/)
                                                    </Typography>
                                                    <table className="oscar-ext-table">
                                                        <caption className="visually-hidden">Stored PMTiles archives</caption>
                                                        <thead>
                                                            <tr>
                                                                <th scope="col">File</th>
                                                                <th scope="col">Size</th>
                                                                <th scope="col">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {status.maps.storedPacks.map((pack) => {
                                                                const isCurrent =
                                                                    status.maps.customActive &&
                                                                    status.maps.activeFileName === pack.fileName;
                                                                return (
                                                                    <tr key={pack.fileName}>
                                                                        <td>
                                                                            <FilenameDisplay value={pack.fileName} />
                                                                        </td>
                                                                        <td>{formatBytes(pack.sizeBytes)}</td>
                                                                        <td>
                                                                            <Stack direction="row" spacing={1}>
                                                                                {!isCurrent && (
                                                                                    <Button
                                                                                        size="small"
                                                                                        type="button"
                                                                                        onClick={() =>
                                                                                            void submitRuntimeExtensionAction(
                                                                                                'maps',
                                                                                                {
                                                                                                    action: 'activate',
                                                                                                    fileName: pack.fileName,
                                                                                                }
                                                                                            ).then(setStatus)
                                                                                        }
                                                                                    >
                                                                                        Activate
                                                                                    </Button>
                                                                                )}
                                                                                <Button
                                                                                    size="small"
                                                                                    color="error"
                                                                                    type="button"
                                                                                    aria-label={`Delete ${pack.fileName}`}
                                                                                    onClick={() =>
                                                                                        openConfirmDialog({
                                                                                            domain: 'maps',
                                                                                            payload: {
                                                                                                action: 'delete-pack',
                                                                                                fileName: pack.fileName,
                                                                                            },
                                                                                            title: `Delete ${pack.fileName}?`,
                                                                                            body: 'This permanently deletes the .pmtiles file from /var/lib/oscar/extensions/maps-storage/.',
                                                                                            confirmLabel: 'Delete Archive',
                                                                                        })
                                                                                    }
                                                                                >
                                                                                    Delete
                                                                                </Button>
                                                                            </Stack>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </Box>
                                            )}
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
                                                Upload Offline Regional .pmtiles Basemap
                                            </Typography>
                                            <Stack spacing={1.5} sx={{ mb: 1.5 }}>
                                                <TextField
                                                    size="small"
                                                    label="Optional Layer Display Name (e.g. Balkans Corridor Vector)"
                                                    value={mapDisplayName}
                                                    onChange={(e) => setMapDisplayName(e.target.value)}
                                                    fullWidth
                                                />
                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            checked={mapDefaultChecked}
                                                            onChange={(e) => setMapDefaultChecked(e.target.checked)}
                                                        />
                                                    }
                                                    label="Make active default basemap immediately upon upload"
                                                />
                                            </Stack>
                                            {renderDropzone(
                                                'maps',
                                                '.pmtiles',
                                                'Drop a PMTiles v3 (.pmtiles) vector (MVT) or raster (PNG/JPEG/WEBP) regional archive up to 2000 MiB.'
                                            )}
                                            <details className="oscar-ext-details">
                                                <summary>How to Extract a Regional .pmtiles File for Your Portal</summary>
                                                <Typography variant="body2" sx={{ mt: 1 }}>
                                                    On any internet-connected staging laptop, slice any bounding box (<code>minLon,minLat,maxLon,maxLat</code>) into a single portable <code>.pmtiles</code> file using the official Protomaps CLI, then upload it here:
                                                </Typography>
                                                <pre className="oscar-ext-codeblock" tabIndex={0} role="region" aria-label="pmtiles extract command">
                                                    <code>{`pmtiles extract https://build.protomaps.com/20260101.pmtiles \\
  portal-region.pmtiles \\
  --bbox=-85.50,35.00,-83.00,36.80 --maxzoom=15`}</code>
                                                </pre>
                                            </details>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </div>
                    </div>

                    {/* 3. Spectroscopy / Nuclide ID */}
                    <div
                        ref={(el) => {
                            panelRefs.current.spectroscopy = el;
                        }}
                        id={`${baseId}-panel-spectroscopy`}
                        role="tabpanel"
                        aria-labelledby={`${baseId}-tab-spectroscopy`}
                        className="oscar-ext-tabpanel"
                        {...(activeTab !== 'spectroscopy' ? ({ hidden: 'until-found' } as any) : {})}
                    >
                        <div className="oscar-ext-panel-inner">
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                                                <Typography variant="h6" component="h2">
                                                    Active Secondary Spectroscopy Engine
                                                </Typography>
                                                {renderSourceChip(status.spectroscopy.customActive)}
                                            </Stack>
                                            <Divider sx={{ mb: 1.5 }} />
                                            <Stack spacing={1}>
                                                <Typography variant="body2">
                                                    <strong>Active Classifier / Endpoint:</strong> {status.spectroscopy.algorithmId}
                                                </Typography>
                                                <Typography variant="body2">
                                                    <strong>Package:</strong> <FilenameDisplay value={status.spectroscopy.fileName} />
                                                </Typography>
                                                <Typography variant="body2">
                                                    <strong>Execution Mode:</strong>{' '}
                                                    <code>{status.spectroscopy.executionMode}</code>
                                                </Typography>
                                                {status.spectroscopy.isotopeCount > 0 && (
                                                    <Typography variant="body2">
                                                        <strong>Configured Photopeak Isotopes:</strong>{' '}
                                                        {status.spectroscopy.isotopeCount}
                                                    </Typography>
                                                )}
                                            </Stack>
                                            <Stack direction="row" spacing={1.5} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    type="button"
                                                    startIcon={<DownloadRoundedIcon />}
                                                    onClick={() =>
                                                        void downloadExtensionArtifact(
                                                            '/templates/isotope-library.json',
                                                            'oscar-isotope-library-template.json'
                                                        )
                                                    }
                                                >
                                                    Download Isotope Library Template (.json)
                                                </Button>
                                                {status.spectroscopy.customActive && (
                                                    <>
                                                        <Button
                                                            variant="outlined"
                                                            size="small"
                                                            type="button"
                                                            onClick={() => {
                                                                const next =
                                                                    status.spectroscopy.executionMode === 'override'
                                                                        ? 'fallback'
                                                                        : 'override';
                                                                void submitRuntimeExtensionAction('spectroscopy', {
                                                                    action: 'set-mode',
                                                                    executionMode: next,
                                                                }).then(setStatus);
                                                            }}
                                                        >
                                                            Switch Mode to{' '}
                                                            {status.spectroscopy.executionMode === 'override'
                                                                ? 'Fallback'
                                                                : 'Always Override'}
                                                        </Button>
                                                        <Button
                                                            variant="outlined"
                                                            color="warning"
                                                            size="small"
                                                            type="button"
                                                            startIcon={<RestartAltRoundedIcon />}
                                                            onClick={() =>
                                                                openConfirmDialog({
                                                                    domain: 'spectroscopy',
                                                                    payload: { action: 'reset' },
                                                                    title: copy.confirmResetTitle,
                                                                    body: copy.confirmResetBody,
                                                                    confirmLabel: copy.confirmResetAction,
                                                                })
                                                            }
                                                        >
                                                            {copy.resetToDefaultBtn}
                                                        </Button>
                                                    </>
                                                )}
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
                                                Upload Isotope Library or Nuclide Classifier SPI
                                            </Typography>
                                            <FormControlLabel
                                                sx={{ mb: 1 }}
                                                control={
                                                    <Checkbox
                                                        checked={specMode === 'override'}
                                                        onChange={(e) =>
                                                            setSpecMode(e.target.checked ? 'override' : 'fallback')
                                                        }
                                                    />
                                                }
                                                label="Always run locally in Override Mode (recommended for air-gapped portals without external WebID)"
                                            />
                                            {renderDropzone(
                                                'spectroscopy',
                                                '.json,.zip,.tar.gz,.tgz,.tar,.jar',
                                                'Drop an isotope-library.json photopeak pack or a SpectroscopyIdentificationAlgorithm .jar archive.'
                                            )}
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </div>
                    </div>

                    {/* 4. Trusted CA Certificates */}
                    <div
                        ref={(el) => {
                            panelRefs.current['trusted-certs'] = el;
                        }}
                        id={`${baseId}-panel-trusted-certs`}
                        role="tabpanel"
                        aria-labelledby={`${baseId}-tab-trusted-certs`}
                        className="oscar-ext-tabpanel"
                        {...(activeTab !== 'trusted-certs' ? ({ hidden: 'until-found' } as any) : {})}
                    >
                        <div className="oscar-ext-panel-inner">
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={7}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                                                <Typography variant="h6" component="h2">
                                                    Composite TLS Truststore Status
                                                </Typography>
                                                {renderSourceChip(status.trustedCerts.customActive)}
                                            </Stack>
                                            <Divider sx={{ mb: 1.5 }} />
                                            <Typography variant="body2" sx={{ mb: 1 }}>
                                                <strong>System JVM Root Issuers:</strong>{' '}
                                                {status.trustedCerts.systemTrustedIssuerCount} |{' '}
                                                <strong>Custom Enterprise Certificates:</strong>{' '}
                                                {status.trustedCerts.customCertificateCount}
                                            </Typography>

                                            {status.trustedCerts.customCertificates?.length > 0 && (
                                                <table className="oscar-ext-table">
                                                    <caption className="visually-hidden">Uploaded custom X.509 CA certificates</caption>
                                                    <thead>
                                                        <tr>
                                                            <th scope="col">File</th>
                                                            <th scope="col">Subject</th>
                                                            <th scope="col">Expires</th>
                                                            <th scope="col">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {status.trustedCerts.customCertificates.map((cert) => (
                                                            <tr key={cert.sha256Fingerprint}>
                                                                <td>
                                                                    <FilenameDisplay value={cert.fileName} />
                                                                </td>
                                                                <td>{cert.subject}</td>
                                                                <td>{cert.notAfter.slice(0, 10)}</td>
                                                                <td>
                                                                    <Button
                                                                        size="small"
                                                                        color="error"
                                                                        type="button"
                                                                        startIcon={<DeleteOutlineRoundedIcon />}
                                                                        aria-label={`Remove certificate ${cert.fileName}`}
                                                                        onClick={() =>
                                                                            openConfirmDialog({
                                                                                domain: 'trusted-certs',
                                                                                payload: {
                                                                                    action: 'delete-cert',
                                                                                    fileName: cert.fileName,
                                                                                },
                                                                                title: `Remove ${cert.fileName}?`,
                                                                                body: 'This removes the certificate from OSCAR’s composite TLS truststore.',
                                                                                confirmLabel: 'Remove Certificate',
                                                                            })
                                                                        }
                                                                    >
                                                                        Remove
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}

                                            {status.trustedCerts.customActive && (
                                                <Box sx={{ mt: 2 }}>
                                                    <Button
                                                        variant="outlined"
                                                        color="warning"
                                                        size="small"
                                                        type="button"
                                                        startIcon={<RestartAltRoundedIcon />}
                                                        onClick={() =>
                                                            openConfirmDialog({
                                                                domain: 'trusted-certs',
                                                                payload: { action: 'reset' },
                                                                title: copy.confirmResetTitle,
                                                                body: copy.confirmResetBody,
                                                                confirmLabel: copy.confirmResetAction,
                                                            })
                                                        }
                                                    >
                                                        {copy.resetToDefaultBtn}
                                                    </Button>
                                                </Box>
                                            )}
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} md={5}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
                                                Upload Enterprise Root / Intermediate CA
                                            </Typography>
                                            {renderDropzone(
                                                'trusted-certs',
                                                '.pem,.crt,.cer',
                                                'Drop public X.509 CA certificates (.pem, .crt, .cer) for internal OIDC, WebID, or federated nodes. Files containing PRIVATE KEY blocks are rejected automatically.'
                                            )}
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </div>
                    </div>

                    {/* 5. Adjudication Policy Packs */}
                    <div
                        ref={(el) => {
                            panelRefs.current['policy-packs'] = el;
                        }}
                        id={`${baseId}-panel-policy-packs`}
                        role="tabpanel"
                        aria-labelledby={`${baseId}-tab-policy-packs`}
                        className="oscar-ext-tabpanel"
                        {...(activeTab !== 'policy-packs' ? ({ hidden: 'until-found' } as any) : {})}
                    >
                        <div className="oscar-ext-panel-inner">
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                                                <Typography variant="h6" component="h2">
                                                    Active Disposition Codes &amp; Policy
                                                </Typography>
                                                {renderSourceChip(status.policyPacks.customActive)}
                                            </Stack>
                                            <Divider sx={{ mb: 1.5 }} />
                                            <Typography variant="body2" sx={{ mb: 1 }}>
                                                <strong>Built-In Core:</strong> {status.policyPacks.builtinSummary}
                                            </Typography>
                                            {status.policyPacks.activePack && (
                                                <Typography variant="body2" sx={{ mb: 1 }}>
                                                    <strong>Active Agency Pack:</strong>{' '}
                                                    {status.policyPacks.activePack.agencyName} (
                                                    <code>{status.policyPacks.activePack.packId}</code> v
                                                    {status.policyPacks.activePack.version})
                                                </Typography>
                                            )}
                                            <Typography variant="body2" sx={{ mb: 1 }}>
                                                <strong>Effective Custom Codes ({status.policyPacks.effectiveCustomCodes?.length ?? 0}):</strong>
                                            </Typography>
                                            {status.policyPacks.effectiveCustomCodes?.length > 0 && (
                                                <ul>
                                                    {status.policyPacks.effectiveCustomCodes.map((c) => (
                                                        <li key={c.code}>
                                                            <code>Code {c.code}</code>: {c.label}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                            <Stack direction="row" spacing={1.5} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    type="button"
                                                    startIcon={<DownloadRoundedIcon />}
                                                    onClick={() =>
                                                        void downloadExtensionArtifact(
                                                            '/templates/policy-pack.json',
                                                            'oscar-policy-pack-template.json'
                                                        )
                                                    }
                                                >
                                                    Download Template (.json)
                                                </Button>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    type="button"
                                                    startIcon={<DownloadRoundedIcon />}
                                                    onClick={() =>
                                                        void downloadExtensionArtifact(
                                                            '/policy-packs/export',
                                                            'oscar-policy-pack.json'
                                                        )
                                                    }
                                                >
                                                    Export Active Policy (.json)
                                                </Button>
                                                {status.policyPacks.customActive && (
                                                    <Button
                                                        variant="outlined"
                                                        color="warning"
                                                        size="small"
                                                        type="button"
                                                        startIcon={<RestartAltRoundedIcon />}
                                                        onClick={() =>
                                                            openConfirmDialog({
                                                                domain: 'policy-packs',
                                                                payload: { action: 'reset' },
                                                                title: copy.confirmResetTitle,
                                                                body: copy.confirmResetBody,
                                                                confirmLabel: copy.confirmResetAction,
                                                            })
                                                        }
                                                    >
                                                        {copy.resetToDefaultBtn}
                                                    </Button>
                                                )}
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
                                                Upload Agency Adjudication Policy Pack
                                            </Typography>
                                            {renderDropzone(
                                                'policy-packs',
                                                '.json,.zip',
                                                'Drop a schema-validated policy-pack.json (custom disposition codes > 11) to publish immediately across all Viewer clients and PDF/XLSX reports.'
                                            )}
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </div>
                    </div>

                    {/* 6. EML Primary-Scan Alarm Assessment */}
                    <div
                        ref={(el) => {
                            panelRefs.current.eml = el;
                        }}
                        id={`${baseId}-panel-eml`}
                        role="tabpanel"
                        aria-labelledby={`${baseId}-tab-eml`}
                        className="oscar-ext-tabpanel"
                        {...(activeTab !== 'eml' ? ({ hidden: 'until-found' } as any) : {})}
                    >
                        <div className="oscar-ext-panel-inner">
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                                                <Typography variant="h6" component="h2">
                                                    EML Alarm Assessment Runtime
                                                </Typography>
                                                {renderSourceChip(status.eml.loaded, !status.eml.loaded)}
                                            </Stack>
                                            <Divider sx={{ mb: 1.5 }} />
                                            {status.eml.loaded ? (
                                                <Stack spacing={1}>
                                                    <Typography variant="body2">
                                                        <strong>Archive:</strong> <FilenameDisplay value={status.eml.fileName} />
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        <strong>Version:</strong> {status.eml.versionId}
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        <strong>Collimated / Uncollimated Models:</strong>{' '}
                                                        {status.eml.collimatedModelId} / {status.eml.uncollimatedModelId}
                                                    </Typography>
                                                    <Box sx={{ mt: 1.5 }}>
                                                        <Button
                                                            variant="outlined"
                                                            color="warning"
                                                            size="small"
                                                            type="button"
                                                            startIcon={<RestartAltRoundedIcon />}
                                                            onClick={() =>
                                                                openConfirmDialog({
                                                                    domain: 'eml',
                                                                    payload: { action: 'unload' },
                                                                    title: 'Unload EML Plugin?',
                                                                    body: 'Lanes with EML enabled will fail closed so all primary-scan alarms remain active for human operator adjudication.',
                                                                    confirmLabel: 'Unload Plugin',
                                                                })
                                                            }
                                                        >
                                                            Unload EML Plugin
                                                        </Button>
                                                    </Box>
                                                </Stack>
                                            ) : (
                                                <Typography variant="body2" color="text.secondary">
                                                    No external EML alarm assessment archive is currently loaded. Unlike OCR and Maps (which ship unrestricted defaults), EML models are export-controlled and optional—when unloaded, all Rapiscan occupancy alarms remain active on the Dashboard for operator review.
                                                </Typography>
                                            )}
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
                                                Upload EML Plugin Archive (.jar / .zip / .tar.gz)
                                            </Typography>
                                            {renderDropzone(
                                                'eml',
                                                '.jar,.zip,.tar.gz,.tgz,.tar',
                                                'Drop an LLNL ERNIE VM-250 bundle or standalone EmlAlarmAssessmentAlgorithm SPI .jar.'
                                            )}
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </div>
                    </div>

                    {/* 7. Cargo NII (WCO UFF 2.0 / 3.0) SMB & Drop-Folder Integration */}
                    <div
                        ref={(el) => {
                            panelRefs.current.uff = el;
                        }}
                        id={`${baseId}-panel-uff`}
                        role="tabpanel"
                        aria-labelledby={`${baseId}-tab-uff`}
                        className="oscar-ext-tabpanel"
                        {...(activeTab !== 'uff' ? ({ hidden: 'until-found' } as any) : {})}
                    >
                        <div className="oscar-ext-panel-inner">
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={5}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                                                <Typography variant="h6" component="h2">
                                                    Cargo NII Share Status
                                                </Typography>
                                                {renderSourceChip(Boolean(status.uff?.enabled), !status.uff?.enabled)}
                                            </Stack>
                                            <Divider sx={{ mb: 1.5 }} />
                                            {status.uff?.enabled ? (
                                                <Stack spacing={1} data-testid="uff-ext-active-summary">
                                                    <Typography variant="body2">
                                                        <strong>Source:</strong>{' '}
                                                        {status.uff.sourceType === 'local'
                                                            ? status.uff.localPath
                                                            : `${status.uff.shareUrl}${status.uff.subPath ? `\\${status.uff.subPath}` : ''}`}
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        <strong>Indexed Archives:</strong>{' '}
                                                        <span data-testid="uff-ext-indexed-count">{status.uff.indexedCount}</span>{' '}
                                                        (UFF 2.0: {status.uff.uff2Count} · UFF 3.0: {status.uff.uff3Count})
                                                    </Typography>
                                                    {status.uff.scanners && status.uff.scanners.length > 0 && (
                                                        <Box>
                                                            <Typography variant="caption" color="text.secondary" display="block">
                                                                Discovered Scanners
                                                            </Typography>
                                                            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                                                                {status.uff.scanners.map((sc) => (
                                                                    <Chip key={sc} size="small" variant="outlined" label={sc} />
                                                                ))}
                                                            </Stack>
                                                        </Box>
                                                    )}
                                                    <Typography variant="caption" color="text.secondary">
                                                        Last incremental refresh: {status.uff.lastRefreshAt || '—'} ({status.uff.lastRefreshDurationMs} ms)
                                                    </Typography>
                                                    {status.uff.lastError && (
                                                        <Alert severity="warning" sx={{ mt: 1 }}>
                                                            {status.uff.lastError}
                                                        </Alert>
                                                    )}
                                                    <Stack direction="row" spacing={1} sx={{ pt: 1 }} flexWrap="wrap" useFlexGap>
                                                        <Button
                                                            type="button"
                                                            size="small"
                                                            variant="outlined"
                                                            startIcon={<RefreshRoundedIcon />}
                                                            onClick={async () => {
                                                                try {
                                                                    setErrorMsg(null);
                                                                    const next = await submitRuntimeExtensionAction('uff', { action: 'refresh' });
                                                                    invalidateCargoUffActiveCache();
                                                                    setStatus(next);
                                                                    setSuccessMsg('Refreshed Cargo UFF index.');
                                                                } catch (err: any) {
                                                                    setErrorMsg(err?.message || 'Failed refreshing UFF share');
                                                                }
                                                            }}
                                                            data-testid="uff-ext-refresh-index-btn"
                                                        >
                                                            Refresh Index
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="small"
                                                            variant="outlined"
                                                            color="warning"
                                                            startIcon={<RestartAltRoundedIcon />}
                                                            onClick={async () => {
                                                                try {
                                                                    setErrorMsg(null);
                                                                    const next = await submitRuntimeExtensionAction('uff', { action: 'reset' });
                                                                    invalidateCargoUffActiveCache();
                                                                    setStatus(next);
                                                                    setUffEnabled(false);
                                                                    setUffTestResult(null);
                                                                    setSuccessMsg('Disabled Cargo UFF share integration.');
                                                                } catch (err: any) {
                                                                    setErrorMsg(err?.message || 'Failed resetting UFF integration');
                                                                }
                                                            }}
                                                            data-testid="uff-ext-disable-btn"
                                                        >
                                                            Disable &amp; Clear Index
                                                        </Button>
                                                    </Stack>
                                                </Stack>
                                            ) : (
                                                <Typography variant="body2" color="text.secondary" data-testid="uff-ext-disabled-note">
                                                    Cargo UFF share integration is disabled by default so non-NII sites see zero extra controls, zero background threads, and zero network polling. Individual .uff files can still be inspected at any time via Upload Files in Secondary Inspection.
                                                </Typography>
                                            )}
                                        </CardContent>
                                    </Card>
                                </Grid>

                                <Grid item xs={12} md={7}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
                                                Read-Only SMBv2/SMBv3 Share &amp; Correlation Settings
                                            </Typography>
                                            <Box
                                                component="form"
                                                onSubmit={async (e) => {
                                                    e.preventDefault();
                                                    setUffSaving(true);
                                                    setErrorMsg(null);
                                                    setSuccessMsg(null);
                                                    try {
                                                        const next = await submitRuntimeExtensionAction('uff', {
                                                            action: 'save-config',
                                                            enabled: uffEnabled,
                                                            sourceType: uffSourceType,
                                                            shareUrl: uffShareUrl,
                                                            subPath: uffSubPath,
                                                            localPath: uffLocalPath,
                                                            domain: uffDomain,
                                                            username: uffUsername,
                                                            ...(uffPassword ? { password: uffPassword } : {}),
                                                            correlationWindowMinutes: uffWindowMin,
                                                            allowFuzzyOcrMatch: uffFuzzyOcr,
                                                        });
                                                        invalidateCargoUffActiveCache();
                                                        setStatus(next);
                                                        setUffPassword('');
                                                        setSuccessMsg(
                                                            next.uff?.enabled
                                                                ? `Cargo UFF share enabled (${next.uff.indexedCount} packages indexed).`
                                                                : 'Cargo UFF configuration saved (disabled).',
                                                        );
                                                    } catch (err: any) {
                                                        setErrorMsg(err?.message || 'Failed saving Cargo UFF settings');
                                                    } finally {
                                                        setUffSaving(false);
                                                    }
                                                }}
                                            >
                                                <Stack spacing={2}>
                                                    <FormControlLabel
                                                        control={
                                                            <Checkbox
                                                                checked={uffEnabled}
                                                                onChange={(e) => setUffEnabled(e.target.checked)}
                                                                data-testid="uff-ext-enabled-checkbox"
                                                            />
                                                        }
                                                        label="Enable Cargo UFF Share / Drop-Folder Integration"
                                                    />

                                                    <Stack direction="row" spacing={2}>
                                                        <FormControlLabel
                                                            control={
                                                                <input
                                                                    type="radio"
                                                                    name="uffSourceType"
                                                                    checked={uffSourceType === 'smb'}
                                                                    onChange={() => setUffSourceType('smb')}
                                                                    data-testid="uff-ext-source-smb"
                                                                />
                                                            }
                                                            label="SMB Network Share (SMBv2/SMBv3)"
                                                        />
                                                        <FormControlLabel
                                                            control={
                                                                <input
                                                                    type="radio"
                                                                    name="uffSourceType"
                                                                    checked={uffSourceType === 'local'}
                                                                    onChange={() => setUffSourceType('local')}
                                                                    data-testid="uff-ext-source-local"
                                                                />
                                                            }
                                                            label="Mounted / Local Host Directory"
                                                        />
                                                    </Stack>

                                                    {uffSourceType === 'smb' ? (
                                                        <>
                                                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                                                <TextField
                                                                    size="small"
                                                                    fullWidth
                                                                    label="SMB Share UNC or URL"
                                                                    placeholder="\\nas.port.local\oscar-uff"
                                                                    value={uffShareUrl}
                                                                    onChange={(e) => setUffShareUrl(e.target.value)}
                                                                    inputProps={{
                                                                        autoCorrect: 'off',
                                                                        autoCapitalize: 'none',
                                                                        spellCheck: false,
                                                                        'data-testid': 'uff-ext-share-url',
                                                                    }}
                                                                />
                                                                <TextField
                                                                    size="small"
                                                                    sx={{ minWidth: { sm: 210 } }}
                                                                    label="Optional Subfolder"
                                                                    placeholder="smb-date-archive"
                                                                    value={uffSubPath}
                                                                    onChange={(e) => setUffSubPath(e.target.value)}
                                                                    inputProps={{
                                                                        autoCorrect: 'off',
                                                                        autoCapitalize: 'none',
                                                                        spellCheck: false,
                                                                        'data-testid': 'uff-ext-subpath',
                                                                    }}
                                                                />
                                                            </Stack>

                                                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                                                                <TextField
                                                                    size="small"
                                                                    label="Domain / Workgroup"
                                                                    placeholder="WORKGROUP"
                                                                    value={uffDomain}
                                                                    onChange={(e) => setUffDomain(e.target.value)}
                                                                    inputProps={{
                                                                        autoCorrect: 'off',
                                                                        autoCapitalize: 'none',
                                                                        spellCheck: false,
                                                                        'data-testid': 'uff-ext-domain',
                                                                    }}
                                                                />
                                                                <TextField
                                                                    size="small"
                                                                    label="Read-Only Username"
                                                                    value={uffUsername}
                                                                    onChange={(e) => setUffUsername(e.target.value)}
                                                                    inputProps={{
                                                                        autoComplete: 'username',
                                                                        autoCorrect: 'off',
                                                                        autoCapitalize: 'none',
                                                                        spellCheck: false,
                                                                        'data-testid': 'uff-ext-username',
                                                                    }}
                                                                />
                                                                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flex: 1 }}>
                                                                    <TextField
                                                                        size="small"
                                                                        fullWidth
                                                                        type={showUffPassword ? 'text' : 'password'}
                                                                        label={
                                                                            status.uff?.passwordConfigured
                                                                                ? 'Password (encrypted — leave blank to keep)'
                                                                                : 'Read-Only Password'
                                                                        }
                                                                        value={uffPassword}
                                                                        onChange={(e) => setUffPassword(e.target.value)}
                                                                        inputProps={{
                                                                            autoComplete: 'new-password',
                                                                            'data-testid': 'uff-ext-password',
                                                                        }}
                                                                    />
                                                                    <Button
                                                                        type="button"
                                                                        size="small"
                                                                        variant="outlined"
                                                                        aria-pressed={showUffPassword}
                                                                        aria-label={showUffPassword ? 'Hide SMB password' : 'Show SMB password'}
                                                                        onClick={() => setShowUffPassword((p) => !p)}
                                                                        sx={{ minWidth: 40, px: 1 }}
                                                                    >
                                                                        {showUffPassword ? (
                                                                            <VisibilityOffRoundedIcon fontSize="small" />
                                                                        ) : (
                                                                            <VisibilityRoundedIcon fontSize="small" />
                                                                        )}
                                                                    </Button>
                                                                </Stack>
                                                            </Stack>
                                                        </>
                                                    ) : (
                                                        <TextField
                                                            size="small"
                                                            fullWidth
                                                            label="Local / Mounted UFF Directory Path"
                                                            placeholder="/mnt/nii-uff"
                                                            value={uffLocalPath}
                                                            onChange={(e) => setUffLocalPath(e.target.value)}
                                                            inputProps={{
                                                                autoCorrect: 'off',
                                                                autoCapitalize: 'none',
                                                                spellCheck: false,
                                                                'data-testid': 'uff-ext-local-path',
                                                            }}
                                                        />
                                                    )}

                                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                                                        <TextField
                                                            size="small"
                                                            label="Correlation Window (minutes)"
                                                            value={uffWindowMin}
                                                            onChange={(e) => {
                                                                const n = parseInt(e.target.value, 10);
                                                                if (Number.isFinite(n)) setUffWindowMin(n);
                                                            }}
                                                            inputProps={{
                                                                inputMode: 'numeric',
                                                                'data-testid': 'uff-ext-window-min',
                                                            }}
                                                            sx={{ maxWidth: 220 }}
                                                        />
                                                        <FormControlLabel
                                                            control={
                                                                <Checkbox
                                                                    checked={uffFuzzyOcr}
                                                                    onChange={(e) => setUffFuzzyOcr(e.target.checked)}
                                                                    data-testid="uff-ext-fuzzy-checkbox"
                                                                />
                                                            }
                                                            label="Allow 1-Character Scanner OCR Fuzzy Match (0↔O, 8↔B, 6↔G)"
                                                        />
                                                    </Stack>

                                                    {uffTestResult && (
                                                        <Alert severity="success" role="status" data-testid="uff-ext-test-result">
                                                            Connected to <strong>{uffTestResult.target}</strong> in{' '}
                                                            {uffTestResult.latencyMs} ms — discovered{' '}
                                                            <strong>{uffTestResult.discoveredUffCount}</strong> .uff packages
                                                            {uffTestResult.sampleScannerId
                                                                ? ` (sample: ${uffTestResult.sampleScannerId}, UFF ${uffTestResult.sampleUffVersion})`
                                                                : ''}
                                                            .
                                                        </Alert>
                                                    )}

                                                    <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                                                        <Button
                                                            type="button"
                                                            variant="outlined"
                                                            disabled={uffTesting || uffSaving}
                                                            onClick={async () => {
                                                                setUffTesting(true);
                                                                setErrorMsg(null);
                                                                setUffTestResult(null);
                                                                try {
                                                                    const res = await testCargoUffConnection({
                                                                        sourceType: uffSourceType,
                                                                        shareUrl: uffShareUrl,
                                                                        subPath: uffSubPath,
                                                                        localPath: uffLocalPath,
                                                                        domain: uffDomain,
                                                                        username: uffUsername,
                                                                        ...(uffPassword ? { password: uffPassword } : {}),
                                                                    });
                                                                    setUffTestResult(res);
                                                                } catch (err: any) {
                                                                    setErrorMsg(err?.message || 'Connection test failed');
                                                                } finally {
                                                                    setUffTesting(false);
                                                                }
                                                            }}
                                                            data-testid="uff-ext-test-btn"
                                                        >
                                                            {uffTesting ? 'Testing...' : 'Test Connection'}
                                                        </Button>
                                                        <Button
                                                            type="submit"
                                                            variant="contained"
                                                            disabled={uffSaving}
                                                            data-testid="uff-ext-save-btn"
                                                        >
                                                            {uffSaving ? 'Saving...' : 'Save & Apply'}
                                                        </Button>
                                                    </Stack>
                                                </Stack>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </div>
                    </div>
                </>
            )}

            {/* Native modal confirmation <dialog> (modern-web-guidance: dialog) */}
            <dialog
                ref={dialogRef}
                aria-labelledby={dialogTitleId}
                className="oscar-ext-dialog"
                onClose={() => void handleDialogClose()}
            >
                <div className="oscar-ext-dialog-body">
                    <Typography id={dialogTitleId} variant="h6" component="h2" sx={{ fontWeight: 700, mb: 1 }}>
                        {pendingConfirm?.title || copy.confirmResetTitle}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                        {pendingConfirm?.body || copy.confirmResetBody}
                    </Typography>
                    <form method="dialog">
                        <Stack direction="row" spacing={1.5} justifyContent="flex-end">
                            <Button type="submit" value="cancel" variant="outlined" autoFocus>
                                {copy.cancelBtn}
                            </Button>
                            <Button
                                type="submit"
                                value="confirm"
                                variant="contained"
                                color="warning"
                                data-testid="ext-dialog-confirm-btn"
                            >
                                {pendingConfirm?.confirmLabel || copy.confirmResetAction}
                            </Button>
                        </Stack>
                    </form>
                </div>
            </dialog>
        </main>
    );
}
