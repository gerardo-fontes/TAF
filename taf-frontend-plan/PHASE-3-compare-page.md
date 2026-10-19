# Phase 3 — Compare View

**Goal:** feature #2. Baseline vs candidate with per-thread, per-metric deltas,
TAF's own status classification, and an explicit warning when two runs are not
comparable.

**Why this phase exists:** this is the highest-value screen in the product and
the one where correctness is visible. It is also where the most interesting
engineering judgement lives — reproducing another system's semantics exactly,
and refusing to render a meaningless comparison.

**Keywords closed:** `tanstack-query` (real usage), state management
architecture, server/client state separation, URL state, CSV export, domain
modelling, responsive data tables, Web Share/clipboard APIs.

---

## Preconditions

- [ ] Phase 2 gate passed.
- [ ] `GET /api/compare` verified against stored `test_run_comparison` rows.

---

## Step 3.1 — Route and layout

`src/app/compare/page.tsx` — server component reading
`?baseline=&candidate=`, validating both with Zod, fetching the comparison, and
rendering.

Layout:

```
┌─────────────────────────────────────────────────────────┐
│  Run header pair: baseline run  ⟷  candidate run        │
│  status badge · max delta · threshold provenance         │
├─────────────────────────────────────────────────────────┤
│  [metric selector]  [type: primary/additional] [unit]   │
├─────────────────────────────────────────────────────────┤
│  Comparison table (per thread, per metric)              │
├─────────────────────────────────────────────────────────┤
│  Thread-scaling chart placeholder (Phase 4)             │
└─────────────────────────────────────────────────────────┘
```

A bare "missing parameter" or "run not found" page is acceptable only with a link
back to the browser. Every failure path in this view needs a way forward.

## Step 3.2 — The incompatibility guard (build this first)

Before any rendering, compare `workload_hash` on both runs.

If they differ, render a prominent, non-dismissible notice:

> **These runs are not comparable.**
> Baseline `MDEV39497_BASELINE` and candidate `TPCC_SCALE_200` describe different
> workloads (`workload_hash` differs), so per-thread deltas are not meaningful.
> Show comparison anyway.

- The main table renders collapsed/disabled, not silently — "Show anyway" is an
  explicit, per-session opt-in.
- Explain *why*, using TAF's own vocabulary: `workload_hash` encodes system,
  config, suite, harness, client, DB engine/version, thread pattern, iteration
  count and variable knobs. Changing threads or DB version changes the hash.
- Offer the nearest valid comparison: call `getCandidateBaselines` and list the
  runs that *are* compatible with the candidate, as links.

This is the single most important rule in the product. TAF's `do_compare()`
assumes a shared `workload_hash`; the frontend is the only place that assumption
can be surfaced. A comparison page that renders deltas across incompatible
workloads is worse than no page, because the numbers look authoritative.

## Step 3.3 — Run header pair

Side-by-side cards:

- `test_name`, `suite_name`/`suite_version`, `db_maker`/`db_version`,
  `test_case_tag`, `host_name`/`cpu_model`/`ram_gb`/`os_name`,
  `thread_list`, `test_timestamp`, `test_duration`, `connector`.
- `is_baseline` badge, and `baseline_notes` **verbatim** when present — the
  maintainer writes things like `MDEV-12345 : Parser regression` there and it is
  the single most useful piece of context on the page. Render as preformatted
  text, never as markdown, never truncated.
- A **swap** control that flips baseline and candidate in the URL via
  `router.replace` — no page reload, no lost state.
- A **change selection** link back to the browser that preserves the filters you
  came from (pass them through as `searchParams`, not as lost state).

## Step 3.4 — Status badge

A single prominent badge from the `status` returned by the API.

Design constraint: **never encode status by colour alone.** `GAIN` and `REGRESSED`
must be distinguishable in greyscale and to a colour-blind reader. Each badge
carries an icon/glyph and a text label:

| Status | Meaning | Direction |
|---|---|---|
| `GAIN` | improvement beyond `pct_gain` | positive |
| `PAR+` | small improvement | neutral-positive |
| `PAR` | within ±1% | neutral |
| `PAR-` | small regression | neutral-negative |
| `WARNING` | regression between `pct_warning` and `pct_fail` | negative |
| `REGRESSED` | regression beyond `pct_fail` | negative |

Use a single accent hue with escalating intensity plus the glyph, rather than a
red/green-only scheme. Define the six states as design tokens in one place
(`statusColor()`, `statusGlyph()`, `statusLabel()`), so adding a seventh state later
is a three-line change. Note that TAF's own header comment says "7-state" while the
`ENUM` declares six — keep the mapping to the `ENUM`, and mention the discrepancy
in the PR.

Supporting text under the badge, always:

> `WARNING` — regression of **−4.2%** at **128 threads**, against thresholds
> `warning 3%` / `fail 5%` (from baseline run **#12**).

Naming the threshold source is not pedantry: TAF reads thresholds from the
**baseline** row, and a reader who assumes the candidate's thresholds will
misinterpret borderline results.

## Step 3.5 — Comparison table

Rows: one per `metric_name`. Columns: one per `threads` value, plus a summary.

```
metric            | 4      | 8      | 16     | 32     | 64     | max Δ
tpmC              | +0.8%  | -1.4%  | -4.2%  | -2.1%  | -0.9%  | -4.2% @128
total_order_cost  | +0.2%  | +0.1%  | -0.4%  | -0.2%  | —      | -0.4% @16
```

Requirements:

- Each cell shows the candidate's **absolute** value (with unit) and the
  **percentage** change. Absolute alone hides the scale; percentage alone hides
  magnitude. Show both, in a `<td>` with a `<span>` per value.
- `raw_diff` is available for the max-delta row — surface it, because TAF selects
  the max on absolute raw delta, and a reader comparing a `latency` metric against
  a `tpm` metric needs the raw number to make sense of it.
- Metrics with no matching row in the candidate render as `—` with a
  `title` explaining "no matching (threads, iteration, metric_name, metric_type,
  metric_dimension, metric_unit) tuple in the candidate run". Do not render `0`.
- **Show the delta table for every comparable metric, not only the max-delta
  metric.** The stored summary is one row; the useful information is the whole
  picture. Highlight the max-delta cell per metric so the eye lands correctly.
- Add an explicit indicator when the `metric_type IS NULL` case is in play, since
  TAF compares NULL types but the UI's "primary/additional" filter would otherwise
  hide them.
- Sticky first column and sticky header. Horizontal scroll on narrow screens with
  the metric name pinned.
- `tabular-nums` on every numeric cell so digits align down the column.
- Export: **CSV** download of the full table (metric, unit, each thread's
  baseline, candidate, raw diff, change pct), built server-side so it works for
  datasets larger than the DOM. Include a header comment row with run ids,
  `workload_hash`, thresholds and generation timestamp — provenance that makes the
  file useful months later.

## Step 3.6 — Data fetching for this route

This is the legitimate use of TanStack Query:

- The initial comparison is server-rendered (server component).
- Hydrate it into the client cache via `prefetchQuery` +
  `HydrationBoundary`, so the client cache starts warm and there is no second
  fetch on mount.
- The client's job is *interactional* refresh: re-running the comparison with
  changed thresholds, toggling primary/additional, and comparing a third run
  against the baseline.
- Query keys must encode every input: `['comparison', baselineId, candidateId,
  pctWarning, pctFail, pctGain]`. Thresholds are overridable in the UI
  ("what if `pct_fail` were 3%?") — a genuinely useful analysis feature for a
  performance engineer, and the reason the key must include them.

Server actions are the wrong tool here: the data is read-only and the comparison
is a pure function of ids and thresholds, so a `GET /api/compare` with a proper
cache key is simpler and shareable. Explain this choice in the PR — "why not a
Server Action?" is a standard interview question.

## Step 3.7 — Freshness

The backend is written by TAF runs, so data can change while the page is open.

- Do **not** poll by default. Poll only when the candidate run's state could
  plausibly still change, and expose it as an explicit control: a
  "last compared" timestamp plus a **Refresh** button.
- Never auto-invalidate on an interval without saying so. An engineer reading a
  regression table needs to trust that what they see is what the database said.
- `staleTime` in the tens of seconds is right; `refetchOnWindowFocus` on is a
  sensible default.

---

## Definition of Done

- [ ] `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` all clean
- [ ] Displayed `status`, max-delta thread, and max-delta percentages match stored
      `test_run_comparison` rows for every seeded pair (paste test output)
- [ ] Differing `workload_hash` shows the incompatibility notice; the table is
      gated behind an explicit "Show comparison anyway"
- [ ] The guard offers compatible baselines from `getCandidateBaselines`
- [ ] Every status badge is distinguishable in greyscale (verify by screenshotting
      with colour removed)
- [ ] Threshold provenance ("from baseline run #N") is displayed
- [ ] Cell values match `do_compare()` arithmetic; `—` is used for genuinely
      absent data, never `0`
- [ ] CSV export contains absolute values, deltas, thresholds, workload hashes and
      run ids
- [ ] Swap and change-selection both work without a full reload
- [ ] Keyboard: fully traversable, swap and export reachable
- [ ] Axe: zero serious/critical; table semantics verified
- [ ] Mobile width: usable with sticky metric column (screenshot)
- [ ] Every new file has the GPLv2+ header

---

## Commit plan

1. `feat(web): compare route with URL-driven baseline/candidate params`
2. `feat(web): workload_hash incompatibility guard with compatible-baseline suggestions`
3. `feat(web): run header pair with swap and verbatim baseline_notes`
4. `feat(web): status badge component with direction glyphs and threshold provenance`
5. `feat(web): per-thread per-metric comparison table with sticky column and max-delta highlight`
6. `feat(web): server-generated CSV export with run provenance header`
7. `feat(web): threshold override control wired into the query key`
8. `test(web): table cell rendering, status badge mapping, and guard behaviour`

---

## Risks and stop conditions

- **Stop and report** if the computed comparison disagrees with a stored
  `test_run_comparison` row. Do not "fix" the UI to match a row you believe is
  wrong without raising it first — that is how a real semantic bug gets shipped
  into a foundation's tooling.
- **Never** silently compare incompatible workloads. If the maintainer asks to drop
  the guard, make it a documented, default-on setting with a warning — do not
  delete the logic.
- **Do not** re-implement `do_compare()` in the client. Compute on the server; the
  client renders. The one place client-side logic belongs is presentation
  thresholds derived from the server's response.
- **Watch for** the `metric_type IS NULL` case disappearing from the UI. TAF
  compares it; your filter must not hide it.

---

## Interview / CV talking points

- Reproduced an existing system's comparison semantics exactly — six-state
  classification, thresholds read from the baseline row, max-delta selected on
  absolute *raw* delta rather than percentage — and proved equivalence with a
  parity test against rows the database itself produced.
- Product engineering judgement: refused to render a comparison across incompatible
  workloads, explained why in the maintainer's own vocabulary, gated the override
  behind explicit consent, and surfaced the nearest valid alternative.
- Accessibility as engineering, not decoration: status conveyed by glyph and label
  as well as colour, verified in greyscale, with threshold provenance shown so a
  reader can audit the classification rather than trust it.
- CSV export with embedded provenance, generated server-side — making an
  engineering artifact self-describing.