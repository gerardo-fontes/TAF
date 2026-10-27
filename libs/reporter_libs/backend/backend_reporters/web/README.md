<!--
#############################################################################
# web::README.md
#
# Created: October 2026
# Last Modified: October 2026
#
# This file is part of the Test Automation Framework (TAF).
# Copyright (c) 2025-2026 MariaDB Foundation, Jonathan "jeb" Miller and Gerardo Fontes
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation; version 2 or later of the License.
#
# Licensed under the GNU General Public License, version 2 or later (GPLv2+).
# See https://www.gnu.org/licenses/ for details.
#
# PURPOSE:
# Developer documentation and operational runbook for the TAF Web Frontend.
#############################################################################
-->

# TAF Web Frontend

An optional, read-only web application and REST API for the MariaDB Foundation's **Test Automation Framework (TAF)** backend database (`taf_backend`).

Provides interactive benchmark run browsing, comparison analysis with exact `do_compare()` parity, thread-scaling charts, and an enterprise regression dashboard.

---

## Architectural Principles

1. **Standalone & Moveable:**
   - The entire `web/` directory is self-contained. It can be relocated or copied anywhere on any host (local workstation, remote benchmark runner, sponsor hardware).
   - Zero runtime dependency on Docker.
2. **Zero Perl Impact:**
   - All code is quarantined under `libs/reporter_libs/backend/backend_reporters/web/`.
   - The Perl framework (`taf.pl`, `libs/**`, `test_suites/**`) remains untouched with zero added dependencies.
3. **Read-Only Database Access:**
   - The frontend issues plain `SELECT` queries against `taf_backend`. It never mutates or drops benchmark data.
4. **Native `backend.conf` Integration:**
   - Database connection parameters are read directly from TAF's standard `backend.conf` properties file.

---

## Configuration

The frontend accepts configuration through:

1. **CLI Argument:**
   ```bash
   node server.js --config=/path/to/backend.conf
   # or with npm:
   npm start -- --config=/path/to/backend.conf
   ```
2. **Environment Variable:**
   ```bash
   export TAF_BACKEND_CONF=/path/to/backend.conf
   npm run dev
   ```
3. **Local Dev Fallback:**
   If no config file is provided, defaults to `127.0.0.1:3306`, user `root`, database `taf_backend`.

### Supported `backend.conf` Properties

```properties
enable_backend_reporting = 1
backend_db_host = 127.0.0.1
backend_db_port = 3306
backend_db_name = taf_backend
backend_db_user = root
backend_db_pass = taf
backend_db_ssl_ca = /path/to/ca.pem
backend_db_ssl_cert = /path/to/cert.pem
backend_db_ssl_key = /path/to/key.pem
backend_timeout = 5
backend_retries = 1
```

---

## Developer Workflows

All commands are run from the `web/` directory:

```bash
# 1. Typecheck strict TypeScript
npm run typecheck

# 2. Run unit and parity tests
npm test

# 3. Start local development server
npm run dev

# 4. Build standalone production bundle
npm run build

# 5. Start standalone production server
npm start

# 6. Re-seed local development database with synthetic data
npm run db:reset

# 7. Inspect database query execution plans (EXPLAIN)
npm run db:explain
```

---

## REST API Surface

All API endpoints return JSON in a standardized envelope:
- Success: `{ "data": ..., "meta": { "tookMs": number, "cursor": string | null } }`
- Error: `{ "error": { "code": string, "message": string, "details"?: unknown } }`

| Route | Method | Description |
|---|---|---|
| `/api/health` | `GET` | Healthcheck and database connectivity ping. |
| `/api/runs` | `GET` | Filtered list of test runs with keyset pagination (`cursor`, `limit`, `days`, `suite`, `host`, `dbVersion`, `workloadHash`, `tag`, `isBaseline`, `search`). |
| `/api/runs/:id` | `GET` | Detailed test run metadata, system specs, and resolved configuration parameters. |
| `/api/runs/:id/metrics` | `GET` | Distinct metric descriptors (`name`, `type`, `dimension`, `unit`) recorded for the run. |
| `/api/runs/:id/series` | `GET` | Iteration-aggregated metric points grouped by thread count (`avg`, `min`, `max`, `stdDev`). |
| `/api/compare` | `GET` | Side-by-side comparison between `?baseline={id}&candidate={id}` with `workload_hash` compatibility guard. |
| `/api/dashboard` | `GET` | Single-round-trip dashboard aggregation (default `days=2`, multi-dimensional AND filtering, status rollups, and keyset-paginated regression feed). |

---

## Comparison Semantics (`do_compare()` Parity)

The comparison engine replicates MariaDB's native `do_compare()` stored procedure (`create_backend.sql`):
1. **Inherited Thresholds:** Thresholds (`pct_warning`, `pct_fail`, `pct_gain`) are always loaded from the **baseline** run, not the candidate.
2. **Workload Compatibility:** Only runs sharing an identical `workload_hash` are validly comparable. Mismatched hashes trigger the Incompatibility Guard.
3. **Iteration Averaging:** Multiple iterations per thread count are averaged server-side before delta calculation.
4. **Metric Scope:** Only `metric_type IS NULL` or `metric_type = 'primary'` are compared.
5. **Max Delta Selection:** Selected by largest **absolute raw difference** (`ORDER BY ABS(raw_diff) DESC`).
6. **6-State Status Classification:**
   - `-1% <= delta <= +1%` → `PAR`
   - Negative: `|delta| < pct_warning` → `PAR-`; `|delta| < pct_fail` → `WARNING`; else → `REGRESSED`
   - Positive: `delta < pct_gain` → `PAR+`; else → `GAIN`
