/**
 * #############################################################################
 * # web::src::lib::db::queries::dashboard.spec.ts
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
 * # Unit and integration tests for dashboard queries: roll-up parity with direct SQL,
 * # multi-dimensional filtering, time window constraints, keyset pagination,
 * # and aggregation payload completeness.
 * #############################################################################
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPool, query } from '../pool';
import { getDashboardData, buildDashboardWhere } from './dashboard';

describe('dashboard queries', () => {
  beforeAll(async () => {
    const [alive] = await query<any[]>('SELECT 1 AS alive;');
    expect(alive).toBeDefined();
  });

  afterAll(async () => {
    const p = getPool();
    await p.end();
  });

  it('generates parameterized WHERE clause with zero SQL concatenation', () => {
    const filters = {
      days: 7,
      suite: 'hammerdb-tpcc',
      host: 'benchmark-node-01',
      dbVersion: '11.8.0',
      workloadHash: 'hash123',
      tag: 'MDEV-39497',
      severity: 'regressed',
    };

    const { whereSql, params } = buildDashboardWhere(filters);
    expect(whereSql).toContain('r.test_timestamp >= NOW() - INTERVAL ? DAY');
    expect(whereSql).toContain('r.suite_name = ?');
    expect(whereSql).toContain('s.host_name = ?');
    expect(whereSql).toContain('r.db_version = ?');
    expect(whereSql).toContain('r.workload_hash = ?');
    expect(whereSql).toContain('r.test_case_tag = ?');
    expect(whereSql).toContain('LOWER(c.status) = LOWER(?)');
    expect(params).toEqual([
      7,
      'hammerdb-tpcc',
      'benchmark-node-01',
      '11.8.0',
      'hash123',
      'MDEV-39497',
      'regressed',
    ]);
  });

  it('omits timestamp filter when days is 0 (all history)', () => {
    const { whereSql, params } = buildDashboardWhere({ days: 0 });
    expect(whereSql).toBe('');
    expect(params).toEqual([]);
  });

  it('retrieves complete single-round-trip aggregation payload', async () => {
    // Retrieve historical data across 30 days
    const data = await getDashboardData({ days: 30 });

    // Verify root envelope
    expect(data.timeWindowDays).toBe(30);
    expect(data.rollups).toBeDefined();
    expect(data.rollups.length).toBe(6); // REGRESSED, WARNING, PAR-, PAR, PAR+, GAIN
    expect(data.feed).toBeDefined();
    expect(data.dailyTimeline).toBeDefined();
    expect(data.suiteHealth).toBeDefined();
    expect(data.systemInventory).toBeDefined();
    expect(data.baselineCoverage).toBeDefined();

    // Verify baseline coverage structure
    expect(data.baselineCoverage.totalRuns).toBeGreaterThanOrEqual(1);
    expect(typeof data.baselineCoverage.coveragePct).toBe('number');
  });

  it('matches direct SQL count for status rollups (parity test)', async () => {
    const windowDays = 30;
    const directRows = await query<any[]>(
      `SELECT c.status, COUNT(*) AS count
       FROM test_run_comparison c
       JOIN test_run r ON r.id = c.candidate_run_id
       WHERE r.test_timestamp >= NOW() - INTERVAL ? DAY
       GROUP BY c.status;`,
      [windowDays]
    );

    const data = await getDashboardData({ days: windowDays });
    const directMap: Record<string, number> = {};
    for (const r of directRows) {
      directMap[r.status] = Number(r.count);
    }

    for (const rollup of data.rollups) {
      const expectedCount = directMap[rollup.status] || 0;
      expect(rollup.count).toBe(expectedCount);
    }
  });

  it('orders regression feed by severity first, then magnitude DESC', async () => {
    const data = await getDashboardData({ days: 30, limit: 10 });
    if (data.feed.length >= 2) {
      const severityRank: Record<string, number> = {
        REGRESSED: 1,
        WARNING: 2,
        'PAR-': 3,
        PAR: 4,
        'PAR+': 5,
        GAIN: 6,
      };

      for (let i = 0; i < data.feed.length - 1; i++) {
        const cur = data.feed[i];
        const next = data.feed[i + 1];
        const curRank = severityRank[cur.status] || 99;
        const nextRank = severityRank[next.status] || 99;

        expect(curRank).toBeLessThanOrEqual(nextRank);
        if (curRank === nextRank) {
          expect(Math.abs(cur.maxChangePct)).toBeGreaterThanOrEqual(
            Math.abs(next.maxChangePct) - 0.01 // tolerance for precision
          );
        }
      }
    }
  });

  it('filters dashboard data by suite name', async () => {
    const data = await getDashboardData({ days: 30, suite: 'hammerdb-tpcc' });
    for (const item of data.feed) {
      expect(item.suiteName).toBe('hammerdb-tpcc');
    }
    for (const sh of data.suiteHealth) {
      expect(sh.suiteName).toBe('hammerdb-tpcc');
    }
  });
});
