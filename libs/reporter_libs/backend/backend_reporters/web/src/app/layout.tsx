/**
 * #############################################################################
 * # web::src::app::layout.tsx
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
 * # Root Next.js layout providing global HTML structure and metadata.
 * #############################################################################
 */

import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import './globals.css';

export const metadata: Metadata = {
  title: 'TAF — Test Automation Framework Web Frontend',
  description: 'Automated database benchmarking run browser, comparison analysis, and regression dashboard.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="midnight" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var t=localStorage.getItem("taf-theme");if(t){try{t=JSON.parse(t).state.themeId;}catch(e){} } if(!t) t="midnight"; document.documentElement.setAttribute("data-theme", t);}catch(e){document.documentElement.setAttribute("data-theme","midnight");}})();',
          }}
        />
      </head>
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased font-sans flex flex-col">
        <Header />
        <div className="flex-1">
          {children}
        </div>
      </body>
    </html>
  );
}
