export const OPERATIONAL_VIEW_KEYWORD_PREFIX = "oscar:view:";
export const OPERATIONAL_VIEW_KEY_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export interface OperationalViewSelection {
    key: string | null;
    error: "invalid" | null;
}

export interface OperationalViewLane {
    uid: string;
    name: string;
}

export interface OperationalViewCatalog {
    lanes: OperationalViewLane[];
    views: Map<string, OperationalViewLane[]>;
}

export interface OperationalViewOption {
    key: string;
    laneCount: number | null;
}

export interface ScopedViewDropdownState {
    mode: "hidden" | "badge" | "dropdown";
    includeAllLanes: boolean;
    options: OperationalViewOption[];
}

export const ALL_LANES_SELECT_VALUE = "__all__";

export function emptyOperationalViewCatalog(): OperationalViewCatalog {
    return {lanes: [], views: new Map()};
}

export function mergeOperationalViewCatalogs(
    catalogs: readonly OperationalViewCatalog[],
): { options: OperationalViewOption[]; totalLaneCount: number } {
    const allLaneKeys = new Set<string>();
    const viewLaneSets = new Map<string, Set<string>>();

    catalogs.forEach((catalog, catalogIndex) => {
        catalog.lanes.forEach((lane) => {
            allLaneKeys.add(`${catalogIndex}:${lane.uid}`);
        });
        catalog.views.forEach((lanes, viewKey) => {
            if (!OPERATIONAL_VIEW_KEY_PATTERN.test(viewKey)) return;
            let set = viewLaneSets.get(viewKey);
            if (!set) {
                set = new Set<string>();
                viewLaneSets.set(viewKey, set);
            }
            lanes.forEach((lane) => {
                set!.add(`${catalogIndex}:${lane.uid}`);
            });
        });
    });

    const options: OperationalViewOption[] = [...viewLaneSets.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, laneSet]) => ({
            key,
            laneCount: laneSet.size,
        }));

    return {
        options,
        totalLaneCount: allLaneKeys.size,
    };
}

export function resolveScopedViewDropdownState(params: {
    availableViews: readonly OperationalViewOption[];
    allowedViews?: readonly string[];
    activeViewKey: string | null;
    viewError?: "invalid" | "empty" | "unauthorized" | null;
}): ScopedViewDropdownState {
    const countByView = new Map<string, number | null>(
        params.availableViews.map((item) => [item.key, item.laneCount]),
    );
    const normalizedAllowed = (params.allowedViews ?? [])
        .map((v) => v.trim())
        .filter((v) => OPERATIONAL_VIEW_KEY_PATTERN.test(v));

    if (normalizedAllowed.length > 0) {
        const uniqueAllowed = Array.from(new Set(normalizedAllowed));
        const options: OperationalViewOption[] = uniqueAllowed.map((key) => ({
            key,
            laneCount: countByView.has(key) ? (countByView.get(key) ?? null) : null,
        }));

        // If restricted to 1 view and currently on that valid view without an authorization error,
        // display a clean read-only badge; if 2+ allowed views or recovering from an unauthorized URL,
        // offer the dropdown strictly limited to the user's permitted views (never "All Lanes").
        if (options.length === 1 && !params.viewError && params.activeViewKey === options[0].key) {
            return {
                mode: "badge",
                includeAllLanes: false,
                options,
            };
        }
        return {
            mode: "dropdown",
            includeAllLanes: false,
            options,
        };
    }

    const mergedOptions: OperationalViewOption[] = [...params.availableViews];
    if (
        params.activeViewKey
        && OPERATIONAL_VIEW_KEY_PATTERN.test(params.activeViewKey)
        && !countByView.has(params.activeViewKey)
    ) {
        mergedOptions.push({key: params.activeViewKey, laneCount: 0});
        mergedOptions.sort((a, b) => a.key.localeCompare(b.key));
    }

    if (mergedOptions.length === 0 && !params.activeViewKey && !params.viewError) {
        return {
            mode: "hidden",
            includeAllLanes: true,
            options: [],
        };
    }

    return {
        mode: "dropdown",
        includeAllLanes: true,
        options: mergedOptions,
    };
}

const SINGLE_ENTITY_VIEW_ROUTES = new Set<string>([
    "/lane-view",
    "/lane-view/",
    "/event-preview",
    "/event-preview/",
    "/quick-view",
    "/quick-view/",
]);

const EVENT_DETAILS_VIEW_ROUTES = new Set<string>([
    "/event-details",
    "/event-details/",
]);

export function resolveRouteForViewSwitch(
    pathname: string,
    currentSearch: string,
    nextViewKey: string | null,
): string {
    const cleanPath = pathname || "/";
    if (EVENT_DETAILS_VIEW_ROUTES.has(cleanPath)) {
        return withOperationalView("/event-log", nextViewKey);
    }
    if (SINGLE_ENTITY_VIEW_ROUTES.has(cleanPath)) {
        return withOperationalView("/", nextViewKey);
    }

    const url = new URL(cleanPath, "https://oscar.local");
    const params = new URLSearchParams(currentSearch);
    params.delete("view");
    params.forEach((value, key) => {
        url.searchParams.append(key, value);
    });
    if (nextViewKey !== null) {
        url.searchParams.set("view", nextViewKey);
    }
    return `${url.pathname}${url.search}`;
}

export function parseOperationalView(search: string): OperationalViewSelection {
    const params = new URLSearchParams(search);
    if (!params.has("view"))
        return {key: null, error: null};

    if (params.getAll("view").length !== 1)
        return {key: null, error: "invalid"};

    const key = params.get("view") ?? "";
    if (!OPERATIONAL_VIEW_KEY_PATTERN.test(key))
        return {key: null, error: "invalid"};

    return {key, error: null};
}

export function getOperationalViewKeys(system: any): string[] {
    const keywords = system?.properties?.properties?.keywords;
    if (!Array.isArray(keywords))
        return [];

    return keywords
        .filter((keyword): keyword is string => typeof keyword === "string")
        .filter((keyword) => keyword.startsWith(OPERATIONAL_VIEW_KEYWORD_PREFIX))
        .map((keyword) => keyword.substring(OPERATIONAL_VIEW_KEYWORD_PREFIX.length));
}

export function buildOperationalViewCatalog(systems: any[]): OperationalViewCatalog {
    const lanes: OperationalViewLane[] = [];
    const views = new Map<string, OperationalViewLane[]>();

    systems.forEach((system) => {
        const uid = system?.properties?.properties?.uid;
        if (typeof uid !== "string" || !uid.startsWith("urn:osh:system:lane:"))
            return;

        const lane = {
            uid,
            name: system?.properties?.properties?.name || uid,
        };
        lanes.push(lane);

        getOperationalViewKeys(system).forEach((key) => {
            if (!OPERATIONAL_VIEW_KEY_PATTERN.test(key))
                return;
            const assignedLanes = views.get(key) ?? [];
            if (!assignedLanes.some((assignedLane) => assignedLane.uid === uid))
                assignedLanes.push(lane);
            views.set(key, assignedLanes);
        });
    });

    const compareLanes = (a: OperationalViewLane, b: OperationalViewLane) =>
        a.name.localeCompare(b.name) || a.uid.localeCompare(b.uid);
    lanes.sort(compareLanes);

    return {
        lanes,
        views: new Map([...views.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, assignedLanes]) => [key, assignedLanes.sort(compareLanes)])),
    };
}

export function systemMatchesOperationalView(system: any, viewKey: string | null): boolean {
    return viewKey === null || getOperationalViewKeys(system).includes(viewKey);
}

export function withOperationalView(path: string, viewKey: string | null): string {
    if (viewKey === null)
        return path;

    const url = new URL(path, "https://oscar.local");
    url.searchParams.set("view", viewKey);
    return `${url.pathname}${url.search}${url.hash}`;
}
