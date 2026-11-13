<!--
#############################################################################
# web::SETUP.md
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
# Step-by-step setup guide for engineers installing the TAF Web Frontend in
# their own environment, plus a structured way to send feedback.
#############################################################################
-->

# TAF Web Frontend: Setup and Feedback Guide

This guide gets the TAF web frontend running against a MariaDB `taf_backend` database on your own machine, in about 15 minutes. It then explains what we would like you to try and how to report what you find.

For architecture, API and comparison semantics, see [README.md](README.md).

---

## 1. What you will need

| Requirement | Notes |
|---|---|
| **Node.js 22.12 or newer** (22 LTS recommended) | Next.js needs 20.9+, but the test runner (Vitest 5) needs 22.12+. Check with `node -v`. |
| **npm** | Ships with Node. |
| **git** | To clone the repo. |
| **A MariaDB server** | Local or remote. You need permission to create a database, or a DBA who can do it for you. |
| **A modern browser** | Any current Chrome, Firefox, Edge or Safari. |

No Docker is required. The `web/` directory is self-contained.

---

## 2. Get the code

```bash
git clone https://github.com/gerardo-fontes/TAF.git
cd TAF
git checkout web-frontend
cd libs/reporter_libs/backend/backend_reporters/web
```

All remaining commands in this guide are run from this `web/` directory unless stated otherwise.

---

## 3. Prepare the database

Pick **one** of the two paths.

### Path A: fresh local database (most engineers)

> **Warning: destructive.** `create_backend.sql` starts with `DROP DATABASE IF EXISTS taf_backend;`.
> Running it erases any existing `taf_backend` database on that server. Never run it against a server that holds real benchmark results.

From the `web/` directory:

```bash
mariadb -u root -p < ../../backend_sql/create_backend.sql
```

(Use `mysql` instead of `mariadb` if that is the client binary on your system.)

This creates `taf_backend`, all tables (including `comparison_triage`), and the stored procedures.

### Path B: you already have a `taf_backend` database

Do **not** re-run `create_backend.sql`. Add only the new triage table:

```sql
USE taf_backend;

CREATE TABLE IF NOT EXISTS comparison_triage (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,

    comparison_id            BIGINT NOT NULL,

    engineer                 VARCHAR(255) NOT NULL,
    comment                  TEXT,
    workflow_status          VARCHAR(64) NOT NULL,

    updated_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_triage_comparison
        FOREIGN KEY (comparison_id)
        REFERENCES test_run_comparison(id),

    INDEX idx_triage_comparison (comparison_id)
);
```

### Database permissions

The frontend is read-only **except** for one table. The database user in `backend.conf` needs:

```sql
GRANT SELECT ON taf_backend.* TO 'taf_web'@'%';
GRANT INSERT ON taf_backend.comparison_triage TO 'taf_web'@'%';
FLUSH PRIVILEGES;
```

Replace `taf_web` and the host with your own user. If you connect as `root` on a local dev database, you can skip this. Without the `INSERT` grant, saving a triage fails with `INSERT command denied` (see [Troubleshooting](#8-troubleshooting)).

---

## 4. Configure the connection

The app reads TAF's standard `backend.conf` format.

```bash
cp ../../working/backend.conf.example ../../working/backend.conf
```

Edit `backend.conf` and fill in at least:

```properties
enable_backend_reporting = 1
backend_db_host = 127.0.0.1
backend_db_port = 3306
backend_db_name = taf_backend
backend_db_user = taf_web
backend_db_pass = your_password
```

Optional SSL settings (`backend_db_ssl_ca`, `backend_db_ssl_cert`, `backend_db_ssl_key`) are documented in the example file.

**Tell the app where the file is** using an environment variable. This is the most reliable way, including with `npm run dev`:

```bash
# macOS / Linux
export TAF_BACKEND_CONF=/absolute/path/to/backend.conf

# Windows PowerShell
$env:TAF_BACKEND_CONF = "C:\path\to\backend.conf"
```

> `backend.conf` holds a database password and is **not** git-ignored by default. Keep it out of commits: never run `git add .` or `git add -A` without checking `git status` first, or store the file outside the repo and point `TAF_BACKEND_CONF` at it.

If you set nothing, the app falls back to `127.0.0.1:3306`, user `root`, password `taf`, database `taf_backend`.

---

## 5. Install and run

```bash
npm ci
npm run dev
```

Then open:

- **Dashboard:** <http://localhost:3000/dashboard>
- **Health check:** <http://localhost:3000/api/health> should return `{"data":{"ok":true,"database":"up",...}}`

If the health check says `database: down`, fix the connection before going further (see [Troubleshooting](#8-troubleshooting)).

---

## 6. Load demo data (optional, development databases only)

An empty database gives an empty dashboard. To get something to look at:

```bash
# Base synthetic systems, configs, runs and comparisons
npm run db:reset

# Historical data: 60 days, 2 candidate runs per day by default
npm run db:seed-history

# Or choose the shape yourself
npm run db:seed-history -- --days=14 --runs-per-day=4
```

Notes:

- Despite its name, `db:reset` **adds** synthetic data; it does not wipe the database.
- `db:seed-history` appends new rows each time it runs, so repeating it grows the data set.
- The scripts read the same `TAF_BACKEND_CONF` variable, or accept `-- --config=/path/to/backend.conf`.
- **Never run the seeders against a database that holds real results.**

Sanity checks (the query tests use the configured database, so complete step 6 first):

```bash
npm run typecheck
npm test
```

---

## 7. Quick tour: what we would like you to try

### Results Matrix (new, most important to review)

The **Results Matrix** sits between the filter bar and the Regression Feed on `/dashboard`.

1. **Layout.** Columns are days (`MM/dd`), rows are candidate runs. Does it read clearly? Pick a window of 14 or 30 days to test many columns.
2. **Colors.** Each cell shows the % change in the same colors as the status badges (REGRESSED, WARNING, PAR-, PAR, PAR+, GAIN). Are they distinguishable and easy to scan?
3. **Open Compare.** Click a **percentage**. You should land on the Compare page for that baseline and candidate.
4. **Triage.** Click the **cell background** (not the percentage). Enter your name, choose a workflow action, add a comment and save. The cell should show the action right away. Reload the page and confirm it persists.
5. **Overwrite and attribution.** Open the same cell again, and save a different action. Ask a colleague to open it and confirm they see your name and update time.
6. **Scrolling.** With many days and rows, scroll right and down. The row headers should stay on the left and the day headers should stay at the top.
7. **Filters.** Change the time window, suite, host and severity. Does the matrix follow?
8. **Keyboard.** Can you Tab to a cell, press Enter to open triage, and Esc to close it?

### Rest of the dashboard and app

Anything else is welcome too: the Regression Feed, timeline, suite health, run browser, comparison charts and live polling (it refreshes every 60 seconds). Rough edges, confusing wording and missing information are all useful.

---

## 8. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| `/api/health` shows `database: down` | Wrong host, port, user or password. Check `backend.conf`, and check that `TAF_BACKEND_CONF` points to it (`echo $TAF_BACKEND_CONF`). Restart `npm run dev` after changing either. |
| App connects to the wrong DB, or uses `root`/`taf` | The config path was not picked up. Use the `TAF_BACKEND_CONF` environment variable in the same shell that runs `npm run dev`. |
| `Configuration file not found` | The path is wrong or relative to a different directory. Use an absolute path. |
| Dashboard loads but is empty | No data in the selected window. Try **All Time**, or seed demo data (step 6). |
| Matrix shows data but no triage ever appears | The `comparison_triage` table is missing. Use Path B above. |
| Saving triage shows `Failed to persist triage record (...)` | The text in the brackets is the real database error. `doesn't exist` means create the table (Path B). `INSERT command denied` means add the grant in section 3. A foreign key error means the comparison id is not in `test_run_comparison`; please report it. |
| `ECONNREFUSED` or timeouts | MariaDB is not running or is not reachable from your machine; check the firewall, `bind-address` and the port. |
| `npm ci` or startup errors about Node | Your Node version is too old. Run `node -v` and upgrade to 22.12 or newer. |
| Port 3000 is already in use | `npm run dev -- -p 3001`, then open <http://localhost:3001/dashboard>. |
| Tests fail with connection errors | The query tests need a reachable, seeded database. Complete steps 3, 4 and 6 first. |

---

## 9. Giving feedback

Honest, specific feedback is what we need most. Please send it as a **GitHub issue on the TAF repository**, or send it to Gerardo Fontes if that is easier. Short notes are fine, as one line is better than nothing.

### What helps most

- **First-run experience.** Where did this guide fail you, or leave you guessing? Which step took longest?
- **Does the Results Matrix fit how you triage?** Do you use rows per candidate run, or would one row per test (so recurring tests line up across days) serve you better?
- **Triage workflow.** Are the seven actions the right set (Investigating, Reproduced, Documented, Fix In Progress, Fixed, Blocked, Decided to Leave As Is)? What is missing? Is a single latest entry per comparison enough, or do you need to see history?
- **Identity.** Typing your name in the popup works for now. Would you prefer it tied to your login or to your git identity?
- **Information gaps.** What do you look for during triage that is not on screen?
- **Performance.** How many comparisons and days did you load, and did anything feel slow?

### Bug report template

Copy this into a new issue:

```markdown
**What I did** (numbered steps):
1.
2.
3.

**What I expected:**

**What happened instead:**

**Screenshot or screen recording:** (attach if possible)

**Error text:** (the exact message shown in the popup or page)

**Browser console / Network tab:** (open DevTools with F12; paste any red errors,
and for a failed save, the response of the `/api/dashboard/triage` request)

**Environment:**
- OS:
- Browser and version:
- Node version (`node -v`):
- MariaDB version (`SELECT VERSION();`):
- Data: seeded demo data, or real results? Roughly how many runs?
- Branch and commit (`git rev-parse --short HEAD`):
```

### Quick environment snapshot

```bash
node -v && npm -v && git rev-parse --abbrev-ref HEAD && git rev-parse --short HEAD
```

Thank you for trying it out.
