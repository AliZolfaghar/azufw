'use strict';

/**
 * ============================================================================
 * SSH DETECTOR  —  reads the actual SSH port from sshd_config
 * ----------------------------------------------------------------------------
 * UFW doesn't protect "the SSH port" generically — it protects rules whose
 * destination port equals whatever SSHD is configured to listen on. So we parse
 * /etc/ssh/sshd_config for a `Port` directive and fall back to 22 if the
 * config is unreadable or missing the directive.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

/** Where OpenSSH keeps its daemon config (standard on Ubuntu/Debian). */
const SSH_CONFIG_PATH = '/etc/ssh/sshd_config';
/** Almost-universal fallback used if parsing fails for any reason. */
const DEFAULT_SSH_PORT = 22;

/**
 * Returns the SSH listen port (an integer).
 * "Port N" appears either uncommented in the body, the FIRST match wins.
 * @returns {number}
 */
function detectSshPort() {
  try {
    const content = fs.readFileSync(path.normalize(SSH_CONFIG_PATH), 'utf8');
    const match = content.match(/^\s*Port\s+(\d+)/m);
    if (match) {
      return parseInt(match[1], 10);
    }
  } catch (_e) {
    // Config unreadable/not found (e.g. running in mock mode) → fallback.
  }
  return DEFAULT_SSH_PORT;
}

module.exports = { detectSshPort, DEFAULT_SSH_PORT };
