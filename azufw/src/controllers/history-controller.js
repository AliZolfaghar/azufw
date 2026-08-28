'use strict';

/**
 * ============================================================================
 * HISTORY CONTROLLER  —  records and restores deleted rules
 * ----------------------------------------------------------------------------
 * Every deletion (via rule-controller) calls addDeletedRule(), which persists the Rule
 * plus the wall-clock deletion time into the on-disk History store (a single
 * JSON file in the user's home directory, see src/models/History.js).
 *
 * The history is shown on the right panel (Press H) and each entry can be
 * restored back into UFW (Press Enter while in History mode).
 * ============================================================================
 */

const History = require('../models/History');
const Rule = require('../models/Rule');

/**
 * Thin wrapper around the persistence model History.
 * RuleController holds exactly one instance.
 */
class HistoryController {
  constructor() {
    /** @type {History} the on-disk store */
    this.history = new History();
  }

  /**
   * Persists `rule` as a new (most recent) deleted entry.
   * @param {Rule} rule - the UFW rule that was just removed
   */
  addDeletedRule(rule) {
    this.history.addEntry(rule);
  }

  /**
   * Returns all entries (oldest → newest).
   * @returns {Array<{rule: object, deletedAt: string}>}
   */
  getEntries() {
    return this.history.listEntries();
  }

  /**
   * Removes the entry at `index` from disk and returns its Rule object.
   * Called when the user restores a rule so it doesn't reappear.
   * @param {number} index - 0-based entry index
   * @returns {Rule|null}
   */
  restoreEntry(index) {
    const entry = this.history.removeEntryAndSave(index);
    if (entry) {
      return Rule.fromJSON(entry.rule);
    }
    return null;
  }

  /**
   * @returns {number} how many deleted rules are currently tracked
   */
  getCount() {
    return this.history.getEntryCount();
  }
}

module.exports = HistoryController;
