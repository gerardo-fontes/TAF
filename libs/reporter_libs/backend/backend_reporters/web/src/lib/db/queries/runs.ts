/**
 * #############################################################################
 * # web::src::lib::db::queries::runs.ts
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
 * # Read-only queries for browsing, filtering, and retrieving test run details
 * # with keyset pagination and subquery aggregates.
 * #############################################################################
 */

import { query } from '../pool';
import { parseThreadList } from '../../domain/threads';
import { decodeCursor, encodeCursor } from '../../api/pagination';
import type { RunSummary, RunDetail } from '../../domain/types';

export interface RunFilters {
  suite?: string;
  host?: string;
  systemId?: string;
  dbMaker?: string;
  dbVersion?: string;
  workloadHash?: string;
  tag?: string;
  isBaseline?: boolean;
  days?: number;
  search?: string;
  cursor?: string | null;
  limit?: number;
}

export interface ListRunsResult {
  data: RunSummary[];
  meta: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

/**
 * Lists test runs using keyset pagination over (test_timestamp DESC, id DESC).
 * Performs server-side aggregation for result and comparison counts.
 */
export async function listRuns(filters: RunFilters = {}): Promise<ListRunsResult> {
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);
  const conditions: string[] = ['1=1'];
  const params: any[] = [];

  if (filters.suite) {
    conditions.push('r.suite_name = ?');
    params.push(filters.suite);
  }

  if (filters.host) {
    conditions.push('s.host_name = ?');
    params.push(filters.host);
  }

  if (filters.systemId) {
    conditions.push('r.system_id = ?');
    params.push(filters.systemId);
  }

  if (filters.dbMaker) {
    conditions.push('r.db_maker = ?');
    params.push(filters.dbMaker);
  }

  if (filters.dbVersion) {
    conditions.push('r.db_version = ?');
    params.push(filters.dbVersion);
  }

  if (filters.workloadHash) {
    conditions.push('r.workload_hash = ?');
    params.push(filters.workloadHash);
  }

  if (filters.tag) {
    conditions.push('r.test_case_tag = ?');
    params.push(filters.tag);
  }

  if (typeof filters.isBaseline === 'boolean') {
    conditions.push('r.is_baseline = ?');
    params.push(filters.isBaseline ? 1 : 0);
  }

  if (filters.days && filters.days > 0) {
    conditions.push('r.test_timestamp >= NOW() - INTERVAL ? DAY');
    params.push(filters.days);
  }

  if (filters.search) {
    conditions.push('(r.test_name LIKE ? OR r.test_case_tag LIKE ? OR r.comments LIKE ?)');
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }

  // Keyset cursor handling
  const cursorObj = decodeCursor(filters.cursor);
  if (cursorObj) {
    conditions.push('(r.test_timestamp < ? OR (r.test_timestamp = ? AND r.id < ?))');
    params.push(cursorObj.timestamp, cursorObj.timestamp, cursorObj.id);
  }

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
      COALESCE(res.result_count, 0) AS result_count,
      COALESCE(cmp.comparison_count, 0) AS comparison_count
    FROM test_run r
    JOIN system_under_test s ON s.id = r.system_id
    LEFT JOIN (
      SELECT test_run_id, COUNT(*) AS result_count
      FROM results
      GROUP BY test_run_id
    ) res ON res.test_run_id = r.id
    LEFT JOIN (
      SELECT candidate_run_id, COUNT(*) AS comparison_count
      FROM test_run_comparison
      GROUP BY candidate_run_id
    ) cmp ON cmp.candidate_run_id = r.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY r.test_timestamp DESC, r.id DESC
    LIMIT ?;
  `;

  // Fetch limit + 1 to detect if a next page exists
  params.push(limit + 1);
  const rows = await query<any[]>(sql, params);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  const data: RunSummary[] = pageRows.map((row) => ({
    id: String(row.id),
    testName: row.test_name,
    systemId: String(row.system_id),
    hostName: row.host_name,
    cpuModel: row.cpu_model,
    suiteName: row.suite_name,
    suiteVersion: row.suite_version,
    dbMaker: row.db_maker,
    dbEngine: row.db_engine,
    dbVersion: row.db_version,
    testCaseTag: row.test_case_tag,
    workloadHash: row.workload_hash,
    isBaseline: Boolean(row.is_baseline),
    baselineNotes: row.baseline_notes,
    testTimestamp: String(row.test_timestamp),
    testDuration: row.test_duration ? Number(row.test_duration) : undefined,
    threadList: row.thread_list,
    threads: parseThreadList(row.thread_list),
    resultCount: Number(row.result_count),
    comparisonCount: Number(row.comparison_count),
  }));

  let nextCursor: string | null = null;
  if (hasMore && data.length > 0) {
    const last = data[data.length - 1];
    nextCursor = encodeCursor(last.testTimestamp, last.id);
  }

  return {
    data,
    meta: {
      nextCursor,
      hasMore,
    },
  };
}

/**
 * Retrieves full details for a single test run by ID, including system specs
 * and resolved database configuration parameters.
 */
export async function getRunById(id: string): Promise<RunDetail | null> {
  const runSql = `
    SELECT
      r.*,
      s.host_name,
      s.cpu_model,
      s.cpu_count,
      s.core_count,
      s.socket_count,
      s.ram_gb,
      s.ram_raw,
      s.os_name,
      s.os_version,
      s.os_kernel,
      s.os_arch,
      s.system_hash,
      cfg.config_name,
      cfg.config_hash
    FROM test_run r
    JOIN system_under_test s ON s.id = r.system_id
    LEFT JOIN db_config_set cfg ON cfg.id = r.config_id
    WHERE r.id = ?;
  `;

  const rows = await query<any[]>(runSql, [id]);
  if (!rows || rows.length === 0) {
    return null;
  }

  const r = rows[0];

  // Load config parameters if config_id exists
  let configParams: { parameterName: string; parameterValue: string }[] = [];
  if (r.config_id) {
    const paramSql = `
      SELECT parameter_name, parameter_value
      FROM db_config_param
      WHERE config_id = ?
      ORDER BY parameter_name ASC;
    `;
    const pRows = await query<any[]>(paramSql, [r.config_id]);
    configParams = pRows.map((p) => ({
      parameterName: p.parameter_name,
      parameterValue: p.parameter_value,
    }));
  }

  // Load counts
  const countsSql = `
    SELECT
      (SELECT COUNT(*) FROM results WHERE test_run_id = ?) AS result_count,
      (SELECT COUNT(*) FROM test_run_comparison WHERE candidate_run_id = ?) AS comparison_count;
  `;
  const [counts] = await query<any[]>(countsSql, [id, id]);

  return {
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
    isBaseline: Boolean(r.is_baseline),
    baselineNotes: r.baseline_notes,
    testTimestamp: String(r.test_timestamp),
    testDuration: r.test_duration ? Number(r.test_duration) : undefined,
    threadList: r.thread_list,
    threads: parseThreadList(r.thread_list),
    resultCount: Number(counts?.result_count || 0),
    comparisonCount: Number(counts?.comparison_count || 0),
    tafHarnessName: r.taf_harness_name,
    tafHarnessVersion: r.taf_harness_version,
    clientProgram: r.client_program,
    clientVersion: r.client_version,
    dbUser: r.db_user,
    dbPort: r.db_port ? Number(r.db_port) : undefined,
    databaseUnderTest: r.database_under_test,
    configId: r.config_id ? String(r.config_id) : undefined,
    pctWarning: Number(r.pct_warning ?? 3),
    pctFail: Number(r.pct_fail ?? 5),
    pctGain: Number(r.pct_gain ?? 5),
    pctDurationDrift: Number(r.pct_duration_drift ?? 10),
    testType: r.test_type,
    comments: r.comments,
    system: {
      id: String(r.system_id),
      hostName: r.host_name,
      cpuModel: r.cpu_model,
      cpuCount: Number(r.cpu_count),
      coreCount: Number(r.core_count),
      socketCount: Number(r.socket_count),
      ramGb: Number(r.ram_gb),
      ramRaw: r.ram_raw,
      osName: r.os_name,
      osVersion: r.os_version,
      osKernel: r.os_kernel,
      osArch: r.os_arch,
      systemHash: r.system_hash,
    },
    config: r.config_id
      ? {
          id: String(r.config_id),
          configName: r.config_name,
          configHash: r.config_hash,
          parameters: configParams,
        }
      : undefined,
  };
}
