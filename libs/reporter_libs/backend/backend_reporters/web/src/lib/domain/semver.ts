/**
 * #############################################################################
 * # web::src::lib::domain::semver.ts
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
 * # Semantic version parsing and numeric sorting for database versions
 * # (e.g. "11.8.1-MariaDB", "10.11.8", "10.6.15"). Prevents lexical string
 * # sorting anomalies where "10.11" might sort improperly against "11.4".
 * #
 * # ARCHITECTURAL ROLE:
 * # Domain utility used by the Facets API and Run Browser filter dropdowns.
 * #############################################################################
 */

export interface ParsedSemver {
  raw: string;
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

/**
 * Extracts numeric major, minor, patch parts from database version strings.
 * Examples:
 *   "11.8.1-MariaDB-debug" -> { major: 11, minor: 8, patch: 1, prerelease: "MariaDB-debug" }
 *   "10.11.8"              -> { major: 10, minor: 11, patch: 8 }
 *   "11.4"                 -> { major: 11, minor: 4, patch: 0 }
 */
export function parseSemver(versionStr: string): ParsedSemver {
  const trimmed = (versionStr || '').trim();
  const match = trimmed.match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+](.+))?$/);

  if (!match) {
    return {
      raw: trimmed,
      major: 0,
      minor: 0,
      patch: 0,
      prerelease: trimmed,
    };
  }

  return {
    raw: trimmed,
    major: parseInt(match[1], 10) || 0,
    minor: parseInt(match[2], 10) || 0,
    patch: parseInt(match[3], 10) || 0,
    prerelease: match[4],
  };
}

/**
 * Comparator to sort version strings in descending numeric order
 * (newest/highest version first).
 */
export function compareSemverDesc(a: string, b: string): number {
  const parsedA = parseSemver(a);
  const parsedB = parseSemver(b);

  if (parsedA.major !== parsedB.major) {
    return parsedB.major - parsedA.major;
  }
  if (parsedA.minor !== parsedB.minor) {
    return parsedB.minor - parsedA.minor;
  }
  if (parsedA.patch !== parsedB.patch) {
    return parsedB.patch - parsedA.patch;
  }

  // Fallback to lexicographical comparison on raw string if numbers are identical
  return b.localeCompare(a);
}

/**
 * Sorts an array of version strings in descending numeric order.
 */
export function sortVersionsDesc(versions: string[]): string[] {
  return [...versions].sort(compareSemverDesc);
}
