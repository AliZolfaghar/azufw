'use strict';

/**
 * ============================================================================
 * UFW EXECUTOR
 * ----------------------------------------------------------------------------
 * This module is the ONLY place in the app that talks to the operating system
 * firewall. It either:
 *
 *   1. Runs real `ufw` / `iptables` commands (on Linux, requires root), or
 *   2. Simulates them against an in-memory list (on Windows "mock mode", so the
 *      full UI can be developed without a real firewall).
 *
 * Every upstream public function returns a uniform result object:
 *    { success: true,  ... }  for successful operations, or
 *    { success: false, output: 'human readable error' } for failures.
 *
 * Components that consume this module:  controllers/rule-controller.js
 * ============================================================================
 */

const { execSync } = require('child_process');
const { isMockMode, MOCK_RULES } = require('../utils/platform');
const Rule = require('../models/Rule');

// --- Mock-mode state --------------------------------------------------------
// `mockRules` mirrors what `ufw status numbered` would return on a real box.
// `mockCounter` issues fresh rule numbers as mock rules are added.
let mockRules = MOCK_RULES.map((r, i) => new Rule({ ...r, number: i + 1 }));
let mockCounter = mockRules.length + 1;

/**
 * Runs an arbitrary shell command and turns its result into the uniform
 * { success, output } result object shared by all public APIs above.
 * @param {string} cmd - the full shell command line to execute
 * @returns {{success: boolean, output: string}}
 */
function runCmd(cmd) {
  try {
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { success: true, output: out };
  } catch (e) {
    // execSync throws when the command exits non-zero; capture stderr for the UI.
    return { success: false, output: e.stderr || e.message };
  }
}

/**
 * Returns every firewall rule in the system.
 * Real mode: parses `ufw status numbered` output line by line.
 * Mock mode: returns a fresh copy of the in-memory mock list.
 * @returns {Rule[]}
 */
function listRules() {
  if (isMockMode) {
    // Deep-copy so callers can't accidentally mutate the shared mock store.
    return mockRules.map((r, i) => new Rule({ ...r.toJSON(), number: i + 1 }));
  }

  try {
    const out = execSync('ufw status numbered', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const rules = [];

    // Each rule line in "ufw status numbered" starts with a "[N]" bracket.
    for (const line of out.split('\n')) {
      if (line.startsWith('[')) {
        const rule = Rule.parseFromNumberedStatus(line);
        if (rule) {
          rules.push(rule);
        }
      }
    }
    return rules;
  } catch (_e) {
    // UFW missing or broken → return an empty rule set rather than crash.
    return [];
  }
}

/**
 * Creates a new firewall rule.
 * Real mode: builds a `ufw allow/deny ...` command from the Rule and runs it.
 * Mock mode: appends to the in-memory list.
 * @param {Rule} rule - the fully-populated rule to create
 * @returns {{success: boolean, output?: string, rule?: Rule}}
 */
function addRule(rule) {
  if (isMockMode) {
    const newRule = new Rule({ ...rule.toJSON(), number: mockCounter++ });
    mockRules.push(newRule);
    return { success: true, rule: newRule };
  }

  const cmd = rule.toUfwCommand();
  const result = runCmd(cmd);
  return { success: result.success, output: result.output, rule };
}

/**
 * Removes a rule identified by its UFW number.
 * Real mode: `ufw --force delete <number>` (the --force flag skips UFW's
 * interactive confirmation prompt).
 * Mock mode: splices the matching rule out of the list and renumbers.
 * @param {number} number - the rule's number in the numbered status listing
 * @returns {{success: boolean, output?: string, rule?: Rule}}
 */
function deleteRule(number) {
  if (isMockMode) {
    const idx = number - 1;
    if (idx >= 0 && idx < mockRules.length) {
      const deleted = mockRules.splice(idx, 1)[0];
      // Keep the mock list numbering contiguous, exactly like real UFW does.
      mockRules.forEach((r, i) => { r.number = i + 1; });
      return { success: true, rule: deleted };
    }
    return { success: false, output: 'Rule not found' };
  }

  const cmd = `ufw --force delete ${number}`;
  const result = runCmd(cmd);
  return { success: result.success, output: result.output };
}

/**
 * Edits an existing rule by deleting the old one and adding a new one,
 * because UFW has no "edit" concept — a rule can only be replaced.
 * @param {Rule} oldRule - the rule currently in place
 * @param {Rule} newRule - the replacement rule with updated values
 * @returns {{success: boolean, output?: string, rule?: Rule}}
 */
function editRule(oldRule, newRule) {
  if (isMockMode) {
    const idx = oldRule.number - 1;
    if (idx >= 0 && idx < mockRules.length) {
      // Reuse the old rule's number so ordering is preserved for the user.
      mockRules[idx] = new Rule({ ...newRule.toJSON(), number: oldRule.number });
      return { success: true, rule: mockRules[idx] };
    }
    return { success: false, output: 'Rule not found' };
  }

  // Delete old, then add new
  const delResult = deleteRule(oldRule.number);
  if (!delResult.success) {
    return { success: false, output: `Failed to delete old rule: ${delResult.output}` };
  }

  const addResult = addRule(newRule);
  if (!addResult.success) {
    return { success: false, output: `Failed to add new rule: ${addResult.output}` };
  }

  return { success: true, rule: newRule };
}

/**
 * Returns UFW's human-readable verbose status text (used by the header).
 * Mock mode fabricates a similar-looking listing from the mock rules.
 * @returns {string} multi-line status text (may be empty on failure)
 */
function getUfwVerbose() {
  if (isMockMode) {
    return 'Status: active\n\n     To                         Action      From\n     --                         ------      ----\n' +
      mockRules.map(r => `[ ${r.number}] ${r.port}/${r.protocol.padEnd(3)}     ${r.action.padEnd(11)} ${r.from}`).join('\n');
  }
  try {
    return execSync('ufw status verbose', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (_e) {
    return '';
  }
}

/**
 * Reads the LIVE traffic counters (packets + bytes) for a given rule.
 *
 * UFW does not expose per-rule traffic, but UFW is a thin wrapper over
 * iptables, and every UFW user rule is mirrored into the `ufw-user-input`
 * chain. That chain contains one ACCEPT/DROP entry per rule, each with its
 * own cumulative packet/byte counters. We parse that listing to find the row
 * matching our action/port/protocol and sum its counters.
 *
 * Matching caveats handled here:
 *  - With `-n`, iptables prints protocols as numbers (6=tcp, 17=udp).
 *  - A bare-port rule (e.g. "allow 22" with no /tcp|/udp suffix) expands to
 *    BOTH a tcp and a udp row, so exact-protocol matching may miss half the
 *    traffic. Strategy: prefer exact-protocol rows; if none match, fall back
 *    to summing every row for the target+port regardless of protocol.
 *
 * Mock mode returns plausible time-growing figures so the live-rate popup
 * works on Windows.
 *
 * @param {string} action   - 'ALLOW' | 'DENY' | 'REJECT' (UFW wording)
 * @param {string} port     - destination port ('' or null = "any")
 * @param {string} protocol - 'tcp' | 'udp'
 * @returns {{success: boolean, pkts?: number, bytes?: number, output?: string}}
 */
function getRuleTraffic(action, port, protocol) {
  if (isMockMode) {
    // Deterministic growth driven by the clock; the seed depends on the port
    // so different rules produce visibly different numbers.
    const t = Math.floor(Date.now() / 1000);
    const seed = (parseInt(port, 10) || 80) % 97 || 7;
    const pkts = Math.floor(50000 / seed + t * 37 * (seed % 13 + 1));
    const bytes = pkts * (800 + seed * 40);
    return { success: true, pkts, bytes };
  }

  // UFW actions differ from iptables targets by name:
  const targetMap = { ALLOW: 'ACCEPT', DENY: 'DROP', REJECT: 'REJECT' };
  const target = targetMap[action.toUpperCase()] || action.toUpperCase();
  // iptables -n numeric protocol codes → human names:
  const PROTO_NUM = { 6: 'tcp', 17: 'udp' };

  try {
    const out = execSync('iptables -L ufw-user-input -v -n -x', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    // strict* = rows whose protocol exactly matches; loose* = any protocol.
    let strictPkts = 0, strictBytes = 0, strictFound = false;
    let loosePkts = 0, looseBytes = 0, looseFound = false;

    for (const line of out.split('\n')) {
      const f = line.trim().split(/\s+/);
      // -v output rows have ≥10 columns: pkts bytes target prot opt in out src dst [extra]
      if (f.length < 10) continue;

      const p = parseInt(f[0], 10);
      const b = parseInt(f[1], 10);
      if (isNaN(p) || isNaN(b)) continue; // skip header / non-counter row

      if (f[2] !== target) continue;          // only rows with our ACCEPT/DROP target
      if (port && !new RegExp(`dpts?:${port}(\\s|$)`).test(line)) continue; // match dest port

      const protName = (PROTO_NUM[f[3]] || f[3]).toLowerCase();
      const protoOk = !protocol || protName === String(protocol).toLowerCase();

      // Tally the row into the strict bucket if the protocol lines up,
      // otherwise into the loose fallback bucket.
      if (protoOk) {
        strictPkts += p; strictBytes += b; strictFound = true;
      } else {
        loosePkts += p; looseBytes += b; looseFound = true;
      }
    }

    // Prefer the exact-protocol total; use the any-protocol total as fallback
    // for bare-port rules that UFW split into tcp+udp rows.
    if (strictFound) {
      return { success: true, pkts: strictPkts, bytes: strictBytes };
    }
    if (looseFound) {
      return { success: true, pkts: loosePkts, bytes: looseBytes };
    }
    return { success: false, output: 'No matching iptables counter found for this rule' };
  } catch (e) {
    return { success: false, output: e.stderr || e.message };
  }
}

module.exports = { listRules, addRule, deleteRule, editRule, getUfwVerbose, getRuleTraffic };
