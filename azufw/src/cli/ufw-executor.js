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

  const cmd = `ufw delete ${number}`;
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

module.exports = { listRules, addRule, deleteRule, editRule, getUfwVerbose };
