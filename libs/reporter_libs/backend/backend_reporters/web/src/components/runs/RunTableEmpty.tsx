/**
 * #############################################################################
 * # web::src::components::runs::RunTableEmpty.tsx
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
 * # Informative empty states distinguishing between "no filter matches"
 * # and "unpopulated taf_backend database".
 * #############################################################################
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { RefreshIcon } from '../ui/icons';

interface RunTableEmptyProps {
  hasFilters: boolean;
}

export function RunTableEmpty({ hasFilters }: RunTableEmptyProps) {
  const router = useRouter();

  if (hasFilters) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-400">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-white">No runs match your filter criteria</h3>
        <p className="mt-1 text-sm text-slate-400 max-w-md mx-auto">
          Try expanding the time window, clearing suite or version filters, or removing the search term.
        </p>
        <div className="mt-6">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow"
          >
            <RefreshIcon className="w-3.5 h-3.5" />
            Clear All Filters
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1.5 3 3.5 3h9c2 0 3.5-1 3.5-3V7c0-2-1.5-3-3.5-3h-9C5.5 4 4 5 4 7z" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-white">No benchmark data found in taf_backend</h3>
      <p className="mt-1 text-sm text-slate-400 max-w-lg mx-auto">
        The MariaDB backend database currently contains zero recorded test runs.
      </p>
      <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950 p-4 max-w-md mx-auto text-left">
        <p className="text-xs font-semibold text-slate-300 mb-2">To populate synthetic development data:</p>
        <code className="block font-mono text-xs text-blue-400 bg-slate-900 p-2 rounded">
          npm run db:reset
        </code>
        <p className="text-[11px] text-slate-500 mt-2">
          Or enable <span className="font-mono text-slate-400">backend_reporting = 1</span> in your TAF test suite properties.
        </p>
      </div>
    </div>
  );
}
