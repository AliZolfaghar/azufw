'use strict';

/**
 * ============================================================================
 * PRESET POPUP  —  quick Add from a list of common services
 * ----------------------------------------------------------------------------
 * Opened via the `P` key. Lists every PRESET grouped under a static header and
 * divider. The user picks one with Enter; the selection is passed to the caller
 * (controllers/rule-controller#enterAddModeWithPreset) which fills the Add form.
 *
 * On selection (real or Esc) the overlay is destroyed and `_modalActive` is
 * cleared so the rest of the app resumes control.
 * ============================================================================
 */

const blessed = require('neo-blessed');

/**
 * The preset catalogue shown in the list. All presets are ALLOW rules;
 * 'Custom' opens an EMPTY Add form, effectively just a shortcut to A.
 * @type {Array<{name:string, action:string, port:string, protocol:string,
 *               from:string, to:string, comment:string}>}
 */
const PRESETS = [
  { name: 'SSH', action: 'ALLOW', port: '22', protocol: 'tcp', from: 'any', to: 'any', comment: 'SSH access' },
  { name: 'HTTP', action: 'ALLOW', port: '80', protocol: 'tcp', from: 'any', to: 'any', comment: 'Web server' },
  { name: 'HTTPS', action: 'ALLOW', port: '443', protocol: 'tcp', from: 'any', to: 'any', comment: 'Secure web server' },
  { name: 'MySQL', action: 'ALLOW', port: '3306', protocol: 'tcp', from: 'any', to: 'any', comment: 'MySQL database' },
  { name: 'PostgreSQL', action: 'ALLOW', port: '5432', protocol: 'tcp', from: 'any', to: 'any', comment: 'PostgreSQL database' },
  { name: 'SQL Server', action: 'ALLOW', port: '1433', protocol: 'tcp', from: 'any', to: 'any', comment: 'MS SQL Server' },
  { name: 'MongoDB', action: 'ALLOW', port: '27017', protocol: 'tcp', from: 'any', to: 'any', comment: 'MongoDB database' },
  { name: 'Redis', action: 'ALLOW', port: '6379', protocol: 'tcp', from: 'any', to: 'any', comment: 'Redis cache' },
  { name: 'FTP', action: 'ALLOW', port: '21', protocol: 'tcp', from: 'any', to: 'any', comment: 'FTP server' },
  { name: 'SMTP', action: 'ALLOW', port: '25', protocol: 'tcp', from: 'any', to: 'any', comment: 'Mail server' },
  { name: 'DNS', action: 'ALLOW', port: '53', protocol: 'udp', from: 'any', to: 'any', comment: 'DNS server' },
  { name: 'Docker', action: 'ALLOW', port: '2376', protocol: 'tcp', from: 'any', to: 'any', comment: 'Docker daemon' },
  { name: 'Nginx', action: 'ALLOW', port: '8080', protocol: 'tcp', from: 'any', to: 'any', comment: 'Nginx reverse proxy' },
  { name: 'Apache', action: 'ALLOW', port: '8080', protocol: 'tcp', from: 'any', to: 'any', comment: 'Apache web server' },
  { name: 'Tomcat', action: 'ALLOW', port: '8443', protocol: 'tcp', from: 'any', to: 'any', comment: 'Tomcat server' },
  { name: 'RDP', action: 'ALLOW', port: '3389', protocol: 'tcp', from: 'any', to: 'any', comment: 'Remote Desktop' },
  { name: 'Custom', action: 'ALLOW', port: '', protocol: 'tcp', from: 'any', to: 'any', comment: '' },
];

/**
 * Opens the preset-selection popup.
 * @param {object} screen   - the blessed screen
 * @param {object} ruleCtrl - the RuleController (mutated `_modalActive`)
 * @param {function(preset: object)} onSelect - called with the chosen preset;
 *                           the caller then opens the Add form filled with it.
 */
function showPresetPopup(screen, ruleCtrl, onSelect) {
  // Row indexes before PRESETS[0]: the list begins with a header row + divider.
  const ROW_OFFSET = 2; // (index 0 = header, index 1 = divider)

  const overlay = blessed.box({
    parent: screen,
    top: 'center',
    left: 'center',
    width: '45%',
    height: 24,
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
    content: '{bold}{cyan-fg}Select Preset Rule{/cyan-fg}{/bold}',
    tags: true,
    align: 'center',
    valign: 'middle',
    style: { bg: '#1a5276' },
  });

  // The browsable list of presets
  const list = blessed.list({
    parent: overlay,
    top: 4,
    left: 1,
    right: 1,
    bottom: 2,
    tags: true,
    keys: true,
    vi: false,
    mouse: true,
    style: {
      selected: { bg: '#1a5276', fg: '#ffffff', bold: true },
      item: { fg: '#d5d8dc' },
    },
  });

  // Render each preset as one padded row.
  const items = PRESETS.map(p => {
    const port = p.port || 'any';
    const proto = p.protocol.toUpperCase();
    return ` ${p.name.padEnd(14)} ${p.action.padEnd(7)} ${port.padEnd(6)} ${proto.padEnd(5)} ${p.comment}`;
  });

  const header = '{bold}{cyan-fg} Name           Action   Port    Proto  Description{/cyan-fg}{/bold}';
  const divider = '{gray-fg}────────────── ─────── ─────── ───── ──────────────{/gray-fg}';

  list.setItems([header, divider, ...items]);
  list.select(0);

  // Enter on a preset selects it → destroy popup and pass along.
  list.on('select', (item, index) => {
    if (index < ROW_OFFSET) return; // clicking the header/divider does nothing
    const preset = PRESETS[index - ROW_OFFSET];
    overlay.hide();
    const idx = screen.children.indexOf(overlay);
    if (idx !== -1) screen.children.splice(idx, 1);
    overlay.destroy();
    ruleCtrl._modalActive = false;
    screen.render();
    onSelect(preset);
  });

  // Esc is handled separately so the user can abandon selection.
  list.key(['escape'], () => {
    screen.removeListener('keypress', onKey);
    dismiss();
  });

  // Static hint footer
  blessed.box({
    parent: overlay,
    bottom: 0,
    left: 1,
    right: 1,
    height: 2,
    content: '{center}{yellow-fg}↑↓:Navigate  Enter:Select  Esc:Cancel{/yellow-fg}{/center}',
    tags: true,
  });

  // While open, swallow global keys.
  ruleCtrl._modalActive = true;
  list.focus();
  screen.render();

  // Fallback close handler (covers Esc/q even if the list didn't grab it).
  const dismiss = () => {
    overlay.hide();
    const idx = screen.children.indexOf(overlay);
    if (idx !== -1) screen.children.splice(idx, 1);
    overlay.destroy();
    ruleCtrl._modalActive = false;
    screen.render();
  };

  const onKey = (ch, key) => {
    if (!ruleCtrl._modalActive) return;
    if (!key) return;
    if (key.name === 'escape' || key.name === 'q') {
      screen.removeListener('keypress', onKey);
      dismiss();
    }
  };

  screen.on('keypress', onKey);
}

module.exports = { showPresetPopup, PRESETS };
