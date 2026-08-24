#!/usr/bin/env node

'use strict';

const path = require('path');

// Resolve src/index.js relative to this file
const indexPath = path.resolve(__dirname, '..', 'src', 'index.js');
require(indexPath);
