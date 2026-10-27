/**
 * #############################################################################
 * # web::src::lib::domain::threads.spec.ts
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
 * # Unit tests for parseThreadList() utility.
 * #############################################################################
 */

import { describe, it, expect } from 'vitest';
import { parseThreadList, formatThreadList } from './threads';

describe('parseThreadList', () => {
  it('parses standard comma-separated thread list', () => {
    expect(parseThreadList('4,8,16,32,64,128')).toEqual([4, 8, 16, 32, 64, 128]);
  });

  it('handles spaces, trailing commas, and duplicate values', () => {
    expect(parseThreadList(' 4 , 8, 16, 16, 32, ')).toEqual([4, 8, 16, 32]);
  });

  it('sorts unsorted thread inputs numerically ascending', () => {
    expect(parseThreadList('128,16,4,32,8,64')).toEqual([4, 8, 16, 32, 64, 128]);
  });

  it('safely handles empty strings, null, or invalid tokens', () => {
    expect(parseThreadList('')).toEqual([]);
    expect(parseThreadList(null)).toEqual([]);
    expect(parseThreadList('abc, -5, 0, 16')).toEqual([16]);
  });

  it('formats thread arrays back to canonical strings', () => {
    expect(formatThreadList([32, 4, 16, 8])).toBe('4,8,16,32');
  });
});
