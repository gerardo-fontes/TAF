/**
 * #############################################################################
 * # web::src::lib::domain::threads.ts
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
 * # Canonical parser and normalizer for TAF comma-separated thread_list strings.
 * #############################################################################
 */

/**
 * Parses a comma-separated thread_list string (e.g. "4,8,16,32,64,128")
 * into a sorted array of positive integers.
 * Handles whitespace, trailing commas, empty tokens, and duplicate numbers.
 */
export function parseThreadList(threadListStr?: string | null): number[] {
  if (!threadListStr || typeof threadListStr !== 'string') {
    return [];
  }

  const threadSet = new Set<number>();
  const tokens = threadListStr.split(',');

  for (const token of tokens) {
    const trimmed = token.trim();
    if (!trimmed) continue;

    const val = parseInt(trimmed, 10);
    if (!Number.isNaN(val) && val > 0) {
      threadSet.add(val);
    }
  }

  return Array.from(threadSet).sort((a, b) => a - b);
}

/**
 * Formats an array of thread numbers back to canonical TAF format "4,8,16,32".
 */
export function formatThreadList(threads: number[]): string {
  return threads.slice().sort((a, b) => a - b).join(',');
}
