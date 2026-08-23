'use strict';

const blessed = require('neo-blessed');

function createScreen() {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'AZUFW — UFW Firewall Manager',
    fullUnicode: false,
    mouse: true,
    ignoreLocked: ['C-s', 'tab', 'up', 'down', 'S-tab'],
  });

  return screen;
}

module.exports = { createScreen };
