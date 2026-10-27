/**
 * #############################################################################
 * # web::src::lib::db::pool.ts
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
 * # Lazy-initialized MariaDB connection pool over mysql2/promise with SSL,
 * # BigInt safety, and timezone-neutral date string handling.
 * #
 * # ARCHITECTURAL ROLE:
 * # Central database connection provider for all read-only API queries.
 * # Supports backend.conf configuration and graceful degradation.
 * #############################################################################
 */

import mysql from 'mysql2/promise';
import { getBackendConfig } from '../config/backendConf';

let pool: mysql.Pool | null = null;

/**
 * Returns the shared connection pool, initializing it lazily on first access.
 */
export function getPool(): mysql.Pool {
  if (pool) {
    return pool;
  }

  const conf = getBackendConfig();

  const poolOptions: mysql.PoolOptions = {
    host: conf.host,
    port: conf.port,
    database: conf.database,
    user: conf.user,
    password: conf.password,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: conf.timeoutSeconds * 1000,
    // Critical: Return DATETIME as string to prevent Node timezone shifting
    dateStrings: true,
    // Critical: Handle BIGINT ids beyond Number.MAX_SAFE_INTEGER
    supportBigNumbers: true,
    bigNumberStrings: true,
  };

  if (conf.ssl && (conf.ssl.ca || conf.ssl.cert || conf.ssl.key)) {
    poolOptions.ssl = {
      ca: conf.ssl.ca,
      cert: conf.ssl.cert,
      key: conf.ssl.key,
      rejectUnauthorized: true,
    };
  }

  pool = mysql.createPool(poolOptions);
  return pool;
}

/**
 * Helper to execute a parameterized read-only query against the pool.
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T> {
  const p = getPool();
  const [rows] = await p.query(sql, params);
  return rows as T;
}

/**
 * Checks connection health by pinging the database with SELECT 1.
 */
export async function healthcheck(): Promise<{ ok: boolean; database: 'up' | 'down'; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const p = getPool();
    await p.query('SELECT 1 AS alive;');
    return {
      ok: true,
      database: 'up',
      latencyMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      ok: false,
      database: 'down',
      latencyMs: Date.now() - start,
      error: err?.message || 'Database connection failed',
    };
  }
}
