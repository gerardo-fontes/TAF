/**
 * #############################################################################
 * # web::src::lib::db::queries::dashboard.ts
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
 * # This program is distributed in the hope that it will be useful,
 * # but WITHOUT ANY WARRANTY; without even the implied warranty of
 * # MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * # GNU General Public License for more details.
 * #
 * # You should have received a copy of the GNU General Public License
 * # along with this program; if not, write to the Free Software
 * # Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1335
 * #
 * # Licensed under the GNU General Public License, version 2 or later (GPLv2+).
 * # See https://www.gnu.org/licenses/ for details.
 * #
 * # PURPOSE:
 * # Single-round-trip dashboard aggregation queries: status roll-ups, severity-sorted
 * # regression feeds, daily run timelines, suite health, system inventory, and
 * # baseline coverage metrics.
 * #############################################################################
 */

import { query } from '../pool';
import { decodeCursor, encodeCursor } from '../../api/pagination';
import type {
  ComparisonStatus,
  DashboardFilters,
  DashboardData,
  DashboardRollup,
  DashboardFeedItem,
  DashboardDailyTimelinePoint,
  DashboardSuiteHealth,
  DashboardSystemInventoryItem,
  DashboardBaselineCoverage,
} from '../../domain/types';

/**
 * Builds the parameterized WHERE clause for dashboard queries.
 * Milestone 5.1: Time window (default 2 days; 0 = all historical).
 * Milestone 5.2: Multi-dimensional AND filtering (suite, host, dbVersion, workloadHash, tag, severity).
 *
 * @param filters   Full DashboardFilters (may include severity).
 * @param tableAliases  SQL aliases for the three joined tables.
 * @param includeSeverity  Whether to include the severity/status filter.
 *   Pass `false` for queries that do not join `test_run_comparison` with an
 *   INNER JOIN (timeline, suite health, inventory, coverage all use LEFT JOIN
 *   or omit `c` entirely, so injecting `c.status` would produce a SQL error or
 *   silently drop all LEFT-JOIN rows that have no comparison yet).
 */
export function buildDashboardWhere(
  filters: DashboardFilters,
  tableAliases = { run: 'r', system: 's', comparison: 'c' },
  includeSeverity = true,
): { whereSql: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  const { run, system, comparison } = tableAliases;

  const days = filters.days ?? 2;
  if (days > 0) {
    conditions.push(`${run}.test_timestamp >= NOW() - INTERVAL ? DAY`);
    params.push(days);
  }

  if (filters.suite) {
    conditions.push(`${run}.suite_name = ?`);
    params.push(filters.suite);
  }

  if (filters.host) {
    conditions.push(`${system}.host_name = ?`);
    params.push(filters.host);
  }

  if (filters.dbVersion) {
    conditions.push(`${run}.db_version = ?`);
    params.push(filters.dbVersion);
  }

  if (filters.workloadHash) {
    conditions.push(`${run}.workload_hash = ?`);
    params.push(filters.workloadHash);
  }

  if (filters.tag) {
    conditions.push(`${run}.test_case_tag = ?`);
    params.push(filters.tag);
  }

  if (includeSeverity && filters.severity) {
    conditions.push(`LOWER(${comparison}.status) = LOWER(?)`);
    params.push(filters.severity);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereSql, params };
}

/**
 * Single-request aggregation retrieving all dashboard telemetry in parallel.
 * Milestone 5.4: Status roll-ups, severity-sorted feed, daily timeline,
 * suite health, system inventory, and baseline coverage.
 */
export async function getDashboardData(filters: DashboardFilters = {}): Promise<DashboardData> {
  const days = filters.days ?? 2;
  const limit = filters.limit ?? 50;

  // Build two WHERE variants:
  //  - baseWhere: time window + suite/host/version/tag dims — NO severity.
  //    Used for rollup, timeline, suite health, inventory, coverage so those
  //    aggregate queries are never broken by a severity-only filter and always
  //    show full-context counts.
  //  - feedWhere: same as baseWhere but WITH severity appended.
  //    Used only for the regression feed (query 3) where severity drill-down
  //    is intentional and test_run_comparison is INNER JOINed.
  const { whereSql, params } = buildDashboardWhere(filters, undefined, false);
  const { whereSql: feedWhereSql, params: feedBaseParams } = buildDashboardWhere(filters, undefined, true);

  // 1. Rollup query: Status breakdown counts within window & filters
  const rollupSql = `
    SELECT
      c.status,
      COUNT(*) AS count
    FROM test_run_comparison c
    JOIN test_run r ON r.id = c.candidate_run_id
    JOIN system_under_test s ON s.id = r.system_id
    ${whereSql}
    GROUP BY c.status;
  `;

  // 2. Distinct hosts count (for multi-host warning check)
  const hostCountSql = `
    SELECT COUNT(DISTINCT r.system_id) AS host_count
    FROM test_run r
    JOIN system_under_test s ON s.id = r.system_id
    ${days > 0 ? 'WHERE r.test_timestamp >= NOW() - INTERVAL ? DAY' : ''};
  `;
  const hostCountParams = days > 0 ? [days] : [];

  // 3. Regression Feed with keyset pagination (Milestone 5.3)
  // Uses feedWhereSql which includes severity (safe: feed INNER JOINs c).
  const feedParams: any[] = [...feedBaseParams];
  const feedConditions: string[] = [];

  const cursorObj = decodeCursor(filters.cursor);
  if (cursorObj) {
    feedConditions.push('(c.created_at < ? OR (c.created_at = ? AND c.id < ?))');
    feedParams.push(cursorObj.timestamp, cursorObj.timestamp, cursorObj.id);
  }

  let fullFeedWhere = feedWhereSql;
  if (feedConditions.length > 0) {
    fullFeedWhere = fullFeedWhere
      ? `${fullFeedWhere} AND ${feedConditions.join(' AND ')}`
      : `WHERE ${feedConditions.join(' AND ')}`;
  }

  const feedSql = `
    SELECT
      c.id AS comparison_id,
      c.baseline_run_id,
      c.candidate_run_id,
      c.status,
      c.thread_of_max_change,
      c.max_change_pct,
      c.created_at,
      r.test_name AS candidate_test_name,
      r.suite_name,
      r.db_maker,
      r.db_version,
      r.test_case_tag,
      s.host_name,
      b.test_name AS baseline_test_name,
      b.test_timestamp AS baseline_timestamp
    FROM test_run_comparison c
    JOIN test_run r ON r.id = c.candidate_run_id
    JOIN test_run b ON b.id = c.baseline_run_id
    JOIN system_under_test s ON s.id = r.system_id
    ${fullFeedWhere}
    ORDER BY
      FIELD(c.status, 'REGRESSED', 'WARNING', 'PAR-', 'PAR', 'PAR+', 'GAIN'),
      ABS(c.max_change_pct) DESC,
      c.id DESC
    LIMIT ?;
  `;
  feedParams.push(limit + 1);

  // 4. Daily timeline query (Group by DATE(test_timestamp))
  const timelineSql = `
    SELECT
      DATE_FORMAT(r.test_timestamp, '%Y-%m-%d') AS day_date,
      COUNT(DISTINCT r.id) AS total_runs,
      COUNT(c.id) AS comparison_count,
      SUM(CASE WHEN c.status = 'REGRESSED' THEN 1 ELSE 0 END) AS regressed_count,
      SUM(CASE WHEN c.status = 'WARNING' THEN 1 ELSE 0 END) AS warning_count,
      SUM(CASE WHEN c.status IN ('PAR', 'PAR-', 'PAR+') THEN 1 ELSE 0 END) AS par_count,
      SUM(CASE WHEN c.status = 'GAIN' THEN 1 ELSE 0 END) AS gain_count
    FROM test_run r
    JOIN system_under_test s ON s.id = r.system_id
    LEFT JOIN test_run_comparison c ON c.candidate_run_id = r.id
    ${whereSql}
    GROUP BY day_date
    ORDER BY day_date ASC;
  `;

  // 5. Suite health summary query
  const suiteHealthSql = `
    SELECT
      r.suite_name,
      COUNT(DISTINCT r.id) AS run_count,
      COUNT(c.id) AS comparison_count,
      SUM(CASE WHEN c.status = 'REGRESSED' THEN 1 ELSE 0 END) AS regressed_count,
      SUM(CASE WHEN c.status = 'WARNING' THEN 1 ELSE 0 END) AS warning_count,
      SUM(CASE WHEN c.status = 'GAIN' THEN 1 ELSE 0 END) AS gain_count,
      COALESCE(AVG(c.max_change_pct), 0) AS avg_change_pct
    FROM test_run r
    JOIN system_under_test s ON s.id = r.system_id
    LEFT JOIN test_run_comparison c ON c.candidate_run_id = r.id
    ${whereSql}
    GROUP BY r.suite_name
    ORDER BY regressed_count DESC, comparison_count DESC;
  `;

  // 6. System inventory query
  const inventorySql = `
    SELECT
      s.id AS system_id,
      s.host_name,
      s.cpu_model,
      s.os_arch AS architecture,
      s.ram_gb,
      COUNT(r.id) AS run_count
    FROM system_under_test s
    JOIN test_run r ON r.system_id = s.id
    ${whereSql}
    GROUP BY s.id, s.host_name, s.cpu_model, s.os_arch, s.ram_gb
    ORDER BY run_count DESC;
  `;

  // 7. Baseline coverage metrics
  const coverageSql = `
    SELECT
      COUNT(DISTINCT r.id) AS total_runs,
      SUM(CASE WHEN r.is_baseline = TRUE THEN 1 ELSE 0 END) AS baseline_runs_count,
      COUNT(DISTINCT c.candidate_run_id) AS candidate_with_baseline_count
    FROM test_run r
    JOIN system_under_test s ON s.id = r.system_id
    LEFT JOIN test_run_comparison c ON c.candidate_run_id = r.id
    ${whereSql};
  `;

  // Execute all 7 queries concurrently through the connection pool
  const [
    rollupRows,
    hostRows,
    feedRows,
    timelineRows,
    suiteHealthRows,
    inventoryRows,
    coverageRows,
  ] = await Promise.all([
    query<any[]>(rollupSql, params),
    query<any[]>(hostCountSql, hostCountParams),
    query<any[]>(feedSql, feedParams),
    query<any[]>(timelineSql, params),
    query<any[]>(suiteHealthSql, params),
    query<any[]>(inventorySql, params),
    query<any[]>(coverageSql, params),
  ]);

  // Process Rollups
  let totalComparisons = 0;
  const countMap: Record<string, number> = {};
  for (const r of rollupRows) {
    const cnt = Number(r.count);
    countMap[r.status] = cnt;
    totalComparisons += cnt;
  }

  const allStatuses: ComparisonStatus[] = ['REGRESSED', 'WARNING', 'PAR-', 'PAR', 'PAR+', 'GAIN'];
  const rollups: DashboardRollup[] = allStatuses.map((st) => ({
    status: st,
    count: countMap[st] || 0,
    pctOfTotal: totalComparisons > 0 ? Number((((countMap[st] || 0) / totalComparisons) * 100).toFixed(1)) : 0,
  }));

  // Process Distinct Hosts & Multi-Host Warning
  const distinctHostsCount = Number(hostRows[0]?.host_count || 0);
  const multiHostWarning = distinctHostsCount > 1;

  // Process Keyset Feed (Milestone 5.3)
  const hasMoreFeed = feedRows.length > limit;
  const pageRows = hasMoreFeed ? feedRows.slice(0, limit) : feedRows;

  const feed: DashboardFeedItem[] = pageRows.map((row) => ({
    comparisonId: String(row.comparison_id),
    baselineRunId: String(row.baseline_run_id),
    candidateRunId: String(row.candidate_run_id),
    status: row.status as ComparisonStatus,
    threadOfMaxChange: Number(row.thread_of_max_change),
    maxChangePct: Number(row.max_change_pct),
    createdAt: String(row.created_at),
    candidateTestName: row.candidate_test_name,
    suiteName: row.suite_name,
    dbMaker: row.db_maker,
    dbVersion: row.db_version,
    testCaseTag: row.test_case_tag,
    hostName: row.host_name,
    baselineTestName: row.baseline_test_name,
    baselineTimestamp: String(row.baseline_timestamp),
  }));

  let feedCursor: string | null = null;
  if (hasMoreFeed && feed.length > 0) {
    const last = feed[feed.length - 1];
    feedCursor = encodeCursor(last.createdAt, last.comparisonId);
  }

  // Process Daily Timeline
  const dailyTimeline: DashboardDailyTimelinePoint[] = timelineRows.map((r) => ({
    date: String(r.day_date),
    totalRuns: Number(r.total_runs),
    comparisonCount: Number(r.comparison_count),
    regressedCount: Number(r.regressed_count),
    warningCount: Number(r.warning_count),
    parCount: Number(r.par_count),
    gainCount: Number(r.gain_count),
  }));

  // Process Suite Health
  const suiteHealth: DashboardSuiteHealth[] = suiteHealthRows.map((r) => ({
    suiteName: String(r.suite_name),
    runCount: Number(r.run_count),
    comparisonCount: Number(r.comparison_count),
    regressedCount: Number(r.regressed_count),
    warningCount: Number(r.warning_count),
    gainCount: Number(r.gain_count),
    medianChangePct: Number(Number(r.avg_change_pct).toFixed(2)),
  }));

  // Process System Inventory
  const systemInventory: DashboardSystemInventoryItem[] = inventoryRows.map((r) => ({
    systemId: String(r.system_id),
    hostName: String(r.host_name),
    cpuModel: String(r.cpu_model),
    architecture: String(r.architecture),
    totalRamGb: Number(r.ram_gb),
    runCount: Number(r.run_count),
  }));

  // Process Baseline Coverage
  const covRow = coverageRows[0] || {};
  const totalRuns = Number(covRow.total_runs || 0);
  const baselineRunsCount = Number(covRow.baseline_runs_count || 0);
  const candidateWithBaselineCount = Number(covRow.candidate_with_baseline_count || 0);
  const candidateWithoutBaselineCount = Math.max(0, totalRuns - baselineRunsCount - candidateWithBaselineCount);
  const eligibleCandidates = totalRuns - baselineRunsCount;
  const coveragePct = eligibleCandidates > 0
    ? Number(((candidateWithBaselineCount / eligibleCandidates) * 100).toFixed(1))
    : 100;

  const baselineCoverage: DashboardBaselineCoverage = {
    totalRuns,
    baselineRunsCount,
    candidateWithBaselineCount,
    candidateWithoutBaselineCount,
    coveragePct,
  };

  return {
    timeWindowDays: days,
    filters,
    rollups,
    feed,
    feedCursor,
    hasMoreFeed,
    totalComparisons,
    multiHostWarning,
    distinctHostsCount,
    dailyTimeline,
    suiteHealth,
    systemInventory,
    baselineCoverage,
  };
}
