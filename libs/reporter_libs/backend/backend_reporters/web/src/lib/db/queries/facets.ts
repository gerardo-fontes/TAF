/**
 * #############################################################################
 * # web::src::lib::db::queries::facets.ts
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
 * # Read-only queries retrieving distinct facet values (suites, database versions,
 * # systems, workload hashes, tags) with numeric semver sorting for UI filters.
 * #
 * # ARCHITECTURAL ROLE:
 * # Query layer feeding GET /api/facets and the Run Browser FilterBar component.
 * #############################################################################
 */

import { query } from '../pool';
import { sortVersionsDesc } from '../../domain/semver';
import type { RunFacets, SystemFacet, WorkloadHashFacet } from '../../domain/types';

export async function listFacets(): Promise<RunFacets> {
  const [
    suiteRows,
    makerRows,
    versionRows,
    systemRows,
    workloadRows,
    tagRows,
    totalCountRows,
  ] = await Promise.all([
    query<Array<{ name: string; count: number }>>(
      `SELECT suite_name AS name, COUNT(*) AS count
       FROM test_run
       GROUP BY suite_name
       ORDER BY count DESC, suite_name ASC`
    ),
    query<Array<{ db_maker: string }>>(
      `SELECT DISTINCT db_maker
       FROM test_run
       WHERE db_maker IS NOT NULL AND db_maker != ''
       ORDER BY db_maker ASC`
    ),
    query<Array<{ db_version: string }>>(
      `SELECT DISTINCT db_version
       FROM test_run
       WHERE db_version IS NOT NULL AND db_version != ''`
    ),
    query<any[]>(
      `SELECT
         s.id,
         s.host_name AS hostName,
         s.cpu_model AS cpuModel,
         s.os_arch AS architecture,
         s.ram_gb AS totalRamGb,
         COUNT(r.id) AS runCount
       FROM system_under_test s
       LEFT JOIN test_run r ON r.system_id = s.id
       GROUP BY s.id, s.host_name, s.cpu_model, s.os_arch, s.ram_gb
       ORDER BY runCount DESC, s.host_name ASC`
    ),
    query<any[]>(
      `SELECT
         workload_hash AS workloadHash,
         suite_name AS suiteName,
         COUNT(*) AS runCount
       FROM test_run
       WHERE workload_hash IS NOT NULL AND workload_hash != ''
       GROUP BY workload_hash, suite_name
       ORDER BY runCount DESC`
    ),
    query<Array<{ tag: string }>>(
      `SELECT DISTINCT test_case_tag AS tag
       FROM test_run
       WHERE test_case_tag IS NOT NULL AND test_case_tag != ''
       ORDER BY tag ASC`
    ),
    query<Array<{ total: number }>>(
      `SELECT COUNT(*) AS total FROM test_run`
    ),
  ]);

  const rawVersions = versionRows.map((r) => r.db_version);
  const sortedVersions = sortVersionsDesc(rawVersions);

  const systems: SystemFacet[] = systemRows.map((s) => ({
    id: String(s.id),
    hostName: s.hostName || 'unknown',
    cpuModel: s.cpuModel || 'unknown',
    architecture: s.architecture || 'x86_64',
    totalRamGb: Number(s.totalRamGb) || 0,
    runCount: Number(s.runCount) || 0,
  }));

  const workloadHashes: WorkloadHashFacet[] = workloadRows.map((w) => ({
    workloadHash: w.workloadHash,
    suiteName: w.suiteName,
    runCount: Number(w.runCount) || 0,
  }));

  return {
    suites: suiteRows.map((s) => ({ name: s.name, count: Number(s.count) })),
    dbMakers: makerRows.map((m) => m.db_maker),
    dbVersions: sortedVersions,
    systems,
    workloadHashes,
    tags: tagRows.map((t) => t.tag),
    totalRuns: Number(totalCountRows[0]?.total || 0),
  };
}
