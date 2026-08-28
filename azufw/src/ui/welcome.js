'use strict';

/**
 * ============================================================================
 * WELCOME POPUP  —  shown once on startup
 * ----------------------------------------------------------------------------
 * A promise-based popup containing:
 *   • App title
 *   • Description of what the tool does
 *   • Safety warning about firewall modifications + SSH lock-out risk
 *   • Author / email / GitHub links
 *   • A green "Accept and Start" button
 *
 * `src/index.js` awaits this promise before building the real UI — the user
 * cannot interact with the app until they accept (or close the popup).
 * ============================================================================
 */

const blessed = require('neo-blessed');

/**
 * Shows the welcome popup and resolves only once the user has accepted
 * (either by Enter key or by pressing the button).
 * @param {object} screen - the blessed screen
 * @returns {Promise<void>} resolves after the popup is dismissed
 */
function showWelcome(screen) {
  return new Promise((resolve) => {
    const overlay = blessed.box({
      parent: screen,
      top: 'center',
      left: 'center',
      width: '55%',
      height: 27,
      tags: true,
      border: { type: 'line' },
      style: {
        border: { fg: '#5dade2' },
        bg: '#0d1b2a',
      },
    });

    // Title bar
    blessed.box({
      parent: overlay,
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      content: '{bold}{yellow-fg}AZUFW v1.0.0{/yellow-fg}{/bold}',
      tags: true,
      align: 'center',
      valign: 'middle',
      style: { bg: '#1a5276' },
    });

    // App description
    blessed.box({
      parent: overlay,
      top: 4,
      left: 1,
      right: 1,
      height: 3,
      content: '{center}{bold}{white-fg}UFW Firewall Manager{/white-fg}{/bold}{/center}',
      tags: true,
    });

    // Divider
    blessed.box({
      parent: overlay,
      top: 7,
      left: 1,
      right: 1,
      height: 1,
      content: '{center}{gray-fg}─────────────────────────────────────────{/gray-fg}{/center}',
      tags: true,
    });

    // Blurb
    blessed.box({
      parent: overlay,
      top: 8,
      left: 1,
      right: 1,
      height: 4,
      content: '{center}{white-fg}A terminal-based interface for managing your Linux{/white-fg}\n{center}{white-fg}UFW firewall rules. Easily add, edit, delete, and{/white-fg}\n{center}{white-fg}monitor firewall rules with a user-friendly TUI.{/white-fg}',
      tags: true,
    });

    // Safety disclaimer / root requirement — always visible so it can't be missed.
    blessed.box({
      parent: overlay,
      top: 12,
      left: 1,
      right: 1,
      height: 4,
      content: '{center}{yellow-fg}⚠ This tool modifies firewall rules.{/yellow-fg}\n{center}{yellow-fg}Root (sudo) privileges are required to apply changes.{/yellow-fg}\n{center}{gray-fg}Always ensure you have console access before modifying{/gray-fg}\n{center}{gray-fg}SSH-related rules to avoid locking yourself out.{/gray-fg}',
      tags: true,
    });

    // Divider
    blessed.box({
      parent: overlay,
      top: 16,
      left: 1,
      right: 1,
      height: 1,
      content: '{center}{gray-fg}─────────────────────────────────────────{/gray-fg}{/center}',
      tags: true,
    });

    // Author info
    blessed.box({
      parent: overlay,
      top: 17,
      left: 1,
      right: 1,
      height: 3,
      content: '{center}{cyan-fg}Author: Ali Zolfaghar{/cyan-fg}\n{center}{cyan-fg}Email: azolfaghar@gmail.com{/cyan-fg}\n{center}{cyan-fg}GitHub: https://github.com/AliZolfaghar/azufw{/cyan-fg}',
      tags: true,
    });

    // Accept button
    const acceptBtn = blessed.button({
      parent: overlay,
      bottom: 1,
      left: 'center',
      width: 22,
      height: 3,
      content: ' {green-fg}{bold}Accept and Start{/bold}{/green-fg} ',
      tags: true,
      border: { type: 'line' },
      style: {
        border: { fg: '#27ae60' },
        bg: '#1a5276',
        focus: { bg: '#27ae60' },
      },
    });

    acceptBtn.focus();

    /**
     * Hides + destroys the popup and settles the promise.
     */
    const dismiss = () => {
      overlay.destroy();
      screen.render();
      resolve();
    };

    // Enter anywhere in the popup behaves like clicking the button.
    acceptBtn.on('press', dismiss);
    screen.onceKey(['enter'], () => {
      if (overlay.parent) dismiss();
    });
    screen.onceKey(['return'], () => {
      if (overlay.parent) dismiss();
    });

    screen.render();
  });
}

module.exports = { showWelcome };
