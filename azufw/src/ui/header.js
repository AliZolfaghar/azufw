'use strict';

const blessed = require('neo-blessed');

function createHeader(screen) {
  const header = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    height: 5,
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
