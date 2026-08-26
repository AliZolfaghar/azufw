'use strict';

const blessed = require('neo-blessed');
const { getRuleTraffic } = require('../cli/ufw-executor');

function _fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n < 1024 ** 4) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  return `${(n / 1024 ** 4).toFixed(2)} TB`;
}

function _fmtNum(n) {
  return n.toLocaleString('en-US');
}

function showStatsPopup(screen, ruleCtrl, rule) {
  const overlay = blessed.box({
    parent: screen,
    top: 'center',
    left: 'center',
    width: 54,
    height: 18,
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
    content: `{bold}{cyan-fg}Live Traffic — Rule #${rule.number}{/cyan-fg}{/bold}`,
    tags: true,
    align: 'center',
    valign: 'middle',
    style: { bg: '#1a5276' },
  });

  const body = blessed.box({
    parent: overlay,
    top: 3,
    left: 1,
    right: 1,
    bottom: 2,
    tags: true,
  });

  blessed.box({
    parent: overlay,
    bottom: 0,
    left: 1,
    right: 1,
    height: 1,
    content: '{center}{gray-fg}Esc/Q:Close · refreshes every 1s{/gray-fg}{/center}',
    tags: true,
  });

  ruleCtrl._modalActive = true;
  screen.render();

  let prev = null;
  let closed = false;
  let tickCount = 0;

  function sample() {
    if (closed) return;
    const res = getRuleTraffic(rule.action, rule.port, rule.protocol);
    let content;

    if (!res.success) {
      content = `\n {red-fg}${res.output}{/red-fg}\n\n {gray-fg}Tip: run with sudo to read counters.{/gray-fg}`;
      body.setContent(content);
      screen.render();
      return;
    }

    const s = { pkts: res.pkts, bytes: res.bytes };
    let ratePkts = '—';
    let rateBytes = '—';
    if (prev) {
      ratePkts = `${_fmtNum(Math.max(0, s.pkts - prev.pkts))} pkt/s`;
      rateBytes = `${_fmtBytes(Math.max(0, s.bytes - prev.bytes))}/s`;
    }
    prev = s;
    tickCount += 1;

    content = [
      ` {gray-fg}Rule{/gray-fg}        ${rule.action} ${rule.port || 'any'}/${rule.protocol.toUpperCase()}`,
      '',
      ` {bold}{cyan-fg}TOTALS{/cyan-fg}{/bold}`,
      `   Packets     {white-fg}${_fmtNum(s.pkts)}{/white-fg}`,
      `   Data        {white-fg}${_fmtBytes(s.bytes)}{/white-fg}`,
      '',
      ` {bold}{cyan-fg}LIVE RATE{/cyan-fg}{/bold}`,
      `   Packets     {green-fg}${ratePkts}{/green-fg}`,
      `   Bandwidth   {green-fg}${rateBytes}{/green-fg}`,
      '',
      ` {gray-fg}${tickCount === 1 ? 'sampling…' : `uptime ${tickCount}s`}{/gray-fg}`,
    ].join('\n');

    body.setContent(content);
    screen.render();
  }

  sample();
  const timer = setInterval(sample, 1000);

  const dismiss = () => {
    if (closed) return;
    closed = true;
    clearInterval(timer);
    overlay.hide();
    const idx = screen.children.indexOf(overlay);
    if (idx !== -1) screen.children.splice(idx, 1);
    overlay.destroy();
    ruleCtrl._modalActive = false;
    screen.render();
  };

  const onKey = (ch, key) => {
    if (!key) return;
    if (key.name === 'escape' || key.name === 'q') {
      dismiss();
    }
  };

  screen.on('keypress', onKey);
}

module.exports = { showStatsPopup };
