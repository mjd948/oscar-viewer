"use client"

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { Box } from "@mui/material";
import Chart from "chart.js/auto";

const WINDOW_MS = 30_000;
// Render cadence — one bar per tick, regardless of how often the datasource publishes.
const TICK_MS = 200;
// If no new reading arrives within this window, render gaps so a stale feed is visible.
// 15s = 3× the 5s background publish cadence, so a single missed publish doesn't trigger it.
const STALE_MS = 15_000;
// 30_000 / 200 = 150. Fixed bar count → constant bar thickness via Chart.js category scale.
const MAX_POINTS = WINDOW_MS / TICK_MS;

/** hh:mm:ss for the category axis. Hoisted: called once per tick, per chart. */
function clockLabel(ms: number): string {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

/** Imperative feed for the scrolling chart: push readings from any source. */
export interface ScrollingChartHandle {
    pushValue: (value: number) => void;
    setThreshold: (value: number) => void;
}

interface ScrollingBarChartCoreProps {
    title: string;
    barColor: string;
    showThreshold?: boolean;
    height?: number | string;
    /**
     * Draw the title inside the canvas. Off for widget-hosted charts, where the
     * widget frame already shows a title and the canvas is the scarce space.
     * The title still labels the dataset in the legend either way.
     */
    showTitle?: boolean;
}

/**
 * Chart rendering + fixed-cadence tick, decoupled from data delivery.
 * Values arrive through the imperative handle, so any registry-fed
 * consumer can drive the chart without owning its render cadence.
 */
export const ScrollingBarChartCore = forwardRef<ScrollingChartHandle, ScrollingBarChartCoreProps>(
    function ScrollingBarChartCore({ title, barColor, showThreshold = false, height = 250, showTitle = true }, ref) {
        const canvasRef = useRef<HTMLCanvasElement>(null);
        const chartRef = useRef<Chart | null>(null);
        // Rolling window kept as the two arrays Chart.js actually reads, pushed
        // and shifted in place by the tick. They used to be rebuilt wholesale
        // every 200ms — 150 Date objects and three fresh arrays per chart, five
        // times a second — to add exactly one sample.
        const labelsRef = useRef<string[]>([]);
        const valuesRef = useRef<(number | null)[]>([]);
        // The threshold is drawn as a flat line at the CURRENT value across the
        // window, not a per-sample history, so this only has to be rebuilt when
        // the value changes or the window is still filling.
        const thresholdSeriesRef = useRef<number[]>([]);
        const thresholdSeriesValueRef = useRef<number | null>(null);
        const thresholdRef = useRef<number | null>(null);
        // Latest reading from the datasource (carry-forward source for the timer tick).
        const lastValueRef = useRef<number | null>(null);
        // Wall-clock time of the most recent reading; used to detect stale feeds.
        const lastUpdateRef = useRef<number>(0);
        // Don't begin pushing bars until the first real reading arrives, so we
        // don't pre-fill the chart with a misleading row of zeros.
        const startedRef = useRef<boolean>(false);
        // Timer effect calls renderChartRef.current() so it doesn't need to restart
        // when the renderChart callback identity changes.
        const renderChartRef = useRef<() => void>(() => {});

        useImperativeHandle(ref, () => ({
            pushValue: (value: number) => {
                lastValueRef.current = value;
                lastUpdateRef.current = Date.now();
                startedRef.current = true;
            },
            setThreshold: (value: number) => {
                thresholdRef.current = value;
            },
        }), []);

        // Create chart on mount, destroy on unmount
        useEffect(() => {
            if (!canvasRef.current) return;

            chartRef.current = new Chart(canvasRef.current, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [
                        {
                            type: 'bar',
                            label: title,
                            data: [],
                            backgroundColor: barColor + '99',
                            borderColor: barColor,
                            borderWidth: 1,
                            order: 2,
                            barPercentage: 0.9,
                            categoryPercentage: 1.0,
                        } as any,
                        {
                            type: 'line',
                            label: 'Threshold',
                            data: [],
                            borderColor: '#ff9800',
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            pointRadius: 0,
                            stepped: true,
                            order: 1,
                        } as any,
                    ],
                },
                options: {
                    animation: false,
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: showTitle,
                            text: title,
                            font: { size: 14, weight: 'bold' },
                        },
                        legend: { display: true, position: 'bottom' },
                    },
                    scales: {
                        x: {
                            title: { display: true, text: 'Time' },
                            ticks: { maxTicksLimit: 6, maxRotation: 0 },
                        },
                        y: {
                            title: { display: true, text: 'CPS' },
                            beginAtZero: true,
                        },
                    },
                },
            });

            return () => {
                chartRef.current?.destroy();
                chartRef.current = null;
            };
        }, []);

        // Chart config is baked at creation; apply in-place title changes
        // (e.g. language switch) without recreating the instance.
        useEffect(() => {
            const chart = chartRef.current;
            if (!chart) return;
            if (chart.options.plugins?.title) chart.options.plugins.title.text = title;
            chart.data.datasets[0].label = title;
            chart.update('none');
        }, [title]);

        const renderChart = useCallback(() => {
            const chart = chartRef.current;
            if (!chart) return;

            const series = thresholdSeriesRef.current;
            const threshold = thresholdRef.current;
            if (showThreshold && threshold != null) {
                const want = valuesRef.current.length;
                if (thresholdSeriesValueRef.current !== threshold) {
                    series.length = 0;
                    thresholdSeriesValueRef.current = threshold;
                }
                while (series.length < want) series.push(threshold);
                while (series.length > want) series.shift();
            } else if (series.length > 0) {
                series.length = 0;
                thresholdSeriesValueRef.current = null;
            }

            // Same array identities every tick; Chart.js re-reads their contents
            // on update, so there is nothing to reassign.
            chart.data.labels = labelsRef.current;
            chart.data.datasets[0].data = valuesRef.current;
            chart.data.datasets[1].data = series;

            chart.update('none');
        }, [showThreshold]);

        // Keep the timer's renderChart reference fresh without restarting the interval
        // when renderChart's identity changes (it depends on showThreshold).
        useEffect(() => {
            renderChartRef.current = renderChart;
        }, [renderChart]);

        // Fixed-cadence renderer: one bar per TICK_MS, regardless of publish rate.
        // Note: when the tab is hidden, browsers throttle setInterval to ~1Hz, so the
        // buffer will refill over ~30s when the user refocuses. Acceptable here.
        useEffect(() => {
            const id = setInterval(() => {
                // Don't push placeholder bars before any real data has arrived.
                if (!startedRef.current) return;

                const now = Date.now();
                const stale = now - lastUpdateRef.current > STALE_MS;
                // Carry the last value forward; render a gap (null) once stale so a
                // dropped feed is visually obvious instead of silently held forever.
                const value = stale ? null : lastValueRef.current;

                labelsRef.current.push(clockLabel(now));
                valuesRef.current.push(value);
                while (valuesRef.current.length > MAX_POINTS) {
                    labelsRef.current.shift();
                    valuesRef.current.shift();
                }

                renderChartRef.current();
            }, TICK_MS);

            return () => clearInterval(id);
        }, []);

        return (
            <Box sx={{ height: height, position: 'relative', width: '100%' }}>
                <canvas ref={canvasRef} />
            </Box>
        );
    });

