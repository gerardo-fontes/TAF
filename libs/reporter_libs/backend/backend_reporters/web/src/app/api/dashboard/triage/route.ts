/**
 * #############################################################################
 * # web::src::app::api::dashboard::triage::route.ts
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
 * # Licensed under the GNU General Public License, version 2 or later (GPLv2+).
 * # See https://www.gnu.org/licenses/ for details.
 * #
 * # PURPOSE:
 * # REST API endpoint persisting engineer triage records (comment + user
 * # workflow action) submitted from the DashboardResultsTable cell popup.
 * # Entries are saved in the DB under the name of the submitting engineer.
 * #############################################################################
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { saveTriage } from '@/lib/db/queries/dashboard';
import { WORKFLOW_STATUSES } from '@/lib/domain/types';
import { apiSuccess, apiError } from '@/lib/api/envelope';

const TriageBodySchema = z.object({
  comparisonId: z.string().min(1),
  engineer: z.string().min(1, 'Engineer name is required'),
  comment: z.string().default(''),
  workflowStatus: z.enum(WORKFLOW_STATUSES),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_TRIAGE_BODY', 'Request body must be valid JSON', null, 400);
  }

  const parsed = TriageBodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      'INVALID_TRIAGE_PARAMS',
      'Invalid triage submission payload',
      parsed.error.format(),
      400
    );
  }

  try {
    const entry = await saveTriage(parsed.data);
    return apiSuccess(entry);
  } catch (err: any) {
    return apiError('TRIAGE_SAVE_FAILED', 'Failed to persist triage record', err?.message, 500);
  }
}
