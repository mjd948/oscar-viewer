import {hashString} from "@/app/utils/Utils";
import {LaneMapEntry} from "@/lib/data/oscar/LaneCollection";
import {EventTableData} from "@/lib/data/oscar/TableHelpers";
import {isOccupancyDataStream} from "@/lib/data/oscar/Utilities";
import {INode} from "@/lib/data/osh/Node";

export const MAX_EVENT_OBSERVATION_ID_LENGTH = 128;
export const EVENT_LOOKUP_REQUEST_TIMEOUT_MS = 25000;

const NOT_FOUND_HTTP_STATUSES = new Set([400, 404, 410]);

export type EventLookupErrorCode = "invalid" | "not-found" | "unavailable" | "ambiguous";

export class EventLookupError extends Error {
    readonly code: EventLookupErrorCode;

    constructor(code: EventLookupErrorCode, message: string) {
        super(message);
        this.name = "EventLookupError";
        this.code = code;
    }
}

export interface EventLookupResult {
    event: EventTableData;
    lane: LaneMapEntry;
    nodeId: string;
}

export type EventLookupFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface NodeLookupCandidate {
    node: INode;
    lanesByDataStreamId: Map<string, LaneMapEntry>;
}

function abortError(): Error {
    const error = new Error("The event lookup was cancelled.");
    error.name = "AbortError";
    return error;
}

async function runWithRequestDeadline<T>(
    operation: (requestSignal: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
    timeoutMs = EVENT_LOOKUP_REQUEST_TIMEOUT_MS,
): Promise<T> {
    if (signal?.aborted) throw abortError();

    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let handleAbort: (() => void) | undefined;
    const request = Promise.resolve().then(() => operation(controller.signal));
    const timeout = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
            controller.abort();
            reject(new EventLookupError("unavailable", "The OSCAR node did not respond in time."));
        }, Math.max(1, timeoutMs));
    });
    const cancellation = new Promise<T>((_, reject) => {
        if (!signal) return;
        handleAbort = () => {
            controller.abort();
            reject(abortError());
        };
        signal.addEventListener("abort", handleAbort, {once: true});
    });

    try {
        return await Promise.race([request, timeout, cancellation]);
    } catch (error) {
        if (signal?.aborted) throw error;
        if (error instanceof EventLookupError) throw error;
        throw new EventLookupError("unavailable", "The OSCAR node lookup failed.");
    } finally {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
        if (signal && handleAbort) signal.removeEventListener("abort", handleAbort);
    }
}

export function normalizeEventObservationId(value: unknown): string {
    if (typeof value !== "string")
        throw new EventLookupError("invalid", "The occupancy observation ID must be text.");

    const normalized = value.trim();
    if (!normalized || normalized.length > MAX_EVENT_OBSERVATION_ID_LENGTH)
        throw new EventLookupError(
            "invalid",
            `The occupancy observation ID must contain 1-${MAX_EVENT_OBSERVATION_ID_LENGTH} characters.`,
        );

    return normalized;
}

/**
 * Builds an application-relative deep link. Operational-view scoping is added
 * by DataSourceContext.scopedHref at the call site.
 */
export function buildEventDetailsHref(
    eventId: string,
    nodeId?: string | null,
    fromFiltered?: boolean,
): string {
    const params = new URLSearchParams({eventId: normalizeEventObservationId(eventId)});
    if (nodeId?.trim()) params.set("nodeId", nodeId.trim());
    if (fromFiltered) params.set("fromFiltered", "1");
    return `/event-details?${params.toString()}`;
}

/**
 * Converts a Connected Systems API occupancy observation into the shared
 * Viewer event model. Both raw REST objects and osh-js Observation wrappers
 * are accepted so list and direct-resource requests use identical mapping.
 */
export function createEventFromOccupancyObservation(
    observation: any,
    lane: LaneMapEntry,
    includeObservationId = true,
): EventTableData {
    const properties = observation?.properties ?? observation;
    const result = properties?.result ?? observation?.result ?? observation;
    const observationId = String(observation?.id ?? properties?.id ?? "");
    const dataStreamId = properties?.["datastream@id"] ?? observation?.["datastream@id"];
    const foiId = properties?.["foi@id"]
        ?? properties?.foiId
        ?? observation?.["foi@id"]
        ?? observation?.foiId;
    const id = hashString(`${result.occupancyCount}${lane.laneName}${result.startTime}${result.endTime}`);
    const event = new EventTableData(
        id,
        lane.laneName,
        result,
        includeObservationId ? observationId : null,
        foiId,
        lane.parentNode.name,
        lane.isRS350Backpack,
    );

    if (dataStreamId) {
        event.setDataStreamId(dataStreamId);
        event.setRPMSystemId(lane.lookupSystemIdFromDataStreamId(dataStreamId));
    }
    event.setFoiId(foiId);
    if (includeObservationId && observationId) event.setOccupancyObsId(observationId);
    return event;
}

function visibleNodeCandidates(
    laneMap: Map<string, LaneMapEntry>,
    requestedNodeId?: string | null,
): NodeLookupCandidate[] {
    const candidates = new Map<string, NodeLookupCandidate>();

    for (const lane of laneMap.values()) {
        const node = lane.parentNode;
        if (requestedNodeId && node.id !== requestedNodeId) continue;

        for (const stream of lane.datastreams.filter(isOccupancyDataStream)) {
            let candidate = candidates.get(node.id);
            if (!candidate) {
                candidate = {node, lanesByDataStreamId: new Map()};
                candidates.set(node.id, candidate);
            }
            candidate.lanesByDataStreamId.set(stream.properties.id, lane);
        }
    }

    return Array.from(candidates.values());
}

async function lookupOnNode(
    candidate: NodeLookupCandidate,
    eventId: string,
    fetchImpl: EventLookupFetch,
    signal?: AbortSignal,
    requestTimeoutMs = EVENT_LOOKUP_REQUEST_TIMEOUT_MS,
): Promise<EventLookupResult | null> {
    const endpoint = candidate.node.getConnectedSystemsEndpoint(false);
    return runWithRequestDeadline(
        async requestSignal => {
            const response = await fetchImpl(
                `${endpoint}/observations/${encodeURIComponent(eventId)}`,
                {
                    credentials: "include",
                    headers: {
                        ...candidate.node.getBasicAuthHeader(),
                        Accept: "application/om+json",
                    },
                    signal: requestSignal,
                },
            );

            if (NOT_FOUND_HTTP_STATUSES.has(response.status)) return null;
            if (!response.ok)
                throw new EventLookupError("unavailable", `Observation lookup returned HTTP ${response.status}`);

            const observation = await response.json();
            const properties = observation?.properties ?? observation;
            const dataStreamId = properties?.["datastream@id"] ?? observation?.["datastream@id"];
            const lane = candidate.lanesByDataStreamId.get(dataStreamId);

            // An ID can identify another kind of observation, or an occupancy outside
            // the current operational view. Both must fail closed as not found.
            if (!lane) return null;

            return {
                event: createEventFromOccupancyObservation(observation, lane),
                lane,
                nodeId: candidate.node.id,
            };
        },
        signal,
        requestTimeoutMs,
    );
}

/**
 * Resolves an occupancy by its durable observation ID without enumerating the
 * event table. With no nodeId, at most one direct resource request is made per
 * distinct node represented by the active (and therefore scoped) lane map.
 */
export async function lookupEventByObservationId(
    laneMap: Map<string, LaneMapEntry>,
    rawEventId: unknown,
    requestedNodeId?: string | null,
    fetchImpl: EventLookupFetch = fetch,
    signal?: AbortSignal,
    requestTimeoutMs = EVENT_LOOKUP_REQUEST_TIMEOUT_MS,
): Promise<EventLookupResult> {
    const eventId = normalizeEventObservationId(rawEventId);
    const candidates = visibleNodeCandidates(laneMap, requestedNodeId?.trim() || null);
    if (candidates.length === 0)
        throw new EventLookupError("not-found", "The occupancy is not available in this view.");

    const outcomes = await Promise.allSettled(
        candidates.map(candidate => lookupOnNode(
            candidate,
            eventId,
            fetchImpl,
            signal,
            requestTimeoutMs,
        )),
    );
    const matches = outcomes.flatMap(outcome =>
        outcome.status === "fulfilled" && outcome.value ? [outcome.value] : []);

    if (matches.length > 1)
        throw new EventLookupError("ambiguous", "The occupancy ID exists on more than one node.");
    if (matches.length === 1) return matches[0];
    if (outcomes.some(outcome => outcome.status === "rejected"))
        throw new EventLookupError("unavailable", "One or more OSCAR nodes could not be searched.");

    throw new EventLookupError("not-found", "The occupancy was not found.");
}

function sameTimestampInstant(left: unknown, right: unknown): boolean {
    if (typeof left !== "string" || typeof right !== "string") return false;
    if (left === right) return true;
    const leftMs = Date.parse(left);
    const rightMs = Date.parse(right);
    return Number.isFinite(leftMs) && Number.isFinite(rightMs) && leftMs === rightMs;
}

/**
 * Resolves the durable ID for a freshly received realtime event. Realtime
 * messages can arrive before the REST resource ID is known, and JavaScript
 * `toISOString()` pads trailing millisecond zeros (`.530Z`, `.000Z`) that
 * SensorHub's JSON serializer trims (`.53Z`, `Z`). Try the exact `filter`
 * lookup first and fall back to a bounded `phenomenonTime` scan matched by
 * parsed epoch milliseconds when trailing-zero formatting differs.
 */
export async function resolveEventObservationId(
    event: EventTableData,
    lane: LaneMapEntry,
    fetchImpl: EventLookupFetch = fetch,
    signal?: AbortSignal,
    requestTimeoutMs = EVENT_LOOKUP_REQUEST_TIMEOUT_MS,
): Promise<string> {
    if (event.occupancyObsId) return normalizeEventObservationId(event.occupancyObsId);

    const occupancyStreams = lane.datastreams.filter(isOccupancyDataStream);
    const stream = occupancyStreams.find(candidate => candidate.properties.id === event.dataStreamId)
        ?? occupancyStreams.find(candidate => candidate.properties["system@id"] === event.rpmSystemId)
        ?? (occupancyStreams.length === 1 ? occupancyStreams[0] : undefined);
    if (!stream)
        throw new EventLookupError("unavailable", "The occupancy datastream is unavailable.");

    const findMatchingObservation = (items: unknown): any => {
        const observations = Array.isArray(items) ? items : [];
        return observations.find((observation: any) => {
            const properties = observation?.properties ?? observation;
            const result = properties?.result ?? observation?.result;
            return properties?.["datastream@id"] === stream.properties.id
                && sameTimestampInstant(result?.startTime, event.startTime)
                && sameTimestampInstant(result?.endTime, event.endTime);
        });
    };

    const fetchObservationsPage = async (params: URLSearchParams, requestSignal: AbortSignal) => {
        const response = await fetchImpl(
            `${lane.parentNode.getConnectedSystemsEndpoint(false)}/observations?${params}`,
            {
                credentials: "include",
                headers: {
                    ...lane.parentNode.getBasicAuthHeader(),
                    Accept: "application/om+json",
                },
                signal: requestSignal,
            },
        );
        if (NOT_FOUND_HTTP_STATUSES.has(response.status))
            throw new EventLookupError("not-found", "The occupancy observation is not available yet.");
        if (!response.ok)
            throw new EventLookupError("unavailable", `Observation lookup returned HTTP ${response.status}`);
        return response.json();
    };

    const exactParams = new URLSearchParams({
        dataStream: stream.properties.id,
        filter: `startTime='${event.startTime}' AND endTime='${event.endTime}'`,
        format: "application/om+json",
        order: "desc",
        limit: "1",
    });
    return runWithRequestDeadline(
        async requestSignal => {
            const payload = await fetchObservationsPage(exactParams, requestSignal);
            let matching = findMatchingObservation(payload?.items);

            if (!matching?.id) {
                const startMs = Date.parse(event.startTime);
                const endMs = Date.parse(event.endTime);
                if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
                    const lowIso = new Date(Math.max(0, Math.min(startMs, endMs) - 2000)).toISOString();
                    const highIso = new Date(Math.max(startMs, endMs) + 5000).toISOString();
                    const rangeParams = new URLSearchParams({
                        dataStream: stream.properties.id,
                        phenomenonTime: `${lowIso}/${highIso}`,
                        format: "application/om+json",
                        order: "desc",
                        limit: "25",
                    });
                    const rangePayload = await fetchObservationsPage(rangeParams, requestSignal);
                    matching = findMatchingObservation(rangePayload?.items);
                }
            }

            if (!matching?.id)
                throw new EventLookupError("not-found", "The occupancy observation is not available yet.");

            return normalizeEventObservationId(matching.id);
        },
        signal,
        requestTimeoutMs,
    );
}
