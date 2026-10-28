/**
 * #############################################################################
 * # web::src::stores::selection.ts
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
 * # Zustand store managing the 2-run comparison selection state (baseline & candidate)
 * # with role swapping, auto-persistence to sessionStorage, and max-2 enforcement.
 * #
 * # ARCHITECTURAL ROLE:
 * # Shared state between the RunTable rows, CompareActionBar, and Compare view.
 * #############################################################################
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { RunSummary } from '@/lib/domain/types';

export interface SelectionState {
  baseline: RunSummary | null;
  candidate: RunSummary | null;

  // Actions
  toggleRun: (run: RunSummary) => void;
  setBaseline: (run: RunSummary | null) => void;
  setCandidate: (run: RunSummary | null) => void;
  swapRoles: () => void;
  clearSelection: () => void;
  isSelected: (runId: string) => boolean;
  getRole: (runId: string) => 'baseline' | 'candidate' | null;
}

const memoryStorage = {
  getItem: (_name: string) => null,
  setItem: (_name: string, _value: string) => {},
  removeItem: (_name: string) => {},
};

export const useSelectionStore = create<SelectionState>()(
  persist(
    (set, get) => ({
      baseline: null,
      candidate: null,

      toggleRun: (run: RunSummary) => {
        const { baseline, candidate } = get();

        // If clicking already selected baseline -> remove baseline, shift candidate to baseline
        if (baseline && baseline.id === run.id) {
          set({ baseline: candidate, candidate: null });
          return;
        }

        // If clicking already selected candidate -> remove candidate
        if (candidate && candidate.id === run.id) {
          set({ candidate: null });
          return;
        }

        // If slot 1 (baseline) is empty -> fill baseline
        if (!baseline) {
          set({ baseline: run });
          return;
        }

        // If slot 2 (candidate) is empty -> fill candidate
        if (!candidate) {
          set({ candidate: run });
          return;
        }

        // Both are filled -> replace candidate with the new selection
        set({ candidate: run });
      },

      setBaseline: (run) => set({ baseline: run }),
      setCandidate: (run) => set({ candidate: run }),

      swapRoles: () => {
        const { baseline, candidate } = get();
        set({ baseline: candidate, candidate: baseline });
      },

      clearSelection: () => {
        set({ baseline: null, candidate: null });
      },

      isSelected: (runId: string) => {
        const { baseline, candidate } = get();
        return baseline?.id === runId || candidate?.id === runId;
      },

      getRole: (runId: string) => {
        const { baseline, candidate } = get();
        if (baseline?.id === runId) return 'baseline';
        if (candidate?.id === runId) return 'candidate';
        return null;
      },
    }),
    {
      name: 'taf-run-selection',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? sessionStorage : memoryStorage)),
      skipHydration: true,
    }
  )
);
