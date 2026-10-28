/**
 * #############################################################################
 * # web::src::lib::db::queries::compare.ts
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
 * # Replicates TAF's native do_compare() procedure mathematics in SQL, including
 * # workload_hash compatibility enforcement, baseline threshold inheritance,
 * # and comparison delta generation.
 * #############################################################################
 */

import { query } from '../pool';
import { classifyChangePct, DEFAULT_THRESHOLDS } from '../../domain/status';
import type { ComparisonResult, ComparisonDeltaRow, RunSummary } from '../../domain/types';

/**
 * Searches for all valid, compatible baseline runs for a given candidate run.
 * Matches TAF's get_candidate_baselines stored procedure:
 *  - is_baseline = TRUE
 *  - workload_hash matches candidate
 *  - test_timestamp is earlier than candidate
 *  - ordered newest baseline first
 */
export async function getCandidateBaselines(candidateId: string): Promise<RunSummary[]> {
  const candidateSql = `SELECT workload_hash, test_timestamp FROM test_run WHERE id = ?;`;
  const cRows = await query<any[]>(candidateSql, [candidateId]);
  if (!cRows || cRows.length === 0) return [];

  const candidate = cRows[0];
  if (!candidate.workload_hash) return [];

  const sql = `
    SELECT
      r.id,
      r.test_name,
      r.system_id,
      s.host_name,
      s.cpu_model,
      r.suite_name,
      r.suite_version,
      r.db_maker,
      r.db_engine,
      r.db_version,
      r.test_case_tag,
      r.workload_hash,
      r.is_baseline,
      r.baseline_notes,
      r.test_timestamp,
      r.test_duration,
      r.thread_list,
      0 AS result_count,
      0 AS comparison_count
    FROM test_run r
    JOIN system_under_test s ON s.id = r.system_id
    WHERE r.is_baseline = TRUE
      AND r.workload_hash = ?
      AND r.test_timestamp < ?
    ORDER BY r.test_timestamp DESC;
  `;

  const rows = await query<any[]>(sql, [candidate.workload_hash, candidate.test_timestamp]);
  return rows.map((r) => ({
    id: String(r.id),
    testName: r.test_name,
    systemId: String(r.system_id),
    hostName: r.host_name,
    cpuModel: r.cpu_model,
    suiteName: r.suite_name,
    suiteVersion: r.suite_version,
    dbMaker: r.db_maker,
    dbEngine: r.db_engine,
    dbVersion: r.db_version,
    testCaseTag: r.test_case_tag,
    workloadHash: r.workload_hash,
    isBaseline: true,
    baselineNotes: r.baseline_notes,
    testTimestamp: String(r.test_timestamp),
    testDuration: r.test_duration ? Number(r.test_duration) : undefined,
    threadList: r.thread_list,
    threads: [],
    resultCount: 0,
    comparisonCount: 0,
  }));
}

/**
 * Computes the comparison between a baseline run and candidate run.
 * Replicates TAF do_compare() procedure steps 1–5 in SQL:
 *  1. Thresholds read from BASELINE row (not candidate).
 *  2. Workload compatibility enforced via workload_hash.
 *  3. Iterations averaged server-side.
 *  4. Only primary or NULL metric types compared.
 *  5. Max change row selected by largest absolute RAW delta (ORDER BY ABS(raw_diff) DESC).
 */
export interface ComputeComparisonOptions {
  force?: boolean;
  thresholds?: Partial<typeof DEFAULT_THRESHOLDS>;
}

export async function computeComparison(
  baselineId: string,
  candidateId: string,
  options: ComputeComparisonOptions = {}
): Promise<ComparisonResult> {
  // 1. Fetch metadata and thresholds from both runs
  const metaSql = `
    SELECT id, test_name, workload_hash, pct_warning, pct_fail, pct_gain, pct_duration_drift
    FROM test_run
    WHERE id IN (?, ?);
  `;
  const runs = await query<any[]>(metaSql, [baselineId, candidateId]);

  const baselineMeta = runs.find((r) => String(r.id) === String(baselineId));
  const candidateMeta = runs.find((r) => String(r.id) === String(candidateId));

  if (!baselineMeta || !candidateMeta) {
    throw new Error(`One or both test runs not found (baseline: #${baselineId}, candidate: #${candidateId})`);
  }

  const thresholds = {
    pctWarning: Number(options.thresholds?.pctWarning ?? baselineMeta.pct_warning ?? DEFAULT_THRESHOLDS.pctWarning),
    pctFail: Number(options.thresholds?.pctFail ?? baselineMeta.pct_fail ?? DEFAULT_THRESHOLDS.pctFail),
    pctGain: Number(options.thresholds?.pctGain ?? baselineMeta.pct_gain ?? DEFAULT_THRESHOLDS.pctGain),
    pctDurationDrift: Number(options.thresholds?.pctDurationDrift ?? baselineMeta.pct_duration_drift ?? DEFAULT_THRESHOLDS.pctDurationDrift),
  };

  // 2. Compatibility Check (Workload Hash Guard)
  const isCompatible =
    Boolean(baselineMeta.workload_hash) &&
    Boolean(candidateMeta.workload_hash) &&
    baselineMeta.workload_hash === candidateMeta.workload_hash;

  if (!isCompatible && !options.force) {
    return {
      baselineId: String(baselineId),
      candidateId: String(candidateId),
      compatible: false,
      incompatibleReason: `Workloads are incompatible: baseline workload_hash (${baselineMeta.workload_hash || 'none'}) does not match candidate (${candidateMeta.workload_hash || 'none'}). Comparisons across different workloads may yield misleading conclusions.`,
      status: 'PAR',
      thresholds,
      threadOfMaxChange: 0,
      maxChangePct: 0,
      maxChangeValue: 0,
      baselineValueAtMax: 0,
      candidateValueAtMax: 0,
      rows: [],
      storedComparison: null,
    };
  }

  // 3. Compute per-thread, per-metric deltas
  const deltaSql = `
    SELECT
      b.threads,
      b.metric_name,
      COALESCE(MAX(b.metric_unit), '') AS metric_unit,
      AVG(b.metric_value) AS baseline_value,
      AVG(c.metric_value) AS candidate_value,
      (AVG(c.metric_value) - AVG(b.metric_value)) AS raw_diff,
      CASE
        WHEN AVG(b.metric_value) = 0 THEN 0
        ELSE ((AVG(c.metric_value) - AVG(b.metric_value)) / AVG(b.metric_value)) * 100
      END AS change_pct
    FROM results b
    JOIN results c
      ON c.test_run_id = ?
     AND c.threads     = b.threads
     AND c.iteration   = b.iteration
     AND c.metric_name = b.metric_name
     AND (c.metric_type      <=> b.metric_type)
     AND (c.metric_dimension <=> b.metric_dimension)
     AND (c.metric_unit      <=> b.metric_unit)
    WHERE b.test_run_id = ?
      AND (b.metric_type IS NULL OR b.metric_type = 'primary')
    GROUP BY b.threads, b.metric_name
    ORDER BY b.threads ASC, b.metric_name ASC;
  `;

  const rawRows = await query<any[]>(deltaSql, [candidateId, baselineId]);

  if (rawRows.length === 0) {
    return {
      baselineId: String(baselineId),
      candidateId: String(candidateId),
      compatible: true,
      status: 'PAR',
      thresholds,
      threadOfMaxChange: 0,
      maxChangePct: 0,
      maxChangeValue: 0,
      baselineValueAtMax: 0,
      candidateValueAtMax: 0,
      rows: [],
      storedComparison: null,
    };
  }

  // 4. Identify Max Change row by largest absolute RAW difference (matching TAF do_compare)
  // Tie-break deterministically on thread count, then metric name
  let maxRow = rawRows[0];
  let maxAbsRaw = Math.abs(Number(rawRows[0].raw_diff));

  for (let i = 1; i < rawRows.length; i++) {
    const cur = rawRows[i];
    const curAbsRaw = Math.abs(Number(cur.raw_diff));
    if (curAbsRaw > maxAbsRaw) {
      maxAbsRaw = curAbsRaw;
      maxRow = cur;
    }
  }

  const threadOfMaxChange = Number(maxRow.threads);
  const maxChangePct = Number(maxRow.change_pct);
  const maxChangeValue = Number(maxRow.raw_diff);
  const baselineValueAtMax = Number(maxRow.baseline_value);
  const candidateValueAtMax = Number(maxRow.candidate_value);

  // 5. Classify status using baseline-derived thresholds
  const status = classifyChangePct(maxChangePct, thresholds);

  const rows: ComparisonDeltaRow[] = rawRows.map((r) => ({
    threads: Number(r.threads),
    metricName: r.metric_name,
    metricUnit: r.metric_unit,
    baselineValue: Number(r.baseline_value),
    candidateValue: Number(r.candidate_value),
    rawDiff: Number(r.raw_diff),
    changePct: Number(r.change_pct),
    isMaxDelta: r.threads === maxRow.threads && r.metric_name === maxRow.metric_name,
  }));

  // 6. Cross-check against stored test_run_comparison table if TAF already computed it
  const storedSql = `
    SELECT id, status, thread_of_max_change, max_change_pct, max_change_value
    FROM test_run_comparison
    WHERE baseline_run_id = ? AND candidate_run_id = ?;
  `;
  const storedRows = await query<any[]>(storedSql, [baselineId, candidateId]);
  const stored = storedRows.length > 0 ? storedRows[0] : null;

  return {
    baselineId: String(baselineId),
    candidateId: String(candidateId),
    compatible: isCompatible,
    incompatibleReason: !isCompatible
      ? `Workloads are incompatible: baseline workload_hash (${baselineMeta.workload_hash || 'none'}) does not match candidate (${candidateMeta.workload_hash || 'none'}). Comparing anyway as requested.`
      : undefined,
    status,
    thresholds,
    threadOfMaxChange,
    maxChangePct,
    maxChangeValue,
    baselineValueAtMax,
    candidateValueAtMax,
    rows,
    storedComparison: stored
      ? {
          id: String(stored.id),
          status: stored.status,
          threadOfMaxChange: Number(stored.thread_of_max_change),
          maxChangePct: Number(stored.max_change_pct),
          maxChangeValue: Number(stored.max_change_value),
        }
      : null,
  };
}
