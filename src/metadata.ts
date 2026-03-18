/**
 * Central metadata module - single source of truth for package name and version.
 * All code should import from here instead of hardcoding values.
 */

import { createRequire } from "node:module";

// Read directly from package.json at build/runtime
function readPackageJson(): { name: string; version: string; description: string } | null {
  try {
    const require = createRequire(import.meta.url);
    const candidates = ["../package.json", "../../package.json", "../../../package.json"];

    for (const candidate of candidates) {
      try {
        const pkg = require(candidate) as {
          name?: string;
          version?: string;
          description?: string;
        };
        if (pkg.name && pkg.version) {
          return {
            name: pkg.name,
            version: pkg.version,
            description: pkg.description || "",
          };
        }
      } catch {
        // Try next candidate
      }
    }
    return null;
  } catch {
    return null;
  }
}

const pkg = readPackageJson();

/**
 * Package name from package.json
 * @example "openclaw"
 */
export const PACKAGE_NAME = pkg?.name || "openclaw";

/**
 * Package version from package.json
 * @example "2026.3.2-ce"
 */
export const PACKAGE_VERSION = pkg?.version || "0.0.0-dev";

/**
 * Package description from package.json
 */
export const PACKAGE_DESCRIPTION = pkg?.description || "";

/**
 * User-facing display name (can be customized for CE, etc.)
 */
export const DISPLAY_NAME = "OpenClaw";

/**
 * Full display name with edition
 */
export const FULL_DISPLAY_NAME = `${DISPLAY_NAME} Community Edition`;

/**
 * User agent string for HTTP requests
 */
export const USER_AGENT = `${PACKAGE_NAME}/${PACKAGE_VERSION}`;
