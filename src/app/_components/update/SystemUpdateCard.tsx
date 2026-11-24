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
    Paper,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import SystemUpdateAltRoundedIcon from '@mui/icons-material/SystemUpdateAltRounded';
import CloudSyncRoundedIcon from '@mui/icons-material/CloudSyncRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { Locale, useLanguage } from '@/app/contexts/LanguageContext';
import {
    applyGitHubSystemUpdate,
    checkGitHubSystemUpdate,
    fetchSystemUpdateStatus,
    SystemUpdateOfflineError,
    SystemUpdateRestartingError,
    SystemUpdateStatusResponse,
    uploadOfflineReleaseBundle,
} from '@/lib/data/oscar/SystemUpdateApi';
import './SystemUpdateDialog.css';

interface SystemUpdateCopy {
    cardTitle: string;
    cardSubtitle: string;
    zeroLoginBadge: string;
    installedLabel: string;
    agentActiveBadge: string;
    agentInactiveBadge: string;
    diskSpaceBadge: (gib: number) => string;
    checkGitHubBtn: string;
    checkingBtn: string;
    upToDateBanner: (ver: string) => string;
    updateAvailableBanner: (cur: string, next: string) => string;
    sandboxReadOnlyAlert: string;
    bridgeInactiveHint: string;
    releaseNotesTitle: string;
    viewOnGitHubBtn: string;
    sha256Label: string;
    sizeLabel: string;
    backupCheckboxLabel: string;
    installFromGitHubBtn: (ver: string) => string;
    reinstallFromGitHubBtn: (ver: string) => string;
    offlineSectionTitle: string;
    offlineSectionDesc: string;
    chooseZipBtn: string;
    optionalShaLabel: string;
    uploadAndInstallBtn: string;
    stageOnlyBtn: string;
    dialogConfirmTitle: (ver: string) => string;
    dialogConfirmBody: (cur: string, ver: string) => string;
    dialogSafeGuarantees: string[];
    cancelBtn: string;
    confirmStartUpgradeBtn: (ver: string) => string;
    dialogProgressTitle: (ver: string) => string;
    escBlockedNote: string;
    reconnectingStatus: string;
    completedBanner: (ver: string) => string;
    rolledBackBanner: (cur: string) => string;
    reloadConsoleBtn: string;
    closeBtn: string;
    cliFallbackTitle: string;
    stages: Record<string, string>;
}

const UPDATE_COPY: Record<Locale, SystemUpdateCopy> = {
    en: {
        cardTitle: 'Zero-Login GitHub & Offline System Update',
        cardSubtitle:
            'Pull, SHA-256 verify, and install the latest official ORNL/oscar release directly from GitHub with zero GitHub login or token — or upload an offline release .zip on air-gapped portals.',
        zeroLoginBadge: 'No GitHub Login Required',
        installedLabel: 'Installed Version',
        agentActiveBadge: 'Host Update Agent: Active',
        agentInactiveBadge: 'Host Update Agent: CLI Mode',
        diskSpaceBadge: (gib) => `Free Disk: ${gib.toFixed(1)} GiB`,
        checkGitHubBtn: 'Check GitHub for Updates',
        checkingBtn: 'Checking GitHub Releases…',
        upToDateBanner: (ver) => `This OSCAR node is running the latest published GitHub release (${ver}).`,
        updateAvailableBanner: (cur, next) => `Update available: OSCAR ${cur} → ${next} (in-place compatible, zero data loss).`,
        sandboxReadOnlyAlert:
            'You are viewing the disposable :8444 Training Sandbox. System Update modifies the operational portal on HTTPS :443 and is intentionally read-only inside the sandbox.',
        bridgeInactiveHint:
            'To enable 1-click browser installation on this host, run the one-time host bridge command below (or apply the update directly from the CLI).',
        releaseNotesTitle: 'Published Release Summary',
        viewOnGitHubBtn: 'Release Notes on GitHub',
        sha256Label: 'Expected SHA-256 Digest',
        sizeLabel: 'Package Size',
        backupCheckboxLabel: 'Create an encrypted backup snapshot before upgrading',
        installFromGitHubBtn: (ver) => `Download & Install OSCAR ${ver}`,
        reinstallFromGitHubBtn: (ver) => `Re-Verify & Reinstall OSCAR ${ver}`,
        offlineSectionTitle: 'Air-Gapped / Offline Release .zip Upload',
        offlineSectionDesc:
            'On isolated portals without internet access, select an official oscar-<version>.zip (or offline-full .zip) downloaded on another workstation.',
        chooseZipBtn: 'Select Release .zip File',
        optionalShaLabel: 'Optional Expected SHA-256 Checksum (64 hex chars)',
        uploadAndInstallBtn: 'Upload & Install Bundle',
        stageOnlyBtn: 'Upload & Verify Only',
        dialogConfirmTitle: (ver) => `Upgrade OSCAR to Version ${ver}?`,
        dialogConfirmBody: (cur, ver) =>
            `OSCAR will anonymously download oscar-${ver}.zip from ORNL/oscar, verify its SHA-256 cryptographic digest, extract into a clean sibling release directory alongside ${cur}, and restart containers in place.`,
        dialogSafeGuarantees: [
            'No GitHub login, OAuth account, or Personal Access Token is used.',
            'All PostgreSQL observations, Parquet archives, users, Passkeys, TLS certificates, and tunnel settings are retained.',
            'If container startup or HTTPS health checks fail, the host agent automatically rolls back to your current release directory.',
        ],
        cancelBtn: 'Cancel',
        confirmStartUpgradeBtn: (ver) => `Start Upgrade to ${ver}`,
        dialogProgressTitle: (ver) => `Upgrading OSCAR to ${ver}`,
        escBlockedNote: 'Upgrade is actively running on the host; keep this window open while OSCAR restarts and reconnects.',
        reconnectingStatus: 'OSCAR containers are restarting onto the new release — waiting for HTTPS gateway readiness…',
        completedBanner: (ver) => `Upgrade to OSCAR ${ver} completed and verified healthy.`,
        rolledBackBanner: (cur) => `The target upgrade failed health verification and automatically rolled back cleanly to OSCAR ${cur}.`,
        reloadConsoleBtn: 'Reload Console Now',
        closeBtn: 'Close',
        cliFallbackTitle: 'Equivalent Host CLI Commands (Zero GitHub Login)',
        stages: {
            IDLE: 'Idle',
            QUEUED: 'Queued for detached host update agent…',
            CHECKING: 'Checking GitHub Releases metadata and SHA-256 checksum…',
            BACKING_UP: 'Creating encrypted pre-upgrade backup snapshot…',
            DOWNLOADING: 'Downloading release archive from GitHub Releases…',
            VERIFYING_SHA256: 'Verifying SHA-256 cryptographic digest…',
            EXTRACTING: 'Extracting into clean sibling release directory…',
            UPGRADING_CONTAINERS: 'Loading container images and migrating runtime services…',
            WAITING_HEALTHY: 'Verifying HTTPS gateway and SensorHub readiness…',
            RECONNECTING: 'Reconnecting browser session after container cutover…',
            ROLLING_BACK: 'Health check failed — rolling back to previous release…',
            ROLLED_BACK: 'Rolled back cleanly to previous release.',
            COMPLETED: 'Upgrade completed!',
            FAILED: 'Update failed before modifying active containers.',
        },
    },
    es: {
        cardTitle: 'Actualización del sistema desde GitHub (sin inicio de sesión) y sin conexión',
        cardSubtitle:
            'Descargue, verifique con SHA-256 e instale la última versión oficial de ORNL/oscar directamente desde GitHub sin cuenta ni token — o cargue un archivo .zip local en portales aislados.',
        zeroLoginBadge: 'Sin cuenta de GitHub',
        installedLabel: 'Versión instalada',
        agentActiveBadge: 'Agente de actualización: Activo',
        agentInactiveBadge: 'Agente de actualización: Modo CLI',
        diskSpaceBadge: (gib) => `Espacio libre: ${gib.toFixed(1)} GiB`,
        checkGitHubBtn: 'Buscar actualizaciones en GitHub',
        checkingBtn: 'Consultando GitHub Releases…',
        upToDateBanner: (ver) => `Este nodo OSCAR ejecuta la última versión publicada en GitHub (${ver}).`,
        updateAvailableBanner: (cur, next) => `Actualización disponible: OSCAR ${cur} → ${next} (compatible sin pérdida de datos).`,
        sandboxReadOnlyAlert:
            'Está en el entorno de práctica :8444. La actualización del sistema opera en el portal principal (:443).',
        bridgeInactiveHint:
            'Para habilitar la instalación con 1 clic desde el navegador, ejecute una vez el comando del puente del host o actualice por CLI.',
        releaseNotesTitle: 'Resumen de la versión publicada',
        viewOnGitHubBtn: 'Ver notas en GitHub',
        sha256Label: 'Resumen SHA-256 esperado',
        sizeLabel: 'Tamaño del paquete',
        backupCheckboxLabel: 'Crear copia de seguridad cifrada antes de actualizar',
        installFromGitHubBtn: (ver) => `Descargar e instalar OSCAR ${ver}`,
        reinstallFromGitHubBtn: (ver) => `Verificar y reinstalar OSCAR ${ver}`,
        offlineSectionTitle: 'Carga de paquete .zip sin conexión (Air-Gapped)',
        offlineSectionDesc:
            'En portales sin acceso a internet, seleccione un paquete oficial oscar-<versión>.zip descargado previamente.',
        chooseZipBtn: 'Seleccionar archivo .zip',
        optionalShaLabel: 'Suma SHA-256 opcional (64 caracteres hex)',
        uploadAndInstallBtn: 'Cargar e instalar paquete',
        stageOnlyBtn: 'Solo cargar y verificar',
        dialogConfirmTitle: (ver) => `¿Actualizar OSCAR a la versión ${ver}?`,
        dialogConfirmBody: (cur, ver) =>
            `OSCAR descargará oscar-${ver}.zip de ORNL/oscar sin credenciales, verificará su SHA-256, lo extraerá junto a ${cur} y actualizará los contenedores.`,
        dialogSafeGuarantees: [
            'No requiere cuenta de GitHub, OAuth ni token personal.',
            'Se conservan todos los datos PostgreSQL, archivos Parquet, cuentas, Passkeys, certificados TLS y túneles.',
            'Si falla la verificación de salud HTTPS, el agente restaura automáticamente la versión anterior.',
        ],
        cancelBtn: 'Cancelar',
        confirmStartUpgradeBtn: (ver) => `Iniciar actualización a ${ver}`,
        dialogProgressTitle: (ver) => `Actualizando OSCAR a ${ver}`,
        escBlockedNote: 'La actualización está en curso; mantenga esta ventana abierta mientras OSCAR se reinicia.',
        reconnectingStatus: 'Reiniciando contenedores OSCAR — esperando disponibilidad HTTPS…',
        completedBanner: (ver) => `Actualización a OSCAR ${ver} completada y verificada.`,
        rolledBackBanner: (cur) => `La actualización falló la prueba de salud y volvió automáticamente a OSCAR ${cur}.`,
        reloadConsoleBtn: 'Recargar consola ahora',
        closeBtn: 'Cerrar',
        cliFallbackTitle: 'Comandos CLI equivalentes en el host',
        stages: {
            IDLE: 'Inactivo',
            QUEUED: 'En cola para el agente del host…',
            CHECKING: 'Verificando metadatos y SHA-256 en GitHub Releases…',
            BACKING_UP: 'Creando copia de seguridad cifrada previa…',
            DOWNLOADING: 'Descargando paquete desde GitHub Releases…',
            VERIFYING_SHA256: 'Verificando firma criptográfica SHA-256…',
            EXTRACTING: 'Extrayendo en directorio limpio paralelo…',
            UPGRADING_CONTAINERS: 'Actualizando imágenes y contenedores en el host…',
            WAITING_HEALTHY: 'Verificando disponibilidad HTTPS…',
            RECONNECTING: 'Reconectando sesión del navegador tras el reinicio…',
            ROLLING_BACK: 'Restaurando automáticamente la versión anterior…',
            ROLLED_BACK: 'Restaurado a la versión anterior.',
            COMPLETED: '¡Actualización completada!',
            FAILED: 'Error antes de modificar los contenedores activos.',
        },
    },
    fr: {
        cardTitle: 'Mise à jour système GitHub (sans connexion) et hors ligne',
        cardSubtitle:
            'Téléchargez, vérifiez par SHA-256 et installez la dernière version officielle ORNL/oscar depuis GitHub sans compte ni jeton — ou importez une archive .zip hors ligne.',
        zeroLoginBadge: 'Aucun compte GitHub requis',
        installedLabel: 'Version installée',
        agentActiveBadge: 'Agent de mise à jour : Actif',
        agentInactiveBadge: 'Agent de mise à jour : Mode CLI',
        diskSpaceBadge: (gib) => `Disque libre : ${gib.toFixed(1)} Gio`,
        checkGitHubBtn: 'Vérifier les mises à jour sur GitHub',
        checkingBtn: 'Vérification de GitHub Releases…',
        upToDateBanner: (ver) => `Ce nœud OSCAR exécute déjà la dernière version publiée sur GitHub (${ver}).`,
        updateAvailableBanner: (cur, next) => `Mise à jour disponible : OSCAR ${cur} → ${next} (sans perte de données).`,
        sandboxReadOnlyAlert:
            'Vous êtes dans le bac à sable :8444. La mise à jour système opère uniquement sur le portail opérationnel (:443).',
        bridgeInactiveHint:
            'Pour activer l’installation en 1 clic depuis le navigateur, exécutez la commande d’activation ci-dessous ou utilisez le CLI.',
        releaseNotesTitle: 'Résumé de la version publiée',
        viewOnGitHubBtn: 'Notes sur GitHub',
        sha256Label: 'Empreinte SHA-256 attendue',
        sizeLabel: 'Taille de l’archive',
        backupCheckboxLabel: 'Créer une sauvegarde chiffrée avant la mise à jour',
        installFromGitHubBtn: (ver) => `Télécharger et installer OSCAR ${ver}`,
        reinstallFromGitHubBtn: (ver) => `Revérifier et réinstaller OSCAR ${ver}`,
        offlineSectionTitle: 'Importation d’archive .zip hors ligne (Air-Gapped)',
        offlineSectionDesc:
            'Sur les portails isolés d’Internet, sélectionnez une archive officielle oscar-<version>.zip.',
        chooseZipBtn: 'Choisir le fichier .zip',
        optionalShaLabel: 'Empreinte SHA-256 attendue (optionnel, 64 hex)',
        uploadAndInstallBtn: 'Importer et installer',
        stageOnlyBtn: 'Importer et vérifier uniquement',
        dialogConfirmTitle: (ver) => `Mettre à jour OSCAR vers ${ver} ?`,
        dialogConfirmBody: (cur, ver) =>
            `OSCAR téléchargera anonymement oscar-${ver}.zip depuis ORNL/oscar, contrôlera son SHA-256, l’extraira à côté de ${cur} et redémarrera les conteneurs.`,
        dialogSafeGuarantees: [
            'Aucun identifiant GitHub, OAuth ou jeton personnel n’est requis.',
            'Toutes les observations PostgreSQL, archives Parquet, comptes, Passkeys et certificats TLS sont préservés.',
            'En cas d’échec du contrôle de santé HTTPS, retour automatique immédiat vers la version précédente.',
        ],
        cancelBtn: 'Annuler',
        confirmStartUpgradeBtn: (ver) => `Lancer la mise à jour vers ${ver}`,
        dialogProgressTitle: (ver) => `Mise à jour d’OSCAR vers ${ver}`,
        escBlockedNote: 'La mise à jour est en cours sur l’hôte ; gardez cette fenêtre ouverte pendant le redémarrage.',
        reconnectingStatus: 'Redémarrage des conteneurs OSCAR — attente de disponibilité HTTPS…',
        completedBanner: (ver) => `Mise à jour vers OSCAR ${ver} terminée et vérifiée.`,
        rolledBackBanner: (cur) => `Échec du contrôle de santé ; retour automatique réussi vers OSCAR ${cur}.`,
        reloadConsoleBtn: 'Recharger la console',
        closeBtn: 'Fermer',
        cliFallbackTitle: 'Commandes CLI équivalentes sur l’hôte',
        stages: {
            IDLE: 'Inactif',
            QUEUED: 'En file d’attente pour l’agent hôte…',
            CHECKING: 'Vérification des métadonnées et du SHA-256 sur GitHub…',
            BACKING_UP: 'Création d’une sauvegarde chiffrée préalable…',
            DOWNLOADING: 'Téléchargement de l’archive depuis GitHub Releases…',
            VERIFYING_SHA256: 'Vérification de l’empreinte SHA-256…',
            EXTRACTING: 'Extraction dans un répertoire parallèle propre…',
            UPGRADING_CONTAINERS: 'Mise à niveau des images et conteneurs…',
            WAITING_HEALTHY: 'Vérification de disponibilité HTTPS…',
            RECONNECTING: 'Reconnexion de la session navigateur…',
            ROLLING_BACK: 'Retour automatique vers la version précédente…',
            ROLLED_BACK: 'Version précédente restaurée.',
            COMPLETED: 'Mise à jour terminée !',
            FAILED: 'Échec avant modification des conteneurs.',
        },
    },
    el: {
        cardTitle: 'Ενημέρωση συστήματος από GitHub (χωρίς σύνδεση λογαριασμού) & εκτός σύνδεσης',
        cardSubtitle:
            'Λήψη, επαλήθευση SHA-256 και εγκατάσταση της νεότερης επίσημης έκδοσης ORNL/oscar απευθείας από το GitHub χωρίς λογαριασμό ή διακριτικό — ή μεταφόρτωση αρχείου .zip εκτός σύνδεσης.',
        zeroLoginBadge: 'Χωρίς σύνδεση GitHub',
        installedLabel: 'Εγκατεστημένη έκδοση',
        agentActiveBadge: 'Υπηρεσία ενημέρωσης: Ενεργή',
        agentInactiveBadge: 'Υπηρεσία ενημέρωσης: Λειτουργία CLI',
        diskSpaceBadge: (gib) => `Ελεύθερος χώρος: ${gib.toFixed(1)} GiB`,
        checkGitHubBtn: 'Έλεγχος GitHub για ενημερώσεις',
        checkingBtn: 'Έλεγχος εκδόσεων GitHub…',
        upToDateBanner: (ver) => `Αυτός ο κόμβος OSCAR εκτελεί την τελευταία δημοσιευμένη έκδοση GitHub (${ver}).`,
        updateAvailableBanner: (cur, next) => `Διαθέσιμη ενημέρωση: OSCAR ${cur} → ${next} (συμβατή χωρίς απώλεια δεδομένων).`,
        sandboxReadOnlyAlert:
            'Βρίσκεστε στο περιβάλλον εξάσκησης :8444. Η ενημέρωση συστήματος εκτελείται μόνο στην κύρια πύλη (:443).',
        bridgeInactiveHint:
            'Για εγκατάσταση με 1 κλικ από το πρόγραμμα περιήγησης, ενεργοποιήστε τη γέφυρα κεντρικού συστήματος παρακάτω ή χρησιμοποιήστε το CLI.',
        releaseNotesTitle: 'Σύνοψη δημοσιευμένης έκδοσης',
        viewOnGitHubBtn: 'Σημειώσεις έκδοσης στο GitHub',
        sha256Label: 'Αναμενόμενο SHA-256',
        sizeLabel: 'Μέγεθος πακέτου',
        backupCheckboxLabel: 'Δημιουργία κρυπτογραφημένου αντιγράφου ασφαλείας πριν από την αναβάθμιση',
        installFromGitHubBtn: (ver) => `Λήψη & εγκατάσταση OSCAR ${ver}`,
        reinstallFromGitHubBtn: (ver) => `Επαλήθευση & επανεγκατάσταση OSCAR ${ver}`,
        offlineSectionTitle: 'Μεταφόρτωση πακέτου .zip εκτός σύνδεσης (Air-Gapped)',
        offlineSectionDesc:
            'Σε απομονωμένες πύλες χωρίς πρόσβαση στο διαδίκτυο, επιλέξτε επίσημο αρχείο oscar-<έκδοση>.zip.',
        chooseZipBtn: 'Επιλογή αρχείου .zip',
        optionalShaLabel: 'Προαιρετικό SHA-256 (64 δεκαεξαδικοί χαρακτήρες)',
        uploadAndInstallBtn: 'Μεταφόρτωση & εγκατάσταση',
        stageOnlyBtn: 'Μόνο μεταφόρτωση & επαλήθευση',
        dialogConfirmTitle: (ver) => `Αναβάθμιση του OSCAR στην έκδοση ${ver};`,
        dialogConfirmBody: (cur, ver) =>
            `Το OSCAR θα πραγματοποιήσει ανώνυμη λήψη του oscar-${ver}.zip από το ORNL/oscar, θα επαληθεύσει το SHA-256, θα το εξαγάγει δίπλα στην ${cur} και θα επανεκκινήσει τα κοντέινερ.`,
        dialogSafeGuarantees: [
            'Δεν απαιτείται λογαριασμός GitHub, OAuth ή προσωπικό διακριτικό (PAT).',
            'Διατηρούνται όλα τα δεδομένα PostgreSQL, αρχεία Parquet, χρήστες, Passkeys και πιστοποιητικά TLS.',
            'Σε περίπτωση αποτυχίας ελέγχου υγείας HTTPS, γίνεται αυτόματη επαναφορά στην προηγούμενη έκδοση.',
        ],
        cancelBtn: 'Ακύρωση',
        confirmStartUpgradeBtn: (ver) => `Έναρξη αναβάθμισης σε ${ver}`,
        dialogProgressTitle: (ver) => `Αναβάθμιση OSCAR σε ${ver}`,
        escBlockedNote: 'Η αναβάθμιση βρίσκεται σε εξέλιξη· κρατήστε αυτό το παράθυρο ανοιχτό κατά την επανεκκίνηση.',
        reconnectingStatus: 'Επανεκκίνηση κοντέινερ OSCAR — αναμονή ετοιμότητας HTTPS…',
        completedBanner: (ver) => `Η αναβάθμιση σε OSCAR ${ver} ολοκληρώθηκε επιτυχώς.`,
        rolledBackBanner: (cur) => `Η αναβάθμιση απέτυχε στον έλεγχο υγείας και επανήλθε αυτόματα στο OSCAR ${cur}.`,
        reloadConsoleBtn: 'Επαναφόρτωση κονσόλας τώρα',
        closeBtn: 'Κλείσιμο',
        cliFallbackTitle: 'Ισοδύναμες εντολές CLI κεντρικού συστήματος',
        stages: {
            IDLE: 'Αδράνεια',
            QUEUED: 'Σε ουρά για την υπηρεσία κεντρικού συστήματος…',
            CHECKING: 'Έλεγχος μεταδεδομένων και SHA-256 στο GitHub…',
            BACKING_UP: 'Δημιουργία κρυπτογραφημένου αντιγράφου ασφαλείας…',
            DOWNLOADING: 'Λήψη πακέτου από το GitHub Releases…',
            VERIFYING_SHA256: 'Επαλήθευση SHA-256…',
            EXTRACTING: 'Εξαγωγή σε καθαρό παράλληλο κατάλογο…',
            UPGRADING_CONTAINERS: 'Αναβάθμιση εικόνων και κοντέινερ…',
            WAITING_HEALTHY: 'Επαλήθευση ετοιμότητας HTTPS…',
            RECONNECTING: 'Επανασύνδεση συνεδρίας προγράμματος περιήγησης…',
            ROLLING_BACK: 'Αυτόματη επαναφορά προηγούμενης έκδοσης…',
            ROLLED_BACK: 'Επαναφέρθηκε στην προηγούμενη έκδοση.',
            COMPLETED: 'Η αναβάθμιση ολοκληρώθηκε!',
            FAILED: 'Αποτυχία πριν από την τροποποίηση κοντέινερ.',
        },
    },
};

function formatMegabytes(bytes?: number): string {
    if (!bytes || bytes <= 0) return '—';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export interface SystemUpdateCardProps {
    isAdmin: boolean;
}

export default function SystemUpdateCard({ isAdmin }: SystemUpdateCardProps) {
    const { language } = useLanguage();
    const copy = UPDATE_COPY[language] || UPDATE_COPY.en;

    const [status, setStatus] = React.useState<SystemUpdateStatusResponse | null>(null);
    const [loadingStatus, setLoadingStatus] = React.useState(true);
    const [checkingGitHub, setCheckingGitHub] = React.useState(false);
    const [uploadingZip, setUploadingZip] = React.useState(false);
    const [createBackupFirst, setCreateBackupFirst] = React.useState(false);
    const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
    const [expectedUploadSha, setExpectedUploadSha] = React.useState('');
    const [alertMessage, setAlertMessage] = React.useState<{
        severity: 'info' | 'success' | 'warning' | 'error';
        text: string;
    } | null>(null);

    // Native <dialog> modal state: 'closed' | 'confirm' | 'progress'
    const dialogRef = React.useRef<HTMLDialogElement | null>(null);
    const cancelBtnRef = React.useRef<HTMLButtonElement | null>(null);
    const [dialogPhase, setDialogPhase] = React.useState<'closed' | 'confirm' | 'progress'>('closed');
    const [pendingTargetVersion, setPendingTargetVersion] = React.useState('');
    const [pendingExpectedSha, setPendingExpectedSha] = React.useState('');
    const [reconnecting, setReconnecting] = React.useState(false);
    const [escAttemptNote, setEscAttemptNote] = React.useState(false);
    const sawContainerRestartRef = React.useRef(false);

    const isActivelyUpgrading =
        dialogPhase === 'progress' &&
        (reconnecting || status?.state === 'QUEUED' || status?.state === 'RUNNING');

    const loadStatus = React.useCallback(async () => {
        if (!isAdmin) return;
        try {
            const s = await fetchSystemUpdateStatus();
            setStatus(s);
            if (s.backupPossible) {
                setCreateBackupFirst(true);
            }
            if (s.state === 'RUNNING' || s.state === 'QUEUED') {
                setPendingTargetVersion(s.targetVersion || s.latestRelease?.latestVersion || '');
                setDialogPhase('progress');
            }
        } catch (err: any) {
            setAlertMessage({ severity: 'error', text: err?.message || 'Could not load system update status.' });
        } finally {
            setLoadingStatus(false);
        }
    }, [isAdmin]);

    React.useEffect(() => {
        void loadStatus();
    }, [loadStatus]);

    // Synchronize React dialogPhase with native HTML <dialog>.showModal() / .close()
    React.useEffect(() => {
        const dlg = dialogRef.current;
        if (!dlg) return;
        if (dialogPhase !== 'closed') {
            if (!dlg.open) {
                dlg.showModal();
                if (dialogPhase === 'confirm') {
                    cancelBtnRef.current?.focus();
                }
            }
        } else if (dlg.open) {
            dlg.close();
        }
    }, [dialogPhase]);

    // Modern Web Guidance: reset returnValue on close & guard accidental Esc during live upgrade
    React.useEffect(() => {
        const dlg = dialogRef.current;
        if (!dlg) return;

        const handleCancel = (e: Event) => {
            if (isActivelyUpgrading) {
                e.preventDefault();
                setEscAttemptNote(true);
            }
        };
        const handleClose = () => {
            dlg.returnValue = '';
            setEscAttemptNote(false);
            if (!isActivelyUpgrading) {
                setDialogPhase('closed');
            }
        };

        dlg.addEventListener('cancel', handleCancel);
        dlg.addEventListener('close', handleClose);
        return () => {
            dlg.removeEventListener('cancel', handleCancel);
            dlg.removeEventListener('close', handleClose);
        };
    }, [isActivelyUpgrading]);

    // Poll status + handle seamless post-restart browser reconnection during active upgrade
    React.useEffect(() => {
        if (dialogPhase !== 'progress') return undefined;
        let cancelled = false;

        const tick = async () => {
            try {
                const next = await fetchSystemUpdateStatus();
                if (cancelled) return;
                setReconnecting(false);
                setStatus(next);

                if (
                    sawContainerRestartRef.current &&
                    pendingTargetVersion &&
                    next.currentVersion === pendingTargetVersion &&
                    next.state !== 'RUNNING'
                ) {
                    setStatus({
                        ...next,
                        state: 'COMPLETED',
                        stage: 'COMPLETED',
                        progressPercent: 100,
                    });
                }
            } catch (err) {
                if (cancelled) return;
                if (err instanceof SystemUpdateRestartingError) {
                    sawContainerRestartRef.current = true;
                    setReconnecting(true);
                }
            }
        };

        const timer = window.setInterval(() => {
            void tick();
        }, 2000);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [dialogPhase, pendingTargetVersion]);

    if (!isAdmin) {
        return null;
    }

    const handleCheckGitHub = async () => {
        setCheckingGitHub(true);
        setAlertMessage(null);
        try {
            const updated = await checkGitHubSystemUpdate(true);
            setStatus(updated);
        } catch (err: any) {
            if (err instanceof SystemUpdateOfflineError) {
                if (err.statusPayload) {
                    setStatus(err.statusPayload);
                }
                setAlertMessage({ severity: 'warning', text: err.message });
            } else {
                setAlertMessage({ severity: 'error', text: err?.message || 'GitHub update check failed.' });
            }
        } finally {
            setCheckingGitHub(false);
        }
    };

    const openConfirmDialog = (targetVer: string, expectedSha?: string) => {
        setPendingTargetVersion(targetVer);
        setPendingExpectedSha(expectedSha || '');
        setEscAttemptNote(false);
        setDialogPhase('confirm');
    };

    const handleConfirmGitHubUpgrade = async () => {
        setAlertMessage(null);
        sawContainerRestartRef.current = false;
        setReconnecting(false);
        try {
            const started = await applyGitHubSystemUpdate({
                targetVersion: pendingTargetVersion,
                expectedSha256: pendingExpectedSha,
                createBackupFirst,
            });
            setStatus(started);
            setDialogPhase('progress');
        } catch (err: any) {
            setDialogPhase('closed');
            setAlertMessage({ severity: 'error', text: err?.message || 'Could not start upgrade.' });
        }
    };

    const handleOfflineUpload = async (applyImmediately: boolean) => {
        if (!selectedFile) return;
        setUploadingZip(true);
        setAlertMessage(null);
        sawContainerRestartRef.current = false;
        setReconnecting(false);
        try {
            const res = await uploadOfflineReleaseBundle({
                file: selectedFile,
                expectedSha256: expectedUploadSha,
                createBackupFirst,
                applyImmediately,
            });
            setStatus(res);
            if (res.stagedOnly) {
                setAlertMessage({
                    severity: 'success',
                    text: `Verified and staged ${res.stagedFileName} (version ${res.stagedVersion}, SHA-256 ${res.stagedSha256?.slice(0, 16)}…).`,
                });
            } else {
                setPendingTargetVersion(res.targetVersion || res.stagedVersion || '');
                setDialogPhase('progress');
            }
        } catch (err: any) {
            setAlertMessage({ severity: 'error', text: err?.message || 'Offline bundle upload failed.' });
        } finally {
            setUploadingZip(false);
        }
    };

    const curVer = status?.currentVersion || '3.11.11';
    const rel = status?.latestRelease;
    const activeStageKey = reconnecting ? 'RECONNECTING' : (status?.stage || status?.state || 'IDLE');
    const activeStageLabel = copy.stages[activeStageKey] || status?.message || activeStageKey;
    const isDeterminateProgress = !reconnecting && typeof status?.progressPercent === 'number' && status.progressPercent > 0;
    const canOneClickApply = Boolean(status?.agentActive && status?.guiUpdateEnabled && !status?.sandboxMode);

    return (
        <Stack spacing={2.5} data-testid="system-update-card">
            <Card variant="outlined">
                <CardContent>
                    <Stack spacing={2.25}>
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            justifyContent="space-between"
                            alignItems={{ sm: 'flex-start' }}
                            spacing={1.5}
                        >
                            <Box>
                                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                    <SystemUpdateAltRoundedIcon color="primary" />
                                    <Typography variant="h6" fontWeight={700}>
                                        {copy.cardTitle}
                                    </Typography>
                                    <Chip
                                        icon={<VerifiedRoundedIcon />}
                                        size="small"
                                        color="success"
                                        variant="outlined"
                                        label={copy.zeroLoginBadge}
                                        data-testid="system-update-zero-login-badge"
                                    />
                                </Stack>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                    {copy.cardSubtitle}
                                </Typography>
                            </Box>

                            <Button
                                variant="contained"
                                startIcon={<CloudSyncRoundedIcon />}
                                disabled={checkingGitHub || loadingStatus}
                                onClick={handleCheckGitHub}
                                data-testid="system-update-check-btn"
                                sx={{ flexShrink: 0 }}
                            >
                                {checkingGitHub ? copy.checkingBtn : copy.checkGitHubBtn}
                            </Button>
                        </Stack>

                        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                            <Chip
                                color="primary"
                                label={`${copy.installedLabel}: ${curVer}`}
                                data-testid="system-update-installed-chip"
                            />
                            <Chip
                                color={status?.agentActive ? 'success' : 'default'}
                                variant="outlined"
                                label={status?.agentActive ? copy.agentActiveBadge : copy.agentInactiveBadge}
                            />
                            {status && (
                                <Chip
                                    variant="outlined"
                                    label={copy.diskSpaceBadge(status.availableDiskGib)}
                                />
                            )}
                        </Stack>

                        {status?.sandboxMode && (
                            <Alert severity="info" data-testid="system-update-sandbox-alert">
                                {copy.sandboxReadOnlyAlert}
                            </Alert>
                        )}

                        {alertMessage && (
                            <Alert severity={alertMessage.severity} onClose={() => setAlertMessage(null)}>
                                {alertMessage.text}
                            </Alert>
                        )}

                        {rel && (
                            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }} data-testid="system-update-release-panel">
                                <Stack spacing={1.75}>
                                    <Alert severity={rel.updateAvailable ? 'info' : 'success'}>
                                        {rel.updateAvailable
                                            ? copy.updateAvailableBanner(curVer, rel.latestVersion)
                                            : copy.upToDateBanner(rel.latestVersion)}
                                    </Alert>

                                    <Grid container spacing={2}>
                                        <Grid item xs={12} md={8}>
                                            <Typography variant="subtitle2" fontWeight={700}>
                                                {rel.releaseTitle} ({rel.tagName})
                                            </Typography>
                                            {rel.expectedSha256 && (
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    sx={{ display: 'block', fontFamily: 'monospace', wordBreak: 'break-all', mt: 0.5 }}
                                                    data-testid="system-update-expected-sha256"
                                                >
                                                    {copy.sha256Label}: {rel.expectedSha256}
                                                </Typography>
                                            )}
                                            {rel.downloadBytes ? (
                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                                                    {copy.sizeLabel}: {formatMegabytes(rel.downloadBytes)} ({rel.assetFileName})
                                                </Typography>
                                            ) : null}
                                        </Grid>
                                        <Grid item xs={12} md={4}>
                                            <Stack spacing={1} alignItems={{ md: 'flex-end' }}>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    endIcon={<OpenInNewRoundedIcon fontSize="small" />}
                                                    href={rel.releasePageUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    {copy.viewOnGitHubBtn}
                                                </Button>
                                            </Stack>
                                        </Grid>
                                    </Grid>

                                    {rel.notesSummary && (
                                        <Box
                                            sx={{
                                                maxHeight: 180,
                                                overflowY: 'auto',
                                                p: 1.5,
                                                borderRadius: 1,
                                                bgcolor: 'action.hover',
                                                fontFamily: 'inherit',
                                                whiteSpace: 'pre-wrap',
                                                fontSize: '0.84rem',
                                            }}
                                        >
                                            <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>
                                                {copy.releaseNotesTitle}
                                            </Typography>
                                            {rel.notesSummary}
                                        </Box>
                                    )}

                                    {status?.backupPossible && (
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={createBackupFirst}
                                                    onChange={(_e, checked) => setCreateBackupFirst(checked)}
                                                />
                                            }
                                            label={copy.backupCheckboxLabel}
                                        />
                                    )}

                                    {!status?.agentActive && !status?.sandboxMode && (
                                        <Alert severity="warning">{copy.bridgeInactiveHint}</Alert>
                                    )}

                                    <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                                        <Button
                                            variant={rel.updateAvailable ? 'contained' : 'outlined'}
                                            color="primary"
                                            startIcon={<SystemUpdateAltRoundedIcon />}
                                            disabled={!canOneClickApply || !rel.inPlaceCompatible || !rel.assetAvailable}
                                            onClick={() => openConfirmDialog(rel.latestVersion, rel.expectedSha256)}
                                            data-testid="system-update-open-confirm-btn"
                                        >
                                            {rel.updateAvailable
                                                ? copy.installFromGitHubBtn(rel.latestVersion)
                                                : copy.reinstallFromGitHubBtn(rel.latestVersion)}
                                        </Button>
                                    </Stack>
                                </Stack>
                            </Paper>
                        )}

                        <Divider />

                        {/* Air-Gapped / Offline .zip Bundle Upload */}
                        <Box>
                            <Typography variant="subtitle1" fontWeight={700}>
                                {copy.offlineSectionTitle}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                {copy.offlineSectionDesc}
                            </Typography>

                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
                                <Button
                                    component="label"
                                    variant="outlined"
                                    startIcon={<UploadFileRoundedIcon />}
                                    disabled={Boolean(status?.sandboxMode) || uploadingZip}
                                    data-testid="system-update-select-zip-btn"
                                >
                                    {selectedFile ? selectedFile.name : copy.chooseZipBtn}
                                    <input
                                        hidden
                                        type="file"
                                        accept=".zip,application/zip"
                                        data-testid="system-update-zip-input"
                                        onChange={(e) => {
                                            const f = e.target.files?.[0] || null;
                                            setSelectedFile(f);
                                        }}
                                    />
                                </Button>

                                <TextField
                                    size="small"
                                    label={copy.optionalShaLabel}
                                    value={expectedUploadSha}
                                    onChange={(e) => setExpectedUploadSha(e.target.value)}
                                    inputProps={{
                                        maxLength: 64,
                                        spellCheck: false,
                                        autoCapitalize: 'none',
                                        autoCorrect: 'off',
                                        'data-testid': 'system-update-upload-sha-input',
                                    }}
                                    sx={{ flex: 1, minWidth: 260 }}
                                />

                                <Button
                                    variant="contained"
                                    disabled={!selectedFile || uploadingZip || !canOneClickApply}
                                    onClick={() => void handleOfflineUpload(true)}
                                    data-testid="system-update-upload-install-btn"
                                >
                                    {copy.uploadAndInstallBtn}
                                </Button>
                                <Button
                                    variant="outlined"
                                    disabled={!selectedFile || uploadingZip || Boolean(status?.sandboxMode)}
                                    onClick={() => void handleOfflineUpload(false)}
                                    data-testid="system-update-upload-stage-btn"
                                >
                                    {copy.stageOnlyBtn}
                                </Button>
                            </Stack>
                        </Box>

                        <Divider />

                        {/* Host CLI Reference */}
                        <Box>
                            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                                {copy.cliFallbackTitle}
                            </Typography>
                            <Grid container spacing={1.5}>
                                <Grid item xs={12} md={6}>
                                    <Paper variant="outlined" sx={{ p: 1.25, fontFamily: 'monospace', fontSize: '0.78rem' }}>
                                        <div># Ubuntu 24.04 LTS</div>
                                        <div>{status?.linuxCheckCommand || 'sudo bash oscar.sh update check'}</div>
                                        <div>{status?.linuxUpgradeCommand || 'sudo bash oscar.sh update apply'}</div>
                                    </Paper>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Paper variant="outlined" sx={{ p: 1.25, fontFamily: 'monospace', fontSize: '0.78rem' }}>
                                        <div># Windows 11 (Administrator)</div>
                                        <div>{status?.windowsCheckCommand || '.\\oscar.bat update check'}</div>
                                        <div>{status?.windowsUpgradeCommand || '.\\oscar.bat update apply'}</div>
                                    </Paper>
                                </Grid>
                            </Grid>
                        </Box>
                    </Stack>
                </CardContent>
            </Card>

            {/* Native HTML <dialog> opened via .showModal() (Modern Web Guidance compliant) */}
            <dialog
                ref={dialogRef}
                className="oscar-update-dialog"
                aria-labelledby="system-update-dialog-title"
                data-testid="system-update-native-dialog"
            >
                {dialogPhase === 'confirm' && (
                    <Box sx={{ p: 3 }}>
                        <Stack spacing={2}>
                            <Typography id="system-update-dialog-title" variant="h6" fontWeight={700}>
                                {copy.dialogConfirmTitle(pendingTargetVersion)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {copy.dialogConfirmBody(curVer, pendingTargetVersion)}
                            </Typography>
                            <Box component="ul" sx={{ pl: 2.5, m: 0, fontSize: '0.875rem' }}>
                                {copy.dialogSafeGuarantees.map((line, idx) => (
                                    <li key={idx} style={{ marginBottom: 6 }}>
                                        {line}
                                    </li>
                                ))}
                            </Box>
                            <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ pt: 1 }}>
                                <Button
                                    ref={cancelBtnRef}
                                    autoFocus
                                    variant="outlined"
                                    onClick={() => setDialogPhase('closed')}
                                    data-testid="system-update-cancel-btn"
                                >
                                    {copy.cancelBtn}
                                </Button>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={() => void handleConfirmGitHubUpgrade()}
                                    data-testid="system-update-confirm-start-btn"
                                >
                                    {copy.confirmStartUpgradeBtn(pendingTargetVersion)}
                                </Button>
                            </Stack>
                        </Stack>
                    </Box>
                )}

                {dialogPhase === 'progress' && (
                    <Box sx={{ p: 3 }}>
                        <Stack spacing={2}>
                            <Typography id="system-update-dialog-title" variant="h6" fontWeight={700}>
                                {copy.dialogProgressTitle(pendingTargetVersion || curVer)}
                            </Typography>

                            <Box>
                                <Typography
                                    id="system-update-progress-label"
                                    variant="body2"
                                    fontWeight={600}
                                    sx={{ mb: 1 }}
                                >
                                    {reconnecting ? copy.reconnectingStatus : activeStageLabel}
                                </Typography>
                                {isDeterminateProgress ? (
                                    <progress
                                        className="oscar-update-progress"
                                        aria-labelledby="system-update-progress-label"
                                        max={100}
                                        value={status?.progressPercent ?? 0}
                                        data-testid="system-update-native-progress"
                                    />
                                ) : (
                                    <progress
                                        className="oscar-update-progress"
                                        aria-labelledby="system-update-progress-label"
                                        max={100}
                                        data-testid="system-update-native-progress"
                                    />
                                )}
                            </Box>

                            <Box role="status" aria-live="polite">
                                {status?.state === 'COMPLETED' && !reconnecting && (
                                    <Alert severity="success" data-testid="system-update-completed-alert">
                                        {copy.completedBanner(pendingTargetVersion || status.currentVersion)}
                                    </Alert>
                                )}
                                {status?.state === 'ROLLED_BACK' && (
                                    <Alert severity="warning" data-testid="system-update-rolledback-alert">
                                        {copy.rolledBackBanner(status.currentVersion)}
                                    </Alert>
                                )}
                                {status?.state === 'FAILED' && (
                                    <Alert severity="error" data-testid="system-update-failed-alert">
                                        {status.message || copy.stages.FAILED}
                                    </Alert>
                                )}
                            </Box>

                            {escAttemptNote && isActivelyUpgrading && (
                                <Alert severity="info">{copy.escBlockedNote}</Alert>
                            )}

                            {status?.logTail && (
                                <Box
                                    sx={{
                                        maxHeight: 150,
                                        overflowY: 'auto',
                                        p: 1.25,
                                        borderRadius: 1,
                                        bgcolor: 'rgba(15, 23, 42, 0.75)',
                                        color: '#e2e8f0',
                                        fontFamily: 'monospace',
                                        fontSize: '0.75rem',
                                        whiteSpace: 'pre-wrap',
                                    }}
                                >
                                    {status.logTail}
                                </Box>
                            )}

                            <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ pt: 1 }}>
                                {status?.state === 'COMPLETED' && !reconnecting && (
                                    <Button
                                        variant="contained"
                                        color="success"
                                        startIcon={<RefreshRoundedIcon />}
                                        onClick={() => window.location.reload()}
                                        data-testid="system-update-reload-btn"
                                    >
                                        {copy.reloadConsoleBtn}
                                    </Button>
                                )}
                                {!isActivelyUpgrading && (
                                    <Button
                                        variant="outlined"
                                        onClick={() => setDialogPhase('closed')}
                                        data-testid="system-update-close-progress-btn"
                                    >
                                        {copy.closeBtn}
                                    </Button>
                                )}
                            </Stack>
                        </Stack>
                    </Box>
                )}
            </dialog>
        </Stack>
    );
}
