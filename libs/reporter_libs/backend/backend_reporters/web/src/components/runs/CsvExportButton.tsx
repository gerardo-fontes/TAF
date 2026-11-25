'use client';

import React, { useState } from 'react';
import type { MetricSummaryRow, RawResultRow } from '@/lib/domain/types';

interface CsvExportButtonProps {
  runId: string;
  matrix: MetricSummaryRow[];
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsv(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function matrixToCsv(matrix: MetricSummaryRow[]): string {
  const header = ['Metric', 'Type', 'Dimension', 'Unit', 'Threads', 'Count', 'Min', 'Max', 'Avg', 'StdDev'];
  const lines = [header.join(',')];
  for (const r of matrix) {
    lines.push(
      [
        r.metricName,
        r.metricType ?? '',
        r.metricDimension ?? '',
        r.metricUnit ?? '',
        r.threads,
        r.count,
        r.minValue,
        r.maxValue,
        r.avgValue,
        r.stdDev,
      ]
        .map(escapeCsv)
        .join(',')
    );
  }
  return lines.join('\n');
}

export function CsvExportButton({ runId, matrix }: CsvExportButtonProps) {
  const [includeRaw, setIncludeRaw] = useState(false);
  const [loading, setLoading] = useState(false);

  const exportMatrix = () => {
    downloadCsv(`run-${runId}-metrics.csv`, matrixToCsv(matrix));
  };

  const exportWithRaw = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/runs/${runId}/results?raw=true&limit=1000`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const raw: RawResultRow[] = json.data?.raw ?? [];

      const matrixCsv = matrixToCsv(matrix);
      const rawHeader = ['Metric', 'Type', 'Dimension', 'Unit', 'Threads', 'Iteration', 'Value'];
      const rawLines = [rawHeader.join(',')];
      for (const r of raw) {
        rawLines.push(
          [
            r.metricName,
            r.metricType ?? '',
            r.metricDimension ?? '',
            r.metricUnit ?? '',
            r.threads,
            r.iteration,
            r.value,
          ]
            .map(escapeCsv)
            .join(',')
        );
      }
      const combined = `${matrixCsv}\n\n=== RAW ITERATIONS ===\n${rawLines.join('\n')}`;
      downloadCsv(`run-${runId}-metrics-and-raw.csv`, combined);
    } catch (err) {
      console.error('CSV export failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={includeRaw}
          onChange={(e) => setIncludeRaw(e.target.checked)}
          className="rounded border-slate-700 bg-slate-950"
        />
        Include raw iterations
      </label>
      <button
        type="button"
        onClick={includeRaw ? exportWithRaw : exportMatrix}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-950/40 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-900/60 transition-colors disabled:opacity-50"
      >
        {loading ? 'Preparing…' : 'Export CSV'}
      </button>
    </div>
  );
}