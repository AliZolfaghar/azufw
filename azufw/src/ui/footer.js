'use strict';

const blessed = require('neo-blessed');

function createFooter(screen) {
  const footer = blessed.box({
    parent: screen,
    bottom: 0,
    left: 0,
    width: '100%',
    height: 3,
    tags: true,
    style: {
      fg: '#d5d8dc',
      bg: '#1a252f',
    },
    content: '',
  });

  footer.updateContent = function (status, processing) {
    if (processing) {
      footer.setContent(` {center}{yellow-fg}⏳ Processing...{/yellow-fg}{/center}`);
    } else {
      const statusColor = status === 'active' ? '{green-fg}● Active{/green-fg}' : '{red-fg}● Inactive{/red-fg}';
      footer.setContent(` Status: ${statusColor}  │  A:Add  Enter:Edit  D:Delete  R:Refresh  H:History  Q:Quit`);
    }
    screen.render();
  };

  footer.updateContent('active', false);

  return footer;
}

module.exports = { createFooter };
