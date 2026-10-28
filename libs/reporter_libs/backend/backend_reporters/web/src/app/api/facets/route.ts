/**
 * #############################################################################
 * # web::src::app::api::facets::route.ts
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
 * # REST API endpoint returning available filter facets (suites, versions, hosts,
 * # workload hashes, tags) with numeric semver sorting for the Run Browser.
 * #############################################################################
 */

import { apiSuccess, apiError } from '@/lib/api/envelope';
import { listFacets } from '@/lib/db/queries/facets';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();
  try {
    const facets = await listFacets();
    return apiSuccess(facets, { tookMs: Date.now() - start });
  } catch (err: any) {
    return apiError('FACETS_QUERY_ERROR', 'Failed to retrieve run facets', err?.message, 500);
  }
}
