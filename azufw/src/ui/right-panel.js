'use strict';

const blessed = require('neo-blessed');

// Helper: destroy all children of a panel
function _destroyAllChildren(panel) {
  while (panel.children.length > 0) {
    const child = panel.children[0];
    child.detach();
    if (child.destroy) child.destroy();
  }
}

// States: 'view', 'edit', 'add', 'history'
function createRightPanel(screen) {
  const panel = blessed.box({
    parent: screen,
    label: ' {bold}Details{/bold} ',
    top: 3,
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
  panel._formInputs = {};
  panel._formFields = ['action', 'port', 'protocol', 'from', 'to', 'comment'];
  panel._currentFieldIndex = 0;
  panel._saveBtn = null;
  panel._cancelBtn = null;

  return panel;
}

function showViewMode(panel, rule, sshPort) {
  panel._state = 'view';
  panel._currentRule = rule;
  _destroyAllChildren(panel);
  panel._formInputs = {};

  if (!rule) {
    const empty = blessed.box({
      parent: panel,
      top: 1,
      left: 1,
      right: 1,
      height: 5,
      content: '{center}{gray-fg}Select a rule from the list to view details.{/gray-fg}{/center}',
      tags: true,
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

  const contentBox = blessed.box({
    parent: panel,
    top: 0,
    left: 1,
    right: 1,
    height: '100%-4',
    content: details.join('\n'),
    tags: true,
    wrap: true,
  });

  // Delete button (disabled for critical)
  const deleteBtn = blessed.button({
    parent: panel,
    bottom: 0,
    left: 1,
    width: 12,
    height: 3,
    content: isCritical ? ' {red-fg}🔒 DELETE{/red-fg} ' : ' {red-fg}DELETE{/red-fg} ',
    tags: true,
    border: { type: 'line' },
    style: {
      border: { fg: '#e74c3c' },
      fg: '#e74c3c',
    },
  });

  if (isCritical) {
    deleteBtn.on('press', () => {
      renderDeleteError(panel, 'Cannot delete SSH critical rule!');
    });
  }

  panel._deleteBtn = deleteBtn;
  panel._isCritical = isCritical;
}

function renderDeleteError(panel, msg) {
  if (panel._deleteErrorBox) panel._deleteErrorBox.destroy();
  panel._deleteErrorBox = blessed.box({
    parent: panel,
    bottom: 3,
    left: 1,
    right: 1,
    height: 3,
    content: `{center}{red-fg}${msg}{/red-fg}{/center}`,
    tags: true,
    style: { bg: '#1a1a2e' },
  });
}

function showEditMode(panel, rule) {
  panel._state = rule ? 'edit' : 'add';
  panel._currentRule = rule;
  panel._currentFieldIndex = 0;
  _destroyAllChildren(panel);
  panel._formInputs = {};

  const title = rule ? `{bold}{cyan-fg}Edit Rule #${rule.number}{/cyan-fg}{/bold}` : `{bold}{green-fg}Add New Rule{/green-fg}{/bold}`;

  const titleBox = blessed.box({
    parent: panel,
    top: 0,
    left: 1,
    right: 1,
    height: 2,
    content: `  ${title}`,
    tags: true,
  });

  const fields = [
    { key: 'action', label: 'Action', type: 'choice', choices: ['ALLOW', 'DENY', 'REJECT'], value: rule ? rule.action : 'ALLOW' },
    { key: 'port', label: 'Port', type: 'input', value: rule ? rule.port : '' },
    { key: 'protocol', label: 'Protocol', type: 'choice', choices: ['tcp', 'udp'], value: rule ? rule.protocol : 'tcp' },
    { key: 'from', label: 'From IP', type: 'input', value: rule ? rule.from : '0.0.0.0' },
    { key: 'to', label: 'To IP', type: 'input', value: rule ? rule.to : 'any' },
    { key: 'comment', label: 'Comment', type: 'input', value: rule ? rule.comment : '' },
  ];

  fields.forEach((field, idx) => {
    const yPos = 2 + idx * 2;

    const labelBox = blessed.text({
      parent: panel,
      top: yPos,
      left: 1,
      width: 12,
      content: `  ${field.label}:`,
      tags: true,
      style: { fg: '#d5d8dc' },
    });

    if (field.type === 'choice') {
      const choiceBox = blessed.box({
        parent: panel,
        top: yPos,
        left: 14,
        right: 1,
        height: 1,
        content: ` [${field.choices.indexOf(field.value) + 1}/${field.choices.length}] ${field.value} `,
        tags: true,
        style: {
          bg: idx === 0 ? '#1a5276' : '#2c3e50',
          fg: '#ffffff',
        },
      });
      choiceBox._choices = field.choices;
      choiceBox._currentChoice = field.choices.indexOf(field.value);
      panel._formInputs[field.key] = choiceBox;
    } else {
      const input = blessed.textbox({
        parent: panel,
        top: yPos,
        left: 14,
        right: 1,
        height: 1,
        inputOnFocus: true,
        value: field.value || '',
        style: {
          bg: idx === 0 ? '#1a5276' : '#2c3e50',
          fg: '#ffffff',
          focus: { bg: '#1a5276' },
        },
        border: { type: 'line', style: { fg: '#5dade2' } },
      });
      panel._formInputs[field.key] = input;
    }
  });

  // Buttons row
  const saveBtn = blessed.button({
    parent: panel,
    bottom: 0,
    left: 'center',
    width: 14,
    height: 3,
    content: ' {green-fg}Save (Ctrl+S){/green-fg} ',
    tags: true,
    border: { type: 'line' },
    style: {
      border: { fg: '#27ae60' },
    },
  });

  const cancelBtn = blessed.button({
    parent: panel,
    bottom: 0,
    right: 1,
    width: 14,
    height: 3,
    content: ' {red-fg}Cancel (Esc){/red-fg} ',
    tags: true,
    border: { type: 'line' },
    style: {
      border: { fg: '#e74c3c' },
    },
  });

  panel._saveBtn = saveBtn;
  panel._cancelBtn = cancelBtn;

  // Highlight first field
  _highlightField(panel, 0);
}

function _highlightField(panel, index) {
  panel._currentFieldIndex = index;
  const fields = ['action', 'port', 'protocol', 'from', 'to', 'comment'];

  fields.forEach((key, i) => {
    const widget = panel._formInputs[key];
    if (!widget) return;

    if (widget._choices) {
      // Choice box
      widget.style.bg = i === index ? '#1a5276' : '#2c3e50';
    } else {
      // Textbox
      widget.style.bg = i === index ? '#1a5276' : '#2c3e50';
    }
  });
}

function cycleChoice(panel) {
  const fields = ['action', 'port', 'protocol', 'from', 'to', 'comment'];
  const key = fields[panel._currentFieldIndex];
  const widget = panel._formInputs[key];
  if (!widget || !widget._choices) return;

  widget._currentChoice = (widget._currentChoice + 1) % widget._choices.length;
  const val = widget._choices[widget._currentChoice];
  widget.setContent(` [${widget._currentChoice + 1}/${widget._choices.length}] ${val} `);
}

function getFormValues(panel) {
  const values = {};
  for (const key of panel._formFields) {
    const widget = panel._formInputs[key];
    if (!widget) continue;

    if (widget._choices) {
      values[key] = widget._choices[widget._currentChoice];
    } else {
      values[key] = (widget.getValue ? widget.getValue() : widget.content || '').trim();
    }
  }
  return values;
}

function showHistoryMode(panel, entries) {
  panel._state = 'history';
  panel._historyEntries = entries;
  panel._historySelectedIndex = 0;
  _destroyAllChildren(panel);
  panel._formInputs = {};
  panel._historyItems = [];

  const titleBox = blessed.box({
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

  const restoreBtn = blessed.button({
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
  panel._restoreBtn = restoreBtn;
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
  showEditMode,
  showHistoryMode,
  cycleChoice,
  getFormValues,
  _highlightField,
  selectHistoryItem,
  getSelectedHistoryIndex,
};
