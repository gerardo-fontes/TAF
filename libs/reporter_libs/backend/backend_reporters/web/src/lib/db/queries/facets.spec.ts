/**
 * #############################################################################
 * # web::src::lib::db::queries::facets.spec.ts
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
 * # Integration tests for listFacets database query and semver-sorted versions.
 * #############################################################################
 */

import { describe, it, expect, afterAll } from 'vitest';
import { getPool } from '../pool';
import { listFacets } from './facets';

describe('facets queries', () => {
  afterAll(async () => {
    const p = getPool();
    await p.end();
  });

  it('retrieves distinct suites, systems, and workload hashes from seeded database', async () => {
    const facets = await listFacets();

    expect(facets.totalRuns).toBeGreaterThanOrEqual(7);

    // Suites
    expect(facets.suites.length).toBeGreaterThanOrEqual(3);
    const suiteNames = facets.suites.map((s) => s.name);
    expect(suiteNames).toContain('hammerdb-tpcc');
    expect(suiteNames).toContain('hammerdb-tpch');
    expect(suiteNames).toContain('sysbench-lua');

    // Systems
    expect(facets.systems.length).toBeGreaterThanOrEqual(2);
    const hostNames = facets.systems.map((s) => s.hostName);
    expect(hostNames).toContain('db-benchmark-epyc01');
    expect(hostNames).toContain('db-benchmark-xeon02');

    // DB Versions are present and sorted
    expect(facets.dbVersions.length).toBeGreaterThanOrEqual(3);
    // Highest version should be at the top
    expect(facets.dbVersions[0]).toMatch(/^11\.8/);

    // Workload hashes
    expect(facets.workloadHashes.length).toBeGreaterThanOrEqual(2);

    // Tags
    expect(facets.tags.length).toBeGreaterThanOrEqual(1);
    expect(facets.tags).toContain('MDEV39497_BASELINE');
  });
});
