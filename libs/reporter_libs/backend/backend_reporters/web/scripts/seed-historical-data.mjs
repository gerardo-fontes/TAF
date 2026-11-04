/**
 * #############################################################################
 * # web::scripts::seed-historical-data.mjs
 * #
 * # Created: November 2026
 * # Last Modified: November 2026
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
 * # Seed the taf_backend database with historical benchmark results spread over
 * # a configurable window (default: the last 60 days), with a configurable
 * # number of candidate tests per day (default: 2), plus a second suite
 * # (sysbench-lua) every other day and a second host on selected days — giving
 * # the TAF web dashboard enough temporal breadth to exercise timeline charts,
 * # suite health tables, multi-host warnings, and regression feed pagination.
 * #
 * # USAGE:
 * #   node scripts/seed-historical-data.mjs [--config=/path/to/backend.conf]
 * #                                         [--days=60] [--runs-per-day=2]
 * #   npm run db:seed-history [-- --config=/path/to/backend.conf --days=60 --runs-per-day=3]
 * #
 * # CLI PARAMETERS:
 * #   --days=N           Number of past days to seed, one entry per consecutive
 * #                      day from -N up to -1 (default: 60).
 * #   --runs-per-day=N   Number of candidate hammerdb-tpcc runs inserted per
 * #                      day alongside that day's baseline (default: 2).
 * #
 * # The script is idempotent at the system/config level (insert_system_identity
 * # and insert_full_db_config are UPSERT-style stored procedures). Each run of
 * # the script appends new test_run + results + comparison rows; test names and
 * # timestamps embed the seed date so repeated executions never collide with
 * # the uq_test_identity unique constraint.
 * #############################################################################
 */

import fs from 'node:fs';
import mysql from 'mysql2/promise';

// ---------------------------------------------------------------------------
// Config resolution (mirrors seed-dev-db.mjs exactly)
// ---------------------------------------------------------------------------

function parseBackendConf(configPath) {
  if (!fs.existsSync(configPath)) {
    throw new Error(`backend.conf not found at: ${configPath}`);
  }

  const content = fs.readFileSync(configPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const props = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    props[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim();
  }

  const connConfig = {
    host: props.backend_db_host || '127.0.0.1',
    port: props.backend_db_port ? parseInt(props.backend_db_port, 10) : 3306,
    user: props.backend_db_user || 'root',
    password: props.backend_db_pass || 'taf',
    database: props.backend_db_name || 'taf_backend',
    connectTimeout: props.backend_timeout ? parseInt(props.backend_timeout, 10) * 1000 : 10000,
  };

  if (props.backend_db_ssl_ca || props.backend_db_ssl_cert || props.backend_db_ssl_key) {
    connConfig.ssl = {};
    if (props.backend_db_ssl_ca) connConfig.ssl.ca = fs.readFileSync(props.backend_db_ssl_ca);
    if (props.backend_db_ssl_cert) connConfig.ssl.cert = fs.readFileSync(props.backend_db_ssl_cert);
    if (props.backend_db_ssl_key) connConfig.ssl.key = fs.readFileSync(props.backend_db_ssl_key);
  }

  return connConfig;
}

function resolveDbConfig() {
  const argConfig = process.argv.find((arg) => arg.startsWith('--config='));
  const configPath = argConfig ? argConfig.slice('--config='.length) : process.env.TAF_BACKEND_CONF;

  if (configPath) {
    console.log(`[Config] Loading backend configuration from: ${configPath}`);
    return parseBackendConf(configPath);
  }

  console.log('[Config] No --config or TAF_BACKEND_CONF provided. Using local development defaults: 127.0.0.1:3306');
  return {
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'taf',
    database: 'taf_backend',
    connectTimeout: 10000,
  };
}

// ---------------------------------------------------------------------------
// CLI parameters (--days / --runs-per-day)
// ---------------------------------------------------------------------------

const DEFAULT_DAYS = 60;
const DEFAULT_RUNS_PER_DAY = 2;

function parsePositiveIntFlag(flagName, defaultValue) {
  const arg = process.argv.find((a) => a.startsWith(`${flagName}=`));
  if (!arg) return defaultValue;
  const raw = arg.slice(flagName.length + 1);
  const value = parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 1) {
    console.error(`[Args] Invalid value for ${flagName}: "${raw}" (expected a positive integer).`);
    process.exit(2);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSqlDatetime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const mo = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

/**
 * Compact seed-date tag (YYMMDD) embedded in every generated test_name so that
 * repeated executions of this script never collide with the uq_test_identity
 * unique constraint (system_id, config_id, suite_name, test_name, test_timestamp).
 */
function seedDateTag(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${String(date.getFullYear()).slice(-2)}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

/**
 * Deterministic jitter using sin so reruns produce identical metric values.
 * Returns a value in the range [-amplitude, +amplitude].
 */
function jitter(seed, amplitude = 0.015) {
  return Math.sin(seed) * amplitude;
}

/**
 * Realistic thread-scaling curve: throughput grows sub-linearly with threads.
 * @param {number} base    baseline tpmC at 1 thread (conceptual)
 * @param {number} threads concurrency level
 * @param {number} factor  run-level scaling factor (1.0 = baseline, 1.062 = GAIN, etc.)
 * @param {number} j       per-iteration jitter [-0.015 .. +0.015]
 */
function tpmC(base, threads, factor, j) {
  return Math.round(base * Math.pow(threads, 0.72) * factor * (1 + j));
}

// ---------------------------------------------------------------------------
// insert_test_run wrapper — matches the exact 45-param call in seed-dev-db.mjs
// ---------------------------------------------------------------------------
async function insertTestRun(conn, run) {
  await conn.query(
    `CALL insert_test_run(
       ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?,
       @test_run_id, @reject_reason
     );`,
    [
      run.test_name,
      run.system_id,
      run.taf_harness_name,
      run.taf_harness_ver,
      run.suite_name,
      run.suite_version,
      run.client_program,
      run.client_version,
      run.db_maker,
      run.db_engine,
      run.db_version,
      run.db_user,
      run.db_root_user,
      run.db_install_dir,
      run.db_port,
      run.db_socket,
      run.database_under_test,
      run.config_id,
      run.test_case_tag,
      run.autogen_tags,
      run.test_run_properties,
      run.test_run_properties_contents,
      run.db_config_origin,
      run.db_config_source_file,
      run.db_config_tmp_file,
      run.is_baseline,
      run.pct_warning,
      run.pct_fail,
      run.pct_gain,
      run.pct_duration_drift,
      run.test_type,
      run.comments,
      run.test_timestamp,
      run.test_end_time,
      run.test_duration,
      run.warmup_threads,
      run.warmup_duration,
      run.test_suite_revision,
      run.test_suite_pm_file,
      run.number_of_rows,
      run.number_of_tables,
      run.range_size,
      run.connector,
      run.thread_list,
      run.metadata,
    ]
  );

  const [res] = await conn.query(`SELECT @test_run_id AS id, @reject_reason AS reason;`);
  const runId = res[0].id;

  if (!runId) {
    throw new Error(`Failed to insert test run '${run.test_name}': ${res[0].reason}`);
  }

  return runId;
}

// ---------------------------------------------------------------------------
// insert_result wrapper
// ---------------------------------------------------------------------------
async function insertResult(conn, runId, threads, iter, metric) {
  await conn.query(
    `CALL insert_result(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @res_id);`,
    [
      runId,
      threads,
      iter,
      metric.duration,
      metric.name,
      metric.type,
      metric.category,
      metric.unit,
      metric.value,
      metric.description,
      metric.scope,
      metric.extra ?? null,
    ]
  );
}

// ---------------------------------------------------------------------------
// Seed metric results for a single run
// ---------------------------------------------------------------------------
async function seedRunResults(conn, runId, { threads, iterations, factor, baseTpmC, suite }) {
  let count = 0;

  for (const th of threads) {
    for (let iter = 1; iter <= iterations; iter++) {
      const seed = th * 17 + iter * 31 + runId;
      const j = jitter(seed, 0.015);

      if (suite === 'hammerdb-tpcc') {
        // ---- tpmC (primary throughput) ----
        const tpmVal = tpmC(baseTpmC, th, factor, j);
        await insertResult(conn, runId, th, iter, {
          duration: '60.0', name: 'tpmC', type: 'primary',
          category: 'throughput', unit: 'tpm', value: tpmVal,
          description: 'NewOrder Transactions per Minute',
          scope: '45% total mix',
          extra: JSON.stringify({ rampup_sec: 10, jitter_pct: (j * 100).toFixed(2) }),
        });
        count++;

        // ---- nopm (additional) ----
        const nopmVal = Math.round(tpmVal * 0.45);
        await insertResult(conn, runId, th, iter, {
          duration: '60.0', name: 'nopm', type: 'additional',
          category: 'throughput', unit: 'tpm', value: nopmVal,
          description: 'New Order Transactions per Minute',
          scope: 'primary metric subset', extra: null,
        });
        count++;

        // ---- latency_p95 (additional) ----
        const latVal = Number((1.2 + th * 0.045 * (2 - factor) + j * 0.2).toFixed(2));
        await insertResult(conn, runId, th, iter, {
          duration: '60.0', name: 'latency_p95', type: 'additional',
          category: 'latency', unit: 'ms', value: latVal,
          description: '95th Percentile Response Time',
          scope: 'all transactions', extra: null,
        });
        count++;

        // ---- total_commits (NULL metric_type — mirrors seed-dev-db.mjs) ----
        const commitVal = Math.round(tpmVal * 1.08);
        await insertResult(conn, runId, th, iter, {
          duration: '60.0', name: 'total_commits', type: null,
          category: 'counter', unit: 'commits', value: commitVal,
          description: 'Total Engine Commits',
          scope: 'innodb commit counter', extra: null,
        });
        count++;

      } else if (suite === 'sysbench-lua') {
        // ---- qps (primary) ----
        const qpsBase = 95000;
        const qpsVal = tpmC(qpsBase, th, factor, j);
        await insertResult(conn, runId, th, iter, {
          duration: '60.0', name: 'qps', type: 'primary',
          category: 'throughput', unit: 'qps', value: qpsVal,
          description: 'Queries per Second',
          scope: 'oltp_point_select',
          extra: JSON.stringify({ threads: th }),
        });
        count++;

        // ---- latency_avg (additional) ----
        const latAvg = Number((0.8 + th * 0.012 * (2 - factor) + j * 0.1).toFixed(3));
        await insertResult(conn, runId, th, iter, {
          duration: '60.0', name: 'latency_avg', type: 'additional',
          category: 'latency', unit: 'ms', value: latAvg,
          description: 'Average Query Latency',
          scope: 'all events', extra: null,
        });
        count++;

        // ---- errors (additional) ----
        const errVal = Math.max(0, Math.round(jitter(seed * 3, 2)));
        await insertResult(conn, runId, th, iter, {
          duration: '60.0', name: 'errors', type: 'additional',
          category: 'counter', unit: 'count', value: errVal,
          description: 'Total Transaction Errors',
          scope: 'all events', extra: null,
        });
        count++;
      }
    }
  }

  return count;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const numDays = parsePositiveIntFlag('--days', DEFAULT_DAYS);
  const runsPerDay = parsePositiveIntFlag('--runs-per-day', DEFAULT_RUNS_PER_DAY);

  console.log('======================================================================');
  console.log('TAF Historical Benchmark Seeder (seed-historical-data.mjs)');
  console.log(`Populating ${numDays}-day history with ${runsPerDay} candidate run(s)/day via stored procedures...`);
  console.log('======================================================================');

  const dbConfig = resolveDbConfig();
  const conn = await mysql.createConnection({
    ...dbConfig,
    multipleStatements: true,
  });

  try {
    // -----------------------------------------------------------------------
    // Step 1: Ensure Systems Under Test exist
    // -----------------------------------------------------------------------
    console.log('\n[1/5] Registering / resolving Systems Under Test...');

    const systemDefs = [
      {
        key: 'epyc01',
        host_name: 'db-benchmark-epyc01',
        cpu_model: 'AMD EPYC 9654 96-Core Processor',
        cpu_count: 2, core_count: 192, socket_count: 2,
        ram_gb: 384, ram_raw: '384 GiB',
        os_name: 'Rocky Linux', os_version: '9.4 (Blue Onyx)',
        os_kernel: '5.14.0-427.el9.x86_64', os_arch: 'x86_64',
      },
      {
        key: 'xeon02',
        host_name: 'db-benchmark-xeon02',
        cpu_model: 'Intel(R) Xeon(R) Platinum 8480+',
        cpu_count: 2, core_count: 112, socket_count: 2,
        ram_gb: 256, ram_raw: '256 GiB',
        os_name: 'Ubuntu', os_version: '24.04 LTS (Noble Numbat)',
        os_kernel: '6.8.0-45-generic', os_arch: 'x86_64',
      },
    ];

    const systemIds = {};
    for (const sys of systemDefs) {
      await conn.query(
        `CALL insert_system_identity(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @sys_id, @sys_hash);`,
        [
          sys.host_name, sys.cpu_model, sys.cpu_count, sys.core_count,
          sys.socket_count, sys.ram_gb, sys.ram_raw,
          sys.os_name, sys.os_version, sys.os_kernel, sys.os_arch,
        ]
      );
      const [rows] = await conn.query(`SELECT @sys_id AS id;`);
      systemIds[sys.key] = rows[0].id;
      console.log(`  ✓ ${sys.host_name} → system_id=${systemIds[sys.key]}`);
    }

    // -----------------------------------------------------------------------
    // Step 2: Ensure DB Config Sets exist
    // -----------------------------------------------------------------------
    console.log('\n[2/5] Registering / resolving DB Configuration Sets...');

    const configDefs = [
      {
        key: 'oltp',
        name: 'mariadb-oltp-highperf.cnf',
        parameters: [
          { name: 'innodb_buffer_pool_size', value: '137438953472' },
          { name: 'innodb_log_file_size', value: '17179869184' },
          { name: 'innodb_flush_log_at_trx_commit', value: '1' },
          { name: 'max_connections', value: '2000' },
          { name: 'innodb_io_capacity', value: '25000' },
          { name: 'innodb_io_capacity_max', value: '50000' },
        ],
      },
    ];

    const configIds = {};
    for (const cfg of configDefs) {
      const blob = JSON.stringify({ parameters: cfg.parameters });
      await conn.query(`CALL insert_full_db_config(?, ?, @cfg_id);`, [cfg.name, blob]);
      const [rows] = await conn.query(`SELECT @cfg_id AS id;`);
      configIds[cfg.key] = rows[0].id;
      console.log(`  ✓ ${cfg.name} → config_id=${configIds[cfg.key]}`);
    }

    // -----------------------------------------------------------------------
    // Step 3: Build the N-day schedule
    //
    // Days chosen: every consecutive day from -numDays up to -1 (oldest first),
    //   e.g. for --days=60 → [60, 59, 58, ..., 2, 1]
    //
    // Per day plan:
    //   - 1 baseline run (is_baseline=true) on the EPYC host (hammerdb-tpcc)
    //   - `--runs-per-day` candidate runs with mixed statuses (hammerdb-tpcc, EPYC)
    //   - Sysbench-lua every other day (indices 0,2,4,...)
    //   - Xeon host runs every 20th day (indices 0,20,40,... → multi-host warning)
    // -----------------------------------------------------------------------
    console.log(`\n[3/5] Inserting ${numDays} days of historical Test Runs (${runsPerDay} candidates/day)...`);

    const now = Date.now();
    const msPerDay = 86400000;
    const seedTag = seedDateTag(new Date(now));

    // The day-offsets (days ago from now), oldest first: numDays .. 1
    const dayOffsets = [];
    for (let d = numDays; d >= 1; d--) dayOffsets.push(d);

    // Per-day candidate status sequence: cycles through PAR, GAIN, WARNING, REGRESSED, PAR+, PAR-
    const statusCycle = [
      { label: 'PAR',       factor: 1.000, pctChange: 0.0  },
      { label: 'GAIN',      factor: 1.070, pctChange: +7.0 },
      { label: 'WARNING',   factor: 0.964, pctChange: -3.6 },
      { label: 'REGRESSED', factor: 0.921, pctChange: -7.9 },
      { label: 'PAR_PLUS',  factor: 1.012, pctChange: +1.2 },
      { label: 'PAR_MINUS', factor: 0.985, pctChange: -1.5 },
    ];

    // Sysbench appears every other day (even day indices)
    const isSysbenchDay = (dayIdx) => dayIdx % 2 === 0;
    // Xeon host appears every 20th day (indices 0, 20, 40, ...)
    const isXeonDay = (dayIdx) => dayIdx % 20 === 0;

    // Workload hashes (must be stable so do_compare picks the right baseline)
    // Using a constant string rather than crypto so the hash is fully deterministic.
    const WH_TPCC_EPYC   = 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d' ; // sha1 placeholder — update_workload_hash() will override
    const WH_TPCC_XEON   = 'bcd4c61ddcc5e8a2dabede0f3b482cd9aea94350' ;
    const WH_SYSBENCH    = 'cde4c61ddcc5e8a2dabede0f3b482cd9aea94351' ;

    // Track all baseline IDs per (suite, host) so candidates can reference them
    // key: `${suite}:${systemKey}`, value: last baseline runId
    const latestBaseline = {};

    let totalRuns = 0;
    let totalResults = 0;
    let totalComparisons = 0;

    for (let dayIdx = 0; dayIdx < dayOffsets.length; dayIdx++) {
      const daysAgo = dayOffsets[dayIdx];
      const dayLabel = `Day -${daysAgo}`;
      console.log(`\n  --- ${dayLabel} (day index ${dayIdx}) ---`);

      // ---- hammerdb-tpcc baseline on EPYC ----
      const baselineStartTs = new Date(now - daysAgo * msPerDay + 2 * 3600000);
      const baselineEndTs   = new Date(now - daysAgo * msPerDay + 4 * 3600000);
      const baselineVersion = `11.4.${dayIdx}-MariaDB-LTS`;

      const baselineRunDef = {
        test_name: `hammerdb_tpcc_baseline_lts_day${dayIdx}_${seedTag}`,
        system_id: systemIds['epyc01'],
        taf_harness_name: 'taf-runner', taf_harness_ver: '2.1.0',
        suite_name: 'hammerdb-tpcc', suite_version: '4.9',
        client_program: 'hammerdbcli', client_version: '4.9-linux-x64',
        db_maker: 'MariaDB', db_engine: 'InnoDB',
        db_version: baselineVersion,
        db_user: 'taf_user', db_root_user: 'root',
        db_install_dir: '/opt/mariadb/11.4',
        db_port: 3306, db_socket: '/tmp/mariadb114.sock',
        database_under_test: 'tpcc_1000w',
        config_id: configIds['oltp'],
        test_case_tag: `HIST_BASELINE_D${dayIdx}`,
        autogen_tags: JSON.stringify({ workload: 'tpcc', scale: 1000, branch: '11.4', day_idx: dayIdx }),
        test_run_properties: 'test_tpcc_11_4_lts.properties',
        test_run_properties_contents: 'taf.test_suite=hammerdb-tpcc\ntaf.threads=4,8,16,32,64,128\ntaf.duration=60',
        db_config_origin: 'file',
        db_config_source_file: '/etc/mysql/mariadb.conf.d/50-server.cnf',
        db_config_tmp_file: '/tmp/backend_db.cnf',
        is_baseline: true,
        pct_warning: 3, pct_fail: 5, pct_gain: 5, pct_duration_drift: 10,
        test_type: 'automated-benchmark',
        comments: `Official 11.4 LTS Baseline — historical seed day ${dayIdx} (${dayLabel})`,
        test_timestamp: toSqlDatetime(baselineStartTs),
        test_end_time: toSqlDatetime(baselineEndTs),
        test_duration: 7200,
        warmup_threads: 32, warmup_duration: 300,
        test_suite_revision: 4, test_suite_pm_file: 'hammerdb-tpcc.pm',
        number_of_rows: 100000000, number_of_tables: 9, range_size: 1000,
        connector: 'MariaDB-Connector-C',
        thread_list: '4,8,16,32,64,128',
        metadata: JSON.stringify({ generator: 'TAF-Perl', run_mode: 'scheduled', day_idx: dayIdx }),
      };

      const baselineRunId = await insertTestRun(conn, baselineRunDef);
      await conn.query(`CALL update_workload_hash(?, ?);`, [baselineRunId, WH_TPCC_EPYC]);
      await conn.query(`CALL set_baseline_with_comment(?, ?);`, [
        baselineRunId,
        `Historical baseline day ${dayIdx} — EPYC 11.4 LTS (${dayLabel})`,
      ]);

      latestBaseline['hammerdb-tpcc:epyc01'] = baselineRunId;
      totalRuns++;
      console.log(`    ✓ Baseline (tpcc/epyc): runId=${baselineRunId} [${baselineVersion}]`);

      const baselineResultCount = await seedRunResults(conn, baselineRunId, {
        threads: [4, 8, 16, 32, 64, 128],
        iterations: 2,
        factor: 1.0,
        baseTpmC: 4800,
        suite: 'hammerdb-tpcc',
      });
      totalResults += baselineResultCount;

      // ---- Candidate runs (hammerdb-tpcc, EPYC) — --runs-per-day of them ----
      for (let r = 0; r < runsPerDay; r++) {
        const status = statusCycle[(dayIdx + r * 2) % statusCycle.length];
        const slotLetter = String.fromCharCode(97 + r); // 'a', 'b', 'c', ...
        // Stagger each candidate 3 hours after the previous one (baseline occupies +2..+4h)
        const candStartTs = new Date(now - daysAgo * msPerDay + (5 + r * 3) * 3600000);
        const candEndTs   = new Date(now - daysAgo * msPerDay + (7 + r * 3) * 3600000);
        const candVersion = `11.8.${dayIdx}-MariaDB`;

        const candRunDef = {
          test_name: `hammerdb_tpcc_candidate_${status.label.toLowerCase()}_day${dayIdx}_${slotLetter}_${seedTag}`,
          system_id: systemIds['epyc01'],
          taf_harness_name: 'taf-runner', taf_harness_ver: '2.1.0',
          suite_name: 'hammerdb-tpcc', suite_version: '4.9',
          client_program: 'hammerdbcli', client_version: '4.9-linux-x64',
          db_maker: 'MariaDB', db_engine: 'InnoDB',
          db_version: candVersion,
          db_user: 'taf_user', db_root_user: 'root',
          db_install_dir: '/opt/mariadb/11.8',
          db_port: 3306, db_socket: '/tmp/mariadb118.sock',
          database_under_test: 'tpcc_1000w',
          config_id: configIds['oltp'],
          test_case_tag: `HIST_CAND_${status.label}_D${dayIdx}${slotLetter.toUpperCase()}`,
          autogen_tags: JSON.stringify({ workload: 'tpcc', scale: 1000, branch: '11.8', day_idx: dayIdx, slot: slotLetter.toUpperCase() }),
          test_run_properties: 'test_tpcc_11_8_candidate.properties',
          test_run_properties_contents: 'taf.test_suite=hammerdb-tpcc\ntaf.threads=4,8,16,32,64,128\ntaf.duration=60',
          db_config_origin: 'file',
          db_config_source_file: '/etc/mysql/mariadb.conf.d/50-server.cnf',
          db_config_tmp_file: '/tmp/backend_db.cnf',
          is_baseline: false,
          pct_warning: 3, pct_fail: 5, pct_gain: 5, pct_duration_drift: 10,
          test_type: 'automated-benchmark',
          comments: `Candidate ${slotLetter.toUpperCase()} — expected ${status.label} (${status.pctChange > 0 ? '+' : ''}${status.pctChange.toFixed(1)}%) — day ${dayIdx}`,
          test_timestamp: toSqlDatetime(candStartTs),
          test_end_time: toSqlDatetime(candEndTs),
          test_duration: 7200,
          warmup_threads: 32, warmup_duration: 300,
          test_suite_revision: 4, test_suite_pm_file: 'hammerdb-tpcc.pm',
          number_of_rows: 100000000, number_of_tables: 9, range_size: 1000,
          connector: 'MariaDB-Connector-C',
          thread_list: '4,8,16,32,64,128',
          metadata: JSON.stringify({ generator: 'TAF-Perl', run_mode: 'nightly', day_idx: dayIdx, slot: slotLetter.toUpperCase() }),
        };

        const candRunId = await insertTestRun(conn, candRunDef);
        await conn.query(`CALL update_workload_hash(?, ?);`, [candRunId, WH_TPCC_EPYC]);
        totalRuns++;

        const cResults = await seedRunResults(conn, candRunId, {
          threads: [4, 8, 16, 32, 64, 128],
          iterations: 2,
          factor: status.factor,
          baseTpmC: 4800,
          suite: 'hammerdb-tpcc',
        });
        totalResults += cResults;

        // Compare against the baseline inserted above for this day
        await conn.query(`CALL do_compare(?, ?, @cmp_id);`, [baselineRunId, candRunId]);
        totalComparisons++;
        console.log(`    ✓ Candidate ${slotLetter.toUpperCase()} (tpcc/epyc): runId=${candRunId} [${status.label}] vs baseline #${baselineRunId}`);
      }

      // ---- Sysbench-lua on every other day ----
      if (isSysbenchDay(dayIdx)) {
        const sbStatus = statusCycle[(dayIdx + 1) % statusCycle.length];
        const sbStartTs = new Date(now - daysAgo * msPerDay + 11 * 3600000);
        const sbEndTs   = new Date(now - daysAgo * msPerDay + 12 * 3600000);

        // Baseline for sysbench (insert on first appearance, then candidates reference it)
        const isFirstSysbench = !latestBaseline['sysbench-lua:epyc01'];
        const sbVersion = `11.4.${dayIdx}-MariaDB-LTS`;

        if (isFirstSysbench) {
          // Insert a sysbench baseline first
          const sbBaselineDef = {
            test_name: `sysbench_lua_point_select_baseline_day${dayIdx}_${seedTag}`,
            system_id: systemIds['epyc01'],
            taf_harness_name: 'taf-runner', taf_harness_ver: '2.1.0',
            suite_name: 'sysbench-lua', suite_version: '1.0.20',
            client_program: 'sysbench', client_version: '1.0.20',
            db_maker: 'MariaDB', db_engine: 'InnoDB',
            db_version: sbVersion,
            db_user: 'taf_user', db_root_user: 'root',
            db_install_dir: '/opt/mariadb/11.4',
            db_port: 3306, db_socket: '/tmp/mariadb114.sock',
            database_under_test: 'sbtest',
            config_id: configIds['oltp'],
            test_case_tag: `SYSBENCH_BASELINE_D${dayIdx}`,
            autogen_tags: JSON.stringify({ workload: 'sysbench', test: 'oltp_point_select', day_idx: dayIdx }),
            test_run_properties: 'test_sysbench_point_select.properties',
            test_run_properties_contents: 'taf.test_suite=sysbench-lua\ntaf.threads=4,8,16,32,64,128',
            db_config_origin: 'file',
            db_config_source_file: '/etc/mysql/mariadb.conf.d/50-server.cnf',
            db_config_tmp_file: '/tmp/backend_db.cnf',
            is_baseline: true,
            pct_warning: 3, pct_fail: 5, pct_gain: 5, pct_duration_drift: 10,
            test_type: 'automated-benchmark',
            comments: `Sysbench point-select 11.4 LTS baseline (${dayLabel})`,
            test_timestamp: toSqlDatetime(sbStartTs),
            test_end_time: toSqlDatetime(sbEndTs),
            test_duration: 3600,
            warmup_threads: 16, warmup_duration: 120,
            test_suite_revision: 3, test_suite_pm_file: 'sysbench-lua.pm',
            number_of_rows: 10000000, number_of_tables: 10, range_size: 100,
            connector: 'libmariadbclient',
            thread_list: '4,8,16,32,64,128',
            metadata: JSON.stringify({ generator: 'TAF-Perl', run_mode: 'scheduled', day_idx: dayIdx }),
          };

          const sbBaselineId = await insertTestRun(conn, sbBaselineDef);
          await conn.query(`CALL update_workload_hash(?, ?);`, [sbBaselineId, WH_SYSBENCH]);
          await conn.query(`CALL set_baseline_with_comment(?, ?);`, [
            sbBaselineId,
            `Sysbench point-select baseline ${dayLabel} — EPYC 11.4 LTS`,
          ]);

          latestBaseline['sysbench-lua:epyc01'] = sbBaselineId;
          totalRuns++;

          const sbBResults = await seedRunResults(conn, sbBaselineId, {
            threads: [4, 8, 16, 32, 64, 128], iterations: 2,
            factor: 1.0, baseTpmC: 95000, suite: 'sysbench-lua',
          });
          totalResults += sbBResults;
          console.log(`    ✓ Sysbench baseline (epyc): runId=${sbBaselineId} [LTS ${sbVersion}]`);
        }

        // Sysbench candidate
        const sbCandStartTs = new Date(now - daysAgo * msPerDay + 12 * 3600000);
        const sbCandEndTs   = new Date(now - daysAgo * msPerDay + 13 * 3600000);

        const sbCandDef = {
          test_name: `sysbench_lua_point_select_candidate_day${dayIdx}_${seedTag}`,
          system_id: systemIds['epyc01'],
          taf_harness_name: 'taf-runner', taf_harness_ver: '2.1.0',
          suite_name: 'sysbench-lua', suite_version: '1.0.20',
          client_program: 'sysbench', client_version: '1.0.20',
          db_maker: 'MariaDB', db_engine: 'InnoDB',
          db_version: `11.8.${dayIdx}-MariaDB`,
          db_user: 'taf_user', db_root_user: 'root',
          db_install_dir: '/opt/mariadb/11.8',
          db_port: 3306, db_socket: '/tmp/mariadb118.sock',
          database_under_test: 'sbtest',
          config_id: configIds['oltp'],
          test_case_tag: `SYSBENCH_CAND_${sbStatus.label}_D${dayIdx}`,
          autogen_tags: JSON.stringify({ workload: 'sysbench', test: 'oltp_point_select', day_idx: dayIdx }),
          test_run_properties: 'test_sysbench_point_select.properties',
          test_run_properties_contents: 'taf.test_suite=sysbench-lua\ntaf.threads=4,8,16,32,64,128',
          db_config_origin: 'file',
          db_config_source_file: '/etc/mysql/mariadb.conf.d/50-server.cnf',
          db_config_tmp_file: '/tmp/backend_db.cnf',
          is_baseline: false,
          pct_warning: 3, pct_fail: 5, pct_gain: 5, pct_duration_drift: 10,
          test_type: 'automated-benchmark',
          comments: `Sysbench candidate — expected ${sbStatus.label} (${dayLabel})`,
          test_timestamp: toSqlDatetime(sbCandStartTs),
          test_end_time: toSqlDatetime(sbCandEndTs),
          test_duration: 3600,
          warmup_threads: 16, warmup_duration: 120,
          test_suite_revision: 3, test_suite_pm_file: 'sysbench-lua.pm',
          number_of_rows: 10000000, number_of_tables: 10, range_size: 100,
          connector: 'libmariadbclient',
          thread_list: '4,8,16,32,64,128',
          metadata: JSON.stringify({ generator: 'TAF-Perl', run_mode: 'nightly', day_idx: dayIdx }),
        };

        const sbCandId = await insertTestRun(conn, sbCandDef);
        await conn.query(`CALL update_workload_hash(?, ?);`, [sbCandId, WH_SYSBENCH]);
        totalRuns++;

        const sbCandResults = await seedRunResults(conn, sbCandId, {
          threads: [4, 8, 16, 32, 64, 128], iterations: 2,
          factor: sbStatus.factor, baseTpmC: 95000, suite: 'sysbench-lua',
        });
        totalResults += sbCandResults;

        const sbBaselineRef = latestBaseline['sysbench-lua:epyc01'];
        await conn.query(`CALL do_compare(?, ?, @cmp_id);`, [sbBaselineRef, sbCandId]);
        totalComparisons++;
        console.log(`    ✓ Sysbench candidate (epyc): runId=${sbCandId} [${sbStatus.label}] vs baseline #${sbBaselineRef}`);
      }

      // ---- Xeon host run on selected days (triggers multi-host warning) ----
      if (isXeonDay(dayIdx)) {
        const xStatus = statusCycle[(dayIdx + 4) % statusCycle.length];
        const xStartTs = new Date(now - daysAgo * msPerDay + 14 * 3600000);
        const xEndTs   = new Date(now - daysAgo * msPerDay + 16 * 3600000);
        const xBaseVer = `11.4.${dayIdx}-MariaDB-LTS`;
        const xCandVer = `11.8.${dayIdx}-MariaDB`;

        // Xeon baseline (each Xeon day gets its own baseline — different host = different workload_hash)
        const xBaselineDef = {
          test_name: `hammerdb_tpcc_xeon02_baseline_day${dayIdx}_${seedTag}`,
          system_id: systemIds['xeon02'],
          taf_harness_name: 'taf-runner', taf_harness_ver: '2.1.0',
          suite_name: 'hammerdb-tpcc', suite_version: '4.9',
          client_program: 'hammerdbcli', client_version: '4.9-linux-x64',
          db_maker: 'MariaDB', db_engine: 'InnoDB',
          db_version: xBaseVer,
          db_user: 'taf_user', db_root_user: 'root',
          db_install_dir: '/opt/mariadb/11.4',
          db_port: 3306, db_socket: '/tmp/mariadb114.sock',
          database_under_test: 'tpcc_1000w',
          config_id: configIds['oltp'],
          test_case_tag: `HIST_XEON_BASELINE_D${dayIdx}`,
          autogen_tags: JSON.stringify({ workload: 'tpcc', scale: 1000, host: 'xeon02', day_idx: dayIdx }),
          test_run_properties: 'test_tpcc_11_4_lts.properties',
          test_run_properties_contents: 'taf.test_suite=hammerdb-tpcc\ntaf.threads=4,8,16,32,64,128\ntaf.duration=60',
          db_config_origin: 'file',
          db_config_source_file: '/etc/mysql/mariadb.conf.d/50-server.cnf',
          db_config_tmp_file: '/tmp/backend_db.cnf',
          is_baseline: true,
          pct_warning: 3, pct_fail: 5, pct_gain: 5, pct_duration_drift: 10,
          test_type: 'automated-benchmark',
          comments: `Xeon02 baseline for multi-host coverage (${dayLabel})`,
          test_timestamp: toSqlDatetime(xStartTs),
          test_end_time: toSqlDatetime(xEndTs),
          test_duration: 7200,
          warmup_threads: 32, warmup_duration: 300,
          test_suite_revision: 4, test_suite_pm_file: 'hammerdb-tpcc.pm',
          number_of_rows: 100000000, number_of_tables: 9, range_size: 1000,
          connector: 'MariaDB-Connector-C',
          thread_list: '4,8,16,32,64,128',
          metadata: JSON.stringify({ generator: 'TAF-Perl', run_mode: 'scheduled', host: 'xeon02', day_idx: dayIdx }),
        };

        const xBaselineId = await insertTestRun(conn, xBaselineDef);
        await conn.query(`CALL update_workload_hash(?, ?);`, [xBaselineId, WH_TPCC_XEON]);
        await conn.query(`CALL set_baseline_with_comment(?, ?);`, [
          xBaselineId,
          `Xeon02 tpcc baseline day ${dayIdx} (${dayLabel})`,
        ]);

        latestBaseline['hammerdb-tpcc:xeon02'] = xBaselineId;
        totalRuns++;

        const xBResults = await seedRunResults(conn, xBaselineId, {
          threads: [4, 8, 16, 32, 64, 128], iterations: 2,
          factor: 1.0, baseTpmC: 3900, // Xeon slightly lower base
          suite: 'hammerdb-tpcc',
        });
        totalResults += xBResults;

        // Xeon candidate
        const xCandStartTs = new Date(now - daysAgo * msPerDay + 17 * 3600000);
        const xCandEndTs   = new Date(now - daysAgo * msPerDay + 19 * 3600000);

        const xCandDef = {
          test_name: `hammerdb_tpcc_xeon02_candidate_day${dayIdx}_${seedTag}`,
          system_id: systemIds['xeon02'],
          taf_harness_name: 'taf-runner', taf_harness_ver: '2.1.0',
          suite_name: 'hammerdb-tpcc', suite_version: '4.9',
          client_program: 'hammerdbcli', client_version: '4.9-linux-x64',
          db_maker: 'MariaDB', db_engine: 'InnoDB',
          db_version: xCandVer,
          db_user: 'taf_user', db_root_user: 'root',
          db_install_dir: '/opt/mariadb/11.8',
          db_port: 3306, db_socket: '/tmp/mariadb118.sock',
          database_under_test: 'tpcc_1000w',
          config_id: configIds['oltp'],
          test_case_tag: `HIST_XEON_CAND_${xStatus.label}_D${dayIdx}`,
          autogen_tags: JSON.stringify({ workload: 'tpcc', scale: 1000, host: 'xeon02', day_idx: dayIdx }),
          test_run_properties: 'test_tpcc_11_8_candidate.properties',
          test_run_properties_contents: 'taf.test_suite=hammerdb-tpcc\ntaf.threads=4,8,16,32,64,128\ntaf.duration=60',
          db_config_origin: 'file',
          db_config_source_file: '/etc/mysql/mariadb.conf.d/50-server.cnf',
          db_config_tmp_file: '/tmp/backend_db.cnf',
          is_baseline: false,
          pct_warning: 3, pct_fail: 5, pct_gain: 5, pct_duration_drift: 10,
          test_type: 'automated-benchmark',
          comments: `Xeon02 candidate — expected ${xStatus.label} (${dayLabel})`,
          test_timestamp: toSqlDatetime(xCandStartTs),
          test_end_time: toSqlDatetime(xCandEndTs),
          test_duration: 7200,
          warmup_threads: 32, warmup_duration: 300,
          test_suite_revision: 4, test_suite_pm_file: 'hammerdb-tpcc.pm',
          number_of_rows: 100000000, number_of_tables: 9, range_size: 1000,
          connector: 'MariaDB-Connector-C',
          thread_list: '4,8,16,32,64,128',
          metadata: JSON.stringify({ generator: 'TAF-Perl', run_mode: 'nightly', host: 'xeon02', day_idx: dayIdx }),
        };

        const xCandId = await insertTestRun(conn, xCandDef);
        await conn.query(`CALL update_workload_hash(?, ?);`, [xCandId, WH_TPCC_XEON]);
        totalRuns++;

        const xCandResults = await seedRunResults(conn, xCandId, {
          threads: [4, 8, 16, 32, 64, 128], iterations: 2,
          factor: xStatus.factor, baseTpmC: 3900,
          suite: 'hammerdb-tpcc',
        });
        totalResults += xCandResults;

        await conn.query(`CALL do_compare(?, ?, @cmp_id);`, [xBaselineId, xCandId]);
        totalComparisons++;
        console.log(`    ✓ Xeon candidate (tpcc/xeon02): runId=${xCandId} [${xStatus.label}] vs baseline #${xBaselineId}`);
      }
    }

    // -----------------------------------------------------------------------
    // Step 4: Summary
    // -----------------------------------------------------------------------
    console.log('\n[4/5] Verifying inserted totals...');

    const [runCountRows] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM test_run WHERE test_name LIKE '%hist%' OR test_name LIKE '%baseline_lts_day%' OR test_name LIKE '%candidate_%_day%' OR test_name LIKE '%xeon02%' OR test_name LIKE '%sysbench_lua%day%';`
    );
    const [cmpCountRows] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM test_run_comparison;`
    );

    console.log(`  Total test_run rows inserted by this script : ${totalRuns}`);
    console.log(`  Total results rows inserted by this script  : ${totalResults}`);
    console.log(`  Total do_compare executions by this script  : ${totalComparisons}`);
    console.log(`  test_run rows matching historical pattern    : ${runCountRows[0].cnt}`);
    console.log(`  test_run_comparison total (all time)         : ${cmpCountRows[0].cnt}`);

    console.log('\n[5/5] Done.');
    console.log('\n======================================================================');
    console.log(`✓ Historical seeding complete! Dashboard has ${numDays} days of test data.`);
    console.log(`  Suites:  hammerdb-tpcc  (${numDays} days × ${1 + runsPerDay} runs)`);
    const sysbenchDays = dayOffsets.filter((_, i) => isSysbenchDay(i)).length;
    const xeonDays = dayOffsets.filter((_, i) => isXeonDay(i)).length;
    console.log(`           sysbench-lua   (${sysbenchDays} days × 2 runs)`);
    console.log(`  Hosts:   db-benchmark-epyc01  (${numDays} days)`);
    console.log(`           db-benchmark-xeon02  (${xeonDays} days — triggers multi-host warning)`);
    console.log('  Statuses mix: PAR, GAIN, WARNING, REGRESSED, PAR+, PAR-');
    console.log('======================================================================\n');

  } catch (err) {
    console.error('\n[Error] Historical seeding failed:', err);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main();

