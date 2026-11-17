"use client"

import React, {useCallback, useContext, useEffect, useMemo, useRef, useState} from "react";
import {
    acquireSharedConnection,
    findRealtimeDataSourceForStream,
    LaneDSColl,
    type SharedConnectionLease,
} from "@/lib/data/oscar/LaneCollection";
import LeafletView from "osh-js/source/core/ui/view/map/LeafletView";
import {useSelector} from "react-redux";
import {RootState} from "@/lib/state/Store";
import Box from "@mui/material/Box";
import '../../style/map.css';
import {DataSourceContext} from "@/app/contexts/DataSourceContext";
import {selectLaneMap} from "@/lib/state/OSCARLaneSlice";
import "leaflet/dist/leaflet.css"
import {
    isConnectionDataStream, isGammaDataStream, isLocationDataStream,
    isMobileGpsDataStream, isNeutronDataStream, isOccupancyDataStream, isSiteDiagramPathDataStream,
    isTamperDataStream
} from "@/lib/data/oscar/Utilities";
import {buildEventDetailsHref} from "@/lib/data/oscar/EventLookup";
import {setCurrentLane} from "@/lib/state/LaneViewSlice";
import {useAppDispatch} from "@/lib/state/Hooks";
import L from "leaflet";
import {selectNodes} from "@/lib/state/OSHSlice";
import {INode} from "@/lib/data/osh/Node";
import ObservationFilter from "osh-js/source/core/consysapi/observation/ObservationFilter";
import DataStreamFilter from "osh-js/source/core/consysapi/datastream/DataStreamFilter.js";
import {useLanguage} from '@/app/contexts/LanguageContext';
import {EventType} from "osh-js/source/core/event/EventType";
import {removeRealtimeEventSubscription} from "@/lib/data/oscar/RealtimeEventNotification";
import {
    buildLaneExtentSignature,
    buildSiteDiagramUrl,
    LANE_EXTENT_FIT_OPTIONS,
    LANE_MARKER_ICON_ANCHOR,
    LANE_MARKER_ICON_SIZE,
    LANE_MARKER_PANE,
    LANE_MARKER_PANE_Z_INDEX,
    LANE_SILENCE_THRESHOLD_MS,
    LaneMapLocation,
    MOBILE_ALARM_COLOR,
    MOBILE_ALARM_FLASH_MS,
    MOBILE_ALARM_REFRESH_MS,
    MOBILE_SWEEP_MS,
    mobileAlarmPosition,
    OSM_TILE_URL,
    resolveLaneMapLocation,
    SITE_DIAGRAM_FIT_OPTIONS,
    SITE_DIAGRAM_PANE,
    SITE_DIAGRAM_PANE_Z_INDEX,
    SiteDiagramBounds,
    toLaneMapLocationFromSystem,
    toLeafletLaneExtentBounds,
    toLaneMapLocation,
    toLeafletSiteDiagramBounds,
    startOfLocalDayIso,
    UNADJUDICATED_ALARM_FILTER,
    walkerIconHtml,
    walkerState,
} from "@/app/_components/maps/MapUtils";

interface LaneMarkerState {
    laneName: string;
    location: LaneMapLocation;
    status: string;
    /** Mobile detector lane: drawn as a walker that follows its live GPS fixes. */
    mobile?: boolean;
    /**
     * Position used for the lane-extent fit. A walker's first fix, so a moving walker does
     * not re-fit (and reset the user's pan/zoom) on every GPS update.
     */
    fitLocation?: LaneMapLocation;
    /** Browser arrival time of the walker's latest fix (or the mount-time grace baseline). */
    lastFixAt?: number;
    /** A live alarm keeps the walker red until this time. */
    alarmUntil?: number;
}

const fitLocationOf = (marker: LaneMarkerState) => marker.fitLocation ?? marker.location;


export default function MapComponent() {
    const {language, t} = useLanguage();
    const mapcontainer: string = "mapcontainer";
    const laneMap = useSelector((state: RootState) => selectLaneMap(state));
    const leafletViewRef = useRef<typeof LeafletView | null>(null);
    const siteDiagramLayersRef = useRef<Map<string, L.ImageOverlay>>(new Map());
    const siteDiagramBoundsRef = useRef<L.LatLngBounds | null>(null);
    const laneMarkerLayersRef = useRef<Map<string, L.Marker>>(new Map());
    const locationListRef = useRef<LaneMarkerState[]>([]);
    const hasUserAdjustedViewRef = useRef(false);
    const isProgrammaticViewChangeRef = useRef(false);
    const previousLanguageRef = useRef(language);
    const {activeViewKey, laneMapReady, scopedHref} = useContext(DataSourceContext);
    const dispatch = useAppDispatch();

    const nodes = useSelector((state: RootState) => selectNodes(state));

    const [isInit, setIsInit] = useState(false);
    const [dataSourcesByLane, setDataSourcesByLane] = useState<Map<string, LaneDSColl>>(new Map<string, LaneDSColl>());
    const [locationList, setLocationList] = useState<LaneMarkerState[]>([]);

    locationListRef.current = locationList;

    const laneExtentSignature = useMemo(
        () => buildLaneExtentSignature(locationList.map((marker) => ({
            laneName: marker.laneName,
            location: fitLocationOf(marker),
        }))),
        [locationList],
    );
    // Re-render tick for silence/alarm-flash transitions that no message announces.
    const [sweepTick, setSweepTick] = useState(0);
    const mobileAlarmMarkersRef = useRef<Map<string, L.CircleMarker>>(new Map());
    const refreshMobileAlarmsRef = useRef<() => void>(() => {});

    const fitMapToActiveExtent = useCallback((resetUserAdjustment = false) => {
        const view = leafletViewRef.current;
        if (!view?.map)
            return;

        if (resetUserAdjustment)
            hasUserAdjustedViewRef.current = false;

        const laneBoundsCoords = toLeafletLaneExtentBounds(
            locationListRef.current.map(fitLocationOf),
        );

        if (laneBoundsCoords) {
            isProgrammaticViewChangeRef.current = true;
            try {
                view.map.invalidateSize({pan: false, animate: false});
                view.map.fitBounds(L.latLngBounds(laneBoundsCoords), LANE_EXTENT_FIT_OPTIONS);
            } finally {
                isProgrammaticViewChangeRef.current = false;
            }
            return;
        }

        if (siteDiagramBoundsRef.current?.isValid()) {
            isProgrammaticViewChangeRef.current = true;
            try {
                view.map.invalidateSize({pan: false, animate: false});
                view.map.fitBounds(siteDiagramBoundsRef.current, SITE_DIAGRAM_FIT_OPTIONS);
            } finally {
                isProgrammaticViewChangeRef.current = false;
            }
        }
    }, []);

    useEffect(() => {
        if (laneMap.size === 0 && !laneMapReady)
            return;

        if (laneMap.size === 0) {
            setDataSourcesByLane(new Map());
            setLocationList([]);
            return;
        }

        let cancelled = false;
        const laneDSMap = new Map<string, LaneDSColl>();
        const locationSources: Array<{
            laneName: string;
            dataStream: any | null;
            systemLocation: LaneMapLocation | null;
            mobile: boolean;
        }> = [];
        const seededAt = Date.now();

        for (const [laneName, lane] of laneMap.entries()) {
            const laneDSColl = new LaneDSColl();
            laneDSMap.set(laneName, laneDSColl);

            const laneSystemId = lane.laneSystem?.properties?.id;
            const locationStreams: any[] = [];

            lane.datastreams.forEach((dataStream) => {
                const realtimeSource = findRealtimeDataSourceForStream(lane, dataStream);

                if (isLocationDataStream(dataStream))
                    locationStreams.push(dataStream);
                if (realtimeSource && isGammaDataStream(dataStream))
                    laneDSColl.addDS('gammaRT', realtimeSource);
                if (realtimeSource && isNeutronDataStream(dataStream))
                    laneDSColl.addDS('neutronRT', realtimeSource);
                if (realtimeSource && isTamperDataStream(dataStream))
                    laneDSColl.addDS('tamperRT', realtimeSource);
                if (realtimeSource && isConnectionDataStream(dataStream))
                    laneDSColl.addDS('connectionRT', realtimeSource);
                if (realtimeSource && isMobileGpsDataStream(dataStream))
                    laneDSColl.addDS('locRT', realtimeSource);
                if (realtimeSource && isOccupancyDataStream(dataStream))
                    laneDSColl.addDS('occRT', realtimeSource);
            });

            // A mobile detector's position is its live GPS fix, not the lane's configured location.
            const gpsStream = lane.datastreams.find((dataStream) => isMobileGpsDataStream(dataStream)) ?? null;
            const laneLocationStream = gpsStream ?? locationStreams.find((dataStream) =>
                dataStream?.properties?.["system@id"] === laneSystemId) ?? locationStreams[0] ?? null;
            locationSources.push({
                laneName,
                dataStream: laneLocationStream,
                systemLocation: toLaneMapLocationFromSystem(lane.laneSystem),
                mobile: gpsStream !== null,
            });
        }
        setDataSourcesByLane(laneDSMap);

        // Seed lane markers immediately from the lane system GeoJSON geometry
        // so the map fits the active lane extent on the first render frame
        // without waiting for per-lane latest observation queries to settle.
        setLocationList((current) => {
            const currentByLane = new Map(current.map((item) => [item.laneName, item]));
            return locationSources
                .map(({laneName, systemLocation, mobile}) => {
                    const existing = currentByLane.get(laneName);
                    const location = (mobile && existing?.location) || systemLocation || existing?.location || null;
                    if (!location)
                        return null;
                    return {
                        laneName,
                        location,
                        status: existing?.status ?? 'None',
                        ...(mobile ? {
                            mobile,
                            fitLocation: existing?.fitLocation ?? location,
                            // grace baseline: never call a walker silent before its first live fix could arrive
                            lastFixAt: existing?.lastFixAt ?? seededAt,
                            alarmUntil: existing?.alarmUntil,
                        } : {}),
                    } as LaneMarkerState;
                })
                .filter((marker): marker is LaneMarkerState => marker !== null);
        });

        const loadLatestLocations = async () => {
            const markers = await Promise.all(locationSources.map(async ({laneName, dataStream, systemLocation, mobile}) => {
                if (!dataStream) {
                    if (!systemLocation)
                        console.warn(`No configured location is available for lane ${laneName}`);
                    return systemLocation
                        ? {laneName, location: systemLocation, status: 'None'} as LaneMarkerState
                        : null;
                }

                try {
                    const observations = await dataStream.searchObservations(
                        new ObservationFilter({resultTime: "latest"}), 1);
                    const results = await observations.nextPage();
                    const location = resolveLaneMapLocation(results[0]?.result, systemLocation);
                    if (!location) {
                        console.warn(`No valid latest location is available for lane ${laneName}`);
                        return null;
                    }
                    return {laneName, location, status: 'None', ...(mobile ? {mobile} : {})} as LaneMarkerState;
                } catch (error) {
                    console.error(`Unable to load the latest location for lane ${laneName}`, error);
                    return systemLocation
                        ? {laneName, location: systemLocation, status: 'None'} as LaneMarkerState
                        : null;
                }
            }));

            if (cancelled) return;
            setLocationList((current) => markers
                .filter((marker): marker is LaneMarkerState => marker !== null)
                .map((marker) => {
                    const existing = current.find((item) => item.laneName === marker.laneName);
                    if (!marker.mobile)
                        return {...marker, status: existing?.status ?? marker.status};
                    // A live fix that arrived before this REST seed is newer: keep it.
                    const liveFixArrived = existing?.lastFixAt != null && existing.lastFixAt > seededAt;
                    const location = liveFixArrived ? existing!.location : marker.location;
                    return {
                        ...marker,
                        location,
                        status: existing?.status ?? marker.status,
                        fitLocation: marker.location,
                        lastFixAt: existing?.lastFixAt ?? seededAt,
                        alarmUntil: existing?.alarmUntil,
                    };
                }));
        };

        void loadLatestLocations();
        return () => {
            cancelled = true;
        };
    }, [laneMap, laneMapReady]);


    const addSubscriptionCallbacks = useCallback(() => {
        let active = true;
        const subscriptions: Array<{
            source: any;
            handler: (message: any) => void;
            lease: SharedConnectionLease;
        }> = [];

        const subscribe = (
            sources: any[],
            handler: (message: any) => void,
        ) => {
            sources.forEach((source) => {
                source.subscribe(handler, [EventType.DATA]);
                const lease = acquireSharedConnection(source);
                subscriptions.push({source, handler, lease});
                void lease.ready.catch((error) => {
                    if (active)
                        console.warn("Unable to connect map status stream", error);
                });
            });
        };

        const subscribedAt = Date.now();
        for (const [laneName, laneDSColl] of dataSourcesByLane.entries()) {
            const msgLaneName = laneName;
            const isMobileLane = laneDSColl.locRT.length > 0;
            // Portal lanes are judged silent by their ~1 Hz gamma/neutron counts (arrival time,
            // so node/browser clock skew cannot fake it); the grace baseline is subscription time.
            if (!isMobileLane && laneDSColl.gammaRT.length + laneDSColl.neutronRT.length > 0)
                deviceMessageAtRef.current.set(msgLaneName, subscribedAt);
            const noteDeviceMessage = () => deviceMessageAtRef.current.set(msgLaneName, Date.now());

            subscribe(laneDSColl.connectionRT, (message: any) => {
                // The connectionStatus record's field is isConnected; "connection" never existed,
                // so the map used to ignore every connection message.
                const data = message.values?.[0]?.data;
                const connected = data?.isConnected ?? data?.connection;
                if (!active || typeof connected !== "boolean") return;
                updateLaneMarker(msgLaneName, (marker) => {
                    if (!connected)
                        return marker.status === 'Alarm' ? marker : {...marker, status: 'Offline'};
                    // "true" from the module is only believed while the device is still talking
                    return marker.status === 'Offline' && !isLaneSilent(msgLaneName, marker, Date.now())
                        ? {...marker, status: 'None'}
                        : marker;
                });
            });

            subscribe(laneDSColl.gammaRT, (message: any) => {
                noteDeviceMessage();
                const alarmstate = message.values?.[0]?.data?.alarmState;
                if (active && alarmstate !== undefined)
                    updateLocationList(msgLaneName, alarmstate);
            });
            subscribe(laneDSColl.neutronRT, (message: any) => {
                noteDeviceMessage();
                const alarmstate = message.values?.[0]?.data?.alarmState;
                if (active && alarmstate !== undefined)
                    updateLocationList(msgLaneName, alarmstate);
            });

            if (isMobileLane) {
                subscribe(laneDSColl.locRT, (message: any) => {
                    const location = toLaneMapLocation(message.values?.[0]?.data);
                    if (!active || !location || (location.lat === 0 && location.lon === 0)) return;
                    updateLaneMarker(msgLaneName, (marker) => ({
                        ...marker,
                        location,
                        fitLocation: marker.fitLocation ?? location,
                        lastFixAt: Date.now(),
                        status: marker.status === 'Offline' ? 'None' : marker.status,
                    }));
                });
                subscribe(laneDSColl.occRT, (message: any) => {
                    const data = message.values?.[0]?.data;
                    if (!active || !(data?.gammaAlarm || data?.neutronAlarm)) return;
                    updateLaneMarker(msgLaneName, (marker) => ({...marker, alarmUntil: Date.now() + MOBILE_ALARM_FLASH_MS}));
                    // give the node a moment to persist the occupancy before re-querying the alarm layer
                    window.setTimeout(() => refreshMobileAlarmsRef.current(), 2_000);
                });
            }
            subscribe(laneDSColl.tamperRT, (message: any) => {
                const tamperState = message.values?.[0]?.data?.tamperStatus;
                if (active && tamperState)
                    updateLocationList(msgLaneName, 'Tamper');
            });
        }

        return () => {
            active = false;
            subscriptions.forEach(({source, handler, lease}) => {
                removeRealtimeEventSubscription(source, handler);
                void lease.release().catch((error) => {
                    console.warn("Unable to disconnect map status stream", error);
                });
            });
        };
    }, [dataSourcesByLane]);

    useEffect(() => {
        if (dataSourcesByLane.size === 0) return;
        return addSubscriptionCallbacks();
    }, [addSubscriptionCallbacks, dataSourcesByLane]);

    // Silence sweep: a stopped module or dead detector sends nothing at all, so the absence
    // of messages has to be noticed on a timer (and again when a background tab wakes up).
    useEffect(() => {
        if (dataSourcesByLane.size === 0) return;
        const sweep = () => {
            const now = Date.now();
            setLocationList((current) => {
                let changed = false;
                const next = current.map((marker) => {
                    if (marker.mobile || marker.status === 'Alarm' || marker.status === 'Offline'
                        || !isLaneSilent(marker.laneName, marker, now))
                        return marker;
                    changed = true;
                    return {...marker, status: 'Offline'};
                });
                return changed ? next : current;
            });
            setSweepTick((tick) => tick + 1);
        };
        const timer = window.setInterval(sweep, MOBILE_SWEEP_MS);
        const onVisible = () => { if (document.visibilityState === 'visible') sweep(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [dataSourcesByLane]);

    // Unadjudicated mobile alarms, drawn where they happened. The server filters out anything
    // an operator has adjudicated, so a marker disappears on the next refresh after adjudication.
    useEffect(() => {
        const view = leafletViewRef.current;
        if (!view?.map || !isInit) return;
        const mobileLanes = Array.from(laneMap.values()).filter((lane) =>
            lane.datastreams.some((dataStream) => isMobileGpsDataStream(dataStream)));
        const markers = mobileAlarmMarkersRef.current;
        if (mobileLanes.length === 0) {
            refreshMobileAlarmsRef.current = () => {};
            return;
        }

        let cancelled = false;
        let inFlight = false;
        const refresh = async () => {
            if (inFlight || cancelled) return;
            inFlight = true;
            try {
                const seen = new Set<string>();
                const windowStart = startOfLocalDayIso();
                await Promise.all(mobileLanes.map(async (lane) => {
                    const occupancyIds = lane.datastreams
                        .filter((dataStream) => isOccupancyDataStream(dataStream))
                        .map((dataStream) => dataStream.properties.id);
                    if (occupancyIds.length === 0) return;
                    try {
                        const api = await lane.parentNode.getObservationsApi();
                        const collection = await api.searchObservations(new ObservationFilter({
                            dataStream: occupancyIds,
                            resultTime: `${windowStart}/${new Date().toISOString()}`,
                            filter: encodeURIComponent(UNADJUDICATED_ALARM_FILTER),
                            order: "desc",
                        }), 200);
                        const observations = await collection.nextPage();
                        if (cancelled) return;
                        (observations ?? []).forEach((observation: any) => {
                            const obsId = observation?.properties?.id ?? observation?.id;
                            const result = observation?.properties?.result ?? observation?.result;
                            const position = mobileAlarmPosition(result);
                            if (!obsId || !position) return;
                            const key = `${lane.laneName}\u001f${obsId}`;
                            seen.add(key);
                            if (markers.has(key)) return;
                            const kind = t('status.alarm');
                            const href = scopedHref(buildEventDetailsHref(obsId, lane.parentNode?.id));
                            const when = result?.startTime ? new Date(result.startTime).toLocaleString() : '';
                            const marker = L.circleMarker([position.lat, position.lon], {
                                className: 'mobile-alarm-marker',
                                radius: 7,
                                weight: 2,
                                color: MOBILE_ALARM_COLOR,
                                fillColor: MOBILE_ALARM_COLOR,
                                fillOpacity: 0.15,
                                pane: LANE_MARKER_PANE,
                            }).addTo(view.map);
                            marker.bindPopup(
                                `<div class='point-popup'><strong>${lane.laneName}</strong> — ${kind}`
                                + `<br/><span style="font-size:0.85em">${when}</span><hr/>`
                                + `<button onClick='location.href="${href}"' class="popup-button" type="button">${t('viewEvent')}</button></div>`,
                            );
                            marker.getElement()?.setAttribute('data-occ-obs', obsId);
                            markers.set(key, marker);
                        });
                    } catch (error) {
                        // keep the markers we have: a failed query must not clear the layer
                        console.warn(`Unable to load mobile alarms for lane ${lane.laneName}`, error);
                        markers.forEach((_marker, key) => {
                            if (key.startsWith(`${lane.laneName}\u001f`)) seen.add(key);
                        });
                    }
                }));
                if (cancelled) return;
                markers.forEach((marker, key) => {
                    if (!seen.has(key)) {
                        marker.remove();
                        markers.delete(key);
                    }
                });
            } finally {
                inFlight = false;
            }
        };
        refreshMobileAlarmsRef.current = () => { void refresh(); };
        void refresh();
        const timer = window.setInterval(() => { void refresh(); }, MOBILE_ALARM_REFRESH_MS);
        const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
            refreshMobileAlarmsRef.current = () => {};
            markers.forEach((marker) => marker.remove());
            markers.clear();
        };
    }, [isInit, laneMap, scopedHref, t]);

    useEffect(() => {
        if (!leafletViewRef.current && !isInit) {
            // define base layers

            const osmLayer = L.tileLayer(OSM_TILE_URL, {
                attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                minZoom: 1,
                maxZoom: 22,
                maxNativeZoom: 19,
                referrerPolicy: "strict-origin-when-cross-origin",
            });
            const esriLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
                attribution: '&copy; <a href="https://www.esri.com/">Esri</a>, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
                maxZoom: 22,
                maxNativeZoom: 19,
                referrerPolicy: "strict-origin-when-cross-origin"
            });

            let view = new LeafletView({
                container: mapcontainer,
                destroyAfterMutation: false,
                layers: [],
                imageOverlays: [],
                autoZoomOnFirstMarker: false,
                baseLayers:{
                    [t('osmStreets')]: osmLayer,
                    [t('esriSatellite')]: esriLayer
                },
                overlayLayers: {},
                defaultLayer: osmLayer
            });
            view.map.options.zoomSnap = 0;
            view.map.options.zoomDelta = 0.5;
            const markUserAdjustedView = () => {
                if (!isProgrammaticViewChangeRef.current)
                    hasUserAdjustedViewRef.current = true;
            };
            view.map.on("dragstart", markUserAdjustedView);
            view.map.on("zoomstart", markUserAdjustedView);

            const siteDiagramPane = view.map.createPane(SITE_DIAGRAM_PANE);
            siteDiagramPane.style.zIndex = String(SITE_DIAGRAM_PANE_Z_INDEX);
            siteDiagramPane.style.pointerEvents = "none";
            const laneMarkerPane = view.map.createPane(LANE_MARKER_PANE);
            laneMarkerPane.style.zIndex = String(LANE_MARKER_PANE_Z_INDEX);

            // LeafletView accepts a default layer, but explicitly enforce OSM
            // here so an empty map never depends on the layer-control state.
            if (!view.map.hasLayer(osmLayer))
                osmLayer.addTo(view.map);

            hasUserAdjustedViewRef.current = false;
            leafletViewRef.current = view;
            setIsInit(true);
        }

        return () =>{
            if(isInit && leafletViewRef.current != null){
                siteDiagramLayersRef.current.clear();
                siteDiagramBoundsRef.current = null;
                laneMarkerLayersRef.current.clear();
                leafletViewRef.current.destroy();
                leafletViewRef.current = undefined;
            }
        }
    }, [isInit]);

    useEffect(() => {
        if (previousLanguageRef.current === language) return;
        previousLanguageRef.current = language;

        if (leafletViewRef.current) {
            siteDiagramLayersRef.current.clear();
            siteDiagramBoundsRef.current = null;
            laneMarkerLayersRef.current.clear();
            leafletViewRef.current.destroy();
            leafletViewRef.current = null;
            setIsInit(false);
        }
    }, [language]);

    useEffect(() => {
        const view = leafletViewRef.current;
        if (!view || !isInit) return;

        const renderedLaneNames = new Set<string>();
        const now = Date.now();
        locationList.forEach((laneMarker) => {
            const {laneName, location, status} = laneMarker;
            renderedLaneNames.add(laneName);
            let markerIcon: L.Icon | L.DivIcon;
            if (laneMarker.mobile) {
                const state = walkerState(laneMarker.lastFixAt, laneMarker.alarmUntil, status === 'Offline', now);
                const title = state === 'offline' && laneMarker.lastFixAt != null
                    ? `${laneName} — ${t('mobileNoDataSince', {time: new Date(laneMarker.lastFixAt).toLocaleTimeString()})}`
                    : laneName;
                markerIcon = L.divIcon({
                    className: 'mobile-unit-marker',
                    iconSize: [30, 30],
                    iconAnchor: [15, 15],
                    popupAnchor: [0, -14],
                    html: walkerIconHtml(state, title),
                });
            } else {
                markerIcon = L.icon({
                    iconUrl: getMarkerIcon(status),
                    iconSize: LANE_MARKER_ICON_SIZE,
                    iconAnchor: LANE_MARKER_ICON_ANCHOR,
                });
            }
            let marker = laneMarkerLayersRef.current.get(laneName);

            if (!marker) {
                marker = L.marker([location.lat, location.lon], {
                    icon: markerIcon,
                    pane: LANE_MARKER_PANE,
                    zIndexOffset: 1000,
                    title: laneName,
                    alt: laneName,
                }).addTo(view.map);
                marker.bindTooltip(`<div class='popup-text-lane'>${laneName}</div>`, {
                    direction: 'center',
                    offset: L.point(-5, -15),
                });
                marker.on('click', () => dispatch(setCurrentLane(laneName)));
                laneMarkerLayersRef.current.set(laneName, marker);
            } else {
                marker.setLatLng([location.lat, location.lon]);
                marker.setIcon(markerIcon);
            }

            if (marker.getPopup())
                marker.setPopupContent(getContent(status));
            else
                marker.bindPopup(getContent(status), {offset: L.point(-5, -15)});
        });

        laneMarkerLayersRef.current.forEach((marker, laneName) => {
            if (!renderedLaneNames.has(laneName)) {
                view.map.removeLayer(marker);
                laneMarkerLayersRef.current.delete(laneName);
            }
        });
    }, [locationList, isInit, language, t, sweepTick]);

    useEffect(() => {
        if (!isInit || !laneExtentSignature)
            return;

        fitMapToActiveExtent(true);
        const frameId = window.requestAnimationFrame(() => {
            fitMapToActiveExtent(false);
        });

        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, [activeViewKey, fitMapToActiveExtent, isInit, laneExtentSignature]);

    useEffect(() => {
        const view = leafletViewRef.current;
        if (!view?.map || !isInit || typeof ResizeObserver === "undefined")
            return;

        const containerElement = document.getElementById(mapcontainer);
        if (!containerElement)
            return;

        let resizeFrameId: number | null = null;
        const observer = new ResizeObserver(() => {
            if (resizeFrameId !== null)
                window.cancelAnimationFrame(resizeFrameId);
            resizeFrameId = window.requestAnimationFrame(() => {
                if (leafletViewRef.current !== view)
                    return;
                if (!hasUserAdjustedViewRef.current) {
                    fitMapToActiveExtent(false);
                } else {
                    isProgrammaticViewChangeRef.current = true;
                    try {
                        view.map.invalidateSize({pan: false, animate: false});
                    } finally {
                        isProgrammaticViewChangeRef.current = false;
                    }
                }
            });
        });
        observer.observe(containerElement);

        return () => {
            observer.disconnect();
            if (resizeFrameId !== null)
                window.cancelAnimationFrame(resizeFrameId);
        };
    }, [fitMapToActiveExtent, isInit]);

    useEffect(() => {
        const view = leafletViewRef.current;
        if (!view || !isInit || !laneMapReady) {
            return;
        }

        let cancelled = false;
        let fitFrameId: number | null = null;

        type LoadedSiteDiagram = {
            node: INode,
            path: string,
            bounds: SiteDiagramBounds,
        };

        const loadSiteDiagram = async (node: INode): Promise<LoadedSiteDiagram | null> => {
            const oscarSystem = node.getOscarServiceSystem();
            if (!oscarSystem)
                return null;

            const oscarSystemDatastreams = [];
            const dataStreamsCol = await oscarSystem.searchDataStreams(
                new DataStreamFilter({validTime: "latest"}), 10);
            while (dataStreamsCol.hasNext()) {
                const datastreamResults = await dataStreamsCol.nextPage();
                oscarSystemDatastreams.push(...datastreamResults);
            }

            const siteDiagramStream = oscarSystemDatastreams.find(isSiteDiagramPathDataStream);
            if (!siteDiagramStream)
                return null;

            const observations = await siteDiagramStream.searchObservations(
                new ObservationFilter({resultTime: "latest"}), 1);
            const results = await observations.nextPage();
            const siteDiagram = results[0]?.result;
            if (!siteDiagram?.siteDiagramPath)
                return null;

            const bounds = toLeafletSiteDiagramBounds(siteDiagram.siteBoundingBox);
            if (!bounds) {
                console.warn(`Invalid site diagram bounds for ${node.name}`, siteDiagram.siteBoundingBox);
                return null;
            }

            const path = buildSiteDiagramUrl(siteDiagram.siteDiagramPath, node);
            node.setSiteMapPath(path);
            node.setLowerLeftBox(bounds[0]);
            node.setUpperRightBox(bounds[1]);
            return {node, path, bounds};
        };

        const renderSiteDiagrams = async () => {
            const diagramResults: Array<LoadedSiteDiagram | null> = await Promise.all(
                (nodes as INode[]).map(async (node: INode) => {
                    try {
                        return await loadSiteDiagram(node);
                    } catch (error) {
                        console.error(`Unable to load the site diagram for ${node.name}`, error);
                        return null;
                    }
                }));
            const diagrams: LoadedSiteDiagram[] = diagramResults.filter(
                (diagram): diagram is LoadedSiteDiagram => diagram !== null);

            if (cancelled || leafletViewRef.current !== view)
                return;

            siteDiagramLayersRef.current.forEach((layer) => view.map.removeLayer(layer));
            siteDiagramLayersRef.current.clear();

            const combinedBounds = L.latLngBounds([]);
            diagrams.forEach(({node, path, bounds}: LoadedSiteDiagram) => {
                const leafletBounds = L.latLngBounds(bounds);
                const overlay = view.addImageOverlay(path, leafletBounds, {
                    opacity: 0.85,
                    interactive: false,
                    pane: SITE_DIAGRAM_PANE,
                    alt: t('siteMapForNode', {name: node.name, id: node.id}),
                }) as L.ImageOverlay;

                overlay.on("load", () => overlay.bringToFront());
                overlay.on("error", () => console.error(`Unable to render the site diagram for ${node.name}: ${path}`));
                overlay.bringToFront();
                siteDiagramLayersRef.current.set(node.id, overlay);
                combinedBounds.extend(leafletBounds);
            });

            siteDiagramBoundsRef.current = diagrams.length > 0 ? combinedBounds : null;

            if (diagrams.length > 0) {
                view.autoZoomOnFirstMarker = false;
                // Fit to the active lane extent when lane locations exist, or
                // fall back to the uploaded site diagram extent when no lane
                // coordinates are available.
                fitFrameId = window.requestAnimationFrame(() => {
                    if (cancelled || leafletViewRef.current !== view)
                        return;

                    fitMapToActiveExtent(false);
                });
            }
        };

        void renderSiteDiagrams();
        return () => {
            cancelled = true;
            if (fitFrameId !== null)
                window.cancelAnimationFrame(fitFrameId);
        };
    }, [fitMapToActiveExtent, isInit, laneMap, laneMapReady, nodes, language]);

    const deviceMessageAtRef = useRef<Map<string, number>>(new Map());

    /** True when a portal lane's device streams, or a walker's GPS, have been quiet too long. */
    const isLaneSilent = (laneName: string, marker: LaneMarkerState, now: number): boolean => {
        if (marker.mobile)
            return walkerState(marker.lastFixAt, undefined, false, now) === 'offline';
        const last = deviceMessageAtRef.current.get(laneName);
        return last != null && now - last > LANE_SILENCE_THRESHOLD_MS;
    };

    const updateLaneMarker = (laneName: string, updater: (marker: LaneMarkerState) => LaneMarkerState) => {
        setLocationList((prevState) => {
            let changed = false;
            const next = prevState.map((data) => {
                if (data.laneName !== laneName) return data;
                const updated = updater(data);
                changed ||= updated !== data;
                return updated;
            });
            return changed ? next : prevState;
        });
    };

    const updateLocationList = (laneName: string, newStatus: string) => {
        setLocationList((prevState) => {
            const updatedList = prevState.map((data) =>
                data.laneName === laneName ? {...data, status: newStatus} : data
            );

            return updatedList;
        });
    };

    function getMarkerIcon(status: string) {
        const normalizedStatus = typeof status === 'string' ? status : '';
        if (normalizedStatus === 'Alarm') return '/alarm.svg';
        if (normalizedStatus.includes('Fault')) return '/fault.svg';
        if (normalizedStatus === 'Offline') return '/offline.svg';
        return '/default.svg';
    }

    /***************content in popup************/
    function getContent(status: string) {
        const normalizedStatus = typeof status === 'string' && status ? status : 'None';
        const statusKey = normalizedStatus.toLowerCase().replace(/[ -]/g, '');

        return (
            `<div id='popup-data-layer' class='point-popup'><hr/>
                <h3 class='popup-text-status'>${t('statusValue', {status: t(`status.${statusKey}`)})}</h3>
                <button onClick='location.href="${scopedHref('/lane-view')}"' class="popup-button" type="button">${t('viewLane')}</button>
            </div>`
        );
    }

    return (
        <Box
            id="mapcontainer"
            sx={{width: '100%', height: '100vh'}}
        />
    );
}
