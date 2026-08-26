'use strict';

const { execSync } = require('child_process');
const { isMockMode, MOCK_RULES } = require('../utils/platform');
const Rule = require('../models/Rule');

// In-memory store for mock mode
let mockRules = MOCK_RULES.map((r, i) => new Rule({ ...r, number: i + 1 }));
let mockCounter = mockRules.length + 1;

function runCmd(cmd) {
  try {
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { success: true, output: out };
  } catch (e) {
    return { success: false, output: e.stderr || e.message };
  }
}

function listRules() {
  if (isMockMode) {
    return mockRules.map((r, i) => new Rule({ ...r.toJSON(), number: i + 1 }));
  }

  try {
    const out = execSync('ufw status numbered', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const lines = out.split('\n');
    const rules = [];

    for (const line of lines) {
      if (line.startsWith('[')) {
        const rule = Rule.parseFromNumberedStatus(line);
        if (rule) {
          rules.push(rule);
        }
      }
    }
    return rules;
  } catch (_e) {
    return [];
  }
}

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

function deleteRule(number) {
  if (isMockMode) {
    const idx = number - 1;
    if (idx >= 0 && idx < mockRules.length) {
      const deleted = mockRules.splice(idx, 1)[0];
      // Renumber
      mockRules.forEach((r, i) => { r.number = i + 1; });
      return { success: true, rule: deleted };
    }
    return { success: false, output: 'Rule not found' };
  }

  const cmd = `ufw --force delete ${number}`;
  const result = runCmd(cmd);
  return { success: result.success, output: result.output };
}

function editRule(oldRule, newRule) {
  if (isMockMode) {
    const idx = oldRule.number - 1;
    if (idx >= 0 && idx < mockRules.length) {
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

function getRuleTraffic(action, port, protocol) {
  if (isMockMode) {
    const t = Math.floor(Date.now() / 1000);
    const seed = (parseInt(port, 10) || 80) % 97 || 7;
    const pkts = Math.floor(50000 / seed + t * 37 * (seed % 13 + 1));
    const bytes = pkts * (800 + seed * 40);
    return { success: true, pkts, bytes };
  }

  const targetMap = { ALLOW: 'ACCEPT', DENY: 'DROP', REJECT: 'REJECT' };
  const target = targetMap[action.toUpperCase()] || action.toUpperCase();

  try {
    const out = execSync('iptables -L ufw-user-input -v -n -x', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    let pkts = 0;
    let bytes = 0;
    let found = false;

    for (const line of out.split('\n')) {
      const f = line.trim().split(/\s+/);
      if (f.length < 10) continue;
      const p = parseInt(f[0], 10);
      const b = parseInt(f[1], 10);
      if (isNaN(p) || isNaN(b)) continue;
      if (f[2] !== target) continue;
      if (f[3] !== protocol.toLowerCase()) continue;
      if (port && !new RegExp(`dpts?:${port}(\\s|$)`).test(line)) continue;
      pkts += p;
      bytes += b;
      found = true;
    }

    if (!found) {
      return { success: false, output: 'No matching iptables counter found for this rule' };
    }
    return { success: true, pkts, bytes };
  } catch (e) {
    return { success: false, output: e.stderr || e.message };
  }
}

module.exports = { listRules, addRule, deleteRule, editRule, getUfwVerbose, getRuleTraffic };
