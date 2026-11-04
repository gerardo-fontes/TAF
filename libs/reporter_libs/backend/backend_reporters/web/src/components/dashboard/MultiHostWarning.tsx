/**
 * #############################################################################
 * # web::src::components::dashboard::MultiHostWarning.tsx
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
 * # Alert callout displayed when recent benchmark runs span multiple physical/virtual
 * # test hosts, warning engineers about potential cross-machine skew.
 * #############################################################################
 */

import React from 'react';

interface MultiHostWarningProps {
  distinctHostsCount: number;
}

export function MultiHostWarning({ distinctHostsCount }: MultiHostWarningProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200 shadow-lg shadow-amber-950/20 backdrop-blur"
    >
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-500/40">
        ⚠️
      </div>
      <div className="text-xs space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white tracking-tight">
            Multi-Host Telemetry Detected ({distinctHostsCount} distinct machines)
          </span>
          <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-mono text-amber-300 border border-amber-500/40">
            Hardware Variance Warning
          </span>
        </div>
        <p className="text-amber-200/90 leading-relaxed">
          Results in the selected time window were executed across different benchmark hosts with differing CPU models or memory layouts. Comparing performance results across different systems can yield misleading conclusions. Use the Host filter to isolate runs executed on identical hardware.
        </p>
      </div>
    </div>
  );
}
