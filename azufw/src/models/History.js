'use strict';

/**
 * ============================================================================
 * HISTORY  —  on-disk persistence for deleted rules
 * ----------------------------------------------------------------------------
 * Stores a JSON array in the user's home directory:
 *     ~/.azufw-history.json
 *
 * File content is:
 *   [ { "rule": { ...Rule.toJSON() }, "deletedAt": "<ISO 8601>" },
 *     ... ]
 *
 * Writes are synchronous and best-effort: if a write fails (e.g. unwritable
 * home directory) we silently skip rather than crash the TUI.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/** Absolute path of the history JSON file. */
const HISTORY_FILE = path.join(os.homedir(), '.azufw-history.json');

class History {
  constructor() {
    /** @type {Array<{rule: object, deletedAt: string}>} raw JSON array */
    this.entries = [];
    this._load();
  }

  /**
   * Reads the JSON file if it exists; wipes entries on any parse error.
   */
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

  /**
   * Writes the current entries back to disk.
   * Failures (bad dir, permissions we may not have as sudo) are ignored.
   */
  _save() {
    try {
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(this.entries, null, 2), 'utf8');
    } catch (_e) {
      // Best-effort write only.
    }
  }

  /**
   * Appends a new deletion record (most recent goes LAST → shown newest last).
   * @param {Rule} rule - the rule that was removed
   */
  addEntry(rule) {
    this.entries.push({
      rule: rule.toJSON(),
      deletedAt: new Date().toISOString(),
    });
    this._save();
  }

  /**
   * @returns {Array<{rule: object, deletedAt: string}>}
   */
  listEntries() {
    return this.entries;
  }

  /**
   * Removes `index` from memory WITHOUT saving (low-level; prefer the sibling
   * method below unless you manually need to skip the save step).
   * @param {number} index - 0-based
   * @returns {{rule: object, deletedAt: string}|null}
   */
  removeEntry(index) {
    if (index >= 0 && index < this.entries.length) {
      return this.entries.splice(index, 1)[0];
    }
    return null;
  }

  /**
   * Like removeEntry but ALSO persists the removal to disk.
   * @param {number} index - 0-based
   * @returns {{rule: object, deletedAt: string}|null}
   */
  removeEntryAndSave(index) {
    const entry = this.removeEntry(index);
    if (entry) this._save();
    return entry;
  }

  /**
   * @returns {number}
   */
  getEntryCount() {
    return this.entries.length;
  }
}

module.exports = History;
