/**
 * Runtime configuration for the viewer.
 *
 * The node's address used to live only in browser localStorage, seeded on first run
 * from window.location. That works when the node itself serves the app, and is wrong
 * everywhere else - most visibly in the desktop client, where the origin is the local
 * static server rather than the node, so first launch produced a "Local Node" pointing
 * at a port that serves no API.
 *
 * An installer needs somewhere to write the endpoint it just configured. This file is
 * that place: it sits next to the exported app and is read at boot, so the same build
 * can be pointed anywhere without rebuilding.
 *
 * Precedence, highest first:
 *   1. localStorage    - what the operator chose in the UI; never overridden
 *   2. oscar-config.json - what the installer wrote
 *   3. window.location - correct when the node serves the app, as it does by default
 */

export interface RuntimeNodeConfig {
    name?: string;
    address: string;
    port: number;
    isSecure?: boolean;
    oshPathRoot?: string;
    csAPIEndpoint?: string;
    bucketsEndpoint?: string;
    // Both fields are required when auth is supplied at all, matching NodeOptions.
    // Omit the whole object to leave credentials to the operator.
    auth?: { username: string; password: string } | null;
}

export interface OscarRuntimeConfig {
    node?: RuntimeNodeConfig;
    telemetry?: { sentryEnabled: boolean; dsn?: string };
}

const CONFIG_FILE = "oscar-config.json";

/**
 * True when the page is being served by the desktop client's local server, which marks
 * every document it serves. See injectDesktopMarker in electron/proxy.js.
 */
export function isDesktopClient(): boolean {
    return typeof window !== "undefined" && (window as any).__OSCAR_DESKTOP__ === true;
}

/**
 * Where a node's requests should actually be sent.
 *
 * In a browser this is the node itself. In the desktop client it is the client's own
 * origin, with the node's id in the path: a browser cannot put credentials on a
 * WebSocket handshake, so live data can only authenticate if it goes through the local
 * server, which attaches them on the way out. The node's real address is registered
 * separately - see registerUpstreams - and never used as a transport address here.
 *
 * The tls reported for the desktop client is the LOCAL server's, which is loopback http
 * and has nothing to do with the node: node.isSecure describes the second leg, which this
 * page never makes and cannot influence from here. It travels with the registration, and
 * the local server acts on it. Reading node.isSecure here instead would ask the renderer
 * to open https against a plain-http local server and break every request.
 *
 * Returning the node's own address in the browser case keeps a node-served deployment
 * behaving exactly as it did.
 */
export function nodeTransport(
    node: { id: string; address: string; port: number; isSecure?: boolean }
): { host: string; tls: boolean } {
    if (isDesktopClient()) {
        return {
            host: `${window.location.host}/__oscar/u/${encodeURIComponent(node.id)}`,
            tls: window.location.protocol === "https:",
        };
    }

    const tls = node.isSecure ?? false;
    const port = resolveNodePort(node.port, tls);

    // An explicit default port is redundant, and it is the one shape a reverse proxy is
    // least likely to expect in a Host header, so leave it off. A non-default port is
    // always spelled out, including the deliberately odd combinations (http on 443).
    const suffix = port === (tls ? 443 : 80) ? "" : `:${port}`;

    return { host: `${node.address}${suffix}`, tls };
}

/**
 * The port a node should actually be contacted on.
 *
 * window.location.port is "" whenever the origin uses the scheme's default port - which
 * is every https deployment behind a proxy - and Number("") is 0. A node seeded from
 * such an origin asked for "https://host:0/sensorhub/api", which the browser refuses
 * outright with ERR_UNSAFE_PORT, so every request the app made failed before it left
 * the tab. A half-typed port box parses to NaN and lands in the same place.
 *
 * Neither 0 nor NaN is a port, so fall back to the default for the scheme.
 */
export function resolveNodePort(port: unknown, isSecure: boolean = false): number {
    const parsed = Number(port);
    const usable = Number.isInteger(parsed) && parsed > 0 && parsed <= 65535;
    return usable ? parsed : (isSecure ? 443 : 80);
}

let cached: Promise<OscarRuntimeConfig | null> | null = null;

/**
 * Loads the runtime configuration, memoized for the lifetime of the page.
 *
 * Resolves to null when the file is absent, empty or unparseable - all of which are
 * ordinary situations rather than errors. A node-served install has no need of the
 * file at all, because the window.location fallback is already correct there.
 */
export function loadRuntimeConfig(): Promise<OscarRuntimeConfig | null> {
    if (cached) return cached;

    cached = (async () => {
        if (typeof window === "undefined") return null; // static export / SSR pass

        try {
            // Relative to document.baseURI so it resolves correctly whether the app is
            // served from the root or from a sub-path.
            const url = new URL(CONFIG_FILE, document.baseURI).toString();
            const response = await fetch(url, {
                cache: "no-store",
                credentials: "include",
            });

            if (!response.ok) return null;

            const text = (await response.text()).trim();
            if (!text) return null;

            const parsed = JSON.parse(text) as OscarRuntimeConfig;
            // The shipped placeholder is an empty object; treat it as absent.
            if (!parsed || Object.keys(parsed).length === 0) return null;

            return parsed;
        } catch {
            // A 404, a proxy returning HTML, or malformed JSON all mean "not configured".
            return null;
        }
    })();

    return cached;
}

/**
 * A file-server (buckets) url for this node, routed the same way as everything else.
 *
 * This one matters for a reason the REST calls do not share: video, images and report
 * downloads are fetched by the element itself - <video>, <source>, HLS, <img> - and a
 * media element cannot be given an Authorization header. Addressed straight at the node
 * they arrive unauthenticated and come back 401, which is why past-alarm clips stayed
 * blank in the desktop client while live streams played. Going through the local server
 * lets it attach the credentials, exactly as it does for the WebSocket handshake.
 *
 * Takes any node-shaped object rather than a Node instance: several callers receive a
 * plain INode out of Redux or props.
 */
export function nodeFileServerUrl(
    node: { id: string; address: string; port: number; isSecure?: boolean; oshPathRoot?: string; bucketsEndpoint?: string },
    path: string = ""
): string {
    const transport = nodeTransport(node);
    const protocol = transport.tls ? "https" : "http";
    const root = node.oshPathRoot ?? "/sensorhub";
    const buckets = node.bucketsEndpoint ?? "/buckets";
    return `${protocol}://${transport.host}${root}${buckets}/${path}`;
}

/**
 * Tells the desktop client which node each id in the path refers to.
 *
 * Must run before any data request: the local server has no other way to learn a node's
 * address or credentials, and a WebSocket handshake cannot carry them. A no-op in the
 * browser, where requests go to the node directly and carry their own Authorization.
 */
export async function registerUpstreams(
    nodes: Array<{ id: string; address: string; port: number; isSecure?: boolean; auth?: { username: string; password: string } | null }>
): Promise<void> {
    if (!isDesktopClient()) return;

    try {
        await fetch("/__oscar/upstreams", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(nodes.map((n) => ({
                id: n.id,
                address: n.address,
                port: n.port,
                // The only place the node's own scheme is ever transmitted. nodeTransport
                // deliberately reports the local server's scheme rather than this one, so
                // without it here the local server had no way to learn that an upstream
                // speaks https - and sent cleartext at port 443 for every request while
                // the Servers page went on showing the node as "Secure".
                isSecure: n.isSecure === true,
                auth: n.auth?.username
                    ? { username: n.auth.username, password: n.auth.password ?? "" }
                    : null,
            }))),
        });
    } catch (err) {
        // The next render registers again; failing loudly here would only replace live
        // data with a blank page.
        console.warn(`[config] could not register upstreams: ${(err as Error).message}`);
    }
}

/** Test seam: drops the memoized result so the next call re-reads the file. */
export function resetRuntimeConfigCache(): void {
    cached = null;
}
