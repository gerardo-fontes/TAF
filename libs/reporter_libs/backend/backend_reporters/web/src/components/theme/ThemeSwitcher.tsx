/**
 * #############################################################################
 * # web::src::components::theme::ThemeSwitcher.tsx
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
 * # Dropdown control letting users pick one of the 5 selectable frontend themes.
 * #############################################################################
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useThemeStore } from '@/stores/theme';
import { THEMES, DEFAULT_THEME_ID } from '@/lib/themes';

export function ThemeSwitcher() {
  const { themeId, setTheme } = useThemeStore();
  const [mounted, setMounted] = useState(false);

  // Hydrate persisted theme on mount and apply to document.
  useEffect(() => {
    setMounted(true);
    // Rehydrate zustand persist store
    useThemeStore.persist.rehydrate();
    const current = useThemeStore.getState().themeId || DEFAULT_THEME_ID;
    document.documentElement.setAttribute('data-theme', current);
  }, []);

  const active = mounted ? themeId : DEFAULT_THEME_ID;

  return (
    <div className="relative">
      <label htmlFor="taf-theme-select" className="sr-only">
        Select visual theme
      </label>
      <select
        id="taf-theme-select"
        value={active}
        onChange={(e) => setTheme(e.target.value)}
        className="rounded-md border border-slate-700 bg-slate-900/80 py-1.5 pl-2 pr-7 text-xs text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
        aria-label="Select visual theme"
      >
        {THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}
