'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DemoteBaselineButtonProps {
  runId: string;
  isBaseline: boolean;
}

export function DemoteBaselineButton({ runId, isBaseline }: DemoteBaselineButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isBaseline) return null;

  const demote = async () => {
    if (!window.confirm(`Remove baseline status from run #${runId}?`)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/runs/${runId}/baseline`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error?.message || `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      window.alert(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={demote}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition-colors disabled:opacity-50"
      >
        {loading ? 'Demoting…' : 'Demote Baseline'}
      </button>
      {error && <span className="text-[10px] text-rose-300">{error}</span>}
    </div>
  );
}