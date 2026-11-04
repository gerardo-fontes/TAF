/**
 * #############################################################################
 * # web::src::components::dashboard::SuiteHealthTable.tsx
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
 * # Benchmark suite health scorecard (Milestone 5.4) displaying total runs,
 * # regression counts, and median performance delta per test suite.
 * #############################################################################
 */

'use client';

import React from 'react';
import Link from 'next/link';
import type { DashboardSuiteHealth } from '@/lib/domain/types';

interface SuiteHealthTableProps {
  suites: DashboardSuiteHealth[];
  onSelectSuite: (suite: string) => void;
  days: number;
}

export function SuiteHealthTable({ suites, onSelectSuite, days }: SuiteHealthTableProps) {
  if (suites.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 text-center text-xs text-slate-500">
        No suite telemetry recorded for this time window.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 backdrop-blur space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div>
          <h4 className="text-sm font-bold text-white tracking-tight">Suite Health Scorecard</h4>
          <p className="text-xs text-slate-400">
            Regression frequency and median throughput change across benchmark suites.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans">
          <thead className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400">
            <tr>
              <th scope="col" className="px-3 py-2">Suite Name</th>
              <th scope="col" className="px-3 py-2 text-right">Runs</th>
              <th scope="col" className="px-3 py-2 text-right">Compared</th>
              <th scope="col" className="px-3 py-2 text-right">Regressed</th>
              <th scope="col" className="px-3 py-2 text-right">Warning</th>
              <th scope="col" className="px-3 py-2 text-right">Avg Delta</th>
              <th scope="col" className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50 font-mono">
            {suites.map((s) => {
              const isPositive = s.medianChangePct > 0;
              const isNegative = s.medianChangePct < 0;

              return (
                <tr key={s.suiteName} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-3 py-2 font-bold text-white">
                    <button
                      type="button"
                      onClick={() => onSelectSuite(s.suiteName)}
                      className="hover:text-blue-400 text-left font-mono transition-colors"
                      title="Filter dashboard by this suite"
                    >
                      {s.suiteName}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-300">{s.runCount}</td>
                  <td className="px-3 py-2 text-right text-slate-400">{s.comparisonCount}</td>
                  <td className="px-3 py-2 text-right">
                    {s.regressedCount > 0 ? (
                      <span className="text-rose-400 font-bold">{s.regressedCount}</span>
                    ) : (
                      <span className="text-slate-600">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {s.warningCount > 0 ? (
                      <span className="text-amber-400 font-bold">{s.warningCount}</span>
                    ) : (
                      <span className="text-slate-600">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-bold">
                    <span
                      className={
                        isPositive
                          ? 'text-emerald-400'
                          : isNegative
                          ? 'text-rose-400'
                          : 'text-slate-400'
                      }
                    >
                      {isPositive ? '+' : ''}
                      {s.medianChangePct.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-[11px] font-sans">
                    <Link
                      href={`/?suite=${encodeURIComponent(s.suiteName)}${
                        days > 0 ? `&days=${days}` : ''
                      }`}
                      className="text-blue-400 hover:text-blue-300 underline"
                      title="Inspect runs in Run Browser"
                    >
                      Browser →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
