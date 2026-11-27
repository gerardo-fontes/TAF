import React from 'react';
import { getRunById } from '@/lib/db/queries/runs';
import { getCandidateBaselines } from '@/lib/db/queries/compare';
import { getRunMetricMatrix } from '@/lib/db/queries/results';
import { RunDetailHeader } from '@/components/runs/RunDetailHeader';
import { PromoteBaselineButton } from '@/components/runs/PromoteBaselineButton';
import { DemoteBaselineButton } from '@/components/runs/DemoteBaselineButton';
import { DumpPropertiesButton } from '@/components/runs/DumpPropertiesButton';
import { MetricSummaryTable } from '@/components/runs/MetricSummaryTable';
import { CsvExportButton } from '@/components/runs/CsvExportButton';
import { RunConfigPanel } from '@/components/runs/RunConfigPanel';
import { RawResultsDrawer } from '@/components/runs/RawResultsDrawer';
import { SystemDetailTable } from '@/components/runs/SystemDetailTable';
import { ConfigDiff } from '@/components/compare/ConfigDiff';
import { ThreadScalingChart } from '@/components/compare/ThreadScalingChart';
import type { ComparisonDeltaRow } from '@/lib/domain/types';

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

  const chartRows: ComparisonDeltaRow[] = matrix.map((r) => ({
    threads: r.threads,
    metricName: r.metricName,
    baselineValue: r.avgValue,
    candidateValue: r.avgValue,
    rawDiff: 0,
    changePct: 0,
    metricUnit: r.metricUnit ?? undefined,
    baselineMin: r.minValue,
    baselineMax: r.maxValue,
    candidateMin: r.minValue,
    candidateMax: r.maxValue,
    baselineStdDev: r.stdDev,
    candidateStdDev: r.stdDev,
    iterationsCount: r.count,
    isMaxDelta: false,
  }));

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <RunDetailHeader run={run} />
      <div className="flex flex-wrap justify-end gap-2">
        {run.isBaseline ? (
          <DemoteBaselineButton runId={id} isBaseline={true} />
        ) : (
          <PromoteBaselineButton runId={id} enabled={promotionEnabled} />
        )}
        <DumpPropertiesButton runId={id} path={run.testRunProperties} contents={run.testRunPropertiesContents} />
      </div>
      <div className="flex justify-end">
        <CsvExportButton runId={id} matrix={matrix} />
      </div>
      <ThreadScalingChart
        rows={chartRows}
        thresholds={{
          pctWarning: run.pctWarning,
          pctFail: run.pctFail,
          pctGain: run.pctGain,
          pctDurationDrift: run.pctDurationDrift,
        }}
        baselineName={run.testName}
        candidateName={run.testName}
        threadOfMaxChange={0}
        singleRun={true}
      />
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
      <SystemDetailTable system={run.system} />
    </main>
  );
}