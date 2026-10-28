/**
 * #############################################################################
 * # web::src::stores::theme.ts
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
 * # Zustand store holding the active visual theme id, persisted to localStorage
 * # and applied to the document element via a data-theme attribute.
 * #############################################################################
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DEFAULT_THEME_ID } from '@/lib/themes';

export interface ThemeState {
  themeId: string;
  setTheme: (id: string) => void;
}

const memoryStorage = {
  getItem: (_name: string) => null,
  setItem: (_name: string, _value: string) => {},
  removeItem: (_name: string) => {},
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themeId: DEFAULT_THEME_ID,
      setTheme: (id: string) => {
        set({ themeId: id });
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', id);
        }
      },
    }),
    {
      name: 'taf-theme',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : memoryStorage)),
      skipHydration: true,
    }
  )
);
