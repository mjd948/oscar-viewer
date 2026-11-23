/*
 * Copyright (c) 2024.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

"use client";

import {
    Alert,
    SnackbarCloseReason,
    Stack,
    Typography,
    Box,
    Button,
    Chip,
    Paper,
    Snackbar,
    TextField, FormControlLabel, Checkbox, DialogTitle,
    Dialog,
    DialogContent,
    DialogActions,
    Divider,
    Grid,
    Select,
    MenuItem,
    FormControl,
    InputLabel, SelectChangeEvent,
} from "@mui/material";
import React, {ChangeEvent, useContext, useEffect, useMemo, useRef, useState} from "react";
import dynamic from "next/dynamic";
import CompareArrowsRoundedIcon from "@mui/icons-material/CompareArrowsRounded";
import FolderSharedRoundedIcon from "@mui/icons-material/FolderSharedRounded";
import LayersRoundedIcon from "@mui/icons-material/LayersRounded";
import {
    fetchActiveCargoUffInfo,
    isCargoUffAttachmentPath,
    searchCargoUff,
    stageCargoUffForAdjudication,
    UffSearchMatch,
} from "@/lib/data/oscar/CargoUffApi";

const CargoUffViewerDialog = dynamic(
    () => import("@/app/_components/uff/CargoUffViewerDialog"),
    {ssr: false},
);
const CargoUffSmbPickerDialog = dynamic(
    () => import("@/app/_components/uff/CargoUffSmbPickerDialog"),
    {ssr: false},
);
import AdjudicationLog from "./AdjudicationLog"
import EmlAnalysisCard from "./EmlAnalysisCard";
import {EventTableData} from "@/lib/data/oscar/TableHelpers";
import {AdjudicationCode, AdjudicationCodes} from "@/lib/data/oscar/adjudication/models/AdjudicationConstants";
import {DataSourceContext} from "@/app/contexts/DataSourceContext";
import AdjudicationData from "@/lib/data/oscar/adjudication/Adjudication";
import {LaneMapEntry} from "@/lib/data/oscar/LaneCollection";
import ObservationFilter from "osh-js/source/core/consysapi/observation/ObservationFilter";
import ControlStream from "osh-js/source/core/consysapi/controlstream/ControlStream";
import {isAdjudicationControlStream} from "@/lib/data/oscar/Utilities";
import {generateAdjudicationCommandJSON, sendCommand} from "@/lib/data/oscar/OSCARCommands";
import SecondaryInspectionSelect from "./SecondaryInspectionSelect";
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import AdjudicationSelect from "./AdjudicationSelect";
import IsotopeSelect from "./IsotopeSelect";
import IconButton from "@mui/material/IconButton";
import DeleteOutline from "@mui/icons-material/DeleteOutline"
import {setAdjudicatedEventId, setSelectedEvent} from "@/lib/state/EventDataSlice";
import {useAppDispatch} from "@/lib/state/Hooks";
import {INode} from "@/lib/data/osh/Node";
import {QrCode} from "@mui/icons-material";
import QrScanner from "qr-scanner";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DetectorResponseFunction from "./DetectorResponseFunction";
import SpectrumTypeSelector from "@/app/_components/adjudication/SpectrumTypeSelector";
import WebIdAnalysis from "@/app/_components/adjudication/WebIdAnalysis";
import WebIdAnalysisResult from "@/lib/data/oscar/adjudication/WebId";
import {useSelector} from "react-redux";
import {RootState} from "@/lib/state/Store";
import {selectLaneMap} from "@/lib/state/OSCARLaneSlice";
import {randomUUID} from "osh-js/source/core/utils/Utils";
import { useBreakpoint } from "@/app/providers";
import N42Detail from "@/app/_components/n42/N42Detail";
import VehicleIdOcr from "@/app/_components/adjudication/VehicleIdOcr";
import VehiclePassComparisonDialog from "@/app/_components/vehicle/VehiclePassComparisonDialog";
import {
    IVehicleOcrResult,
    selectAutoFillCandidate,
} from "@/lib/data/oscar/adjudication/VehicleOcr";
import {
    FederatedVehicleSearchResult,
    normalizeVehicleId,
    searchVehiclePassesAcrossNodes,
    VEHICLE_SEARCH_WINDOW_MS,
} from "@/lib/data/oscar/VehicleSearch";
import {useLanguage} from '@/app/contexts/LanguageContext';
import {getIntlLocale} from '@/app/utils/LocaleUtils';
import {
    CanonicalIsotopeKey,
    isSpectroscopicFilePath,
    normalizeIsotopeListForSelect,
    selectHighestConfidenceIsotopesFromWebIdEntry,
    selectHighestConfidenceWebIdResult,
} from '@/lib/data/oscar/adjudication/IsotopeMapping';
import {markSessionCachedEventAdjudicated} from '@/lib/data/oscar/SavedEventQueries';

function inferSpectrumTypeFromFileName(fileName: string): "foreground" | "background" {
    const lower = (fileName || "").toLowerCase();
    if (lower.includes("background") || /(?:^|[\s_.-])(bkg|bg)(?:$|[\s_.-])/.test(lower)) {
        return "background";
    }
    return "foreground";
}

function isSpectroscopicFileName(fileName: string): boolean {
    return isSpectroscopicFilePath(fileName);
}

interface FileWithWebId {
    file: File;
    webIdEnabled: boolean;
    detectorResponseFunction: string;
    spectrumType: string;
    synthesizeBackground: boolean;
    serverPath?: string;
}

// qr code auto true = webIdEnabled

interface ScannedDataWithWebId {
    text: string;
    webIdEnabled: boolean;
    detectorResponseFunction: string;
    spectrumType: string;
    synthesizeBackground: boolean;
    serverPath?: string;
}

export default function AdjudicationDetail(props: {
    event: EventTableData;
    ocrInitialResults?: readonly IVehicleOcrResult[];
    ocrFetchImpl?: typeof fetch;
}) {
    const { isMobile, isSmallTablet } = useBreakpoint();
    const {language, t} = useLanguage();
    const dispatch = useAppDispatch();

    const [uploadedFiles, setUploadedFiles] = useState<FileWithWebId[]>([])
    const [adjudicationCode, setAdjudicationCode] = useState(AdjudicationCodes.codes[0]);
    const [isotope, setIsotope] = useState<string[]>([]);
    const [secondaryInspection, setSecondaryInspection] = useState('');
    const [secondaryInspectionManuallySet, setSecondaryInspectionManuallySet] = useState(false);
    const secondaryInspectionManuallySetRef = useRef(false);
    secondaryInspectionManuallySetRef.current = secondaryInspectionManuallySet;

    const [vehicleId, setVehicleId] = useState<string>("");
    const [vehicleIdTouched, setVehicleIdTouched] = useState<boolean>(false);
    const [vehicleIdAutoFilled, setVehicleIdAutoFilled] = useState<boolean>(false);
    const [ocrResults, setOcrResults] = useState<IVehicleOcrResult[]>([]);
    const [feedback, setFeedback] = useState<string>("");
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [openDialog, setOpenDialog] = useState(false);
    const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
    const videoElement = useRef<HTMLVideoElement>(null);
    const [scannedData, setScannedData] = useState<ScannedDataWithWebId[]>([]);
    const scanner = useRef<QrScanner | null>(null);

    const {laneMapRef, activeViewKey, currentSession} = useContext(DataSourceContext);
    const isReadOnlyViewer = Boolean(currentSession?.isReadOnly);
    const laneMap = useSelector((state: RootState) => selectLaneMap(state));
    const laneUid = laneMap.get(props.event?.laneId)?.laneSystem?.properties?.properties?.uid;
    const effectiveLaneMap = laneMapRef?.current && laneMapRef.current.size > 0
        ? laneMapRef.current
        : laneMap;

    const adjudication = props.event ? new AdjudicationData(new Date().toISOString(), props.event.occupancyCount, props.event.occupancyObsId) : null;
    const [adjData, setAdjData] = useState<AdjudicationData>(adjudication);

    const [debouncedVehicleId, setDebouncedVehicleId] = useState<string>("");
    const [relatedVehicleResult, setRelatedVehicleResult] = useState<FederatedVehicleSearchResult | null>(null);
    const [relatedSearchNonce, setRelatedSearchNonce] = useState<number>(0);
    const [openVehicleComparison, setOpenVehicleComparison] = useState<boolean>(false);

    // Optional Cargo NII (WCO UFF) integration state — zero UI footprint when disabled
    const eventParentNode: INode | null = effectiveLaneMap.get(props.event?.laneId)?.parentNode ?? null;
    const [uffEnabled, setUffEnabled] = useState<boolean>(false);
    const [correlatedUffMatches, setCorrelatedUffMatches] = useState<UffSearchMatch[]>([]);
    const [openUffPicker, setOpenUffPicker] = useState<boolean>(false);
    const [linkingUffUuid, setLinkingUffUuid] = useState<string | null>(null);
    const [viewerTarget, setViewerTarget] = useState<{
        open: boolean;
        uffUuid?: string | null;
        bucketKey?: string | null;
        localFile?: File | null;
    }>({open: false});

    // Key per-occupancy reset on laneId|occupancyCount|startTime rather than occupancyObsId
    // so live-event UUID resolution does not clear operator-entered Vehicle ID input.
    const eventIdentityKey = `${props.event?.laneId ?? ""}|${props.event?.occupancyCount ?? ""}|${props.event?.startTime ?? ""}`;
    const [syncedEventIdentityKey, setSyncedEventIdentityKey] = useState<string>(eventIdentityKey);
    if (syncedEventIdentityKey !== eventIdentityKey) {
        setSyncedEventIdentityKey(eventIdentityKey);
        setVehicleId("");
        setDebouncedVehicleId("");
        setVehicleIdTouched(false);
        setVehicleIdAutoFilled(false);
        setSecondaryInspection("");
        setSecondaryInspectionManuallySet(false);
        setOcrResults([]);
        setRelatedVehicleResult(null);
        setAdjData(
            props.event
                ? new AdjudicationData(
                    new Date().toISOString(),
                    props.event.occupancyCount,
                    props.event.occupancyObsId,
                )
                : null,
        );
    }

    useEffect(() => {
        const trimmed = vehicleId.trim();
        if (!trimmed) {
            setDebouncedVehicleId("");
            return;
        }
        const timer = window.setTimeout(() => {
            setDebouncedVehicleId(trimmed);
        }, vehicleIdTouched ? 350 : 0);
        return () => window.clearTimeout(timer);
    }, [vehicleId, vehicleIdTouched]);

    const [adjSnackMsg, setAdjSnackMsg] = useState('');
    const [colorStatus, setColorStatus] = useState('');
    const [openSnack, setOpenSnack] = useState(false);
    const [shouldFetchLogs, setShouldFetchLogs] = useState<boolean>(false);
    const [loggedAdjudications, setLoggedAdjudications] = useState<AdjudicationData[]>([]);

    useEffect(() => {
        if (vehicleIdTouched || vehicleId.trim().length > 0) return;

        let priorVehicleId = "";
        for (let idx = loggedAdjudications.length - 1; idx >= 0; idx -= 1) {
            const candidate = loggedAdjudications[idx]?.vehicleId?.trim() ?? "";
            if (candidate.length > 0) {
                priorVehicleId = candidate;
                break;
            }
        }
        if (!priorVehicleId && props.event?.vehicleId && !props.event.vehicleIdFromOcr) {
            priorVehicleId = props.event.vehicleId.trim();
        }
        if (priorVehicleId) {
            setVehicleId(priorVehicleId);
            setVehicleIdAutoFilled(false);
            setAdjData(previous => {
                if (!previous) return previous;
                const updated = Object.assign(
                    Object.create(Object.getPrototypeOf(previous)),
                    previous,
                ) as AdjudicationData;
                updated.setVehicleId(priorVehicleId);
                return updated;
            });
            return;
        }

        const candidate = selectAutoFillCandidate(ocrResults);
        if (!candidate) return;
        setVehicleId(candidate.value);
        setVehicleIdAutoFilled(true);
        setAdjData(previous => {
            if (!previous) return previous;
            const updated = Object.assign(
                Object.create(Object.getPrototypeOf(previous)),
                previous,
            ) as AdjudicationData;
            updated.setVehicleId(candidate.value);
            return updated;
        });
    }, [loggedAdjudications, ocrResults, props.event?.vehicleId, props.event?.vehicleIdFromOcr, vehicleId, vehicleIdTouched]);
    const [webIdResults, setWebIdResults] = useState<WebIdAnalysisResult[]>([]);
    const [selectedWebIdResultId, setSelectedWebIdResultId] = useState<string[]>([]);
    const [isSubmittingWebId, setIsSubmittingWebId] = useState(false);
    const [spectroscopicRefreshNonce, setSpectroscopicRefreshNonce] = useState(0);
    const spectroscopicTimersRef = useRef<number[]>([]);

    useEffect(() => {
        return () => {
            spectroscopicTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
            spectroscopicTimersRef.current = [];
        };
    }, []);

    const scheduleSpectroscopicRefresh = React.useCallback((includeAsyncWebIdFollowUp: boolean) => {
        setSpectroscopicRefreshNonce((prev) => prev + 1);
        if (!includeAsyncWebIdFollowUp || typeof window === "undefined") return;
        for (const delayMs of [1500, 3500, 7000]) {
            const timerId = window.setTimeout(() => {
                setSpectroscopicRefreshNonce((prev) => prev + 1);
            }, delayMs);
            spectroscopicTimersRef.current.push(timerId);
        }
    }, []);

    function onFetchComplete() {
        setShouldFetchLogs(false);
    }

    const effectiveCorrelationVehicleId = useMemo(() => {
        if (normalizeVehicleId(debouncedVehicleId).length >= 3) {
            return debouncedVehicleId;
        }
        for (let idx = loggedAdjudications.length - 1; idx >= 0; idx -= 1) {
            const candidate = loggedAdjudications[idx]?.vehicleId?.trim() ?? "";
            if (normalizeVehicleId(candidate).length >= 3) {
                return candidate;
            }
        }
        const ocrCandidate = selectAutoFillCandidate(ocrResults)?.value ?? ocrResults[0]?.value ?? "";
        if (normalizeVehicleId(ocrCandidate).length >= 3) {
            return ocrCandidate;
        }
        const eventVehicleId = props.event?.vehicleId?.trim() ?? "";
        if (normalizeVehicleId(eventVehicleId).length >= 3) {
            return eventVehicleId;
        }
        return "";
    }, [debouncedVehicleId, loggedAdjudications, ocrResults, props.event?.vehicleId]);

    const relatedVehicleStartTimeIso = useMemo(
        () => new Date(Date.now() - VEHICLE_SEARCH_WINDOW_MS["30d"]).toISOString(),
        [effectiveCorrelationVehicleId, relatedSearchNonce],
    );

    useEffect(() => {
        const normalized = normalizeVehicleId(effectiveCorrelationVehicleId);
        if (normalized.length < 3 || !effectiveLaneMap || effectiveLaneMap.size === 0) {
            setRelatedVehicleResult(null);
            return;
        }
        const controller = new AbortController();
        void searchVehiclePassesAcrossNodes({
            laneMap: effectiveLaneMap,
            vehicleId: effectiveCorrelationVehicleId,
            matchMode: "equals",
            activeViewKey,
            startTimeIso: relatedVehicleStartTimeIso,
            signal: controller.signal,
            fetchImpl: props.ocrFetchImpl,
        })
            .then(res => {
                if (!controller.signal.aborted) {
                    setRelatedVehicleResult(res);
                }
            })
            .catch((): void => {
                if (!controller.signal.aborted) {
                    setRelatedVehicleResult(null);
                }
            });
        return () => controller.abort();
    }, [
        activeViewKey,
        effectiveCorrelationVehicleId,
        effectiveLaneMap,
        props.ocrFetchImpl,
        relatedVehicleStartTimeIso,
    ]);

    const showRelatedPassesBanner = useMemo(() => {
        if (!relatedVehicleResult || relatedVehicleResult.passes.length === 0) return false;
        if (relatedVehicleResult.passes.length > 1) return true;
        const onlyPass = relatedVehicleResult.passes[0];
        return (
            Boolean(props.event?.occupancyObsId && onlyPass.occupancyObsId !== props.event.occupancyObsId)
            || Boolean(props.event?.laneId && onlyPass.laneName !== props.event.laneId)
        );
    }, [props.event?.laneId, props.event?.occupancyObsId, relatedVehicleResult]);

    // Event Details owns live-event identity resolution. Keep the editable
    // adjudication model in sync when that page supplies a newly identified
    // event, without a second background query or mutating props in place.
    useEffect(() => {
        const occupancyObsId = props.event.occupancyObsId;
        if (!occupancyObsId) return;

        setAdjData(previous => {
            if (!previous || previous.occupancyObsId === occupancyObsId) return previous;
            const updated = Object.assign(
                Object.create(Object.getPrototypeOf(previous)),
                previous,
            ) as AdjudicationData;
            updated.setOccupancyObsId(occupancyObsId);
            return updated;
        });
    }, [props.event.occupancyObsId]);

    useEffect(() => {
        let cancelled = false;
        void fetchActiveCargoUffInfo(eventParentNode, props.ocrFetchImpl)
            .then(info => {
                if (!cancelled) {
                    setUffEnabled(Boolean(info.enabled));
                }
            })
            .catch(() => {
                if (!cancelled) setUffEnabled(false);
            });
        return () => {
            cancelled = true;
        };
    }, [eventParentNode, props.ocrFetchImpl]);

    useEffect(() => {
        const normalized = normalizeVehicleId(effectiveCorrelationVehicleId);
        if (!uffEnabled || normalized.length < 3) {
            setCorrelatedUffMatches([]);
            return;
        }
        const ctrl = new AbortController();
        void searchCargoUff(
            {
                vehicleId: effectiveCorrelationVehicleId,
                nearTime: props.event?.startTime || undefined,
                windowMinutes: 0,
                fuzzy: true,
                limit: 5,
            },
            eventParentNode,
            ctrl.signal,
            props.ocrFetchImpl,
        )
            .then(res => {
                if (!ctrl.signal.aborted) {
                    setCorrelatedUffMatches(res.matches ?? []);
                }
            })
            .catch(() => {
                if (!ctrl.signal.aborted) {
                    setCorrelatedUffMatches([]);
                }
            });
        return () => ctrl.abort();
    }, [uffEnabled, effectiveCorrelationVehicleId, props.event?.startTime, eventParentNode, props.ocrFetchImpl, relatedSearchNonce]);

    const syncAutoSecondaryInspection = React.useCallback((
        nextFiles: readonly FileWithWebId[],
        nextScanned: readonly ScannedDataWithWebId[],
    ) => {
        if (secondaryInspectionManuallySetRef.current) return;
        const hasSpectroscopic = nextFiles.some(
            f => f.webIdEnabled || isSpectroscopicFileName(f.file.name) || isCargoUffAttachmentPath(f.file.name),
        )
            || nextScanned.length > 0
            || webIdResults.length > 0;
        const nextStatus = hasSpectroscopic ? "COMPLETED" : "";
        setSecondaryInspection(prev => (prev === nextStatus ? prev : nextStatus));
        setAdjData(previous => {
            if (!previous || previous.secondaryInspectionStatus === nextStatus) return previous;
            const updated = Object.assign(
                Object.create(Object.getPrototypeOf(previous)),
                previous,
            ) as AdjudicationData;
            updated.secondaryInspectionStatus = nextStatus;
            return updated;
        });
    }, [webIdResults.length]);

    const handleWebIdAnalysis = (fileIndex: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
        const enabled = event.target.checked;
        setUploadedFiles(prevFiles => {
            const hasExplicitBg = prevFiles.some((f, idx) =>
                idx !== fileIndex
                && (f.webIdEnabled || enabled)
                && (f.spectrumType || inferSpectrumTypeFromFileName(f.file.name)) === 'background',
            );
            const nextFiles = prevFiles.map((fileData, idx) => {
                if (idx !== fileIndex) {
                    if (enabled && inferSpectrumTypeFromFileName(prevFiles[fileIndex].file.name) === 'background' && fileData.spectrumType === 'foreground') {
                        return {...fileData, synthesizeBackground: false};
                    }
                    return fileData;
                }
                const nextType = fileData.spectrumType || inferSpectrumTypeFromFileName(fileData.file.name);
                const nextDrf = fileData.detectorResponseFunction || 'auto';
                const nextSynth = enabled && nextType === 'foreground' && !hasExplicitBg
                    ? (fileData.spectrumType === '' ? true : fileData.synthesizeBackground)
                    : false;
                return {
                    ...fileData,
                    webIdEnabled: enabled,
                    detectorResponseFunction: nextDrf,
                    spectrumType: nextType,
                    synthesizeBackground: nextSynth,
                };
            });
            syncAutoSecondaryInspection(nextFiles, scannedData);
            return nextFiles;
        });
    };

    const handleQRCodeWebIdAnalysis = (fileIndex: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
        setScannedData(prevFiles =>
            prevFiles.map((fileData, idx) =>
                idx === fileIndex ? {...fileData, webIdEnabled: event.target.checked} : fileData
            )
        );
    };

    const handleCloseQrCodeDialog = () => {
        scanner?.current?.stop();
        scanner.current = undefined;
        setOpenDialog(false);
    }

    const handleQrCode = () => {
        setOpenDialog(true);
    };

    useEffect(() => {
        if (openDialog && !scanner.current) {
            const timeoutId = setTimeout(() => {
                if (!videoElement.current) {
                    console.error("Video element not found");
                    setAdjSnackMsg(t('cameraInitializationFailed'));
                    setOpenSnack(true);
                    return;
                }

                const qrOptions = {
                    onDecodeError: (err: any) => console.error("QR Scan Error:", err),
                    preferredCamera: "environment", //this will detect automatically to use the back camera on the phone
                    highlightScanRegion: true,
                }

                scanner.current = new QrScanner(videoElement.current, (result) => {
                    let newData: ScannedDataWithWebId = {
                        text: result.data,
                        detectorResponseFunction: "",
                        spectrumType: "",
                        webIdEnabled: true,
                        synthesizeBackground: false
                    }

                    setScannedData(prev => {
                        if (prev.some(item => item.text === result.data))
                            return prev;
                        const next = [...prev, newData];
                        syncAutoSecondaryInspection(uploadedFiles, next);
                        return next;
                    });
                }, qrOptions);

                scanner.current.start().catch((err) => {
                    console.error("Error starting scanner:", err);
                    setAdjSnackMsg(t('cameraStartFailed'));
                    setColorStatus('error');
                    setOpenSnack(true);
                });
            }, 100);

            return () => clearTimeout(timeoutId);
        }
    }, [openDialog]);


    const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files === null) {
            return;
        }

        const files = Array.from(e.target.files);
        const batchHasBg = files.some(f => inferSpectrumTypeFromFileName(f.name) === 'background')
            || uploadedFiles.some(f => f.spectrumType === 'background');

        const filesWithWebId = files.map(file => {
            const inferredType = inferSpectrumTypeFromFileName(file.name);
            const autoWebId = isSpectroscopicFileName(file.name);
            return {
                file,
                webIdEnabled: autoWebId,
                detectorResponseFunction: "auto",
                spectrumType: inferredType,
                synthesizeBackground: inferredType === 'foreground' && !batchHasBg,
            };
        });

        const nextFiles = [...uploadedFiles, ...filesWithWebId];
        setUploadedFiles(nextFiles);
        syncAutoSecondaryInspection(nextFiles, scannedData);
        e.target.value = '';

        // If any selected file is a WCO .uff archive, asynchronously extract any embedded .n42
        // radiation file into WebID and populate Vehicle ID if currently empty.
        const uffCandidates = files.filter(f => f.name.toLowerCase().endsWith('.uff'));
        if (uffCandidates.length > 0) {
            void (async () => {
                try {
                    const {parseLocalUffFile} = await import('@/lib/data/oscar/UffClientArchive');
                    for (const uffFile of uffCandidates) {
                        const parsed = await parseLocalUffFile(uffFile);
                        const detectedId = parsed.metadata.allDisplayVehicleIds[0];
                        if (detectedId) {
                            setVehicleId(prev => {
                                if (prev.trim().length > 0) return prev;
                                setAdjData(prevAdj => {
                                    if (!prevAdj) return prevAdj;
                                    const updated = Object.assign(
                                        Object.create(Object.getPrototypeOf(prevAdj)),
                                        prevAdj,
                                    ) as AdjudicationData;
                                    updated.setVehicleId(detectedId);
                                    return updated;
                                });
                                return detectedId;
                            });
                        }
                        if (parsed.embeddedN42File) {
                            const n42File = parsed.embeddedN42File;
                            setUploadedFiles(prev => {
                                if (prev.some(item => item.file.name === n42File.name)) return prev;
                                const appended: FileWithWebId[] = [
                                    ...prev,
                                    {
                                        file: n42File,
                                        webIdEnabled: true,
                                        detectorResponseFunction: 'auto',
                                        spectrumType: 'foreground',
                                        synthesizeBackground: !prev.some(item => item.spectrumType === 'background'),
                                    },
                                ];
                                syncAutoSecondaryInspection(appended, scannedData);
                                return appended;
                            });
                        }
                    }
                } catch (err) {
                    console.warn('Unable to inspect local .uff package metadata:', err);
                }
            })();
        }
    };

    const handleLinkSmbUffToAdjudication = async (uffUuid: string) => {
        try {
            setLinkingUffUuid(uffUuid);
            const staged = await stageCargoUffForAdjudication(uffUuid, eventParentNode);
            const refFile = new File(['{}'], staged.referenceKey, {type: 'application/json'});
            const additions: FileWithWebId[] = [
                {
                    file: refFile,
                    webIdEnabled: false,
                    detectorResponseFunction: 'auto',
                    spectrumType: 'foreground',
                    synthesizeBackground: false,
                    serverPath: staged.referenceUri,
                },
            ];
            if (staged.manifestUri) {
                const pdfName = staged.manifestUri.split('/').pop() || `uff-manifest-${uffUuid}.pdf`;
                additions.push({
                    file: new File([''], pdfName, {type: 'application/pdf'}),
                    webIdEnabled: false,
                    detectorResponseFunction: 'auto',
                    spectrumType: 'foreground',
                    synthesizeBackground: false,
                    serverPath: staged.manifestUri,
                });
            }
            if (staged.n42ContentBase64 && staged.n42FileName) {
                const bin = Uint8Array.from(atob(staged.n42ContentBase64), ch => ch.charCodeAt(0));
                const n42File = new File([bin], staged.n42FileName, {type: 'application/xml'});
                additions.push({
                    file: n42File,
                    webIdEnabled: true,
                    detectorResponseFunction: 'auto',
                    spectrumType: 'foreground',
                    synthesizeBackground: !uploadedFiles.some(item => item.spectrumType === 'background'),
                });
            }
            setUploadedFiles(prev => {
                const existingNames = new Set(prev.map(p => p.file.name));
                const next = [...prev, ...additions.filter(a => !existingNames.has(a.file.name))];
                syncAutoSecondaryInspection(next, scannedData);
                return next;
            });

            const detectedId = staged.caseMetadata?.allDisplayVehicleIds?.[0];
            if (detectedId && !vehicleId.trim()) {
                handleOcrSelect(detectedId);
            }
            setOpenUffPicker(false);
            setAdjSnackMsg(t('cargoUffLinkedToast', {id: uffUuid.slice(0, 8)}));
            setColorStatus('success');
            setOpenSnack(true);
        } catch (err: any) {
            setAdjSnackMsg(err?.message || t('cargoUffLinkFailedToast'));
            setColorStatus('error');
            setOpenSnack(true);
        } finally {
            setLinkingUffUuid(null);
        }
    };

    const handleFileDelete = (fileIndex: number) => {
        setUploadedFiles((prevState) => {
            const nextFiles = prevState.filter((_, i) => i !== fileIndex);
            syncAutoSecondaryInspection(nextFiles, scannedData);
            return nextFiles;
        });
    }

    const handleAdjudicationSelect = (value: AdjudicationCode) => {
        let tAdjData: AdjudicationData = adjData;
        tAdjData.adjudicationCode = value;

        setAdjData(tAdjData);
        setAdjudicationCode(value);
    }

    const handleIsotopeSelect = (value: string[]) => {
        let tAdjData = adjData;
        tAdjData.isotopes = value;
        setIsotope(value);
        setAdjData(tAdjData);
    }

    const handleInspectionSelect = (value: string) => {
        setSecondaryInspectionManuallySet(true);
        secondaryInspectionManuallySetRef.current = true;
        let tAdjData = adjData;
        tAdjData.secondaryInspectionStatus = value;
        setSecondaryInspection(value);
        setAdjData(tAdjData);
    }

    const handleDrfSelection = (fileIndex: number) => (value: string) => {
        setUploadedFiles(prevFiles =>
            prevFiles.map((fileData, idx) =>
                idx === fileIndex ? {...fileData, detectorResponseFunction: value} : fileData
            )
        );
    }

    const handleSpectrumType = (fileIndex: number) => (value: string) => {
        setUploadedFiles(prevFiles =>
            prevFiles.map((fileData, idx) =>
                idx === fileIndex ? {...fileData, spectrumType: value} : fileData
            )
        );
    }

    const handleSynthesizeBackground = (fileIndex: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
        setUploadedFiles(prevFiles =>
            prevFiles.map((fileData, idx) =>
                idx === fileIndex ? {...fileData, synthesizeBackground: event.target.checked} : fileData
            )
        );
    };

    const handleScannedDataDrfSelection = (index: number) => (value: string) => {
        setScannedData(prev =>
            prev.map((data, idx) =>
                idx === index ? {...data, detectorResponseFunction: value} : data
            )
        );
    }

    const handleScannedDataSpectrumType = (index: number) => (value: string) => {
        setScannedData(prev =>
            prev.map((data, idx) =>
                idx === index ? {...data, spectrumType: value} : data
            )
        );
    }

    const handleScannedDataSynthesizeBackground = (fileIndex: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
        setScannedData(prevFiles =>
            prevFiles.map((fileData, idx) =>
                idx === fileIndex ? {...fileData, synthesizeBackground: event.target.checked} : fileData
            )
        );
    };

    const handleScannedDataDelete = (index: number) => {
        setScannedData(prev => {
            const nextScanned = prev.filter((_, i) => i !== index);
            syncAutoSecondaryInspection(uploadedFiles, nextScanned);
            return nextScanned;
        });
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const {name, value} = e.target;

        if (name === 'vehicleId') {
            setVehicleId(value);
            setVehicleIdTouched(true);
            setVehicleIdAutoFilled(false);
            setAdjData(previous => {
                if (!previous) return previous;
                const updated = Object.assign(
                    Object.create(Object.getPrototypeOf(previous)),
                    previous,
                ) as AdjudicationData;
                updated.setVehicleId(value);
                return updated;
            });
            return;
        }

        let tempAdjData = adjData;
        if (name === 'notes') {
            setFeedback(value);
            if (tempAdjData) {
                tempAdjData.feedback = value;
            }
        }

        setAdjData(tempAdjData);
    }

    const handleOcrSelect = (selected: string) => {
        setVehicleId(selected);
        setVehicleIdTouched(true);
        setVehicleIdAutoFilled(false);
        setAdjData(previous => {
            if (!previous) return previous;
            const updated = Object.assign(
                Object.create(Object.getPrototypeOf(previous)),
                previous,
            ) as AdjudicationData;
            updated.setVehicleId(selected);
            return updated;
        });
    };

    function resetForm() {
        setVehicleId('');
        setVehicleIdTouched(true);
        setVehicleIdAutoFilled(false);
        setAdjData(adjudication);
        setUploadedFiles([]);
        setScannedData([]);
        setSecondaryInspection('');
        setSecondaryInspectionManuallySet(false);
        secondaryInspectionManuallySetRef.current = false;
        setIsotope([]);
        setAdjudicationCode(AdjudicationCodes.codes[0]);
        setFeedback('')
        setWebIdResults([]);
        setSelectedWebIdResultId([]);
    }

    const sendAdjudicationData = async () => {
        if (adjData.adjudicationCode === null || !adjData.adjudicationCode || adjData.adjudicationCode === AdjudicationCodes.codes[0]) {
            setAdjSnackMsg(t('selectValidAdjudicationCode'));
            setColorStatus('error');
            setOpenSnack(true)
            return;
        }

        setOpenConfirmDialog(true);
    }

    const confirmAndSubmitAdjudication = async () => {
        setOpenConfirmDialog(false);

        const phenomenonTime = new Date().toISOString();

        let tempAdjData: AdjudicationData = adjData;

        tempAdjData.setTime(phenomenonTime);
        tempAdjData.setFilePaths(uploadedFiles.map(f => f.file.name));
        tempAdjData.setAdjudicationCode(adjData.adjudicationCode);
        tempAdjData.setVehicleId(adjData.vehicleId);
        tempAdjData.setFeedback(adjData.feedback);
        tempAdjData.setIsotopes(adjData.isotopes);
        tempAdjData.setOccupancyObsId(adjData.occupancyObsId);

        // send to server
        const currentLane = props.event.laneId;
        const currLaneEntry: LaneMapEntry = laneMapRef.current.get(currentLane);

        await submitAdjudication(currLaneEntry, tempAdjData, uploadedFiles)
    }

    const submitAdjudication = async (currLaneEntry: any, tempAdjData: any, files: FileWithWebId[]) => {
        try {
            if (!currLaneEntry) {
                setAdjSnackMsg(t('eventLaneUnavailable', {lane: props.event.laneId}));
                setColorStatus('error');
                setOpenSnack(true);
                return;
            }

            let ds = currLaneEntry.datastreams.find((ds: any) => ds.properties.id == props.event.dataStreamId);

            let streams = currLaneEntry.controlStreams;
            if (streams.length === 0) {
                const laneSystemIds = new Set(currLaneEntry.systems.map(
                    (system: any) => system.properties.id));
                const nodeControlStreams = await currLaneEntry.parentNode.fetchNodeControlStreams() ?? [];
                streams = nodeControlStreams.filter((stream: typeof ControlStream) =>
                    laneSystemIds.has(stream.properties["system@id"]));
            }
            let adjControlStream = streams.find((stream: typeof ControlStream) => isAdjudicationControlStream(stream));

            if (!adjControlStream) {
                setAdjSnackMsg(t('adjudicationControlStreamMissing'));
                setColorStatus('error')
                setOpenSnack(true);
                return;
            }

            if (!tempAdjData.occupancyObsId) {
                let query = await ds.searchObservations(new ObservationFilter({
                    filter: `startTime='${props.event.startTime}' AND endTime='${props.event.endTime}'`
                }), 1);

                const occupancyObservation = await query.nextPage();

                if (!occupancyObservation || occupancyObservation.length === 0) {
                    setAdjSnackMsg(t('observationNotFound'));
                    setColorStatus('error')
                    setOpenSnack(true);
                    return;
                }

                tempAdjData.setOccupancyObsId(occupancyObservation[0].id);
            }

            const alreadyUploaded = files.filter(f => f.serverPath);
            const needsUpload = files.filter(f => !f.serverPath);

            let qrCodeFiles = createFilesForQRCode(scannedData.filter(d => !d.serverPath));
            qrCodeFiles.forEach(file => needsUpload.push(file));

            const newFileNames = needsUpload.length > 0
                ? await sendFileUploadRequest(needsUpload, currLaneEntry.parentNode, tempAdjData.occupancyObsId)
                : [];

            if (needsUpload.length > 0 && (!newFileNames || newFileNames.length === 0)) {
                return;
            }

            if (needsUpload.length > 0) {
                scheduleSpectroscopicRefresh(needsUpload.some(item => item.webIdEnabled));
            }

            const alreadyUploadedPaths = [
                ...alreadyUploaded.map(f => f.serverPath!),
                ...scannedData.filter(d => d.serverPath).map(d => d.serverPath!),
            ];
            let allFiles = [...alreadyUploadedPaths, ...(newFileNames || [])]

            const response = await sendCommand(
                currLaneEntry.parentNode,
                adjControlStream.properties.id,
                generateAdjudicationCommandJSON(
                    tempAdjData.feedback,
                    tempAdjData.adjudicationCode,
                    tempAdjData.isotopes,
                    tempAdjData.secondaryInspectionStatus,
                    // files.map(file => 'adjudication/' + file.file.name),
                    allFiles,
                    tempAdjData.occupancyObsId,
                    tempAdjData.vehicleId
                )
            );

            if (!response.ok) {
                setAdjSnackMsg(t('adjudicationSubmitFailed'))
                setColorStatus('error')
                setOpenSnack(true);
                return;
            }

            let updatedEvent = props.event;
            if (Object.isFrozen(props.event) || !Object.isExtensible(props.event)) {
                updatedEvent = Object.assign(
                    Object.create(Object.getPrototypeOf(props.event)),
                    props.event,
                    {adjudicatedData: tempAdjData},
                );
            } else {
                props.event.adjudicatedData = tempAdjData;
            }
            markSessionCachedEventAdjudicated(
                tempAdjData.occupancyObsId,
                tempAdjData.adjudicationCode?.code,
            );

            setAdjSnackMsg(t('adjudicationSuccessful', {occupancyId: props.event.occupancyCount}));
            setColorStatus('success')

            dispatch(setSelectedEvent(updatedEvent));
            dispatch(setAdjudicatedEventId(updatedEvent.id));

            setShouldFetchLogs(true);
            setRelatedSearchNonce(previous => previous + 1);
            setOpenSnack(true);
            resetForm();
        } catch (error) {
            setAdjSnackMsg(t('adjudicationSubmitFailed'))
            setColorStatus('error')
            setOpenSnack(true);
        }
    }

    function createFilesForQRCode(qrCodeData: ScannedDataWithWebId[]) {
        let newFiles: FileWithWebId[] = [];

        const options = {
            type: "text/plain;charset=utf-8",
        };

        qrCodeData.forEach((code) => {
            let fileName = 'foreground-' + randomUUID() + ".txt"
            let fileBits = code.text;
            const file = new File([fileBits], fileName, options);

            let fileWithId: FileWithWebId = {
                file,
                webIdEnabled: true,
                detectorResponseFunction: code.detectorResponseFunction,
                spectrumType: code.spectrumType ? code.spectrumType : 'foreground',
                synthesizeBackground: code.synthesizeBackground
            }
            newFiles.push(fileWithId);
        })

        return newFiles;
    }

    async function ensureOccupancyObsId(currLaneEntry: LaneMapEntry): Promise<string> {
        const existing = adjData?.occupancyObsId || props.event.occupancyObsId;
        if (existing) return existing;
        const ds = currLaneEntry.datastreams.find((candidate: any) => candidate.properties.id == props.event.dataStreamId);
        if (!ds) return '';
        try {
            const query = await ds.searchObservations(new ObservationFilter({
                filter: `startTime='${props.event.startTime}' AND endTime='${props.event.endTime}'`,
            }), 1);
            const occupancyObservation = await query.nextPage();
            const resolved = occupancyObservation?.[0]?.id ?? '';
            if (resolved) {
                setAdjData(previous => {
                    if (!previous || previous.occupancyObsId === resolved) return previous;
                    const updated = Object.assign(
                        Object.create(Object.getPrototypeOf(previous)),
                        previous,
                    ) as AdjudicationData;
                    updated.setOccupancyObsId(resolved);
                    return updated;
                });
            }
            return resolved;
        } catch {
            return '';
        }
    }

    async function sendFileUploadRequest(filePaths: FileWithWebId[], node: INode, occupancyObsIdOverride?: string) {
        const resolvedPathsByItem = new Map<FileWithWebId, string>();
        let newFileNames: string[] = [];

        const protocol = node.isSecure ? 'https://' : 'http://';
        const effectiveOccupancyObsId = occupancyObsIdOverride || adjData?.occupancyObsId || props.event.occupancyObsId || '';

        const webIdFiles = filePaths.filter(f => f.webIdEnabled);
        const foregroundFile = webIdFiles.find(f => f.spectrumType === 'foreground');
        const backgroundFile = webIdFiles.find(f => f.spectrumType === 'background');
        const hasPair = Boolean(foregroundFile && backgroundFile);

        const pairedFiles = hasPair && foregroundFile && backgroundFile
            ? new Set<FileWithWebId>([foregroundFile, backgroundFile])
            : new Set<FileWithWebId>();

        if (hasPair && foregroundFile && backgroundFile) {
            const drf = foregroundFile.detectorResponseFunction || backgroundFile.detectorResponseFunction || 'auto';
            const endpoint = `${protocol}${node.address}:${node.port}${node.oshPathRoot}${node.bucketsEndpoint}/adjudication?occupancyObsId=${encodeURIComponent(effectiveOccupancyObsId)}&laneUid=${encodeURIComponent(laneUid ?? '')}&webIdEnabled=${foregroundFile.webIdEnabled}&drf=${encodeURIComponent(drf)}`;
            const url = new URL(endpoint);

            const formData = new FormData();
            formData.append('foreground', foregroundFile.file);
            formData.append('background', backgroundFile.file);

            const options: RequestInit = {
                method: 'POST',
                headers: node.getBasicAuthHeader(),
                mode: 'cors',
                credentials: 'include',
                body: formData
            };

            const response = await fetch(url, options);
            if (!response.ok) {
                console.error("Failed uploading paired WebID files:", response);
                setAdjSnackMsg(t('pairedWebIdUploadFailed'));
                setColorStatus('error');
                setOpenSnack(true);
                return;
            }

            const filesNames: string[] = await response.json();
            if (filesNames[0]) resolvedPathsByItem.set(foregroundFile, filesNames[0]);
            if (filesNames[1]) resolvedPathsByItem.set(backgroundFile, filesNames[1]);
        }

        for (const fileData of filePaths) {
            if (pairedFiles.has(fileData)) continue;

            const drf = fileData.detectorResponseFunction || 'auto';
            let queryPath = `adjudication?occupancyObsId=${encodeURIComponent(effectiveOccupancyObsId)}&laneUid=${encodeURIComponent(laneUid ?? '')}&webIdEnabled=${fileData.webIdEnabled}`;
            if (fileData.webIdEnabled) {
                queryPath += `&drf=${encodeURIComponent(drf)}&synthesizeBackground=${Boolean(fileData.synthesizeBackground)}`;
            }

            const endpoint = `${protocol}${node.address}:${node.port}${node.oshPathRoot}${node.bucketsEndpoint}/${queryPath}`;
            const url = new URL(endpoint);

            const formData = new FormData();
            formData.append('foreground', fileData.file);

            const options: RequestInit = {
                method: 'POST',
                headers: node.getBasicAuthHeader(),
                mode: 'cors',
                credentials: 'include',
                body: formData
            };

            const response = await fetch(url, options);
            if (!response.ok) {
                console.error("Failed uploading file:", fileData.file.name, response);
                setAdjSnackMsg(t('fileUploadFailed', {file: fileData.file.name}));
                setColorStatus('error');
                setOpenSnack(true);
                return;
            }

            setAdjSnackMsg(t('fileUploadSuccessful', {file: fileData.file.name}));
            setColorStatus('success');
            setOpenSnack(true);

            const filesNames: string[] = await response.json();
            if (filesNames[0]) {
                resolvedPathsByItem.set(fileData, filesNames[0]);
            }
        }

        newFileNames = filePaths
            .map((item) => resolvedPathsByItem.get(item))
            .filter((p): p is string => Boolean(p));

        return newFileNames;
    }

    const handleWebIdResults = React.useCallback((results: WebIdAnalysisResult[]) => {
        setWebIdResults(results);
        setSelectedWebIdResultId(prev => {
            const validPrev = prev.filter(id => results.some(r => r.id === id));
            if (validPrev.length > 0) return validPrev;
            const {bestResult} = selectHighestConfidenceWebIdResult(results);
            return bestResult?.id ? [bestResult.id] : [];
        });
    }, []);

    const applySelectedWebIdResult = () => {
        if (selectedWebIdResultId.length === 0) return;
        const selectedResults = webIdResults.filter(r => selectedWebIdResultId.includes(r.id));
        const collected: string[] = [];
        for (const result of selectedResults) {
            const topEntry = selectHighestConfidenceIsotopesFromWebIdEntry(result);
            if (topEntry.canonicalIsotopes.length > 0) {
                collected.push(...topEntry.canonicalIsotopes);
            } else if (Array.isArray(result.isotopes)) {
                result.isotopes.forEach(iso => collected.push(iso.name));
            }
        }
        const normalized = normalizeIsotopeListForSelect(collected);
        if (normalized.length > 0) {
            handleIsotopeSelect(normalized);
        }
    };

    const handleApplyDeviceIsotopes = React.useCallback((deviceIsotopes: CanonicalIsotopeKey[]) => {
        if (deviceIsotopes.length > 0) {
            handleIsotopeSelect([...deviceIsotopes]);
        }
    }, [adjData]);

    const submitToWebId = async () => {
        setIsSubmittingWebId(true);
        try {
            const currentLane = props.event.laneId;
            const currLaneEntry: LaneMapEntry = laneMapRef.current.get(currentLane);
            if (!currLaneEntry) {
                setAdjSnackMsg(t('eventLaneUnavailable', {lane: currentLane}));
                setColorStatus('error');
                setOpenSnack(true);
                return;
            }
            const node = currLaneEntry.parentNode;

            const resolvedOccupancyObsId = await ensureOccupancyObsId(currLaneEntry);

            const webIdFileIndices: number[] = [];
            const webIdFilesToUpload: FileWithWebId[] = [];
            uploadedFiles.forEach((f, idx) => {
                if (!f.serverPath && (f.webIdEnabled || isSpectroscopicFileName(f.file.name))) {
                    webIdFileIndices.push(idx);
                    webIdFilesToUpload.push(f);
                }
            });

            const qrIndices: number[] = [];
            const qrToConvert: ScannedDataWithWebId[] = [];
            scannedData.forEach((d, idx) => {
                if (d.webIdEnabled && !d.serverPath) {
                    qrIndices.push(idx);
                    qrToConvert.push(d);
                }
            });

            const qrAsFiles = createFilesForQRCode(qrToConvert);
            const allToUpload = [...webIdFilesToUpload, ...qrAsFiles];

            if (allToUpload.length === 0) {
                setAdjSnackMsg(t('noNewWebIdFiles'));
                setColorStatus('info');
                setOpenSnack(true);
                return;
            }

            const serverPaths = await sendFileUploadRequest(allToUpload, node, resolvedOccupancyObsId);

            if (!serverPaths || serverPaths.length === 0) return;

            let pathIdx = 0;

            setUploadedFiles(prev => prev.map((f, i) => {
                if (webIdFileIndices.includes(i) && pathIdx < serverPaths.length) {
                    return { ...f, serverPath: serverPaths[pathIdx++] };
                }
                return f;
            }));

            setScannedData(prev => prev.map((d, i) => {
                if (qrIndices.includes(i) && pathIdx < serverPaths.length) {
                    return { ...d, serverPath: serverPaths[pathIdx++] };
                }
                return d;
            }));

            scheduleSpectroscopicRefresh(allToUpload.some(item => item.webIdEnabled));

            setAdjSnackMsg(t('webIdSubmitSuccessful'));
            setColorStatus('success');
            setOpenSnack(true);
        } catch (error) {
            setAdjSnackMsg(t('webIdSubmitFailed'));
            setColorStatus('error');
            setOpenSnack(true);
        } finally {
            setIsSubmittingWebId(false);
        }
    };

    const handleCloseSnack = (event: React.SyntheticEvent | Event, reason?: SnackbarCloseReason,) => {
        if (reason === 'clickaway')
            return;
        setOpenSnack(false);
    };

    const handleEvidenceSelection = (event: SelectChangeEvent<string[]>) => {
        setSelectedWebIdResultId(event.target.value as string[]);
    };

    return (
        <Stack spacing={2}>
            <Paper variant='outlined' sx={{ p: 2 }}>
                <Grid container spacing={2} sx={{ width: '100%' }}>
                    {/*N42 Detail*/}
                    <Grid item xs={12}>
                        <N42Detail
                            event={props.event}
                            occupancyObsIdOverride={adjData?.occupancyObsId || props.event.occupancyObsId}
                            refreshNonce={spectroscopicRefreshNonce}
                            onApplyDeviceIsotopes={handleApplyDeviceIsotopes}
                        />
                    </Grid>
                    {/*WebID Results*/}
                    <Grid item xs={12}>
                        <WebIdAnalysis
                            event={props.event}
                            occupancyObsIdOverride={adjData?.occupancyObsId || props.event.occupancyObsId}
                            refreshNonce={spectroscopicRefreshNonce}
                            onWebIdResults={handleWebIdResults}
                        />
                    </Grid>
                    {/*EML Analysis*/}
                    <Grid item xs={12}>
                        <EmlAnalysisCard
                            event={props.event}
                            adjudications={loggedAdjudications}
                        />
                    </Grid>
                    {/*Adj Log*/}
                    <Grid item xs={12}>
                        <AdjudicationLog
                            event={props.event}
                            node={laneMapRef.current.get(props.event.laneId)?.parentNode}
                            shouldFetch={shouldFetchLogs}
                            onFetchComplete={onFetchComplete}
                            onAdjudicationsChange={setLoggedAdjudications}
                        />
                    </Grid>
                </Grid>
            </Paper>

            {/*Evidence Collection*/}
            <Paper
                variant='outlined'
                sx={{
                    p: 2,
                    displayPrint: (uploadedFiles.length > 0 || scannedData.length > 0) ? 'block' : 'none',
                }}
            >
                <Grid container spacing={2} sx={{ width: '100%' }}>

                    <Grid item xs={12}>
                        <Typography variant="h5">
                            {t('evidenceCollection')}
                        </Typography>
                    </Grid>

                    {uploadedFiles.length > 0 && (
                        <Grid item xs={12}>
                            <Paper variant="outlined" sx={{ p: 1 }}>
                                <Stack
                                    sx={{
                                        maxHeight: '150px',
                                        overflowY: 'auto',
                                    }}
                                    spacing={1}
                                >
                                    {uploadedFiles.map((fileData, index) => (
                                        <Stack key={`${fileData.file.name}-${index}`} direction="row" spacing={1} alignItems="center" flexWrap="wrap" p={1}>
                                            <Box display="flex" alignItems="center" sx={{ minWidth: 0, flex: '1 1 auto' }}>
                                                <InsertDriveFileRoundedIcon fontSize="small" />
                                                <Typography variant="body2" noWrap sx={{ ml: 0.5 }}>
                                                    {fileData.file.name}
                                                    {fileData.serverPath && (
                                                        <Typography component="span" variant="caption" color="success.main" sx={{ ml: 1 }}>
                                                            {t('uploaded')}
                                                        </Typography>
                                                    )}
                                                </Typography>
                                            </Box>

                                            <Stack direction="row" spacing={1} alignItems="center">
                                                {isCargoUffAttachmentPath(fileData.file.name) ? (
                                                    <Button
                                                        type="button"
                                                        size="small"
                                                        variant="outlined"
                                                        color="secondary"
                                                        startIcon={<LayersRoundedIcon fontSize="small" />}
                                                        onClick={() =>
                                                            setViewerTarget(
                                                                fileData.serverPath
                                                                    ? {open: true, bucketKey: fileData.serverPath}
                                                                    : {open: true, localFile: fileData.file},
                                                            )
                                                        }
                                                        data-testid={`inspect-uploaded-uff-${index}`}
                                                    >
                                                        {t('inspectCargoRadiograph')}
                                                    </Button>
                                                ) : (
                                                    <FormControlLabel
                                                        control={
                                                            <Checkbox
                                                                size="small"
                                                                checked={fileData.webIdEnabled}
                                                                onChange={handleWebIdAnalysis(index)}
                                                                disabled={!!fileData.serverPath}
                                                            />
                                                        }
                                                        label={<Typography variant="body2">WebID</Typography>}
                                                        sx={{mr: 0}}
                                                    />
                                                )}

                                                {fileData.webIdEnabled && (

                                                    <>
                                                        <DetectorResponseFunction
                                                            onSelect={handleDrfSelection(index)}
                                                            selectVal={fileData.detectorResponseFunction}
                                                        />
                                                        <SpectrumTypeSelector
                                                            onSelect={handleSpectrumType(index)}
                                                            selectVal={fileData.spectrumType}
                                                        />
                                                        {
                                                            fileData.spectrumType === 'foreground' && (

                                                                <FormControlLabel
                                                                    control={
                                                                        <Checkbox
                                                                            size="small"
                                                                            checked={fileData.synthesizeBackground}
                                                                            onChange={handleSynthesizeBackground(index)}
                                                                        />
                                                                    }
                                                                    label={<Typography variant="body2">{t('synthesizeBackground')}</Typography>}
                                                                    sx={{mr: 0}}
                                                                />

                                                            )
                                                        }
                                                    </>
                                                )}
                                            </Stack>
                                            <IconButton
                                                aria-label={t('deleteFile', {file: fileData.file.name})}
                                                onClick={() => handleFileDelete(index)}
                                                size="small"
                                                sx={{
                                                    padding: "2px",
                                                    border: "1px solid",
                                                    borderRadius: "10px",
                                                    borderColor: "error.main",
                                                    backgroundColor: "inherit",
                                                    color: "error.main"
                                                }}>
                                                <DeleteOutline fontSize="small" />
                                            </IconButton>
                                        </Stack>
                                    ))}
                                </Stack>
                            </Paper>
                        </Grid>
                    )}

                    {scannedData.length > 0 && (
                        <Grid item xs={12}>
                            <Paper variant="outlined" sx={{ p: 1 }}>
                                <Stack
                                    sx={{
                                        maxHeight: '150px',
                                        overflowY: 'auto',
                                    }}
                                    spacing={1}
                                >
                                    {scannedData.map((data, index) => (
                                        <Stack key={`scanned-${index}`} direction="row" spacing={1} alignItems="center" flexWrap="wrap" p={1}>
                                            <Box display="flex" alignItems="center" sx={{ minWidth: 0, flex: '1 1 auto' }}>
                                                <QrCode fontSize="small" color="action"/>
                                                <Typography variant="body2" noWrap sx={{ ml: 0.5 }}>
                                                    {data.text.length > 40 ? data.text.substring(0, 40) + '...' : data.text}
                                                    {data.serverPath && (
                                                        <Typography component="span" variant="caption" color="success.main" sx={{ ml: 1 }}>
                                                            {t('uploaded')}
                                                        </Typography>
                                                    )}
                                                </Typography>
                                            </Box>

                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            size="small"
                                                            checked={data.webIdEnabled}
                                                            onChange={handleQRCodeWebIdAnalysis(index)}
                                                            disabled={!!data.serverPath}
                                                        />
                                                    }
                                                    label={<Typography variant="body2">WebID</Typography>}
                                                    sx={{mr: 0}}
                                                />

                                                {data.webIdEnabled && (
                                                    <>
                                                        <DetectorResponseFunction
                                                            onSelect={handleScannedDataDrfSelection(index)}
                                                            selectVal={data.detectorResponseFunction}
                                                        />
                                                        <SpectrumTypeSelector
                                                            onSelect={handleScannedDataSpectrumType(index)}
                                                            selectVal={data.spectrumType}
                                                        />

                                                        {
                                                            data.spectrumType === 'foreground' && (
                                                                <FormControlLabel
                                                                    control={
                                                                        <Checkbox
                                                                            size="small"
                                                                            checked={data.synthesizeBackground}
                                                                            onChange={handleScannedDataSynthesizeBackground(index)}
                                                                        />
                                                                    }
                                                                    label={<Typography variant="body2">{t('synthesizeBackground')}</Typography>}
                                                                    sx={{mr: 0}}
                                                                />
                                                            )
                                                        }

                                                    </>
                                                )}
                                                <IconButton
                                                    aria-label={t('deleteScannedCode')}
                                                    onClick={() => handleScannedDataDelete(index)}
                                                    size="small"
                                                    sx={{
                                                        padding: "2px",
                                                        border: "1px solid",
                                                        borderRadius: "10px",
                                                        borderColor: "error.main",
                                                        backgroundColor: "inherit",
                                                        color: "error.main"
                                                    }}>
                                                    <DeleteOutline fontSize="small" />
                                                </IconButton>
                                            </Stack>
                                        </Stack>
                                    ))}
                                </Stack>
                            </Paper>
                        </Grid>
                    )}

                    <Dialog
                        onClose={handleCloseQrCodeDialog}
                        open={openDialog}
                        fullWidth
                        maxWidth="sm"
                    >
                        <IconButton
                            aria-label={t('close')}
                            onClick={handleCloseQrCodeDialog}
                            sx={{
                                position: 'absolute',
                                right: 8,
                                top: 8,
                            }}
                        >
                            <CloseRoundedIcon/>
                        </IconButton>
                        <DialogTitle sx={{textAlign: 'center', pb: 1}}>
                            {t('spectroscopicQrScanner')}
                        </DialogTitle>
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                p: 3,
                                pt: 1,
                            }}
                        >
                            <Box className='qr-reader'
                                 sx={{
                                     width: 400,
                                     height: 400,
                                     maxWidth: 400,
                                     borderRadius: 2,
                                     overflow: 'hidden',
                                     backgroundColor: 'black',
                                     display: 'flex',
                                     alignItems: 'center',
                                     justifyContent: 'center',
                                 }}
                            >
                                <video
                                    ref={videoElement}
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover"
                                    }}
                                />
                            </Box>

                            {scannedData.length > 0 && (
                                <Paper
                                    variant="outlined"
                                    sx={{mt: 2, p: 2, width: '100%', maxHeight: 150, overflowY: 'auto'}}
                                >
                                    <Typography variant="subtitle2" gutterBottom>
                                        {t('scannedCodesCount', {count: scannedData.length})}
                                    </Typography>
                                    <Stack spacing={1}>
                                        {scannedData.map((data, idx) => (
                                            <Stack
                                                key={idx}
                                                direction="row"
                                                justifyContent="space-between"
                                                alignItems="center"
                                            >
                                                <Typography variant="body2">
                                                    {data.text.length > 60 ? data.text.substring(0, 60) + '...' : data.text}
                                                </Typography>
                                                <IconButton
                                                    aria-label={t('deleteScannedCode')}
                                                    size="small"
                                                    onClick={() => handleScannedDataDelete(idx)}
                                                >
                                                    <DeleteOutline fontSize="small"/>
                                                </IconButton>
                                            </Stack>
                                        ))}
                                    </Stack>
                                </Paper>
                            )}

                            <Stack direction="row" spacing={2} sx={{mt: 2}}>
                                {scannedData.length > 0 && (
                                    <Button
                                        variant="outlined"
                                        onClick={() => {
                                            setScannedData([]);
                                            syncAutoSecondaryInspection(uploadedFiles, []);
                                        }}
                                    >
                                        {t('clearAll')}
                                    </Button>
                                )}
                                <Button
                                    variant="contained"
                                    onClick={handleCloseQrCodeDialog}
                                    sx={{minWidth: 120}}
                                >
                                    {t('doneScanning')}
                                </Button>
                            </Stack>
                        </Box>
                    </Dialog>
                    <Grid item container xs={12} spacing={2} alignItems="center" sx={{ displayPrint: 'none' }}>
                        <Grid item xs={"auto"}>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Button
                                    component="label"
                                    startIcon={<UploadFileRoundedIcon/>}
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        width: "auto",
                                        padding: "8px",
                                        borderStyle: "solid",
                                        borderWidth: "1px",
                                        borderRadius: "10px",
                                        borderColor: "secondary.main",
                                        backgroundColor: "inherit",
                                        color: "secondary.main"
                                    }}
                                >
                                    {t('uploadFiles')}
                                    <input
                                        type="file"
                                        multiple
                                        data-testid="adjudication-file-input"
                                        onChange={handleFileUpload}
                                        ref={fileInputRef}
                                        style={{display: "none"}}
                                    />
                                </Button>
                                {uffEnabled && !isReadOnlyViewer && (
                                    <Button
                                        type="button"
                                        startIcon={<FolderSharedRoundedIcon />}
                                        onClick={() => setOpenUffPicker(true)}
                                        data-testid="open-cargo-uff-picker-btn"
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            width: "auto",
                                            padding: "8px",
                                            borderStyle: "solid",
                                            borderWidth: "1px",
                                            borderRadius: "10px",
                                            borderColor: "primary.main",
                                            backgroundColor: "inherit",
                                            color: "primary.main",
                                        }}
                                    >
                                        {t('browseCargoUff')}
                                    </Button>
                                )}
                                <Button
                                    component="label"
                                    startIcon={<QrCode/>}
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        width: "auto",
                                        padding: "8px",
                                        borderStyle: "solid",
                                        borderWidth: "1px",
                                        borderRadius: "10px",
                                        borderColor: "info.main",
                                        backgroundColor: "inherit",
                                        color: "info.main"
                                    }}
                                    onClick={handleQrCode}
                                >
                                    {t('qrScanner')}
                                </Button>
                                <Button
                                    variant="outlined"
                                    color="info"
                                    data-testid="upload-to-webid-btn"
                                    onClick={submitToWebId}
                                    disabled={isSubmittingWebId || (!uploadedFiles.some(f => !f.serverPath && (f.webIdEnabled || isSpectroscopicFileName(f.file.name))) && !scannedData.some(d => d.webIdEnabled && !d.serverPath))}
                                    sx={{
                                        padding: "8px",
                                        borderRadius: "10px",
                                    }}
                                >
                                    {isSubmittingWebId ? t('uploading') : t('uploadToWebId')}
                                </Button>
                            </Stack>
                        </Grid>
                    </Grid>
                </Grid>
            </Paper>
            {showRelatedPassesBanner && relatedVehicleResult && (
                <Paper
                    variant="outlined"
                    data-testid="vehicle-related-passes-banner"
                    sx={{
                        p: 2,
                        borderColor: "secondary.main",
                        bgcolor: "action.hover",
                    }}
                >
                    <Stack
                        direction={{xs: "column", md: "row"}}
                        spacing={1.5}
                        alignItems={{xs: "flex-start", md: "center"}}
                        justifyContent="space-between"
                    >
                        <Stack spacing={0.75}>
                            <Typography variant="subtitle1" fontWeight={700}>
                                {t("vehicleCorrelationBannerTitle", {
                                    vehicleId:
                                        relatedVehicleResult.formattedVehicleId
                                        || effectiveCorrelationVehicleId,
                                })}
                            </Typography>
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                data-testid="vehicle-related-window-note"
                                sx={{textWrap: "pretty"}}
                            >
                                {relatedVehicleResult.truncated
                                    ? t("vehicleRelatedWindowTruncatedSummary", {
                                        limit: relatedVehicleResult.limitPerNode ?? 200,
                                    })
                                    : t("vehicleRelatedWindowSummary")}
                            </Typography>
                            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                                <Chip
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                    label={t("vehicleSearchSummaryChip", {
                                        passes: relatedVehicleResult.summary.totalPasses,
                                        lanes: relatedVehicleResult.summary.distinctLanes,
                                        nodes: relatedVehicleResult.summary.distinctNodes,
                                    })}
                                />
                                {relatedVehicleResult.summary.openAlarmPasses > 0 && (
                                    <Chip
                                        size="small"
                                        color="warning"
                                        label={t("vehicleCorrelationOpenAlarms", {
                                            count: relatedVehicleResult.summary.openAlarmPasses,
                                        })}
                                    />
                                )}
                                {relatedVehicleResult.summary.spectroscopicPasses > 0 && (
                                    <Chip
                                        size="small"
                                        color="info"
                                        variant="outlined"
                                        label={t("vehicleCorrelationSpectroscopic", {
                                            count: relatedVehicleResult.summary.spectroscopicPasses,
                                        })}
                                    />
                                )}
                                {relatedVehicleResult.summary.confirmedIsotopes.length > 0 && (
                                    <Chip
                                        size="small"
                                        color="secondary"
                                        variant="outlined"
                                        label={relatedVehicleResult.summary.confirmedIsotopes.join(", ")}
                                    />
                                )}
                            </Stack>
                        </Stack>
                        <Button
                            type="button"
                            variant="contained"
                            color="secondary"
                            size="small"
                            startIcon={<CompareArrowsRoundedIcon />}
                            onClick={() => setOpenVehicleComparison(true)}
                            data-testid="open-vehicle-pass-comparison"
                            sx={{whiteSpace: "nowrap"}}
                        >
                            {t("vehicleComparePassesButton", {
                                count: relatedVehicleResult.passes.length,
                            })}
                        </Button>
                    </Stack>
                </Paper>
            )}
            {uffEnabled && correlatedUffMatches.length > 0 && (
                <Paper
                    variant="outlined"
                    data-testid="correlated-cargo-uff-banner"
                    sx={{
                        p: 1.5,
                        borderColor: "primary.main",
                        bgcolor: "action.hover",
                    }}
                >
                    <Stack
                        direction={{xs: "column", md: "row"}}
                        spacing={1.5}
                        alignItems={{xs: "flex-start", md: "center"}}
                        justifyContent="space-between"
                    >
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                            <LayersRoundedIcon color="primary" fontSize="small" />
                            <Typography variant="body2" fontWeight={700}>
                                {t('cargoUffCorrelatedTitle', {count: correlatedUffMatches.length})}
                            </Typography>
                            <Chip
                                size="small"
                                color="primary"
                                label={`UFF ${correlatedUffMatches[0]!.uffVersion} · ${correlatedUffMatches[0]!.scannerId || 'NII'}`}
                            />
                            {correlatedUffMatches[0]!.fuzzyMatch && (
                                <Chip
                                    size="small"
                                    color="warning"
                                    label={`OCR ±1: ${correlatedUffMatches[0]!.matchedIdentifier}`}
                                />
                            )}
                            {correlatedUffMatches[0]!.goodsDescription && (
                                <Chip
                                    size="small"
                                    variant="outlined"
                                    label={`HS ${correlatedUffMatches[0]!.hsCode}: ${correlatedUffMatches[0]!.goodsDescription}`}
                                />
                            )}
                        </Stack>
                        <Stack direction="row" spacing={1}>
                            <Button
                                type="button"
                                size="small"
                                variant="contained"
                                color="primary"
                                startIcon={<LayersRoundedIcon />}
                                onClick={() => setViewerTarget({open: true, uffUuid: correlatedUffMatches[0]!.uffUuid})}
                                data-testid="open-correlated-cargo-uff-btn"
                            >
                                {t('openCargoXray')}
                            </Button>
                            {!isReadOnlyViewer && (
                                <Button
                                    type="button"
                                    size="small"
                                    variant="outlined"
                                    color="secondary"
                                    disabled={linkingUffUuid === correlatedUffMatches[0]!.uffUuid}
                                    onClick={() => void handleLinkSmbUffToAdjudication(correlatedUffMatches[0]!.uffUuid)}
                                    data-testid="link-correlated-cargo-uff-btn"
                                >
                                    {t('linkCargoUffShort')}
                                </Button>
                            )}
                        </Stack>
                    </Stack>
                </Paper>
            )}
            {/*Adjudication FORM*/}
            <Paper variant='outlined' sx={{ p: 2, displayPrint: 'none' }}>
                <Grid container spacing={2} sx={{ width: '100%' }}>
                    <Grid item container xs={12} spacing={2}>
                        <Grid item xs={12}>
                            <Typography variant="h5">
                                {t('adjudicationForm')}
                            </Typography>
                        </Grid>
                        <Grid item xs={12} sm={6} lg={5}>
                            <TextField
                                label={t('vehicleId')}
                                name="vehicleId"
                                value={vehicleId}
                                onChange={handleChange}
                                helperText={vehicleIdAutoFilled ? t('ocrAutoFilledHelper') : undefined}
                                inputProps={{
                                    autoCorrect: 'off',
                                    autoCapitalize: 'none',
                                    spellCheck: false,
                                }}
                                fullWidth
                            />
                            {normalizeVehicleId(effectiveCorrelationVehicleId).length >= 3 && (
                                <Box sx={{mt: 0.75}}>
                                    <Button
                                        type="button"
                                        size="small"
                                        variant="text"
                                        color="secondary"
                                        startIcon={<CompareArrowsRoundedIcon fontSize="small" />}
                                        onClick={() => setOpenVehicleComparison(true)}
                                        data-testid="vehicle-id-history-btn"
                                    >
                                        {t("vehicleOpenPassHistory")}
                                    </Button>
                                </Box>
                            )}
                            {props.event && (
                                <VehicleIdOcr
                                    event={props.event}
                                    selectedValue={vehicleId}
                                    onResults={setOcrResults}
                                    onSelectValue={handleOcrSelect}
                                    initialResults={props.ocrInitialResults}
                                    fetchImpl={props.ocrFetchImpl}
                                />
                            )}
                        </Grid>
                        <Grid item xs={12} sm={6} lg={7} />
                        <Grid item xs={12} sm={6}>
                            <AdjudicationSelect
                                adjCode={adjudicationCode}
                                onSelect={handleAdjudicationSelect}
                                nodes={[laneMapRef.current.get(props.event.laneId)?.parentNode].filter(Boolean)}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <IsotopeSelect
                                isotopeValue={isotope}
                                onSelect={handleIsotopeSelect}
                            />
                        </Grid>
                        {webIdResults.length > 0 && (
                            <Grid item xs={12}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <FormControl size="small" sx={{ minWidth: 250 }}>
                                        <InputLabel id="webid-result-select-label">{t('webIdEvidence')}</InputLabel>
                                        <Select
                                            multiple
                                            labelId="webid-result-select-label"
                                            label={t('webIdEvidence')}
                                            data-testid="webid-evidence-select"
                                            value={selectedWebIdResultId}
                                            onChange={handleEvidenceSelection}
                                        >
                                            {webIdResults.map((result) => (
                                                <MenuItem key={result.id} value={result.id}>
                                                    <Checkbox size="small" checked={selectedWebIdResultId.includes(result.id)} />
                                                    {new Date(result.time).toLocaleString(getIntlLocale(language))} — {result.isotopeString || result.isotopes?.map(i => i.name).join(', ') || t('noIsotopes')}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    <Button
                                        type="button"
                                        size="small"
                                        variant="outlined"
                                        color="info"
                                        data-testid="apply-webid-isotopes"
                                        disabled={selectedWebIdResultId.length === 0}
                                        onClick={applySelectedWebIdResult}
                                        sx={{ whiteSpace: 'nowrap' }}
                                    >
                                        {t('useSelectedResult')}
                                    </Button>
                                </Stack>
                            </Grid>
                        )}

                        <Grid item xs={12}>
                            <TextField
                                id="outlined-multiline-static"
                                label={t('notes')}
                                name="notes"
                                multiline
                                rows={4}
                                value={feedback}
                                onChange={handleChange}
                                fullWidth
                            />
                        </Grid>
                    </Grid>

                    <Grid item container xs={12} spacing={2} alignItems="center" justifyContent="flex-end">
                        {isReadOnlyViewer && (
                            <Grid item xs={12}>
                                <Alert severity="info" data-testid="viewer-readonly-adjudication-alert">
                                    {t('viewerReadOnlyAdjudicationNotice')}
                                </Alert>
                            </Grid>
                        )}
                        <Grid item xs={"auto"}>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <SecondaryInspectionSelect
                                    secondarySelectVal={secondaryInspection}
                                    onSelect={handleInspectionSelect}
                                />
                                <Button
                                    size="large"
                                    disableElevation
                                    variant={"contained"}
                                    color={"success"}
                                    disabled={isReadOnlyViewer}
                                    onClick={sendAdjudicationData}
                                >
                                    {t('submit')}
                                </Button>
                            </Stack>
                        </Grid>
                    </Grid>

                    <Dialog
                        open={openConfirmDialog}
                        onClose={() => setOpenConfirmDialog(false)}
                        fullWidth
                        maxWidth="sm"
                    >
                        <DialogTitle sx={{ pb: 1 }}>
                            {t('confirmAdjudicationSubmission')}
                        </DialogTitle>
                        <DialogContent dividers sx={{ px: 1.5 }}>
                            <Stack spacing={1.5}>
                                {vehicleId && (
                                    <>
                                        <Box>
                                            <Typography variant="subtitle2" color="text.secondary">{t('vehicleId')}</Typography>
                                            <Typography variant="body1">{vehicleId}</Typography>
                                        </Box>
                                        <Divider />
                                    </>
                                )}

                                <Box>
                                    <Typography variant="subtitle2" color="text.secondary">{t('adjudicationCode')}</Typography>
                                    <Typography variant="body1" sx={{ wordBreak: 'break-word' }}>
                                        {adjData.adjudicationCode?.code > 11
                                            ? `Code ${adjData.adjudicationCode.code}: ${adjData.adjudicationCode.label}`
                                            : `${t(`adjudicationCode.${adjData.adjudicationCode?.code}`)} (${t(`adjudicationGroup.${adjData.adjudicationCode?.group}`)})`}
                                    </Typography>
                                </Box>
                                <Divider />

                                {isotope.length > 0 && (
                                    <>
                                        <Box>
                                            <Typography variant="subtitle2" color="text.secondary">{t('isotopes')}</Typography>
                                            <Typography variant="body1" sx={{ wordBreak: 'break-word' }}>{isotope.map(item => t(`isotope.${item}`)).join(', ')}</Typography>
                                        </Box>
                                        <Divider />
                                    </>
                                )}

                                {feedback && (
                                    <>
                                        <Box>
                                            <Typography variant="subtitle2" color="text.secondary">{t('notes')}</Typography>
                                            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{feedback}</Typography>
                                        </Box>
                                        <Divider />
                                    </>
                                )}

                                {uploadedFiles.length > 0 && (
                                    <>
                                        <Box>
                                            <Typography variant="subtitle2" color="text.secondary">{t('filesCount', {count: uploadedFiles.length})}</Typography>
                                            <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                                                {uploadedFiles.map((fileData, index) => (
                                                    <Box key={index}>
                                                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
                                                            <InsertDriveFileRoundedIcon fontSize="small" sx={{ flexShrink: 0 }} />
                                                            <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>{fileData.file.name}</Typography>
                                                        </Stack>
                                                        {fileData.webIdEnabled && (
                                                            <Typography variant="caption" color="info.main" sx={{ pl: 3, display: 'block', wordBreak: 'break-word' }}>
                                                                {t('webIdFileDetails', {spectrum: t(fileData.spectrumType), drf: fileData.detectorResponseFunction})}
                                                                {fileData.synthesizeBackground ? `, ${t('synthesizedBackgroundShort')}` : ''}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                ))}
                                            </Stack>
                                        </Box>
                                        <Divider />
                                    </>
                                )}

                                {scannedData.length > 0 && (
                                    <>
                                        <Box>
                                            <Typography variant="subtitle2" color="text.secondary">{t('scannedQrCodesCount', {count: scannedData.length})}</Typography>
                                            <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                                                {scannedData.map((data, idx) => (
                                                    <Typography key={idx} variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                                        {data.text.length > 80 ? data.text.substring(0, 80) + '...' : data.text}
                                                    </Typography>
                                                ))}
                                            </Stack>
                                        </Box>
                                        <Divider />
                                    </>
                                )}

                                {secondaryInspection && (
                                    <Box>
                                        <Typography variant="subtitle2" color="text.secondary">{t('secondaryInspection')}</Typography>
                                        <Typography variant="body1">{t(`secondaryInspection.${secondaryInspection.toLowerCase()}`)}</Typography>
                                    </Box>
                                )}
                            </Stack>
                        </DialogContent>
                        <DialogActions sx={{ px: 1.5, py: 1.5, flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
                            <Button
                                onClick={() => setOpenConfirmDialog(false)}
                                color="error"
                                fullWidth
                                sx={{ width: { sm: 'auto' } }}
                            >
                                {t('cancel')}
                            </Button>
                            <Button
                                onClick={confirmAndSubmitAdjudication}
                                variant="contained"
                                color="success"
                                fullWidth
                                sx={{ width: { sm: 'auto' } }}
                            >
                                {t('confirmAndSubmit')}
                            </Button>
                        </DialogActions>
                    </Dialog>

                    <Snackbar
                        anchorOrigin={{vertical: 'top', horizontal: 'center'}}
                        open={openSnack}
                        autoHideDuration={5000}
                        onClose={handleCloseSnack}
                        message={adjSnackMsg}
                        sx={{
                            '& .MuiSnackbarContent-root': {
                                backgroundColor: colorStatus === 'success' ? 'green' : 'red',
                            },
                        }}
                    />
                </Grid>
            </Paper>
            {openVehicleComparison && effectiveCorrelationVehicleId && (
                <VehiclePassComparisonDialog
                    open={openVehicleComparison}
                    onClose={() => setOpenVehicleComparison(false)}
                    vehicleId={effectiveCorrelationVehicleId}
                    matchMode="equals"
                    laneMap={effectiveLaneMap}
                    activeViewKey={activeViewKey}
                    startTimeIso={relatedVehicleStartTimeIso}
                    initialResult={relatedVehicleResult}
                    highlightOccupancyObsId={props.event?.occupancyObsId ?? null}
                    onAdjudicationComplete={() => {
                        setShouldFetchLogs(true);
                        setRelatedSearchNonce(previous => previous + 1);
                    }}
                    fetchImpl={props.ocrFetchImpl}
                />
            )}
            {openUffPicker && (
                <CargoUffSmbPickerDialog
                    open={openUffPicker}
                    onClose={() => setOpenUffPicker(false)}
                    node={eventParentNode}
                    alarmTimestampIso={props.event?.startTime ?? null}
                    initialVehicleId={effectiveCorrelationVehicleId || null}
                    onInspectUff={uuid => setViewerTarget({open: true, uffUuid: uuid})}
                    onLinkUff={uuid => handleLinkSmbUffToAdjudication(uuid)}
                    linkingUuid={linkingUffUuid}
                />
            )}
            {viewerTarget.open && (
                <CargoUffViewerDialog
                    open={viewerTarget.open}
                    onClose={() => setViewerTarget({open: false})}
                    uffUuid={viewerTarget.uffUuid ?? null}
                    bucketKey={viewerTarget.bucketKey ?? null}
                    localFile={viewerTarget.localFile ?? null}
                    node={eventParentNode}
                    occupancyObsId={props.event?.occupancyObsId ?? null}
                    onApplyVehicleId={!isReadOnlyViewer ? selected => handleOcrSelect(selected) : undefined}
                    onLinkToAdjudication={
                        !isReadOnlyViewer && viewerTarget.uffUuid
                            ? async uuid => {
                                  await handleLinkSmbUffToAdjudication(uuid);
                                  setViewerTarget({open: false});
                              }
                            : undefined
                    }
                    linkingAdjudication={Boolean(linkingUffUuid)}
                />
            )}
        </Stack>
    );
}
