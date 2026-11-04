/**
 * #############################################################################
 * # web::src::components::dashboard::DashboardHeader.tsx
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
 * # Header for the Automated Results Dashboard: user-defined time window selector
 * # (presets 1d-30d and custom numeric input) plus live polling controls.
 * #############################################################################
 */

'use client';

import React, { useState, useEffect } from 'react';

interface DashboardHeaderProps {
  days: number;
  onSelectDays: (days: number) => void;
  isPaused: boolean;
  onTogglePause: () => void;
  lastUpdated: Date | null;
  isFetching: boolean;
  onRefresh: () => void;
}

const PRESET_DAYS = [
  { label: '24h', value: 1 },
  { label: '2d (Default)', value: 2 },
  { label: '3d', value: 3 },
  { label: '7d', value: 7 },
  { label: '14d', value: 14 },
  { label: '30d', value: 30 },
  { label: 'All Time', value: 0 },
];

export function DashboardHeader({
  days,
  onSelectDays,
  isPaused,
  onTogglePause,
  lastUpdated,
  isFetching,
  onRefresh,
}: DashboardHeaderProps) {
  const [customInput, setCustomInput] = useState('');
  const [isCustomOpen, setIsCustomOpen] = useState(false);

  // Render the "Updated:" timestamp only on the client to avoid SSR/hydration
  // mismatch: toLocaleTimeString() can differ by ≥1 second between server render
  // and client hydration, causing React to report a hydration error.
  const [formattedTime, setFormattedTime] = useState<string | null>(null);
  useEffect(() => {
    setFormattedTime(
      lastUpdated
        ? lastUpdated.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        : '—'
    );
  }, [lastUpdated]);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customInput, 10);
    if (!isNaN(val) && val >= 0) {
      onSelectDays(val);
      setIsCustomOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur shadow-2xl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Title and Scope description */}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Automated Results Dashboard
            </h1>
            <span className="rounded-md bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 text-[11px] font-mono text-blue-300">
              Active Triage
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Real-time telemetry and regression tracking across automated benchmark runs. Click any feed item to inspect comparison details.
          </p>
        </div>

        {/* Polling & Live Controls (Milestone 5.6) */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Live / Paused Status Indicator */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-mono">
            <span className="relative flex h-2.5 w-2.5">
              {!isPaused && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isPaused ? 'bg-amber-400' : 'bg-emerald-500'
                }`}
              />
            </span>
            <span className={isPaused ? 'text-amber-300 font-bold' : 'text-emerald-400 font-semibold'}>
              {isPaused ? 'PAUSED' : 'LIVE'}
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-[11px] text-slate-400">
              {formattedTime !== null ? `Updated: ${formattedTime}` : null}
            </span>
          </div>

          {/* Pause / Resume Button */}
          <button
            type="button"
            onClick={onTogglePause}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
              isPaused
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                : 'border-slate-800 bg-slate-950 text-slate-300 hover:text-white hover:border-slate-700'
            }`}
          >
            {isPaused ? '▶ Resume Live' : '⏸ Pause Live'}
          </button>

          {/* Manual Refresh Button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isFetching}
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700 disabled:opacity-50 transition-all"
            title="Refresh dashboard data immediately"
          >
            <span className={isFetching ? 'animate-spin' : ''}>↻</span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Milestone 5.1: Time Window Selector (Presets & Custom Input) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-400 mr-1.5">Time Window:</span>
          {PRESET_DAYS.map((preset) => {
            const isSelected = days === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => onSelectDays(preset.value)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-600/90 text-white shadow-sm shadow-blue-500/20 font-bold'
                    : 'border-slate-800 bg-slate-950/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {preset.label}
              </button>
            );
          })}

          {/* Custom Days Input */}
          {!isCustomOpen ? (
            <button
              type="button"
              onClick={() => setIsCustomOpen(true)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                !PRESET_DAYS.some((p) => p.value === days)
                  ? 'border-blue-500 bg-blue-600/90 text-white font-bold'
                  : 'border-slate-800 bg-slate-950/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              {!PRESET_DAYS.some((p) => p.value === days) ? `Custom (${days}d)` : '+ Custom Days'}
            </button>
          ) : (
            <form onSubmit={handleCustomSubmit} className="flex items-center gap-1">
              <input
                type="number"
                min="1"
                max="365"
                placeholder="Days"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                className="w-16 rounded-lg border border-blue-500 bg-slate-950 px-2 py-0.5 text-xs text-white focus:outline-none font-mono"
                autoFocus
              />
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-2 py-0.5 text-xs font-bold text-white hover:bg-blue-500"
              >
                Set
              </button>
              <button
                type="button"
                onClick={() => setIsCustomOpen(false)}
                className="text-xs text-slate-400 hover:text-white px-1"
              >
                ✕
              </button>
            </form>
          )}
        </div>

        <div className="text-[11px] font-mono text-slate-500">
          Filtering: <span className="text-slate-300 font-semibold">{days > 0 ? `Past ${days} Days` : 'Full History'}</span>
        </div>
      </div>
    </div>
  );
}
