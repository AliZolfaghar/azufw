#!/usr/bin/env node

'use strict';

/**
 * ============================================================================
 * AZUFW  —  npm bin entry point
 * ----------------------------------------------------------------------------
 * The CLI wrapper installed by `npm install -g azufw`. All it does is load the
 * real application code living in ../src/index.js (relative to THIS file), so that
 * `azufw` works regardless of CWD.
 * ============================================================================
 */

const path = require('path');

// Resolve src/index.js relative to this file
const indexPath = path.resolve(__dirname, '..', 'src', 'index.js');
require(indexPath);
