'use strict';

/**
 * ============================================================================
 * RULE CONTROLLER  —  central business logic for the main rule screen
 * ----------------------------------------------------------------------------
 * Bridges the UI widgets (left list, right panel, header, footer) and the
 * firewall executor (cli/ufw-executor). Owns:
 *   - loading + selecting rules
 *   - the Add/Edit form lifecycle (mode, save, duplicate checks)
 *   - Delete confirmation and deletion
 *   - error popups that can reopen the form with state preserved
 *   - tracking `_modalActive`, which suppresses ALL global key handlers while a
 *     popup (help/preset/error/delete/stats) is showing.
 * ============================================================================
 */

const blessed = require('neo-blessed');
const ufwExecutor = require('../cli/ufw-executor');
const Rule = require('../models/Rule');
const { renderRuleList } = require('../ui/left-panel');
const { showViewMode } = require('../ui/right-panel');
const { showFormPopup } = require('../ui/form-popup');

/**
 * The left list always holds [header, divider, rule0, rule1, ...].
 * So rule index N lives at list row (N + LIST_HEADER_OFFSET). This constant
 * matches the one in ui/left-panel.js and keeps both files in sync.
 * @type {number}
 */
const LIST_HEADER_OFFSET = 2;

/**
 * Core controller. Instantiated once in src/index.js.
 */
class RuleController {
  /**
   * @param {object} listPanel    - blessed list (left panel)
   * @param {object} rightPanel   - blessed box (right panel)
   * @param {object} headerPanel  - blessed box (top title bar)
   * @param {object} footerPanel  - blessed box (bottom bar)
   * @param {object} screen       - blessed screen
   * @param {object} historyCtrl - HistoryController (persists deleted rules)
   * @param {number} sshPort     - detected SSH port
   * @param {string} ufwStatus   - 'active' | 'inactive'
   */
  constructor(listPanel, rightPanel, headerPanel, footerPanel, screen, historyCtrl, sshPort, ufwStatus) {
    this.list = listPanel;
    this.rightPanel = rightPanel;
    this.headerPanel = headerPanel;
    this.footer = footerPanel;
    this.screen = screen;
    this.historyCtrl = historyCtrl;
    this.sshPort = sshPort || 22;
    this.ufwStatus = ufwStatus || 'active';
    this.rules = [];
    this.selectedRule = null;
    this.isProcessing = false;
    this._modalActive = false;    // true while ANY popup is showing
    this.formPopup = null;        // the currently-open Add/Edit popup (or null)
  }

  /**
   * Fetches all rules from UFW, repaints the list, restores selection.
   * Called at startup, after refresh (R), and after every mutation.
   */
  async loadRules() {
    this.showProcessing(true);
    this.rules = ufwExecutor.listRules();
    // Flag rules that guard the SSH port → they can't be deleted.
    this.rules.forEach(rule => {
      if (rule.port && parseInt(rule.port, 10) === this.sshPort) {
        rule.isCritical = true;
      }
    });
    renderRuleList(this.list, this.rules, this.sshPort);
    this.showProcessing(false);
    this.screen.render();

    if (this.rules.length > 0) {
      this.list.select(LIST_HEADER_OFFSET);
      this.selectRule(0);
    } else {
      this.selectedRule = null;
      showViewMode(this.rightPanel, null, this.sshPort);
      this.screen.render();
    }
  }

  /**
   * Selects rule at `index`, updating both the list highlight and the right panel.
   * @param {number} index       - 0-based rule index
   * @param {boolean} [skipListSelect=false] - true when selection came from clicking
   *                                        the list itself (avoid double-select)
   */
  selectRule(index, skipListSelect) {
    if (index < 0 || index >= this.rules.length) return;
    if (!skipListSelect) this.list.select(index + LIST_HEADER_OFFSET);
    this.selectedRule = this.rules[index];
    showViewMode(this.rightPanel, this.selectedRule, this.sshPort);
    this.screen.render();
  }

  /** Toggles the "Processing…" state on the footer. */
  showProcessing(processing) {
    this.isProcessing = processing;
    this.footer.updateContent(this.ufwStatus, processing);
  }

  /**
   * Opens the Delete confirmation popup for the currently selected rule.
   * Confirmed with Y, cancelled with N, Esc, or Q. Critical (SSH) rules are
   * blocked at a higher level (in index.js), so they never reach here.
   */
  confirmDelete() {
    if (!this.selectedRule) return;
    if (this.isProcessing) return;

    const rule = this.selectedRule;
    const portStr = rule.port || 'all';

    const overlay = require('neo-blessed').box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: 50,
      height: 14,
      tags: true,
      border: { type: 'line' },
      style: {
        border: { fg: '#e74c3c' },
        bg: '#0d1b2a',
      },
    });

    // Danger-striped title bar.
    require('neo-blessed').box({
      parent: overlay,
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      content: '{bold}{white-fg}⚠  Confirm Delete  ⚠{/white-fg}{/bold}',
      tags: true,
      align: 'center',
      valign: 'middle',
      style: { bg: '#c0392b' },
    });

    // Rule summary being deleted.
    require('neo-blessed').box({
      parent: overlay,
      top: 3,
      left: 1,
      right: 1,
      height: 5,
      content: [
        '',
        `  ${rule.action}  ${portStr}/${rule.protocol.toUpperCase()}`,
        `  From: ${rule.from}`,
        `  To:   ${rule.to}`,
        rule.comment ? `  Comment: ${rule.comment}` : '',
      ].join('\n'),
      tags: true,
    });

    // Prompt line.
    require('neo-blessed').box({
      parent: overlay,
      top: 9,
      left: 1,
      right: 1,
      height: 1,
      content: '{center}{yellow-fg}Press Y to confirm, N to cancel{/yellow-fg}{/center}',
      tags: true,
    });

    this._modalOverlay = overlay;
    this.screen.render();
    this._modalActive = true;

    /**
     * Closes the popup without deleting.
     */
    const dismiss = () => {
      this._modalActive = false;
      if (this._modalOverlay) {
        this._modalOverlay.hide();
        const idx = this.screen.children.indexOf(this._modalOverlay);
        if (idx !== -1) this.screen.children.splice(idx, 1);
        this._modalOverlay.destroy();
        this._modalOverlay = null;
      }
      this.screen.render();
    };

    // Individual key handlers for Y / N.
    const onKey = (ch, key) => {
      if (!this._modalActive) return;
      if (!key) return;
      if (key.name === 'y' || key.name === 'Y') {
        cleanup();
        dismiss();
        this.deleteSelectedRule();
      } else if (key.name === 'n' || key.name === 'N' || key.name === 'escape' || key.name === 'q') {
        cleanup();
        dismiss();
      }
    };

    // Remember to detach our own listener so it doesn't fire forever.
    const cleanup = () => {
      this.screen.removeListener('keypress', onKey);
    };

    this.screen.on('keypress', onKey);
  }

  /**
   * Actually deletes the selected UFW rule, records it in history, reloads.
   * On failure, shows an error popup that restores the right panel.
   */
  async deleteSelectedRule() {
    if (!this.selectedRule) return;
    if (this.isProcessing) return;

    const ruleToDelete = this.selectedRule;
    const ruleIndex = this.rules.findIndex(r => r.number === ruleToDelete.number);

    this.showProcessing(true);
    // Wipe the right panel while the deletion is in flight (avoids stale view).
    while (this.rightPanel.children.length > 0) {
      const child = this.rightPanel.children[0];
      child.detach();
      if (child.destroy) child.destroy();
    }
    this.screen.render();

    const result = ufwExecutor.deleteRule(ruleToDelete.number);
    if (result.success) {
      this.historyCtrl.addDeletedRule(ruleToDelete);
      await this.loadRules();
    } else {
      this.showProcessing(false);
      this._showErrorPopup('Delete Rule Failed', result.output || 'Unknown error', () => {
        showViewMode(this.rightPanel, ruleToDelete, this.sshPort);
        this.screen.render();
      });
    }
  }

  /** Opens the Edit form for the selected rule. */
  enterEditMode() {
    if (!this.selectedRule) return;
    this._showForm(this.selectedRule);
  }

  /** Opens the Add form with empty (default) values. */
  enterAddMode() {
    this._showForm(null);
  }

  /**
   * Like enterAddMode but pre-fills the form with a preset's values.
   * Preset rules carry number=0 so the form treats them as Adds.
   * @param {object} preset - one entry from src/ui/preset-popup.js PRESETS
   */
  enterAddModeWithPreset(preset) {
    const presetRule = new Rule({
      number: 0,
      action: preset.action,
      port: preset.port,
      protocol: preset.protocol,
      from: preset.from,
      to: preset.to,
      comment: preset.comment,
      direction: 'in',
    });
    this._showForm(presetRule);
  }

  /**
   * Shows the Add/Edit form popup.
   * @param {Rule|null} rule - existing rule (Edit) or null/new rule#0 (Add)
   */
  _showForm(rule) {
    // Remember which number is selected so we can restore focus after a save reloads.
    this._ruleNumberBeforeForm = this.selectedRule ? this.selectedRule.number : null;
    this.formPopup = showFormPopup(
      this.screen,
      rule,
      (values, existingRule) => this._handleFormSave(values, existingRule),
      () => this._handleFormCancel()
    );
    this._modalActive = true;
  }

  /**
   * Save handler called from the form's Ctrl+S.
   * Builds the new Rule, detects duplicates (Add only), executes ufw,
   * restores selection, and on failure reopens the form with prior state.
   * @param {object} values       - {action, port, protocol, from, to, comment}
   * @param {Rule|null} existingRule - the rule being edited, or null for Add
   */
  _handleFormSave(values, existingRule) {
    this._modalActive = false;
    this.formPopup = null;

    // number>0 ⟺ an existing UFW rule → Edit, else Add.
    const isEdit = existingRule && existingRule.number > 0;

    const newRule = new Rule({
      number: isEdit ? existingRule.number : 0,
      action: values.action,
      port: values.port,
      protocol: values.protocol,
      from: values.from,
      to: values.to,
      comment: values.comment,
      direction: 'in',
    });

    // Prevent duplicate Adds (exact same action/port/proto/from/to).
    if (!isEdit) {
      const duplicate = this.rules.find(r =>
        r.action === newRule.action &&
        r.port === newRule.port &&
        r.protocol === newRule.protocol &&
        r.from === newRule.from &&
        r.to === newRule.to
      );
      if (duplicate) {
        this._showErrorPopup('Rule Already Exists', 'This rule is already exists!', () => {
          this._showForm(newRule); // reopen with what they typed
        });
        return;
      }
    }

    this.showProcessing(true);

    // On Edit we first archive the old rule so we can restore it after a failure.
    let result;
    if (isEdit) {
      this.historyCtrl.addDeletedRule(existingRule);
      result = ufwExecutor.editRule(existingRule, newRule);
    } else {
      result = ufwExecutor.addRule(newRule);
    }

    // Error → show popup; on dismiss reopen form with saved state.
    if (result && !result.success) {
      this.showProcessing(false);
      const action = isEdit ? 'Edit' : 'Add';
      const savedExistingRule = isEdit ? existingRule : null;
      const savedValues = { ...values };
      this._showErrorPopup(`${action} Rule Failed`, result.output || 'Unknown error', () => {
        if (savedExistingRule) {
          this._showForm(savedExistingRule);
        } else {
          const presetRule = new Rule({
            number: 0,
            action: savedValues.action,
            port: savedValues.port,
            protocol: savedValues.protocol,
            from: savedValues.from,
            to: savedValues.to,
            comment: savedValues.comment,
            direction: 'in',
          });
          this._showForm(presetRule);
        }
      });
      return;
    }

    const restoreNumber = this._ruleNumberBeforeForm;
    this._ruleNumberBeforeForm = null;

    this.loadRules().then(() => {
      if (restoreNumber != null) {
        const idx = this.rules.findIndex(r => r.number === restoreNumber);
        if (idx >= 0) {
          this.selectRule(idx);
        }
      }
    });
  }

  /** Cancels a form — just releases the modal lock. */
  _handleFormCancel() {
    this._modalActive = false;
    this.formPopup = null;
  }

  /**
   * Displays a modal error popup with a single Dismiss (Enter/Esc).
   * @param {string} title    - short error heading
   * @param {string} message  - body text
   * @param {function()=} onDismiss - called once popup closes (e.g. reopen form)
   */
  _showErrorPopup(title, message, onDismiss) {
    const overlay = blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '50%',
      height: 12,
      tags: true,
      border: { type: 'line' },
      style: {
        border: { fg: '#e74c3c' },
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
      content: `{bold}{red-fg}${title}{/red-fg}{/bold}`,
      tags: true,
      align: 'center',
      valign: 'middle',
      style: { bg: '#1a5276' },
    });

    // Message body
    blessed.box({
      parent: overlay,
      top: 4,
      left: 1,
      right: 1,
      bottom: 2,
      content: message,
      tags: true,
      wrap: true,
    });

    // Footer hint
    blessed.box({
      parent: overlay,
      bottom: 0,
      left: 1,
      right: 1,
      height: 1,
      content: '{center}{yellow-fg}Press Enter or Esc to close{/yellow-fg}{/center}',
      tags: true,
    });

    this._modalActive = true;
    this.screen.render();

    /**
     * Closes popup and runs onDismiss AFTER releasing the lock.
     */
    const dismiss = () => {
      overlay.hide();
      const idx = this.screen.children.indexOf(overlay);
      if (idx !== -1) this.screen.children.splice(idx, 1);
      overlay.destroy();
      this._modalActive = false;
      this.screen.render();
      if (onDismiss) onDismiss();
    };

    const onKey = (ch, key) => {
      if (!this._modalActive) return;
      if (!key) return;
      if (key.name === 'enter' || key.name === 'return' || key.name === 'escape') {
        this.screen.removeListener('keypress', onKey);
        dismiss();
      }
    };

    this.screen.on('keypress', onKey);
  }

  /** Moves selection UP in the rule list. */
  moveUp() {
    if (this.rules.length === 0) return;
    const current = (this.list.selected || LIST_HEADER_OFFSET) - LIST_HEADER_OFFSET;
    if (current > 0) {
      this.selectRule(current - 1);
    }
  }

  /** Moves selection DOWN in the rule list. */
  moveDown() {
    if (this.rules.length === 0) return;
    const current = (this.list.selected || LIST_HEADER_OFFSET) - LIST_HEADER_OFFSET;
    if (current < this.rules.length - 1) {
      this.selectRule(current + 1);
    }
  }

  /**
   * Called when the user clicks a rule row directly in the list.
   * Adjusts for the header/divider offset before delegating.
   * @param {number} index - TRUE list row index (includes offset)
   */
  handleListSelect(index) {
    const ruleIndex = index - LIST_HEADER_OFFSET;
    if (ruleIndex >= 0 && ruleIndex < this.rules.length) {
      this.selectRule(ruleIndex, true);
    }
  }
}

module.exports = RuleController;
