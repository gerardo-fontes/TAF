/**
 * #############################################################################
 * # web::src::lib::themes.ts
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
 * # Catalogue of selectable visual themes for the TAF web frontend. Each theme
 * # remaps the Tailwind neutral + accent colour scales via CSS variables so the
 * # entire UI re-skins without touching component markup.
 * #############################################################################
 */

export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  /** Preview swatch colours (background, surface, accent). */
  swatches: [string, string, string];
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'midnight',
    name: 'Midnight Indigo',
    description: 'Deep slate surfaces with indigo accents. The default TAF look.',
    swatches: ['#020617', '#0f172a', '#4f46e5'],
  },
  {
    id: 'ocean',
    name: 'Abyss Teal',
    description: 'Navy depths with bright teal/cyan accents for high contrast.',
    swatches: ['#04121f', '#0a1f33', '#06b6d4'],
  },
  {
    id: 'forest',
    name: 'Pine Emerald',
    description: 'Charcoal greens with emerald accents, easy on the eyes.',
    swatches: ['#05130d', '#0f2419', '#10b981'],
  },
  {
    id: 'ember',
    name: 'Ember Amber',
    description: 'Warm dark browns with amber/orange accents.',
    swatches: ['#1a1208', '#2a1e10', '#f59e0b'],
  },
  {
    id: 'violet',
    name: 'Violet Dusk',
    description: 'Purple-tinted neutrals with vivid violet/fuchsia accents.',
    swatches: ['#130a1f', '#21123a', '#a855f7'],
  },
];

export const DEFAULT_THEME_ID = 'midnight';

export function getTheme(id: string): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
