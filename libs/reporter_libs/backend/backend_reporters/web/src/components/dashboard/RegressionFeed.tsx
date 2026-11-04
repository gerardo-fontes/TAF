/**
 * #############################################################################
 * # web::src::components::dashboard::RegressionFeed.tsx
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
 * # Severity-sorted regression feed (Milestone 5.4) featuring keyset pagination
 * # (Milestone 5.3) and deep-linking directly into Compare View (Milestone 5.5).
 * #############################################################################
 */

'use client';

import React from 'react';
import Link from 'next/link';
import type { DashboardFeedItem, DashboardFilters } from '@/lib/domain/types';

interface RegressionFeedProps {
  feed: DashboardFeedItem[];
  hasMore: boolean;
  onLoadMore: () => void;
  isLoadingMore: boolean;
  filters: DashboardFilters;
  days: number;
}

export function RegressionFeed({
  feed,
  hasMore,
  onLoadMore,
  isLoadingMore,
  filters,
  days,
}: RegressionFeedProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'REGRESSED':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'WARNING':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'PAR-':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
      case 'PAR':
        return 'bg-slate-700/50 text-slate-300 border-slate-600/40';
      case 'PAR+':
        return 'bg-teal-500/20 text-teal-300 border-teal-500/40';
      case 'GAIN':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const getStatusGlyph = (status: string) => {
    switch (status) {
      case 'REGRESSED':
        return '▼▼▼';
      case 'WARNING':
        return '▼▼';
      case 'PAR-':
        return '▼';
      case 'PAR':
        return '■';
      case 'PAR+':
        return '▲';
      case 'GAIN':
        return '▲▲';
      default:
        return '•';
    }
  };

  // Build preserved dashboard return query string
  const returnParams = new URLSearchParams();
  if (days > 0) returnParams.set('window', String(days));
  if (filters.suite) returnParams.set('suite', filters.suite);
  if (filters.host) returnParams.set('host', filters.host);
  if (filters.severity) returnParams.set('severity', filters.severity);
  const returnQuery = returnParams.toString();

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur overflow-hidden space-y-4">
      {/* Feed Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white tracking-tight">
              Severity-Sorted Regression Feed
            </h3>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
              FIELD(status) & ABS(Δ%) DESC
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Click any row to open the detailed Compare View between baseline and candidate.
          </p>
        </div>

        <div className="text-xs font-mono text-slate-400">
          Showing <span className="text-white font-bold">{feed.length}</span> comparison records
        </div>
      </div>

      {/* Feed Table / List */}
      {feed.length === 0 ? (
        <div className="p-12 text-center text-slate-400">
          <p className="text-sm font-semibold text-slate-300">No comparisons found matching active filters</p>
          <p className="text-xs text-slate-500 mt-1">
            Try broadening your time window or clearing active filters.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-2.5">Status</th>
                <th scope="col" className="px-4 py-2.5">Candidate Run / Test</th>
                <th scope="col" className="px-4 py-2.5">Suite & Host</th>
                <th scope="col" className="px-4 py-2.5">DB Version</th>
                <th scope="col" className="px-4 py-2.5 text-right">Max Delta @ Threads</th>
                <th scope="col" className="px-4 py-2.5">Linked Baseline</th>
                <th scope="col" className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {feed.map((item) => {
                const isGain = item.maxChangePct > 0;
                const isNegative = item.maxChangePct < 0;
                const compareHref = `/compare?baseline=${item.baselineRunId}&candidate=${item.candidateRunId}${
                  returnQuery ? `&${returnQuery}` : ''
                }`;

                return (
                  <tr
                    key={item.comparisonId}
                    className="group hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Status Badge */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-bold font-mono ${getStatusBadge(
                          item.status
                        )}`}
                      >
                        <span>{getStatusGlyph(item.status)}</span>
                        <span>{item.status}</span>
                      </span>
                    </td>

                    {/* Candidate Test Tag / Name */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-white group-hover:text-blue-400 transition-colors font-mono text-xs">
                          {item.testCaseTag || item.candidateTestName}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Candidate #{item.candidateRunId}
                        </span>
                      </div>
                    </td>

                    {/* Suite & Host */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-300 font-mono text-xs">
                          {item.suiteName}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono truncate max-w-[140px]">
                          {item.hostName}
                        </span>
                      </div>
                    </td>

                    {/* DB Version */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="rounded bg-slate-950 px-2 py-0.5 text-[11px] font-mono text-slate-300 border border-slate-800">
                        {item.dbMaker} {item.dbVersion}
                      </span>
                    </td>

                    {/* Max Delta @ Threads */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex flex-col items-end">
                        <span
                          className={`font-mono font-bold text-xs ${
                            isGain
                              ? 'text-emerald-400'
                              : isNegative && item.status === 'REGRESSED'
                              ? 'text-rose-400'
                              : isNegative && item.status === 'WARNING'
                              ? 'text-amber-400'
                              : 'text-slate-300'
                          }`}
                        >
                          {isGain ? '+' : ''}
                          {item.maxChangePct.toFixed(2)}%
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          @ {item.threadOfMaxChange} threads
                        </span>
                      </div>
                    </td>

                    {/* Baseline Run Name */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-slate-300 font-mono text-xs truncate max-w-[150px]">
                          {item.baselineTestName}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Baseline #{item.baselineRunId}
                        </span>
                      </div>
                    </td>

                    {/* Compare Drill-Down CTA (Milestone 5.5) */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link
                        href={compareHref}
                        className="inline-flex items-center gap-1 rounded-lg border border-blue-500/40 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 hover:border-blue-500 transition-all shadow-sm"
                      >
                        <span>Compare</span>
                        <span>→</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Keyset Pagination Load More (Milestone 5.3) */}
      {hasMore && (
        <div className="p-4 border-t border-slate-800/80 text-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-5 py-2 text-xs font-semibold text-white shadow-md hover:bg-slate-700 hover:border-slate-600 disabled:opacity-50 transition-all"
          >
            {isLoadingMore ? (
              <>
                <span className="animate-spin">↻</span>
                <span>Loading Next Batch...</span>
              </>
            ) : (
              <span>Load More Comparisons (Keyset Pagination) ↓</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
