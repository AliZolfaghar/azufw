'use strict';

const blessed = require('neo-blessed');

function createLeftPanel(screen) {
  const list = blessed.list({
    parent: screen,
    label: ' {bold}Rules{/bold} ',
    top: 5,
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
  const header = '{bold}{cyan-fg} #   Action   Port    Proto  From             To               Ver  Comment{/cyan-fg}{/bold}';
  const divider = '{gray-fg}─── ──────── ─────── ────── ──────────────── ──────────────── ─── ──────────────{/gray-fg}';

  const items = rules.map(rule => {
    const isCritical = rule.port && parseInt(rule.port, 10) === sshPort;
    rule.isCritical = isCritical;

    let colorPrefix = '';
    let colorSuffix = '';
    if (isCritical) {
      colorPrefix = '{yellow-fg}';
      colorSuffix = '{/yellow-fg}';
    } else if (rule.action === 'ALLOW') {
      colorPrefix = '{green-fg}';
      colorSuffix = '{/green-fg}';
    } else if (rule.action === 'DENY' || rule.action === 'REJECT') {
      colorPrefix = '{red-fg}';
      colorSuffix = '{/red-fg}';
    }

    const num = String(rule.number).padStart(3);
    const action = rule.action.padEnd(8);
    const port = (rule.port || '-').padEnd(7);
    const proto = rule.protocol.toUpperCase().padEnd(6);
    const from = (rule.from || '-').substring(0, 16).padEnd(16);
    const to = (rule.to || '-').substring(0, 16).padEnd(16);
    const ver = rule.getIpVersion().padEnd(3);
    const comment = (rule.comment || '-').substring(0, 14).padEnd(14);

    return `${colorPrefix}${num}  ${action} ${port} ${proto} ${from} ${to} ${ver}  ${comment}${colorSuffix}`;
  });

  list.setItems([header, divider, ...items]);
}

module.exports = { createLeftPanel, renderRuleList };
