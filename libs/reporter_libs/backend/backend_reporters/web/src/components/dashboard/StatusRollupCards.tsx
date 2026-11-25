/**
 * #############################################################################
 * # web::src::components::dashboard::StatusRollupCards.tsx
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
 * # 6-state status roll-up summary cards for the dashboard with dual drill-down
 * # links (filtering regression feed and deep-linking to the Run Browser).
 * #############################################################################
 */

'use client';

import React from 'react';
import Link from 'next/link';
import type { DashboardRollup, ComparisonStatus } from '@/lib/domain/types';

interface StatusRollupCardsProps {
  rollups: DashboardRollup[];
  activeSeverity?: string;
  onSelectSeverity: (severity: string | undefined) => void;
  days: number;
}

export function StatusRollupCards({
  rollups,
  activeSeverity,
  onSelectSeverity,
  days,
}: StatusRollupCardsProps) {
  const getCardStyle = (status: ComparisonStatus, isActive: boolean) => {
    switch (status) {
      case 'REGRESSED':
        return {
          glyph: '▼▼▼',
          label: 'REGRESSED',
          border: isActive ? 'border-rose-500 ring-2 ring-rose-500/50' : 'border-rose-500/30 hover:border-rose-500/60',
          bg: 'bg-rose-500/10',
          text: 'text-rose-400',
          badgeBg: 'bg-rose-500/20 text-rose-300',
        };
      case 'WARNING':
        return {
          glyph: '▼▼',
          label: 'WARNING',
          border: isActive ? 'border-amber-500 ring-2 ring-amber-500/50' : 'border-amber-500/30 hover:border-amber-500/60',
          bg: 'bg-amber-500/10',
          text: 'text-amber-400',
          badgeBg: 'bg-amber-500/20 text-amber-300',
        };
      case 'PAR-':
        return {
          glyph: '▼',
          label: 'PAR-',
          border: isActive ? 'border-orange-500 ring-2 ring-orange-500/50' : 'border-orange-500/30 hover:border-orange-500/60',
          bg: 'bg-orange-500/10',
          text: 'text-orange-400',
          badgeBg: 'bg-orange-500/20 text-orange-300',
        };
      case 'PAR':
        return {
          glyph: '■',
          label: 'PAR',
          border: isActive ? 'border-slate-500 ring-2 ring-slate-500/50' : 'border-slate-700 hover:border-slate-600',
          bg: 'bg-slate-800/40',
          text: 'text-slate-300',
          badgeBg: 'bg-slate-700 text-slate-300',
        };
      case 'PAR+':
        return {
          glyph: '▲',
          label: 'PAR+',
          border: isActive ? 'border-teal-500 ring-2 ring-teal-500/50' : 'border-teal-500/30 hover:border-teal-500/60',
          bg: 'bg-teal-500/10',
          text: 'text-teal-400',
          badgeBg: 'bg-teal-500/20 text-teal-300',
        };
      case 'GAIN':
        return {
          glyph: '▲▲',
          label: 'GAIN',
          border: isActive ? 'border-emerald-500 ring-2 ring-emerald-500/50' : 'border-emerald-500/30 hover:border-emerald-500/60',
          bg: 'bg-emerald-500/10',
          text: 'text-emerald-400',
          badgeBg: 'bg-emerald-500/20 text-emerald-300',
        };
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 backdrop-blur grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {rollups.map((r) => {
        const isActive = activeSeverity?.toLowerCase() === r.status.toLowerCase();
        const style = getCardStyle(r.status, isActive);

        return (
          <div
            key={r.status}
            className={`group rounded-xl border p-4 transition-all backdrop-blur ${style.bg} ${style.border} flex flex-col justify-between`}
          >
            <button
              type="button"
              onClick={() => onSelectSeverity(isActive ? undefined : r.status.toLowerCase())}
              className="text-left w-full cursor-pointer focus:outline-none"
              aria-label={`${r.count} comparisons classified as ${r.status} (${r.pctOfTotal}% of total)`}
            >
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className={`font-mono text-xs font-black ${style.text}`}>
                  {style.glyph} {style.label}
                </span>
                <span className={`rounded px-1.5 py-0.2 text-[10px] font-bold font-mono ${style.badgeBg}`}>
                  {r.pctOfTotal}%
                </span>
              </div>

              <div className="text-2xl font-black text-white font-mono tracking-tight">
                {r.count.toLocaleString()}
              </div>
            </button>

            <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
              <button
                type="button"
                onClick={() => onSelectSeverity(isActive ? undefined : r.status.toLowerCase())}
                className="text-slate-400 group-hover:text-slate-200 hover:underline cursor-pointer"
              >
                {isActive ? 'Filtered ✓' : 'Filter feed'}
              </button>

              {/* Dual drill-down link to Run Browser */}
              <Link
                href={`/?days=${days > 0 ? days : ''}`}
                className="text-slate-400 hover:text-white underline"
                title={`Open Run Browser for ${r.status}`}
              >
                Browser →
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
