/**
 * #############################################################################
 * # web::src::components::dashboard::DashboardFilterBar.tsx
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
 * # Deep multi-dimensional AND filter bar for the dashboard (Milestone 5.2).
 * # Supports composable filtering across Suite, Host, DB Version, Workload Hash,
 * # Tag, and Severity status.
 * #############################################################################
 */

'use client';

import React from 'react';
import type { DashboardFilters } from '@/lib/domain/types';

interface DashboardFilterBarProps {
  filters: DashboardFilters;
  onChangeFilters: (newFilters: Partial<DashboardFilters>) => void;
  onClearFilters: () => void;
}

export function DashboardFilterBar({
  filters,
  onChangeFilters,
  onClearFilters,
}: DashboardFilterBarProps) {
  const hasActiveFilters = Boolean(
    filters.suite ||
    filters.host ||
    filters.dbVersion ||
    filters.workloadHash ||
    filters.tag ||
    filters.severity
  );

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 backdrop-blur space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white tracking-tight">Multi-Dimensional AND Filters</span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
            Composable
          </span>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 transition-colors"
          >
            ✕ Clear All Filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 text-xs">
        {/* Severity Status Filter */}
        <div>
          <label className="block text-[10px] font-medium text-slate-400 mb-1">Status / Severity</label>
          <label htmlFor="filter-severity" className="block text-[10px] font-medium text-slate-400 mb-1">Status / Severity</label>
          <select
            id="filter-severity"
            aria-label="Filter by Status / Severity"
            value={filters.severity || ''}
            onChange={(e) => onChangeFilters({ severity: e.target.value || undefined })}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="regressed">REGRESSED</option>
            <option value="warning">WARNING</option>
            <option value="gain">GAIN</option>
            <option value="par">PAR (Parity)</option>
            <option value="par-">PAR-</option>
            <option value="par+">PAR+</option>
          </select>
        </div>

        {/* Suite Filter */}
        <div>
          <label className="block text-[10px] font-medium text-slate-400 mb-1">Test Suite</label>
          <label htmlFor="filter-suite" className="block text-[10px] font-medium text-slate-400 mb-1">Test Suite</label>
          <input
            id="filter-suite"
            aria-label="Filter by Test Suite"
            type="text"
            placeholder="e.g. hammerdb-tpcc"
            value={filters.suite || ''}
            onChange={(e) => onChangeFilters({ suite: e.target.value || undefined })}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none font-mono"
          />
        </div>

        {/* Host Filter */}
        <div>
          <label className="block text-[10px] font-medium text-slate-400 mb-1">Host Machine</label>
          <label htmlFor="filter-host" className="block text-[10px] font-medium text-slate-400 mb-1">Host Machine</label>
          <input
            id="filter-host"
            aria-label="Filter by Host Machine"
            type="text"
            placeholder="e.g. benchmark-node-01"
            value={filters.host || ''}
            onChange={(e) => onChangeFilters({ host: e.target.value || undefined })}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none font-mono"
          />
        </div>

        {/* DB Version Filter */}
        <div>
          <label className="block text-[10px] font-medium text-slate-400 mb-1">Database Version</label>
          <label htmlFor="filter-dbversion" className="block text-[10px] font-medium text-slate-400 mb-1">Database Version</label>
          <input
            id="filter-dbversion"
            aria-label="Filter by Database Version"
            type="text"
            placeholder="e.g. 11.8.0"
            value={filters.dbVersion || ''}
            onChange={(e) => onChangeFilters({ dbVersion: e.target.value || undefined })}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none font-mono"
          />
        </div>

        {/* Workload Hash Filter */}
        <div>
          <label className="block text-[10px] font-medium text-slate-400 mb-1">Workload Hash</label>
          <label htmlFor="filter-hash" className="block text-[10px] font-medium text-slate-400 mb-1">Workload Hash</label>
          <input
            id="filter-hash"
            aria-label="Filter by Workload Hash"
            type="text"
            placeholder="Exact hash"
            value={filters.workloadHash || ''}
            onChange={(e) => onChangeFilters({ workloadHash: e.target.value || undefined })}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none font-mono"
          />
        </div>

        {/* Tag Filter */}
        <div>
          <label className="block text-[10px] font-medium text-slate-400 mb-1">Case Tag / Jira</label>
          <label htmlFor="filter-tag" className="block text-[10px] font-medium text-slate-400 mb-1">Case Tag / Jira</label>
          <input
            id="filter-tag"
            aria-label="Filter by Case Tag or Jira"
            type="text"
            placeholder="e.g. MDEV-39497"
            value={filters.tag || ''}
            onChange={(e) => onChangeFilters({ tag: e.target.value || undefined })}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none font-mono"
          />
        </div>
      </div>
    </div>
  );
}
