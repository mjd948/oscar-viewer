/*
 * Copyright (c) 2026. Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import { Locale } from "@/app/contexts/LanguageContext";
import type { PlatformIconKey } from "@/app/_components/common/PlatformIcons";
import {
    SandboxScenarioId,
    SandboxTrackId,
    SandboxVerificationSnapshot,
} from "@/lib/data/oscar/TrainingSandboxApi";

export interface TrainingInjectAction {
    scenario: SandboxScenarioId;
    label: string;
    laneSlot?: 1 | 2;
}

export interface TrainingSpotlightTarget {
    id: string;
    selector: string;
    label: string;
    iconKey?: PlatformIconKey;
}

export interface TrainingLabDefinition {
    id: string;
    trackId: SandboxTrackId;
    badge: string;
    route: string;
    pageIconKey?: PlatformIconKey;
    splitPaneAdmin?: boolean;
    videoGuideSlug: string;
    screenshotFile: string;
    screenshotCaption: string;
    title: string;
    durationEstimate: string;
    whyItMatters: string;
    steps: string[];
    injectActions?: TrainingInjectAction[];
    sampleFiles?: { fileName: string; buttonLabel: string }[];
    copySnippets?: { label: string; value: string }[];
    spotlights?: TrainingSpotlightTarget[];
    spotlightSelector?: string;
    spotlightLabel?: string;
    objectiveSummary: string;
    isAutoVerified: (snap: SandboxVerificationSnapshot) => boolean;
}

export interface TrainingTrackDefinition {
    id: SandboxTrackId;
    shortLabel: Record<Locale, string>;
    title: Record<Locale, string>;
    subtitle: Record<Locale, string>;
}

export interface TrainingCoachUiStrings {
    sandboxBadge: string;
    sandboxBannerNote: string;
    coachButtonLabel: string;
    walkthroughButtonLabel: string;
    walkthroughButtonHint: string;
    refresherBadge: string;
    refresherOrientationSummary: string;
    refresherSafeNote: string;
    practiceCardTitle: string;
    practiceIsolationBullet: string;
    practiceShutdownBullet: (ttlMinutes: number) => string;
    practiceSignInBullet: string;
    practiceRunningStatus: (durationText: string, timeText: string | null) => string;
    practiceStoppedStatus: (ttlMinutes: number) => string;
    launchPracticeBtn: (badgeLabel: string) => string;
    startingPracticeBtn: string;
    openPracticeBtn: (badgeLabel: string) => string;
    practiceBridgeHint: string;
    refresherSimulationNote: string;
    refresherAdminTabLabel: string;
    activeSandboxShutdownBanner: (durationText: string, timeText: string | null) => string;
    hideCoachLabel: string;
    quickInjectLabel: string;
    resetTrackLabel: string;
    certificateButtonLabel: string;
    traineeNamePlaceholder: string;
    watchVideoSummary: string;
    referenceImageSummary: string;
    stepsSummary: string;
    whyItMattersLabel: string;
    openPageLabel: string;
    openSplitAdminLabel: string;
    closeSplitAdminLabel: string;
    showMeWhereLabel: string;
    markCompleteLabel: string;
    verifiedBadgeLabel: string;
    completedBadgeLabel: string;
    pendingBadgeLabel: string;
    objectivePrefix: string;
    copiedNotice: string;
    ttlRemainingLabel: (minutes: number) => string;
}

export const TRAINING_COACH_UI: Record<Locale, TrainingCoachUiStrings> = {
    en: {
        sandboxBadge: "TRAINING SANDBOX",
        sandboxBannerNote: "Practice Data Only · Zero Production DB / Parquet Impact · Auto-Wipes on Shutdown",
        coachButtonLabel: "Training Coach",
        walkthroughButtonLabel: "Guided Walkthrough",
        walkthroughButtonHint: "Open step-by-step interactive walkthroughs, 1080p videos, and 1-click :8444 Practice Sandbox launch (100% read-only on live console)",
        refresherBadge: "READ-ONLY REFRESHER",
        refresherOrientationSummary: "How This Walkthrough Works & Practice Sandbox Auto-Shutdown",
        refresherSafeNote: "You are on the live operational console (:443). Browsing steps, watching videos, viewing screenshots, and highlighting controls here is 100% read-only and never injects fake alarms or modifies live records. (Clicking actual operational controls on the main page acts on the live site.)",
        practiceCardTitle: "Need Safe Hands-On Practice? Launch Isolated Sandbox (:8444)",
        practiceIsolationBullet: "Zero Live Impact: Runs disposable practice lanes (DemoLane01 / DemoLane02) with simulated RPM & camera streams (archive.enabled = false). Nothing on :8444 ever touches live PostgreSQL, Parquet archives, config.json, or physical RPM relays.",
        practiceShutdownBullet: (m) => `Automatic Shutdown & Wipe (${m} min / ${Math.round((m / 60) * 10) / 10}h): Automatically shuts down after ${m} minutes and permanently erases all practice alarms, uploads, and edits (< 2s) so server RAM is never tied up overnight.`,
        practiceSignInBullet: "Sign-In, HTTPS & Exports: Opens https://<host>:8444 on LAN/VPN (or https://<site>-sandbox.<hub> with Let's Encrypt HTTPS over remote Federation Hub tunnels) using your existing OSCAR username/password, SSO, or Passkey. All exports carry a TRAINING SANDBOX — NON-OPERATIONAL watermark; download your PDF Completion Record before shutdown.",
        practiceRunningStatus: (dur, at) => `Practice Sandbox RUNNING · Auto-shuts down & wipes in ${dur}${at ? ` (at ${at})` : ""}`,
        practiceStoppedStatus: (m) => `Practice Sandbox STOPPED · Auto-shuts down ${m} min after launch (requires ≥ 3.5 GiB free RAM)`,
        launchPracticeBtn: (b) => `Launch Practice Sandbox (${b})`,
        startingPracticeBtn: "Starting Practice Sandbox (~20–40s)...",
        openPracticeBtn: (b) => `Open Practice Sandbox (${b})`,
        practiceBridgeHint: "1-click browser launch can be enabled once on Ubuntu with `sudo bash oscar.sh sandbox enable-ui-bridge`, or started via CLI (`sudo bash oscar.sh sandbox start` / `.\\oscar.bat sandbox start`).",
        refresherSimulationNote: "Simulated alarm injection & practice sample files activate automatically inside the :8444 Practice Sandbox.",
        refresherAdminTabLabel: "Open SensorHub Admin (New Tab — Live Console)",
        activeSandboxShutdownBanner: (dur, at) => `Auto-shutdown in ${dur}${at ? ` (at ${at})` : ""}: all practice alarms, uploads, and lane edits wipe automatically when the timer expires. Export your PDF Completion Record below before shutdown.`,
        hideCoachLabel: "Minimize Coach",
        quickInjectLabel: "Inject Event",
        resetTrackLabel: "Re-Stage Track",
        certificateButtonLabel: "Download Completion PDF",
        traineeNamePlaceholder: "Trainee name for PDF record (optional)",
        watchVideoSummary: "Watch Bite-Sized Video Guide (1080p + Captions)",
        referenceImageSummary: "Annotated Reference Screenshot & Why It Matters",
        stepsSummary: "Hands-On Guided Steps & Practice Controls",
        whyItMattersLabel: "Operational Why:",
        openPageLabel: "Go to Lab Page",
        openSplitAdminLabel: "Open Split-Pane SensorHub Admin",
        closeSplitAdminLabel: "Return to Viewer Page",
        showMeWhereLabel: "Highlight Control on Screen",
        markCompleteLabel: "Mark Step Completed",
        verifiedBadgeLabel: "Auto-Verified",
        completedBadgeLabel: "Completed",
        pendingBadgeLabel: "In Progress",
        objectivePrefix: "Outcome Check:",
        copiedNotice: "Copied to clipboard",
        ttlRemainingLabel: (m) => `${m}m left`,
    },
    es: {
        sandboxBadge: "ENTORNO DE PRÁCTICA",
        sandboxBannerNote: "Solo datos de entrenamiento · Cero impacto en BD / Parquet real · Se borra al apagarse",
        coachButtonLabel: "Guía de Práctica",
        walkthroughButtonLabel: "Recorrido guiado",
        walkthroughButtonHint: "Abrir pasos guiados, videoguías 1080p y lanzamiento en 1 clic del entorno de práctica :8444 (solo lectura en consola real)",
        refresherBadge: "REPASO SOLO LECTURA",
        refresherOrientationSummary: "Cómo funciona este recorrido y apagado automático del entorno (:8444)",
        refresherSafeNote: "Está en la consola operativa real (:443). Consultar pasos, vídeos, capturas y resaltar controles aquí es 100 % de solo lectura y nunca inyecta alarmas falsas ni altera datos reales. (Pulsar botones operativos reales en la página principal sí actúa sobre el sitio en vivo).",
        practiceCardTitle: "¿Desea práctica interactiva segura? Entorno aislado (:8444)",
        practiceIsolationBullet: "Cero impacto real: Ejecuta carriles desechables (DemoLane01 / DemoLane02) con flujos simulados (archive.enabled = false). Nada en :8444 toca PostgreSQL real, Parquet, config.json ni relés físicos.",
        practiceShutdownBullet: (m) => `Apagado y borrado automático (${m} min): Se apaga automáticamente tras ${m} minutos y purga todos los datos de práctica (< 2 s) para no consumir RAM durante la noche.`,
        practiceSignInBullet: "Acceso, HTTPS y exportaciones: Abre https://<host>:8444 en una pestaña nueva (acepte el aviso HTTPS local si aparece) e inicie sesión con su usuario/contraseña o Passkey actual. Toda exportación lleva marca TRAINING SANDBOX — NON-OPERATIONAL; descargue su PDF de finalización antes del apagado.",
        practiceRunningStatus: (dur, at) => `Entorno ACTIVO · Se apaga y purga en ${dur}${at ? ` (a las ${at})` : ""}`,
        practiceStoppedStatus: (m) => `Entorno DETENIDO · Se apaga automáticamente ${m} min después de iniciar (requiere ≥ 3.5 GiB de RAM libre)`,
        launchPracticeBtn: (b) => `Iniciar entorno de práctica (${b})`,
        startingPracticeBtn: "Iniciando entorno de práctica (~20–40 s)...",
        openPracticeBtn: (b) => `Abrir entorno de práctica (${b})`,
        practiceBridgeHint: "El inicio en 1 clic en Ubuntu se habilita una vez con `sudo bash oscar.sh sandbox enable-ui-bridge`, o por CLI (`sudo bash oscar.sh sandbox start` / `.\\oscar.bat sandbox start`).",
        refresherSimulationNote: "La inyección de alarmas simuladas y los archivos de muestra se activan automáticamente dentro del entorno :8444.",
        refresherAdminTabLabel: "Abrir SensorHub Admin (nueva pestaña — consola real)",
        activeSandboxShutdownBanner: (dur, at) => `Apagado automático en ${dur}${at ? ` (a las ${at})` : ""}: todos los datos y ajustes de práctica se borran al expirar el temporizador. Descargue abajo su PDF de finalización antes del apagado.`,
        hideCoachLabel: "Minimizar guía",
        quickInjectLabel: "Inyectar evento",
        resetTrackLabel: "Reiniciar bloque",
        certificateButtonLabel: "Descargar PDF de finalización",
        traineeNamePlaceholder: "Nombre del operador para el PDF (opcional)",
        watchVideoSummary: "Ver videoguía breve (1080p + subtítulos)",
        referenceImageSummary: "Captura de referencia y relevancia operativa",
        stepsSummary: "Pasos prácticos guiados y controles",
        whyItMattersLabel: "Por qué importa:",
        openPageLabel: "Ir a la página del ejercicio",
        openSplitAdminLabel: "Abrir SensorHub Admin en vista dividida",
        closeSplitAdminLabel: "Volver a OSCAR Viewer",
        showMeWhereLabel: "Resaltar control en pantalla",
        markCompleteLabel: "Marcar ejercicio completado",
        verifiedBadgeLabel: "Verificado automáticamente",
        completedBadgeLabel: "Completado",
        pendingBadgeLabel: "En curso",
        objectivePrefix: "Verificación:",
        copiedNotice: "Copiado al portapapeles",
        ttlRemainingLabel: (m) => `${m} min restantes`,
    },
    fr: {
        sandboxBadge: "BAC À SABLE DE FORMATION",
        sandboxBannerNote: "Données d’exercice uniquement · Zéro impact BD / Parquet réel · Purgé à l’extinction",
        coachButtonLabel: "Coach Formation",
        walkthroughButtonLabel: "Parcours guidé",
        walkthroughButtonHint: "Ouvrir les ateliers guidés, vidéos 1080p et lancement en 1 clic du bac à sable :8444 (lecture seule sur la console réelle)",
        refresherBadge: "RÉVISION LECTURE SEULE",
        refresherOrientationSummary: "Fonctionnement du parcours et arrêt automatique du bac à sable (:8444)",
        refresherSafeNote: "Vous êtes sur la console opérationnelle (:443). Parcourir les étapes, vidéos, captures et mettre en évidence les contrôles ici est 100 % en lecture seule et n’injecte jamais de fausses alarmes. (Cliquer sur les vrais boutons de la page principale agit sur le site réel.)",
        practiceCardTitle: "Pratique interactive sans risque : Bac à sable isolé (:8444)",
        practiceIsolationBullet: "Zéro impact réel : Exécute des voies jetables (DemoLane01 / DemoLane02) avec flux simulés (archive.enabled = false). Rien sur :8444 ne touche PostgreSQL réel, Parquet, config.json ni les relais physiques.",
        practiceShutdownBullet: (m) => `Extinction et purge automatiques (${m} min) : S’arrête automatiquement après ${m} minutes et efface toutes les données d’exercice (< 2 s) afin de préserver la RAM du serveur.`,
        practiceSignInBullet: "Connexion, HTTPS et exports : Ouvre https://<hôte>:8444 dans un nouvel onglet (acceptez l’invite HTTPS locale si affichée) et connectez-vous avec vos identifiants ou Passkey habituels. Tous les exports portent le filigrane TRAINING SANDBOX — NON-OPERATIONAL ; téléchargez votre PDF de réussite avant l’extinction.",
        practiceRunningStatus: (dur, at) => `Bac à sable ACTIF · Arrêt et purge dans ${dur}${at ? ` (à ${at})` : ""}`,
        practiceStoppedStatus: (m) => `Bac à sable ARRÊTÉ · Extinction automatique ${m} min après lancement (≥ 3,5 Gio de RAM libre requis)`,
        launchPracticeBtn: (b) => `Lancer le bac à sable (${b})`,
        startingPracticeBtn: "Démarrage du bac à sable (~20–40 s)...",
        openPracticeBtn: (b) => `Ouvrir le bac à sable (${b})`,
        practiceBridgeHint: "Le lancement en 1 clic sous Ubuntu s’active une fois via `sudo bash oscar.sh sandbox enable-ui-bridge`, ou par CLI (`sudo bash oscar.sh sandbox start` / `.\\oscar.bat sandbox start`).",
        refresherSimulationNote: "L’injection d’alarmes simulées et les fichiers d’exemple s’activent automatiquement dans le bac à sable :8444.",
        refresherAdminTabLabel: "Ouvrir SensorHub Admin (nouvel onglet — console réelle)",
        activeSandboxShutdownBanner: (dur, at) => `Extinction automatique dans ${dur}${at ? ` (à ${at})` : ""} : toutes les données d’exercice seront effacées à l’expiration. Téléchargez votre attestation PDF ci-dessous avant l’arrêt.`,
        hideCoachLabel: "Réduire le coach",
        quickInjectLabel: "Injecter un événement",
        resetTrackLabel: "Réinitialiser le parcours",
        certificateButtonLabel: "Télécharger le PDF de réussite",
        traineeNamePlaceholder: "Nom du stagiaire pour le PDF (facultatif)",
        watchVideoSummary: "Voir le guide vidéo court (1080p + sous-titres)",
        referenceImageSummary: "Capture de référence et intérêt opérationnel",
        stepsSummary: "Étapes pratiques guidées et commandes",
        whyItMattersLabel: "Pourquoi c’est essentiel :",
        openPageLabel: "Ouvrir la page de l’atelier",
        openSplitAdminLabel: "Ouvrir SensorHub Admin en vue partagée",
        closeSplitAdminLabel: "Revenir à OSCAR Viewer",
        showMeWhereLabel: "Mettre en évidence à l’écran",
        markCompleteLabel: "Marquer comme terminé",
        verifiedBadgeLabel: "Auto-vérifié",
        completedBadgeLabel: "Terminé",
        pendingBadgeLabel: "En cours",
        objectivePrefix: "Objectif vérifié :",
        copiedNotice: "Copié dans le presse-papiers",
        ttlRemainingLabel: (m) => `${m} min restantes`,
    },
    el: {
        sandboxBadge: "ΠΕΡΙΒΑΛΛΟΝ ΕΚΠΑΙΔΕΥΣΗΣ",
        sandboxBannerNote: "Μόνο δεδομένα εξάσκησης · Μηδενική επίδραση σε ΒΔ / Parquet · Διαγράφεται στον τερματισμό",
        coachButtonLabel: "Οδηγός Εκπαίδευσης",
        walkthroughButtonLabel: "Καθοδηγούμενη περιήγηση",
        walkthroughButtonHint: "Άνοιγμα καθοδηγούμενων βημάτων, βιντεοοδηγών 1080p και εκκίνησης με 1 κλικ του περιβάλλοντος εξάσκησης :8444 (μόνο ανάγνωση στη ζωντανή κονσόλα)",
        refresherBadge: "ΕΠΑΝΑΛΗΨΗ ΜΟΝΟ ΑΝΑΓΝΩΣΗΣ",
        refresherOrientationSummary: "Πώς λειτουργεί η περιήγηση & αυτόματος τερματισμός περιβάλλοντος (:8444)",
        refresherSafeNote: "Βρίσκεστε στη ζωντανή επιχειρησιακή κονσόλα (:443). Η προβολή βημάτων, βίντεο, εικόνων και η επισήμανση στοιχείων εδώ είναι 100% μόνο για ανάγνωση και δεν εγχέει ποτέ εικονικούς συναγερμούς. (Τα πραγματικά κουμπιά της κύριας σελίδας επιδρούν στο ζωντανό σύστημα.)",
        practiceCardTitle: "Θέλετε ασφαλή πρακτική εξάσκηση; Απομονωμένο περιβάλλον (:8444)",
        practiceIsolationBullet: "Μηδενική επίδραση στην παραγωγή: Εκτελεί αναλώσιμες λωρίδες (DemoLane01 / DemoLane02) με εικονικές ροές (archive.enabled = false). Τίποτα στο :8444 δεν αγγίζει την PostgreSQL παραγωγής, τα Parquet, το config.json ή τα φυσικά ρελέ RPM.",
        practiceShutdownBullet: (m) => `Αυτόματος τερματισμός & διαγραφή (${m} λεπτά): Τερματίζεται αυτόματα μετά από ${m} λεπτά και διαγράφει μόνιμα όλα τα δεδομένα εξάσκησης (< 2 δευτ.) ώστε να μην δεσμεύεται μνήμη RAM.`,
        practiceSignInBullet: "Σύνδεση, HTTPS & εξαγωγές: Ανοίγει το https://<host>:8444 σε νέα καρτέλα (αποδεχθείτε την τοπική προειδοποίηση HTTPS αν εμφανιστεί) και συνδεθείτε με τα υπάρχοντα στοιχεία ή Passkey σας. Κάθε εξαγωγή φέρει υδατογράφημα TRAINING SANDBOX — NON-OPERATIONAL· κατεβάστε το PDF ολοκλήρωσης πριν από τον τερματισμό.",
        practiceRunningStatus: (dur, at) => `Περιβάλλον ΕΝΕΡΓΟ · Αυτόματος τερματισμός & εκκαθάριση σε ${dur}${at ? ` (στις ${at})` : ""}`,
        practiceStoppedStatus: (m) => `Περιβάλλον ΑΝΕΝΕΡΓΟ · Αυτόματος τερματισμός ${m} λεπτά μετά την εκκίνηση (απαιτεί ≥ 3,5 GiB ελεύθερη RAM)`,
        launchPracticeBtn: (b) => `Εκκίνηση περιβάλλοντος εξάσκησης (${b})`,
        startingPracticeBtn: "Εκκίνηση περιβάλλοντος εξάσκησης (~20–40 δευτ.)...",
        openPracticeBtn: (b) => `Άνοιγμα περιβάλλοντος εξάσκησης (${b})`,
        practiceBridgeHint: "Η εκκίνηση με 1 κλικ σε Ubuntu ενεργοποιείται μία φορά με `sudo bash oscar.sh sandbox enable-ui-bridge`, ή μέσω CLI (`sudo bash oscar.sh sandbox start` / `.\\oscar.bat sandbox start`).",
        refresherSimulationNote: "Η έγχυση εικονικών συναγερμών και τα δείγματα αρχείων ενεργοποιούνται αυτόματα μέσα στο περιβάλλον :8444.",
        refresherAdminTabLabel: "Άνοιγμα SensorHub Admin (νέα καρτέλα — ζωντανή κονσόλα)",
        activeSandboxShutdownBanner: (dur, at) => `Αυτόματος τερματισμός σε ${dur}${at ? ` (στις ${at})` : ""}: όλα τα δεδομένα εξάσκησης διαγράφονται αυτόματα στη λήξη. Εξαγάγετε το PDF ολοκλήρωσης παρακάτω πριν από τον τερματισμό.`,
        hideCoachLabel: "Ελαχιστοποίηση οδηγού",
        quickInjectLabel: "Έγχυση συμβάντος",
        resetTrackLabel: "Επαναφορά ενότητας",
        certificateButtonLabel: "Λήψη PDF ολοκλήρωσης",
        traineeNamePlaceholder: "Ονοματεπώνυμο εκπαιδευόμενου για PDF (προαιρετικό)",
        watchVideoSummary: "Προβολή σύντομου βιντεοοδηγού (1080p + υπότιτλοι)",
        referenceImageSummary: "Εικόνα αναφοράς & επιχειρησιακή σημασία",
        stepsSummary: "Καθοδηγούμενα πρακτικά βήματα & ενέργειες",
        whyItMattersLabel: "Επιχειρησιακή σημασία:",
        openPageLabel: "Μετάβαση στη σελίδα άσκησης",
        openSplitAdminLabel: "Άνοιγμα SensorHub Admin σε διπλή προβολή",
        closeSplitAdminLabel: "Επιστροφή στο OSCAR Viewer",
        showMeWhereLabel: "Επισήμανση στοιχείου στην οθόνη",
        markCompleteLabel: "Σήμανση ως ολοκληρωμένο",
        verifiedBadgeLabel: "Αυτόματη επαλήθευση",
        completedBadgeLabel: "Ολοκληρώθηκε",
        pendingBadgeLabel: "Σε εξέλιξη",
        objectivePrefix: "Έλεγχος στόχου:",
        copiedNotice: "Αντιγράφηκε στο πρόχειρο",
        ttlRemainingLabel: (m) => `${m} λεπ. ακόμη`,
    },
};

export const TRAINING_TRACKS: readonly TrainingTrackDefinition[] = [
    {
        id: "operator",
        shortLabel: {
            en: "1 · Operator",
            es: "1 · Operador",
            fr: "1 · Opérateur",
            el: "1 · Χειριστής",
        },
        title: {
            en: "Track 1 — Gatehouse Operator",
            es: "Bloque 1 — Operador de garita",
            fr: "Parcours 1 — Opérateur de guérite",
            el: "Ενότητα 1 — Χειριστής πύλης",
        },
        subtitle: {
            en: "Pre-wires DemoLane01 online with live RTSP video, Container OCR, EML, and Cargo NII samples so you can practice real-time monitoring, fault triage, spectroscopy, and alarm adjudication.",
            es: "Preconfigura DemoLane01 en línea con vídeo RTSP, OCR de contenedores, EML y muestras NII para practicar monitoreo, fallos, espectroscopía y adjudicación.",
            fr: "Préconfigure DemoLane01 en ligne avec vidéo RTSP, OCR conteneur, EML et échantillons NII pour pratiquer la surveillance, le tri des défauts et l’adjudication.",
            el: "Προετοιμάζει τη λωρίδα DemoLane01 σε σύνδεση με ζωντανό βίντεο RTSP, OCR εμπορευματοκιβωτίων, EML και δείγματα NII για πρακτική εξάσκηση.",
        },
    },
    {
        id: "supervisor",
        shortLabel: {
            en: "2 · Supervisor",
            es: "2 · Supervisor",
            fr: "2 · Superviseur",
            el: "2 · Επόπτης",
        },
        title: {
            en: "Track 2 — Shift Supervisor & Analyst",
            es: "Bloque 2 — Supervisor de turno y analista",
            fr: "Parcours 2 — Superviseur et analyste",
            el: "Ενότητα 2 — Επόπτης βάρδιας & αναλυτής",
        },
        subtitle: {
            en: "Seeds 2 Operational View lanes (`north-gate`, `south-gate`) with multi-category SNM, Medical, NORM, and multi-pass container history for UpSet analytics and multi-format reports.",
            es: "Prepara 2 carriles con vistas operativas (`north-gate`, `south-gate`) e historial multicategoría SNM/Médico/NORM para análisis UpSet e informes multiformato.",
            fr: "Prépare 2 voies (`north-gate`, `south-gate`) avec un historique multi-catégories SNM/Médical/NORM pour l’analyse UpSet et les rapports multi-formats.",
            el: "Προετοιμάζει 2 λωρίδες (`north-gate`, `south-gate`) με ιστορικό πολλαπλών κατηγοριών SNM/Ιατρικών/NORM για γραφήματα UpSet και αναφορές.",
        },
    },
    {
        id: "administrator",
        shortLabel: {
            en: "3 · Administrator",
            es: "3 · Administrador",
            fr: "3 · Administrateur",
            el: "3 · Διαχειριστής",
        },
        title: {
            en: "Track 3 — System Administrator (Blank Slate)",
            es: "Bloque 3 — Administrador del sistema (desde cero)",
            fr: "Parcours 3 — Administrateur système (page blanche)",
            el: "Ενότητα 3 — Διαχειριστής συστήματος (από το μηδέν)",
        },
        subtitle: {
            en: "Starts with 0 configured lanes while loopback Rapiscan (`127.0.0.1:10099`) and RTSP (`127.0.0.1:8554/tutorial-cam`) run locally so you can practice SensorHub Admin lane setup, CSV import, RBAC/Passkeys, and Runtime Extensions.",
            es: "Inicia con 0 carriles mientras el emulador Rapiscan (`127.0.0.1:10099`) y RTSP (`127.0.0.1:8554/tutorial-cam`) corren localmente para practicar alta manual, CSV, Passkeys y Extensiones.",
            fr: "Démarre avec 0 voie configurée tandis que Rapiscan (`127.0.0.1:10099`) et RTSP (`127.0.0.1:8554/tutorial-cam`) tournent localement pour pratiquer la configuration Admin, l’import CSV, les Passkeys et les Extensions.",
            el: "Ξεκινά με 0 λωρίδες ενώ οι τοπικοί εξομοιωτές Rapiscan (`127.0.0.1:10099`) και RTSP (`127.0.0.1:8554/tutorial-cam`) λειτουργούν για εξάσκηση στο SensorHub Admin, CSV, Passkeys & Επεκτάσεις.",
        },
    },
];

export const TRAINING_LABS: readonly TrainingLabDefinition[] = [
    // ==================== TRACK 1: GATEHOUSE OPERATOR ====================
    {
        id: "op-1",
        trackId: "operator",
        badge: "1.1",
        route: "/health",
        pageIconKey: "health",
        videoGuideSlug: "15-status-of-health-and-site-map",
        screenshotFile: "18-viewer-dashboard.png",
        screenshotCaption: "Live Dashboard & Status of Health showing Online RPM/camera tiles and fault badges.",
        title: "Live Lane Monitoring, Status of Health & Fault Triage",
        durationEstimate: "3 min",
        whyItMatters:
            "Before trusting clean portal passes, operators must check Status of Health {{icon:health}} (the heart-pulse monitor icon) and Dashboard {{icon:dashboard}} (the four-tile grid icon) to confirm both the RPM and lane camera are Online with zero active Gamma High/Low or Tamper faults.",
        steps: [
            "Open Status of Health {{icon:health}} (`/health`, the heart-pulse monitor icon in the left navigation bar) or Dashboard {{icon:dashboard}} (`/`, the four-tile grid icon) and confirm `DemoLane01` shows Online for both the Rapiscan RPM and camera — or click Help {{icon:help}} (the circled `?` icon in the top-right bar) anytime for quick reference.",
            "Click 'Inject Gamma High Fault' or 'Inject Tamper Alarm' below and watch the Status of Health {{icon:health}} indicator immediately flag the detector fault.",
            "Click 'Clear Faults' to restore normal background (`GB` / `TC`), then click 'Inject Clean Pass' to stream a ~4s non-alarm vehicle pass and verify it appears at row #1 of Events {{icon:events}} (`/event-log`) with Status `None` (without interrupting the Dashboard alarm queue).",
        ],
        injectActions: [
            { scenario: "fault_gamma_high", label: "Inject Gamma High Fault" },
            { scenario: "fault_tamper", label: "Inject Tamper Alarm" },
            { scenario: "clear_faults", label: "Clear Faults" },
            { scenario: "clean_pass", label: "Inject Clean Pass" },
        ],
        spotlights: [
            {
                id: "health",
                selector: '[data-testid="nav-item-health"]',
                label: "Highlight Status of Health Icon",
                iconKey: "health",
            },
            {
                id: "dashboard",
                selector: '[data-testid="nav-item-dashboard"]',
                label: "Highlight Dashboard Icon",
                iconKey: "dashboard",
            },
            {
                id: "help",
                selector: '[data-testid="navbar-help-button"]',
                label: "Highlight Help (?) Icon",
                iconKey: "help",
            },
        ],
        spotlightSelector: '[data-testid="nav-item-health"]',
        spotlightLabel: "Highlight Status of Health Icon",
        objectiveSummary: "At least 1 lane online and 1 occupancy recorded (`onlineLaneCount >= 1 && totalOccupancies >= 1`).",
        isAutoVerified: (v) => v.onlineLaneCount >= 1 && v.totalOccupancies >= 1,
    },
    {
        id: "op-2",
        trackId: "operator",
        badge: "1.2",
        route: "/",
        pageIconKey: "dashboard",
        videoGuideSlug: "09-dashboard-monitoring-and-quick-adjudication",
        screenshotFile: "26-dashboard-adjudication.png",
        screenshotCaption: "Dashboard quick-preview drawer with 5 retained JPEG keyframes, count profile, and disposition selector.",
        title: "Priority Alarm Queue & 5-Frame Alarm Adjudication",
        durationEstimate: "4 min",
        whyItMatters:
            "Every un-suppressed Gamma or Neutron alarm stays bold in the shared Gatehouse queue on Dashboard {{icon:dashboard}} (the four-tile grid icon) until an operator reviews the radiation profile, retained 5-JPEG frames, and records an auditable disposition code.",
        steps: [
            "Click 'Inject Gamma Alarm' below if you want a fresh localized point-source gamma spike on `DemoLane01`.",
            "On Dashboard {{icon:dashboard}} (`/`, the four-tile grid icon in the left navigation bar) or Events {{icon:events}} (`/event-log`, the warning-triangle `!` icon), click the bold alarm row to inspect its gamma count curve above the NSIGMA threshold and its retained camera snapshots (use Settings {{icon:settings}}, the top-right gear icon, to configure visual or audio unread alerts).",
            "Select a Disposition Code (for example Code 9: Authorized Test, Maintenance, or Training Activity), set Secondary Inspection Status, enter operator notes, and click Submit Adjudication.",
        ],
        injectActions: [
            { scenario: "gamma_alarm", label: "Inject Gamma Alarm" },
        ],
        spotlights: [
            {
                id: "dashboard",
                selector: '[data-testid="nav-item-dashboard"]',
                label: "Highlight Dashboard Icon",
                iconKey: "dashboard",
            },
            {
                id: "events",
                selector: '[data-testid="nav-item-events"]',
                label: "Highlight Events Icon",
                iconKey: "events",
            },
            {
                id: "settings",
                selector: '[data-testid="navbar-settings-button"]',
                label: "Highlight Settings Gear Icon",
                iconKey: "settings",
            },
        ],
        spotlightSelector: '[data-testid="nav-item-dashboard"]',
        spotlightLabel: "Highlight Dashboard Icon",
        objectiveSummary: "Submit at least 1 human operator adjudication (`operatorAdjudicatedCount >= 1`).",
        isAutoVerified: (v) => v.operatorAdjudicatedCount >= 1,
    },
    {
        id: "op-3",
        trackId: "operator",
        badge: "1.3",
        route: "/event-log",
        pageIconKey: "events",
        videoGuideSlug: "12-event-log-filtering-and-adjudication-codes",
        screenshotFile: "27-event-list.png",
        screenshotCaption: "Events log filtering across Code 9999 (EML Non-Threat), Code 9998 (Extended Occupancy), and active Neutron alarms.",
        title: "NORM (Code 9999), Extended Occupancy (Code 9998) & Neutron Safety",
        durationEstimate: "4 min",
        whyItMatters:
            "OSCAR reduces nuisance workload by auto-releasing spatially uniform NORM cargo (`Code 9999`) and stalled gamma-only holds (`Code 9998`), while strictly refusing to auto-release any Neutron alarm.",
        steps: [
            "Click 'Inject Distributed NORM (Code 9999)' (~4s transit): the Coach opens Events {{icon:events}} (`/event-log`, the warning-triangle `!` icon) where EML auto-adjudicates the pass at `t = 0` as `Code 9999: EML Non-Threat` — intentionally suppressed from the Dashboard {{icon:dashboard}} (`/`) active alarm queue!",
            "Click 'Inject Extended Hold (Code 9998)' (~10s stalled vehicle hold): `Fault - Extended Occupancy` triggers at 8s and EML auto-adjudicates gamma-only exit as `Code 9998: Extended Occupancy Gamma Alarm` in Events {{icon:events}} (`/event-log`).",
            "Click 'Inject Neutron Alarm' (~4s transit) and confirm in Events {{icon:events}} and Dashboard {{icon:dashboard}} that Neutron triggers NEVER auto-release and immediately demand human secondary inspection.",
        ],
        injectActions: [
            { scenario: "norm_eml", label: "Inject Distributed NORM (Code 9999)" },
            { scenario: "extended_occupancy", label: "Inject Extended Hold (Code 9998)" },
            { scenario: "neutron_alarm", label: "Inject Neutron Alarm" },
        ],
        spotlights: [
            {
                id: "events",
                selector: '[data-testid="nav-item-events"]',
                label: "Highlight Events Icon",
                iconKey: "events",
            },
            {
                id: "health",
                selector: '[data-testid="nav-item-health"]',
                label: "Highlight Status of Health Icon",
                iconKey: "health",
            },
        ],
        spotlightSelector: '[data-testid="nav-item-events"]',
        spotlightLabel: "Highlight Events Icon",
        objectiveSummary: "Observe at least 1 automated `Code 9999` or `Code 9998` disposition (`emlCode9999Count >= 1 || extendedCode9998Count >= 1`).",
        isAutoVerified: (v) => v.emlCode9999Count >= 1 || v.extendedCode9998Count >= 1,
    },
    {
        id: "op-4",
        trackId: "operator",
        badge: "1.4",
        route: "/event-log",
        pageIconKey: "alarm-transfer",
        videoGuideSlug: "17-vehicle-ocr-and-adjudication",
        screenshotFile: "29-event-details-adjudication.png",
        screenshotCaption: "Event Details adjudication workflow with ISO 6346 Container OCR chip, .n42 spectrum upload, and QR export.",
        title: "Container OCR, Secondary Spectroscopy (.n42) & QR Transfer",
        durationEstimate: "5 min",
        whyItMatters:
            "Attaching the handheld RIID `.n42` spectrum and verified ISO 6346 container ID ties physical secondary inspection evidence permanently to the portal occupancy.",
        steps: [
            "Click 'Download Practice Spectrum (.n42)' below to save a synthetic secondary-inspection gamma spectrum to your computer.",
            "Open any alarm's Event Details page from Events {{icon:events}} (`/event-log`, the warning-triangle `!` icon in the left navigation bar), inspect the Vehicle / Container ID field (or click an OCR suggestion chip), upload `sample-cs137-co60.n42`, select Cs-137 / Co-60, and submit.",
            "Optional: Click 'Share / Export QR' {{icon:qr}} on the event or open Alarm Transfer {{icon:alarm-transfer}} (`/alarm-transfer`, the QR-scanner frame icon in the left navigation bar) — notice sandbox QR exports carry an explicit `TRAINING SANDBOX — NON-OPERATIONAL` watermark.",
        ],
        sampleFiles: [
            { fileName: "sample-cs137-co60.n42", buttonLabel: "Download Practice Spectrum (.n42)" },
        ],
        copySnippets: [
            { label: "Copy Container ID", value: "SCFU8572724" },
        ],
        spotlights: [
            {
                id: "events",
                selector: '[data-testid="nav-item-events"]',
                label: "Highlight Events Icon",
                iconKey: "events",
            },
            {
                id: "alarm-transfer",
                selector: '[data-testid="nav-item-alarm-transfer"]',
                label: "Highlight Alarm Transfer QR Icon",
                iconKey: "alarm-transfer",
            },
        ],
        spotlightSelector: '[data-testid="nav-item-events"]',
        spotlightLabel: "Highlight Events Icon",
        objectiveSummary: "Record an adjudication with isotope/spectrum evidence or a normalized Vehicle/Container ID.",
        isAutoVerified: (v) => v.adjudicatedWithEvidenceCount >= 1 || v.adjudicatedWithVehicleIdCount >= 1,
    },
    {
        id: "op-5",
        trackId: "operator",
        badge: "1.5",
        route: "/event-log",
        pageIconKey: "uff",
        videoGuideSlug: "27-cargo-uff-smb-and-xray-inspection",
        screenshotFile: "49-cargo-uff-16bit-xray-inspector.png",
        screenshotCaption: "16-bit WCO UFF 3.0 cargo radiograph inspector with window/level LUT controls, HEMD effective-Z material bands, and aligned RPM count strip.",
        title: "16-Bit WCO UFF Cargo X-Ray & HEMD Material Inspection",
        durationEstimate: "4 min",
        whyItMatters:
            "Correlating dual-energy cargo X-ray High-Z shielding anomalies (`Z_eff > 72`) via the Cargo X-Ray / UFF inspector {{icon:uff}} (the stacked-layers icon) with the RPM gamma/neutron count profile pinpoints shielded sources inside dense cargo pallets.",
        steps: [
            "Open Events {{icon:events}} (`/event-log`, the warning-triangle `!` icon in the left navigation bar) and paste the sandbox UFF UUID (`dfb985c4-eb26-41ab-938b-ad2a1f5966d4`) or container `SCFU8572724` into the search bar to reveal the Open Cargo X-Ray {{icon:uff}} stacked-layers button, OR open an Event Details page and click Browse Cargo NII Share / Upload `.uff`.",
            "Open the 16-bit X-Ray Inspector {{icon:uff}}, adjust Window/Level contrast, toggle the HEMD High-Z material overlay (`Organic`, `Intermediate`, `Inorganic`, `High-Z Shielding`), and inspect the localized High-Z metallic attenuation anomaly.",
            "You can also download `sample-cargo-uff3.uff` below to test direct client-side `.uff` file upload.",
        ],
        sampleFiles: [
            { fileName: "sample-cargo-uff3.uff", buttonLabel: "Download Practice Cargo Scan (.uff)" },
        ],
        copySnippets: [
            { label: "Copy UFF Scan UUID", value: "dfb985c4-eb26-41ab-938b-ad2a1f5966d4" },
        ],
        spotlights: [
            {
                id: "events",
                selector: '[data-testid="nav-item-events"]',
                label: "Highlight Events Icon",
                iconKey: "events",
            },
            {
                id: "uff",
                selector: '[data-testid="event-log-open-uff-btn"], [data-testid="vehicle-id-search-bar"]',
                label: "Highlight Cargo UFF Search / X-Ray Control",
                iconKey: "uff",
            },
        ],
        spotlightSelector: '[data-testid="nav-item-events"]',
        spotlightLabel: "Highlight Events Icon",
        objectiveSummary: "Sandbox Cargo NII index active with practice `.uff` packages (`cargoUffEnabled && cargoUffIndexedCount >= 1`).",
        isAutoVerified: (v) => v.cargoUffEnabled && v.cargoUffIndexedCount >= 1,
    },

    // ==================== TRACK 2: SUPERVISOR & ANALYST ====================
    {
        id: "sup-1",
        trackId: "supervisor",
        badge: "2.1",
        route: "/event-log",
        pageIconKey: "scoped-view",
        videoGuideSlug: "10-operational-views-scoping",
        screenshotFile: "35-vehicle-pass-comparison.png",
        screenshotCaption: "Scoped View workstation filter and Multi-Pass Vehicle Comparison correlating passes across North Gate and South Gate.",
        title: "Operational Views (`north-gate` / `south-gate`) & Multi-Pass Correlation",
        durationEstimate: "4 min",
        whyItMatters:
            "Shift supervisors scope gatehouse screens to specific portals (`?view=north-gate`) using the top-bar Scoped View {{icon:scoped-view}} selector while correlating repeat or re-scan passes of the same container across all lanes.",
        steps: [
            "Use the top-bar Scoped View {{icon:scoped-view}} dropdown (in the upper console bar) to switch between All Lanes, `north-gate` (`DemoLane01`), and `south-gate` (`DemoLane02`).",
            "Open Events {{icon:events}} (`/event-log`, the warning-triangle `!` icon in the left navigation bar), search for container `SCFU8572724`, and open Multi-Pass Vehicle Comparison to compare the primary and confirmation passes side by side.",
            "Save a reusable filter in Saved Queries (for example, Alarms Only or Code 1 Real Alarms) for one-click shift handoff.",
        ],
        copySnippets: [
            { label: "Copy Multi-Pass Container", value: "SCFU8572724" },
        ],
        spotlights: [
            {
                id: "scoped-view",
                selector: '[data-testid="navbar-scoped-view-select"], [data-testid="navbar-scoped-view-badge"]',
                label: "Highlight Scoped View Selector",
                iconKey: "scoped-view",
            },
            {
                id: "events",
                selector: '[data-testid="nav-item-events"]',
                label: "Highlight Events Icon",
                iconKey: "events",
            },
        ],
        spotlightSelector: '[data-testid="navbar-scoped-view-select"]',
        spotlightLabel: "Highlight Scoped View Selector",
        objectiveSummary: "2 Operational Views active with correlated multi-pass container history (`operationalViewCount >= 2 && multiPassVehicleCount >= 1`).",
        isAutoVerified: (v) => v.operationalViewCount >= 2 && v.multiPassVehicleCount >= 1,
    },
    {
        id: "sup-2",
        trackId: "supervisor",
        badge: "2.2",
        route: "/report",
        pageIconKey: "report",
        videoGuideSlug: "16-national-statistics-and-reports",
        screenshotFile: "40-upset-category-filters-and-other-snm.png",
        screenshotCaption: "Adjudication Report UpSet co-occurrence plot with crimson SNM highlighting and multi-format PDF/CSV/JSON/XLSX export.",
        title: "UpSet SNM Co-Occurrence Analytics & 6-Type Multi-Format Reports",
        durationEstimate: "4 min",
        whyItMatters:
            "Supervisors audit alarm rates, EML suppression (`Code 9999`), and Special Nuclear Material (`SNM`) isotope intersections in Report Generator {{icon:report}} (the three-bar chart icon) across PDF, CSV, JSON, and Excel workbooks.",
        steps: [
            "Open Report Generator {{icon:report}} (`/report`, the three-bar chart icon in the left navigation bar) and select Adjudication Report (`ADJUDICATION`) or RDS Site Report (`RDS_SITE`).",
            "Generate a PDF report and inspect the inline preview: verify the `TRAINING SANDBOX — NON-OPERATIONAL` header/footer watermark and the UpSet Alarm & Source-Category Co-Occurrence chart.",
            "Switch format to Excel (`.xlsx`), CSV, or JSON (or run a `VEHICLE_INCIDENT` report for `SCFU8572724`) to verify structured exports.",
        ],
        copySnippets: [
            { label: "Copy Incident Vehicle ID", value: "SCFU8572724" },
        ],
        spotlights: [
            {
                id: "report",
                selector: '[data-testid="nav-item-report"]',
                label: "Highlight Report Generator Icon",
                iconKey: "report",
            },
            {
                id: "events",
                selector: '[data-testid="nav-item-events"]',
                label: "Highlight Events Icon",
                iconKey: "events",
            },
        ],
        spotlightSelector: '[data-testid="nav-item-report"]',
        spotlightLabel: "Highlight Report Generator Icon",
        objectiveSummary: "Generate at least 1 report in `/report` (`generatedReportCount >= 1`).",
        isAutoVerified: (v) => v.generatedReportCount >= 1,
    },
    {
        id: "sup-3",
        trackId: "supervisor",
        badge: "2.3",
        route: "/national-view",
        pageIconKey: "national",
        videoGuideSlug: "18-operator-help-and-support-bundle",
        screenshotFile: "34-viewer-help-support-bundle.png",
        screenshotCaption: "National node overview and 1-click secret-redacted Support Bundle export inside Help (?).",
        title: "National Node Summary & Secret-Redacted Support Bundles",
        durationEstimate: "3 min",
        whyItMatters:
            "When escalating field anomalies across sites in National {{icon:national}} (the connected-nodes network icon), supervisors open Help {{icon:help}} (the circled `?` icon) to export a single `.zip` diagnostic bundle with all passwords, tokens, cookies, and RTSP credentials automatically scrubbed.",
        steps: [
            "Open National {{icon:national}} (`/national-view`, the connected-nodes network icon in the left navigation bar) to review aggregated occupancies, gamma/neutron alarms, and faults across time windows (federated nodes are managed in Nodes {{icon:servers}}, the cloud icon).",
            "Click the top-right Help {{icon:help}} button (the circled `?` icon), open the 'Manual & Video Guides' tab, and click 'Export Support Bundle' to download a redacted diagnostic `.zip`.",
        ],
        spotlights: [
            {
                id: "national",
                selector: '[data-testid="nav-item-national"]',
                label: "Highlight National Icon",
                iconKey: "national",
            },
            {
                id: "help",
                selector: '[data-testid="navbar-help-button"]',
                label: "Highlight Help (?) Icon",
                iconKey: "help",
            },
            {
                id: "servers",
                selector: '[data-testid="nav-item-servers"]',
                label: "Highlight Nodes (Cloud) Icon",
                iconKey: "servers",
            },
        ],
        spotlightSelector: '[data-testid="nav-item-national"]',
        spotlightLabel: "Highlight National Icon",
        objectiveSummary: "Supervisor 2-lane node healthy (`onlineLaneCount >= 2`).",
        isAutoVerified: (v) => v.onlineLaneCount >= 2,
    },

    // ==================== TRACK 3: SYSTEM ADMINISTRATOR ====================
    {
        id: "adm-1",
        trackId: "administrator",
        badge: "3.1",
        route: "/",
        pageIconKey: "split-admin",
        splitPaneAdmin: true,
        videoGuideSlug: "06-admin-manual-lane-and-site-diagram",
        screenshotFile: "25-lane-options-filled.png",
        screenshotCaption: "SensorHub Admin Lane System configuration with Rapiscan RPM and Custom RTSP camera options.",
        title: "Manual Lane, Rapiscan RPM & Loopback RTSP Camera Setup",
        durationEstimate: "6 min",
        whyItMatters:
            "Starting from 0 lanes in this sandbox lets administrators practice adding a Lane System in Split-Pane SensorHub Admin {{icon:split-admin}} (the dual-pane icon) without touching production sensors or `config.json`.",
        steps: [
            "Click 'Open Split-Pane SensorHub Admin' {{icon:split-admin}} (the dual-pane icon button above) to open `/sensorhub/admin` right beside this Training Coach.",
            "Right-click the Systems pane -> Add Module -> Lane System (`DemoLane01`, UID `tutorial-lane-01`, Auto-Start checked). Under Lane Options, add Initial RPM Config (`Rapiscan`, Host `127.0.0.1`, Port `10099`, EML enabled) and Initial Camera Config (`Custom`, Host `127.0.0.1:8554`, Stream Path `/tutorial-cam`).",
            "Click Apply Changes and Start the module — then verify on Status of Health {{icon:health}} (the heart-pulse monitor icon in the left navigation bar) that your new lane comes Online!",
        ],
        copySnippets: [
            { label: "Copy RPM Host", value: "127.0.0.1" },
            { label: "Copy RPM Port", value: "10099" },
            { label: "Copy Camera Host", value: "127.0.0.1:8554" },
            { label: "Copy Stream Path", value: "/tutorial-cam" },
        ],
        spotlights: [
            {
                id: "split-admin",
                selector: '[data-testid="training-toggle-split-admin"], [data-testid="training-refresher-admin-link"]',
                label: "Highlight Split-Pane Admin Button",
                iconKey: "split-admin",
            },
            {
                id: "health",
                selector: '[data-testid="nav-item-health"]',
                label: "Highlight Status of Health Icon",
                iconKey: "health",
            },
        ],
        spotlightSelector: '[data-testid="training-toggle-split-admin"], [data-testid="training-refresher-admin-link"]',
        spotlightLabel: "Highlight Split-Pane Admin Button",
        objectiveSummary: "Configure and start at least 1 online Lane System (`configuredLaneCount >= 1 && onlineLaneCount >= 1`).",
        isAutoVerified: (v) => v.configuredLaneCount >= 1 && v.onlineLaneCount >= 1,
    },
    {
        id: "adm-2",
        trackId: "administrator",
        badge: "3.2",
        route: "/",
        pageIconKey: "split-admin",
        splitPaneAdmin: true,
        videoGuideSlug: "05-admin-lane-spreadsheet-sync",
        screenshotFile: "16-csv-upload-success.png",
        screenshotCaption: "Bulk multi-lane CSV configuration import inside SensorHub Admin -> Services -> OSCAR Service.",
        title: "1-Click Bulk Lane Spreadsheet Import (`tutorial-1-lane.csv`)",
        durationEstimate: "3 min",
        whyItMatters:
            "At multi-lane ports of entry, importing a validated `config.csv` in SensorHub Admin {{icon:split-admin}} provisions RPMs, RTSP cameras, coordinates, and `OperationalViews` in seconds.",
        steps: [
            "Click 'Download 1-Lane Tutorial CSV' below to save `tutorial-1-lane.csv` (pre-targeted at loopback `127.0.0.1:10099` and `127.0.0.1:8554/tutorial-cam` with `archiveEnabled=false`).",
            "Open Split-Pane SensorHub Admin {{icon:split-admin}} (the dual-pane icon button) -> Services -> OSCAR Service, upload `tutorial-1-lane.csv` under Lane Configuration Spreadsheet, and click Apply.",
            "Return to OSCAR Viewer (`Return to Viewer Page`) on Dashboard {{icon:dashboard}} (`/`, the four-tile grid icon in the left navigation bar) and confirm `DemoLane01` is online and streaming live video!",
        ],
        sampleFiles: [
            { fileName: "tutorial-1-lane.csv", buttonLabel: "Download 1-Lane Tutorial CSV" },
        ],
        spotlights: [
            {
                id: "split-admin",
                selector: '[data-testid="training-toggle-split-admin"], [data-testid="training-refresher-admin-link"]',
                label: "Highlight Split-Pane Admin Button",
                iconKey: "split-admin",
            },
            {
                id: "dashboard",
                selector: '[data-testid="nav-item-dashboard"]',
                label: "Highlight Dashboard Icon",
                iconKey: "dashboard",
            },
        ],
        spotlightSelector: '[data-testid="training-toggle-split-admin"], [data-testid="training-refresher-admin-link"]',
        spotlightLabel: "Highlight Split-Pane Admin Button",
        objectiveSummary: "At least 1 lane provisioned and started (`configuredLaneCount >= 1 && onlineLaneCount >= 1`).",
        isAutoVerified: (v) => v.configuredLaneCount >= 1 && v.onlineLaneCount >= 1,
    },
    {
        id: "adm-3",
        trackId: "administrator",
        badge: "3.3",
        route: "/users",
        pageIconKey: "users",
        videoGuideSlug: "19-viewer-users-passkeys-and-access",
        screenshotFile: "36-users-and-passkeys.png",
        screenshotCaption: "Users & Access self-service WebAuthn Passkeys, role scoping, bulk QR enrollment invites, and Federation Tokens.",
        title: "Users, RBAC View Scoping, QR Enrollment & Offline Passkeys",
        durationEstimate: "4 min",
        whyItMatters:
            "In Users & Access {{icon:users}} (the person-and-gear icon), administrators enroll operators via 1-tap QR codes or temporary passwords, scope accounts to specific `OperationalViews` (`north-gate`), and mint scoped `oscar_fed_...` tokens.",
        steps: [
            "Open Users & Access {{icon:users}} (`/users`, the person-and-gear icon in the left navigation bar and top-bar signed-in badge) and explore creating a practice Operator account scoped to `north-gate`, or test Bulk CSV/Paste User Enrollment to preview printable QR onboarding invites.",
            "Inspect the Federation Tokens section (`oscar_fed_...`, paired on remote sites in Nodes {{icon:servers}}, the cloud icon) and the Backup & Hardware Replacement readiness checklist — everything created here lives strictly in disposable sandbox memory/volumes.",
            "Click 'Mark Step Completed' below once you have explored account, Passkey, and token workflows.",
        ],
        spotlights: [
            {
                id: "users",
                selector: '[data-testid="nav-item-users"], [data-testid="navbar-user-account-btn"]',
                label: "Highlight Users & Access Icon",
                iconKey: "users",
            },
            {
                id: "servers",
                selector: '[data-testid="nav-item-servers"]',
                label: "Highlight Nodes (Cloud) Icon",
                iconKey: "servers",
            },
        ],
        spotlightSelector: '[data-testid="nav-item-users"], [data-testid="navbar-user-account-btn"]',
        spotlightLabel: "Highlight Users & Access Icon",
        objectiveSummary: "Review RBAC roles, QR enrollment invites, and Passkey / Federation Token controls in `/users`.",
        isAutoVerified: () => false,
    },
    {
        id: "adm-4",
        trackId: "administrator",
        badge: "3.4",
        route: "/extensions",
        pageIconKey: "extensions",
        videoGuideSlug: "25-pluggable-runtime-extensions-and-pmtiles",
        screenshotFile: "46-runtime-extensions-hub.png",
        screenshotCaption: "Runtime Extensions hub for air-gapped .pmtiles basemaps, custom policy packs, OCR/spectroscopy packs, and Cargo NII shares.",
        title: "Runtime Extensions (`.pmtiles` Maps, Policy Packs & Cargo NII)",
        durationEstimate: "5 min",
        whyItMatters:
            "Runtime Extensions {{icon:extensions}} (the puzzle-piece icon) let sites hot-swap regional `.pmtiles` basemaps, agency disposition codes (`Code 101+`), and read-only Cargo UFF shares without modifying shipped OSCAR defaults.",
        steps: [
            "Download `sample-regional-map.pmtiles` and `sample-policy-pack.json` using the buttons below.",
            "In Runtime Extensions {{icon:extensions}} (`/extensions`, the puzzle-piece icon in the left navigation bar), upload `sample-regional-map.pmtiles` under Offline Regional Basemaps (then check Map {{icon:map}} `/map`, the map-pin icon), OR upload `sample-policy-pack.json` under Adjudication Policy Packs (`Code 101` & `Code 102`).",
            "Optional: Under Cargo NII (WCO UFF) {{icon:uff}}, test Local Directory mode using path `/var/lib/oscar/sandbox-tutorial/uff-share`, and visit USB Backups {{icon:usb-backups}} (`/usb-backups`, the USB trident icon) to review the zero-downtime USB NVMe backup workflow.",
        ],
        sampleFiles: [
            { fileName: "sample-regional-map.pmtiles", buttonLabel: "Download Practice Map (.pmtiles)" },
            { fileName: "sample-policy-pack.json", buttonLabel: "Download Policy Pack (.json)" },
        ],
        copySnippets: [
            { label: "Copy Sandbox UFF Path", value: "/var/lib/oscar/sandbox-tutorial/uff-share" },
        ],
        spotlights: [
            {
                id: "extensions",
                selector: '[data-testid="nav-item-extensions"]',
                label: "Highlight Runtime Extensions Icon",
                iconKey: "extensions",
            },
            {
                id: "map",
                selector: '[data-testid="nav-item-map"]',
                label: "Highlight Map Icon",
                iconKey: "map",
            },
            {
                id: "usb-backups",
                selector: '[data-testid="nav-item-usb-backups"]',
                label: "Highlight USB Backups Icon",
                iconKey: "usb-backups",
            },
        ],
        spotlightSelector: '[data-testid="nav-item-extensions"]',
        spotlightLabel: "Highlight Runtime Extensions Icon",
        objectiveSummary: "Activate an offline `.pmtiles` basemap, Policy Pack, or Cargo NII share in `/extensions`.",
        isAutoVerified: (v) => v.offlineMapActive || v.policyPackActive || v.cargoUffEnabled,
    },
    {
        id: "adm-5",
        trackId: "administrator",
        badge: "3.5",
        route: "/health",
        pageIconKey: "webrelay",
        videoGuideSlug: "29-lane-webrelay-lights-and-sound",
        screenshotFile: "53-lane-webrelay-lights-and-sound.png",
        screenshotCaption: "Per-lane RPM Lights & Sound (WebRelay-Quad) control modal showing Automatic EML gatekeeping, relay coil telemetry (R1–R4), and timed alarm test pulses.",
        title: "Per-Lane Physical RPM Lights & Sound (`WebRelay-Quad`)",
        durationEstimate: "4 min",
        whyItMatters:
            "Administrators can suppress nuisance physical siren/beacon activations on benign NORM (`Code 9999`) and stalled gamma holds (`Code 9998`) via Lights & Sound {{icon:webrelay}} (the megaphone/siren icon) while pulsing Gamma Red + Siren (`R3`) and Neutron Blue (`R4`) on actionable threats, with fail-safe `0,0,0,0` pass-through if OSCAR stops.",
        steps: [
            "Click 'Stage DemoLane01 + Loopback WebRelay' below (or open Status of Health {{icon:health}} `/health` if `DemoLane01` is already online) and click the 'Lights & Sound' {{icon:webrelay}} megaphone button.",
            "Verify the sandbox loopback WebRelay-Quad (`127.0.0.1` port `10180`) using 'Test Connection', then review Operating Modes: `AUTO` (arms `R1=1, R2=1` intercept coils, suppresses `Code 9999` and optional `Code 9998`, pulses `R3`/`R4` on real alarms), `PASS_THROUGH` (`0,0,0,0` direct hardware wiring), `MUTED` (`1,1,0,0` silence), and `MANUAL`.",
            "Click timed pulse controls (`Pulse Gamma + Sounder` `R3` or `Pulse Neutron` `R4`) inside the modal and watch the live coil telemetry update in real time!",
        ],
        injectActions: [
            { scenario: "stage_webrelay_demo", label: "Stage DemoLane01 + Loopback WebRelay" },
        ],
        copySnippets: [
            { label: "Copy Sandbox Relay Host", value: "127.0.0.1" },
            { label: "Copy Sandbox Relay Port", value: "10180" },
        ],
        spotlights: [
            {
                id: "health",
                selector: '[data-testid="nav-item-health"]',
                label: "Highlight Status of Health Icon",
                iconKey: "health",
            },
            {
                id: "webrelay",
                selector: '[data-testid^="webrelay-open-lane-"], [data-testid="webrelay-open-header-btn"], [data-testid="lane-view-webrelay-btn"]',
                label: "Highlight Lane Lights & Sound Button",
                iconKey: "webrelay",
            },
        ],
        spotlightSelector: '[data-testid^="webrelay-open-lane-"], [data-testid="webrelay-open-header-btn"], [data-testid="lane-view-webrelay-btn"]',
        spotlightLabel: "Highlight Lane Lights & Sound Button",
        objectiveSummary: "Connect a lane to the loopback WebRelay-Quad (`127.0.0.1:10180`) and verify online coil telemetry (`webRelayOnlineCount >= 1`).",
        isAutoVerified: (v) => (v.webRelayOnlineCount ?? 0) >= 1,
    },
];
