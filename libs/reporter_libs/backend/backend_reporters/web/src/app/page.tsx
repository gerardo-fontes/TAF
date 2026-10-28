/**
 * #############################################################################
 * # web::src::app::page.tsx
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
 * # Server Component for the Run Browser. Reads searchParams on the server,
 * # pre-fetches runs and facets, and renders the accessible RunTable and FilterBar.
 * #############################################################################
 */

import React from 'react';
import { listRuns, type RunFilters } from '@/lib/db/queries/runs';
import { listFacets } from '@/lib/db/queries/facets';
import { FilterBar } from '@/components/runs/FilterBar';
import { RunTable } from '@/components/runs/RunTable';
import { RunTableEmpty } from '@/components/runs/RunTableEmpty';
import { CompareActionBar } from '@/components/runs/CompareActionBar';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function RunsPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const filters: RunFilters = {
    suite: typeof sp.suite === 'string' ? sp.suite : undefined,
    host: typeof sp.host === 'string' ? sp.host : undefined,
    dbVersion: typeof sp.dbVersion === 'string' ? sp.dbVersion : undefined,
    workloadHash: typeof sp.workloadHash === 'string' ? sp.workloadHash : undefined,
    tag: typeof sp.tag === 'string' ? sp.tag : undefined,
    isBaseline: sp.baseline === 'true' ? true : sp.baseline === 'false' ? false : undefined,
    days: sp.days ? parseInt(sp.days as string, 10) : undefined,
    search: typeof sp.search === 'string' ? sp.search : undefined,
    cursor: typeof sp.cursor === 'string' ? sp.cursor : null,
    limit: 25,
  };

  const [runsResult, facets] = await Promise.all([
    listRuns(filters),
    listFacets(),
  ]);

  const hasActiveFilters = Boolean(
    filters.suite ||
    filters.host ||
    filters.dbVersion ||
    filters.workloadHash ||
    filters.tag ||
    filters.isBaseline !== undefined ||
    filters.days ||
    filters.search
  );

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Title & Context Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Test Run Browser
            <span className="text-xs font-normal text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full">
              {facets.totalRuns} total runs
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse and filter benchmark runs across test suites, systems, and database versions. Select any 2 runs to compare.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar facets={facets} />

      {/* Run Listing Table or Empty State */}
      {runsResult.data.length === 0 ? (
        <RunTableEmpty hasFilters={hasActiveFilters} />
      ) : (
        <RunTable
          runs={runsResult.data}
          nextCursor={runsResult.meta.nextCursor}
          hasMore={runsResult.meta.hasMore}
        />
      )}

      {/* Floating 2-Run Comparison Action Bar */}
      <CompareActionBar />
    </main>
  );
}
