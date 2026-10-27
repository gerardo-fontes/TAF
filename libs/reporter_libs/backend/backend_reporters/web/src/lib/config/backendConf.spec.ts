/**
 * #############################################################################
 * # web::src::lib::config::backendConf.spec.ts
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
 * # Unit tests for parsing TAF backend.conf files and properties format.
 * #############################################################################
 */

import { describe, it, expect } from 'vitest';
import { parsePropertiesString, BackendConfigSchema } from './backendConf';

describe('backendConf parser', () => {
  it('parses standard TAF backend.conf properties with comments and whitespace', () => {
    const sample = `
# TAF backend configuration
enable_backend_reporting = 1
backend_db_host = 192.168.1.100
backend_db_port = 3307
backend_db_name = taf_production
backend_db_user = taf_operator
backend_db_pass = secret_pass_123
backend_timeout = 10
backend_retries = 3
    `;

    const parsed = parsePropertiesString(sample);
    expect(parsed.enable_backend_reporting).toBe('1');
    expect(parsed.backend_db_host).toBe('192.168.1.100');
    expect(parsed.backend_db_port).toBe('3307');
    expect(parsed.backend_db_name).toBe('taf_production');
    expect(parsed.backend_db_user).toBe('taf_operator');
    expect(parsed.backend_db_pass).toBe('secret_pass_123');
    expect(parsed.backend_timeout).toBe('10');
    expect(parsed.backend_retries).toBe('3');

    const config = BackendConfigSchema.parse({
      enableReporting: parsed.enable_backend_reporting === '1',
      host: parsed.backend_db_host,
      port: parseInt(parsed.backend_db_port, 10),
      database: parsed.backend_db_name,
      user: parsed.backend_db_user,
      password: parsed.backend_db_pass,
      timeoutSeconds: parseInt(parsed.backend_timeout, 10),
      retries: parseInt(parsed.backend_retries, 10),
    });

    expect(config.host).toBe('192.168.1.100');
    expect(config.port).toBe(3307);
    expect(config.database).toBe('taf_production');
    expect(config.enableReporting).toBe(true);
    expect(config.timeoutSeconds).toBe(10);
  });

  it('applies defaults when optional fields are missing', () => {
    const config = BackendConfigSchema.parse({});
    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(3306);
    expect(config.database).toBe('taf_backend');
    expect(config.user).toBe('root');
    expect(config.password).toBe('taf');
    expect(config.timeoutSeconds).toBe(5);
  });
});
