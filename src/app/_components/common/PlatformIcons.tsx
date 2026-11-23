"use client";

import * as React from 'react';
import { Box } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';
import MonitorHeartRoundedIcon from '@mui/icons-material/MonitorHeartRounded';
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded';
import MediationIcon from '@mui/icons-material/Mediation';
import InsertChartIcon from '@mui/icons-material/InsertChart';
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded';
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded';
import UsbRoundedIcon from '@mui/icons-material/UsbRounded';
import ExtensionRoundedIcon from '@mui/icons-material/ExtensionRounded';
import CloudRoundedIcon from '@mui/icons-material/CloudRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import SettingsIcon from '@mui/icons-material/Settings';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import FilterCenterFocusRoundedIcon from '@mui/icons-material/FilterCenterFocusRounded';
import LanguageIcon from '@mui/icons-material/Language';
import MenuIcon from '@mui/icons-material/Menu';
import SplitscreenRoundedIcon from '@mui/icons-material/SplitscreenRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';
import type { Locale } from '@/app/contexts/LanguageContext';

export type PlatformIconKey =
    | 'dashboard'
    | 'events'
    | 'health'
    | 'map'
    | 'national'
    | 'report'
    | 'alarm-transfer'
    | 'users'
    | 'usb-backups'
    | 'extensions'
    | 'servers'
    | 'help'
    | 'settings'
    | 'walkthrough'
    | 'scoped-view'
    | 'language'
    | 'menu'
    | 'split-admin'
    | 'webrelay'
    | 'uff'
    | 'qr';

export interface PlatformIconDefinition {
    key: PlatformIconKey;
    Icon: SvgIconComponent;
    spotlightSelector: string;
    symbolName: Record<Locale, string>;
    locationNote: Record<Locale, string>;
    highlightLabel: Record<Locale, string>;
}

export const PLATFORM_ICONS: Record<PlatformIconKey, PlatformIconDefinition> = {
    dashboard: {
        key: 'dashboard',
        Icon: DashboardRoundedIcon,
        spotlightSelector: '[data-testid="nav-item-dashboard"]',
        symbolName: {
            en: 'four-tile grid icon',
            es: 'icono de cuadrícula de 4 mosaicos',
            fr: 'icône de grille à 4 tuiles',
            el: 'εικονίδιο πλέγματος 4 πλακιδίων',
        },
        locationNote: {
            en: 'Left navigation bar symbol: four-tile grid icon.',
            es: 'Símbolo en la barra lateral izquierda: icono de cuadrícula de 4 mosaicos.',
            fr: 'Symbole dans la barre latérale gauche : icône de grille à 4 tuiles.',
            el: 'Σύμβολο στην αριστερή γραμμή πλοήγησης: εικονίδιο πλέγματος 4 πλακιδίων.',
        },
        highlightLabel: {
            en: 'Highlight Dashboard Icon',
            es: 'Resaltar icono de Panel',
            fr: 'Mettre en évidence l’icône Tableau de bord',
            el: 'Επισήμανση εικονιδίου Πίνακα ελέγχου',
        },
    },
    events: {
        key: 'events',
        Icon: WarningRoundedIcon,
        spotlightSelector: '[data-testid="nav-item-events"]',
        symbolName: {
            en: 'warning-triangle (!) icon',
            es: 'icono de triángulo de advertencia (!)',
            fr: 'icône de triangle d’alerte (!)',
            el: 'εικονίδιο προειδοποιητικού τριγώνου (!)',
        },
        locationNote: {
            en: 'Left navigation bar symbol: warning-triangle (!) icon.',
            es: 'Símbolo en la barra lateral izquierda: icono de triángulo de advertencia (!).',
            fr: 'Symbole dans la barre latérale gauche : icône de triangle d’alerte (!).',
            el: 'Σύμβολο στην αριστερή γραμμή πλοήγησης: εικονίδιο προειδοποιητικού τριγώνου (!).',
        },
        highlightLabel: {
            en: 'Highlight Events Icon',
            es: 'Resaltar icono de Eventos',
            fr: 'Mettre en évidence l’icône Événements',
            el: 'Επισήμανση εικονιδίου Συμβάντων',
        },
    },
    health: {
        key: 'health',
        Icon: MonitorHeartRoundedIcon,
        spotlightSelector: '[data-testid="nav-item-health"]',
        symbolName: {
            en: 'heart-pulse monitor icon',
            es: 'icono de monitor de pulso cardíaco',
            fr: 'icône de moniteur de pouls cardiaque',
            el: 'εικονίδιο παλμογράφου καρδιάς',
        },
        locationNote: {
            en: 'Left navigation bar symbol: heart-pulse monitor icon.',
            es: 'Símbolo en la barra lateral izquierda: icono de monitor de pulso cardíaco.',
            fr: 'Symbole dans la barre latérale gauche : icône de moniteur de pouls cardiaque.',
            el: 'Σύμβολο στην αριστερή γραμμή πλοήγησης: εικονίδιο παλμογράφου καρδιάς.',
        },
        highlightLabel: {
            en: 'Highlight Status of Health Icon',
            es: 'Resaltar icono de Estado de salud',
            fr: 'Mettre en évidence l’icône État de santé',
            el: 'Επισήμανση εικονιδίου Κατάστασης υγείας',
        },
    },
    map: {
        key: 'map',
        Icon: LocationOnRoundedIcon,
        spotlightSelector: '[data-testid="nav-item-map"]',
        symbolName: {
            en: 'map-pin icon',
            es: 'icono de marcador de mapa',
            fr: 'icône d’épingle de carte',
            el: 'εικονίδιο πινέζας χάρτη',
        },
        locationNote: {
            en: 'Left navigation bar symbol: map-pin icon.',
            es: 'Símbolo en la barra lateral izquierda: icono de marcador de mapa.',
            fr: 'Symbole dans la barre latérale gauche : icône d’épingle de carte.',
            el: 'Σύμβολο στην αριστερή γραμμή πλοήγησης: εικονίδιο πινέζας χάρτη.',
        },
        highlightLabel: {
            en: 'Highlight Map Icon',
            es: 'Resaltar icono de Mapa',
            fr: 'Mettre en évidence l’icône Carte',
            el: 'Επισήμανση εικονιδίου Χάρτη',
        },
    },
    national: {
        key: 'national',
        Icon: MediationIcon,
        spotlightSelector: '[data-testid="nav-item-national"]',
        symbolName: {
            en: 'connected-nodes network icon',
            es: 'icono de red de nodos conectados',
            fr: 'icône de réseau de nœuds connectés',
            el: 'εικονίδιο δικτύου συνδεδεμένων κόμβων',
        },
        locationNote: {
            en: 'Left navigation bar symbol: connected-nodes network icon.',
            es: 'Símbolo en la barra lateral izquierda: icono de red de nodos conectados.',
            fr: 'Symbole dans la barre latérale gauche : icône de réseau de nœuds connectés.',
            el: 'Σύμβολο στην αριστερή γραμμή πλοήγησης: εικονίδιο δικτύου συνδεδεμένων κόμβων.',
        },
        highlightLabel: {
            en: 'Highlight National Icon',
            es: 'Resaltar icono de Nacional',
            fr: 'Mettre en évidence l’icône National',
            el: 'Επισήμανση εικονιδίου Εθνικής προβολής',
        },
    },
    report: {
        key: 'report',
        Icon: InsertChartIcon,
        spotlightSelector: '[data-testid="nav-item-report"]',
        symbolName: {
            en: 'three-bar chart icon',
            es: 'icono de gráfico de barras',
            fr: 'icône de graphique à barres',
            el: 'εικονίδιο ραβδογράμματος',
        },
        locationNote: {
            en: 'Left navigation bar symbol: three-bar chart icon.',
            es: 'Símbolo en la barra lateral izquierda: icono de gráfico de barras.',
            fr: 'Symbole dans la barre latérale gauche : icône de graphique à barres.',
            el: 'Σύμβολο στην αριστερή γραμμή πλοήγησης: εικονίδιο ραβδογράμματος.',
        },
        highlightLabel: {
            en: 'Highlight Report Generator Icon',
            es: 'Resaltar icono de Generador de informes',
            fr: 'Mettre en évidence l’icône Rapports',
            el: 'Επισήμανση εικονιδίου Αναφορών',
        },
    },
    'alarm-transfer': {
        key: 'alarm-transfer',
        Icon: QrCodeScannerRoundedIcon,
        spotlightSelector: '[data-testid="nav-item-alarm-transfer"]',
        symbolName: {
            en: 'QR-scanner frame icon',
            es: 'icono de escáner QR',
            fr: 'icône de lecteur QR',
            el: 'εικονίδιο σαρωτή QR',
        },
        locationNote: {
            en: 'Left navigation bar symbol: QR-scanner frame icon.',
            es: 'Símbolo en la barra lateral izquierda: icono de escáner QR.',
            fr: 'Symbole dans la barre latérale gauche : icône de lecteur QR.',
            el: 'Σύμβολο στην αριστερή γραμμή πλοήγησης: εικονίδιο σαρωτή QR.',
        },
        highlightLabel: {
            en: 'Highlight Alarm Transfer QR Icon',
            es: 'Resaltar icono QR de Transferencia',
            fr: 'Mettre en évidence l’icône QR Transfert',
            el: 'Επισήμανση εικονιδίου QR Μεταφοράς',
        },
    },
    users: {
        key: 'users',
        Icon: ManageAccountsRoundedIcon,
        spotlightSelector: '[data-testid="nav-item-users"], [data-testid="navbar-user-account-btn"]',
        symbolName: {
            en: 'person-and-gear icon',
            es: 'icono de usuario con engranaje',
            fr: 'icône de profil avec engrenage',
            el: 'εικονίδιο χρήστη με γρανάζι',
        },
        locationNote: {
            en: 'Left navigation bar & top-bar account symbol: person-and-gear icon.',
            es: 'Símbolo en la barra lateral izquierda y cuenta superior: icono de usuario con engranaje.',
            fr: 'Symbole dans la barre latérale gauche et le compte supérieur : icône de profil avec engrenage.',
            el: 'Σύμβολο στην αριστερή γραμμή πλοήγησης και στον λογαριασμό: εικονίδιο χρήστη με γρανάζι.',
        },
        highlightLabel: {
            en: 'Highlight Users & Access Icon',
            es: 'Resaltar icono de Usuarios y acceso',
            fr: 'Mettre en évidence l’icône Utilisateurs',
            el: 'Επισήμανση εικονιδίου Χρηστών & πρόσβασης',
        },
    },
    'usb-backups': {
        key: 'usb-backups',
        Icon: UsbRoundedIcon,
        spotlightSelector: '[data-testid="nav-item-usb-backups"]',
        symbolName: {
            en: 'USB trident icon',
            es: 'icono de conector USB',
            fr: 'icône de connecteur USB',
            el: 'εικονίδιο υποδοχής USB',
        },
        locationNote: {
            en: 'Left navigation bar symbol (Administrators): USB trident icon.',
            es: 'Símbolo en la barra lateral izquierda (Administradores): icono de conector USB.',
            fr: 'Symbole dans la barre latérale gauche (Administrateurs) : icône de connecteur USB.',
            el: 'Σύμβολο στην αριστερή γραμμή πλοήγησης (Διαχειριστές): εικονίδιο USB.',
        },
        highlightLabel: {
            en: 'Highlight USB Backups Icon',
            es: 'Resaltar icono de Copias USB',
            fr: 'Mettre en évidence l’icône Sauvegardes USB',
            el: 'Επισήμανση εικονιδίου Αντιγράφων USB',
        },
    },
    extensions: {
        key: 'extensions',
        Icon: ExtensionRoundedIcon,
        spotlightSelector: '[data-testid="nav-item-extensions"]',
        symbolName: {
            en: 'puzzle-piece icon',
            es: 'icono de pieza de rompecabezas',
            fr: 'icône de pièce de puzzle',
            el: 'εικονίδιο κομματιού παζλ',
        },
        locationNote: {
            en: 'Left navigation bar symbol (Administrators): puzzle-piece icon.',
            es: 'Símbolo en la barra lateral izquierda (Administradores): icono de pieza de rompecabezas.',
            fr: 'Symbole dans la barre latérale gauche (Administrateurs) : icône de pièce de puzzle.',
            el: 'Σύμβολο στην αριστερή γραμμή πλοήγησης (Διαχειριστές): εικονίδιο κομματιού παζλ.',
        },
        highlightLabel: {
            en: 'Highlight Runtime Extensions Icon',
            es: 'Resaltar icono de Extensiones',
            fr: 'Mettre en évidence l’icône Extensions',
            el: 'Επισήμανση εικονιδίου Επεκτάσεων',
        },
    },
    servers: {
        key: 'servers',
        Icon: CloudRoundedIcon,
        spotlightSelector: '[data-testid="nav-item-servers"]',
        symbolName: {
            en: 'cloud icon',
            es: 'icono de nube',
            fr: 'icône de nuage',
            el: 'εικονίδιο σύννεφου',
        },
        locationNote: {
            en: 'Left navigation bar symbol: cloud icon.',
            es: 'Símbolo en la barra lateral izquierda: icono de nube.',
            fr: 'Symbole dans la barre latérale gauche : icône de nuage.',
            el: 'Σύμβολο στην αριστερή γραμμή πλοήγησης: εικονίδιο σύννεφου.',
        },
        highlightLabel: {
            en: 'Highlight Nodes (Cloud) Icon',
            es: 'Resaltar icono de Nodos (nube)',
            fr: 'Mettre en évidence l’icône Nœuds (nuage)',
            el: 'Επισήμανση εικονιδίου Κόμβων (σύννεφο)',
        },
    },
    help: {
        key: 'help',
        Icon: HelpOutlineRoundedIcon,
        spotlightSelector: '[data-testid="navbar-help-button"]',
        symbolName: {
            en: 'circled question-mark (?) icon',
            es: 'icono de interrogación (?) en círculo',
            fr: 'icône de point d’interrogation (?) cerclé',
            el: 'εικονίδιο ερωτηματικού (?) σε κύκλο',
        },
        locationNote: {
            en: 'Top-right bar symbol: circled question-mark (?) icon.',
            es: 'Símbolo en la barra superior derecha: icono de interrogación (?) en círculo.',
            fr: 'Symbole dans la barre supérieure droite : icône de point d’interrogation (?) cerclé.',
            el: 'Σύμβολο στην επάνω δεξιά γραμμή: εικονίδιο ερωτηματικού (?) σε κύκλο.',
        },
        highlightLabel: {
            en: 'Highlight Help (?) Icon',
            es: 'Resaltar icono de Ayuda (?)',
            fr: 'Mettre en évidence l’icône Aide (?)',
            el: 'Επισήμανση εικονιδίου Βοήθειας (?)',
        },
    },
    settings: {
        key: 'settings',
        Icon: SettingsIcon,
        spotlightSelector: '[data-testid="navbar-settings-button"]',
        symbolName: {
            en: 'gear icon',
            es: 'icono de engranaje',
            fr: 'icône d’engrenage',
            el: 'εικονίδιο γραναζιού',
        },
        locationNote: {
            en: 'Top-right bar symbol: gear icon.',
            es: 'Símbolo en la barra superior derecha: icono de engranaje.',
            fr: 'Symbole dans la barre supérieure droite : icône d’engrenage.',
            el: 'Σύμβολο στην επάνω δεξιά γραμμή: εικονίδιο γραναζιού.',
        },
        highlightLabel: {
            en: 'Highlight Settings Gear Icon',
            es: 'Resaltar icono de Configuración',
            fr: 'Mettre en évidence l’icône Paramètres',
            el: 'Επισήμανση εικονιδίου Ρυθμίσεων',
        },
    },
    walkthrough: {
        key: 'walkthrough',
        Icon: SchoolRoundedIcon,
        spotlightSelector: '[data-testid="navbar-walkthrough-button"], [data-testid="navbar-training-coach-toggle"]',
        symbolName: {
            en: 'graduation-cap icon',
            es: 'icono de birrete académico',
            fr: 'icône de toque universitaire',
            el: 'εικονίδιο καπέλου αποφοίτησης',
        },
        locationNote: {
            en: 'Top bar symbol: graduation-cap icon.',
            es: 'Símbolo en la barra superior: icono de birrete académico.',
            fr: 'Symbole dans la barre supérieure : icône de toque universitaire.',
            el: 'Σύμβολο στην επάνω γραμμή: εικονίδιο καπέλου αποφοίτησης.',
        },
        highlightLabel: {
            en: 'Highlight Guided Walkthrough Icon',
            es: 'Resaltar icono de Recorrido guiado',
            fr: 'Mettre en évidence l’icône Parcours guidé',
            el: 'Επισήμανση εικονιδίου Περιήγησης',
        },
    },
    'scoped-view': {
        key: 'scoped-view',
        Icon: FilterCenterFocusRoundedIcon,
        spotlightSelector: '[data-testid="navbar-scoped-view-select"], [data-testid="navbar-scoped-view-badge"]',
        symbolName: {
            en: 'Scoped View selector',
            es: 'selector de Vista operativa',
            fr: 'sélecteur de Vue opérationnelle',
            el: 'επιλογέας Λειτουργικής προβολής',
        },
        locationNote: {
            en: 'Top bar control: Scoped View selector dropdown.',
            es: 'Control en la barra superior: menú desplegable Vista operativa.',
            fr: 'Commande dans la barre supérieure : menu déroulant Vue opérationnelle.',
            el: 'Στοιχείο στην επάνω γραμμή: αναπτυσσόμενο μενού Λειτουργικής προβολής.',
        },
        highlightLabel: {
            en: 'Highlight Scoped View Selector',
            es: 'Resaltar selector de Vista operativa',
            fr: 'Mettre en évidence le sélecteur de Vue',
            el: 'Επισήμανση επιλογέα Προβολής',
        },
    },
    language: {
        key: 'language',
        Icon: LanguageIcon,
        spotlightSelector: '[data-testid="navbar-language-selector"]',
        symbolName: {
            en: 'globe language icon',
            es: 'icono de globo de idioma',
            fr: 'icône de globe de langue',
            el: 'εικονίδιο υδρογείου γλώσσας',
        },
        locationNote: {
            en: 'Top-right bar symbol: globe language selector.',
            es: 'Símbolo en la barra superior derecha: selector de idioma con globo.',
            fr: 'Symbole dans la barre supérieure droite : sélecteur de langue (globe).',
            el: 'Σύμβολο στην επάνω δεξιά γραμμή: επιλογέας γλώσσας (υδρόγειος).',
        },
        highlightLabel: {
            en: 'Highlight Language Selector',
            es: 'Resaltar selector de idioma',
            fr: 'Mettre en évidence le sélecteur de langue',
            el: 'Επισήμανση επιλογέα γλώσσας',
        },
    },
    menu: {
        key: 'menu',
        Icon: MenuIcon,
        spotlightSelector: '[data-testid="navbar-drawer-toggle"]',
        symbolName: {
            en: 'three-line menu icon',
            es: 'icono de menú de tres líneas',
            fr: 'icône de menu à trois barres',
            el: 'εικονίδιο μενού τριών γραμμών',
        },
        locationNote: {
            en: 'Top-left bar symbol: three-line drawer menu icon.',
            es: 'Símbolo en la barra superior izquierda: icono de menú de tres líneas.',
            fr: 'Symbole dans la barre supérieure gauche : icône de menu à trois barres.',
            el: 'Σύμβολο στην επάνω αριστερή γραμμή: εικονίδιο μενού τριών γραμμών.',
        },
        highlightLabel: {
            en: 'Highlight Navigation Menu Icon',
            es: 'Resaltar icono del menú lateral',
            fr: 'Mettre en évidence l’icône du menu',
            el: 'Επισήμανση εικονιδίου μενού',
        },
    },
    'split-admin': {
        key: 'split-admin',
        Icon: SplitscreenRoundedIcon,
        spotlightSelector: '[data-testid="training-toggle-split-admin"], [data-testid="training-refresher-admin-link"]',
        symbolName: {
            en: 'split-pane icon',
            es: 'icono de vista dividida',
            fr: 'icône de vue partagée',
            el: 'εικονίδιο διπλής προβολής',
        },
        locationNote: {
            en: 'Training Coach action button: split-pane SensorHub Admin icon.',
            es: 'Botón en la Guía de Práctica: icono de vista dividida de SensorHub Admin.',
            fr: 'Bouton du Coach Formation : icône de vue partagée SensorHub Admin.',
            el: 'Κουμπί στον Οδηγό Εκπαίδευσης: εικονίδιο διπλής προβολής SensorHub Admin.',
        },
        highlightLabel: {
            en: 'Highlight Split-Pane Admin Button',
            es: 'Resaltar botón de Vista dividida Admin',
            fr: 'Mettre en évidence le bouton Vue partagée',
            el: 'Επισήμανση κουμπιού Διπλής προβολής',
        },
    },
    webrelay: {
        key: 'webrelay',
        Icon: CampaignRoundedIcon,
        spotlightSelector: '[data-testid^="webrelay-open-lane-"], [data-testid="webrelay-open-header-btn"], [data-testid="lane-view-webrelay-btn"]',
        symbolName: {
            en: 'megaphone / siren Lights & Sound icon',
            es: 'icono de megáfono / sirena de Luces y sonido',
            fr: 'icône de mégaphone / sirène Feux et son',
            el: 'εικονίδιο τηλεβόα / σειρήνας Φώτα & ήχος',
        },
        locationNote: {
            en: 'Status of Health & Lane View control: megaphone / siren Lights & Sound button.',
            es: 'Control en Estado de salud y Vista de carril: botón de megáfono Luces y sonido.',
            fr: 'Commande dans État de santé et Vue de voie : bouton mégaphone Feux et son.',
            el: 'Κουμπί σε Κατάσταση υγείας & Προβολή λωρίδας: εικονίδιο τηλεβόα Φώτα & ήχος.',
        },
        highlightLabel: {
            en: 'Highlight Lane Lights & Sound Button',
            es: 'Resaltar botón de Luces y sonido',
            fr: 'Mettre en évidence le bouton Feux et son',
            el: 'Επισήμανση κουμπιού Φώτα & ήχος',
        },
    },
    uff: {
        key: 'uff',
        Icon: LayersRoundedIcon,
        spotlightSelector: '[data-testid="event-log-open-uff-btn"], [data-testid="vehicle-id-search-bar"]',
        symbolName: {
            en: 'stacked-layers 16-bit X-Ray / UFF icon',
            es: 'icono de capas apiladas Rayos X 16 bits / UFF',
            fr: 'icône de calques superposés Rayons X 16 bits / UFF',
            el: 'εικονίδιο επιπέδων Ακτινογραφίας 16-bit / UFF',
        },
        locationNote: {
            en: 'Events search bar & Secondary Inspection control: stacked-layers Cargo X-Ray / UFF icon.',
            es: 'Barra de búsqueda de Eventos e Inspección secundaria: icono de capas Rayos X / UFF.',
            fr: 'Barre de recherche Événements et Inspection secondaire : icône de calques Rayons X / UFF.',
            el: 'Αναζήτηση Συμβάντων & Δευτερογενής έλεγχος: εικονίδιο επιπέδων Ακτινογραφίας / UFF.',
        },
        highlightLabel: {
            en: 'Highlight Cargo UFF Search / X-Ray Control',
            es: 'Resaltar control de Rayos X / UFF',
            fr: 'Mettre en évidence la commande Rayons X / UFF',
            el: 'Επισήμανση στοιχείου Ακτινογραφίας / UFF',
        },
    },
    qr: {
        key: 'qr',
        Icon: QrCodeScannerRoundedIcon,
        spotlightSelector: '[data-testid="nav-item-alarm-transfer"]',
        symbolName: {
            en: 'QR-scanner frame icon',
            es: 'icono de escáner QR',
            fr: 'icône de lecteur QR',
            el: 'εικονίδιο σαρωτή QR',
        },
        locationNote: {
            en: 'Left navigation bar & Event Details share control: QR-scanner frame icon.',
            es: 'Barra lateral izquierda y Detalles del evento: icono de escáner QR.',
            fr: 'Barre latérale gauche et Détails de l’événement : icône de lecteur QR.',
            el: 'Αριστερή γραμμή πλοήγησης & Λεπτομέρειες συμβάντος: εικονίδιο σαρωτή QR.',
        },
        highlightLabel: {
            en: 'Highlight QR Transfer Icon',
            es: 'Resaltar icono QR',
            fr: 'Mettre en évidence l’icône QR',
            el: 'Επισήμανση εικονιδίου QR',
        },
    },
};

export const CONSOLE_PAGE_CARD_ICON_KEYS: readonly PlatformIconKey[] = [
    'dashboard',
    'events',
    'health',
    'map',
    'national',
    'report',
    'alarm-transfer',
    'users',
    'servers',
    'usb-backups',
    'extensions',
];

export const TOP_BAR_TOOL_ICON_KEYS: readonly PlatformIconKey[] = [
    'menu',
    'scoped-view',
    'language',
    'walkthrough',
    'help',
    'settings',
];

export function isPlatformIconKey(value: string): value is PlatformIconKey {
    return Object.prototype.hasOwnProperty.call(PLATFORM_ICONS, value);
}

export function PlatformIconBadge({
    iconKey,
    size = 'inline',
}: {
    iconKey: PlatformIconKey;
    size?: 'inline' | 'card' | 'header';
}) {
    const def = PLATFORM_ICONS[iconKey];
    if (!def) return null;
    const { Icon } = def;

    if (size === 'header') {
        return (
            <Icon
                color="primary"
                aria-hidden="true"
                data-platform-icon={iconKey}
                sx={{ fontSize: 34, flexShrink: 0 }}
            />
        );
    }

    if (size === 'card') {
        return (
            <Box
                component="span"
                aria-hidden="true"
                data-platform-icon={iconKey}
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    borderRadius: 1,
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    flexShrink: 0,
                }}
            >
                <Icon sx={{ fontSize: 18 }} />
            </Box>
        );
    }

    return (
        <Box
            component="span"
            className="oscar-inline-platform-icon"
            aria-hidden="true"
            data-platform-icon={iconKey}
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '1.38em',
                height: '1.38em',
                mx: '0.18em',
                verticalAlign: '-0.24em',
                borderRadius: '4px',
                bgcolor: 'rgba(25, 118, 210, 0.12)',
                color: 'primary.main',
                border: '1px solid rgba(25, 118, 210, 0.28)',
            }}
        >
            <Icon sx={{ fontSize: '0.95em' }} />
        </Box>
    );
}

const TOKEN_PATTERN = /(\{\{icon:[a-z-]+\}\}|`[^`]+`)/g;

/**
 * Renders plain text containing `inline code` backticks and `{{icon:<key>}}` tokens
 * with crisp inline MUI platform icons.
 */
export function renderTextWithIconsAndCode(text: string): React.ReactNode {
    const parts = text.split(TOKEN_PATTERN);
    return parts.map((part, idx) => {
        if (!part) return null;
        if (part.startsWith('{{icon:') && part.endsWith('}}')) {
            const rawKey = part.slice(7, -2);
            if (isPlatformIconKey(rawKey)) {
                return <PlatformIconBadge key={idx} iconKey={rawKey} size="inline" />;
            }
        }
        if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
            return (
                <code key={idx} className="oscar-coach-code">
                    {part.slice(1, -1)}
                </code>
            );
        }
        return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
}

function applySpotlightPulse(target: HTMLElement, durationMs = 3_500): void {
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    target.setAttribute('data-oscar-coach-spotlight', 'true');
    window.setTimeout(() => {
        target.removeAttribute('data-oscar-coach-spotlight');
    }, durationMs);
}

/**
 * Highlights a platform navigation or tool control matching `selector`.
 * Automatically opens the left navigation drawer on compact viewports when
 * targeting a `[data-testid^="nav-item-"]` item.
 */
export function triggerPlatformSpotlight(
    selector?: string,
    options?: { delayMs?: number },
): boolean {
    if (!selector || typeof document === 'undefined' || typeof window === 'undefined') {
        return false;
    }
    const targetsNavDrawer = selector.includes('nav-item-');
    if (targetsNavDrawer) {
        window.dispatchEvent(new CustomEvent('oscar:open-nav-drawer'));
    }

    const immediate = document.querySelector<HTMLElement>(selector);
    if (immediate && (!options?.delayMs || options.delayMs <= 0)) {
        applySpotlightPulse(immediate);
        return true;
    }

    const waitMs = Math.max(options?.delayMs ?? 0, targetsNavDrawer ? 90 : 0);
    if (waitMs > 0) {
        if (immediate) {
            applySpotlightPulse(immediate);
        }
        window.setTimeout(() => {
            const delayed = document.querySelector<HTMLElement>(selector);
            if (delayed) {
                applySpotlightPulse(delayed);
            }
        }, waitMs);
        return Boolean(immediate) || targetsNavDrawer;
    }

    return false;
}
