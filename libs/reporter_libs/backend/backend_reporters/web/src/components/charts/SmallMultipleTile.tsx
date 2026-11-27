/**
 * #############################################################################
 * # web::src::components::charts::SmallMultipleTile.tsx
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
 * # Memoized sub-chart tile for small multiples grid view. Renders independent
 * # Y-axis scaling for diverse metric units while sharing the log2 threads X-axis.
 * #############################################################################
 */

'use client';

import React, { memo, useMemo } from 'react';
import { scaleLinear } from 'd3-scale';
import { line, area } from 'd3-shape';
import type { ComparisonDeltaRow } from '@/lib/domain/types';
import { CHART_SERIES, formatMetricNumber, formatDeltaPct } from '@/lib/charts/theme';

interface SmallMultipleTileProps {
  metricName: string;
  unit: string;
  points: ComparisonDeltaRow[];
  threads: number[];
  minLog: number;
  maxLog: number;
  isSelected: boolean;
  onSelect: (metric: string) => void;
  threadOfMaxChange?: number;
  singleRun?: boolean;
}

export const SmallMultipleTile = memo(function SmallMultipleTile({
  metricName,
  unit,
  points,
  threads,
  minLog,
  maxLog,
  isSelected,
  onSelect,
  threadOfMaxChange,
  singleRun = false,
}: SmallMultipleTileProps) {
  const width = 280;
  const height = 180;
  const padding = { top: 20, right: 15, bottom: 30, left: 45 };

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Log2 X coordinate mapping
  const getX = React.useCallback(
    (threadCount: number) => {
      const range = maxLog - minLog;
      if (range === 0 || threads.length <= 1) return padding.left + innerWidth / 2;
      const fraction = (Math.log2(threadCount) - minLog) / range;
      return padding.left + fraction * innerWidth;
    },
    [maxLog, minLog, threads.length, padding.left, innerWidth]
  );

  // Find Y min and max for this specific metric
  const { minY, maxY, yScale } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;

    for (const p of points) {
      const bMin = p.baselineMin ?? p.baselineValue;
      const cMin = p.candidateMin ?? p.candidateValue;
      const bMax = p.baselineMax ?? p.baselineValue;
      const cMax = p.candidateMax ?? p.candidateValue;

      min = Math.min(min, bMin, cMin);
      max = Math.max(max, bMax, cMax);
    }

    if (!isFinite(min) || !isFinite(max)) {
      min = 0;
      max = 100;
    }

    const yMin = min > 0 ? 0 : min * 1.1;
    const yMax = max > 0 ? max * 1.15 : 100;

    const scale = scaleLinear().domain([yMin, yMax]).range([padding.top + innerHeight, padding.top]);
    return { minY: yMin, maxY: yMax, yScale: scale };
  }, [points, innerHeight, padding.top]);

  // Baseline line & candidate line via d3-shape
  const baselineLinePath = useMemo(() => {
    const lineGen = line<ComparisonDeltaRow>()
      .x((d) => getX(d.threads))
      .y((d) => yScale(d.baselineValue));
    return lineGen(points) || '';
  }, [points, yScale, getX]);

  const candidateLinePath = useMemo(() => {
    const lineGen = line<ComparisonDeltaRow>()
      .x((d) => getX(d.threads))
      .y((d) => yScale(d.candidateValue));
    return lineGen(points) || '';
  }, [points, yScale, getX]);

  // Baseline iteration variance area
  const baselineVarianceArea = useMemo(() => {
    const areaGen = area<ComparisonDeltaRow>()
      .x((d) => getX(d.threads))
      .y0((d) => yScale(d.baselineMin ?? d.baselineValue))
      .y1((d) => yScale(d.baselineMax ?? d.baselineValue));
    return areaGen(points) || '';
  }, [points, yScale, getX]);

  // Candidate iteration variance area
  const candidateVarianceArea = useMemo(() => {
    const areaGen = area<ComparisonDeltaRow>()
      .x((d) => getX(d.threads))
      .y0((d) => yScale(d.candidateMin ?? d.candidateValue))
      .y1((d) => yScale(d.candidateMax ?? d.candidateValue));
    return areaGen(points) || '';
  }, [points, yScale, getX]);

  // Find max delta in this metric
  const maxDeltaPoint = useMemo(() => {
    if (points.length === 0) return null;
    let max = points[0];
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(points[i].rawDiff) > Math.abs(max.rawDiff)) {
        max = points[i];
      }
    }
    return max;
  }, [points]);

  return (
    <div
      onClick={() => onSelect(metricName)}
      className={`group cursor-pointer rounded-xl border p-3 transition-all backdrop-blur ${
        isSelected
          ? 'border-blue-500 bg-blue-950/20 ring-1 ring-blue-500/50 shadow-lg shadow-blue-500/10'
          : 'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900/80'
      }`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(metricName);
        }
      }}
      aria-label={`Select metric ${metricName} for detailed chart view`}
    >
      {/* Tile Header */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-bold text-white truncate">{metricName}</span>
            {unit && <span className="text-[10px] text-slate-400">({unit})</span>}
          </div>
        </div>

        {!singleRun && maxDeltaPoint && (
          <span
            className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold shrink-0 ${
              maxDeltaPoint.changePct > 0
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : maxDeltaPoint.changePct < 0
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            {formatDeltaPct(maxDeltaPoint.changePct)}
          </span>
        )}
      </div>

      {/* SVG Sparkline */}
      <div className="relative mt-2 w-full h-[180px]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full select-none overflow-visible"
          role="img"
          aria-label={`Small multiple sparkline for ${metricName}`}
        >
          {/* Y Axis Reference Grid (Min, Mid, Max) */}
          {[minY, (minY + maxY) / 2, maxY].map((tick, i) => {
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
                  strokeDasharray="2 2"
                  strokeOpacity={0.4}
                />
                <text
                  x={padding.left - 4}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-500 font-mono text-[9px]"
                >
                  {formatMetricNumber(tick)}
                </text>
              </g>
            );
          })}

          {/* X Axis Thread Ticks */}
          {threads.map((t) => {
            const x = getX(t);
            const isMaxThread = t === threadOfMaxChange;
            return (
              <g key={t}>
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={padding.top + innerHeight}
                  stroke={isMaxThread ? '#f59e0b' : '#334155'}
                  strokeWidth={isMaxThread ? '1' : '0.5'}
                  strokeDasharray="2 2"
                  strokeOpacity={isMaxThread ? 0.7 : 0.2}
                />
                <text
                  x={x}
                  y={height - 12}
                  textAnchor="middle"
                  className={`font-mono text-[9px] ${
                    isMaxThread ? 'fill-amber-400 font-bold' : 'fill-slate-500'
                  }`}
                >
                  {t}
                </text>
              </g>
            );
          })}

          {/* Iteration Variance Areas (No animation to preserve performance) */}
          {baselineVarianceArea && (
            <path
              d={baselineVarianceArea}
              fill={CHART_SERIES.baseline.varianceBandFill}
              stroke="none"
            />
          )}
          {!singleRun && candidateVarianceArea && (
            <path
              d={candidateVarianceArea}
              fill={CHART_SERIES.candidate.varianceBandFill}
              stroke="none"
            />
          )}

          {/* Baseline Line (Solid) */}
          {baselineLinePath && (
            <path
              d={baselineLinePath}
              fill="none"
              stroke={CHART_SERIES.baseline.stroke}
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          )}

          {/* Candidate Line (Dashed) */}
          {!singleRun && candidateLinePath && (
            <path
              d={candidateLinePath}
              fill="none"
              stroke={CHART_SERIES.candidate.stroke}
              strokeWidth={1.8}
              strokeDasharray={CHART_SERIES.candidate.strokeDasharray}
              strokeLinecap="round"
            />
          )}

          {/* Markers */}
          {points.map((p) => {
            const x = getX(p.threads);
            const yB = yScale(p.baselineValue);
            const yC = yScale(p.candidateValue);
            return (
              <g key={p.threads}>
                <circle cx={x} cy={yB} r={2.5} fill={CHART_SERIES.baseline.stroke} />
                {!singleRun && (
                  <rect
                    x={x - 2}
                    y={yC - 2}
                    width={4}
                    height={4}
                    transform={`rotate(45 ${x} ${yC})`}
                    fill={CHART_SERIES.candidate.stroke}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 font-sans">
        <span>Click to expand</span>
        <span className="font-mono">{points.length} thread points</span>
      </div>
    </div>
  );
});

