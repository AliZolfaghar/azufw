'use strict';

const isMockMode = process.platform === 'win32';

const MOCK_RULES = [
  { number: 1, action: 'ALLOW', port: '22', protocol: 'tcp', from: '0.0.0.0', to: 'any', comment: 'SSH Access', direction: 'in' },
  { number: 2, action: 'ALLOW', port: '80', protocol: 'tcp', from: '0.0.0.0', to: 'any', comment: 'HTTP', direction: 'in' },
  { number: 3, action: 'ALLOW', port: '443', protocol: 'tcp', from: '0.0.0.0', to: 'any', comment: 'HTTPS', direction: 'in' },
  { number: 4, action: 'DENY', port: '23', protocol: 'tcp', from: '0.0.0.0', to: 'any', comment: 'Block Telnet', direction: 'in' },
  { number: 5, action: 'ALLOW', port: '3306', protocol: 'tcp', from: '192.168.1.0/24', to: 'any', comment: 'MySQL Local', direction: 'in' },
];

function getPlatformInfo() {
  return {
    isMockMode,
    platform: process.platform,
  };
}

function getMockMessage() {
  return '⚠  This program is designed for Linux. Running in Windows Mock Mode.';
}

module.exports = { isMockMode, MOCK_RULES, getPlatformInfo, getMockMessage };
