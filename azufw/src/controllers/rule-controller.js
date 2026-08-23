'use strict';

const ufwExecutor = require('../cli/ufw-executor');
const Rule = require('../models/Rule');
const { renderRuleList } = require('../ui/left-panel');
const { showViewMode, showEditMode, getFormValues, cycleChoice, _highlightField } = require('../ui/right-panel');

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
      height: 12,
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
      height: 1,
      content: '{center}{bold}{red-fg}Confirm Delete{/red-fg}{/bold}{/center}',
      tags: true,
      style: { bg: '#1a5276' },
    });

    require('neo-blessed').box({
      parent: overlay,
      top: 1,
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
      top: 7,
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

    this.showProcessing(true);
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
    this.screen.render();
    this._focusCurrentField();
  }

  enterAddMode() {
    showEditMode(this.rightPanel, null);
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

  _endCurrentFieldRead() {
    const fields = ['action', 'port', 'protocol', 'from', 'to', 'comment'];
    const key = fields[this.rightPanel._currentFieldIndex];
    const widget = this.rightPanel._formInputs[key];
    if (widget && !widget._choices && widget._reading && typeof widget._done === 'function') {
      try {
        widget._done('stop');
      } catch (_e) {
        widget._reading = false;
      }
    }
    if (this.screen.grabKeys) {
      this.screen.grabKeys = false;
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
      this.historyCtrl.addDeletedRule(this.selectedRule);
      ufwExecutor.editRule(this.selectedRule, newRule);
    } else {
      ufwExecutor.addRule(newRule);
    }

    this.loadRules();
  }

  _handleCancel() {
    if (this.selectedRule) {
      this.selectRule((this.list.selected || LIST_HEADER_OFFSET) - LIST_HEADER_OFFSET);
    } else {
      showViewMode(this.rightPanel, null, this.sshPort);
      this.screen.render();
    }
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

  tabField() {
    if (this.rightPanel._state !== 'edit' && this.rightPanel._state !== 'add') return;
    this._endCurrentFieldRead();
    const fieldCount = 6;
    this.rightPanel._currentFieldIndex = (this.rightPanel._currentFieldIndex + 1) % fieldCount;
    _highlightField(this.rightPanel, this.rightPanel._currentFieldIndex);
    this._focusCurrentField();
    this.screen.render();
  }

  tabFieldBack() {
    if (this.rightPanel._state !== 'edit' && this.rightPanel._state !== 'add') return;
    this._endCurrentFieldRead();
    const fieldCount = 6;
    this.rightPanel._currentFieldIndex = (this.rightPanel._currentFieldIndex - 1 + fieldCount) % fieldCount;
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
    const ruleIndex = index - LIST_HEADER_OFFSET;
    if (ruleIndex >= 0 && ruleIndex < this.rules.length) {
      this.selectRule(ruleIndex, true);
    }
  }
}

module.exports = RuleController;
