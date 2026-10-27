/**
 * #############################################################################
 * # web::src::lib::api::pagination.ts
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
 * # Opaque cursor encoder and decoder for keyset-based pagination over
 * # (test_timestamp DESC, id DESC).
 * #############################################################################
 */

export interface KeysetCursor {
  timestamp: string;
  id: string;
}

/**
 * Encodes timestamp and ID into an opaque, URL-safe base64 cursor string.
 */
export function encodeCursor(timestamp: string, id: string): string {
  const payload = JSON.stringify({ t: timestamp, i: id });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

/**
 * Decodes a cursor string back to timestamp and ID. Returns null if invalid.
 */
export function decodeCursor(cursorStr?: string | null): KeysetCursor | null {
  if (!cursorStr || typeof cursorStr !== 'string') {
    return null;
  }

  try {
    const raw = Buffer.from(cursorStr, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.t === 'string' && typeof parsed.i === 'string') {
      return { timestamp: parsed.t, id: parsed.i };
    }
  } catch {
    // Malformed cursor
  }

  return null;
}
