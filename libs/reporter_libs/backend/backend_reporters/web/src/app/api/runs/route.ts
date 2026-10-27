/**
 * #############################################################################
 * # web::src::app::api::runs::route.ts
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
 * # REST API endpoint for listing and filtering test runs with keyset pagination.
 * #############################################################################
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { listRuns } from '@/lib/db/queries/runs';
import { apiSuccess, apiError } from '@/lib/api/envelope';

const QuerySchema = z.object({
  suite: z.string().optional(),
  host: z.string().optional(),
  systemId: z.string().optional(),
  dbMaker: z.string().optional(),
  dbVersion: z.string().optional(),
  workloadHash: z.string().optional(),
  tag: z.string().optional(),
  isBaseline: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true' || val === '1')),
  days: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
  search: z.string().optional(),
  cursor: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
});

export async function GET(request: NextRequest) {
  const start = Date.now();
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());

  const parsed = QuerySchema.safeParse(searchParams);
  if (!parsed.success) {
    return apiError('INVALID_QUERY_PARAMS', 'Invalid query parameters', parsed.error.format(), 400);
  }

  try {
    const result = await listRuns(parsed.data);
    return apiSuccess(result.data, {
      tookMs: Date.now() - start,
      cursor: result.meta.nextCursor,
      hasMore: result.meta.hasMore,
    });
  } catch (err: any) {
    return apiError('QUERY_FAILED', 'Failed to retrieve test runs', err?.message, 500);
  }
}
