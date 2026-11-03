/**
 * #############################################################################
 * # web::src::components::charts::ThreadScalingChart.tsx
 * #
 * # Created: October 2026
 * # Last Modified: October 2026
 * #
 * # This file is part of the Test Automation Framework (TAF).
 * # Copyright (c) 2025-2026 MariaDB Foundation, Jonathan "jeb" Miller and Gerardo Fontes
 * #
 * # This program is free software; you can redistribute it and/or modify
 * # it under the terms of the GNU General Public License as published by
 * # the Free Software Foundation; version 2 or later of the License.
 * #
 * # This program is distributed in the hope that it will be useful,
 * # but WITHOUT ANY WARRANTY; without even the implied warranty of
 * # MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * # GNU General Public License for more details.
 * #
 * # You should have received a copy of the GNU General Public License
 * # along with this program; if not, write to the Free Software
 * # Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1335
 * #
 * # Licensed under the GNU General Public License, version 2 or later (GPLv2+).
 * # See https://www.gnu.org/licenses/ for details.
 * #
 * # PURPOSE:
 * # Comprehensive thread-scaling visualization comparing baseline vs candidate runs.
 * # Features log2 thread spacing, d3-scale linear/log Y-axes, d3-shape line & area
 * # path generators, iteration variance bands, direction-gated threshold regions,
 * # small-multiples grid view, and WCAG-accessible data table fallbacks.
 * #############################################################################
 */

'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { scaleLinear, scaleLog } from 'd3-scale';
import { line, area } from 'd3-shape';
import type { ComparisonDeltaRow, Thresholds } from '@/lib/domain/types';
import {
  CHART_SERIES,
  STATUS_BAND_TOKENS,
  formatMetricNumber,
  formatDeltaPct,
} from '@/lib/charts/theme';
import { ChartDataTable } from './ChartDataTable';
import { MultiMetricGrid } from './MultiMetricGrid';

export type MetricDirection = 'none' | 'higher' | 'lower';

export interface ThreadScalingChartProps {
  rows: ComparisonDeltaRow[];
  thresholds: Thresholds;
  baselineName: string;
  candidateName: string;
  threadOfMaxChange: number;
}

export function ThreadScalingChart({
  rows,
  thresholds,
  baselineName,
  candidateName,
  threadOfMaxChange,
}: ThreadScalingChartProps) {
  // 1. Extract distinct metric names
  const metrics = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.metricName);
    return Array.from(set);
  }, [rows]);

  // Selected metric state (defaults to primary throughput metrics if present)
  const [selectedMetric, setSelectedMetric] = useState<string>(() => {
    if (metrics.includes('tpmC')) return 'tpmC';
    if (metrics.includes('TPS')) return 'TPS';
    if (metrics.includes('QPS')) return 'QPS';
    return metrics[0] || '';
  });

  const activeMetric = metrics.includes(selectedMetric) ? selectedMetric : metrics[0] || '';

  // View Mode: 'detail' (single metric) or 'grid' (small multiples)
  const [viewMode, setViewMode] = useState<'detail' | 'grid'>('detail');

  // Y-Axis scale type: 'linear' or 'log'
  const [yAxisType, setYAxisType] = useState<'linear' | 'log'>('linear');

  // Accessible Data Table expansion state
  const [showDataTable, setShowDataTable] = useState(false);

  // Direction control per metric (stored in localStorage)
  const [metricDirection, setMetricDirection] = useState<MetricDirection>('none');

  // Read saved direction from localStorage when active metric changes
  useEffect(() => {
    if (typeof window !== 'undefined' && activeMetric) {
      const saved = localStorage.getItem(`taf_metric_dir_${activeMetric}`);
      if (saved === 'higher' || saved === 'lower' || saved === 'none') {
        setMetricDirection(saved);
      } else {
        setMetricDirection('none');
      }
    }
  }, [activeMetric]);

  const handleDirectionChange = useCallback(
    (dir: MetricDirection) => {
      setMetricDirection(dir);
      if (typeof window !== 'undefined' && activeMetric) {
        localStorage.setItem(`taf_metric_dir_${activeMetric}`, dir);
      }
    },
    [activeMetric]
  );

  // Filter and sort points for active metric
  const metricPoints = useMemo(() => {
    return rows
      .filter((r) => r.metricName === activeMetric)
      .sort((a, b) => a.threads - b.threads);
  }, [rows, activeMetric]);

  const unit = metricPoints[0]?.metricUnit || '';

  // Thread counts
  const threads = useMemo(() => metricPoints.map((p) => p.threads), [metricPoints]);

  // SVG Chart Layout Geometry
  const width = 800;
  const height = 360;
  const padding = { top: 35, right: 40, bottom: 50, left: 75 };

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Log2 thread spacing mapping
  const { minLog, maxLog } = useMemo(() => {
    if (threads.length === 0) return { minLog: 0, maxLog: 1 };
    return {
      minLog: Math.log2(threads[0]),
      maxLog: Math.log2(threads[threads.length - 1]),
    };
  }, [threads]);

  const getX = useCallback(
    (threadCount: number) => {
      const range = maxLog - minLog;
      if (range === 0 || threads.length <= 1) return padding.left + innerWidth / 2;
      const fraction = (Math.log2(threadCount) - minLog) / range;
      return padding.left + fraction * innerWidth;
    },
    [minLog, maxLog, innerWidth, padding.left, threads.length]
  );

  // Compute Y Min and Max
  const { minY, maxY, yMinPositive } = useMemo(() => {
    if (metricPoints.length === 0) return { minY: 0, maxY: 100, yMinPositive: 1 };

    let min = Infinity;
    let max = -Infinity;
    let minPos = Infinity;

    for (const p of metricPoints) {
      const bMin = p.baselineMin ?? p.baselineValue;
      const cMin = p.candidateMin ?? p.candidateValue;
      const bMax = p.baselineMax ?? p.baselineValue;
      const cMax = p.candidateMax ?? p.candidateValue;

      min = Math.min(min, bMin, cMin);
      max = Math.max(max, bMax, cMax);

      if (bMin > 0) minPos = Math.min(minPos, bMin);
      if (cMin > 0) minPos = Math.min(minPos, cMin);
    }

    if (!isFinite(min) || !isFinite(max)) {
      min = 0;
      max = 100;
    }

    const resolvedMinPos = isFinite(minPos) ? minPos : 1;
    return { minY: min, maxY: max, yMinPositive: resolvedMinPos };
  }, [metricPoints]);

  // Y Scale (Linear vs Log) using d3-scale
  const { yScale, yTicks } = useMemo(() => {
    const bottom = padding.top + innerHeight;
    const top = padding.top;

    if (yAxisType === 'log' && yMinPositive > 0) {
      const domainMin = Math.max(1e-2, yMinPositive * 0.8);
      const domainMax = maxY > domainMin ? maxY * 1.25 : domainMin * 10;
      const scale = scaleLog().domain([domainMin, domainMax]).range([bottom, top]).nice();
      const ticks = scale.ticks(5);
      return { yScale: scale, yTicks: ticks.length > 0 ? ticks : [domainMin, domainMax] };
    }

    // Default Linear scale
    const domainMin = minY > 0 ? 0 : minY * 1.1;
    const domainMax = maxY > 0 ? maxY * 1.15 : 100;
    const scale = scaleLinear().domain([domainMin, domainMax]).range([bottom, top]).nice();
    const ticks = scale.ticks(5);
    return { yScale: scale, yTicks: ticks };
  }, [yAxisType, minY, maxY, yMinPositive, innerHeight, padding.top]);

  // SVG Paths generated with d3-shape
  const baselinePath = useMemo(() => {
    if (metricPoints.length === 0) return '';
    const lineGen = line<ComparisonDeltaRow>()
      .x((d) => getX(d.threads))
      .y((d) => yScale(d.baselineValue));
    return lineGen(metricPoints) || '';
  }, [metricPoints, getX, yScale]);

  const candidatePath = useMemo(() => {
    if (metricPoints.length === 0) return '';
    const lineGen = line<ComparisonDeltaRow>()
      .x((d) => getX(d.threads))
      .y((d) => yScale(d.candidateValue));
    return lineGen(metricPoints) || '';
  }, [metricPoints, getX, yScale]);

  // Iteration Variance Areas (d3-shape area generator)
  const baselineVarianceArea = useMemo(() => {
    if (metricPoints.length === 0) return '';
    const areaGen = area<ComparisonDeltaRow>()
      .x((d) => getX(d.threads))
      .y0((d) => yScale(d.baselineMin ?? d.baselineValue))
      .y1((d) => yScale(d.baselineMax ?? d.baselineValue));
    return areaGen(metricPoints) || '';
  }, [metricPoints, getX, yScale]);

  const candidateVarianceArea = useMemo(() => {
    if (metricPoints.length === 0) return '';
    const areaGen = area<ComparisonDeltaRow>()
      .x((d) => getX(d.threads))
      .y0((d) => yScale(d.candidateMin ?? d.candidateValue))
      .y1((d) => yScale(d.candidateMax ?? d.candidateValue));
    return areaGen(metricPoints) || '';
  }, [metricPoints, getX, yScale]);

  // Baseline Under-curve Shaded Fill
  const baselineUnderCurveArea = useMemo(() => {
    if (metricPoints.length === 0) return '';
    const bottom = padding.top + innerHeight;
    const areaGen = area<ComparisonDeltaRow>()
      .x((d) => getX(d.threads))
      .y0(() => bottom)
      .y1((d) => yScale(d.baselineValue));
    return areaGen(metricPoints) || '';
  }, [metricPoints, getX, yScale, innerHeight, padding.top]);

  // D3-Shape Threshold Bands (Rendered ONLY when metricDirection is known)
  const thresholdBands = useMemo(() => {
    if (metricDirection === 'none' || metricPoints.length === 0) return null;

    const chartTop = padding.top;
    const chartBottom = padding.top + innerHeight;

    if (metricDirection === 'higher') {
      // GAIN: Candidate is above baseline * (1 + pctGain/100)
      const gainArea = area<ComparisonDeltaRow>()
        .x((d) => getX(d.threads))
        .y0((d) => yScale(d.baselineValue * (1 + thresholds.pctGain / 100)))
        .y1(() => chartTop)(metricPoints);

      // WARNING: Candidate is between baseline * (1 - pctFail/100) and baseline * (1 - pctWarning/100)
      const warnArea = area<ComparisonDeltaRow>()
        .x((d) => getX(d.threads))
        .y0((d) => yScale(d.baselineValue * (1 - thresholds.pctFail / 100)))
        .y1((d) => yScale(d.baselineValue * (1 - thresholds.pctWarning / 100)))(metricPoints);

      // REGRESSED: Candidate is below baseline * (1 - pctFail/100)
      const regressedArea = area<ComparisonDeltaRow>()
        .x((d) => getX(d.threads))
        .y0(() => chartBottom)
        .y1((d) => yScale(d.baselineValue * (1 - thresholds.pctFail / 100)))(metricPoints);

      return { gainArea, warnArea, regressedArea };
    } else {
      // Lower is better (latency/cost)
      // GAIN: Candidate is below baseline * (1 - pctGain/100)
      const gainArea = area<ComparisonDeltaRow>()
        .x((d) => getX(d.threads))
        .y0(() => chartBottom)
        .y1((d) => yScale(d.baselineValue * (1 - thresholds.pctGain / 100)))(metricPoints);

      // WARNING: Candidate is between baseline * (1 + pctWarning/100) and baseline * (1 + pctFail/100)
      const warnArea = area<ComparisonDeltaRow>()
        .x((d) => getX(d.threads))
        .y0((d) => yScale(d.baselineValue * (1 + thresholds.pctWarning / 100)))
        .y1((d) => yScale(d.baselineValue * (1 + thresholds.pctFail / 100)))(metricPoints);

      // REGRESSED: Candidate is above baseline * (1 + pctFail/100)
      const regressedArea = area<ComparisonDeltaRow>()
        .x((d) => getX(d.threads))
        .y0((d) => yScale(d.baselineValue * (1 + thresholds.pctFail / 100)))
        .y1(() => chartTop)(metricPoints);

      return { gainArea, warnArea, regressedArea };
    }
  }, [metricDirection, metricPoints, thresholds, getX, yScale, innerHeight, padding.top]);

  // Hover state for interactive tooltips
  const [hoveredThread, setHoveredThread] = useState<number | null>(null);

  const hoveredPoint = useMemo(() => {
    if (!hoveredThread) return null;
    return metricPoints.find((p) => p.threads === hoveredThread) || null;
  }, [hoveredThread, metricPoints]);

  // Max Delta Point for summary
  const maxDeltaPoint = useMemo(() => {
    if (metricPoints.length === 0) return null;
    return metricPoints.find((p) => p.threads === threadOfMaxChange) || metricPoints[0];
  }, [metricPoints, threadOfMaxChange]);

  // Accessible Chart ARIA Summary (WCAG requirement)
  const accessibleSummary = useMemo(() => {
    if (metricPoints.length === 0) return 'No metric points available';
    const firstP = metricPoints[0];
    const lastP = metricPoints[metricPoints.length - 1];
    const maxP = maxDeltaPoint || lastP;

    return `Thread scaling for metric ${activeMetric} (${unit || 'units'}): baseline scales from ${formatMetricNumber(
      firstP.baselineValue
    )} at ${firstP.threads} threads to ${formatMetricNumber(
      lastP.baselineValue
    )} at ${lastP.threads} threads. Candidate is ${formatDeltaPct(
      lastP.changePct
    )} at ${lastP.threads} threads. Maximum change of ${formatDeltaPct(
      maxP.changePct
    )} occurred at ${maxP.threads} threads.`;
  }, [metricPoints, activeMetric, unit, maxDeltaPoint]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur shadow-xl space-y-5">
      {/* Chart Control Bar: Title, Metric Picker, Mode Toggle, and Axis Toggle */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              Thread-Scaling Performance Curves
            </h3>
            <span className="rounded-md bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 text-[11px] font-mono text-blue-300">
              log₂ threads
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Overlaid baseline vs candidate throughput across concurrent thread workloads with iteration variance bands.
          </p>
        </div>

        {/* View Controls & Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle (Single Detail vs Small Multiples) */}
          {metrics.length > 1 && (
            <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setViewMode('detail')}
                className={`rounded-md px-2.5 py-1 transition-all ${
                  viewMode === 'detail'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Detail View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`rounded-md px-2.5 py-1 transition-all ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Small Multiples ({Math.min(metrics.length, 8)})
              </button>
            </div>
          )}

          {/* Y-Axis Linear / Log Toggle (only in detail mode) */}
          {viewMode === 'detail' && (
            <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setYAxisType('linear')}
                className={`rounded-md px-2 py-1 transition-all ${
                  yAxisType === 'linear'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Linear Y
              </button>
              <button
                type="button"
                onClick={() => setYAxisType('log')}
                className={`rounded-md px-2 py-1 transition-all ${
                  yAxisType === 'log'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Log Y
              </button>
            </div>
          )}

          {/* Data Table Alternative Toggle */}
          <button
            type="button"
            onClick={() => setShowDataTable((prev) => !prev)}
            aria-expanded={showDataTable}
            className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
              showDataTable
                ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300'
                : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
            }`}
          >
            {showDataTable ? 'Hide Data Table' : '📊 View Data Table'}
          </button>
        </div>
      </div>

      {/* Metric Selector Pills (if in detail mode and multiple metrics exist) */}
      {viewMode === 'detail' && metrics.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono">
          <span className="text-[11px] font-sans text-slate-400 shrink-0 mr-1">Metric:</span>
          {metrics.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setSelectedMetric(m)}
              className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                activeMetric === m
                  ? 'bg-blue-600/90 border-blue-500 text-white shadow-sm shadow-blue-500/20'
                  : 'border-slate-800 bg-slate-950/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {/* Small Multiples Grid Mode */}
      {viewMode === 'grid' && (
        <MultiMetricGrid
          rows={rows}
          metrics={metrics}
          selectedMetric={activeMetric}
          onSelectMetric={(m) => {
            setSelectedMetric(m);
            setViewMode('detail');
          }}
          threadOfMaxChange={threadOfMaxChange}
        />
      )}

      {/* Single Detail Chart View */}
      {viewMode === 'detail' && (
        <>
          {/* Legend and Metric Direction Policy Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
            {/* Visual Legend (Greyscale Accessible) */}
            <div className="flex flex-wrap items-center gap-5">
              {/* Baseline */}
              <div className="flex items-center gap-2">
                <span className="flex items-center">
                  <span className="w-4 h-0.5 bg-blue-500 rounded" />
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 -ml-1 border border-slate-900" />
                </span>
                <span className="text-slate-300 font-medium">
                  Baseline (solid):{' '}
                  <span className="text-slate-400 font-mono text-[11px] truncate max-w-[140px] inline-block align-bottom">
                    {baselineName}
                  </span>
                </span>
              </div>

              {/* Candidate */}
              <div className="flex items-center gap-2">
                <span className="flex items-center">
                  <span className="w-4 h-0.5 border-t-2 border-dashed border-purple-400" />
                  <span className="w-2.5 h-2.5 rounded-sm bg-purple-400 -ml-1 border border-slate-900 rotate-45" />
                </span>
                <span className="text-slate-300 font-medium">
                  Candidate (dashed):{' '}
                  <span className="text-slate-400 font-mono text-[11px] truncate max-w-[140px] inline-block align-bottom">
                    {candidateName}
                  </span>
                </span>
              </div>

              {/* Iteration Variance */}
              <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                <span className="w-3.5 h-3 rounded bg-blue-500/20 border border-blue-500/40" />
                <span>Iteration Variance [Min, Max]</span>
              </div>

              {/* Max Delta Line */}
              {threadOfMaxChange > 0 && (
                <div className="hidden sm:flex items-center gap-2">
                  <span className="w-4 h-0.5 border-t border-dashed border-amber-400" />
                  <span className="text-slate-400 text-[11px]">
                    Max Delta ({threadOfMaxChange}t)
                  </span>
                </div>
              )}
            </div>

            {/* Metric Direction Selector (Gating Threshold Bands) */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Direction:</span>
              <select
                value={metricDirection}
                onChange={(e) => handleDirectionChange(e.target.value as MetricDirection)}
                className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-xs font-medium text-slate-200 focus:border-blue-500 focus:outline-none"
                aria-label="Select metric direction for threshold band rendering"
              >
                <option value="none">No bands (raw data)</option>
                <option value="higher">Higher is better (throughput)</option>
                <option value="lower">Lower is better (latency/cost)</option>
              </select>
            </div>
          </div>

          {/* Metric Direction Notice when 'none' */}
          {metricDirection === 'none' && (
            <div className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">ℹ️</span>
                <span>
                  Threshold bands (GAIN / WARNING / REGRESSED) are hidden because TAF schema lacks direction metadata.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDirectionChange('higher')}
                  className="text-[11px] text-blue-400 hover:text-blue-300 underline font-medium"
                >
                  Enable (Higher is better)
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={() => handleDirectionChange('lower')}
                  className="text-[11px] text-blue-400 hover:text-blue-300 underline font-medium"
                >
                  Enable (Lower is better)
                </button>
              </div>
            </div>
          )}

          {/* Active Threshold Bands Legend if enabled */}
          {metricDirection !== 'none' && (
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 bg-slate-950/50 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-300 font-semibold">Active Threshold Bands:</span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2 rounded bg-emerald-500/25 border border-emerald-500/50" />
                <span className="text-emerald-400 font-mono">GAIN (+{thresholds.pctGain}%)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2 rounded bg-amber-500/25 border border-amber-500/50" />
                <span className="text-amber-400 font-mono">WARNING (-{thresholds.pctWarning}%)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2 rounded bg-rose-500/25 border border-rose-500/50" />
                <span className="text-rose-400 font-mono">REGRESSED (-{thresholds.pctFail}%)</span>
              </span>
            </div>
          )}

          {/* Primary SVG Chart Canvas */}
          <div className="relative w-full overflow-hidden min-h-[360px]">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto select-none overflow-visible"
              role="img"
              aria-label={accessibleSummary}
            >
              <defs>
                <linearGradient id="chartBaselineAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* D3-Shape Threshold Bands (Background) */}
              {thresholdBands && (
                <g className="threshold-bands">
                  {thresholdBands.gainArea && (
                    <path
                      d={thresholdBands.gainArea}
                      fill={STATUS_BAND_TOKENS.GAIN.fill}
                      stroke="none"
                    />
                  )}
                  {thresholdBands.warnArea && (
                    <path
                      d={thresholdBands.warnArea}
                      fill={STATUS_BAND_TOKENS.WARNING.fill}
                      stroke="none"
                    />
                  )}
                  {thresholdBands.regressedArea && (
                    <path
                      d={thresholdBands.regressedArea}
                      fill={STATUS_BAND_TOKENS.REGRESSED.fill}
                      stroke="none"
                    />
                  )}
                </g>
              )}

              {/* Horizontal Y Grid Lines & Ticks */}
              {yTicks.map((tick, i) => {
                const y = yScale(tick);
                return (
                  <g key={i}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={width - padding.right}
                      y2={y}
                      stroke="#334155"
                      strokeWidth="1"
                      strokeDasharray={i === 0 ? 'none' : '3 3'}
                      strokeOpacity={i === 0 ? 0.7 : 0.35}
                    />
                    <text
                      x={padding.left - 10}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-500 font-mono text-[10px]"
                    >
                      {formatMetricNumber(tick)}
                    </text>
                  </g>
                );
              })}

              {/* Vertical Thread Grid Lines & Log2 Ticks */}
              {threads.map((t) => {
                const x = getX(t);
                const isMax = t === threadOfMaxChange;
                return (
                  <g key={t}>
                    <line
                      x1={x}
                      y1={padding.top}
                      x2={x}
                      y2={padding.top + innerHeight}
                      stroke={isMax ? '#f59e0b' : '#334155'}
                      strokeWidth={isMax ? '1.5' : '1'}
                      strokeDasharray={isMax ? '4 4' : '2 4'}
                      strokeOpacity={isMax ? 0.8 : 0.25}
                    />
                    <text
                      x={x}
                      y={padding.top + innerHeight + 20}
                      textAnchor="middle"
                      className={`font-mono text-[11px] font-medium ${
                        isMax ? 'fill-amber-400 font-bold' : 'fill-slate-400'
                      }`}
                    >
                      {t}
                    </text>
                  </g>
                );
              })}

              {/* X Axis Title */}
              <text
                x={padding.left + innerWidth / 2}
                y={height - 8}
                textAnchor="middle"
                className="fill-slate-500 text-[11px] font-sans font-medium"
              >
                Concurrent Threads (log₂ spacing)
              </text>

              {/* Shaded Area Under Baseline Curve */}
              {baselineUnderCurveArea && (
                <path d={baselineUnderCurveArea} fill="url(#chartBaselineAreaGrad)" />
              )}

              {/* Baseline Iteration Variance Band (Shaded area behind line) */}
              {baselineVarianceArea && (
                <path
                  d={baselineVarianceArea}
                  fill={CHART_SERIES.baseline.varianceBandFill}
                  stroke={CHART_SERIES.baseline.varianceBandStroke}
                  strokeWidth="0.5"
                />
              )}

              {/* Candidate Iteration Variance Band (Shaded area behind line) */}
              {candidateVarianceArea && (
                <path
                  d={candidateVarianceArea}
                  fill={CHART_SERIES.candidate.varianceBandFill}
                  stroke={CHART_SERIES.candidate.varianceBandStroke}
                  strokeWidth="0.5"
                />
              )}

              {/* Baseline Line Curve (Solid Blue) */}
              {baselinePath && (
                <path
                  d={baselinePath}
                  fill="none"
                  stroke={CHART_SERIES.baseline.stroke}
                  strokeWidth={CHART_SERIES.baseline.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Candidate Line Curve (Dashed Purple) */}
              {candidatePath && (
                <path
                  d={candidatePath}
                  fill="none"
                  stroke={CHART_SERIES.candidate.stroke}
                  strokeWidth={CHART_SERIES.candidate.strokeWidth}
                  strokeDasharray={CHART_SERIES.candidate.strokeDasharray}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Markers & Hover Hit Boxes */}
              {metricPoints.map((p) => {
                const x = getX(p.threads);
                const yBase = yScale(p.baselineValue);
                const yCand = yScale(p.candidateValue);
                const isMax = p.threads === threadOfMaxChange;
                const isHovered = p.threads === hoveredThread;

                return (
                  <g key={p.threads} className="cursor-pointer">
                    {/* Max Change Highlighting Ring */}
                    {isMax && (
                      <circle
                        cx={x}
                        cy={yCand}
                        r="9"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                    )}

                    {/* Baseline Marker (Circle) */}
                    <circle
                      cx={x}
                      cy={yBase}
                      r={isHovered ? 5.5 : 4}
                      fill={CHART_SERIES.baseline.markerFill}
                      stroke={CHART_SERIES.baseline.markerStroke}
                      strokeWidth="2"
                    />

                    {/* Candidate Marker (Diamond) */}
                    <rect
                      x={x - (isHovered ? 5 : 3.5)}
                      y={yCand - (isHovered ? 5 : 3.5)}
                      width={isHovered ? 10 : 7}
                      height={isHovered ? 10 : 7}
                      transform={`rotate(45 ${x} ${yCand})`}
                      fill={CHART_SERIES.candidate.markerFill}
                      stroke={CHART_SERIES.candidate.markerStroke}
                      strokeWidth="2"
                    />

                    {/* Hover Hit Target Column */}
                    <rect
                      x={x - 25}
                      y={padding.top}
                      width="50"
                      height={innerHeight}
                      fill="transparent"
                      onMouseEnter={() => setHoveredThread(p.threads)}
                      onMouseLeave={() => setHoveredThread(null)}
                    />
                  </g>
                );
              })}

              {/* Hover Crosshair */}
              {hoveredThread && (
                <line
                  x1={getX(hoveredThread)}
                  y1={padding.top}
                  x2={getX(hoveredThread)}
                  y2={padding.top + innerHeight}
                  stroke="#60a5fa"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  className="pointer-events-none"
                />
              )}
            </svg>

            {/* Interactive Floating Tooltip */}
            {hoveredPoint && (
              <div
                className="pointer-events-none absolute z-30 rounded-xl border border-slate-700 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-md text-xs font-sans transition-all duration-75"
                style={{
                  left: `${(getX(hoveredPoint.threads) / width) * 100}%`,
                  top: '15%',
                  transform:
                    getX(hoveredPoint.threads) > width / 2
                      ? 'translateX(-105%)'
                      : 'translateX(10%)',
                }}
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1.5 mb-2">
                  <span className="font-bold text-white font-mono">{hoveredPoint.threads} Threads</span>
                  {hoveredPoint.isMaxDelta && (
                    <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider">
                      Max Delta
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-blue-400 font-medium">Baseline:</span>
                    <span className="text-slate-200">
                      {formatMetricNumber(hoveredPoint.baselineValue)} {unit}
                      {hoveredPoint.baselineMin !== undefined && (
                        <span className="text-slate-500 text-[10px] ml-1">
                          [{formatMetricNumber(hoveredPoint.baselineMin)}, {formatMetricNumber(hoveredPoint.baselineMax ?? hoveredPoint.baselineValue)}]
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-purple-300 font-medium">Candidate:</span>
                    <span className="text-white font-semibold">
                      {formatMetricNumber(hoveredPoint.candidateValue)} {unit}
                      {hoveredPoint.candidateMin !== undefined && (
                        <span className="text-slate-500 text-[10px] ml-1">
                          [{formatMetricNumber(hoveredPoint.candidateMin)}, {formatMetricNumber(hoveredPoint.candidateMax ?? hoveredPoint.candidateValue)}]
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-slate-800/80 pt-1.5 font-sans">
                    <span className="text-slate-400">Delta:</span>
                    <span
                      className={`font-mono font-bold ${
                        hoveredPoint.changePct > 0
                          ? 'text-emerald-400'
                          : hoveredPoint.changePct < -thresholds.pctWarning
                          ? 'text-rose-400'
                          : 'text-slate-200'
                      }`}
                    >
                      {formatDeltaPct(hoveredPoint.changePct)} (
                      {hoveredPoint.rawDiff > 0 ? '+' : ''}
                      {formatMetricNumber(hoveredPoint.rawDiff)})
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Accessible Data Table Alternative (Collapsible) */}
      {showDataTable && (
        <div className="pt-2">
          <ChartDataTable
            rows={metricPoints}
            thresholds={thresholds}
            baselineName={baselineName}
            candidateName={candidateName}
            metricName={activeMetric}
            unit={unit}
          />
        </div>
      )}
    </div>
  );
}

