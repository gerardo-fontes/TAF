/**
 * #############################################################################
 * # web::src::lib::charts::theme.ts
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
 * # This program is distributed in the hope that it will be useful,
 * # but WITHOUT ANY WARRANTY; without even the implied warranty of
 * # MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * # GNU General Public License for more details.
 * #
 * # You should have received a copy of the GNU General Public License
 * # along with this program; if not, write to the Free Software
 * # Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1335
 * #
 * # Licensed under the GNU General Public License, version 2 or later (GPLv2+).
 * # See https://www.gnu.org/licenses/ for details.
 * #
 * # PURPOSE:
 * # Shared design system tokens for charts: greyscale-distinguishable dash patterns,
 * # accessible series markers, status band color tokens, and number formatters.
 * #############################################################################
 */

import type { ComparisonStatus } from '../domain/status';

export interface ChartSeriesStyle {
  stroke: string;
  strokeWidth: number;
  strokeDasharray: string;
  markerType: 'circle' | 'diamond' | 'square';
  markerFill: string;
  markerStroke: string;
  areaFill: string;
  varianceBandFill: string;
  varianceBandStroke: string;
}

export interface StatusBandToken {
  fill: string;
  stroke: string;
  textColor: string;
  label: string;
}

export const CHART_SERIES: {
  baseline: ChartSeriesStyle;
  candidate: ChartSeriesStyle;
  maxChangeRef: {
    stroke: string;
    strokeWidth: number;
    strokeDasharray: string;
  };
} = {
  baseline: {
    stroke: '#3b82f6', // blue-500
    strokeWidth: 2.5,
    strokeDasharray: 'none', // Solid line for greyscale & accessibility
    markerType: 'circle',
    markerFill: '#3b82f6',
    markerStroke: '#0f172a',
    areaFill: 'rgba(59, 130, 246, 0.12)',
    varianceBandFill: 'rgba(59, 130, 246, 0.18)',
    varianceBandStroke: 'rgba(59, 130, 246, 0.4)',
  },
  candidate: {
    stroke: '#c084fc', // purple-400
    strokeWidth: 2.5,
    strokeDasharray: '6 4', // Dashed line for greyscale & accessibility
    markerType: 'diamond',
    markerFill: '#c084fc',
    markerStroke: '#0f172a',
    areaFill: 'rgba(192, 132, 252, 0.10)',
    varianceBandFill: 'rgba(192, 132, 252, 0.18)',
    varianceBandStroke: 'rgba(192, 132, 252, 0.4)',
  },
  maxChangeRef: {
    stroke: '#f59e0b', // amber-500
    strokeWidth: 1.5,
    strokeDasharray: '4 4',
  },
};

export const STATUS_BAND_TOKENS: Record<ComparisonStatus, StatusBandToken> = {
  GAIN: {
    fill: 'rgba(16, 185, 129, 0.12)',
    stroke: 'rgba(16, 185, 129, 0.4)',
    textColor: '#34d399',
    label: 'GAIN zone',
  },
  'PAR+': {
    fill: 'rgba(20, 184, 166, 0.08)',
    stroke: 'rgba(20, 184, 166, 0.3)',
    textColor: '#2dd4bf',
    label: 'PAR+ zone',
  },
  PAR: {
    fill: 'rgba(148, 163, 184, 0.05)',
    stroke: 'rgba(148, 163, 184, 0.2)',
    textColor: '#94a3b8',
    label: 'PAR zone',
  },
  'PAR-': {
    fill: 'rgba(251, 146, 60, 0.08)',
    stroke: 'rgba(251, 146, 60, 0.3)',
    textColor: '#fb923c',
    label: 'PAR- zone',
  },
  WARNING: {
    fill: 'rgba(245, 158, 11, 0.12)',
    stroke: 'rgba(245, 158, 11, 0.4)',
    textColor: '#fbbf24',
    label: 'WARNING zone',
  },
  REGRESSED: {
    fill: 'rgba(244, 63, 94, 0.14)',
    stroke: 'rgba(244, 63, 94, 0.45)',
    textColor: '#fb7185',
    label: 'REGRESSED zone',
  },
};

export const CHART_LAYOUT = {
  gridStroke: '#334155',
  gridOpacity: 0.35,
  axisTextFill: '#94a3b8',
  axisFontSize: 10,
  threadTickFontSize: 11,
  tooltipBackground: 'rgba(15, 23, 42, 0.95)',
  tooltipBorder: '#334155',
};

/**
 * Format metric number for compact display on chart axes and tooltips.
 */
export function formatMetricNumber(val: number): string {
  if (Math.abs(val) >= 1_000_000_000) {
    return `${(val / 1_000_000_000).toFixed(2)}B`;
  }
  if (Math.abs(val) >= 1_000_000) {
    return `${(val / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(val) >= 1_000) {
    return `${(val / 1_000).toFixed(1)}k`;
  }
  if (Math.abs(val) < 0.01 && val !== 0) {
    return val.toExponential(1);
  }
  return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Format percentage difference with explicit sign.
 */
export function formatDeltaPct(changePct: number): string {
  const sign = changePct > 0 ? '+' : '';
  return `${sign}${changePct.toFixed(2)}%`;
}

