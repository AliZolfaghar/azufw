'use strict';

const blessed = require('neo-blessed');

function createHeader(screen) {
  const header = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    height: 3,
    tags: true,
    style: {
      fg: '#ffffff',
      bg: '#1a5276',
      bold: true,
    },
    content: '{center}{bold}⚡ AZUFW v1.0.0 — UFW Firewall Manager{/bold}{/center}',
  });

  return header;
}

module.exports = { createHeader };
