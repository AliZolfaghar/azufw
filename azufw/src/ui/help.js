'use strict';

const blessed = require('neo-blessed');

function showHelp(screen, ruleCtrl) {
  const overlay = blessed.box({
    parent: screen,
    top: 'center',
    left: 'center',
    width: 60,
    height: 24,
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
    content: '{bold}{cyan-fg}AZUFW — Keyboard Shortcuts{/cyan-fg}{/bold}',
    tags: true,
    align: 'center',
    valign: 'middle',
    style: { bg: '#1a5276' },
  });

  blessed.box({
    parent: overlay,
    top: 3,
    left: 2,
    right: 2,
    bottom: 2,
    content: [
      '',
      ' {bold}{white-fg}Navigation{/white-fg}{/bold}',
      '   {yellow-fg}Up/Down{/yellow-fg}      Navigate rules / form fields',
      '   {yellow-fg}Tab{/yellow-fg}          Next field (edit/add mode)',
      '   {yellow-fg}Shift+Tab{/yellow-fg}   Previous field (edit/add mode)',
      '   {yellow-fg}Space{/yellow-fg}       Cycle choices (dropdown fields)',
      '',
      ' {bold}{white-fg}Actions{/white-fg}{/bold}',
      '   {yellow-fg}Enter{/yellow-fg}       Edit selected rule',
      '   {yellow-fg}A{/yellow-fg}           Add new rule',
      '   {yellow-fg}P{/yellow-fg}           Add preset rule (common services)',
      '   {yellow-fg}Delete{/yellow-fg}     Delete rule (with confirmation)',
      '   {yellow-fg}R{/yellow-fg}           Refresh rules',
      '',
      ' {bold}{white-fg}Form (edit/add mode){/white-fg}{/bold}',
      '   {yellow-fg}Ctrl+S{/yellow-fg}     Save rule',
      '   {yellow-fg}Escape{/yellow-fg}     Cancel / go back',
      '',
      ' {bold}{white-fg}Other{/white-fg}{/bold}',
      '   {yellow-fg}H{/yellow-fg}           View deleted rules history',
      '   {yellow-fg}?{/yellow-fg}           Show this help',
      '   {yellow-fg}Q / Ctrl+C{/yellow-fg}  Quit',
    ].join('\n'),
    tags: true,
    wrap: true,
  });

  blessed.box({
    parent: overlay,
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    content: '{center}{gray-fg}Press any key to close{/gray-fg}{/center}',
    tags: true,
  });

  ruleCtrl._modalActive = true;
  screen.render();

  const dismiss = () => {
    ruleCtrl._modalActive = false;
    overlay.hide();
    const idx = screen.children.indexOf(overlay);
    if (idx !== -1) screen.children.splice(idx, 1);
    overlay.destroy();
    screen.render();
  };

  const onKey = () => {
    screen.removeListener('keypress', onKey);
    dismiss();
  };

  screen.on('keypress', onKey);
}

module.exports = { showHelp };
