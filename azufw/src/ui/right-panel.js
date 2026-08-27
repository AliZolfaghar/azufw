'use strict';

/**
 * ============================================================================
 * RIGHT PANEL  —  right half of the screen
 * ----------------------------------------------------------------------------
 * The right panel has TWO operating modes, tracked by `panel._state`:
 *
 *   'view'    (default)  → detailed read-only view of whatever rule is selected
 *                          in the left panel, plus the AZUFW logo at the bottom.
 *   'history'             → list of recently deleted rules with Restore + navigation.
 *
 * The panel's label (top border) is swapped by setLabel() depending on the mode.
 * Content is destroyed and rebuilt per selection because neo-blessed boxes are static;
 * rebuilding is simpler than trying to diff/update individual lines.
 * ============================================================================
 */

const blessed = require('neo-blessed');

/**
 * Detach and destroy every child widget on the panel.
 * Used before every repaint so stale boxes don't stack up.
 * @param {object} panel - the blessed element whose children to wipe
 */
function _destroyAllChildren(panel) {
  while (panel.children.length > 0) {
    const child = panel.children[0];
    child.detach();
    if (child.destroy) child.destroy();
  }
}

/**
 * Creates the right panel and anchors it to the right half of the screen.
 * Starts in 'view' mode with no rule selected.
 * @param {object} screen - the blessed screen
 * @returns {object} the new right-panel element
 */
function createRightPanel(screen) {
  const panel = blessed.box({
    parent: screen,
    label: ' {bold}Rule Details{/bold} ',
    top: 5,             // below the 5-row header
    left: '50%',        // right half of the screen
    width: '50%',
    bottom: 3,          // above the 3-row footer
    border: { type: 'line' },
    style: {
      border: { fg: '#5dade2' },
      label: { fg: '#5dade2' },
    },
    tags: true,
    keys: false,
  });

  // Public-ish state read by src/index.js to decide which keyboard shortcuts apply.
  panel._state = 'view';
  panel._currentRule = null;

  return panel;
}

/**
 * Renders the AZUFW ASCII-art logo pinned to the bottom of the panel.
 * Always shown in 'view' mode (below the rule details).
 * @param {object} panel - right panel to attach the logo to
 */
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

/**
 * Switches the panel into VIEW mode: shows the selected rule's details above
 * the AZUFW logo. Called on every selection change and after rules reload.
 *
 * Purely visual — no UFW interaction happens here.
 *
 * @param {object} panel   - right panel element
 * @param {Rule|null} rule - the currently selected rule (or null if none)
 * @param {number} sshPort  - the local SSH port, used to flag critical rules
 */
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

  // Rule number line at the very top of the view area.
  blessed.box({
    parent: panel,
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    content: `{center}{bold}{white-fg}RULE #${rule.number}{/white-fg}{/bold}{/center}`,
    tags: true,
  });

  // Bordered action badge (green ALLOW / red DENY / gray other).
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

  // --- Detail body: three titled sections, one line helper wrappers ------------
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

  // Warn prominently when this rule guards the SSH port (can't be deleted).
  if (isCritical) {
    lines.push('');
    lines.push(` {yellow-fg}{bold}⚠ CRITICAL{/bold} SSH port ${sshPort} — deletion blocked{/yellow-fg}`);
  }

  blessed.box({
    parent: panel,
    top: 4,       // below the RULE # header + badge
    left: 1,
    right: 1,
    bottom: 10,    // above the logo
    content: lines.join('\n'),
    tags: true,
    wrap: false,
  });

  // Stash the flag so src/index.js can block the Delete key for this rule.
  panel._isCritical = isCritical;
}

/**
 * Switches the panel into HISTORY mode: displays the deleted-rules history list,
 * highlights a selected entry, shows a Restore button, and prepares state needed
 * by src/index.js (arrow keys, Restore via Enter).
 * @param {object} panel   - right panel to rebuild
 * @param {object[]} entries - history entries from HistoryController.getEntries()
 */
function showHistoryMode(panel, entries) {
  panel._state = 'history';
  panel._historyEntries = entries;
  panel._historySelectedIndex = 0;
  panel.setLabel(' {bold}Deleted Rules History{/bold} ');
  _destroyAllChildren(panel);
  panel._historyItems = [];

  // Small section header inside the panel body.
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

  // One 2-row-tall item per history entry, index 0 highlighted.
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

/**
 * Moves the history selection highlight to `index`, clamped to valid bounds.
 * The user clicks ↑/↓ in history mode, and index.js calls this.
 * @param {object} panel - right panel in 'history' state
 * @param {number} index  - desired 0-based item index
 */
function selectHistoryItem(panel, index) {
  if (!panel._historyItems || panel._historyItems.length === 0) return;
  const max = panel._historyItems.length - 1;
  if (index < 0) index = 0;
  if (index > max) index = max;
  panel._historySelectedIndex = index;

  // Re-stripe: selected is one color, others alternate.
  panel._historyItems.forEach((item, i) => {
    item.style.bg = i === index ? '#1a5276' : (i % 2 === 0 ? '#1a1a2e' : '#16213e');
  });
}

/**
 * Returns the currently selected history index (0-based).
 * @param {object} panel - right panel in 'history' state
 * @returns {number}
 */
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
