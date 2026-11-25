'use client';

import React, { useMemo, useState } from 'react';
import { SearchIcon } from '../ui/icons';
import type { DbConfigParam } from '@/lib/domain/types';

interface RunConfigPanelProps {
  parameters: DbConfigParam[];
}

export function RunConfigPanel({ parameters }: RunConfigPanelProps) {
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return parameters;
    return parameters.filter(
      (p) =>
        p.parameterName.toLowerCase().includes(q) ||
        p.parameterValue.toLowerCase().includes(q)
    );
  }, [parameters, filter]);

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight">Database Configuration</h3>
          <p className="text-xs text-slate-400">Full resolved configuration for this run.</p>
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

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-xs border-collapse font-sans">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4">Parameter</th>
              <th className="py-3 px-4">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.map((p) => (
              <tr key={p.parameterName} className="hover:bg-slate-800/30">
                <td className="py-2.5 px-4 font-mono text-slate-200">{p.parameterName}</td>
                <td className="py-2.5 px-4 font-mono text-slate-300">{p.parameterValue}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={2} className="py-6 text-center text-slate-500">
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