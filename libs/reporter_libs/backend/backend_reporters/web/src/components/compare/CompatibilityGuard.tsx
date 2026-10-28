/**
 * #############################################################################
 * # web::src::components::compare::CompatibilityGuard.tsx
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
 * # Workload compatibility guard banner warning when workload_hash values differ,
 * # displaying compatible baseline suggestions and a force override toggle.
 * #############################################################################
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { StarIcon } from '../ui/icons';
import type { RunSummary } from '@/lib/domain/types';

interface CompatibilityGuardProps {
  baselineId: string;
  candidateId: string;
  baselineHash?: string;
  candidateHash?: string;
  isForced: boolean;
  compatibleBaselines: RunSummary[];
}

export function CompatibilityGuard({
  baselineId,
  candidateId,
  baselineHash,
  candidateHash,
  isForced,
  compatibleBaselines,
}: CompatibilityGuardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const toggleForce = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (isForced) {
      params.delete('force');
    } else {
      params.set('force', 'true');
    }
    router.replace(`/compare?${params.toString()}`);
  };

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 backdrop-blur shadow-xl space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-amber-500/20 p-2 text-amber-400 shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <div className="flex-1">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            Workload Incompatibility Guard Active
          </h3>
          <p className="text-xs text-amber-200/90 mt-1 leading-relaxed">
            The selected baseline (Hash: <code className="font-mono text-white bg-amber-950/60 px-1 py-0.5 rounded">{baselineHash?.slice(0, 12) || 'none'}...</code>) and candidate (Hash: <code className="font-mono text-white bg-amber-950/60 px-1 py-0.5 rounded">{candidateHash?.slice(0, 12) || 'none'}...</code>) have differing workload shapes (e.g. scale factor, tables, or benchmark parameters). Comparisons between differing workloads are mathematically invalid in TAF.
          </p>

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={toggleForce}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition-colors shadow-sm"
            >
              {isForced ? 'Hide Forced Comparison' : 'Show Comparison Anyway (Opt-in)'}
            </button>
          </div>
        </div>
      </div>

      {/* Suggested Compatible Baselines */}
      {compatibleBaselines.length > 0 && (
        <div className="border-t border-amber-500/20 pt-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300 block mb-2">
            Suggested Compatible Baselines for Candidate #{candidateId}:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {compatibleBaselines.map((b) => (
              <Link
                key={b.id}
                href={`/compare?baseline=${b.id}&candidate=${candidateId}`}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-blue-500 hover:bg-blue-950/30 transition-all text-xs group"
              >
                <div className="flex items-center gap-2">
                  <StarIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <div>
                    <span className="font-mono font-bold text-white group-hover:text-blue-300">
                      #{b.id}
                    </span>{' '}
                    <span className="text-slate-300">{b.testCaseTag || b.testName}</span>
                    <span className="block text-[10px] text-slate-500 font-mono">
                      {b.dbMaker} {b.dbVersion} • {b.hostName}
                    </span>
                  </div>
                </div>
                <span className="text-blue-400 font-medium text-[11px] group-hover:translate-x-0.5 transition-transform">
                  Switch →
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
