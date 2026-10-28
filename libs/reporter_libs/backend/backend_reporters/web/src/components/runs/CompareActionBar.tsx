/**
 * #############################################################################
 * # web::src::components::runs::CompareActionBar.tsx
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
 * # Floating action bar displaying selected baseline and candidate runs,
 * # with role swapping, clear action, and navigation to the Compare view.
 * #############################################################################
 */

'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useSelectionStore } from '@/stores/selection';
import { SwapIcon, ArrowRightIcon, CloseIcon, StarIcon } from '../ui/icons';

export function CompareActionBar() {
  const { baseline, candidate, swapRoles, clearSelection, toggleRun } = useSelectionStore();

  const count = (baseline ? 1 : 0) + (candidate ? 1 : 0);

  // Allow ESC key to dismiss selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && count > 0) {
        clearSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [count, clearSelection]);

  if (count === 0) {
    return null;
  }

  const canCompare = Boolean(baseline && candidate);
  const compareHref = canCompare ? `/compare?baseline=${baseline?.id}&candidate=${candidate?.id}` : '#';

  return (
    <aside
      role="region"
      aria-label="Run comparison selection toolbar"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-200"
    >
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-blue-500/30 bg-slate-900/95 p-3.5 shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
        {/* Selection Slots */}
        <div className="flex flex-1 items-center gap-2 overflow-x-auto">
          {/* Slot 1: Baseline */}
          <div className="flex items-center gap-2 rounded-xl border border-blue-500/40 bg-blue-950/40 px-3 py-2 text-xs">
            <span className="flex items-center gap-1 font-semibold uppercase tracking-wider text-blue-400 text-[10px]">
              <StarIcon className="w-3 h-3 text-blue-400" />
              Baseline:
            </span>
            {baseline ? (
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-white">#{baseline.id}</span>
                <span className="text-slate-300 font-medium truncate max-w-[140px]">
                  {baseline.testCaseTag || baseline.testName}
                </span>
                <button
                  type="button"
                  onClick={() => toggleRun(baseline)}
                  className="rounded p-0.5 text-slate-400 hover:bg-blue-900/50 hover:text-white"
                  title="Remove baseline"
                  aria-label="Remove baseline run"
                >
                  <CloseIcon className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <span className="text-slate-500 italic">Select from table</span>
            )}
          </div>

          {/* Swap Button */}
          <button
            type="button"
            onClick={swapRoles}
            disabled={!baseline || !candidate}
            className="flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 transition-all hover:border-slate-500 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
            title="Swap baseline and candidate roles"
            aria-label="Swap baseline and candidate roles"
          >
            <SwapIcon className="w-4 h-4" />
          </button>

          {/* Slot 2: Candidate */}
          <div className="flex items-center gap-2 rounded-xl border border-purple-500/40 bg-purple-950/40 px-3 py-2 text-xs">
            <span className="font-semibold uppercase tracking-wider text-purple-400 text-[10px]">
              Candidate:
            </span>
            {candidate ? (
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-white">#{candidate.id}</span>
                <span className="text-slate-300 font-medium truncate max-w-[140px]">
                  {candidate.testCaseTag || candidate.testName}
                </span>
                <button
                  type="button"
                  onClick={() => toggleRun(candidate)}
                  className="rounded p-0.5 text-slate-400 hover:bg-purple-900/50 hover:text-white"
                  title="Remove candidate"
                  aria-label="Remove candidate run"
                >
                  <CloseIcon className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <span className="text-slate-500 italic">Select second run</span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={clearSelection}
            className="rounded-lg px-2.5 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            Clear (Esc)
          </button>

          {canCompare ? (
            <Link
              href={compareHref}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/25 hover:from-blue-500 hover:to-indigo-500 hover:shadow-blue-500/40 transition-all"
            >
              <span>Compare 2 Runs</span>
              <ArrowRightIcon className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-500 cursor-not-allowed border border-slate-700/60"
            >
              Select 1 More Run
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
