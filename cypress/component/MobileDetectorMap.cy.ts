import {
    MOBILE_SILENCE_THRESHOLD_MS,
    mobileAlarmPosition,
    startOfLocalDayIso,
    toLaneMapLocation,
    UNADJUDICATED_ALARM_FILTER,
    walkerIconHtml,
    walkerState,
} from "../../src/app/_components/maps/MapUtils";
import {
    isD5RadiometricStatusDataStream,
    isLocationDataStream,
    isMobileGpsDataStream,
} from "../../src/lib/data/oscar/Utilities";

const NOW = Date.parse("2026-11-17T12:00:00.000Z");

describe("mobile detector map", () => {
    it("draws a walker normal while fixes arrive, offline once they stop", () => {
        expect(walkerState(NOW - 1_000, undefined, false, NOW)).to.equal("normal");
        expect(walkerState(NOW - MOBILE_SILENCE_THRESHOLD_MS - 1, undefined, false, NOW)).to.equal("offline");
        expect(walkerState(null, undefined, false, NOW)).to.equal("offline");
        expect(walkerState(NOW - 1_000, undefined, true, NOW)).to.equal("offline");
    });

    it("never downgrades a live alarm to offline", () => {
        expect(walkerState(NOW - 10 * MOBILE_SILENCE_THRESHOLD_MS, NOW + 5_000, true, NOW)).to.equal("alarm");
        // and the flash ends on time
        expect(walkerState(NOW - 1_000, NOW - 1, false, NOW)).to.equal("normal");
    });

    it("escapes the walker title and tags its state", () => {
        const html = walkerIconHtml("offline", `Walker <1> "A"`);
        expect(html).to.include('data-walker-state="offline"');
        expect(html).to.include("Walker &lt;1&gt; &quot;A&quot;");
        expect(html).not.to.include("<1>");
    });

    it("reads the alarm position the occupancy process stamped, ignoring Null Island", () => {
        expect(mobileAlarmPosition({latitude: 35.93, longitude: -84.31})).to.deep.equal({lat: 35.93, lon: -84.31, alt: 0});
        expect(mobileAlarmPosition({latitude: 0, longitude: 0})).to.equal(null);
        expect(mobileAlarmPosition({gammaAlarm: true})).to.equal(null);
        expect(mobileAlarmPosition({latitude: 135, longitude: 0})).to.equal(null);
    });

    it("parses an RS-350/D5 GPS fix record", () => {
        const fix = toLaneMapLocation({samplingTime: 1, sensorLocation: {lat: 35.9, lon: -84.3, alt: 250}});
        expect(fix?.lat).to.equal(35.9);
        expect(fix?.lon).to.equal(-84.3);
    });

    it("asks the server only for alarms that still need adjudication", () => {
        expect(UNADJUDICATED_ALARM_FILTER).to.equal("(gammaAlarm=true OR neutronAlarm=true) AND adjudicatedIdsCount=0");
    });

    it("starts the alarm window at local midnight", () => {
        const start = new Date(startOfLocalDayIso(new Date(2026, 10, 17, 15, 42)));
        expect(start.getHours()).to.equal(0);
        expect(start.getMinutes()).to.equal(0);
        expect(start.getDate()).to.equal(17);
    });

    it("tells a walker's GPS stream apart from the one-shot fixed sensorLocation", () => {
        const gps = {properties: {outputName: "location", observedProperties: []}};
        const fixed = {properties: {outputName: "sensorLocation", observedProperties: []}};
        expect(isMobileGpsDataStream(gps)).to.equal(true);
        expect(isMobileGpsDataStream(fixed)).to.equal(false);
        expect(isLocationDataStream(fixed)).to.equal(true);
    });

    it("recognizes the Kromek D5 radiometric status stream", () => {
        const d5 = {properties: {observedProperties: [{definition: "http://sensorml.com/ont/swe/property/doseAlarmActive"}]}};
        expect(isD5RadiometricStatusDataStream(d5)).to.equal(true);
        expect(isD5RadiometricStatusDataStream({properties: {observedProperties: []}})).to.equal(false);
    });
});
