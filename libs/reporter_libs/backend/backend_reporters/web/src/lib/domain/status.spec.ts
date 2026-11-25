/**
 * #############################################################################
 * # web::src::lib::domain::status.spec.ts
 * #
 * # Created: October 2026
 * # Last Modified: October 2026
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
 * # Boundary unit tests for classifyChangePct() against do_compare() Step 6 rules.
 * # Boundary unit tests for classifyChangePct() against do_compare() Step 6 rules,
 * # covering extreme values, NaN/Infinity edge cases, and default thresholds.
 * #############################################################################
 */

import { describe, it, expect } from 'vitest';
import { classifyChangePct, DEFAULT_THRESHOLDS } from './status';

describe('classifyChangePct', () => {
  const t = { pctWarning: 3, pctFail: 5, pctGain: 5 };

  it('classifies values between -1% and +1% as PAR', () => {
    expect(classifyChangePct(0, t)).toBe('PAR');
    expect(classifyChangePct(-1.0, t)).toBe('PAR');
    expect(classifyChangePct(1.0, t)).toBe('PAR');
    expect(classifyChangePct(0.5, t)).toBe('PAR');
    expect(classifyChangePct(-0.5, t)).toBe('PAR');
    expect(classifyChangePct(-0.999999, t)).toBe('PAR');
    expect(classifyChangePct(0.999999, t)).toBe('PAR');
  });

  it('classifies small regressions (< pctWarning) as PAR-', () => {
    expect(classifyChangePct(-1.000001, t)).toBe('PAR-');
    expect(classifyChangePct(-1.01, t)).toBe('PAR-');
    expect(classifyChangePct(-2.99, t)).toBe('PAR-');
    expect(classifyChangePct(-2.5, t)).toBe('PAR-');
    expect(classifyChangePct(-2.999999, t)).toBe('PAR-');
  });

  it('classifies moderate regressions between pctWarning and pctFail as WARNING', () => {
    expect(classifyChangePct(-3.0, t)).toBe('WARNING');
    expect(classifyChangePct(-3.000001, t)).toBe('WARNING');
    expect(classifyChangePct(-4.2, t)).toBe('WARNING');
    expect(classifyChangePct(-4.99, t)).toBe('WARNING');
    expect(classifyChangePct(-4.999999, t)).toBe('WARNING');
  });

  it('classifies severe regressions (>= pctFail) as REGRESSED', () => {
    expect(classifyChangePct(-5.0, t)).toBe('REGRESSED');
    expect(classifyChangePct(-5.000001, t)).toBe('REGRESSED');
    expect(classifyChangePct(-7.5, t)).toBe('REGRESSED');
    expect(classifyChangePct(-50.0, t)).toBe('REGRESSED');
    expect(classifyChangePct(-100.0, t)).toBe('REGRESSED');
  });

  it('classifies small gains (> 1% and < pctGain) as PAR+', () => {
    expect(classifyChangePct(1.000001, t)).toBe('PAR+');
    expect(classifyChangePct(1.01, t)).toBe('PAR+');
    expect(classifyChangePct(4.99, t)).toBe('PAR+');
    expect(classifyChangePct(3.5, t)).toBe('PAR+');
    expect(classifyChangePct(4.999999, t)).toBe('PAR+');
  });

  it('classifies significant improvements (>= pctGain) as GAIN', () => {
    expect(classifyChangePct(5.0, t)).toBe('GAIN');
    expect(classifyChangePct(5.000001, t)).toBe('GAIN');
    expect(classifyChangePct(6.2, t)).toBe('GAIN');
    expect(classifyChangePct(25.0, t)).toBe('GAIN');
    expect(classifyChangePct(500.0, t)).toBe('GAIN');
  });

  it('handles custom baseline-provided thresholds', () => {
    const custom = { pctWarning: 5, pctFail: 10, pctGain: 8 };
    expect(classifyChangePct(-4.5, custom)).toBe('PAR-');
    expect(classifyChangePct(-5.0, custom)).toBe('WARNING');
    expect(classifyChangePct(-9.9, custom)).toBe('WARNING');
    expect(classifyChangePct(-10.0, custom)).toBe('REGRESSED');
    expect(classifyChangePct(7.5, custom)).toBe('PAR+');
    expect(classifyChangePct(8.0, custom)).toBe('GAIN');
  });

  it('falls back to DEFAULT_THRESHOLDS when thresholds argument is omitted', () => {
    expect(classifyChangePct(0)).toBe('PAR');
    expect(classifyChangePct(-2.0)).toBe('PAR-');
    expect(classifyChangePct(-3.0)).toBe('WARNING');
    expect(classifyChangePct(-5.0)).toBe('REGRESSED');
    expect(classifyChangePct(2.0)).toBe('PAR+');
    expect(classifyChangePct(5.0)).toBe('GAIN');
  });

  it('handles NaN, Infinity, -Infinity gracefully by returning PAR', () => {
    expect(classifyChangePct(NaN, t)).toBe('PAR');
    expect(classifyChangePct(Infinity, t)).toBe('PAR');
    expect(classifyChangePct(-Infinity, t)).toBe('PAR');
  });
});
