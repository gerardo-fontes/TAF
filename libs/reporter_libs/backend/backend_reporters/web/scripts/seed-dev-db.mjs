/**
 * #############################################################################
 * # web::scripts::seed-dev-db.mjs
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
 * # Generate synthetic benchmark test data for local development, verification,
 * # and offline testing of the TAF web frontend.
 * #
 * # ARCHITECTURAL ROLE:
 * # Exercises the native TAF stored procedures (insert_system_identity,
 * # insert_full_db_config, insert_test_run, insert_result, update_workload_hash,
 * # set_baseline_with_comment, and do_compare) against a MariaDB taf_backend
 * # database. Accepts connection parameters via --config=/path/to/backend.conf
 * # or TAF_BACKEND_CONF, falling back to local defaults.
 * #############################################################################
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';

/**
 * Parse a TAF backend.conf file into a connection options object.
 * Format is key = value, comments begin with '#' or ';'.
 */
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

    const key = line.slice(0, eqIdx).trim();
    const value = line.slice(eqIdx + 1).trim();
    props[key] = value;
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

/**
 * Resolve DB connection options from CLI argument, env var, or local defaults.
 */
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

/**
 * Format a Date object to MariaDB DATETIME string: YYYY-MM-DD HH:mm:ss
 */
function toSqlDatetime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

async function main() {
  console.log('======================================================================');
  console.log('TAF Synthetic Benchmark Seeder (seed-dev-db.mjs)');
  console.log('Populating taf_backend via stored procedures...');
  console.log('======================================================================');

  const dbConfig = resolveDbConfig();
  const connection = await mysql.createConnection({
    ...dbConfig,
    multipleStatements: true,
  });

  try {
    // -------------------------------------------------------------------------
    // 1. Systems Under Test (insert_system_identity)
    // -------------------------------------------------------------------------
    console.log('\n[1/5] Registering Systems Under Test...');

    const systems = [
      {
        host_name: 'db-benchmark-epyc01',
        cpu_model: 'AMD EPYC 9654 96-Core Processor',
        cpu_count: 2,
        core_count: 192,
        socket_count: 2,
        ram_gb: 384,
        ram_raw: '384 GiB',
        os_name: 'Rocky Linux',
        os_version: '9.4 (Blue Onyx)',
        os_kernel: '5.14.0-427.el9.x86_64',
        os_arch: 'x86_64',
      },
      {
        host_name: 'db-benchmark-xeon02',
        cpu_model: 'Intel(R) Xeon(R) Platinum 8480+',
        cpu_count: 2,
        core_count: 112,
        socket_count: 2,
        ram_gb: 256,
        ram_raw: '256 GiB',
        os_name: 'Ubuntu',
        os_version: '24.04 LTS (Noble Numbat)',
        os_kernel: '6.8.0-45-generic',
        os_arch: 'x86_64',
      },
    ];

    const systemIds = {};
    for (const sys of systems) {
      await connection.query(
        `CALL insert_system_identity(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @sys_id, @sys_hash);`,
        [
          sys.host_name,
          sys.cpu_model,
          sys.cpu_count,
          sys.core_count,
          sys.socket_count,
          sys.ram_gb,
          sys.ram_raw,
          sys.os_name,
          sys.os_version,
          sys.os_kernel,
          sys.os_arch,
        ]
      );
      const [rows] = await connection.query(`SELECT @sys_id AS id, @sys_hash AS hash;`);
      const sysId = rows[0].id;
      systemIds[sys.host_name] = sysId;
      console.log(`  ✓ System: ${sys.host_name} (ID: ${sysId}, Arch: ${sys.os_arch})`);
    }

    // -------------------------------------------------------------------------
    // 2. Database Configurations (insert_full_db_config)
    // -------------------------------------------------------------------------
    console.log('\n[2/5] Registering Database Configuration Sets...');

    const configs = [
      {
        name: 'mariadb-oltp-highperf.cnf',
        parameters: [
          { name: 'innodb_buffer_pool_size', value: '137438953472' }, // 128G
          { name: 'innodb_log_file_size', value: '17179869184' },     // 16G
          { name: 'innodb_flush_log_at_trx_commit', value: '1' },
          { name: 'max_connections', value: '2000' },
          { name: 'innodb_io_capacity', value: '25000' },
          { name: 'innodb_io_capacity_max', value: '50000' },
          { name: 'table_open_cache', value: '8192' },
          { name: 'table_definition_cache', value: '4096' },
        ],
      },
      {
        name: 'mariadb-dwh-analytical.cnf',
        parameters: [
          { name: 'innodb_buffer_pool_size', value: '68719476736' },  // 64G
          { name: 'join_buffer_size', value: '33554432' },           // 32M
          { name: 'sort_buffer_size', value: '67108864' },           // 64M
          { name: 'tmp_table_size', value: '1073741824' },           // 1G
          { name: 'max_heap_table_size', value: '1073741824' },      // 1G
        ],
      },
    ];

    const configIds = {};
    for (const cfg of configs) {
      const blob = JSON.stringify({ parameters: cfg.parameters });
      await connection.query(`CALL insert_full_db_config(?, ?, @cfg_id);`, [cfg.name, blob]);
      const [rows] = await connection.query(`SELECT @cfg_id AS id;`);
      const cfgId = rows[0].id;
      configIds[cfg.name] = cfgId;
      console.log(`  ✓ Config Set: ${cfg.name} (ID: ${cfgId}, Params: ${cfg.parameters.length})`);
    }

    // -------------------------------------------------------------------------
    // 3. Test Runs (insert_test_run, update_workload_hash, set_baseline_with_comment)
    // -------------------------------------------------------------------------
    console.log('\n[3/5] Inserting Benchmark Test Runs...');

    // Stable workload hashes for compatibility testing
    const WORKLOAD_TPCC_EPYC = crypto.createHash('sha256').update('WORKLOAD_TPCC_EPYC_SHARED_SHAPE').digest('hex');
    const WORKLOAD_INCOMPATIBLE = crypto.createHash('sha256').update('WORKLOAD_INCOMPATIBLE_SCALE_200').digest('hex');
    const WORKLOAD_TPCH = crypto.createHash('sha256').update('WORKLOAD_TPCH_STREAM_ANALYTICS').digest('hex');
    const WORKLOAD_SYSBENCH = crypto.createHash('sha256').update('WORKLOAD_SYSBENCH_POINT_SELECT').digest('hex');

    const now = Date.now();
    const daysAgo = (d, h = 0) => new Date(now - (d * 86400000 + h * 3600000));

    const runDefinitions = [
      {
        key: 'tpcc_baseline',
        test_name: 'hammerdb_tpcc_mariadb11_4_baseline',
        system_id: systemIds['db-benchmark-epyc01'],
        taf_harness_name: 'taf-runner',
        taf_harness_ver: '2.1.0',
        suite_name: 'hammerdb-tpcc',
        suite_version: '4.9',
        client_program: 'hammerdbcli',
        client_version: '4.9-linux-x64',
        db_maker: 'MariaDB',
        db_engine: 'InnoDB',
        db_version: '11.4.3-MariaDB',
        db_user: 'taf_user',
        db_root_user: 'root',
        db_install_dir: '/opt/mariadb/11.4',
        db_port: 3306,
        db_socket: '/tmp/mariadb114.sock',
        database_under_test: 'tpcc_1000w',
        config_id: configIds['mariadb-oltp-highperf.cnf'],
        test_case_tag: 'MDEV39497_BASELINE',
        autogen_tags: JSON.stringify({ workload: 'tpcc', scale: 1000, branch: '11.4' }),
        test_run_properties: 'test_tpcc_11_4_baseline.properties',
        test_run_properties_contents: 'taf.test_suite=hammerdb-tpcc\ntaf.threads=4,8,16,32,64,128\ntaf.duration=60',
        db_config_origin: 'file',
        db_config_source_file: '/etc/mysql/mariadb.conf.d/50-server.cnf',
        db_config_tmp_file: '/tmp/backend_db.cnf',
        is_baseline: true,
        pct_warning: 3,
        pct_fail: 5,
        pct_gain: 5,
        pct_duration_drift: 10,
        test_type: 'automated-benchmark',
        comments: 'Official 11.4 LTS Baseline run for MDEV-39497 comparison',
        test_timestamp: toSqlDatetime(daysAgo(4, 2)),
        test_end_time: toSqlDatetime(daysAgo(4, 0)),
        test_duration: 7200,
        warmup_threads: 32,
        warmup_duration: 300,
        test_suite_revision: 4,
        test_suite_pm_file: 'hammerdb-tpcc.pm',
        number_of_rows: 100000000,
        number_of_tables: 9,
        range_size: 1000,
        connector: 'MariaDB-Connector-C',
        thread_list: '4,8,16,32,64,128',
        metadata: JSON.stringify({ generator: 'TAF-Perl', run_mode: 'scheduled' }),
        workload_hash: WORKLOAD_TPCC_EPYC,
        baseline_notes: 'MDEV-39497 : Subquery and join optimizer baseline on 11.4.3 LTS (Rocky 9.4, EPYC 9654)',
      },
      {
        key: 'tpcc_candidate_gain',
        test_name: 'hammerdb_tpcc_mariadb11_8_candidate_gain',
        system_id: systemIds['db-benchmark-epyc01'],
        taf_harness_name: 'taf-runner',
        taf_harness_ver: '2.1.0',
        suite_name: 'hammerdb-tpcc',
        suite_version: '4.9',
        client_program: 'hammerdbcli',
        client_version: '4.9-linux-x64',
        db_maker: 'MariaDB',
        db_engine: 'InnoDB',
        db_version: '11.8.1-MariaDB',
        db_user: 'taf_user',
        db_root_user: 'root',
        db_install_dir: '/opt/mariadb/11.8',
        db_port: 3306,
        db_socket: '/tmp/mariadb118.sock',
        database_under_test: 'tpcc_1000w',
        config_id: configIds['mariadb-oltp-highperf.cnf'],
        test_case_tag: 'MDEV39497_PATCH_GAIN',
        autogen_tags: JSON.stringify({ workload: 'tpcc', scale: 1000, branch: '11.8', patch: 'v2' }),
        test_run_properties: 'test_tpcc_11_8_gain.properties',
        test_run_properties_contents: 'taf.test_suite=hammerdb-tpcc\ntaf.threads=4,8,16,32,64,128\ntaf.duration=60',
        db_config_origin: 'file',
        db_config_source_file: '/etc/mysql/mariadb.conf.d/50-server.cnf',
        db_config_tmp_file: '/tmp/backend_db.cnf',
        is_baseline: false,
        pct_warning: 3,
        pct_fail: 5,
        pct_gain: 5,
        pct_duration_drift: 10,
        test_type: 'automated-benchmark',
        comments: '11.8 Candidate testing patch v2 (+6.2% throughput improvement)',
        test_timestamp: toSqlDatetime(daysAgo(2, 4)),
        test_end_time: toSqlDatetime(daysAgo(2, 2)),
        test_duration: 7200,
        warmup_threads: 32,
        warmup_duration: 300,
        test_suite_revision: 4,
        test_suite_pm_file: 'hammerdb-tpcc.pm',
        number_of_rows: 100000000,
        number_of_tables: 9,
        range_size: 1000,
        connector: 'MariaDB-Connector-C',
        thread_list: '4,8,16,32,64,128',
        metadata: JSON.stringify({ generator: 'TAF-Perl', run_mode: 'nightly' }),
        workload_hash: WORKLOAD_TPCC_EPYC, // MATCHES BASELINE
        baseline_notes: null,
      },
      {
        key: 'tpcc_candidate_regressed',
        test_name: 'hammerdb_tpcc_mariadb11_8_candidate_regressed',
        system_id: systemIds['db-benchmark-epyc01'],
        taf_harness_name: 'taf-runner',
        taf_harness_ver: '2.1.0',
        suite_name: 'hammerdb-tpcc',
        suite_version: '4.9',
        client_program: 'hammerdbcli',
        client_version: '4.9-linux-x64',
        db_maker: 'MariaDB',
        db_engine: 'InnoDB',
        db_version: '11.8.1-MariaDB',
        db_user: 'taf_user',
        db_root_user: 'root',
        db_install_dir: '/opt/mariadb/11.8',
        db_port: 3306,
        db_socket: '/tmp/mariadb118.sock',
        database_under_test: 'tpcc_1000w',
        config_id: configIds['mariadb-oltp-highperf.cnf'],
        test_case_tag: 'MDEV39497_REGRESSION_BUG',
        autogen_tags: JSON.stringify({ workload: 'tpcc', scale: 1000, branch: '11.8', patch: 'bad_alloc' }),
        test_run_properties: 'test_tpcc_11_8_regressed.properties',
        test_run_properties_contents: 'taf.test_suite=hammerdb-tpcc\ntaf.threads=4,8,16,32,64,128\ntaf.duration=60',
        db_config_origin: 'file',
        db_config_source_file: '/etc/mysql/mariadb.conf.d/50-server.cnf',
        db_config_tmp_file: '/tmp/backend_db.cnf',
        is_baseline: false,
        pct_warning: 3,
        pct_fail: 5,
        pct_gain: 5,
        pct_duration_drift: 10,
        test_type: 'automated-benchmark',
        comments: 'Suspected regression in index lock manager (-7.5% at high concurrency)',
        test_timestamp: toSqlDatetime(daysAgo(1, 1)),
        test_end_time: toSqlDatetime(daysAgo(0, 23)),
        test_duration: 7200,
        warmup_threads: 32,
        warmup_duration: 300,
        test_suite_revision: 4,
        test_suite_pm_file: 'hammerdb-tpcc.pm',
        number_of_rows: 100000000,
        number_of_tables: 9,
        range_size: 1000,
        connector: 'MariaDB-Connector-C',
        thread_list: '4,8,16,32,64,128',
        metadata: JSON.stringify({ generator: 'TAF-Perl', run_mode: 'manual' }),
        workload_hash: WORKLOAD_TPCC_EPYC, // MATCHES BASELINE
        baseline_notes: null,
      },
      {
        key: 'tpcc_candidate_warning',
        test_name: 'hammerdb_tpcc_mariadb11_8_candidate_warning',
        system_id: systemIds['db-benchmark-epyc01'],
        taf_harness_name: 'taf-runner',
        taf_harness_ver: '2.1.0',
        suite_name: 'hammerdb-tpcc',
        suite_version: '4.9',
        client_program: 'hammerdbcli',
        client_version: '4.9-linux-x64',
        db_maker: 'MariaDB',
        db_engine: 'InnoDB',
        db_version: '11.8.1-MariaDB',
        db_user: 'taf_user',
        db_root_user: 'root',
        db_install_dir: '/opt/mariadb/11.8',
        db_port: 3306,
        db_socket: '/tmp/mariadb118.sock',
        database_under_test: 'tpcc_1000w',
        config_id: configIds['mariadb-oltp-highperf.cnf'],
        test_case_tag: 'MDEV39497_WARNING_TEST',
        autogen_tags: JSON.stringify({ workload: 'tpcc', scale: 1000, branch: '11.8' }),
        test_run_properties: 'test_tpcc_11_8_warning.properties',
        test_run_properties_contents: 'taf.test_suite=hammerdb-tpcc\ntaf.threads=4,8,16,32,64,128\ntaf.duration=60',
        db_config_origin: 'file',
        db_config_source_file: '/etc/mysql/mariadb.conf.d/50-server.cnf',
        db_config_tmp_file: '/tmp/backend_db.cnf',
        is_baseline: false,
        pct_warning: 3,
        pct_fail: 5,
        pct_gain: 5,
        pct_duration_drift: 10,
        test_type: 'automated-benchmark',
        comments: 'Borderline regression (-3.8% at 128 threads) triggering WARNING',
        test_timestamp: toSqlDatetime(daysAgo(1, 8)),
        test_end_time: toSqlDatetime(daysAgo(1, 6)),
        test_duration: 7200,
        warmup_threads: 32,
        warmup_duration: 300,
        test_suite_revision: 4,
        test_suite_pm_file: 'hammerdb-tpcc.pm',
        number_of_rows: 100000000,
        number_of_tables: 9,
        range_size: 1000,
        connector: 'MariaDB-Connector-C',
        thread_list: '4,8,16,32,64,128',
        metadata: JSON.stringify({ generator: 'TAF-Perl', run_mode: 'scheduled' }),
        workload_hash: WORKLOAD_TPCC_EPYC, // MATCHES BASELINE
        baseline_notes: null,
      },
      {
        key: 'tpcc_incompatible_xeon',
        test_name: 'hammerdb_tpcc_mariadb11_8_incompatible_scale200',
        system_id: systemIds['db-benchmark-xeon02'], // DIFFERENT HOST
        taf_harness_name: 'taf-runner',
        taf_harness_ver: '2.1.0',
        suite_name: 'hammerdb-tpcc',
        suite_version: '4.9',
        client_program: 'hammerdbcli',
        client_version: '4.9-linux-x64',
        db_maker: 'MariaDB',
        db_engine: 'InnoDB',
        db_version: '11.8.1-MariaDB',
        db_user: 'taf_user',
        db_root_user: 'root',
        db_install_dir: '/opt/mariadb/11.8',
        db_port: 3306,
        db_socket: '/tmp/mariadb118.sock',
        database_under_test: 'tpcc_200w',
        config_id: configIds['mariadb-oltp-highperf.cnf'],
        test_case_tag: 'TPCC_SCALE_200_INCOMPATIBLE',
        autogen_tags: JSON.stringify({ workload: 'tpcc', scale: 200, host: 'xeon02' }),
        test_run_properties: 'test_tpcc_scale200.properties',
        test_run_properties_contents: 'taf.test_suite=hammerdb-tpcc\ntaf.threads=8,16,32,64,128,256',
        db_config_origin: 'file',
        db_config_source_file: '/etc/mysql/mariadb.conf.d/50-server.cnf',
        db_config_tmp_file: '/tmp/backend_db.cnf',
        is_baseline: false,
        pct_warning: 3,
        pct_fail: 5,
        pct_gain: 5,
        pct_duration_drift: 10,
        test_type: 'automated-benchmark',
        comments: 'Different scale (200w vs 1000w) and different host -> Incompatible workload_hash',
        test_timestamp: toSqlDatetime(daysAgo(2, 10)),
        test_end_time: toSqlDatetime(daysAgo(2, 8)),
        test_duration: 7200,
        warmup_threads: 16,
        warmup_duration: 300,
        test_suite_revision: 4,
        test_suite_pm_file: 'hammerdb-tpcc.pm',
        number_of_rows: 20000000,
        number_of_tables: 9,
        range_size: 200,
        connector: 'MariaDB-Connector-C',
        thread_list: '8,16,32,64,128,256',
        metadata: JSON.stringify({ generator: 'TAF-Perl', run_mode: 'manual' }),
        workload_hash: WORKLOAD_INCOMPATIBLE, // INTENTIONALLY DIFFERENT HASH
        baseline_notes: null,
      },
      {
        key: 'tpch_analytics',
        test_name: 'hammerdb_tpch_mariadb11_8_analytics',
        system_id: systemIds['db-benchmark-epyc01'],
        taf_harness_name: 'taf-runner',
        taf_harness_ver: '2.1.0',
        suite_name: 'hammerdb-tpch',
        suite_version: '4.9',
        client_program: 'hammerdbcli',
        client_version: '4.9-linux-x64',
        db_maker: 'MariaDB',
        db_engine: 'ColumnStore',
        db_version: '11.8.1-MariaDB',
        db_user: 'taf_user',
        db_root_user: 'root',
        db_install_dir: '/opt/mariadb/11.8',
        db_port: 3306,
        db_socket: '/tmp/mariadb118.sock',
        database_under_test: 'tpch_scale10',
        config_id: configIds['mariadb-dwh-analytical.cnf'],
        test_case_tag: 'TPCH_STREAM_ANALYTICS',
        autogen_tags: JSON.stringify({ workload: 'tpch', scale: 10 }),
        test_run_properties: 'test_tpch_analytics.properties',
        test_run_properties_contents: 'taf.test_suite=hammerdb-tpch\ntaf.threads=1,2,4,8,16\ntaf.duration=120',
        db_config_origin: 'file',
        db_config_source_file: '/etc/mysql/mariadb.conf.d/60-dwh.cnf',
        db_config_tmp_file: '/tmp/backend_db.cnf',
        is_baseline: false,
        pct_warning: 3,
        pct_fail: 5,
        pct_gain: 5,
        pct_duration_drift: 10,
        test_type: 'automated-benchmark',
        comments: 'TPC-H 22-query analytical throughput stream test',
        test_timestamp: toSqlDatetime(daysAgo(3, 5)),
        test_end_time: toSqlDatetime(daysAgo(3, 2)),
        test_duration: 10800,
        warmup_threads: 2,
        warmup_duration: 600,
        test_suite_revision: 2,
        test_suite_pm_file: 'hammerdb-tpch.pm',
        number_of_rows: 60000000,
        number_of_tables: 8,
        range_size: 10,
        connector: 'MariaDB-Connector-ODBC',
        thread_list: '1,2,4,8,16',
        metadata: JSON.stringify({ generator: 'TAF-Perl', run_mode: 'scheduled' }),
        workload_hash: WORKLOAD_TPCH,
        baseline_notes: null,
      },
      {
        key: 'sysbench_point_select',
        test_name: 'sysbench_lua_point_select_10_11_legacy',
        system_id: systemIds['db-benchmark-epyc01'],
        taf_harness_name: 'taf-runner',
        taf_harness_ver: '2.1.0',
        suite_name: 'sysbench-lua',
        suite_version: '1.0.20',
        client_program: 'sysbench',
        client_version: '1.0.20',
        db_maker: 'MariaDB',
        db_engine: 'InnoDB',
        db_version: '10.11.8-MariaDB',
        db_user: 'taf_user',
        db_root_user: 'root',
        db_install_dir: '/opt/mariadb/10.11',
        db_port: 3306,
        db_socket: '/tmp/mariadb1011.sock',
        database_under_test: 'sbtest',
        config_id: configIds['mariadb-oltp-highperf.cnf'],
        test_case_tag: 'SYSBENCH_POINT_SELECT_10_11',
        autogen_tags: JSON.stringify({ workload: 'sysbench', test: 'oltp_point_select' }),
        test_run_properties: 'test_sysbench_point_select.properties',
        test_run_properties_contents: 'taf.test_suite=sysbench-lua\ntaf.threads=4,8,16,32,64,128',
        db_config_origin: 'file',
        db_config_source_file: '/etc/mysql/mariadb.conf.d/50-server.cnf',
        db_config_tmp_file: '/tmp/backend_db.cnf',
        is_baseline: false,
        pct_warning: 3,
        pct_fail: 5,
        pct_gain: 5,
        pct_duration_drift: 10,
        test_type: 'automated-benchmark',
        comments: 'Sysbench point-select legacy LTS comparison run',
        test_timestamp: toSqlDatetime(daysAgo(1, 15)),
        test_end_time: toSqlDatetime(daysAgo(1, 14)),
        test_duration: 3600,
        warmup_threads: 16,
        warmup_duration: 120,
        test_suite_revision: 3,
        test_suite_pm_file: 'sysbench-lua.pm',
        number_of_rows: 10000000,
        number_of_tables: 10,
        range_size: 100,
        connector: 'libmariadbclient',
        thread_list: '4,8,16,32,64,128',
        metadata: JSON.stringify({ generator: 'TAF-Perl', run_mode: 'manual' }),
        workload_hash: WORKLOAD_SYSBENCH,
        baseline_notes: null,
      },
    ];

    const runIds = {};

    for (const run of runDefinitions) {
      await connection.query(
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

      const [res] = await connection.query(`SELECT @test_run_id AS id, @reject_reason AS reason;`);
      const runId = res[0].id;

      if (!runId) {
        throw new Error(`Failed to insert test run '${run.test_name}': ${res[0].reason}`);
      }

      runIds[run.key] = runId;

      // Assign the verified workload hash
      await connection.query(`CALL update_workload_hash(?, ?);`, [runId, run.workload_hash]);

      // If marked as baseline, assign explicit baseline comment
      if (run.is_baseline && run.baseline_notes) {
        await connection.query(`CALL set_baseline_with_comment(?, ?);`, [runId, run.baseline_notes]);
      }

      console.log(`  ✓ Run [${run.key}]: ID=${runId} | Tag: ${run.test_case_tag} | Baseline=${run.is_baseline}`);
    }

    // -------------------------------------------------------------------------
    // 4. Per-Iteration Results (insert_result)
    // -------------------------------------------------------------------------
    console.log('\n[4/5] Populating Results Table (Metric Series & Aggregations)...');

    /**
     * Helper to generate scaling throughput curve
     * threads: 4, 8, 16, 32, 64, 128
     * Returns realistic tpmC values with slight iteration jitter
     */
    function calculateMetric(baseVal, threads, factor, iterJitter) {
      const threadScaling = Math.pow(threads, 0.72);
      return Math.round(baseVal * threadScaling * factor * (1 + iterJitter));
    }

    let totalResultsCount = 0;

    for (const [key, runId] of Object.entries(runIds)) {
      const def = runDefinitions.find((r) => r.key === key);
      const threadsArr = def.thread_list.split(',').map((t) => parseInt(t.trim(), 10));

      // Scaling factors relative to baseline
      let factor = 1.0;
      if (key === 'tpcc_candidate_gain') factor = 1.062;       // +6.2% -> GAIN
      if (key === 'tpcc_candidate_regressed') factor = 0.925;  // -7.5% -> REGRESSED
      if (key === 'tpcc_candidate_warning') factor = 0.962;    // -3.8% -> WARNING

      const iterations = key === 'tpcc_candidate_regressed' ? 5 : 2; // Extra iterations on regressed run to test scaling!

      for (const th of threadsArr) {
        for (let iter = 1; iter <= iterations; iter++) {
          const jitter = (Math.sin(th * 17 + iter * 31) * 0.015); // Deterministic ±1.5% variance

          // 1. Primary metric: tpmC
          const tpmVal = calculateMetric(4800, th, factor, jitter);
          await connection.query(
            `CALL insert_result(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @res_id);`,
            [
              runId,
              th,
              iter,
              '60.0',
              'tpmC',
              'primary',
              'throughput',
              'tpm',
              tpmVal,
              'NewOrder Transactions',
              '45% total mix',
              JSON.stringify({ rampup_sec: 10, client_jitter_pct: (jitter * 100).toFixed(2) }),
            ]
          );
          totalResultsCount++;

          // 2. Additional metric: latency_p95
          const latencyVal = Number((1.2 + (th * 0.045 * (2 - factor)) + (jitter * 0.2)).toFixed(2));
          await connection.query(
            `CALL insert_result(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @res_id);`,
            [
              runId,
              th,
              iter,
              '60.0',
              'latency_p95',
              'additional',
              'latency',
              'ms',
              latencyVal,
              '95th Percentile Response Time',
              'all transactions',
              null,
            ]
          );
          totalResultsCount++;

          // 3. NULL metric_type: total_commits (to test TAF do_compare NULL metric_type equality)
          const commitVal = Math.round(tpmVal * 1.08);
          await connection.query(
            `CALL insert_result(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @res_id);`,
            [
              runId,
              th,
              iter,
              '60.0',
              'total_commits',
              null, // NULL metric_type
              'counter',
              'commits',
              commitVal,
              'Total Engine Commits',
              'innodb commit counter',
              null,
            ]
          );
          totalResultsCount++;
        }
      }

      console.log(`  ✓ Results populated for Run ID ${runId} (${key}): ${threadsArr.length * iterations * 3} metric rows`);
    }

    console.log(`  -> Total rows in 'results' table inserted: ${totalResultsCount}`);

    // -------------------------------------------------------------------------
    // 5. Native do_compare() Execution
    // -------------------------------------------------------------------------
    console.log('\n[5/5] Executing TAF do_compare() Stored Procedure...');

    const baselineId = runIds['tpcc_baseline'];
    const candidatesToCompare = [
      { key: 'tpcc_candidate_gain', id: runIds['tpcc_candidate_gain'], expected: 'GAIN' },
      { key: 'tpcc_candidate_regressed', id: runIds['tpcc_candidate_regressed'], expected: 'REGRESSED' },
      { key: 'tpcc_candidate_warning', id: runIds['tpcc_candidate_warning'], expected: 'WARNING' },
    ];

    for (const cand of candidatesToCompare) {
      await connection.query(`CALL do_compare(?, ?, @cmp_id);`, [baselineId, cand.id]);
      const [rows] = await connection.query(
        `SELECT id, baseline_run_id, candidate_run_id, status, thread_of_max_change, max_change_pct, max_change_value
           FROM test_run_comparison
          WHERE baseline_run_id = ? AND candidate_run_id = ?;`,
        [baselineId, cand.id]
      );

      const cmp = rows[0];
      if (cmp) {
        console.log(
          `  ✓ Comparison: Baseline #${baselineId} vs Candidate #${cand.id} (${cand.key})` +
          `\n    -> Status: [${cmp.status}] (Expected: ${cand.expected})` +
          ` | Max Δ: ${cmp.max_change_pct.toFixed(2)}% at ${cmp.thread_of_max_change} threads` +
          ` | Raw Δ: ${cmp.max_change_value.toFixed(0)}`
        );
      }
    }

    console.log('\n======================================================================');
    console.log('✓ Seeding complete! Database is primed and ready for Frontend Dev.');
    console.log('======================================================================\n');
  } catch (err) {
    console.error('\n[Error] Database seeding failed:', err);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

main();
