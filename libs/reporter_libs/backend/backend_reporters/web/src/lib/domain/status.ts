/**
 * #############################################################################
 * # web::src::lib::domain::status.ts
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
 * # Domain definitions and classification functions replicating TAF's native
 * # do_compare() procedure 6-state regression classification.
 * #
 * # ARCHITECTURAL ROLE:
 * # Pure domain logic used by comparison queries, UI badges, and parity tests.
 * #############################################################################
 */

export const COMPARISON_STATUSES = [
  'PAR',
  'PAR-',
  'PAR+',
  'WARNING',
  'REGRESSED',
  'GAIN',
] as const;

export type ComparisonStatus = (typeof COMPARISON_STATUSES)[number];

export interface Thresholds {
  pctWarning: number; // % regression triggering WARNING (default: 3)
  pctFail: number;    // % regression triggering REGRESSED (default: 5)
  pctGain: number;    // % improvement triggering GAIN (default: 5)
  pctDurationDrift?: number; // allowed duration drift % (default: 10)
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  pctWarning: 3,
  pctFail: 5,
  pctGain: 5,
  pctDurationDrift: 10,
};

/**
 * Classifies a percentage delta into one of the 6 TAF statuses, matching
 * create_backend.sql (CREATE PROCEDURE do_compare) Step 6 exactly.
 *
 * NOTE: Thresholds must ALWAYS originate from the BASELINE test run, not the candidate!
 *
 * Logic:
 *  -1 <= changePct <= 1          => 'PAR'
 *  changePct < 0:
 *    |changePct| < pctWarning     => 'PAR-'
 *    |changePct| < pctFail        => 'WARNING'
 *    else                         => 'REGRESSED'
 *  changePct > 0:
 *    changePct < pctGain          => 'PAR+'
 *    else                         => 'GAIN'
 */
export function classifyChangePct(changePct: number, thresholds: Thresholds = DEFAULT_THRESHOLDS): ComparisonStatus {
  // Edge case: if zero baseline or NaN, treat as PAR
  if (Number.isNaN(changePct) || !Number.isFinite(changePct)) {
    return 'PAR';
  }

  // -1% to +1% is neutral parity
  if (changePct >= -1 && changePct <= 1) {
    return 'PAR';
  }

  if (changePct < 0) {
    const absChange = Math.abs(changePct);
    if (absChange < thresholds.pctWarning) {
      return 'PAR-';
    }
    if (absChange < thresholds.pctFail) {
      return 'WARNING';
    }
    return 'REGRESSED';
  }

  // Positive side
  if (changePct < thresholds.pctGain) {
    return 'PAR+';
  }

  return 'GAIN';
}
