'use client';

import React, { useMemo, useState } from 'react';
import { SearchIcon } from '../ui/icons';
import type { DbConfigParam } from '@/lib/domain/types';

interface ConfigDiffProps {
  baselineParams: DbConfigParam[];
  candidateParams: DbConfigParam[];
  baselineLabel?: string;
  candidateLabel?: string;
}

type DiffStatus = 'changed' | 'added' | 'removed' | 'unchanged';

interface DiffRow {
  name: string;
  baselineValue: string | null;
  candidateValue: string | null;
  status: DiffStatus;
}

export function ConfigDiff({
  baselineParams,
  candidateParams,
  baselineLabel = 'Baseline',
  candidateLabel = 'Candidate',
}: ConfigDiffProps) {
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DiffStatus>('all');

  const rows = useMemo<DiffRow[]>(() => {
    const baseMap = new Map(baselineParams.map((p) => [p.parameterName, p.parameterValue]));
    const candMap = new Map(candidateParams.map((p) => [p.parameterName, p.parameterValue]));
    const names = new Set([...baseMap.keys(), ...candMap.keys()]);

    const out: DiffRow[] = [];
    for (const name of names) {
      const b = baseMap.has(name) ? baseMap.get(name)! : null;
      const c = candMap.has(name) ? candMap.get(name)! : null;
      let status: DiffStatus = 'unchanged';
      if (b === null) status = 'added';
      else if (c === null) status = 'removed';
      else if (b !== c) status = 'changed';

      out.push({ name, baselineValue: b, candidateValue: c, status });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [baselineParams, candidateParams]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.baselineValue || '').toLowerCase().includes(q) ||
        (r.candidateValue || '').toLowerCase().includes(q)
      );
    });
  }, [rows, filter, statusFilter]);

  const counts = useMemo(() => {
    const c = { changed: 0, added: 0, removed: 0, unchanged: 0 };
    for (const r of rows) c[r.status]++;
    return c;
  }, [rows]);

  const statusClass = (s: DiffStatus) => {
    switch (s) {
      case 'changed':
        return 'text-amber-300 bg-amber-500/10 border-amber-500/30';
      case 'added':
        return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
      case 'removed':
        return 'text-rose-300 bg-rose-500/10 border-rose-500/30';
      default:
        return 'text-slate-400 bg-slate-800/40 border-slate-700/40';
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight">Database Configuration Diff</h3>
          <p className="text-xs text-slate-400">
            {baselineLabel} vs {candidateLabel} — {counts.changed} changed, {counts.added} added, {counts.removed} removed
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search parameters..."
            className="w-full rounded-lg border border-slate-800 bg-slate-950 py-1.5 pl-8 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'changed', 'added', 'removed', 'unchanged'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1 text-xs font-semibold border transition-colors ${
              statusFilter === s
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-xs border-collapse font-sans">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4">Parameter</th>
              <th className="py-3 px-4">{baselineLabel}</th>
              <th className="py-3 px-4">{candidateLabel}</th>
              <th className="py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.map((r) => (
              <tr
                key={r.name}
                className={
                  r.status === 'changed'
                    ? 'bg-amber-500/15 hover:bg-amber-500/25'
                    : r.status === 'added'
                    ? 'bg-emerald-500/15 hover:bg-emerald-500/25'
                    : r.status === 'removed'
                    ? 'bg-rose-500/15 hover:bg-rose-500/25'
                    : 'hover:bg-slate-800/30'
                }
              >
                <td className="py-2.5 px-4 font-mono text-slate-200">{r.name}</td>
                <td className="py-2.5 px-4 font-mono text-slate-300">{r.baselineValue ?? '—'}</td>
                <td className="py-2.5 px-4 font-mono text-slate-300">{r.candidateValue ?? '—'}</td>
                <td className="py-2.5 px-4">
                  <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold border ${statusClass(r.status)}`}>
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-500">
                  No parameters match the filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}