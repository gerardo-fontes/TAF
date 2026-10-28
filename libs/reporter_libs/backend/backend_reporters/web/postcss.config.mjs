/**
 * #############################################################################
 * # web::postcss.config.mjs
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
 * # PostCSS configuration enabling the Tailwind CSS v4 plugin so utility
 * # classes are generated from src/app/globals.css.
 * #############################################################################
 */

const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
