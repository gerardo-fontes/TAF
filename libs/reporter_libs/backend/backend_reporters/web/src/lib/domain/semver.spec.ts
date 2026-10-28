/**
 * #############################################################################
 * # web::src::lib::domain::semver.spec.ts
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
 * # Unit tests for semver parsing and numeric descending sorting.
 * #############################################################################
 */

import { describe, it, expect } from 'vitest';
import { parseSemver, sortVersionsDesc } from './semver';

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

  it('sorts versions numerically descending instead of lexicographical sorting', () => {
    const input = [
      '10.6.15-MariaDB',
      '11.8.1-MariaDB',
      '10.11.8-MariaDB',
      '11.4.3-MariaDB',
      '10.5.21',
      '11.4.0',
    ];

    const sorted = sortVersionsDesc(input);
    expect(sorted).toEqual([
      '11.8.1-MariaDB',
      '11.4.3-MariaDB',
      '11.4.0',
      '10.11.8-MariaDB',
      '10.6.15-MariaDB',
      '10.5.21',
    ]);
  });
});
