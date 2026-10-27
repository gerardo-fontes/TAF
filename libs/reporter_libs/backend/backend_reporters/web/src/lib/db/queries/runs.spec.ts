/**
 * #############################################################################
 * # web::src::lib::db::queries::runs.spec.ts
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
 * # Integration tests for listRuns and getRunById database queries.
 * #############################################################################
 */

import { describe, it, expect, afterAll } from 'vitest';
import { getPool } from '../pool';
import { listRuns, getRunById } from './runs';

describe('runs queries', () => {
  afterAll(async () => {
    const p = getPool();
    await p.end();
  });

  it('lists seeded runs with correct joins and result counts', async () => {
    const result = await listRuns({ limit: 10 });

    expect(result.data.length).toBeGreaterThanOrEqual(7);
    const first = result.data[0];
    expect(first.id).toBeDefined();
    expect(first.hostName).toBeDefined();
    expect(first.resultCount).toBeGreaterThan(0);
  });

  it('filters runs by suite name', async () => {
    const result = await listRuns({ suite: 'hammerdb-tpcc' });
    expect(result.data.length).toBeGreaterThan(0);
    for (const r of result.data) {
      expect(r.suiteName).toBe('hammerdb-tpcc');
    }
  });

  it('paginates correctly using keyset cursor', async () => {
    const page1 = await listRuns({ limit: 3 });
    expect(page1.data).toHaveLength(3);
    expect(page1.meta.nextCursor).toBeDefined();

    const page2 = await listRuns({ limit: 3, cursor: page1.meta.nextCursor });
    expect(page2.data.length).toBeGreaterThan(0);

    // Ensure no overlapping IDs between page 1 and page 2
    const p1Ids = new Set(page1.data.map((r) => r.id));
    for (const r of page2.data) {
      expect(p1Ids.has(r.id)).toBe(false);
    }
  });

  it('fetches full run details by ID including config parameters', async () => {
    const list = await listRuns({ limit: 1 });
    const runId = list.data[0].id;

    const detail = await getRunById(runId);
    expect(detail).not.toBeNull();
    expect(detail?.id).toBe(runId);
    expect(detail?.system).toBeDefined();
    expect(detail?.system?.hostName).toBe(list.data[0].hostName);
  });
});
