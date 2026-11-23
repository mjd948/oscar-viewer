"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    IconButton,
    Paper,
    Slider,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import FlipRoundedIcon from '@mui/icons-material/FlipRounded';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';
import ZoomOutRoundedIcon from '@mui/icons-material/ZoomOutRounded';
import CenterFocusStrongRoundedIcon from '@mui/icons-material/CenterFocusStrongRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { Locale, useLanguage } from '@/app/contexts/LanguageContext';
import { INode } from '@/lib/data/osh/Node';
import {
    fetchCargoUffCase,
    fetchCargoUffEntryBlobUrl,
    fetchCargoUffEntryBytes,
    UffCaseMetadata,
} from '@/lib/data/oscar/CargoUffApi';
import {
    DecodedHemdPng,
    DecodedTiff16,
    decodeHemdPalettizedPng,
    decodeTiff16Bytes,
} from '@/lib/data/oscar/Tiff16Decoder';
import { parseLocalUffFile, readLocalUffEntryBytes } from '@/lib/data/oscar/UffClientArchive';
import { buildNodeBucketBaseUrl, VehiclePassProfileSample } from '@/lib/data/oscar/VehicleSearch';

export interface CargoUffViewerDialogProps {
    open: boolean;
    onClose: () => void;
    uffUuid?: string | null;
    bucketKey?: string | null;
    localFile?: File | null;
    node?: INode | null;
    occupancyObsId?: string | null;
    initialRadiationProfile?: VehiclePassProfileSample[] | null;
    onApplyVehicleId?: (vehicleId: string) => void;
    onLinkToAdjudication?: (uffUuid: string) => Promise<void> | void;
    linkingAdjudication?: boolean;
}

interface ViewerCopy {
    title: string;
    loadingPreview: string;
    upgrading16Bit: string;
    full16BitActive: string;
    windowLevelLabel: string;
    presetAuto: string;
    presetLight: string;
    presetStandard: string;
    presetPenetration: string;
    logAttenuation: string;
    invertPolarity: string;
    highZStrip: string;
    hemdOverlay: string;
    hemdOpacity: string;
    bandOrganic: string;
    bandNorm: string;
    bandHighZ: string;
    annotationsToggle: string;
    flipCab: string;
    cabLeft: string;
    cabRight: string;
    fitView: string;
    rpmAlignmentTitle: string;
    rpmAlignmentHint: string;
    manifestSectionTitle: string;
    openManifestPdf: string;
    ocrSectionTitle: string;
    applyVehicleIdBtn: string;
    linkToAdjudicationBtn: string;
    closeBtn: string;
    pixelProbeLabel: string;
}

const VIEWER_COPY: Record<Locale, ViewerCopy> = {
    en: {
        title: 'Cargo NII Radiograph & Material Inspector (WCO UFF)',
        loadingPreview: 'Loading progressive preview...',
        upgrading16Bit: 'Streaming full 16-bit uint16 radiograph...',
        full16BitActive: '16-Bit uint16 Radiograph Active',
        windowLevelLabel: '16-Bit Window / Level (0 – 65,535)',
        presetAuto: 'Auto 2–98%',
        presetLight: 'Light / Organic',
        presetStandard: 'Standard Cargo',
        presetPenetration: 'High Penetration',
        logAttenuation: 'Log Attenuation',
        invertPolarity: 'Invert',
        highZStrip: 'High-Z Strip',
        hemdOverlay: 'HEMD Material Map',
        hemdOpacity: 'HEMD Blend',
        bandOrganic: 'Organic (Z 6–10)',
        bandNorm: 'NORM / Mineral (Z 11–18)',
        bandHighZ: 'Inorganic / High-Z (Z 21–82)',
        annotationsToggle: 'Scanner Annotations',
        flipCab: 'Flip Cab Orientation',
        cabLeft: 'Cab Left',
        cabRight: 'Cab Right',
        fitView: 'Fit View',
        rpmAlignmentTitle: 'Longitudinal RPM Gamma / Neutron Spatial Alignment',
        rpmAlignmentHint: 'Aligned across container span — use Flip Cab if portal transit direction is reversed.',
        manifestSectionTitle: 'Trade Manifest, Customs Declaration & WCO Technical Metadata',
        openManifestPdf: 'View Trade Manifest (PDF)',
        ocrSectionTitle: 'Scanner Optical CCR / LPR Captures',
        applyVehicleIdBtn: 'Use Vehicle ID',
        linkToAdjudicationBtn: 'Link UFF Scan to Adjudication',
        closeBtn: 'Close',
        pixelProbeLabel: '16-bit Transmission Probe',
    },
    es: {
        title: 'Inspector de Radiografía de Carga y Materiales NII (WCO UFF)',
        loadingPreview: 'Cargando vista previa progresiva...',
        upgrading16Bit: 'Transmitiendo radiografía completa de 16 bits...',
        full16BitActive: 'Radiografía uint16 de 16 bits activa',
        windowLevelLabel: 'Ventana / Nivel de 16 bits (0 – 65.535)',
        presetAuto: 'Auto 2–98%',
        presetLight: 'Carga ligera / Orgánica',
        presetStandard: 'Carga estándar',
        presetPenetration: 'Alta penetración',
        logAttenuation: 'Atenuación log',
        invertPolarity: 'Invertir',
        highZStrip: 'Filtro Alto-Z',
        hemdOverlay: 'Mapa de materiales HEMD',
        hemdOpacity: 'Mezcla HEMD',
        bandOrganic: 'Orgánico (Z 6–10)',
        bandNorm: 'NORM / Mineral (Z 11–18)',
        bandHighZ: 'Inorgánico / Alto-Z (Z 21–82)',
        annotationsToggle: 'Anotaciones automáticas',
        flipCab: 'Invertir cabina',
        cabLeft: 'Cabina izq.',
        cabRight: 'Cabina der.',
        fitView: 'Ajustar vista',
        rpmAlignmentTitle: 'Alineación longitudinal Gamma / Neutrones RPM',
        rpmAlignmentHint: 'Alineado a lo largo del contenedor — use Invertir cabina si el sentido de paso es opuesto.',
        manifestSectionTitle: 'Manifiesto de carga, declaración aduanera y metadatos WCO',
        openManifestPdf: 'Abrir manifiesto (PDF)',
        ocrSectionTitle: 'Capturas ópticas CCR / LPR del escáner',
        applyVehicleIdBtn: 'Usar ID de vehículo',
        linkToAdjudicationBtn: 'Vincular escaneo UFF a la adjudicación',
        closeBtn: 'Cerrar',
        pixelProbeLabel: 'Sonda de transmisión 16 bits',
    },
    fr: {
        title: 'Inspecteur radiographique de fret et matériaux NII (OMD UFF)',
        loadingPreview: 'Chargement de l’aperçu progressif...',
        upgrading16Bit: 'Transmission de la radiographie 16 bits...',
        full16BitActive: 'Radiographie uint16 16 bits active',
        windowLevelLabel: 'Fenêtre / Niveau 16 bits (0 – 65 535)',
        presetAuto: 'Auto 2–98 %',
        presetLight: 'Fret léger / Organique',
        presetStandard: 'Fret standard',
        presetPenetration: 'Haute pénétration',
        logAttenuation: 'Atténuation log',
        invertPolarity: 'Inverser',
        highZStrip: 'Filtre Haut-Z',
        hemdOverlay: 'Carte matériaux HEMD',
        hemdOpacity: 'Opacité HEMD',
        bandOrganic: 'Organique (Z 6–10)',
        bandNorm: 'NORM / Minéral (Z 11–18)',
        bandHighZ: 'Inorganique / Haut-Z (Z 21–82)',
        annotationsToggle: 'Annotations scanner',
        flipCab: 'Inverser la cabine',
        cabLeft: 'Cabine gauche',
        cabRight: 'Cabine droite',
        fitView: 'Ajuster la vue',
        rpmAlignmentTitle: 'Alignement longitudinal RPM Gamma / Neutrons',
        rpmAlignmentHint: 'Aligné sur la longueur du conteneur — inversez la cabine si le sens de passage diffère.',
        manifestSectionTitle: 'Manifeste commercial, déclaration douanière et métadonnées OMD',
        openManifestPdf: 'Ouvrir le manifeste (PDF)',
        ocrSectionTitle: 'Captures optiques CCR / LPR du scanner',
        applyVehicleIdBtn: 'Utiliser l’ID véhicule',
        linkToAdjudicationBtn: 'Lier le scan UFF à l’adjudication',
        closeBtn: 'Fermer',
        pixelProbeLabel: 'Sonde de transmission 16 bits',
    },
    el: {
        title: 'Επιθεωρητής Ακτινογραφίας Φορτίου & Υλικών NII (WCO UFF)',
        loadingPreview: 'Φόρτωση προοδευτικής προεπισκόπησης...',
        upgrading16Bit: 'Ροή πλήρους ακτινογραφίας 16-bit...',
        full16BitActive: 'Ακτινογραφία 16-bit uint16 ενεργή',
        windowLevelLabel: 'Παράθυρο / Επίπεδο 16-bit (0 – 65.535)',
        presetAuto: 'Αυτόματο 2–98%',
        presetLight: 'Ελαφρύ / Οργανικό',
        presetStandard: 'Τυπικό φορτίο',
        presetPenetration: 'Υψηλή διείσδυση',
        logAttenuation: 'Λογ. εξασθένηση',
        invertPolarity: 'Αντιστροφή',
        highZStrip: 'Φίλτρο Υψηλού-Z',
        hemdOverlay: 'Χάρτης υλικών HEMD',
        hemdOpacity: 'Μείξη HEMD',
        bandOrganic: 'Οργανικά (Z 6–10)',
        bandNorm: 'NORM / Ορυκτά (Z 11–18)',
        bandHighZ: 'Ανόργανα / Υψηλό-Z (Z 21–82)',
        annotationsToggle: 'Επισημάνσεις σαρωτή',
        flipCab: 'Αναστροφή καμπίνας',
        cabLeft: 'Καμπίνα αριστερά',
        cabRight: 'Καμπίνα δεξιά',
        fitView: 'Προσαρμογή',
        rpmAlignmentTitle: 'Διαμήκης ευθυγράμμιση ακτινοβολίας Γάμμα / Νετρονίων RPM',
        rpmAlignmentHint: 'Ευθυγράμμιση κατά μήκος του εμπορευματοκιβωτίου — αναστρέψτε την καμπίνα αν χρειάζεται.',
        manifestSectionTitle: 'Δηλωτικό φορτίου, τελωνειακή δήλωση & μεταδεδομένα WCO',
        openManifestPdf: 'Προβολή δηλωτικού (PDF)',
        ocrSectionTitle: 'Οπτικές λήψεις CCR / LPR σαρωτή',
        applyVehicleIdBtn: 'Χρήση ID οχήματος',
        linkToAdjudicationBtn: 'Σύνδεση σάρωσης UFF στην κρίση',
        closeBtn: 'Κλείσιμο',
        pixelProbeLabel: 'Ανιχνευτής διέλευσης 16-bit',
    },
};

const VERTEX_SHADER_SRC = `#version 300 es
in vec2 a_pos;
in vec2 a_uv;
out vec2 v_uv;
void main() {
    gl_Position = vec4(a_pos, 0.0, 1.0);
    v_uv = a_uv;
}
`;

const FRAGMENT_SHADER_SRC = `#version 300 es
precision highp float;
precision highp usampler2D;

in vec2 v_uv;
out vec4 outColor;

uniform usampler2D u_xray;
uniform usampler2D u_hemd;
uniform sampler2D u_palette;

uniform float u_winLow;
uniform float u_winHigh;
uniform int u_logMode;
uniform int u_invert;
uniform int u_highZStrip;
uniform int u_hasHemd;
uniform float u_hemdAlpha;
uniform int u_bandMask; // bit 1=organic(1..11), bit 2=norm(12..20), bit 4=highZ(21..255)
uniform int u_flipX;

void main() {
    vec2 uv = vec2(u_flipX == 1 ? (1.0 - v_uv.x) : v_uv.x, v_uv.y);
    uint rawVal = texture(u_xray, uv).r;
    if (rawVal == 0u) {
        outColor = vec4(0.97, 0.98, 0.99, 1.0);
        return;
    }

    float v = float(rawVal);
    float lo = max(1.0, u_winLow);
    float hi = max(lo + 1.0, u_winHigh);
    float norm;
    if (u_logMode == 1) {
        // Beer-Lambert optical thickness maps low transmission to dark/dense highlight
        float att = log(hi / clamp(v, lo, hi)) / max(0.001, log(hi / lo));
        norm = 1.0 - clamp(att, 0.0, 1.0);
    } else {
        norm = clamp((v - lo) / (hi - lo), 0.0, 1.0);
    }

    if (u_invert == 1) {
        norm = 1.0 - norm;
    }

    vec3 rgb = vec3(norm);

    if (u_highZStrip == 1) {
        if (rawVal < 2800u) {
            rgb = mix(rgb, vec3(0.22, 0.08, 0.78), 0.72);
        } else {
            rgb = vec3(0.82 + 0.16 * norm);
        }
    }

    if (u_hasHemd == 1 && u_hemdAlpha > 0.001) {
        uint idx = texture(u_hemd, uv).r;
        bool bandAllowed = false;
        if (idx >= 1u && idx <= 11u && (u_bandMask & 1) != 0) bandAllowed = true;
        else if (idx >= 12u && idx <= 20u && (u_bandMask & 2) != 0) bandAllowed = true;
        else if (idx >= 21u && (u_bandMask & 4) != 0) bandAllowed = true;

        if (bandAllowed) {
            vec3 palColor = texelFetch(u_palette, ivec2(int(idx), 0), 0).rgb;
            // Multiply-tint preserves 16-bit internal pallet/rib luminance modulation!
            vec3 tinted = palColor * (0.28 + 0.72 * norm);
            rgb = mix(rgb, tinted, u_hemdAlpha);
        }
    }

    outColor = vec4(rgb, 1.0);
}
`;

interface GlContextResources {
    gl: WebGL2RenderingContext;
    program: WebGLProgram;
    vao: WebGLVertexArrayObject;
    xrayTex: WebGLTexture;
    hemdTex: WebGLTexture;
    palTex: WebGLTexture;
    uploadedXrayRef: Uint16Array | null;
    uploadedHemdRef: Uint8Array | null;
}

function createShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null;
    }
    return sh;
}

export default function CargoUffViewerDialog({
    open,
    onClose,
    uffUuid,
    bucketKey,
    localFile,
    node,
    occupancyObsId,
    initialRadiationProfile,
    onApplyVehicleId,
    onLinkToAdjudication,
    linkingAdjudication = false,
}: CargoUffViewerDialogProps) {
    const { language } = useLanguage();
    const copy = VIEWER_COPY[language] ?? VIEWER_COPY.en;
    const titleId = useId();
    const wlSliderId = useId();

    const [metadata, setMetadata] = useState<UffCaseMetadata | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [manifestBlobUrl, setManifestBlobUrl] = useState<string | null>(null);
    const [ocrCropUrls, setOcrCropUrls] = useState<Record<string, string>>({});
    const [decodedXray, setDecodedXray] = useState<DecodedTiff16 | null>(null);
    const [decodedHemd, setDecodedHemd] = useState<DecodedHemdPng | null>(null);
    const [loadingMeta, setLoadingMeta] = useState(false);
    const [loading16Bit, setLoading16Bit] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Radiograph contrast & material controls
    const [windowRange, setWindowRange] = useState<[number, number]>([800, 62000]);
    const [logMode, setLogMode] = useState(false);
    const [invertPolarity, setInvertPolarity] = useState(false);
    const [highZStrip, setHighZStrip] = useState(false);
    const [showHemd, setShowHemd] = useState(true);
    const [hemdOpacity, setHemdOpacity] = useState(0.55);
    const [showOrganic, setShowOrganic] = useState(true);
    const [showNorm, setShowNorm] = useState(true);
    const [showHighZ, setShowHighZ] = useState(true);
    const [showAnnotations, setShowAnnotations] = useState(true);
    const [flipCab, setFlipCab] = useState(false);

    // Viewport zoom / pan & 16-bit cursor probe
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const dragStateRef = useRef<{ active: boolean; startX: number; startY: number; origX: number; origY: number }>({
        active: false,
        startX: 0,
        startY: 0,
        origX: 0,
        origY: 0,
    });
    const [probeInfo, setProbeInfo] = useState<{
        px: number;
        py: number;
        metersX: number;
        rawU16: number;
        hemdClass: string;
    } | null>(null);

    // Longitudinal RPM profile
    const [rpmProfile, setRpmProfile] = useState<VehiclePassProfileSample[]>(initialRadiationProfile ?? []);

    const glCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const glResRef = useRef<GlContextResources | null>(null);
    const blobUrlsToRevokeRef = useRef<string[]>([]);

    const registerBlobUrl = useCallback((url: string) => {
        blobUrlsToRevokeRef.current.push(url);
        return url;
    }, []);

    // Cleanup object URLs & WebGL context on close
    useEffect(() => {
        if (!open) {
            for (const u of blobUrlsToRevokeRef.current) {
                URL.revokeObjectURL(u);
            }
            blobUrlsToRevokeRef.current = [];
            glResRef.current = null;
            setPreviewUrl(null);
            setManifestBlobUrl(null);
            setOcrCropUrls({});
            setDecodedXray(null);
            setDecodedHemd(null);
            setMetadata(null);
            setErrorMsg(null);
            setZoom(1);
            setPan({ x: 0, y: 0 });
            setFlipCab(false);
            setProbeInfo(null);
        }
    }, [open]);

    // Hydrate occupancy RPM radiation profile if occupancyObsId is supplied
    useEffect(() => {
        if (!open) return;
        if (initialRadiationProfile && initialRadiationProfile.length > 0) {
            setRpmProfile(initialRadiationProfile);
            return;
        }
        if (!occupancyObsId) {
            setRpmProfile([]);
            return;
        }
        const ctrl = new AbortController();
        (async () => {
            try {
                const base = node ? buildNodeBucketBaseUrl(node) : '/sensorhub/buckets';
                const qs = new URLSearchParams({
                    profileOnlyObsIds: occupancyObsId,
                    includeProfiles: 'true',
                });
                const headers: Record<string, string> = { Accept: 'application/json' };
                if (node && typeof node.getBasicAuthHeader === 'function') {
                    Object.assign(headers, node.getBasicAuthHeader() || {});
                }
                const resp = await fetch(`${base}/adjudication/vehicle-search?${qs.toString()}`, {
                    credentials: 'include',
                    headers,
                    signal: ctrl.signal,
                });
                if (!resp.ok) return;
                const data = await resp.json();
                const samples = data?.passes?.[0]?.radiationProfile;
                if (Array.isArray(samples)) {
                    setRpmProfile(samples);
                }
            } catch {
                // Non-fatal: radiograph inspection still works standalone
            }
        })();
        return () => ctrl.abort();
    }, [open, occupancyObsId, node, initialRadiationProfile]);

    // Load UFF metadata -> fast progressive preview.jpg -> background 16-bit TIFF + HEMD decode
    useEffect(() => {
        if (!open) return;
        if (!localFile && !uffUuid && !bucketKey) return;

        const ctrl = new AbortController();
        let cancelled = false;

        const readBytes = async (entryPath: string, metaUuid: string): Promise<Uint8Array> => {
            if (localFile) {
                return readLocalUffEntryBytes(localFile, entryPath);
            }
            return fetchCargoUffEntryBytes(
                { uffUuid: bucketKey ? undefined : metaUuid, bucketKey: bucketKey ?? undefined, entry: entryPath },
                node,
                ctrl.signal,
            );
        };

        const readBlobUrl = async (entryPath: string, metaUuid: string, mimeType: string): Promise<string> => {
            if (localFile) {
                const bytes = await readLocalUffEntryBytes(localFile, entryPath);
                return registerBlobUrl(URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: mimeType })));
            }
            const url = await fetchCargoUffEntryBlobUrl(
                {
                    uffUuid: bucketKey ? undefined : metaUuid,
                    bucketKey: bucketKey ?? undefined,
                    entry: entryPath,
                    mimeType,
                },
                node,
                ctrl.signal,
            );
            return registerBlobUrl(url);
        };

        (async () => {
            try {
                setLoadingMeta(true);
                setErrorMsg(null);

                let meta: UffCaseMetadata;
                if (localFile) {
                    meta = (await parseLocalUffFile(localFile)).metadata;
                } else {
                    meta = await fetchCargoUffCase(
                        { uffUuid: uffUuid ?? undefined, bucketKey: bucketKey ?? undefined },
                        node,
                        ctrl.signal,
                    );
                }
                if (cancelled) return;
                setMetadata(meta);
                setLoadingMeta(false);

                // Stage 0: Instant ~40 KB preview.jpg (< 80 ms over WAN/Octelium!)
                if (meta.previewEntryPath) {
                    readBlobUrl(meta.previewEntryPath, meta.uffUuid, 'image/jpeg')
                        .then((url) => {
                            if (!cancelled) setPreviewUrl(url);
                        })
                        .catch(() => {});
                }

                // Stage 1: Full 16-bit TIFF + palettized HEMD PNG
                const primaryXray = meta.xrayFiles[0];
                if (primaryXray?.entryPath) {
                    setLoading16Bit(true);
                    const [tifBytes, hemdBytes] = await Promise.all([
                        readBytes(primaryXray.entryPath, meta.uffUuid),
                        primaryXray.hemdEntryPath
                            ? readBytes(primaryXray.hemdEntryPath, meta.uffUuid).catch((): Uint8Array | null => null)
                            : Promise.resolve<Uint8Array | null>(null),
                    ]);
                    if (cancelled) return;
                    const tiffDecoded = await decodeTiff16Bytes(tifBytes);
                    const hemdDecoded = hemdBytes
                        ? await decodeHemdPalettizedPng(hemdBytes).catch((): DecodedHemdPng | null => null)
                        : null;
                    if (cancelled) return;
                    setDecodedXray(tiffDecoded);
                    setDecodedHemd(hemdDecoded);
                    setWindowRange([tiffDecoded.p02, tiffDecoded.p98]);
                    setShowHemd(Boolean(hemdDecoded));
                    setLoading16Bit(false);
                }

                // Stage 2: Lightweight OCR crops & Manifest PDF blob URL
                if (meta.manifestEntryPath) {
                    readBlobUrl(meta.manifestEntryPath, meta.uffUuid, 'application/pdf')
                        .then((url) => {
                            if (!cancelled) setManifestBlobUrl(url);
                        })
                        .catch(() => {});
                }
                for (const ocr of meta.ocrResults) {
                    if (ocr.imageEntryPath) {
                        readBlobUrl(ocr.imageEntryPath, meta.uffUuid, 'image/jpeg')
                            .then((url) => {
                                if (!cancelled) {
                                    setOcrCropUrls((prev) => ({ ...prev, [ocr.imageEntryPath]: url }));
                                }
                            })
                            .catch(() => {});
                    }
                }
            } catch (err: any) {
                if (!cancelled && err?.name !== 'AbortError') {
                    setErrorMsg(err?.message || 'Unable to load Cargo UFF package');
                    setLoadingMeta(false);
                    setLoading16Bit(false);
                }
            }
        })();

        return () => {
            cancelled = true;
            ctrl.abort();
        };
    }, [open, localFile, uffUuid, bucketKey, node, registerBlobUrl]);

    // Render 16-bit radiograph via WebGL2 R16UI (with automatic 65,536-entry LUT Canvas2D fallback)
    useEffect(() => {
        const canvas = glCanvasRef.current;
        if (!canvas || !decodedXray) return;

        const { width, height, pixels } = decodedXray;
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }

        const bandMask = (showOrganic ? 1 : 0) | (showNorm ? 2 : 0) | (showHighZ ? 4 : 0);

        // Try WebGL2 hardware/SwiftShader R16UI pipeline first
        let res = glResRef.current;
        if (!res) {
            const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
            if (gl) {
                const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
                const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
                const prog = gl.createProgram();
                if (vs && fs && prog) {
                    gl.attachShader(prog, vs);
                    gl.attachShader(prog, fs);
                    gl.linkProgram(prog);
                    if (gl.getProgramParameter(prog, gl.LINK_STATUS)) {
                        const vao = gl.createVertexArray()!;
                        gl.bindVertexArray(vao);
                        const buf = gl.createBuffer()!;
                        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
                        // Quad: pos.x, pos.y, uv.x, uv.y (flip Y so image row 0 is at top)
                        const quad = new Float32Array([
                            -1, -1, 0, 1,
                             1, -1, 1, 1,
                            -1,  1, 0, 0,
                             1,  1, 1, 0,
                        ]);
                        gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
                        const posLoc = gl.getAttribLocation(prog, 'a_pos');
                        const uvLoc = gl.getAttribLocation(prog, 'a_uv');
                        gl.enableVertexAttribArray(posLoc);
                        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
                        gl.enableVertexAttribArray(uvLoc);
                        gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);

                        const xrayTex = gl.createTexture()!;
                        const hemdTex = gl.createTexture()!;
                        const palTex = gl.createTexture()!;
                        res = {
                            gl,
                            program: prog,
                            vao,
                            xrayTex,
                            hemdTex,
                            palTex,
                            uploadedXrayRef: null,
                            uploadedHemdRef: null,
                        };
                        glResRef.current = res;
                    }
                }
            }
        }

        if (res) {
            const { gl, program, vao, xrayTex, hemdTex, palTex } = res;
            gl.viewport(0, 0, width, height);
            gl.useProgram(program);
            gl.bindVertexArray(vao);

            if (res.uploadedXrayRef !== pixels) {
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, xrayTex);
                gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16UI, width, height, 0, gl.RED_INTEGER, gl.UNSIGNED_SHORT, pixels);
                res.uploadedXrayRef = pixels;
            } else {
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, xrayTex);
            }

            if (decodedHemd && res.uploadedHemdRef !== decodedHemd.indices) {
                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_2D, hemdTex);
                gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texImage2D(
                    gl.TEXTURE_2D,
                    0,
                    gl.R8UI,
                    decodedHemd.width,
                    decodedHemd.height,
                    0,
                    gl.RED_INTEGER,
                    gl.UNSIGNED_BYTE,
                    decodedHemd.indices,
                );

                gl.activeTexture(gl.TEXTURE2);
                gl.bindTexture(gl.TEXTURE_2D, palTex);
                gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, 256, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, decodedHemd.paletteRgb);
                res.uploadedHemdRef = decodedHemd.indices;
            } else {
                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_2D, hemdTex);
                gl.activeTexture(gl.TEXTURE2);
                gl.bindTexture(gl.TEXTURE_2D, palTex);
            }

            gl.uniform1i(gl.getUniformLocation(program, 'u_xray'), 0);
            gl.uniform1i(gl.getUniformLocation(program, 'u_hemd'), 1);
            gl.uniform1i(gl.getUniformLocation(program, 'u_palette'), 2);
            gl.uniform1f(gl.getUniformLocation(program, 'u_winLow'), windowRange[0]);
            gl.uniform1f(gl.getUniformLocation(program, 'u_winHigh'), windowRange[1]);
            gl.uniform1i(gl.getUniformLocation(program, 'u_logMode'), logMode ? 1 : 0);
            gl.uniform1i(gl.getUniformLocation(program, 'u_invert'), invertPolarity ? 1 : 0);
            gl.uniform1i(gl.getUniformLocation(program, 'u_highZStrip'), highZStrip ? 1 : 0);
            gl.uniform1i(gl.getUniformLocation(program, 'u_hasHemd'), decodedHemd && showHemd ? 1 : 0);
            gl.uniform1f(gl.getUniformLocation(program, 'u_hemdAlpha'), hemdOpacity);
            gl.uniform1i(gl.getUniformLocation(program, 'u_bandMask'), bandMask);
            gl.uniform1i(gl.getUniformLocation(program, 'u_flipX'), flipCab ? 1 : 0);

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            return;
        }

        // Fast 65,536-entry LUT Canvas2D fallback when WebGL2 is unavailable
        const ctx2d = canvas.getContext('2d');
        if (!ctx2d) return;
        const imgData = ctx2d.createImageData(width, height);
        const out32 = new Uint32Array(imgData.data.buffer);
        const grayLut = new Uint8Array(65536);
        const lo = Math.max(1, windowRange[0]);
        const hi = Math.max(lo + 1, windowRange[1]);
        const logDenom = Math.max(0.001, Math.log(hi / lo));

        for (let v = 1; v < 65536; v++) {
            let n: number;
            if (logMode) {
                const clamped = Math.min(hi, Math.max(lo, v));
                n = 1 - Math.min(1, Math.max(0, Math.log(hi / clamped) / logDenom));
            } else {
                n = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
            }
            if (invertPolarity) n = 1 - n;
            grayLut[v] = Math.round(n * 255);
        }

        const useHemd = Boolean(decodedHemd && showHemd && hemdOpacity > 0.001);
        const pal = decodedHemd?.paletteRgb;
        const indices = decodedHemd?.indices;
        const alpha = hemdOpacity;

        for (let y = 0; y < height; y++) {
            const rowOff = y * width;
            for (let x = 0; x < width; x++) {
                const srcX = flipCab ? width - 1 - x : x;
                const rawVal = pixels[rowOff + srcX]!;
                if (rawVal === 0) {
                    out32[rowOff + x] = 0xfffcfaf8;
                    continue;
                }
                const g = grayLut[rawVal]!;
                let r = g;
                let gr = g;
                let b = g;

                if (highZStrip) {
                    if (rawVal < 2800) {
                        r = Math.round(r * 0.28 + 56 * 0.72);
                        gr = Math.round(gr * 0.28 + 20 * 0.72);
                        b = Math.round(b * 0.28 + 199 * 0.72);
                    } else {
                        r = gr = b = Math.round(210 + 0.16 * g);
                    }
                }

                if (useHemd && indices && pal) {
                    const idx = indices[rowOff + srcX]!;
                    const allowed =
                        (idx >= 1 && idx <= 11 && showOrganic) ||
                        (idx >= 12 && idx <= 20 && showNorm) ||
                        (idx >= 21 && showHighZ);
                    if (allowed) {
                        const lumScale = 0.28 + 0.72 * (g / 255);
                        const pr = pal[idx * 3]! * lumScale;
                        const pg = pal[idx * 3 + 1]! * lumScale;
                        const pb = pal[idx * 3 + 2]! * lumScale;
                        r = Math.round(r * (1 - alpha) + pr * alpha);
                        gr = Math.round(gr * (1 - alpha) + pg * alpha);
                        b = Math.round(b * (1 - alpha) + pb * alpha);
                    }
                }
                out32[rowOff + x] = (255 << 24) | (b << 16) | (gr << 8) | r;
            }
        }
        ctx2d.putImageData(imgData, 0, 0);
    }, [
        decodedXray,
        decodedHemd,
        windowRange,
        logMode,
        invertPolarity,
        highZStrip,
        showHemd,
        hemdOpacity,
        showOrganic,
        showNorm,
        showHighZ,
        flipCab,
    ]);

    const handleCanvasPointerMove = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (dragStateRef.current.active) {
                const dx = e.clientX - dragStateRef.current.startX;
                const dy = e.clientY - dragStateRef.current.startY;
                setPan({ x: dragStateRef.current.origX + dx, y: dragStateRef.current.origY + dy });
                return;
            }
            if (!decodedXray || !glCanvasRef.current) return;
            const rect = glCanvasRef.current.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            const u = (e.clientX - rect.left) / rect.width;
            const v = (e.clientY - rect.top) / rect.height;
            if (u < 0 || u > 1 || v < 0 || v > 1) {
                setProbeInfo(null);
                return;
            }
            const dispX = Math.min(decodedXray.width - 1, Math.max(0, Math.floor(u * decodedXray.width)));
            const srcX = flipCab ? decodedXray.width - 1 - dispX : dispX;
            const srcY = Math.min(decodedXray.height - 1, Math.max(0, Math.floor(v * decodedXray.height)));
            const rawU16 = decodedXray.pixels[srcY * decodedXray.width + srcX] ?? 0;
            const hIdx = decodedHemd?.indices[srcY * decodedXray.width + srcX] ?? 0;
            const hClass =
                hIdx === 0
                    ? 'Air'
                    : hIdx <= 11
                      ? 'Organic'
                      : hIdx <= 20
                        ? 'Intermediate / NORM'
                        : 'Inorganic / High-Z';
            const mmPerPx = metadata?.xrayFiles[0]?.horizontalPixelSizeMm ?? 4.0;
            setProbeInfo({
                px: srcX,
                py: srcY,
                metersX: Math.round(((dispX * mmPerPx) / 1000) * 100) / 100,
                rawU16,
                hemdClass: hClass,
            });
        },
        [decodedXray, decodedHemd, flipCab, metadata],
    );

    const rpmPolyline = useMemo(() => {
        if (!rpmProfile || rpmProfile.length < 2) return null;
        const maxG = Math.max(1, ...rpmProfile.map((s) => s.gammaCounts));
        const maxN = Math.max(1, ...rpmProfile.map((s) => s.neutronCounts));
        const n = rpmProfile.length;
        const gammaPts: string[] = [];
        const neutronPts: string[] = [];
        rpmProfile.forEach((s, idx) => {
            const frac = idx / (n - 1);
            const x = (frac * 1000).toFixed(1);
            const gy = (54 - (s.gammaCounts / maxG) * 46).toFixed(1);
            const ny = (54 - (s.neutronCounts / maxN) * 46).toFixed(1);
            gammaPts.push(`${x},${gy}`);
            neutronPts.push(`${x},${ny}`);
        });
        return { gamma: gammaPts.join(' '), neutron: neutronPts.join(' '), maxG, maxN };
    }, [rpmProfile]);

    const primaryXrayInfo = metadata?.xrayFiles[0];

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="xl"
            aria-labelledby={titleId}
            data-testid="cargo-uff-viewer-dialog"
        >
            <DialogTitle id={titleId} sx={{ pr: 6, py: 1.5 }}>
                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                    <LayersRoundedIcon color="primary" />
                    <Typography variant="h6" component="span" fontWeight={700}>
                        {copy.title}
                    </Typography>
                    {metadata && (
                        <>
                            <Chip
                                size="small"
                                color="primary"
                                label={`UFF ${metadata.uffVersion}`}
                                data-testid="uff-viewer-version-chip"
                            />
                            {metadata.scannerId && (
                                <Chip size="small" variant="outlined" label={metadata.scannerId} />
                            )}
                            {metadata.allDisplayVehicleIds.map((vid) => (
                                <Chip
                                    key={vid}
                                    size="small"
                                    color="secondary"
                                    label={vid}
                                    onClick={onApplyVehicleId ? () => onApplyVehicleId(vid) : undefined}
                                    data-testid="uff-viewer-vehicle-chip"
                                />
                            ))}
                            <Chip
                                size="small"
                                color={decodedXray ? 'success' : 'info'}
                                icon={decodedXray ? <CheckCircleRoundedIcon /> : undefined}
                                label={
                                    decodedXray
                                        ? `${copy.full16BitActive} (${decodedXray.width}×${decodedXray.height})`
                                        : loading16Bit
                                          ? copy.upgrading16Bit
                                          : copy.loadingPreview
                                }
                                data-testid="uff-viewer-resolution-chip"
                            />
                        </>
                    )}
                </Stack>
                <IconButton
                    type="button"
                    aria-label={copy.closeBtn}
                    onClick={onClose}
                    data-testid="cargo-uff-viewer-close"
                    sx={{ position: 'absolute', right: 8, top: 8 }}
                >
                    <CloseRoundedIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent dividers sx={{ p: 2 }}>
                {errorMsg && (
                    <Alert severity="error" role="alert" sx={{ mb: 2 }}>
                        {errorMsg}
                    </Alert>
                )}

                {loadingMeta && !metadata && (
                    <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" sx={{ py: 6 }}>
                        <CircularProgress size={24} />
                        <Typography variant="body2">{copy.loadingPreview}</Typography>
                    </Stack>
                )}

                {metadata && (
                    <Stack spacing={1.5}>
                        {/* Analyst Contrast, Material Discrimination & Orientation Toolbar */}
                        <Paper variant="outlined" sx={{ p: 1.5 }}>
                            <Stack spacing={1.25}>
                                <Stack
                                    direction={{ xs: 'column', lg: 'row' }}
                                    spacing={2}
                                    alignItems={{ lg: 'center' }}
                                    justifyContent="space-between"
                                >
                                    <Box sx={{ flex: '1 1 320px', px: 1 }}>
                                        <Typography id={wlSliderId} variant="caption" fontWeight={700} display="block">
                                            {copy.windowLevelLabel}: {windowRange[0].toLocaleString()} –{' '}
                                            {windowRange[1].toLocaleString()}
                                        </Typography>
                                        <Slider
                                            size="small"
                                            min={0}
                                            max={65535}
                                            step={128}
                                            value={windowRange}
                                            aria-labelledby={wlSliderId}
                                            onChange={(_, val) => {
                                                if (Array.isArray(val) && val.length === 2) {
                                                    setWindowRange([val[0]!, val[1]!]);
                                                }
                                            }}
                                            data-testid="uff-window-level-slider"
                                        />
                                    </Box>

                                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                        <Button
                                            type="button"
                                            size="small"
                                            variant="outlined"
                                            onClick={() =>
                                                setWindowRange(
                                                    decodedXray ? [decodedXray.p02, decodedXray.p98] : [800, 62000],
                                                )
                                            }
                                            data-testid="uff-preset-auto"
                                        >
                                            {copy.presetAuto}
                                        </Button>
                                        <Button
                                            type="button"
                                            size="small"
                                            variant="outlined"
                                            onClick={() => setWindowRange([22000, 62000])}
                                            data-testid="uff-preset-light"
                                        >
                                            {copy.presetLight}
                                        </Button>
                                        <Button
                                            type="button"
                                            size="small"
                                            variant="outlined"
                                            onClick={() => setWindowRange([4000, 48000])}
                                            data-testid="uff-preset-standard"
                                        >
                                            {copy.presetStandard}
                                        </Button>
                                        <Button
                                            type="button"
                                            size="small"
                                            variant="outlined"
                                            color="warning"
                                            onClick={() => setWindowRange([100, 12000])}
                                            data-testid="uff-preset-penetration"
                                        >
                                            {copy.presetPenetration}
                                        </Button>
                                    </Stack>
                                </Stack>

                                <Divider />

                                <Stack
                                    direction="row"
                                    spacing={1.5}
                                    alignItems="center"
                                    justifyContent="space-between"
                                    flexWrap="wrap"
                                    useFlexGap
                                >
                                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    size="small"
                                                    checked={logMode}
                                                    onChange={(e) => setLogMode(e.target.checked)}
                                                    data-testid="uff-toggle-log"
                                                />
                                            }
                                            label={<Typography variant="body2">{copy.logAttenuation}</Typography>}
                                        />
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    size="small"
                                                    checked={invertPolarity}
                                                    onChange={(e) => setInvertPolarity(e.target.checked)}
                                                    data-testid="uff-toggle-invert"
                                                />
                                            }
                                            label={<Typography variant="body2">{copy.invertPolarity}</Typography>}
                                        />
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    size="small"
                                                    checked={highZStrip}
                                                    onChange={(e) => setHighZStrip(e.target.checked)}
                                                    data-testid="uff-toggle-highz-strip"
                                                />
                                            }
                                            label={<Typography variant="body2">{copy.highZStrip}</Typography>}
                                        />
                                        {primaryXrayInfo?.hemdEntryPath && (
                                            <>
                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            size="small"
                                                            checked={showHemd}
                                                            onChange={(e) => setShowHemd(e.target.checked)}
                                                            data-testid="uff-toggle-hemd"
                                                        />
                                                    }
                                                    label={<Typography variant="body2">{copy.hemdOverlay}</Typography>}
                                                />
                                                {showHemd && (
                                                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                                                        <Box sx={{ width: 96 }}>
                                                            <Slider
                                                                size="small"
                                                                min={0.1}
                                                                max={0.9}
                                                                step={0.05}
                                                                value={hemdOpacity}
                                                                aria-label={copy.hemdOpacity}
                                                                onChange={(_, v) => setHemdOpacity(Number(v))}
                                                            />
                                                        </Box>
                                                        <Chip
                                                            size="small"
                                                            variant={showOrganic ? 'filled' : 'outlined'}
                                                            onClick={() => setShowOrganic((p) => !p)}
                                                            sx={{
                                                                bgcolor: showOrganic ? '#e67e22' : undefined,
                                                                color: showOrganic ? '#fff' : undefined,
                                                            }}
                                                            label={copy.bandOrganic}
                                                            data-testid="uff-band-organic"
                                                        />
                                                        <Chip
                                                            size="small"
                                                            variant={showNorm ? 'filled' : 'outlined'}
                                                            onClick={() => setShowNorm((p) => !p)}
                                                            sx={{
                                                                bgcolor: showNorm ? '#1e8449' : undefined,
                                                                color: showNorm ? '#fff' : undefined,
                                                            }}
                                                            label={copy.bandNorm}
                                                            data-testid="uff-band-norm"
                                                        />
                                                        <Chip
                                                            size="small"
                                                            variant={showHighZ ? 'filled' : 'outlined'}
                                                            onClick={() => setShowHighZ((p) => !p)}
                                                            sx={{
                                                                bgcolor: showHighZ ? '#283593' : undefined,
                                                                color: showHighZ ? '#fff' : undefined,
                                                            }}
                                                            label={copy.bandHighZ}
                                                            data-testid="uff-band-highz"
                                                        />
                                                    </Stack>
                                                )}
                                            </>
                                        )}
                                        {metadata.annotations.length > 0 && (
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        size="small"
                                                        checked={showAnnotations}
                                                        onChange={(e) => setShowAnnotations(e.target.checked)}
                                                        data-testid="uff-toggle-annotations"
                                                    />
                                                }
                                                label={
                                                    <Typography variant="body2">
                                                        {copy.annotationsToggle} ({metadata.annotations.length})
                                                    </Typography>
                                                }
                                            />
                                        )}
                                    </Stack>

                                    <Stack direction="row" spacing={0.75} alignItems="center">
                                        <Button
                                            type="button"
                                            size="small"
                                            variant={flipCab ? 'contained' : 'outlined'}
                                            startIcon={<FlipRoundedIcon />}
                                            onClick={() => setFlipCab((f) => !f)}
                                            data-testid="uff-flip-cab-btn"
                                        >
                                            {flipCab ? copy.cabRight : copy.cabLeft}
                                        </Button>
                                        <Tooltip title="Zoom Out">
                                            <IconButton
                                                type="button"
                                                size="small"
                                                aria-label="Zoom out radiograph"
                                                onClick={() => setZoom((z) => Math.max(1, +(z / 1.3).toFixed(2)))}
                                            >
                                                <ZoomOutRoundedIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Typography variant="caption" sx={{ minWidth: 38, textAlign: 'center' }}>
                                            {zoom.toFixed(1)}×
                                        </Typography>
                                        <Tooltip title="Zoom In">
                                            <IconButton
                                                type="button"
                                                size="small"
                                                aria-label="Zoom in radiograph"
                                                onClick={() => setZoom((z) => Math.min(10, +(z * 1.3).toFixed(2)))}
                                            >
                                                <ZoomInRoundedIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Button
                                            type="button"
                                            size="small"
                                            variant="text"
                                            startIcon={<CenterFocusStrongRoundedIcon />}
                                            onClick={() => {
                                                setZoom(1);
                                                setPan({ x: 0, y: 0 });
                                            }}
                                        >
                                            {copy.fitView}
                                        </Button>
                                    </Stack>
                                </Stack>
                            </Stack>
                        </Paper>

                        {/* Interactive 16-Bit Radiograph Viewport */}
                        <Paper
                            variant="outlined"
                            sx={{
                                position: 'relative',
                                overflow: 'hidden',
                                bgcolor: '#eef2f6',
                                minHeight: 300,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: zoom > 1 ? 'grab' : 'crosshair',
                                userSelect: 'none',
                            }}
                            onWheel={(e) => {
                                e.preventDefault();
                                const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
                                setZoom((z) => Math.min(10, Math.max(1, +(z * factor).toFixed(2))));
                            }}
                            onPointerDown={(e) => {
                                dragStateRef.current = {
                                    active: true,
                                    startX: e.clientX,
                                    startY: e.clientY,
                                    origX: pan.x,
                                    origY: pan.y,
                                };
                            }}
                            onPointerMove={handleCanvasPointerMove}
                            onPointerUp={() => {
                                dragStateRef.current.active = false;
                            }}
                            onPointerLeave={() => {
                                dragStateRef.current.active = false;
                                setProbeInfo(null);
                            }}
                            data-testid="uff-radiograph-viewport"
                        >
                            <Box
                                sx={{
                                    position: 'relative',
                                    width: '100%',
                                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                                    transformOrigin: 'center center',
                                }}
                            >
                                {!decodedXray && previewUrl && (
                                    <img
                                        src={previewUrl}
                                        alt={`Cargo radiograph preview ${metadata.uffUuid}`}
                                        style={{
                                            width: '100%',
                                            height: 'auto',
                                            display: 'block',
                                            transform: flipCab ? 'scaleX(-1)' : undefined,
                                        }}
                                        data-testid="uff-progressive-preview-img"
                                    />
                                )}
                                <canvas
                                    ref={glCanvasRef}
                                    data-testid="uff-16bit-xray-canvas"
                                    style={{
                                        width: '100%',
                                        height: 'auto',
                                        display: decodedXray ? 'block' : 'none',
                                        touchAction: 'none',
                                    }}
                                />

                                {/* Automated WCO <Analysis> Bounding Box Overlays */}
                                {showAnnotations &&
                                    metadata.annotations.map((ann, idx) => {
                                        const leftPct = flipCab ? (1 - ann.right) * 100 : ann.left * 100;
                                        const widthPct = Math.max(0.5, (ann.right - ann.left) * 100);
                                        const topPct = ann.top * 100;
                                        const heightPct = Math.max(0.5, (ann.bottom - ann.top) * 100);
                                        return (
                                            <Box
                                                key={ann.annotationId || idx}
                                                data-testid={`uff-annotation-box-${idx}`}
                                                sx={{
                                                    position: 'absolute',
                                                    left: `${leftPct}%`,
                                                    top: `${topPct}%`,
                                                    width: `${widthPct}%`,
                                                    height: `${heightPct}%`,
                                                    border: '2px solid #d32f2f',
                                                    bgcolor: 'rgba(211, 47, 47, 0.12)',
                                                    pointerEvents: 'none',
                                                }}
                                            >
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        position: 'absolute',
                                                        top: -22,
                                                        left: 0,
                                                        bgcolor: '#d32f2f',
                                                        color: '#fff',
                                                        px: 0.75,
                                                        borderRadius: 0.5,
                                                        whiteSpace: 'nowrap',
                                                        fontWeight: 700,
                                                        fontSize: '0.7rem',
                                                    }}
                                                >
                                                    {ann.description || 'Anomaly'}
                                                    {ann.confidence != null ? ` (${ann.confidence}%)` : ''}
                                                </Typography>
                                            </Box>
                                        );
                                    })}
                            </Box>

                            {probeInfo && (
                                <Paper
                                    elevation={2}
                                    sx={{
                                        position: 'absolute',
                                        bottom: 8,
                                        right: 8,
                                        px: 1.25,
                                        py: 0.5,
                                        bgcolor: 'rgba(15, 23, 42, 0.86)',
                                        color: '#fff',
                                        pointerEvents: 'none',
                                    }}
                                >
                                    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                        {copy.pixelProbeLabel}: x={probeInfo.metersX.toFixed(2)}m ({probeInfo.px},{' '}
                                        {probeInfo.py}) · I₁₆={probeInfo.rawU16.toLocaleString()} · {probeInfo.hemdClass}
                                    </Typography>
                                </Paper>
                            )}
                        </Paper>

                        {/* Longitudinal RPM Gamma / Neutron Strip Chart Spatial Alignment */}
                        {rpmPolyline && (
                            <Paper variant="outlined" sx={{ p: 1.25 }} data-testid="uff-rpm-alignment-strip">
                                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                                    <Typography variant="caption" fontWeight={700}>
                                        {copy.rpmAlignmentTitle}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {copy.rpmAlignmentHint} (Max γ: {Math.round(rpmPolyline.maxG)} cps · Max n:{' '}
                                        {Math.round(rpmPolyline.maxN)} cps)
                                    </Typography>
                                </Stack>
                                <svg
                                    viewBox="0 0 1000 60"
                                    preserveAspectRatio="none"
                                    style={{ width: '100%', height: 58, display: 'block' }}
                                    role="img"
                                    aria-label={copy.rpmAlignmentTitle}
                                >
                                    <line x1="0" y1="54" x2="1000" y2="54" stroke="#cbd5e1" strokeWidth="1" />
                                    <polyline
                                        fill="none"
                                        stroke="#d32f2f"
                                        strokeWidth="2.5"
                                        points={rpmPolyline.gamma}
                                    />
                                    <polyline
                                        fill="none"
                                        stroke="#1976d2"
                                        strokeWidth="2"
                                        strokeDasharray="6 3"
                                        points={rpmPolyline.neutron}
                                    />
                                </svg>
                            </Paper>
                        )}

                        {/* Progressive-Disclosure Trade Manifest, Declaration & Scanner Metadata (<details>) */}
                        <Paper variant="outlined" sx={{ p: 1.5 }}>
                            <Box component="details" open={Boolean(metadata.declaration || manifestBlobUrl)}>
                                <Box
                                    component="summary"
                                    sx={{
                                        cursor: 'pointer',
                                        fontWeight: 700,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 1,
                                    }}
                                >
                                    <Typography variant="subtitle2" component="span" fontWeight={700}>
                                        {copy.manifestSectionTitle}
                                    </Typography>
                                    {manifestBlobUrl && (
                                        <Button
                                            component="a"
                                            href={manifestBlobUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            size="small"
                                            variant="outlined"
                                            startIcon={<DescriptionRoundedIcon />}
                                            endIcon={<OpenInNewRoundedIcon fontSize="small" />}
                                            onClick={(e) => e.stopPropagation()}
                                            data-testid="uff-open-manifest-pdf"
                                        >
                                            {copy.openManifestPdf}
                                        </Button>
                                    )}
                                </Box>

                                <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} flexWrap="wrap" useFlexGap>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                UFF UUID
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                {metadata.uffUuid}
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                Scanner System
                                            </Typography>
                                            <Typography variant="body2">
                                                {[metadata.scannerManufacturer, metadata.scannerModel, metadata.scannerId]
                                                    .filter(Boolean)
                                                    .join(' · ') || 'N/A'}
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                Scan Timestamp
                                            </Typography>
                                            <Typography variant="body2">{metadata.scanTimestamp || 'N/A'}</Typography>
                                        </Box>
                                        {primaryXrayInfo && (
                                            <Box>
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                    Beam / Geometry
                                                </Typography>
                                                <Typography variant="body2">
                                                    {primaryXrayInfo.energiesMeV.length > 0
                                                        ? `${primaryXrayInfo.energiesMeV.join('/')} MeV `
                                                        : ''}
                                                    {primaryXrayInfo.modality} ·{' '}
                                                    {primaryXrayInfo.horizontalPixelSizeMm ?? 4} mm/px
                                                </Typography>
                                            </Box>
                                        )}
                                        {metadata.containerWeightKg != null && (
                                            <Box>
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                    Gross Cargo Weight
                                                </Typography>
                                                <Typography variant="body2">
                                                    {metadata.containerWeightKg.toLocaleString()} kg
                                                </Typography>
                                            </Box>
                                        )}
                                    </Stack>

                                    {metadata.declaration && (
                                        <Paper variant="outlined" sx={{ p: 1.25, bgcolor: 'action.hover' }}>
                                            <Stack
                                                direction={{ xs: 'column', md: 'row' }}
                                                spacing={2}
                                                justifyContent="space-between"
                                            >
                                                <Box>
                                                    <Typography variant="caption" color="text.secondary" display="block">
                                                        Declared Commodity (HS {metadata.declaration.hsCode || '—'})
                                                    </Typography>
                                                    <Typography variant="body2" fontWeight={700} data-testid="uff-declared-goods">
                                                        {metadata.declaration.goodsDescription || '—'}
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography variant="caption" color="text.secondary" display="block">
                                                        Consignor → Consignee
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        {metadata.declaration.consignorName || '—'} →{' '}
                                                        {metadata.declaration.consigneeName || '—'}
                                                    </Typography>
                                                </Box>
                                                {metadata.declaration.customsId && (
                                                    <Box>
                                                        <Typography variant="caption" color="text.secondary" display="block">
                                                            Customs Declaration ID
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                            {metadata.declaration.customsId}
                                                        </Typography>
                                                    </Box>
                                                )}
                                            </Stack>
                                        </Paper>
                                    )}

                                    {metadata.ocrResults.length > 0 && (
                                        <Box>
                                            <Typography variant="caption" fontWeight={700} display="block" sx={{ mb: 0.75 }}>
                                                {copy.ocrSectionTitle}
                                            </Typography>
                                            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                                                {metadata.ocrResults.map((ocr, i) => (
                                                    <Paper key={`${ocr.ocrType}-${i}`} variant="outlined" sx={{ p: 1 }}>
                                                        <Stack direction="row" spacing={1} alignItems="center">
                                                            {ocr.imageEntryPath && ocrCropUrls[ocr.imageEntryPath] && (
                                                                <img
                                                                    src={ocrCropUrls[ocr.imageEntryPath]}
                                                                    alt={`${ocr.ocrType} ${ocr.value}`}
                                                                    style={{
                                                                        height: 44,
                                                                        width: 'auto',
                                                                        borderRadius: 4,
                                                                    }}
                                                                />
                                                            )}
                                                            <Box>
                                                                <Typography variant="caption" color="text.secondary" display="block">
                                                                    {ocr.ocrType}{' '}
                                                                    {ocr.confidence != null
                                                                        ? `(${Math.round(ocr.confidence * 100)}%)`
                                                                        : ''}
                                                                </Typography>
                                                                <Typography variant="body2" fontWeight={700}>
                                                                    {ocr.value}
                                                                </Typography>
                                                            </Box>
                                                            {onApplyVehicleId && ocr.value && (
                                                                <Button
                                                                    type="button"
                                                                    size="small"
                                                                    variant="outlined"
                                                                    onClick={() => onApplyVehicleId(ocr.value)}
                                                                    data-testid={`uff-apply-ocr-${i}`}
                                                                >
                                                                    {copy.applyVehicleIdBtn}
                                                                </Button>
                                                            )}
                                                        </Stack>
                                                    </Paper>
                                                ))}
                                            </Stack>
                                        </Box>
                                    )}
                                </Stack>
                            </Box>
                        </Paper>
                    </Stack>
                )}
            </DialogContent>

            <DialogActions sx={{ px: 2, py: 1.25 }}>
                {onLinkToAdjudication && metadata && !localFile && (
                    <Button
                        type="button"
                        variant="contained"
                        color="secondary"
                        startIcon={<LinkRoundedIcon />}
                        disabled={linkingAdjudication}
                        onClick={() => onLinkToAdjudication(metadata.uffUuid)}
                        data-testid="uff-viewer-link-adjudication-btn"
                    >
                        {copy.linkToAdjudicationBtn}
                    </Button>
                )}
                <Button type="button" variant="outlined" onClick={onClose}>
                    {copy.closeBtn}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
