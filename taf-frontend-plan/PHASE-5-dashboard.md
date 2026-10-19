# Phase 5 — Dashboard

**Goal:** feature #3. A landing view of automated results that surfaces what
changed, and routes a click straight into baseline vs incoming.

**Why this phase exists:** the maintainer described this as *"a dashboard that
takes in the automated results, displays, and will take you to baseline vs
incoming when clicked on like ATR dashboard."* It is the entry point, and it is
where polling, aggregation and server-state caching become real problems rather
than configuration.

**Keywords closed:** `tanstack-query` (polling, cache invalidation, optimistic
updates), dashboard design, aggregation, time-series, keyboard/URL state.

---

## Preconditions

- [ ] Phase 4 gate passed.
- [ ] `GET /api/dashboard` stub replaced with a real implementation.

---

## Step 5.1 — `GET /api/dashboard`

One endpoint, several time windows. Default `window=30d`, allowed
`24h | 7d | 30d | 90d | all`.

**a. Status roll-up.** Counts per `status` over the window. Prefer deriving these
from `test_run_comparison` (already computed) over recomputing classifications in
the dashboard:

```sql
SELECT c.status, COUNT(*) AS n
FROM   test_run_comparison c
JOIN   test_run r          ON r.id = c.candidate_run_id
WHERE  r.test_timestamp >= ?
GROUP  BY c.status;
```

**b. Regression feed.** The rows a performance engineer actually wants:

```sql
SELECT c.id, c.baseline_run_id, c.candidate_run_id, c.status,
       c.thread_of_max_change, c.max_change_pct, c.created_at,
       r.test_name, r.suite_name, r.db_maker, r.db_version, r.test_case_tag,
       b.test_name AS baseline_test_name, b.test_timestamp AS baseline_timestamp
FROM   test_run_comparison c
JOIN   test_run r ON r.id = c.candidate_run_id
JOIN   test_run b ON b.id = c.baseline_run_id
WHERE  r.test_timestamp >= ?
ORDER  BY FIELD(c.status,'REGRESSED','WARNING','PAR-','PAR','PAR+','GAIN'),
         ABS(c.max_change_pct) DESC
LIMIT  50;
```

Order by severity first, then by magnitude. A dashboard sorted by timestamp
buries the regression you care about.

**c. Run timeline.** Daily counts of runs plus status counts per day — the
`GROUP BY DATE(test_timestamp), status` shape. Render as a stacked bar or a small
sparkline band.

**d. Suite health.** Per `suite_name`: runs, regressions, and the median
`max_change_pct`. Aggregating `GROUP BY suite_name` keeps this to one query.

**e. System inventory.** From `system_under_test` joined to `test_run` counts, so
a reader can see whether results are comparable across machines at all. Include a
warning when recent runs span more than one `system_id` — a timeline that mixes
results from different hosts is a misleading chart, and saying so is the honest
rendering.

**f. Baseline coverage.** How many runs have a compatible baseline, how many are
`is_baseline`, how many have never been compared. A maintainer looking at adoption
of the backend wants this.

All six in **one** endpoint, one round trip. A dashboard that fires eight requests
is a dashboard with a waterfall, and it is a legitimate code-review objection.

## Step 5.2 — Layout

```
┌──────────────────────────────────────────────────────┐
│  Status roll-up: 6 tiles, counts + % of total        │
│  (tile → pre-filtered regression feed)               │
├──────────────────────────────────────────────────────┤
│  Regression feed (severity-sorted)                   │
│  status │ suite │ run │ Δ% @ threads │ baseline │ ↗  │
├───────────────────────────┬──────────────────────────┤
│  Run timeline (per day)   │  Suite health table      │
├───────────────────────────┴──────────────────────────┤
│  Baseline coverage + system inventory                 │
└──────────────────────────────────────────────────────┘
```

- Status tiles are **links**, not divs: each carries its filter into the
  regression feed. Filtering by clicking a tile is the interaction that makes a
  dashboard worth more than a list.
- The feed row is a single link to `/compare?baseline=…&candidate=…` — the
  baseline-vs-incoming drill-down, exactly as requested.
- Empty state must handle an empty database (Phase 2 requirement applies again).
- `REGRESSED`/`WARNING` tiles carry an `aria-label` with the count so a screen
  reader user gets the number, not just a colour.

## Step 5.3 — Polling and caching

The backend changes when TAF runs execute.

- `GET /api/dashboard` polled every **60s** with TanStack Query
  (`refetchInterval: 60_000`), plus `refetchOnWindowFocus`.
- Expose the interval as a control — `Live / Paused`, with the last-updated time
  always visible. A performance engineer must be able to freeze the view before
  screenshotting or discussing numbers.
- Pausing must genuinely stop the polling, and the UI must say it is paused. Do
  not leave a hidden timer running.
- Query keys: `['dashboard', window]`. Switching windows is a key change, so
  TanStack Query serves the previous window instantly from cache while fetching
  the new one (`placeholderData: keepPreviousData`) — no empty flash.
- **Do not** pre-invalidate the whole cache on a dashboard refresh. Let it be one
  independent query; the drill-down is a navigation, not a dependency.

## Step 5.4 — Deep-linking and shareability

Every dashboard view must be reproducible from a URL: window, status filter, suite
filter, date range in `searchParams`. An engineer pasting a URL into a bug report
is the primary use case for this whole tool. State that in the PR description — it
explains why the URL discipline is worth the effort.

## Step 5.5 — Deep dive (baseline vs incoming from the feed)

Clicking a feed row lands on Phase 3's compare view. Two additions:

- **Context preservation.** Carry the dashboard's window and filters through as
  `searchParams` on the compare route so a "back" returns the user to the same
  dashboard view they left.
- **"No baseline" case.** A run that has never been compared must not dead-end.
  Offer: list compatible baselines via `getCandidateBaselines`, and a link to run
  a new comparison for any two selected runs. This is the same guard as Phase 3's,
  from the other direction.

## Step 5.6 — Perf-cost alignment

Index note worth raising in the PR, not fixing unilaterally: the dashboard's
time-window queries filter `test_run.test_timestamp`, and the table's indexes are
`uq_test_identity (system_id, config_id, suite_name, test_name, test_timestamp)`
and `idx_results_lookup` / `idx_results_compare`. A leading-column index on
`test_timestamp` would serve these aggregations better. Propose it; let the
maintainer own the schema change. This is the correct posture — you are a
contributor to a foundation's tool, not its owner.

---

## Definition of Done

- [ ] `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` all clean
- [ ] Dashboard loads from **one** API call (verify in the network panel, and
      state it in the PR)
- [ ] Roll-up counts match a direct SQL `GROUP BY` on the same window — include a
      verification query and its output in the PR
- [ ] Regression feed sorted by severity then magnitude
- [ ] Status tiles filter the feed via the URL
- [ ] Feed rows navigate to `/compare` with correct baseline/candidate orientation
- [ ] Polling every 60s, pausable, with visible last-updated time; pause genuinely
      stops the timer
- [ ] Window switching uses `placeholderData` with no empty flash
- [ ] Multi-system warning shown when recent runs span more than one `system_id`
- [ ] Baseline-coverage and suite-health sections populated
- [ ] Empty database state renders
- [ ] Axe: zero serious/critical; tiles expose counts to assistive tech
- [ ] Screenshot of the dashboard in the PR description
- [ ] Every new file has the GPLv2+ header

---

## Commit plan

1. `feat(web): dashboard endpoint with status roll-up, feed, timeline, health`
2. `feat(web): dashboard layout with status tiles and severity-sorted feed`
3. `feat(web): URL-driven window and status filters, tiles as links`
4. `feat(web): 60s polling with pause control and visible last-updated time`
5. `feat(web): window switching with keepPreviousData to avoid flash`
6. `feat(web): deep-link from feed to compare with context preservation`
7. `feat(web): no-baseline path offering compatible baselines`
8. `docs(web): note leading-index proposal for test_run.test_timestamp`
9. `test(web): roll-up parity test against direct SQL aggregation`

---

## Risks and stop conditions

- **Stop and report** if the dashboard requires more than one round trip to
  render. Do not solve a slow query by fanning out six client requests.
- **Stop and report** if window queries are slow at realistic volume. Propose the
  index; do not add schema changes in a frontend PR.
- **Never** let polling change what the user is looking at without saying so. If
  a refresh lands mid-read, keep scroll position and selection.
- **Do not** add a websocket/SSE layer. TAF has no push channel and inventing one
  would be scope creep the maintainer did not ask for. Polling is the correct
  answer; say why in the PR.

---

## Interview / CV talking points

- Designed a dashboard as one aggregation endpoint with correct ordering and
  semantic slicing, then verified the roll-up against direct SQL in a committed
  test — treating a dashboard number as a claim that must be auditable.
- Polling, cache keys, `placeholderData` and a genuinely effective pause control,
  with the reasoning that a performance engineer must be able to freeze a view
  before discussing numbers.
- Made every dashboard state URL-reproducible, because the primary workflow is
  pasting a link into a bug report.
- Flagged a missing leading index on `test_run.test_timestamp` as a proposal to
  the schema owner rather than shipping an unrequested schema change.