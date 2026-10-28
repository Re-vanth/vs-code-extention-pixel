'use strict';

const path = require('path');
const { runTests } = require('@vscode/test-electron');

/**
 * Runs the VS Code integration tests inside a real Extension Development
 * Host. This exercises activation, command registration and the webview.
 */
async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '..');
    const extensionTestsPath = path.resolve(__dirname, 'suite', 'index');

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        '--disable-extensions',
        '--disable-gpu',
        '--no-sandbox',
        `--user-data-dir=${path.resolve(__dirname, '..', '..', '.vscode-test', 'user-data')}`,
      ],
    });
  } catch (error) {
    console.error('Failed to run integration tests.', error);
    process.exit(1);
  }
}

main();
