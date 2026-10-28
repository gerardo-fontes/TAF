/**
 * #############################################################################
 * # web::src::components::compare::ThreadScalingChart.spec.ts
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
 * # Unit tests for thread-scaling chart calculations, sorting, and log2 coordinates.
 * #############################################################################
 */

import { describe, it, expect } from 'vitest';
import type { ComparisonDeltaRow } from '@/lib/domain/types';

describe('ThreadScalingChart calculations', () => {
  const sampleRows: ComparisonDeltaRow[] = [
    {
      threads: 4,
      metricName: 'tpmC',
      metricUnit: 'tpmC',
      baselineValue: 12000,
      candidateValue: 12500,
      rawDiff: 500,
      changePct: 4.17,
    },
    {
      threads: 8,
      metricName: 'tpmC',
      metricUnit: 'tpmC',
      baselineValue: 24000,
      candidateValue: 26000,
      rawDiff: 2000,
      changePct: 8.33,
    },
    {
      threads: 16,
      metricName: 'tpmC',
      metricUnit: 'tpmC',
      baselineValue: 45000,
      candidateValue: 50000,
      rawDiff: 5000,
      changePct: 11.11,
      isMaxDelta: true,
    },
    {
      threads: 32,
      metricName: 'tpmC',
      metricUnit: 'tpmC',
      baselineValue: 78000,
      candidateValue: 84000,
      rawDiff: 6000,
      changePct: 7.69,
    },
    {
      threads: 64,
      metricName: 'tpmC',
      metricUnit: 'tpmC',
      baselineValue: 110000,
      candidateValue: 119000,
      rawDiff: 9000,
      changePct: 8.18,
    },
  ];

  it('orders threads monotonically ascending for chart curve coordinates', () => {
    const unsorted = [...sampleRows].reverse();
    const sorted = unsorted.sort((a, b) => a.threads - b.threads);
    const threads = sorted.map((p) => p.threads);
    expect(threads).toEqual([4, 8, 16, 32, 64]);
  });

  it('calculates equal spacing on a log2 scale for doubling thread counts', () => {
    const threads = [4, 8, 16, 32, 64];
    const minLog = Math.log2(threads[0]);
    const maxLog = Math.log2(threads[threads.length - 1]);
    const range = maxLog - minLog;

    const fractions = threads.map((t) => (Math.log2(t) - minLog) / range);
    expect(fractions[0]).toBe(0);
    expect(fractions[1]).toBeCloseTo(0.25, 4);
    expect(fractions[2]).toBeCloseTo(0.5, 4);
    expect(fractions[3]).toBeCloseTo(0.75, 4);
    expect(fractions[4]).toBe(1);
  });

  it('correctly isolates the thread where maximum delta occurs', () => {
    const maxRow = sampleRows.find((r) => r.isMaxDelta);
    expect(maxRow?.threads).toBe(16);
    expect(maxRow?.changePct).toBe(11.11);
  });
});
