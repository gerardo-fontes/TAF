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

const TRANSIENT_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'PROTOCOL_CONNECTION_LOST',
  'ER_LOCK_WAIT_TIMEOUT',
  'ER_QUERY_INTERRUPTED',
  'ER_CON_COUNT_ERROR',
]);

function isTransientDbError(err: any): boolean {
  if (!err) return false;
  if (err.code && TRANSIENT_ERROR_CODES.has(String(err.code))) return true;
  const message = String(err.message || '').toLowerCase();
  return (
    message.includes('connection lost') ||
    message.includes('connection reset') ||
    message.includes('timeout') ||
    message.includes('too many connections')
  );
}

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
 *
 * Transient connection errors (reset, timeout, lock wait) are retried up to
 * `backend_retries` times with a short exponential backoff so that a single
 * blip does not surface as an HTTP 500 to the dashboard.
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T> {
  const conf = getBackendConfig();
  const maxAttempts = Math.max(1, (conf.retries ?? 0) + 1);
  let lastError: any;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const p = getPool();
      const [rows] = await p.query(sql, params);
      return rows as T;
    } catch (err: any) {
      lastError = err;
      if (attempt === maxAttempts - 1 || !isTransientDbError(err)) {
        throw err;
      }
      const delayMs = 50 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
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
