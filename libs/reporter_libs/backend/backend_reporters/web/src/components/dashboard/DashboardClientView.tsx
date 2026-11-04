/**
 * #############################################################################
 * # web::src::components::dashboard::DashboardClientView.tsx
 * #
 * # Created: October 2026
 * # Last Modified: November 2026
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
 * # Interactive Client Component for the dashboard. Manages 60s live polling
 * # with pause controls (Milestone 5.6), keyset pagination (Milestone 5.3),
 * # URL synchronization, and smooth keepPreviousData updates without flashes.
 * #############################################################################
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { DashboardData, DashboardFilters, DashboardFeedItem } from '@/lib/domain/types';
import { DashboardHeader } from './DashboardHeader';
import { DashboardFilterBar } from './DashboardFilterBar';
import { StatusRollupCards } from './StatusRollupCards';
import { MultiHostWarning } from './MultiHostWarning';
import { DashboardResultsTable } from './DashboardResultsTable';
import { RegressionFeed } from './RegressionFeed';
import { DailyTimelineChart } from './DailyTimelineChart';
import { SuiteHealthTable } from './SuiteHealthTable';
import { SystemInventoryAndCoverage } from './SystemInventoryAndCoverage';

interface DashboardClientViewProps {
  initialData: DashboardData;
  initialFilters: DashboardFilters;
}

export function DashboardClientView({ initialData, initialFilters }: DashboardClientViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Dashboard Telemetry Data State
  const [data, setData] = useState<DashboardData>(initialData);

  // Time Window Days State (Milestone 5.1, default: 2)
  const [days, setDays] = useState<number>(initialFilters.days ?? initialData.timeWindowDays ?? 2);

  // Composable Filters State (Milestone 5.2)
  const [filters, setFilters] = useState<DashboardFilters>(initialFilters);

  // Live Polling & Pause State (Milestone 5.6)
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());
  const [isFetching, setIsFetching] = useState<boolean>(false);

  // Keyset Pagination State (Milestone 5.3)
  const [feedItems, setFeedItems] = useState<DashboardFeedItem[]>(initialData.feed);
  const [feedCursor, setFeedCursor] = useState<string | null>(initialData.feedCursor);
  const [hasMoreFeed, setHasMoreFeed] = useState<boolean>(initialData.hasMoreFeed);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  // Ref to hold current state inside setInterval callbacks
  const stateRef = useRef({ days, filters, isPaused });
  useEffect(() => {
    stateRef.current = { days, filters, isPaused };
  }, [days, filters, isPaused]);

  // URL synchronization helper
  const syncUrl = useCallback((newDays: number, newFilters: DashboardFilters) => {
    const params = new URLSearchParams();
    if (newDays > 0) params.set('days', String(newDays));
    if (newFilters.suite) params.set('suite', newFilters.suite);
    if (newFilters.host) params.set('host', newFilters.host);
    if (newFilters.dbVersion) params.set('version', newFilters.dbVersion);
    if (newFilters.workloadHash) params.set('hash', newFilters.workloadHash);
    if (newFilters.tag) params.set('tag', newFilters.tag);
    if (newFilters.severity) params.set('severity', newFilters.severity);

    const queryStr = params.toString();
    const newUrl = queryStr ? `/dashboard?${queryStr}` : '/dashboard';
    window.history.replaceState(null, '', newUrl);
  }, []);

  // Fetch Dashboard Telemetry (Milestone 5.4 single round-trip)
  const fetchDashboard = useCallback(
    async (targetDays: number, targetFilters: DashboardFilters, silent = false) => {
      if (!silent) setIsFetching(true);

      const params = new URLSearchParams();
      params.set('days', String(targetDays));
      if (targetFilters.suite) params.set('suite', targetFilters.suite);
      if (targetFilters.host) params.set('host', targetFilters.host);
      if (targetFilters.dbVersion) params.set('dbVersion', targetFilters.dbVersion);
      if (targetFilters.workloadHash) params.set('workloadHash', targetFilters.workloadHash);
      if (targetFilters.tag) params.set('tag', targetFilters.tag);
      if (targetFilters.severity) params.set('severity', targetFilters.severity);
      params.set('limit', '50');

      try {
        const res = await fetch(`/api/dashboard?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.data) {
          setData(json.data);
          setFeedItems(json.data.feed);
          setFeedCursor(json.data.feedCursor);
          setHasMoreFeed(json.data.hasMoreFeed);
          setLastUpdated(new Date());
        }
      } catch (err) {
        console.error('Failed to refresh dashboard telemetry:', err);
      } finally {
        if (!silent) setIsFetching(false);
      }
    },
    []
  );

  // Time Window Change Handler (Milestone 5.1)
  const handleSelectDays = (newDays: number) => {
    setDays(newDays);
    syncUrl(newDays, filters);
    fetchDashboard(newDays, filters);
  };

  // Filter Change Handler (Milestone 5.2)
  const handleChangeFilters = (changed: Partial<DashboardFilters>) => {
    const nextFilters = { ...filters, ...changed };
    setFilters(nextFilters);
    syncUrl(days, nextFilters);
    fetchDashboard(days, nextFilters);
  };

  const handleClearFilters = () => {
    const cleared: DashboardFilters = {};
    setFilters(cleared);
    syncUrl(days, cleared);
    fetchDashboard(days, cleared);
  };

  // Keyset Pagination Load More (Milestone 5.3)
  const handleLoadMore = async () => {
    if (!feedCursor || isLoadingMore) return;
    setIsLoadingMore(true);

    const params = new URLSearchParams();
    params.set('days', String(days));
    if (filters.suite) params.set('suite', filters.suite);
    if (filters.host) params.set('host', filters.host);
    if (filters.dbVersion) params.set('dbVersion', filters.dbVersion);
    if (filters.workloadHash) params.set('workloadHash', filters.workloadHash);
    if (filters.tag) params.set('tag', filters.tag);
    if (filters.severity) params.set('severity', filters.severity);
    params.set('cursor', feedCursor);
    params.set('limit', '50');

    try {
      const res = await fetch(`/api/dashboard?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.data) {
        setFeedItems((prev) => [...prev, ...json.data.feed]);
        setFeedCursor(json.data.feedCursor);
        setHasMoreFeed(json.data.hasMoreFeed);
      }
    } catch (err) {
      console.error('Failed to load more feed items:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Milestone 5.6: 60-Second Live Polling Loop
  useEffect(() => {
    if (isPaused) return;

    const intervalId = setInterval(() => {
      if (!stateRef.current.isPaused) {
        fetchDashboard(stateRef.current.days, stateRef.current.filters, true);
      }
    }, 60_000); // 60 seconds

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !stateRef.current.isPaused) {
        fetchDashboard(stateRef.current.days, stateRef.current.filters, true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPaused, fetchDashboard]);

  return (
    <div className="space-y-6">
      {/* Dashboard Top Header (Time Window Selector & Polling Controls) */}
      <DashboardHeader
        days={days}
        onSelectDays={handleSelectDays}
        isPaused={isPaused}
        onTogglePause={() => setIsPaused((prev) => !prev)}
        lastUpdated={lastUpdated}
        isFetching={isFetching}
        onRefresh={() => fetchDashboard(days, filters)}
      />

      {/* Multi-Host Hardware Variance Warning (if applicable) */}
      {data.multiHostWarning && (
        <MultiHostWarning distinctHostsCount={data.distinctHostsCount} />
      )}

      {/* 6-State Status Roll-Up Summary Cards (Milestones 5.4 & 5.5) */}
      <StatusRollupCards
        rollups={data.rollups}
        activeSeverity={filters.severity}
        onSelectSeverity={(sev) => handleChangeFilters({ severity: sev })}
        days={days}
      />

      {/* Composable Multi-Dimensional AND Filter Bar (Milestone 5.2) */}
      <DashboardFilterBar
        filters={filters}
        onChangeFilters={handleChangeFilters}
        onClearFilters={handleClearFilters}
      />

      {/* Results Matrix: candidate runs x days, with triage popup */}
      <DashboardResultsTable
        rows={data.resultRows}
        triageByComparison={data.triageByComparison}
        filters={filters}
        days={days}
      />

      {/* Severity-Sorted Regression Feed (Milestones 5.3, 5.4, 5.5) */}
      <RegressionFeed
        feed={feedItems}
        hasMore={hasMoreFeed}
        onLoadMore={handleLoadMore}
        isLoadingMore={isLoadingMore}
        filters={filters}
        days={days}
      />

      {/* Middle Telemetry Grid: Daily Timeline & Suite Health (Milestone 5.4) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DailyTimelineChart timeline={data.dailyTimeline} />
        <SuiteHealthTable
          suites={data.suiteHealth}
          onSelectSuite={(suite) => handleChangeFilters({ suite })}
          days={days}
        />
      </div>

      {/* Bottom Telemetry: System Inventory and Baseline Coverage (Milestone 5.4 & 5.5) */}
      <SystemInventoryAndCoverage
        systems={data.systemInventory}
        coverage={data.baselineCoverage}
        days={days}
      />
    </div>
  );
}
