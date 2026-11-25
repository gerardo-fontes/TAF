/**
 * #############################################################################
 * # web::src::lib::domain::semver.spec.ts
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
 * # Unit tests for semver parsing and numeric descending sorting.
 * # Unit tests for semver parsing and numeric descending sorting across MariaDB
 * # release versions and standard SemVer strings.
 * #############################################################################
 */

import { describe, it, expect } from 'vitest';
import { parseSemver, sortVersionsDesc, compareSemverDesc } from './semver';

describe('semver parsing and sorting', () => {
  it('parses standard 3-digit version strings', () => {
    const parsed = parseSemver('11.4.3');
    expect(parsed.major).toBe(11);
    expect(parsed.minor).toBe(4);
    expect(parsed.patch).toBe(3);
  });

  it('parses version strings with suffixes like MariaDB release tags', () => {
    const parsed = parseSemver('11.8.1-MariaDB-enterprise');
    expect(parsed.major).toBe(11);
    expect(parsed.minor).toBe(8);
    expect(parsed.patch).toBe(1);
    expect(parsed.prerelease).toBe('MariaDB-enterprise');
  });

  it('handles 2-digit versions cleanly', () => {
    const parsed = parseSemver('11.8');
    expect(parsed.major).toBe(11);
    expect(parsed.minor).toBe(8);
    expect(parsed.patch).toBe(0);
  });

  it('handles major-only versions and non-standard tokens', () => {
    const parsed = parseSemver('12');
    expect(parsed.major).toBe(12);
    expect(parsed.minor).toBe(0);
    expect(parsed.patch).toBe(0);

    const fallback = parseSemver('invalid-version');
    expect(fallback.major).toBe(0);
    expect(fallback.minor).toBe(0);
    expect(fallback.patch).toBe(0);
  });

  it('compares semvers correctly with compareSemverDesc', () => {
    expect(compareSemverDesc('11.4.3', '11.4.3')).toBe(0);
    expect(compareSemverDesc('11.8.0', '11.4.3')).toBeLessThan(0); // 11.8.0 comes before 11.4.3 in desc order
    expect(compareSemverDesc('10.11.8', '11.4.0')).toBeGreaterThan(0);
    expect(compareSemverDesc('11.4.10', '11.4.2')).toBeLessThan(0); // Numeric vs lexicographical (10 > 2)
  });

  it('sorts versions numerically descending instead of lexicographical sorting', () => {
    const input = [
      '10.6.15-MariaDB',
      '11.8.1-MariaDB',
      '10.11.8-MariaDB',
      '11.4.10-MariaDB',
      '11.4.3-MariaDB',
      '10.5.21',
      '11.4.0',
    ];

    const sorted = sortVersionsDesc(input);
    expect(sorted).toEqual([
      '11.8.1-MariaDB',
      '11.4.10-MariaDB',
      '11.4.3-MariaDB',
      '11.4.0',
      '10.11.8-MariaDB',
      '10.6.15-MariaDB',
      '10.5.21',
    ]);
  });
});
