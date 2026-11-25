<!--
#############################################################################
# web::CONTRIBUTING.md
#
# Created: November 2026
# Last Modified: November 2026
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
# Contribution guidelines and coding conventions for the TAF Web Frontend.
#############################################################################
-->

# Contributing to the TAF Web Frontend

Thank you for contributing to the **Test Automation Framework (TAF)** Web Frontend!

This guide outlines core constraints, coding conventions, and verification steps required for all contributions to `libs/reporter_libs/backend/backend_reporters/web/`.

---

## 1. Golden Rules & Architectural Constraints

1. **Zero Perl Impact:**
   - Never add dependencies to the Perl test harness or modify files outside `libs/reporter_libs/backend/backend_reporters/web/`.
   - Core TAF (`taf.pl`, `libs/**`, `test_suites/**`, properties files) must remain untouched. If the `web/` directory is deleted or absent, TAF must run cleanly without errors.

2. **Read-Only Database Access:**
   - The frontend application must maintain a strict read-only posture toward the database (`taf_backend`).
   - Only `SELECT` statements are permitted in application code. Never issue `INSERT`, `UPDATE`, `DELETE`, or call write-side stored procedures (`insert_*`, `set_baseline*`).

3. **Standalone Execution:**
   - The frontend builds as a standalone, moveable Node.js application (`output: 'standalone'` in `next.config.ts`).
   - It must run without assuming Docker runtime presence or fixed absolute repository directory paths.

4. **License & Headers (GPLv2+):**
   - All new source files (`.ts`, `.tsx`, `.mjs`, `.md`) must carry the standard GPLv2+ license block:
     ```
     This file is part of the Test Automation Framework (TAF).
     Copyright (c) 2025-2026 MariaDB Foundation, Jonathan "jeb" Miller and Gerardo Fontes
     Licensed under the GNU General Public License, version 2 or later (GPLv2+).
     ```

5. **Exact `do_compare()` Parity:**
   - Comparison mathematics must replicate MariaDB's `do_compare()` stored procedure:
     - Baseline thresholds (`pct_warning`, `pct_fail`, `pct_gain`) take precedence over candidate thresholds.
     - Workload compatibility guard enforces matching `workload_hash` values.
     - 6 status classifications: `PAR`, `PAR-`, `PAR+`, `WARNING`, `REGRESSED`, `GAIN`.
     - Max change selected by largest absolute raw difference (`ABS(raw_diff) DESC`).

---

## 2. Development Setup

```bash
cd libs/reporter_libs/backend/backend_reporters/web

# Install dependencies
npm install

# Start development server
npm run dev

# Connect to custom database via backend.conf
export TAF_BACKEND_CONF=/path/to/backend.conf
npm run dev
```

---

## 3. Verification Checklist

Before submitting a pull request, ensure all verification commands pass cleanly:

```bash
# 1. Typecheck strict TypeScript
npm run typecheck

# 2. Linting
npm run lint

# 3. Unit, Parity, E2E, and Accessibility Test Suite
npm test

# 4. Standalone Production Build
npm run build

# 5. Database Query Execution Plan Analysis
npm run db:explain
```

---

## 4. Accessibility Standards (WCAG 2.1 AA)

All user interface components must meet WCAG 2.1 AA accessibility standards:
- Forms and selects must have explicit accessible labels (`id` + `<label htmlFor="...">` and `aria-label`).
- Interactive elements must never be nested (`nested-interactive` violation).
- Tables must have accessible `aria-label`, caption, and header column scopes.
- Accessibility tests are automated with `axe-core` under `src/e2e/a11y.spec.tsx`.

---

## 5. Git Commit Guidelines

Commit messages must follow MariaDB / TAF repository conventions:
```
<subsystem>: <short summary under 72 chars>

<detailed description of why the change was made and what was done>

- Key change 1
- Key change 2

Signed-off-by: Contributor Name <contributor@example.com>
```

