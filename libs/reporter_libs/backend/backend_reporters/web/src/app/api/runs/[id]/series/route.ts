/**
 * #############################################################################
 * # web::src::app::api::runs::[id]::series::route.ts
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
 * # REST API endpoint retrieving server-aggregated iteration metrics for a run.
 * #############################################################################
 */

import { NextRequest } from 'next/server';
import { getSeries } from '@/lib/db/queries/results';
import { apiSuccess, apiError } from '@/lib/api/envelope';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || !/^\d+$/.test(id)) {
    return apiError('INVALID_RUN_ID', 'Run ID must be a numeric integer string', null, 400);
  }

  const searchParams = request.nextUrl.searchParams;
  const metricName = searchParams.get('metric');
  const metricType = searchParams.get('type') ?? undefined;

  if (!metricName) {
    return apiError('MISSING_METRIC_PARAM', "Query parameter 'metric' is required", null, 400);
  }

  try {
    const points = await getSeries(id, metricName, metricType);
    return apiSuccess(points);
  } catch (err: any) {
    return apiError('QUERY_FAILED', 'Failed to retrieve series data', err?.message, 500);
  }
}
