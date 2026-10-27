/**
 * #############################################################################
 * # web::src::lib::config::backendConf.ts
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
 * # Parse TAF backend.conf files, CLI arguments, and environment variables into
 * # validated database connection options.
 * #
 * # ARCHITECTURAL ROLE:
 * # Enables the frontend to be fully standalone and relocatable, accepting
 * # database connection parameters from any backend.conf file without assuming
 * # fixed file paths or Docker dependencies.
 * #############################################################################
 */

import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export const BackendConfigSchema = z.object({
  enableReporting: z.boolean().default(true),
  host: z.string().default('127.0.0.1'),
  port: z.number().int().positive().default(3306),
  database: z.string().default('taf_backend'),
  user: z.string().default('root'),
  password: z.string().default('taf'),
  timeoutSeconds: z.number().int().positive().default(5),
  retries: z.number().int().nonnegative().default(1),
  ssl: z
    .object({
      caPath: z.string().optional(),
      certPath: z.string().optional(),
      keyPath: z.string().optional(),
      ca: z.string().optional(),
      cert: z.string().optional(),
      key: z.string().optional(),
    })
    .optional(),
});

export type BackendConfig = z.infer<typeof BackendConfigSchema>;

/**
 * Parses raw text from a TAF backend.conf properties file.
 */
export function parsePropertiesString(content: string): Record<string, string> {
  const props: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    const value = line.slice(eqIndex + 1).trim();
    props[key] = value;
  }

  return props;
}

/**
 * Parses a backend.conf file from disk.
 */
export function parseBackendConfFile(filePath: string): BackendConfig {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(/*turbopackIgnore: true*/ resolvedPath)) {
    throw new Error(`Configuration file not found: ${resolvedPath}`);
  }

  const raw = fs.readFileSync(/*turbopackIgnore: true*/ resolvedPath, 'utf8');
  const props = parsePropertiesString(raw);

  const ssl: BackendConfig['ssl'] = {};
  if (props.backend_db_ssl_ca && fs.existsSync(/*turbopackIgnore: true*/ props.backend_db_ssl_ca)) {
    ssl.caPath = props.backend_db_ssl_ca;
    ssl.ca = fs.readFileSync(/*turbopackIgnore: true*/ props.backend_db_ssl_ca, 'utf8');
  }
  if (props.backend_db_ssl_cert && fs.existsSync(/*turbopackIgnore: true*/ props.backend_db_ssl_cert)) {
    ssl.certPath = props.backend_db_ssl_cert;
    ssl.cert = fs.readFileSync(/*turbopackIgnore: true*/ props.backend_db_ssl_cert, 'utf8');
  }
  if (props.backend_db_ssl_key && fs.existsSync(/*turbopackIgnore: true*/ props.backend_db_ssl_key)) {
    ssl.keyPath = props.backend_db_ssl_key;
    ssl.key = fs.readFileSync(/*turbopackIgnore: true*/ props.backend_db_ssl_key, 'utf8');
  }

  return BackendConfigSchema.parse({
    enableReporting: props.enable_backend_reporting === '1' || props.enable_backend_reporting === 'true',
    host: props.backend_db_host || undefined,
    port: props.backend_db_port ? parseInt(props.backend_db_port, 10) : undefined,
    database: props.backend_db_name || undefined,
    user: props.backend_db_user || undefined,
    password: props.backend_db_pass ?? undefined,
    timeoutSeconds: props.backend_timeout ? parseInt(props.backend_timeout, 10) : undefined,
    retries: props.backend_retries ? parseInt(props.backend_retries, 10) : undefined,
    ssl: Object.keys(ssl).length > 0 ? ssl : undefined,
  });
}

/**
 * Resolves the configuration path from CLI arguments (--config=path) or environment variable.
 */
export function resolveConfigPath(): string | null {
  const arg = process.argv.find((a) => a.startsWith('--config='));
  if (arg) {
    return arg.slice('--config='.length);
  }

  if (process.env.TAF_BACKEND_CONF) {
    return process.env.TAF_BACKEND_CONF;
  }

  return null;
}

let cachedConfig: BackendConfig | null = null;

/**
 * Returns the active BackendConfig, resolving via --config, TAF_BACKEND_CONF,
 * individual environment variables (TAF_DB_*), or local defaults.
 */
export function getBackendConfig(): BackendConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const confPath = resolveConfigPath();
  if (confPath) {
    cachedConfig = parseBackendConfFile(confPath);
    return cachedConfig;
  }

  // Fallback to environment variables or defaults
  cachedConfig = BackendConfigSchema.parse({
    host: process.env.TAF_DB_HOST ?? '127.0.0.1',
    port: process.env.TAF_DB_PORT ? parseInt(process.env.TAF_DB_PORT, 10) : 3306,
    database: process.env.TAF_DB_NAME ?? 'taf_backend',
    user: process.env.TAF_DB_USER ?? 'root',
    password: process.env.TAF_DB_PASSWORD ?? 'taf',
    timeoutSeconds: process.env.TAF_DB_TIMEOUT ? parseInt(process.env.TAF_DB_TIMEOUT, 10) : 5,
    retries: process.env.TAF_DB_RETRIES ? parseInt(process.env.TAF_DB_RETRIES, 10) : 1,
  });

  return cachedConfig;
}
