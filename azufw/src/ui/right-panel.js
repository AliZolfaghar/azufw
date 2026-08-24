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
    label: ' {bold}Details{/bold} ',
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

function showViewMode(panel, rule, sshPort) {
  panel._state = 'view';
  panel._currentRule = rule;
  _destroyAllChildren(panel);

  const logo = '{center}{bold}{cyan-fg}AZUFW{/cyan-fg}{/bold}\n{center}{gray-fg}UFW Firewall Manager v1.0.0{/gray-fg}';

  blessed.box({
    parent: panel,
    bottom: 0,
    left: 1,
    right: 1,
    height: 9,
    content: logo,
    tags: true,
  });

  if (!rule) {
    blessed.box({
      parent: panel,
      top: 0,
      left: 1,
      right: 1,
      bottom: 10,
      content: '{center}{gray-fg}Select a rule from the list to view details.{/gray-fg}{/center}',
      tags: true,
      valign: 'middle',
    });
    return;
  }

  const isCritical = rule.port && parseInt(rule.port, 10) === sshPort;
  const actionColor = rule.action === 'ALLOW' ? 'green' : (rule.action === 'DENY' || rule.action === 'REJECT') ? 'red' : 'white';
  const criticalTag = isCritical ? `  {yellow-fg}⚠ CRITICAL (SSH Port ${sshPort}){/yellow-fg}` : '';

  const details = [
    `{bold}{cyan-fg}Rule #${rule.number}{/cyan-fg}{/bold}${criticalTag}`,
    '',
    `  Action:    {${actionColor}-fg}${rule.action}{/${actionColor}-fg}`,
    `  Port:      ${rule.port || '-'}`,
    `  Protocol:  ${rule.protocol.toUpperCase()}`,
    `  From:      ${rule.from}`,
    `  To:        ${rule.to}`,
    `  Direction: ${rule.direction.toUpperCase()}`,
    `  Comment:   ${rule.comment || '-'}`,
    '',
    `{gray-fg}─────────────────────────────{/gray-fg}`,
  ];

  blessed.box({
    parent: panel,
    top: 0,
    left: 1,
    right: 1,
    bottom: 10,
    content: details.join('\n'),
    tags: true,
    wrap: true,
  });

  panel._isCritical = isCritical;
}

function showHistoryMode(panel, entries) {
  panel._state = 'history';
  panel._historyEntries = entries;
  panel._historySelectedIndex = 0;
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
