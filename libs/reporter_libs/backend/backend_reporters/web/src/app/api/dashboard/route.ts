/**
 * #############################################################################
 * # web::src::app::api::dashboard::route.ts
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
 * # REST API endpoint for single-round-trip dashboard aggregation telemetry:
 * # time windows (default: 2 days), multi-dimensional AND filtering, keyset pagination,
 * # status roll-ups, regression feeds, daily run timelines, suite health,
 * # system inventory, and baseline coverage metrics.
 * #############################################################################
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import crypto from 'node:crypto';
import { getDashboardData } from '@/lib/db/queries/dashboard';
import { apiSuccess, apiError } from '@/lib/api/envelope';

const DashboardQuerySchema = z.object({
  days: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return 2; // Default 2 days per maintainer guidance
      if (val === 'all' || val === '0') return 0;
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? 2 : parsed;
    }),
  suite: z.string().optional(),
  host: z.string().optional(),
  metric: z.string().optional(),
  dbVersion: z.string().optional(),
  workloadHash: z.string().optional(),
  tag: z.string().optional(),
  severity: z.string().optional(),
  cursor: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50)),
});

export async function GET(request: NextRequest) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = DashboardQuerySchema.safeParse(searchParams);

  if (!parsed.success) {
    return apiError('INVALID_DASHBOARD_PARAMS', 'Invalid dashboard query parameters', parsed.error.format(), 400);
  }

  const requestId = crypto.randomUUID();

  try {
    const data = await getDashboardData(parsed.data);
    return apiSuccess(data, { requestId });
  } catch (err: any) {
    console.error(`[dashboard:${requestId}] ${err?.stack || err?.message || err}`);
    return apiError(
      'DASHBOARD_QUERY_FAILED',
      'Failed to retrieve dashboard aggregation',
      { requestId, message: err?.message },
      500
    );
  }
}
