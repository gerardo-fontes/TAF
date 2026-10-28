/**
 * #############################################################################
 * # web::src::stores::selection.spec.ts
 * #
 * # Created: October 2026
 * # Last Modified: October 2026
 * #
 * # This file is part of the Test Automation Framework (TAF).
 * # Copyright (c) 2025-2026 MariaDB Foundation, Jonathan "jeb" Miller and Gerardo Fontes
 * #
 * # This program is free software; you can redistribute it and/or modify
 * # it under the terms of the GNU General Public License as published by
 * # the Free Software Foundation; version 2 or later of the License.
 * #
 * # Licensed under the GNU General Public License, version 2 or later (GPLv2+).
 * # See https://www.gnu.org/licenses/ for details.
 * #
 * # PURPOSE:
 * # Unit tests for the 2-run selection store (adding, removing, swap, limits).
 * #############################################################################
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useSelectionStore } from './selection';
import type { RunSummary } from '@/lib/domain/types';

function mockRun(id: string, testName: string): RunSummary {
  return {
    id,
    testName,
    systemId: '1',
    hostName: 'host1',
    cpuModel: 'EPYC 9654',
    suiteName: 'hammerdb-tpcc',
    dbMaker: 'MariaDB',
    dbEngine: 'InnoDB',
    dbVersion: '11.8.1',
    isBaseline: false,
    testTimestamp: '2026-10-19 12:00:00',
    threads: [4, 8, 16],
    resultCount: 30,
    comparisonCount: 1,
  };
}

describe('useSelectionStore', () => {
  beforeEach(() => {
    useSelectionStore.getState().clearSelection();
  });

  it('initializes with no selected runs', () => {
    const { baseline, candidate } = useSelectionStore.getState();
    expect(baseline).toBeNull();
    expect(candidate).toBeNull();
  });

  it('selects first run as baseline', () => {
    const run1 = mockRun('1', 'run-1');
    useSelectionStore.getState().toggleRun(run1);

    const state = useSelectionStore.getState();
    expect(state.baseline?.id).toBe('1');
    expect(state.candidate).toBeNull();
    expect(state.getRole('1')).toBe('baseline');
    expect(state.isSelected('1')).toBe(true);
  });

  it('selects second run as candidate', () => {
    const run1 = mockRun('1', 'run-1');
    const run2 = mockRun('2', 'run-2');
    useSelectionStore.getState().toggleRun(run1);
    useSelectionStore.getState().toggleRun(run2);

    const state = useSelectionStore.getState();
    expect(state.baseline?.id).toBe('1');
    expect(state.candidate?.id).toBe('2');
    expect(state.getRole('2')).toBe('candidate');
  });

  it('replaces candidate when a third run is selected', () => {
    const run1 = mockRun('1', 'run-1');
    const run2 = mockRun('2', 'run-2');
    const run3 = mockRun('3', 'run-3');
    useSelectionStore.getState().toggleRun(run1);
    useSelectionStore.getState().toggleRun(run2);
    useSelectionStore.getState().toggleRun(run3);

    const state = useSelectionStore.getState();
    expect(state.baseline?.id).toBe('1');
    expect(state.candidate?.id).toBe('3');
  });

  it('promotes candidate to baseline when baseline is deselected', () => {
    const run1 = mockRun('1', 'run-1');
    const run2 = mockRun('2', 'run-2');
    useSelectionStore.getState().toggleRun(run1);
    useSelectionStore.getState().toggleRun(run2);
    useSelectionStore.getState().toggleRun(run1); // deselect run1

    const state = useSelectionStore.getState();
    expect(state.baseline?.id).toBe('2');
    expect(state.candidate).toBeNull();
  });

  it('swaps baseline and candidate roles', () => {
    const run1 = mockRun('1', 'run-1');
    const run2 = mockRun('2', 'run-2');
    useSelectionStore.getState().toggleRun(run1);
    useSelectionStore.getState().toggleRun(run2);
    useSelectionStore.getState().swapRoles();

    const state = useSelectionStore.getState();
    expect(state.baseline?.id).toBe('2');
    expect(state.candidate?.id).toBe('1');
  });
});
