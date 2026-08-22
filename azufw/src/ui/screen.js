'use strict';

const blessed = require('neo-blessed');

function createScreen() {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'AZUFW — UFW Firewall Manager',
    fullUnicode: false,
  });

  return screen;
}

module.exports = { createScreen };
