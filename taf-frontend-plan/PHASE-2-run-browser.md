# Phase 2 — Run Browser (listing, filters, multi-select)

**Goal:** the first visible screen. A filterable, sortable, paginated list of
automated runs with row checkboxes and a *Compare (n)* action that routes to
Phase 3 with two run ids selected.

**Why this phase exists:** this is feature #1 of the maintainer's three. It is
where the "consuming an API properly" skill — the #3 frontend job-market keyword
— is demonstrated.

**Keywords closed:** `react`, `tailwind`, `zustand`, `tanstack-query` (server
state), URL-as-state, list virtualisation, accessible table semantics.

---

## Preconditions

- [ ] Phase 1 gate passed, including comparison parity tests.
- [ ] `GET /api/runs`, `/api/runs/:id`, `/api/facets` return verified data.

---

## Step 2.1 — Server component shell

`src/app/page.tsx` is a **server component**. It reads `searchParams` directly
and awaits the first page of runs — first paint needs no loading spinner, which
is the entire point of the App Router and is worth demonstrating.

```tsx
export default async function Page({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const params = await searchParams;
  const query = runFilterSchema.parse(normalizeParams(params)); // Zod, on the server
  const { data, meta } = await listRuns(query);
  return (
    <>
      <RunFilters facets={facets} defaults={query} />   {/* client */}
      <RunTable initialRows={data} initialCursor={meta.cursor} />
    </>
  );
}
```

Filters and pagination live in the **URL**, not in a store. Shared, bookmarkable,
back-button-correct views of an engineering dashboard are a real product
expectation, and moving them to `searchParams` removes a whole class of state
bugs. Zustand is then reserved for what genuinely is client-only (Step 2.3).

If a filter value is invalid, do not throw. Fall back to defaults and surface a
dismissible notice — a 500 on a hand-edited query string is bad UX in a tool the
maintainer will use daily.

## Step 2.2 — `GET /api/facets`

Complete the Phase 1 stub. Distinct values with counts:

```sql
SELECT suite_name, COUNT(*) AS n FROM test_run GROUP BY suite_name ORDER BY n DESC;
SELECT db_maker, COUNT(*) AS n FROM test_run GROUP BY db_maker;
SELECT db_maker, db_version, COUNT(*) AS n FROM test_run
  GROUP BY db_maker, db_version ORDER BY db_version DESC;
SELECT id, host_name, cpu_model, ram_gb, os_name FROM system_under_test;
SELECT test_case_tag, COUNT(*) AS n FROM test_run
  WHERE test_case_tag IS NOT NULL GROUP BY test_case_tag;
```

Version strings do not sort lexically (`11.11.2` < `11.4.3` as text). Implement a
numeric-aware version comparator (`src/lib/domain/version.ts`) and use it for the
version facet ordering. Small detail, visible immediately to anyone who uses it.

## Step 2.3 — Selection state (Zustand)

`src/stores/selection.ts`

```ts
interface SelectionState {
  ids: number[];                       // ordered; index 0 = baseline candidate
  toggle: (id: number) => void;
  clear: () => void;
  setBaseline: (id: number) => void;   // promote to position 0
}
```

Rules:

- Maximum **2** selected (the maintainer described "check mark 2 and hit
  compare"). Attempting a third shows an inline message, not an `alert()`.
- Order is explicit. The first selection is the baseline by default, but the user
  can swap. Persist to `sessionStorage` so a mistaken navigation does not lose the
  selection.
- Never store the full run object — store ids only, and let TanStack Query own the
  data. Duplicating server data into a client store is the anti-pattern the 2026
  consensus is explicit about, and a reviewer will notice.

## Step 2.4 — Data fetching

Two layers, deliberately:

- **Initial page**: fetched on the server, passed down as props. No waterfall, no
  loading flash.
- **Pagination and filter changes**: client-side navigation via `router.push` with
  new `searchParams`, plus `<Link>` for back/forward correctness. Wrap
  `listRuns` in a `prefetch` helper keyed on the serialised params.

Reserve TanStack Query for the run **detail** fetch (Phase 3 opens a detail panel
that refetches independently of the list). Do not introduce TanStack Query merely
to fetch what the server component already fetched — that is a redundant layer,
and an interviewer asking "why is React Query fetching what your server component
just fetched?" would get a bad answer.

## Step 2.5 — The table

`src/components/runs/RunTable.tsx`

Columns, in order:

| Column | Source | Notes |
|---|---|---|
| checkbox | — | `aria-label={`Select run ${id}, ${testName}`}` |
| run | `test_name` + `test_case_tag` | tag as a small badge |
| suite | `suite_name` + `suite_version` | |
| database | `db_maker` / `db_version` | version rendered as a badge |
| system | `system_under_test.host_name` + `cpu_model` | truncate `cpu_model` with a title tooltip |
| threads | `thread_list` parsed | e.g. `4 · 8 · 16 · 32` |
| results | `resultCount` | right-aligned, tabular numerals |
| baseline | `is_baseline` | a distinct badge, not a colour alone |
| started | `test_timestamp` | ISO string, no client-side reformatting (see Phase 1 timezone note) |

Requirements:

- Semantic `<table>` with `<caption class="sr-only">`, `<thead>`, `scope="col"`.
  This is a data table; a grid of `<div>`s is wrong and hurts screen readers.
- Row selection is expressed as `aria-selected` on `<tr>` (with `role` left as
  `row` inside a `grid`-like wrapper only if genuinely needed). Checkboxes remain
  real `<input type="checkbox">`.
- Keyboard: arrow keys move between rows, `Space` toggles, `Enter` opens the
  detail panel. Announce selection changes with an `aria-live="polite"` status
  region: "2 runs selected."
- Row striping and hover affordance must not rely on colour alone — pair with a
  border or icon.
- Sortable headers: `started` and `results` client-side on the current page, with
  `aria-sort` set. Server-side sorting beyond the primary key is out of scope;
  document that limit in the UI as a tooltip rather than pretending.

## Step 2.6 — Row virtualisation

Add virtualisation **only if** the page size justifies it. Decision rule: if
`RunSummary` grows to include more fields or the page size rises above ~100,
virtualise with `@tanstack/react-virtual`. Otherwise render all rows and skip the
dependency. Do not add virtualisation to 20-row pages — it is complexity with no
payoff and it breaks keyboard navigation if done carelessly.

If you do virtualise, keep the checkbox column sticky and verify arrow-key
navigation still reaches off-screen rows.

## Step 2.7 — The Compare action

A sticky action bar that appears when `ids.length > 0`:

- Shows the selected runs as two chips with a **swap** control.
- Label: `Compare (2)`. Disabled until exactly 2 are selected.
- Clicking navigates to `/compare?baseline={ids[0]}&candidate={ids[1]}`, then
  clears the selection.
- `aria-disabled` plus a visible explanation rather than a silent disabled button.
- Keyboard shortcut `⌘/Ctrl + Enter` when two are selected, documented in a
  shortcuts hint. Announce via `aria-live` on focus change.

## Step 2.8 — Empty, error and loading states

The backend is **empty by default** (`enable_backend_reporting = 0`), so empty
states are a core requirement, not an edge case.

- No runs at all: explain that the backend has no data, name the exact TAF property
  that populates it (`enable_backend_reporting = 1` in
  `libs/reporter_libs/backend/working/backend.conf`), and link to
  `properties/examples/`. State the count of rows actually found.
- Filters matched nothing: distinguish from "no data at all" — offer "clear
  filters" and echo the active filter set.
- API error: show the `error.code` from the envelope, plus a retry. Never render a
  raw stack trace.
- Loading: `loading.tsx` with a skeleton matching the table shape, and
  `aria-busy="true"`.

---

## Definition of Done

- [ ] `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` all clean
- [ ] List renders real seeded runs; screenshots in the PR description
- [ ] Every filter round-trips through the URL; back/forward works
- [ ] Invalid query params degrade gracefully, no 500
- [ ] Selecting 3 runs is prevented with an inline explanation
- [ ] `Compare (2)` routes to `/compare?baseline=…&candidate=…` with the right
      orientation
- [ ] Full keyboard path works: reach a checkbox, toggle, reach Compare, activate
- [ ] Screen-reader pass: table semantics, `aria-sort`, `aria-selected`,
      `aria-live` announcements (test with VoiceOver or NVDA — state what you used)
- [ ] Empty-database and no-match states both render distinct copy
- [ ] Axe scan reports zero serious/critical issues
- [ ] Every new file has the GPLv2+ header

---

## Commit plan

1. `feat(web): facets endpoint with numeric-aware version ordering`
2. `feat(web): run list as server component reading filter state from the URL`
3. `feat(web): filter bar bound to searchParams with graceful invalid-param fallback`
4. `feat(web): accessible results table with sortable headers and selection state`
5. `feat(web): Zustand selection store with 2-run limit and sessionStorage persistence`
6. `feat(web): sticky compare action bar with swap and Compare (2)`
7. `feat(web): empty, no-match, error and skeleton states`
8. `test(web): component tests for selection limit, swap, and filter round-trip`

---

## Risks and stop conditions

- **Stop and report** if the list query degrades on large datasets; do not paper
  over it with a smaller `LIMIT`.
- **Do not** put filter state in Redux/Zustand when it belongs in the URL. If a
  reviewer asks why filters are in `searchParams`, the answer is bookmarkable
  views and no state-sync bugs.
- **Do not** invent a second, richer run model in the client. The DTO is the
  contract.
- **Watch for** the classic table bug: `<td>` inside `<div>` rows breaks
  `<thead>`/`<tbody>` semantics. Validate the rendered DOM structure.

---

## Interview / CV talking points

- URL as the single source of truth for filter, sort and pagination state —
  shareable engineering dashboard views, no store sync bugs — while reserving a
  client store for the genuinely client-only run selection.
- Server components for first paint (no loading waterfall, no flash) and client
  navigation for subsequent pages.
- Built an accessible data table the hard way: semantic table markup, `aria-sort`,
  `aria-selected`, live-region announcements, full keyboard path, and zero
  serious/critical axe findings — verified with a real screen reader.
- Designed empty states against the real deployment reality that TAF's backend is
  empty unless a specific property flag is enabled.