'use strict';

/**
 * ============================================================================
 * HEADER  —  top status bar with the app title
 * ----------------------------------------------------------------------------
 * A static 5-row bar centered at the top. It never changes during runtime.
 * NOTE: `src/ui/right-panel.js`'s content assumes the header is exactly 5 rows
 * tall (the panels anchor at top: 5).
 * ============================================================================
 */

const blessed = require('neo-blessed');

/**
 * Creates the top title header.
 * @param {object} screen - the blessed screen
 * @returns {object} the blessed header box
 */
function createHeader(screen) {
  const header = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    height: 5,          // panels below start at top: 5 to sit under this
    tags: true,
    style: {
      fg: '#ffffff',
      bg: '#1a5276',
      bold: true,
    },
    content: '{bold}{cyan-fg}AZUFW v1.0.0 — UFW Firewall Manager{/cyan-fg}{/bold}',
    align: 'center',
    valign: 'middle',
  });

  return header;
}

module.exports = { createHeader };
