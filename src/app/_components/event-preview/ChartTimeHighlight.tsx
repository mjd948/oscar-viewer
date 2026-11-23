/*
 * Copyright (c) 2024.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */
'use client';

import React, {useEffect, useMemo, useRef, useState} from "react";
import {Alert, Box, Grid, Stack, ToggleButton, ToggleButtonGroup} from "@mui/material";
import ChartJsView from "osh-js/source/core/ui/view/chart/ChartJsView.js";
import ConSysApi from "osh-js/source/core/datasource/consysapi/ConSysApi.datasource";
import annotationPlugin from 'chartjs-plugin-annotation';
import {Chart, registerables} from 'chart.js';
import {EventTableData} from "@/lib/data/oscar/TableHelpers";
import {
    buildEventTimeScaleOptions,
    clampEventAnnotationTime,
    createGammaViewCurve,
    createGammaDetectorViewCurves,
    createNeutronViewCurve,
    createNeutronDetectorViewCurves,
    createNSigmaCalcViewCurve,
    createThresholdViewCurve,
    createThreshSigmaViewCurve,
    destroyChartView,
    DETECTOR_DATASET_OPTIONS,
    type DetectorPlotLayout,
    EVENT_CHART_MAX_VALUES,
    getEventChartBoundsMs,
    getStoredDetectorPlotLayout,
    patchChartViewMultiCurveSync,
    setStoredDetectorPlotLayout,
    sortTooltipByHighestCps,
} from "@/app/utils/ChartUtils";
import {useLanguage} from '@/app/contexts/LanguageContext';
import {getIntlLocale} from '@/app/utils/LocaleUtils';


type CurveLayers = {
    neutron: any;
    gamma: any;
    threshold: any;
    threshNsigma: any;
    nsigma: any;
};

type ChartTypes ={
    gamma?: any;
    neutron?: any;
    nsigma?: any;
}

type ChartMode = "total" | "gamma" | "neutron";

const combinedGammaDetectorChartId = "event-gamma-detectors-combined";
const combinedNeutronDetectorChartId = "event-neutron-detectors-combined";

const gammaDetectorChartIds = [
    "event-gamma-detector-1",
    "event-gamma-detector-2",
    "event-gamma-detector-3",
    "event-gamma-detector-4",
];

const neutronDetectorChartIds = [
    "event-neutron-detector-1",
    "event-neutron-detector-2",
    "event-neutron-detector-3",
    "event-neutron-detector-4",
];

Chart.register(...registerables, annotationPlugin);

export class ChartInterceptProps {
    modeType: string;
    datasources: { gamma: typeof ConSysApi, neutron: typeof ConSysApi, threshold: typeof ConSysApi };
    eventData: EventTableData;
    latestGB: number;
    currentTime: any;
    showDetectorModes?: boolean;
}

export default function ChartTimeHighlight(props: ChartInterceptProps) {
    const {language, t} = useLanguage();

    const gammaChartViewRef = useRef<HTMLDivElement | null>(null);
    const nSigmaChartViewRef = useRef<HTMLDivElement | null>(null);
    const neutronChartViewRef = useRef<HTMLDivElement | null>(null);

    const gammaChartBaseId = "chart-view-event-detail-gamma-";
    const neutronChartBaseId = "chart-view-event-detail-neutron-";
    const nsigmaChartBaseId = "chart-view-event-detail-nsigma-";

    const [layers, setLayers] = useState<CurveLayers>();

    const [hasNsigma, setHasNsigma] = useState(false);

    const [chartViews, setChartViews] = useState<ChartTypes>({
        gamma: null,
        neutron: null,
        nsigma: null,
    });

    const [toggleView, setToggleView] = useState("cps");
    const totalChartViewsRef = useRef<any[]>([]);
    const detectorChartViewsRef = useRef<any[]>([]);
    const [mode, setMode] = useState<ChartMode>("total");
    const [detectorLayout, setDetectorLayout] = useState<DetectorPlotLayout>(() => getStoredDetectorPlotLayout());

    const availableModes = useMemo<ChartMode[]>(() => {
        if (props.eventData.status === "Gamma")
            return ["total", "gamma"];
        if (props.eventData.status === "Neutron")
            return ["total", "neutron"];
        return ["total", "gamma", "neutron"];
    }, [props.eventData.status]);

    const gammaChartIds = useMemo(() => gammaDetectorChartIds, []);
    const neutronChartIds = useMemo(() => neutronDetectorChartIds, []);
    const eventBounds = useMemo(
        () => getEventChartBoundsMs(props.eventData?.startTime, props.eventData?.endTime),
        [props.eventData?.startTime, props.eventData?.endTime],
    );
    const eventIdentityKey = useMemo(() => {
        if (!props.eventData) return "";
        return [
            props.eventData.laneId ?? "",
            props.eventData.occupancyObsId ?? "",
            props.eventData.occupancyCount ?? "",
            props.eventData.startTime ?? "",
            props.eventData.endTime ?? "",
        ].join("|");
    }, [
        props.eventData?.laneId,
        props.eventData?.occupancyObsId,
        props.eventData?.occupancyCount,
        props.eventData?.startTime,
        props.eventData?.endTime,
    ]);

    useEffect(() => {
        if (!availableModes.includes(mode))
            setMode("total");
    }, [availableModes, mode]);

    useEffect(() => {
        if (!props.showDetectorModes) return;

        const labels = {time: t("time"), gamma: t("gamma"), neutron: t("neutron")};
        const detectorTimeScale = () => buildEventTimeScaleOptions(
            props.eventData?.startTime,
            props.eventData?.endTime,
            t("time"),
        );
        const createCombinedChart = (
            datasource: typeof ConSysApi | undefined,
            container: string,
            title: string,
            curves: any[],
        ) => {
            if (!datasource || curves.length === 0 || !document.getElementById(container)) return [];

            const view = new ChartJsView({
                type: "line",
                container,
                layers: curves,
                css: "chart-view",
                destroyAfterMutation: false,
                refreshRate: 0,
                datasetOptions: DETECTOR_DATASET_OPTIONS,
                options: {
                    interaction: {
                        mode: "index" as const,
                        intersect: false,
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: title,
                            font: {size: 14, weight: "bold" as const},
                        },
                        legend: {display: true, position: "bottom" as const},
                        tooltip: {
                            itemSort: sortTooltipByHighestCps,
                        },
                    },
                    responsive: true,
                    scales: {
                        x: detectorTimeScale(),
                        y: {title: {display: true, text: "CPS"}, position: "left" as const},
                    },
                },
            });
            patchChartViewMultiCurveSync(view, true);
            return [view];
        };

        const createSeparateCharts = (
            datasource: typeof ConSysApi | undefined,
            chartIds: string[],
            curves: any[],
        ) => {
            if (!datasource) return [];

            return curves.flatMap((curve, index) => {
                const container = chartIds[index];
                if (!document.getElementById(container)) return [];

                const view = new ChartJsView({
                    type: "line",
                    container,
                    layers: [curve],
                    css: "chart-view",
                    destroyAfterMutation: false,
                    refreshRate: 0,
                    datasetOptions: DETECTOR_DATASET_OPTIONS,
                    options: {
                        plugins: {
                            title: {
                                display: true,
                                text: `${t("detector")} ${index + 1}`,
                                font: {size: 14, weight: "bold" as const},
                            },
                            legend: {display: true, position: "bottom" as const},
                        },
                        responsive: true,
                        scales: {
                            x: detectorTimeScale(),
                            y: {title: {display: true, text: "CPS"}, position: "left" as const},
                        },
                    },
                });
                patchChartViewMultiCurveSync(view, true);
                return [view];
            });
        };

        const views = [
            ...(availableModes.includes("gamma")
                ? [
                    ...createCombinedChart(
                        props.datasources.gamma,
                        combinedGammaDetectorChartId,
                        t("chartModeGammaDetectors"),
                        createGammaDetectorViewCurves(props.datasources.gamma, labels),
                    ),
                    ...createSeparateCharts(
                        props.datasources.gamma,
                        gammaChartIds,
                        createGammaDetectorViewCurves(props.datasources.gamma, labels),
                    ),
                ]
                : []),
            ...(availableModes.includes("neutron")
                ? [
                    ...createCombinedChart(
                        props.datasources.neutron,
                        combinedNeutronDetectorChartId,
                        t("chartModeNeutronDetectors"),
                        createNeutronDetectorViewCurves(props.datasources.neutron, labels),
                    ),
                    ...createSeparateCharts(
                        props.datasources.neutron,
                        neutronChartIds,
                        createNeutronDetectorViewCurves(props.datasources.neutron, labels),
                    ),
                ]
                : []),
        ];

        detectorChartViewsRef.current = views;
        return () => {
            views.forEach(destroyChartView);
            detectorChartViewsRef.current = [];
        };
    }, [
        availableModes,
        gammaChartIds,
        neutronChartIds,
        props.datasources.gamma,
        props.datasources.neutron,
        props.eventData?.endTime,
        props.eventData?.startTime,
        props.showDetectorModes,
        t,
    ]);

    useEffect(() => {
        return () => {
            totalChartViewsRef.current.forEach(destroyChartView);
            totalChartViewsRef.current = [];
        };
    }, []);

    useEffect(() => {
        if (!props.showDetectorModes) return;
        detectorChartViewsRef.current.forEach(view => {
            view.chart?.resize?.();
            view.chart?.update?.();
        });
    }, [detectorLayout, mode, props.showDetectorModes]);

    useEffect(() => {
        if (!props.showDetectorModes || props.currentTime === null || props.currentTime === undefined) return;

        const time = clampEventAnnotationTime(props.currentTime, eventBounds);
        if (!time) return;
        detectorChartViewsRef.current.forEach(view => {
            if (!view?.chart?.options?.plugins) return;
            view.chart.options.plugins.annotation = {
                annotations: {
                    currentTime: {
                        type: "line",
                        xMin: time,
                        xMax: time,
                        borderColor: "yellow",
                        borderWidth: 4,
                        label: {enabled: true, content: t("currentTime")},
                    },
                },
            };
            view.chart.update();
        });
    }, [eventBounds, props.currentTime, props.showDetectorModes, t]);

    const gammaToggleButtons = [
        <ToggleButton color='error' value={"cps"} key={"cps"}>CPS</ToggleButton>,
        <ToggleButton color='secondary' value={"sigma"} key={"sigma"}>NSigma</ToggleButton>
    ];

    useEffect(() => {
        const timers: Array<ReturnType<typeof setTimeout>> = [];
        if (chartViews.gamma) {
            timers.push(setTimeout(() => {
                chartViews.gamma?.chart?.update?.();
            }, 300));
        }

        if (chartViews.nsigma) {
            timers.push(setTimeout(() => {
                chartViews.nsigma?.chart?.update?.();
            }, 300));
        }
        return () => {
            timers.forEach(clearTimeout);
        };
    }, [chartViews.gamma, chartViews.nsigma]);


    useEffect(() => {
        if (!props.eventData || !props.datasources?.gamma || !props.datasources?.neutron) return;

        setHasNsigma(Boolean(props.datasources?.threshold && props?.latestGB != null));

        const init = async () => {
            const createdLayers = await createCurveLayers();
            setLayers(createdLayers);
        };
        init();
    }, [props.eventData, props.latestGB, props.datasources]);

    const initializedEventKeyRef = useRef<string | null>(null);
    const nsigmaInitializedRef = useRef(false);

    useEffect(() => {
        if (!props.eventData) {
            console.warn("No event data");
            return;
        }

        if (!layers) {
            return;
        }

        const elementIds = updateChartElIds(props.eventData);
        if (initializedEventKeyRef.current !== eventIdentityKey) {
            nsigmaInitializedRef.current = false;
            renderCharts(layers, elementIds);
            initializedEventKeyRef.current = eventIdentityKey;
            return;
        }

        if (!nsigmaInitializedRef.current && hasNsigma && layers.nsigma && layers.threshNsigma && nSigmaChartViewRef?.current) {
            renderNSigmaChartView(layers, elementIds);
        }
    }, [eventIdentityKey, hasNsigma, layers, props.eventData]);

    useEffect(() => {
        if (chartViews && props.currentTime) {
            annotateCharts(props.currentTime);
        }
    }, [props.currentTime, chartViews, eventBounds]);

    useEffect(() => {
        const updateLabels = (view: any, datasetLabels: string[]) => {
            if (!view?.chart) return;

            view.chart.options.scales.x.title.text = t('time');
            view.chart.data.datasets.forEach((dataset: any, index: number) => {
                if (datasetLabels[index]) dataset.label = datasetLabels[index];
            });
            view.chart.update();
        };

        updateLabels(chartViews.gamma, [t('gamma'), t('threshold')]);
        updateLabels(chartViews.neutron, [t('neutron')]);
        updateLabels(chartViews.nsigma, [t('gammaNSigma'), t('threshold')]);

        if (props.currentTime) annotateCharts(props.currentTime);
    }, [language, chartViews, props.currentTime, eventBounds]);



    function annotateCharts(currTime: any) {
        if (currTime === null || currTime === undefined) return;

        const timeVal = clampEventAnnotationTime(currTime, eventBounds);
        if (!timeVal) return;

        let chartAnnotation = {
            annotations: {
                verticalLine: {
                    type: 'line',
                    xMin: timeVal,
                    xMax: timeVal,
                    borderColor: 'yellow',
                    borderWidth: 4,
                    label: {
                        enabled: true,
                        content: t('currentTime')
                    }
                }
            }
        };

        if (chartViews?.gamma?.chart) {
            const gchart = chartViews.gamma.chart;
            gchart.options.plugins.annotation = chartAnnotation;
            gchart.update();
        }

        if (chartViews?.nsigma?.chart) {
            const nSigmachart = chartViews.nsigma.chart;
            nSigmachart.options.plugins.annotation = chartAnnotation;
            nSigmachart.update();
        }

        if (chartViews?.neutron?.chart) {
            const nchart = chartViews.neutron.chart;
            nchart.options.plugins.annotation = chartAnnotation;
            nchart.update();
        }
    }

    function updateChartElIds(eventData: EventTableData): string[] {
        let ids: string[] = [];
        let gammaId: string;
        let nsigmaId: string;
        let neutronId: string

        switch (eventData.status) {
            case "Gamma":
                gammaId = gammaChartBaseId + eventData.id + "-" + props.modeType;
                nsigmaId = nsigmaChartBaseId + eventData.id + "-" + props.modeType;
                ids.push(gammaId, nsigmaId);
                break;
            case "Neutron":
                neutronId = neutronChartBaseId + eventData.id + "-" + props.modeType;
                ids.push(neutronId);
                break;
            case "Gamma & Neutron":
            case "None":
                gammaId = gammaChartBaseId + eventData.id + "-" + props.modeType;
                nsigmaId = nsigmaChartBaseId + eventData.id + "-" + props.modeType;
                neutronId = neutronChartBaseId + eventData.id + "-" + props.modeType;
                ids.push(gammaId, neutronId, nsigmaId);
                break;
            default:
                break;
        }
        return ids;
    }

    async function createCurveLayers() {
        const labels = {
            time: t('time'),
            neutron: t('neutron'),
            gamma: t('gamma'),
            threshold: t('threshold'),
            gammaNSigma: t('gammaNSigma'),
        };

        let result = await Promise.all([
            createNeutronViewCurve(props.datasources.neutron, labels),
            createGammaViewCurve(props.datasources.gamma, labels),
            createThresholdViewCurve(props.datasources.threshold, labels),
            createThreshSigmaViewCurve(props.datasources.threshold, labels),
            createNSigmaCalcViewCurve(props.datasources.gamma, props.latestGB, labels)
        ]);

        const [neutron, gamma, threshold, threshNsigma, nsigma] = result;
        return {
            neutron,
            gamma,
            threshold,
            threshNsigma,
            nsigma
        };
    }

    const renderNSigmaChartView = (chartLayers: CurveLayers, elementIds: string[]) => {
        const nsigmaContainerId = elementIds.find(id => id.includes("nsigma"));
        if (!nsigmaContainerId || !chartLayers?.nsigma || !chartLayers?.threshNsigma || !nSigmaChartViewRef?.current) {
            return;
        }
        setHasNsigma(true);
        const nsigmaDiv = document.createElement("div");
        nsigmaDiv.id = nsigmaContainerId;

        nSigmaChartViewRef.current.innerHTML = "";
        nSigmaChartViewRef.current.appendChild(nsigmaDiv);

        const nsigmaChart = new ChartJsView({
            container: nsigmaDiv.id,
            layers: [chartLayers.nsigma, chartLayers.threshNsigma],
            css: "chart-view-event-detail",
            type: 'line',
            destroyAfterMutation: false,
            refreshRate: 0,
            options: {
                scales: {
                    x: buildEventTimeScaleOptions(
                        props.eventData?.startTime,
                        props.eventData?.endTime,
                        t('time'),
                        {padding: 5},
                    ),
                    y: {
                        type: 'linear',
                        position: 'left',
                        title: {display: true, text: 'Nσ', padding: 15},
                        beginAtZero: false
                    }
                }
            }
        });
        patchChartViewMultiCurveSync(nsigmaChart, true);
        totalChartViewsRef.current.push(nsigmaChart);
        nsigmaInitializedRef.current = true;
        setChartViews(prev => ({...prev, nsigma: nsigmaChart}));
    };

    const renderCharts = (chartLayers: CurveLayers, elementIds: string[]) => {
        totalChartViewsRef.current.forEach(destroyChartView);
        totalChartViewsRef.current = [];
        setChartViews({gamma: null, neutron: null, nsigma: null});

        const gammaContainerId = elementIds.find(id => id.includes("gamma"));
        if (gammaContainerId && chartLayers?.gamma && gammaChartViewRef?.current) {
            const gammaLayers: any[] = [];

            if (chartLayers.gamma) gammaLayers.push(chartLayers.gamma);
            if (chartLayers.threshold) gammaLayers.push(chartLayers.threshold);

            const gammaDiv = document.createElement("div");
            gammaDiv.id = gammaContainerId;
            gammaChartViewRef.current.innerHTML = ""; //clear previous chart
            gammaChartViewRef.current.appendChild(gammaDiv);

            const gammaChart = new ChartJsView({
                container: gammaDiv.id,
                layers: gammaLayers,
                css: "chart-view-event-detail",
                type: 'line',
                destroyAfterMutation: false,
                refreshRate: 0,
                options: {
                    scales: {
                        x: buildEventTimeScaleOptions(
                            props.eventData?.startTime,
                            props.eventData?.endTime,
                            t('time'),
                            {padding: 5},
                        ),
                        y: {title: {display: true, text: 'CPS', padding: 15}, beginAtZero: false}
                    }
                }
            });

            patchChartViewMultiCurveSync(gammaChart, true);
            totalChartViewsRef.current.push(gammaChart);
            setChartViews(prev => ({...prev, gamma: gammaChart}));
        }

        const neutronContainerId = elementIds.find(id => id.includes("neutron"));
        if (neutronContainerId && chartLayers?.neutron && neutronChartViewRef?.current) {
            const neutronDiv = document.createElement("div");
            neutronDiv.id = neutronContainerId;

            neutronChartViewRef.current.innerHTML = "";
            neutronChartViewRef.current.appendChild(neutronDiv);

            const neutronChart = new ChartJsView({
                container: neutronDiv.id,
                layers: [chartLayers.neutron],
                css: "chart-view-event-detail",
                type: 'line',
                destroyAfterMutation: false,
                refreshRate: 0,
                options: {
                    scales: {
                        x: buildEventTimeScaleOptions(
                            props.eventData?.startTime,
                            props.eventData?.endTime,
                            t('time'),
                            {padding: 5},
                        ),
                        y: {
                            type: 'linear',
                            position: 'left',
                            title: {display: true, text: 'CPS', padding: 15},
                            beginAtZero: false,
                            ticks: {stepSize: 1}
                        }
                    }
                }
            });

            patchChartViewMultiCurveSync(neutronChart, true);
            totalChartViewsRef.current.push(neutronChart);
            setChartViews(prev => ({...prev, neutron: neutronChart}));
        }

        renderNSigmaChartView(chartLayers, elementIds);
    };

    const handleToggle = (event: React.MouseEvent<HTMLElement>, newView: string | null) => {
        if (newView) setToggleView(newView);
    }

    const handleDetectorLayoutChange = (
        event: React.MouseEvent<HTMLElement>,
        nextLayout: DetectorPlotLayout | null,
    ) => {
        if (!nextLayout) return;
        setDetectorLayout(nextLayout);
        setStoredDetectorPlotLayout(nextLayout);
    };

    const renderToggleButtons = () => {
        if (!hasNsigma) return null;

        return (
            <Grid item style={{display: "flex", justifyContent: "center", width: "100%"}}>
                <ToggleButtonGroup
                    size="small"
                    orientation="horizontal"
                    onChange={handleToggle}
                    exclusive
                    value={toggleView}
                >
                    {gammaToggleButtons}
                </ToggleButtonGroup>
            </Grid>
        );
    }

    const renderGammaChart = () => {
        return (
            <Grid item xs sx={{width: "100%", display: toggleView === 'cps' ? 'block' : 'none'}} ref={gammaChartViewRef}/>
        )
    }

    const renderNSigmaChart = () => {
        if(!hasNsigma) return null;

        return(
            <Grid item xs sx={{width: "100%", display: toggleView === 'sigma' ? 'block' : 'none'}} ref={nSigmaChartViewRef}/>
        )
    }

    const renderNeutronChart = () => {
        return (
            <Grid item xs sx={{width: "100%"}} ref={neutronChartViewRef}/>
        )

    }

    const renderChartsByStatus = () => {
        switch (props.eventData.status) {
            case "Gamma":
                return (
                    <>
                        {renderToggleButtons()}
                        {renderGammaChart()}
                        {renderNSigmaChart()}
                    </>
                );

            case "Neutron":
                return renderNeutronChart();

            case "Gamma & Neutron":
            case "None":
            default:
                return (
                    <>
                        {renderToggleButtons()}
                        {renderGammaChart()}
                        {renderNSigmaChart()}
                        {renderNeutronChart()}
                    </>
                );
        }
    };

    const renderDetectorCharts = (chartIds: string[], combinedChartId: string, kind: "gamma" | "neutron") => (
        <Box>
            <Box
                data-testid={`event-${kind}-detectors-combined-container`}
                sx={{display: detectorLayout === "combined" ? "block" : "none"}}
            >
                <div id={combinedChartId} style={{height: 380}}/>
            </Box>
            <Box
                data-testid={`event-${kind}-detectors-separate-container`}
                sx={{display: detectorLayout === "separate" ? "block" : "none"}}
            >
                <Grid container spacing={2}>
                    {chartIds.map(chartId => (
                        <Grid item xs={12} md={6} key={chartId}>
                            <div id={chartId} style={{height: 360}}/>
                        </Grid>
                    ))}
                </Grid>
            </Box>
        </Box>
    );

    const locale = getIntlLocale(language);
    const exceedsSampleCapWindow = useMemo(() => {
        const startMs = Date.parse(props.eventData?.startTime ?? "");
        const endMs = Date.parse(props.eventData?.endTime ?? "");
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return false;
        return (endMs - startMs) > (EVENT_CHART_MAX_VALUES / 5) * 1000;
    }, [props.eventData?.endTime, props.eventData?.startTime]);
    const sampleCapBanner = exceedsSampleCapWindow ? (
        <Alert
            severity="info"
            role="status"
            data-testid="event-chart-sample-cap-notice"
            sx={{mb: 1, py: 0.25, "& .MuiAlert-message": {textWrap: "pretty"}}}
        >
            {t("eventChartSampleCapNotice", {
                max: EVENT_CHART_MAX_VALUES.toLocaleString(locale),
            })}
        </Alert>
    ) : null;

    const aggregateCharts = (
        <Box display='flex' flexDirection="column" alignItems="stretch">
            {!props.showDetectorModes && sampleCapBanner}
            <Grid container direction="column" spacing={2}>
                {renderChartsByStatus()}
            </Grid>
        </Box>
    );

    if (!props.showDetectorModes) return aggregateCharts;

    return (
        <Grid container spacing={2}>
            {sampleCapBanner && (
                <Grid item xs={12}>
                    {sampleCapBanner}
                </Grid>
            )}
            <Grid item xs={12}>
                <Stack
                    direction={{xs: "column", sm: "row"}}
                    spacing={1.5}
                    alignItems={{xs: "flex-start", sm: "center"}}
                    justifyContent="space-between"
                    useFlexGap
                    flexWrap="wrap"
                >
                    <ToggleButtonGroup
                        exclusive
                        value={mode}
                        onChange={(_, nextMode: ChartMode | null) => nextMode && setMode(nextMode)}
                        size="small"
                        aria-label="chart mode"
                    >
                        <ToggleButton value="total" data-testid="event-chart-mode-total">{t("chartModeTotal")}</ToggleButton>
                        {availableModes.includes("gamma") && (
                            <ToggleButton value="gamma" data-testid="event-chart-mode-gamma">{t("chartModeGammaDetectors")}</ToggleButton>
                        )}
                        {availableModes.includes("neutron") && (
                            <ToggleButton value="neutron" data-testid="event-chart-mode-neutron">{t("chartModeNeutronDetectors")}</ToggleButton>
                        )}
                    </ToggleButtonGroup>
                    {mode !== "total" && (
                        <ToggleButtonGroup
                            aria-label={t("detectorPlotLayout")}
                            exclusive
                            value={detectorLayout}
                            onChange={handleDetectorLayoutChange}
                            size="small"
                            data-testid="event-detector-layout-toggle-group"
                        >
                            <ToggleButton value="combined" data-testid="event-detector-layout-combined">
                                {t("combinedPlot")}
                            </ToggleButton>
                            <ToggleButton value="separate" data-testid="event-detector-layout-separate">
                                {t("separateAccessibilityPlots")}
                            </ToggleButton>
                        </ToggleButtonGroup>
                    )}
                </Stack>
            </Grid>
            <Grid item xs={12} sx={{position: "relative"}}>
                <Box sx={{display: mode === "total" ? "block" : "none"}}>{aggregateCharts}</Box>
                {availableModes.includes("gamma") && (
                    <Box sx={{display: mode === "gamma" ? "block" : "none"}}>
                        {renderDetectorCharts(gammaChartIds, combinedGammaDetectorChartId, "gamma")}
                    </Box>
                )}
                {availableModes.includes("neutron") && (
                    <Box sx={{display: mode === "neutron" ? "block" : "none"}}>
                        {renderDetectorCharts(neutronChartIds, combinedNeutronDetectorChartId, "neutron")}
                    </Box>
                )}
            </Grid>
        </Grid>
    );
}