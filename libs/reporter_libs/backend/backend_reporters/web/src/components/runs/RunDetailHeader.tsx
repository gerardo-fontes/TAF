import React from 'react';
import Link from 'next/link';
import type { RunDetail } from '@/lib/domain/types';

interface RunDetailHeaderProps {
  run: RunDetail;
}

export function RunDetailHeader({ run }: RunDetailHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-xs font-medium text-slate-400 hover:text-white">
          ← Back to Run Browser
        </Link>
        <span className="font-mono text-xs text-slate-400">Run #{run.id}</span>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
        <h1 className="text-xl font-bold text-white tracking-tight">{run.testName}</h1>
        {run.testCaseTag && (
          <span className="mt-1 inline-block rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-300 border border-slate-700">
            {run.testCaseTag}
          </span>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
          <div>
            <span className="block text-[11px] text-slate-500">Database</span>
            <span className="font-semibold text-slate-200">{run.dbMaker}</span>{' '}
            <span className="font-mono text-slate-400">{run.dbVersion}</span>
          </div>
          <div>
            <span className="block text-[11px] text-slate-500">Suite</span>
            <span className="font-mono text-slate-200">{run.suiteName}</span>
          </div>
          <div>
            <span className="block text-[11px] text-slate-500">System / Host</span>
            <span className="font-mono text-slate-200">{run.hostName}</span>
            <div className="text-[10px] text-slate-500">{run.cpuModel}</div>
          </div>
          <div>
            <span className="block text-[11px] text-slate-500">Timestamp</span>
            <span className="font-mono text-slate-300">{run.testTimestamp}</span>
          </div>
          <div>
            <span className="block text-[11px] text-slate-500">Threads</span>
            <span className="font-mono text-slate-200">{run.threads.join(', ')}</span>
          </div>
          <div>
            <span className="block text-[11px] text-slate-500">Iterations</span>
            <span className="font-mono text-slate-200">{run.resultCount}</span>
          </div>
          <div>
            <span className="block text-[11px] text-slate-500">Baseline</span>
            <span className="font-mono text-slate-200">{run.isBaseline ? 'Yes' : 'No'}</span>
          </div>
          <div>
            <span className="block text-[11px] text-slate-500">Workload Hash</span>
            <span className="font-mono text-slate-200 text-[10px] break-all">{run.workloadHash || '—'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}