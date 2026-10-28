/**
 * #############################################################################
 * # web::src::components::compare::ThreadScalingChart.tsx
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
 * # Licensed under the GNU General Public License, version 2 or later (GPLv2+).
 * # See https://www.gnu.org/licenses/ for details.
 * #
 * # PURPOSE:
 * # Thread-scaling graphic comparing baseline vs candidate performance curves
 * # on a log2 thread count X-axis, featuring max-change vertical reference line,
 * # greyscale-accessible stroke patterns, and interactive tooltips.
 * #############################################################################
 */

'use client';

import React, { useState, useMemo } from 'react';
import type { ComparisonDeltaRow, Thresholds } from '@/lib/domain/types';
import { classifyChangePct } from '@/lib/domain/status';

interface ThreadScalingChartProps {
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
  // 1. Group rows by metricName
  const metrics = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.metricName);
    return Array.from(set);
  }, [rows]);

  // Default to first metric (or primary like tpmC / TPS if present)
  const [selectedMetric, setSelectedMetric] = useState<string>(() => {
    if (metrics.includes('tpmC')) return 'tpmC';
    if (metrics.includes('TPS')) return 'TPS';
    if (metrics.includes('QPS')) return 'QPS';
    return metrics[0] || '';
  });

  const activeMetric = metrics.includes(selectedMetric) ? selectedMetric : metrics[0] || '';

  // Filter rows for the active metric, sorted by thread count
  const metricPoints = useMemo(() => {
    return rows
      .filter((r) => r.metricName === activeMetric)
      .sort((a, b) => a.threads - b.threads);
  }, [rows, activeMetric]);

  const unit = metricPoints[0]?.metricUnit || '';

  // Active hover point state
  const [hoveredThread, setHoveredThread] = useState<number | null>(null);

  // SVG dimensions & padding
  const width = 800;
  const height = 340;
  const padding = { top: 30, right: 40, bottom: 50, left: 70 };

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Thread counts
  const threads = useMemo(() => metricPoints.map((p) => p.threads), [metricPoints]);

  // Scaling ranges
  const { minY, maxY, yTicks } = useMemo(() => {
    if (metricPoints.length === 0) {
      return { minY: 0, maxY: 100, yTicks: [0, 25, 50, 75, 100] };
    }

    let min = Infinity;
    let max = -Infinity;

    for (const p of metricPoints) {
      min = Math.min(min, p.baselineValue, p.candidateValue);
      max = Math.max(max, p.baselineValue, p.candidateValue);
    }

    // Give Y-axis headroom
    const yMin = 0;
    const yMax = max > 0 ? max * 1.15 : 100;

    // Generate 5 round ticks
    const step = yMax / 4;
    const ticks = [0, step, step * 2, step * 3, yMax];

    return { minY: yMin, maxY: yMax, yTicks: ticks };
  }, [metricPoints]);

  // Log2 mapping for thread counts
  const getX = (threadCount: number) => {
    if (threads.length <= 1) return padding.left + innerWidth / 2;
    const minLog = Math.log2(threads[0]);
    const maxLog = Math.log2(threads[threads.length - 1]);
    const range = maxLog - minLog;
    if (range === 0) return padding.left + innerWidth / 2;

    const currentLog = Math.log2(threadCount);
    const fraction = (currentLog - minLog) / range;
    return padding.left + fraction * innerWidth;
  };

  const getY = (val: number) => {
    const range = maxY - minY;
    if (range === 0) return padding.top + innerHeight / 2;
    const fraction = (val - minY) / range;
    return padding.top + innerHeight - fraction * innerHeight;
  };

  // Build SVG path strings
  const baselinePath = useMemo(() => {
    if (metricPoints.length === 0) return '';
    return metricPoints.reduce((acc, p, i) => {
      const x = getX(p.threads);
      const y = getY(p.baselineValue);
      return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
  }, [metricPoints, maxY]);

  const candidatePath = useMemo(() => {
    if (metricPoints.length === 0) return '';
    return metricPoints.reduce((acc, p, i) => {
      const x = getX(p.threads);
      const y = getY(p.candidateValue);
      return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
  }, [metricPoints, maxY]);

  // Baseline area gradient under curve
  const baselineArea = useMemo(() => {
    if (metricPoints.length === 0) return '';
    const firstX = getX(metricPoints[0].threads);
    const lastX = getX(metricPoints[metricPoints.length - 1].threads);
    const bottomY = padding.top + innerHeight;
    return `${baselinePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [baselinePath, metricPoints, innerHeight]);

  const hoveredPoint = useMemo(() => {
    if (!hoveredThread) return null;
    return metricPoints.find((p) => p.threads === hoveredThread) || null;
  }, [hoveredThread, metricPoints]);

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
    return num.toLocaleString(undefined, { maximumFractionDigits: 1 });
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur shadow-xl space-y-4">
      {/* Chart Title & Metric Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            Thread-Scaling Performance Curves
          </h3>
          <p className="text-xs text-slate-400">
            Comparing Baseline vs Candidate throughput across concurrent thread workloads (log₂ X-axis).
          </p>
        </div>

        {/* Metric Selector Pills */}
        {metrics.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-slate-950/80 rounded-lg border border-slate-800">
            {metrics.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedMetric(m)}
                className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-all ${
                  activeMetric === m
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Accessible Legend */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-6">
          {/* Baseline Legend Item */}
          <div className="flex items-center gap-2">
            <span className="flex items-center">
              <span className="w-4 h-0.5 bg-blue-500 rounded" />
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 -ml-1 border border-slate-900" />
            </span>
            <span className="text-slate-300 font-medium">
              Baseline: <span className="text-slate-400 font-mono text-[11px] truncate max-w-[150px] inline-block align-bottom">{baselineName}</span>
            </span>
          </div>

          {/* Candidate Legend Item */}
          <div className="flex items-center gap-2">
            <span className="flex items-center">
              <span className="w-4 h-0.5 bg-purple-400 border-t border-dashed border-purple-300" />
              <span className="w-2.5 h-2.5 rounded-sm bg-purple-400 -ml-1 border border-slate-900 rotate-45" />
            </span>
            <span className="text-slate-300 font-medium">
              Candidate: <span className="text-slate-400 font-mono text-[11px] truncate max-w-[150px] inline-block align-bottom">{candidateName}</span>
            </span>
          </div>

          {/* Max Delta Line Legend */}
          {threadOfMaxChange > 0 && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="w-4 h-0.5 border-t border-dashed border-amber-400" />
              <span className="text-slate-400 text-[11px]">
                Max Change Ref ({threadOfMaxChange}t)
              </span>
            </div>
          )}
        </div>

        <div className="text-[11px] font-mono text-slate-500">
          Units: <span className="text-slate-300">{unit || 'value'}</span>
        </div>
      </div>

      {/* SVG Chart Canvas */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none overflow-visible"
          role="img"
          aria-label={`Thread-scaling chart for metric ${activeMetric}`}
        >
          <defs>
            <linearGradient id="baselineAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Horizontal Grid Lines & Y-Axis Ticks */}
          {yTicks.map((tick, i) => {
            const y = getY(tick);
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#334155"
                  strokeWidth="1"
                  strokeDasharray={i === 0 ? 'none' : '3,3'}
                  strokeOpacity={i === 0 ? 0.7 : 0.35}
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 font-mono text-[10px]"
                >
                  {formatNumber(tick)}
                </text>
              </g>
            );
          })}

          {/* Vertical Thread Grid Lines & X-Axis Ticks */}
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
                  strokeDasharray={isMax ? '4,4' : '2,4'}
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

          {/* X-Axis Label */}
          <text
            x={padding.left + innerWidth / 2}
            y={height - 8}
            textAnchor="middle"
            className="fill-slate-500 text-[11px] font-sans font-medium"
          >
            Concurrent Threads (log₂ scale)
          </text>

          {/* Shaded Area Under Baseline */}
          {baselineArea && <path d={baselineArea} fill="url(#baselineAreaGrad)" />}

          {/* Baseline Curve (Solid Blue) */}
          {baselinePath && (
            <path
              d={baselinePath}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Candidate Curve (Dashed Purple) */}
          {candidatePath && (
            <path
              d={candidatePath}
              fill="none"
              stroke="#c084fc"
              strokeWidth="2.5"
              strokeDasharray="6,4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data Points (Markers) & Hover Hit-Targets */}
          {metricPoints.map((p) => {
            const x = getX(p.threads);
            const yBase = getY(p.baselineValue);
            const yCand = getY(p.candidateValue);
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
                    strokeDasharray="2,2"
                    className="animate-spin-slow origin-center"
                  />
                )}

                {/* Baseline Marker (Circle) */}
                <circle
                  cx={x}
                  cy={yBase}
                  r={isHovered ? 5.5 : 4}
                  fill="#3b82f6"
                  stroke="#0f172a"
                  strokeWidth="2"
                  className="transition-all"
                />

                {/* Candidate Marker (Diamond) */}
                <rect
                  x={x - (isHovered ? 5 : 3.5)}
                  y={yCand - (isHovered ? 5 : 3.5)}
                  width={isHovered ? 10 : 7}
                  height={isHovered ? 10 : 7}
                  transform={`rotate(45 ${x} ${yCand})`}
                  fill="#c084fc"
                  stroke="#0f172a"
                  strokeWidth="2"
                  className="transition-all"
                />

                {/* Invisible wide column hit-target for seamless hover */}
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

          {/* Active Hover Crosshair Line */}
          {hoveredThread && (
            <line
              x1={getX(hoveredThread)}
              y1={padding.top}
              x2={getX(hoveredThread)}
              y2={padding.top + innerHeight}
              stroke="#60a5fa"
              strokeWidth="1"
              strokeDasharray="2,2"
              className="pointer-events-none"
            />
          )}
        </svg>

        {/* Floating Tooltip */}
        {hoveredPoint && (
          <div
            className="pointer-events-none absolute z-30 rounded-xl border border-slate-700 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-md text-xs font-sans transition-all duration-75"
            style={{
              left: `${(getX(hoveredPoint.threads) / width) * 100}%`,
              top: '15%',
              transform: getX(hoveredPoint.threads) > width / 2 ? 'translateX(-105%)' : 'translateX(10%)',
            }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1.5 mb-2">
              <span className="font-bold text-white font-mono">{hoveredPoint.threads} Threads</span>
              {hoveredPoint.isMaxDelta && (
                <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider">
                  Max Change
                </span>
              )}
            </div>

            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="flex items-center justify-between gap-4">
                <span className="text-blue-400 font-medium">Baseline:</span>
                <span className="text-slate-200">
                  {hoveredPoint.baselineValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} {unit}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-purple-300 font-medium">Candidate:</span>
                <span className="text-white font-semibold">
                  {hoveredPoint.candidateValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} {unit}
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
                  {hoveredPoint.changePct > 0 ? '+' : ''}
                  {hoveredPoint.changePct.toFixed(2)}% (
                  {hoveredPoint.rawDiff > 0 ? '+' : ''}
                  {hoveredPoint.rawDiff.toFixed(2)})
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
