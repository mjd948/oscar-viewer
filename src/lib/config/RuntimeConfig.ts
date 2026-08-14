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

/** Test seam: drops the memoized result so the next call re-reads the file. */
export function resetRuntimeConfigCache(): void {
    cached = null;
}
