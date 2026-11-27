/**
 * #############################################################################
 * # web::src::components::dashboard::DashboardResultsTable.tsx
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
 * # Results matrix for the dashboard: rows = candidate runs, columns = days
 * # (MM/dd) in the active time window. Each cell shows the max % change colour
 * # coded by comparison status. Clicking the % opens the Compare page; clicking
 * # the cell background opens a triage popup (comment + workflow action) that
 * # is persisted per engineer via POST /api/dashboard/triage.
 * #
 * # The row-header column and the day-header row are sticky, so they stay
 * # visible while the table is scrolled right / down.
 * #############################################################################
 */

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import type {
  DashboardFilters,
  DashboardResultRow,
  TriageEntry,
  WorkflowStatus,
} from '@/lib/domain/types';
import { WORKFLOW_STATUSES } from '@/lib/domain/types';

/* -------------------------------------------------------------------------- */
/* Status theming (same palette as the RegressionFeed status badges)          */
/* -------------------------------------------------------------------------- */

const STATUS_CELL: Record<string, string> = {
  REGRESSED: 'bg-rose-500/20 text-rose-300',
  WARNING: 'bg-amber-500/20 text-amber-300',
  'PAR-': 'bg-orange-500/20 text-orange-300',
  PAR: 'bg-slate-700/50 text-slate-300',
  'PAR+': 'bg-teal-500/20 text-teal-300',
  GAIN: 'bg-emerald-500/20 text-emerald-300',
};

const STATUS_BADGE: Record<string, string> = {
  REGRESSED: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  WARNING: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  'PAR-': 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  PAR: 'bg-slate-700/50 text-slate-300 border-slate-600/40',
  'PAR+': 'bg-teal-500/20 text-teal-300 border-teal-500/40',
  GAIN: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
};

const STATUS_GLYPH: Record<string, string> = {
  REGRESSED: '▼▼▼',
  WARNING: '▼▼',
  'PAR-': '▼',
  PAR: '■',
  'PAR+': '▲',
  GAIN: '▲▲',
};

const FALLBACK_CELL = 'bg-slate-800 text-slate-400';
const FALLBACK_BADGE = 'bg-slate-800 text-slate-400 border-slate-700';

const ENGINEER_STORAGE_KEY = 'taf.dashboard.engineer';

/* -------------------------------------------------------------------------- */
/* Date helpers (string based, so DB DATETIME strings never shift timezone)   */
/* -------------------------------------------------------------------------- */

const DAY_MS = 86_400_000;

/** 'YYYY-MM-DD' from a raw DATETIME / ISO string. */
function dayKeyOf(ts: string): string {
  return ts.slice(0, 10);
}

function keyToUtcMs(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function addDays(key: string, n: number): string {
  return new Date(keyToUtcMs(key) + n * DAY_MS).toISOString().slice(0, 10);
}

function localTodayKey(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Column label: MM/dd. The year is intentionally omitted (see tooltip). */
function columnLabel(key: string): string {
  return `${key.slice(5, 7)}/${key.slice(8, 10)}`;
}

/** Inclusive list of day keys between two keys. */
function dayRange(start: string, end: string): string[] {
  const out: string[] = [];
  for (let ms = keyToUtcMs(start); ms <= keyToUtcMs(end); ms += DAY_MS) {
    out.push(new Date(ms).toISOString().slice(0, 10));
  }
  return out;
}

function formatPct(v: number): string {
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
}

/** BIGINT-safe "a > b" for numeric id strings. */
function idGreater(a: string, b: string): boolean {
  return a.length !== b.length ? a.length > b.length : a > b;
}

/* -------------------------------------------------------------------------- */
/* Row model                                                                  */
/* -------------------------------------------------------------------------- */

interface MatrixRow {
  key: string;
  title: string;
  subtitle: string;
  tooltip: string;
  latestTs: string;
  cells: Map<string, DashboardResultRow[]>;
}

/**
 * Rows are candidate runs. To group by something else (for example one row per
 * test tag so recurring tests line up across days), change this one function:
 * several comparisons landing in the same cell are stacked automatically.
 */
function rowKeyOf(item: DashboardResultRow): string {
  return item.candidateRunId;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

interface DashboardResultsTableProps {
  rows?: DashboardResultRow[];
  triageByComparison?: Record<string, TriageEntry>;
  filters: DashboardFilters;
  days: number;
}

export function DashboardResultsTable({
  rows = [],
  triageByComparison = {},
  filters,
  days,
}: DashboardResultsTableProps) {
  // "Today" is resolved after mount so server and client markup always match.
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(localTodayKey()), []);

  const [localTriage, setLocalTriage] = useState<Record<string, TriageEntry>>({});
  const [active, setActive] = useState<DashboardResultRow | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Server triage merged with just-saved entries; the newer id always wins,
  // so a 60s poll never reverts a fresh save, and never hides a colleague's.
  const triage = useMemo(() => {
    const merged: Record<string, TriageEntry> = { ...triageByComparison };
    for (const [id, entry] of Object.entries(localTriage)) {
      const server = merged[id];
      if (!server || idGreater(entry.id, server.id)) merged[id] = entry;
    }
    return merged;
  }, [triageByComparison, localTriage]);

  // Day columns: the active window (through today) plus any day holding data.
  const columns = useMemo(() => {
    if (rows.length === 0) return [] as string[];
    let min = dayKeyOf(rows[0].createdAt);
    let max = min;
    for (const r of rows) {
      const k = dayKeyOf(r.createdAt);
      if (k < min) min = k;
      if (k > max) max = k;
    }
    if (days > 0 && today) {
      const winStart = addDays(today, -days);
      if (winStart < min) min = winStart;
      if (today > max) max = today;
    }
    return dayRange(min, max);
  }, [rows, days, today]);

  const matrix = useMemo(() => {
    const byKey = new Map<string, MatrixRow>();
    for (const item of rows) {
      const key = rowKeyOf(item);
      let row = byKey.get(key);
      if (!row) {
        row = {
          key,
          title: item.candidateTestName,
          subtitle: `Candidate #${item.candidateRunId}`,
          tooltip: `${item.candidateTestName}\n${item.suiteName} on ${item.hostName}\n${item.dbMaker} ${item.dbVersion}`,
          latestTs: item.createdAt,
          cells: new Map(),
        };
        byKey.set(key, row);
      }
      if (item.createdAt > row.latestTs) row.latestTs = item.createdAt;
      const dk = dayKeyOf(item.createdAt);
      const list = row.cells.get(dk);
      if (list) list.push(item);
      else row.cells.set(dk, [item]);
    }
    return Array.from(byKey.values()).sort((a, b) =>
      a.latestTs === b.latestTs ? 0 : a.latestTs < b.latestTs ? 1 : -1
    );
  }, [rows]);

  // Newest day is the rightmost column; open scrolled to it.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [columns.length]);

  // Same return-query convention as RegressionFeed's Compare links.
  const returnParams = new URLSearchParams();
  if (days > 0) returnParams.set('window', String(days));
  if (filters.suite) returnParams.set('suite', filters.suite);
  if (filters.host) returnParams.set('host', filters.host);
  if (filters.severity) returnParams.set('severity', filters.severity);
  const returnQuery = returnParams.toString();
  const compareHref = (item: DashboardResultRow) =>
    `/compare?baseline=${item.baselineRunId}&candidate=${item.candidateRunId}${returnQuery ? `&${returnQuery}` : ''
    }`;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-800/80">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight">Results Matrix</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Click a percentage to open Compare. Click the cell background to add a comment or set a
            workflow action.
          </p>
        </div>
        <div className="text-xs font-mono text-slate-400">
          Showing <span className="text-white font-bold">{rows.length}</span> comparisons across{' '}
          <span className="text-white font-bold">{matrix.length}</span> candidate runs
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-sm font-semibold text-slate-300">No results match the active filters</p>
          <p className="text-xs text-slate-500 mt-1">
            Try a longer time window or clear some filters.
          </p>
        </div>
      ) : (
        <div ref={scrollRef} className="max-h-[75vh] overflow-auto overscroll-contain">
          <table className="border-separate border-spacing-0 text-xs font-sans">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky top-0 left-0 z-30 min-w-[240px] w-[240px] border-b border-r border-slate-800 bg-slate-950 px-4 py-2.5 text-left text-[11px] font-semibold text-slate-400"
                >
                  Candidate Run / Test
                </th>
                {columns.map((key) => (
                  <th
                    key={key}
                    scope="col"
                    title={key}
                    className={`sticky top-0 z-20 min-w-[92px] w-[92px] border-b border-r border-slate-800/60 bg-slate-950 px-2 py-2.5 text-center font-mono text-[11px] font-semibold ${key === today ? 'text-blue-300' : 'text-slate-400'
                      }`}
                  >
                    {columnLabel(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={row.key}>
                  <th
                    scope="row"
                    title={row.tooltip}
                    className="sticky left-0 z-10 min-w-[240px] w-[240px] max-w-[240px] border-b border-r border-slate-800 bg-slate-950 px-4 py-2 text-left font-normal"
                  >
                    <div className="flex flex-col">
                      <span className="truncate font-mono text-xs font-semibold text-white">
                        {row.title}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">{row.subtitle}</span>
                    </div>
                  </th>

                  {columns.map((key) => {
                    const items = row.cells.get(key);
                    if (!items) {
                      return (
                        <td
                          key={key}
                          className="border-b border-r border-slate-800/40 bg-slate-950/30 p-0"
                        />
                      );
                    }
                    return (
                      <td key={key} className="border-b border-r border-slate-800/40 p-0 align-top">
                        {items.map((item) => {
                          const entry = triage[item.comparisonId];
                          return (
                            <ResultCell
                              key={item.comparisonId}
                              item={item}
                              entry={entry}
                              href={compareHref(item)}
                              onOpenTriage={() => setActive(item)}
                              stacked={items.length > 1}
                            />
                          );
                        })}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {active && (
        <TriageModal
          item={active}
          entry={triage[active.comparisonId]}
          href={compareHref(active)}
          onClose={() => setActive(null)}
          onSaved={(saved) =>
            setLocalTriage((prev) => ({ ...prev, [saved.comparisonId]: saved }))
          }
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Cell                                                                       */
/* -------------------------------------------------------------------------- */

interface ResultCellProps {
  item: DashboardResultRow;
  entry?: TriageEntry;
  href: string;
  onOpenTriage: () => void;
  stacked: boolean;
}

function ResultCell({ item, entry, href, onOpenTriage, stacked }: ResultCellProps) {
  const tint = STATUS_CELL[item.status] ?? FALLBACK_CELL;
  const tip = entry
    ? `${item.status} at ${item.threadOfMaxChange} threads\n${entry.workflowStatus} by ${entry.engineer}`
    : `${item.status} at ${item.threadOfMaxChange} threads`;

  return (
    <div
      className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-2 py-2 ${tint} ${stacked ? 'border-t border-slate-950/60 first:border-t-0' : ''
        }`}
    >
      {/* Background hit area: opens the triage popup */}
      <button
        type="button"
        onClick={onOpenTriage}
        aria-label={`Triage ${item.candidateTestName}, ${item.status}${entry ? `, currently ${entry.workflowStatus}` : ''
          }`}
        title={tip}
        className="absolute inset-0 h-full w-full cursor-pointer transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400"
      />

      {/* The % itself: opens Compare */}
      <Link
        href={href}
        title="Open Compare view"
        className="relative z-1 flex items-center gap-1 rounded px-1 font-mono text-xs font-bold hover:underline underline-offset-2"
      >
        <span className="text-[9px] opacity-70">{STATUS_GLYPH[item.status] ?? '•'}</span>
        <span>{formatPct(item.maxChangePct)}</span>
      </Link>

      {entry && (
        <span className="pointer-events-none relative z-1 max-w-full truncate font-sans text-[9px] opacity-80">
          {entry.workflowStatus}
        </span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Triage popup                                                               */
/* -------------------------------------------------------------------------- */

interface TriageModalProps {
  item: DashboardResultRow;
  entry?: TriageEntry;
  href: string;
  onClose: () => void;
  onSaved: (entry: TriageEntry) => void;
}

function readStoredEngineer(): string {
  try {
    return window.localStorage.getItem(ENGINEER_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function TriageModal({ item, entry, href, onClose, onSaved }: TriageModalProps) {
  const [engineer, setEngineer] = useState<string>(readStoredEngineer);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>(
    entry?.workflowStatus ?? 'Investigating'
  );
  const [comment, setComment] = useState<string>(entry?.comment ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape closes; page behind does not scroll while the popup is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, saving]);

  const handleSave = async () => {
    const name = engineer.trim();
    if (!name) {
      setError('Enter your name so this triage is saved under you.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/dashboard/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comparisonId: item.comparisonId,
          engineer: name,
          comment,
          workflowStatus,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.data) {
        const base = json?.error?.message ?? `HTTP ${res.status}`;
        const details = json?.error?.details;
        throw new Error(typeof details === 'string' && details ? `${base} (${details})` : base);
      }
      try {
        window.localStorage.setItem(ENGINEER_STORAGE_KEY, name);
      } catch {
        /* storage unavailable: name just won't be remembered */
      }
      onSaved(json.data as TriageEntry);
      onClose();
    } catch (err: any) {
      setError(`Could not save triage: ${err?.message ?? 'unknown error'}`);
      setSaving(false);
    }
  };

  const badge = STATUS_BADGE[item.status] ?? FALLBACK_BADGE;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="triage-title"
        className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 p-4">
          <div className="min-w-0">
            <h2 id="triage-title" className="truncate font-mono text-sm font-bold text-white">
              {item.candidateTestName}
            </h2>
            <p className="mt-0.5 font-mono text-[11px] text-slate-500">
              Candidate #{item.candidateRunId} vs Baseline #{item.baselineRunId}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 font-mono text-[11px] font-bold ${badge}`}
              >
                <span>{STATUS_GLYPH[item.status] ?? '•'}</span>
                <span>{item.status}</span>
              </span>
              <span className="font-mono text-xs font-bold text-white">
                {formatPct(item.maxChangePct)}
              </span>
              <span className="font-mono text-[11px] text-slate-500">
                at {item.threadOfMaxChange} threads
              </span>
            </div>
          </div>
          <Link
            href={href}
            className="shrink-0 rounded-lg border border-blue-500/40 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 hover:border-blue-500 transition-colors"
          >
            Open Compare
          </Link>
        </div>

        <div className="space-y-4 p-4">
          {entry && (
            <p className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-400">
              Last updated by <span className="font-semibold text-slate-200">{entry.engineer}</span> on{' '}
              <span className="font-mono">{entry.updatedAt}</span>
            </p>
          )}

          <div>
            <label htmlFor="triage-engineer" className="mb-1 block text-[10px] font-medium text-slate-400">
              Your name
            </label>
            <input
              id="triage-engineer"
              type="text"
              value={engineer}
              onChange={(e) => setEngineer(e.target.value)}
              placeholder="e.g. jane.doe"
              autoFocus={!engineer}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <span id="triage-action-label" className="mb-1 block text-[10px] font-medium text-slate-400">
              Workflow action
            </span>
            <div role="radiogroup" aria-labelledby="triage-action-label" className="flex flex-wrap gap-1.5">
              {WORKFLOW_STATUSES.map((ws) => {
                const selected = ws === workflowStatus;
                return (
                  <button
                    key={ws}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setWorkflowStatus(ws)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${selected
                      ? 'border-blue-500 bg-blue-500/20 text-blue-200'
                      : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'
                      }`}
                  >
                    {ws}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="triage-comment" className="mb-1 block text-[10px] font-medium text-slate-400">
              Comment
            </label>
            <textarea
              id="triage-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              autoFocus={Boolean(engineer)}
              placeholder="What did you find? Link a Jira issue, a bisect result, or the reason it can stay."
              className="w-full resize-y rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-rose-400">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800 p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg border border-blue-500 bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save triage'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
