'use strict';

/**
 * ============================================================================
 * STATS POPUP  —  live traffic monitor for a single rule
 * ----------------------------------------------------------------------------
 * Rendered when the user presses `I` while a rule is selected in the left panel.
 *
 * Every second we re-read the rule's iptables counters via
 * cli/ufw-executor.getRuleTraffic(). Each new sample is compared with the
 * previous one to derive a live packets/second and bytes/second figure.
 *
 * Closing happens on Esc / Q and is done through a keypress listener that we
 * register ourselves and remove in dismiss() — the popup fully owns its lifecycle.
 * ============================================================================
 */

const blessed = require('neo-blessed');
const { getRuleTraffic } = require('../cli/ufw-executor');

/** Human-friendly size formatter: B, KB, MB, GB, TB */
function _fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n < 1024 ** 4) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  return `${(n / 1024 ** 4).toFixed(2)} TB`;
}

/** Thousands-separated integer formatter (e.g. 12,345) */
function _fmtNum(n) {
  return n.toLocaleString('en-US');
}

/**
 * Opens the live-traffic popup for the given rule and keeps it updating
 * until the user dismisses it.
 *
 * @param {object}   screen   - the blessed screen
 * @param {object}   ruleCtrl - the RuleController (used to set _modalActive
 *                             so other global keybindings are suppressed)
 * @param {Rule}     rule    - the rule to monitor
 */
function showStatsPopup(screen, ruleCtrl, rule) {
  // --- Outer framed box that hosts the title bar, body and footer ---------------
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

  // Title bar
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

  // Body region where totals + live rates are redrawn every second
  const body = blessed.box({
    parent: overlay,
    top: 3,
    left: 1,
    right: 1,
    bottom: 2,
    tags: true,
  });

  // Static hint footer
  blessed.box({
    parent: overlay,
    bottom: 0,
    left: 1,
    right: 1,
    height: 1,
    content: '{center}{gray-fg}Esc/Q:Close · refreshes every 1s{/gray-fg}{/center}',
    tags: true,
  });

  // While the popup is open, swallow global keys so the user can't e.g. quit
  // from underneath it.
  ruleCtrl._modalActive = true;
  screen.render();

  let prev = null;      // previous sample, used for delta → rate calculation
  let closed = false;   // guard so we don't keep working after dismissal
  let tickCount = 0;   // how many samples have been collected so far

  /**
   * One sample cycle: read counters → compute deltas → redraw body.
   * Called immediately and then every 1000 ms.
   */
  function sample() {
    if (closed) return;

    const res = getRuleTraffic(rule.action, rule.port, rule.protocol);
    let content;

    // Counter read failed (e.g. iptables unavailable) → show the error inline.
    if (!res.success) {
      content = `\n {red-fg}${res.output}{/red-fg}\n\n {gray-fg}Tip: run with sudo to read counters.{/gray-fg}`;
      body.setContent(content);
      screen.render();
      return;
    }

    const s = { pkts: res.pkts, bytes: res.bytes };

    // Rates only appear from the second sample onward (need two points for a delta).
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

  /**
   * Permanently closes the popup: stops the interval and removes both the overlay
   * and our keypress listener, restoring normal control flow to the app.
   */
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

  // Popup-level keys: any key closes (handled below), Esc/Q explicitly.
  const onKey = (ch, key) => {
    if (!key) return;
    if (key.name === 'escape' || key.name === 'q') {
      dismiss();
    }
  };

  screen.on('keypress', onKey);
}

module.exports = { showStatsPopup };
