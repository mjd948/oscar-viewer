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
    Typography,
} from '@mui/material';
import UsbRoundedIcon from '@mui/icons-material/UsbRounded';
import EjectRoundedIcon from '@mui/icons-material/EjectRounded';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { Locale, useLanguage } from '@/app/contexts/LanguageContext';
import { getIntlLocale } from '@/app/utils/LocaleUtils';
import { fetchCurrentSession, OscarSessionInfo } from '@/lib/data/oscar/AuthSessionApi';
import {
    downloadUsbBackupEscrowKey,
    fetchUsbBackupStatus,
    submitUsbBackupAction,
    UsbBackupMode,
    UsbBackupStatusResponse,
    UsbCandidateDrive,
} from '@/lib/data/oscar/UsbBackupApi';
import './UsbBackupManager.css';

interface UsbUiStrings {
    pageTitle: string;
    pageSubtitle: string;
    adminRequired: string;
    loadingProgressLabel: string;
    activeJobProgressLabel: string;
    agentInactiveWarning: string;
    statusSectionTitle: string;
    actionsSectionTitle: string;
    modeSectionTitle: string;
    setupSectionTitle: string;
    fieldGuideTitle: string;
    stateBadges: {
        ATTACHED: string;
        SAFE_TO_UNPLUG: string;
        DETACHED: string;
        UNCONFIGURED: string;
    };
    safeToUnplugBannerTitle: string;
    safeToUnplugBannerBody: string;
    detachedBannerTitle: string;
    detachedBannerBody: string;
    unconfiguredBannerBody: string;
    safelyEjectBtn: string;
    reattachSyncBtn: string;
    syncNowBtn: string;
    verifyQuickBtn: string;
    verifyDeepBtn: string;
    downloadKeyBtn: string;
    refreshDrivesBtn: string;
    keyEscrowHint: string;
    keyDownloadedStatus: string;
    latestSnapshotHeading: string;
    noSnapshotYet: string;
    snapshotIdLabel: string;
    snapshotTimeLabel: string;
    postgresLsnLabel: string;
    archivePacksLabel: string;
    statePacksLabel: string;
    trackedFilesLabel: string;
    mountPathLabel: string;
    capacityLabel: string;
    modeLegend: string;
    modeContinualTitle: string;
    modeContinualDesc: string;
    modeOccasionalTitle: string;
    modeOccasionalDesc: string;
    modeDisabledTitle: string;
    modeDisabledDesc: string;
    intervalMinutesLabel: string;
    saveModeBtn: string;
    selectDriveLabel: string;
    noCandidateDrives: string;
    protectedDisksNote: string;
    filesystemLabel: string;
    fsNtfsOption: string;
    fsExt4Option: string;
    adoptWithoutFormatLabel: string;
    openFormatDialogBtn: string;
    adoptDriveBtn: string;
    dialogTitle: string;
    dialogWarningBody: (driveLabel: string, fs: string) => string;
    dialogConfirmInputLabel: string;
    dialogConfirmError: string;
    cancelBtn: string;
    confirmFormatSubmitBtn: string;
    copyBtn: string;
    copiedStatus: string;
    fieldStep1: string;
    fieldStep2: string;
    fieldStep3: string;
}

const USB_COPY: Record<Locale, UsbUiStrings> = {
    en: {
        pageTitle: 'Continual & Occasional USB NVMe Backups',
        pageSubtitle:
            'Manage zero-downtime incremental backups, 1-click safe field USB eject, automatic reconnect catch-up, and off-site encryption keys directly from the browser.',
        adminRequired: 'Administrator privileges are required to manage host USB backup drives and recovery keys.',
        loadingProgressLabel: 'Loading USB backup drive and snapshot status',
        activeJobProgressLabel: 'USB backup operation in progress',
        agentInactiveWarning:
            'The host USB backup watcher is not yet active on this server. Run `sudo bash oscar.sh usb-backup install-agent` (Ubuntu) or `.\\oscar.bat usb-backup install-agent` (Windows) once, or restart OSCAR via `oscar.sh restart`.',
        statusSectionTitle: 'Live Drive & Snapshot Status',
        actionsSectionTitle: 'Field Visit & Verification Actions',
        modeSectionTitle: 'Backup Mode & Sync Schedule',
        setupSectionTitle: 'Initialize or Switch External USB NVMe SSD',
        fieldGuideTitle: 'Visiting Data Admin Offload Workflow',
        stateBadges: {
            ATTACHED: 'ATTACHED & ONLINE',
            SAFE_TO_UNPLUG: 'SAFE TO UNPLUG NOW',
            DETACHED: 'UNPLUGGED (RECORDING INTERNALLY)',
            UNCONFIGURED: 'NOT CONFIGURED',
        },
        safeToUnplugBannerTitle: 'SAFE TO UNPLUG: USB NVMe SSD Flushed & Unmounted',
        safeToUnplugBannerBody:
            'Final delta changes have been synced and flushed. Unplug the USB NVMe SSD from the OSCAR server, plug it into your laptop to run COPY-TO-ANOTHER-DRIVE.bat (Windows) or ./copy-to-another-drive.sh (macOS/Linux), then plug it back into OSCAR when finished.',
        detachedBannerTitle: 'USB Backup Drive Unplugged — Portal Recording Normally',
        detachedBannerBody:
            'OSCAR remains 100% online on internal NVMe storage. In Continual mode, plugging the USB NVMe SSD back into the USB 3.x port automatically pulls in all radiation telemetry, Daily-File CSVs, video frames, OCR crops, and database changes recorded while unplugged.',
        unconfiguredBannerBody:
            'Plug an external USB 3.x NVMe SSD into the OSCAR server and initialize it below to enable zero-downtime continual or occasional backups.',
        safelyEjectBtn: 'Safely Eject USB Drive',
        reattachSyncBtn: 'Re-Attach & Sync Catch-Up',
        syncNowBtn: 'Sync Incremental Snapshot Now',
        verifyQuickBtn: 'Verify Backup (Quick)',
        verifyDeepBtn: 'Deep-Verify All Packs',
        downloadKeyBtn: 'Download Off-Site Recovery Key (backup-key.txt)',
        refreshDrivesBtn: 'Rescan USB Ports',
        keyEscrowHint:
            'Store oscar-backup-key.txt in off-site escrow (password manager or separate vault) — never solely on the USB carrier.',
        keyDownloadedStatus: 'Downloaded oscar-backup-key.txt. Save it in secure off-site escrow.',
        latestSnapshotHeading: 'Latest Verified Recovery Point',
        noSnapshotYet: 'No verified snapshot recorded yet.',
        snapshotIdLabel: 'Snapshot ID',
        snapshotTimeLabel: 'Captured (UTC)',
        postgresLsnLabel: 'PostgreSQL WAL LSN',
        archivePacksLabel: 'Sealed Parquet Daily Packs',
        statePacksLabel: 'Media / CSV Delta Packs',
        trackedFilesLabel: 'Tracked Immutable Files',
        mountPathLabel: 'Host Carrier Path',
        capacityLabel: 'USB Carrier Capacity',
        modeLegend: 'Choose Operational Backup Mode',
        modeContinualTitle: 'Continual Background Sync (Recommended)',
        modeContinualDesc:
            'Syncs new data automatically on an idle-I/O timer with 0.0 s portal downtime and automatically catches up whenever the USB NVMe SSD is plugged back in.',
        modeOccasionalTitle: 'Occasional / On-Demand Visit Sync',
        modeOccasionalDesc:
            'Disables the background timer; syncs delta packs whenever an administrator clicks "Sync Incremental Snapshot Now" or "Re-Attach & Sync Catch-Up".',
        modeDisabledTitle: 'Disabled (Pause USB Backups)',
        modeDisabledDesc:
            'Pauses background timers while preserving all existing snapshots and packs already written on the USB drive.',
        intervalMinutesLabel: 'Continual Sync Interval (minutes)',
        saveModeBtn: 'Save Mode & Schedule',
        selectDriveLabel: 'Detected External USB Drives',
        noCandidateDrives:
            'No external USB drives detected. Plug a USB 3.x NVMe SSD into the server and click "Rescan USB Ports".',
        protectedDisksNote:
            'OS boot volumes and active OSCAR database/archive disks are hardware-excluded and can never be formatted.',
        filesystemLabel: 'Carrier Filesystem',
        fsNtfsOption: 'NTFS — Readable on Windows, macOS & Linux laptops (Recommended)',
        fsExt4Option: 'ext4 — Native Linux server carrier',
        adoptWithoutFormatLabel: 'Use existing NTFS/ext4 partition without erasing (--no-format)',
        openFormatDialogBtn: 'Format & Initialize Selected USB Drive...',
        adoptDriveBtn: 'Initialize Drive Without Formatting',
        dialogTitle: 'Confirm Erasing & Formatting External USB Drive',
        dialogWarningBody: (driveLabel: string, fs: string) =>
            `This will permanently erase all existing partitions and files on ${driveLabel}, format it as ${fs.toUpperCase()} (label OSCAR_BACKUP), and run the initial zero-downtime OSCAR backup snapshot.`,
        dialogConfirmInputLabel: 'Type FORMAT in capital letters to confirm',
        dialogConfirmError: 'Enter the exact word FORMAT in uppercase to confirm erasing the selected USB drive.',
        cancelBtn: 'Cancel',
        confirmFormatSubmitBtn: 'Erase & Initialize USB Drive',
        copyBtn: 'Copy',
        copiedStatus: 'Copied',
        fieldStep1: '1. Click "Safely Eject USB Drive" above and wait for the green SAFE TO UNPLUG banner.',
        fieldStep2:
            '2. Unplug the USB NVMe SSD, connect it to your laptop, and run COPY-TO-ANOTHER-DRIVE.bat (Windows) or ./copy-to-another-drive.sh (macOS/Linux) to copy only new daily packs.',
        fieldStep3:
            '3. Plug the USB NVMe SSD back into the OSCAR USB 3.x port; OSCAR automatically pulls in everything recorded while the drive was away.',
    },
    es: {
        pageTitle: 'Copias de Seguridad USB NVMe Continuas y Ocasionales',
        pageSubtitle:
            'Administre copias incrementales sin tiempo de inactividad, expulsión segura con 1 clic, sincronización automática al reconectar y claves de recuperación desde el navegador.',
        adminRequired: 'Se requieren privilegios de Administrador para gestionar unidades USB de respaldo.',
        loadingProgressLabel: 'Cargando estado de la unidad USB y puntos de recuperación',
        activeJobProgressLabel: 'Operación de respaldo USB en curso',
        agentInactiveWarning:
            'El agente anfitrión de respaldo USB aún no está activo. Ejecute `sudo bash oscar.sh usb-backup install-agent` o reinicie OSCAR.',
        statusSectionTitle: 'Estado en Vivo de la Unidad y Copia',
        actionsSectionTitle: 'Acciones de Campo y Verificación',
        modeSectionTitle: 'Modo de Respaldo y Frecuencia',
        setupSectionTitle: 'Inicializar o Cambiar Unidad USB NVMe Externa',
        fieldGuideTitle: 'Flujo de Trabajo para Visita de Campo',
        stateBadges: {
            ATTACHED: 'CONECTADA Y EN LÍNEA',
            SAFE_TO_UNPLUG: 'SEGURO PARA DESCONECTAR',
            DETACHED: 'DESCONECTADA (GRABANDO INTERNO)',
            UNCONFIGURED: 'SIN CONFIGURAR',
        },
        safeToUnplugBannerTitle: 'SEGURO PARA DESCONECTAR: Unidad USB NVMe Desmontada',
        safeToUnplugBannerBody:
            'Los cambios finales se sincronizaron correctamente. Desconecte el SSD USB NVMe, cópielo en su portátil y vuelva a conectarlo al servidor OSCAR al terminar.',
        detachedBannerTitle: 'Unidad USB Desconectada — El Portal Sigue Grabando Normalmente',
        detachedBannerBody:
            'OSCAR permanece 100% en línea en el almacenamiento interno y sincronizará automáticamente los datos nuevos al reconectar la unidad USB.',
        unconfiguredBannerBody:
            'Conecte un SSD USB 3.x NVMe externo e inicialícelo abajo para habilitar respaldos incrementales.',
        safelyEjectBtn: 'Expulsar Unidad USB con Seguridad',
        reattachSyncBtn: 'Reconectar y Sincronizar',
        syncNowBtn: 'Sincronizar Ahora',
        verifyQuickBtn: 'Verificar Copia (Rápida)',
        verifyDeepBtn: 'Verificación Profunda SHA-256',
        downloadKeyBtn: 'Descargar Clave de Recuperación (backup-key.txt)',
        refreshDrivesBtn: 'Reescanear Puertos USB',
        keyEscrowHint:
            'Guarde oscar-backup-key.txt fuera del sitio en una bóveda segura, nunca únicamente en la unidad USB.',
        keyDownloadedStatus: 'Se descargó oscar-backup-key.txt correctamente.',
        latestSnapshotHeading: 'Último Punto de Recuperación Verificado',
        noSnapshotYet: 'Aún no hay puntos de recuperación verificados.',
        snapshotIdLabel: 'ID de Instantánea',
        snapshotTimeLabel: 'Fecha (UTC)',
        postgresLsnLabel: 'LSN WAL de PostgreSQL',
        archivePacksLabel: 'Paquetes Diarios Parquet',
        statePacksLabel: 'Paquetes Multimedia / CSV',
        trackedFilesLabel: 'Archivos Inmutables Rastreados',
        mountPathLabel: 'Ruta de Montaje',
        capacityLabel: 'Capacidad de Unidad USB',
        modeLegend: 'Seleccionar Modo de Respaldo',
        modeContinualTitle: 'Sincronización Continua Automática (Recomendado)',
        modeContinualDesc:
            'Sincroniza en segundo plano con 0 s de inactividad y recupera datos automáticamente al reconectar el USB.',
        modeOccasionalTitle: 'Sincronización Ocasional / Bajo Demanda',
        modeOccasionalDesc:
            'Desactiva el temporizador automático; sincroniza cuando el administrador pulsa "Sincronizar Ahora".',
        modeDisabledTitle: 'Desactivado (Pausar Respaldos USB)',
        modeDisabledDesc: 'Pausa las tareas automáticas conservando los respaldos existentes en la unidad USB.',
        intervalMinutesLabel: 'Intervalo Continuo (minutos)',
        saveModeBtn: 'Guardar Modo y Horario',
        selectDriveLabel: 'Unidades USB Externas Detectadas',
        noCandidateDrives: 'No se detectaron unidades USB externas. Conecte un SSD USB NVMe y pulse Reescanear.',
        protectedDisksNote: 'Los discos del sistema operativo y de OSCAR activo están bloqueados contra formateo.',
        filesystemLabel: 'Sistema de Archivos',
        fsNtfsOption: 'NTFS — Compatible con portátiles Windows, macOS y Linux (Recomendado)',
        fsExt4Option: 'ext4 — Nativo de Linux',
        adoptWithoutFormatLabel: 'Usar partición NTFS/ext4 existente sin borrar (--no-format)',
        openFormatDialogBtn: 'Formatear e Inicializar Unidad USB...',
        adoptDriveBtn: 'Inicializar sin Formatear',
        dialogTitle: 'Confirmar Borrado y Formateo de Unidad USB',
        dialogWarningBody: (driveLabel: string, fs: string) =>
            `Esto borrará permanentemente todos los datos en ${driveLabel}, la formateará como ${fs.toUpperCase()} (OSCAR_BACKUP) y ejecutará la copia inicial sin interrupción.`,
        dialogConfirmInputLabel: 'Escriba FORMAT en mayúsculas para confirmar',
        dialogConfirmError: 'Escriba exactamente FORMAT en mayúsculas para confirmar.',
        cancelBtn: 'Cancelar',
        confirmFormatSubmitBtn: 'Borrar e Inicializar Unidad USB',
        copyBtn: 'Copiar',
        copiedStatus: 'Copiado',
        fieldStep1: '1. Pulse "Expulsar Unidad USB con Seguridad" y espere el aviso verde SEGURO PARA DESCONECTAR.',
        fieldStep2: '2. Conecte el SSD USB a su portátil y ejecute COPY-TO-ANOTHER-DRIVE.bat o ./copy-to-another-drive.sh.',
        fieldStep3: '3. Reconecte el SSD USB al puerto USB 3.x de OSCAR para sincronizar los datos grabados en su ausencia.',
    },
    fr: {
        pageTitle: 'Sauvegardes USB NVMe Continues et Occasionnelles',
        pageSubtitle:
            'Gérez les sauvegardes incrémentielles sans interruption, l’éjection USB sécurisée en 1 clic, le rattrapage automatique à la reconnexion et la clé hors site depuis le navigateur.',
        adminRequired: 'Les droits Administrateur sont requis pour gérer les disques de sauvegarde USB.',
        loadingProgressLabel: 'Chargement de l’état du disque USB et des instantanés',
        activeJobProgressLabel: 'Opération de sauvegarde USB en cours',
        agentInactiveWarning:
            'L’agent hôte de sauvegarde USB n’est pas encore actif. Exécutez `sudo bash oscar.sh usb-backup install-agent` ou redémarrez OSCAR.',
        statusSectionTitle: 'État en Direct du Disque et des Sauvegardes',
        actionsSectionTitle: 'Actions Terrain et Vérification',
        modeSectionTitle: 'Mode de Sauvegarde et Planification',
        setupSectionTitle: 'Initialiser ou Changer de SSD USB NVMe Externe',
        fieldGuideTitle: 'Procédure de Collecte sur Site',
        stateBadges: {
            ATTACHED: 'CONNECTÉ ET EN LIGNE',
            SAFE_TO_UNPLUG: 'PRÊT À DÉBRANCHER',
            DETACHED: 'DÉBRANCHÉ (ENREGISTREMENT INTERNE)',
            UNCONFIGURED: 'NON CONFIGURÉ',
        },
        safeToUnplugBannerTitle: 'PRÊT À DÉBRANCHER : SSD USB NVMe Synchronisé et Démonté',
        safeToUnplugBannerBody:
            'Le dernier delta a été écrit et le disque est démonté proprement. Débranchez le SSD USB NVMe, copiez-le sur votre ordinateur portable, puis rebranchez-le sur OSCAR.',
        detachedBannerTitle: 'Disque USB Débranché — Enregistrement Interne Actif',
        detachedBannerBody:
            'OSCAR reste 100 % en ligne sur son stockage NVMe interne et synchronisera automatiquement les nouvelles données dès le rebranchement du SSD USB.',
        unconfiguredBannerBody:
            'Branchez un SSD USB 3.x NVMe externe et initialisez-le ci-dessous pour activer les sauvegardes sans coupure.',
        safelyEjectBtn: 'Éjecter le Disque USB en Sécurité',
        reattachSyncBtn: 'Rattacher et Synchroniser',
        syncNowBtn: 'Synchroniser Maintenant',
        verifyQuickBtn: 'Vérifier la Sauvegarde (Rapide)',
        verifyDeepBtn: 'Vérification Complète SHA-256',
        downloadKeyBtn: 'Télécharger la Clé Hors Site (backup-key.txt)',
        refreshDrivesBtn: 'Actualiser les Ports USB',
        keyEscrowHint:
            'Conservez oscar-backup-key.txt dans un coffre-fort hors site — jamais uniquement sur le support USB.',
        keyDownloadedStatus: 'Fichier oscar-backup-key.txt téléchargé.',
        latestSnapshotHeading: 'Dernier Point de Restauration Vérifié',
        noSnapshotYet: 'Aucun instantané vérifié pour le moment.',
        snapshotIdLabel: 'ID d’Instantané',
        snapshotTimeLabel: 'Date (UTC)',
        postgresLsnLabel: 'LSN WAL PostgreSQL',
        archivePacksLabel: 'Archives Parquet Scellées',
        statePacksLabel: 'Packs Médias / CSV',
        trackedFilesLabel: 'Fichiers Immuables Suivis',
        mountPathLabel: 'Point de Montage Hôte',
        capacityLabel: 'Capacité du Support USB',
        modeLegend: 'Choisir le Mode de Sauvegarde',
        modeContinualTitle: 'Synchronisation Continue en Arrière-Plan (Recommandé)',
        modeContinualDesc:
            'Synchronise périodiquement sans interruption (0 s) et rattrape automatiquement les données au rebranchement USB.',
        modeOccasionalTitle: 'Synchronisation Occasionnelle / À la Demande',
        modeOccasionalDesc:
            'Désactive le minuteur automatique ; synchronise lors d’un clic sur « Synchroniser Maintenant ».',
        modeDisabledTitle: 'Désactivé (Suspendre les Sauvegardes USB)',
        modeDisabledDesc: 'Suspend la planification tout en conservant les sauvegardes existantes sur le disque USB.',
        intervalMinutesLabel: 'Intervalle Continu (minutes)',
        saveModeBtn: 'Enregistrer le Mode',
        selectDriveLabel: 'Disques USB Externes Détectés',
        noCandidateDrives: 'Aucun disque USB externe détecté. Branchez un SSD USB NVMe puis cliquez sur Actualiser.',
        protectedDisksNote: 'Les disques système et les volumes actifs d’OSCAR sont protégés contre tout formatage.',
        filesystemLabel: 'Système de Fichiers',
        fsNtfsOption: 'NTFS — Lisible sous Windows, macOS et Linux (Recommandé)',
        fsExt4Option: 'ext4 — Natif Linux',
        adoptWithoutFormatLabel: 'Utiliser la partition NTFS/ext4 existante sans formater (--no-format)',
        openFormatDialogBtn: 'Formater et Initialiser le Disque USB...',
        adoptDriveBtn: 'Initialiser sans Formater',
        dialogTitle: 'Confirmer le Formatage du Disque USB Externe',
        dialogWarningBody: (driveLabel: string, fs: string) =>
            `Cette action effacera définitivement toutes les données sur ${driveLabel}, formatera le support en ${fs.toUpperCase()} (OSCAR_BACKUP) et lancera la sauvegarde initiale.`,
        dialogConfirmInputLabel: 'Tapez FORMAT en majuscules pour confirmer',
        dialogConfirmError: 'Veuillez saisir exactement FORMAT en majuscules pour confirmer.',
        cancelBtn: 'Annuler',
        confirmFormatSubmitBtn: 'Effacer et Initialiser le Disque USB',
        copyBtn: 'Copier',
        copiedStatus: 'Copié',
        fieldStep1: '1. Cliquez sur « Éjecter le Disque USB en Sécurité » et attendez la bannière verte.',
        fieldStep2: '2. Branchez le SSD sur votre portable et lancez COPY-TO-ANOTHER-DRIVE.bat ou ./copy-to-another-drive.sh.',
        fieldStep3: '3. Rebranchez le SSD sur le port USB 3.x d’OSCAR pour rattraper automatiquement les données.',
    },
    el: {
        pageTitle: 'Συνεχή και Περιστασιακά Αντίγραφα Ασφαλείας USB NVMe',
        pageSubtitle:
            'Διαχειριστείτε αυξητικά αντίγραφα ασφαλείας μηδενικής διακοπής, ασφαλή εξαγωγή USB με 1 κλικ, αυτόματο συγχρονισμό επανασύνδεσης και κλειδιά ανάκτησης από τον περιηγητή.',
        adminRequired: 'Απαιτούνται δικαιώματα Διαχειριστή για τη διαχείριση των δίσκων αντιγράφων ασφαλείας USB.',
        loadingProgressLabel: 'Φόρτωση κατάστασης δίσκου USB και αντιγράφων ασφαλείας',
        activeJobProgressLabel: 'Εργασία αντιγράφου ασφαλείας USB σε εξέλιξη',
        agentInactiveWarning:
            'Ο υπηρεσιακός παράγοντας USB δεν είναι ενεργός ακόμη. Εκτελέστε `sudo bash oscar.sh usb-backup install-agent` ή επανεκκινήστε το OSCAR.',
        statusSectionTitle: 'Ζωντανή Κατάσταση Δίσκου & Στιγμιοτύπου',
        actionsSectionTitle: 'Ενέργειες Πεδίου & Επαλήθευσης',
        modeSectionTitle: 'Λειτουργία Αντιγράφων & Πρόγραμμα',
        setupSectionTitle: 'Αρχικοποίηση ή Αλλαγή Εξωτερικού USB NVMe SSD',
        fieldGuideTitle: 'Διαδικασία Μεταφοράς Δεδομένων Πεδίου',
        stateBadges: {
            ATTACHED: 'ΣΥΝΔΕΔΕΜΕΝΟΣ & ΕΝΕΡΓΟΣ',
            SAFE_TO_UNPLUG: 'ΑΣΦΑΛΗΣ ΑΠΟΣΥΝΔΕΣΗ ΤΩΡΑ',
            DETACHED: 'ΑΠΟΣΥΝΔΕΔΕΜΕΝΟΣ (ΕΣΩΤΕΡΙΚΗ ΚΑΤΑΓΡΑΦΗ)',
            UNCONFIGURED: 'ΜΗ ΡΥΘΜΙΣΜΕΝΟΣ',
        },
        safeToUnplugBannerTitle: 'ΑΣΦΑΛΗΣ ΑΠΟΣΥΝΔΕΣΗ: Ο Δίσκος USB NVMe Αποπροσαρτήθηκε',
        safeToUnplugBannerBody:
            'Τα τελευταία δεδομένα συγχρονίστηκαν με ασφάλεια. Αποσυνδέστε τον δίσκο USB NVMe, αντιγράψτε τον στον φορητό υπολογιστή σας και επανασυνδέστε τον στο OSCAR όταν ολοκληρώσετε.',
        detachedBannerTitle: 'Ο Δίσκος USB είναι Αποσυνδεδεμένος — Κανονική Εσωτερική Καταγραφή',
        detachedBannerBody:
            'Το OSCAR παραμένει 100% ενεργό στον εσωτερικό δίσκο NVMe και θα συγχρονίσει αυτόματα όλα τα νέα δεδομένα μόλις επανασυνδεθεί ο δίσκος USB.',
        unconfiguredBannerBody:
            'Συνδέστε έναν εξωτερικό δίσκο USB 3.x NVMe SSD και αρχικοποιήστε τον παρακάτω.',
        safelyEjectBtn: 'Ασφαλής Εξαγωγή Δίσκου USB',
        reattachSyncBtn: 'Επανασύνδεση & Συγχρονισμός',
        syncNowBtn: 'Συγχρονισμός Τώρα',
        verifyQuickBtn: 'Επαλήθευση (Γρήγορη)',
        verifyDeepBtn: 'Πλήρης Επαλήθευση SHA-256',
        downloadKeyBtn: 'Λήψη Κλειδιού Ανάκτησης (backup-key.txt)',
        refreshDrivesBtn: 'Νέα Σάρωση Θυρών USB',
        keyEscrowHint:
            'Φυλάξτε το oscar-backup-key.txt σε ασφαλή τοποθεσία εκτός σταθμού — ποτέ αποκλειστικά πάνω στον δίσκο USB.',
        keyDownloadedStatus: 'Το αρχείο oscar-backup-key.txt λήφθηκε επιτυχώς.',
        latestSnapshotHeading: 'Τελευταίο Επαληθευμένο Σημείο Ανάκτησης',
        noSnapshotYet: 'Δεν υπάρχει ακόμη επαληθευμένο στιγμιότυπο.',
        snapshotIdLabel: 'Αναγνωριστικό Στιγμιοτύπου',
        snapshotTimeLabel: 'Ώρα Λήψης (UTC)',
        postgresLsnLabel: 'PostgreSQL WAL LSN',
        archivePacksLabel: 'Ημερήσια Πακέτα Parquet',
        statePacksLabel: 'Πακέτα Πολυμέσων / CSV',
        trackedFilesLabel: 'Καταγεγραμμένα Αρχεία',
        mountPathLabel: 'Διαδρομή Προσάρτησης',
        capacityLabel: 'Χωρητικότητα Δίσκου USB',
        modeLegend: 'Επιλογή Λειτουργίας Αντιγράφων Ασφαλείας',
        modeContinualTitle: 'Συνεχής Αυτόματος Συγχρονισμός (Συνιστάται)',
        modeContinualDesc:
            'Συγχρονίζει περιοδικά στο παρασκήνιο με 0 s διακοπή και ενημερώνεται αυτόματα σε κάθε επανασύνδεση USB.',
        modeOccasionalTitle: 'Περιστασιακός / Κατ’ Απαίτηση Συγχρονισμός',
        modeOccasionalDesc:
            'Απενεργοποιεί τον αυτόματο χρονοδιακόπτη· συγχρονίζει όταν επιλέξετε «Συγχρονισμός Τώρα».',
        modeDisabledTitle: 'Απενεργοποιημένο (Παύση Αντιγράφων USB)',
        modeDisabledDesc: 'θέτει σε παύση τον προγραμματισμό διατηρώντας τα υπάρχοντα αρχεία στον δίσκο USB.',
        intervalMinutesLabel: 'Διάστημα Συνεχούς Συγχρονισμού (λεπτά)',
        saveModeBtn: 'Αποθήκευση Λειτουργίας',
        selectDriveLabel: 'Ανιχνευμένοι Εξωτερικοί Δίσκοι USB',
        noCandidateDrives: 'Δεν βρέθηκαν εξωτερικοί δίσκοι USB. Συνδέστε έναν δίσκο USB NVMe και πατήστε Νέα Σάρωση.',
        protectedDisksNote: 'Οι δίσκοι του λειτουργικού συστήματος και του ενεργού OSCAR προστατεύονται αυτόματα.',
        filesystemLabel: 'Σύστημα Αρχείων',
        fsNtfsOption: 'NTFS — Συμβατό με Windows, macOS & Linux (Συνιστάται)',
        fsExt4Option: 'ext4 — Εγγενές σύστημα αρχείων Linux',
        adoptWithoutFormatLabel: 'Χρήση υπάρχουσας κατάτμησης NTFS/ext4 χωρίς διαμόρφωση (--no-format)',
        openFormatDialogBtn: 'Διαμόρφωση & Αρχικοποίηση Δίσκου USB...',
        adoptDriveBtn: 'Αρχικοποίηση χωρίς Διαμόρφωση',
        dialogTitle: 'Επιβεβαίωση Διαγραφής & Διαμόρφωσης Εξωτερικού Δίσκου USB',
        dialogWarningBody: (driveLabel: string, fs: string) =>
            `Αυτή η ενέργεια θα διαγράψει οριστικά όλα τα δεδομένα στον δίσκο ${driveLabel}, θα τον διαμορφώσει ως ${fs.toUpperCase()} (OSCAR_BACKUP) και θα εκτελέσει το αρχικό αντίγραφο ασφαλείας.`,
        dialogConfirmInputLabel: 'Πληκτρολογήστε FORMAT με κεφαλαία γράμματα για επιβεβαίωση',
        dialogConfirmError: 'Πληκτρολογήστε ακριβώς τη λέξη FORMAT με κεφαλαία γράμματα.',
        cancelBtn: 'Ακύρωση',
        confirmFormatSubmitBtn: 'Διαγραφή & Αρχικοποίηση Δίσκου USB',
        copyBtn: 'Αντιγραφή',
        copiedStatus: 'Αντιγράφηκε',
        fieldStep1: '1. Πατήστε «Ασφαλής Εξαγωγή Δίσκου USB» και περιμένετε την πράσινη ένδειξη ΑΣΦΑΛΗΣ ΑΠΟΣΥΝΔΕΣΗ.',
        fieldStep2: '2. Συνδέστε τον δίσκο στον φορητό σας και εκτελέστε COPY-TO-ANOTHER-DRIVE.bat ή ./copy-to-another-drive.sh.',
        fieldStep3: '3. Επανασυνδέστε τον δίσκο στη θύρα USB 3.x του OSCAR για αυτόματο συγχρονισμό.',
    },
};

function formatByteCount(bytes?: number): string {
    const val = Number(bytes || 0);
    if (!Number.isFinite(val) || val <= 0) return '0 B';
    if (val >= 1e12) return `${(val / 1e12).toFixed(2)} TB`;
    if (val >= 1e9) return `${(val / 1e9).toFixed(2)} GB`;
    if (val >= 1e6) return `${(val / 1e6).toFixed(1)} MB`;
    return `${Math.round(val / 1024)} KB`;
}

function CopyTokenButton({
    value,
    label,
    copiedText,
}: {
    value: string;
    label: string;
    copiedText: string;
}) {
    const [visible, setVisible] = React.useState(false);
    const [toggleNbsp, setToggleNbsp] = React.useState(false);
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    React.useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const handleCopy = async () => {
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(value);
            }
            setToggleNbsp((prev) => !prev);
            setVisible(true);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => setVisible(false), 1800);
        } catch {
            // ignore clipboard permission denial
        }
    };

    return (
        <span className="usb-copy-wrapper">
            <Button
                type="button"
                size="small"
                variant="outlined"
                onClick={handleCopy}
                startIcon={<ContentCopyRoundedIcon aria-hidden="true" fontSize="small" />}
            >
                {label}
            </Button>
            <span className="usb-copy-status" role="status" data-visible={visible ? 'true' : 'false'}>
                {visible ? (toggleNbsp ? `${copiedText}\u00A0` : copiedText) : ''}
            </span>
        </span>
    );
}

export interface UsbBackupManagerProps {
    initialSession?: OscarSessionInfo | null;
    initialStatus?: UsbBackupStatusResponse | null;
}

export default function UsbBackupManager({
    initialSession,
    initialStatus,
}: UsbBackupManagerProps = {}) {
    const { language: locale } = useLanguage();
    const copy = USB_COPY[locale] || USB_COPY.en;
    const intlLocale = getIntlLocale(locale);

    const [session, setSession] = React.useState<OscarSessionInfo | null>(initialSession ?? null);
    const [sessionLoaded, setSessionLoaded] = React.useState<boolean>(initialSession !== undefined);
    const [status, setStatus] = React.useState<UsbBackupStatusResponse | null>(initialStatus ?? null);
    const [initialLoading, setInitialLoading] = React.useState<boolean>(initialStatus === undefined);
    const [actionSubmitting, setActionSubmitting] = React.useState<boolean>(false);
    const [banner, setBanner] = React.useState<{ severity: 'success' | 'error' | 'info'; text: string } | null>(null);

    // Mode form state
    const [selectedMode, setSelectedMode] = React.useState<'continual' | 'occasional' | 'disabled'>('continual');
    const [intervalMinutes, setIntervalMinutes] = React.useState<number>(15);
    const modeInitializedRef = React.useRef<boolean>(false);

    // Prepare-drive form state
    const [selectedDevice, setSelectedDevice] = React.useState<string>('');
    const [selectedFs, setSelectedFs] = React.useState<'ntfs' | 'ext4'>('ntfs');
    const [adoptWithoutFormat, setAdoptWithoutFormat] = React.useState<boolean>(false);

    // Native <dialog> confirmation state
    const formatDialogRef = React.useRef<HTMLDialogElement | null>(null);
    const [formatConfirmText, setFormatConfirmText] = React.useState<string>('');
    const [formatConfirmError, setFormatConfirmError] = React.useState<string>('');

    // Track last announced job transition so role="status" announces completion cleanly once
    const lastSeenJobKeyRef = React.useRef<string>('');

    const applyStatusUpdate = React.useCallback((next: UsbBackupStatusResponse) => {
        setStatus(next);
        if (!modeInitializedRef.current && next.configured && next.mode !== 'unconfigured') {
            setSelectedMode(next.mode);
            setIntervalMinutes(next.intervalMinutes || 15);
            modeInitializedRef.current = true;
        }
        if (next.candidateDrives.length > 0) {
            setSelectedDevice((prev) => {
                if (prev && next.candidateDrives.some((d) => d.device === prev)) {
                    return prev;
                }
                const preferred =
                    next.candidateDrives.find((d) => d.isConfiguredCarrier) || next.candidateDrives[0];
                return preferred.device;
            });
        } else {
            setSelectedDevice('');
        }

        const job = next.activeJob;
        if (job && job.requestId && (job.state === 'SUCCEEDED' || job.state === 'FAILED')) {
            const jobKey = `${job.requestId}:${job.state}`;
            if (lastSeenJobKeyRef.current && lastSeenJobKeyRef.current !== jobKey) {
                setBanner({
                    severity: job.state === 'SUCCEEDED' ? 'success' : 'error',
                    text: job.message || `${job.action}: ${job.state}`,
                });
            }
            lastSeenJobKeyRef.current = jobKey;
        } else if (job && job.requestId) {
            lastSeenJobKeyRef.current = `${job.requestId}:${job.state}`;
        }
    }, []);

    React.useEffect(() => {
        if (initialStatus) {
            applyStatusUpdate(initialStatus);
        }
    }, [initialStatus, applyStatusUpdate]);

    React.useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();

        async function bootstrap() {
            try {
                let currentSess = initialSession;
                if (currentSess === undefined) {
                    currentSess = await fetchCurrentSession(controller.signal);
                    if (cancelled) return;
                    setSession(currentSess);
                    setSessionLoaded(true);
                }
                if (currentSess?.isAdmin && initialStatus === undefined) {
                    const st = await fetchUsbBackupStatus(controller.signal);
                    if (!cancelled) {
                        applyStatusUpdate(st);
                    }
                }
            } catch (err: any) {
                if (!cancelled && err?.name !== 'AbortError') {
                    setBanner({ severity: 'error', text: err?.message || 'Unable to load USB backup status.' });
                }
            } finally {
                if (!cancelled) {
                    setInitialLoading(false);
                }
            }
        }
        bootstrap();
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [initialSession, initialStatus, applyStatusUpdate]);

    const jobBusy =
        actionSubmitting ||
        status?.activeJob?.state === 'RUNNING' ||
        status?.activeJob?.state === 'QUEUED';

    // Poll faster while a job is running/queued, slower when idle
    React.useEffect(() => {
        if (!session?.isAdmin) return;
        const pollMs = jobBusy ? 1500 : 12000;
        const id = setInterval(async () => {
            try {
                const latest = await fetchUsbBackupStatus();
                applyStatusUpdate(latest);
            } catch {
                // ignore transient network blip during background poll
            }
        }, pollMs);
        return () => clearInterval(id);
    }, [session?.isAdmin, jobBusy, applyStatusUpdate]);

    const runAction = async (payload: Parameters<typeof submitUsbBackupAction>[0]) => {
        setActionSubmitting(true);
        setBanner(null);
        try {
            const updated = await submitUsbBackupAction(payload);
            applyStatusUpdate(updated);
            if (updated.activeJob?.state === 'SUCCEEDED' && updated.activeJob.message) {
                setBanner({ severity: 'success', text: updated.activeJob.message });
            } else if (updated.activeJob?.state === 'FAILED' && updated.activeJob.message) {
                setBanner({ severity: 'error', text: updated.activeJob.message });
            }
        } catch (err: any) {
            setBanner({ severity: 'error', text: err?.message || 'USB backup request failed.' });
        } finally {
            setActionSubmitting(false);
        }
    };

    const handleDownloadKey = async () => {
        setActionSubmitting(true);
        setBanner(null);
        try {
            const { filename, content } = await downloadUsbBackupEscrowKey();
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = filename;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
            setBanner({ severity: 'success', text: copy.keyDownloadedStatus });
        } catch (err: any) {
            setBanner({ severity: 'error', text: err?.message || 'Failed downloading backup key.' });
        } finally {
            setActionSubmitting(false);
        }
    };

    const handleSaveMode = async (e: React.FormEvent) => {
        e.preventDefault();
        const clampedInterval = Math.min(1440, Math.max(5, Number(intervalMinutes) || 15));
        setIntervalMinutes(clampedInterval);
        await runAction({
            action: 'set-mode',
            mode: selectedMode,
            intervalMinutes: clampedInterval,
        });
    };

    const selectedCandidate: UsbCandidateDrive | undefined = status?.candidateDrives.find(
        (d) => d.device === selectedDevice,
    );

    const openFormatDialog = () => {
        setFormatConfirmText('');
        setFormatConfirmError('');
        const dlg = formatDialogRef.current;
        if (dlg && !dlg.open) {
            dlg.showModal();
        }
    };

    const closeFormatDialog = () => {
        const dlg = formatDialogRef.current;
        if (dlg && dlg.open) {
            dlg.close();
        }
    };

    const handleFormatDialogClose = () => {
        if (formatDialogRef.current) {
            formatDialogRef.current.returnValue = '';
        }
        setFormatConfirmError('');
    };

    const validateFormatToken = (val: string): boolean => {
        if (val.trim() !== 'FORMAT') {
            setFormatConfirmError(copy.dialogConfirmError);
            return false;
        }
        setFormatConfirmError('');
        return true;
    };

    const handleConfirmFormatSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateFormatToken(formatConfirmText) || !selectedDevice) {
            return;
        }
        closeFormatDialog();
        const initMode: 'continual' | 'occasional' =
            selectedMode === 'occasional' ? 'occasional' : 'continual';
        await runAction({
            action: 'prepare-drive',
            device: selectedDevice,
            noFormat: false,
            confirm: 'FORMAT',
            filesystem: selectedFs,
            mode: initMode,
            intervalMinutes: Math.min(1440, Math.max(5, Number(intervalMinutes) || 15)),
        });
    };

    const handleAdoptWithoutFormat = async () => {
        if (!selectedDevice) return;
        const initMode: 'continual' | 'occasional' =
            selectedMode === 'occasional' ? 'occasional' : 'continual';
        await runAction({
            action: 'prepare-drive',
            device: selectedDevice,
            noFormat: true,
            filesystem: selectedFs,
            mode: initMode,
            intervalMinutes: Math.min(1440, Math.max(5, Number(intervalMinutes) || 15)),
        });
    };

    if (sessionLoaded && !session?.isAdmin) {
        return (
            <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1080, mx: 'auto' }}>
                <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>
                    {copy.pageTitle}
                </Typography>
                <Alert severity="warning">{copy.adminRequired}</Alert>
            </Box>
        );
    }

    const driveState = status?.driveState || 'UNCONFIGURED';
    const stateChipColor: 'success' | 'info' | 'warning' | 'default' =
        driveState === 'ATTACHED' || driveState === 'SAFE_TO_UNPLUG'
            ? 'success'
            : driveState === 'DETACHED'
              ? 'warning'
              : 'default';

    const snap = status?.latestSnapshot;
    const formattedSnapTime = snap?.createdAt
        ? (() => {
              const dt = new Date(snap.createdAt);
              return Number.isNaN(dt.getTime()) ? snap.createdAt : dt.toLocaleString(intlLocale, { timeZone: 'UTC', timeZoneName: 'short' });
          })()
        : '';

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
            <Stack spacing={3}>
                {/* Page Header (<h1>) */}
                <Box>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.75 }}>
                        <UsbRoundedIcon aria-hidden="true" color="primary" fontSize="large" />
                        <Typography variant="h4" component="h1" fontWeight={700}>
                            {copy.pageTitle}
                        </Typography>
                    </Stack>
                    <Typography variant="body1" color="text.secondary">
                        {copy.pageSubtitle}
                    </Typography>
                </Box>

                {/* Native Indeterminate <progress> while loading or running a backup job */}
                {(initialLoading || jobBusy) && (
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Stack spacing={1}>
                            <Typography
                                component="label"
                                htmlFor="usb-job-progress"
                                variant="body2"
                                fontWeight={600}
                            >
                                {initialLoading
                                    ? copy.loadingProgressLabel
                                    : status?.activeJob?.message || copy.activeJobProgressLabel}
                            </Typography>
                            <progress id="usb-job-progress" className="usb-native-progress" />
                        </Stack>
                    </Paper>
                )}

                {/* Polite Status / Completion Announcement */}
                <div role="status">
                    {banner && (
                        <Alert severity={banner.severity} onClose={() => setBanner(null)}>
                            {banner.text}
                        </Alert>
                    )}
                </div>

                {status && !status.agentActive && (
                    <Alert severity="warning">{copy.agentInactiveWarning}</Alert>
                )}

                {/* Prominent SAFE TO UNPLUG or DETACHED Operational Banner */}
                {driveState === 'SAFE_TO_UNPLUG' && (
                    <Alert
                        severity="success"
                        icon={<CheckCircleRoundedIcon aria-hidden="true" fontSize="inherit" />}
                        sx={{ border: '2px solid', borderColor: 'success.main' }}
                    >
                        <Typography variant="subtitle1" fontWeight={700}>
                            {copy.safeToUnplugBannerTitle}
                        </Typography>
                        <Typography variant="body2">{copy.safeToUnplugBannerBody}</Typography>
                    </Alert>
                )}

                {driveState === 'DETACHED' && (
                    <Alert severity="info">
                        <Typography variant="subtitle1" fontWeight={700}>
                            {copy.detachedBannerTitle}
                        </Typography>
                        <Typography variant="body2">{copy.detachedBannerBody}</Typography>
                    </Alert>
                )}

                {driveState === 'UNCONFIGURED' && !initialLoading && (
                    <Alert severity="info">{copy.unconfiguredBannerBody}</Alert>
                )}

                {/* Section 1: Live Drive & Snapshot Status (<h2>) */}
                <Card variant="outlined">
                    <CardContent>
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            justifyContent="space-between"
                            alignItems={{ xs: 'flex-start', sm: 'center' }}
                            spacing={1.5}
                            sx={{ mb: 2 }}
                        >
                            <Typography variant="h6" component="h2" fontWeight={700}>
                                {copy.statusSectionTitle}
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                <Chip
                                    color={stateChipColor}
                                    label={copy.stateBadges[driveState]}
                                    sx={{ fontWeight: 700 }}
                                />
                                {status?.configured && (
                                    <Chip
                                        variant="outlined"
                                        color={status.mode === 'continual' ? 'primary' : 'default'}
                                        label={
                                            status.mode === 'continual'
                                                ? `CONTINUAL (${status.intervalMinutes}m)`
                                                : status.mode.toUpperCase()
                                        }
                                    />
                                )}
                            </Stack>
                        </Stack>

                        <Grid container spacing={2.5}>
                            <Grid item xs={12} md={5}>
                                <Stack spacing={1.25}>
                                    <Typography variant="subtitle2" color="text.secondary">
                                        {copy.mountPathLabel}
                                    </Typography>
                                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                        <Typography variant="body1" fontFamily="monospace" fontWeight={600}>
                                            {status?.mountPath || '—'}
                                        </Typography>
                                        {status?.mountPath && (
                                            <CopyTokenButton
                                                value={status.mountPath}
                                                label={copy.copyBtn}
                                                copiedText={copy.copiedStatus}
                                            />
                                        )}
                                    </Stack>

                                    {driveState === 'ATTACHED' && (status?.driveTotalBytes || 0) > 0 && (
                                        <Box sx={{ pt: 0.5 }}>
                                            <Typography variant="subtitle2" color="text.secondary">
                                                {copy.capacityLabel}
                                            </Typography>
                                            <Typography variant="body2" fontWeight={600}>
                                                {formatByteCount(status?.backupUsedBytes)} used ·{' '}
                                                {formatByteCount(status?.driveFreeBytes)} free of{' '}
                                                {formatByteCount(status?.driveTotalBytes)} (
                                                {(status?.filesystem || 'ntfs').toUpperCase()})
                                            </Typography>
                                        </Box>
                                    )}
                                </Stack>
                            </Grid>

                            <Grid item xs={12} md={7}>
                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                    {copy.latestSnapshotHeading}
                                </Typography>
                                {snap ? (
                                    <Stack spacing={1}>
                                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                            <Typography variant="body2" color="text.secondary">
                                                {copy.snapshotIdLabel}:
                                            </Typography>
                                            <Typography variant="body2" fontFamily="monospace" fontWeight={700}>
                                                {snap.snapshotId}
                                            </Typography>
                                            <CopyTokenButton
                                                value={snap.snapshotId}
                                                label={copy.copyBtn}
                                                copiedText={copy.copiedStatus}
                                            />
                                        </Stack>
                                        <Grid container spacing={1.5}>
                                            <Grid item xs={6} sm={4}>
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                    {copy.snapshotTimeLabel}
                                                </Typography>
                                                <Typography variant="body2" fontWeight={600}>
                                                    {formattedSnapTime}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={6} sm={4}>
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                    {copy.postgresLsnLabel}
                                                </Typography>
                                                <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                                                    {snap.postgresLsn}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={4} sm={4}>
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                    {copy.archivePacksLabel}
                                                </Typography>
                                                <Typography variant="body2" fontWeight={600}>
                                                    {snap.archivePackCount}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={4} sm={4}>
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                    {copy.statePacksLabel}
                                                </Typography>
                                                <Typography variant="body2" fontWeight={600}>
                                                    {snap.statePackCount}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={4} sm={8}>
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                    {copy.trackedFilesLabel}
                                                </Typography>
                                                <Typography variant="body2" fontWeight={600}>
                                                    {snap.immutableStateFileCount.toLocaleString(intlLocale)}
                                                </Typography>
                                            </Grid>
                                        </Grid>
                                    </Stack>
                                ) : (
                                    <Typography variant="body2" color="text.secondary">
                                        {copy.noSnapshotYet}
                                    </Typography>
                                )}
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>

                {/* Section 2: 1-Click Field Offload & Verification Actions (<h2>) */}
                <Card variant="outlined">
                    <CardContent>
                        <Typography variant="h6" component="h2" fontWeight={700} gutterBottom>
                            {copy.actionsSectionTitle}
                        </Typography>
                        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                            <Button
                                type="button"
                                variant="contained"
                                color="warning"
                                disabled={!status?.configured || driveState !== 'ATTACHED' || jobBusy}
                                startIcon={<EjectRoundedIcon aria-hidden="true" />}
                                onClick={() => runAction({ action: 'eject', noSync: false })}
                            >
                                {copy.safelyEjectBtn}
                            </Button>

                            <Button
                                type="button"
                                variant="contained"
                                color="success"
                                disabled={
                                    !status?.configured ||
                                    driveState === 'ATTACHED' ||
                                    jobBusy
                                }
                                startIcon={<UsbRoundedIcon aria-hidden="true" />}
                                onClick={() => runAction({ action: 'attach' })}
                            >
                                {copy.reattachSyncBtn}
                            </Button>

                            <Button
                                type="button"
                                variant="contained"
                                color="primary"
                                disabled={!status?.configured || driveState !== 'ATTACHED' || jobBusy}
                                startIcon={<SyncRoundedIcon aria-hidden="true" />}
                                onClick={() => runAction({ action: 'sync', quiesce: false })}
                            >
                                {copy.syncNowBtn}
                            </Button>

                            <Button
                                type="button"
                                variant="outlined"
                                disabled={!status?.configured || driveState !== 'ATTACHED' || jobBusy}
                                startIcon={<VerifiedUserRoundedIcon aria-hidden="true" />}
                                onClick={() => runAction({ action: 'verify', deep: false })}
                            >
                                {copy.verifyQuickBtn}
                            </Button>

                            <Button
                                type="button"
                                variant="outlined"
                                disabled={!status?.configured || driveState !== 'ATTACHED' || jobBusy}
                                startIcon={<VerifiedUserRoundedIcon aria-hidden="true" />}
                                onClick={() => runAction({ action: 'verify', deep: true })}
                            >
                                {copy.verifyDeepBtn}
                            </Button>

                            <Button
                                type="button"
                                variant="outlined"
                                disabled={jobBusy}
                                startIcon={<RefreshRoundedIcon aria-hidden="true" />}
                                onClick={() => runAction({ action: 'refresh-status' })}
                            >
                                {copy.refreshDrivesBtn}
                            </Button>
                        </Stack>

                        <Divider sx={{ my: 2.25 }} />

                        <Stack
                            direction={{ xs: 'column', md: 'row' }}
                            spacing={1.5}
                            alignItems={{ xs: 'flex-start', md: 'center' }}
                            justifyContent="space-between"
                        >
                            <Typography variant="body2" color="text.secondary">
                                {copy.keyEscrowHint}
                            </Typography>
                            <Button
                                type="button"
                                variant="outlined"
                                color="secondary"
                                disabled={jobBusy}
                                startIcon={<KeyRoundedIcon aria-hidden="true" />}
                                onClick={handleDownloadKey}
                            >
                                {copy.downloadKeyBtn}
                            </Button>
                        </Stack>
                    </CardContent>
                </Card>

                {/* Section 3: Backup Mode & Interval Switcher (<fieldset> + visible radio buttons + explicit submit) */}
                <Card variant="outlined">
                    <CardContent>
                        <Typography variant="h6" component="h2" fontWeight={700} gutterBottom>
                            {copy.modeSectionTitle}
                        </Typography>
                        <Box component="form" onSubmit={handleSaveMode} sx={{ mt: 1.5 }}>
                            <fieldset className="usb-mode-fieldset" disabled={!status?.configured || jobBusy}>
                                <legend>{copy.modeLegend}</legend>
                                <Stack spacing={1.25}>
                                    <label className="usb-radio-card" htmlFor="usb-mode-continual">
                                        <input
                                            id="usb-mode-continual"
                                            type="radio"
                                            name="usbBackupMode"
                                            value="continual"
                                            checked={selectedMode === 'continual'}
                                            onChange={() => setSelectedMode('continual')}
                                        />
                                        <Box>
                                            <Typography variant="subtitle2" fontWeight={700}>
                                                {copy.modeContinualTitle}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {copy.modeContinualDesc}
                                            </Typography>
                                        </Box>
                                    </label>

                                    <label className="usb-radio-card" htmlFor="usb-mode-occasional">
                                        <input
                                            id="usb-mode-occasional"
                                            type="radio"
                                            name="usbBackupMode"
                                            value="occasional"
                                            checked={selectedMode === 'occasional'}
                                            onChange={() => setSelectedMode('occasional')}
                                        />
                                        <Box>
                                            <Typography variant="subtitle2" fontWeight={700}>
                                                {copy.modeOccasionalTitle}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {copy.modeOccasionalDesc}
                                            </Typography>
                                        </Box>
                                    </label>

                                    <label className="usb-radio-card" htmlFor="usb-mode-disabled">
                                        <input
                                            id="usb-mode-disabled"
                                            type="radio"
                                            name="usbBackupMode"
                                            value="disabled"
                                            checked={selectedMode === 'disabled'}
                                            onChange={() => setSelectedMode('disabled')}
                                        />
                                        <Box>
                                            <Typography variant="subtitle2" fontWeight={700}>
                                                {copy.modeDisabledTitle}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {copy.modeDisabledDesc}
                                            </Typography>
                                        </Box>
                                    </label>

                                    {selectedMode === 'continual' && (
                                        <Box sx={{ pt: 0.75, maxWidth: 320 }}>
                                            <Typography
                                                component="label"
                                                htmlFor="usb-interval-minutes"
                                                variant="body2"
                                                fontWeight={600}
                                                display="block"
                                                sx={{ mb: 0.5 }}
                                            >
                                                {copy.intervalMinutesLabel}
                                            </Typography>
                                            <select
                                                id="usb-interval-minutes"
                                                value={String(intervalMinutes)}
                                                onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.55rem 0.75rem',
                                                    borderRadius: 8,
                                                    border: '1px solid rgba(148, 163, 184, 0.6)',
                                                    fontSize: '0.95rem',
                                                    background: 'transparent',
                                                    color: 'inherit',
                                                }}
                                            >
                                                <option value="5">Every 5 minutes</option>
                                                <option value="15">Every 15 minutes (Default)</option>
                                                <option value="30">Every 30 minutes</option>
                                                <option value="60">Every 60 minutes</option>
                                                <option value="180">Every 3 hours</option>
                                                <option value="360">Every 6 hours</option>
                                                <option value="720">Every 12 hours</option>
                                                <option value="1440">Every 24 hours</option>
                                            </select>
                                        </Box>
                                    )}

                                    <Box sx={{ pt: 0.75 }}>
                                        <Button
                                            type="submit"
                                            variant="contained"
                                            disabled={!status?.configured || jobBusy}
                                        >
                                            {copy.saveModeBtn}
                                        </Button>
                                    </Box>
                                </Stack>
                            </fieldset>
                        </Box>
                    </CardContent>
                </Card>

                {/* Section 4: Initialize or Switch External USB NVMe SSD (<h2>) */}
                <Card variant="outlined">
                    <CardContent>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <StorageRoundedIcon aria-hidden="true" color="primary" />
                            <Typography variant="h6" component="h2" fontWeight={700}>
                                {copy.setupSectionTitle}
                            </Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {copy.protectedDisksNote}
                        </Typography>

                        {(status?.candidateDrives.length || 0) === 0 ? (
                            <Alert severity="warning" sx={{ mb: 1 }}>
                                {copy.noCandidateDrives}
                            </Alert>
                        ) : (
                            <Stack spacing={2}>
                                <Box sx={{ maxWidth: 640 }}>
                                    <Typography
                                        component="label"
                                        htmlFor="usb-candidate-drive-select"
                                        variant="body2"
                                        fontWeight={600}
                                        display="block"
                                        sx={{ mb: 0.5 }}
                                    >
                                        {copy.selectDriveLabel}
                                    </Typography>
                                    <select
                                        id="usb-candidate-drive-select"
                                        value={selectedDevice}
                                        disabled={jobBusy}
                                        onChange={(e) => setSelectedDevice(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '0.6rem 0.75rem',
                                            borderRadius: 8,
                                            border: '1px solid rgba(148, 163, 184, 0.6)',
                                            fontSize: '0.95rem',
                                            background: 'transparent',
                                            color: 'inherit',
                                        }}
                                    >
                                        {status?.candidateDrives.map((d) => (
                                            <option key={d.device} value={d.device}>
                                                {d.model} ({d.device} — {d.sizeHuman}
                                                {d.fstype ? `, ${d.fstype.toUpperCase()}` : ''}
                                                {d.label ? ` "${d.label}"` : ''}
                                                {d.isConfiguredCarrier ? ' — Active Carrier' : ''})
                                            </option>
                                        ))}
                                    </select>
                                </Box>

                                {status?.hostPlatform !== 'windows' && !adoptWithoutFormat && (
                                    <Box sx={{ maxWidth: 640 }}>
                                        <Typography
                                            component="label"
                                            htmlFor="usb-filesystem-select"
                                            variant="body2"
                                            fontWeight={600}
                                            display="block"
                                            sx={{ mb: 0.5 }}
                                        >
                                            {copy.filesystemLabel}
                                        </Typography>
                                        <select
                                            id="usb-filesystem-select"
                                            value={selectedFs}
                                            disabled={jobBusy}
                                            onChange={(e) => setSelectedFs(e.target.value as 'ntfs' | 'ext4')}
                                            style={{
                                                width: '100%',
                                                padding: '0.6rem 0.75rem',
                                                borderRadius: 8,
                                                border: '1px solid rgba(148, 163, 184, 0.6)',
                                                fontSize: '0.95rem',
                                                background: 'transparent',
                                                color: 'inherit',
                                            }}
                                        >
                                            <option value="ntfs">{copy.fsNtfsOption}</option>
                                            <option value="ext4">{copy.fsExt4Option}</option>
                                        </select>
                                    </Box>
                                )}

                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={adoptWithoutFormat}
                                            disabled={jobBusy}
                                            onChange={(_e, checked) => setAdoptWithoutFormat(checked)}
                                        />
                                    }
                                    label={copy.adoptWithoutFormatLabel}
                                />

                                <Box>
                                    {adoptWithoutFormat ? (
                                        <Button
                                            type="button"
                                            variant="contained"
                                            disabled={!selectedDevice || jobBusy}
                                            onClick={handleAdoptWithoutFormat}
                                        >
                                            {copy.adoptDriveBtn}
                                        </Button>
                                    ) : (
                                        <Button
                                            type="button"
                                            variant="contained"
                                            color="error"
                                            disabled={!selectedDevice || jobBusy}
                                            onClick={openFormatDialog}
                                        >
                                            {copy.openFormatDialogBtn}
                                        </Button>
                                    )}
                                </Box>
                            </Stack>
                        )}
                    </CardContent>
                </Card>

                {/* Section 5: Quick Visiting Data Admin Field Offload Steps (<h2>) */}
                <Card variant="outlined">
                    <CardContent>
                        <Typography variant="h6" component="h2" fontWeight={700} gutterBottom>
                            {copy.fieldGuideTitle}
                        </Typography>
                        <Stack spacing={0.75}>
                            <Typography variant="body2">{copy.fieldStep1}</Typography>
                            <Typography variant="body2">{copy.fieldStep2}</Typography>
                            <Typography variant="body2">{copy.fieldStep3}</Typography>
                        </Stack>
                    </CardContent>
                </Card>
            </Stack>

            {/* Native Modal <dialog> for Destructive Format Confirmation */}
            <dialog
                ref={formatDialogRef}
                aria-labelledby="usb-format-dialog-title"
                className="usb-native-dialog"
                onClose={handleFormatDialogClose}
            >
                <Box component="form" onSubmit={handleConfirmFormatSubmit} sx={{ p: 3 }}>
                    <Stack spacing={2}>
                        <Typography id="usb-format-dialog-title" variant="h6" component="h2" fontWeight={700}>
                            {copy.dialogTitle}
                        </Typography>
                        <Alert severity="warning">
                            {copy.dialogWarningBody(
                                selectedCandidate
                                    ? `${selectedCandidate.model} (${selectedCandidate.device}, ${selectedCandidate.sizeHuman})`
                                    : selectedDevice,
                                selectedFs,
                            )}
                        </Alert>
                        <Box>
                            <Typography
                                component="label"
                                htmlFor="usb-format-confirm-input"
                                variant="body2"
                                fontWeight={600}
                                display="block"
                                sx={{ mb: 0.5 }}
                            >
                                {copy.dialogConfirmInputLabel}
                            </Typography>
                            <input
                                id="usb-format-confirm-input"
                                type="text"
                                value={formatConfirmText}
                                autoCorrect="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                autoComplete="off"
                                aria-invalid={formatConfirmError ? 'true' : 'false'}
                                aria-describedby={formatConfirmError ? 'usb-format-confirm-error' : undefined}
                                onChange={(e) => {
                                    setFormatConfirmText(e.target.value);
                                    if (formatConfirmError) {
                                        setFormatConfirmError('');
                                    }
                                }}
                                onBlur={(e) => {
                                    if (e.target.value.trim().length > 0) {
                                        validateFormatToken(e.target.value);
                                    }
                                }}
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 8,
                                    border: formatConfirmError
                                        ? '2px solid #d32f2f'
                                        : '1px solid rgba(148, 163, 184, 0.7)',
                                    fontFamily: 'monospace',
                                    fontSize: '1rem',
                                    background: 'transparent',
                                    color: 'inherit',
                                }}
                            />
                            {formatConfirmError && (
                                <Typography
                                    id="usb-format-confirm-error"
                                    variant="caption"
                                    color="error"
                                    display="block"
                                    sx={{ mt: 0.5 }}
                                >
                                    {formatConfirmError}
                                </Typography>
                            )}
                        </Box>
                        <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ pt: 1 }}>
                            <Button type="button" variant="outlined" autoFocus onClick={closeFormatDialog}>
                                {copy.cancelBtn}
                            </Button>
                            <Button type="submit" variant="contained" color="error">
                                {copy.confirmFormatSubmitBtn}
                            </Button>
                        </Stack>
                    </Stack>
                </Box>
            </dialog>
        </Box>
    );
}
