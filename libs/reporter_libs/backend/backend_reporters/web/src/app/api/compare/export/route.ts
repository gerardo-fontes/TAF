/**
 * #############################################################################
 * # web::src::app::api::compare::export::route.ts
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
 * # Generates a provenance-embedded CSV export of baseline vs candidate
 * # comparison deltas with metadata comments and per-thread metrics.
 * #############################################################################
 */

import { NextRequest, NextResponse } from 'next/server';
import { computeComparison } from '@/lib/db/queries/compare';
import { getRunById } from '@/lib/db/queries/runs';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const baseline = searchParams.get('baseline');
  const candidate = searchParams.get('candidate');
  const force = searchParams.get('force') === 'true';

  if (!baseline || !candidate) {
    return new NextResponse('Both baseline and candidate parameters are required', { status: 400 });
  }

  try {
    const [baselineRun, candidateRun, comparison] = await Promise.all([
      getRunById(baseline),
      getRunById(candidate),
      computeComparison(baseline, candidate, { force: true }),
    ]);

    if (!baselineRun || !candidateRun) {
      return new NextResponse('One or both test runs not found', { status: 404 });
    }

    const lines: string[] = [];

    // Provenance metadata comments
    lines.push('# ==============================================================================');
    lines.push('# TAF Benchmark Comparison Export');
    lines.push(`# Generated At (UTC): ${new Date().toISOString()}`);
    lines.push(`# Baseline Run: ID=#${baselineRun.id} | Suite=${baselineRun.suiteName} | Test=${baselineRun.testName} | DB=${baselineRun.dbMaker} ${baselineRun.dbVersion} | Host=${baselineRun.hostName} | WorkloadHash=${baselineRun.workloadHash || 'none'}`);
    lines.push(`# Candidate Run: ID=#${candidateRun.id} | Suite=${candidateRun.suiteName} | Test=${candidateRun.testName} | DB=${candidateRun.dbMaker} ${candidateRun.dbVersion} | Host=${candidateRun.hostName} | WorkloadHash=${candidateRun.workloadHash || 'none'}`);
    lines.push(`# Thresholds (Inherited from Baseline): Warning=-${comparison.thresholds.pctWarning}% | Fail=-${comparison.thresholds.pctFail}% | Gain=+${comparison.thresholds.pctGain}%`);
    lines.push(`# Overall Status: ${comparison.status}`);
    lines.push(`# Max Change: ${comparison.maxChangePct.toFixed(2)}% (raw diff: ${comparison.maxChangeValue.toFixed(2)}) at ${comparison.threadOfMaxChange} threads`);
    if (!comparison.compatible) {
      lines.push(`# WARNING: Workloads are incompatible (workload_hash mismatch). Exported under force mode.`);
    }
    lines.push('# ==============================================================================');

    // Header row
    lines.push('metric_name,threads,metric_unit,baseline_value,candidate_value,raw_diff,change_pct,is_max_delta');

    // Data rows
    for (const r of comparison.rows) {
      const metric = `"${r.metricName.replace(/"/g, '""')}"`;
      const unit = `"${(r.metricUnit || '').replace(/"/g, '""')}"`;
      lines.push(
        [
          metric,
          r.threads,
          unit,
          r.baselineValue.toFixed(4),
          r.candidateValue.toFixed(4),
          r.rawDiff.toFixed(4),
          r.changePct.toFixed(2),
          r.isMaxDelta ? 'TRUE' : 'FALSE',
        ].join(',')
      );
    }

    const csvContent = lines.join('\n');
    const filename = `taf-comparison-${baseline}-vs-${candidate}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    return new NextResponse(`Export failed: ${err?.message}`, { status: 500 });
  }
}
