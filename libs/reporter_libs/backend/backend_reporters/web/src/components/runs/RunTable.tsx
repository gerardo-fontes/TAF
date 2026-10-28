/**
 * #############################################################################
 * # web::src::components::runs::RunTable.tsx
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
 * # Accessible data table for browsing benchmark test runs with full keyboard
 * # navigation, role indicators (Baseline/Candidate), tooltips, and keyset pagination.
 * #############################################################################
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSelectionStore } from '@/stores/selection';
import { StarIcon, CheckIcon, CpuIcon, ArrowRightIcon } from '../ui/icons';
import type { RunSummary } from '@/lib/domain/types';

interface RunTableProps {
  runs: RunSummary[];
  nextCursor: string | null;
  hasMore: boolean;
}

export function RunTable({ runs, nextCursor, hasMore }: RunTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toggleRun, isSelected, getRole, baseline, candidate } = useSelectionStore();

  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  // Keyboard navigation across table rows
  const handleKeyDown = (e: React.KeyboardEvent, index: number, run: RunSummary) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (index < runs.length - 1) {
          setFocusedIndex(index + 1);
          rowRefs.current[index + 1]?.focus();
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (index > 0) {
          setFocusedIndex(index - 1);
          rowRefs.current[index - 1]?.focus();
        }
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        rowRefs.current[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(runs.length - 1);
        rowRefs.current[runs.length - 1]?.focus();
        break;
      case ' ': // Space key toggles selection
        e.preventDefault();
        toggleRun(run);
        break;
      case 'Enter': // Enter key navigates to compare view if two selected, or opens run details
        e.preventDefault();
        if (baseline && candidate) {
          router.push(`/compare?baseline=${baseline.id}&candidate=${candidate.id}`);
        } else if (baseline && baseline.id !== run.id) {
          router.push(`/compare?baseline=${baseline.id}&candidate=${run.id}`);
        }
        break;
    }
  };

  const handleNextPage = () => {
    if (!nextCursor) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('cursor', nextCursor);
    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur shadow-xl">
        <table
          className="w-full text-left text-xs border-collapse"
          aria-label="Benchmark test runs listing"
        >
          <caption className="sr-only">
            List of automated benchmark runs recorded in TAF backend with comparison selection controls.
          </caption>
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th scope="col" className="py-3.5 pl-4 pr-2 w-12 text-center">
                Select
              </th>
              <th scope="col" className="py-3.5 px-3">
                Timestamp
              </th>
              <th scope="col" className="py-3.5 px-3">
                Run & Tag
              </th>
              <th scope="col" className="py-3.5 px-3">
                Suite
              </th>
              <th scope="col" className="py-3.5 px-3">
                Database
              </th>
              <th scope="col" className="py-3.5 px-3">
                System / Host
              </th>
              <th scope="col" className="py-3.5 px-3">
                Threads
              </th>
              <th scope="col" className="py-3.5 px-3 text-right">
                Results
              </th>
              <th scope="col" className="py-3.5 pl-3 pr-4 text-center">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {runs.map((run, idx) => {
              const selected = isSelected(run.id);
              const role = getRole(run.id);
              const isFocused = focusedIndex === idx;

              return (
                <tr
                  key={run.id}
                  ref={(el) => {
                    rowRefs.current[idx] = el;
                  }}
                  tabIndex={0}
                  onFocus={() => setFocusedIndex(idx)}
                  onKeyDown={(e) => handleKeyDown(e, idx, run)}
                  aria-selected={selected}
                  className={`group transition-colors outline-none cursor-pointer ${
                    selected
                      ? role === 'baseline'
                        ? 'bg-blue-950/40 hover:bg-blue-950/60'
                        : 'bg-purple-950/40 hover:bg-purple-950/60'
                      : isFocused
                      ? 'bg-slate-800/60'
                      : 'hover:bg-slate-800/30'
                  }`}
                  onClick={() => toggleRun(run)}
                >
                  {/* Select Checkbox / Role Badge */}
                  <td className="py-3 pl-4 pr-2 text-center whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRun(run);
                      }}
                      className={`inline-flex items-center justify-center h-6 min-w-[24px] px-1.5 rounded-md text-[10px] font-bold transition-all ${
                        role === 'baseline'
                          ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400'
                          : role === 'candidate'
                          ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-400'
                          : 'border border-slate-700 bg-slate-950/80 text-slate-400 group-hover:border-slate-500'
                      }`}
                      aria-label={
                        role === 'baseline'
                          ? 'Selected as Baseline'
                          : role === 'candidate'
                          ? 'Selected as Candidate'
                          : 'Select for comparison'
                      }
                    >
                      {role === 'baseline' ? (
                        <span>B</span>
                      ) : role === 'candidate' ? (
                        <span>C</span>
                      ) : (
                        <span className="opacity-0 group-hover:opacity-100">+</span>
                      )}
                    </button>
                  </td>

                  {/* Timestamp */}
                  <td className="py-3 px-3 whitespace-nowrap text-slate-300 font-mono text-[11px]">
                    <div>{run.testTimestamp}</div>
                    {run.testDuration ? (
                      <span className="text-[10px] text-slate-500 font-sans">
                        {run.testDuration}s duration
                      </span>
                    ) : null}
                  </td>

                  {/* Run Name & Tag */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-slate-500 font-semibold">#{run.id}</span>
                      <span className="font-medium text-white group-hover:text-blue-300 transition-colors">
                        {run.testName}
                      </span>
                      {run.isBaseline && (
                        <span
                          className="inline-flex items-center gap-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/30"
                          title={run.baselineNotes || 'Designated baseline run'}
                        >
                          <StarIcon className="w-2.5 h-2.5 text-amber-400" />
                          BASELINE
                        </span>
                      )}
                    </div>
                    {run.testCaseTag && (
                      <div className="mt-0.5">
                        <span className="rounded bg-slate-800 px-1.5 py-0.2 text-[10px] font-mono text-slate-300 border border-slate-700/60">
                          {run.testCaseTag}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Suite */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className="rounded-md bg-slate-950 px-2 py-1 text-slate-200 border border-slate-800 font-mono text-[11px]">
                      {run.suiteName}
                    </span>
                  </td>

                  {/* DB Version */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <div className="font-semibold text-slate-200">{run.dbMaker}</div>
                    <div className="text-[11px] font-mono text-slate-400">{run.dbVersion}</div>
                  </td>

                  {/* System / Host */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <CpuIcon className="w-3.5 h-3.5 text-slate-500" />
                      <span className="font-mono">{run.hostName}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate max-w-[150px]" title={run.cpuModel}>
                      {run.cpuModel}
                    </div>
                  </td>

                  {/* Threads */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-1 flex-wrap max-w-[140px]">
                      {run.threads.slice(0, 4).map((t) => (
                        <span
                          key={t}
                          className="rounded bg-slate-950 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-800"
                        >
                          {t}
                        </span>
                      ))}
                      {run.threads.length > 4 && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          +{run.threads.length - 4}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Results Count */}
                  <td className="py-3 px-3 whitespace-nowrap text-right">
                    <div className="font-mono text-slate-200 font-semibold">{run.resultCount}</div>
                    <div className="text-[10px] text-slate-500 font-sans">
                      {run.comparisonCount} comp{run.comparisonCount === 1 ? '' : 's'}
                    </div>
                  </td>

                  {/* Action */}
                  <td className="py-3 pl-3 pr-4 text-center whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRun(run);
                      }}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                    >
                      {selected ? 'Deselect' : 'Select'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <div>
          Showing <span className="font-semibold text-slate-200">{runs.length}</span> test runs
        </div>

        {hasMore && nextCursor && (
          <button
            type="button"
            onClick={handleNextPage}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500 hover:bg-slate-700 hover:text-white transition-all shadow"
          >
            <span>Load Next Page</span>
            <ArrowRightIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
