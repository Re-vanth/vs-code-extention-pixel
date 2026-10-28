'use strict';

/**
 * Registers the `vscode` module stub before the unit tests are loaded.
 *
 * Mocha loads this file through `--require`, so the stub is in place by the
 * time any test file imports a module that depends on the VS Code API.
 */

const Module = require('module');
const path = require('path');

const stubPath = path.join(__dirname, 'vscodeMock.js');const originalLoad = Module._load;

Module._load = function (request, parent, isMain) {
  if (request === 'vscode') {
    return originalLoad(stubPath, parent, isMain);
  }
  return originalLoad.apply(this, arguments);
};
