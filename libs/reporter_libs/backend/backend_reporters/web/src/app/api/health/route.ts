/**
 * #############################################################################
 * # web::src::app::api::health::route.ts
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
 * # Health check endpoint reporting application and database connectivity status.
 * #############################################################################
 */

import { healthcheck } from '@/lib/db/pool';
import { apiSuccess, apiError } from '@/lib/api/envelope';

export async function GET() {
  const health = await healthcheck();

  if (health.ok) {
    return apiSuccess({
      ok: true,
      service: 'taf-web-backend',
      database: health.database,
      latencyMs: health.latencyMs,
    });
  }

  return apiError(
    'DATABASE_UNAVAILABLE',
    'Unable to connect to the taf_backend database',
    { database: health.database, error: health.error },
    503
  );
}
