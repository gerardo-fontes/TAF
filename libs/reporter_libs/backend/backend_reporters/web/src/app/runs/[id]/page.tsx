import React from 'react';
import { getRunById } from '@/lib/db/queries/runs';
import { getCandidateBaselines } from '@/lib/db/queries/compare';
import { getRunMetricMatrix } from '@/lib/db/queries/results';
import { RunDetailHeader } from '@/components/runs/RunDetailHeader';
import { PromoteBaselineButton } from '@/components/runs/PromoteBaselineButton';
import { DemoteBaselineButton } from '@/components/runs/DemoteBaselineButton';
import { MetricSummaryTable } from '@/components/runs/MetricSummaryTable';
import { CsvExportButton } from '@/components/runs/CsvExportButton';
import { RunConfigPanel } from '@/components/runs/RunConfigPanel';
import { RawResultsDrawer } from '@/components/runs/RawResultsDrawer';
import { ConfigDiff } from '@/components/compare/ConfigDiff';

export const dynamic = 'force-dynamic';

interface RunDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const { id } = await params;

  if (!id || !/^\d+$/.test(id)) {
    return (
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-8 text-center max-w-lg mx-auto">
          <h2 className="text-base font-bold text-white">Invalid Run ID</h2>
        </div>
      </main>
    );
  }

  const [run, matrix, baselines] = await Promise.all([
    getRunById(id),
    getRunMetricMatrix(id),
    getCandidateBaselines(id),
  ]);

  const nearestBaseline = baselines.length > 0 ? await getRunById(baselines[0].id) : null;

  const promotionEnabled = process.env.TAF_ALLOW_BASELINE_PROMOTION !== '0' && process.env.TAF_ALLOW_BASELINE_PROMOTION !== 'false';

  if (!run) {
    return (
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-8 text-center max-w-lg mx-auto">
          <h2 className="text-base font-bold text-white">Test Run Not Found</h2>
          <p className="mt-2 text-xs text-rose-300">Could not find run #{id} in taf_backend.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <RunDetailHeader run={run} />
      <div className="flex justify-end gap-2">
        {run.isBaseline ? (
          <DemoteBaselineButton runId={id} isBaseline={true} />
        ) : (
          <PromoteBaselineButton runId={id} enabled={promotionEnabled} />
        )}
      </div>
      <div className="flex justify-end">
        <CsvExportButton runId={id} matrix={matrix} />
      </div>
      <MetricSummaryTable rows={matrix} />
      {run.config?.parameters?.length ? (
        <RunConfigPanel parameters={run.config.parameters} />
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
          No database configuration parameters recorded for this run.
        </div>
      )}

      {nearestBaseline?.config?.parameters?.length && run.config?.parameters?.length ? (
        <ConfigDiff
          baselineParams={nearestBaseline.config.parameters}
          candidateParams={run.config.parameters}
          baselineLabel={`Baseline Run #${nearestBaseline.id}`}
          candidateLabel={`Run #${run.id}`}
        />
      ) : null}

      <RawResultsDrawer runId={id} />
    </main>
  );
}