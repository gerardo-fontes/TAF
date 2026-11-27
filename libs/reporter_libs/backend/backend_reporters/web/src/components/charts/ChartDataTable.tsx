/**
 * #############################################################################
 * # web::src::components::charts::ChartDataTable.tsx
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
 * # Accessible data table alternative for the thread-scaling chart. Provides
 * # screen-reader access and tabular verification for baseline, candidate,
 * # iteration min/max variance, and percentage changes.
 * #############################################################################
 */

import React from 'react';
import type { ComparisonDeltaRow, Thresholds } from '@/lib/domain/types';
import { classifyChangePct } from '@/lib/domain/status';
import { formatMetricNumber, formatDeltaPct } from '@/lib/charts/theme';

interface ChartDataTableProps {
  rows: ComparisonDeltaRow[];
  thresholds: Thresholds;
  baselineName: string;
  candidateName: string;
  metricName: string;
  unit: string;
  singleRun?: boolean;
}

export function ChartDataTable({
  rows,
  thresholds,
  baselineName,
  candidateName,
  metricName,
  unit,
  singleRun = false,
}: ChartDataTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/60">
      <table
        className="w-full text-left text-xs font-mono"
        aria-label={`Data table alternative for ${metricName} thread scaling`}
      >
        <caption className="sr-only">
          {singleRun
            ? `Thread scaling data table for ${metricName} (${candidateName})`
            : `Thread scaling data table for ${metricName} comparing ${baselineName} and ${candidateName}`}
        </caption>
        <thead>
          <tr className="border-b border-slate-800 bg-slate-900/80 text-[11px] font-sans font-semibold text-slate-400">
            <th scope="col" className="px-3 py-2.5">Threads</th>
            {singleRun ? (
              <>
                <th scope="col" className="px-3 py-2.5">
                  Avg ({unit || 'val'})
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Iterations [Min, Max]
                </th>
              </>
            ) : (
              <>
                <th scope="col" className="px-3 py-2.5">
                  Baseline Avg ({unit || 'val'})
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Baseline Iterations [Min, Max]
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Candidate Avg ({unit || 'val'})
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Candidate Iterations [Min, Max]
                </th>
                <th scope="col" className="px-3 py-2.5">Raw Diff</th>
                <th scope="col" className="px-3 py-2.5">Delta %</th>
                <th scope="col" className="px-3 py-2.5">Status</th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {rows.map((row) => {
            if (singleRun) {
              return (
                <tr key={row.threads} className="transition-colors hover:bg-slate-800/40">
                  <th scope="row" className="px-3 py-2 font-bold text-white">
                    {row.threads}t
                  </th>
                  <td className="px-3 py-2 text-blue-300 font-medium">
                    {formatMetricNumber(row.candidateValue)}
                  </td>
                  <td className="px-3 py-2 text-slate-400 text-[11px]">
                    {row.candidateMin !== undefined && row.candidateMax !== undefined
                      ? `[${formatMetricNumber(row.candidateMin)}, ${formatMetricNumber(row.candidateMax)}]`
                      : '—'}
                  </td>
                </tr>
              );
            }

            const status = classifyChangePct(row.changePct, thresholds);
            const isGain = row.changePct > 0;
            const isRegressed = row.changePct < -thresholds.pctFail;
            const isWarning = row.changePct < -thresholds.pctWarning && !isRegressed;

            return (
              <tr
                key={row.threads}
                className={`transition-colors hover:bg-slate-800/40 ${
                  row.isMaxDelta ? 'bg-amber-500/10' : ''
                }`}
              >
                <th scope="row" className="px-3 py-2 font-bold text-white flex items-center gap-1.5">
                  <span>{row.threads}t</span>
                  {row.isMaxDelta && (
                    <span className="rounded bg-amber-500/20 px-1 py-0.2 text-[9px] font-bold uppercase tracking-wider text-amber-300 border border-amber-500/40">
                      MAX
                    </span>
                  )}
                </th>
                <td className="px-3 py-2 text-blue-300">
                  {formatMetricNumber(row.baselineValue)}
                </td>
                <td className="px-3 py-2 text-slate-400 text-[11px]">
                  {row.baselineMin !== undefined && row.baselineMax !== undefined ? (
                    `[${formatMetricNumber(row.baselineMin)}, ${formatMetricNumber(row.baselineMax)}]`
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2 text-purple-300 font-medium">
                  {formatMetricNumber(row.candidateValue)}
                </td>
                <td className="px-3 py-2 text-slate-400 text-[11px]">
                  {row.candidateMin !== undefined && row.candidateMax !== undefined ? (
                    `[${formatMetricNumber(row.candidateMin)}, ${formatMetricNumber(row.candidateMax)}]`
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2 text-slate-300">
                  {row.rawDiff > 0 ? '+' : ''}
                  {formatMetricNumber(row.rawDiff)}
                </td>
                <td
                  className={`px-3 py-2 font-bold ${
                    isGain
                      ? 'text-emerald-400'
                      : isRegressed
                      ? 'text-rose-400'
                      : isWarning
                      ? 'text-amber-400'
                      : 'text-slate-300'
                  }`}
                >
                  {formatDeltaPct(row.changePct)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      status === 'GAIN'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : status === 'REGRESSED'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : status === 'WARNING'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-slate-700/40 text-slate-300 border border-slate-600/40'
                    }`}
                  >
                    {status === 'GAIN' && '▲ '}
                    {status === 'REGRESSED' && '▼ '}
                    {status === 'WARNING' && '▼ '}
                    {status === 'PAR' && '■ '}
                    {status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

