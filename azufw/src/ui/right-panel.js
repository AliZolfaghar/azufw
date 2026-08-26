'use strict';

const blessed = require('neo-blessed');

function _destroyAllChildren(panel) {
  while (panel.children.length > 0) {
    const child = panel.children[0];
    child.detach();
    if (child.destroy) child.destroy();
  }
}

function createRightPanel(screen) {
  const panel = blessed.box({
    parent: screen,
    label: ' {bold}Rule Details{/bold} ',
    top: 5,
    left: '50%',
    width: '50%',
    bottom: 3,
    border: { type: 'line' },
    style: {
      border: { fg: '#5dade2' },
      label: { fg: '#5dade2' },
    },
    tags: true,
    keys: false,
  });

  panel._state = 'view';
  panel._currentRule = null;

  return panel;
}

function _showLogo(panel) {
  const logo = [
    '{center}{cyan-fg} █████╗ ███████╗██╗   ██╗███████╗██╗    ██╗{/cyan-fg}',
    '{center}{cyan-fg}██╔══██╗╚══███╔╝██║   ██║██╔════╝██║    ██║{/cyan-fg}',
    '{center}{cyan-fg}███████║  ███╔╝ ██║   ██║█████╗  ██║ █╗ ██║{/cyan-fg}',
    '{center}{cyan-fg}██╔══██║ ███╔╝  ██║   ██║██╔══╝  ██║███╗██║{/cyan-fg}',
    '{center}{cyan-fg}██║  ██║███████╗╚██████╔╝██║     ╚███╔███╔╝{/cyan-fg}',
    '{center}{cyan-fg}╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝      ╚══╝╚══╝ {/cyan-fg}',
    '',
    '{center}{gray-fg}UFW Firewall Manager v1.0.0{/gray-fg}',
  ].join('\n');

  blessed.box({
    parent: panel,
    bottom: 0,
    left: 1,
    right: 1,
    height: 9,
    content: logo,
    tags: true,
  });
}

function showViewMode(panel, rule, sshPort) {
  panel._state = 'view';
  panel._currentRule = rule;
  panel.setLabel(' {bold}Rule Details{/bold} ');
  _destroyAllChildren(panel);

  _showLogo(panel);

  if (!rule) {
    blessed.box({
      parent: panel,
      top: 0,
      left: 1,
      right: 1,
      bottom: 10,
      content: '{center}{gray-fg}◇ No rule selected{/gray-fg}\n\n{center}{gray-fg}Select a rule from the list\nto view its details{/gray-fg}{/center}',
      tags: true,
      align: 'center',
      valign: 'middle',
    });
    return;
  }

  const isCritical = rule.port && parseInt(rule.port, 10) === sshPort;

  const badgeColor = rule.action === 'ALLOW'
    ? '#1e8449'
    : (rule.action === 'DENY' || rule.action === 'REJECT') ? '#943126' : '#5d6d7e';

  blessed.box({
    parent: panel,
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    content: `{center}{bold}{white-fg}RULE #${rule.number}{/white-fg}{/bold}{/center}`,
    tags: true,
  });

  blessed.box({
    parent: panel,
    top: 1,
    left: 'center',
    width: 18,
    height: 3,
    content: `{center}{bold}${rule.action}{/bold}{/center}`,
    tags: true,
    align: 'center',
    valign: 'middle',
    border: { type: 'line' },
    style: {
      bg: badgeColor,
      fg: '#ffffff',
      bold: true,
      border: { fg: badgeColor },
    },
  });

  const section = (title) => ` {bold}{cyan-fg}▸ ${title}{/cyan-fg}{/bold} {gray-fg}─────────────────────────{/gray-fg}`;
  const field = (label, value) => `   {gray-fg}${label.padEnd(12)}{/gray-fg}  ${value}`;

  const lines = [
    section('CONNECTION'),
    field('Direction', rule.direction === 'out' ? '{cyan-fg}Outgoing →{/cyan-fg}' : '{cyan-fg}← Incoming{/cyan-fg}'),
    field('Port', `{bold}{white-fg}${rule.port || 'any'}{/white-fg}{/bold} {gray-fg}/ ${rule.protocol.toUpperCase()}{/gray-fg}`),
    '',
    section('ADDRESSING'),
    field('Source', rule.from || 'any'),
    field('Destination', rule.to || 'any'),
    field('IP Version', `v${rule.getIpVersion()}`),
    '',
    section('DESCRIPTION'),
    field('', rule.comment ? `{white-fg}${rule.comment}{/white-fg}` : '{gray-fg}(none){/gray-fg}'),
  ];

  if (isCritical) {
    lines.push('');
    lines.push(` {yellow-fg}{bold}⚠ CRITICAL{/bold} SSH port ${sshPort} — deletion blocked{/yellow-fg}`);
  }

  blessed.box({
    parent: panel,
    top: 4,
    left: 1,
    right: 1,
    bottom: 10,
    content: lines.join('\n'),
    tags: true,
    wrap: false,
  });

  panel._isCritical = isCritical;
}

function showHistoryMode(panel, entries) {
  panel._state = 'history';
  panel._historyEntries = entries;
  panel._historySelectedIndex = 0;
  panel.setLabel(' {bold}Deleted Rules History{/bold} ');
  _destroyAllChildren(panel);
  panel._historyItems = [];

  blessed.box({
    parent: panel,
    top: 0,
    left: 1,
    right: 1,
    height: 2,
    content: '  {bold}{magenta-fg}📜 Deleted Rules History{/magenta-fg}{/bold}',
    tags: true,
  });

  if (entries.length === 0) {
    blessed.box({
      parent: panel,
      top: 2,
      left: 1,
      right: 1,
      height: 5,
      content: '{center}{gray-fg}No deleted rules in history.{/gray-fg}{/center}',
      tags: true,
    });
    return;
  }

  entries.forEach((entry, idx) => {
    const yPos = 2 + idx * 2;
    const rule = entry.rule;
    const date = new Date(entry.deletedAt).toLocaleString();
    const item = blessed.box({
      parent: panel,
      top: yPos,
      left: 1,
      right: 1,
      height: 2,
      content: ` {yellow-fg}[${idx + 1}]{/yellow-fg} ${rule.action} ${rule.port || '-'}/${rule.protocol} — ${rule.comment || '-'} {gray-fg}(${date}){/gray-fg}`,
      tags: true,
      style: { bg: idx === 0 ? '#1a5276' : (idx % 2 === 0 ? '#1a1a2e' : '#16213e') },
    });
    panel._historyItems.push(item);
  });

  blessed.button({
    parent: panel,
    bottom: 0,
    left: 'center',
    width: 20,
    height: 3,
    content: ' {green-fg}Restore Selected (Enter){/green-fg} ',
    tags: true,
    border: { type: 'line' },
    style: {
      border: { fg: '#27ae60' },
    },
  });
}

function selectHistoryItem(panel, index) {
  if (!panel._historyItems || panel._historyItems.length === 0) return;
  const max = panel._historyItems.length - 1;
  if (index < 0) index = 0;
  if (index > max) index = max;
  panel._historySelectedIndex = index;

  panel._historyItems.forEach((item, i) => {
    item.style.bg = i === index ? '#1a5276' : (i % 2 === 0 ? '#1a1a2e' : '#16213e');
  });
}

function getSelectedHistoryIndex(panel) {
  return panel._historySelectedIndex || 0;
}

module.exports = {
  createRightPanel,
  showViewMode,
  showHistoryMode,
  selectHistoryItem,
  getSelectedHistoryIndex,
};
