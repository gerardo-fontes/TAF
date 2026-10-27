/**
 * #############################################################################
 * # web::src::app::api::compare::route.ts
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
 * # REST API endpoint computing comparison analysis between baseline and candidate runs.
 * #############################################################################
 */

import { NextRequest } from 'next/server';
import { computeComparison } from '@/lib/db/queries/compare';
import { apiSuccess, apiError } from '@/lib/api/envelope';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const baseline = searchParams.get('baseline');
  const candidate = searchParams.get('candidate');

  if (!baseline || !candidate) {
    return apiError(
      'MISSING_COMPARE_PARAMS',
      "Both 'baseline' and 'candidate' query parameters are required",
      null,
      400
    );
  }

  if (!/^\d+$/.test(baseline) || !/^\d+$/.test(candidate)) {
    return apiError(
      'INVALID_COMPARE_PARAMS',
      "'baseline' and 'candidate' parameters must be numeric integer IDs",
      null,
      400
    );
  }

  try {
    const comparison = await computeComparison(baseline, candidate);

    // If runs are incompatible, return 200 with compatible: false so the UI can explain why
    return apiSuccess(comparison);
  } catch (err: any) {
    return apiError('COMPARISON_FAILED', 'Failed to compute run comparison', err?.message, 500);
  }
}
