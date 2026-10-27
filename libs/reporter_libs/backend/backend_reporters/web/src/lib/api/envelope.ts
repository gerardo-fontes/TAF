/**
 * #############################################################################
 * # web::src::lib::api::envelope.ts
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
 * # Uniform JSON envelope format for all TAF REST API responses and errors.
 * #############################################################################
 */

import { NextResponse } from 'next/server';

export interface ApiSuccessEnvelope<T> {
  data: T;
  meta?: {
    tookMs?: number;
    cursor?: string | null;
    hasMore?: boolean;
    [key: string]: unknown;
  };
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function apiSuccess<T>(
  data: T,
  meta: ApiSuccessEnvelope<T>['meta'] = {},
  status = 200
): NextResponse<ApiSuccessEnvelope<T>> {
  return NextResponse.json(
    {
      data,
      meta,
    },
    { status }
  );
}

export function apiError(
  code: string,
  message: string,
  details?: unknown,
  status = 400
): NextResponse<ApiErrorEnvelope> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details,
      },
    },
    { status }
  );
}
