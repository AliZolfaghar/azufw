'use strict';

const blessed = require('neo-blessed');

function createLeftPanel(screen) {
  const list = blessed.list({
    parent: screen,
    label: ' {bold}Rules{/bold} ',
    top: 3,
    left: 0,
    width: '50%',
    bottom: 3,
    border: { type: 'line' },
    style: {
      border: { fg: '#5dade2' },
      label: { fg: '#5dade2' },
      selected: { bg: '#1a5276', fg: '#ffffff', bold: true },
      item: { fg: '#d5d8dc' },
      focus: { border: { fg: '#2e86c1' } },
    },
    tags: true,
    keys: true,
    vi: false,
    mouse: true,
  });

  return list;
}

function renderRuleList(list, rules, sshPort) {
  const items = rules.map(rule => {
    const isCritical = rule.port && parseInt(rule.port, 10) === sshPort;
    rule.isCritical = isCritical;

    let colorPrefix = '';
    let colorSuffix = '';
    if (isCritical) {
      colorPrefix = '{yellow-fg}⚠ ';
      colorSuffix = ' ★ CRITICAL{/yellow-fg}';
    } else if (rule.action === 'ALLOW') {
      colorPrefix = '{green-fg}✓ ';
      colorSuffix = '{/green-fg}';
    } else if (rule.action === 'DENY' || rule.action === 'REJECT') {
      colorPrefix = '{red-fg}✗ ';
      colorSuffix = '{/red-fg}';
    }

    return `${colorPrefix}[${rule.number}]  ${rule.action.padEnd(7)}  ${(rule.port || '-').padEnd(6)}  ${rule.protocol.toUpperCase().padEnd(4)}  ${rule.comment || '-'}${colorSuffix}`;
  });

  list.setItems(items.length > 0 ? items : ['{gray-fg}No rules found.{/gray-fg}']);
}

module.exports = { createLeftPanel, renderRuleList };
