<!--
#############################################################################
# web::DECISIONS.md
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
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1335
#
# Licensed under the GNU General Public License, version 2 or later (GPLv2+).
# See https://www.gnu.org/licenses/ for details.
#
# PURPOSE:
# Architectural Decision Record (ADR) capturing foundation alignment, design
# constraints, and maintainer direction for the TAF Web Frontend.
#############################################################################
-->

# TAF Web Frontend — Architectural Decisions Record (ADR)

This document records the foundational decisions agreed upon with the TAF maintainer (Jonathan "jeb" Miller, MariaDB Foundation). Every design choice here reflects maintainer guidance.

---

## 1. Designated Location & Zero Perl Impact

- **Decision:** The web frontend lives exclusively at `libs/reporter_libs/backend/backend_reporters/web/`.
- **Date:** October 2026
- **Rationale:**
  TAF's core guarantee is that the Perl test harness requires no runtime to install, no virtual environments to manage, and has zero dependency chain. Quarantining all web application code inside `libs/reporter_libs/backend/backend_reporters/web/` ensures:
  1. The Perl framework never gains a single Node.js dependency.
  2. If the `web/` directory is deleted or absent, `taf.pl` and all test suites continue to run without error.
  3. No existing Perl (`.pm`, `.pl`), properties (`.properties`), or shell script files are modified.

---

## 2. Standalone, Moveable & Zero Docker Dependency

- **Decision:** The web frontend is a standalone Node.js application and must not depend on Docker.
- **Date:** October 2026
- **Rationale:**
  The frontend must be able to run in diverse execution environments: local laptops, dedicated database servers, remote sponsor hardware, or headless CI runners.
  - The entire `web/` directory is self-contained and moveable (it can be copied anywhere without assuming fixed parent directory paths).
  - Docker is treated strictly as an optional developer convenience for running a local test database (`taf-db`), never as a deployment or runtime prerequisite.

---

## 3. Native `backend.conf` Integration

- **Decision:** The frontend reads connection information from TAF's standard `backend.conf` file via `--config` CLI argument or `TAF_BACKEND_CONF` environment variable.
- **Date:** October 2026
- **Rationale:**
  TAF already defines database connection details, credentials, SSL paths (`backend_db_ssl_ca`, `_cert`, `_key`), timeouts, and retries in `backend.conf`. The frontend must not require hardcoded credentials or separate configuration formats.
  - Usage: `node server.js --config=/path/to/backend.conf` or `export TAF_BACKEND_CONF=/path/to/backend.conf`.
  - Fallback: Defaults to local standard development ports if no configuration is provided.

---

## 4. Read-Only Database Posture

- **Decision:** The frontend is strictly read-only (`SELECT` queries only).
- **Date:** October 2026
- **Rationale:**
  The frontend does not execute `INSERT`, `UPDATE`, or `DELETE`, and does not invoke write-side stored procedures (`insert_*`, `set_baseline*`).
  - Read-only access guarantees that running or misconfiguring the frontend can never corrupt, overwrite, or mutate benchmark data.
  - Promoting runs to baselines (`set_baseline`) remains an administrative task managed via TAF runner scripts or future opt-in proposals.

---

## 5. Exact `do_compare()` Parity

- **Decision:** The frontend must reproduce the exact comparison mathematics and classification defined in `create_backend.sql` (`CREATE PROCEDURE do_compare`).
- **Date:** October 2026
- **Rationale:**
  A web frontend that presents different comparison conclusions than the database itself would confuse performance engineers.
  - **Threshold Source:** Thresholds (`pct_warning`, `pct_fail`, `pct_gain`) must be read from the **baseline** run, not the candidate.
  - **Status Classification:** 6 states (`PAR`, `PAR-`, `PAR+`, `WARNING`, `REGRESSED`, `GAIN`).
  - **Max Change Selection:** Selected by largest **absolute raw difference** (`ORDER BY ABS(raw_diff) DESC`), matching TAF's SQL logic.
  - **Metric Type Filtering:** Only `metric_type IS NULL` or `metric_type = 'primary'` are compared (additional metrics are excluded from comparison).
  - **Workload Hash Guard:** Comparing runs with differing `workload_hash` values represents incomparable workloads; the frontend must guard against this and display an explicit warning.

---

## 6. Coexistence with Existing Reporters

- **Decision:** The web frontend complements, rather than replaces, existing TAF report generators.
- **Date:** October 2026
- **Rationale:**
  TAF already includes `json.pm`, `csv.pm`, `text.pm`, and static HTML reporters (`chart_and_tables_html.pm`). The web frontend provides a dynamic, interactive dashboard over the database without altering or deprecating existing report outputs.

---

## 7. Scalable Dashboard Architecture

- **Decision:** Support high-scale benchmark analysis with user-defined time windows, multi-dimensional `AND` filtering, keyset pagination, and dual drill-downs.
- **Date:** October 2026
- **Rationale:**
  TAF can generate thousands of test runs across dozens of hosts and suites.
  - **Time Window:** Default **2 days** (optimized for active regression triage), with presets (`1, 2, 3, 7, 14, 30` days) and custom numeric inputs.
  - **Multi-Dimensional AND Filtering:** Filter simultaneously by suite, host/system, metric, db version, workload hash, tags, and severity.
  - **Keyset Pagination:** Cursor-based pagination on the regression feed to handle high-frequency runs without performance degradation.
  - **Dual Drill-Downs:** Clicking a run navigates to the Compare View; clicking a filter badge navigates to a pre-filtered Run Browser.

---

## 8. License & Attribution

- **Decision:** All new files carry the GPLv2+ license header attributing copyright to MariaDB Foundation, Jonathan "jeb" Miller and Gerardo Fontes.
- **Date:** October 2026
- **Rationale:**
  Preserves TAF's licensing terms (GPLv2 or later) and provides contributor attribution for the web frontend architecture.
