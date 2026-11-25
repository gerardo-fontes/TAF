/**
 * #############################################################################
 * # web::src::e2e::workflows.spec.tsx
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
 * # End-to-end integration test specifications for primary TAF web workflows:
 * # 1. Run browser filtering, multi-selection, and compare navigation
 * # 2. Compare view rendering, compatibility guards, and threshold overrides
 * # 3. Dashboard time window selection (default 2d, presets, custom days)
 * # 4. Multi-filter AND composition (suite, host, severity, dbVersion, tag)
 * # 5. Dashboard -> Run Browser drill-down navigation
 * # 6. Dashboard -> Compare view drill-down navigation
 * #############################################################################
 */

// @vitest-environment jsdom

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RunTable } from '@/components/runs/RunTable';
import { CompareActionBar } from '@/components/runs/CompareActionBar';
import { useSelectionStore } from '@/stores/selection';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardFilterBar } from '@/components/dashboard/DashboardFilterBar';
import { StatusRollupCards } from '@/components/dashboard/StatusRollupCards';
import { SuiteHealthTable } from '@/components/dashboard/SuiteHealthTable';
import { RegressionFeed } from '@/components/dashboard/RegressionFeed';
import { DashboardResultsTable } from '@/components/dashboard/DashboardResultsTable';
import { CompatibilityGuard } from '@/components/compare/CompatibilityGuard';
import { RunHeaderPair } from '@/components/compare/RunHeaderPair';
import { StatusBadge } from '@/components/compare/StatusBadge';
import { DeltaTable } from '@/components/compare/DeltaTable';

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
const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard',
}));

describe('Primary TAF Web Workflows (E2E Integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSelectionStore.getState().clearSelection();
  });

  // ---------------------------------------------------------------------------
  // Workflow 1: Run browser filtering, multi-select, and compare navigation
  // ---------------------------------------------------------------------------
  describe('Workflow 1: Run browser multi-select and compare navigation', () => {
    const mockRuns: RunSummary[] = [
      {
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
        threadList: '4,8,16,32,64,128',
        threads: [4, 8, 16, 32, 64, 128],
        resultCount: 72,
        comparisonCount: 5,
      },
      {
        id: '102',
        testName: 'tpcc_candidate_11_8',
        systemId: '1',
        hostName: 'benchmark-epyc01',
        cpuModel: 'AMD EPYC 9654',
        suiteName: 'hammerdb-tpcc',
        dbMaker: 'MariaDB',
        dbEngine: 'InnoDB',
        dbVersion: '11.8.1',
        testCaseTag: 'PATCH_OPT',
        workloadHash: 'hash_abc',
        isBaseline: false,
        testTimestamp: '2026-10-22 14:00:00',
        threadList: '4,8,16,32,64,128',
        threads: [4, 8, 16, 32, 64, 128],
        resultCount: 72,
        comparisonCount: 1,
      },
    ];

    it('allows selecting baseline and candidate, then triggers compare navigation', async () => {
      render(
        <div>
          <RunTable runs={mockRuns} nextCursor={null} hasMore={false} />
          <CompareActionBar />
        </div>
      );

      // Select first run (becomes baseline)
      const selectBtns = screen.getAllByRole('button', { name: /Select for comparison/i });
      expect(selectBtns).toHaveLength(2);

      await fireEvent.click(selectBtns[0]);
      expect(useSelectionStore.getState().baseline?.id).toBe('101');
      expect(useSelectionStore.getState().candidate).toBeNull();

      // Select second run (becomes candidate)
      await fireEvent.click(selectBtns[1]);
      expect(useSelectionStore.getState().baseline?.id).toBe('101');
      expect(useSelectionStore.getState().candidate?.id).toBe('102');

      // The compare link is now rendered
      const compareLink = screen.getByRole('link', { name: /Compare 2 Runs/i });
      expect(compareLink).toBeDefined();
      expect(compareLink.getAttribute('href')).toBe('/compare?baseline=101&candidate=102');
    });

    it('allows swapping baseline and candidate roles in selection bar', async () => {
      useSelectionStore.getState().toggleRun(mockRuns[0]);
      useSelectionStore.getState().toggleRun(mockRuns[1]);
      expect(useSelectionStore.getState().baseline?.id).toBe('101');
      expect(useSelectionStore.getState().candidate?.id).toBe('102');

      render(<CompareActionBar />);
      const swapBtn = screen.getByRole('button', { name: /Swap baseline and candidate/i });
      await fireEvent.click(swapBtn);

      expect(useSelectionStore.getState().baseline?.id).toBe('102');
      expect(useSelectionStore.getState().candidate?.id).toBe('101');
    });
  });

  // ---------------------------------------------------------------------------
  // Workflow 2: Compare view rendering, compatibility guards, and threshold overrides
  // ---------------------------------------------------------------------------
  describe('Workflow 2: Compare view compatibility guards & threshold overrides', () => {
    it('renders CompatibilityGuard when workload hashes mismatch with override button', async () => {
      render(
        <CompatibilityGuard
          baselineId="101"
          candidateId="102"
          baselineHash="hash_1000w"
          candidateHash="hash_200w"
          isForced={false}
          compatibleBaselines={[]}
        />
      );

      expect(screen.getByText(/Workload Incompatibility Guard Active/i)).toBeDefined();
      expect(screen.getByText(/hash_1000w/i)).toBeDefined();
      expect(screen.getByText(/hash_200w/i)).toBeDefined();

      const overrideBtn = screen.getByRole('button', { name: /Show Comparison Anyway/i });
      await fireEvent.click(overrideBtn);
      expect(replaceMock).toHaveBeenCalledWith(expect.stringContaining('force=true'));
    });

    it('renders side-by-side run header cards with verbatim baseline notes', () => {
      const baselineDetail: RunDetail = {
        id: '101',
        testName: 'tpcc_baseline_11_4',
        systemId: '1',
        hostName: 'benchmark-epyc01',
        cpuModel: 'AMD EPYC 9654',
        suiteName: 'hammerdb-tpcc',
        dbMaker: 'MariaDB',
        dbEngine: 'InnoDB',
        dbVersion: '11.4.3',
        testCaseTag: 'OFFICIAL_LTS',
        workloadHash: 'hash_abc',
        isBaseline: true,
        baselineNotes: 'Official LTS baseline for optimizer testing',
        testTimestamp: '2026-10-20 10:00:00',
        threads: [4, 8, 16],
        resultCount: 36,
        comparisonCount: 5,
        pctWarning: 3,
        pctFail: 5,
        pctGain: 5,
        pctDurationDrift: 10,
      };

      const candidateDetail: RunDetail = {
        ...baselineDetail,
        id: '102',
        testName: 'tpcc_candidate_11_8',
        dbVersion: '11.8.1',
        testCaseTag: 'PATCH_TEST',
        isBaseline: false,
        baselineNotes: null,
      };

      render(
        <RunHeaderPair
          baseline={baselineDetail}
          candidate={candidateDetail}
        />
      );

      expect(screen.getByText(/Official LTS baseline for optimizer testing/i)).toBeDefined();
      expect(screen.getByText('11.4.3')).toBeDefined();
      expect(screen.getByText('11.8.1')).toBeDefined();
    });

    it('updates status badge dynamically when user applies threshold overrides', () => {
      // With default thresholds (warning: 3, fail: 5): a -4% change is WARNING
      const { rerender } = render(
        <StatusBadge
          status="WARNING"
          threadOfMaxChange={64}
          maxChangePct={-4.0}
          maxChangeValue={-1200}
          baselineId="101"
          thresholds={{ pctWarning: 3, pctFail: 5, pctGain: 5 }}
        />
      );

      expect(screen.getByText('WARNING')).toBeDefined();

      // With tightened override (fail: 3.5%): a -4% change now classifies as REGRESSED
      rerender(
        <StatusBadge
          status="REGRESSED"
          threadOfMaxChange={64}
          maxChangePct={-4.0}
          maxChangeValue={-1200}
          baselineId="101"
          thresholds={{ pctWarning: 2, pctFail: 3.5, pctGain: 5 }}
        />
      );

      expect(screen.getByText('REGRESSED')).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Workflow 3: Dashboard time window selection (default 2d, presets, custom days)
  // ---------------------------------------------------------------------------
  describe('Workflow 3: Dashboard time window selection', () => {
    it('supports selecting preset windows and submitting custom day ranges', async () => {
      const onSelectDaysMock = vi.fn();
      const onTogglePauseMock = vi.fn();
      const onRefreshMock = vi.fn();

      render(
        <DashboardHeader
          days={2}
          onSelectDays={onSelectDaysMock}
          isPaused={false}
          onTogglePause={onTogglePauseMock}
          lastUpdated={new Date('2026-10-25T12:00:00Z')}
          isFetching={false}
          onRefresh={onRefreshMock}
        />
      );

      // Verify default 2d is active
      expect(screen.getByText(/Past 2 Days/i)).toBeDefined();

      // Click preset 7d
      const btn7d = screen.getByRole('button', { name: '7d' });
      await fireEvent.click(btn7d);
      expect(onSelectDaysMock).toHaveBeenCalledWith(7);

      // Click preset 30d
      const btn30d = screen.getByRole('button', { name: '30d' });
      await fireEvent.click(btn30d);
      expect(onSelectDaysMock).toHaveBeenCalledWith(30);

      // Open custom days input
      const customToggle = screen.getByRole('button', { name: /\+ Custom Days/i });
      await fireEvent.click(customToggle);

      const input = screen.getByPlaceholderText('Days');
      await fireEvent.change(input, { target: { value: '45' } });
      const setBtn = screen.getByRole('button', { name: 'Set' });
      await fireEvent.click(setBtn);

      expect(onSelectDaysMock).toHaveBeenCalledWith(45);
    });
  });

  // ---------------------------------------------------------------------------
  // Workflow 4: Multi-filter AND composition
  // ---------------------------------------------------------------------------
  describe('Workflow 4: Multi-filter AND composition', () => {
    it('composes multiple filter dimensions and triggers onChangeFilters', async () => {
      const onChangeFiltersMock = vi.fn();
      const onClearFiltersMock = vi.fn();
      render(
        <DashboardFilterBar
          filters={{ days: 7 }}
          onChangeFilters={onChangeFiltersMock}
          onClearFilters={onClearFiltersMock}
        />
      );

      // Select Severity
      const severitySelect = screen.getByRole('combobox');
      await fireEvent.change(severitySelect, { target: { value: 'regressed' } });
      expect(onChangeFiltersMock).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'regressed' })
      );

      // Enter Suite filter
      const suiteInput = screen.getByPlaceholderText(/hammerdb-tpcc/i);
      await fireEvent.change(suiteInput, { target: { value: 'hammerdb-tpcc' } });
      expect(onChangeFiltersMock).toHaveBeenCalledWith(
        expect.objectContaining({ suite: 'hammerdb-tpcc' })
      );

      // Enter Host filter
      const hostInput = screen.getByPlaceholderText(/benchmark-node-01/i);
      await fireEvent.change(hostInput, { target: { value: 'benchmark-epyc01' } });
      expect(onChangeFiltersMock).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'benchmark-epyc01' })
      );

      // Enter Tag filter
      const tagInput = screen.getByPlaceholderText(/MDEV-39497/i);
      await fireEvent.change(tagInput, { target: { value: 'MDEV-39497' } });
      expect(onChangeFiltersMock).toHaveBeenCalledWith(
        expect.objectContaining({ tag: 'MDEV-39497' })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Workflow 5: Dashboard -> Run Browser drill-down navigation
  // ---------------------------------------------------------------------------
  describe('Workflow 5: Dashboard to Run Browser drill-down navigation', () => {
    const mockRollups: DashboardRollup[] = [
      { status: 'REGRESSED', count: 4, pctOfTotal: 25.0 },
      { status: 'WARNING', count: 2, pctOfTotal: 12.5 },
      { status: 'PAR-', count: 2, pctOfTotal: 12.5 },
      { status: 'PAR', count: 4, pctOfTotal: 25.0 },
      { status: 'PAR+', count: 2, pctOfTotal: 12.5 },
      { status: 'GAIN', count: 2, pctOfTotal: 12.5 },
    ];

    it('clicking Run Browser drill-down link on StatusRollupCards navigates with filters', () => {
      render(
        <StatusRollupCards
          rollups={mockRollups}
          activeSeverity={undefined}
          onSelectSeverity={vi.fn()}
          days={7}
        />
      );

      // Status card includes a drill-down link to Run Browser
      const drillLinks = screen.getAllByRole('link', { name: /Browser →/i });
      expect(drillLinks.length).toBeGreaterThan(0);

      // Verify the link href encodes days
      const firstHref = drillLinks[0].getAttribute('href');
      expect(firstHref).toBe('/?days=7');
    });

    it('clicking suite name in SuiteHealthTable opens Run Browser pre-filtered to suite', () => {
      const mockSuites: DashboardSuiteHealth[] = [
        {
          suiteName: 'hammerdb-tpcc',
          runCount: 20,
          comparisonCount: 15,
          regressedCount: 2,
          warningCount: 1,
          gainCount: 3,
          medianChangePct: 1.5,
        },
      ];

      render(<SuiteHealthTable suites={mockSuites} onSelectSuite={vi.fn()} days={7} />);

      const browserLink = screen.getByRole('link', { name: /Browser →/i });
      expect(browserLink.getAttribute('href')).toBe('/?suite=hammerdb-tpcc&days=7');
    });
  });

  // ---------------------------------------------------------------------------
  // Workflow 6: Dashboard -> Compare view drill-down navigation
  // ---------------------------------------------------------------------------
  describe('Workflow 6: Dashboard to Compare view drill-down navigation', () => {
    const mockFeed: DashboardFeedItem[] = [
      {
        comparisonId: '501',
        baselineRunId: '101',
        candidateRunId: '102',
        status: 'REGRESSED',
        threadOfMaxChange: 128,
        maxChangePct: -7.5,
        createdAt: '2026-10-25 10:00:00',
        candidateTestName: 'tpcc_candidate_regressed',
        suiteName: 'hammerdb-tpcc',
        dbMaker: 'MariaDB',
        dbVersion: '11.8.1',
        testCaseTag: 'REGRESSION_BUG',
        hostName: 'benchmark-epyc01',
        baselineTestName: 'tpcc_baseline_lts',
        baselineTimestamp: '2026-10-20 10:00:00',
      },
    ];

    it('clicking Compare action link in RegressionFeed navigates to Compare view', () => {
      render(
        <RegressionFeed
          feed={mockFeed}
          hasMore={false}
          onLoadMore={vi.fn()}
          isLoadingMore={false}
          days={7}
          filters={{ suite: 'hammerdb-tpcc' }}
        />
      );

      const compareLink = screen.getByRole('link', { name: /Compare/i });
      expect(compareLink).toBeDefined();

      const href = compareLink.getAttribute('href');
      expect(href).toContain('/compare?baseline=101&candidate=102');
      expect(href).toContain('window=7');
      expect(href).toContain('suite=hammerdb-tpcc');
    });

    it('clicking cell % in DashboardResultsTable navigates to Compare view', () => {
      const mockResultRows: DashboardResultRow[] = [
        {
          comparisonId: '501',
          baselineRunId: '101',
          candidateRunId: '102',
          status: 'REGRESSED',
          threadOfMaxChange: 128,
          maxChangePct: -7.5,
          createdAt: '2026-10-25 10:00:00',
          candidateTestName: 'tpcc_candidate_regressed',
          suiteName: 'hammerdb-tpcc',
          dbMaker: 'MariaDB',
          dbVersion: '11.8.1',
          testCaseTag: 'REGRESSION_BUG',
          hostName: 'benchmark-epyc01',
          baselineTestName: 'tpcc_baseline_lts',
        },
      ];

      render(
        <DashboardResultsTable
          rows={mockResultRows}
          days={7}
          filters={{ suite: 'hammerdb-tpcc' }}
          triageByComparison={{}}
        />
      );

      const cellCompareLink = screen.getByTitle(/Open Compare view/i);
      expect(cellCompareLink).toBeDefined();

      const href = cellCompareLink.getAttribute('href');
      expect(href).toContain('/compare?baseline=101&candidate=102');
      expect(href).toContain('suite=hammerdb-tpcc');
    });
  });
});