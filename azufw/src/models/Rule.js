'use strict';

class Rule {
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

  getDisplayAction() {
    return this.action;
  }

  getShortDisplay() {
    const portStr = this.port || 'all';
    return `[${this.number}]  ${this.action.padEnd(7)}  ${portStr.padEnd(6)}  ${this.protocol.toUpperCase().padEnd(4)}  ${this.comment || '-'}`;
  }

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

  static fromJSON(data) {
    return new Rule(data);
  }

  static parseFromNumberedStatus(line) {
    // Example: "[ 1] 22/tcp    ALLOW IN    Anywhere"
    const re = /^\[\s*(\d+)\]\s+(\S+)\s+(ALLOW|DENY|REJECT)\s+(IN|OUT)\s+(.+)$/;
    const match = line.trim().match(re);
    if (!match) return null;

    const number = parseInt(match[1], 10);
    const portPart = match[2];
    const action = match[3];
    const direction = match[4].toLowerCase();
    const destination = match[5].trim();

    let port = '';
    let protocol = 'tcp';
    const protoMatch = portPart.match(/^(\S+?)\/(tcp|udp)$/);
    if (protoMatch) {
      port = protoMatch[1];
      protocol = protoMatch[2];
    } else if (portPart !== '0.0.0.0' && portPart !== 'Anywhere') {
      port = portPart;
    }

    return new Rule({
      number,
      action,
      port,
      protocol,
      from: destination === 'Anywhere' ? '0.0.0.0' : destination,
      to: 'any',
      direction,
    });
  }
}

module.exports = Rule;
