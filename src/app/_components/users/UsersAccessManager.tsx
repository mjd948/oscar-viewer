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
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    FormControlLabel,
    Grid,
    InputLabel,
    LinearProgress,
    MenuItem,
    Paper,
    Select,
    Stack,
    Switch,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Tabs,
    TextField,
    Typography,
} from '@mui/material';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded';
import VpnKeyRoundedIcon from '@mui/icons-material/VpnKeyRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { PlatformIconBadge } from '@/app/_components/common/PlatformIcons';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import GroupAddRoundedIcon from '@mui/icons-material/GroupAddRounded';
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import CloudRoundedIcon from '@mui/icons-material/CloudRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import SystemUpdateAltRoundedIcon from '@mui/icons-material/SystemUpdateAltRounded';
import Link from 'next/link';
import SystemUpdateCard from '@/app/_components/update/SystemUpdateCard';
import { Locale, useLanguage } from '@/app/contexts/LanguageContext';
import { DataSourceContext } from '@/app/contexts/DataSourceContext';
import { getIntlLocale } from '@/app/utils/LocaleUtils';
import {
    adminCreateFederationToken,
    adminCreateUser,
    adminDeleteUser,
    adminIssueUserInvite,
    adminResetUserPassword,
    adminRevokeFederationToken,
    adminRevokeUserSessions,
    adminUpdateSecurityPolicy,
    adminUpdateUser,
    AdminOverviewResponse,
    AdminUserSummary,
    changeOwnPassword,
    deleteMyPasskey,
    EnrolledInviteCard,
    FederationTokenSummary,
    fetchAdminOverview,
    fetchCurrentSession,
    fetchMyPasskeys,
    isPasskeyRegistrationSupported,
    normalizeTrustedHttpsConsoleUrl,
    OscarRoleId,
    OscarSessionInfo,
    PasskeyItem,
    PasskeyListResponse,
    registerNewPasskey,
    renameMyPasskey,
    SecurityPolicySummary,
    syncClientUserDetails,
} from '@/lib/data/oscar/AuthSessionApi';
import {
    BulkEnrollDialog,
    OnboardingPackDialog,
    useBulkStrings,
} from '@/app/_components/users/OnboardingInviteDialogs';

interface UsersUiCopy {
    pageTitle: string;
    pageSubtitle: string;
    tabs: {
        myAccount: string;
        users: string;
        federation: string;
        policy: string;
        recovery: string;
        systemUpdate: string;
    };
    roles: Record<OscarRoleId, { label: string; desc: string }>;
    accountSummaryTitle: string;
    staySignedInBadge: string;
    timedSessionBadge: (idleMin: number, maxHours: number) => string;
    allGatesScope: string;
    scopedGatesLabel: string;
    passkeysTitle: string;
    passkeysSubtitle: string;
    addPasskeyBtn: string;
    passkeyNicknameLabel: string;
    passkeyIpWarning: string;
    passkeyAlreadyExists: string;
    passkeyAddedSuccess: string;
    noPasskeysYet: string;
    colName: string;
    colType: string;
    colCreated: string;
    colLastUsed: string;
    colActions: string;
    syncedBadge: string;
    deviceBoundBadge: string;
    renameBtn: string;
    removeBtn: string;
    changePasswordTitle: string;
    changePasswordDesc: string;
    currentPasswordLabel: string;
    newPasswordLabel: string;
    confirmPasswordLabel: string;
    showLabel: string;
    hideLabel: string;
    updatePasswordBtn: string;
    passwordUpdatedSuccess: string;
    passwordMismatchError: string;
    usersHeader: string;
    usersSubheader: string;
    addUserBtn: string;
    colUsername: string;
    colRole: string;
    colGateScope: string;
    colStatus: string;
    colSecurity: string;
    statusActive: string;
    statusDisabled: string;
    statusMustChangePw: string;
    editUserBtn: string;
    resetPwBtn: string;
    signOutDevicesBtn: string;
    deleteBtn: string;
    tempPasswordTitle: string;
    tempPasswordHint: string;
    copyBtn: string;
    copiedNotice: string;
    createUserDialogTitle: string;
    editUserDialogTitle: string;
    displayNameLabel: string;
    gateViewsInputLabel: string;
    gateViewsHelper: string;
    autoGenerateTempPwLabel: string;
    initialPasswordLabel: string;
    requirePwChangeOnLoginLabel: string;
    saveBtn: string;
    cancelBtn: string;
    fedHeader: string;
    fedSubheader: string;
    fedWhereToUseTitle: string;
    fedWhereToUseBody: string;
    openServersFedBtn: string;
    fedLabelInput: string;
    fedScopeInput: string;
    fedExpiryInput: string;
    fedNeverExpires: string;
    fed90Days: string;
    fed365Days: string;
    mintFedTokenBtn: string;
    newFedTokenTitle: string;
    newFedTokenHint: string;
    noFedTokens: string;
    revokeBtn: string;
    policyHeader: string;
    policySubheader: string;
    presetStaySignedInTitle: string;
    presetStaySignedInDesc: string;
    presetShiftKioskTitle: string;
    presetShiftKioskDesc: string;
    idleTimeoutLabel: string;
    maxTimeoutLabel: string;
    allowKeepSignedInLabel: string;
    oidcSectionTitle: string;
    oidcSectionDesc: string;
    enableOidcLabel: string;
    oidcProviderLabel: string;
    oidcIssuerLabel: string;
    oidcClientIdLabel: string;
    oidcClientSecretLabel: string;
    oidcAdminGroupLabel: string;
    oidcOperatorGroupLabel: string;
    oidcTrustedCaPathLabel: string;
    externalConsoleUrlLabel: string;
    externalConsoleUrlHelper: string;
    externalConsoleUrlError: string;
    openExternalSsoConsoleBtn: string;
    tunnelSsoTitle: string;
    tunnelSsoDesc: string;
    enableTunnelSsoLabel: string;
    tunnelHeaderLabel: string;
    tunnelGroupsHeaderLabel: string;
    tunnelSecretLabel: string;
    tunnelAutoViewerLabel: string;
    savePolicyBtn: string;
    policySavedSuccess: string;
    recoveryHeader: string;
    recoverySubheader: string;
    downloadChecklistBtn: string;
    confirmDeletePasskeyTitle: string;
    confirmDeletePasskeyBody: (name: string) => string;
    confirmDeleteUserTitle: string;
    confirmDeleteUserBody: (username: string) => string;
    confirmRevokeTokenTitle: string;
    confirmRevokeTokenBody: (label: string) => string;
}

const COPY: Record<Locale, UsersUiCopy> = {
    en: {
        pageTitle: 'Users, Passkeys & Access Control',
        pageSubtitle: 'Manage operator accounts, offline-ready Passkeys & security keys, phone-free passwords, federation tokens, and corporate SSO.',
        tabs: {
            myAccount: 'My Account & Passkeys',
            users: 'Users & Roles',
            federation: 'Federation Tokens',
            policy: 'Sign-In & SSO Policy',
            recovery: 'Backup & Hardware Recovery',
            systemUpdate: 'System Update',
        },
        roles: {
            admin: {
                label: 'Administrator',
                desc: 'Full control over OSCAR Viewer, Users & Access, Federation Tokens, and SensorHub Admin.',
            },
            operator: {
                label: 'Operator',
                desc: 'Monitor lanes, acknowledge alarms, submit adjudications, and generate reports (no admin configuration access).',
            },
            viewer: {
                label: 'Viewer (Read-Only)',
                desc: 'Read-only access to live lanes, historical events, video/waveforms, and reports (cannot adjudicate or modify settings).',
            },
        },
        accountSummaryTitle: 'Signed-In Account Summary',
        staySignedInBadge: 'Stays signed in until you click Log Out',
        timedSessionBadge: (idle, max) => `Auto-expires after ${idle}m idle / ${max}h max`,
        allGatesScope: 'All Facility Lanes',
        scopedGatesLabel: 'Assigned Operational Views',
        passkeysTitle: 'Passkeys & Hardware Security Keys (Offline-Ready)',
        passkeysSubtitle: 'Sign in with Windows Hello, Touch ID, Face ID, or a USB/NFC YubiKey. Passkey verification runs locally on this OSCAR server and works even when internet access is down.',
        addPasskeyBtn: 'Add a Passkey or Security Key',
        passkeyNicknameLabel: 'Optional label (e.g. Control Room Windows Hello or Supervisor YubiKey)',
        passkeyIpWarning: 'Passkeys require opening OSCAR via a domain name (such as https://oscar.local or your tunnel domain) rather than a raw IP address. Password sign-in works on both.',
        passkeyAlreadyExists: 'This device or security key already has a passkey registered for your account.',
        passkeyAddedSuccess: 'Passkey registered. You can now use it to sign in with one tap.',
        noPasskeysYet: 'No passkeys registered yet. You can continue signing in with your password or add a passkey above.',
        colName: 'Name',
        colType: 'Authenticator',
        colCreated: 'Added',
        colLastUsed: 'Last Used',
        colActions: 'Actions',
        syncedBadge: 'Synced',
        deviceBoundBadge: 'Hardware / Device',
        renameBtn: 'Rename',
        removeBtn: 'Remove',
        changePasswordTitle: 'Password (Works in Phone-Free Facilities & Offline)',
        changePasswordDesc: 'Choose a password of at least 14 characters. Changing your OSCAR password keeps this browser signed in, signs out any other OSCAR sessions, and does NOT require changing your Octelium Zero-Trust tunnel password (keeping separate tunnel and OSCAR credentials provides two-layer defense-in-depth).',
        currentPasswordLabel: 'Current password',
        newPasswordLabel: 'New password (14+ characters)',
        confirmPasswordLabel: 'Confirm new password',
        showLabel: 'Show',
        hideLabel: 'Hide',
        updatePasswordBtn: 'Update Password',
        passwordUpdatedSuccess: 'Your password has been updated.',
        passwordMismatchError: 'New password and confirmation do not match.',
        usersHeader: 'Facility User Accounts',
        usersSubheader: 'Create individual accounts for administrators, operators, and read-only auditors without needing IT command-line access.',
        addUserBtn: 'Add User',
        colUsername: 'User',
        colRole: 'Role',
        colGateScope: 'Allowed Gates / Views',
        colStatus: 'Status',
        colSecurity: 'Passkeys / Sessions',
        statusActive: 'Active',
        statusDisabled: 'Disabled',
        statusMustChangePw: 'Must Change Password',
        editUserBtn: 'Edit',
        resetPwBtn: 'Reset Password',
        signOutDevicesBtn: 'Sign Out Sessions',
        deleteBtn: 'Delete',
        tempPasswordTitle: 'One-Time Temporary Password Ready',
        tempPasswordHint: 'Share this temporary password with the user. OSCAR will prompt them to choose their own private password immediately upon first sign-in.',
        copyBtn: 'Copy',
        copiedNotice: 'Copied to clipboard.',
        createUserDialogTitle: 'Add OSCAR User Account',
        editUserDialogTitle: 'Edit User Role & Gate Scope',
        displayNameLabel: 'Full Name / Label',
        gateViewsInputLabel: 'Restrict to Operational Views (comma-separated, leave blank for all lanes)',
        gateViewsHelper: 'Example: east-gate, truck-portal (leave blank to allow all facility lanes)',
        autoGenerateTempPwLabel: 'Generate a readable temporary password automatically (Recommended)',
        initialPasswordLabel: 'Initial password (14+ characters)',
        requirePwChangeOnLoginLabel: 'Require user to choose a new password on first sign-in',
        saveBtn: 'Save',
        cancelBtn: 'Cancel',
        fedHeader: 'Federation Service Tokens',
        fedSubheader: 'Issue revocable, least-privilege tokens so remote headquarters or partner OSCAR nodes can subscribe to this site without sharing human passwords.',
        fedWhereToUseTitle: 'Where to Use a Federation Token (2-Step Multi-Site Setup)',
        fedWhereToUseBody: '1) Create an oscar_fed_... token below on the site being monitored.  2) On the monitoring / HQ OSCAR Viewer, open Servers (/servers) -> Add Server, set Authentication Method to "Federation Service Token", check Use HTTPS (port 443), and paste the token to stream into National View and Multi-Pass Vehicle Search.',
        openServersFedBtn: 'Open Servers Page (Federation Token Mode)',
        fedLabelInput: 'Remote Organization / Node Label (e.g. HQ National Operations Center)',
        fedScopeInput: 'Access Level',
        fedExpiryInput: 'Expiration',
        fedNeverExpires: 'Never (Active Until Revoked)',
        fed90Days: '90 Days',
        fed365Days: '365 Days',
        mintFedTokenBtn: 'Create Federation Token',
        newFedTokenTitle: 'Copy Federation Token Now (Shown Once)',
        newFedTokenHint: 'Paste this token into Servers (/servers) -> Add Server -> Authentication Method: Federation Service Token on the monitoring OSCAR instance.',
        noFedTokens: 'No federation service tokens issued on this node.',
        revokeBtn: 'Revoke',
        policyHeader: 'Session Lifetime, Corporate SSO & Tunnel Policy',
        policySubheader: 'Configure whether operator workstations stay signed in until explicit Log Out, and optionally link corporate OIDC or Octelium tunnel SSO.',
        presetStaySignedInTitle: 'Stay Signed In Until Log Out (Recommended)',
        presetStaySignedInDesc: 'Sets Idle & Maximum Timeouts to 0 and persists encrypted session hashes across browser restarts, server reboots, and upgrades.',
        presetShiftKioskTitle: 'Shared Kiosk Shift Timeout (30m Idle / 8h Max)',
        presetShiftKioskDesc: 'Automatically logs out unattended shared hallway terminals after 30 minutes of inactivity or 8 hours.',
        idleTimeoutLabel: 'Idle timeout in seconds (0 = never expire on idle)',
        maxTimeoutLabel: 'Maximum session lifetime in seconds (0 = stay signed in until Log Out)',
        allowKeepSignedInLabel: 'Allow "Keep me signed in until I log out" persistent cookie',
        oidcSectionTitle: 'Optional Organization Single Sign-On (OpenID Connect / PKCE)',
        oidcSectionDesc: 'Connect Okta, Microsoft Entra ID, Keycloak, or Authentik. Local OSCAR passwords and Passkeys always remain active so operators can sign in locally if the internet goes down.',
        enableOidcLabel: 'Enable Organization OIDC Single Sign-On button on /login',
        oidcProviderLabel: 'Button Provider Name',
        oidcIssuerLabel: 'OIDC Issuer URL (HTTPS)',
        oidcClientIdLabel: 'OIDC Client ID',
        oidcClientSecretLabel: 'OIDC Client Secret (leave blank to keep existing or for public PKCE)',
        oidcAdminGroupLabel: 'IdP Group -> Administrator',
        oidcOperatorGroupLabel: 'IdP Group -> Operator',
        oidcTrustedCaPathLabel: 'OIDC Custom CA Certificate Path (Optional PEM .crt/.pem file or folder)',
        externalConsoleUrlLabel: 'External SSO User Console URL (Optional HTTPS)',
        externalConsoleUrlHelper: 'Optional shortcut button on Users & Roles (e.g. https://auth.hub.example.org/if/admin/). Stores zero Hub admin credentials on this OSCAR server.',
        externalConsoleUrlError: 'Enter a valid https:// URL without embedded credentials (or leave blank).',
        openExternalSsoConsoleBtn: 'Open Federated User Console',
        tunnelSsoTitle: 'Optional Zero Trust Tunnel Single Sign-On (Octelium)',
        tunnelSsoDesc: 'Automatically map verified Octelium tunnel users to local OSCAR sessions without double sign-in when authenticated with a shared secret.',
        enableTunnelSsoLabel: 'Enable Verified Tunnel Header SSO',
        tunnelHeaderLabel: 'Verified User Header',
        tunnelGroupsHeaderLabel: 'Verified Groups Header (Optional Role Mapping)',
        tunnelSecretLabel: 'Tunnel Shared Secret (16+ chars, matched against X-Oscar-Tunnel-Secret)',
        tunnelAutoViewerLabel: 'Auto-provision unknown verified tunnel users as Read-Only Viewer',
        savePolicyBtn: 'Save Security Policy',
        policySavedSuccess: 'Session and SSO security policy saved.',
        recoveryHeader: 'Non-IT Install, Backup & Hardware Replacement Guide',
        recoverySubheader: 'All user accounts, PBKDF2 password hashes, Passkeys, Federation Tokens, and Octelium tunnel settings are backed up and restored together.',
        downloadChecklistBtn: 'Download Emergency Recovery Checklist (.txt)',
        confirmDeletePasskeyTitle: 'Remove Passkey?',
        confirmDeletePasskeyBody: (name) => `Remove "${name}" from your OSCAR account? You will no longer be able to sign in with this passkey.`,
        confirmDeleteUserTitle: 'Delete User Account?',
        confirmDeleteUserBody: (u) => `Permanently delete user "${u}" and sign out all active sessions?`,
        confirmRevokeTokenTitle: 'Revoke Federation Token?',
        confirmRevokeTokenBody: (lbl) => `Immediately revoke federation token "${lbl}"? Connected remote nodes using this token will lose access immediately.`,
    },
    es: {
        pageTitle: 'Usuarios, llaves de acceso y control de acceso',
        pageSubtitle: 'Gestione cuentas de operadores, llaves Passkey/FIDO2 sin conexión, contraseñas para zonas sin teléfonos, tokens de federación y SSO corporativo.',
        tabs: {
            myAccount: 'Mi cuenta y Passkeys',
            users: 'Usuarios y roles',
            federation: 'Tokens de federación',
            policy: 'Política de sesión y SSO',
            recovery: 'Copia y reemplazo de equipo',
            systemUpdate: 'Actualización del sistema',
        },
        roles: {
            admin: {
                label: 'Administrador',
                desc: 'Control total sobre OSCAR Viewer, Usuarios y acceso, Tokens de federación y SensorHub Admin.',
            },
            operator: {
                label: 'Operador',
                desc: 'Supervisa carriles, reconoce alarmas, envía adjudicaciones y genera informes (sin acceso a SensorHub Admin).',
            },
            viewer: {
                label: 'Lector (Solo lectura)',
                desc: 'Acceso de solo lectura a carriles en vivo, eventos, vídeo/curvas e informes (no puede adjudicar ni cambiar ajustes).',
            },
        },
        accountSummaryTitle: 'Resumen de la cuenta conectada',
        staySignedInBadge: 'Permanece conectado hasta pulsar Cerrar sesión',
        timedSessionBadge: (idle, max) => `Caduca tras ${idle}m inactivo / ${max}h máx.`,
        allGatesScope: 'Todos los carriles del sitio',
        scopedGatesLabel: 'Vistas operativas asignadas',
        passkeysTitle: 'Llaves de acceso (Passkeys) y llaves físicas (100 % sin conexión)',
        passkeysSubtitle: 'Inicie sesión con Windows Hello, Touch ID, Face ID o YubiKey USB/NFC. La verificación ocurre localmente en este servidor OSCAR incluso sin internet.',
        addPasskeyBtn: 'Añadir llave de acceso (Passkey) o llave física',
        passkeyNicknameLabel: 'Etiqueta opcional (ej. Windows Hello Sala de Control o YubiKey)',
        passkeyIpWarning: 'Las llaves Passkey requieren abrir OSCAR mediante un nombre de dominio (como https://oscar.local) en lugar de una dirección IP. Las contraseñas funcionan en ambos.',
        passkeyAlreadyExists: 'Este dispositivo o llave de seguridad ya tiene una Passkey registrada para su cuenta.',
        passkeyAddedSuccess: 'Llave de acceso registrada correctamente.',
        noPasskeysYet: 'Aún no hay llaves registradas. Puede iniciar sesión con contraseña o añadir una llave arriba.',
        colName: 'Nombre',
        colType: 'Autenticador',
        colCreated: 'Creada',
        colLastUsed: 'Último uso',
        colActions: 'Acciones',
        syncedBadge: 'Sincronizada',
        deviceBoundBadge: 'Dispositivo / Hardware',
        renameBtn: 'Renombrar',
        removeBtn: 'Eliminar',
        changePasswordTitle: 'Contraseña (Instalaciones sin teléfonos y sin conexión)',
        changePasswordDesc: 'Elija una contraseña de al menos 14 caracteres. Cambiar su contraseña de OSCAR mantiene activa esta sesión, cierra las demás y NO requiere cambiar la contraseña del túnel Octelium Zero-Trust (mantener credenciales separadas ofrece defensa en profundidad).',
        currentPasswordLabel: 'Contraseña actual',
        newPasswordLabel: 'Nueva contraseña (14+ caracteres)',
        confirmPasswordLabel: 'Confirmar nueva contraseña',
        showLabel: 'Mostrar',
        hideLabel: 'Ocultar',
        updatePasswordBtn: 'Actualizar contraseña',
        passwordUpdatedSuccess: 'Contraseña actualizada correctamente.',
        passwordMismatchError: 'La nueva contraseña y la confirmación no coinciden.',
        usersHeader: 'Cuentas de usuarios de la instalación',
        usersSubheader: 'Cree cuentas individuales para administradores, operadores y auditores sin usar línea de comandos.',
        addUserBtn: 'Añadir usuario',
        colUsername: 'Usuario',
        colRole: 'Rol',
        colGateScope: 'Vistas permitidas',
        colStatus: 'Estado',
        colSecurity: 'Passkeys / Sesiones',
        statusActive: 'Activo',
        statusDisabled: 'Deshabilitado',
        statusMustChangePw: 'Cambio de clave pendiente',
        editUserBtn: 'Editar',
        resetPwBtn: 'Restablecer clave',
        signOutDevicesBtn: 'Cerrar sesiones',
        deleteBtn: 'Eliminar',
        tempPasswordTitle: 'Contraseña temporal lista',
        tempPasswordHint: 'Entregue esta clave temporal al usuario. OSCAR le pedirá elegir su propia contraseña al iniciar sesión.',
        copyBtn: 'Copiar',
        copiedNotice: 'Copiado al portapapeles.',
        createUserDialogTitle: 'Añadir cuenta de usuario OSCAR',
        editUserDialogTitle: 'Editar rol y alcance de carril',
        displayNameLabel: 'Nombre completo / Etiqueta',
        gateViewsInputLabel: 'Restringir a Vistas Operativas (separadas por comas; vacío = todos los carriles)',
        gateViewsHelper: 'Ejemplo: east-gate, truck-portal',
        autoGenerateTempPwLabel: 'Generar contraseña temporal legible automáticamente (Recomendado)',
        initialPasswordLabel: 'Contraseña inicial (14+ caracteres)',
        requirePwChangeOnLoginLabel: 'Solicitar cambio de contraseña en el primer acceso',
        saveBtn: 'Guardar',
        cancelBtn: 'Cancelar',
        fedHeader: 'Tokens de servicio de federación',
        fedSubheader: 'Emita tokens revocables de mínimo privilegio para que nodos remotos se conecten sin compartir contraseñas humanas.',
        fedWhereToUseTitle: 'Dónde usar un token de federación (configuración multisitio en 2 pasos)',
        fedWhereToUseBody: '1) Cree un token oscar_fed_... abajo en el sitio monitoreado.  2) En el visor OSCAR de monitoreo / sede central, abra Servidores (/servers) -> Añadir servidor, elija "Token de servicio de federación", active HTTPS (puerto 443) y pegue el token para Vista Nacional y Búsqueda multipasada.',
        openServersFedBtn: 'Abrir Servidores (Modo Token de Federación)',
        fedLabelInput: 'Etiqueta de organización / nodo remoto',
        fedScopeInput: 'Nivel de acceso',
        fedExpiryInput: 'Caducidad',
        fedNeverExpires: 'Sin caducidad (Hasta revocar)',
        fed90Days: '90 días',
        fed365Days: '365 días',
        mintFedTokenBtn: 'Crear token de federación',
        newFedTokenTitle: 'Copie el token ahora (se muestra una sola vez)',
        newFedTokenHint: 'Pegue este token en Servidores (/servers) -> Añadir servidor -> Método de autenticación: Token de servicio de federación.',
        noFedTokens: 'No hay tokens de federación emitidos en este nodo.',
        revokeBtn: 'Revocar',
        policyHeader: 'Duración de sesión, SSO corporativo y túnel',
        policySubheader: 'Configure si las estaciones permanecen conectadas hasta pulsar Cerrar sesión y vincule OIDC u Octelium SSO opcionalmente.',
        presetStaySignedInTitle: 'Mantener sesión hasta Cerrar sesión (Recomendado)',
        presetStaySignedInDesc: 'Fija los tiempos en 0 y conserva sesiones cifradas tras reinicios del navegador, del servidor y actualizaciones.',
        presetShiftKioskTitle: 'Turno de quiosco compartido (30m inactivo / 8h máx.)',
        presetShiftKioskDesc: 'Cierra automáticamente terminales desatendidos tras 30 minutos sin uso u 8 horas.',
        idleTimeoutLabel: 'Tiempo de inactividad en segundos (0 = sin caducidad)',
        maxTimeoutLabel: 'Duración máxima en segundos (0 = hasta Cerrar sesión)',
        allowKeepSignedInLabel: 'Permitir cookie persistente "Mantener la sesión iniciada"',
        oidcSectionTitle: 'Inicio de sesión único corporativo opcional (OpenID Connect / PKCE)',
        oidcSectionDesc: 'Conecte Okta, Entra ID o Keycloak. Las contraseñas y Passkeys locales permanecen siempre activas si cae internet.',
        enableOidcLabel: 'Mostrar botón OIDC SSO en /login',
        oidcProviderLabel: 'Nombre del proveedor SSO',
        oidcIssuerLabel: 'URL del emisor OIDC (HTTPS)',
        oidcClientIdLabel: 'ID de cliente OIDC',
        oidcClientSecretLabel: 'Secreto de cliente OIDC (vacío para conservar actual)',
        oidcAdminGroupLabel: 'Grupo IdP -> Administrador',
        oidcOperatorGroupLabel: 'Grupo IdP -> Operador',
        oidcTrustedCaPathLabel: 'Ruta de certificado CA personalizado OIDC (archivo o carpeta .crt/.pem opcional)',
        externalConsoleUrlLabel: 'URL de consola externa de usuarios SSO (HTTPS opcional)',
        externalConsoleUrlHelper: 'Acceso directo opcional en Usuarios y roles (ej. https://auth.hub.example.org/if/admin/). No almacena claves de administración del Hub.',
        externalConsoleUrlError: 'Introduzca una URL https:// válida sin credenciales incrustadas (o déjela en blanco).',
        openExternalSsoConsoleBtn: 'Abrir consola de usuarios SSO',
        tunnelSsoTitle: 'SSO opcional por túnel Zero Trust (Octelium)',
        tunnelSsoDesc: 'Asocia usuarios verificados del túnel Octelium a sesiones OSCAR sin doble inicio de sesión.',
        enableTunnelSsoLabel: 'Habilitar SSO por cabecera verificada del túnel',
        tunnelHeaderLabel: 'Cabecera de usuario',
        tunnelGroupsHeaderLabel: 'Cabecera de grupos verificados (mapeo de rol opcional)',
        tunnelSecretLabel: 'Secreto compartido del túnel (16+ caracteres)',
        tunnelAutoViewerLabel: 'Crear perfil Lector automáticamente para usuarios del túnel',
        savePolicyBtn: 'Guardar política de seguridad',
        policySavedSuccess: 'Política de sesión y SSO guardada.',
        recoveryHeader: 'Guía sin TI: instalación, copia de seguridad y reemplazo de hardware',
        recoverySubheader: 'Todos los usuarios, contraseñas PBKDF2, Passkeys, tokens de federación y ajustes del túnel Octelium se respaldan y restauran juntos.',
        downloadChecklistBtn: 'Descargar lista de recuperación de emergencia (.txt)',
        confirmDeletePasskeyTitle: '¿Eliminar llave de acceso?',
        confirmDeletePasskeyBody: (name) => `¿Eliminar "${name}" de su cuenta OSCAR?`,
        confirmDeleteUserTitle: '¿Eliminar cuenta de usuario?',
        confirmDeleteUserBody: (u) => `¿Eliminar permanentemente al usuario "${u}" y cerrar sus sesiones activas?`,
        confirmRevokeTokenTitle: '¿Revocar token de federación?',
        confirmRevokeTokenBody: (lbl) => `¿Revocar inmediatamente el token "${lbl}"?`,
    },
    fr: {
        pageTitle: 'Utilisateurs, clés d’accès (Passkeys) et contrôle d’accès',
        pageSubtitle: 'Gérez les comptes opérateurs, les clés Passkey/FIDO2 hors ligne, les mots de passe sans téléphone, les jetons de fédération et le SSO.',
        tabs: {
            myAccount: 'Mon compte et Passkeys',
            users: 'Utilisateurs et rôles',
            federation: 'Jetons de fédération',
            policy: 'Politique de session et SSO',
            recovery: 'Sauvegarde et remplacement matériel',
            systemUpdate: 'Mise à jour système',
        },
        roles: {
            admin: {
                label: 'Administrateur',
                desc: 'Contrôle complet sur OSCAR Viewer, Utilisateurs et accès, Jetons de fédération et SensorHub Admin.',
            },
            operator: {
                label: 'Opérateur',
                desc: 'Surveille les voies, acquitte les alarmes, soumet les adjudications et génère les rapports.',
            },
            viewer: {
                label: 'Lecteur (Lecture seule)',
                desc: 'Accès en lecture seule aux voies en direct, événements, vidéos/courbes et rapports.',
            },
        },
        accountSummaryTitle: 'Résumé du compte connecté',
        staySignedInBadge: 'Reste connecté jusqu’au clic sur Déconnexion',
        timedSessionBadge: (idle, max) => `Expire après ${idle}m d’inactivité / ${max}h max`,
        allGatesScope: 'Toutes les voies du site',
        scopedGatesLabel: 'Vues opérationnelles assignées',
        passkeysTitle: 'Clés d’accès (Passkeys) et clés matérielles (100 % hors ligne)',
        passkeysSubtitle: 'Connectez-vous via Windows Hello, Touch ID, Face ID ou YubiKey USB/NFC. La vérification est locale et fonctionne même sans accès Internet.',
        addPasskeyBtn: 'Ajouter une clé Passkey ou clé matérielle',
        passkeyNicknameLabel: 'Libellé facultatif (ex. Windows Hello Salle de contrôle ou YubiKey)',
        passkeyIpWarning: 'Les clés Passkey exigent d’ouvrir OSCAR via un nom de domaine (comme https://oscar.local) plutôt qu’une adresse IP brute.',
        passkeyAlreadyExists: 'Cet appareil ou cette clé matérielle possède déjà une Passkey enregistrée pour votre compte.',
        passkeyAddedSuccess: 'Clé Passkey enregistrée avec succès.',
        noPasskeysYet: 'Aucune clé Passkey enregistrée. Vous pouvez utiliser votre mot de passe ou ajouter une clé ci-dessus.',
        colName: 'Nom',
        colType: 'Authentificateur',
        colCreated: 'Ajoutée',
        colLastUsed: 'Dernier usage',
        colActions: 'Actions',
        syncedBadge: 'Synchronisée',
        deviceBoundBadge: 'Matériel / Appareil',
        renameBtn: 'Renommer',
        removeBtn: 'Supprimer',
        changePasswordTitle: 'Mot de passe (Sites sans téléphone et hors ligne)',
        changePasswordDesc: 'Choisissez un mot de passe d’au moins 14 caractères. Modifier votre mot de passe OSCAR ne nécessite PAS de changer votre mot de passe de tunnel Zero-Trust Octelium (conserver des identifiants distincts assure une défense en profondeur).',
        currentPasswordLabel: 'Mot de passe actuel',
        newPasswordLabel: 'Nouveau mot de passe (14+ caractères)',
        confirmPasswordLabel: 'Confirmer le nouveau mot de passe',
        showLabel: 'Afficher',
        hideLabel: 'Masquer',
        updatePasswordBtn: 'Mettre à jour le mot de passe',
        passwordUpdatedSuccess: 'Votre mot de passe a été mis à jour.',
        passwordMismatchError: 'Le nouveau mot de passe et la confirmation ne correspondent pas.',
        usersHeader: 'Comptes utilisateurs du site',
        usersSubheader: 'Créez des comptes individuels pour administrateurs, opérateurs et auditeurs sans ligne de commande.',
        addUserBtn: 'Ajouter un utilisateur',
        colUsername: 'Utilisateur',
        colRole: 'Rôle',
        colGateScope: 'Vues autorisées',
        colStatus: 'État',
        colSecurity: 'Passkeys / Sessions',
        statusActive: 'Actif',
        statusDisabled: 'Désactivé',
        statusMustChangePw: 'Changement requis',
        editUserBtn: 'Modifier',
        resetPwBtn: 'Réinitialiser mot de passe',
        signOutDevicesBtn: 'Déconnecter sessions',
        deleteBtn: 'Supprimer',
        tempPasswordTitle: 'Mot de passe temporaire prêt',
        tempPasswordHint: 'Remettez ce mot de passe temporaire à l’utilisateur. OSCAR lui demandera d’en choisir un personnel dès la première connexion.',
        copyBtn: 'Copier',
        copiedNotice: 'Copié dans le presse-papiers.',
        createUserDialogTitle: 'Ajouter un compte utilisateur OSCAR',
        editUserDialogTitle: 'Modifier le rôle et les voies autorisées',
        displayNameLabel: 'Nom complet / Libellé',
        gateViewsInputLabel: 'Restreindre aux Vues Opérationnelles (séparées par virgules, vide = toutes)',
        gateViewsHelper: 'Exemple : east-gate, truck-portal',
        autoGenerateTempPwLabel: 'Générer automatiquement un mot de passe temporaire lisible (Recommandé)',
        initialPasswordLabel: 'Mot de passe initial (14+ caractères)',
        requirePwChangeOnLoginLabel: 'Imposer le changement du mot de passe à la première connexion',
        saveBtn: 'Enregistrer',
        cancelBtn: 'Annuler',
        fedHeader: 'Jetons de service de fédération',
        fedSubheader: 'Créez des jetons révocables à privilège minimal pour connecter des nœuds OSCAR distants sans partager de mot de passe humain.',
        fedWhereToUseTitle: 'Où utiliser un jeton de fédération (configuration multi-sites en 2 étapes)',
        fedWhereToUseBody: '1) Créez un jeton oscar_fed_... ci-dessous sur le site surveillé.  2) Sur la console OSCAR de supervision, ouvrez Serveurs (/servers) -> Ajouter un serveur, sélectionnez « Jeton de service de fédération », cochez HTTPS (port 443) et collez le jeton pour alimenter la Vue Nationale et la Recherche multipassage.',
        openServersFedBtn: 'Ouvrir Serveurs (Mode Jeton de Fédération)',
        fedLabelInput: 'Libellé de l’organisation / du nœud distant',
        fedScopeInput: 'Niveau d’accès',
        fedExpiryInput: 'Expiration',
        fedNeverExpires: 'Aucune (Actif jusqu’à révocation)',
        fed90Days: '90 jours',
        fed365Days: '365 jours',
        mintFedTokenBtn: 'Créer un jeton de fédération',
        newFedTokenTitle: 'Copiez ce jeton maintenant (affiché une seule fois)',
        newFedTokenHint: 'Collez ce jeton dans Serveurs (/servers) -> Ajouter un serveur -> Méthode d’authentification : Jeton de service de fédération.',
        noFedTokens: 'Aucun jeton de fédération actif sur ce nœud.',
        revokeBtn: 'Révoquer',
        policyHeader: 'Durée de session, SSO d’organisation et tunnel',
        policySubheader: 'Définissez le maintien de session jusqu’à Déconnexion et liez facultativement un fournisseur OIDC ou un tunnel Octelium.',
        presetStaySignedInTitle: 'Rester connecté jusqu’à Déconnexion (Recommandé)',
        presetStaySignedInDesc: 'Règle les délais sur 0 et conserve les sessions chiffrées après redémarrage du navigateur, du serveur et mises à niveau.',
        presetShiftKioskTitle: 'Poste partagé (30m inactivité / 8h max)',
        presetShiftKioskDesc: 'Déconnecte automatiquement les terminaux partagés après 30 minutes d’inactivité ou 8 heures.',
        idleTimeoutLabel: 'Délai d’inactivité en secondes (0 = aucune expiration)',
        maxTimeoutLabel: 'Durée maximale en secondes (0 = jusqu’à Déconnexion)',
        allowKeepSignedInLabel: 'Autoriser le cookie persistant « Rester connecté »',
        oidcSectionTitle: 'Authentification unique d’organisation facultative (OpenID Connect / PKCE)',
        oidcSectionDesc: 'Connectez Okta, Entra ID ou Keycloak. Les mots de passe et Passkeys locaux restent toujours actifs en cas de coupure WAN.',
        enableOidcLabel: 'Afficher le bouton SSO OIDC sur /login',
        oidcProviderLabel: 'Nom du fournisseur SSO',
        oidcIssuerLabel: 'URL de l’émetteur OIDC (HTTPS)',
        oidcClientIdLabel: 'ID client OIDC',
        oidcClientSecretLabel: 'Secret client OIDC (vide pour conserver)',
        oidcAdminGroupLabel: 'Groupe IdP -> Administrateur',
        oidcOperatorGroupLabel: 'Groupe IdP -> Opérateur',
        oidcTrustedCaPathLabel: 'Chemin de certificat CA personnalisé OIDC (fichier ou dossier .crt/.pem facultatif)',
        externalConsoleUrlLabel: 'URL de console externe des utilisateurs SSO (HTTPS facultatif)',
        externalConsoleUrlHelper: 'Raccourci facultatif dans Utilisateurs et rôles (ex. https://auth.hub.example.org/if/admin/). Aucun jeton d’administration Hub stocké.',
        externalConsoleUrlError: 'Saisissez une URL https:// valide sans identifiants intégrés (ou laissez vide).',
        openExternalSsoConsoleBtn: 'Ouvrir la console utilisateurs SSO',
        tunnelSsoTitle: 'SSO facultatif par tunnel Zero Trust (Octelium)',
        tunnelSsoDesc: 'Associe automatiquement les utilisateurs vérifiés du tunnel Octelium à une session OSCAR.',
        enableTunnelSsoLabel: 'Activer le SSO par en-tête de tunnel vérifié',
        tunnelHeaderLabel: 'En-tête utilisateur vérifié',
        tunnelGroupsHeaderLabel: 'En-tête de groupes vérifiés (mappage de rôle facultatif)',
        tunnelSecretLabel: 'Secret partagé du tunnel (16+ caractères)',
        tunnelAutoViewerLabel: 'Créer automatiquement un profil Lecteur pour les utilisateurs du tunnel',
        savePolicyBtn: 'Enregistrer la politique de sécurité',
        policySavedSuccess: 'Politique de session et SSO enregistrée.',
        recoveryHeader: 'Guide sans informatique : installation, sauvegarde et remplacement matériel',
        recoverySubheader: 'Tous les comptes, empreintes PBKDF2, clés Passkey, jetons de fédération et paramètres Octelium sont sauvegardés et restaurés ensemble.',
        downloadChecklistBtn: 'Télécharger la fiche de reprise d’urgence (.txt)',
        confirmDeletePasskeyTitle: 'Supprimer la clé Passkey ?',
        confirmDeletePasskeyBody: (name) => `Supprimer « ${name} » de votre compte OSCAR ?`,
        confirmDeleteUserTitle: 'Supprimer le compte utilisateur ?',
        confirmDeleteUserBody: (u) => `Supprimer définitivement l’utilisateur « ${u} » et fermer toutes ses sessions ?`,
        confirmRevokeTokenTitle: 'Révoquer le jeton de fédération ?',
        confirmRevokeTokenBody: (lbl) => `Révoquer immédiatement le jeton « ${lbl} » ?`,
    },
    el: {
        pageTitle: 'Χρήστες, κλειδιά πρόσβασης (Passkeys) & έλεγχος πρόσβασης',
        pageSubtitle: 'Διαχειριστείτε λογαριασμούς χειριστών, κλειδιά Passkey/FIDO2 εκτός σύνδεσης, κωδικούς για χώρους χωρίς κινητά, διακριτικά ομοσπονδίας και εταιρικό SSO.',
        tabs: {
            myAccount: 'Ο λογαριασμός μου & Passkeys',
            users: 'Χρήστες & ρόλοι',
            federation: 'Διακριτικά ομοσπονδίας',
            policy: 'Πολιτική συνεδρίας & SSO',
            recovery: 'Αντίγραφα & αντικατάσταση υλικού',
            systemUpdate: 'Ενημέρωση συστήματος',
        },
        roles: {
            admin: {
                label: 'Διαχειριστής',
                desc: 'Πλήρης έλεγχος στο OSCAR Viewer, Χρήστες & πρόσβαση, Διακριτικά ομοσπονδίας και SensorHub Admin.',
            },
            operator: {
                label: 'Χειριστής',
                desc: 'Παρακολουθεί λωρίδες, αναγνωρίζει συναγερμούς, υποβάλλει αξιολογήσεις και παράγει αναφορές.',
            },
            viewer: {
                label: 'Θεατής (Μόνο ανάγνωση)',
                desc: 'Πρόσβαση μόνο για ανάγνωση σε ζωντανές λωρίδες, συμβάντα, βίντεο/καμπύλες και αναφορές.',
            },
        },
        accountSummaryTitle: 'Σύνοψη συνδεδεμένου λογαριασμού',
        staySignedInBadge: 'Παραμένει σε σύνδεση έως το κλικ στην Αποσύνδεση',
        timedSessionBadge: (idle, max) => `Λήγει μετά από ${idle}λ αδράνειας / ${max}ώ μέγ.`,
        allGatesScope: 'Όλες οι λωρίδες εγκατάστασης',
        scopedGatesLabel: 'Ανατεθειμένες Λειτουργικές Προβολές',
        passkeysTitle: 'Κλειδιά πρόσβασης (Passkeys) & κλειδιά ασφαλείας (100% εκτός σύνδεσης)',
        passkeysSubtitle: 'Συνδεθείτε με Windows Hello, Touch ID, Face ID ή YubiKey USB/NFC. Η επαλήθευση γίνεται τοπικά στον διακομιστή OSCAR ακόμη και χωρίς διαδίκτυο.',
        addPasskeyBtn: 'Προσθήκη Passkey ή κλειδιού ασφαλείας',
        passkeyNicknameLabel: 'Προαιρετική ετικέτα (π.χ. Windows Hello Κέντρου Ελέγχου ή YubiKey)',
        passkeyIpWarning: 'Τα Passkeys απαιτούν άνοιγμα του OSCAR μέσω ονόματος τομέα (π.χ. https://oscar.local) αντί διεύθυνσης IP.',
        passkeyAlreadyExists: 'Αυτή η συσκευή ή το κλειδί ασφαλείας έχει ήδη καταχωρημένο Passkey για τον λογαριασμό σας.',
        passkeyAddedSuccess: 'Το κλειδί πρόσβασης καταχωρήθηκε επιτυχώς.',
        noPasskeysYet: 'Δεν υπάρχουν ακόμη καταχωρημένα Passkeys. Μπορείτε να συνδέεστε με κωδικό ή να προσθέσετε κλειδί παραπάνω.',
        colName: 'Όνομα',
        colType: 'Μέσο επαλήθευσης',
        colCreated: 'Προστέθηκε',
        colLastUsed: 'Τελευταία χρήση',
        colActions: 'Ενέργειες',
        syncedBadge: 'Συγχρονισμένο',
        deviceBoundBadge: 'Συσκευή / Υλικό',
        renameBtn: 'Μετονομασία',
        removeBtn: 'Αφαίρεση',
        changePasswordTitle: 'Κωδικός πρόσβασης (Χώροι χωρίς τηλέφωνα & εκτός σύνδεσης)',
        changePasswordDesc: 'Επιλέξτε κωδικό τουλάχιστον 14 χαρακτήρων. Η αλλαγή του κωδικού OSCAR ΔΕΝ απαιτεί αλλαγή του κωδικού σήραγγας Octelium Zero-Trust (η διατήρηση ξεχωριστών κωδικών προσφέρει άμυνα σε βάθος).',
        currentPasswordLabel: 'Τρέχων κωδικός',
        newPasswordLabel: 'Νέος κωδικός (14+ χαρακτήρες)',
        confirmPasswordLabel: 'Επιβεβαίωση νέου κωδικού',
        showLabel: 'Εμφάνιση',
        hideLabel: 'Απόκρυψη',
        updatePasswordBtn: 'Ενημέρωση κωδικού',
        passwordUpdatedSuccess: 'Ο κωδικός σας ενημερώθηκε.',
        passwordMismatchError: 'Ο νέος κωδικός και η επιβεβαίωση δεν ταιριάζουν.',
        usersHeader: 'Λογαριασμοί χρηστών εγκατάστασης',
        usersSubheader: 'Δημιουργήστε λογαριασμούς για διαχειριστές, χειριστές και ελεγκτές χωρίς γραμμή εντολών.',
        addUserBtn: 'Προσθήκη χρήστη',
        colUsername: 'Χρήστης',
        colRole: 'Ρόλος',
        colGateScope: 'Επιτρεπόμενες προβολές',
        colStatus: 'Κατάσταση',
        colSecurity: 'Passkeys / Συνεδρίες',
        statusActive: 'Ενεργός',
        statusDisabled: 'Ανενεργός',
        statusMustChangePw: 'Απαιτείται αλλαγή κωδικού',
        editUserBtn: 'Επεξεργασία',
        resetPwBtn: 'Επαναφορά κωδικού',
        signOutDevicesBtn: 'Αποσύνδεση συνεδριών',
        deleteBtn: 'Διαγραφή',
        tempPasswordTitle: 'Προσωρινός κωδικός έτοιμος',
        tempPasswordHint: 'Δώστε αυτόν τον προσωρινό κωδικό στον χρήστη. Το OSCAR θα ζητήσει νέο προσωπικό κωδικό κατά την πρώτη σύνδεση.',
        copyBtn: 'Αντιγραφή',
        copiedNotice: 'Αντιγράφηκε στο πρόχειρο.',
        createUserDialogTitle: 'Προσθήκη λογαριασμού χρήστη OSCAR',
        editUserDialogTitle: 'Επεξεργασία ρόλου & επιτρεπόμενων πυλών',
        displayNameLabel: 'Πλήρες όνομα / Ετικέτα',
        gateViewsInputLabel: 'Περιορισμός σε Λειτουργικές Προβολές (με κόμμα, κενό = όλες οι λωρίδες)',
        gateViewsHelper: 'Παράδειγμα: east-gate, truck-portal',
        autoGenerateTempPwLabel: 'Αυτόματη δημιουργία ευανάγνωστου προσωρινού κωδικού (Συνιστάται)',
        initialPasswordLabel: 'Αρχικός κωδικός (14+ χαρακτήρες)',
        requirePwChangeOnLoginLabel: 'Απαίτηση αλλαγής κωδικού στην πρώτη σύνδεση',
        saveBtn: 'Αποθήκευση',
        cancelBtn: 'Ακύρωση',
        fedHeader: 'Διακριτικά υπηρεσίας ομοσπονδίας',
        fedSubheader: 'Εκδώστε ανακλητά διακριτικά ελάχιστων προνομίων ώστε απομακρυσμένοι κόμβοι OSCAR να συνδέονται χωρίς κοινή χρήση κωδικών.',
        fedWhereToUseTitle: 'Πού χρησιμοποιείται ένα διακριτικό ομοσπονδίας (ρύθμιση 2 βημάτων)',
        fedWhereToUseBody: '1) Δημιουργήστε ένα διακριτικό oscar_fed_... παρακάτω στον παρακολουθούμενο κόμβο.  2) Στο OSCAR Viewer εποπτείας, ανοίξτε Διακομιστές (/servers) -> Προσθήκη διακομιστή, επιλέξτε «Διακριτικό υπηρεσίας ομοσπονδίας», ενεργοποιήστε HTTPS (θύρα 443) και επικολλήστε το διακριτικό για Εθνική Προβολή & Αναζήτηση πολλαπλών διελεύσεων.',
        openServersFedBtn: 'Άνοιγμα Διακομιστών (Λειτουργία Διακριτικού Ομοσπονδίας)',
        fedLabelInput: 'Ετικέτα απομακρυσμένου οργανισμού / κόμβου',
        fedScopeInput: 'Επίπεδο πρόσβασης',
        fedExpiryInput: 'Λήξη',
        fedNeverExpires: 'Ποτέ (Ενεργό έως ανάκληση)',
        fed90Days: '90 ημέρες',
        fed365Days: '365 ημέρες',
        mintFedTokenBtn: 'Δημιουργία διακριτικού ομοσπονδίας',
        newFedTokenTitle: 'Αντιγράψτε το διακριτικό τώρα (εμφανίζεται μία φορά)',
        newFedTokenHint: 'Επικολλήστε το στους Διακομιστές (/servers) -> Προσθήκη διακομιστή -> Μέθοδος ταυτοποίησης: Διακριτικό υπηρεσίας ομοσπονδίας.',
        noFedTokens: 'Δεν έχουν εκδοθεί διακριτικά ομοσπονδίας σε αυτόν τον κόμβο.',
        revokeBtn: 'Ανάκληση',
        policyHeader: 'Διάρκεια συνεδρίας, εταιρικό SSO & σήραγγα',
        policySubheader: 'Ρυθμίστε την παραμονή σε σύνδεση έως την Αποσύνδεση και συνδέστε προαιρετικά OIDC ή Octelium SSO.',
        presetStaySignedInTitle: 'Παραμονή σε σύνδεση έως την Αποσύνδεση (Συνιστάται)',
        presetStaySignedInDesc: 'Ορίζει τα όρια σε 0 και διατηρεί τις συνεδρίες μετά από επανεκκινήσεις περιηγητή, διακομιστή και αναβαθμίσεις.',
        presetShiftKioskTitle: 'Κοινόχρηστος σταθμός βάρδιας (30λ αδράνεια / 8ώ μέγ.)',
        presetShiftKioskDesc: 'Αποσυνδέει αυτόματα κοινόχρηστα τερματικά μετά από 30 λεπτά αδράνειας ή 8 ώρες.',
        idleTimeoutLabel: 'Όριο αδράνειας σε δευτερόλεπτα (0 = χωρίς λήξη)',
        maxTimeoutLabel: 'Μέγιστη διάρκεια σε δευτερόλεπτα (0 = έως την Αποσύνδεση)',
        allowKeepSignedInLabel: 'Επιτρέπεται μόνιμο cookie «Διατήρηση σύνδεσης»',
        oidcSectionTitle: 'Προαιρετική εταιρική ενιαία σύνδεση (OpenID Connect / PKCE)',
        oidcSectionDesc: 'Συνδέστε Okta, Entra ID ή Keycloak. Οι τοπικοί κωδικοί και τα Passkeys παραμένουν πάντα ενεργοί αν πέσει το διαδίκτυο.',
        enableOidcLabel: 'Εμφάνιση κουμπιού OIDC SSO στη σελίδα /login',
        oidcProviderLabel: 'Όνομα παρόχου SSO',
        oidcIssuerLabel: 'URL εκδότη OIDC (HTTPS)',
        oidcClientIdLabel: 'ID πελάτη OIDC',
        oidcClientSecretLabel: 'Μυστικό πελάτη OIDC (κενό για διατήρηση)',
        oidcAdminGroupLabel: 'Ομάδα IdP -> Διαχειριστής',
        oidcOperatorGroupLabel: 'Ομάδα IdP -> Χειριστής',
        oidcTrustedCaPathLabel: 'Διαδρομή προσαρμοσμένου πιστοποιητικού CA OIDC (προαιρετικό αρχείο/φάκελος .crt/.pem)',
        externalConsoleUrlLabel: 'URL εξωτερικής κονσόλας χρηστών SSO (προαιρετικό HTTPS)',
        externalConsoleUrlHelper: 'Προαιρετική συντόμευση στους Χρήστες & ρόλους (π.χ. https://auth.hub.example.org/if/admin/). Χωρίς αποθήκευση κλειδιών διαχείρισης Hub.',
        externalConsoleUrlError: 'Εισαγάγετε έγκυρο URL https:// χωρίς ενσωματωμένα διαπιστευτήρια (ή αφήστε κενό).',
        openExternalSsoConsoleBtn: 'Άνοιγμα κονσόλας χρηστών SSO',
        tunnelSsoTitle: 'Προαιρετικό SSO σήραγγας Zero Trust (Octelium)',
        tunnelSsoDesc: 'Αντιστοιχίζει επαληθευμένους χρήστες της σήραγγας Octelium σε συνεδρίες OSCAR.',
        enableTunnelSsoLabel: 'Ενεργοποίηση SSO επαληθευμένης κεφαλίδας σήραγγας',
        tunnelHeaderLabel: 'Κεφαλίδα χρήστη',
        tunnelGroupsHeaderLabel: 'Κεφαλίδα επαληθευμένων ομάδων (προαιρετική αντιστοίχιση ρόλων)',
        tunnelSecretLabel: 'Κοινόχρηστο μυστικό σήραγγας (16+ χαρακτήρες)',
        tunnelAutoViewerLabel: 'Αυτόματη δημιουργία προφίλ Θεατή για χρήστες σήραγγας',
        savePolicyBtn: 'Αποθήκευση πολιτικής ασφαλείας',
        policySavedSuccess: 'Η πολιτική συνεδρίας και SSO αποθηκεύτηκε.',
        recoveryHeader: 'Οδηγός χωρίς ΙΤ: εγκατάσταση, αντίγραφα & αντικατάσταση υλικού',
        recoverySubheader: 'Όλοι οι χρήστες, οι κωδικοί PBKDF2, τα Passkeys, τα διακριτικά ομοσπονδίας και οι ρυθμίσεις Octelium αποθηκεύονται και επαναφέρονται μαζί.',
        downloadChecklistBtn: 'Λήψη λίστας ανάκτησης έκτακτης ανάγκης (.txt)',
        confirmDeletePasskeyTitle: 'Αφαίρεση κλειδιού Passkey;',
        confirmDeletePasskeyBody: (name) => `Να αφαιρεθεί το «${name}» από τον λογαριασμό σας;`,
        confirmDeleteUserTitle: 'Διαγραφή λογαριασμού χρήστη;',
        confirmDeleteUserBody: (u) => `Να διαγραφεί οριστικά ο χρήστης «${u}» και να κλείσουν οι συνεδρίες του;`,
        confirmRevokeTokenTitle: 'Ανάκληση διακριτικού ομοσπονδίας;',
        confirmRevokeTokenBody: (lbl) => `Να ανακληθεί αμέσως το διακριτικό «${lbl}»;`,
    },
};

function formatDateTime(epochMs: number, locale: Locale): string {
    if (!epochMs || epochMs <= 0) return '—';
    try {
        return new Intl.DateTimeFormat(getIntlLocale(locale), {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(new Date(epochMs));
    } catch {
        return new Date(epochMs).toISOString();
    }
}

export default function UsersAccessManager() {
    const { language: locale } = useLanguage();
    const copy = COPY[locale] || COPY.en;
    const bulkCopy = useBulkStrings(locale);
    const dataSourceCtx = React.useContext(DataSourceContext);
    const scopedHref = dataSourceCtx?.scopedHref ?? ((p: string) => p);

    const [activeTab, setActiveTab] = React.useState(0);
    const appliedInitialTabQueryRef = React.useRef(false);
    const [loading, setLoading] = React.useState(true);
    const [banner, setBanner] = React.useState<{ severity: 'success' | 'error' | 'info' | 'warning'; text: string } | null>(null);

    const [session, setSession] = React.useState<OscarSessionInfo | null>(null);
    const [passkeySupported, setPasskeySupported] = React.useState(false);
    const [passkeyData, setPasskeyData] = React.useState<PasskeyListResponse | null>(null);
    const [newPasskeyName, setNewPasskeyName] = React.useState('');
    const [registeringPasskey, setRegisteringPasskey] = React.useState(false);
    const [renameTarget, setRenameTarget] = React.useState<{ id: string; name: string } | null>(null);
    const [deletePasskeyTarget, setDeletePasskeyTarget] = React.useState<PasskeyItem | null>(null);

    // Self-service password state
    const [currentPassword, setCurrentPassword] = React.useState('');
    const [newPassword, setNewPassword] = React.useState('');
    const [confirmPassword, setConfirmPassword] = React.useState('');
    const [showPasswords, setShowPasswords] = React.useState(false);

    // Admin state
    const [overview, setOverview] = React.useState<AdminOverviewResponse | null>(null);
    const [oneTimeTempPassword, setOneTimeTempPassword] = React.useState<{
        username: string;
        password: string;
        card?: EnrolledInviteCard;
    } | null>(null);
    const [oneTimeFedToken, setOneTimeFedToken] = React.useState<{ label: string; token: string } | null>(null);
    const [bulkDialogOpen, setBulkDialogOpen] = React.useState(false);
    const [onboardingPackCards, setOnboardingPackCards] = React.useState<EnrolledInviteCard[]>([]);
    const [inviteBaseOrigin, setInviteBaseOrigin] = React.useState<string>(() =>
        typeof window !== 'undefined' ? window.location.origin : 'https://oscar.local',
    );

    // Create / Edit User Dialog
    const [userDialogOpen, setUserDialogOpen] = React.useState(false);
    const [editingUser, setEditingUser] = React.useState<AdminUserSummary | null>(null);
    const [formUsername, setFormUsername] = React.useState('');
    const [formDisplayName, setFormDisplayName] = React.useState('');
    const [formRole, setFormRole] = React.useState<OscarRoleId>('operator');
    const [formViewsText, setFormViewsText] = React.useState('');
    const [formAutoTempPw, setFormAutoTempPw] = React.useState(true);
    const [formExplicitPw, setFormExplicitPw] = React.useState('');
    const [formMustChangePw, setFormMustChangePw] = React.useState(true);
    const [deleteUserTarget, setDeleteUserTarget] = React.useState<AdminUserSummary | null>(null);

    // Federation token form
    const [fedLabel, setFedLabel] = React.useState('');
    const [fedRole, setFedRole] = React.useState<'viewer' | 'operator'>('viewer');
    const [fedExpiresDays, setFedExpiresDays] = React.useState<number>(0);
    const [revokeTokenTarget, setRevokeTokenTarget] = React.useState<FederationTokenSummary | null>(null);

    // Policy state
    const [policyDraft, setPolicyDraft] = React.useState<SecurityPolicySummary | null>(null);
    const [oidcSecretDraft, setOidcSecretDraft] = React.useState('[UNCHANGED]');
    const [tunnelSecretDraft, setTunnelSecretDraft] = React.useState('[UNCHANGED]');
    const [externalConsoleUrlError, setExternalConsoleUrlError] = React.useState<string | null>(null);

    const loadAll = React.useCallback(async () => {
        setLoading(true);
        try {
            const [sess, pkSupported, pkList] = await Promise.all([
                fetchCurrentSession(),
                isPasskeyRegistrationSupported(),
                fetchMyPasskeys().catch((): null => null),
            ]);
            setSession(sess);
            setPasskeySupported(pkSupported);
            if (pkList) setPasskeyData(pkList);

            if (sess?.isAdmin) {
                const adminData = await fetchAdminOverview();
                setOverview(adminData);
                setPolicyDraft(adminData.policy);
                setOidcSecretDraft(adminData.policy.oidcHasClientSecret ? '[UNCHANGED]' : '');
                setTunnelSecretDraft(adminData.policy.trustedTunnelHasSharedSecret ? '[UNCHANGED]' : '');
            }
        } catch (err: any) {
            setBanner({ severity: 'error', text: err?.message || 'Failed to load account settings.' });
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadAll();
    }, [loadAll]);

    const copyText = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setBanner({ severity: 'success', text: copy.copiedNotice });
        } catch {
            // Fallback selection handled visually
        }
    };

    const handleRegisterPasskey = async () => {
        setBanner(null);
        setRegisteringPasskey(true);
        try {
            const result = await registerNewPasskey(newPasskeyName);
            if (result.status === 'already_exists') {
                setBanner({ severity: 'info', text: copy.passkeyAlreadyExists });
            } else if (result.status === 'registered' && result.list) {
                setPasskeyData(result.list);
                setNewPasskeyName('');
                setBanner({ severity: 'success', text: copy.passkeyAddedSuccess });
                await dataSourceCtx?.refreshSession();
            }
        } catch (err: any) {
            setBanner({ severity: 'error', text: err?.message || 'Passkey registration failed.' });
        } finally {
            setRegisteringPasskey(false);
        }
    };

    const handleConfirmRenamePasskey = async () => {
        if (!renameTarget) return;
        try {
            const updated = await renameMyPasskey(renameTarget.id, renameTarget.name);
            setPasskeyData(updated);
            setRenameTarget(null);
        } catch (err: any) {
            setBanner({ severity: 'error', text: err?.message || 'Rename failed.' });
        }
    };

    const handleConfirmDeletePasskey = async () => {
        if (!deletePasskeyTarget) return;
        try {
            const updated = await deleteMyPasskey(deletePasskeyTarget.id);
            setPasskeyData(updated);
            setDeletePasskeyTarget(null);
            await dataSourceCtx?.refreshSession();
        } catch (err: any) {
            setBanner({ severity: 'error', text: err?.message || 'Delete failed.' });
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBanner(null);
        if (newPassword !== confirmPassword) {
            setBanner({ severity: 'error', text: copy.passwordMismatchError });
            return;
        }
        try {
            await changeOwnPassword(currentPassword, newPassword);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setBanner({ severity: 'success', text: copy.passwordUpdatedSuccess });
        } catch (err: any) {
            setBanner({ severity: 'error', text: err?.message || 'Password update failed.' });
        }
    };

    const openCreateUserDialog = () => {
        setEditingUser(null);
        setFormUsername('');
        setFormDisplayName('');
        setFormRole('operator');
        setFormViewsText('');
        setFormAutoTempPw(true);
        setFormExplicitPw('');
        setFormMustChangePw(true);
        setUserDialogOpen(true);
    };

    const openEditUserDialog = (u: AdminUserSummary) => {
        setEditingUser(u);
        setFormUsername(u.username);
        setFormDisplayName(u.displayName);
        setFormRole(u.role);
        setFormViewsText((u.allowedViews || []).join(', '));
        setUserDialogOpen(true);
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setBanner(null);
        const parsedViews = formViewsText
            .split(/[,\s;]+/)
            .map((v) => v.trim().toLowerCase())
            .filter(Boolean);

        try {
            if (editingUser) {
                const res = await adminUpdateUser(editingUser.username, {
                    displayName: formDisplayName,
                    role: formRole,
                    allowedViews: formRole === 'admin' ? [] : parsedViews,
                });
                if (editingUser.username === session?.username && passkeyData?.rpIdSupported) {
                    void syncClientUserDetails(
                        passkeyData.rpId,
                        passkeyData.passkeyUserId,
                        res.user.username,
                        res.user.displayName,
                    );
                }
            } else {
                const res = await adminCreateUser({
                    username: formUsername.trim(),
                    displayName: formDisplayName.trim() || formUsername.trim(),
                    role: formRole,
                    allowedViews: formRole === 'admin' ? [] : parsedViews,
                    password: formAutoTempPw ? undefined : formExplicitPw,
                    mustChangePassword: formAutoTempPw ? true : formMustChangePw,
                });
                if (res.temporaryPassword) {
                    const card: EnrolledInviteCard | undefined = res.inviteToken
                        ? {
                            user: res.user,
                            createdNew: true,
                            temporaryPassword: res.temporaryPassword,
                            inviteToken: res.inviteToken,
                            inviteExpiresAt: res.inviteExpiresAt || 0,
                        }
                        : undefined;
                    setOneTimeTempPassword({
                        username: res.user.username,
                        password: res.temporaryPassword,
                        card,
                    });
                }
            }
            setUserDialogOpen(false);
            await loadAll();
            await dataSourceCtx?.refreshSession();
        } catch (err: any) {
            setBanner({ severity: 'error', text: err?.message || 'Could not save user.' });
        }
    };

    const handleToggleUserEnabled = async (u: AdminUserSummary) => {
        try {
            await adminUpdateUser(u.username, { enabled: !u.enabled });
            await loadAll();
        } catch (err: any) {
            setBanner({ severity: 'error', text: err?.message || 'Could not update user status.' });
        }
    };

    const handleResetPassword = async (u: AdminUserSummary) => {
        try {
            const res = await adminResetUserPassword(u.username, { mustChangePassword: true });
            if (res.temporaryPassword) {
                const card: EnrolledInviteCard | undefined = res.inviteToken
                    ? {
                        user: res.user,
                        createdNew: false,
                        temporaryPassword: res.temporaryPassword,
                        inviteToken: res.inviteToken,
                        inviteExpiresAt: res.inviteExpiresAt || 0,
                    }
                    : undefined;
                setOneTimeTempPassword({
                    username: u.username,
                    password: res.temporaryPassword,
                    card,
                });
            }
            await loadAll();
        } catch (err: any) {
            setBanner({ severity: 'error', text: err?.message || 'Password reset failed.' });
        }
    };

    const handleIssueQrInvite = async (u: AdminUserSummary) => {
        try {
            const res = await adminIssueUserInvite(u.username, 168);
            // A new invite revokes the user's earlier ones, including the one behind the
            // temporary-password banner's QR button, so point that button at the new invite.
            setOneTimeTempPassword((prev) =>
                prev?.card && prev.username === u.username
                    ? { ...prev, card: { ...prev.card, inviteToken: res.inviteToken, inviteExpiresAt: res.inviteExpiresAt } }
                    : prev,
            );
            setOnboardingPackCards([
                {
                    user: res.user,
                    createdNew: false,
                    inviteToken: res.inviteToken,
                    inviteExpiresAt: res.inviteExpiresAt,
                },
            ]);
        } catch (err: any) {
            setBanner({ severity: 'error', text: err?.message || 'Could not issue QR invite.' });
        }
    };

    const handleRevokeSessions = async (u: AdminUserSummary) => {
        try {
            const res = await adminRevokeUserSessions(u.username);
            setBanner({ severity: 'success', text: `Signed out ${res.revokedSessions} session(s) for ${u.username}.` });
            await loadAll();
        } catch (err: any) {
            setBanner({ severity: 'error', text: err?.message || 'Could not revoke sessions.' });
        }
    };

    const handleConfirmDeleteUser = async () => {
        if (!deleteUserTarget) return;
        try {
            await adminDeleteUser(deleteUserTarget.username);
            setDeleteUserTarget(null);
            await loadAll();
        } catch (err: any) {
            setBanner({ severity: 'error', text: err?.message || 'Delete failed.' });
        }
    };

    const handleCreateFedToken = async (e: React.FormEvent) => {
        e.preventDefault();
        setBanner(null);
        try {
            const created = await adminCreateFederationToken({
                label: fedLabel,
                role: fedRole,
                expiresInDays: fedExpiresDays,
            });
            setOneTimeFedToken({ label: created.record.label, token: created.token });
            setFedLabel('');
            await loadAll();
        } catch (err: any) {
            setBanner({ severity: 'error', text: err?.message || 'Could not create federation token.' });
        }
    };

    const handleConfirmRevokeToken = async () => {
        if (!revokeTokenTarget) return;
        try {
            await adminRevokeFederationToken(revokeTokenTarget.id);
            setRevokeTokenTarget(null);
            await loadAll();
        } catch (err: any) {
            setBanner({ severity: 'error', text: err?.message || 'Could not revoke token.' });
        }
    };

    const handleSavePolicy = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!policyDraft) return;
        const rawConsoleUrl = (policyDraft.externalIdentityConsoleUrl ?? '').trim();
        if (rawConsoleUrl && !normalizeTrustedHttpsConsoleUrl(rawConsoleUrl)) {
            setExternalConsoleUrlError(copy.externalConsoleUrlError);
            setBanner({ severity: 'error', text: copy.externalConsoleUrlError });
            return;
        }
        setExternalConsoleUrlError(null);
        setBanner(null);
        try {
            const saved = await adminUpdateSecurityPolicy({
                ...policyDraft,
                externalIdentityConsoleUrl: rawConsoleUrl ? normalizeTrustedHttpsConsoleUrl(rawConsoleUrl) ?? '' : '',
                oidcClientSecret: oidcSecretDraft,
                trustedTunnelSharedSecret: tunnelSecretDraft,
            });
            setPolicyDraft(saved);
            setOidcSecretDraft(saved.oidcHasClientSecret ? '[UNCHANGED]' : '');
            setTunnelSecretDraft(saved.trustedTunnelHasSharedSecret ? '[UNCHANGED]' : '');
            setBanner({ severity: 'success', text: copy.policySavedSuccess });
            await dataSourceCtx?.refreshSession();
        } catch (err: any) {
            setBanner({ severity: 'error', text: err?.message || 'Could not save policy.' });
        }
    };

    const handleDownloadRecoveryChecklist = () => {
        const hostname = typeof window !== 'undefined' ? window.location.hostname : 'oscar.local';
        const lines = [
            '========================================================================',
            `OSCAR 3.11.11 — NON-IT INSTALL, BACKUP & HARDWARE REPLACEMENT CHECKLIST`,
            `Generated: ${new Date().toISOString()} | Node: ${hostname}`,
            '========================================================================',
            '',
            '1. KEEP THIS SEPARATE FROM THE SERVER:',
            '   - Copy secrets/backup-key.txt to an offline USB drive or supervisor safe.',
            '   - Keep at least two Administrator accounts (or one Passkey + one Password',
            '     saved in your facility safe) so a lost phone/YubiKey never locks you out.',
            '',
            '2. ROUTINE SINGLE-COMMAND BACKUP (INCLUDES ALL USERS, PASSKEYS & TUNNEL):',
            '   - Linux:   sudo bash oscar.sh backup && sudo bash oscar.sh backup-verify',
            '   - Windows: .\\oscar.bat backup   then   .\\oscar.bat backup-verify',
            '   What is inside the encrypted snapshot automatically:',
            '     * PostGIS database + immutable Parquet archive parity receipts',
            '     * All user accounts, roles, gate scopes, Passkeys & Federation Tokens',
            '     * TLS certificates (.env, secrets/, tls/)',
            '     * Octelium Zero Trust remote-access tunnel config & token (remote-access/)',
            '',
            '3. FULL HARDWARE REPLACEMENT (IF SERVER FAILS):',
            '   Step A: Extract oscar-3.11.11.zip on the replacement Ubuntu 24.04 or Windows 11 PC.',
            '   Step B: Attach your backup drive and place secrets/backup-key.txt in place.',
            '   Step C: Run:',
            '           Linux:   sudo bash oscar.sh restore --backup <BACKUP_ID> --confirm <BACKUP_ID>',
            '           Windows: .\\oscar.bat restore -BackupId <BACKUP_ID> -Confirm <BACKUP_ID>',
            '   Result: Every user account, Passkey, active session, lane configuration, historical',
            '           alarm, and Octelium public tunnel reconnects automatically.',
            '',
        ];
        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `oscar-recovery-checklist-${hostname}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const isAdmin = Boolean(session?.isAdmin);

    React.useEffect(() => {
        if (!isAdmin || appliedInitialTabQueryRef.current || typeof window === 'undefined') {
            return;
        }
        const qTab = new URLSearchParams(window.location.search).get('tab')?.toLowerCase();
        if (qTab === 'update' || qTab === 'system-update') {
            appliedInitialTabQueryRef.current = true;
            setActiveTab(5);
        } else if (qTab === 'recovery') {
            appliedInitialTabQueryRef.current = true;
            setActiveTab(4);
        }
    }, [isAdmin]);
    const rpSupported = passkeyData ? passkeyData.rpIdSupported : Boolean(session?.rpIdSupported);
    const validExternalConsoleUrl = normalizeTrustedHttpsConsoleUrl(
        policyDraft?.externalIdentityConsoleUrl ?? overview?.policy?.externalIdentityConsoleUrl,
    );

    return (
        <Stack spacing={2.5} sx={{ maxWidth: 1360, mx: 'auto', width: '100%' }}>
            <Box>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }}>
                    <PlatformIconBadge iconKey="users" size="header" />
                    <Typography variant="h4" fontWeight={700}>
                        {copy.pageTitle}
                    </Typography>
                </Stack>
                <Typography variant="body1" color="text.secondary">
                    {copy.pageSubtitle}
                </Typography>
            </Box>

            {loading && <LinearProgress />}

            {banner && (
                <Alert severity={banner.severity} onClose={() => setBanner(null)}>
                    {banner.text}
                </Alert>
            )}

            <Paper variant="outlined" sx={{ borderRadius: 2 }}>
                <Tabs
                    value={activeTab}
                    onChange={(_e, next) => setActiveTab(next)}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{ borderBottom: 1, borderColor: 'divider', px: 1 }}
                >
                    <Tab icon={<KeyRoundedIcon fontSize="small" />} iconPosition="start" label={copy.tabs.myAccount} />
                    {isAdmin && (
                        <Tab icon={<PersonAddAlt1RoundedIcon fontSize="small" />} iconPosition="start" label={copy.tabs.users} />
                    )}
                    {isAdmin && (
                        <Tab icon={<VpnKeyRoundedIcon fontSize="small" />} iconPosition="start" label={copy.tabs.federation} />
                    )}
                    {isAdmin && (
                        <Tab icon={<ShieldRoundedIcon fontSize="small" />} iconPosition="start" label={copy.tabs.policy} />
                    )}
                    {isAdmin && (
                        <Tab icon={<DownloadRoundedIcon fontSize="small" />} iconPosition="start" label={copy.tabs.recovery} />
                    )}
                    {isAdmin && (
                        <Tab
                            icon={<SystemUpdateAltRoundedIcon fontSize="small" />}
                            iconPosition="start"
                            label={copy.tabs.systemUpdate}
                            data-testid="users-tab-system-update"
                        />
                    )}
                </Tabs>

                <Box sx={{ p: { xs: 2, md: 3 } }}>
                    {/* ========================================================= */}
                    {/* TAB 0: MY ACCOUNT, PASSKEYS & PASSWORD                    */}
                    {/* ========================================================= */}
                    {activeTab === 0 && (
                        <Stack spacing={3}>
                            {session && (
                                <Card variant="outlined">
                                    <CardContent>
                                        <Typography variant="h6" gutterBottom>
                                            {copy.accountSummaryTitle}
                                        </Typography>
                                        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
                                            <Chip label={`${session.displayName} (@${session.username})`} color="primary" />
                                            <Chip
                                                label={copy.roles[session.primaryRole]?.label || session.primaryRole}
                                                variant="outlined"
                                            />
                                            <Chip
                                                color="success"
                                                variant="outlined"
                                                label={
                                                    session.idleTimeoutSeconds === 0 && session.absoluteTimeoutSeconds === 0
                                                        ? copy.staySignedInBadge
                                                        : copy.timedSessionBadge(
                                                            Math.round(session.idleTimeoutSeconds / 60),
                                                            Math.round(session.absoluteTimeoutSeconds / 3600),
                                                        )
                                                }
                                            />
                                            <Chip
                                                variant="outlined"
                                                label={
                                                    session.allowedViews.length === 0
                                                        ? copy.allGatesScope
                                                        : `${copy.scopedGatesLabel}: ${session.allowedViews.join(', ')}`
                                                }
                                            />
                                        </Stack>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Passkey Registration & List */}
                            <Card variant="outlined">
                                <CardContent>
                                    <Stack spacing={2}>
                                        <Box>
                                            <Typography id="my-passkeys-heading" variant="h6">
                                                {copy.passkeysTitle}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {copy.passkeysSubtitle}
                                            </Typography>
                                        </Box>

                                        {!rpSupported && (
                                            <Alert severity="warning">{copy.passkeyIpWarning}</Alert>
                                        )}

                                        {passkeySupported && rpSupported && (
                                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                                                <TextField
                                                    size="small"
                                                    label={copy.passkeyNicknameLabel}
                                                    value={newPasskeyName}
                                                    onChange={(e) => setNewPasskeyName(e.target.value)}
                                                    inputProps={{ maxLength: 64 }}
                                                    sx={{ flex: 1 }}
                                                />
                                                <Button
                                                    variant="contained"
                                                    startIcon={<KeyRoundedIcon />}
                                                    disabled={registeringPasskey}
                                                    onClick={handleRegisterPasskey}
                                                >
                                                    {copy.addPasskeyBtn}
                                                </Button>
                                            </Stack>
                                        )}

                                        {(!passkeyData || passkeyData.passkeys.length === 0) ? (
                                            <Typography variant="body2" color="text.secondary">
                                                {copy.noPasskeysYet}
                                            </Typography>
                                        ) : (
                                            <Box
                                                tabIndex={0}
                                                role="region"
                                                aria-labelledby="my-passkeys-heading"
                                                sx={{ overflowX: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}
                                            >
                                                <Table size="small">
                                                    <TableHead>
                                                        <TableRow>
                                                            <TableCell>{copy.colName}</TableCell>
                                                            <TableCell>{copy.colType}</TableCell>
                                                            <TableCell>{copy.colCreated}</TableCell>
                                                            <TableCell>{copy.colLastUsed}</TableCell>
                                                            <TableCell align="right">{copy.colActions}</TableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {passkeyData.passkeys.map((pk) => (
                                                            <TableRow key={pk.id}>
                                                                <TableCell sx={{ fontWeight: 600 }}>{pk.name}</TableCell>
                                                                <TableCell>
                                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                                        <span>{pk.authenticatorLabel}</span>
                                                                        <Chip
                                                                            size="small"
                                                                            variant="outlined"
                                                                            label={pk.backupState ? copy.syncedBadge : copy.deviceBoundBadge}
                                                                        />
                                                                    </Stack>
                                                                </TableCell>
                                                                <TableCell>{formatDateTime(pk.createdAt, locale)}</TableCell>
                                                                <TableCell>{formatDateTime(pk.lastUsedAt, locale)}</TableCell>
                                                                <TableCell align="right">
                                                                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                                        <Button
                                                                            size="small"
                                                                            startIcon={<EditRoundedIcon fontSize="small" />}
                                                                            onClick={() => setRenameTarget({ id: pk.id, name: pk.name })}
                                                                        >
                                                                            {copy.renameBtn}
                                                                        </Button>
                                                                        <Button
                                                                            size="small"
                                                                            color="error"
                                                                            startIcon={<DeleteOutlineRoundedIcon fontSize="small" />}
                                                                            onClick={() => setDeletePasskeyTarget(pk)}
                                                                        >
                                                                            {copy.removeBtn}
                                                                        </Button>
                                                                    </Stack>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </Box>
                                        )}
                                    </Stack>
                                </CardContent>
                            </Card>

                            {/* Self-Service Password Change */}
                            <Card variant="outlined">
                                <CardContent>
                                    <Box component="form" onSubmit={handlePasswordSubmit}>
                                        <Stack spacing={2} sx={{ maxWidth: 540 }}>
                                            <Box>
                                                <Typography variant="h6">{copy.changePasswordTitle}</Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {copy.changePasswordDesc}
                                                </Typography>
                                            </Box>
                                            <TextField
                                                required
                                                type={showPasswords ? 'text' : 'password'}
                                                label={copy.currentPasswordLabel}
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                autoComplete="current-password"
                                                inputProps={{ spellCheck: false, autoCorrect: 'off', autoCapitalize: 'none' }}
                                            />
                                            <TextField
                                                required
                                                type={showPasswords ? 'text' : 'password'}
                                                label={copy.newPasswordLabel}
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                autoComplete="new-password"
                                                inputProps={{ minLength: 14, maxLength: 512, spellCheck: false, autoCorrect: 'off', autoCapitalize: 'none' }}
                                            />
                                            <TextField
                                                required
                                                type={showPasswords ? 'text' : 'password'}
                                                label={copy.confirmPasswordLabel}
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                autoComplete="new-password"
                                                inputProps={{ minLength: 14, maxLength: 512, spellCheck: false, autoCorrect: 'off', autoCapitalize: 'none' }}
                                            />
                                            <Stack direction="row" spacing={1.5}>
                                                <Button type="submit" variant="contained">
                                                    {copy.updatePasswordBtn}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outlined"
                                                    aria-pressed={showPasswords}
                                                    onClick={() => setShowPasswords((prev) => !prev)}
                                                >
                                                    {showPasswords ? copy.hideLabel : copy.showLabel}
                                                </Button>
                                            </Stack>
                                        </Stack>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Stack>
                    )}

                    {/* ========================================================= */}
                    {/* TAB 1: ADMIN USERS & ROLES                                */}
                    {/* ========================================================= */}
                    {isAdmin && activeTab === 1 && overview && (
                        <Stack spacing={2.5}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5}>
                                <Box>
                                    <Typography id="users-table-heading" variant="h6">
                                        {copy.usersHeader}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {copy.usersSubheader}
                                    </Typography>
                                </Box>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                    {validExternalConsoleUrl && (
                                        <Button
                                            component="a"
                                            href={validExternalConsoleUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            variant="outlined"
                                            endIcon={<OpenInNewRoundedIcon fontSize="small" aria-hidden="true" />}
                                            data-testid="open-external-sso-console-btn"
                                        >
                                            {copy.openExternalSsoConsoleBtn}
                                        </Button>
                                    )}
                                    <Button
                                        variant="outlined"
                                        startIcon={<GroupAddRoundedIcon />}
                                        onClick={() => setBulkDialogOpen(true)}
                                        data-testid="bulk-enroll-button"
                                    >
                                        {bulkCopy.bulkBtn}
                                    </Button>
                                    <Button
                                        variant="contained"
                                        startIcon={<PersonAddAlt1RoundedIcon />}
                                        onClick={openCreateUserDialog}
                                        data-testid="add-user-button"
                                    >
                                        {copy.addUserBtn}
                                    </Button>
                                </Stack>
                            </Stack>

                            {oneTimeTempPassword && (
                                <Alert
                                    severity="warning"
                                    onClose={() => setOneTimeTempPassword(null)}
                                    action={
                                        <Stack direction="row" spacing={1}>
                                            {oneTimeTempPassword.card && (
                                                <Button
                                                    color="inherit"
                                                    size="small"
                                                    startIcon={<QrCode2RoundedIcon fontSize="small" />}
                                                    onClick={() => setOnboardingPackCards([oneTimeTempPassword.card!])}
                                                    data-testid="open-single-invite-qr-btn"
                                                >
                                                    {bulkCopy.qrInviteBtn}
                                                </Button>
                                            )}
                                            <Button
                                                color="inherit"
                                                size="small"
                                                startIcon={<ContentCopyRoundedIcon fontSize="small" />}
                                                onClick={() => copyText(oneTimeTempPassword.password)}
                                            >
                                                {copy.copyBtn}
                                            </Button>
                                        </Stack>
                                    }
                                >
                                    <Typography variant="subtitle2" fontWeight={700}>
                                        {copy.tempPasswordTitle} ({oneTimeTempPassword.username}):{' '}
                                        <Box component="code" sx={{ fontSize: '1rem', px: 1, py: 0.25, bgcolor: 'action.hover', borderRadius: 1 }}>
                                            {oneTimeTempPassword.password}
                                        </Box>
                                    </Typography>
                                    <Typography variant="body2">{copy.tempPasswordHint}</Typography>
                                </Alert>
                            )}

                            <Box
                                tabIndex={0}
                                role="region"
                                aria-labelledby="users-table-heading"
                                sx={{ overflowX: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}
                            >
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>{copy.colUsername}</TableCell>
                                            <TableCell>{copy.colRole}</TableCell>
                                            <TableCell>{copy.colGateScope}</TableCell>
                                            <TableCell>{copy.colStatus}</TableCell>
                                            <TableCell>{copy.colSecurity}</TableCell>
                                            <TableCell>{copy.colLastUsed}</TableCell>
                                            <TableCell align="right">{copy.colActions}</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {overview.users.map((u) => (
                                            <TableRow key={u.username} hover>
                                                <TableCell>
                                                    <Typography variant="body2" fontWeight={600}>
                                                        {u.displayName}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        @{u.username}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        size="small"
                                                        color={u.role === 'admin' ? 'primary' : u.role === 'operator' ? 'info' : 'default'}
                                                        label={copy.roles[u.role]?.label || u.role}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {u.allowedViews.length === 0 ? (
                                                        <Typography variant="body2" color="text.secondary">
                                                            {copy.allGatesScope}
                                                        </Typography>
                                                    ) : (
                                                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                                            {u.allowedViews.map((v) => (
                                                                <Chip key={v} size="small" variant="outlined" label={v} />
                                                            ))}
                                                        </Stack>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                                                        <Switch
                                                            size="small"
                                                            checked={u.enabled}
                                                            disabled={u.username === session?.username}
                                                            inputProps={{ 'aria-label': `${u.username} ${copy.statusActive}` }}
                                                            onChange={() => handleToggleUserEnabled(u)}
                                                        />
                                                        <Chip
                                                            size="small"
                                                            color={u.enabled ? 'success' : 'default'}
                                                            variant="outlined"
                                                            label={u.enabled ? copy.statusActive : copy.statusDisabled}
                                                        />
                                                        {u.mustChangePassword && (
                                                            <Chip size="small" color="warning" label={copy.statusMustChangePw} />
                                                        )}
                                                    </Stack>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2">
                                                        {u.passkeyCount} Passkey(s) · {u.activeSessions} Session(s)
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>{formatDateTime(u.lastLoginAt, locale)}</TableCell>
                                                <TableCell align="right">
                                                    <Stack direction="row" spacing={0.75} justifyContent="flex-end">
                                                        {u.enabled && (
                                                            <Button
                                                                size="small"
                                                                startIcon={<QrCode2RoundedIcon fontSize="small" />}
                                                                onClick={() => handleIssueQrInvite(u)}
                                                                data-testid={`issue-qr-invite-${u.username}`}
                                                            >
                                                                {bulkCopy.qrInviteBtn}
                                                            </Button>
                                                        )}
                                                        <Button
                                                            size="small"
                                                            startIcon={<EditRoundedIcon fontSize="small" />}
                                                            onClick={() => openEditUserDialog(u)}
                                                        >
                                                            {copy.editUserBtn}
                                                        </Button>
                                                        <Button
                                                            size="small"
                                                            startIcon={<LockResetRoundedIcon fontSize="small" />}
                                                            onClick={() => handleResetPassword(u)}
                                                        >
                                                            {copy.resetPwBtn}
                                                        </Button>
                                                        {u.activeSessions > 0 && (
                                                            <Button
                                                                size="small"
                                                                startIcon={<LogoutRoundedIcon fontSize="small" />}
                                                                onClick={() => handleRevokeSessions(u)}
                                                            >
                                                                {copy.signOutDevicesBtn}
                                                            </Button>
                                                        )}
                                                        {u.username !== session?.username && (
                                                            <Button
                                                                size="small"
                                                                color="error"
                                                                startIcon={<DeleteOutlineRoundedIcon fontSize="small" />}
                                                                onClick={() => setDeleteUserTarget(u)}
                                                            >
                                                                {copy.deleteBtn}
                                                            </Button>
                                                        )}
                                                    </Stack>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Box>
                        </Stack>
                    )}

                    {/* ========================================================= */}
                    {/* TAB 2: FEDERATION SERVICE TOKENS                          */}
                    {/* ========================================================= */}
                    {isAdmin && activeTab === 2 && overview && (
                        <Stack spacing={3}>
                            <Box>
                                <Typography id="fed-tokens-heading" variant="h6">
                                    {copy.fedHeader}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {copy.fedSubheader}
                                </Typography>
                            </Box>

                            <Alert
                                severity="info"
                                data-testid="fed-token-how-to-use-card"
                                action={
                                    <Button
                                        component={Link}
                                        href={scopedHref('/servers?auth=bearer')}
                                        color="inherit"
                                        size="small"
                                        variant="outlined"
                                        startIcon={<CloudRoundedIcon fontSize="small" />}
                                        data-testid="open-servers-federation-btn"
                                        sx={{ whiteSpace: 'nowrap' }}
                                    >
                                        {copy.openServersFedBtn}
                                    </Button>
                                }
                            >
                                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                                    {copy.fedWhereToUseTitle}
                                </Typography>
                                <Typography variant="body2">
                                    {copy.fedWhereToUseBody}
                                </Typography>
                            </Alert>

                            <Card variant="outlined">
                                <CardContent>
                                    <Box component="form" onSubmit={handleCreateFedToken}>
                                        <Grid container spacing={2} alignItems="center">
                                            <Grid item xs={12} md={5}>
                                                <TextField
                                                    required
                                                    fullWidth
                                                    size="small"
                                                    label={copy.fedLabelInput}
                                                    value={fedLabel}
                                                    onChange={(e) => setFedLabel(e.target.value)}
                                                    inputProps={{ maxLength: 80 }}
                                                />
                                            </Grid>
                                            <Grid item xs={12} sm={6} md={3}>
                                                <FormControl fullWidth size="small">
                                                    <InputLabel id="fed-role-label">{copy.fedScopeInput}</InputLabel>
                                                    <Select
                                                        labelId="fed-role-label"
                                                        label={copy.fedScopeInput}
                                                        value={fedRole}
                                                        onChange={(e) => setFedRole(e.target.value as 'viewer' | 'operator')}
                                                    >
                                                        <MenuItem value="viewer">{copy.roles.viewer.label}</MenuItem>
                                                        <MenuItem value="operator">{copy.roles.operator.label}</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Grid>
                                            <Grid item xs={12} sm={6} md={2}>
                                                <FormControl fullWidth size="small">
                                                    <InputLabel id="fed-exp-label">{copy.fedExpiryInput}</InputLabel>
                                                    <Select
                                                        labelId="fed-exp-label"
                                                        label={copy.fedExpiryInput}
                                                        value={fedExpiresDays}
                                                        onChange={(e) => setFedExpiresDays(Number(e.target.value))}
                                                    >
                                                        <MenuItem value={0}>{copy.fedNeverExpires}</MenuItem>
                                                        <MenuItem value={90}>{copy.fed90Days}</MenuItem>
                                                        <MenuItem value={365}>{copy.fed365Days}</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Grid>
                                            <Grid item xs={12} md={2}>
                                                <Button type="submit" variant="contained" fullWidth>
                                                    {copy.mintFedTokenBtn}
                                                </Button>
                                            </Grid>
                                        </Grid>
                                    </Box>
                                </CardContent>
                            </Card>

                            {oneTimeFedToken && (
                                <Alert
                                    severity="success"
                                    onClose={() => setOneTimeFedToken(null)}
                                    action={
                                        <Button
                                            color="inherit"
                                            size="small"
                                            startIcon={<ContentCopyRoundedIcon fontSize="small" />}
                                            onClick={() => copyText(oneTimeFedToken.token)}
                                        >
                                            {copy.copyBtn}
                                        </Button>
                                    }
                                >
                                    <Typography variant="subtitle2" fontWeight={700}>
                                        {copy.newFedTokenTitle} ({oneTimeFedToken.label})
                                    </Typography>
                                    <Box component="code" sx={{ display: 'block', my: 0.75, p: 1, bgcolor: 'action.hover', borderRadius: 1, wordBreak: 'break-all' }}>
                                        {oneTimeFedToken.token}
                                    </Box>
                                    <Typography variant="body2">{copy.newFedTokenHint}</Typography>
                                    <Box sx={{ mt: 1 }}>
                                        <Button
                                            component={Link}
                                            href={scopedHref('/servers?auth=bearer')}
                                            size="small"
                                            variant="outlined"
                                            color="inherit"
                                            startIcon={<CloudRoundedIcon fontSize="small" />}
                                            data-testid="new-fed-token-open-servers-btn"
                                        >
                                            {copy.openServersFedBtn}
                                        </Button>
                                    </Box>
                                </Alert>
                            )}

                            {overview.federationTokens.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">
                                    {copy.noFedTokens}
                                </Typography>
                            ) : (
                                <Box
                                    tabIndex={0}
                                    role="region"
                                    aria-labelledby="fed-tokens-heading"
                                    sx={{ overflowX: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}
                                >
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>{copy.colName}</TableCell>
                                                <TableCell>{copy.colRole}</TableCell>
                                                <TableCell>Token ID</TableCell>
                                                <TableCell>{copy.colCreated}</TableCell>
                                                <TableCell>{copy.colLastUsed}</TableCell>
                                                <TableCell align="right">{copy.colActions}</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {overview.federationTokens.map((tok) => (
                                                <TableRow key={tok.id}>
                                                    <TableCell sx={{ fontWeight: 600 }}>{tok.label}</TableCell>
                                                    <TableCell>
                                                        <Chip size="small" variant="outlined" label={copy.roles[tok.role]?.label || tok.role} />
                                                    </TableCell>
                                                    <TableCell><code>{tok.tokenPrefix}</code></TableCell>
                                                    <TableCell>{formatDateTime(tok.createdAt, locale)}</TableCell>
                                                    <TableCell>{formatDateTime(tok.lastUsedAt, locale)}</TableCell>
                                                    <TableCell align="right">
                                                        <Button
                                                            size="small"
                                                            color="error"
                                                            onClick={() => setRevokeTokenTarget(tok)}
                                                        >
                                                            {copy.revokeBtn}
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </Box>
                            )}
                        </Stack>
                    )}

                    {/* ========================================================= */}
                    {/* TAB 3: SESSION LIFETIME, CORPORATE OIDC & TUNNEL SSO      */}
                    {/* ========================================================= */}
                    {isAdmin && activeTab === 3 && policyDraft && (
                        <Box component="form" onSubmit={handleSavePolicy}>
                            <Stack spacing={3}>
                                <Box>
                                    <Typography variant="h6">{copy.policyHeader}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {copy.policySubheader}
                                    </Typography>
                                </Box>

                                <Grid container spacing={2}>
                                    <Grid item xs={12} md={6}>
                                        <Card
                                            variant="outlined"
                                            sx={{
                                                borderColor:
                                                    policyDraft.idleTimeoutSeconds === 0 && policyDraft.absoluteTimeoutSeconds === 0
                                                        ? 'primary.main'
                                                        : 'divider',
                                                borderWidth:
                                                    policyDraft.idleTimeoutSeconds === 0 && policyDraft.absoluteTimeoutSeconds === 0 ? 2 : 1,
                                            }}
                                        >
                                            <CardContent>
                                                <Stack spacing={1}>
                                                    <Typography variant="subtitle1" fontWeight={700}>
                                                        {copy.presetStaySignedInTitle}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {copy.presetStaySignedInDesc}
                                                    </Typography>
                                                    <Box>
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            onClick={() =>
                                                                setPolicyDraft({
                                                                    ...policyDraft,
                                                                    idleTimeoutSeconds: 0,
                                                                    absoluteTimeoutSeconds: 0,
                                                                    allowKeepSignedIn: true,
                                                                })
                                                            }
                                                        >
                                                            Apply Preset
                                                        </Button>
                                                    </Box>
                                                </Stack>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <Card
                                            variant="outlined"
                                            sx={{
                                                borderColor:
                                                    policyDraft.idleTimeoutSeconds === 1800 && policyDraft.absoluteTimeoutSeconds === 28800
                                                        ? 'primary.main'
                                                        : 'divider',
                                                borderWidth:
                                                    policyDraft.idleTimeoutSeconds === 1800 && policyDraft.absoluteTimeoutSeconds === 28800 ? 2 : 1,
                                            }}
                                        >
                                            <CardContent>
                                                <Stack spacing={1}>
                                                    <Typography variant="subtitle1" fontWeight={700}>
                                                        {copy.presetShiftKioskTitle}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {copy.presetShiftKioskDesc}
                                                    </Typography>
                                                    <Box>
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            onClick={() =>
                                                                setPolicyDraft({
                                                                    ...policyDraft,
                                                                    idleTimeoutSeconds: 1800,
                                                                    absoluteTimeoutSeconds: 28800,
                                                                })
                                                            }
                                                        >
                                                            Apply Preset
                                                        </Button>
                                                    </Box>
                                                </Stack>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                </Grid>

                                <Grid container spacing={2}>
                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            fullWidth
                                            type="number"
                                            size="small"
                                            label={copy.idleTimeoutLabel}
                                            value={policyDraft.idleTimeoutSeconds}
                                            onChange={(e) =>
                                                setPolicyDraft({ ...policyDraft, idleTimeoutSeconds: Math.max(0, Number(e.target.value) || 0) })
                                            }
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            fullWidth
                                            type="number"
                                            size="small"
                                            label={copy.maxTimeoutLabel}
                                            value={policyDraft.absoluteTimeoutSeconds}
                                            onChange={(e) =>
                                                setPolicyDraft({ ...policyDraft, absoluteTimeoutSeconds: Math.max(0, Number(e.target.value) || 0) })
                                            }
                                        />
                                    </Grid>
                                    <Grid item xs={12}>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={policyDraft.allowKeepSignedIn}
                                                    onChange={(_e, checked) => setPolicyDraft({ ...policyDraft, allowKeepSignedIn: checked })}
                                                />
                                            }
                                            label={copy.allowKeepSignedInLabel}
                                        />
                                    </Grid>
                                </Grid>

                                <Divider />

                                {/* Corporate OIDC SSO */}
                                <Stack spacing={2}>
                                    <Box>
                                        <Typography variant="h6">{copy.oidcSectionTitle}</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {copy.oidcSectionDesc}
                                        </Typography>
                                    </Box>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={policyDraft.oidcEnabled}
                                                onChange={(_e, checked) => setPolicyDraft({ ...policyDraft, oidcEnabled: checked })}
                                            />
                                        }
                                        label={copy.enableOidcLabel}
                                    />
                                    {policyDraft.oidcEnabled && (
                                        <Grid container spacing={2}>
                                            <Grid item xs={12} sm={6}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label={copy.oidcProviderLabel}
                                                    value={policyDraft.oidcProviderName}
                                                    onChange={(e) => setPolicyDraft({ ...policyDraft, oidcProviderName: e.target.value })}
                                                />
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label={copy.oidcIssuerLabel}
                                                    placeholder="https://idp.example.org/realms/facility"
                                                    value={policyDraft.oidcIssuerUrl}
                                                    onChange={(e) => setPolicyDraft({ ...policyDraft, oidcIssuerUrl: e.target.value })}
                                                />
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label={copy.oidcClientIdLabel}
                                                    value={policyDraft.oidcClientId}
                                                    onChange={(e) => setPolicyDraft({ ...policyDraft, oidcClientId: e.target.value })}
                                                />
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    type="password"
                                                    label={copy.oidcClientSecretLabel}
                                                    value={oidcSecretDraft}
                                                    onChange={(e) => setOidcSecretDraft(e.target.value)}
                                                />
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label={copy.oidcAdminGroupLabel}
                                                    value={policyDraft.oidcAdminGroup}
                                                    onChange={(e) => setPolicyDraft({ ...policyDraft, oidcAdminGroup: e.target.value })}
                                                />
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label={copy.oidcOperatorGroupLabel}
                                                    value={policyDraft.oidcOperatorGroup}
                                                    onChange={(e) => setPolicyDraft({ ...policyDraft, oidcOperatorGroup: e.target.value })}
                                                    inputProps={{ spellCheck: false, autoCorrect: 'off', autoCapitalize: 'none' }}
                                                />
                                            </Grid>
                                            <Grid item xs={12}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label={copy.oidcTrustedCaPathLabel}
                                                    placeholder="/opt/oscar/trusted_certificates"
                                                    value={policyDraft.oidcTrustedCaCertificatePath ?? ''}
                                                    onChange={(e) =>
                                                        setPolicyDraft({ ...policyDraft, oidcTrustedCaCertificatePath: e.target.value })
                                                    }
                                                    inputProps={{
                                                        spellCheck: false,
                                                        autoCorrect: 'off',
                                                        autoCapitalize: 'none',
                                                        'data-testid': 'oidc-trusted-ca-path-input',
                                                    }}
                                                />
                                            </Grid>
                                        </Grid>
                                    )}
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label={copy.externalConsoleUrlLabel}
                                        placeholder="https://auth.hub.example.org/if/admin/"
                                        value={policyDraft.externalIdentityConsoleUrl ?? ''}
                                        error={Boolean(externalConsoleUrlError)}
                                        helperText={externalConsoleUrlError || copy.externalConsoleUrlHelper}
                                        onChange={(e) => {
                                            if (externalConsoleUrlError) {
                                                setExternalConsoleUrlError(null);
                                            }
                                            setPolicyDraft({ ...policyDraft, externalIdentityConsoleUrl: e.target.value });
                                        }}
                                        onBlur={() => {
                                            const raw = (policyDraft.externalIdentityConsoleUrl ?? '').trim();
                                            if (raw && !normalizeTrustedHttpsConsoleUrl(raw)) {
                                                setExternalConsoleUrlError(copy.externalConsoleUrlError);
                                            }
                                        }}
                                        inputProps={{
                                            spellCheck: false,
                                            autoCorrect: 'off',
                                            autoCapitalize: 'none',
                                            'data-testid': 'external-sso-console-url-input',
                                        }}
                                    />
                                </Stack>

                                <Divider />

                                {/* Trusted Tunnel SSO */}
                                <Stack spacing={2}>
                                    <Box>
                                        <Typography variant="h6">{copy.tunnelSsoTitle}</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {copy.tunnelSsoDesc}
                                        </Typography>
                                    </Box>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={policyDraft.trustedTunnelSsoEnabled}
                                                onChange={(_e, checked) => setPolicyDraft({ ...policyDraft, trustedTunnelSsoEnabled: checked })}
                                            />
                                        }
                                        label={copy.enableTunnelSsoLabel}
                                    />
                                    {policyDraft.trustedTunnelSsoEnabled && (
                                        <Grid container spacing={2}>
                                            <Grid item xs={12} sm={4}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label={copy.tunnelHeaderLabel}
                                                    value={policyDraft.trustedTunnelUserHeader}
                                                    onChange={(e) => setPolicyDraft({ ...policyDraft, trustedTunnelUserHeader: e.target.value })}
                                                    inputProps={{ spellCheck: false, autoCorrect: 'off', autoCapitalize: 'none' }}
                                                />
                                            </Grid>
                                            <Grid item xs={12} sm={4}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label={copy.tunnelGroupsHeaderLabel}
                                                    value={policyDraft.trustedTunnelGroupsHeader ?? 'X-Octelium-Groups'}
                                                    onChange={(e) => setPolicyDraft({ ...policyDraft, trustedTunnelGroupsHeader: e.target.value })}
                                                    inputProps={{
                                                        spellCheck: false,
                                                        autoCorrect: 'off',
                                                        autoCapitalize: 'none',
                                                        'data-testid': 'tunnel-groups-header-input',
                                                    }}
                                                />
                                            </Grid>
                                            <Grid item xs={12} sm={4}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    type="password"
                                                    label={copy.tunnelSecretLabel}
                                                    value={tunnelSecretDraft}
                                                    onChange={(e) => setTunnelSecretDraft(e.target.value)}
                                                />
                                            </Grid>
                                            <Grid item xs={12}>
                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            checked={policyDraft.trustedTunnelAutoProvisionViewer}
                                                            onChange={(_e, checked) =>
                                                                setPolicyDraft({ ...policyDraft, trustedTunnelAutoProvisionViewer: checked })
                                                            }
                                                        />
                                                    }
                                                    label={copy.tunnelAutoViewerLabel}
                                                />
                                            </Grid>
                                        </Grid>
                                    )}
                                </Stack>

                                <Box>
                                    <Button type="submit" variant="contained">
                                        {copy.savePolicyBtn}
                                    </Button>
                                </Box>
                            </Stack>
                        </Box>
                    )}

                    {/* ========================================================= */}
                    {/* TAB 4: BACKUP & HARDWARE REPLACEMENT RECOVERY             */}
                    {/* ========================================================= */}
                    {isAdmin && activeTab === 4 && overview && (
                        <Stack spacing={2.5}>
                            <Box>
                                <Typography variant="h6">{copy.recoveryHeader}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {copy.recoverySubheader}
                                </Typography>
                            </Box>

                            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                                <Chip
                                    color={overview.recovery.identityStorePersisted ? 'success' : 'warning'}
                                    label="Persistent Sessions & Passkeys (.moduledata/oscar-identity.json)"
                                />
                                <Chip
                                    color="success"
                                    variant="outlined"
                                    label={`Backup Coverage: ${overview.recovery.includedInBackupArchive}`}
                                />
                            </Stack>

                            <Grid container spacing={2}>
                                <Grid item xs={12} md={4}>
                                    <Card variant="outlined" sx={{ height: '100%' }}>
                                        <CardContent>
                                            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                                                1. Out-of-the-Box Install
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Run <code>oscar init</code> once. Your initial Administrator password is PBKDF2-hashed into OSCAR state and scrubbed from plaintext disk automatically. Add operators, Passkeys, or temporary passwords right here in Users &amp; Access.
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <Card variant="outlined" sx={{ height: '100%' }}>
                                        <CardContent>
                                            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                                                2. One-Command Encrypted Backup
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Run <code>oscar backup</code>. Every user account, role, gate assignment, Passkey public key, Federation Token, TLS certificate, and Octelium tunnel credential is encrypted and checksum-verified together.
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <Card variant="outlined" sx={{ height: '100%' }}>
                                        <CardContent>
                                            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                                                3. Drop-In Hardware Replacement
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                If a server PC fails, extract <code>oscar-3.11.11.zip</code> on replacement hardware, supply <code>backup-key.txt</code>, and run <code>oscar restore</code>. All users, Passkeys, alarms, and the public Octelium tunnel come back online automatically.
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>

                            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                                <Button
                                    variant="contained"
                                    startIcon={<DownloadRoundedIcon />}
                                    onClick={handleDownloadRecoveryChecklist}
                                >
                                    {copy.downloadChecklistBtn}
                                </Button>
                                <Button
                                    component={Link}
                                    href="/usb-backups"
                                    variant="outlined"
                                    startIcon={<OpenInNewRoundedIcon />}
                                >
                                    USB NVMe Backups
                                </Button>
                                <Button
                                    variant="outlined"
                                    startIcon={<SystemUpdateAltRoundedIcon />}
                                    onClick={() => setActiveTab(5)}
                                    data-testid="recovery-open-system-update-btn"
                                >
                                    {copy.tabs.systemUpdate}
                                </Button>
                            </Stack>
                        </Stack>
                    )}

                    {/* ========================================================= */}
                    {/* TAB 5: ZERO-LOGIN GITHUB & OFFLINE SYSTEM UPDATE          */}
                    {/* ========================================================= */}
                    {isAdmin && activeTab === 5 && (
                        <SystemUpdateCard isAdmin={isAdmin} />
                    )}
                </Box>
            </Paper>

            {/* ========================================================= */}
            {/* DIALOGS (Accessible, Safe Cancel Focus on Destructive)    */}
            {/* ========================================================= */}

            {/* Create / Edit User Dialog */}
            <Dialog open={userDialogOpen} onClose={() => setUserDialogOpen(false)} maxWidth="sm" fullWidth>
                <Box component="form" onSubmit={handleSaveUser}>
                    <DialogTitle>
                        {editingUser ? copy.editUserDialogTitle : copy.createUserDialogTitle}
                    </DialogTitle>
                    <DialogContent dividers>
                        <Stack spacing={2.5} sx={{ mt: 0.5 }}>
                            <TextField
                                required
                                disabled={Boolean(editingUser)}
                                label={copy.colUsername}
                                value={formUsername}
                                onChange={(e) => setFormUsername(e.target.value)}
                                inputProps={{ spellCheck: false, autoCapitalize: 'none', autoCorrect: 'off', maxLength: 64 }}
                            />
                            <TextField
                                label={copy.displayNameLabel}
                                value={formDisplayName}
                                onChange={(e) => setFormDisplayName(e.target.value)}
                                inputProps={{ maxLength: 128 }}
                            />
                            <FormControl fullWidth>
                                <InputLabel id="user-role-select-label">{copy.colRole}</InputLabel>
                                <Select
                                    labelId="user-role-select-label"
                                    label={copy.colRole}
                                    value={formRole}
                                    onChange={(e) => setFormRole(e.target.value as OscarRoleId)}
                                >
                                    {(['admin', 'operator', 'viewer'] as OscarRoleId[]).map((r) => (
                                        <MenuItem key={r} value={r}>
                                            <Box>
                                                <Typography variant="body2" fontWeight={600}>
                                                    {copy.roles[r].label}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'normal', display: 'block' }}>
                                                    {copy.roles[r].desc}
                                                </Typography>
                                            </Box>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            {formRole !== 'admin' && (
                                <TextField
                                    label={copy.gateViewsInputLabel}
                                    helperText={copy.gateViewsHelper}
                                    value={formViewsText}
                                    onChange={(e) => setFormViewsText(e.target.value)}
                                    inputProps={{ spellCheck: false, autoCapitalize: 'none' }}
                                />
                            )}

                            {!editingUser && (
                                <>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={formAutoTempPw}
                                                onChange={(_e, checked) => setFormAutoTempPw(checked)}
                                            />
                                        }
                                        label={copy.autoGenerateTempPwLabel}
                                    />
                                    {!formAutoTempPw && (
                                        <>
                                            <TextField
                                                required
                                                type={showPasswords ? 'text' : 'password'}
                                                label={copy.initialPasswordLabel}
                                                value={formExplicitPw}
                                                onChange={(e) => setFormExplicitPw(e.target.value)}
                                                autoComplete="new-password"
                                                inputProps={{ minLength: 14, maxLength: 512, spellCheck: false }}
                                            />
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={formMustChangePw}
                                                        onChange={(_e, checked) => setFormMustChangePw(checked)}
                                                    />
                                                }
                                                label={copy.requirePwChangeOnLoginLabel}
                                            />
                                        </>
                                    )}
                                </>
                            )}
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setUserDialogOpen(false)}>{copy.cancelBtn}</Button>
                        <Button type="submit" variant="contained">{copy.saveBtn}</Button>
                    </DialogActions>
                </Box>
            </Dialog>

            {/* Rename Passkey Dialog */}
            <Dialog open={Boolean(renameTarget)} onClose={() => setRenameTarget(null)} maxWidth="xs" fullWidth>
                <DialogTitle>{copy.renameBtn}</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        margin="dense"
                        label={copy.colName}
                        value={renameTarget?.name || ''}
                        onChange={(e) => setRenameTarget((prev) => (prev ? { ...prev, name: e.target.value } : null))}
                        inputProps={{ maxLength: 64 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRenameTarget(null)}>{copy.cancelBtn}</Button>
                    <Button variant="contained" onClick={handleConfirmRenamePasskey}>{copy.saveBtn}</Button>
                </DialogActions>
            </Dialog>

            {/* Delete Passkey Confirmation (Safe Cancel Focused) */}
            <Dialog open={Boolean(deletePasskeyTarget)} onClose={() => setDeletePasskeyTarget(null)} maxWidth="xs" fullWidth>
                <DialogTitle>{copy.confirmDeletePasskeyTitle}</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        {deletePasskeyTarget ? copy.confirmDeletePasskeyBody(deletePasskeyTarget.name) : ''}
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button autoFocus variant="outlined" onClick={() => setDeletePasskeyTarget(null)}>
                        {copy.cancelBtn}
                    </Button>
                    <Button color="error" variant="contained" onClick={handleConfirmDeletePasskey}>
                        {copy.removeBtn}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete User Confirmation (Safe Cancel Focused) */}
            <Dialog open={Boolean(deleteUserTarget)} onClose={() => setDeleteUserTarget(null)} maxWidth="xs" fullWidth>
                <DialogTitle>{copy.confirmDeleteUserTitle}</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        {deleteUserTarget ? copy.confirmDeleteUserBody(deleteUserTarget.username) : ''}
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button autoFocus variant="outlined" onClick={() => setDeleteUserTarget(null)}>
                        {copy.cancelBtn}
                    </Button>
                    <Button color="error" variant="contained" onClick={handleConfirmDeleteUser}>
                        {copy.deleteBtn}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Revoke Federation Token Confirmation (Safe Cancel Focused) */}
            <Dialog open={Boolean(revokeTokenTarget)} onClose={() => setRevokeTokenTarget(null)} maxWidth="xs" fullWidth>
                <DialogTitle>{copy.confirmRevokeTokenTitle}</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        {revokeTokenTarget ? copy.confirmRevokeTokenBody(revokeTokenTarget.label) : ''}
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button autoFocus variant="outlined" onClick={() => setRevokeTokenTarget(null)}>
                        {copy.cancelBtn}
                    </Button>
                    <Button color="error" variant="contained" onClick={handleConfirmRevokeToken}>
                        {copy.revokeBtn}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Bulk Roster Upload & Paste Dialog */}
            <BulkEnrollDialog
                open={bulkDialogOpen}
                locale={locale}
                existingUsernames={new Set((overview?.users || []).map((u) => u.username.toLowerCase()))}
                baseOrigin={inviteBaseOrigin}
                onBaseOriginChange={setInviteBaseOrigin}
                onClose={() => setBulkDialogOpen(false)}
                onEnrolled={async (cards, summaryMessage, rowErrors) => {
                    setBulkDialogOpen(false);
                    setOnboardingPackCards(cards);
                    if (rowErrors.length > 0) {
                        setBanner({
                            severity: 'warning',
                            text: `${summaryMessage} (${rowErrors.length} row error(s)).`,
                        });
                    } else {
                        setBanner({ severity: 'success', text: summaryMessage });
                    }
                    await loadAll();
                }}
            />

            {/* Ready-to-Send Startup Messages & 1-Tap Passkey/Password QR Pack */}
            <OnboardingPackDialog
                open={onboardingPackCards.length > 0}
                cards={onboardingPackCards}
                locale={locale}
                baseOrigin={inviteBaseOrigin}
                onBaseOriginChange={setInviteBaseOrigin}
                onCopiedNotice={() => setBanner({ severity: 'success', text: copy.copiedNotice })}
                onClose={() => setOnboardingPackCards([])}
            />
        </Stack>
    );
}
