'use strict';

/**
 * ============================================================================
 * CHECKER  —  startup validation + one-shot bootstrap of UFW
 * ----------------------------------------------------------------------------
 * Runs (in this order) at app launch:
 *   1. checkSudo()      → exits immediately if we're not root on Linux
 *   2. bootstrapUfw()   → installs UFW if missing, enables it if inactive,
 *                          and returns the current status string.
 *
 * Mock mode short-circuits everything (Linux-specific tools don't exist).
 * ============================================================================
 */

const { execSync } = require('child_process');
const { isMockMode } = require('../utils/platform');
const { detectSshPort } = require('../utils/ssh-detector');

/**
 * Verifies the app is running as root (required by UFW).
 * Exits the process on failure. Always returns true otherwise.
 * @returns {boolean}
 */
function checkSudo() {
  if (isMockMode) return true;

  if (process.getuid && process.getuid() !== 0) {
    console.error('\x1b[31m[ERROR]\x1b[0m This program must be run as root. Use: sudo azufw');
    process.exit(1);
  }
  return true;
}

/**
 * @returns {boolean} whether the `ufw` binary exists on PATH
 */
function isUfwInstalled() {
  if (isMockMode) return true;
  try {
    execSync('which ufw', { stdio: 'ignore' });
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * One-shot auto-install attempt for debian/ubuntu.
 * @returns {boolean}
 */
function installUfw() {
  if (isMockMode) return true;
  console.log('[*] Installing UFW...');
  try {
    execSync('apt install ufw -y', { stdio: 'inherit' });
    return true;
  } catch (e) {
    console.error('\x1b[31m[ERROR]\x1b[0m Failed to install UFW:', e.message);
    return false;
  }
}

/**
 * @returns {'active'|'inactive'|'unknown'}
 */
function getUfwStatus() {
  if (isMockMode) return 'active';
  try {
    const out = execSync('ufw status', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    if (/inactive/i.test(out)) return 'inactive';
    if (/active/i.test(out)) return 'active';
    return 'unknown';
  } catch (_e) {
    return 'unknown';
  }
}

/**
 * Turns UFW ON (required for any rule to take effect).
 * @returns {boolean}
 */
function enableUfw() {
  if (isMockMode) return true;
  console.log('[*] Enabling UFW...');
  try {
    execSync('ufw --force enable', { stdio: 'inherit' });
    return true;
  } catch (e) {
    console.error('\x1b[31m[ERROR]\x1b[0m Failed to enable UFW:', e.message);
    return false;
  }
}

/**
 * Full start gate used by src/index.js.
 * @returns {Promise<{status: 'active'|'inactive'|'unknown', sshPort: number}>}
 */
async function bootstrapUfw() {
  if (isMockMode) {
    return { status: 'active', sshPort: detectSshPort() };
  }

  if (!isUfwInstalled()) {
    if (!installUfw()) {
      process.exit(1);
    }
  }

  let status = getUfwStatus();
  if (status === 'inactive') {
    enableUfw();
    status = getUfwStatus();
  }

  const sshPort = detectSshPort();
  return { status, sshPort };
}

module.exports = { checkSudo, bootstrapUfw, getUfwStatus, installUfw, enableUfw };
