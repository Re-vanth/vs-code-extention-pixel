import * as path from 'path';
import Mocha = require('mocha');

/**
 * Entry point used by `@vscode/test-electron`.
 *
 * Runs the integration suite inside a real Extension Development Host.
 */
export async function run(): Promise<void> {
  const mocha = new Mocha({ ui: 'bdd', color: true, timeout: 20000 });
  mocha.addFile(path.resolve(__dirname, 'extension.test.js'));

  await new Promise<void>((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} integration test(s) failed.`));
      } else {
        resolve();
      }
    });
  });
}
