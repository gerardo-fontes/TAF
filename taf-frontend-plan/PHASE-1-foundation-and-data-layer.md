# Phase 1 — Foundation and Read-Only Data Layer

**Goal:** a Next.js application with a typed, read-only REST API over
`taf_backend`, verified against the real schema.

**Why this phase exists:** every later phase is UI on top of this. Getting the
query layer right — especially server-side aggregation of the `results` table —
is the difference between a dashboard and a browser that hangs. This phase also
deliberately produces **no visible UI**, which keeps the PR reviewable by
someone who does not write frontend code.

**Keywords closed:** `typescript` (strict), `react`, `nextjs` (App Router, route
handlers), `rest`, `api`, `zod`, `docker`, `openapi`.

---

## Preconditions

- [ ] Phase 0 gate passed; maintainer answers recorded.
- [ ] Local database populated per Phase 0.3 and reachable on `127.0.0.1:3306`.
- [ ] If Phase 0 returned "separate repository", this phase starts from an empty
      repo instead of a TAF fork. Drop the `web/` path prefix throughout.

---

## Step 1.1 — Scaffold

```bash
cd TAF
mkdir -p web && cd web
npx create-next-app@latest . \
  --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" \
  --turbopack --use-npm
```

Confirm `strict: true` in `tsconfig.json` and do **not** relax it. Add:

```bash
npm i mysql2 zod
npm i -D @types/pg 2>/dev/null || true   # not needed; keep deps minimal
npm i -D vitest @vitejs/plugin-react jsdom @testing-library/react \
      @testing-library/jest-dom @testing-library/user-event msw
npm i -D tsx
```

`src/` layout:

```
web/
  src/
    app/
      layout.tsx
      page.tsx                 # Phase 2
      api/
        health/route.ts
        runs/route.ts
        runs/[id]/route.ts
        runs/[id]/series/route.ts
        runs/[id]/metrics/route.ts
        compare/route.ts
        facets/route.ts        # Phase 5, stub in Phase 1
        dashboard/route.ts     # Phase 5, stub in Phase 1
    lib/
      db/
        pool.ts
        queries/
          runs.ts
          results.ts
          compare.ts
        health.ts
      api/
        envelope.ts            # uniform response shape
        errors.ts
        pagination.ts          # keyset cursor
      domain/
        status.ts              # ComparisonStatus union + classification
        threads.ts             # thread_list parsing
        types.ts               # DTOs
    components/                # Phase 2+
  scripts/
    seed-dev-db.mjs            # Phase 0.3 Option B
  DECISIONS.md
  README.md
  Dockerfile
  docker-compose.yml           # app + db, for local dev
```

## Step 1.2 — Database pool

`src/lib/db/pool.ts`

- A single module-level `mysql2/promise` pool, created lazily so the module can
  be imported during `next build` without a live database.
- Connection settings from environment only — never hardcode, never commit
  credentials: `TAF_DB_HOST`, `TAF_DB_PORT`, `TAF_DB_USER`, `TAF_DB_PASSWORD`,
  `TAF_DB_NAME`, `TAF_DB_CONNECTION_LIMIT`.
- **TLS:** TAF's `backend.conf` explicitly supports
  `backend_db_ssl_ca` / `_ssl_cert` / `_ssl_key`. Implement an optional
  `TAF_DB_SSL_CA` path that produces an `ssl` option — the frontend must be able
  to talk to a TLS-configured backend. Do not set `rejectUnauthorized: false` as
  a convenience default; if you need it for local work, gate it behind an
  explicit env var.
- `dateStrings: true` for `DATETIME` so timestamps arrive as strings and are not
  silently shifted into the Node process timezone. This matters: a benchmark
  dashboard that renders times in the viewer's local zone instead of the runner's
  recorded zone is a real bug, and reviewers will catch timezone handling.
- `supportBigNumbers: true`, `bigNumberStrings: true` — `id` and `system_id` are
  `BIGINT` and exceed `Number.MAX_SAFE_INTEGER` territory in principle.
- Export a `withConnection` / `query` helper and a `healthcheck()` that runs
  `SELECT 1`.

## Step 1.3 — Domain types and the status classifier

`src/lib/domain/status.ts`

```ts
export const COMPARISON_STATUSES = [
  'PAR', 'PAR-', 'PAR+', 'WARNING', 'REGRESSED', 'GAIN',
] as const;
export type ComparisonStatus = (typeof COMPARISON_STATUSES)[number];

export interface Thresholds {
  pctWarning: number;   // baseline row's pct_warning, default 3
  pctFail: number;      // default 5
  pctGain: number;      // default 5
  pctDurationDrift: number; // default 10
}
```

`classifyChangePct(changePct: number, t: Thresholds): ComparisonStatus` must
reproduce `do_compare()` step 6 exactly:

```ts
if (changePct >= -1 && changePct <= 1) return 'PAR';
if (changePct < 0) {
  const a = Math.abs(changePct);
  if (a < t.pctWarning) return 'PAR-';
  if (a < t.pctFail) return 'WARNING';
  return 'REGRESSED';
}
return changePct < t.pctGain ? 'PAR+' : 'GAIN';
```

Thresholds come from the **baseline** row. Document that in a comment referencing
`create_backend.sql`.

`src/lib/domain/threads.ts` — parse `thread_list` (`"4,8,16,32,64,128"`), tolerating
whitespace, trailing commas and empty values. Return sorted ascending integers.
This is the canonical thread axis for every chart, so it needs one implementation,
not five.

## Step 1.4 — Query layer

`src/lib/db/queries/runs.ts`

`listRuns(filters)` — the run browser's data source. Filters: `suite`,
`dbMaker`, `dbVersion`, `systemId`, `isBaseline`, `testCaseTag`, `from`, `to`,
`search` (matches `test_name` / `test_case_tag`).

- **Keyset pagination**, not `OFFSET`. Sort by
  `(test_timestamp DESC, id DESC)`; cursor encodes that pair. `results` grows
  without bound and offset pagination degrades visibly on it.
- Join `system_under_test` for `host_name` — without it the list is unreadable.
- Include per-run aggregates via a grouped subquery, not N+1 queries:
  `SELECT COUNT(*) FROM results WHERE test_run_id = ?` as
  `resultCount`, and `COUNT(*) FROM test_run_comparison WHERE candidate_run_id = ?`
  as `comparisonCount`.
- **The critical performance constraint:** `results` may hold thousands of rows per
  run and many runs. Never select from `results` for the list view — only
  `COUNT` aggregated by `test_run_id`. Verify against a run with a few thousand
  result rows and confirm the query plan uses `idx_results_lookup`.

`getRunById(id)` — full `test_run` row, resolved system, and resolved config
(`db_config_set` + `db_config_param`). Return config parameters with names exactly
as stored (lower-cased by the ingest procedure — do not re-case).

`src/lib/db/queries/results.ts`

- `listMetricNames(runId)` — `SELECT DISTINCT metric_name, metric_type,
  metric_dimension, metric_unit FROM results WHERE test_run_id = ?`. Include the
  `NULL`-`metric_type` case explicitly rather than filtering it out; TAF allows
  `metric_type IS NULL` and `do_compare` treats NULL as comparable.
- `getSeries(runId, metric, { type })` — the charting payload:
  ```sql
  SELECT threads, iteration, metric_value, run_time, metric_unit
  FROM   results
  WHERE  test_run_id = ? AND metric_name = ?
    AND  (? IS NULL OR metric_type <=> ?)
  ORDER  BY threads, iteration
  ```
  Aggregate iterations server-side (`AVG`, plus `MIN`/`MAX`/`STDDEV` if you want
  to show variance) and return one row per `threads`. Returning raw per-iteration
  rows to the browser and averaging there is the mistake to avoid — it turns a
  few hundred KB into a few MB for no benefit.

`src/lib/db/queries/compare.ts`

`computeComparison(baselineId, candidateId)` reproduces `do_compare()` steps 1–5
in SQL:

```sql
SELECT b.threads,
       b.metric_name,
       AVG(b.metric_value) AS baseline_value,
       AVG(c.metric_value) AS candidate_value,
       AVG(c.metric_value) - AVG(b.metric_value) AS raw_diff,
       CASE WHEN AVG(b.metric_value) = 0 THEN 0
            ELSE (AVG(c.metric_value) - AVG(b.metric_value)) / AVG(b.metric_value) * 100
       END AS change_pct
FROM  results b
JOIN  results c
  ON  c.test_run_id = ?                       -- candidate
  AND c.threads     = b.threads
  AND c.iteration   = b.iteration
  AND c.metric_name = b.metric_name
  AND (c.metric_type      <=> b.metric_type)
  AND (c.metric_dimension <=> b.metric_dimension)
  AND (c.metric_unit      <=> b.metric_unit)
WHERE b.test_run_id = ?                       -- baseline
  AND (b.metric_type IS NULL OR b.metric_type = 'primary')
GROUP BY b.threads, b.metric_name
```

Then pick the max-delta row with **`ORDER BY ABS(raw_diff) DESC LIMIT 1`** —
absolute *raw* delta, matching TAF. Do not "improve" this to `ABS(change_pct)`;
matching the stored semantics is the entire point. Flag in a code comment that the
tie-break is non-deterministic in TAF (the `GROUP BY` includes `metric_name` but
the `ORDER BY` does not), and make your own tie-break deterministic and documented.

Also return, alongside the computed comparison, the matching stored
`test_run_comparison` row when one exists. This is not decoration: it gives the
UI a cross-check and gives Phase 6 a regression test.

`getCandidateBaselines(candidateId)` mirrors `get_candidate_baselines`:
`is_baseline = TRUE AND workload_hash = (candidate's) AND test_timestamp < candidate's`,
newest first.

## Step 1.5 — API surface

Uniform envelope in `src/lib/api/envelope.ts`:

```ts
{ "data": ..., "meta": { "cursor": string | null, "tookMs": number } }
{ "error": { "code": string, "message": string, "details"?: unknown } }
```

Every route returns correct HTTP status codes (`400` invalid input, `404`
missing run, `422` semantically invalid such as comparing incomparable runs,
`500` unexpected). Put the error code in the body too.

| Route | Query params | Returns |
|---|---|---|
| `GET /api/health` | — | `{ ok, database: 'up'\|'down', version }` |
| `GET /api/runs` | `suite, dbMaker, dbVersion, systemId, isBaseline, testCaseTag, from, to, search, limit, cursor` | `RunSummary[]` |
| `GET /api/runs/:id` | — | `RunDetail` (run + system + config params) |
| `GET /api/runs/:id/metrics` | — | `MetricDescriptor[]` (distinct name/type/dimension/unit) |
| `GET /api/runs/:id/series` | `metric, type` | `SeriesPoint[]` — one per thread, iteration-averaged |
| `GET /api/compare` | `baseline, candidate` | `Comparison` incl. `thresholds`, `compatible`, `rows`, `maxDelta`, `status`, `storedComparison` |
| `GET /api/facets` | — | distinct suites, db makers/versions, systems, tags + counts (Phase 5) |
| `GET /api/dashboard` | — | stub `501` in this phase |

**Validate every query parameter with Zod** before it reaches SQL. Use
**parameterised queries exclusively** — no string interpolation into SQL anywhere,
and no dynamic `ORDER BY` from user input.

`GET /api/compare` must return `compatible: false` (with a reason) when the two
runs' `workload_hash` values differ. Choosing an HTTP status is a judgement call:
prefer `200` with `compatible: false` so the UI can render *why* rather than a
dead end, and reserve `422` for structurally invalid input.

## Step 1.6 — Correctness harness (the most important deliverable here)

`src/lib/domain/compare.spec.ts` and `src/lib/db/queries/compare.spec.ts` —
table-driven tests asserting, against the populated local database, that
`computeComparison()` produces the same `status`, `threadOfMaxChange`,
`maxChangePct` and `maxChangeValue` as the stored `test_run_comparison` rows that
TAF's own `do_compare()` wrote.

Seed data must include at least one pair that TAF has already compared. If any
pair disagrees, **stop and report** — that is a genuine finding about TAF's
semantics, not something to paper over.

Also unit-test `classifyChangePct` at every threshold boundary: `±1`, exactly
`pct_warning`, exactly `pct_fail`, exactly `pct_gain`, and the zero-baseline case
(`change_pct` forced to `0`).

## Step 1.7 — Local dev ergonomics

- `docker-compose.yml` with `db` (`mariadb:11`, healthcheck-gated) and `app`
  services; `npm run dev` waits for a healthy database.
- `.env.example` documenting every variable with no real values.
- `npm run db:reset` — drops, re-creates and re-seeds using the Phase 0 script.
- `npm run db:explain` — runs `EXPLAIN` on the list and series queries and prints
  the plans, so performance claims are checkable rather than asserted.

## Step 1.8 — Docker

Multi-stage `Dockerfile`: `deps` → `builder` → `runner`, non-root user,
`npm ci`, `next build`, standalone output (`output: 'standalone'`). Document
`docker run -p 3000:3000 -e TAF_DB_HOST=... taf-web`.

---

## Definition of Done

- [ ] `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` all clean
- [ ] `curl localhost:3000/api/health` → `{"ok":true,"database":"up"}`
- [ ] `GET /api/runs` paginates by cursor with correct ordering, and its `EXPLAIN`
      uses an index on `results`
- [ ] `GET /api/runs/:id/series` returns iteration-averaged points, not raw rows
- [ ] `GET /api/compare` matches stored `test_run_comparison` rows on every seeded
      pair (paste the test output)
- [ ] `compatible: false` is returned for differing `workload_hash`, with a reason
- [ ] `classifyChangePct` boundary tests pass
- [ ] SQL injection check: every query parameterised; Zod validates all inputs
- [ ] Docker image builds and serves `/api/health`
- [ ] Every new file has the GPLv2+ header
- [ ] `web/DECISIONS.md` records the Phase 0 maintainer answers verbatim
- [ ] `web/README.md` documents setup, env vars, and the decision to keep the
      frontend read-only

---

## Commit plan

One PR. Suggested commits within it:

1. `chore(web): scaffold Next.js app with strict TS, Tailwind, ESLint`
2. `feat(web): mysql2 pool with env config, optional TLS, lazy init`
3. `feat(web): domain types, comparison status classifier, thread_list parsing`
4. `feat(web): read-only run/result/compare queries with keyset pagination`
5. `feat(web): REST routes with Zod validation and uniform envelope`
6. `test(web): assert computed comparisons match stored test_run_comparison rows`
7. `build(web): multi-stage Dockerfile, compose for local dev, db reset script`
8. `docs(web): README and DECISIONS from Phase 0 alignment`

---

## Risks and stop conditions

- **Stop and report** if `do_compare()` semantics cannot be reproduced exactly.
  Report which stored rows disagree and by how much.
- **Stop and report** if the list query cannot be served by an index at realistic
  volume. Do not paper over it with an unbounded `SELECT`.
- **Never** add a write path in this phase. If you find yourself wanting
  `set_baseline`, write it down in the PR description as a follow-up proposal.
- **Never** weaken `strict: true` to make a type error go away. Fix the type.

---

## Interview / CV talking points

- Read a 1,540-line stored-procedure schema and identified that the frontend must
  reproduce a specific classification algorithm (six states, thresholds read from
  the baseline row, max-delta selected on absolute *raw* delta) — then wrote a
  parity test proving the TypeScript implementation agrees with the SQL the
  database already contains.
- Solved the N+1 and unbounded-`results` problem with server-side aggregation and
  keyset pagination, and proved it with `EXPLAIN` output rather than a claim.
- Handled a `BIGINT`-keyed schema and `DATETIME` timezone semantics correctly —
  the two things that silently corrupt dashboards in production.