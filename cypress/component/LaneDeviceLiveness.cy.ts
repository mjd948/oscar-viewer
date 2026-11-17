import {
    DEVICE_SILENCE_THRESHOLD_MS,
    deriveDeviceLiveness,
} from "../../src/lib/data/oscar/useLaneHealth";

const NOW = Date.parse("2026-11-17T12:00:00.000Z");

describe("lane device liveness", () => {
    it("believes a module's online claim only while the device is still publishing", () => {
        expect(deriveDeviceLiveness(NOW - 1_000, "online", NOW)).to.deep.equal({silent: false, state: "online"});
        // module stopped from the admin console: last connectionStatus stays true, data stops
        expect(deriveDeviceLiveness(NOW - DEVICE_SILENCE_THRESHOLD_MS - 1, "online", NOW))
            .to.deep.equal({silent: true, state: "offline"});
    });

    it("treats a lane that never published device data as offline", () => {
        expect(deriveDeviceLiveness(null, "online", NOW)).to.deep.equal({silent: true, state: "offline"});
    });

    it("always believes an explicit offline from the module", () => {
        expect(deriveDeviceLiveness(NOW - 500, "offline", NOW)).to.deep.equal({silent: false, state: "offline"});
    });

    it("proves a lane online from fresh data when it has no connection stream (Kromek D5)", () => {
        expect(deriveDeviceLiveness(NOW - 2_000, undefined, NOW)).to.deep.equal({silent: false, state: "online"});
        expect(deriveDeviceLiveness(NOW - DEVICE_SILENCE_THRESHOLD_MS - 1, undefined, NOW))
            .to.deep.equal({silent: true, state: "offline"});
    });

    it("tolerates the threshold boundary itself as live", () => {
        expect(deriveDeviceLiveness(NOW - DEVICE_SILENCE_THRESHOLD_MS, "online", NOW).state).to.equal("online");
    });
});
