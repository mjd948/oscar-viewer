"use client";

import {Grid, Stack, ToggleButton, ToggleButtonGroup, Typography} from "@mui/material";
import ConSysApi from "osh-js/source/core/datasource/consysapi/ConSysApi.datasource";
import React, {useEffect, useRef, useState} from "react";
import ChartJsView from "osh-js/source/core/ui/view/chart/ChartJsView";
import {
    createGammaDetectorViewCurves,
    createGammaViewCurve,
    createNeutronDetectorViewCurves,
    createNeutronViewCurve,
    createThresholdViewCurve,
    destroyChartView,
    DETECTOR_DATASET_OPTIONS,
    type DetectorPlotLayout,
    getStoredDetectorPlotLayout,
    LIVE_CHART_MAX_VALUES,
    patchChartViewMultiCurveSync,
    setStoredDetectorPlotLayout,
    sortTooltipByHighestCps,
} from "@/app/utils/ChartUtils";
import {useLanguage} from '@/app/contexts/LanguageContext';

export class ChartInterceptProps {
    laneName: string;
    datasources: {
        gamma: typeof ConSysApi,
        neutron: typeof ConSysApi,
        threshold: typeof ConSysApi
    };
    setChartReady: (ready: boolean) => void;
}
type ChartMode = 'total' | 'gamma' | 'neutron';

const neutronDetectorChartIds = [
    "neutron-detector-1",
    "neutron-detector-2",
    "neutron-detector-3",
    "neutron-detector-4",
];

const gammaDetectorChartIds = [
    "gamma-detector-1",
    "gamma-detector-2",
    "gamma-detector-3",
    "gamma-detector-4",
];
const combinedGammaChartID = "gamma-detectors-combined";
const combinedNeutronChartID = "neutron-detectors-combined";
const gammaChartID = "chart-view-gamma";
const neutronChartID = "chart-view-neutron";

export default function ChartLane({laneName, datasources, setChartReady}: ChartInterceptProps) {
    const {t} = useLanguage();

    const [mode, setMode] = useState<ChartMode>('total');
    const [detectorLayout, setDetectorLayout] = useState<DetectorPlotLayout>(() => getStoredDetectorPlotLayout());
    const chartViewsRef = useRef<any[]>([]);

    const createOptions = (title: string, isCombinedDetectorPlot = false) => ({
        ...(isCombinedDetectorPlot
            ? {
                interaction: {
                    mode: 'index' as const,
                    intersect: false,
                },
            }
            : {}),
        plugins: {
            title: {
                display: true,
                text: title,
                font: {size: 14, weight: 'bold' as const},
                align: 'center' as const,
                position: 'top' as const,
            },
            legend: {display: true, align: 'center' as const, position: 'bottom' as const},
            ...(isCombinedDetectorPlot
                ? {
                    tooltip: {
                        itemSort: sortTooltipByHighestCps,
                    },
                }
                : {}),
        },
        responsive: true,
        scales: {
            x: {
                title: {
                    display: true,
                    text: t('time'),
                    padding: 5
                },
                type: 'time'
            },
            y: {
                title: {
                    display: true,
                    text: 'CPS'
                },
                display: true,
                position: 'left' as const,
                grid: {
                    beginAtZero: false
                },
            },
        },
    });

    useEffect(() => {
        const labels = { time: t('time'), gamma: t('gamma'), neutron: t('neutron'), threshold: t('threshold') };
        const views: any[] = [];

        const addChart = (
            container: string,
            layers: any[],
            title: string,
            isCombinedDetectorPlot = false,
            useCleanDetectorLines = false,
        ) => {
            if (layers.length === 0 || !document.getElementById(container)) return;

            const view = new ChartJsView({
                type: 'line',
                container,
                layers,
                css: 'chart-view',
                destroyAfterMutation: false,
                refreshRate: 0,
                ...(useCleanDetectorLines ? {datasetOptions: DETECTOR_DATASET_OPTIONS} : {}),
                options: createOptions(title, isCombinedDetectorPlot),
            });
            patchChartViewMultiCurveSync(view, false);
            views.push(view);
        };

        if (mode === 'total') {
            const gammaLayers = [
                createGammaViewCurve(datasources.gamma, labels, LIVE_CHART_MAX_VALUES),
                createThresholdViewCurve(datasources.threshold, labels, LIVE_CHART_MAX_VALUES),
            ].filter(Boolean);
            const neutronLayers = [createNeutronViewCurve(datasources.neutron, labels, LIVE_CHART_MAX_VALUES)].filter(Boolean);

            addChart(gammaChartID, gammaLayers, t('gammaChart'));
            addChart(neutronChartID, neutronLayers, t('neutronChart'));
        } else {
            const curves = mode === 'gamma'
                ? createGammaDetectorViewCurves(datasources.gamma, labels, LIVE_CHART_MAX_VALUES)
                : createNeutronDetectorViewCurves(datasources.neutron, labels, LIVE_CHART_MAX_VALUES);

            if (detectorLayout === 'combined') {
                const combinedContainerId = mode === 'gamma'
                    ? combinedGammaChartID
                    : combinedNeutronChartID;
                const combinedTitle = mode === 'gamma'
                    ? t('chartModeGammaDetectors')
                    : t('chartModeNeutronDetectors');
                addChart(combinedContainerId, curves, combinedTitle, true, true);
            } else {
                const chartLabel = t('detector');
                const chartIds = mode === 'gamma'
                    ? gammaDetectorChartIds
                    : neutronDetectorChartIds;

                curves.forEach((curve, index) => {
                    addChart(chartIds[index], [curve], `${chartLabel} ${index + 1}`, false, true);
                });
            }
        }

        chartViewsRef.current = views;
        return () => {
            views.forEach(destroyChartView);
            chartViewsRef.current = [];
        };
    }, [datasources.gamma, datasources.neutron, datasources.threshold, detectorLayout, laneName, mode, t]);

    useEffect(() => {
        const ready = Boolean(datasources.gamma || datasources.neutron);
        setChartReady(ready);

        return () => setChartReady(false);
    }, [datasources.gamma, datasources.neutron, setChartReady]);

    const handleToggle = (event: React.MouseEvent<HTMLElement>, newView: ChartMode | null) => {
        if (newView) setMode(newView);
    };

    const handleDetectorLayoutChange = (
        event: React.MouseEvent<HTMLElement>,
        nextLayout: DetectorPlotLayout | null,
    ) => {
        if (!nextLayout) return;
        setDetectorLayout(nextLayout);
        setStoredDetectorPlotLayout(nextLayout);
    };

    const renderToggleButtons = () => (
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
                    aria-label="chart mode"
                    exclusive
                    onChange={handleToggle}
                    size="small"
                    value={mode}
                >
                    <ToggleButton value="total" data-testid="lane-chart-mode-total">
                        {t('chartModeTotal')}
                    </ToggleButton>
                    <ToggleButton value="gamma" data-testid="lane-chart-mode-gamma">
                        {t('chartModeGammaDetectors')}
                    </ToggleButton>
                    <ToggleButton value="neutron" data-testid="lane-chart-mode-neutron">
                        {t('chartModeNeutronDetectors')}
                    </ToggleButton>
                </ToggleButtonGroup>
                {mode !== 'total' && (
                    <ToggleButtonGroup
                        aria-label={t('detectorPlotLayout')}
                        exclusive
                        onChange={handleDetectorLayoutChange}
                        size="small"
                        value={detectorLayout}
                        data-testid="lane-detector-layout-toggle-group"
                    >
                        <ToggleButton value="combined" data-testid="lane-detector-layout-combined">
                            {t('combinedPlot')}
                        </ToggleButton>
                        <ToggleButton value="separate" data-testid="lane-detector-layout-separate">
                            {t('separateAccessibilityPlots')}
                        </ToggleButton>
                    </ToggleButtonGroup>
                )}
            </Stack>
        </Grid>
    );

    const renderTotalCharts = () => (
        <Grid container xs={12}>
            <Grid item xs={12} md={6}>
                <div
                    id={gammaChartID}
                    style={{
                        marginBottom: 25,
                        height: '360px'
                    }}
                />
            </Grid>
            <Grid item xs={12} md={6}>
                <div
                    id={neutronChartID}
                    style={{
                        marginBottom: 25,
                        height: '360px'
                    }}
                />
            </Grid>
        </Grid>
    );

    const renderDetectorCharts = (activeMode: Exclude<ChartMode, 'total'>) => {
        if (detectorLayout === 'combined') {
            const combinedChartId = activeMode === 'gamma'
                ? combinedGammaChartID
                : combinedNeutronChartID;

            return (
                <Grid container spacing={2} xs={12}>
                    <Grid item xs={12}>
                        <div
                            id={combinedChartId}
                            data-testid={`lane-${activeMode}-detectors-combined`}
                            style={{height: '380px'}}
                        />
                    </Grid>
                </Grid>
            );
        }

        const chartIds = activeMode === 'gamma'
            ? gammaDetectorChartIds
            : neutronDetectorChartIds;

        return (
            <Grid container spacing={2} xs={12} data-testid={`lane-${activeMode}-detectors-separate`}>
                {chartIds.map(chartId => (
                    <Grid item xs={12} md={6} key={chartId}>
                        <div id={chartId} style={{height: '360px'}}/>
                    </Grid>
                ))}
            </Grid>
        );
    };

    const renderChartsByMode = () => {
        switch (mode) {
            case "total":
                return (
                    <>
                        {renderToggleButtons()}
                        {renderTotalCharts()}
                    </>
                );
            case "gamma":
                return (
                    <>
                        {renderToggleButtons()}
                        {renderDetectorCharts("gamma")}
                    </>
                );

            case "neutron":
                return (
                    <>
                        {renderToggleButtons()}
                        {renderDetectorCharts("neutron")}
                    </>
                );

        }
    }

    return (
        <Grid container spacing={2} alignItems="center">
            {renderChartsByMode()}
            <Grid item xs={12}>
                <Typography
                    variant="caption"
                    color="text.secondary"
                    data-testid="live-chart-window-note"
                    sx={{display: "block", px: 1, textWrap: "pretty"}}
                >
                    {t('liveChartRollingWindowNotice', {max: LIVE_CHART_MAX_VALUES})}
                </Typography>
            </Grid>
        </Grid>
    );
}
