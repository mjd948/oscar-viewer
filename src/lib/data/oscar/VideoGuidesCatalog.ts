import { Locale } from '@/app/contexts/LanguageContext';

export type VideoGuideTrackId = 'A' | 'B' | 'C';

export interface VideoGuideCaptionTrack {
    locale: Locale;
    label: string;
    src: string;
}

export const VIDEO_GUIDE_CAPTION_LOCALES: readonly Locale[] = ['en', 'es', 'fr', 'el'];

export const VIDEO_GUIDE_CAPTION_LABELS: Record<Locale, string> = {
    en: 'English',
    es: 'Español',
    fr: 'Français',
    el: 'Ελληνικά',
};

export interface VideoGuideEntry {
    badge: string;
    slug: string;
    track: VideoGuideTrackId;
    durationLabel: string;
    sizeLabel: string;
    mp4Url: string;
    vttUrl: string;
    captionUrlsByLocale: Record<Locale, string>;
    srtUrl: string;
    titles: Record<Locale, string>;
    summaries: Record<Locale, string>;
}

export function getVideoGuideCaptionTracks(
    guide: Pick<VideoGuideEntry, 'slug' | 'captionUrlsByLocale'>,
): VideoGuideCaptionTrack[] {
    return VIDEO_GUIDE_CAPTION_LOCALES.map((loc) => ({
        locale: loc,
        label: VIDEO_GUIDE_CAPTION_LABELS[loc],
        src: guide.captionUrlsByLocale[loc],
    }));
}

export function syncVideoElementCaptionLocale(
    videoEl: HTMLVideoElement | null,
    locale: Locale,
): void {
    if (!videoEl) return;
    const targetLocale: Locale = VIDEO_GUIDE_CAPTION_LABELS[locale] ? locale : 'en';
    const trackEls = videoEl.querySelectorAll('track');
    trackEls.forEach((trackEl) => {
        if (trackEl.kind && trackEl.kind !== 'captions' && trackEl.kind !== 'subtitles') return;
        const lang = trackEl.srclang || trackEl.getAttribute('srclang') || '';
        const isMatch = lang === targetLocale;
        trackEl.default = isMatch;
        if (trackEl.track) {
            trackEl.track.mode = isMatch ? 'showing' : 'disabled';
        }
    });
    if (videoEl.textTracks) {
        for (let i = 0; i < videoEl.textTracks.length; i++) {
            const track = videoEl.textTracks[i];
            if (!track || (track.kind !== 'captions' && track.kind !== 'subtitles')) continue;
            track.mode = track.language === targetLocale ? 'showing' : 'disabled';
        }
    }
}

export interface VideoGuideUiStrings {
    contextualStripLabel: string;
    watchButtonLabel: (badge: string, durationLabel: string) => string;
    watchButtonAriaLabel: (visibleLabel: string, guideTitle: string, contextTitle?: string) => string;
    closeVideoLabel: string;
    captionsNote: string;
    localCatalogCardTitle: string;
    localCatalogCardDesc: string;
    openLocalCatalogButtonLabel: string;
    openGithubCatalogButtonLabel: string;
    inAppCatalogHeading: string;
    inAppCatalogHint: string;
    tracks: Record<VideoGuideTrackId, string>;
}

const makeGuide = (
    badge: string,
    slug: string,
    track: VideoGuideTrackId,
    durationLabel: string,
    sizeLabel: string,
    titles: Record<Locale, string>,
    summaries: Record<Locale, string>,
): VideoGuideEntry => ({
    badge,
    slug,
    track,
    durationLabel,
    sizeLabel,
    mp4Url: `/video-guides/videos/${slug}.mp4`,
    vttUrl: `/video-guides/captions/${slug}.vtt`,
    captionUrlsByLocale: {
        en: `/video-guides/captions/${slug}.vtt`,
        es: `/video-guides/captions/es/${slug}.vtt`,
        fr: `/video-guides/captions/fr/${slug}.vtt`,
        el: `/video-guides/captions/el/${slug}.vtt`,
    },
    srtUrl: `/video-guides/captions/${slug}.srt`,
    titles,
    summaries,
});

export const VIDEO_GUIDES_CATALOG: readonly VideoGuideEntry[] = [
    makeGuide(
        '01',
        '01-deployment-init-and-credentials',
        'A',
        '28.5s',
        '587.7 KiB',
        {
            en: 'Initialize OSCAR Deployment, Admin Credentials & TLS',
            es: 'Inicializar despliegue de OSCAR, credenciales de administrador y TLS',
            fr: 'Initialiser le déploiement OSCAR, les identifiants administrateur et TLS',
            el: 'Αρχικοποίηση εγκατάστασης OSCAR, διαπιστευτηρίων διαχειριστή & TLS',
        },
        {
            en: 'Extract a clean release archive, initialize administrator credentials and TLS SAN certificates with oscar init, and verify healthy startup.',
            es: 'Extraiga un archivo de versión limpio, inicialice credenciales y certificados TLS SAN con oscar init y verifique el arranque saludable.',
            fr: 'Extrayez une archive propre, initialisez les identifiants administrateur et les certificats TLS SAN avec oscar init et vérifiez l’état sain.',
            el: 'Εξαγάγετε καθαρό αρχείο έκδοσης, αρχικοποιήστε διαπιστευτήρια και πιστοποιητικά TLS SAN με το oscar init και επιβεβαιώστε την υγιή εκκίνηση.',
        },
    ),
    makeGuide(
        '02',
        '02-clean-directory-upgrade',
        'A',
        '29.5s',
        '519.6 KiB',
        {
            en: 'Upgrade OSCAR in a Clean Release Directory',
            es: 'Actualizar OSCAR en un directorio de versión limpio',
            fr: 'Mettre à niveau OSCAR dans un répertoire de version propre',
            el: 'Αναβάθμιση του OSCAR σε καθαρό κατάλογο έκδοσης',
        },
        {
            en: 'Verify a pre-upgrade snapshot, copy only .env, secrets/, and tls/ into a newly extracted release folder, and run oscar upgrade.',
            es: 'Verifique una copia previa, copie únicamente .env, secrets/ y tls/ en una carpeta recién extraída y ejecute oscar upgrade.',
            fr: 'Vérifiez une sauvegarde préalable, copiez uniquement .env, secrets/ et tls/ dans un dossier neuf et exécutez oscar upgrade.',
            el: 'Επαληθεύστε αντίγραφο ασφαλείας, αντιγράψτε μόνο .env, secrets/ και tls/ σε νέο φάκελο έκδοσης και εκτελέστε oscar upgrade.',
        },
    ),
    makeGuide(
        '03',
        '03-archive-and-snapshot-backup',
        'A',
        '28.5s',
        '545.2 KiB',
        {
            en: 'Verify Parquet Cold-Tier Archives & Single-Snapshot Backup',
            es: 'Verificar archivos Parquet de nivel frío y copia de seguridad instantánea',
            fr: 'Vérifier les archives froides Parquet et la sauvegarde instantanée unique',
            el: 'Επαλήθευση ψυχρών αρχείων Parquet & αντιγράφου ασφαλείας στιγμιοτύπου',
        },
        {
            en: 'Inspect PARQUET_PRIMARY cold-tier generation status, verify SHA-256 parity receipts, and run a coordinated single-snapshot backup.',
            es: 'Inspeccione el estado de generaciones PARQUET_PRIMARY, valide recibos SHA-256 y ejecute una copia instantánea coordinada.',
            fr: 'Inspectez l’état des générations PARQUET_PRIMARY, vérifiez les reçus SHA-256 et exécutez une sauvegarde coordonnée.',
            el: 'Ελέγξτε την κατάσταση γενεών PARQUET_PRIMARY, επαληθεύστε αποδείξεις SHA-256 και εκτελέστε συντονισμένο αντίγραφο ασφαλείας.',
        },
    ),
    makeGuide(
        '04',
        '04-admin-oscar-service-and-custom-codes',
        'B',
        '41.5s',
        '1040.3 KiB',
        {
            en: 'Configure OSCAR Service Retention & Custom Disposition Codes',
            es: 'Configurar retención del Servicio OSCAR y códigos personalizados',
            fr: 'Configurer la rétention du Service OSCAR et les codes personnalisés',
            el: 'Ρύθμιση διατήρησης Υπηρεσίας OSCAR & προσαρμοσμένων κωδικών διάθεσης',
        },
        {
            en: 'Open Services -> OSCAR Service in SensorHub Admin to review 5-JPEG media retention, storage-pressure thresholds, and custom disposition codes.',
            es: 'Abra Servicios -> Servicio OSCAR en SensorHub Admin para revisar la retención de 5 JPEG, umbrales de almacenamiento y códigos personalizados.',
            fr: 'Ouvrez Services -> Service OSCAR dans SensorHub Admin pour ajuster la rétention 5 JPEG, les seuils de stockage et les codes personnalisés.',
            el: 'Ανοίξτε Υπηρεσίες -> Υπηρεσία OSCAR στη διαχείριση SensorHub για έλεγχο διατήρησης 5 JPEG, ορίων δίσκου και προσαρμοσμένων κωδικών.',
        },
    ),
    makeGuide(
        '05',
        '05-admin-lane-spreadsheet-sync',
        'B',
        '30s',
        '682.8 KiB',
        {
            en: 'Sync Multi-Lane Spreadsheet Configuration (config.csv)',
            es: 'Sincronizar hoja de cálculo multicarril (config.csv)',
            fr: 'Synchroniser la feuille de calcul multivoie (config.csv)',
            el: 'Συγχρονισμός υπολογιστικού φύλλου πολλαπλών λωρίδων (config.csv)',
        },
        {
            en: 'Import or download config.csv in OSCAR Service to provision RPM endpoints, RTSP cameras, and OperationalViews assignments in bulk.',
            es: 'Importe o descargue config.csv en el Servicio OSCAR para aprovisionar RPM, cámaras RTSP y asignaciones OperationalViews de forma masiva.',
            fr: 'Importez ou téléchargez config.csv dans le Service OSCAR pour configurer en bloc les RPM, caméras RTSP et vues opérationnelles.',
            el: 'Εισαγάγετε ή λάβετε το config.csv στην Υπηρεσία OSCAR για μαζική ρύθμιση πυλών RPM, καμερών RTSP και αναθέσεων OperationalViews.',
        },
    ),
    makeGuide(
        '06',
        '06-admin-manual-lane-and-site-diagram',
        'B',
        '41s',
        '1078.5 KiB',
        {
            en: 'Configure a Lane System & Georeferenced Site Diagram',
            es: 'Configurar un sistema de carril y plano georreferenciado del sitio',
            fr: 'Configurer un système de voie et un plan du site géoréférencé',
            el: 'Ρύθμιση συστήματος λωρίδας & γεωαναφερθέντος διαγράμματος εγκατάστασης',
        },
        {
            en: 'Inspect Lane System coordinates, Extended Occupancy Threshold, and camera/RPM options, then upload a georeferenced Site Diagram.',
            es: 'Revise coordenadas del carril, umbral de ocupación prolongada y opciones de cámara/RPM, y cargue un plano georreferenciado del sitio.',
            fr: 'Inspectez les coordonnées de voie, le seuil d’occupation prolongée et les options caméra/RPM, puis chargez un plan du site géoréférencé.',
            el: 'Ελέγξτε συντεταγμένες λωρίδας, όριο παρατεταμένης διέλευσης και ρυθμίσεις κάμερας/RPM και μεταφορτώστε γεωαναφερθέν διάγραμμα.',
        },
    ),
    makeGuide(
        '07',
        '07-admin-eml-plugin-setup',
        'B',
        '27s',
        '1939.6 KiB',
        {
            en: 'Upload External EML VM-250 Plugin & Enable Per-Lane EML',
            es: 'Cargar complemento externo EML VM-250 y activar EML por carril',
            fr: 'Charger le module externe EML VM-250 et activer l’EML par voie',
            el: 'Μεταφόρτωση εξωτερικού προσθέτου EML VM-250 & ενεργοποίηση EML ανά λωρίδα',
        },
        {
            en: 'Upload a licensed Enhanced Machine Learning (EML) VM-250 .jar plugin in OSCAR Service and enable per-lane EML for Code 9999 auto-adjudication.',
            es: 'Cargue el complemento .jar con licencia de Aprendizaje Automático Mejorado (EML) VM-250 y habilite EML por carril para Código 9999.',
            fr: 'Chargez le module .jar sous licence d’Apprentissage Automatique Amélioré (EML) VM-250 et activez l’EML par voie pour le Code 9999.',
            el: 'Μεταφορτώστε το αδειοδοτημένο πρόσθετο .jar Ενισχυμένης Μηχανικής Μάθησης (EML) VM-250 και ενεργοποιήστε το EML ανά λωρίδα (Κωδικός 9999).',
        },
    ),
    makeGuide(
        '08',
        '08-viewer-signin-language-and-nodes',
        'C',
        '31.5s',
        '3838.2 KiB',
        {
            en: 'Sign In to OSCAR Viewer, Switch Language & Manage Nodes',
            es: 'Iniciar sesión en OSCAR Viewer, cambiar idioma y gestionar nodos',
            fr: 'Se connecter à OSCAR Viewer, changer la langue et gérer les nœuds',
            el: 'Σύνδεση στο OSCAR Viewer, αλλαγή γλώσσας & διαχείριση κόμβων',
        },
        {
            en: 'Authenticate with Keep me signed in or offline Passkey, switch localization live across 4 languages, open the Operator Quick Guide (?), and manage federated nodes.',
            es: 'Autentíquese con sesión persistente o Passkey sin conexión, cambie entre 4 idiomas en vivo, abra la guía rápida (?) y gestione nodos federados.',
            fr: 'Authentifiez-vous avec session persistante ou clé Passkey hors ligne, changez la langue parmi 4 langues, ouvrez le guide (?) et gérez les nœuds fédérés.',
            el: 'Συνδεθείτε με μόνιμη συνεδρία ή Passkey εκτός δικτύου, αλλάξτε ζωντανά μεταξύ 4 γλωσσών, ανοίξτε τον οδηγό χειριστή (?) και διαχειριστείτε ομόσπονδους κόμβους.',
        },
    ),
    makeGuide(
        '09',
        '09-dashboard-monitoring-and-quick-adjudication',
        'C',
        '29s',
        '2439.6 KiB',
        {
            en: 'Monitor Live 50-Lane Dashboard & Inspect Alarm Rows',
            es: 'Supervisar el panel en vivo de 50 carriles e inspeccionar alarmas',
            fr: 'Surveiller le tableau de bord 50 voies en direct et inspecter les alarmes',
            el: 'Παρακολούθηση ζωντανού πίνακα 50 λωρίδων & επιθεώρηση συναγερμών',
        },
        {
            en: 'Monitor real-time lane tiles and unread alarm occupancy rows on the Dashboard, customize panels, and launch rapid alarm review.',
            es: 'Supervise mosaicos de carriles y alarmas no leídas en tiempo real en el Panel, personalice vistas e inicie la revisión rápida.',
            fr: 'Surveillez les tuiles de voies et les alarmes non lues en direct sur le Tableau de bord, personnalisez l’affichage et lancez l’examen rapide.',
            el: 'Παρακολουθήστε ζωντανά τις κάρτες λωρίδων και τους μη αναγνωσμένους συναγερμούς στον Πίνακα ελέγχου και ξεκινήστε ταχεία αξιολόγηση.',
        },
    ),
    makeGuide(
        '10',
        '10-operational-views-scoping',
        'C',
        '29s',
        '1164.3 KiB',
        {
            en: 'Scope Workstation Lanes with Fail-Closed Operational Views',
            es: 'Delimitar carriles por estación mediante Vistas Operativas seguras',
            fr: 'Restreindre les voies d’un poste avec les Vues Opérationnelles sécurisées',
            el: 'Περιορισμός λωρίδων σταθμού εργασίας με ασφαλείς Λειτουργικές Προβολές',
        },
        {
            en: 'Apply ?view=<key> workstation URLs to restrict Dashboard, Events, Status of Health, and Reports to assigned portal lanes.',
            es: 'Aplique direcciones ?view=<clave> para limitar Panel, Eventos, Estado de salud e Informes a los carriles asignados.',
            fr: 'Appliquez les URL ?view=<clé> pour restreindre Tableau de bord, Événements, État de santé et Rapports aux voies assignées.',
            el: 'Χρησιμοποιήστε διευθύνσεις ?view=<κλειδί> για περιορισμό του Πίνακα, των Συμβάντων, της Υγείας και των Αναφορών στις ανατεθειμένες λωρίδες.',
        },
    ),
    makeGuide(
        '11',
        '11-live-lane-video-and-charts',
        'C',
        '62s',
        '3584.1 KiB',
        {
            en: 'Inspect Live Lane Camera Stream & Gamma/Neutron Waveforms',
            es: 'Inspeccionar vídeo en vivo del carril y curvas gamma/neutrones',
            fr: 'Inspecter le flux caméra en direct et les courbes gamma/neutrons',
            el: 'Επιθεώρηση ζωντανού βίντεο λωρίδας & καμπυλών γάμμα/νετρονίων',
        },
        {
            en: 'Open Live Lane View from a lane tile to monitor low-latency camera video alongside synchronized gamma and neutron count-rate traces.',
            es: 'Abra la vista en vivo desde un carril para ver vídeo de baja latencia junto a trazas sincronizadas de conteo gamma y de neutrones.',
            fr: 'Ouvrez la vue en direct d’une voie pour suivre la vidéo caméra à faible latence avec les courbes synchronisées gamma et neutrons.',
            el: 'Ανοίξτε τη ζωντανή προβολή λωρίδας για παρακολούθηση βίντεο χαμηλής καθυστέρησης μαζί με συγχρονισμένες καμπύλες γάμμα και νετρονίων.',
        },
    ),
    makeGuide(
        '12',
        '12-event-log-filtering-and-adjudication-codes',
        'C',
        '56.5s',
        '4116.8 KiB',
        {
            en: 'Filter Event Log by Vehicle ID, Adjudication Code & Event UUID',
            es: 'Filtrar el registro de eventos por vehículo, código de adjudicación y UUID',
            fr: 'Filtrer le journal des événements par véhicule, code d’adjudication et UUID',
            el: 'Φιλτράρισμα ιστορικού συμβάντων ανά όχημα, κωδικό αξιολόγησης & UUID',
        },
        {
            en: 'Search historical occupancies by Vehicle / ISO 6346 Container ID, Event UUID, time window, and Adjudication Code (including 9998 & 9999).',
            es: 'Busque ocupaciones históricas por ID de vehículo / contenedor ISO 6346, UUID, ventana temporal y Código de adjudicación (9998 y 9999).',
            fr: 'Recherchez l’historique par ID de véhicule / conteneur ISO 6346, UUID, plage horaire et Code d’adjudication (dont 9998 et 9999).',
            el: 'Αναζητήστε διελεύσεις ανά ID οχήματος / εμπορευματοκιβωτίου ISO 6346, UUID, χρονικό παράθυρο και Κωδικό αξιολόγησης (9998 & 9999).',
        },
    ),
    makeGuide(
        '13',
        '13-event-details-adjudication-and-daily-file',
        'C',
        '39s',
        '2159.0 KiB',
        {
            en: 'Review Retained 5-Frame Media, Daily File Output & Adjudicate',
            es: 'Revisar los 5 fotogramas retenidos, el archivo diario y adjudicar',
            fr: 'Examiner les 5 images conservées, le fichier quotidien et adjuger',
            el: 'Έλεγχος διατηρούμενων 5 καρέ, ημερήσιου αρχείου & υποβολή αξιολόγησης',
        },
        {
            en: 'Inspect retained 5-frame JPEG evidence, radiation profiles, spectroscopic spectra, and raw RPM Daily File records, then submit an adjudication.',
            es: 'Inspeccione los 5 fotogramas JPEG retenidos, perfiles de radiación, espectros y registros del archivo diario RPM antes de adjudicar.',
            fr: 'Inspectez les 5 images JPEG conservées, les profils radiologiques, les spectres et le fichier quotidien RPM, puis soumettez l’adjudication.',
            el: 'Επιθεωρήστε τα 5 διατηρούμενα καρέ JPEG, τις καμπύλες ακτινοβολίας, τα φάσματα και το ημερήσιο αρχείο RPM και υποβάλετε αξιολόγηση.',
        },
    ),
    makeGuide(
        '14',
        '14-airgapped-alarm-qr-transfer',
        'C',
        '27s',
        '1628.5 KiB',
        {
            en: 'Export Signed Alarm QR & Verify Offline on Air-Gapped Transfer',
            es: 'Exportar código QR firmado y verificar alarmas sin conexión',
            fr: 'Exporter un QR d’alarme signé et le vérifier hors ligne',
            el: 'Εξαγωγή υπογεγραμμένου QR συναγερμού & επαλήθευση εκτός δικτύου',
        },
        {
            en: 'Export a compact alarm QR code or .oscar-alarm.json bundle and verify its cryptographic integrity and count curves on an air-gapped workstation.',
            es: 'Exporte un código QR compacto o paquete .oscar-alarm.json y verifique su integridad y curvas de conteo en una estación sin conexión.',
            fr: 'Exportez un code QR compact ou fichier .oscar-alarm.json et vérifiez son intégrité et ses courbes sur un poste isolé hors réseau.',
            el: 'Εξαγάγετε κωδικό QR ή αρχείο .oscar-alarm.json και επαληθεύστε την ακεραιότητα και τις καμπύλες μετρήσεων σε απομονωμένο σταθμό.',
        },
    ),
    makeGuide(
        '15',
        '15-status-of-health-and-site-map',
        'C',
        '32.5s',
        '2886.0 KiB',
        {
            en: 'Monitor RPM/Camera Status of Health & Georeferenced Site Map',
            es: 'Supervisar el Estado de salud de RPM/cámaras y el Mapa del sitio',
            fr: 'Surveiller l’État de santé RPM/caméras et la Carte du site',
            el: 'Παρακολούθηση Κατάστασης υγείας RPM/καμερών & Χάρτη εγκατάστασης',
        },
        {
            en: 'Check live RPM and camera connectivity, Gamma/Neutron/Tamper/Extended Occupancy fault indicators, and georeferenced lane markers.',
            es: 'Compruebe la conectividad en vivo de RPM y cámaras, indicadores de fallos/manipulación y marcadores de carril en el mapa del sitio.',
            fr: 'Vérifiez la connectivité en direct des RPM et caméras, les indicateurs de défaut/sabotage et les marqueurs sur la carte géoréférencée.',
            el: 'Ελέγξτε τη ζωντανή σύνδεση πυλών RPM και καμερών, τις ενδείξεις βλαβών/παραβίασης και τους δείκτες λωρίδων στον χάρτη.',
        },
    ),
    makeGuide(
        '16',
        '16-national-statistics-and-reports',
        'C',
        '36s',
        '842.7 KiB',
        {
            en: 'Analyze National View Statistics & Generate Multi-Format Reports',
            es: 'Analizar estadísticas nacionales y generar informes multiformato',
            fr: 'Analyser les statistiques nationales et générer des rapports multiformats',
            el: 'Ανάλυση εθνικών στατιστικών & δημιουργία αναφορών πολλαπλών μορφών',
        },
        {
            en: 'Compare multi-node statistics in National View and generate PDF, CSV, JSON, and Excel (.xlsx) operational and adjudication reports.',
            es: 'Compare estadísticas multinodo en Vista Nacional y genere informes operativos y de adjudicación en PDF, CSV, JSON y Excel (.xlsx).',
            fr: 'Comparez les statistiques multi-nœuds dans la Vue Nationale et générez des rapports en PDF, CSV, JSON et Excel (.xlsx).',
            el: 'Συγκρίνετε στατιστικά πολλαπλών κόμβων στην Εθνική προβολή και δημιουργήστε αναφορές PDF, CSV, JSON και Excel (.xlsx).',
        },
    ),
    makeGuide(
        '17',
        '17-vehicle-ocr-and-adjudication',
        'C',
        '48.5s',
        '2912.5 KiB',
        {
            en: 'Configure Vehicle OCR, Compare Multi-Pass Transits & Adjudicate',
            es: 'Configurar OCR de vehículos, comparar múltiples pasadas y adjudicar',
            fr: 'Configurer l’OCR véhicules, comparer les passages multiples et adjuger',
            el: 'Ρύθμιση OCR οχημάτων, σύγκριση πολλαπλών διελεύσεων & αξιολόγηση',
        },
        {
            en: 'Enable per-lane container/plate OCR, review crop thumbnails and Vehicle ID auto-fill, compare multi-pass transits, and generate Vehicle Incident Reports.',
            es: 'Active el OCR de contenedores y matrículas, revise recortes y autocompletado, compare múltiples pasadas y genere informes de incidente.',
            fr: 'Activez l’OCR conteneurs/plaques, inspectez les vignettes et le préremplissage, comparez les passages multiples et générez le rapport d’incident.',
            el: 'Ενεργοποιήστε το OCR εμπορευματοκιβωτίων/πινακίδων, ελέγξτε τις μικρογραφίες, συγκρίνετε πολλαπλές διελεύσεις και εξαγάγετε αναφορά συμβάντος οχήματος.',
        },
    ),
    makeGuide(
        '18',
        '18-operator-help-and-support-bundle',
        'C',
        '37.5s',
        '3333.3 KiB',
        {
            en: 'Use Flight Recorder, Help (?) & Redacted Support Bundles (UI & CLI)',
            es: 'Usar grabadora de diagnóstico, Ayuda (?) y paquetes de soporte redactados',
            fr: 'Utiliser l’enregistreur de diagnostic, l’Aide (?) et les archives masquées',
            el: 'Χρήση καταγραφέα διαγνωστικών, Βοήθειας (?) & πακέτων υποστήριξης',
        },
        {
            en: 'Open Help (?) to export the 400-event browser Flight Recorder + rolling server logs, run oscar.sh / oscar.bat support-bundle offline, and verify [REDACTED] scrubbing.',
            es: 'Abra Ayuda (?) para exportar los 400 eventos de diagnóstico + registros del servidor, ejecute support-bundle por CLI sin conexión y valide el masquage [REDACTED].',
            fr: 'Ouvrez l’Aide (?) pour exporter les 400 événements clients + journaux serveur, exécutez support-bundle hors ligne en CLI et vérifiez le masquage [REDACTED].',
            el: 'Ανοίξτε τη Βοήθεια (?) για εξαγωγή των 400 συμβάντων + αρχείων διακομιστή, εκτελέστε support-bundle μέσω CLI εκτός δικτύου και ελέγξτε την απόκρυψη [REDACTED].',
        },
    ),
    makeGuide(
        '19',
        '19-viewer-users-passkeys-and-access',
        'C',
        '39.5s',
        '2798.3 KiB',
        {
            en: 'Manage Users, Bulk QR Invites, Offline Passkeys & Federation Tokens',
            es: 'Gestionar usuarios, invitaciones QR masivas, Passkeys y tokens de federación',
            fr: 'Gérer les utilisateurs, invitations QR groupées, Passkeys et jetons de fédération',
            el: 'Διαχείριση χρηστών, μαζικών προσκλήσεων QR, Passkeys & διακριτικών ομοσπονδίας',
        },
        {
            en: 'Enroll offline Passkeys, bulk-upload a CSV user list to generate ready-to-send startup messages and 1-tap setup QR codes, mint Federation Tokens, and download the hardware recovery checklist.',
            es: 'Registre Passkeys sin conexión, cargue una lista CSV de usuarios para generar mensajes de inicio y códigos QR de un toque, cree tokens de federación y descargue la guía de recuperación.',
            fr: 'Enregistrez des Passkeys hors ligne, importez une liste CSV d’utilisateurs pour générer messages de démarrage et codes QR en un geste, créez des jetons de fédération et téléchargez la liste de reprise.',
            el: 'Καταχωρίστε Passkeys εκτός δικτύου, μεταφορτώστε λίστα CSV χρηστών για αυτόματα μηνύματα εκκίνησης και κωδικούς QR, εκδώστε διακριτικά ομοσπονδίας και λάβετε τη λίστα ανάκτησης υλικού.',
        },
    ),
    makeGuide(
        '20',
        '20-multi-node-federation-vehicle-search-and-report',
        'C',
        '90s',
        '4423.5 KiB',
        {
            en: 'Federate Multi-Site Nodes, Search Vehicles Across Portals & Generate Reports',
            es: 'Federar nodos multisede, buscar vehículos entre portales y generar informes',
            fr: 'Fédérer plusieurs sites, rechercher des véhicules multi-nœuds et générer des rapports',
            el: 'Ομοσπονδοποίηση κόμβων, αναζήτηση οχημάτων σε πολλαπλές πύλες & ενιαίες αναφορές',
        },
        {
            en: 'Mint scoped oscar_fed_* service tokens, connect remote HTTPS portals on Servers, correlate vehicle passes across nodes, and export unified multi-node Vehicle Incident Reports.',
            es: 'Cree tokens de servicio oscar_fed_*, conecte portales remotos HTTPS en Servidores, correlacione pasadas entre nodos y exporte informes de incidente multinodo.',
            fr: 'Créez des jetons oscar_fed_*, connectez des portails distants HTTPS dans Serveurs, corrélez les passages multi-sites et exportez des rapports d’incident unifiés.',
            el: 'Εκδώστε διακριτικά oscar_fed_*, συνδέστε απομακρυσμένους κόμβους HTTPS, συσχετίστε διελεύσεις οχημάτων μεταξύ σταθμών και εξαγάγετε ενιαίες αναφορές συμβάντος.',
        },
    ),
    makeGuide(
        '21',
        '21-federated-sso-passkey-onboarding-and-revocation',
        'C',
        '39.5s',
        '1790.5 KiB',
        {
            en: 'Onboard Authentik SSO Passkey Users & Revoke Access Across All Layers',
            es: 'Incorporar usuarios SSO Passkey en Authentik y revocar acceso completo',
            fr: 'Intégrer des utilisateurs SSO Passkey dans Authentik et révoquer tout accès',
            el: 'Εγγραφή χρηστών SSO Passkey στο Authentik & πλήρης ανάκληση πρόσβασης',
        },
        {
            en: 'Create centralized Authentik users, assign oscar-admins/operators/viewers groups, issue 1-tap SSO Passkey setup links, and permanently delete users across Authentik, Octelium, and OSCAR.',
            es: 'Cree usuarios centralizados en Authentik, asigne grupos oscar-*, envíe enlaces de Passkey de un toque y elimine usuarios en Authentik, Octelium y OSCAR.',
            fr: 'Créez des comptes Authentik centralisés, attribuez les groupes oscar-*, générez des liens Passkey en un clic et révoquez totalement les accès.',
            el: 'Δημιουργήστε κεντρικούς χρήστες Authentik, αναθέστε ομάδες oscar-*, εκδώστε συνδέσμους Passkey ενός αγγίγματος και ανακαλέστε πλήρως την πρόσβαση.',
        },
    ),
    makeGuide(
        '22',
        '22-regression-suite-setup-and-certification',
        'A',
        '42.5s',
        '1748.3 KiB',
        {
            en: 'Install, Configure & Run the End-to-End OSCAR Regression Suite',
            es: 'Instalar, configurar y ejecutar la suite de regresión integral de OSCAR',
            fr: 'Installer, configurer et exécuter la suite de régression complète OSCAR',
            el: 'Εγκατάσταση, ρύθμιση & εκτέλεση της σουίτας παλινδρόμησης OSCAR',
        },
        {
            en: 'Install ORNL/oscar-regression, configure .env safety interlocks, run smoke, full, 3.11.0-release, restore-drill, and ui-endurance profiles across 23 scenarios, and inspect summary.md.',
            es: 'Instale ORNL/oscar-regression, configure bloqueos de seguridad en .env, ejecute perfiles smoke, full, 3.11.0-release, restore-drill y ui-endurance y revise summary.md.',
            fr: 'Installez ORNL/oscar-regression, configurez les verrous .env, lancez les profils smoke, full, 3.11.0-release, restore-drill et ui-endurance et inspectez summary.md.',
            el: 'Εγκαταστήστε το ORNL/oscar-regression, ρυθμίστε δικλείδες ασφαλείας .env, εκτελέστε τα προφίλ smoke, full, 3.11.0-release, restore-drill και ui-endurance και ελέγξτε το summary.md.',
        },
    ),
    makeGuide(
        '23',
        '23-windows-wsl2-host-readiness-and-ocr-scaling',
        'A',
        '55s',
        '13167.7 KiB',
        {
            en: 'Prepare Windows 11 WSL 2 Hosts & Right-Size 100% Per-Lane OCR',
            es: 'Preparar hosts Windows 11 WSL 2 y dimensionar el OCR al 100% por carril',
            fr: 'Préparer Windows 11 WSL 2 et dimensionner l’OCR 100 % par voie',
            el: 'Προετοιμασία Windows 11 WSL 2 & βέλτιστη κλιμάκωση 100% OCR ανά λωρίδα',
        },
        {
            en: 'Run oscar.bat prepare-host, attach outbound Zero-Trust tunnels, and size 100% Container/Plate OCR cleanly (6 lanes on Windows 11 WSL 2 vs. 50 lanes on Ubuntu 24.04 bare-metal).',
            es: 'Ejecute oscar.bat prepare-host, conecte túneles Zero-Trust salientes y dimensione el OCR al 100% sin ráfagas TCP (6 carriles en Windows 11 WSL 2 frente a 50 en Ubuntu 24.04).',
            fr: 'Exécutez oscar.bat prepare-host, connectez le tunnel Zero-Trust sortant et dimensionnez l’OCR 100 % sans gigue TCP (6 voies sous Windows 11 WSL 2 contre 50 sous Ubuntu 24.04).',
            el: 'Εκτελέστε το oscar.bat prepare-host, συνδέστε εξερχόμενη σήραγγα Zero-Trust και κλιμακώστε το 100% OCR χωρίς συσσώρευση δειγμάτων (6 λωρίδες σε Windows 11 WSL 2 έναντι 50 σε Ubuntu 24.04).',
        },
    ),
    makeGuide(
        '24',
        '24-continual-and-occasional-usb-backups',
        'C',
        '43.5s',
        '1570.8 KiB',
        {
            en: 'Manage Continual & Occasional USB NVMe Backups & Safe Field Eject',
            es: 'Gestionar copias USB NVMe continuas y ocasionales y expulsión segura',
            fr: 'Gérer les sauvegardes USB NVMe continues et occasionnelles et l’éjection sécurisée',
            el: 'Διαχείριση συνεχών & περιστασιακών αντιγράφων USB NVMe & ασφαλής εξαγωγή',
        },
        {
            en: 'Open USB Backups (/usb-backups) to configure Continual or Occasional 0.0 s downtime sync on an NTFS USB 3.x NVMe SSD, download backup-key.txt, and safely eject for laptop offload.',
            es: 'Abra Copias USB (/usb-backups) para configurar sincronización continua u ocasional sin interrupción (0.0 s) en SSD USB 3.x NVMe NTFS, descargar backup-key.txt y expulsar con seguridad.',
            fr: 'Ouvrez Sauvegardes USB (/usb-backups) pour configurer la synchronisation continue ou occasionnelle sans coupure (0,0 s) sur SSD USB 3.x NVMe NTFS, télécharger backup-key.txt et éjecter proprement.',
            el: 'Ανοίξτε Αντίγραφα USB (/usb-backups) για ρύθμιση συνεχούς ή περιστασιακού συγχρονισμού μηδενικής διακοπής (0,0 s) σε SSD USB 3.x NVMe NTFS, λήψη του backup-key.txt και ασφαλή εξαγωγή.',
        },
    ),
    makeGuide(
        '25',
        '25-pluggable-runtime-extensions-and-pmtiles',
        'C',
        '48s',
        '2039.9 KiB',
        {
            en: 'Swap Pluggable OCR Packs & Air-Gapped Regional .pmtiles Basemaps',
            es: 'Intercambiar paquetes OCR y mapas regionales .pmtiles sin conexión',
            fr: 'Remplacer à chaud les packs OCR et fonds de carte régionaux .pmtiles hors ligne',
            el: 'Εναλλαγή πακέτων OCR & τοπικών χαρτών .pmtiles εκτός δικτύου',
        },
        {
            en: 'Open Runtime Extensions (/extensions) to hot-swap Unicode regional OCR plate-rule packs and PMTiles v3 (.pmtiles) basemaps, render lanes offline on Map (/map), and restore shipped defaults.',
            es: 'Abra Extensiones (/extensions) para cambiar reglas OCR regionales Unicode y mapas PMTiles v3 (.pmtiles), visualizar carriles sin conexión en Mapa (/map) y restaurar valores integrados.',
            fr: 'Ouvrez Extensions (/extensions) pour charger des règles OCR Unicode et des cartes PMTiles v3 (.pmtiles), afficher les voies hors ligne sur Carte (/map) et rétablir les défauts intégrés.',
            el: 'Ανοίξτε Επεκτάσεις (/extensions) για φόρτωση κανόνων OCR Unicode και χαρτών PMTiles v3 (.pmtiles), προβολή λωρίδων εκτός σύνδεσης στον Χάρτη (/map) και επαναφορά προεπιλογών.',
        },
    ),
    makeGuide(
        '26',
        '26-ubuntu-hotel-staging-and-airgapped-cutover',
        'A',
        '33.5s',
        '1007.3 KiB',
        {
            en: 'Stage Ubuntu 24.04 Off-Site & Cut Over to Air-Gapped Portal Subnets',
            es: 'Preparar Ubuntu 24.04 fuera de sitio y migrar a subredes de portal aisladas',
            fr: 'Préparer Ubuntu 24.04 hors site et basculer sur le sous-réseau isolé du portail',
            el: 'Προετοιμασία Ubuntu 24.04 εκτός σταθμού & μετάβαση σε απομονωμένο υποδίκτυο πύλης',
        },
        {
            en: 'Identify physical NICs, pre-stage static Netplan YAML without dropping SSH, expand Ubuntu 100 GiB LVM root and initialize OSCAR offline, then cut over on-site and discover RPMs/cameras.',
            es: 'Identifique interfaces físicas, preconfigure Netplan estático sin cortar SSH, expanda el volumen LVM de 100 GiB e inicialice OSCAR sin conexión, y aplique la red en sitio.',
            fr: 'Identifiez les ports réseau, pré-stagez Netplan statique sans couper SSH, étendez le volume LVM de 100 Gio et initialisez OSCAR hors ligne, puis basculez sur site.',
            el: 'Αναγνωρίστε θύρες δικτύου, προετοιμάστε στατικό Netplan χωρίς διακοπή SSH, επεκτείνετε τον τόμο LVM 100 GiB και αρχικοποιήστε το OSCAR εκτός δικτύου πριν την εγκατάσταση πεδίου.',
        },
    ),
    makeGuide(
        '27',
        '27-cargo-uff-smb-and-xray-inspection',
        'C',
        '55s',
        '3599.7 KiB',
        {
            en: 'Connect Cargo UFF SMB Shares, Search by UUID & Inspect 16-Bit Radiographs',
            es: 'Conectar recursos SMB UFF de carga, buscar por UUID e inspeccionar rayos X 16 bits',
            fr: 'Connecter un partage SMB UFF fret, chercher par UUID et inspecter les rayons X 16 bits',
            el: 'Σύνδεση SMB UFF φορτίου, αναζήτηση μέσω UUID & επιθεώρηση ακτινογραφιών 16-bit',
        },
        {
            en: 'Connect a read-only SMBv2/SMBv3 Cargo NII share in Runtime Extensions (/extensions), look up unlabelled WCO UFF 2.0/3.0 scans by UUID or fuzzy container OCR, inspect 16-bit TIFF radiographs with HEMD Z-bands, and link scans to adjudications.',
            es: 'Conecte un recurso SMBv2/SMBv3 de solo lectura en Extensiones (/extensions), busque paquetes WCO UFF 2.0/3.0 por UUID u OCR difuso, inspeccione radiografías TIFF de 16 bits con bandas Z HEMD y vincúlelas a la adjudicación.',
            fr: 'Connectez un partage SMBv2/SMBv3 en lecture seule dans Extensions (/extensions), recherchez les archives OMD UFF 2.0/3.0 par UUID ou OCR tolérant, inspectez les radiographies TIFF 16 bits avec bandes Z HEMD et liez-les à l’adjudication.',
            el: 'Συνδέστε κοινόχρηστο πόρο SMBv2/SMBv3 μόνο ανάγνωσης στις Επεκτάσεις (/extensions), αναζητήστε πακέτα WCO UFF 2.0/3.0 μέσω UUID ή ασαφούς OCR, επιθεωρήστε ακτινογραφίες TIFF 16-bit με ζώνες Z HEMD και συνδέστε τα στην αξιολόγηση.',
        },
    ),
    makeGuide(
        '28',
        '28-hands-on-training-sandbox',
        'C',
        '79s',
        '3193.2 KiB',
        {
            en: 'Practice Safely in the Ephemeral Hands-On Training Sandbox & Guided Academy',
            es: 'Practicar de forma segura en el entorno efímero de formación y academia guiada',
            fr: 'S’entraîner sans risque dans le bac à sable éphémère de formation et l’académie guidée',
            el: 'Ασφαλής πρακτική εξάσκηση στο προσωρινό περιβάλλον εκπαίδευσης & καθοδηγούμενη ακαδημία',
        },
        {
            en: 'Launch the isolated oscar-sandbox (:8444) with zero production DB or Parquet impact, walk through Operator, Supervisor, and Split-Pane Administrator labs with live loopback Rapiscan + RTSP + OCR + Cargo UFF, and export a 1-page PDF Completion Record.',
            es: 'Inicie el entorno aislado oscar-sandbox (:8444) sin afectar PostgreSQL ni Parquet reales, complete ejercicios de Operador, Supervisor y Administrador con Rapiscan + RTSP + OCR + UFF locales y descargue el PDF de finalización.',
            fr: 'Lancez le bac à sable isolé oscar-sandbox (:8444) sans impact sur PostgreSQL ou Parquet réels, suivez les ateliers Opérateur, Superviseur et Administrateur avec Rapiscan + RTSP + OCR + UFF locaux et téléchargez le PDF de réussite.',
            el: 'Εκκινήστε το απομονωμένο oscar-sandbox (:8444) χωρίς επίδραση στην παραγωγική ΒΔ ή στα αρχεία Parquet, ολοκληρώστε ασκήσεις Χειριστή, Επόπτη και Διαχειριστή και λάβετε το PDF ολοκλήρωσης.',
        },
    ),
    makeGuide(
        '29',
        '29-lane-webrelay-lights-and-sound',
        'C',
        '44s',
        '2607.8 KiB',
        {
            en: 'Configure & Control Per-Lane Physical RPM Lights & Sound (WebRelay-Quad)',
            es: 'Configurar y controlar luces y sonido físicos del RPM por carril (WebRelay-Quad)',
            fr: 'Configurer et commander les feux et la sirène physiques du RPM par voie (WebRelay-Quad)',
            el: 'Διαμόρφωση & έλεγχος φυσικών φώτων και ήχου RPM ανά λωρίδα (WebRelay-Quad)',
        },
        {
            en: 'Enable per-lane ControlByWeb WebRelay-Quad HTTP/XML control in Status of Health (/health) or SensorHub Admin, verify AUTO occupancy/EML gatekeeping (Code 9999 & Code 9998 suppression), and test live Gamma + Sound and Neutron Light pulses.',
            es: 'Active el control HTTP/XML ControlByWeb WebRelay-Quad por carril en Estado de funcionamiento (/health) o SensorHub Admin, verifique el modo AUTO (supresión Código 9999 y 9998) y pruebe pulsos en vivo de luz gamma + sirena y luz de neutrones.',
            fr: 'Activez le contrôle HTTP/XML ControlByWeb WebRelay-Quad par voie dans État de fonctionnement (/health) ou SensorHub Admin, vérifiez le mode AUTO (masquage Code 9999 et 9998) et testez les impulsions gamma + sirène et feu neutron.',
            el: 'Ενεργοποιήστε τον έλεγχο HTTP/XML ControlByWeb WebRelay-Quad ανά λωρίδα στην Κατάσταση λειτουργίας (/health) ή στο SensorHub Admin, επαληθεύστε τη λειτουργία AUTO (καταστολή Κωδικού 9999 & 9998) και δοκιμάστε παλμούς γάμμα + σειρήνας και φωτός νετρονίων.',
        },
    ),
    makeGuide(
        '30',
        '30-zero-login-github-system-update',
        'C',
        '38s',
        '1118.9 KiB',
        {
            en: 'Update OSCAR From the GUI Without a GitHub Login (GitHub & Offline .zip)',
            es: 'Actualizar OSCAR desde la GUI sin cuenta de GitHub (GitHub y .zip sin conexión)',
            fr: 'Mettre à jour OSCAR depuis l’interface sans compte GitHub (GitHub et .zip hors ligne)',
            el: 'Ενημέρωση OSCAR από το GUI χωρίς σύνδεση GitHub (GitHub & .zip εκτός σύνδεσης)',
        },
        {
            en: 'Open Users & Access -> System Update (/users?tab=update) to check official ORNL/oscar GitHub Releases anonymously without any GitHub login or token, verify the SHA-256 digest, install into a clean sibling directory with automatic rollback, or upload an air-gapped .zip bundle.',
            es: 'Abra Usuarios y acceso -> Actualización del sistema (/users?tab=update) para consultar versiones oficiales de ORNL/oscar sin cuenta ni token de GitHub, verificar el resumen SHA-256, actualizar con respaldo automático o cargar un paquete .zip sin conexión.',
            fr: 'Ouvrez Utilisateurs et accès -> Mise à jour système (/users?tab=update) pour interroger les versions officielles ORNL/oscar sans compte ni jeton GitHub, vérifier le condensé SHA-256, mettre à niveau avec repli automatique ou téléverser une archive .zip hors ligne.',
            el: 'Ανοίξτε Χρήστες & Πρόσβαση -> Ενημέρωση συστήματος (/users?tab=update) για ανώνυμο έλεγχο εκδόσεων ORNL/oscar χωρίς σύνδεση GitHub, επαλήθευση SHA-256, εγκατάσταση με αυτόματη επαναφορά ή μεταφόρτωση πακέτου .zip εκτός σύνδεσης.',
        },
    ),
    makeGuide(
        '31',
        '31-bare-metal-autoinstall-usb-creator',
        'A',
        '67s',
        '1739.4 KiB',
        {
            en: 'Build an Air-Gapped Ubuntu 24.04 Autoinstall USB Drive (GUI, TUI & CLI)',
            es: 'Crear una unidad USB de autoinstalación Ubuntu 24.04 sin conexión (GUI, TUI y CLI)',
            fr: 'Créer une clé USB d’installation automatique Ubuntu 24.04 hors ligne (GUI, TUI et CLI)',
            el: 'Δημιουργία USB αυτόματης εγκατάστασης Ubuntu 24.04 εκτός δικτύου (GUI, TUI & CLI)',
        },
        {
            en: 'Use the standalone oscar-3.11.15-autoinstall-usb-creator.zip on Windows 11 or Ubuntu—via Desktop GUI, interactive terminal TUI, or CLI—to combine ubuntu-24.04-live-server-amd64.iso, oscar-3.11.15-ubuntu-x86_64-offline-full.zip, a PBKDF2-hashed initial OSCAR web admin password, and lanes.csv with unattended first-boot setup.',
            es: 'Use oscar-3.11.15-autoinstall-usb-creator.zip en Windows 11 o Ubuntu —mediante GUI de escritorio, TUI interactiva o CLI— para combinar el ISO de Ubuntu 24.04, offline-full.zip, contraseña web inicial admin con hash PBKDF2 y lanes.csv con auto-inicialización.',
            fr: 'Utilisez oscar-3.11.15-autoinstall-usb-creator.zip sous Windows 11 ou Ubuntu — via GUI de bureau, TUI interactive ou CLI — pour assembler l’ISO Ubuntu 24.04, offline-full.zip, mot de passe web admin PBKDF2 et lanes.csv avec initialisation automatique.',
            el: 'Χρησιμοποιήστε το oscar-3.11.15-autoinstall-usb-creator.zip σε Windows 11 ή Ubuntu — μέσω GUI, διαδραστικού TUI ή CLI — για συνδυασμό του ISO Ubuntu 24.04, του offline-full.zip, κωδικού web admin PBKDF2 και lanes.csv με αυτόματη αρχικοποίηση.',
        },
    ),
];

const GUIDE_BY_SLUG = new Map<string, VideoGuideEntry>(
    VIDEO_GUIDES_CATALOG.map((guide) => [guide.slug, guide]),
);

export function getVideoGuideBySlug(slug: string): VideoGuideEntry | undefined {
    return GUIDE_BY_SLUG.get(slug);
}

export function resolveVideoGuidesBySlugs(slugs: readonly string[]): VideoGuideEntry[] {
    const resolved: VideoGuideEntry[] = [];
    for (const slug of slugs) {
        const entry = GUIDE_BY_SLUG.get(slug);
        if (entry) resolved.push(entry);
    }
    return resolved;
}

const ROUTE_VIDEO_GUIDE_SLUGS: Record<string, readonly string[]> = {
    '/': ['09-dashboard-monitoring-and-quick-adjudication', '10-operational-views-scoping'],
    '/quick-view': ['09-dashboard-monitoring-and-quick-adjudication', '10-operational-views-scoping'],
    '/lane-view': ['11-live-lane-video-and-charts', '29-lane-webrelay-lights-and-sound'],
    '/event-log': ['12-event-log-filtering-and-adjudication-codes', '17-vehicle-ocr-and-adjudication', '27-cargo-uff-smb-and-xray-inspection'],
    '/event-details': ['13-event-details-adjudication-and-daily-file', '17-vehicle-ocr-and-adjudication', '27-cargo-uff-smb-and-xray-inspection'],
    '/event-preview': ['13-event-details-adjudication-and-daily-file', '17-vehicle-ocr-and-adjudication', '27-cargo-uff-smb-and-xray-inspection'],
    '/alarm-transfer': ['14-airgapped-alarm-qr-transfer'],
    '/health': ['15-status-of-health-and-site-map', '29-lane-webrelay-lights-and-sound'],
    '/map': ['25-pluggable-runtime-extensions-and-pmtiles', '15-status-of-health-and-site-map', '06-admin-manual-lane-and-site-diagram'],
    '/national-view': ['20-multi-node-federation-vehicle-search-and-report', '16-national-statistics-and-reports'],
    '/report': ['20-multi-node-federation-vehicle-search-and-report', '16-national-statistics-and-reports', '17-vehicle-ocr-and-adjudication'],
    '/users': ['30-zero-login-github-system-update', '19-viewer-users-passkeys-and-access', '21-federated-sso-passkey-onboarding-and-revocation', '08-viewer-signin-language-and-nodes'],
    '/servers': ['20-multi-node-federation-vehicle-search-and-report', '08-viewer-signin-language-and-nodes', '19-viewer-users-passkeys-and-access'],
    '/usb-backups': ['24-continual-and-occasional-usb-backups', '03-archive-and-snapshot-backup'],
    '/extensions': ['25-pluggable-runtime-extensions-and-pmtiles', '27-cargo-uff-smb-and-xray-inspection', '07-admin-eml-plugin-setup'],
};

export function normalizeConsolePathname(pathname?: string | null): string {
    if (!pathname) return '/';
    const withoutQuery = pathname.split('?')[0]?.split('#')[0] ?? '/';
    const trimmed = withoutQuery.replace(/\/+$/, '');
    return trimmed.length > 0 ? trimmed : '/';
}

export function getContextualVideoGuidesForPath(pathname?: string | null): VideoGuideEntry[] {
    const normalized = normalizeConsolePathname(pathname);
    const slugs = ROUTE_VIDEO_GUIDE_SLUGS[normalized] ?? ['18-operator-help-and-support-bundle'];
    return resolveVideoGuidesBySlugs(slugs);
}

export const CONSOLE_PAGE_CARD_GUIDE_SLUGS: readonly (readonly string[])[] = [
    ['09-dashboard-monitoring-and-quick-adjudication', '10-operational-views-scoping', '11-live-lane-video-and-charts'],
    ['12-event-log-filtering-and-adjudication-codes', '13-event-details-adjudication-and-daily-file', '17-vehicle-ocr-and-adjudication', '27-cargo-uff-smb-and-xray-inspection'],
    ['15-status-of-health-and-site-map', '29-lane-webrelay-lights-and-sound'],
    ['25-pluggable-runtime-extensions-and-pmtiles', '15-status-of-health-and-site-map', '06-admin-manual-lane-and-site-diagram'],
    ['16-national-statistics-and-reports'],
    ['16-national-statistics-and-reports'],
    ['14-airgapped-alarm-qr-transfer'],
    ['30-zero-login-github-system-update', '19-viewer-users-passkeys-and-access', '08-viewer-signin-language-and-nodes'],
    ['08-viewer-signin-language-and-nodes', '19-viewer-users-passkeys-and-access'],
    ['24-continual-and-occasional-usb-backups', '03-archive-and-snapshot-backup'],
    ['25-pluggable-runtime-extensions-and-pmtiles', '27-cargo-uff-smb-and-xray-inspection', '07-admin-eml-plugin-setup'],
];

export const REPORT_CARD_GUIDE_SLUGS: readonly (readonly string[])[] = [
    ['16-national-statistics-and-reports'],
    ['16-national-statistics-and-reports'],
    ['16-national-statistics-and-reports'],
    ['16-national-statistics-and-reports'],
    ['16-national-statistics-and-reports'],
    ['17-vehicle-ocr-and-adjudication', '16-national-statistics-and-reports'],
];

export const GLOSSARY_INDEX_GUIDE_SLUGS: Readonly<Record<number, readonly string[]>> = {
    4: ['07-admin-eml-plugin-setup'],
    7: ['13-event-details-adjudication-and-daily-file'],
    9: ['10-operational-views-scoping'],
    10: ['13-event-details-adjudication-and-daily-file'],
    11: ['03-archive-and-snapshot-backup'],
    12: ['17-vehicle-ocr-and-adjudication'],
    13: ['19-viewer-users-passkeys-and-access', '08-viewer-signin-language-and-nodes'],
    14: ['19-viewer-users-passkeys-and-access', '08-viewer-signin-language-and-nodes'],
    15: ['25-pluggable-runtime-extensions-and-pmtiles', '27-cargo-uff-smb-and-xray-inspection', '07-admin-eml-plugin-setup'],
    16: ['24-continual-and-occasional-usb-backups', '03-archive-and-snapshot-backup'],
    17: ['27-cargo-uff-smb-and-xray-inspection'],
    18: ['28-hands-on-training-sandbox'],
    19: ['29-lane-webrelay-lights-and-sound'],
};

export const VIDEO_GUIDE_UI_STRINGS: Record<Locale, VideoGuideUiStrings> = {
    en: {
        contextualStripLabel: 'Video guides for this page:',
        watchButtonLabel: (badge, durationLabel) => `Watch #${badge} (${durationLabel})`,
        watchButtonAriaLabel: (visibleLabel, guideTitle, contextTitle) =>
            contextTitle ? `${visibleLabel} — ${guideTitle} (${contextTitle})` : `${visibleLabel} — ${guideTitle}`,
        closeVideoLabel: 'Close video',
        captionsNote: '1080p H.264 · synchronized closed captions (.vtt) in 4 languages (English, Español, Français, Ελληνικά) included; zero data loaded until played.',
        localCatalogCardTitle: 'Built-In How-To Video Guides (`/video-guides/index.html`)',
        localCatalogCardDesc: '31 compressed 1080p workflow screen recordings (< 2 min each, ~36 MiB total) bundled directly inside OSCAR for offline and air-gapped workstations, with synchronized closed captions.',
        openLocalCatalogButtonLabel: 'Open Local Video Guide Page',
        openGithubCatalogButtonLabel: 'ORNL/oscar-video-guides (GitHub)',
        inAppCatalogHeading: 'Browse & Play All 31 Workflow Video Guides Inline',
        inAppCatalogHint: 'Expand a track below and select any workflow to play it directly inside this dialog.',
        tracks: {
            A: 'Track A — CLI Deployment, Field Staging, Storage, Scaling & Regression (01–03, 22–23, 26, 31)',
            B: 'Track B — SensorHub Admin Configuration (04–07)',
            C: 'Track C — OSCAR Viewer Console, USB Backups, Extensions, Cargo UFF, Sandbox & Federation (08–21, 24–25, 27–30)',
        },
    },
    es: {
        contextualStripLabel: 'Videoguías para esta página:',
        watchButtonLabel: (badge, durationLabel) => `Ver #${badge} (${durationLabel})`,
        watchButtonAriaLabel: (visibleLabel, guideTitle, contextTitle) =>
            contextTitle ? `${visibleLabel} — ${guideTitle} (${contextTitle})` : `${visibleLabel} — ${guideTitle}`,
        closeVideoLabel: 'Cerrar vídeo',
        captionsNote: '1080p H.264 · incluye subtítulos sincronizados (.vtt) en 4 idiomas (English, Español, Français, Ελληνικά); no descarga datos hasta reproducir.',
        localCatalogCardTitle: 'Videoguías prácticas integradas (`/video-guides/index.html`)',
        localCatalogCardDesc: '31 grabaciones cortas en 1080p (< 2 min cada una, ~36 MiB en total) integradas localmente en OSCAR para estaciones sin conexión o aisladas, con subtítulos sincronizados.',
        openLocalCatalogButtonLabel: 'Abrir catálogo local de videoguías',
        openGithubCatalogButtonLabel: 'ORNL/oscar-video-guides (GitHub)',
        inAppCatalogHeading: 'Explorar y reproducir las 31 videoguías aquí mismo',
        inAppCatalogHint: 'Despliegue una sección y pulse cualquier guía para reproducirla directamente en este cuadro de diálogo.',
        tracks: {
            A: 'Bloque A — Despliegue CLI, preparación de campo, almacenamiento y regresión (01–03, 22–23, 26, 31)',
            B: 'Bloque B — Configuración en SensorHub Admin (04–07)',
            C: 'Bloque C — Operaciones de consola, copias USB, extensiones, UFF, práctica y federación (08–21, 24–25, 27–30)',
        },
    },
    fr: {
        contextualStripLabel: 'Guides vidéo pour cette page :',
        watchButtonLabel: (badge, durationLabel) => `Voir #${badge} (${durationLabel})`,
        watchButtonAriaLabel: (visibleLabel, guideTitle, contextTitle) =>
            contextTitle ? `${visibleLabel} — ${guideTitle} (${contextTitle})` : `${visibleLabel} — ${guideTitle}`,
        closeVideoLabel: 'Fermer la vidéo',
        captionsNote: '1080p H.264 · sous-titres synchronisés (.vtt) inclus en 4 langues (English, Español, Français, Ελληνικά) ; aucune donnée chargée avant lecture.',
        localCatalogCardTitle: 'Guides vidéo pratiques intégrés (`/video-guides/index.html`)',
        localCatalogCardDesc: '31 courtes captures 1080p (< 2 min chacune, ~36 Mio au total) embarquées localement dans OSCAR pour les postes hors ligne ou isolés, avec sous-titres synchronisés.',
        openLocalCatalogButtonLabel: 'Ouvrir la page locale des guides vidéo',
        openGithubCatalogButtonLabel: 'ORNL/oscar-video-guides (GitHub)',
        inAppCatalogHeading: 'Parcourir et lire les 31 guides vidéo intégrés',
        inAppCatalogHint: 'Dépliez une catégorie ci-dessous et sélectionnez un guide pour le lire directement dans cette fenêtre.',
        tracks: {
            A: 'Volet A — Déploiement CLI, préparation terrain, stockage et régression (01–03, 22–23, 26, 31)',
            B: 'Volet B — Configuration dans SensorHub Admin (04–07)',
            C: 'Volet C — Opérations de console, sauvegardes USB, extensions, UFF, bac à sable et fédération (08–21, 24–25, 27–30)',
        },
    },
    el: {
        contextualStripLabel: 'Βιντεοοδηγοί για αυτή τη σελίδα:',
        watchButtonLabel: (badge, durationLabel) => `Προβολή #${badge} (${durationLabel})`,
        watchButtonAriaLabel: (visibleLabel, guideTitle, contextTitle) =>
            contextTitle ? `${visibleLabel} — ${guideTitle} (${contextTitle})` : `${visibleLabel} — ${guideTitle}`,
        closeVideoLabel: 'Κλείσιμο βίντεο',
        captionsNote: '1080p H.264 · περιλαμβάνει συγχρονισμένους υπότιτλους (.vtt) σε 4 γλώσσες (English, Español, Français, Ελληνικά)· μηδενική φόρτωση δεδομένων πριν την αναπαραγωγή.',
        localCatalogCardTitle: 'Ενσωματωμένοι βιντεοοδηγοί εργασιών (`/video-guides/index.html`)',
        localCatalogCardDesc: '31 συμπιεσμένα βίντεο 1080p (< 2 λεπ. έκαστο, ~36 MiB συνολικά) ενσωματωμένα τοπικά στο OSCAR για σταθμούς εκτός δικτύου, με συγχρονισμένους υπότιτλους.',
        openLocalCatalogButtonLabel: 'Άνοιγμα τοπικής σελίδας βιντεοοδηγών',
        openGithubCatalogButtonLabel: 'ORNL/oscar-video-guides (GitHub)',
        inAppCatalogHeading: 'Περιήγηση & αναπαραγωγή και των 31 βιντεοοδηγών εντός παραθύρου',
        inAppCatalogHint: 'Αναπτύξτε μια ενότητα παρακάτω και επιλέξτε οποιονδήποτε οδηγό για άμεση αναπαραγωγή.',
        tracks: {
            A: 'Ενότητα A — Εγκατάσταση CLI, προετοιμασία πεδίου, αποθήκευση & παλινδρόμηση (01–03, 22–23, 26, 31)',
            B: 'Ενότητα B — Διαμόρφωση στο SensorHub Admin (04–07)',
            C: 'Ενότητα C — Λειτουργίες κονσόλας, αντίγραφα USB, επεκτάσεις, UFF, εκπαίδευση & ομοσπονδία (08–21, 24–25, 27–30)',
        },
    },
};
