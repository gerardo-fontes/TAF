/**
 * #############################################################################
 * # web::src::lib::api::pagination.spec.ts
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
 * # Unit tests for keyset pagination cursor encoding, decoding, validation,
 * # and stable cursor progression across identical timestamps.
 * #############################################################################
 */

import { describe, it, expect } from 'vitest';
import { encodeCursor, decodeCursor } from './pagination';

describe('keyset pagination cursor', () => {
  it('encodes and decodes valid timestamp and ID pairs', () => {
    const timestamp = '2026-10-15 14:30:00';
    const id = '1234567890';

    const cursor = encodeCursor(timestamp, id);
    expect(typeof cursor).toBe('string');
    expect(cursor.length).toBeGreaterThan(0);
    // Should be valid base64url without plus, slash, or padding
    expect(cursor).not.toContain('+');
    expect(cursor).not.toContain('/');
    expect(cursor).not.toContain('=');

    const decoded = decodeCursor(cursor);
    expect(decoded).not.toBeNull();
    expect(decoded?.timestamp).toBe(timestamp);
    expect(decoded?.id).toBe(id);
  });

  it('returns null for null, undefined, empty, or non-string inputs', () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor('')).toBeNull();
    // @ts-expect-error - testing invalid runtime input
    expect(decodeCursor(12345)).toBeNull();
    // @ts-expect-error - testing invalid runtime input
    expect(decodeCursor({})).toBeNull();
  });

  it('returns null for malformed or non-JSON base64 strings', () => {
    expect(decodeCursor('not-valid-base64-json!')).toBeNull();
    const nonJsonB64 = Buffer.from('just plain text').toString('base64url');
    expect(decodeCursor(nonJsonB64)).toBeNull();
  });

  it('returns null when JSON payload is missing timestamp or id properties', () => {
    const missingId = Buffer.from(JSON.stringify({ t: '2026-10-15 14:00:00' })).toString('base64url');
    expect(decodeCursor(missingId)).toBeNull();

    const missingTimestamp = Buffer.from(JSON.stringify({ i: '42' })).toString('base64url');
    expect(decodeCursor(missingTimestamp)).toBeNull();

    const wrongTypes = Buffer.from(JSON.stringify({ t: 12345, i: 67890 })).toString('base64url');
    expect(decodeCursor(wrongTypes)).toBeNull();
  });

  it('verifies stable progression across duplicate timestamps via composite keyset', () => {
    // Keyset pagination over (timestamp DESC, id DESC)
    // Row comparison predicate:
    // (r.test_timestamp < ? OR (r.test_timestamp = ? AND r.id < ?))
    const runs = [
      { id: '100', timestamp: '2026-10-20 12:00:00' },
      { id: '95', timestamp: '2026-10-20 12:00:00' }, // Identical timestamp, lower ID
      { id: '90', timestamp: '2026-10-20 12:00:00' }, // Identical timestamp, even lower ID
      { id: '85', timestamp: '2026-10-19 18:00:00' }, // Older timestamp
    ];

    // Page 1 with limit 2: picks rows 0 and 1
    const page1 = runs.slice(0, 2);
    expect(page1).toHaveLength(2);
    const lastRowP1 = page1[page1.length - 1];
    const cursorP1 = encodeCursor(lastRowP1.timestamp, lastRowP1.id);

    const decodedP1 = decodeCursor(cursorP1);
    expect(decodedP1?.timestamp).toBe('2026-10-20 12:00:00');
    expect(decodedP1?.id).toBe('95');

    // Page 2 simulation using SQL predicate:
    // row is after cursor if (row.ts < decoded.ts) OR (row.ts === decoded.ts AND row.id < decoded.id)
    const page2 = runs.filter((r) => {
      if (r.timestamp < decodedP1!.timestamp) return true;
      if (r.timestamp === decodedP1!.timestamp && Number(r.id) < Number(decodedP1!.id)) return true;
      return false;
    });

    expect(page2).toHaveLength(2);
    expect(page2[0].id).toBe('90');
    expect(page2[1].id).toBe('85');

    // Verify disjoint sets (no duplicate items across pages)
    const p1Ids = new Set(page1.map((r) => r.id));
    for (const r of page2) {
      expect(p1Ids.has(r.id)).toBe(false);
    }
  });
});

