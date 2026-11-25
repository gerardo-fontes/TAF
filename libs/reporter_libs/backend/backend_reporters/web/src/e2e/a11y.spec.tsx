/**
 * #############################################################################
 * # web::src::e2e::a11y.spec.tsx
 * #
 * # Created: November 2026
 * # Last Modified: November 2026
 * #
 * # This file is part of the Test Automation Framework (TAF).
 * # Copyright (c) 2025-2026 MariaDB Foundation, Jonathan "jeb" Miller and Gerardo Fontes
 * #
 * # This program is free software; you can redistribute it and/or modify
 * # it under the terms of the GNU General Public License as published by
 * # the Free Software Foundation; version 2 or later of the License.
 * #
 * # This program is distributed in the hope that it will be useful,
 * # but WITHOUT ANY WARRANTY; without even the implied warranty of
 * # MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * # GNU General Public License for more details.
 * #
 * # You should have received a copy of the GNU General Public License
 * # along with this program; if not, write to the Free Software
 * # Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1335
 * #
 * # Licensed under the GNU General Public License, version 2 or later (GPLv2+).
 * # See https://www.gnu.org/licenses/ for details.
 * #
 * # PURPOSE:
 * # Automated accessibility (a11y) audit suite using axe-core targeting WCAG 2.1 AA
 * # compliance across all core TAF web frontend UI views and components (Milestone 6.3).
 * #############################################################################
 */

// @vitest-environment jsdom

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import axe from 'axe-core';

import { RunTable } from '@/components/runs/RunTable';
import { FilterBar } from '@/components/runs/FilterBar';
import { CompareActionBar } from '@/components/runs/CompareActionBar';
import { useSelectionStore } from '@/stores/selection';
import { CompatibilityGuard } from '@/components/compare/CompatibilityGuard';
import { RunHeaderPair } from '@/components/compare/RunHeaderPair';
import { StatusBadge } from '@/components/compare/StatusBadge';
import { DeltaTable } from '@/components/compare/DeltaTable';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardFilterBar } from '@/components/dashboard/DashboardFilterBar';
import { StatusRollupCards } from '@/components/dashboard/StatusRollupCards';
import { SuiteHealthTable } from '@/components/dashboard/SuiteHealthTable';
import { RegressionFeed } from '@/components/dashboard/RegressionFeed';
import { DashboardResultsTable } from '@/components/dashboard/DashboardResultsTable';

import type {
  RunSummary,
  RunDetail,
  DashboardRollup,
  DashboardFeedItem,
  DashboardSuiteHealth,
  DashboardResultRow,
  ComparisonDeltaRow,
} from '@/lib/domain/types';

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

// Helper to run axe-core with jsdom-safe rule configuration.
// 'color-contrast' requires full CSS layout engine and pseudo-element rendering
// which JSDOM does not provide; other WCAG 2.1 AA rules (labels, ARIA semantics,
// landmark structure, role validity, keyboard focus targets) are verified.
async function auditA11y(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: {
      'color-contrast': { enabled: false },
    },
  });

  // Filter for critical and serious violations
  const severeViolations = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  );

  return {
    violations: results.violations,
    severeViolations,
  };
}

describe('Automated Accessibility Audits (axe-core WCAG 2.1 AA)', () => {
  const mockRun: RunSummary = {
    id: '101',
    testName: 'tpcc_baseline_11_4',
    systemId: '1',
    hostName: 'benchmark-epyc01',
    cpuModel: 'AMD EPYC 9654',
    suiteName: 'hammerdb-tpcc',
    dbMaker: 'MariaDB',
    dbEngine: 'InnoDB',
    dbVersion: '11.4.3',
    testCaseTag: 'LTS_BASELINE',
    workloadHash: 'hash_abc',
    isBaseline: true,
    testTimestamp: '2026-10-20 10:00:00',
    threadList: '4,8,16,32',
    threads: [4, 8, 16, 32],
    resultCount: 48,
    comparisonCount: 3,
  };

  const mockRunDetail: RunDetail = {
    ...mockRun,
    baselineNotes: 'Standard reference baseline',
    pctWarning: 3,
    pctFail: 5,
    pctGain: 5,
    pctDurationDrift: 10,
  };

  it('verifies RunTable has no critical/serious a11y violations', async () => {
    const { container } = render(<RunTable runs={[mockRun]} nextCursor={null} hasMore={false} />);
    const { severeViolations } = await auditA11y(container);
    expect(severeViolations).toEqual([]);
  });

  it('verifies FilterBar has no critical/serious a11y violations', async () => {
    const { container } = render(
      <FilterBar
        facets={{
          suites: [
            { name: 'hammerdb-tpcc', count: 12 },
            { name: 'sysbench', count: 8 },
          ],
          dbMakers: ['MariaDB'],
          dbVersions: ['11.4.3', '11.8.1'],
          totalRuns: 20,
          tags: ['LTS_BASELINE'],
          systems: [
            {
              id: '1',
              hostName: 'benchmark-epyc01',
              cpuModel: 'AMD EPYC 9654',
              architecture: 'x86_64',
              totalRamGb: 256,
              runCount: 10,
            },
          ],
          workloadHashes: [
            {
              workloadHash: 'hash_abc123456789',
              suiteName: 'hammerdb-tpcc',
              runCount: 10,
            },
          ],
        }}
      />
    );
    const { severeViolations } = await auditA11y(container);
    expect(severeViolations).toEqual([]);
  });

  it('verifies CompareActionBar toolbar has no critical/serious a11y violations', async () => {
    useSelectionStore.getState().toggleRun(mockRun);
    const { container } = render(<CompareActionBar />);
    const { severeViolations } = await auditA11y(container);
    expect(severeViolations).toEqual([]);
    useSelectionStore.getState().clearSelection();
  });

  it('verifies CompatibilityGuard banner has no critical/serious a11y violations', async () => {
    const { container } = render(
      <CompatibilityGuard
        baselineId="101"
        candidateId="102"
        baselineHash="hash_1000w"
        candidateHash="hash_200w"
        isForced={false}
        compatibleBaselines={[mockRun]}
      />
    );
    const { severeViolations } = await auditA11y(container);
    expect(severeViolations).toEqual([]);
  });

  it('verifies RunHeaderPair cards have no critical/serious a11y violations', async () => {
    const { container } = render(
      <RunHeaderPair
        baseline={mockRunDetail}
        candidate={{ ...mockRunDetail, id: '102', isBaseline: false }}
      />
    );
    const { severeViolations } = await auditA11y(container);
    expect(severeViolations).toEqual([]);
  });

  it('verifies StatusBadge has no critical/serious a11y violations', async () => {
    const { container } = render(
      <StatusBadge
        status="REGRESSED"
        threadOfMaxChange={32}
        maxChangePct={-6.5}
        maxChangeValue={-450}
        baselineId="101"
        thresholds={{ pctWarning: 3, pctFail: 5, pctGain: 5 }}
      />
    );
    const { severeViolations } = await auditA11y(container);
    expect(severeViolations).toEqual([]);
  });

  it('verifies DeltaTable has no critical/serious a11y violations', async () => {
    const mockDeltas: ComparisonDeltaRow[] = [
      {
        threads: 16,
        metricName: 'throughput_tpm',
        baselineValue: 50000,
        candidateValue: 47000,
        rawDiff: -3000,
        changePct: -6.0,
        metricUnit: 'tpm',
      },
    ];

    const { container } = render(
      <DeltaTable
        rows={mockDeltas}
        thresholds={{ pctWarning: 3, pctFail: 5, pctGain: 5 }}
        baselineId="101"
        candidateId="102"
      />
    );
    const { severeViolations } = await auditA11y(container);
    expect(severeViolations).toEqual([]);
  });

  it('verifies DashboardHeader controls have no critical/serious a11y violations', async () => {
    const { container } = render(
      <DashboardHeader
        days={2}
        onSelectDays={vi.fn()}
        isPaused={false}
        onTogglePause={vi.fn()}
        lastUpdated={new Date('2026-10-25T12:00:00Z')}
        isFetching={false}
        onRefresh={vi.fn()}
      />
    );
    const { severeViolations } = await auditA11y(container);
    expect(severeViolations).toEqual([]);
  });

  it('verifies DashboardFilterBar has no critical/serious a11y violations', async () => {
    const { container } = render(
      <DashboardFilterBar
        filters={{ days: 2 }}
        onChangeFilters={vi.fn()}
        onClearFilters={vi.fn()}
      />
    );
    const { severeViolations } = await auditA11y(container);
    expect(severeViolations).toEqual([]);
  });

  it('verifies StatusRollupCards have no critical/serious a11y violations', async () => {
    const mockRollups: DashboardRollup[] = [
      { status: 'REGRESSED', count: 3, pctOfTotal: 30.0 },
      { status: 'WARNING', count: 2, pctOfTotal: 20.0 },
      { status: 'PAR', count: 5, pctOfTotal: 50.0 },
    ];

    const { container } = render(
      <StatusRollupCards
        rollups={mockRollups}
        activeSeverity={undefined}
        onSelectSeverity={vi.fn()}
        days={2}
      />
    );
    const { severeViolations } = await auditA11y(container);
    expect(severeViolations).toEqual([]);
  });

  it('verifies SuiteHealthTable has no critical/serious a11y violations', async () => {
    const mockSuites: DashboardSuiteHealth[] = [
      {
        suiteName: 'hammerdb-tpcc',
        runCount: 15,
        comparisonCount: 10,
        regressedCount: 2,
        warningCount: 1,
        gainCount: 2,
        medianChangePct: -1.2,
      },
    ];

    const { container } = render(
      <SuiteHealthTable suites={mockSuites} onSelectSuite={vi.fn()} days={2} />
    );
    const { severeViolations } = await auditA11y(container);
    expect(severeViolations).toEqual([]);
  });

  it('verifies RegressionFeed has no critical/serious a11y violations', async () => {
    const mockFeed: DashboardFeedItem[] = [
      {
        comparisonId: '501',
        baselineRunId: '101',
        candidateRunId: '102',
        status: 'REGRESSED',
        threadOfMaxChange: 64,
        maxChangePct: -6.5,
        createdAt: '2026-10-25 10:00:00',
        candidateTestName: 'tpcc_candidate',
        suiteName: 'hammerdb-tpcc',
        dbMaker: 'MariaDB',
        dbVersion: '11.8.1',
        testCaseTag: 'REGRESSION_TEST',
        hostName: 'benchmark-epyc01',
        baselineTestName: 'tpcc_baseline',
        baselineTimestamp: '2026-10-20 10:00:00',
      },
    ];

    const { container } = render(
      <RegressionFeed
        feed={mockFeed}
        hasMore={false}
        onLoadMore={vi.fn()}
        isLoadingMore={false}
        days={2}
        filters={{}}
      />
    );
    const { severeViolations } = await auditA11y(container);
    expect(severeViolations).toEqual([]);
  });

  it('verifies DashboardResultsTable matrix has no critical/serious a11y violations', async () => {
    const mockResultRows: DashboardResultRow[] = [
      {
        comparisonId: '501',
        baselineRunId: '101',
        candidateRunId: '102',
        status: 'REGRESSED',
        threadOfMaxChange: 64,
        maxChangePct: -6.5,
        createdAt: '2026-10-25 10:00:00',
        candidateTestName: 'tpcc_candidate',
        suiteName: 'hammerdb-tpcc',
        dbMaker: 'MariaDB',
        dbVersion: '11.8.1',
        testCaseTag: 'REGRESSION_TEST',
        hostName: 'benchmark-epyc01',
        baselineTestName: 'tpcc_baseline',
      },
    ];

    const { container } = render(
      <DashboardResultsTable
        rows={mockResultRows}
        days={2}
        filters={{}}
        triageByComparison={{}}
      />
    );
    const { severeViolations } = await auditA11y(container);
    expect(severeViolations).toEqual([]);
  });
});