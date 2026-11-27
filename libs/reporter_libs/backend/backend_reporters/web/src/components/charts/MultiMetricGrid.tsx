/**
 * #############################################################################
 * # web::src::components::charts::MultiMetricGrid.tsx
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
 * # Multi-metric small multiples grid view. Displays up to 8 memoized sparklines
 * # sharing the log2 threads X-axis with independent Y-axes per metric.
 * #############################################################################
 */

'use client';

import React, { useMemo } from 'react';
import type { ComparisonDeltaRow } from '@/lib/domain/types';
import { SmallMultipleTile } from './SmallMultipleTile';

interface MultiMetricGridProps {
  rows: ComparisonDeltaRow[];
  metrics: string[];
  selectedMetric: string;
  onSelectMetric: (metric: string) => void;
  threadOfMaxChange?: number;
  singleRun?: boolean;
}

const MAX_DISPLAYED_METRICS = 8;

export function MultiMetricGrid({
  rows,
  metrics,
  selectedMetric,
  onSelectMetric,
  threadOfMaxChange,
  singleRun = false,
}: MultiMetricGridProps) {
  // Cap at 8 metrics for layout stability and performance
  const visibleMetrics = useMemo(() => {
    return metrics.slice(0, MAX_DISPLAYED_METRICS);
  }, [metrics]);

  const hasCappedMetrics = metrics.length > MAX_DISPLAYED_METRICS;

  // Group rows by metric
  const metricDataMap = useMemo(() => {
    const map = new Map<string, ComparisonDeltaRow[]>();
    for (const m of visibleMetrics) {
      map.set(
        m,
        rows.filter((r) => r.metricName === m).sort((a, b) => a.threads - b.threads)
      );
    }
    return map;
  }, [rows, visibleMetrics]);

  // Extract common thread set across all metrics for uniform log2 scale
  const { threads, minLog, maxLog } = useMemo(() => {
    const threadSet = new Set<number>();
    for (const r of rows) threadSet.add(r.threads);
    const sorted = Array.from(threadSet).sort((a, b) => a - b);
    const min = sorted.length > 0 ? Math.log2(sorted[0]) : 0;
    const max = sorted.length > 0 ? Math.log2(sorted[sorted.length - 1]) : 1;
    return { threads: sorted, minLog: min, maxLog: max };
  }, [rows]);

  return (
    <div className="space-y-4">
      {/* Header and Cap Notice */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h4 className="text-sm font-semibold text-white">
            Small Multiples (Multi-Metric Overview)
          </h4>
          <p className="text-xs text-slate-400">
            Each tile displays independent Y-axis scaling for its metric unit while sharing concurrent thread spacing.
          </p>
        </div>

        {hasCappedMetrics && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 text-[11px] text-amber-300">
            Showing 8 of {metrics.length} metrics. Switch to single metric view or filter to inspect others.
          </div>
        )}
      </div>

      {/* Grid of Small Multiple Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {visibleMetrics.map((m) => {
          const points = metricDataMap.get(m) || [];
          const unit = points[0]?.metricUnit || '';
          return (
            <SmallMultipleTile
              key={m}
              metricName={m}
              unit={unit}
              points={points}
              threads={threads}
              minLog={minLog}
              maxLog={maxLog}
              isSelected={selectedMetric === m}
              onSelect={onSelectMetric}
              threadOfMaxChange={threadOfMaxChange}
              singleRun={singleRun}
            />
          );
        })}
      </div>
    </div>
  );
}

