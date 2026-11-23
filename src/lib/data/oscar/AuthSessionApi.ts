/*
 * Copyright (c) 2026. Botts Innovative Research, Inc.
 * All Rights Reserved
 */

export type OscarRoleId = 'admin' | 'operator' | 'viewer';

export interface OscarSessionInfo {
    username: string;
    displayName: string;
    roles: string[];
    primaryRole: OscarRoleId;
    isAdmin: boolean;
    canAdjudicate: boolean;
    isReadOnly: boolean;
    allowedViews: string[];
    mustChangePassword: boolean;
    keepSignedIn: boolean;
    authSource: string;
    rpId: string;
    rpIdSupported: boolean;
    passkeyUserId: string;
    passkeyCount: number;
    idleTimeoutSeconds: number;
    absoluteTimeoutSeconds: number;
}

export interface PasskeyItem {
    id: string;
    name: string;
    aaguid: string;
    authenticatorLabel: string;
    backupEligible: boolean;
    backupState: boolean;
    createdAt: number;
    lastUsedAt: number;
}

export interface PasskeyListResponse {
    rpId: string;
    rpIdSupported: boolean;
    passkeyUserId: string;
    acceptedCredentialIds: string[];
    passkeys: PasskeyItem[];
}

export interface AdminUserSummary {
    username: string;
    displayName: string;
    role: OscarRoleId;
    roles: string[];
    enabled: boolean;
    mustChangePassword: boolean;
    allowedViews: string[];
    authSource: string;
    passkeyCount: number;
    activeSessions: number;
    createdAt: number;
    lastLoginAt: number;
}

export interface FederationTokenSummary {
    id: string;
    serviceUserId: string;
    label: string;
    role: OscarRoleId;
    tokenPrefix: string;
    enabled: boolean;
    createdAt: number;
    createdBy: string;
    expiresAt: number;
    lastUsedAt: number;
}

export interface SecurityPolicySummary {
    idleTimeoutSeconds: number;
    absoluteTimeoutSeconds: number;
    persistSessions: boolean;
    allowKeepSignedIn: boolean;
    persistentCookieMaxAgeSeconds: number;
    sameSite: string;
    secureCookie: boolean;
    webAuthnRpId: string;
    effectiveRpId: string;
    rpIdSupported: boolean;
    oidcEnabled: boolean;
    oidcProviderName: string;
    oidcIssuerUrl: string;
    oidcClientId: string;
    oidcHasClientSecret: boolean;
    oidcScopes: string;
    oidcAdminGroup: string;
    oidcOperatorGroup: string;
    oidcDefaultRole: string;
    oidcTrustedCaCertificatePath?: string;
    externalIdentityConsoleUrl?: string;
    trustedTunnelSsoEnabled: boolean;
    trustedTunnelUserHeader: string;
    trustedTunnelGroupsHeader?: string;
    trustedTunnelHasSharedSecret: boolean;
    trustedTunnelAutoProvisionViewer: boolean;
}

export interface AdminOverviewResponse {
    users: AdminUserSummary[];
    federationTokens: FederationTokenSummary[];
    policy: SecurityPolicySummary;
    recovery: {
        bootstrapPasswordScrubbed: boolean;
        identityStorePersisted: boolean;
        includedInBackupArchive: string;
    };
}

const SESSION_API_BASE = '/sensorhub/session';

function base64UrlToUint8Array(b64url: string): Uint8Array {
    let base64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
        base64 += '=';
    }
    const raw = window.atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
        out[i] = raw.charCodeAt(i);
    }
    return out;
}

function bufferToBase64Url(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
        Accept: 'application/json',
        ...(init?.headers as Record<string, string> | undefined),
    };
    if (init?.method && init.method !== 'GET' && init.method !== 'HEAD') {
        headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(`${SESSION_API_BASE}${path}`, {
        credentials: 'include',
        ...init,
        headers,
    });
    let payload: any = null;
    try {
        payload = await response.json();
    } catch {
        payload = null;
    }
    if (!response.ok) {
        throw new Error(payload?.error || `Request failed (HTTP ${response.status})`);
    }
    return payload as T;
}

let cachedSessionInfo: OscarSessionInfo | null = null;
const sessionInfoListeners = new Set<(session: OscarSessionInfo | null) => void>();

export function getCachedSessionInfo(): OscarSessionInfo | null {
    return cachedSessionInfo;
}

export function subscribeSessionInfo(listener: (session: OscarSessionInfo | null) => void): () => void {
    sessionInfoListeners.add(listener);
    return () => {
        sessionInfoListeners.delete(listener);
    };
}

function publishCachedSessionInfo(next: OscarSessionInfo | null): void {
    cachedSessionInfo = next;
    sessionInfoListeners.forEach((listener) => {
        try {
            listener(next);
        } catch {
            // ignore listener error
        }
    });
}

export async function fetchCurrentSession(signal?: AbortSignal): Promise<OscarSessionInfo | null> {
    try {
        const res = await fetch(SESSION_API_BASE, {
            credentials: 'include',
            headers: { Accept: 'application/json' },
            signal,
        });
        if (!res.ok) return null;
        const json = await res.json();
        if (!json || typeof json.username !== 'string') return null;
        const parsed: OscarSessionInfo = {
            username: json.username,
            displayName: json.displayName || json.username,
            roles: Array.isArray(json.roles) ? json.roles : [],
            primaryRole: (json.primaryRole as OscarRoleId) || 'viewer',
            isAdmin: Boolean(json.isAdmin),
            canAdjudicate: json.canAdjudicate !== false,
            isReadOnly: Boolean(json.isReadOnly),
            allowedViews: Array.isArray(json.allowedViews) ? json.allowedViews : [],
            mustChangePassword: Boolean(json.mustChangePassword),
            keepSignedIn: json.keepSignedIn !== false,
            authSource: json.authSource || 'local',
            rpId: json.rpId || '',
            rpIdSupported: Boolean(json.rpIdSupported),
            passkeyUserId: json.passkeyUserId || '',
            passkeyCount: Number(json.passkeyCount || 0),
            idleTimeoutSeconds: Number(json.idleTimeoutSeconds ?? 0),
            absoluteTimeoutSeconds: Number(json.absoluteTimeoutSeconds ?? 0),
        };
        publishCachedSessionInfo(parsed);
        return parsed;
    } catch (err: any) {
        if (err?.name !== 'AbortError') {
            console.warn('Unable to load OSCAR session metadata:', err);
        }
        return null;
    }
}

export async function changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiJson('/account/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
    });
}

export async function isPasskeyRegistrationSupported(): Promise<boolean> {
    if (typeof window === 'undefined' || !window.PublicKeyCredential || !navigator.credentials) {
        return false;
    }
    const pkc = window.PublicKeyCredential as any;
    try {
        if (typeof pkc.getClientCapabilities === 'function') {
            const caps = await pkc.getClientCapabilities();
            if (caps && (caps.passkeyPlatformAuthenticator || caps.conditionalCreate || caps.hybridTransport)) {
                return true;
            }
        }
        if (typeof pkc.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
            await pkc.isUserVerifyingPlatformAuthenticatorAvailable();
        }
        return true;
    } catch {
        return true;
    }
}

export async function syncClientAcceptedPasskeys(
    rpId: string,
    passkeyUserId: string,
    acceptedCredentialIds: string[],
): Promise<void> {
    if (typeof window === 'undefined' || !rpId || !passkeyUserId) return;
    const pkc = window.PublicKeyCredential as any;
    if (typeof pkc?.signalAllAcceptedCredentials !== 'function') return;
    try {
        await pkc.signalAllAcceptedCredentials({
            rpId,
            userId: passkeyUserId,
            allAcceptedCredentialIds: acceptedCredentialIds,
        });
    } catch (err) {
        console.warn('PublicKeyCredential.signalAllAcceptedCredentials failed:', err);
    }
}

export async function syncClientUserDetails(
    rpId: string,
    passkeyUserId: string,
    name: string,
    displayName: string,
): Promise<void> {
    if (typeof window === 'undefined' || !rpId || !passkeyUserId) return;
    const pkc = window.PublicKeyCredential as any;
    if (typeof pkc?.signalCurrentUserDetails !== 'function') return;
    try {
        await pkc.signalCurrentUserDetails({
            rpId,
            userId: passkeyUserId,
            name,
            displayName,
        });
    } catch (err) {
        console.warn('PublicKeyCredential.signalCurrentUserDetails failed:', err);
    }
}

export async function fetchMyPasskeys(): Promise<PasskeyListResponse> {
    const data = await apiJson<PasskeyListResponse>('/account/passkeys');
    if (data.rpIdSupported) {
        void syncClientAcceptedPasskeys(data.rpId, data.passkeyUserId, data.acceptedCredentialIds || []);
    }
    return data;
}

export interface RegisterPasskeyOutcome {
    status: 'registered' | 'already_exists' | 'cancelled';
    list?: PasskeyListResponse;
}

export async function registerNewPasskey(customName?: string): Promise<RegisterPasskeyOutcome> {
    const serverOpts = await apiJson<any>('/account/passkeys/options', {
        method: 'POST',
        body: JSON.stringify({}),
    });

    const pkc = window.PublicKeyCredential as any;
    let publicKey: PublicKeyCredentialCreationOptions;
    if (typeof pkc?.parseCreationOptionsFromJSON === 'function') {
        publicKey = pkc.parseCreationOptionsFromJSON(serverOpts);
    } else {
        publicKey = {
            challenge: base64UrlToUint8Array(serverOpts.challenge) as BufferSource,
            rp: {
                id: serverOpts.rp.id,
                name: serverOpts.rp.name,
            },
            user: {
                id: base64UrlToUint8Array(serverOpts.user.id) as BufferSource,
                name: serverOpts.user.name,
                displayName: serverOpts.user.displayName,
            },
            pubKeyCredParams: serverOpts.pubKeyCredParams,
            timeout: serverOpts.timeout || 120000,
            attestation: serverOpts.attestation || 'none',
            authenticatorSelection: serverOpts.authenticatorSelection,
            excludeCredentials: Array.isArray(serverOpts.excludeCredentials)
                ? serverOpts.excludeCredentials.map((c: any) => ({
                    type: 'public-key' as PublicKeyCredentialType,
                    id: base64UrlToUint8Array(c.id) as BufferSource,
                    transports: c.transports,
                }))
                : [],
        };
    }

    let created: PublicKeyCredential | null = null;
    try {
        created = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
    } catch (err: any) {
        if (err?.name === 'InvalidStateError') {
            return { status: 'already_exists' };
        }
        if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') {
            return { status: 'cancelled' };
        }
        throw err;
    }

    if (!created) {
        return { status: 'cancelled' };
    }

    const credAny = created as any;
    let serializedCred: any;
    if (typeof credAny.toJSON === 'function') {
        serializedCred = credAny.toJSON();
    } else {
        const attResp = created.response as AuthenticatorAttestationResponse;
        serializedCred = {
            id: created.id,
            rawId: bufferToBase64Url(created.rawId),
            type: created.type,
            response: {
                clientDataJSON: bufferToBase64Url(attResp.clientDataJSON),
                attestationObject: bufferToBase64Url(attResp.attestationObject),
                transports: typeof attResp.getTransports === 'function' ? attResp.getTransports() : [],
            },
        };
    }

    const updatedList = await apiJson<PasskeyListResponse>('/account/passkeys/verify', {
        method: 'POST',
        body: JSON.stringify({
            challenge: serverOpts.challenge,
            name: customName?.trim() || undefined,
            credential: serializedCred,
        }),
    });

    if (updatedList.rpIdSupported) {
        void syncClientAcceptedPasskeys(
            updatedList.rpId,
            updatedList.passkeyUserId,
            updatedList.acceptedCredentialIds || [],
        );
    }
    return { status: 'registered', list: updatedList };
}

export async function renameMyPasskey(credentialId: string, name: string): Promise<PasskeyListResponse> {
    return apiJson<PasskeyListResponse>(`/account/passkeys/${encodeURIComponent(credentialId)}`, {
        method: 'PUT',
        body: JSON.stringify({ name }),
    });
}

export async function deleteMyPasskey(credentialId: string): Promise<PasskeyListResponse> {
    const updated = await apiJson<PasskeyListResponse>(
        `/account/passkeys/${encodeURIComponent(credentialId)}`,
        { method: 'DELETE', body: '{}' },
    );
    if (updated.rpIdSupported) {
        void syncClientAcceptedPasskeys(
            updated.rpId,
            updated.passkeyUserId,
            updated.acceptedCredentialIds || [],
        );
    }
    return updated;
}

// ---------------------------------------------------------------------------
// Administrator Users, Federation Tokens & Security Policy APIs
// ---------------------------------------------------------------------------

export interface EnrolledInviteCard {
    user: AdminUserSummary;
    createdNew?: boolean;
    temporaryPassword?: string;
    inviteToken: string;
    inviteExpiresAt: number;
}

export interface BulkEnrollmentResponse {
    createdCount: number;
    reissuedCount: number;
    skippedCount: number;
    enrolled: EnrolledInviteCard[];
    errors: Array<{ row: number; username: string; error: string }>;
}

export interface ParsedRosterRow {
    lineNumber: number;
    username: string;
    displayName: string;
    role: OscarRoleId;
    allowedViews: string[];
    error?: string;
}

export async function fetchAdminOverview(): Promise<AdminOverviewResponse> {
    return apiJson<AdminOverviewResponse>('/admin/overview');
}

export async function adminCreateUser(input: {
    username: string;
    displayName: string;
    role: OscarRoleId;
    allowedViews: string[];
    password?: string;
    mustChangePassword: boolean;
    inviteExpiresInHours?: number;
}): Promise<{
    user: AdminUserSummary;
    temporaryPassword?: string;
    inviteToken?: string;
    inviteExpiresAt?: number;
}> {
    return apiJson('/admin/users', {
        method: 'POST',
        body: JSON.stringify(input),
    });
}

export async function adminBulkEnrollUsers(input: {
    users: Array<{
        username: string;
        displayName?: string;
        role: OscarRoleId;
        allowedViews: string[];
    }>;
    reissueExisting: boolean;
    inviteExpiresInHours: number;
}): Promise<BulkEnrollmentResponse> {
    return apiJson('/admin/users/bulk', {
        method: 'POST',
        body: JSON.stringify(input),
    });
}

export async function adminIssueUserInvite(
    username: string,
    inviteExpiresInHours = 168,
): Promise<{ user: AdminUserSummary; inviteToken: string; inviteExpiresAt: number }> {
    return apiJson(`/admin/users/${encodeURIComponent(username)}/invite`, {
        method: 'POST',
        body: JSON.stringify({ inviteExpiresInHours }),
    });
}

export async function adminUpdateUser(
    username: string,
    input: {
        displayName?: string;
        role?: OscarRoleId;
        enabled?: boolean;
        allowedViews?: string[];
    },
): Promise<{ user: AdminUserSummary }> {
    return apiJson(`/admin/users/${encodeURIComponent(username)}`, {
        method: 'PUT',
        body: JSON.stringify(input),
    });
}

export async function adminResetUserPassword(
    username: string,
    input: { password?: string; mustChangePassword: boolean; inviteExpiresInHours?: number },
): Promise<{
    user: AdminUserSummary;
    temporaryPassword?: string;
    inviteToken?: string;
    inviteExpiresAt?: number;
}> {
    return apiJson(`/admin/users/${encodeURIComponent(username)}/reset-password`, {
        method: 'POST',
        body: JSON.stringify(input),
    });
}

export async function adminRevokeUserSessions(username: string): Promise<{ revokedSessions: number }> {
    return apiJson(`/admin/users/${encodeURIComponent(username)}/revoke-sessions`, {
        method: 'POST',
        body: '{}',
    });
}

export async function adminDeleteUser(username: string): Promise<void> {
    await apiJson(`/admin/users/${encodeURIComponent(username)}`, {
        method: 'DELETE',
        body: '{}',
    });
}

export async function adminCreateFederationToken(input: {
    label: string;
    role: 'viewer' | 'operator';
    expiresInDays: number;
}): Promise<{ token: string; record: FederationTokenSummary }> {
    return apiJson('/admin/federation-tokens', {
        method: 'POST',
        body: JSON.stringify(input),
    });
}

export async function adminRevokeFederationToken(tokenId: string): Promise<void> {
    await apiJson(`/admin/federation-tokens/${encodeURIComponent(tokenId)}`, {
        method: 'DELETE',
        body: '{}',
    });
}

export async function adminUpdateSecurityPolicy(
    patch: Partial<SecurityPolicySummary> & {
        oidcClientSecret?: string;
        trustedTunnelSharedSecret?: string;
    },
): Promise<SecurityPolicySummary> {
    return apiJson('/admin/policy', {
        method: 'PUT',
        body: JSON.stringify(patch),
    });
}

/**
 * Extracts the scoped SensorHub MQTT service username (`svc-fed-<shortId>`)
 * from an OSCAR federation token (`oscar_fed_<shortId>_<secret>`).
 */
export function extractFederationServiceUser(rawToken: string): string | null {
    if (!rawToken) return null;
    const trimmed = rawToken.trim();
    const match = /^oscar_fed_([0-9a-f]{8,24})_[A-Za-z0-9_-]+$/.exec(trimmed);
    return match ? `svc-fed-${match[1]}` : null;
}

/**
 * Validates and normalizes an optional HTTPS external SSO user-management console URL
 * using structured Origin / URL parsing (rejecting opaque "null" origins, non-HTTPS
 * schemes such as http:/javascript:/data:, and embedded URL credentials).
 */
export function normalizeTrustedHttpsConsoleUrl(rawUrl?: string | null): string | null {
    const trimmed = (rawUrl ?? '').trim();
    if (!trimmed) return null;
    try {
        if ('Origin' in globalThis) {
            const parsedOrigin = (globalThis as any).Origin.from(trimmed);
            if (!parsedOrigin || parsedOrigin.opaque === true) {
                return null;
            }
        }
        const parsed = new URL(trimmed);
        if (
            parsed.origin === 'null'
            || parsed.protocol !== 'https:'
            || !parsed.hostname
            || parsed.username !== ''
            || parsed.password !== ''
        ) {
            return null;
        }
        return parsed.toString();
    } catch {
        return null;
    }
}

const ROLE_ALIASES: Record<string, OscarRoleId> = {
    admin: 'admin',
    administrator: 'admin',
    supervisor: 'admin',
    administrador: 'admin',
    administrateur: 'admin',
    operator: 'operator',
    op: 'operator',
    adjudicator: 'operator',
    inspector: 'operator',
    operador: 'operator',
    operateur: 'operator',
    'opérateur': 'operator',
    viewer: 'viewer',
    readonly: 'viewer',
    'read-only': 'viewer',
    auditor: 'viewer',
    guest: 'viewer',
    visor: 'viewer',
    lecteur: 'viewer',
};

const HEADER_FIRST_COL_NAMES = new Set([
    'user',
    'username',
    'user_name',
    'userid',
    'user_id',
    'login',
    'account',
    'email',
    'usuario',
    'utilisateur',
    'χρήστης',
]);

function splitDelimitedLine(line: string, delimiter: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === delimiter && !inQuotes) {
            out.push(cur.trim());
            cur = '';
        } else {
            cur += ch;
        }
    }
    out.push(cur.trim());
    return out;
}

function humanizeAccountName(username: string): string {
    const base = username.includes('@') ? username.slice(0, username.indexOf('@')) : username;
    const parts = base.split(/[._-]+/).filter(Boolean);
    if (parts.length === 0) return username;
    return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

/**
 * Parses a CSV, TSV (Excel paste), or semicolon-delimited user list into validated rows.
 * Supports 1–4 columns (`username, role, displayName, views`) with or without a header row,
 * and automatically swaps `role` and `displayName` if the uploader placed Full Name in column 2.
 */
export function parseBulkUserRoster(rawText: string): ParsedRosterRow[] {
    if (!rawText) return [];
    const cleaned = rawText.replace(/^\uFEFF/, '');
    const lines = cleaned.split(/\r?\n/);
    const parsed: ParsedRosterRow[] = [];
    const seen = new Set<string>();
    let nonEmptyIndex = 0;

    for (let idx = 0; idx < lines.length; idx++) {
        const rawLine = lines[idx].trim();
        if (!rawLine || rawLine.startsWith('#')) continue;

        const delimiter = rawLine.includes('\t')
            ? '\t'
            : rawLine.includes(',')
                ? ','
                : rawLine.includes(';')
                    ? ';'
                    : ',';
        const cols = splitDelimitedLine(rawLine, delimiter);
        const firstLower = (cols[0] || '').toLowerCase().replace(/\s+/g, '_');

        if (nonEmptyIndex === 0 && HEADER_FIRST_COL_NAMES.has(firstLower)) {
            nonEmptyIndex++;
            continue;
        }
        nonEmptyIndex++;

        const username = (cols[0] || '').trim();
        let rawRole = (cols[1] || '').trim();
        let rawDisplay = (cols[2] || '').trim();
        const rawViews = (cols[3] || '').trim();

        // If column 2 is not a recognized role but column 3 IS, swap gracefully
        if (
            rawRole
            && !ROLE_ALIASES[rawRole.toLowerCase()]
            && rawDisplay
            && ROLE_ALIASES[rawDisplay.toLowerCase()]
        ) {
            const tmp = rawRole;
            rawRole = rawDisplay;
            rawDisplay = tmp;
        }

        let error: string | undefined;
        let role: OscarRoleId = 'operator';

        if (!username) {
            error = 'Missing username';
        } else if (!/^[A-Za-z0-9._@-]{2,64}$/.test(username)) {
            error = 'Invalid username characters (use letters, numbers, ., _, @, -)';
        } else if (username.toLowerCase().startsWith('svc-fed-')) {
            error = 'Prefix svc-fed- is reserved';
        } else if (seen.has(username.toLowerCase())) {
            error = 'Duplicate username in list';
        } else {
            seen.add(username.toLowerCase());
        }

        if (!error && rawRole) {
            const mapped = ROLE_ALIASES[rawRole.toLowerCase()];
            if (!mapped) {
                error = `Unknown role "${rawRole}" (use admin, operator, or viewer)`;
            } else {
                role = mapped;
            }
        }

        const allowedViews: string[] = [];
        if (!error && rawViews && role !== 'admin') {
            const viewTokens = rawViews
                .split(/[|\s;/]+/)
                .map((v) => v.trim().toLowerCase())
                .filter((v) => v && v !== 'all' && v !== '*');
            for (const v of viewTokens) {
                if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(v)) {
                    error = `Invalid Operational View "${v}"`;
                    break;
                }
                if (!allowedViews.includes(v)) {
                    allowedViews.push(v);
                }
            }
        }

        parsed.push({
            lineNumber: idx + 1,
            username,
            displayName: rawDisplay || (username ? humanizeAccountName(username) : ''),
            role,
            allowedViews,
            error,
        });
    }

    return parsed;
}

export function normalizeBaseOrigin(rawOrigin?: string): string {
    const fallback = typeof window !== 'undefined' ? window.location.origin : 'https://oscar.local';
    const trimmed = (rawOrigin || '').trim().replace(/\/+$/, '');
    if (!trimmed) return fallback;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}

export function buildEnrollmentUrl(baseOrigin: string, inviteToken: string): string {
    return `${normalizeBaseOrigin(baseOrigin)}/login/enroll?token=${encodeURIComponent(inviteToken)}`;
}

export function buildStartupTextMessage(
    card: EnrolledInviteCard,
    baseOrigin: string,
    locale: 'en' | 'es' | 'fr' | 'el' = 'en',
): string {
    const origin = normalizeBaseOrigin(baseOrigin);
    const enrollUrl = buildEnrollmentUrl(origin, card.inviteToken);
    const scope = card.user.allowedViews && card.user.allowedViews.length > 0
        ? card.user.allowedViews.join(', ')
        : locale === 'es'
            ? 'Todos los carriles'
            : locale === 'fr'
                ? 'Toutes les voies'
                : locale === 'el'
                    ? 'Όλες οι λωρίδες'
                    : 'All Facility Lanes';
    const expDate = card.inviteExpiresAt > 0 ? new Date(card.inviteExpiresAt).toISOString().slice(0, 10) : '';

    if (locale === 'es') {
        const lines = [
            `Bienvenido/a a OSCAR (${origin})`,
            `• Usuario: ${card.user.username} (${card.user.displayName})`,
            `• Rol: ${card.user.role.toUpperCase()} | Vistas: ${scope}`,
            `• Enlace directo para activar Passkey o contraseña (o escanee el código QR):`,
            `  ${enrollUrl}`,
        ];
        if (card.temporaryPassword) {
            lines.push(`• Código temporal (para estaciones sin teléfono en ${origin}/login): ${card.temporaryPassword}`);
        }
        if (expDate) lines.push(`(Invitación de un solo uso válida hasta ${expDate})`);
        return lines.join('\n');
    }

    if (locale === 'fr') {
        const lines = [
            `Bienvenue sur OSCAR (${origin})`,
            `• Compte : ${card.user.username} (${card.user.displayName})`,
            `• Rôle : ${card.user.role.toUpperCase()} | Voies : ${scope}`,
            `• Lien d’activation directe Passkey ou mot de passe (ou scannez le QR) :`,
            `  ${enrollUrl}`,
        ];
        if (card.temporaryPassword) {
            lines.push(`• Code temporaire (postes sans téléphone sur ${origin}/login) : ${card.temporaryPassword}`);
        }
        if (expDate) lines.push(`(Invitation à usage unique valable jusqu’au ${expDate})`);
        return lines.join('\n');
    }

    if (locale === 'el') {
        const lines = [
            `Καλώς ήρθατε στο OSCAR (${origin})`,
            `• Χρήστης: ${card.user.username} (${card.user.displayName})`,
            `• Ρόλος: ${card.user.role.toUpperCase()} | Λωρίδες: ${scope}`,
            `• Άμεσος σύνδεσμος ρύθμισης Passkey ή κωδικού (ή σαρώστε το QR):`,
            `  ${enrollUrl}`,
        ];
        if (card.temporaryPassword) {
            lines.push(`• Προσωρινός κωδικός (για σταθμούς χωρίς κινητό στο ${origin}/login): ${card.temporaryPassword}`);
        }
        if (expDate) lines.push(`(Πρόσκληση μίας χρήσης έως ${expDate})`);
        return lines.join('\n');
    }

    const lines = [
        `Welcome to OSCAR (${origin})!`,
        `• Username: ${card.user.username} (${card.user.displayName})`,
        `• Role: ${card.user.role.toUpperCase()} | Gates: ${scope}`,
        `• 1-Tap Passkey / Password Setup Link (or scan QR):`,
        `  ${enrollUrl}`,
    ];
    if (card.temporaryPassword) {
        lines.push(`• Phone-Free Workstation Code (manual sign-in at ${origin}/login): ${card.temporaryPassword}`);
    }
    if (expDate) {
        lines.push(`(One-time setup link expires ${expDate})`);
    }
    return lines.join('\n');
}
