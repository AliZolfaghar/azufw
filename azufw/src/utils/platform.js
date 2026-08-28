'use strict';

/**
 * ============================================================================
 * PLATFORM  —  mock-mode detection and demo data
 * ----------------------------------------------------------------------------
 * The whole app works WITHOUT a real Linux + UFW when you run it on Windows:
 * `isMockMode` is true → every file that would touch the OS (checker, executor)
 * switches to simulated rules so the UI is fully demo-able anywhere.
 *
 * NOT platform-detected for macOS by design — the app targets Linux+UFW.
 * ============================================================================
 */

/** true only on Windows (where `ufw` and `iptables` don't exist). */
const isMockMode = process.platform === 'win32';

/**
 * The simulated rule set used when in mock mode.
 * Numbers are assigned at load time (see cli/ufw-executor.js), not here.
 * @type {Array<object>}
 */
const MOCK_RULES = [
  { number: 1, action: 'ALLOW', port: '22', protocol: 'tcp', from: '0.0.0.0', to: 'any', comment: 'SSH Access', direction: 'in' },
  { number: 2, action: 'ALLOW', port: '80', protocol: 'tcp', from: '0.0.0.0', to: 'any', comment: 'HTTP', direction: 'in' },
  { number: 3, action: 'ALLOW', port: '443', protocol: 'tcp', from: '0.0.0.0', to: 'any', comment: 'HTTPS', direction: 'in' },
  { number: 4, action: 'DENY', port: '23', protocol: 'tcp', from: '0.0.0.0', to: 'any', comment: 'Block Telnet', direction: 'in' },
  { number: 5, action: 'ALLOW', port: '3306', protocol: 'tcp', from: '192.168.1.0/24', to: 'any', comment: 'MySQL Local', direction: 'in' },
];

/**
 * @returns {{isMockMode: boolean, platform: string}}
 */
function getPlatformInfo() {
  return {
    isMockMode,
    platform: process.platform,
  };
}

/**
 * Warning shown in the terminal banner when running on Windows.
 * @returns {string}
 */
function getMockMessage() {
  return '⚠  This program is designed for Linux. Running in Windows Mock Mode.';
}

module.exports = { isMockMode, MOCK_RULES, getPlatformInfo, getMockMessage };
