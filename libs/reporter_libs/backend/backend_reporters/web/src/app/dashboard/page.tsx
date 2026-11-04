/**
 * #############################################################################
 * # web::src::app::dashboard::page.tsx
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
 * # Server Component for the Automated Results Dashboard. Ingests URL searchParams,
 * # pre-fetches single-round-trip aggregation telemetry on the server to prevent
 * # client-side loading flashes, and hydrates the interactive DashboardClientView.
 * #############################################################################
 */

import React from 'react';
import type { Metadata } from 'next';
import { getDashboardData } from '@/lib/db/queries/dashboard';
import type { DashboardFilters } from '@/lib/domain/types';
import { DashboardClientView } from '@/components/dashboard/DashboardClientView';

export const metadata: Metadata = {
  title: 'Automated Results Dashboard — TAF Web',
  description: 'Enterprise results dashboard for active benchmark regression triage and tracking.',
};

export const dynamic = 'force-dynamic';

interface DashboardPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const sp = await searchParams;

  // Milestone 5.1: Parse Time Window (default 2 days)
  let days = 2;
  if (sp.days === 'all' || sp.days === '0') {
    days = 0;
  } else if (typeof sp.days === 'string') {
    const parsed = parseInt(sp.days, 10);
    days = !isNaN(parsed) && parsed >= 0 ? parsed : 2;
  }

  // Milestone 5.2: Ingest Multi-Dimensional AND Filters from URL
  const filters: DashboardFilters = {
    days,
    suite: typeof sp.suite === 'string' ? sp.suite : undefined,
    host: typeof sp.host === 'string' ? sp.host : undefined,
    dbVersion: typeof sp.version === 'string' ? sp.version : typeof sp.dbVersion === 'string' ? sp.dbVersion : undefined,
    workloadHash: typeof sp.hash === 'string' ? sp.hash : typeof sp.workloadHash === 'string' ? sp.workloadHash : undefined,
    tag: typeof sp.tag === 'string' ? sp.tag : undefined,
    severity: typeof sp.severity === 'string' ? sp.severity : undefined,
    cursor: typeof sp.cursor === 'string' ? sp.cursor : null,
    limit: 50,
  };

  // Milestone 5.4: Server-Side Pre-fetch (single round-trip, zero client flash)
  let initialData;
  try {
    initialData = await getDashboardData(filters);
  } catch (err: any) {
    return (
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-8 text-center max-w-lg mx-auto">
          <h2 className="text-base font-bold text-white">Dashboard Telemetry Unavailable</h2>
          <p className="mt-2 text-xs text-rose-300">
            Failed to query dashboard aggregation telemetry: {err?.message || 'Database error'}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <DashboardClientView initialData={initialData} initialFilters={filters} />
    </main>
  );
}
