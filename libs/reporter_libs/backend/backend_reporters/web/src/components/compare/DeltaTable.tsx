/**
 * #############################################################################
 * # web::src::components::compare::DeltaTable.tsx
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
 * # High-density comparison delta matrix table rendering metrics as rows and
 * # thread counts as columns, highlighting max change cells and missing values.
 * #############################################################################
 */

'use client';

import React, { useState, useMemo } from 'react';
import { SearchIcon } from '../ui/icons';
import { classifyChangePct } from '@/lib/domain/status';
import type { ComparisonDeltaRow, Thresholds } from '@/lib/domain/types';

interface DeltaTableProps {
  rows: ComparisonDeltaRow[];
  thresholds: Thresholds;
  baselineId: string;
  candidateId: string;
}

export function DeltaTable({ rows, thresholds }: DeltaTableProps) {
  const [metricFilter, setMetricFilter] = useState('');

  // Extract unique sorted thread counts
  const threadList = useMemo(() => {
    const set = new Set<number>();
    for (const r of rows) set.add(r.threads);
    return Array.from(set).sort((a, b) => a - b);
  }, [rows]);

  // Extract unique metric names and units
  const metricMetadata = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (!map.has(r.metricName)) {
        map.set(r.metricName, r.metricUnit || '');
      }
    }
    return map;
  }, [rows]);

  // Build matrix lookup: metricName -> thread -> row
  const matrix = useMemo(() => {
    const m = new Map<string, Map<number, ComparisonDeltaRow>>();
    for (const r of rows) {
      if (!m.has(r.metricName)) {
        m.set(r.metricName, new Map());
      }
      m.get(r.metricName)!.set(r.threads, r);
    }
    return m;
  }, [rows]);

  const filteredMetrics = useMemo(() => {
    const metrics = Array.from(matrix.keys());
    if (!metricFilter.trim()) return metrics;
    const lower = metricFilter.toLowerCase();
    return metrics.filter((m) => m.toLowerCase().includes(lower));
  }, [matrix, metricFilter]);

  const getCellDeltaClass = (changePct: number) => {
    const status = classifyChangePct(changePct, thresholds);
    switch (status) {
      case 'GAIN':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'PAR+':
        return 'text-teal-300 bg-teal-500/10 border-teal-500/20';
      case 'PAR':
        return 'text-slate-300 bg-slate-800/40 border-slate-700/40';
      case 'PAR-':
        return 'text-amber-200/90 bg-amber-500/10 border-amber-500/20';
      case 'WARNING':
        return 'text-amber-300 bg-amber-500/15 border-amber-500/40 font-semibold';
      case 'REGRESSED':
        return 'text-rose-300 bg-rose-500/20 border-rose-500/40 font-bold';
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur shadow-xl">
      {/* Table Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight">
            Comparison Delta Matrix
          </h3>
          <p className="text-xs text-slate-400">
            Per-metric iterations averaged server-side. Delta represents percentage difference relative to baseline.
          </p>
        </div>

        {/* Filter metric search */}
        <div className="relative w-full sm:w-64">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={metricFilter}
            onChange={(e) => setMetricFilter(e.target.value)}
            placeholder="Filter metrics..."
            className="w-full rounded-lg border border-slate-800 bg-slate-950 py-1.5 pl-8 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Delta Matrix Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-xs border-collapse font-sans">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th scope="col" className="py-3 px-4 min-w-[180px]">
                Metric
              </th>
              {threadList.map((threads) => (
                <th key={threads} scope="col" className="py-3 px-3 text-right min-w-[120px]">
                  {threads} Threads
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredMetrics.map((metricName) => {
              const unit = metricMetadata.get(metricName) || '';
              const threadMap = matrix.get(metricName)!;

              return (
                <tr key={metricName} className="hover:bg-slate-800/30 transition-colors">
                  {/* Metric Name & Unit */}
                  <td className="py-3 px-4">
                    <span className="font-mono font-bold text-slate-200">{metricName}</span>
                    {unit && (
                      <span className="block text-[10px] text-slate-500 font-sans">{unit}</span>
                    )}
                  </td>

                  {/* Thread cells */}
                  {threadList.map((threads) => {
                    const cell = threadMap.get(threads);

                    if (!cell) {
                      return (
                        <td key={threads} className="py-3 px-3 text-right text-slate-600 font-mono">
                          —
                        </td>
                      );
                    }

                    const sign = cell.changePct > 0 ? '+' : '';
                    const deltaStyle = getCellDeltaClass(cell.changePct);

                    return (
                      <td
                        key={threads}
                        className={`py-2.5 px-3 text-right align-top transition-colors ${
                          cell.isMaxDelta ? 'bg-blue-950/30 ring-1 ring-blue-500/40 rounded-sm' : ''
                        }`}
                      >
                        {/* Candidate Value */}
                        <div className="font-mono font-semibold text-white">
                          {cell.candidateValue.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}
                        </div>

                        {/* Baseline Value (subtext) */}
                        <div className="text-[10px] text-slate-500 font-mono">
                          base: {cell.baselineValue.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}
                        </div>

                        {/* Delta Pill */}
                        <div className="mt-1 flex items-center justify-end gap-1">
                          <span
                            className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-mono border ${deltaStyle}`}
                            title={`Raw diff: ${sign}${cell.rawDiff.toFixed(2)} ${unit}`}
                          >
                            <span>{sign}{cell.changePct.toFixed(2)}%</span>
                          </span>

                          {cell.isMaxDelta && (
                            <span
                              className="rounded bg-blue-600 text-[9px] font-bold text-white px-1 py-0.2 uppercase tracking-tight shadow-sm"
                              title="Thread of Maximum Change"
                            >
                              MAX
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
