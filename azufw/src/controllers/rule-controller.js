'use strict';

const blessed = require('neo-blessed');
const ufwExecutor = require('../cli/ufw-executor');
const Rule = require('../models/Rule');
const { renderRuleList } = require('../ui/left-panel');
const { showViewMode } = require('../ui/right-panel');
const { showFormPopup } = require('../ui/form-popup');

const LIST_HEADER_OFFSET = 2; // header + divider rows in the rule list

class RuleController {
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
    this._modalActive = false;
    this.formPopup = null;
  }

  async loadRules() {
    this.showProcessing(true);
    this.rules = ufwExecutor.listRules();
    // Mark critical rules
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

  selectRule(index, skipListSelect) {
    if (index < 0 || index >= this.rules.length) return;
    if (!skipListSelect) this.list.select(index + LIST_HEADER_OFFSET);
    this.selectedRule = this.rules[index];
    showViewMode(this.rightPanel, this.selectedRule, this.sshPort);
    this.screen.render();
  }

  showProcessing(processing) {
    this.isProcessing = processing;
    this.footer.updateContent(this.ufwStatus, processing);
  }

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

    require('neo-blessed').box({
      parent: overlay,
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      content: '{bold}{red-fg}Confirm Delete{/red-fg}{/bold}',
      tags: true,
      align: 'center',
      valign: 'middle',
      style: { bg: '#1a5276' },
    });

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

    const cleanup = () => {
      this.screen.removeListener('keypress', onKey);
    };

    this.screen.on('keypress', onKey);
  }

  async deleteSelectedRule() {
    if (!this.selectedRule) return;
    if (this.isProcessing) return;

    const ruleToDelete = this.selectedRule;
    const ruleIndex = this.rules.findIndex(r => r.number === ruleToDelete.number);

    this.showProcessing(true);
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

  enterEditMode() {
    if (!this.selectedRule) return;
    this._showForm(this.selectedRule);
  }

  enterAddMode() {
    this._showForm(null);
  }

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

  _showForm(rule) {
    this._ruleNumberBeforeForm = this.selectedRule ? this.selectedRule.number : null;
    this.formPopup = showFormPopup(
      this.screen,
      rule,
      (values, existingRule) => this._handleFormSave(values, existingRule),
      () => this._handleFormCancel()
    );
    this._modalActive = true;
  }

  _handleFormSave(values, existingRule) {
    this._modalActive = false;
    this.formPopup = null;

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

    this.showProcessing(true);

    let result;
    if (isEdit) {
      this.historyCtrl.addDeletedRule(existingRule);
      result = ufwExecutor.editRule(existingRule, newRule);
    } else {
      result = ufwExecutor.addRule(newRule);
    }

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

  _handleFormCancel() {
    this._modalActive = false;
    this.formPopup = null;
  }

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

  moveUp() {
    if (this.rules.length === 0) return;
    const current = (this.list.selected || LIST_HEADER_OFFSET) - LIST_HEADER_OFFSET;
    if (current > 0) {
      this.selectRule(current - 1);
    }
  }

  moveDown() {
    if (this.rules.length === 0) return;
    const current = (this.list.selected || LIST_HEADER_OFFSET) - LIST_HEADER_OFFSET;
    if (current < this.rules.length - 1) {
      this.selectRule(current + 1);
    }
  }

  handleListSelect(index) {
    const ruleIndex = index - LIST_HEADER_OFFSET;
    if (ruleIndex >= 0 && ruleIndex < this.rules.length) {
      this.selectRule(ruleIndex, true);
    }
  }
}

module.exports = RuleController;
