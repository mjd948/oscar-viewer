/*
 * Copyright (c) 2024.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */


import {LaneMapEntry} from "@/lib/data/oscar/LaneCollection";
import DataStreamFilter from "osh-js/source/core/consysapi/datastream/DataStreamFilter.js";
import DataStreams from "osh-js/source/core/consysapi/datastream/DataStreams.js";
import System from "osh-js/source/core/consysapi/system/System.js";
import Systems from "osh-js/source/core/consysapi/system/Systems.js";
import Observations from "osh-js/source/core/consysapi/observation/Observations.js"
import SystemFilter from "osh-js/source/core/consysapi/system/SystemFilter.js";
import ObservationFilter from "osh-js/source/core/consysapi/observation/ObservationFilter";
import ControlStreams from "osh-js/source/core/consysapi/controlstream/ControlStreams";
import { hashString } from "@/app/utils/Utils";
import {LatLngExpression} from "leaflet";
import ControlStreamFilter from "osh-js/source/core/consysapi/controlstream/ControlStreamFilter";
import DataStream from "osh-js/source/core/consysapi/datastream/DataStream.js";
import ControlStream from "osh-js/source/core/consysapi/controlstream/ControlStream";
import ConSysApi from "osh-js/source/core/datasource/consysapi/ConSysApi.datasource";
import MqttTopicConnector from "osh-js/source/core/connector/MqttTopicConnector.js";
import {Mode} from "osh-js/source/core/datasource/Mode";
import {
    buildOperationalViewCatalog,
    OperationalViewCatalog,
    systemMatchesOperationalView,
} from "@/lib/data/oscar/OperationalView";
import {extractFederationServiceUser} from "@/lib/data/oscar/AuthSessionApi";

const LANE_SYSTEM_UID_PREFIX = "urn:osh:system:lane:";

/**
 * Creates a per-instance lazy stream connector wrapper for osh-js ConnectedSystemsApi
 * REST models. In pinned osh-js, ConnectedSystemsApi eagerly constructs a new
 * MqttTopicConnector (opening an unclosed BroadcastChannel + message listener) on
 * every deserialized System, DataStream, ControlStream, and Observation even when
 * only REST methods are used. Deferring MqttTopicConnector construction until a
 * streaming method is invoked eliminates listener/channel accumulation on 24/7
 * wallboards while preserving full streaming capability on demand.
 */
function createLazyStreamConnector(rawNetworkProperties: Record<string, any>) {
    let delegate: any = null;
    const wrapper: any = {
        onMessage: () => {},
        onChangeStatus: () => {},
        onReconnect: () => true,
        ensureDelegate() {
            if (!delegate) {
                delegate = new MqttTopicConnector(
                    rawNetworkProperties.mqttOpts?.bcId,
                    rawNetworkProperties,
                );
            }
            delegate.onMessage = wrapper.onMessage;
            delegate.onChangeStatus = wrapper.onChangeStatus;
            delegate.onReconnect = wrapper.onReconnect;
            return delegate;
        },
        connect() {
            return wrapper.ensureDelegate().connect();
        },
        doRequest(topic?: string, queryString?: string) {
            return wrapper.ensureDelegate().doRequest(topic, queryString);
        },
        publishRequest(topic?: string, payload?: any) {
            return wrapper.ensureDelegate().publishRequest(topic, payload);
        },
        disconnect() {
            if (delegate) delegate.disconnect();
        },
        fullDisconnect(removeInterval?: boolean) {
            if (delegate) delegate.fullDisconnect(removeInterval);
        },
        reconnect() {
            if (delegate) delegate.reconnect();
        },
        close() {
            if (delegate) delegate.close();
        },
        isConnected() {
            return delegate ? delegate.isConnected() : false;
        },
        checkStatus(status: any) {
            if (delegate) delegate.checkStatus(status);
        },
    };
    return wrapper;
}

export function withLazyStreamConnector(rawNetworkProperties: Record<string, any>): Record<string, any> {
    const networkProperties: Record<string, any> = {...rawNetworkProperties};
    Object.defineProperty(networkProperties, "connector", {
        enumerable: true,
        configurable: true,
        get: () => createLazyStreamConnector(rawNetworkProperties),
    });
    return networkProperties;
}

/**
 * Returns the terminal lane identifier used by subsystem UIDs.
 */
function getTerminalLaneId(laneUid: string): string | null {
    if (!laneUid.startsWith(LANE_SYSTEM_UID_PREFIX))
        return null;

    const lanePath = laneUid.substring(LANE_SYSTEM_UID_PREFIX.length)
        .split(":")
        .filter(Boolean);
    return lanePath.length > 0 ? lanePath[lanePath.length - 1] : null;
}
export type NodeAuthenticationMode = "session" | "basic" | "bearer";

export interface RealtimeObservationSource {
    subscribe(handler: (message: any) => void, eventTypes: string[]): void;
    connect(): Promise<void>;
    reset(): Promise<void>;
}

export interface INode {
    id: string,
    name: string,
    address: string,
    port: number,
    oshPathRoot: string,
    csAPIEndpoint: string,
    bucketsEndpoint: string,
    isSecure: boolean,
    authenticationMode: NodeAuthenticationMode,
    auth: { username: string, password: string, token?: string },
    isDefaultNode: boolean
    customNameSet?: boolean;
    serverNodeUid?: string;
    serverNodeName?: string;
    laneAdjMap?: Map<string, string>,
    oscarServiceSystem: any;
    siteMapPath: string;
    lowerLeftBound: LatLngExpression;
    upperRightBound: LatLngExpression;

    getConnectedSystemsEndpoint(noProtocolPrefix: boolean): string,

    getBasicAuthHeader(): any,

    fetchSystems(): Promise<any[]>,

    fetchDataStreams(laneMap: Map<string, LaneMapEntry>): void,

    fetchLaneSystemsAndSubsystems(viewKey?: string | null): Promise<Map<string, LaneMapEntry>>,

    fetchOperationalViewCatalog(forceRefresh?: boolean): Promise<OperationalViewCatalog>,

    invalidateOperationalViewCatalog(): void,

    fetchLaneControlStreams(laneMap: Map<string, LaneMapEntry>): Promise<any>,

    fetchNodeControlStreams(): Promise<typeof ControlStream[]>,

    fetchNodeDataStreams(): Promise<typeof DataStream[]>,

    fetchDataStreamWithObservedProperty(observedProperty: string): Promise<typeof DataStream>,

    createRealtimeObservationSource(stream: typeof DataStream): RealtimeObservationSource,

    checkForEndpoint(): Promise<boolean>

    getOscarServiceSystem(): typeof System

    fetchDataStream(system: typeof System): Promise<typeof DataStream[]>

    fetchObservationsWithFilter(observationFilter: typeof ObservationFilter): Promise<any[]>

    fetchLatestObservationWithFilter(observationFilter: typeof ObservationFilter): Promise<any[]>

    getDataStreamsApi(): typeof DataStreams

    getSystemsApi(): typeof Systems

    getControlStreamApi(): typeof ControlStreams

    getObservationsApi(): typeof Observations

    setSiteMapPath(path: string): void

    setUpperRightBox(latLong: LatLngExpression): void

    setLowerLeftBox(latLong: LatLngExpression): void
}

export interface NodeOptions {
    id?: string,
    name: string,
    address: string,
    port: number,
    oshPathRoot?: string,
    csAPIEndpoint?: string,
    bucketsEndpoint?: string,
    auth?: { username: string, password: string, token?: string } | null,
    authenticationMode?: NodeAuthenticationMode,
    isSecure?: boolean,
    isDefaultNode?: boolean,
    customNameSet?: boolean,
    serverNodeUid?: string,
    serverNodeName?: string,
    siteMapPath?: string,
    lowerLeftBound?: LatLngExpression,
    upperRightBound?: LatLngExpression,
    laneAdjMap?: Map<string, string>,
    oscarServiceSystem?: typeof System,
}

export class Node implements INode {
    id: string;
    name: string;
    address: string;
    port: number;
    oshPathRoot: string;
    csAPIEndpoint: string;
    bucketsEndpoint: string;
    isSecure: boolean;
    authenticationMode: NodeAuthenticationMode;
    /** Runtime-only credentials. Persistence code must never serialize this field. */
    auth: { username: string, password: string, token?: string };
    isDefaultNode: boolean;
    customNameSet?: boolean;
    serverNodeUid?: string;
    serverNodeName?: string;
    laneAdjMap: Map<string, string> = new Map<string, string>();
    siteMapPath: string;
    lowerLeftBound: LatLngExpression;
    upperRightBound: LatLngExpression;

    dataStreamsApi: typeof DataStreams;
    systemsApi: typeof Systems;
    observationsApi: typeof Observations;
    oscarServiceSystem: typeof System;
    controlStreamApi: typeof ControlStreams;
    operationalViewCatalogPromise: Promise<OperationalViewCatalog> | null = null;

    constructor(options: NodeOptions) {
        this.id = options.id || ("node-" + hashString(options.address + "-" + options.port));
        this.name = options.name;
        this.address = options.address;
        this.port = options.port;
        this.oshPathRoot = options.oshPathRoot || '/sensorhub';
        this.csAPIEndpoint = options.csAPIEndpoint || '/api';
        this.bucketsEndpoint = options.bucketsEndpoint || '/buckets';
        this.authenticationMode = options.authenticationMode || "session";
        this.auth = options.auth ? {
            username: options.auth.username || "",
            password: options.auth.password || "",
            token: options.auth.token || "",
        } : {username: "", password: "", token: ""};
        this.isSecure = options.isSecure || false;
        this.isDefaultNode = options.isDefaultNode || false;
        this.customNameSet = Boolean(options.customNameSet);
        this.serverNodeUid = options.serverNodeUid;
        this.serverNodeName = options.serverNodeName;
        if (options.siteMapPath !== undefined) this.siteMapPath = options.siteMapPath;
        if (options.lowerLeftBound !== undefined) this.lowerLeftBound = options.lowerLeftBound;
        if (options.upperRightBound !== undefined) this.upperRightBound = options.upperRightBound;
        if (options.oscarServiceSystem !== undefined) this.oscarServiceSystem = options.oscarServiceSystem;


        let mqttOpts: any = {
            shared: true,
            prefix: this.csAPIEndpoint,
            endpointUrl: `${this.address}:${this.port}${this.oshPathRoot}`,
        }

        let connectorOpts: any = {};
        if (this.authenticationMode === "bearer" && this.auth.token && this.auth.token.trim().length > 0) {
            const trimmedToken = this.auth.token.trim();
            connectorOpts.Authorization = `Bearer ${trimmedToken}`;
            const fedUser = extractFederationServiceUser(trimmedToken);
            if (fedUser) {
                mqttOpts.username = fedUser;
                mqttOpts.password = trimmedToken;
            }
        } else if (this.authenticationMode === "basic" && this.hasRuntimeCredentials()) {
            mqttOpts.username = this.auth.username;
            mqttOpts.password = this.auth.password;
            connectorOpts.username = this.auth.username;
            connectorOpts.password = this.auth.password;
        }

        const rawNetworkProperties = {
            endpointUrl: `${this.address}:${this.port}${this.oshPathRoot}${this.csAPIEndpoint}`,
            tls: this.isSecure,
            streamProtocol: "mqtt",
            mqttOpts: mqttOpts,
            connectorOpts,
        };
        const networkProperties = withLazyStreamConnector(rawNetworkProperties);

        this.dataStreamsApi = new DataStreams(networkProperties);
        this.systemsApi = new Systems(networkProperties);
        this.observationsApi = new Observations(networkProperties);
        this.controlStreamApi = new ControlStreams(networkProperties);
        this.oscarServiceSystem = options.oscarServiceSystem || null;

    }

    getOscarServiceSystem() {
        return this.oscarServiceSystem;
    }

    getControlStreamApi(): typeof ControlStreams {
        return this.controlStreamApi;
    }

    getObservationsApi(): typeof Observations {
        return this.observationsApi;
    }

    getSystemsApi(): typeof Systems {
        return this.systemsApi;
    }

    setSiteMapPath(path: string) {
        this.siteMapPath = path;
    }

    setLowerLeftBox(latLon: LatLngExpression) {
        this.lowerLeftBound = latLon;
    }

    setUpperRightBox(latLon: LatLngExpression) {
        this.upperRightBound = latLon;
    }

    getDataStreamsApi(): typeof DataStreams {
        return this.dataStreamsApi;
    }

    createRealtimeObservationSource(stream: typeof DataStream): RealtimeObservationSource {
        const mqttOpts: any = {
            shared: true,
            prefix: this.csAPIEndpoint,
            endpointUrl: `${this.address}:${this.port}${this.oshPathRoot}`,
        };
        if (this.authenticationMode === "bearer" && this.auth.token && this.auth.token.trim().length > 0) {
            const trimmedToken = this.auth.token.trim();
            const fedUser = extractFederationServiceUser(trimmedToken);
            if (fedUser) {
                mqttOpts.username = fedUser;
                mqttOpts.password = trimmedToken;
            }
        } else if (this.authenticationMode === "basic" && this.hasRuntimeCredentials()) {
            mqttOpts.username = this.auth.username;
            mqttOpts.password = this.auth.password;
        }
        return new ConSysApi(`disposition-codes-${this.id}-${stream.properties.id}`, {
            endpointUrl: stream.networkProperties.endpointUrl,
            resource: `/datastreams/${stream.properties.id}/observations`,
            tls: this.isSecure,
            protocol: "mqtt",
            mode: Mode.REAL_TIME,
            responseFormat: "application/swe+json",
            mqttOpts,
        });
    }

    getConnectedSystemsEndpoint(noProtocolPrefix: boolean = false) {
        let protocol = this.isSecure ? 'https' : 'http';
        return noProtocolPrefix ? `${this.address}:${this.port}${this.oshPathRoot}${this.csAPIEndpoint}`
            : `${protocol}://${this.address}:${this.port}${this.oshPathRoot}${this.csAPIEndpoint}`;
    }

    getFileServerEndpoint(noProtocolPrefix: boolean = false) {
        let protocol = this.isSecure ? 'https' : 'http';
        return noProtocolPrefix ? `${this.address}:${this.port}${this.oshPathRoot}/buckets`
            : `${protocol}://${this.address}:${this.port}${this.oshPathRoot}/buckets`;
    }

    getBasicAuthHeader() {
        if (this.auth.token && this.auth.token.trim().length > 0) {
            return {"Authorization": `Bearer ${this.auth.token.trim()}`};
        }
        if (this.auth.username.length === 0 && this.auth.password.length === 0)
            return {};
        const encoded = btoa(`${this.auth.username}:${this.auth.password}`);
        return {"Authorization": `Basic ${encoded}`};
    }

    hasRuntimeCredentials() {
        return this.auth.username.length > 0 || this.auth.password.length > 0 || Boolean(this.auth.token && this.auth.token.trim().length > 0);
    }

    clearRuntimeCredentials() {
        this.auth = {username: "", password: "", token: ""};
    }

    async checkForEndpoint() {
        let ep: string = `${this.getConnectedSystemsEndpoint()}`;

        const response = await fetch(ep, {
            method: 'GET',
            mode: 'cors',
            credentials: 'include',
            headers: {
                ...this.getBasicAuthHeader(),
                'Content-Type': 'application/sml+json'
            }
        });

        if (response.ok) {
            return true;
        } else {
            console.warn("Error checking for API endpoint: ", response);
            return false;
        }
    }

    async fetchLaneSystemsAndSubsystems(viewKey: string | null = null): Promise<Map<string, LaneMapEntry>> {

        // check if node is reachable first
        const isReachable = await this.checkForEndpoint();

        if (!isReachable) {
            console.warn("Node is not reachable, check endpoint properties");
            return new Map<string, LaneMapEntry>();
        }

        let systems = await this.fetchSystems();
        if (!systems || systems.length == 0) return;

        // The systems collection is GeoJSON and does not include SensorML
        // keywords. Load the full lane descriptions only when a scoped view
        // needs those keywords, then attach them to the existing system shape
        // used by the rest of lane discovery.
        if (viewKey !== null) {
            const laneSystems = systems.filter((system) =>
                system?.properties?.properties?.uid?.startsWith(LANE_SYSTEM_UID_PREFIX));
            await this.loadOperationalViewKeywordsBounded(laneSystems);
        }

        systems.sort((a, b) => {
            const aIsLane = a.properties.properties?.uid.startsWith(LANE_SYSTEM_UID_PREFIX) ? 0 : 1;
            const bIsLane = b.properties.properties?.uid.startsWith(LANE_SYSTEM_UID_PREFIX) ? 0 : 1;
            return aIsLane - bIsLane;
        });

        let laneMap = new Map<string, LaneMapEntry>();

        // filter into lanes
        for (let system of systems) {
            if (system.properties.properties?.uid.startsWith(LANE_SYSTEM_UID_PREFIX)) {
                if (!systemMatchesOperationalView(system, viewKey))
                    continue;

                let laneName = system.properties.properties.name;

                if (laneMap.has(laneName)) {
                    laneMap.get(laneName).addSystem(system);
                    laneMap.get(laneName).setLaneSystem(system);
                } else {
                    let tLaneEntry = new LaneMapEntry(this);
                    tLaneEntry.setLaneName(laneName);
                    laneMap.set(laneName, tLaneEntry);
                    let entry = laneMap.get(laneName);
                    entry.addSystem(system);
                    entry.setLaneSystem(system);
                }

            } else if (system.properties.properties.uid.includes("urn:ornl:oscar:system:")) {
                const candidateValidStart = String(system.properties?.properties?.validTime?.[0] || "");
                const existingValidStart = String((this.oscarServiceSystem as any)?.properties?.properties?.validTime?.[0] || "");
                if (!this.oscarServiceSystem || candidateValidStart >= existingValidStart) {
                    this.oscarServiceSystem = system;
                    const serverUid = String(system.properties?.properties?.uid || "").trim();
                    const rawServerName = String(system.properties?.properties?.name || "").trim();
                    if (serverUid) {
                        this.serverNodeUid = serverUid;
                    }
                    this.serverNodeName = (rawServerName && rawServerName !== "OSCAR System")
                        ? rawServerName
                        : undefined;
                }
            } else {
                const uid = system.properties.properties.uid;
                const uidParts = uid.split(":");

                for (let [, entry] of laneMap) {
                    const laneUid = entry.laneSystem?.properties?.properties?.uid;
                    if (!laneUid) continue;

                    const laneSuffix = getTerminalLaneId(laneUid);
                    if (!laneSuffix) continue;

                    const isStandardSubsystem =
                        uidParts[uidParts.length - 1] === laneSuffix;

                    let isFFmpegSubsystem = false;

                    const ffmpegIdx = uidParts.indexOf("ffmpeg");
                    if (ffmpegIdx >= 0) {
                        const subLaneIdx = uidParts.indexOf("lane", ffmpegIdx);
                        const n = uidParts[uidParts.length - 1];
                        const subsystemLaneSuffix = uidParts[uidParts.length - 2];
                        const hasCorrectSuffix = subsystemLaneSuffix === laneSuffix;
                        const isInteger = /^\d+$/.test(n);

                        isFFmpegSubsystem =
                            subLaneIdx > ffmpegIdx &&
                            uidParts.length - subLaneIdx >= 3 &&
                            hasCorrectSuffix &&
                            isInteger;

                        if (isFFmpegSubsystem) {
                            entry.addSystem(system);
                            break;
                        }
                    } else if(isStandardSubsystem) {
                         entry.addSystem(system);
                         break;
                    }
                }
            }
        }

        return laneMap;
    }

    invalidateOperationalViewCatalog(): void {
        this.operationalViewCatalogPromise = null;
    }

    async fetchOperationalViewCatalog(forceRefresh = false): Promise<OperationalViewCatalog> {
        if (forceRefresh) {
            this.operationalViewCatalogPromise = null;
        }
        if (this.operationalViewCatalogPromise)
            return this.operationalViewCatalogPromise;

        this.operationalViewCatalogPromise = (async () => {
            const systems = await this.fetchSystems();
            if (!systems)
                return buildOperationalViewCatalog([]);

            const laneSystems = systems.filter((system) =>
                system?.properties?.properties?.uid?.startsWith(LANE_SYSTEM_UID_PREFIX));
            await this.loadOperationalViewKeywordsBounded(laneSystems);
            return buildOperationalViewCatalog(laneSystems);
        })();

        try {
            return await this.operationalViewCatalogPromise;
        } catch (error) {
            // Permit a later retry after a transient discovery failure.
            this.operationalViewCatalogPromise = null;
            throw error;
        }
    }

    private async loadOperationalViewKeywordsBounded(laneSystems: any[], concurrency = 8): Promise<void> {
        let nextIndex = 0;
        const workerCount = Math.max(1, Math.min(concurrency, laneSystems.length));
        await Promise.all(Array.from({length: workerCount}, async () => {
            while (nextIndex < laneSystems.length) {
                const current = laneSystems[nextIndex++];
                await this.loadOperationalViewKeywords(current);
            }
        }));
    }

    private async loadOperationalViewKeywords(system: any): Promise<void> {
        const systemProperties = system?.properties?.properties;
        if (!systemProperties) {
            console.warn("Cannot load operational-view metadata for a malformed lane system");
            return;
        }

        // Clear any collection-level value before the authoritative SensorML
        // request so a failed lookup cannot accidentally retain a stale scope.
        systemProperties.keywords = [];

        const systemId = system?.properties?.id;
        if (!systemId) {
            console.warn("Cannot load operational-view metadata for a lane without a system ID");
            return;
        }

        try {
            const description = await this.systemsApi.getSystemById(
                systemId,
                new SystemFilter({format: "application/sml+json"}),
            );
            const keywords = description?.properties?.keywords;

            if (Array.isArray(keywords))
                systemProperties.keywords = keywords;
        } catch (error) {
            // Fail closed: a lane whose assignment cannot be verified must not
            // leak into a scoped operational view.
            console.warn(`Unable to load operational-view metadata for system ${systemId}`, error);
        }
    }

    async fetchSystems(): Promise<any[]> {
        let systemsApi = this.getSystemsApi();

        let searchedSystems = await systemsApi.searchSystems(new SystemFilter({ searchMembers: true, validTime: "latest" }), 500);
        let availableSystems = [];

        while (searchedSystems.hasNext()) {
            let systems = await searchedSystems.nextPage();
            availableSystems.push(...systems);
        }

        if (availableSystems.length > 0) {
            return availableSystems;
        } else {
            console.warn("No systems found, check endpoint properties for: ", this.address);
        }
    }

    async fetchObservations(): Promise<any[]> {
        let observationsApi = this.getObservationsApi();

        let searchedObservations = await observationsApi.searchObservations(new ObservationFilter(), 100);
        let availableObservations = [];

        while (searchedObservations.hasNext()) {
            let systems = await searchedObservations.nextPage();
            availableObservations.push(...systems);
        }

        if (availableObservations.length > 0) {
            return availableObservations;
        } else {
            console.warn("No observations found, check endpoint properties for: ", this.address);
        }
    }

    async fetchLatestObservationWithFilter(observationFilter: typeof ObservationFilter) {
        let observationsApi = this.getObservationsApi();

        let searchedObservations = await observationsApi.searchObservations(observationFilter, 1);

        let obsResult = await searchedObservations.nextPage();
        return obsResult;
    }

    async fetchObservationsWithFilter(observationFilter: typeof ObservationFilter): Promise<any[]> {
        let observationsApi = this.getObservationsApi();

        let searchedObservations = await observationsApi.searchObservations(observationFilter, 100);
        let availableObservations = [];

        while (searchedObservations.hasNext()) {
            let systems = await searchedObservations.nextPage();
            availableObservations.push(...systems);
        }

        if (availableObservations.length > 0) {
            return availableObservations;
        } else {
            console.warn("No observations found, check endpoint properties for: ", this.address);
        }
    }

    async fetchDataStreams(laneMap: Map<string, LaneMapEntry>) {
        const laneIds: string[] = [];
        const laneBySystemId = new Map<string, LaneMapEntry>();
        for (const [, laneEntry] of laneMap) {
            if (laneEntry.parentNode.id != this.id) continue;
            laneIds.push(laneEntry.laneSystem.properties.id);
            for (const system of laneEntry.systems) {
                const sysId = (system as any)?.properties?.id;
                if (typeof sysId === "string" && sysId.length > 0) {
                    laneBySystemId.set(sysId, laneEntry);
                }
            }
        }

        const dataStreamCollection = await this.getDataStreamsApi()
            .searchDataStreams(
                new DataStreamFilter({
                    system: laneIds.join(","),
                    validTime: "latest"
                }), 2500);

        const allDataStreams = [];
        while (dataStreamCollection.hasNext()) {
            const dataStreams = await dataStreamCollection.nextPage();
            allDataStreams.push(...dataStreams);
        }

        for (const dataStream of allDataStreams) {
            const laneEntry = laneBySystemId.get(dataStream.properties?.["system@id"]);
            if (laneEntry != null) {
                laneEntry.addDataStream(dataStream);

                const systemLinkUid = dataStream.properties?.["system@link"]?.uid;
                if (systemLinkUid && systemLinkUid.includes("rsi:rs350")) {
                    laneEntry.setIsRS350Backpack(true);
                }
            }
        }
    }

    async fetchDataStream(system: typeof System) {
        let allDatastreams = [];
        const datastreams = await system.searchDataStreams(new DataStreamFilter({ validTime: "latest" }), 100);
        while (datastreams.hasNext()) {
            const datastreamResults = await datastreams.nextPage();
            allDatastreams.push(...datastreamResults);
        }
        return allDatastreams;
    }

    async fetchLaneControlStreams(laneMap: Map<string, LaneMapEntry>) {
        const laneIds: string[] = [];
        const laneBySystemId = new Map<string, LaneMapEntry>();
        for (const [, laneEntry] of laneMap) {
            if (laneEntry.parentNode.id != this.id) continue;
            laneIds.push(laneEntry.laneSystem.properties.id);
            for (const system of laneEntry.systems) {
                const sysId = (system as any)?.properties?.id;
                if (typeof sysId === "string" && sysId.length > 0) {
                    laneBySystemId.set(sysId, laneEntry);
                }
            }
        }

        const controlStreamCollection = await this.getControlStreamApi()
            .searchControlStreams(
                new ControlStreamFilter({
                    system: laneIds.join(","),
                    validTime: "latest"
                }), 1000);

        const allControlStreams = [];
        while (controlStreamCollection.hasNext()) {
            const controlStreams = await controlStreamCollection.nextPage();
            allControlStreams.push(...controlStreams);
        }

        for (const controlStream of allControlStreams) {
            const laneEntry = laneBySystemId.get(controlStream.properties?.["system@id"]);
            if (laneEntry != null) {
                laneEntry.addControlStream(controlStream);
            }
        }
    }

    async fetchNodeControlStreams(): Promise<any[]>{
        let availableControlStreams = [];
        const controlStreamCollection = await this.getControlStreamApi().searchControlStreams(new ControlStreamFilter({ validTime: "latest" }), 100);
        while (controlStreamCollection.hasNext()) {
            let controlStreamResults = await controlStreamCollection.nextPage();
            availableControlStreams.push(...controlStreamResults);
        }

        if(availableControlStreams.length > 0)
            return availableControlStreams;
        else
            console.warn("No control streams found for : ", this.address);
    }

    async fetchNodeDataStreams(): Promise<any[]>{
        let availableDataStreams = [];
        const dataStreamCollection = await this.getDataStreamsApi().searchDataStreams(new DataStreamFilter({ validTime: "latest" }), 100);
        while (dataStreamCollection.hasNext()) {
            let dataStreamResults = await dataStreamCollection.nextPage();
            availableDataStreams.push(...dataStreamResults);
        }

        if(availableDataStreams.length > 0)
            return availableDataStreams;
        else
            console.warn("No data streams found for : ", this.address);
    }

    async fetchDataStreamWithObservedProperty(observedProperty: string): Promise<typeof DataStream>{
        const dataStreamCollection = await this.getDataStreamsApi().searchDataStreams(new DataStreamFilter({ validTime: "latest", observedProperty: observedProperty }), 1);
        let dataStreamResults = await dataStreamCollection.nextPage();

        if(dataStreamResults)
            return dataStreamResults[0];
        else
            console.warn("No data streams found for : {} and {}", this.address , observedProperty);
    }
}
