import {
    inspectSameOriginAuthResponse,
    isTunnelAuthReloadPending,
    resetTunnelSelfHealStateForTesting,
    TUNNEL_RELOAD_COOLDOWN_MS,
    TUNNEL_RELOAD_STORAGE_KEY,
} from "@/lib/data/oscar/TunnelSessionSelfHeal";

class MemoryStorage {
    private readonly map = new Map<string, string>();
    getItem(key: string): string | null {
        return this.map.get(key) ?? null;
    }
    setItem(key: string, value: string): void {
        this.map.set(key, value);
    }
}

describe("TunnelSessionSelfHeal", () => {
    beforeEach(() => {
        resetTunnelSelfHealStateForTesting();
    });

    it("triggers a single top-level reload on same-origin 401 with x-octelium-unauthorized", () => {
        const storage = new MemoryStorage();
        let reloads = 0;

        const triggered = inspectSameOriginAuthResponse({
            input: "/sensorhub/api/observations?limit=10",
            response: {
                status: 401,
                ok: false,
                headers: new Headers({"x-octelium-unauthorized": "true"}),
            },
            currentOrigin: "https://site-a.example.org",
            currentPathname: "/",
            nowMs: 1_000_000,
            storage,
            reloadFn: () => {
                reloads += 1;
            },
        });

        expect(triggered).to.equal(true);
        expect(reloads).to.equal(1);
        expect(isTunnelAuthReloadPending()).to.equal(true);
        expect(storage.getItem(TUNNEL_RELOAD_STORAGE_KEY)).to.equal("1000000");
    });

    it("enforces the 60s sessionStorage cooldown to prevent reload loops", () => {
        const storage = new MemoryStorage();
        storage.setItem(TUNNEL_RELOAD_STORAGE_KEY, "1000000");
        let reloads = 0;

        const blocked = inspectSameOriginAuthResponse({
            input: "/sensorhub/api/observations?limit=10",
            response: {
                status: 401,
                ok: false,
                headers: new Headers({"x-octelium-unauthorized": "true"}),
            },
            currentOrigin: "https://site-a.example.org",
            currentPathname: "/event-log",
            nowMs: 1_000_000 + TUNNEL_RELOAD_COOLDOWN_MS - 1,
            storage,
            reloadFn: () => {
                reloads += 1;
            },
        });

        expect(blocked).to.equal(false);
        expect(reloads).to.equal(0);

        const allowedAfterCooldown = inspectSameOriginAuthResponse({
            input: "/sensorhub/api/observations?limit=10",
            response: {
                status: 401,
                ok: false,
                headers: new Headers({"x-octelium-unauthorized": "true"}),
            },
            currentOrigin: "https://site-a.example.org",
            currentPathname: "/event-log",
            nowMs: 1_000_000 + TUNNEL_RELOAD_COOLDOWN_MS,
            storage,
            reloadFn: () => {
                reloads += 1;
            },
        });

        expect(allowedAfterCooldown).to.equal(true);
        expect(reloads).to.equal(1);
    });

    it("ignores cross-origin federated node 401s and login routes", () => {
        const storage = new MemoryStorage();
        let reloads = 0;

        const crossOrigin = inspectSameOriginAuthResponse({
            input: "https://remote-gate.example.org/sensorhub/api/observations?limit=10",
            response: {
                status: 401,
                ok: false,
                headers: new Headers({"x-octelium-unauthorized": "true"}),
            },
            currentOrigin: "https://site-a.example.org",
            currentPathname: "/",
            nowMs: 2_000_000,
            storage,
            reloadFn: () => {
                reloads += 1;
            },
        });
        expect(crossOrigin).to.equal(false);

        const onLoginPage = inspectSameOriginAuthResponse({
            input: "/sensorhub/session",
            response: {
                status: 401,
                ok: false,
                headers: new Headers({"x-octelium-unauthorized": "true"}),
            },
            currentOrigin: "https://site-a.example.org",
            currentPathname: "/login/enroll",
            nowMs: 2_000_000,
            storage,
            reloadFn: () => {
                reloads += 1;
            },
        });
        expect(onLoginPage).to.equal(false);
        expect(reloads).to.equal(0);
    });

    it("reloads when an established /sensorhub/session transitions from 200 to 401", () => {
        const storage = new MemoryStorage();
        let reloads = 0;

        inspectSameOriginAuthResponse({
            input: "/sensorhub/session",
            response: {
                status: 200,
                ok: true,
                headers: new Headers(),
            },
            currentOrigin: "https://site-a.example.org",
            currentPathname: "/",
            nowMs: 3_000_000,
            storage,
            reloadFn: () => {
                reloads += 1;
            },
        });
        expect(reloads).to.equal(0);

        const expired = inspectSameOriginAuthResponse({
            input: "/sensorhub/session",
            response: {
                status: 401,
                ok: false,
                headers: new Headers(),
            },
            currentOrigin: "https://site-a.example.org",
            currentPathname: "/",
            nowMs: 3_300_000,
            storage,
            reloadFn: () => {
                reloads += 1;
            },
        });
        expect(expired).to.equal(true);
        expect(reloads).to.equal(1);
    });
});
