'use strict';

const path = require('path');
const Mocha = require('mocha');

/**
 * Runs the unit test suite.
 *
 * These tests cover the parts of the extension that do not need a running
 * VS Code instance: the activity state machine, the animation controller,
 * the activity manager and the message validation. The VS Code integration
 * tests live in `test/suite` and are run by `test/runTest.js`.
 *
 * The TypeScript sources are compiled to `out/` first, so this runner points
 * at the compiled JavaScript.
 */

const mocha = new Mocha({
  ui: 'bdd',
  color: true,
  timeout: 10000,
});

const unitRoot = path.join(__dirname, '..', 'out', 'test', 'unit');

// The unit tests import modules that depend on the `vscode` module, which only
// exists inside a running VS Code host. The stub is registered before any test
// file is loaded.
mocha.addFile(path.join(__dirname, 'unitSetup.js'));

for (const file of [
  'activityStateMachine.test.js',
  'animationController.test.js',
  'activityManager.test.js',
  'messages.test.js',
]) {
  mocha.addFile(path.join(unitRoot, file));
}

mocha.run((failures) => {
  process.exitCode = failures ? 1 : 0;
});
