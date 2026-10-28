/**
 * #############################################################################
 * # web::src::app::compare::page.tsx
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
 * # Server Component for the Compare View. Validates baseline and candidate IDs,
 * # enforces the workload_hash compatibility guard, renders side-by-side run headers,
 * # greyscale-accessible status badges, and the per-thread delta matrix.
 * #############################################################################
 */

import React from 'react';
import Link from 'next/link';
import { getRunById } from '@/lib/db/queries/runs';
import { computeComparison, getCandidateBaselines } from '@/lib/db/queries/compare';
import { RunHeaderPair } from '@/components/compare/RunHeaderPair';
import { StatusBadge } from '@/components/compare/StatusBadge';
import { CompatibilityGuard } from '@/components/compare/CompatibilityGuard';
import { ThreadScalingChart } from '@/components/compare/ThreadScalingChart';
import { DeltaTable } from '@/components/compare/DeltaTable';

export const dynamic = 'force-dynamic';

interface ComparePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const sp = await searchParams;
  const baselineId = typeof sp.baseline === 'string' ? sp.baseline : undefined;
  const candidateId = typeof sp.candidate === 'string' ? sp.candidate : undefined;
  const isForced = sp.force === 'true';

  // 1. Validate required parameters
  if (!baselineId || !candidateId) {
    return (
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center max-w-xl mx-auto shadow-2xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white">Select Two Runs to Compare</h2>
          <p className="mt-2 text-xs text-slate-400 leading-relaxed">
            Comparison analysis requires both a baseline run and a candidate run. Please return to the Run Browser and select two runs.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-500/25 hover:from-blue-500 hover:to-indigo-500 transition-all"
            >
              ← Open Run Browser
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 2. Fetch baseline and candidate run details
  const [baselineRun, candidateRun] = await Promise.all([
    getRunById(baselineId),
    getRunById(candidateId),
  ]);

  if (!baselineRun || !candidateRun) {
    return (
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-8 text-center max-w-lg mx-auto">
          <h2 className="text-base font-bold text-white">Test Run Not Found</h2>
          <p className="mt-2 text-xs text-rose-300">
            Could not find run records in taf_backend for baseline #{baselineId} and candidate #{candidateId}.
          </p>
          <div className="mt-4">
            <Link href="/" className="text-xs text-white underline hover:text-slate-300">
              Return to Run Browser
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 3. Compute Comparison & Check Compatibility
  const comparison = await computeComparison(baselineId, candidateId, { force: isForced });

  // If incompatible, fetch suggested compatible baselines
  let compatibleBaselines: any[] = [];
  if (!comparison.compatible) {
    compatibleBaselines = await getCandidateBaselines(candidateId);
  }

  // Find metric name for the max delta row
  const maxRow = comparison.rows.find((r) => r.isMaxDelta);

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Side-by-Side Run Headers */}
      <RunHeaderPair baseline={baselineRun} candidate={candidateRun} />

      {/* Compatibility Guard Warning Banner */}
      {!comparison.compatible && (
        <CompatibilityGuard
          baselineId={baselineId}
          candidateId={candidateId}
          baselineHash={baselineRun.workloadHash}
          candidateHash={candidateRun.workloadHash}
          isForced={isForced}
          compatibleBaselines={compatibleBaselines}
        />
      )}

      {/* Comparison Content (Active if compatible or forced) */}
      {(comparison.compatible || isForced) && (
        <>
          {/* Status Badge & Max Delta Callout */}
          <StatusBadge
            status={comparison.status}
            thresholds={comparison.thresholds}
            baselineId={baselineId}
            maxChangePct={comparison.maxChangePct}
            maxChangeValue={comparison.maxChangeValue}
            threadOfMaxChange={comparison.threadOfMaxChange}
            metricName={maxRow?.metricName}
            metricUnit={maxRow?.metricUnit}
          />

          {/* Thread-Scaling Graphic (Baseline vs Candidate across thread counts) */}
          <ThreadScalingChart
            rows={comparison.rows}
            thresholds={comparison.thresholds}
            baselineName={baselineRun.testCaseTag || baselineRun.testName}
            candidateName={candidateRun.testCaseTag || candidateRun.testName}
            threadOfMaxChange={comparison.threadOfMaxChange}
          />

          {/* Delta Matrix Table */}
          <DeltaTable
            rows={comparison.rows}
            thresholds={comparison.thresholds}
            baselineId={baselineId}
            candidateId={candidateId}
          />
        </>
      )}
    </main>
  );
}
