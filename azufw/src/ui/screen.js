'use strict';

/**
 * ============================================================================
 * SCREEN  —  global neo-blessed terminal instance
 * ----------------------------------------------------------------------------
 * Owns the entire layout. Everything else is attached to this screen.
 * The `ignoreLocked` array is important: neo-blessed "locks" a widget while it
 * is focused, suppressing certain keys sent elsewhere. But we handle some keys
 * globally (e.g. Ctrl+S to save a form even while a textbox is focused), so we
 * white-list them here to make sure they still reach the global key handlers.
 * ============================================================================
 */

const blessed = require('neo-blessed');

/**
 * Creates the single blessed screen for the app.
 * @returns {object} the blessed screen instance
 */
function createScreen() {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'AZUFW — UFW Firewall Manager',
    fullUnicode: false,
    mouse: true,
    // Keys we keep global even when a widget is focused and "locked":
    ignoreLocked: ['C-s', 'tab', 'up', 'down', 'S-tab'],
  });

  return screen;
}

module.exports = { createScreen };
