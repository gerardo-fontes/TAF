# CONTEXT — verified facts about MariaDB/TAF

Everything in this file was read directly from the repository at the commit this
plan was written against. **Do not re-derive it. Do not guess past it.** If you
find a discrepancy between this file and the code, the code wins — and you must
report the discrepancy rather than silently following this file.

Source: `https://github.com/MariaDB/TAF`, branch `main`, shallow clone.

---

## 1. Identity

- **Repo:** `MariaDB/TAF` — "Test Automation Framework (TAF)"
- **Implementation language:** Perl (entry point `taf.pl`, requires Perl ≥ 5.30)
- **Copyright holder:** `Copyright (c) 2025-2026 MariaDB Foundation and Jonathan "jeb" Miller`
- **License:** GPLv2 or later
- **Maintainer contact:** Jonathan "jeb" Miller — the person who invited the
  frontend work. He is a Perl/database-performance specialist, **not** a
  frontend specialist. Assume every proposal needs frontend terms explained in
  plain language.
- **Repo maturity:** 40 commits, 14 stars, 5 forks, no releases, no `.github/`
  directory, no CI.

## 2. Why Perl (this constrains the frontend design)

The README justifies Perl explicitly:

> "Perl is present on every Linux distribution... There is no runtime to install,
> no virtual environment to manage, and no dependency chain to maintain."

and

> "Perl enables contributor-proof design by making state transitions, file
> operations, and test lifecycles explicit and easy to inspect."

**Consequence:** the frontend must be (a) fully optional — TAF works with no
`web/` directory present, and (b) fully isolated under `web/` so the Perl harness
gains zero dependencies. Never make `taf.pl` or any `.pm` file aware that the
frontend exists.

## 3. Directory structure (relevant subset)

```
taf.pl                                  # entry point
libs/
  reporter_libs/
    backend_reporter.pm                 # ingestion path: TAF -> Java parser -> DB
    chart_and_tables_html.pm            # 600 lines, STATIC HTML + Chart.js
    chart_and_test_info_results_tables_html.pm  # 1140 lines, STATIC HTML
    csv.pm                              # CSV reporter
    json.pm                             # JSON reporter (machine-consumable)
    text.pm                             # text reporter
    taf_res_raw_text.pm                 # raw text extraction
    tproch_queries_chart.pm             # TPC-H query chart
    backend/
      backend_sql/create_backend.sql    # THE SCHEMA (see §4)
      backend_parser/source/taf/backend/parser/
        CliArgs.java  Db.java  DbConfig.java  DbIngest.java
        JsonUtil.java  ParsedIteration.java  ParsedMetric.java
        ParsedTestRun.java  Parser.java
      working/backend.conf.example      # ingestion connection config
      build_backend_parser.sh
      parse_raw_text_results.sh
properties/
  default/  examples/  mariadb/  mysql/
test_suites/
  hammerdb-tpcc.pm  hammerdb-tpch.pm  sysbench-lua.pm  test_suite_template.pm
scripts/
  ResultsCompareRaw.pl  ResultsCompareTprochRaw.pl
```

## 4. The database — `taf_backend`

Created by `libs/reporter_libs/backend/backend_sql/create_backend.sql`
(TAF-Backend-Parser Version 2.0, Last Modified August 2026).

**Note:** the script begins with `DROP DATABASE IF EXISTS taf_backend;`. Never
point a destructive migration tool at a populated instance. The frontend must
never run this script against anything but a disposable local database.

### 4.1 `system_under_test`

Host identity. Deduplicated by SHA-256 hash of all identity fields.

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT PK AI | referenced as `test_run.system_id` |
| `host_name` | VARCHAR(255) NOT NULL | |
| `cpu_model` | VARCHAR(255) NOT NULL | |
| `cpu_count` | INT NOT NULL | |
| `core_count` | INT NOT NULL | |
| `socket_count` | INT NOT NULL | |
| `ram_gb` | INT NOT NULL | |
| `ram_raw` | VARCHAR(64) NOT NULL | e.g. `"32 GiB"` |
| `os_name` / `os_version` / `os_kernel` / `os_arch` | VARCHAR NOT NULL | |
| `system_hash` | CHAR(64) NOT NULL | UNIQUE |
| `created_at` | DATETIME | |

### 4.2 `db_config_set` and `db_config_param`

| `db_config_set` | | `db_config_param` | |
|---|---|---|---|
| `id` BIGINT PK AI | | `id` BIGINT PK AI | |
| `config_name` VARCHAR(255) | filename only | `config_id` BIGINT FK | |
| `config_hash` CHAR(64) UNIQUE | SHA-256 of canonical sorted `name=value` blob | `parameter_name` VARCHAR(255) | lowercased + trimmed |
| `created_at` TIMESTAMP | | `parameter_value` VARCHAR(2048) | trimmed, NULL→`''` |

Parameter names are **lowercased and trimmed** by the `insert_full_db_config`
procedure. Display them as stored; do not re-case them.

### 4.3 `test_run` — one row per executed test case

The central table. Selected columns (there are ~50):

| Column | Type | Frontend relevance |
|---|---|---|
| `id` | BIGINT PK AI | route param |
| `test_name` | VARCHAR(255) NOT NULL | display |
| `system_id` | BIGINT NOT NULL FK | join to host label |
| `taf_harness_name` / `taf_harness_version` | VARCHAR | provenance filter |
| `suite_name` / `suite_version` | VARCHAR | **primary filter** |
| `client_program` / `client_version` | VARCHAR | provenance filter |
| `db_maker` / `db_engine` / `db_version` | VARCHAR NOT NULL | **primary filter** |
| `db_user`, `db_root_user`, `db_install_dir`, `db_port`, `db_socket`, `database_under_test` | | run detail panel |
| `config_id` | BIGINT FK | "show config" |
| `workload_hash` | CHAR(64) | **baseline compatibility key** — only runs with an identical `workload_hash` are comparable |
| `test_case_tag` | VARCHAR(255) | user-supplied label, e.g. `MDEV39497_BASELINE` |
| `autogen_tags` | LONGTEXT | machine-generated JSON identity tags, "for dashboards and comparison tools" |
| `test_run_properties` | VARCHAR(255) | generated properties file NAME |
| `test_run_properties_contents` | LONGTEXT | full contents |
| `db_config_origin` / `db_config_source_file` / `db_config_tmp_file` | VARCHAR | provenance |
| `is_baseline` | BOOLEAN DEFAULT FALSE | baseline flag |
| `baseline_notes` | TEXT | free-form, e.g. `MDEV-12345 : Parser regression` |
| `baseline_set_at` | DATETIME | audit trail |
| `pct_warning` | INT DEFAULT 3 | % regression → `WARNING` |
| `pct_fail` | INT DEFAULT 5 | % regression → `REGRESSED` |
| `pct_gain` | INT DEFAULT 5 | % improvement → `GAIN` |
| `pct_duration_drift` | INT DEFAULT 10 | allowed % duration drift |
| `test_type` / `comments` | VARCHAR | filter / display |
| `test_timestamp` | DATETIME NOT NULL | run start; default sort |
| `test_end_time` / `test_duration` | | |
| `warmup_threads` / `warmup_duration` | | |
| `test_suite_revision`, `test_suite_pm_file`, `number_of_rows`, `number_of_tables`, `range_size` | | TPC-C/H workload shape |
| `connector` | VARCHAR(255) | e.g. `JDBC` |
| `thread_list` | VARCHAR(255) | e.g. `"4,8,16,32,64,128"` |
| `metadata` | LONGTEXT NOT NULL | raw runner metadata blob |
| `last_modified` | TIMESTAMP | |

UNIQUE KEY `uq_test_identity (system_id, config_id, suite_name, test_name, test_timestamp)`.

### 4.4 `results` — per-iteration metrics. **The charting dataset.**

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT PK AI | |
| `test_run_id` | BIGINT NOT NULL FK | |
| `threads` | INT NOT NULL | thread count — the X axis of every chart |
| `iteration` | INT NOT NULL | iterations are averaged before comparison |
| `run_time` | DOUBLE | table says DOUBLE; `insert_result` proc signature says VARCHAR(32) — **known inconsistency, report it** |
| `metric_name` | VARCHAR(255) NOT NULL | |
| `metric_type` | VARCHAR(64) | may be **NULL**, or `'primary'` / `'additional'` |
| `metric_dimension` | VARCHAR(64) | may be NULL |
| `metric_unit` | VARCHAR(64) | e.g. `tps`, `latency` |
| `metric_value` | DOUBLE NOT NULL | the plotted number |
| `variable_description` / `variable_value` | VARCHAR(255) | workload knobs |
| `extra_data` | JSON | per-metric metadata |

Indexes: `idx_results_lookup (test_run_id, threads, iteration)` and
`idx_results_compare (test_run_id, threads, iteration, metric_name, metric_type, metric_dimension, metric_unit)`
— the latter exists specifically for `do_compare()`.

Comment in the schema: *"This table may contain thousands of rows per test run."*
Design every list view to aggregate server-side.

### 4.5 `test_run_comparison` — pre-computed comparison summary

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT PK AI | |
| `baseline_run_id` | BIGINT NOT NULL FK | |
| `candidate_run_id` | BIGINT NOT NULL FK | |
| `status` | ENUM | see below |
| `thread_of_max_change` | INT NOT NULL | thread count with largest absolute raw delta |
| `max_change_pct` | DOUBLE NOT NULL | |
| `max_change_value` | DOUBLE NOT NULL | raw diff |
| `baseline_value_at_max` | DOUBLE NOT NULL | |
| `candidate_value_at_max` | DOUBLE NOT NULL | |
| `comparison_hash` | CHAR(64) NOT NULL UNIQUE | `SHA2(baseline_id || ':' || candidate_id, 256)` |
| `created_at` | DATETIME | |

**Important:** only the *summary* is stored. Per-metric deltas are **not** stored
— they are computed dynamically by the reporter. The frontend must compute them
and must match `do_compare()` exactly (see §5).

## 5. `do_compare()` semantics — the frontend must reproduce these exactly

Source: `create_backend.sql`, `CREATE PROCEDURE do_compare`.

1. Load `pct_warning`, `pct_fail`, `pct_gain` **from the BASELINE row**, not the
   candidate.
2. Join baseline `results b` to candidate `results c` on:
   `threads` = `threads`, `iteration` = `iteration`, `metric_name` = `metric_name`,
   and NULL-safe equality (`<=>`) on `metric_type`, `metric_dimension`,
   `metric_unit`.
3. Filter baseline rows to `metric_type IS NULL OR metric_type = 'primary'`.
   **Additional metrics are never compared.**
4. `GROUP BY b.threads, b.metric_name`, averaging over iterations:
   `baseline_value = AVG(b.metric_value)`, `candidate_value = AVG(c.metric_value)`,
   `raw_diff = candidate - baseline`,
   `change_pct = base = 0 ? 0 : (candidate - baseline) / baseline * 100`.
5. The "max change" row is chosen by **`ORDER BY ABS(raw_diff) DESC LIMIT 1`** —
   the largest **absolute raw** delta, *not* the largest percentage delta. Note
   that `metric_name` is in the GROUP BY but is not part of the ORDER BY, so ties
   are resolved arbitrarily by the server.
6. Status classification from `max_change_pct`:
   - `-1 ≤ change_pct ≤ +1` → `PAR`
   - `change_pct < -pct_fail` (i.e. `ABS ≥ pct_fail`) → `REGRESSED`
   - `-pct_fail < change_pct ≤ -pct_warning` → `WARNING`
   - `-pct_warning < change_pct < 0` → `PAR-`
   - `0 < change_pct < pct_gain` → `PAR+`
   - `change_pct ≥ pct_gain` → `GAIN`

   (Implemented as: `|pct| < pct_warning` → `PAR-`; `|pct| < pct_fail` →
   `WARNING`; else `REGRESSED`.)
7. Write the summary row with `comparison_hash`.

### 5.1 Baseline selection — `get_candidate_baselines`

Returns **all** runs where `is_baseline = TRUE` **AND** `workload_hash` equals
the candidate's **AND** `test_timestamp` is earlier, ordered `test_timestamp DESC`
(newest baseline first). Higher-level logic (`check_for_baseline`) applies further
duration-drift and metric-compatibility filtering.

**Frontend implication:** the compare view must refuse or warn when two selected
runs have different `workload_hash` values. This is the single most important
correctness rule in the product — a comparison across different workload shapes is
meaningless, and the UI must make that visible rather than silently rendering
noise.

### 5.2 Known documentation defect (report, do not fix unilaterally)

The `test_run_comparison` header comment says *"overall status (7-state
classification)"* but then enumerates **six** states, and the `ENUM` declares
six: `'PAR','PAR-','PAR+','WARNING','REGRESSED','GAIN'`.

Note this in the PR as an observation for the maintainer. The frontend should
implement **six** states to match the `ENUM` and should be written so that adding
a seventh state is a one-line TypeScript union change plus one colour token.

## 6. Stored procedures available

`insert_system_identity`, `insert_full_db_config`, `insert_test_run`,
`insert_result`, `update_workload_hash`, `update_autogen_tags`, `set_baseline`,
`set_baseline_with_comment`, `get_candidate_baselines`, `do_compare`,
`check_for_baseline`.

All are **write-side** except `get_candidate_baselines`. The frontend should use
plain `SELECT` for reads; it must not call the insert/update procedures.

## 7. Ingestion pipeline (context for why rows look the way they do)

`reporter_libs::backend_reporter::GenerateResults()` builds a raw payload and
invokes the Java parser CLI with `--stdin`; classpath is
`backend_jar : jdbc_jar : json_jar`. Metadata keys it reads include
`test_host`, `database_maker`, `timestamp`, `test_name`, `db_config_contents`,
`raw_db_config_block`, `db_config_origin`, `db_config_source_file`,
`db_config_tmp_file`, `java_bin`, `backend_parser_jar`, `jdbc_jar`, `json_jar`.

Ingestion is opt-in via `backend.conf` (see `libs/reporter_libs/backend/working/backend.conf.example`):

```properties
enable_backend_reporting = 0
backend_db_host =
backend_db_port =
backend_db_name =
backend_db_user =
backend_db_pass =
backend_db_ssl_ca =
backend_db_ssl_cert =
backend_db_ssl_key =
backend_timeout = 5
backend_retries = 1
```

`enable_backend_reporting = 0` by default — **most TAF installations have an
empty backend.** The frontend must degrade gracefully against an empty database
and never assume data exists. Empty-state design is a requirement, not polish.
The SSL fields confirm TLS connections are a supported configuration: the
frontend must not hardcode `rejectUnauthorized: true` defaults away, and must
accept CA/cert/key paths from configuration.

## 8. Properties file keys (facet source for the filters)

From `properties/examples/test_02.template_jeb.properties`:

```properties
taf.action                 = run-tests
taf.sleep_after_test_setup  = 2
taf.verbose                = true
taf.comments               = "Baseline execution of the jebstest case in test_suite_template"
taf.duration               = 10
taf.iterations             = 2
taf.tests                  = jebstest
taf.threads                = 256,512
taf.test_suite             = test_suite_template
test_suite_template.load_args   = "--rows=100000"
test_suite_template.client_args = "--example --how --to --pass"
```

`taf.threads` is comma-separated — this is the origin of `thread_list`. DB config
can be embedded inline between `[db_config_start]` / `[db_config_end]` tags.
`--test-case-tag=<value>` / `taf.test_case_tag=<value>` populates
`test_run.test_case_tag`.

## 9. Existing report output the frontend must coexist with

`libs/reporter_libs/json.pm` already emits a deterministic JSON document
containing top-level `test_name` and `timestamp`, a full `metadata` hash, and an
`iterations` array of `{ iteration_id, thread_count, primary, additional }`. Its
own header says it is *"intended for machine consumption, dashboards, and
automated analysis pipelines."*

`libs/reporter_libs/chart_and_tables_html.pm` (600 lines) renders static HTML and
loads **Chart.js from a jsDelivr CDN** (`<script src="https://cdn.jsdelivr.net/npm/chart.js" ...>`,
line 398). `chart_and_test_info_results_tables_html.pm` (1140 lines) is the
richer variant.

**Do not delete or rewrite these.** The Phase 0 issue must ask whether the
frontend *replaces*, *complements*, or *optionally supersedes* them. A frontend
that silently deletes the maintainer's reporting output will be rejected.

## 10. Local run commands

```bash
# show help
perl taf.pl --help

# run the sample test suite
perl taf.pl --prop=./properties/examples/test_01.template_hello.properties

# larger example
perl taf.pl --prop=./properties/examples/test_01.template_hello.properties \
    --iter=1 --threads=2,128 --tools-debug \
    --skip-test-setup --duration=10
```

Test suites: `hammerdb-tpcc.pm`, `hammerdb-tpch.pm`, `sysbench-lua.pm`,
`test_suite_template.pm`.