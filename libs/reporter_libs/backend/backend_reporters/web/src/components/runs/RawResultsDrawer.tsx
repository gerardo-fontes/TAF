'use client';

import React, { useState } from 'react';
import type { RawResultRow } from '@/lib/domain/types';

interface RawResultsDrawerProps {
  runId: string;
}

export function RawResultsDrawer({ runId }: RawResultsDrawerProps) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<RawResultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 100;

  const load = async (nextOffset: number, append: boolean) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/runs/${runId}/results?raw=true&limit=${limit}&offset=${nextOffset}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const newRows: RawResultRow[] = json.data?.raw ?? [];
      setRows((prev) => (append ? [...prev, ...newRows] : newRows));
      setHasMore(newRows.length === limit);
      setOffset(nextOffset + newRows.length);
    } catch (err) {
      console.error('Failed to load raw results:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && rows.length === 0) {
      load(0, false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
      <button
        type="button"
        onClick={toggle}
        className="text-sm font-semibold text-blue-300 hover:text-blue-200"
      >
        {open ? 'Hide' : 'Show'} raw per-iteration values
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <div className="overflow-x-auto rounded-lg border border-slate-800 max-h-96">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead className="sticky top-0 bg-slate-950">
                <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-2 px-3">Metric</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3 text-right">Threads</th>
                  <th className="py-2 px-3 text-right">Iteration</th>
                  <th className="py-2 px-3 text-right">Value</th>
                  <th className="py-2 px-3">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {Array.from(
                  rows.reduce((map, r) => {
                    if (!map.has(r.threads)) map.set(r.threads, []);
                    map.get(r.threads)!.push(r);
                    return map;
                  }, new Map<number, RawResultRow[]>())
                )
                  .sort((a, b) => a[0] - b[0])
                  .map(([threads, groupRows]) => (
                    <React.Fragment key={threads}>
                      <tr className="bg-slate-950/80">
                        <td colSpan={6} className="py-2 px-3 text-xs font-bold text-blue-300 uppercase tracking-wider">
                          Thread Count: {threads}
                        </td>
                      </tr>
                      {groupRows.map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30">
                          <td className="py-2 px-3 font-mono text-slate-200">{r.metricName}</td>
                          <td className="py-2 px-3 text-slate-400">{r.metricType || '—'}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-200">{r.threads}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-200">{r.iteration}</td>
                          <td className="py-2 px-3 text-right font-mono text-white">{r.value.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                          <td className="py-2 px-3 text-slate-400">{r.metricUnit || '—'}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <button
              type="button"
              onClick={() => load(offset, true)}
              disabled={loading}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}