/**
 * #############################################################################
 * # web::src::components::layout::Header.tsx
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
 * # Global application header displaying branding, primary navigation,
 * # and read-only status indicator.
 * #############################################################################
 */

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher';

export function Header() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Run Browser', href: '/' },
    { label: 'Dashboard', href: '/dashboard' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand / Logo */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3 group">
            {/* MariaDB Foundation logo — recolored copy of the official
                mariadb.org asset (public/icons/...svg): brand slate-blue ink
                (#355872) for the lettering/seal plus the original periwinkle
                & rust sea-lion marks (#6183E0/#D1876C), so the true logo
                colours show on light themes; dark themes get a lightness-only
                invert via CSS (see globals.css .taf-logo rules). */}
            <Image
              src="/icons/mariaDBFoundation_light_transparent.svg"
              alt="MariaDB Foundation logo"
              width={80}
              height={30}
              className="taf-logo h-14 w-auto shrink-0 group-hover:scale-105 transition-transform"
              priority
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-brand text-base group-hover:text-blue-400 transition-colors">
                  TAF
                </span>
                <span className="rounded bg-blue-950/80 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400 border border-blue-800/60">
                  WEB
                </span>
              </div>
              <p className="text-[11px] text-slate-400 tracking-wide">
                MariaDB Foundation Benchmark Reporter
              </p>
            </div>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-slate-800">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${active
                    ? 'bg-blue-950/60 text-blue-300 border border-blue-800/60 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-xs text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-slate-400">Database:</span>
            <span className="font-mono text-emerald-400 font-medium">taf_backend</span>
          </div>

          <ThemeSwitcher />
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
            Read-Only
          </span>
        </div>
      </div>
    </header>
  );
}
