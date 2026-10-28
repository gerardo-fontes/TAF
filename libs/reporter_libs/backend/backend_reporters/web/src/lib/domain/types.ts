/**
 * #############################################################################
 * # web::src::lib::domain::types.ts
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
 * # Core domain interfaces, DTOs, and query response models for the TAF frontend.
 * #############################################################################
 */

import type { ComparisonStatus, Thresholds } from './status';
export type { ComparisonStatus, Thresholds };

export interface SystemUnderTest {
  id: string; // BIGINT string
  hostName: string;
  cpuModel: string;
  cpuCount: number;
  coreCount: number;
  socketCount: number;
  ramGb: number;
  ramRaw: string;
  osName: string;
  osVersion: string;
  osKernel: string;
  osArch: string;
  systemHash: string;
  createdAt?: string;
}

export interface DbConfigParam {
  parameterName: string;
  parameterValue: string;
}

export interface DbConfigSet {
  id: string;
  configName: string;
  configHash: string;
  createdAt?: string;
  parameters: DbConfigParam[];
}

export interface RunSummary {
  id: string;
  testName: string;
  systemId: string;
  hostName: string;
  cpuModel: string;
  suiteName: string;
  suiteVersion?: string;
  dbMaker: string;
  dbEngine: string;
  dbVersion: string;
  testCaseTag?: string | null;
  workloadHash?: string;
  isBaseline: boolean;
  baselineNotes?: string | null;
  testTimestamp: string;
  testDuration?: number;
  threadList?: string;
  threads: number[];
  resultCount: number;
  comparisonCount: number;
}

export interface RunDetail extends RunSummary {
  tafHarnessName?: string;
  tafHarnessVersion?: string;
  clientProgram?: string;
  clientVersion?: string;
  dbUser?: string;
  dbPort?: number;
  databaseUnderTest?: string;
  configId?: string;
  config?: DbConfigSet;
  system?: SystemUnderTest;
  pctWarning: number;
  pctFail: number;
  pctGain: number;
  pctDurationDrift: number;
  testType?: string;
  comments?: string;
  autogenTags?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface MetricDescriptor {
  metricName: string;
  metricType: string | null;
  metricDimension: string | null;
  metricUnit: string | null;
}

export interface SeriesPoint {
  threads: number;
  avgValue: number;
  minValue: number;
  maxValue: number;
  stdDev: number;
  iterationsCount: number;
  unit: string;
}

export interface ComparisonDeltaRow {
  threads: number;
  metricName: string;
  baselineValue: number;
  candidateValue: number;
  rawDiff: number;
  changePct: number;
  metricUnit?: string;
  isMaxDelta?: boolean;
}

export interface ComparisonResult {
  baselineId: string;
  candidateId: string;
  compatible: boolean;
  incompatibleReason?: string;
  status: ComparisonStatus;
  thresholds: Thresholds;
  threadOfMaxChange: number;
  maxChangePct: number;
  maxChangeValue: number;
  baselineValueAtMax: number;
  candidateValueAtMax: number;
  rows: ComparisonDeltaRow[];
  storedComparison?: {
    id: string;
    status: ComparisonStatus;
    threadOfMaxChange: number;
    maxChangePct: number;
    maxChangeValue: number;
  } | null;
}

export interface DashboardRollup {
  status: ComparisonStatus;
  count: number;
  pctOfTotal: number;
}

export interface DashboardFeedItem {
  comparisonId: string;
  baselineRunId: string;
  candidateRunId: string;
  status: ComparisonStatus;
  threadOfMaxChange: number;
  maxChangePct: number;
  createdAt: string;
  candidateTestName: string;
  suiteName: string;
  dbMaker: string;
  dbVersion: string;
  testCaseTag?: string | null;
  hostName: string;
  baselineTestName: string;
  baselineTimestamp: string;
}

export interface DashboardData {
  timeWindowDays: number;
  filters: Record<string, unknown>;
  rollups: DashboardRollup[];
  feed: DashboardFeedItem[];
  feedCursor: string | null;
  hasMoreFeed: boolean;
  totalComparisons: number;
  multiHostWarning: boolean;
  distinctHostsCount: number;
}

export interface SystemFacet {
  id: string;
  hostName: string;
  cpuModel: string;
  architecture: string;
  totalRamGb: number;
  runCount: number;
}

export interface WorkloadHashFacet {
  workloadHash: string;
  suiteName: string;
  runCount: number;
}

export interface RunFacets {
  suites: Array<{ name: string; count: number }>;
  dbMakers: string[];
  dbVersions: string[];
  systems: SystemFacet[];
  workloadHashes: WorkloadHashFacet[];
  tags: string[];
  totalRuns: number;
}

