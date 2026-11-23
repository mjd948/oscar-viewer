"use client";

import * as React from 'react';
import QRCode from 'qrcode';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    FormControlLabel,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import GroupAddRoundedIcon from '@mui/icons-material/GroupAddRounded';
import { Locale } from '@/app/contexts/LanguageContext';
import {
    adminBulkEnrollUsers,
    buildEnrollmentUrl,
    buildStartupTextMessage,
    EnrolledInviteCard,
    normalizeBaseOrigin,
    parseBulkUserRoster,
} from '@/lib/data/oscar/AuthSessionApi';

interface BulkUiStrings {
    bulkBtn: string;
    qrInviteBtn: string;
    bulkDialogTitle: string;
    bulkDialogSubtitle: string;
    uploadCsvBtn: string;
    downloadSampleBtn: string;
    pasteLabel: string;
    pasteHelper: string;
    baseOriginLabel: string;
    baseOriginHelper: string;
    expiryLabel: string;
    exp24h: string;
    exp7d: string;
    exp30d: string;
    reissueExistingLabel: string;
    previewHeading: (validCount: number, skipCount: number, errorCount: number) => string;
    statusReady: string;
    statusSkipExisting: string;
    statusReissue: string;
    enrollSubmitBtn: (count: number) => string;
    cancelBtn: string;
    packDialogTitle: (count: number) => string;
    packDialogSubtitle: string;
    copyAllMessagesBtn: string;
    printCardsBtn: string;
    downloadCsvBtn: string;
    copyMessageBtn: string;
    copyLinkBtn: string;
    downloadQrBtn: string;
    closeBtn: string;
    qrAlt: (username: string) => string;
}

const BULK_STRINGS: Record<Locale, BulkUiStrings> = {
    en: {
        bulkBtn: 'Bulk Enroll (CSV / Paste)',
        qrInviteBtn: 'QR & Invite',
        bulkDialogTitle: 'Bulk Enroll Users & Generate QR Startup Invites',
        bulkDialogSubtitle:
            'Upload a CSV/TSV roster or paste rows below (username, role, optional full name, optional gate views). OSCAR creates each account and produces a ready-to-send startup message plus a 1-tap Passkey/Password setup QR code.',
        uploadCsvBtn: 'Upload CSV / TXT File',
        downloadSampleBtn: 'Download Sample CSV',
        pasteLabel: 'User List (CSV, Excel Tab-Separated, or Semicolon)',
        pasteHelper: 'Format: username, role (operator | viewer | admin), full name (optional), gate views (optional, e.g. north-gate|truck-portal)',
        baseOriginLabel: 'Facility OSCAR URL for QR Codes & Links',
        baseOriginHelper: 'Use the hostname or tunnel domain your users can reach (for example https://oscar.local).',
        expiryLabel: 'One-Time Invite Validity',
        exp24h: '24 Hours',
        exp7d: '7 Days (Recommended)',
        exp30d: '30 Days',
        reissueExistingLabel: 'Re-issue fresh setup link & temporary code for usernames that already exist',
        previewHeading: (valid, skip, err) =>
            `Preview: ${valid} ready to enroll · ${skip} existing skipped · ${err} with errors`,
        statusReady: 'Ready to Create',
        statusSkipExisting: 'Exists (Will Skip)',
        statusReissue: 'Exists (Re-Issue Invite)',
        enrollSubmitBtn: (count) => `Enroll ${count} User(s) & Generate QR Pack`,
        cancelBtn: 'Cancel',
        packDialogTitle: (count) => `Startup Messages & 1-Tap Setup QR Codes (${count})`,
        packDialogSubtitle:
            'Send each user their startup text message or let them scan their QR code to set up a Passkey or password in one tap. Phone-free workstation codes are included automatically.',
        copyAllMessagesBtn: 'Copy All Startup Messages',
        printCardsBtn: 'Print / Save PDF Handout Cards',
        downloadCsvBtn: 'Download Onboarding CSV',
        copyMessageBtn: 'Copy Text Message',
        copyLinkBtn: 'Copy Setup Link',
        downloadQrBtn: 'Save QR (.png)',
        closeBtn: 'Done',
        qrAlt: (u) => `One-time OSCAR setup QR code for ${u}`,
    },
    es: {
        bulkBtn: 'Alta masiva (CSV / Pegar)',
        qrInviteBtn: 'QR e invitación',
        bulkDialogTitle: 'Alta masiva de usuarios e invitaciones QR',
        bulkDialogSubtitle:
            'Suba un archivo CSV/TXT o pegue filas (usuario, rol, nombre opcional, vistas opcionales). OSCAR crea cada cuenta y genera el mensaje de bienvenida con un código QR de activación directa de Passkey o contraseña.',
        uploadCsvBtn: 'Subir archivo CSV / TXT',
        downloadSampleBtn: 'Descargar CSV de ejemplo',
        pasteLabel: 'Lista de usuarios (CSV, tabulaciones de Excel o punto y coma)',
        pasteHelper: 'Formato: usuario, rol (operator | viewer | admin), nombre completo (opcional), vistas (opcional, ej. north-gate|truck-portal)',
        baseOriginLabel: 'URL del sitio OSCAR para códigos QR y enlaces',
        baseOriginHelper: 'Use el nombre de dominio o túnel accesible para sus usuarios (p. ej. https://oscar.local).',
        expiryLabel: 'Validez de la invitación',
        exp24h: '24 horas',
        exp7d: '7 días (Recomendado)',
        exp30d: '30 días',
        reissueExistingLabel: 'Reemitir invitación y código temporal para usuarios ya existentes',
        previewHeading: (valid, skip, err) =>
            `Vista previa: ${valid} listos · ${skip} omitidos · ${err} con errores`,
        statusReady: 'Listo para crear',
        statusSkipExisting: 'Ya existe (Omitir)',
        statusReissue: 'Ya existe (Reemitir)',
        enrollSubmitBtn: (count) => `Inscribir ${count} usuario(s) y generar QR`,
        cancelBtn: 'Cancelar',
        packDialogTitle: (count) => `Mensajes de inicio y códigos QR de activación (${count})`,
        packDialogSubtitle:
            'Envíe el mensaje de texto o muestre el código QR para que cada usuario active su Passkey o contraseña en un toque.',
        copyAllMessagesBtn: 'Copiar todos los mensajes',
        printCardsBtn: 'Imprimir / Guardar tarjetas PDF',
        downloadCsvBtn: 'Descargar CSV de bienvenida',
        copyMessageBtn: 'Copiar mensaje',
        copyLinkBtn: 'Copiar enlace',
        downloadQrBtn: 'Guardar QR (.png)',
        closeBtn: 'Listo',
        qrAlt: (u) => `Código QR de activación OSCAR para ${u}`,
    },
    fr: {
        bulkBtn: 'Inscription groupée (CSV)',
        qrInviteBtn: 'QR et invitation',
        bulkDialogTitle: 'Inscription groupée d’utilisateurs et invitations QR',
        bulkDialogSubtitle:
            'Importez un fichier CSV/TXT ou collez une liste (utilisateur, rôle, nom facultatif, vues facultatives). OSCAR crée les comptes et génère un message prêt à envoyer ainsi qu’un QR d’activation Passkey / mot de passe.',
        uploadCsvBtn: 'Importer un fichier CSV / TXT',
        downloadSampleBtn: 'Télécharger un modèle CSV',
        pasteLabel: 'Liste des utilisateurs (CSV, copier-coller Excel ou point-virgule)',
        pasteHelper: 'Format : utilisateur, rôle (operator | viewer | admin), nom complet (facultatif), vues (facultatif, ex. north-gate|truck-portal)',
        baseOriginLabel: 'URL OSCAR du site pour les QR et liens',
        baseOriginHelper: 'Indiquez le nom d’hôte ou domaine du tunnel accessible aux opérateurs (ex. https://oscar.local).',
        expiryLabel: 'Validité du lien unique',
        exp24h: '24 heures',
        exp7d: '7 jours (Recommandé)',
        exp30d: '30 jours',
        reissueExistingLabel: 'Émettre une nouvelle invitation et un code temporaire si le compte existe déjà',
        previewHeading: (valid, skip, err) =>
            `Aperçu : ${valid} prêts · ${skip} existants ignorés · ${err} en erreur`,
        statusReady: 'Prêt à créer',
        statusSkipExisting: 'Existe (Ignoré)',
        statusReissue: 'Existe (Nouvelle invitation)',
        enrollSubmitBtn: (count) => `Inscrire ${count} utilisateur(s) et générer les QR`,
        cancelBtn: 'Annuler',
        packDialogTitle: (count) => `Messages de démarrage et QR d’activation (${count})`,
        packDialogSubtitle:
            'Envoyez le message texte ou faites scanner le code QR pour configurer une clé Passkey ou un mot de passe en un geste.',
        copyAllMessagesBtn: 'Copier tous les messages',
        printCardsBtn: 'Imprimer / Enregistrer fiches PDF',
        downloadCsvBtn: 'Télécharger le CSV d’accueil',
        copyMessageBtn: 'Copier le message',
        copyLinkBtn: 'Copier le lien',
        downloadQrBtn: 'Enregistrer QR (.png)',
        closeBtn: 'Terminé',
        qrAlt: (u) => `Code QR d’activation OSCAR pour ${u}`,
    },
    el: {
        bulkBtn: 'Μαζική εγγραφή (CSV)',
        qrInviteBtn: 'QR & πρόσκληση',
        bulkDialogTitle: 'Μαζική εγγραφή χρηστών & δημιουργία προσκλήσεων QR',
        bulkDialogSubtitle:
            'Μεταφορτώστε αρχείο CSV/TXT ή επικολλήστε γραμμές (χρήστης, ρόλος, προαιρετικό ονοματεπώνυμο, προαιρετικές λωρίδες). Το OSCAR δημιουργεί τους λογαριασμούς και παράγει έτοιμο μήνυμα εκκίνησης και κωδικό QR ρύθμισης Passkey/κωδικού.',
        uploadCsvBtn: 'Μεταφόρτωση CSV / TXT',
        downloadSampleBtn: 'Λήψη πρότυπου CSV',
        pasteLabel: 'Λίστα χρηστών (CSV, επικόλληση Excel ή ερωτηματικό)',
        pasteHelper: 'Μορφή: χρήστης, ρόλος (operator | viewer | admin), ονοματεπώνυμο (προαιρετικό), προβολές (π.χ. north-gate|truck-portal)',
        baseOriginLabel: 'Διεύθυνση URL OSCAR για κωδικούς QR & συνδέσμους',
        baseOriginHelper: 'Χρησιμοποιήστε το όνομα τομέα που βλέπουν οι χειριστές (π.χ. https://oscar.local).',
        expiryLabel: 'Ισχύς πρόσκλησης μίας χρήσης',
        exp24h: '24 ώρες',
        exp7d: '7 ημέρες (Συνιστάται)',
        exp30d: '30 ημέρες',
        reissueExistingLabel: 'Επανέκδοση πρόσκλησης & προσωρινού κωδικού για υπάρχοντες χρήστες',
        previewHeading: (valid, skip, err) =>
            `Προεπισκόπηση: ${valid} έτοιμοι · ${skip} παραλείπονται · ${err} με σφάλματα`,
        statusReady: 'Έτοιμο για δημιουργία',
        statusSkipExisting: 'Υπάρχει (Παράλειψη)',
        statusReissue: 'Υπάρχει (Επανέκδοση)',
        enrollSubmitBtn: (count) => `Εγγραφή ${count} χρηστών & δημιουργία QR`,
        cancelBtn: 'Ακύρωση',
        packDialogTitle: (count) => `Μηνύματα εκκίνησης & κωδικοί QR ρύθμισης (${count})`,
        packDialogSubtitle:
            'Στείλτε το μήνυμα εκκίνησης ή σαρώστε τον κωδικό QR για άμεση ρύθμιση Passkey ή κωδικού πρόσβασης.',
        copyAllMessagesBtn: 'Αντιγραφή όλων των μηνυμάτων',
        printCardsBtn: 'Εκτύπωση / Αποθήκευση καρτών PDF',
        downloadCsvBtn: 'Λήψη CSV εγγραφής',
        copyMessageBtn: 'Αντιγραφή μηνύματος',
        copyLinkBtn: 'Αντιγραφή συνδέσμου',
        downloadQrBtn: 'Λήψη QR (.png)',
        closeBtn: 'Τέλος',
        qrAlt: (u) => `Κωδικός QR ενεργοποίησης OSCAR για ${u}`,
    },
};

export function useBulkStrings(locale: Locale): BulkUiStrings {
    return BULK_STRINGS[locale] || BULK_STRINGS.en;
}

const SAMPLE_ROSTER_CSV = [
    'username,role,display_name,views',
    'maria.gatehouse,operator,Maria Gatehouse,north-gate|truck-portal',
    'james.shiftlead,operator,James Shift Lead,south-gate',
    'elena.auditor,viewer,Elena Compliance Auditor,',
    'backup.supervisor,admin,Backup Site Supervisor,',
].join('\n');

export function BulkEnrollDialog(props: {
    open: boolean;
    locale: Locale;
    existingUsernames: ReadonlySet<string>;
    baseOrigin: string;
    onBaseOriginChange: (nextOrigin: string) => void;
    onClose: () => void;
    onEnrolled: (
        cards: EnrolledInviteCard[],
        summaryMessage: string,
        rowErrors: Array<{ row: number; username: string; error: string }>,
    ) => void;
}) {
    const {
        open,
        locale,
        existingUsernames,
        baseOrigin,
        onBaseOriginChange,
        onClose,
        onEnrolled,
    } = props;
    const s = useBulkStrings(locale);

    const [rosterText, setRosterText] = React.useState('');
    const [reissueExisting, setReissueExisting] = React.useState(false);
    const [inviteExpiresInHours, setInviteExpiresInHours] = React.useState(168);
    const [submitting, setSubmitting] = React.useState(false);
    const [submitError, setSubmitError] = React.useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);

    const parsedRows = React.useMemo(() => parseBulkUserRoster(rosterText), [rosterText]);

    const { actionableRows, skippedExistingCount, errorCount } = React.useMemo(() => {
        const actionable: typeof parsedRows = [];
        let skipped = 0;
        let errs = 0;
        for (const r of parsedRows) {
            if (r.error) {
                errs++;
                continue;
            }
            const exists = existingUsernames.has(r.username.toLowerCase());
            if (exists && !reissueExisting) {
                skipped++;
            } else {
                actionable.push(r);
            }
        }
        return { actionableRows: actionable, skippedExistingCount: skipped, errorCount: errs };
    }, [parsedRows, existingUsernames, reissueExisting]);

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            setRosterText(text);
            setSubmitError(null);
        } catch {
            setSubmitError('Could not read the selected file.');
        } finally {
            e.target.value = '';
        }
    };

    const handleDownloadSample = () => {
        const blob = new Blob([SAMPLE_ROSTER_CSV + '\n'], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'oscar-users-template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (actionableRows.length === 0) return;
        setSubmitting(true);
        setSubmitError(null);
        try {
            const res = await adminBulkEnrollUsers({
                users: actionableRows.map((r) => ({
                    username: r.username,
                    displayName: r.displayName,
                    role: r.role,
                    allowedViews: r.allowedViews,
                })),
                reissueExisting,
                inviteExpiresInHours,
            });
            const summary = `Enrolled ${res.enrolled.length} user(s) (${res.createdCount} created, ${res.reissuedCount} re-issued, ${res.skippedCount + skippedExistingCount} skipped).`;
            setRosterText('');
            onEnrolled(res.enrolled, summary, res.errors || []);
        } catch (err: any) {
            setSubmitError(err?.message || 'Bulk enrollment failed.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <Box component="form" onSubmit={handleSubmit}>
                <DialogTitle>{s.bulkDialogTitle}</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2.5}>
                        <Typography variant="body2" color="text.secondary">
                            {s.bulkDialogSubtitle}
                        </Typography>

                        {submitError && <Alert severity="error">{submitError}</Alert>}

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,.tsv,.txt,text/csv,text/plain"
                                hidden
                                data-testid="bulk-roster-file-input"
                                onChange={handleFileSelected}
                            />
                            <Button
                                type="button"
                                variant="outlined"
                                startIcon={<UploadFileRoundedIcon />}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {s.uploadCsvBtn}
                            </Button>
                            <Button
                                type="button"
                                variant="text"
                                startIcon={<DownloadRoundedIcon />}
                                onClick={handleDownloadSample}
                            >
                                {s.downloadSampleBtn}
                            </Button>
                        </Stack>

                        <TextField
                            multiline
                            minRows={5}
                            maxRows={10}
                            fullWidth
                            label={s.pasteLabel}
                            helperText={s.pasteHelper}
                            placeholder={SAMPLE_ROSTER_CSV}
                            value={rosterText}
                            onChange={(e) => setRosterText(e.target.value)}
                            inputProps={{
                                spellCheck: false,
                                autoCapitalize: 'none',
                                'data-testid': 'bulk-roster-textarea',
                            }}
                        />

                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={7}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label={s.baseOriginLabel}
                                    helperText={s.baseOriginHelper}
                                    value={baseOrigin}
                                    onChange={(e) => onBaseOriginChange(e.target.value)}
                                    inputProps={{ spellCheck: false, autoCapitalize: 'none' }}
                                />
                            </Grid>
                            <Grid item xs={12} sm={5}>
                                <FormControl fullWidth size="small">
                                    <InputLabel id="bulk-invite-expiry-label">{s.expiryLabel}</InputLabel>
                                    <Select
                                        labelId="bulk-invite-expiry-label"
                                        label={s.expiryLabel}
                                        value={inviteExpiresInHours}
                                        onChange={(e) => setInviteExpiresInHours(Number(e.target.value))}
                                    >
                                        <MenuItem value={24}>{s.exp24h}</MenuItem>
                                        <MenuItem value={168}>{s.exp7d}</MenuItem>
                                        <MenuItem value={720}>{s.exp30d}</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={reissueExisting}
                                            onChange={(_e, checked) => setReissueExisting(checked)}
                                        />
                                    }
                                    label={s.reissueExistingLabel}
                                />
                            </Grid>
                        </Grid>

                        {parsedRows.length > 0 && (
                            <Box>
                                <Typography id="bulk-preview-heading" variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                                    {s.previewHeading(actionableRows.length, skippedExistingCount, errorCount)}
                                </Typography>
                                <Box
                                    tabIndex={0}
                                    role="region"
                                    aria-labelledby="bulk-preview-heading"
                                    sx={{ maxHeight: 240, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}
                                >
                                    <Table size="small" stickyHeader>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>#</TableCell>
                                                <TableCell>Username</TableCell>
                                                <TableCell>Display Name</TableCell>
                                                <TableCell>Role</TableCell>
                                                <TableCell>Views</TableCell>
                                                <TableCell>Status</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {parsedRows.map((row) => {
                                                const exists = existingUsernames.has(row.username.toLowerCase());
                                                return (
                                                    <TableRow key={`${row.lineNumber}-${row.username}`}>
                                                        <TableCell>{row.lineNumber}</TableCell>
                                                        <TableCell sx={{ fontWeight: 600 }}>{row.username || '—'}</TableCell>
                                                        <TableCell>{row.displayName || '—'}</TableCell>
                                                        <TableCell>{row.role.toUpperCase()}</TableCell>
                                                        <TableCell>
                                                            {row.allowedViews.length > 0 ? row.allowedViews.join(', ') : 'All'}
                                                        </TableCell>
                                                        <TableCell>
                                                            {row.error ? (
                                                                <Chip size="small" color="error" label={row.error} />
                                                            ) : exists ? (
                                                                <Chip
                                                                    size="small"
                                                                    color={reissueExisting ? 'info' : 'default'}
                                                                    variant="outlined"
                                                                    label={reissueExisting ? s.statusReissue : s.statusSkipExisting}
                                                                />
                                                            ) : (
                                                                <Chip size="small" color="success" variant="outlined" label={s.statusReady} />
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </Box>
                            </Box>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>{s.cancelBtn}</Button>
                    <Button
                        type="submit"
                        variant="contained"
                        startIcon={<GroupAddRoundedIcon />}
                        disabled={submitting || actionableRows.length === 0 || errorCount > 0}
                        data-testid="bulk-enroll-submit-btn"
                    >
                        {s.enrollSubmitBtn(actionableRows.length)}
                    </Button>
                </DialogActions>
            </Box>
        </Dialog>
    );
}

function escapeCsvCell(val: string): string {
    if (/[",\r\n]/.test(val)) {
        return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
}

export function OnboardingPackDialog(props: {
    open: boolean;
    cards: EnrolledInviteCard[];
    locale: Locale;
    baseOrigin: string;
    onBaseOriginChange: (nextOrigin: string) => void;
    onCopiedNotice: () => void;
    onClose: () => void;
}) {
    const { open, cards, locale, baseOrigin, onBaseOriginChange, onCopiedNotice, onClose } = props;
    const s = useBulkStrings(locale);
    const effectiveOrigin = normalizeBaseOrigin(baseOrigin);
    const [qrDataUrls, setQrDataUrls] = React.useState<Record<string, string>>({});

    React.useEffect(() => {
        if (!open || cards.length === 0) return;
        let cancelled = false;
        (async () => {
            const entries: Record<string, string> = {};
            for (const c of cards) {
                const url = buildEnrollmentUrl(effectiveOrigin, c.inviteToken);
                try {
                    entries[c.inviteToken] = await QRCode.toDataURL(url, {
                        errorCorrectionLevel: 'M',
                        margin: 2,
                        scale: 6,
                        color: { dark: '#0f172a', light: '#ffffff' },
                    });
                } catch {
                    entries[c.inviteToken] = '';
                }
            }
            if (!cancelled) {
                setQrDataUrls(entries);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, cards, effectiveOrigin]);

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            onCopiedNotice();
        } catch {
            // Clipboard permission restricted in headless context
        }
    };

    const handleCopyAllMessages = () => {
        const allText = cards
            .map((c) => buildStartupTextMessage(c, effectiveOrigin, locale))
            .join('\n\n------------------------------------------------------------\n\n');
        void copyToClipboard(allText);
    };

    const handleDownloadOnboardingCsv = () => {
        const header = 'username,display_name,role,allowed_views,enroll_url,temporary_password,expires_at';
        const rows = cards.map((c) => {
            const url = buildEnrollmentUrl(effectiveOrigin, c.inviteToken);
            const exp = c.inviteExpiresAt > 0 ? new Date(c.inviteExpiresAt).toISOString() : '';
            return [
                c.user.username,
                c.user.displayName,
                c.user.role,
                (c.user.allowedViews || []).join('|'),
                url,
                c.temporaryPassword || '',
                exp,
            ]
                .map(escapeCsvCell)
                .join(',');
        });
        const blob = new Blob([[header, ...rows].join('\n') + '\n'], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `oscar-onboarding-invites-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleDownloadSingleQr = (card: EnrolledInviteCard) => {
        const dataUrl = qrDataUrls[card.inviteToken];
        if (!dataUrl) return;
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `oscar-invite-${card.user.username}.png`;
        a.click();
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth data-testid="onboarding-pack-dialog">
            <DialogTitle sx={{ displayPrint: 'none' }}>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={1.5}>
                    <Box>
                        <Typography variant="h6" fontWeight={700}>
                            {s.packDialogTitle(cards.length)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {s.packDialogSubtitle}
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Button
                            size="small"
                            variant="contained"
                            startIcon={<ContentCopyRoundedIcon />}
                            onClick={handleCopyAllMessages}
                            data-testid="copy-all-startup-messages-btn"
                        >
                            {s.copyAllMessagesBtn}
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<PrintRoundedIcon />}
                            onClick={() => window.print()}
                        >
                            {s.printCardsBtn}
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<DownloadRoundedIcon />}
                            onClick={handleDownloadOnboardingCsv}
                        >
                            {s.downloadCsvBtn}
                        </Button>
                    </Stack>
                </Stack>
            </DialogTitle>
            <DialogContent dividers>
                <Box sx={{ mb: 2, maxWidth: 460, displayPrint: 'none' }}>
                    <TextField
                        fullWidth
                        size="small"
                        label={s.baseOriginLabel}
                        value={baseOrigin}
                        onChange={(e) => onBaseOriginChange(e.target.value)}
                        inputProps={{ spellCheck: false, autoCapitalize: 'none' }}
                    />
                </Box>

                <Grid container spacing={2}>
                    {cards.map((card) => {
                        const enrollUrl = buildEnrollmentUrl(effectiveOrigin, card.inviteToken);
                        const message = buildStartupTextMessage(card, effectiveOrigin, locale);
                        const qrSrc = qrDataUrls[card.inviteToken];
                        return (
                            <Grid item xs={12} md={cards.length === 1 ? 12 : 6} key={`${card.user.username}-${card.inviteToken}`}>
                                <Card variant="outlined" sx={{ height: '100%', breakInside: 'avoid' }}>
                                    <CardContent>
                                        <Stack spacing={1.5}>
                                            <Stack direction="row" spacing={2} alignItems="center">
                                                <Box
                                                    sx={{
                                                        width: 148,
                                                        height: 148,
                                                        flexShrink: 0,
                                                        border: 1,
                                                        borderColor: 'divider',
                                                        borderRadius: 1.5,
                                                        display: 'grid',
                                                        placeItems: 'center',
                                                        bgcolor: '#ffffff',
                                                        p: 0.5,
                                                    }}
                                                >
                                                    {qrSrc ? (
                                                        <Box
                                                            component="img"
                                                            src={qrSrc}
                                                            alt={s.qrAlt(card.user.username)}
                                                            width={136}
                                                            height={136}
                                                            data-testid={`invite-qr-${card.user.username}`}
                                                            sx={{ imageRendering: 'pixelated', display: 'block' }}
                                                        />
                                                    ) : (
                                                        <QrCode2RoundedIcon fontSize="large" color="disabled" />
                                                    )}
                                                </Box>
                                                <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
                                                    <Typography variant="subtitle1" fontWeight={700} noWrap>
                                                        {card.user.displayName}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary" noWrap>
                                                        @{card.user.username}
                                                    </Typography>
                                                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                                        <Chip size="small" color="primary" label={card.user.role.toUpperCase()} />
                                                        <Chip
                                                            size="small"
                                                            variant="outlined"
                                                            label={
                                                                card.user.allowedViews && card.user.allowedViews.length > 0
                                                                    ? card.user.allowedViews.join(', ')
                                                                    : 'All Lanes'
                                                            }
                                                        />
                                                    </Stack>
                                                    {card.temporaryPassword && (
                                                        <Typography variant="caption" sx={{ fontFamily: 'monospace', pt: 0.5 }}>
                                                            Code: <strong>{card.temporaryPassword}</strong>
                                                        </Typography>
                                                    )}
                                                </Stack>
                                            </Stack>

                                            <Divider />

                                            <Box
                                                component="pre"
                                                data-testid={`startup-message-${card.user.username}`}
                                                sx={{
                                                    m: 0,
                                                    p: 1.25,
                                                    bgcolor: 'action.hover',
                                                    borderRadius: 1,
                                                    fontSize: '0.79rem',
                                                    fontFamily: 'monospace',
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word',
                                                }}
                                            >
                                                {message}
                                            </Box>

                                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ displayPrint: 'none' }}>
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    startIcon={<ContentCopyRoundedIcon fontSize="small" />}
                                                    onClick={() => void copyToClipboard(message)}
                                                >
                                                    {s.copyMessageBtn}
                                                </Button>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    onClick={() => void copyToClipboard(enrollUrl)}
                                                >
                                                    {s.copyLinkBtn}
                                                </Button>
                                                {qrSrc && (
                                                    <Button
                                                        size="small"
                                                        variant="text"
                                                        startIcon={<DownloadRoundedIcon fontSize="small" />}
                                                        onClick={() => handleDownloadSingleQr(card)}
                                                    >
                                                        {s.downloadQrBtn}
                                                    </Button>
                                                )}
                                            </Stack>
                                        </Stack>
                                    </CardContent>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            </DialogContent>
            <DialogActions sx={{ displayPrint: 'none' }}>
                <Button variant="contained" onClick={onClose}>
                    {s.closeBtn}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
