/**
 * #############################################################################
 * # web::src::components::dashboard::DailyTimelineChart.tsx
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
 * # Daily benchmark activity and status distribution timeline chart (Milestone 5.4).
 * #############################################################################
 */

'use client';

import React, { useState, useMemo } from 'react';
import type { DashboardDailyTimelinePoint } from '@/lib/domain/types';

interface DailyTimelineChartProps {
  timeline: DashboardDailyTimelinePoint[];
}

export function DailyTimelineChart({ timeline }: DailyTimelineChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<DashboardDailyTimelinePoint | null>(null);

  const maxDailyRuns = useMemo(() => {
    let max = 0;
    for (const p of timeline) {
      max = Math.max(max, p.totalRuns);
    }
    return max > 0 ? max : 10;
  }, [timeline]);

  if (timeline.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 text-center text-xs text-slate-500">
        No daily timeline activity recorded in this time window.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 backdrop-blur space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div>
          <h4 className="text-sm font-bold text-white tracking-tight">Daily Activity & Status Timeline</h4>
          <p className="text-xs text-slate-400">
            Total automated test runs and comparison breakdown grouped by date.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
          <span className="flex items-center gap-1 text-rose-400">
            <span className="h-2 w-2 rounded-sm bg-rose-500" /> Regressed
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <span className="h-2 w-2 rounded-sm bg-amber-500" /> Warning
          </span>
          <span className="flex items-center gap-1 text-slate-400">
            <span className="h-2 w-2 rounded-sm bg-slate-600" /> Parity
          </span>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Gain
          </span>
        </div>
      </div>

      {/* Stacked Bar Visual Chart (horizontally scrollable when days overflow) */}
      <div className="relative pt-4 pb-2">
        <div className="overflow-x-auto overflow-y-hidden timeline-scrollbar pb-2">
          <div
            className="flex items-end justify-between gap-2 h-44 border-b border-slate-800 px-2 w-max min-w-full"
          >
            {timeline.map((point) => {
              const heightPct = (point.totalRuns / maxDailyRuns) * 100;
              const totalComp = point.comparisonCount > 0 ? point.comparisonCount : 1;
              const regressedPct = (point.regressedCount / totalComp) * 100;
              const warnPct = (point.warningCount / totalComp) * 100;
              const gainPct = (point.gainCount / totalComp) * 100;
              const parPct = (point.parCount / totalComp) * 100;

              const isHovered = hoveredPoint?.date === point.date;

              return (
                <div
                  key={point.date}
                  className="flex flex-col items-center shrink-0 w-12 max-w-[60px] h-full justify-end group cursor-pointer"
                  onMouseEnter={() => setHoveredPoint(point)}
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  {/* Total count badge above bar */}
                  <span
                    className={`text-[10px] font-mono mb-1 transition-all ${isHovered ? 'text-white font-bold scale-110' : 'text-slate-500'
                      }`}
                  >
                    {point.totalRuns}
                  </span>

                  {/* Stacked bar container */}
                  <div
                    className={`w-full rounded-t-md overflow-hidden flex flex-col justify-end transition-all ${isHovered ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-slate-900' : ''
                      }`}
                    style={{ height: `${Math.max(8, heightPct)}%` }}
                  >
                    {/* Regressed segment */}
                    {point.regressedCount > 0 && (
                      <div
                        className="bg-rose-500 hover:bg-rose-400 transition-colors"
                        style={{ height: `${regressedPct}%` }}
                        title={`Regressed: ${point.regressedCount}`}
                      />
                    )}
                    {/* Warning segment */}
                    {point.warningCount > 0 && (
                      <div
                        className="bg-amber-500 hover:bg-amber-400 transition-colors"
                        style={{ height: `${warnPct}%` }}
                        title={`Warning: ${point.warningCount}`}
                      />
                    )}
                    {/* Parity segment */}
                    {point.parCount > 0 && (
                      <div
                        className="bg-slate-600 hover:bg-slate-500 transition-colors"
                        style={{ height: `${parPct}%` }}
                        title={`Parity: ${point.parCount}`}
                      />
                    )}
                    {/* Gain segment */}
                    {point.gainCount > 0 && (
                      <div
                        className="bg-emerald-500 hover:bg-emerald-400 transition-colors"
                        style={{ height: `${gainPct}%` }}
                        title={`Gain: ${point.gainCount}`}
                      />
                    )}
                    {/* Uncompared runs filler if no comparisons */}
                    {point.comparisonCount === 0 && (
                      <div className="bg-slate-800 h-full w-full" title="Runs without comparisons" />
                    )}
                  </div>

                  {/* Date label */}
                  <span className="text-[10px] font-mono text-slate-400 mt-2 truncate w-full text-center">
                    {point.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hover Callout Card */}
        {hoveredPoint && (
          <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs font-mono flex items-center justify-between">
            <span className="font-bold text-white">{hoveredPoint.date}:</span>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="text-slate-300">Total Runs: {hoveredPoint.totalRuns}</span>
              <span className="text-rose-400">Regressed: {hoveredPoint.regressedCount}</span>
              <span className="text-amber-400">Warning: {hoveredPoint.warningCount}</span>
              <span className="text-slate-400">Parity: {hoveredPoint.parCount}</span>
              <span className="text-emerald-400">Gain: {hoveredPoint.gainCount}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
