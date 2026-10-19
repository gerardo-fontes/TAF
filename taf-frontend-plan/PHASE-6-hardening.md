# Phase 6 — Hardening, Tests, Accessibility, CI, and the Merge

**Goal:** make the contribution mergeable and maintainable — the test suite, the
accessibility evidence, the CI, the documentation, and the actual pull request.

**Why this phase exists:** a donated frontend that has no tests, no CI and no
README becomes maintenance burden and gets ignored. This phase is what converts
"interesting PR" into "merged contribution you can point a recruiter at".

**Keywords closed:** `vitest`, `playwright`, `react testing library`,
`accessibility`, `wcag`, `ci-cd`, `github actions`, `docker`, technical writing.

---

## Preconditions

- [ ] Phase 5 gate passed.
- [ ] Phase 0 maintainer answer recorded on whether `.github/workflows/` is
      permitted. **If it is not, skip Step 6.4 and say so explicitly in the PR.**

---

## Step 6.1 — Unit and integration tests (Vitest)

```bash
npm i -D vitest @vitest/coverage-v8 jsdom \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

```ts
// vitest.config.ts — one Node environment, one jsdom environment
test: {
  environmentMatchGlobs: [
    ['src/lib/**', 'node'],        // pure logic + queries run in Node
    ['src/app/**', 'jsdom'],       // route handlers exercised as components
  ],
}
```

Rationale to state in the PR: the valuable tests are on pure logic and query
correctness (Node, fast, no DOM), and the component tests are thin. Testing
through the UI when the logic is testable in isolation is slow and brittle.

Required coverage, in priority order:

1. **`classifyChangePct`** — every threshold boundary: `-1`, `+1`, exactly
   `pct_warning`, `pct_fail`, `pct_gain`, negative and positive sides, and the
   zero-baseline case. Table-driven.
2. **`computeComparison` parity** — against stored `test_run_comparison` rows
   (from Phase 1.6). This is the single most important test in the repository.
3. **Thread-list parsing** — `"4,8,16,32"`, spaces, trailing comma, empty string,
   `null`, unsorted input, single value.
4. **Version comparator** — `11.4.3` before `11.11.2`; `10.11.0-MariaDB` vs
   `11.0.0`.
5. **Filter normalisation** — every `searchParams` shape from Phase 2, including
   invalid values falling back to defaults.
6. **Selection store** — 2-run limit, swap, sessionStorage persistence and
   recovery.
7. **API envelope + error mapping** — `400`/`404`/`422`/`500` bodies.
8. **Zod schemas** — including that a non-numeric `:id` yields a `400`, not a 500.

Component tests (RTL): table semantics (`role="table"`, `scope="col"`),
`aria-selected` updates, `aria-live` announcement text, the compare bar's disabled
state below 2 selections, and the incompatibility guard.

Use `user-event`, never `fireEvent`. Do not snapshot-test the whole page — brittle
snapshots are the main reason frontend test suites get deleted.

## Step 6.2 — End-to-end tests (Playwright)

```bash
npm i -D @playwright/test
npx playwright install --with-deps chromium
```

`playwright.config.ts`: `webServer` runs `npm run dev` against the seeded local
database, `baseURL: http://localhost:3000`, CI retries on failure only, traces on
first retry.

Specs — one per user story from the maintainer's message:

1. **List runs** — dashboard loads, run list renders seeded runs, filters narrow
   the list, filters round-trip through the URL.
2. **Select two and compare** — tick exactly two rows, `Compare (2)` navigates to
   `/compare` with baseline/candidate correctly oriented; attempt a third
   selection is blocked with a visible explanation.
3. **Compare** — status badge matches the seeded `test_run_comparison` row;
   threshold provenance is displayed; swap flips orientation.
4. **Incompatible runs** — selecting two runs with different `workload_hash`
   surfaces the notice; the table stays gated until "Show comparison anyway".
5. **Dashboard drill-down** — click a feed row, land on the compare view for that
   baseline/candidate pair; back returns to the same dashboard filters.
6. **Charts** — the thread-scaling chart renders SVG with the expected point
   count, and the data-table alternative contains the same values.
7. **CSV export** — download the export and assert the header row carries run ids,
   `workload_hash` and thresholds.

Also add an `axe` scan to one critical spec so accessibility is enforced in CI, not
just reported once.

Note that you already know Playwright from other work — say so plainly if you
mention it in an interview; do not present it as new.

## Step 6.3 — Accessibility audit

```bash
npm i -D @axe-core/playwright axe-core
```

- Zero serious/critical violations across all routes, enforced in CI.
- Manual keyboard pass on every interactive element, recorded in the PR:
  tab order, focus visibility (do not remove focus outlines without a replacement),
  skip link, and no keyboard traps.
- Manual screen-reader pass on the three primary views, stating which reader you
  used. An automated axe run is necessary and not sufficient — it cannot tell you
  that the status badge is meaningless without its colour.
- Colour contrast: verify tokens pass 4.5:1 for text and 3:1 for non-text UI
  components. The greyscale check from Phase 3 and 4 must also pass.
- `prefers-reduced-motion` honoured.

## Step 6.4 — CI (only if permitted)

`.github/workflows/web.yml`:

```yaml
name: web
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: web/package-lock.json }
      - run: npm ci
        working-directory: web
      - run: npm run lint
        working-directory: web
      - run: npm run typecheck
        working-directory: web
      - run: npm run test:coverage
        working-directory: web
      - run: npm run build
        working-directory: web
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: playwright-report, path: web/playwright-report/ }
```

- Pinned action versions. No publishing, no deployment, no secrets.
- The database-backed tests need a MariaDB service container — add it and document
  it. If the maintainer does not want a service container in CI, make the
  database-backed tests skip cleanly when `TAF_DB_HOST` is absent, and state that
  limitation in the README rather than letting CI go red.
- Consider adding `SECURITY.md`-adjacent notes only if asked. Do not add
  workflows beyond `web.yml` — the repository currently has none, and adding a
  fleet of badges and workflows uninvited is exactly the behaviour that gets a
  first PR rejected.

## Step 6.5 — Documentation

`web/README.md`:

- What the frontend is, and that it is **optional** — TAF works without it.
- Architecture in one diagram (ASCII is fine): browser → Next.js route handlers →
  `mysql2` → `taf_backend`, read-only, with the Perl harness untouched.
- Prereqs (Node version, MariaDB, JDK if regenerating the schema).
- Setup: `docker compose up -d`, `npm run db:reset`, `npm run dev`.
- Every environment variable, including the TLS ones.
- The three user stories mapped to routes.
- **Comparison semantics**: a short section stating the six statuses, that
  thresholds come from the baseline run, and that comparisons require a matching
  `workload_hash`. Link to `create_backend.sql`. A future maintainer must be able
  to audit the classification from the README.
- Known limitations, stated plainly: no baseline management (write path), no
  virtualisation below the threshold, no push channel, comparison tie-breaking is
  deterministic here but not in `do_compare()`.
- Test and CI instructions, and how to run the app with Docker.

`web/DECISIONS.md` — every design decision with its date, its rationale, and the
maintainer answer that authorised it. This file is the answer to "why is it built
this way?" six months from now.

`web/CONTRIBUTING.md` — how to run locally, how to add a route, the header
requirement, and the read-only constraint.

## Step 6.6 — Security review of your own work

Before opening the PR, check:

- [ ] No credentials in code, fixtures, `.env.example`, or committed screenshots
- [ ] Every SQL query parameterised; no dynamic `ORDER BY` from user input (grep
      for template literals inside query strings and justify each one)
- [ ] `docker logs`, error responses and the UI never leak a connection string or
      a full DSN
- [ ] No `NEXT_PUBLIC_` variable holds anything secret
- [ ] Dependencies: `npm audit`, and record anything you cannot resolve with a
      note
- [ ] No telemetry, no third-party fonts, no external CDN in the app bundle. (The
      existing Perl reporter loads Chart.js from jsDelivr; your frontend must
      **not** introduce a similar CDN dependency — bundle instead. Call this out
      as an intentional difference.)

## Step 6.7 — Open the pull request

**Target `MariaDB/TAF:main`, not a fork's default branch.**

Title: `web: optional read-only frontend for TAF backend results`

Description:

1. What it does, mapped to the three requested views.
2. The three maintainer constraints honoured (optional, read-only, no Perl
   changes).
3. Screenshots: run list, compare view, dashboard, and a **greyscale** screenshot
   proving status is not colour-only.
4. **Real verification output, pasted:** `npm test`, the comparison-parity test,
   `npm run build`, the axe summary, and the `EXPLAIN` plan from Phase 1.
5. `performance.md` from Phase 4.
6. The `do_compare()` "7-state vs 6-state" documentation discrepancy and the
   `results.run_time` DOUBLE/VARCHAR(32) inconsistency, raised as observations.
7. Proposals for the maintainer to decide: leading index on
   `test_run.test_timestamp`; `metric_direction` metadata so threshold bands need
   no guessing; optional `set_baseline` write path; CI service container.
8. Known limitations, copied from the README.
9. An explicit ask: *"Reviewing for the Perl and schema side rather than the
   frontend — the frontend side is the part I am least confident about."* This
   invites the maintainer's actual expertise and is far more likely to produce a
   useful review than a broad "please review".

**Then, after merge:**

- Tag the merge commit SHA.
- Screenshot the merged state for your CV.
- File the follow-up proposals as separate issues so the merged PR stays clean.
- Record the outcome in your job tracker with the report/artifact links.

---

## Definition of Done

- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`,
      `npm run build` all clean locally
- [ ] Coverage thresholds set in `vitest.config.ts` and met (`lines` and
      `functions` at 80+, `branches` at 70+ is a defensible bar; state the real
      numbers in the PR)
- [ ] All seven Playwright specs green, traces uploaded on failure
- [ ] Axe: zero serious/critical in CI, with a manual screen-reader pass recorded
- [ ] Keyboard pass documented
- [ ] `web/README.md`, `web/DECISIONS.md`, `web/CONTRIBUTING.md` complete
- [ ] `.github/workflows/web.yml` present **only if permitted**, or its absence
      explicitly justified
- [ ] Security checklist complete
- [ ] PR opened against `MariaDB/TAF` with real verification output pasted
- [ ] Merged, SHA recorded, follow-up proposals filed as separate issues

---

## Risks and stop conditions

- **Stop and report** if any test can only pass by weakening an assertion. A test
  that needs to be loosened to go green is telling you something.
- **Do not** chase a coverage number for its own sake. Coverage of the comparison
  logic is the goal; a coverage percentage is the proxy. If they conflict, cover
  the logic.
- **Do not** add CI, badges, issue templates, PR templates or a `CODEOWNERS` file
  without being asked. You are adding a frontend to someone else's community
  repository.
- **If the PR stalls**, do not open a duplicate PR. Reply once, ask whether the
  scope should be split or a feature reduced, and accept a narrower outcome. A
  merged 60% is worth far more than an unmerged 100%.

---

## Interview / CV talking points

- Built the verification that lets someone else trust the work: a parity test
  proving my TypeScript classification matches the SQL the database already
  contains, boundary tests at every threshold, seven Playwright specs written
  directly from the maintainer's three requirements, and enforced axe coverage.
- Accessibility treated as an engineering requirement with evidence — automated
  scan, keyboard pass, manual screen-reader pass, and a greyscale check proving
  status is never colour-only.
- Self-reviewed for security: parameterised SQL, no secrets in `NEXT_PUBLIC_*`,
  no CDN dependency in the bundle (deliberately diverging from the existing Perl
  reporter's jsDelivr chart), read-only database access.
- Read a 1,540-line stored-procedure schema and a Perl framework's stated design
  philosophy, then delivered a frontend that is additive, optional and isolated
  enough that the existing harness gained zero dependencies.