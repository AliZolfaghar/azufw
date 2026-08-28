'use strict';

/**
 * ============================================================================
 * AZUFW  —  application entry point & global keyboard controller
 * ----------------------------------------------------------------------------
 * This is the glue layer. It:
 *   1. Validates environment (sudo, UFW).
 *   2. Builds every screen component.
 *   3. Registers ALL global (screen-level) key bindings.
 *   4. Delegates the keys a popup needs to that popup.
 *
 * View-state protocol used throughout:
 *   ruleCtrl._modalActive  — true while ANY popup is open (form/help/error/
 *                            preset/confirm/stats). Every global handler bails
 *                            out at the top when this is true, EXCEPT the form
 *                            delegator at the bottom which routes keys into
 *                            formPopup.handleKey().
 *   rightPanel._state     — 'view' | 'history' (see src/ui/right-panel.js).
 * ============================================================================
 */

const { checkSudo, bootstrapUfw } = require('./cli/checker');
const { isMockMode, getMockMessage } = require('./utils/platform');
const { detectSshPort } = require('./utils/ssh-detector');
const { createScreen } = require('./ui/screen');
const { createHeader } = require('./ui/header');
const { createFooter } = require('./ui/footer');
const { createLeftPanel, renderRuleList } = require('./ui/left-panel');
const { createRightPanel, showViewMode, showHistoryMode, selectHistoryItem, getSelectedHistoryIndex } = require('./ui/right-panel');
const { showWelcome } = require('./ui/welcome');
const { showHelp } = require('./ui/help');
const { showPresetPopup } = require('./ui/preset-popup');
const { showStatsPopup } = require('./ui/stats-popup');
const ufwExecutor = require('./cli/ufw-executor');
const RuleController = require('./controllers/rule-controller');
const HistoryController = require('./controllers/history-controller');

async function main() {
  // --- 1. Environment -----------------------------------------------------

  // Platform check (Windows only → tells the user we're faking).
  if (isMockMode) {
    console.log(getMockMessage());
  }

  // Root check (Linux only) — exits if not root.
  checkSudo();

  // SSH port is used to flag critical rules and block their deletion.
  const sshPort = detectSshPort();

  // Make sure UFW exists+is active before we draw anything.
  const ufwInfo = await bootstrapUfw();

  // --- 2. Build UI -------------------------------------------------------

  const screen = createScreen();

  // Welcome popup that the user must accept before we load any rules.
  await showWelcome(screen);

  const header = createHeader(screen);
  const footer = createFooter(screen);
  const leftPanel = createLeftPanel(screen);
  const rightPanel = createRightPanel(screen);

  // --- 3. Controllers ----------------------------------------------------

  const historyCtrl = new HistoryController();
  const ruleCtrl = new RuleController(leftPanel, rightPanel, header, footer, screen, historyCtrl, sshPort, ufwInfo.status);

  // Initial rule fetch + first paint.
  await ruleCtrl.loadRules();

  // --- 4. Global keybindings -----------------------------------------------
  // Every handler starts with `if (ruleCtrl._modalActive) return;` so popups
  // own the screen while they're open. Exceptions: the form delegator below,
  // which routes keys to the form popup instead.

  // ↑/↓ (rows) — handled at the SCREEN level, not the list, so both
  // view mode AND history mode react the same way.
  leftPanel.on('select item', (item, index) => {
    if (ruleCtrl._modalActive) return;
    ruleCtrl.handleListSelect(index);
  });

  screen.key(['up'], () => {
    if (ruleCtrl._modalActive) return;
    if (rightPanel._state === 'view') {
      ruleCtrl.moveUp();
    } else if (rightPanel._state === 'history') {
      const idx = getSelectedHistoryIndex(rightPanel);
      selectHistoryItem(rightPanel, idx - 1);
      screen.render();
    }
  });

  screen.key(['down'], () => {
    if (ruleCtrl._modalActive) return;
    if (rightPanel._state === 'view') {
      ruleCtrl.moveDown();
    } else if (rightPanel._state === 'history') {
      const idx = getSelectedHistoryIndex(rightPanel);
      selectHistoryItem(rightPanel, idx + 1);
      screen.render();
    }
  });

  screen.key(['enter'], () => {
    if (ruleCtrl._modalActive) return;
    if (rightPanel._state === 'view') {
      // View mode: Enter edits the selected rule.
      ruleCtrl.enterEditMode();
    } else if (rightPanel._state === 'history') {
      // History mode: Enter restores the highlighted deleted rule back to UFW.
      const idx = getSelectedHistoryIndex(rightPanel);
      const entries = historyCtrl.getEntries();
      if (idx >= 0 && idx < entries.length) {
        const restoredRule = historyCtrl.restoreEntry(idx);
        if (restoredRule) {
          ufwExecutor.addRule(restoredRule);
          ruleCtrl.loadRules();
        }
      }
    }
  });

  screen.key(['escape'], () => {
    if (ruleCtrl._modalActive) return;
    // Esc in history mode goes back to a normal rule view.
    if (rightPanel._state === 'history') {
      showViewMode(rightPanel, ruleCtrl.selectedRule, sshPort);
      screen.render();
    }
  });

  screen.key(['a'], () => {
    if (ruleCtrl._modalActive) return;
    if (rightPanel._state === 'view' || rightPanel._state === 'history') {
      ruleCtrl.enterAddMode();
    }
  });

  // P: preset rules popup
  screen.key(['p'], () => {
    if (ruleCtrl._modalActive) return;
    if (rightPanel._state === 'view' || rightPanel._state === 'history') {
      showPresetPopup(screen, ruleCtrl, (preset) => {
        ruleCtrl.enterAddModeWithPreset(preset);
      });
    }
  });

  screen.key(['r'], () => {
    if (ruleCtrl._modalActive) return;
    if (rightPanel._state === 'view' || rightPanel._state === 'history') {
      ruleCtrl.loadRules();
    }
  });

  screen.key(['q', 'C-c'], () => {
    if (ruleCtrl._modalActive) return;
    return process.exit(0);
  });

  // H: swap right panel to history view.
  screen.key(['h'], () => {
    if (ruleCtrl._modalActive) return;
    if (rightPanel._state === 'view') {
      const entries = historyCtrl.getEntries();
      showHistoryMode(rightPanel, entries);
      screen.render();
    }
  });

  // Delete key: rule deletion (guarded: critical SSH rules can't be deleted).
  screen.key(['delete'], () => {
    if (ruleCtrl._modalActive) return;
    if (rightPanel._state === 'view' && ruleCtrl.selectedRule && !ruleCtrl.selectedRule.isCritical) {
      ruleCtrl.confirmDelete();
    }
  });

  // I: live traffic info for selected rule
  screen.key(['i'], () => {
    if (ruleCtrl._modalActive) return;
    if (rightPanel._state === 'view' && ruleCtrl.selectedRule) {
      showStatsPopup(screen, ruleCtrl, ruleCtrl.selectedRule);
    }
  });

  // ?: show help
  screen.key(['?'], () => {
    if (ruleCtrl._modalActive) return;
    showHelp(screen, ruleCtrl);
  });

  // --- Form popup key handler ----------------------------------------------
  // When a form is open, ALL keys route through it (formOverride the screen keys
  // above by intercepting first at the screen level).
  screen.on('keypress', (ch, key) => {
    if (ruleCtrl.formPopup && ruleCtrl.formPopup.active) {
      ruleCtrl.formPopup.handleKey(ch, key);
    }
  });

  // --- 5. First paint -----------------------------------------------------

  screen.render();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
