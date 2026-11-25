'use client';

import React, { useMemo, useState } from 'react';
import { SearchIcon } from '../ui/icons';
import type { MetricSummaryRow } from '@/lib/domain/types';

interface MetricSummaryTableProps {
  rows: MetricSummaryRow[];
}

export function MetricSummaryTable({ rows }: MetricSummaryTableProps) {
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.metricName.toLowerCase().includes(q) ||
        (r.metricType || '').toLowerCase().includes(q) ||
        (r.metricDimension || '').toLowerCase().includes(q) ||
        (r.metricUnit || '').toLowerCase().includes(q)
    );
  }, [rows, filter]);

  const grouped = useMemo(() => {
    const map = new Map<number, MetricSummaryRow[]>();
    for (const r of filtered) {
      if (!map.has(r.threads)) map.set(r.threads, []);
      map.get(r.threads)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 });

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight">Metric Summary</h3>
          <p className="text-xs text-slate-400">
            Every collected metric aggregated by thread count (Count, Min, Max, Avg).
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter metrics..."
            className="w-full rounded-lg border border-slate-800 bg-slate-950 py-1.5 pl-8 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-xs border-collapse font-sans">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4">Metric</th>
              <th className="py-3 px-3">Type</th>
              <th className="py-3 px-3">Dimension</th>
              <th className="py-3 px-3">Unit</th>
              <th className="py-3 px-3 text-right">Threads</th>
              <th className="py-3 px-3 text-right">Count</th>
              <th className="py-3 px-3 text-right">Min</th>
              <th className="py-3 px-3 text-right">Max</th>
              <th className="py-3 px-3 text-right">Avg</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {grouped.map(([threads, groupRows]) => (
              <React.Fragment key={threads}>
                <tr className="bg-slate-950/80">
                  <td colSpan={9} className="py-2 px-4 text-xs font-bold text-blue-300 uppercase tracking-wider">
                    Thread Count: {threads}
                  </td>
                </tr>
                {groupRows
                  .sort((a, b) => a.metricName.localeCompare(b.metricName))
                  .map((r, idx) => (
                    <tr key={`${r.metricName}-${r.threads}-${idx}`} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-200">{r.metricName}</td>
                      <td className="py-2.5 px-3 text-slate-400">{r.metricType || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-400">{r.metricDimension || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-400">{r.metricUnit || '—'}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-200">{r.threads}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-200">{r.count}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-200">{fmt(r.minValue)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-200">{fmt(r.maxValue)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-white font-semibold">{fmt(r.avgValue)}</td>
                    </tr>
                  ))}
              </React.Fragment>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="py-6 text-center text-slate-500">
                  No metrics match the filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}