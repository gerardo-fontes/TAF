# Phase 4 — Charts

**Goal:** thread-scaling curves for one or many metrics, with baseline vs
candidate overlaid, plus the threshold bands that make a regression legible.

**Why this phase exists:** this is where the project stops being a CRUD view and
becomes a performance-analysis tool. It is also the highest-leverage skill for a
full-stack CV: data visualisation is what senior frontend candidates are actually
judged on, and Recharts/D3 is the single most-named charting requirement in
frontend job ads after React.

**Keywords closed:** `recharts`, `d3` (`d3-scale`), data visualisation, SVG,
responsive charts, accessible charts, performance (render cost, memoisation).

---

## Preconditions

- [ ] Phase 3 gate passed, including the CSV export.
- [ ] `GET /api/runs/:id/series` returns iteration-averaged points.
- [ ] Decide, and record in `web/DECISIONS.md`, the **Chart.js coexistence
      question** from Phase 0.9 of `CONTEXT.md`: the Perl reporter
      `chart_and_tables_html.pm` already loads Chart.js from a CDN. The frontend
      adds charts in its own stack; the Perl reporter is untouched. Say this
      explicitly in the PR so the reviewer is not left guessing whether you are
      replacing it.

---

## Step 4.1 — The core chart

`src/components/charts/ThreadScalingChart.tsx`

**X axis** — thread count (`threads`, integer, from `thread_list`). **This is not
a linear x-axis** in the usual sense: thread counts are typically `1,2,4,8,16,32,
64,128,256` — doubling. Plot against `log2(threads)` so the spacing reflects the
actual experiment design, and label ticks with the real thread values. A linear
axis bunches `1..8` and leaves `128..256` half-empty.

**Y axis** — metric value. Linear by default. Add a toggle for a log Y axis when
the value range spans orders of magnitude (it usually does: `4→256` threads on a
benchmark can move a metric by 10×+).

**Series** — one `<Line>` per (run, metric). Solid line for baseline, dashed for
candidate, so the distinction survives greyscale and colour-blind viewing. Never
baseline/candidate by hue alone.

**Error band** — plot `MIN`/`MAX` (or ±1 stddev) across iterations as a shaded
`Area` behind the line. Iteration variance is the honest signal in a benchmark,
and omitting it makes a 1% wobble look like signal. Return the extra aggregates
from `GET /api/runs/:id/series` (Phase 1 already specifies `MIN`/`MAX`/`STDDEV`).

**Reference lines** — mark `threads` where the run is `is_baseline`, and mark
`thread_of_max_change` from the comparison when rendering a compared pair.

## Step 4.2 — Threshold bands with `d3-scale`

The one thing off-the-shelf chart libraries do badly: shaded regions showing where
a metric value would be classified `WARNING` / `REGRESSED` / `GAIN` given the
run's thresholds.

Implementation:

- `npm i d3-scale d3-shape` (additive; you are not installing all of D3).
- `scaleLinear()` for the value axis, `scaleLog()` for the optional log axis,
  `scalePoint()` for thread counts on a log x-axis. Use `d3-shape`'s `line()` and
  `area()` generators for the path data — then hand the generated path strings to
  Recharts, or render as plain SVG inside the same chart wrapper.
- Render the bands as `<rect>` with `fillOpacity` low enough that the series stay
  readable, in the same token colours as the status badges so the chart and the
  badge never disagree.
- These bands only make sense when a metric's direction is known. TPC-C `tpmC` up
  is good; `total_order_cost` up is bad. **The metric's direction is not in the
  schema.** Do not guess it per metric name. Instead:
  - default to showing raw values with no band, and
  - add a per-metric direction control (better / lower-is-better) that the user
    sets, persisted locally,
  - and raise the missing-direction-metadata point in the PR as a schema
    improvement proposal to the maintainer (`results` could carry a
    `metric_direction` column, or `db_config_param` could carry it). That is a
    genuinely good contribution to raise — it is a design observation, not a
    feature request.

This is the honest use of D3 in a project: reach past the chart library for the
one visual it cannot express, using only the scale and shape modules.

## Step 4.3 — Multi-metric view

Let the user select several metrics. Then:

- Small multiples: a grid of sparkline-style charts, one per metric, sharing the
  x-axis. This is the correct default for "compare 12 metrics" — overlaying 12
  lines on different units produces an unreadable chart and a misleading common
  y-axis.
- Small multiples must share the x-axis but **not** the y-axis when units differ.
  Label each sub-chart with its metric name and unit.
- Cap at a sensible number (say 8) and say so, with a hint to filter rather than
  render 30 unusable tiles.

## Step 4.4 — Performance

`results` holds thousands of rows per run and a comparison spans two runs.

- Charts receive **iteration-averaged, per-thread** data only. Never pass raw
  per-iteration rows to a chart component.
- Memoise series transforms (`useMemo` on the input array) — recomputing the
  point array on every render is the usual cause of jank in dashboards.
- Set `isAnimationActive={false}` for the error bands and for the multi-metric
  grid; animated bands over dozens of charts look broken and cost frames.
- Set explicit `height` on every chart container. Responsive charts that size
  themselves from content produce layout shift.
- Provide a debounced hover (`onMouseMove`) rather than re-rendering the whole
  chart per pointer move; Recharts' `Tooltip` handles this, but keep the tooltip
  payload minimal.
- Add a `React.memo` boundary around each sub-chart in the multi-metric grid so
  hovering one tile does not re-render the other seven.
- **Measure it.** Record a `performance.md` in the PR with: dataset size, chart
  count, render time before and after memoisation, and bundle size of the charting
  dependencies. An assertion is not a measurement.

## Step 4.5 — Accessible charts

Charts are the usual accessibility failure point in engineering dashboards.

- The chart element gets `role="img"` and an `aria-label` summarising it:
  `"Thread scaling for metric tpmC: baseline rises from 12,400 at 4 threads to
  88,100 at 128 threads; candidate is 4.2% lower at 128 threads."` Generate this
  from the data rather than hardcoding it.
- Provide a **data table alternative** — a visually-hidden or collapsible table
  with the same values. This is the only genuinely accessible chart fallback and
  it also serves the CSV export.
- Threshold bands and the max-delta marker get text equivalents in the summary.
- Do not rely on the tooltip for essential information; anything only in the
  tooltip must also exist in the table or the summary.
- Respect `prefers-reduced-motion` — disable entry animations when set.

## Step 4.6 — Browser renderer

`src/lib/charts/theme.ts` — one place defining the colour tokens, the
greyscale-distinguishable dash patterns, and the axis label formats. Both the
chart and the compare table consume these tokens, so a change to a status colour
cannot leave the two views inconsistent. This is the small design-system
discipline that separates a dashboard from a demo.

---

## Definition of Done

- [ ] `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` all clean
- [ ] Chart plots baseline and candidate distinctly in greyscale (verify)
- [ ] X axis is log₂-spaced with real thread-count labels
- [ ] Iteration variance band rendered from real `MIN`/`MAX` (or stddev)
- [ ] Threshold bands appear only when metric direction is known, and the absence
      of direction metadata is documented in the PR as a schema proposal
- [ ] Multi-metric view uses small multiples with independent y-axes
- [ ] No layout shift on load; no animation across the multi-metric grid
- [ ] Every chart has a generated `aria-label` and a data-table alternative
- [ ] `prefers-reduced-motion` honoured
- [ ] `performance.md` in the PR with dataset size, render timings, bundle sizes
- [ ] Greyscale screenshot and full-colour screenshot in the PR description
- [ ] Every new file has the GPLv2+ header

---

## Commit plan

1. `feat(web): shared chart theme tokens for status colours and dash patterns`
2. `feat(web): thread-scaling line chart with log2 thread axis`
3. `feat(web): iteration variance band from min/max aggregates`
4. `feat(web): d3-scale threshold bands gated on metric direction`
5. `feat(web): small-multiples grid with independent y-axes and memoised tiles`
6. `perf(web): memoised transforms, disabled band animation, measured render times`
7. `a11y(web): generated chart summaries, data-table alternative, reduced motion`
8. `test(web): scale, series and accessibility snapshot tests`

---

## Risks and stop conditions

- **Stop and report** if charting a realistic dataset (thousands of result rows,
  8 metrics) cannot stay responsive after memoisation. Report the measurements.
  Do not solve it by truncating data silently — if you cap, say so on screen.
- **Do not** install all of D3. `d3-scale` and `d3-shape` only. Pulling in the
  full library in a project whose maintainer values "no dependency chain to
  maintain" undermines the proposal in Phase 0.
- **Do not** guess metric direction. The schema does not carry it. A band drawn
  from a guessed direction is a wrong chart that looks authoritative.
- **Do not** overlay metrics with different units on a shared axis. That is a
  correctness bug, not a style preference.
- **Watch for** Recharts v3 API differences (the current major) — check the
  installed version's docs rather than copying v2 examples.

---

## Interview / CV talking points

- Built the one visualisation the charting library could not express — threshold
  bands on a log-scaled axis — using only `d3-scale` and `d3-shape`, deliberately
  avoiding the full D3 dependency in a repo whose stated philosophy is minimal
  dependency chains.
- Correctly modelled a doubling thread-count experiment on a log₂ axis and
  iteration variance as an uncertainty band, rather than a single misleading line.
- Made charts accessible the only way that actually works: generated text
  summaries plus a real data table, not a tooltip.
- Optimised and **measured** — dataset size, render timings and bundle sizes in
  the PR — instead of asserting performance.