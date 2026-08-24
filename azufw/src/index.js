'use strict';

const { checkSudo, bootstrapUfw } = require('./cli/checker');
const { isMockMode, getMockMessage } = require('./utils/platform');
const { detectSshPort } = require('./utils/ssh-detector');
const { createScreen } = require('./ui/screen');
const { createHeader } = require('./ui/header');
const { createFooter } = require('./ui/footer');
const { createLeftPanel, renderRuleList } = require('./ui/left-panel');
const { createRightPanel, showViewMode, showEditMode, showHistoryMode, getFormValues, cycleChoice, _highlightField, selectHistoryItem, getSelectedHistoryIndex } = require('./ui/right-panel');
const { showWelcome } = require('./ui/welcome');
const ufwExecutor = require('./cli/ufw-executor');
const RuleController = require('./controllers/rule-controller');
const HistoryController = require('./controllers/history-controller');

async function main() {
  // Platform check
  if (isMockMode) {
    console.log(getMockMessage());
  }

  // Check sudo (Linux only)
  checkSudo();

  // Detect SSH port
  const sshPort = detectSshPort();

  // Bootstrap UFW
  const ufwInfo = await bootstrapUfw();

  // Create screen
  const screen = createScreen();

  // Show welcome/acceptance popup
  await showWelcome(screen);

  // Create UI components
  const header = createHeader(screen);
  const footer = createFooter(screen);
  const leftPanel = createLeftPanel(screen);
  const rightPanel = createRightPanel(screen);

  // Controllers
  const historyCtrl = new HistoryController();
  const ruleCtrl = new RuleController(leftPanel, rightPanel, header, footer, screen, historyCtrl, sshPort, ufwInfo.status);

  // Load initial rules
  await ruleCtrl.loadRules();

  // --- Key bindings ---

  // Up/Down: navigate rules
  leftPanel.on('select item', (item, index) => {
    if (ruleCtrl._modalActive) return;
    ruleCtrl.handleListSelect(index);
  });

  // Global key bindings
  screen.key(['up'], () => {
    if (ruleCtrl._modalActive) return;
    if (rightPanel._state === 'view') {
      ruleCtrl.moveUp();
    } else if (rightPanel._state === 'edit' || rightPanel._state === 'add') {
      ruleCtrl.tabFieldBack();
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
    } else if (rightPanel._state === 'edit' || rightPanel._state === 'add') {
      ruleCtrl.tabField();
    } else if (rightPanel._state === 'history') {
      const idx = getSelectedHistoryIndex(rightPanel);
      selectHistoryItem(rightPanel, idx + 1);
      screen.render();
    }
  });

  screen.key(['enter'], () => {
    if (ruleCtrl._modalActive) return;
    if (rightPanel._state === 'view') {
      ruleCtrl.enterEditMode();
    } else if (rightPanel._state === 'history') {
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
    if (rightPanel._state === 'edit' || rightPanel._state === 'add') {
      ruleCtrl._handleCancel();
    } else if (rightPanel._state === 'history') {
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

  screen.key(['r'], () => {
    if (ruleCtrl._modalActive) return;
    if (rightPanel._state === 'view' || rightPanel._state === 'history') {
      ruleCtrl.loadRules();
    }
  });

  screen.key(['q', 'C-c'], () => {
    if (ruleCtrl._modalActive) return;
    if (rightPanel._state === 'edit' || rightPanel._state === 'add') return;
    return process.exit(0);
  });

  // Tab: move between form fields
  screen.key(['tab'], () => {
    if (ruleCtrl._modalActive) return;
    if (rightPanel._state === 'edit' || rightPanel._state === 'add') {
      ruleCtrl.tabField();
    }
  });

  // Shift+Tab: move between form fields backwards
  screen.key(['S-tab'], () => {
    if (ruleCtrl._modalActive) return;
    if (rightPanel._state === 'edit' || rightPanel._state === 'add') {
      ruleCtrl.tabFieldBack();
    }
  });

  // Space: cycle choices in dropdown fields
  screen.key(['space'], () => {
    if (ruleCtrl._modalActive) return;
    if (rightPanel._state === 'edit' || rightPanel._state === 'add') {
      const fields = ['action', 'port', 'protocol', 'from', 'to', 'comment'];
      const key = fields[rightPanel._currentFieldIndex];
      const widget = rightPanel._formInputs[key];
      if (widget && widget._choices) {
        ruleCtrl.cycleChoiceCurrent();
      }
    }
  });

  // Ctrl+S: save form
  screen.key(['C-s'], () => {
    if (ruleCtrl._modalActive) return;
    if (rightPanel._state === 'edit' || rightPanel._state === 'add') {
      ruleCtrl._handleSave();
    }
  });

  // H: show history
  screen.key(['h'], () => {
    if (ruleCtrl._modalActive) return;
    if (rightPanel._state === 'view') {
      const entries = historyCtrl.getEntries();
      showHistoryMode(rightPanel, entries);
      screen.render();
    }
  });

  // Delete key: delete rule
  screen.key(['delete', 'backspace'], () => {
    if (ruleCtrl._modalActive) return;
    if (rightPanel._state === 'view' && ruleCtrl.selectedRule && !ruleCtrl.selectedRule.isCritical) {
      ruleCtrl.confirmDelete();
    }
  });

  // Render
  screen.render();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
