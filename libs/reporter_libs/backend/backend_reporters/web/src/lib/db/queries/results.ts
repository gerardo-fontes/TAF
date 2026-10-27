/**
 * #############################################################################
 * # web::src::lib::db::queries::results.ts
 * #
 * # Created: October 2026
 * # Last Modified: October 2026
 * #
 * # This file is part of the Test Automation Framework (TAF).
 * # Copyright (c) 2025-2026 MariaDB Foundation, Jonathan "jeb" Miller and Gerardo Fontes
 * #
 * # This program is free software; you can redistribute it and/or modify
 * # it under the terms of the GNU General Public License as published by
 * # the Free Software Foundation; version 2 or later of the License.
 * #
 * # Licensed under the GNU General Public License, version 2 or later (GPLv2+).
 * # See https://www.gnu.org/licenses/ for details.
 * #
 * # PURPOSE:
 * # Metric extraction and server-side iteration aggregation queries for chart series.
 * #############################################################################
 */

import { query } from '../pool';
import type { MetricDescriptor, SeriesPoint } from '../../domain/types';

/**
 * Lists all distinct metrics recorded for a given test run.
 * Preserves metric_type IS NULL entries (does not filter them out).
 */
export async function listMetricNames(runId: string): Promise<MetricDescriptor[]> {
  const sql = `
    SELECT DISTINCT
      metric_name,
      metric_type,
      metric_dimension,
      metric_unit
    FROM results
    WHERE test_run_id = ?
    ORDER BY (metric_type = 'primary') DESC, metric_name ASC;
  `;

  const rows = await query<any[]>(sql, [runId]);
  return rows.map((r) => ({
    metricName: r.metric_name,
    metricType: r.metric_type,
    metricDimension: r.metric_dimension,
    metricUnit: r.metric_unit,
  }));
}

/**
 * Retrieves thread-scaling series data for a metric, aggregating across iterations
 * on the database server (AVG, MIN, MAX, STDDEV).
 * Never streams thousands of unaggregated rows to the browser!
 */
export async function getSeries(
  runId: string,
  metricName: string,
  metricType?: string | null
): Promise<SeriesPoint[]> {
  const conditions: string[] = ['test_run_id = ?', 'metric_name = ?'];
  const params: any[] = [runId, metricName];

  if (metricType !== undefined) {
    conditions.push('metric_type <=> ?');
    params.push(metricType);
  }

  const sql = `
    SELECT
      threads,
      AVG(metric_value) AS avg_value,
      MIN(metric_value) AS min_value,
      MAX(metric_value) AS max_value,
      COALESCE(STDDEV(metric_value), 0) AS std_dev,
      COUNT(*) AS iterations_count,
      COALESCE(MAX(metric_unit), '') AS unit
    FROM results
    WHERE ${conditions.join(' AND ')}
    GROUP BY threads
    ORDER BY threads ASC;
  `;

  const rows = await query<any[]>(sql, params);

  return rows.map((r) => ({
    threads: Number(r.threads),
    avgValue: Number(r.avg_value),
    minValue: Number(r.min_value),
    maxValue: Number(r.max_value),
    stdDev: Number(r.std_dev),
    iterationsCount: Number(r.iterations_count),
    unit: String(r.unit),
  }));
}
