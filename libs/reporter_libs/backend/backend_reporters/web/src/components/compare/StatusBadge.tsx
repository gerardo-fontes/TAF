/**
 * #############################################################################
 * # web::src::components::compare::StatusBadge.tsx
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
 * # Greyscale-accessible comparison status badge with distinct directional glyphs
 * # (▲, ▼, ■), threshold provenance subtext, and max change metric summary.
 * #############################################################################
 */

import React from 'react';
import type { ComparisonStatus, Thresholds } from '@/lib/domain/types';

interface StatusBadgeProps {
  status: ComparisonStatus;
  thresholds: Thresholds;
  baselineId: string;
  maxChangePct: number;
  maxChangeValue: number;
  threadOfMaxChange: number;
  metricName?: string;
  metricUnit?: string;
}

export function StatusBadge({
  status,
  thresholds,
  baselineId,
  maxChangePct,
  maxChangeValue,
  threadOfMaxChange,
  metricName,
  metricUnit,
}: StatusBadgeProps) {
  const getStatusConfig = (st: ComparisonStatus) => {
    switch (st) {
      case 'GAIN':
        return {
          glyph: '▲▲',
          label: 'GAIN',
          bg: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 ring-emerald-500/20',
          dotBg: 'bg-emerald-400',
          description: `Performance improved beyond +${thresholds.pctGain}% gain threshold`,
        };
      case 'PAR+':
        return {
          glyph: '▲',
          label: 'PAR+',
          bg: 'bg-teal-500/15 border-teal-500/40 text-teal-300 ring-teal-500/20',
          dotBg: 'bg-teal-400',
          description: `Slight positive change within +1% to +${thresholds.pctGain}%`,
        };
      case 'PAR':
        return {
          glyph: '■',
          label: 'PAR',
          bg: 'bg-slate-700/30 border-slate-600/40 text-slate-200 ring-slate-600/20',
          dotBg: 'bg-slate-400',
          description: 'Performance parity within neutral ±1% band',
        };
      case 'PAR-':
        return {
          glyph: '▼',
          label: 'PAR-',
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-200/90 ring-amber-500/10',
          dotBg: 'bg-amber-300',
          description: `Slight negative change within -1% to -${thresholds.pctWarning}%`,
        };
      case 'WARNING':
        return {
          glyph: '▼▼',
          label: 'WARNING',
          bg: 'bg-amber-500/20 border-amber-500/50 text-amber-300 ring-amber-500/30',
          dotBg: 'bg-amber-400',
          description: `Moderate drop exceeding -${thresholds.pctWarning}% warning threshold`,
        };
      case 'REGRESSED':
        return {
          glyph: '▼▼▼',
          label: 'REGRESSED',
          bg: 'bg-rose-500/20 border-rose-500/50 text-rose-300 ring-rose-500/30',
          dotBg: 'bg-rose-400',
          description: `Severe regression exceeding -${thresholds.pctFail}% failure threshold`,
        };
    }
  };

  const config = getStatusConfig(status);
  const sign = maxChangePct > 0 ? '+' : '';

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Status Pill & Label */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 font-mono text-sm font-bold shadow-sm ring-1 ${config.bg}`}
            role="status"
            aria-label={`Comparison status: ${config.label}`}
          >
            <span className="text-base select-none" aria-hidden="true">
              {config.glyph}
            </span>
            <span className="tracking-wider">{config.label}</span>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-200">{config.description}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Thresholds: <span className="font-mono text-slate-300">-{thresholds.pctWarning}% warn</span> /{' '}
              <span className="font-mono text-slate-300">-{thresholds.pctFail}% fail</span> /{' '}
              <span className="font-mono text-slate-300">+{thresholds.pctGain}% gain</span>{' '}
              <span className="text-slate-500">(inherited from baseline #{baselineId})</span>
            </div>
          </div>
        </div>

        {/* Max Change Delta Callout */}
        <div className="flex items-center gap-4 border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-4">
          <div className="text-right sm:text-right">
            <span className="block text-[11px] font-medium text-slate-400">Max Delta</span>
            <span
              className={`font-mono text-lg font-bold ${
                maxChangePct > 0
                  ? 'text-emerald-400'
                  : maxChangePct < -thresholds.pctWarning
                  ? 'text-rose-400'
                  : 'text-slate-200'
              }`}
            >
              {sign}{maxChangePct.toFixed(2)}%
            </span>
          </div>

          <div className="text-left text-xs text-slate-400 font-mono">
            <div>
              {metricName || 'Metric'}: <span className="text-white font-semibold">{sign}{maxChangeValue.toFixed(2)} {metricUnit}</span>
            </div>
            <div className="text-[11px] text-slate-500 font-sans">
              at <span className="font-mono text-slate-300 font-medium">{threadOfMaxChange}</span> threads
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
