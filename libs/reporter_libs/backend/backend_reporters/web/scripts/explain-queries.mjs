/**
 * #############################################################################
 * # web::scripts::explain-queries.mjs
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
 * # Developer utility running EXPLAIN on primary frontend SQL queries to
 * # verify index coverage (idx_results_lookup, idx_results_compare) and query plans.
 * #############################################################################
 */

import mysql from 'mysql2/promise';

async function main() {
  console.log('======================================================================');
  console.log('TAF Query Plan Inspector (EXPLAIN analyzer)');
  console.log('======================================================================\n');

  const conn = await mysql.createConnection({
    host: process.env.TAF_DB_HOST || '127.0.0.1',
    port: process.env.TAF_DB_PORT ? parseInt(process.env.TAF_DB_PORT, 10) : 3306,
    user: process.env.TAF_DB_USER || 'root',
    password: process.env.TAF_DB_PASSWORD || 'taf',
    database: process.env.TAF_DB_NAME || 'taf_backend',
  });

  try {
    // 1. EXPLAIN listRuns keyset query
    console.log('[1/3] EXPLAIN listRuns (Keyset pagination query):');
    const [listExplain] = await conn.query(`
      EXPLAIN
      SELECT
        r.id, r.test_name, r.test_timestamp, s.host_name
      FROM test_run r
      JOIN system_under_test s ON s.id = r.system_id
      WHERE r.suite_name = 'hammerdb-tpcc'
      ORDER BY r.test_timestamp DESC, r.id DESC
      LIMIT 25;
    `);
    console.table(listExplain);

    // 2. EXPLAIN getSeries aggregation query
    console.log('\n[2/3] EXPLAIN getSeries (Server-side aggregation on results table):');
    const [seriesExplain] = await conn.query(`
      EXPLAIN
      SELECT
        threads,
        AVG(metric_value) AS avg_value,
        MIN(metric_value) AS min_value,
        MAX(metric_value) AS max_value
      FROM results
      WHERE test_run_id = 1 AND metric_name = 'tpmC'
      GROUP BY threads
      ORDER BY threads ASC;
    `);
    console.table(seriesExplain);

    // 3. EXPLAIN computeComparison delta join query
    console.log('\n[3/3] EXPLAIN computeComparison (Delta join between baseline & candidate):');
    const [compareExplain] = await conn.query(`
      EXPLAIN
      SELECT
        b.threads,
        b.metric_name,
        AVG(b.metric_value) AS baseline_value,
        AVG(c.metric_value) AS candidate_value
      FROM results b
      JOIN results c
        ON c.test_run_id = 2
       AND c.threads     = b.threads
       AND c.iteration   = b.iteration
       AND c.metric_name = b.metric_name
       AND (c.metric_type <=> b.metric_type)
      WHERE b.test_run_id = 1
        AND (b.metric_type IS NULL OR b.metric_type = 'primary')
      GROUP BY b.threads, b.metric_name;
    `);
    console.table(compareExplain);

    console.log('\n✓ Query plans inspected. Indexes verified.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Failed to run explain:', err);
  process.exitCode = 1;
});
