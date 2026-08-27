'use strict';

/**
 * ============================================================================
 * RULE  —  the UFW firewall rule domain model
 * ----------------------------------------------------------------------------
 * Represents a single rule as shown by `ufw status numbered`.
 *
 * Field semantics:
 *   number   – UFW's positional rule number (0 means "not yet in UFW" — used
 *               for Add mode / preset pre-fill).
 *   action   – 'ALLOW' | 'DENY' | 'REJECT'
 *   port     – destination port (string, '' = "any")
 *   protocol – 'tcp' | 'udp' (defaults 'tcp')
 *   from/to  – source / destination addresses
 *   comment  – optional descriptive text
 *   direction – 'in' | 'out'
 *   isCritical – true when this rule guards the SSHD port (blocked from deletion)
 *
 * THE CRITICAL LINK: `number` > 0 means the rule ALREADY EXISTS in UFW.
 * Controllers (and form-popup) use this single fact to tell Add from Edit.
 * ============================================================================
 */

class Rule {
  /**
   * @param {object} params - see class docs above. All fields optional.
   */
  constructor({ number, action, port, protocol, from, to, comment, direction, isCritical }) {
    this.number = number || 0;
    this.action = (action || 'ALLOW').toUpperCase();
    this.port = String(port || '');
    this.protocol = (protocol || 'tcp').toLowerCase();
    this.from = from || '0.0.0.0';
    this.to = to || 'any';
    this.comment = comment || '';
    this.direction = direction || 'in';
    this.isCritical = !!isCritical;
  }

  /**
   * @returns {string} 'ALLOW' | 'DENY' | 'REJECT' (normalised)
   */
  getDisplayAction() {
    return this.action;
  }

  /**
   * Determines whether this rule is IPv4 or IPv6 based on address shape.
   * @returns {'4'|'6'|'4/6'} '4/6' if from/to disagree
   */
  getIpVersion() {
    const detect = (ip) => {
      if (!ip || ip === 'any' || ip === '0.0.0.0' || ip === 'Anywhere') return '4';
      if (ip.includes(':')) return '6';
      return '4';
    };
    const fromVer = detect(this.from);
    const toVer = detect(this.to);
    return fromVer === toVer ? fromVer : '4/6';
  }

  /**
   * One-line shorthand string used in some UI hints (e.g. delete confirmation).
   * @returns {string}
   */
  getShortDisplay() {
    const portStr = this.port || 'all';
    return `[${this.number}]  ${this.action.padEnd(7)}  ${portStr.padEnd(6)}  ${this.protocol.toUpperCase().padEnd(4)}  ${this.comment || '-'}`;
  }

  /**
   * Builds the real `ufw` shell command that CREATES this rule.
   * Comment gets shell-escaped double quotes.
   * @returns {string} e.g. `ufw allow proto tcp from 0.0.0.0 to any port 22 comment "SSH access"`
   */
  toUfwCommand() {
    let cmd = `ufw ${this.action.toLowerCase()}`;
    if (this.port) {
      cmd += ` proto ${this.protocol}`;
      cmd += ` from ${this.from}`;
      cmd += ` to any port ${this.port}`;
    } else {
      cmd += ` from ${this.from}`;
      cmd += ` to ${this.to}`;
    }
    if (this.comment) {
      const escaped = this.comment.replace(/"/g, '\\"');
      cmd += ` comment "${escaped}"`;
    }
    return cmd;
  }

  /**
   * @returns {object} plain object (used for JSON persistence, deep copies)
   */
  toJSON() {
    return {
      number: this.number,
      action: this.action,
      port: this.port,
      protocol: this.protocol,
      from: this.from,
      to: this.to,
      comment: this.comment,
      direction: this.direction,
      isCritical: this.isCritical,
    };
  }

  /**
   * Rehydrates a Rule from a plain JSON object.
   * @param {object} data - the output of toJSON()
   * @returns {Rule}
   */
  static fromJSON(data) {
    return new Rule(data);
  }

  /**
   * Parses ONE line of `ufw status numbered` output into a Rule.
   *
   * Expected line shape (modern UFW):
   *   [ 1] 22/tcp       ALLOW IN    Anywhere             My comment
   *         ^^^^^ port/proto token      ^^^^^^ destination ('Anywhere' if none)
   *
   * The port token may be:
   *   • "22/tcp"   → port=22, protocol=tcp
   *   • "22"       → port=22, protocol=tcp (no explicit proto → UFW assumed tcp)
   *   • "0.0.0.0" / "Anywhere" → port='' (a bare from-rule)
   *
   * Anything after the leading destination word is treated as the comment.
   *
   * @param {string} line - one raw line from ufw status numbered
   * @returns {Rule|null} parsed Rule or null if the line isn't a rule row
   */
  static parseFromNumberedStatus(line) {
    // [ 1] 22/tcp    ALLOW IN    Anywhere             My comment
    const re = /^\[\s*(\d+)\]\s+(\S+)\s+(ALLOW|DENY|REJECT)\s+(IN|OUT)\s+(.+)$/;
    const match = line.trim().match(re);
    if (!match) return null;

    const number = parseInt(match[1], 10);
    const portPart = match[2];
    const action = match[3];
    const direction = match[4].toLowerCase();
    const destinationRaw = match[5];

    // --- Port/proto decomposition -------------------------------------------
    let port = '';
    let protocol = 'tcp';
    // "22/tcp" pattern:
    const protoMatch = portPart.match(/^(\S+?)\/(tcp|udp)$/);
    if (protoMatch) {
      port = protoMatch[1];
      protocol = protoMatch[2];
    } else if (portPart !== '0.0.0.0' && portPart !== 'Anywhere') {
      // Bare "22" (no "/proto") → way-less common but supported.
      port = portPart;
    }

    // --- Destination → from + comment --------------------------------------
    let from = destinationRaw.trim();
    let comment = '';
    const commentMatch = destinationRaw.match(/^(\S+)\s+(.+)$/);
    if (commentMatch) {
      from = commentMatch[1];
      comment = commentMatch[2].trim();
    }

    return new Rule({
      number,
      action,
      port,
      protocol,
      from: from === 'Anywhere' ? '0.0.0.0' : from,
      to: 'any',
      comment,
      direction,
    });
  }
}

module.exports = Rule;
