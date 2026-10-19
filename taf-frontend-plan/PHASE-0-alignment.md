# Phase 0 — Alignment, Fork, and Local Database

**Goal:** leave this phase with a maintainer-approved proposal, a fork, and a
populated local database. **No frontend code is written in this phase.**

**Why this phase exists:** a frontend PR that lands cold into a 14-star
community repo maintained by one Perl specialist will be rejected. This phase is
cheap (a few hours) and it is the difference between a merged contribution and a
dead branch. It also converts an invitation into a visible public artifact.

**Keywords closed:** none directly. It removes the risk that makes every
downstream phase worthless.

---

## Preconditions

- [ ] Read `CONTEXT.md` in full.
- [ ] Re-read `https://github.com/MariaDB/TAF` README to check nothing changed
      since this plan was written (the repo had a single commit visible on
      `main` at the time of writing — if there are new commits, re-verify
      `create_backend.sql`).
- [ ] Confirm your GitHub handle is what you want the contribution attributed to.

---

## Step 0.1 — Fork and verify

```bash
git clone https://github.com/<your-handle>/TAF.git
cd TAF
git remote add upstream https://github.com/MariaDB/TAF.git
git fetch upstream && git checkout -b web-frontend upstream/main
```

Verify the tree matches `CONTEXT.md`:

```bash
test -f libs/reporter_libs/backend/backend_sql/create_backend.sql && echo "schema present"
ls libs/reporter_libs/
```

Confirm there is genuinely no frontend yet:

```bash
find . -name package.json -not -path "*/node_modules/*"
find . \( -name "*.tsx" -o -name "*.jsx" -o -name "*.vue" \) -not -path "*/third_party/*"
```

Both commands are expected to return nothing.

## Step 0.2 — Stand up a local backend database

```bash
docker run -d --name taf-db \
  -e MARIADB_ROOT_PASSWORD=taf \
  -e MARIADB_DATABASE=taf_backend \
  -p 3306:3306 mariadb:11

docker exec -i taf-db mariadb -uroot -ptaf \
  < libs/reporter_libs/backend/backend_sql/create_backend.sql

# confirm 5 tables + procedures
docker exec -it taf-db mariadb -uroot -ptaf -e "
  SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='taf_backend';
  SELECT ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA='taf_backend';"
```

Expected tables: `system_under_test`, `db_config_set`, `db_config_param`,
`test_run`, `results`, `test_run_comparison`.

> **Safety:** `create_backend.sql` starts with `DROP DATABASE IF EXISTS
> taf_backend;`. Only ever run it against this disposable container. Never point
> it at a shared or remote instance.

## Step 0.3 — Generate real seed data (preferred over hand-written INSERTs)

Two options, in priority order.

**Option A — real TAF output.** Enable backend reporting against the local
container and run a real test suite, so the schema is populated by TAF itself and
the data is guaranteed shape-correct:

1. Copy `libs/reporter_libs/backend/working/backend.conf.example` to your
   properties directory and set `enable_backend_reporting = 1`,
   `backend_db_host = 127.0.0.1`, `backend_db_port = 3306`,
   `backend_db_name = taf_backend`, `backend_db_user = root`,
   `backend_db_pass = taf`.
2. Build the backend parser jar with `libs/reporter_libs/backend/build_backend_parser.sh`
   (requires a JDK; a MariaDB JDBC driver and a JSON jar must be resolvable).
3. Run the sample suite: `perl taf.pl --prop=./properties/examples/test_01.template_hello.properties`

**Option B — generated fixture script.** If Option A is blocked on toolchain
availability, write `web/scripts/seed-dev-db.mjs` that generates rows through the
existing stored procedures (`insert_system_identity`, `insert_full_db_config`,
`insert_test_run`, `insert_result`) so the schema invariants — identity hashes,
uniqueness, foreign keys — are exercised the same way production exercises them.
Commit it with a header stating it generates **synthetic** data for local
development only, and never for any published environment.

Requirements for whatever you use:

- at least 2 systems, 3 `db_version` values, 3 suites, 2 config sets
- at least one `is_baseline = TRUE` run with a populated `baseline_notes`
- at least 3 candidate runs sharing that baseline's `workload_hash`
- at least one run with a **different** `workload_hash` (needed to exercise the
  incompatibility warning in Phase 3)
- `thread_list` like `"4,8,16,32,64,128"`, 2+ iterations, both `primary` and
  `additional` metrics, at least one `NULL` `metric_type`, one `extra_data` JSON
  value
- `results` large enough to prove the aggregation path (a few thousand rows for
  one run) — this is the case that a naive frontend will choke on

## Step 0.4 — Draft and file the proposal issue

Open an issue on `MariaDB/TAF`. Title: *"Proposal: optional web frontend for TAF
results (run browser, compare view, dashboard)"*.

Plain-language body — the maintainer is not a frontend developer:

```markdown
## What

An optional web frontend for the TAF backend database (`taf_backend`), covering
the three views discussed:

1. **Run browser** — list automated runs (suite, DB maker/version, system,
   baseline, tag, date range), tick two or more, press **Compare**.
2. **Compare view** — baseline vs candidate, per-thread and per-metric deltas,
   with the same status classification TAF already uses in `do_compare()`
   (PAR / PAR- / PAR+ / WARNING / REGRESSED / GAIN) and the run's own
   `pct_warning` / `pct_fail` / `pct_gain` thresholds.
3. **Dashboard** — recent automated runs with their comparison status; click a
   run to open baseline vs incoming.

## Constraints I intend to honour

- **Zero impact on the Perl harness.** All new files live under `web/`. No `.pm`,
  `taf.pl`, `scripts/`, `test_suites/` or `properties/` file is modified, and
  TAF keeps working with no `web/` directory present.
- **Read-only.** The frontend only issues `SELECT`. It never calls the
  `insert_*` / `set_baseline` procedures.
- **The existing reporters stay.** `chart_and_tables_html.pm`,
  `chart_and_test_info_results_tables_html.pm`, `csv.pm`, `json.pm` and `text.pm`
  are untouched.
- **GPLv2+**, matching the rest of the repository, with the same file headers.

## Proposed location and stack

`web/` — Next.js (App Router) + TypeScript (strict) + Tailwind + shadcn/ui,
Recharts with `d3-scale` for the threshold bands, TanStack Query for server
state, Zustand for the selection state, Zod at the API boundary,
Vitest + React Testing Library + Playwright + axe-core, Docker + GitHub Actions.
The read layer is `mysql2` against `taf_backend`.

## Questions

1. **Replace or complement the Perl HTML reporters?** `chart_and_tables_html.pm`
   already renders static HTML with Chart.js from a CDN. My preference is
   *complement* — leave the Perl reporters as the zero-dependency path and let the
   frontend be the interactive one. Do you want the frontend to be able to
   generate the same static output instead?
2. **`web/` or a separate repository?** A separate repo (e.g.
   `MariaDB/TAF-web`) keeps TAF's Perl-only guarantee absolute, at the cost of
   version skew between backend schema and UI. I can follow whichever you prefer.
3. **May I add `.github/workflows/`?** There is no `.github` directory today. I
   would propose lint/typecheck/test/build only, no publishing.
4. **Is a read-only REST layer acceptable, or do you have a preference on the
   interface?** I plan `/api/runs`, `/api/runs/:id/series`,
   `/api/compare?baseline=&candidate=`, `/api/dashboard`, all read-only `SELECT`.
5. **`set_baseline` from the UI?** The `set_baseline_with_comment` procedure
   exists and would let the browser promote a run to baseline. I have left it out
   of scope because it makes the UI a writer. Worth a follow-up?
6. **When `enable_backend_reporting = 0`** (the default) the database is empty.
   I will design explicit empty states. Anything you would rather the UI show in
   that case?
```

Attach your Phase 0.3 seed script and a screenshot of the seeded run list if you
have one. A concrete artefact gets a concrete answer.

## Step 0.5 — Wait for the answers

**HARD GATE. Do not write frontend code until the maintainer replies.**

Replies that change the plan, and where to record the decision:

| Possible answer | Consequence |
|---|---|
| "Separate repo `MariaDB/TAF-web`" | All paths become relative to a new repo; Phases 1–6 start from an empty repo, not a TAF fork |
| "Complement, leave Perl alone" | Confirmed default; no static-output generation work |
| "Replace the HTML reporters" | **Scope increase** — add a Phase 3b for server-side static generation, and re-negotiate before starting |
| "`web/` is fine" | Proceed as written |
| No reply | Do not open a PR anyway. Nudge once after ~2 weeks, then park it |

Record the answers verbatim in `web/DECISIONS.md` (created in Phase 1) with the
date and issue number. This file is your evidence that the work was
maintainer-directed.

---

## Definition of Done

- [ ] Fork created, `web-frontend` branch based on `upstream/main`
- [ ] Local `taf_db` container with all 5 tables and all stored procedures present
- [ ] Database populated per Step 0.3 requirements (verify each bullet with a
      `SELECT` and paste the output)
- [ ] Proposal issue filed on `MariaDB/TAF`
- [ ] Maintainer reply received, or an explicit decision to proceed without one
- [ ] Answers recorded with issue number and date

---

## Risks and stop conditions

- **Stop and report** if the schema in the repo differs from `CONTEXT.md` in a
  way that breaks the planned API. Do not adapt silently — the maintainer needs to
  know.
- **Stop and report** if `create_backend.sql` fails to apply on `mariadb:11`.
  Report the exact error. A schema that will not install cleanly on the current
  MariaDB release is itself a valuable finding.
- **Stop and report** if the Perl toolchain is unavailable (no JDK, no JDBC
  driver) — do not spend the phase fighting build tooling. Fall back to Option B
  and say so in the issue.

---

## Interview / CV talking points

Do not claim credit for this phase beyond "proposed and got the design signed off
before writing code." The real signal, if it comes up, is that you recognised a
single-maintainer community repo needs social alignment before technical work, and
that you asked a Perl specialist to review a frontend proposal without assuming
frontend vocabulary.