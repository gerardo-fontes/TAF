import React from 'react';
import type { SystemUnderTest } from '@/lib/domain/types';

interface SystemDetailTableProps {
  system?: SystemUnderTest | null;
}

export function SystemDetailTable({ system }: SystemDetailTableProps) {
  if (!system) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
        No system / host details recorded for this run.
      </div>
    );
  }

  const rows: Array<{ label: string; value: string | number }> = [
    { label: 'System ID', value: system.id },
    { label: 'Host Name', value: system.hostName },
    { label: 'CPU Model', value: system.cpuModel },
    { label: 'CPU Count', value: system.cpuCount },
    { label: 'Core Count', value: system.coreCount },
    { label: 'Socket Count', value: system.socketCount },
    { label: 'RAM (GB)', value: system.ramGb },
    { label: 'RAM (Raw)', value: system.ramRaw },
    { label: 'OS Name', value: system.osName },
    { label: 'OS Version', value: system.osVersion },
    { label: 'OS Kernel', value: system.osKernel },
    { label: 'OS Architecture', value: system.osArch },
    { label: 'System Hash', value: system.systemHash },
  ];

  if (system.createdAt) {
    rows.push({ label: 'Created At', value: system.createdAt });
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
      <div>
        <h3 className="text-base font-bold text-white tracking-tight">System Detail</h3>
        <p className="text-xs text-slate-400">All system / host details recorded for this run.</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-xs border-collapse font-sans">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4">Field</th>
              <th className="py-3 px-4">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {rows.map((r) => (
              <tr key={r.label} className="hover:bg-slate-800/30">
                <td className="py-2.5 px-4 font-mono text-slate-200">{r.label}</td>
                <td className="py-2.5 px-4 font-mono text-slate-300 break-all">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}