import {hashString} from "@/app/utils/Utils";
import {LaneMapEntry} from "@/lib/data/oscar/LaneCollection";
import {
    fetchCommandStatuses,
    generateReportCommandJSON,
    ReportOutputFormat,
    sendCommand,
} from "@/lib/data/oscar/OSCARCommands";
import {EventTableData} from "@/lib/data/oscar/TableHelpers";
import {
    adjudicationCodeMarker,
    EML_NON_THREAT_CODE,
    EML_NON_THREAT_MARKER,
} from "@/lib/data/oscar/adjudication/models/AdjudicationConstants";
import {formatIso6346, isValidIso6346} from "@/lib/data/oscar/adjudication/Iso6346";
import {isSpectroscopicFilePath} from "@/lib/data/oscar/adjudication/IsotopeMapping";
import {
    fetchAdjudicatedVehicleIdsWindow,
    fetchVehicleOcrWindow,
} from "@/lib/data/oscar/adjudication/fetchVehicleOcrWindow";
import {
    isAdjudicationDataStream,
    isOccupancyDataStream,
    isReportControlStream,
    isVehicleOcrDataStream,
} from "@/lib/data/oscar/Utilities";
import {INode} from "@/lib/data/osh/Node";
import ControlStreamFilter from "osh-js/source/core/consysapi/controlstream/ControlStreamFilter";

export type VehicleSearchMatchMode =
    | "equals"
    | "contains"
    | "startsWith"
    | "notEquals"
    | "isEmpty"
    | "isNotEmpty";

export type VehicleSearchWindowPreset = "24h" | "15d" | "30d" | "all";

export const VEHICLE_SEARCH_WINDOW_MS: Record<Exclude<VehicleSearchWindowPreset, "all">, number> = {
    "24h": 24 * 60 * 60 * 1000,
    "15d": 15 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
};

export interface VehiclePassOcrSummary {
    value: string;
    normalizedValue: string;
    idType: string;
    confidence: number;
    checksumValid: boolean;
    readCount: number;
    cameraUid: string;
    frameTime: string;
    evidenceImagePath: string;
}

export interface VehiclePassEmlSummary {
    decision: string;
    sourceType: string;
    normProbabilityPct: number | null;
    threatProbabilityPct: number | null;
}

export interface VehiclePassWebIdSummary {
    obsId: string;
    sampleTime: string;
    isotopeString: string;
    isotopes: string[];
    drf: string;
    estimatedDose: number;
    chi2: number;
    errorMessage: string;
    warnings: string[];
}

export interface VehiclePassAdjudicationSummary {
    timeUtc: string;
    username: string;
    adjudicationCode: number;
    dispositionLabel: string;
    dispositionGroup: string;
    secondaryInspectionStatus: string;
    vehicleId: string;
    summary: string;
    isotopes: string[];
    filePaths: string[];
}

export interface VehiclePassProfileSample {
    timestampMs: number;
    offsetSeconds: number;
    gammaCounts: number;
    neutronCounts: number;
}

export interface VehiclePassItem {
    compositeKey: string;
    nodeId: string;
    nodeName: string;
    node: INode | null;
    laneEntry: LaneMapEntry | null;
    federatedRemote: boolean;
    laneUid: string;
    laneName: string;
    datastreamId: string;
    occupancyObsId: string;
    occupancyCount: number;
    systemType: string;
    startTime: string;
    endTime: string;
    samplingTime: string;
    durationSeconds: number;
    gammaAlarm: boolean;
    neutronAlarm: boolean;
    alarmCategoryCode: string;
    alarmStatusLabel: string;
    emlAutoReleased: boolean;
    maxGammaCount: number;
    maxNeutronCount: number;
    neutronBackground: number;
    vehicleId: string;
    normalizedVehicleId: string;
    vehicleIdSource: "adjudication" | "ocr" | "both" | "none";
    ocr: VehiclePassOcrSummary | null;
    eml: VehiclePassEmlSummary | null;
    confirmedIsotopes: string[];
    videoPaths: string[];
    webIdAnalyses: VehiclePassWebIdSummary[];
    adjudications: VehiclePassAdjudicationSummary[];
    radiationProfile: VehiclePassProfileSample[];
    eventRow: EventTableData;
}

export interface UnreachableFederatedNode {
    nodeId: string;
    nodeName: string;
    reason: string;
}

export interface VehicleIncidentSummary {
    totalPasses: number;
    alarmingPasses: number;
    openAlarmPasses: number;
    emlAutoReleasePasses: number;
    spectroscopicPasses: number;
    distinctLanes: number;
    distinctNodes: number;
    confirmedIsotopes: string[];
    latestDisposition: string;
}

export interface FederatedVehicleSearchResult {
    rawVehicleId: string;
    normalizedVehicleId: string;
    formattedVehicleId: string;
    matchMode: VehicleSearchMatchMode;
    passes: VehiclePassItem[];
    summary: VehicleIncidentSummary;
    truncated: boolean;
    limitPerNode?: number;
    unreachableNodes: UnreachableFederatedNode[];
}

export interface SearchVehiclePassesOptions {
    vehicleId: string;
    matchMode?: VehicleSearchMatchMode;
    laneMap: Map<string, LaneMapEntry>;
    nodes?: readonly INode[];
    activeViewKey?: string | null;
    startTimeIso?: string | null;
    endTimeIso?: string | null;
    limitPerNode?: number;
    includeProfiles?: boolean;
    signal?: AbortSignal;
    fetchImpl?: typeof fetch;
}

const ISO_6346_NORMALIZED_RE = /^[A-Z]{3}[UJZR][0-9]{7}$/;
const DEFAULT_SEARCH_TIMEOUT_MS = 30_000;
export const DEFAULT_VEHICLE_SEARCH_LIMIT_PER_NODE = 200;
export const LEGACY_FALLBACK_VEHICLE_SEARCH_LIMIT = 100;
export const MAX_HYDRATED_PROFILE_PASSES = 16;

export function normalizeVehicleId(raw: unknown): string {
    if (typeof raw !== "string") return "";
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "-") return "";
    return trimmed.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatVehicleIdDisplay(raw: unknown, normalizedOverride?: string): string {
    const trimmed = typeof raw === "string" && raw.trim() !== "-" ? raw.trim() : "";
    const norm = normalizedOverride !== undefined ? normalizedOverride : normalizeVehicleId(trimmed);
    if (ISO_6346_NORMALIZED_RE.test(norm) && isValidIso6346(norm)) {
        return formatIso6346(norm);
    }
    return trimmed || norm;
}

export function matchesVehicleIdNormalized(
    candidateRawOrNormalized: unknown,
    mode: VehicleSearchMatchMode,
    expectedRawOrNormalized: unknown,
): boolean {
    const cand = normalizeVehicleId(String(candidateRawOrNormalized ?? ""));
    const exp = normalizeVehicleId(String(expectedRawOrNormalized ?? ""));
    switch (mode) {
        case "equals":
            return exp.length > 0 && cand === exp;
        case "contains":
            return exp.length > 0 && cand.includes(exp);
        case "startsWith":
            return exp.length > 0 && cand.startsWith(exp);
        case "notEquals":
            return cand.length > 0 && cand !== exp;
        case "isEmpty":
            return cand.length === 0;
        case "isNotEmpty":
            return cand.length > 0;
        default:
            return false;
    }
}

export function isPassAlarming(pass: Pick<VehiclePassItem, "gammaAlarm" | "neutronAlarm" | "alarmCategoryCode">): boolean {
    if (pass.gammaAlarm || pass.neutronAlarm) return true;
    const cat = (pass.alarmCategoryCode ?? "").trim();
    return cat.length > 0 && cat.toLowerCase() !== "none" && cat.toLowerCase() !== "background";
}

export function isPassOpenAlarm(pass: Pick<VehiclePassItem, "gammaAlarm" | "neutronAlarm" | "alarmCategoryCode" | "emlAutoReleased" | "adjudications">): boolean {
    return isPassAlarming(pass) && !pass.emlAutoReleased && pass.adjudications.length === 0;
}

export function isPassSpectroscopic(
    pass: Pick<VehiclePassItem, "systemType" | "webIdAnalyses" | "adjudications">,
): boolean {
    if (pass.systemType.toLowerCase().includes("spectroscopic") || pass.webIdAnalyses.length > 0) {
        return true;
    }
    return pass.adjudications.some(
        adj => Array.isArray(adj.filePaths) && adj.filePaths.some(isSpectroscopicFilePath),
    );
}

export function buildNodeBucketBaseUrl(
    node: Pick<INode, "address" | "port" | "isSecure" | "isDefaultNode" | "oshPathRoot" | "bucketsEndpoint">,
): string {
    const oshRoot = (node.oshPathRoot ?? "/sensorhub").replace(/\/+$/, "");
    const rawBuckets = node.bucketsEndpoint ?? "/buckets";
    const bucketsPath = rawBuckets.startsWith("/") ? rawBuckets : `/${rawBuckets}`;
    const relative = `${oshRoot}${bucketsPath}`.replace(/\/+$/, "");
    if (node.isDefaultNode && typeof window !== "undefined") {
        return relative;
    }
    const protocol = node.isSecure ? "https://" : "http://";
    return `${protocol}${node.address}:${node.port}${relative}`;
}

export function buildPassCompositeKey(nodeId: string, laneKey: string, occupancyObsId: string): string {
    return `${nodeId}\u001f${laneKey}\u001f${occupancyObsId}`;
}

function resolvePassTimestampMs(pass: Pick<VehiclePassItem, "startTime" | "samplingTime" | "endTime">): number {
    for (const candidate of [pass.startTime, pass.samplingTime, pass.endTime]) {
        if (!candidate) continue;
        const parsed = Date.parse(candidate);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
}

function buildEventRowFromPass(
    raw: {
        nodeId: string;
        nodeName: string;
        laneUid: string;
        laneName: string;
        datastreamId: string;
        occupancyObsId: string;
        occupancyCount: number;
        systemType: string;
        startTime: string;
        endTime: string;
        samplingTime: string;
        gammaAlarm: boolean;
        neutronAlarm: boolean;
        alarmCategoryCode: string;
        emlAutoReleased: boolean;
        maxGammaCount: number;
        maxNeutronCount: number;
        neutronBackground: number;
        vehicleId: string;
        vehicleIdSource: string;
        videoPaths: string[];
        adjudications: VehiclePassAdjudicationSummary[];
    },
    laneEntry: LaneMapEntry | null,
): EventTableData {
    const laneLabel = laneEntry?.laneName || raw.laneName || raw.laneUid || "Lane";
    const parentNodeName = laneEntry?.parentNode?.name || raw.nodeName || raw.nodeId || "OSCAR Node";
    const isRs350 = Boolean(
        laneEntry?.isRS350Backpack
        || raw.systemType.toLowerCase().includes("spectroscopic")
        || raw.systemType.toLowerCase().includes("rs350")
        || Boolean(raw.alarmCategoryCode),
    );

    const adjudicatedIds: string[] = [];
    if (raw.emlAutoReleased) {
        adjudicatedIds.push(EML_NON_THREAT_MARKER);
    }
    for (const adj of raw.adjudications) {
        if (Number.isFinite(adj.adjudicationCode) && adj.adjudicationCode > 0) {
            adjudicatedIds.push(adjudicationCodeMarker(adj.adjudicationCode));
        }
    }

    const startTime = raw.startTime || raw.samplingTime || raw.endTime || new Date(0).toISOString();
    const endTime = raw.endTime || raw.samplingTime || raw.startTime || startTime;
    const rowId = hashString(`${raw.nodeId}|${laneLabel}|${raw.occupancyObsId || raw.occupancyCount}|${startTime}`);
    const event = new EventTableData(
        rowId,
        laneLabel,
        {
            occupancyCount: String(raw.occupancyCount ?? ""),
            startTime,
            endTime,
            maxGamma: raw.maxGammaCount ?? 0,
            maxNeutron: raw.maxNeutronCount ?? 0,
            neutronBackground: raw.neutronBackground ?? 0,
            alarmCategoryCode: raw.alarmCategoryCode || undefined,
            gammaAlarm: Boolean(raw.gammaAlarm),
            neutronAlarm: Boolean(raw.neutronAlarm),
            videoPaths: raw.videoPaths ?? [],
            adjudicatedIds,
        },
        raw.occupancyObsId || "",
        "",
        parentNodeName,
        isRs350,
    );

    const occStream = laneEntry?.datastreams?.find(isOccupancyDataStream);
    const effectiveDsId = raw.datastreamId || occStream?.properties?.id || "";
    if (effectiveDsId) {
        event.setDataStreamId(effectiveDsId);
        if (laneEntry) {
            event.setRPMSystemId(laneEntry.lookupSystemIdFromDataStreamId(effectiveDsId));
        }
    }
    if (laneEntry?.lookupSystemIdFromDataStreamId && raw.laneUid) {
        event.setLaneSystemId(raw.laneUid);
    }
    if (raw.vehicleId) {
        event.setVehicleId(raw.vehicleId, raw.vehicleIdSource === "ocr");
    }
    return event;
}

interface NodeLaneDirectory {
    node: INode;
    lanes: LaneMapEntry[];
    laneSystemUids: Set<string>;
    byDataStreamId: Map<string, LaneMapEntry>;
    byLaneUid: Map<string, LaneMapEntry>;
    byLaneName: Map<string, LaneMapEntry>;
}

function buildNodeDirectories(
    laneMap: Map<string, LaneMapEntry>,
    explicitNodes?: readonly INode[],
): NodeLaneDirectory[] {
    const map = new Map<string, NodeLaneDirectory>();
    for (const lane of laneMap.values()) {
        const node = lane?.parentNode;
        if (!node?.id) continue;
        let dir = map.get(node.id);
        if (!dir) {
            dir = {
                node,
                lanes: [],
                laneSystemUids: new Set(),
                byDataStreamId: new Map(),
                byLaneUid: new Map(),
                byLaneName: new Map(),
            };
            map.set(node.id, dir);
        }
        dir.lanes.push(lane);
        dir.byLaneName.set(lane.laneName, lane);
        const topLaneUid =
            lane.laneSystem?.properties?.properties?.uid
            ?? lane.laneSystem?.properties?.uid;
        if (typeof topLaneUid === "string" && topLaneUid.trim()) {
            dir.laneSystemUids.add(topLaneUid.trim());
            dir.byLaneUid.set(topLaneUid.trim(), lane);
        }
        for (const sys of (lane.systems ?? []) as any[]) {
            const uid = sys?.properties?.properties?.uid ?? sys?.properties?.uid;
            if (typeof uid === "string" && uid.trim()) {
                const trimmedUid = uid.trim();
                dir.byLaneUid.set(trimmedUid, lane);
                if (trimmedUid.startsWith("urn:osh:system:lane:")) {
                    dir.laneSystemUids.add(trimmedUid);
                }
            }
        }
        for (const ds of (lane.datastreams ?? []) as any[]) {
            const dsId = ds?.properties?.id;
            if (typeof dsId === "string" && dsId.trim()) {
                dir.byDataStreamId.set(dsId.trim(), lane);
            }
        }
    }

    if (explicitNodes) {
        for (const node of explicitNodes) {
            if (!node?.id || map.has(node.id)) continue;
            map.set(node.id, {
                node,
                lanes: [],
                laneSystemUids: new Set(),
                byDataStreamId: new Map(),
                byLaneUid: new Map(),
                byLaneName: new Map(),
            });
        }
    }
    return Array.from(map.values());
}

function resolveLaneEntryForPass(
    dir: NodeLaneDirectory,
    datastreamId: string,
    laneUid: string,
    laneName: string,
): LaneMapEntry | null {
    if (datastreamId && dir.byDataStreamId.has(datastreamId)) {
        return dir.byDataStreamId.get(datastreamId) ?? null;
    }
    if (laneUid && dir.byLaneUid.has(laneUid)) {
        return dir.byLaneUid.get(laneUid) ?? null;
    }
    if (laneName && dir.byLaneName.has(laneName)) {
        return dir.byLaneName.get(laneName) ?? null;
    }
    if (laneUid) {
        for (const [knownUid, entry] of dir.byLaneUid.entries()) {
            if (laneUid.startsWith(`${knownUid}:`) || knownUid.startsWith(`${laneUid}:`)) {
                return entry;
            }
        }
    }
    return null;
}

function mapRawServerPass(rawPass: any, dir: NodeLaneDirectory, isRemoteNode: boolean): VehiclePassItem {
    const rawDsId = String(rawPass?.datastreamId ?? "").trim();
    const rawLaneUid = String(rawPass?.laneUid ?? "").trim();
    const rawLaneName = String(rawPass?.laneName ?? "").trim();
    const laneEntry = resolveLaneEntryForPass(dir, rawDsId, rawLaneUid, rawLaneName);

    const nodeId = dir.node.id || String(rawPass?.nodeId ?? "oscar-node");
    const nodeName = dir.node.name || String(rawPass?.nodeName ?? nodeId);
    const laneName = laneEntry?.laneName || rawLaneName || rawLaneUid || "Lane";
    const laneUid = rawLaneUid || laneName;
    const occupancyObsId = String(rawPass?.occupancyObsId ?? "").trim();

    const rawVehicle = String(rawPass?.vehicleId ?? "").trim();
    const normVehicle = normalizeVehicleId(rawPass?.normalizedVehicleId || rawVehicle);
    const formattedVehicle = formatVehicleIdDisplay(rawVehicle, normVehicle);
    const rawSource = String(rawPass?.vehicleIdSource ?? "").toLowerCase();
    const vehicleIdSource: VehiclePassItem["vehicleIdSource"] =
        rawSource === "both" || rawSource === "adjudication" || rawSource === "ocr"
            ? rawSource
            : (normVehicle ? "adjudication" : "none");

    const ocr: VehiclePassOcrSummary | null = rawPass?.ocr && typeof rawPass.ocr === "object"
        ? {
            value: String(rawPass.ocr.value ?? ""),
            normalizedValue: normalizeVehicleId(rawPass.ocr.normalizedValue || rawPass.ocr.value),
            idType: String(rawPass.ocr.idType ?? ""),
            confidence: Number(rawPass.ocr.confidence ?? 0),
            checksumValid: Boolean(rawPass.ocr.checksumValid),
            readCount: Number(rawPass.ocr.readCount ?? 0),
            cameraUid: String(rawPass.ocr.cameraUid ?? ""),
            frameTime: String(rawPass.ocr.frameTime ?? ""),
            evidenceImagePath: String(rawPass.ocr.evidenceImagePath ?? ""),
        }
        : null;

    const eml: VehiclePassEmlSummary | null = rawPass?.eml && typeof rawPass.eml === "object"
        ? {
            decision: String(rawPass.eml.decision ?? ""),
            sourceType: String(rawPass.eml.sourceType ?? ""),
            normProbabilityPct: typeof rawPass.eml.normProbabilityPct === "number" ? rawPass.eml.normProbabilityPct : null,
            threatProbabilityPct: typeof rawPass.eml.threatProbabilityPct === "number" ? rawPass.eml.threatProbabilityPct : null,
        }
        : null;

    const webIdAnalyses: VehiclePassWebIdSummary[] = Array.isArray(rawPass?.webIdAnalyses)
        ? rawPass.webIdAnalyses.map((w: any) => ({
            obsId: String(w?.obsId ?? ""),
            sampleTime: String(w?.sampleTime ?? ""),
            isotopeString: String(w?.isotopeString ?? ""),
            isotopes: Array.isArray(w?.isotopes) ? w.isotopes.map(String) : [],
            drf: String(w?.drf ?? ""),
            estimatedDose: Number(w?.estimatedDose ?? 0),
            chi2: Number(w?.chi2 ?? 0),
            errorMessage: String(w?.errorMessage ?? ""),
            warnings: Array.isArray(w?.warnings) ? w.warnings.map(String) : [],
        }))
        : [];

    const adjudications: VehiclePassAdjudicationSummary[] = Array.isArray(rawPass?.adjudications)
        ? rawPass.adjudications.map((a: any) => ({
            timeUtc: String(a?.timeUtc ?? ""),
            username: String(a?.username ?? "-"),
            adjudicationCode: Number(a?.adjudicationCode ?? 0),
            dispositionLabel: String(a?.dispositionLabel ?? ""),
            dispositionGroup: String(a?.dispositionGroup ?? ""),
            secondaryInspectionStatus: String(a?.secondaryInspectionStatus ?? "-"),
            vehicleId: String(a?.vehicleId ?? ""),
            summary: String(a?.summary ?? ""),
            isotopes: Array.isArray(a?.isotopes) ? a.isotopes.map(String) : [],
            filePaths: Array.isArray(a?.filePaths) ? a.filePaths.map(String) : [],
        }))
        : [];

    const radiationProfile: VehiclePassProfileSample[] = Array.isArray(rawPass?.radiationProfile)
        ? rawPass.radiationProfile.map((s: any) => ({
            timestampMs: Number(s?.timestampMs ?? 0),
            offsetSeconds: Number(s?.offsetSeconds ?? 0),
            gammaCounts: Number(s?.gammaCounts ?? 0),
            neutronCounts: Number(s?.neutronCounts ?? 0),
        }))
        : [];

    const confirmedIsotopes = Array.isArray(rawPass?.confirmedIsotopes)
        ? rawPass.confirmedIsotopes.map(String).filter(Boolean)
        : [];
    const videoPaths = Array.isArray(rawPass?.videoPaths)
        ? rawPass.videoPaths.map(String).filter(Boolean)
        : [];

    const gammaAlarm = Boolean(rawPass?.gammaAlarm);
    const neutronAlarm = Boolean(rawPass?.neutronAlarm);
    const alarmCategoryCode = String(rawPass?.alarmCategoryCode ?? "").trim();
    const emlAutoReleased = Boolean(rawPass?.emlAutoReleased)
        || adjudications.some(a => a.adjudicationCode === EML_NON_THREAT_CODE);
    const systemType = String(rawPass?.systemType ?? "").trim()
        || ((laneEntry?.isRS350Backpack || alarmCategoryCode || webIdAnalyses.length > 0) ? "RS350 Spectroscopic" : "Gross-Counting");

    const startTime = String(rawPass?.startTime ?? "");
    const endTime = String(rawPass?.endTime ?? "");
    const samplingTime = String(rawPass?.samplingTime ?? "");
    const durationSeconds = Number(rawPass?.durationSeconds ?? 0);
    const maxGammaCount = Number(rawPass?.maxGammaCount ?? 0);
    const maxNeutronCount = Number(rawPass?.maxNeutronCount ?? 0);
    const neutronBackground = Number(rawPass?.neutronBackground ?? 0);
    const occupancyCount = Number(rawPass?.occupancyCount ?? 0);
    const alarmStatusLabel = String(rawPass?.alarmStatusLabel ?? "").trim() || (
        gammaAlarm && neutronAlarm
            ? "Gamma + Neutron Alarm"
            : gammaAlarm
                ? "Gamma Alarm"
                : neutronAlarm
                    ? "Neutron Alarm"
                    : alarmCategoryCode
                        ? `RS350: ${alarmCategoryCode}`
                        : "Clear / Non-Alarming"
    );

    const eventRow = buildEventRowFromPass(
        {
            nodeId,
            nodeName,
            laneUid,
            laneName,
            datastreamId: rawDsId,
            occupancyObsId,
            occupancyCount,
            systemType,
            startTime,
            endTime,
            samplingTime,
            gammaAlarm,
            neutronAlarm,
            alarmCategoryCode,
            emlAutoReleased,
            maxGammaCount,
            maxNeutronCount,
            neutronBackground,
            vehicleId: formattedVehicle,
            vehicleIdSource,
            videoPaths,
            adjudications,
        },
        laneEntry,
    );

    return {
        compositeKey: buildPassCompositeKey(nodeId, laneUid || laneName, occupancyObsId || `${occupancyCount}-${startTime}`),
        nodeId,
        nodeName,
        node: dir.node,
        laneEntry,
        federatedRemote: isRemoteNode || Boolean(rawPass?.federatedRemote),
        laneUid,
        laneName,
        datastreamId: eventRow.dataStreamId ?? rawDsId,
        occupancyObsId,
        occupancyCount,
        systemType,
        startTime,
        endTime,
        samplingTime,
        durationSeconds,
        gammaAlarm,
        neutronAlarm,
        alarmCategoryCode,
        alarmStatusLabel,
        emlAutoReleased,
        maxGammaCount,
        maxNeutronCount,
        neutronBackground,
        vehicleId: formattedVehicle,
        normalizedVehicleId: normVehicle,
        vehicleIdSource,
        ocr,
        eml,
        confirmedIsotopes,
        videoPaths,
        webIdAnalyses,
        adjudications,
        radiationProfile,
        eventRow,
    };
}

async function fallbackLegacyConSysVehicleSearch(
    dir: NodeLaneDirectory,
    normalizedQuery: string,
    matchMode: VehicleSearchMatchMode,
    startTimeIso: string,
    isRemoteNode: boolean,
    fetchImpl: typeof fetch,
    signal?: AbortSignal,
): Promise<{passes: VehiclePassItem[]; truncated: boolean; effectiveLimit: number}> {
    if (dir.lanes.length === 0) {
        return {passes: [], truncated: false, effectiveLimit: LEGACY_FALLBACK_VEHICLE_SEARCH_LIMIT};
    }
    const ocrStreams: any[] = [];
    const adjStreams: any[] = [];
    for (const lane of dir.lanes) {
        for (const stream of lane.datastreams ?? []) {
            if (isVehicleOcrDataStream(stream)) {
                ocrStreams.push(stream);
            } else if (isAdjudicationDataStream(stream)) {
                adjStreams.push(stream);
            }
        }
    }
    const effectiveWindowStart = startTimeIso || new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [ocrByObsId, adjudicatedVehicleIdByObsId] = await Promise.all([
        fetchVehicleOcrWindow(ocrStreams, effectiveWindowStart, signal),
        fetchAdjudicatedVehicleIdsWindow(adjStreams, effectiveWindowStart, signal),
    ]);

    const matchedObsIds = new Set<string>();
    for (const [obsId, adjVeh] of adjudicatedVehicleIdByObsId.entries()) {
        if (matchesVehicleIdNormalized(adjVeh, matchMode, normalizedQuery)) {
            matchedObsIds.add(obsId);
        }
    }
    for (const [obsId, ocrRes] of ocrByObsId.entries()) {
        if (matchesVehicleIdNormalized(ocrRes.value, matchMode, normalizedQuery)) {
            matchedObsIds.add(obsId);
        }
    }
    if (matchedObsIds.size === 0) {
        return {passes: [], truncated: false, effectiveLimit: LEGACY_FALLBACK_VEHICLE_SEARCH_LIMIT};
    }

    const csEndpoint = dir.node.getConnectedSystemsEndpoint(false);
    const items: VehiclePassItem[] = [];
    const truncated = matchedObsIds.size > LEGACY_FALLBACK_VEHICLE_SEARCH_LIMIT;
    for (const obsId of Array.from(matchedObsIds).slice(0, LEGACY_FALLBACK_VEHICLE_SEARCH_LIMIT)) {
        if (signal?.aborted) break;
        const resp = await fetchImpl(`${csEndpoint}/observations/${encodeURIComponent(obsId)}`, {
            method: "GET",
            credentials: "include",
            headers: {
                ...dir.node.getBasicAuthHeader(),
                Accept: "application/om+json",
            },
            signal,
        });
        if (!resp.ok) continue;
        const obs = await resp.json();
        const props = obs?.properties ?? obs;
        const res = props?.result ?? obs?.result ?? {};
        const dsId = String(props?.["datastream@id"] ?? "");
        const adjRaw = adjudicatedVehicleIdByObsId.get(obsId) ?? "";
        const ocrRes = ocrByObsId.get(obsId);
        const vehicleId = adjRaw || ocrRes?.value || "";
        const vehicleIdSource = adjRaw && ocrRes?.value ? "both" : adjRaw ? "adjudication" : "ocr";

        items.push(
            mapRawServerPass(
                {
                    nodeId: dir.node.id,
                    nodeName: dir.node.name,
                    datastreamId: dsId,
                    occupancyObsId: obsId,
                    occupancyCount: Number(res.occupancyCount ?? 0),
                    startTime: String(res.startTime ?? ""),
                    endTime: String(res.endTime ?? ""),
                    samplingTime: String(res.samplingTime ?? res.endTime ?? ""),
                    gammaAlarm: Boolean(res.gammaAlarm),
                    neutronAlarm: Boolean(res.neutronAlarm),
                    alarmCategoryCode: String(res.alarmCategoryCode ?? ""),
                    maxGammaCount: Number(res.maxGamma ?? res.maxGammaCount ?? 0),
                    maxNeutronCount: Number(res.maxNeutron ?? res.maxNeutronCount ?? 0),
                    neutronBackground: Number(res.neutronBackground ?? 0),
                    videoPaths: Array.isArray(res.videoPaths) ? res.videoPaths : [],
                    vehicleId,
                    normalizedVehicleId: normalizeVehicleId(vehicleId),
                    vehicleIdSource,
                    ocr: ocrRes
                        ? {
                            value: ocrRes.value,
                            normalizedValue: normalizeVehicleId(ocrRes.value),
                            idType: ocrRes.kind,
                            confidence: ocrRes.confidence,
                            checksumValid: ocrRes.isoChecksumValid,
                            readCount: ocrRes.frameCount,
                            cameraUid: ocrRes.cameraId,
                            frameTime: ocrRes.frameTime ?? ocrRes.time,
                            evidenceImagePath: ocrRes.evidenceImagePath,
                        }
                        : null,
                    adjudications: [],
                },
                dir,
                isRemoteNode,
            ),
        );
    }
    return {passes: items, truncated, effectiveLimit: LEGACY_FALLBACK_VEHICLE_SEARCH_LIMIT};
}

async function querySingleNodeVehiclePasses(
    dir: NodeLaneDirectory,
    options: {
        rawVehicleId: string;
        normalizedVehicleId: string;
        matchMode: VehicleSearchMatchMode;
        scopedLaneUids: string[];
        startTimeIso?: string | null;
        endTimeIso?: string | null;
        limitPerNode: number;
        includeProfiles: boolean;
        isRemoteNode: boolean;
        fetchImpl: typeof fetch;
        signal?: AbortSignal;
    },
): Promise<{passes: VehiclePassItem[]; truncated: boolean; effectiveLimit: number}> {
    const params = new URLSearchParams();
    if (options.rawVehicleId.trim()) {
        params.set("vehicleId", options.rawVehicleId.trim());
    }
    params.set("matchMode", options.matchMode);
    params.set("limit", String(options.limitPerNode));
    if (options.includeProfiles) {
        params.set("includeProfiles", "true");
    }
    if (options.startTimeIso) {
        params.set("startTime", options.startTimeIso);
    }
    if (options.endTimeIso) {
        params.set("endTime", options.endTimeIso);
    }
    if (options.scopedLaneUids.length > 0) {
        params.set("laneUID", options.scopedLaneUids.join(","));
    }

    const url = `${buildNodeBucketBaseUrl(dir.node)}/adjudication/vehicle-search?${params.toString()}`;
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), DEFAULT_SEARCH_TIMEOUT_MS);
    const onParentAbort = () => timeoutController.abort();
    options.signal?.addEventListener("abort", onParentAbort, {once: true});

    try {
        const resp = await options.fetchImpl(url, {
            method: "GET",
            credentials: "include",
            mode: "cors",
            cache: "no-store",
            headers: {
                ...dir.node.getBasicAuthHeader(),
                Accept: "application/json",
            },
            signal: timeoutController.signal,
        });

        if (resp.status === 404 || resp.status === 405) {
            return await fallbackLegacyConSysVehicleSearch(
                dir,
                options.normalizedVehicleId,
                options.matchMode,
                options.startTimeIso ?? "",
                options.isRemoteNode,
                options.fetchImpl,
                timeoutController.signal,
            );
        }

        if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
        }

        const payload = await resp.json();
        const rawPasses = Array.isArray(payload?.passes) ? payload.passes : [];
        const mapped = rawPasses.map((item: any) => mapRawServerPass(item, dir, options.isRemoteNode));
        return {
            passes: mapped,
            truncated: Boolean(payload?.truncated),
            effectiveLimit: options.limitPerNode,
        };
    } finally {
        clearTimeout(timeoutId);
        options.signal?.removeEventListener("abort", onParentAbort);
    }
}

export function summarizeVehiclePasses(passes: readonly VehiclePassItem[]): VehicleIncidentSummary {
    let alarmingPasses = 0;
    let openAlarmPasses = 0;
    let emlAutoReleasePasses = 0;
    let spectroscopicPasses = 0;
    const lanes = new Set<string>();
    const nodes = new Set<string>();
    const isotopes = new Set<string>();
    let latestDisposition = "No Adjudications";

    for (const pass of passes) {
        if (isPassAlarming(pass)) alarmingPasses += 1;
        if (isPassOpenAlarm(pass)) openAlarmPasses += 1;
        if (pass.emlAutoReleased) emlAutoReleasePasses += 1;
        if (isPassSpectroscopic(pass)) {
            spectroscopicPasses += 1;
        }
        lanes.add(`${pass.nodeId}|${pass.laneUid || pass.laneName}`);
        nodes.add(pass.nodeId);
        for (const iso of pass.confirmedIsotopes) {
            if (iso) isotopes.add(iso);
        }
        const latestAdj = pass.adjudications[pass.adjudications.length - 1];
        if (latestAdj?.dispositionLabel) {
            latestDisposition = latestAdj.dispositionLabel;
        } else if (pass.emlAutoReleased && latestDisposition === "No Adjudications") {
            latestDisposition = "9999 (EML Non-Threat)";
        }
    }
    if (openAlarmPasses > 0 && latestDisposition === "No Adjudications") {
        latestDisposition = `Open / Unadjudicated (${openAlarmPasses})`;
    }

    return {
        totalPasses: passes.length,
        alarmingPasses,
        openAlarmPasses,
        emlAutoReleasePasses,
        spectroscopicPasses,
        distinctLanes: lanes.size,
        distinctNodes: Math.max(nodes.size, passes.length > 0 ? 1 : 0),
        confirmedIsotopes: Array.from(isotopes),
        latestDisposition,
    };
}

export async function searchVehiclePassesAcrossNodes(
    options: SearchVehiclePassesOptions,
): Promise<FederatedVehicleSearchResult> {
    const rawVehicleId = String(options.vehicleId ?? "").trim();
    const normalizedVehicleId = normalizeVehicleId(rawVehicleId);
    const matchMode: VehicleSearchMatchMode = options.matchMode
        ?? (normalizedVehicleId ? "equals" : "isNotEmpty");
    const fetchImpl = options.fetchImpl ?? fetch;
    const limitPerNode = options.limitPerNode ?? DEFAULT_VEHICLE_SEARCH_LIMIT_PER_NODE;
    const includeProfiles = Boolean(options.includeProfiles);

    if (
        (matchMode === "equals" || matchMode === "contains" || matchMode === "startsWith")
        && normalizedVehicleId.length === 0
    ) {
        return {
            rawVehicleId,
            normalizedVehicleId,
            formattedVehicleId: "",
            matchMode,
            passes: [],
            summary: summarizeVehiclePasses([]),
            truncated: false,
            limitPerNode,
            unreachableNodes: [],
        };
    }

    const directories = buildNodeDirectories(options.laneMap, options.nodes);
    const primaryNodeId = directories.find(d => d.node.isDefaultNode)?.node.id ?? directories[0]?.node.id ?? "";

    const outcomes = await Promise.allSettled(
        directories.map(dir => {
            const scopedLaneUids = options.activeViewKey
                ? (dir.laneSystemUids.size > 0
                    ? Array.from(dir.laneSystemUids)
                    : Array.from(dir.byLaneUid.keys()))
                : [];
            return querySingleNodeVehiclePasses(dir, {
                rawVehicleId,
                normalizedVehicleId,
                matchMode,
                scopedLaneUids,
                startTimeIso: options.startTimeIso,
                endTimeIso: options.endTimeIso,
                limitPerNode,
                includeProfiles,
                isRemoteNode: Boolean(primaryNodeId && dir.node.id !== primaryNodeId),
                fetchImpl,
                signal: options.signal,
            });
        }),
    );

    if (options.signal?.aborted) {
        const abortErr = new Error("Vehicle search aborted");
        abortErr.name = "AbortError";
        throw abortErr;
    }

    const mergedByKey = new Map<string, VehiclePassItem>();
    const unreachableNodes: UnreachableFederatedNode[] = [];
    let truncated = false;
    let effectiveLimitPerNode = limitPerNode;

    outcomes.forEach((outcome, index) => {
        const dir = directories[index];
        if (outcome.status === "fulfilled") {
            if (outcome.value.truncated) {
                truncated = true;
                effectiveLimitPerNode = Math.min(effectiveLimitPerNode, outcome.value.effectiveLimit);
            }
            for (const pass of outcome.value.passes) {
                if (!mergedByKey.has(pass.compositeKey)) {
                    mergedByKey.set(pass.compositeKey, pass);
                }
            }
        } else {
            unreachableNodes.push({
                nodeId: dir.node.id,
                nodeName: dir.node.name || dir.node.id,
                reason: outcome.reason instanceof Error ? outcome.reason.message : "Unreachable",
            });
        }
    });

    const passes = Array.from(mergedByKey.values()).sort((left, right) => {
        const diff = resolvePassTimestampMs(left) - resolvePassTimestampMs(right);
        if (diff !== 0) return diff;
        return left.occupancyCount - right.occupancyCount;
    });

    return {
        rawVehicleId,
        normalizedVehicleId,
        formattedVehicleId: formatVehicleIdDisplay(rawVehicleId, normalizedVehicleId),
        matchMode,
        passes,
        summary: summarizeVehiclePasses(passes),
        truncated,
        limitPerNode: effectiveLimitPerNode,
        unreachableNodes,
    };
}

export async function hydrateVehiclePassProfiles(options: {
    passes: readonly VehiclePassItem[];
    vehicleId?: string;
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
}): Promise<{passes: VehiclePassItem[]; usedFastPath: boolean}> {
    const fetchImpl = options.fetchImpl ?? fetch;
    const allPasses = Array.from(options.passes);
    if (allPasses.length === 0) {
        return {passes: [], usedFastPath: true};
    }

    const candidates = allPasses
        .filter(p => Boolean(p.node) && Boolean(p.occupancyObsId))
        .slice(-MAX_HYDRATED_PROFILE_PASSES);
    if (candidates.length === 0) {
        return {passes: allPasses, usedFastPath: false};
    }

    const byNodeId = new Map<string, {node: INode; obsIds: string[]}>();
    for (const pass of candidates) {
        if (!pass.node) continue;
        const nodeKey = pass.node.id || pass.nodeId;
        let group = byNodeId.get(nodeKey);
        if (!group) {
            group = {node: pass.node, obsIds: []};
            byNodeId.set(nodeKey, group);
        }
        if (!group.obsIds.includes(pass.occupancyObsId)) {
            group.obsIds.push(pass.occupancyObsId);
        }
    }

    const profileMapByNodeObs = new Map<string, VehiclePassProfileSample[]>();
    let anyNodeUnsupported = false;

    await Promise.all(
        Array.from(byNodeId.entries()).map(async ([nodeKey, group]) => {
            const params = new URLSearchParams();
            params.set("profileOnlyObsIds", group.obsIds.join(","));
            params.set("includeProfiles", "true");
            if (options.vehicleId?.trim()) {
                params.set("vehicleId", options.vehicleId.trim());
            }
            const url = `${buildNodeBucketBaseUrl(group.node)}/adjudication/vehicle-search?${params.toString()}`;
            const timeoutController = new AbortController();
            const timeoutId = setTimeout(() => timeoutController.abort(), DEFAULT_SEARCH_TIMEOUT_MS);
            const onParentAbort = () => timeoutController.abort();
            options.signal?.addEventListener("abort", onParentAbort, {once: true});
            try {
                const resp = await fetchImpl(url, {
                    method: "GET",
                    credentials: "include",
                    mode: "cors",
                    cache: "no-store",
                    headers: {
                        ...group.node.getBasicAuthHeader(),
                        Accept: "application/json",
                    },
                    signal: timeoutController.signal,
                });
                if (resp.status === 400 || resp.status === 404 || resp.status === 405) {
                    anyNodeUnsupported = true;
                    return;
                }
                if (!resp.ok) {
                    throw new Error(`HTTP ${resp.status}`);
                }
                const payload = await resp.json();
                const rawPasses = Array.isArray(payload?.passes) ? payload.passes : [];
                for (const rawPass of rawPasses) {
                    const occId = String(rawPass?.occupancyObsId ?? "").trim();
                    if (!occId || !Array.isArray(rawPass?.radiationProfile)) continue;
                    const samples: VehiclePassProfileSample[] = rawPass.radiationProfile.map((s: any) => ({
                        timestampMs: Number(s?.timestampMs ?? 0),
                        offsetSeconds: Number(s?.offsetSeconds ?? 0),
                        gammaCounts: Number(s?.gammaCounts ?? 0),
                        neutronCounts: Number(s?.neutronCounts ?? 0),
                    }));
                    profileMapByNodeObs.set(`${nodeKey}|${occId}`, samples);
                }
            } finally {
                clearTimeout(timeoutId);
                options.signal?.removeEventListener("abort", onParentAbort);
            }
        }),
    );

    if (anyNodeUnsupported) {
        return {passes: allPasses, usedFastPath: false};
    }

    const updated = allPasses.map((pass) => {
        const nodeKey = pass.node?.id || pass.nodeId;
        const hydrated = profileMapByNodeObs.get(`${nodeKey}|${pass.occupancyObsId}`);
        if (!hydrated) return pass;
        return {
            ...pass,
            radiationProfile: hydrated,
        };
    });
    return {passes: updated, usedFastPath: true};
}

export function serializeFederatedRemotePasses(
    passes: readonly VehiclePassItem[],
    hostNodeId: string,
): Array<Record<string, unknown>> {
    return passes
        .filter(pass => pass.nodeId && pass.nodeId !== hostNodeId)
        .map(pass => ({
            nodeId: pass.nodeId,
            nodeName: pass.nodeName,
            laneUid: pass.laneUid,
            laneName: pass.laneName,
            datastreamId: pass.datastreamId,
            occupancyObsId: pass.occupancyObsId,
            occupancyCount: pass.occupancyCount,
            systemType: pass.systemType,
            startTime: pass.startTime,
            endTime: pass.endTime,
            samplingTime: pass.samplingTime,
            durationSeconds: pass.durationSeconds,
            gammaAlarm: pass.gammaAlarm,
            neutronAlarm: pass.neutronAlarm,
            alarmCategoryCode: pass.alarmCategoryCode,
            alarmStatusLabel: pass.alarmStatusLabel,
            emlAutoReleased: pass.emlAutoReleased,
            maxGammaCount: pass.maxGammaCount,
            maxNeutronCount: pass.maxNeutronCount,
            neutronBackground: pass.neutronBackground,
            vehicleId: pass.vehicleId,
            normalizedVehicleId: pass.normalizedVehicleId,
            vehicleIdSource: pass.vehicleIdSource,
            ...(pass.ocr ? {ocr: pass.ocr} : {}),
            ...(pass.eml ? {eml: pass.eml} : {}),
            confirmedIsotopes: pass.confirmedIsotopes,
            videoPaths: pass.videoPaths,
            webIdAnalyses: pass.webIdAnalyses,
            adjudications: pass.adjudications,
        }));
}

export function buildVehicleIncidentReportSpec(params: {
    vehicleId: string;
    matchMode?: VehicleSearchMatchMode;
    laneUIDs?: readonly string[];
    includeProfiles?: boolean;
    federatedPasses?: ReadonlyArray<Record<string, unknown>>;
}): string {
    const payload: Record<string, unknown> = {
        vehicleId: params.vehicleId.trim(),
        matchMode: params.matchMode ?? (normalizeVehicleId(params.vehicleId) ? "equals" : "isNotEmpty"),
        includeProfiles: params.includeProfiles ?? true,
    };
    if (params.laneUIDs && params.laneUIDs.length > 0) {
        payload.laneUID = params.laneUIDs.join(",");
    }
    if (params.federatedPasses && params.federatedPasses.length > 0) {
        payload.federatedPasses = params.federatedPasses;
    }
    return JSON.stringify(payload);
}

export async function submitVehicleIncidentReport(params: {
    hostNode: INode;
    startTimeIso: string;
    endTimeIso: string;
    format: ReportOutputFormat;
    vehicleId: string;
    matchMode?: VehicleSearchMatchMode;
    laneUIDs?: readonly string[];
    remotePasses?: readonly VehiclePassItem[];
    signal?: AbortSignal;
}): Promise<{reportUrl: string; downloadUrl: string; format: ReportOutputFormat}> {
    const {hostNode, startTimeIso, endTimeIso, format, signal} = params;
    let streams: any[] = [];
    if (hostNode.oscarServiceSystem != null) {
        const query = await hostNode.oscarServiceSystem.searchControlStreams(
            new ControlStreamFilter({validTime: "latest"}),
            100,
        );
        const results = await query.nextPage();
        if (results?.length > 0) {
            streams = results;
        }
    } else {
        streams = await hostNode.fetchNodeControlStreams();
    }

    const controlStream = streams.find((s: any) => isReportControlStream(s));
    if (!controlStream) {
        throw new Error("Report control stream unavailable on selected node");
    }

    const federatedPasses = params.remotePasses
        ? serializeFederatedRemotePasses(params.remotePasses, hostNode.id)
        : [];
    const specJson = buildVehicleIncidentReportSpec({
        vehicleId: params.vehicleId,
        matchMode: params.matchMode ?? "equals",
        laneUIDs: params.laneUIDs,
        includeProfiles: true,
        federatedPasses,
    });

    const response = await sendCommand(
        hostNode,
        controlStream.properties.id,
        generateReportCommandJSON(
            startTimeIso,
            endTimeIso,
            "VEHICLE_INCIDENT",
            specJson,
            "NONE",
            format,
        ),
        {signal},
    );
    if (!response.ok) {
        throw new Error(`Report command returned HTTP ${response.status}`);
    }
    const json = await response.json();
    const buildReportUrl = (reportPath: string): {reportUrl: string; downloadUrl: string; format: ReportOutputFormat} => {
        const cleanPath = String(reportPath).replace(/^\/+/, "");
        const bucketBase = buildNodeBucketBaseUrl(hostNode);
        const reportUrl = `${bucketBase}/${cleanPath}`;
        const separator = reportUrl.includes("?") ? "&" : "?";
        return {
            reportUrl,
            downloadUrl: `${reportUrl}${separator}download=1`,
            format,
        };
    };

    if (json.statusCode === "ACCEPTED" || json.statusCode === "COMPLETED") {
        const reportPath = json?.results?.[0]?.data?.reportPath;
        if (!reportPath) throw new Error("Missing reportPath in report command result");
        return buildReportUrl(reportPath);
    }

    if (json.statusCode === "PENDING") {
        const commandId = json["command@id"];
        const controlStreamId = controlStream.properties.id;
        const deadline = Date.now() + 45_000;
        while (Date.now() < deadline) {
            if (signal?.aborted) {
                const abortErr = new Error("Aborted");
                abortErr.name = "AbortError";
                throw abortErr;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
            const statuses = await fetchCommandStatuses(hostNode, controlStreamId, commandId, {signal});
            for (const item of statuses) {
                if (item?.statusCode === "ACCEPTED" || item?.statusCode === "COMPLETED") {
                    const reportPath = item?.results?.[0]?.data?.reportPath;
                    if (!reportPath) throw new Error("Missing reportPath in completed status");
                    return buildReportUrl(reportPath);
                }
                if (item?.statusCode === "FAILED" || item?.statusCode === "REJECTED" || item?.statusCode === "CANCELED") {
                    throw new Error(`Report command failed (${item.statusCode})`);
                }
            }
        }
        throw new Error("Timed out waiting for vehicle incident report");
    }

    throw new Error(`Unexpected command status: ${json.statusCode ?? "UNKNOWN"}`);
}
