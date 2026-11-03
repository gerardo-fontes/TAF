<!--
#############################################################################
# web::SCHEMA_PROPOSAL.md
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
# Schema improvement proposal for adding semantic metric directionality
# to TAF's results table.
#############################################################################
-->

# Schema Improvement Proposal: Semantic Metric Directionality

**Date:** October 2026  
**Author:** Gerardo Fontes & Jonathan "jeb" Miller  
**Target:** `results` table in `libs/reporter_libs/backend/backend_sql/create_backend.sql`

---

## 1. Context & Motivation

TAF's `results` table records per-iteration benchmark metrics:

```sql
CREATE TABLE results (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    test_run_id      BIGINT NOT NULL,
    threads          INT NOT NULL,
    iteration        INT NOT NULL,
    run_time         DOUBLE,
    metric_name      VARCHAR(255) NOT NULL,
    metric_value     DOUBLE NOT NULL,
    metric_type      VARCHAR(64),
    metric_unit      VARCHAR(64),
    metric_dimension VARCHAR(64),
    ...
);
```

During automated triage and visual regression analysis, metrics diverge in semantic direction:
- **Higher is better:** Throughput measurements such as TPC-C `tpmC`, `queries_per_sec` (QPS), and `transactions_per_sec` (TPS). An increase (+10%) indicates a performance gain; a decrease (-10%) indicates a regression.
- **Lower is better:** Cost, latency, and duration measurements such as `avg_latency_ms`, `p99_latency_ms`, `total_order_cost`, and `execution_time_sec`. An increase (+10%) indicates a performance regression; a decrease (-10%) indicates a performance gain.

Currently, **the metric's semantic direction is absent from the database schema.**

---

## 2. Problem Statement

Without direction metadata in the schema:
1. Automated tools and dashboards cannot distinguish whether an increase in a metric represents a performance win (`GAIN`) or a performance failure (`REGRESSED`).
2. Charting libraries cannot reliably draw threshold bands (e.g., shaded regions representing `GAIN`, `WARNING`, and `REGRESSED` performance levels) without guessing.
3. Guessing direction from metric name substrings (e.g., regex matching `latency` or `cost`) is brittle and prone to false positives or errors on custom or proprietary benchmark suites.

---

## 3. Proposed Schema Extension

Add a `metric_direction` column to the `results` table:

```sql
ALTER TABLE results
    ADD COLUMN metric_direction ENUM('higher_is_better', 'lower_is_better')
    DEFAULT 'higher_is_better'
    AFTER metric_dimension;
```

Alternatively, if metric metadata is normalized into a distinct metric registry table (e.g. `metric_descriptor`):

```sql
CREATE TABLE metric_descriptor (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    suite_name       VARCHAR(128) NOT NULL,
    metric_name      VARCHAR(255) NOT NULL,
    metric_direction ENUM('higher_is_better', 'lower_is_better') NOT NULL DEFAULT 'higher_is_better',
    default_unit     VARCHAR(64),
    description      TEXT,
    UNIQUE KEY uq_suite_metric (suite_name, metric_name)
);
```

---

## 4. Ingestion Path Compatibility

TAF benchmark harnesses (e.g., `sysbench.pm`, `hammerdb.pm`) already understand their own metrics. During extraction, the reporter can pass the direction attribute into the Java backend parser (`DbIngest.java`) and `insert_result` stored procedure.

### Backward Compatibility:
- Defaulting to `'higher_is_better'` ensures that existing scripts and historical rows remain valid.
- The change is purely additive and does not break existing `SELECT` queries or stored procedures (`do_compare()`).

---

## 5. Web Frontend Mitigation (Phase 4)

In Phase 4 of the web frontend, we uphold the principle: **Never guess metric direction**.

- Threshold bands are **disabled by default**.
- The UI exposes an explicit per-metric direction control (`None / Raw`, `Higher is better`, `Lower is better`) persisted in `localStorage`.
- Shaded threshold regions are drawn only when the user has explicitly confirmed the metric's direction.
- This document serves as the formal upstream proposal to eliminate this client-side workaround.

