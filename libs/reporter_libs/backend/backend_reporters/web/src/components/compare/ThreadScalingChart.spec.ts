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
 * # Unit tests for Phase 4 thread-scaling chart calculations, d3-scale / d3-shape
 * # generators, log2 thread spacing, iteration variance bands, threshold bands,
 * # and WCAG accessibility summaries.
 * #############################################################################
 */

import { describe, it, expect } from 'vitest';
import { scaleLinear, scaleLog } from 'd3-scale';
import { line, area } from 'd3-shape';
import type { ComparisonDeltaRow, Thresholds } from '@/lib/domain/types';
import {
  CHART_SERIES,
  STATUS_BAND_TOKENS,
  formatMetricNumber,
  formatDeltaPct,
} from '@/lib/charts/theme';

describe('ThreadScalingChart calculations & D3 generators', () => {
  const sampleRows: ComparisonDeltaRow[] = [
    {
      threads: 4,
      metricName: 'tpmC',
      metricUnit: 'tpmC',
      baselineValue: 12000,
      candidateValue: 12500,
      rawDiff: 500,
      changePct: 4.17,
      baselineMin: 11800,
      baselineMax: 12200,
      candidateMin: 12300,
      candidateMax: 12700,
    },
    {
      threads: 8,
      metricName: 'tpmC',
      metricUnit: 'tpmC',
      baselineValue: 24000,
      candidateValue: 26000,
      rawDiff: 2000,
      changePct: 8.33,
      baselineMin: 23600,
      baselineMax: 24400,
      candidateMin: 25500,
      candidateMax: 26500,
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
      baselineMin: 44000,
      baselineMax: 46000,
      candidateMin: 49000,
      candidateMax: 51000,
    },
    {
      threads: 32,
      metricName: 'tpmC',
      metricUnit: 'tpmC',
      baselineValue: 78000,
      candidateValue: 84000,
      rawDiff: 6000,
      changePct: 7.69,
      baselineMin: 76500,
      baselineMax: 79500,
      candidateMin: 82500,
      candidateMax: 85500,
    },
    {
      threads: 64,
      metricName: 'tpmC',
      metricUnit: 'tpmC',
      baselineValue: 110000,
      candidateValue: 119000,
      rawDiff: 9000,
      changePct: 8.18,
      baselineMin: 108000,
      baselineMax: 112000,
      candidateMin: 116500,
      candidateMax: 121500,
    },
  ];

  const testThresholds: Thresholds = {
    pctWarning: 3.0,
    pctFail: 5.0,
    pctGain: 5.0,
    pctDurationDrift: 10.0,
  };

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

  it('generates continuous SVG paths via d3-shape line()', () => {
    const threads = sampleRows.map((r) => r.threads);
    const minLog = Math.log2(threads[0]);
    const maxLog = Math.log2(threads[threads.length - 1]);
    const range = maxLog - minLog;
    const width = 800;
    const paddingLeft = 70;
    const innerWidth = 690;

    const getX = (t: number) => paddingLeft + ((Math.log2(t) - minLog) / range) * innerWidth;
    const yScale = scaleLinear().domain([0, 130000]).range([300, 30]);

    const baselineLineGen = line<ComparisonDeltaRow>()
      .x((d) => getX(d.threads))
      .y((d) => yScale(d.baselineValue));

    const path = baselineLineGen(sampleRows);
    expect(path).toBeTruthy();
    expect(path).toContain('M');
    expect(path).toContain('L');
  });

  it('generates shaded iteration variance bands via d3-shape area()', () => {
    const threads = sampleRows.map((r) => r.threads);
    const minLog = Math.log2(threads[0]);
    const maxLog = Math.log2(threads[threads.length - 1]);
    const range = maxLog - minLog;
    const getX = (t: number) => 70 + ((Math.log2(t) - minLog) / range) * 690;
    const yScale = scaleLinear().domain([0, 130000]).range([300, 30]);

    const areaGen = area<ComparisonDeltaRow>()
      .x((d) => getX(d.threads))
      .y0((d) => yScale(d.baselineMin ?? d.baselineValue))
      .y1((d) => yScale(d.baselineMax ?? d.baselineValue));

    const areaPath = areaGen(sampleRows);
    expect(areaPath).toBeTruthy();
    // Area paths close with Z or loop back
    expect(areaPath).toContain('M');
    expect(areaPath).toContain('L');
  });

  it('computes correct threshold regions when metric direction is higher-is-better', () => {
    const baselineVal = 100000;
    const gainBoundary = baselineVal * (1 + testThresholds.pctGain / 100);
    const warningBoundary = baselineVal * (1 - testThresholds.pctWarning / 100);
    const failBoundary = baselineVal * (1 - testThresholds.pctFail / 100);

    expect(gainBoundary).toBe(105000);
    expect(warningBoundary).toBe(97000);
    expect(failBoundary).toBe(95000);
  });

  it('computes correct threshold regions when metric direction is lower-is-better (latency)', () => {
    const baselineVal = 100; // e.g. 100ms latency
    const gainBoundary = baselineVal * (1 - testThresholds.pctGain / 100);
    const warningBoundary = baselineVal * (1 + testThresholds.pctWarning / 100);
    const failBoundary = baselineVal * (1 + testThresholds.pctFail / 100);

    // Faster latency (< 95ms) is GAIN
    expect(gainBoundary).toBe(95);
    // Slower latency (> 103ms) is WARNING
    expect(warningBoundary).toBe(103);
    // Severely slower latency (> 105ms) is REGRESSED
    expect(failBoundary).toBe(105);
  });

  it('formats metric numbers and percentages according to theme tokens', () => {
    expect(formatMetricNumber(1250000)).toBe('1.3M');
    expect(formatMetricNumber(45000)).toBe('45.0k');
    expect(formatMetricNumber(12.345)).toBe('12.35');
    expect(formatDeltaPct(5.432)).toBe('+5.43%');
    expect(formatDeltaPct(-4.12)).toBe('-4.12%');
  });

  it('maintains distinct greyscale dash patterns between baseline and candidate', () => {
    expect(CHART_SERIES.baseline.strokeDasharray).toBe('none');
    expect(CHART_SERIES.candidate.strokeDasharray).toBe('6 4');
    expect(CHART_SERIES.baseline.markerType).toBe('circle');
    expect(CHART_SERIES.candidate.markerType).toBe('diamond');
  });

  it('supports log Y scale with positive domain', () => {
    const logScale = scaleLog().domain([1000, 1000000]).range([300, 30]);
    expect(logScale(1000)).toBe(300);
    expect(logScale(1000000)).toBe(30);
    expect(logScale(10000)).toBeCloseTo(210, 0);
  });
});
