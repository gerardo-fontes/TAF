/**
 * #############################################################################
 * # web::src::components::dashboard::SystemInventoryAndCoverage.tsx
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
 * # System hardware inventory and baseline coverage progress meter (Milestone 5.4),
 * # including the "no-baseline" uncompared runs drill-down path (Milestone 5.5).
 * #############################################################################
 */

'use client';

import React from 'react';
import Link from 'next/link';
import type { DashboardSystemInventoryItem, DashboardBaselineCoverage } from '@/lib/domain/types';

interface SystemInventoryAndCoverageProps {
  systems: DashboardSystemInventoryItem[];
  coverage: DashboardBaselineCoverage;
  days: number;
}

export function SystemInventoryAndCoverage({
  systems,
  coverage,
  days,
}: SystemInventoryAndCoverageProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 1. Baseline Coverage Meter */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 backdrop-blur space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div>
            <h4 className="text-sm font-bold text-white tracking-tight">Baseline Coverage Metric</h4>
            <p className="text-xs text-slate-400">
              Proportion of incoming candidate runs successfully paired with an official baseline.
            </p>
          </div>
          <span className="font-mono text-base font-black text-blue-400">
            {coverage.coveragePct}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="h-3 w-full rounded-full bg-slate-950 overflow-hidden border border-slate-800 p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, coverage.coveragePct))}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono pt-1">
            <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
              <span className="block text-slate-500 text-[10px]">Total Runs</span>
              <span className="text-white font-bold">{coverage.totalRuns}</span>
            </div>
            <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
              <span className="block text-slate-500 text-[10px]">Paired Baselines</span>
              <span className="text-emerald-400 font-bold">{coverage.candidateWithBaselineCount}</span>
            </div>
            <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
              <span className="block text-slate-500 text-[10px]">Unpaired Runs</span>
              <span className={coverage.candidateWithoutBaselineCount > 0 ? 'text-amber-400 font-bold' : 'text-slate-400 font-bold'}>
                {coverage.candidateWithoutBaselineCount}
              </span>
            </div>
          </div>
        </div>

        {/* No Baseline Guidance (Milestone 5.5) */}
        {coverage.candidateWithoutBaselineCount > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200/90 flex items-center justify-between gap-3">
            <span>
              {coverage.candidateWithoutBaselineCount} candidate runs lack a compatible baseline.
            </span>
            <Link
              href={`/?baseline=false${days > 0 ? `&days=${days}` : ''}`}
              className="rounded bg-amber-500/20 px-2 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/30 shrink-0 transition-colors"
            >
              Pair Runs →
            </Link>
          </div>
        )}
      </div>

      {/* 2. System Hardware Inventory */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 backdrop-blur space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div>
            <h4 className="text-sm font-bold text-white tracking-tight">Active Systems Inventory</h4>
            <p className="text-xs text-slate-400">
              Hardware platforms running benchmarks during this period.
            </p>
          </div>
          <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-mono text-slate-300">
            {systems.length} machines
          </span>
        </div>

        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
          {systems.map((s) => (
            <div
              key={s.systemId}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-800/80 bg-slate-950/70 p-2.5 text-xs font-mono hover:border-slate-700 transition-colors"
            >
              <div className="min-w-0">
                <span className="font-bold text-white block truncate">{s.hostName}</span>
                <span className="text-[10px] text-slate-400 block truncate max-w-[280px]">
                  {s.cpuModel || 'Generic CPU'} • {s.totalRamGb || '—'} GB RAM
                </span>
              </div>
              <div className="text-right shrink-0">
                <span className="rounded bg-blue-500/10 text-blue-400 px-2 py-0.5 text-[11px] font-bold border border-blue-500/20">
                  {s.runCount} runs
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
