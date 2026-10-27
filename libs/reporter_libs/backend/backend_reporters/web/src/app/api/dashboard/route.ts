/**
 * #############################################################################
 * # web::src::app::api::dashboard::route.ts
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
 * # Single-round-trip dashboard aggregation endpoint supporting user-defined
 * # time windows (default: 2 days), multi-dimensional AND filtering, and keyset
 * # pagination on high-frequency benchmark feeds.
 * #############################################################################
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db/pool';
import { decodeCursor, encodeCursor } from '@/lib/api/pagination';
import { apiSuccess, apiError } from '@/lib/api/envelope';
import type { ComparisonStatus, DashboardData, DashboardRollup, DashboardFeedItem } from '@/lib/domain/types';

const DashboardQuerySchema = z.object({
  days: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 2)), // Default 2 days per maintainer guidance
  suite: z.string().optional(),
  host: z.string().optional(),
  metric: z.string().optional(),
  dbVersion: z.string().optional(),
  workloadHash: z.string().optional(),
  tag: z.string().optional(),
  severity: z.string().optional(),
  cursor: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50)),
});

export async function GET(request: NextRequest) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = DashboardQuerySchema.safeParse(searchParams);

  if (!parsed.success) {
    return apiError('INVALID_DASHBOARD_PARAMS', 'Invalid dashboard query parameters', parsed.error.format(), 400);
  }

  const { days, suite, host, metric, dbVersion, workloadHash, tag, severity, cursor, limit } = parsed.data;

  try {
    const conditions: string[] = ['r.test_timestamp >= NOW() - INTERVAL ? DAY'];
    const params: any[] = [days];

    if (suite) {
      conditions.push('r.suite_name = ?');
      params.push(suite);
    }
    if (host) {
      conditions.push('s.host_name = ?');
      params.push(host);
    }
    if (dbVersion) {
      conditions.push('r.db_version = ?');
      params.push(dbVersion);
    }
    if (workloadHash) {
      conditions.push('r.workload_hash = ?');
      params.push(workloadHash);
    }
    if (tag) {
      conditions.push('r.test_case_tag = ?');
      params.push(tag);
    }
    if (severity) {
      conditions.push('LOWER(c.status) = LOWER(?)');
      params.push(severity);
    }

    const whereClause = conditions.join(' AND ');

    // 1. Rollup query: Status breakdown counts within window & filters
    const rollupSql = `
      SELECT
        c.status,
        COUNT(*) AS count
      FROM test_run_comparison c
      JOIN test_run r ON r.id = c.candidate_run_id
      JOIN system_under_test s ON s.id = r.system_id
      WHERE ${whereClause}
      GROUP BY c.status;
    `;
    const rollupRows = await query<any[]>(rollupSql, params);

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

    // 2. Distinct hosts count (for multi-host warning check)
    const hostCountSql = `
      SELECT COUNT(DISTINCT r.system_id) AS host_count
      FROM test_run r
      JOIN system_under_test s ON s.id = r.system_id
      WHERE r.test_timestamp >= NOW() - INTERVAL ? DAY;
    `;
    const [hostRow] = await query<any[]>(hostCountSql, [days]);
    const distinctHostsCount = Number(hostRow?.host_count || 0);
    const multiHostWarning = distinctHostsCount > 1;

    // 3. Regression Feed with keyset pagination
    const feedConditions = [...conditions];
    const feedParams = [...params];

    const cursorObj = decodeCursor(cursor);
    if (cursorObj) {
      feedConditions.push('(c.created_at < ? OR (c.created_at = ? AND c.id < ?))');
      feedParams.push(cursorObj.timestamp, cursorObj.timestamp, cursorObj.id);
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
      WHERE ${feedConditions.join(' AND ')}
      ORDER BY
        FIELD(c.status, 'REGRESSED', 'WARNING', 'PAR-', 'PAR', 'PAR+', 'GAIN'),
        ABS(c.max_change_pct) DESC,
        c.id DESC
      LIMIT ?;
    `;

    feedParams.push(limit + 1);
    const feedRows = await query<any[]>(feedSql, feedParams);

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

    const data: DashboardData = {
      timeWindowDays: days,
      filters: { suite, host, metric, dbVersion, workloadHash, tag, severity },
      rollups,
      feed,
      feedCursor,
      hasMoreFeed,
      totalComparisons,
      multiHostWarning,
      distinctHostsCount,
    };

    return apiSuccess(data);
  } catch (err: any) {
    return apiError('DASHBOARD_QUERY_FAILED', 'Failed to retrieve dashboard aggregation', err?.message, 500);
  }
}
