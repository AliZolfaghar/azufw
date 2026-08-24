'use strict';

const blessed = require('neo-blessed');

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

    blessed.box({
      parent: overlay,
      top: 4,
      left: 1,
      right: 1,
      height: 3,
      content: '{center}{bold}{white-fg}UFW Firewall Manager{/white-fg}{/bold}{/center}',
      tags: true,
    });

    blessed.box({
      parent: overlay,
      top: 7,
      left: 1,
      right: 1,
      height: 1,
      content: '{center}{gray-fg}─────────────────────────────────────────{/gray-fg}{/center}',
      tags: true,
    });

    blessed.box({
      parent: overlay,
      top: 8,
      left: 1,
      right: 1,
      height: 4,
      content: '{center}{white-fg}A terminal-based interface for managing your Linux{/white-fg}\n{center}{white-fg}UFW firewall rules. Easily add, edit, delete, and{/white-fg}\n{center}{white-fg}monitor firewall rules with a user-friendly TUI.{/white-fg}',
      tags: true,
    });

    blessed.box({
      parent: overlay,
      top: 12,
      left: 1,
      right: 1,
      height: 4,
      content: '{center}{yellow-fg}⚠ This tool modifies firewall rules.{/yellow-fg}\n{center}{yellow-fg}Root (sudo) privileges are required to apply changes.{/yellow-fg}\n{center}{gray-fg}Always ensure you have console access before modifying{/gray-fg}\n{center}{gray-fg}SSH-related rules to avoid locking yourself out.{/gray-fg}',
      tags: true,
    });

    blessed.box({
      parent: overlay,
      top: 16,
      left: 1,
      right: 1,
      height: 1,
      content: '{center}{gray-fg}─────────────────────────────────────────{/gray-fg}{/center}',
      tags: true,
    });

    blessed.box({
      parent: overlay,
      top: 17,
      left: 1,
      right: 1,
      height: 3,
      content: '{center}{cyan-fg}Author: Ali Zolfaghar{/cyan-fg}\n{center}{cyan-fg}Email: azolfaghar@gmail.com{/cyan-fg}\n{center}{cyan-fg}GitHub: https://github.com/AliZolfaghar/azufw{/cyan-fg}',
      tags: true,
    });

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

    const dismiss = () => {
      overlay.destroy();
      screen.render();
      resolve();
    };

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
