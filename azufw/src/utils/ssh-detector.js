'use strict';

const fs = require('fs');
const path = require('path');

const SSH_CONFIG_PATH = '/etc/ssh/sshd_config';
const DEFAULT_SSH_PORT = 22;

function detectSshPort() {
  try {
    const content = fs.readFileSync(SSH_CONFIG_PATH, 'utf8');
    const match = content.match(/^\s*Port\s+(\d+)/m);
    if (match) {
      return parseInt(match[1], 10);
    }
  } catch (_e) {
    // File not readable or doesn't exist
  }
  return DEFAULT_SSH_PORT;
}

module.exports = { detectSshPort, DEFAULT_SSH_PORT };
