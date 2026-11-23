/*
 * Copyright (c) 2026. Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import {
    HemdZMapBand,
    UffAnnotationInfo,
    UffCaseMetadata,
    UffDeclarationInfo,
    UffOcrResultInfo,
    UffRadiationFileInfo,
    XRayFileInfo,
    extractUffUuidFromOmniboxInput,
} from '@/lib/data/oscar/CargoUffApi';
import { normalizeVehicleId } from '@/lib/data/oscar/VehicleSearch';

/**
 * Pure client-side random-access `.uff` ZIP + WCO `UFF 2.0` / `UFF 3.0.0` XML parser.
 *
 * Allows an operator to drop or select a `.uff` file directly via the existing `Upload Files`
 * button in Secondary Inspection—even on sites with SMB share integration disabled—extracting
 * embedded `.n42` spectra for WebID, auto-populating Vehicle ID chips, and opening the full
 * 16-bit radiograph viewer with zero server-side preprocessing required.
 */

interface ClientZipEntry {
    name: string;
    method: number;
    compSize: number;
    uncompSize: number;
    localHeaderOffset: number;
    directory: boolean;
}

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

function sanitizeZipPath(raw: string): string {
    return raw.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '').trim();
}

async function readZipEntriesFromBlob(blob: Blob): Promise<Map<string, ClientZipEntry>> {
    const totalSize = blob.size;
    if (totalSize < 22) {
        throw new Error('Invalid .uff file: smaller than ZIP header');
    }
    const tailLen = Math.min(totalSize, 65_557);
    const tailBuf = await blob.slice(totalSize - tailLen, totalSize).arrayBuffer();
    const tailView = new DataView(tailBuf);

    let eocdPos = -1;
    for (let i = tailLen - 22; i >= 0; i--) {
        if (tailView.getUint32(i, true) === EOCD_SIG) {
            eocdPos = i;
            break;
        }
    }
    if (eocdPos < 0) {
        throw new Error('Invalid .uff file: ZIP Central Directory not found');
    }

    const cdSize = tailView.getUint32(eocdPos + 12, true);
    const cdOffset = tailView.getUint32(eocdPos + 16, true);
    const cenBuf = await blob.slice(cdOffset, cdOffset + cdSize).arrayBuffer();
    const cenBytes = new Uint8Array(cenBuf);
    const cenView = new DataView(cenBuf);
    const decoder = new TextDecoder('utf-8');

    const map = new Map<string, ClientZipEntry>();
    let pos = 0;
    while (pos + 46 <= cenBytes.byteLength) {
        if (cenView.getUint32(pos, true) !== CEN_SIG) break;
        const method = cenView.getUint16(pos + 10, true);
        const compSize = cenView.getUint32(pos + 20, true);
        const uncompSize = cenView.getUint32(pos + 24, true);
        const nameLen = cenView.getUint16(pos + 28, true);
        const extraLen = cenView.getUint16(pos + 30, true);
        const commentLen = cenView.getUint16(pos + 32, true);
        const localHeaderOffset = cenView.getUint32(pos + 42, true);

        const rawName = decoder.decode(cenBytes.subarray(pos + 46, pos + 46 + nameLen));
        const directory = rawName.endsWith('/') || rawName.endsWith('\\');
        const cleanName = sanitizeZipPath(rawName);
        if (cleanName) {
            map.set(cleanName, {
                name: cleanName,
                method,
                compSize,
                uncompSize,
                localHeaderOffset,
                directory,
            });
        }
        pos += 46 + nameLen + extraLen + commentLen;
    }
    return map;
}

export async function readLocalUffEntryBytes(file: Blob, entryName: string): Promise<Uint8Array> {
    const entries = await readZipEntriesFromBlob(file);
    const target = entries.get(sanitizeZipPath(entryName));
    if (!target || target.directory) {
        throw new Error(`UFF archive entry not found: ${entryName}`);
    }
    const locBuf = await file.slice(target.localHeaderOffset, target.localHeaderOffset + 30).arrayBuffer();
    const locView = new DataView(locBuf);
    if (locView.getUint32(0, true) !== LOC_SIG) {
        throw new Error(`Invalid local ZIP header for ${entryName}`);
    }
    const nameLen = locView.getUint16(26, true);
    const extraLen = locView.getUint16(28, true);
    const dataStart = target.localHeaderOffset + 30 + nameLen + extraLen;
    const compBlob = file.slice(dataStart, dataStart + target.compSize);

    if (target.method === 0) {
        return new Uint8Array(await compBlob.arrayBuffer());
    }
    if (target.method === 8) {
        const ds = new DecompressionStream('deflate-raw');
        const stream = compBlob.stream().pipeThrough(ds);
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    throw new Error(`Unsupported ZIP compression method ${target.method} for ${entryName}`);
}

function resolveClientUri(
    entries: Map<string, ClientZipEntry>,
    eventId: string,
    rawUri: string,
): ClientZipEntry | null {
    const clean = sanitizeZipPath(rawUri);
    if (!clean) return null;
    const direct = entries.get(clean);
    if (direct && !direct.directory) return direct;
    if (eventId) {
        const compact = eventId.replace(/-/g, '');
        for (const prefix of [`event${compact}`, `event-${eventId}`, eventId, compact]) {
            const cand = entries.get(`${prefix}/${clean}`);
            if (cand && !cand.directory) return cand;
        }
    }
    const suffix = `/${clean}`;
    for (const entry of entries.values()) {
        if (!entry.directory && (entry.name.toLowerCase() === clean.toLowerCase() || entry.name.endsWith(suffix))) {
            return entry;
        }
    }
    return null;
}

function localTagName(el: Element): string {
    return el.localName || el.tagName.replace(/^.*:/, '');
}

function firstChildEl(parent: Element | null | undefined, localName: string): Element | null {
    if (!parent) return null;
    const target = localName.toLowerCase();
    for (let i = 0; i < parent.children.length; i++) {
        const c = parent.children[i]!;
        if (localTagName(c).toLowerCase() === target) return c;
    }
    return null;
}

function childEls(parent: Element | null | undefined, localName: string): Element[] {
    if (!parent) return [];
    const target = localName.toLowerCase();
    const out: Element[] = [];
    for (let i = 0; i < parent.children.length; i++) {
        const c = parent.children[i]!;
        if (localTagName(c).toLowerCase() === target) out.push(c);
    }
    return out;
}

function childText(parent: Element | null | undefined, localName: string): string {
    const el = firstChildEl(parent, localName);
    return el?.textContent?.trim() ?? '';
}

function numOrNull(raw: string): number | null {
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

export async function parseLocalUffFile(file: File): Promise<{
    metadata: UffCaseMetadata;
    embeddedN42File: File | null;
}> {
    const entries = await readZipEntriesFromBlob(file);
    const decoder = new TextDecoder('utf-8');

    let uffVersion = '';
    if (entries.has('version')) {
        uffVersion = decoder.decode(await readLocalUffEntryBytes(file, 'version')).trim();
    }

    let rootXmlEntry: ClientZipEntry | null = null;
    for (const e of entries.values()) {
        if (!e.directory && !e.name.includes('/') && e.name.toLowerCase().endsWith('.xml') && !e.name.toLowerCase().endsWith('.n42')) {
            rootXmlEntry = e;
            break;
        }
    }
    if (!rootXmlEntry) {
        throw new Error(`Invalid .uff package '${file.name}': missing root <uuid>.xml`);
    }

    const xmlString = decoder.decode(await readLocalUffEntryBytes(file, rootXmlEntry.name));
    const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
    const root = doc.documentElement;
    if (!root || localTagName(root).toLowerCase() !== 'uff') {
        throw new Error(`Invalid WCO UFF XML root element in '${file.name}'`);
    }

    const xmlId = childText(root, 'Id');
    if (!uffVersion) {
        uffVersion = (root.namespaceURI?.includes('UFF3') || xmlId) ? '3.0' : '2.0';
    }
    const uffUuid =
        xmlId.toLowerCase() ||
        extractUffUuidFromOmniboxInput(rootXmlEntry.name) ||
        extractUffUuidFromOmniboxInput(file.name) ||
        rootXmlEntry.name.replace(/\.xml$/i, '').toLowerCase();

    const targetEl = firstChildEl(root, 'Target');
    const scanEl = firstChildEl(root, 'Scan');
    const analysisEl = firstChildEl(root, 'Analysis');
    const targetEventId = childText(targetEl, 'EventId');
    const scanEventId = childText(scanEl, 'EventId');

    const xraySys = firstChildEl(scanEl, 'XraySystem');
    const inspSys = firstChildEl(targetEl, 'InspectionSystem');
    const scannerId = childText(xraySys, 'Identifier') || childText(inspSys, 'Identifier');
    const scannerManufacturer = childText(xraySys, 'Manufacturer') || childText(inspSys, 'Manufacturer');
    const scannerModel = childText(xraySys, 'ModelName') || childText(inspSys, 'ModelName');
    const scannerSerial = childText(xraySys, 'SerialNumber') || childText(inspSys, 'SerialNumber');
    const country = childText(xraySys, 'Country');
    const locEl = firstChildEl(xraySys, 'Location');
    const latitude = numOrNull(childText(locEl, 'Latitude'));
    const longitude = numOrNull(childText(locEl, 'Longitude'));
    const scannerCaseId = childText(scanEl, 'ScannerCaseId');
    const scanTimestamp = childText(scanEl, 'TimeStamp') || childText(targetEl, 'TimeStamp');
    const parsedEpoch = Date.parse(scanTimestamp);
    const scanEpochMillis = Number.isFinite(parsedEpoch) ? parsedEpoch : file.lastModified || Date.now();
    const scanDurationMs = numOrNull(childText(scanEl, 'Duration'));

    const vehicleEl = firstChildEl(targetEl, 'Vehicle');
    const containerEl = firstChildEl(vehicleEl, 'Container');
    const containerNum = childText(containerEl, 'ContainerNum');
    const containerWeightKg = numOrNull(childText(containerEl, 'Weight'));
    const containerLengthFt = numOrNull(childText(containerEl, 'Length'));
    const frontPlateNum = childText(vehicleEl, 'FrontPlateNum');
    const vehicleType = childText(vehicleEl, 'VehicleType');
    const vehicleWeightKg = numOrNull(childText(vehicleEl, 'Weight'));

    let declaration: UffDeclarationInfo | null = null;
    const declEl = firstChildEl(containerEl, 'Declaration');
    if (declEl) {
        const consignorCo = firstChildEl(firstChildEl(declEl, 'Consignor'), 'Company');
        const consigneeCo = firstChildEl(firstChildEl(declEl, 'Consignee'), 'Company');
        const goodsEl = firstChildEl(declEl, 'GoodsDescription');
        const addrSummary = (addr: Element | null) =>
            [childText(addr, 'City'), childText(addr, 'State'), childText(addr, 'Country')].filter(Boolean).join(', ');
        declaration = {
            customsId: childText(declEl, 'CustomsId'),
            consignorName: childText(consignorCo, 'Name'),
            consignorLocation: addrSummary(firstChildEl(consignorCo, 'Address')),
            consigneeName: childText(consigneeCo, 'Name'),
            consigneeLocation: addrSummary(firstChildEl(consigneeCo, 'Address')),
            hsCode: childText(goodsEl, 'HSCode'),
            goodsDescription: childText(goodsEl, 'Description'),
            unit: childText(goodsEl, 'Unit'),
            quantity: numOrNull(childText(goodsEl, 'Quantity')),
        };
    }

    let manifestEntryPath = '';
    let manifestSizeBytes = 0;
    for (const docEl of childEls(targetEl, 'Document')) {
        const uri = childText(docEl, 'URI');
        const docType = childText(docEl, 'Type');
        if (uri && (docType.toLowerCase() === 'manifest' || uri.toLowerCase().endsWith('.pdf'))) {
            const res = resolveClientUri(entries, targetEventId, uri);
            if (res) {
                manifestEntryPath = res.name;
                manifestSizeBytes = res.uncompSize;
                break;
            }
        }
    }

    const normSet = new Set<string>();
    const dispSet = new Set<string>();
    const addVeh = (v: string) => {
        const t = v.trim();
        if (!t) return;
        const n = normalizeVehicleId(t);
        if (n) {
            normSet.add(n);
            dispSet.add(t);
        }
    };
    addVeh(containerNum);
    addVeh(frontPlateNum);

    const ocrResults: UffOcrResultInfo[] = [];
    for (const ocrEl of childEls(scanEl, 'OcrResult')) {
        const val = childText(ocrEl, 'Value');
        addVeh(val);
        const outEl = firstChildEl(ocrEl, 'OutputFile');
        const imgUri = childText(outEl, 'URI');
        const imgRes = imgUri ? resolveClientUri(entries, scanEventId, imgUri) : null;
        ocrResults.push({
            ocrType: childText(ocrEl, 'OcrType'),
            value: val,
            normalizedValue: normalizeVehicleId(val),
            confidence: numOrNull(childText(ocrEl, 'Confidence')),
            plateLocation: childText(ocrEl, 'PlateLocation'),
            view: childText(outEl, 'View'),
            imageEntryPath: imgRes ? imgRes.name : '',
            containerType: childText(firstChildEl(ocrEl, 'CcrDetail'), 'ContainerType'),
        });
    }

    const radiationFiles: UffRadiationFileInfo[] = [];
    for (const outEl of childEls(scanEl, 'OutputFile')) {
        const t = childText(outEl, 'Type');
        const uri = childText(outEl, 'URI');
        if (uri && (t.toLowerCase() === 'radiationdetection' || uri.toLowerCase().endsWith('.n42'))) {
            const r = resolveClientUri(entries, scanEventId, uri);
            if (r) {
                radiationFiles.push({
                    fileId: childText(outEl, 'FileId'),
                    entryPath: r.name,
                    sizeBytes: r.uncompSize,
                    type: t || 'RadiationDetection',
                });
            }
        }
    }

    const xrayFiles: XRayFileInfo[] = [];
    for (const xrEl of childEls(scanEl, 'XRayFile')) {
        const uri = childText(xrEl, 'URI');
        const xrMeta = resolveClientUri(entries, scanEventId, uri);
        if (!xrMeta) continue;
        const energiesMeV = childEls(xrEl, 'Energy')
            .map((e) => numOrNull(e.textContent?.trim() ?? ''))
            .filter((n): n is number => n !== null);
        const speeds = childEls(xrEl, 'Speed')
            .map((e) => numOrNull(e.textContent?.trim() ?? ''))
            .filter((n): n is number => n !== null);
        const avgSpeed = speeds.length > 0 ? Math.round((speeds.reduce((a, b) => a + b, 0) / speeds.length) * 10) / 10 : null;

        const hemdInfoEl = firstChildEl(xrEl, 'HEMDInfo');
        const hemdUri = childText(hemdInfoEl, 'HEMDFileURI');
        const hmMeta = hemdUri ? resolveClientUri(entries, scanEventId, hemdUri) : null;
        const zMaps: HemdZMapBand[] = [];
        const hemdMapEl = firstChildEl(hemdInfoEl, 'HEMDMap');
        for (const zmEl of childEls(hemdMapEl, 'ZMap')) {
            const ps = numOrNull(childText(zmEl, 'PaletteStart'));
            const pe = numOrNull(childText(zmEl, 'PaletteEnd'));
            if (ps !== null && pe !== null) {
                zMaps.push({
                    name: childText(zmEl, 'Name'),
                    paletteStart: ps,
                    paletteEnd: pe,
                    effectiveZStart: numOrNull(childText(zmEl, 'EffectiveZStart')) ?? 0,
                    effectiveZEnd: numOrNull(childText(zmEl, 'EffectiveZEnd')) ?? 0,
                });
            }
        }
        xrayFiles.push({
            fileId: childText(xrEl, 'FileId'),
            entryPath: xrMeta.name,
            sizeBytes: xrMeta.uncompSize,
            view: childText(xrEl, 'View'),
            modality: childText(xrEl, 'Modality'),
            scanningMode: childText(xrEl, 'ScanningMode'),
            energiesMeV,
            horizontalPixelSizeMm: numOrNull(childText(xrEl, 'HorizontalPixelSize')),
            verticalPixelSizeMm: numOrNull(childText(xrEl, 'VerticalPixelSize')),
            averageSpeedMmPerSec: avgSpeed,
            hemdEntryPath: hmMeta ? hmMeta.name : '',
            hemdSizeBytes: hmMeta ? hmMeta.uncompSize : 0,
            zMaps,
        });
    }

    const annotations: UffAnnotationInfo[] = [];
    for (const annEl of childEls(analysisEl, 'Annotation')) {
        const bbEl = firstChildEl(annEl, 'BoundingBox');
        if (!bbEl) continue;
        const top = numOrNull(childText(bbEl, 'Top'));
        const left = numOrNull(childText(bbEl, 'Left'));
        const bottom = numOrNull(childText(bbEl, 'Bottom'));
        const right = numOrNull(childText(bbEl, 'Right'));
        if (top === null || left === null || bottom === null || right === null) continue;
        annotations.push({
            annotationId: childText(annEl, 'AnnotationId'),
            description: childText(annEl, 'Description'),
            comment: childText(annEl, 'Comment'),
            confidence: numOrNull(childText(annEl, 'Confidence')),
            fileUri: childText(annEl, 'FileURI'),
            shape: childText(annEl, 'Shape') || 'Rectangle',
            top,
            left,
            bottom,
            right,
        });
    }

    const previewEntry = entries.get('preview.jpg') ?? null;

    let embeddedN42File: File | null = null;
    if (radiationFiles.length > 0) {
        const rad = radiationFiles[0]!;
        const n42Bytes = await readLocalUffEntryBytes(file, rad.entryPath);
        const shortName = `uff-spectrum-${uffUuid}.n42`;
        embeddedN42File = new File([n42Bytes as unknown as BlobPart], shortName, { type: 'application/xml' });
    }

    return {
        metadata: {
            uffUuid,
            uffVersion,
            archiveFileName: file.name,
            relativePath: file.name,
            archiveSizeBytes: file.size,
            archiveMtimeMillis: file.lastModified || Date.now(),
            scannerId,
            scannerManufacturer,
            scannerModel,
            scannerSerial,
            scannerCaseId,
            country,
            latitude,
            longitude,
            scanTimestamp,
            scanEpochMillis,
            scanDurationMs,
            containerNum,
            frontPlateNum,
            vehicleType,
            containerWeightKg,
            vehicleWeightKg,
            containerLengthFt,
            allNormalizedVehicleIds: Array.from(normSet),
            allDisplayVehicleIds: Array.from(dispSet),
            ocrResults,
            declaration,
            manifestEntryPath,
            manifestSizeBytes,
            radiationFiles,
            xrayFiles,
            analysisAssessment: childText(analysisEl, 'Assessment'),
            analysisResult: childText(analysisEl, 'Result'),
            analysisAlgorithmName: childText(firstChildEl(analysisEl, 'Algorithm'), 'Name'),
            analysisVendor: childText(firstChildEl(analysisEl, 'Algorithm'), 'Vendor'),
            annotations,
            previewEntryPath: previewEntry ? previewEntry.name : '',
            previewSizeBytes: previewEntry ? previewEntry.uncompSize : 0,
        },
        embeddedN42File,
    };
}
