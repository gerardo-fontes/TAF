/**
 * #############################################################################
 * # web::src::lib::config::backendConf.spec.ts
 * #
 * # Created: October 2026
 * # Last Modified: November 2026
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
 * # Unit tests for parsing TAF backend.conf files, property syntax, SSL paths,
 * # and environment/CLI configuration resolution.
 * #############################################################################
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  parsePropertiesString,
  parseBackendConfFile,
  resolveConfigPath,
  BackendConfigSchema,
} from './backendConf';

describe('backendConf parser', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taf-conf-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('parsePropertiesString', () => {
    it('parses standard TAF backend.conf properties with comments and whitespace', () => {
      const sample = `
# TAF backend configuration
; Alternate comment style
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

    it('handles lines with equal signs in values (e.g. passwords or tokens)', () => {
      const sample = `
backend_db_pass = pass=word==with=equals
key_with_empty_val =
# Comment line
invalid line without equals
      `;
      const parsed = parsePropertiesString(sample);
      expect(parsed.backend_db_pass).toBe('pass=word==with=equals');
      expect(parsed.key_with_empty_val).toBe('');
      expect(parsed['invalid line without equals']).toBeUndefined();
    });

    it('ignores empty lines and leading/trailing whitespace around keys and values', () => {
      const sample = `
   
   key1   =   val1   
   key2=val2
`;
      const parsed = parsePropertiesString(sample);
      expect(parsed.key1).toBe('val1');
      expect(parsed.key2).toBe('val2');
    });
  });

  describe('BackendConfigSchema', () => {
    it('applies defaults when optional fields are missing', () => {
      const config = BackendConfigSchema.parse({});
      expect(config.host).toBe('127.0.0.1');
      expect(config.port).toBe(3306);
      expect(config.database).toBe('taf_backend');
      expect(config.user).toBe('root');
      expect(config.password).toBe('taf');
      expect(config.timeoutSeconds).toBe(5);
      expect(config.retries).toBe(1);
      expect(config.enableReporting).toBe(true);
      expect(config.ssl).toBeUndefined();
    });

    it('validates port and numeric ranges', () => {
      expect(() => BackendConfigSchema.parse({ port: -1 })).toThrow();
      expect(() => BackendConfigSchema.parse({ port: 0 })).toThrow();
      expect(() => BackendConfigSchema.parse({ timeoutSeconds: 0 })).toThrow();
      expect(() => BackendConfigSchema.parse({ retries: -1 })).toThrow();
    });
  });

  describe('parseBackendConfFile', () => {
    it('throws when configuration file does not exist', () => {
      expect(() => parseBackendConfFile(path.join(tempDir, 'nonexistent.conf'))).toThrow(
        /Configuration file not found/
      );
    });

    it('parses valid configuration file from disk with SSL paths when certificates exist', () => {
      const caPath = path.join(tempDir, 'ca.pem');
      const certPath = path.join(tempDir, 'client-cert.pem');
      const keyPath = path.join(tempDir, 'client-key.pem');

      fs.writeFileSync(caPath, '---MOCK CA---');
      fs.writeFileSync(certPath, '---MOCK CERT---');
      fs.writeFileSync(keyPath, '---MOCK KEY---');

      const confPath = path.join(tempDir, 'backend.conf');
      const confContent = `
enable_backend_reporting = true
backend_db_host = 10.0.0.5
backend_db_port = 3308
backend_db_name = custom_taf
backend_db_user = admin
backend_db_pass = s3cr3t
backend_timeout = 15
backend_retries = 2
backend_db_ssl_ca = ${caPath}
backend_db_ssl_cert = ${certPath}
backend_db_ssl_key = ${keyPath}
      `;
      fs.writeFileSync(confPath, confContent);

      const config = parseBackendConfFile(confPath);
      expect(config.enableReporting).toBe(true);
      expect(config.host).toBe('10.0.0.5');
      expect(config.port).toBe(3308);
      expect(config.database).toBe('custom_taf');
      expect(config.user).toBe('admin');
      expect(config.password).toBe('s3cr3t');
      expect(config.timeoutSeconds).toBe(15);
      expect(config.retries).toBe(2);
      expect(config.ssl).toBeDefined();
      expect(config.ssl?.ca).toBe('---MOCK CA---');
      expect(config.ssl?.cert).toBe('---MOCK CERT---');
      expect(config.ssl?.key).toBe('---MOCK KEY---');
    });

    it('handles non-existent SSL paths gracefully without failing the entire config parse', () => {
      const confPath = path.join(tempDir, 'backend_no_ssl.conf');
      const confContent = `
backend_db_host = 127.0.0.1
backend_db_ssl_ca = /tmp/does_not_exist_ca.pem
      `;
      fs.writeFileSync(confPath, confContent);

      const config = parseBackendConfFile(confPath);
      expect(config.host).toBe('127.0.0.1');
      expect(config.ssl).toBeUndefined();
    });
  });

  describe('resolveConfigPath', () => {
    const origArgv = [...process.argv];
    const origEnv = process.env.TAF_BACKEND_CONF;

    afterEach(() => {
      process.argv = [...origArgv];
      if (origEnv !== undefined) {
        process.env.TAF_BACKEND_CONF = origEnv;
      } else {
        delete process.env.TAF_BACKEND_CONF;
      }
    });

    it('extracts path from --config argument', () => {
      process.argv = ['node', 'server.js', '--config=/etc/taf/backend.conf'];
      delete process.env.TAF_BACKEND_CONF;
      expect(resolveConfigPath()).toBe('/etc/taf/backend.conf');
    });

    it('extracts path from TAF_BACKEND_CONF environment variable when CLI flag is absent', () => {
      process.argv = ['node', 'server.js'];
      process.env.TAF_BACKEND_CONF = '/opt/taf/custom.conf';
      expect(resolveConfigPath()).toBe('/opt/taf/custom.conf');
    });

    it('prioritizes --config argument over TAF_BACKEND_CONF environment variable', () => {
      process.argv = ['node', 'server.js', '--config=/cli/override.conf'];
      process.env.TAF_BACKEND_CONF = '/env/default.conf';
      expect(resolveConfigPath()).toBe('/cli/override.conf');
    });

    it('returns null when neither CLI flag nor environment variable is set', () => {
      process.argv = ['node', 'server.js'];
      delete process.env.TAF_BACKEND_CONF;
      expect(resolveConfigPath()).toBeNull();
    });
  });
});
