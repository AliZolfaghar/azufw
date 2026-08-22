'use strict';

const ufwExecutor = require('../cli/ufw-executor');
const Rule = require('../models/Rule');
const { renderRuleList } = require('../ui/left-panel');
const { showViewMode, showEditMode, getFormValues, cycleChoice, _highlightField } = require('../ui/right-panel');

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
      this.list.select(0);
      this.selectRule(0);
    } else {
      this.selectedRule = null;
      showViewMode(this.rightPanel, null, this.sshPort);
      this.screen.render();
    }
  }

  selectRule(index, skipListSelect) {
    if (index < 0 || index >= this.rules.length) return;
    if (!skipListSelect) this.list.select(index);
    this.selectedRule = this.rules[index];
    showViewMode(this.rightPanel, this.selectedRule, this.sshPort);

    // Wire delete button
    const rightRef = this.rightPanel;
    if (rightRef._deleteBtn) {
      rightRef._deleteBtn.removeAllListeners('press');
      if (rightRef._isCritical) {
        rightRef._deleteBtn.on('press', () => {
          this.showDeleteError('Cannot delete SSH critical rule!');
        });
      } else {
        rightRef._deleteBtn.on('press', () => {
          this.deleteSelectedRule();
        });
      }
    }
    this.screen.render();
  }

  showProcessing(processing) {
    this.isProcessing = processing;
    this.footer.updateContent(this.ufwStatus, processing);
  }

  showDeleteError(msg) {
    if (this.rightPanel._deleteErrorBox) this.rightPanel._deleteErrorBox.destroy();
    this.rightPanel._deleteErrorBox = require('neo-blessed').box({
      parent: this.rightPanel,
      bottom: 3,
      left: 1,
      right: 1,
      height: 3,
      content: `{center}{red-fg}${msg}{/red-fg}{/center}`,
      tags: true,
      style: { bg: '#1a1a2e' },
    });
    this.screen.render();
  }

  async deleteSelectedRule() {
    if (!this.selectedRule) return;
    if (this.isProcessing) return;

    this.showProcessing(true);
    // Clear panel children
    while (this.rightPanel.children.length > 0) {
      const child = this.rightPanel.children[0];
      child.detach();
      if (child.destroy) child.destroy();
    }
    this.screen.render();

    const result = ufwExecutor.deleteRule(this.selectedRule.number);
    if (result.success) {
      this.historyCtrl.addDeletedRule(this.selectedRule);
    }

    await this.loadRules();
  }

  enterEditMode() {
    if (!this.selectedRule) return;
    showEditMode(this.rightPanel, this.selectedRule);
    this._wireFormEvents();
    this.screen.render();
    // Focus first input
    this._focusCurrentField();
  }

  enterAddMode() {
    showEditMode(this.rightPanel, null);
    this._wireFormEvents();
    this.screen.render();
    this._focusCurrentField();
  }

  _focusCurrentField() {
    const fields = ['action', 'port', 'protocol', 'from', 'to', 'comment'];
    const key = fields[this.rightPanel._currentFieldIndex];
    const widget = this.rightPanel._formInputs[key];
    if (widget && widget.focus) {
      widget.focus();
    }
  }

  _wireFormEvents() {
    const panel = this.rightPanel;

    // Save button
    if (panel._saveBtn) {
      panel._saveBtn.removeAllListeners('press');
      panel._saveBtn.on('press', () => this._handleSave());
    }

    // Cancel button
    if (panel._cancelBtn) {
      panel._cancelBtn.removeAllListeners('press');
      panel._cancelBtn.on('press', () => this._handleCancel());
    }
  }

  _handleSave() {
    if (this.isProcessing) return;

    const values = getFormValues(this.rightPanel);
    if (!values.port && !values.from) {
      // Basic validation
      return;
    }

    const newRule = new Rule({
      number: this.selectedRule ? this.selectedRule.number : 0,
      action: values.action,
      port: values.port,
      protocol: values.protocol,
      from: values.from,
      to: values.to,
      comment: values.comment,
      direction: 'in',
    });

    this.showProcessing(true);
    // Clear panel children
    while (this.rightPanel.children.length > 0) {
      const child = this.rightPanel.children[0];
      child.detach();
      if (child.destroy) child.destroy();
    }
    this.screen.render();

    if (this.selectedRule) {
      // Edit mode: delete old, add new
      ufwExecutor.deleteRule(this.selectedRule.number);
    }
    ufwExecutor.addRule(newRule);

    this.loadRules();
  }

  _handleCancel() {
    if (this.selectedRule) {
      this.selectRule(this.list.selected || 0);
    } else {
      showViewMode(this.rightPanel, null, this.sshPort);
      this.screen.render();
    }
  }

  moveUp() {
    if (this.rules.length === 0) return;
    const current = this.list.selected || 0;
    if (current > 0) {
      this.selectRule(current - 1);
    }
  }

  moveDown() {
    if (this.rules.length === 0) return;
    const current = this.list.selected || 0;
    if (current < this.rules.length - 1) {
      this.selectRule(current + 1);
    }
  }

  tabField() {
    if (this.rightPanel._state !== 'edit' && this.rightPanel._state !== 'add') return;
    const fieldCount = 6;
    this.rightPanel._currentFieldIndex = (this.rightPanel._currentFieldIndex + 1) % fieldCount;
    _highlightField(this.rightPanel, this.rightPanel._currentFieldIndex);
    this._focusCurrentField();
    this.screen.render();
  }

  cycleChoiceCurrent() {
    if (this.rightPanel._state !== 'edit' && this.rightPanel._state !== 'add') return;
    cycleChoice(this.rightPanel);
    this.screen.render();
  }

  handleListSelect(index) {
    this.selectRule(index, true);
  }
}

module.exports = RuleController;
