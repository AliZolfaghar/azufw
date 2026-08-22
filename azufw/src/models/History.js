'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const HISTORY_FILE = path.join(os.homedir(), '.azufw-history.json');

class History {
  constructor() {
    this.entries = [];
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
        this.entries = JSON.parse(raw);
      }
    } catch (_e) {
      this.entries = [];
    }
  }

  _save() {
    try {
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(this.entries, null, 2), 'utf8');
    } catch (_e) {
      // Silently fail if can't write
    }
  }

  addEntry(rule) {
    this.entries.push({
      rule: rule.toJSON(),
      deletedAt: new Date().toISOString(),
    });
    this._save();
  }

  listEntries() {
    return this.entries;
  }

  removeEntry(index) {
    if (index >= 0 && index < this.entries.length) {
      return this.entries.splice(index, 1)[0];
    }
    return null;
  }

  removeEntryAndSave(index) {
    const entry = this.removeEntry(index);
    if (entry) this._save();
    return entry;
  }

  getEntryCount() {
    return this.entries.length;
  }
}

module.exports = History;
