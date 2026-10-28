/**
 * #############################################################################
 * # web::src::components::compare::RunHeaderPair.tsx
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
 * # Side-by-side run header cards comparing baseline and candidate run metadata,
 * # host hardware specs, verbatim baseline notes, and role swapping.
 * #############################################################################
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SwapIcon, StarIcon, CpuIcon } from '../ui/icons';
import type { RunDetail } from '@/lib/domain/types';

interface RunHeaderPairProps {
  baseline: RunDetail;
  candidate: RunDetail;
}

export function RunHeaderPair({ baseline, candidate }: RunHeaderPairProps) {
  const router = useRouter();

  const handleSwap = () => {
    router.replace(`/compare?baseline=${candidate.id}&candidate=${baseline.id}`);
  };

  const exportUrl = `/api/compare/export?baseline=${baseline.id}&candidate=${candidate.id}`;

  return (
    <div className="space-y-4">
      {/* Top action bar: Back link, Swap, Export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          <span>← Back to Run Browser</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSwap}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500 hover:bg-slate-700 hover:text-white transition-all shadow"
            title="Swap baseline and candidate roles"
          >
            <SwapIcon className="w-3.5 h-3.5" />
            <span>Swap Roles</span>
          </button>

          <a
            href={exportUrl}
            download
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-950/40 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-900/60 transition-all shadow"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Side-by-Side Run Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Baseline Card (Slot 1) */}
        <div className="rounded-xl border border-blue-500/30 bg-slate-900/80 p-5 shadow-xl backdrop-blur relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-400 border border-blue-500/30">
              <StarIcon className="w-3 h-3 text-blue-400" />
              SLOT 1: BASELINE
            </span>
            <span className="font-mono text-xs text-slate-400">Run #{baseline.id}</span>
          </div>

          <h2 className="text-lg font-bold text-white tracking-tight">{baseline.testName}</h2>

          {baseline.testCaseTag && (
            <div className="mt-1">
              <span className="font-mono text-xs text-blue-300 bg-blue-950/80 border border-blue-800/60 px-2 py-0.5 rounded">
                {baseline.testCaseTag}
              </span>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs border-t border-slate-800 pt-3">
            <div>
              <span className="text-slate-500 block text-[11px]">Database</span>
              <span className="font-semibold text-slate-200">{baseline.dbMaker}</span>{' '}
              <span className="font-mono text-slate-400">{baseline.dbVersion}</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">Suite</span>
              <span className="font-mono text-slate-200">{baseline.suiteName}</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">System / Host</span>
              <div className="flex items-center gap-1 text-slate-200 font-mono">
                <CpuIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>{baseline.hostName}</span>
              </div>
              <div className="text-[10px] text-slate-500 truncate" title={baseline.cpuModel}>
                {baseline.cpuModel}
              </div>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">Timestamp</span>
              <span className="font-mono text-slate-300">{baseline.testTimestamp}</span>
            </div>
          </div>

          {/* Verbatim Baseline Notes Callout */}
          {baseline.baselineNotes ? (
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 block mb-1">
                Verbatim Baseline Notes
              </span>
              <p className="text-xs text-slate-200 italic font-sans leading-relaxed">
                &ldquo;{baseline.baselineNotes}&rdquo;
              </p>
            </div>
          ) : null}
        </div>

        {/* Candidate Card (Slot 2) */}
        <div className="rounded-xl border border-purple-500/30 bg-slate-900/80 p-5 shadow-xl backdrop-blur relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1 rounded bg-purple-500/10 px-2 py-0.5 text-xs font-semibold text-purple-400 border border-purple-500/30">
              SLOT 2: CANDIDATE
            </span>
            <span className="font-mono text-xs text-slate-400">Run #{candidate.id}</span>
          </div>

          <h2 className="text-lg font-bold text-white tracking-tight">{candidate.testName}</h2>

          {candidate.testCaseTag && (
            <div className="mt-1">
              <span className="font-mono text-xs text-purple-300 bg-purple-950/80 border border-purple-800/60 px-2 py-0.5 rounded">
                {candidate.testCaseTag}
              </span>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs border-t border-slate-800 pt-3">
            <div>
              <span className="text-slate-500 block text-[11px]">Database</span>
              <span className="font-semibold text-slate-200">{candidate.dbMaker}</span>{' '}
              <span className="font-mono text-slate-400">{candidate.dbVersion}</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">Suite</span>
              <span className="font-mono text-slate-200">{candidate.suiteName}</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">System / Host</span>
              <div className="flex items-center gap-1 text-slate-200 font-mono">
                <CpuIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>{candidate.hostName}</span>
              </div>
              <div className="text-[10px] text-slate-500 truncate" title={candidate.cpuModel}>
                {candidate.cpuModel}
              </div>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">Timestamp</span>
              <span className="font-mono text-slate-300">{candidate.testTimestamp}</span>
            </div>
          </div>

          {candidate.comments ? (
            <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Candidate Comments
              </span>
              <p className="text-xs text-slate-300 font-sans leading-relaxed">
                {candidate.comments}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
