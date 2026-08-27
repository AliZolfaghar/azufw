'use strict';

/**
 * ============================================================================
 * LEFT PANEL  —  rule list in the left half of the screen
 * ----------------------------------------------------------------------------
 * A blessed `list` widget whose items are color-tagged strings.
 *
 * Important layout convention: the list is NOT just the rules. Rows 0 and 1
 * are the column header and divider, so a rule at list row N corresponds to
 * rule index (N - LIST_HEADER_OFFSET). That offset trick keeps the header
 * pinned at the top while blessed scrolls only the rule rows.
 * ============================================================================
 */

const blessed = require('neo-blessed');

/**
 * Creates the left rule-list panel.
 * Anchored to the left half of the screen between the header (top 5)
 * and footer (bottom 3).
 * @param {object} screen - the blessed screen
 * @returns {object} the blessed list element
 */
function createLeftPanel(screen) {
  const list = blessed.list({
    parent: screen,
    label: ' {bold}Rules{/bold} ',
    top: 5,          // below the 5-row header
    left: 0,
    width: '50%',
    bottom: 3,       // above the 3-row footer
    border: { type: 'line' },
    style: {
      border: { fg: '#5dade2' },
      label: { fg: '#5dade2' },
      selected: { bg: '#1a5276', fg: '#ffffff', bold: true },
      item: { fg: '#d5d8dc' },
      focus: { border: { fg: '#2e86c1' } },
    },
    tags: true,   // ← lets rows embed {color-fg}...{/color-fg} markup
    keys: true,
    vi: false,
    mouse: true,
  });

  return list;
}

/**
 * Row index offset because of the header/divider placeholder rows at the top.
 * Also used by controllers/rule-controller.js to translate list rows ↔ rule indexes.
 * @type {number}
 */
const LIST_HEADER_OFFSET = 2;

/**
 * Repaints the whole rule list including the pinned header/divider rows.
 * Each rule is color-coded: yellow = critical SSH, green = ALLOW, red = DENY/REJECT.
 *
 * @param {object} list   - the blessed list created by createLeftPanel()
 * @param {Rule[]} rules  - the rules to display
 * @param {number} sshPort - the SSH port, rules on it are flagged critical
 */
function renderRuleList(list, rules, sshPort) {
  const header = '{bold}{cyan-fg} #   Action   Port    Proto  From             To               Ver  Comment{/cyan-fg}{/bold}';
  const divider = '{gray-fg}─── ──────── ─────── ────── ──────────────── ──────────────── ─── ──────────────{/gray-fg}';

  const items = rules.map(rule => {
    const isCritical = rule.port && parseInt(rule.port, 10) === sshPort;
    rule.isCritical = isCritical;

    // Choose the row color based on action + criticality.
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

    // Pad every column to a fixed width so rows line up vertically.
    const num = String(rule.number).padStart(3);
    const action = rule.action.padEnd(8);
    const port = (rule.port || '-').padEnd(7);
    const proto = rule.protocol.toUpperCase().padEnd(6);
    const from = (rule.from || '-').substring(0, 16).padEnd(16);  // truncate long CIDRs
    const to = (rule.to || '-').substring(0, 16).padEnd(16);
    const ver = rule.getIpVersion().padEnd(3);
    const comment = (rule.comment || '-').substring(0, 14).padEnd(14);

    return `${colorPrefix}${num}  ${action} ${port} ${proto} ${from} ${to} ${ver}  ${comment}${colorSuffix}`;
  });

  list.setItems([header, divider, ...items]);
}

module.exports = { createLeftPanel, renderRuleList };
