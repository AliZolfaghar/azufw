'use strict';

const History = require('../models/History');
const Rule = require('../models/Rule');

class HistoryController {
  constructor() {
    this.history = new History();
  }

  addDeletedRule(rule) {
    this.history.addEntry(rule);
  }

  getEntries() {
    return this.history.listEntries();
  }

  restoreEntry(index) {
    const entry = this.history.removeEntryAndSave(index);
    if (entry) {
      return Rule.fromJSON(entry.rule);
    }
    return null;
  }

  getCount() {
    return this.history.getEntryCount();
  }
}

module.exports = HistoryController;
