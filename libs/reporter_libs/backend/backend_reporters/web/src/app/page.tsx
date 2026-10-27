/**
 * #############################################################################
 * # web::src::app::page.tsx
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
 * # Root page component for TAF web frontend.
 * #############################################################################
 */

export default function HomePage() {
  return (
    <main className="p-8 max-w-7xl mx-auto">
      <div className="border border-slate-800 bg-slate-900/60 rounded-xl p-8 backdrop-blur shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
          <h1 className="text-2xl font-bold tracking-tight text-white">
            TAF Web Frontend — Foundation Ready
          </h1>
        </div>
        <p className="text-slate-400 mb-6 leading-relaxed">
          The read-only data layer, connection pool, and REST API routes for MariaDB TAF backend are initialized.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3 bg-slate-950/80 rounded border border-slate-800">
            <span className="text-slate-500 block">Health Endpoint</span>
            <span className="text-emerald-400">/api/health</span>
          </div>
          <div className="p-3 bg-slate-950/80 rounded border border-slate-800">
            <span className="text-slate-500 block">Runs Endpoint</span>
            <span className="text-blue-400">/api/runs</span>
          </div>
          <div className="p-3 bg-slate-950/80 rounded border border-slate-800">
            <span className="text-slate-500 block">Dashboard API</span>
            <span className="text-purple-400">/api/dashboard</span>
          </div>
        </div>
      </div>
    </main>
  );
}
