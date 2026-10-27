/**
 * #############################################################################
 * # web::src::app::api::runs::[id]::route.ts
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
 * # REST API endpoint retrieving full run metadata, system specs, and configs by ID.
 * #############################################################################
 */

import { NextRequest } from 'next/server';
import { getRunById } from '@/lib/db/queries/runs';
import { apiSuccess, apiError } from '@/lib/api/envelope';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || !/^\d+$/.test(id)) {
    return apiError('INVALID_RUN_ID', 'Run ID must be a numeric integer string', null, 400);
  }

  try {
    const run = await getRunById(id);
    if (!run) {
      return apiError('RUN_NOT_FOUND', `Test run with ID #${id} not found`, null, 404);
    }

    return apiSuccess(run);
  } catch (err: any) {
    return apiError('QUERY_FAILED', 'Failed to retrieve test run details', err?.message, 500);
  }
}
