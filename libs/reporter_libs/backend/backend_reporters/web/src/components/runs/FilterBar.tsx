/**
 * #############################################################################
 * # web::src::components::runs::FilterBar.tsx
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
 * # Filter bar component for the Run Browser. Ingests dynamic facets (suites,
 * # versions, systems, workload hashes, tags) and binds cleanly to URL searchParams.
 * #############################################################################
 */

'use client';

import React, { useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { SearchIcon, FilterIcon, CloseIcon } from '../ui/icons';
import type { RunFacets } from '@/lib/domain/types';

interface FilterBarProps {
  facets: RunFacets;
}

export function FilterBar({ facets }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSuite = searchParams.get('suite') || '';
  const currentHost = searchParams.get('host') || '';
  const currentVersion = searchParams.get('dbVersion') || '';
  const currentWorkload = searchParams.get('workloadHash') || '';
  const currentTag = searchParams.get('tag') || '';
  const currentDays = searchParams.get('days') || '';
  const currentBaseline = searchParams.get('baseline') || '';
  const currentSearch = searchParams.get('search') || '';

  const [searchInput, setSearchInput] = useState(currentSearch);

  const activeFilterCount = [
    currentSuite,
    currentHost,
    currentVersion,
    currentWorkload,
    currentTag,
    currentDays,
    currentBaseline,
    currentSearch,
  ].filter(Boolean).length;

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    // Clear cursor whenever filters change to start at page 1
    params.delete('cursor');

    if (value && value.trim() !== '') {
      params.set(key, value.trim());
    } else {
      params.delete(key);
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const clearAllFilters = () => {
    setSearchInput('');
    startTransition(() => {
      router.push(pathname);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParam('search', searchInput);
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur shadow-lg">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search input */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onBlur={() => updateParam('search', searchInput)}
            placeholder="Search runs by test name, tag, or notes..."
            className="w-full rounded-lg border border-slate-800 bg-slate-950/80 py-2 pl-9 pr-8 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                updateParam('search', '');
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              aria-label="Clear search text"
            >
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </form>

        {/* Filter count & Reset CTA */}
        <div className="flex items-center gap-2 self-end lg:self-center">
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-blue-950 px-2.5 py-0.5 text-xs font-medium text-blue-300 border border-blue-800/60">
                {activeFilterCount} active filter{activeFilterCount > 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={clearAllFilters}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-400 transition-colors"
              >
                <CloseIcon className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
          )}
          {isPending && (
            <span className="text-xs text-blue-400 animate-pulse font-mono">
              Loading...
            </span>
          )}
        </div>
      </div>

      {/* Dropdown Filters Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 pt-2 border-t border-slate-800/80">
        {/* 1. Test Suite */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">Suite</label>
          <select
            value={currentSuite}
            onChange={(e) => updateParam('suite', e.target.value)}
            className="w-full rounded-md border border-slate-800 bg-slate-950 py-1.5 px-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Suites</option>
            {facets.suites.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name} ({s.count})
              </option>
            ))}
          </select>
        </div>

        {/* 2. System / Host */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">Host / System</label>
          <select
            value={currentHost}
            onChange={(e) => updateParam('host', e.target.value)}
            className="w-full rounded-md border border-slate-800 bg-slate-950 py-1.5 px-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Systems</option>
            {facets.systems.map((s) => (
              <option key={s.id} value={s.hostName}>
                {s.hostName} ({s.cpuModel.split(' ')[0]})
              </option>
            ))}
          </select>
        </div>

        {/* 3. DB Version */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">DB Version</label>
          <select
            value={currentVersion}
            onChange={(e) => updateParam('dbVersion', e.target.value)}
            className="w-full rounded-md border border-slate-800 bg-slate-950 py-1.5 px-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Versions</option>
            {facets.dbVersions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Time Window */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">Time Window</label>
          <select
            value={currentDays}
            onChange={(e) => updateParam('days', e.target.value)}
            className="w-full rounded-md border border-slate-800 bg-slate-950 py-1.5 px-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Time</option>
            <option value="1">Last 24 Hours</option>
            <option value="2">Last 2 Days</option>
            <option value="7">Last 7 Days</option>
            <option value="14">Last 14 Days</option>
            <option value="30">Last 30 Days</option>
          </select>
        </div>

        {/* 5. Baseline Filter */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">Baseline Role</label>
          <select
            value={currentBaseline}
            onChange={(e) => updateParam('baseline', e.target.value)}
            className="w-full rounded-md border border-slate-800 bg-slate-950 py-1.5 px-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Runs</option>
            <option value="true">Baselines Only</option>
            <option value="false">Candidates Only</option>
          </select>
        </div>

        {/* 6. Tag */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">Tag</label>
          <select
            value={currentTag}
            onChange={(e) => updateParam('tag', e.target.value)}
            className="w-full rounded-md border border-slate-800 bg-slate-950 py-1.5 px-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Tags</option>
            {facets.tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* 7. Workload Hash */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">Workload</label>
          <select
            value={currentWorkload}
            onChange={(e) => updateParam('workloadHash', e.target.value)}
            className="w-full rounded-md border border-slate-800 bg-slate-950 py-1.5 px-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Hashes</option>
            {facets.workloadHashes.map((w) => (
              <option key={w.workloadHash} value={w.workloadHash}>
                {w.workloadHash.slice(0, 10)}... ({w.suiteName})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
