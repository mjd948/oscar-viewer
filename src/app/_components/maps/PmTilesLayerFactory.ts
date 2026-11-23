/*
 * Copyright (c) 2026. Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import L from 'leaflet';
import { FetchSource, leafletRasterLayer, PMTiles } from 'pmtiles';
import { leafletLayer as protomapsVectorLayer } from 'protomaps-leaflet';
import { ActiveOfflineMapInfo } from '@/lib/data/oscar/RuntimeExtensionsApi';

export function resolveAbsolutePmTilesUrl(tileUrl: string): string {
    if (/^https?:\/\//i.test(tileUrl)) {
        return tileUrl;
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
        const path = tileUrl.startsWith('/') ? tileUrl : `/${tileUrl}`;
        return `${window.location.origin}${path}`;
    }
    return tileUrl;
}

export function isValidOfflineMapBounds(
    bounds: ActiveOfflineMapInfo['bounds']
): bounds is [[number, number], [number, number]] {
    if (!Array.isArray(bounds) || bounds.length !== 2) {
        return false;
    }
    const [sw, ne] = bounds;
    if (!Array.isArray(sw) || !Array.isArray(ne) || sw.length !== 2 || ne.length !== 2) {
        return false;
    }
    const [minLat, minLon] = sw;
    const [maxLat, maxLon] = ne;
    if (![minLat, minLon, maxLat, maxLon].every(Number.isFinite)) {
        return false;
    }
    return minLat < maxLat && minLon < maxLon && Math.abs(minLat) <= 90 && Math.abs(maxLat) <= 90
        && Math.abs(minLon) <= 180 && Math.abs(maxLon) <= 180;
}

/**
 * Constructs an authenticated, 100% air-gapped Leaflet layer backed by a local `.pmtiles` archive
 * (either Protomaps MVT vector tiles rendered on HTML5 Canvas or PNG/JPEG/WEBP raster tiles).
 */
export function createLeafletPmTilesLayer(
    info: ActiveOfflineMapInfo,
    language: string
): L.Layer | null {
    if (!info.active || !info.tileUrl) {
        return null;
    }
    if (typeof globalThis !== 'undefined' && !(globalThis as any).L) {
        (globalThis as any).L = L;
    }
    const resolvedUrl = resolveAbsolutePmTilesUrl(info.tileUrl);
    const source = new FetchSource(resolvedUrl, new Headers(), 'include');
    const pmInstance = new PMTiles(source);
    const maxDataZoom = typeof info.maxZoom === 'number' && info.maxZoom > 0 ? info.maxZoom : 15;
    const attribution = `Offline PMTiles (${info.displayName || info.fileName || 'Local'}) &copy; OpenStreetMap contributors`;

    if ((info.tileType || 'mvt').toLowerCase() === 'mvt') {
        return protomapsVectorLayer({
            url: pmInstance as any,
            flavor: 'light',
            lang: language || 'en',
            maxDataZoom,
            maxZoom: 22,
            attribution,
        }) as unknown as L.Layer;
    }

    return leafletRasterLayer(pmInstance, {
        maxNativeZoom: maxDataZoom,
        maxZoom: 22,
        attribution,
    }) as L.Layer;
}
