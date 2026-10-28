import * as path from 'path';
import * as assert from 'assert';
import * as fs from 'fs';
import * as vscode from 'vscode';

export const EXTENSION_ID = 'vscode-copilot-pixel.vscode-copilot-pixel-companion';

/**
 * Integration tests that run inside a real Extension Development Host.
 *
 * These cover the parts that need a genuine VS Code instance: activation,
 * command registration, the webview view provider and the packaged assets.
 */

/** The extension under test, activated. */
export async function activateExtension(): Promise<vscode.Extension<unknown>> {
  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  assert.ok(extension, 'the extension should be installed in the host');
  await extension.activate();
  return extension;
}

describe('extension activation', () => {
  it('activates successfully', async () => {
    const extension = await activateExtension();
    assert.strictEqual(extension.isActive, true);
  });

  it('registers every contributed command', async () => {
    await activateExtension();
    const commands = await vscode.commands.getCommands(true);
    const expected = [
      'copilotPixelCompanion.show',
      'copilotPixelCompanion.hide',
      'copilotPixelCompanion.toggle',
      'copilotPixelCompanion.setCharacter',
      'copilotPixelCompanion.setEnvironment',
      'copilotPixelCompanion.setAnimationEnabled',
      'copilotPixelCompanion.setManualState',
      'copilotPixelCompanion.clearActivityHistory',
      'copilotPixelCompanion.resetSettings',
      'copilotPixelCompanion.showDiagnostics',
    ];
    for (const command of expected) {
      assert.ok(
        commands.includes(command),
        `expected the command ${command} to be registered`
      );
    }
  });

  it('registers the webview view provider', async () => {
    await activateExtension();
    // Focusing the contributed view resolves it through the registered
    // provider, which fails if the provider was never registered.
    await vscode.commands.executeCommand('copilotPixelCompanion.view.focus');
  });

  it('contributes the activity bar container and the view', async () => {
    const extension = await activateExtension();
    const packageJson = JSON.parse(
      fs.readFileSync(
        path.join(extension.extensionUri.fsPath, 'package.json'),
        'utf8'
      )
    );
    assert.ok(packageJson.contributes.viewsContainers.activitybar);
    assert.ok(packageJson.contributes.views.copilotPixelCompanion);
    assert.strictEqual(
      packageJson.contributes.views.copilotPixelCompanion[0].type,
      'webview'
    );
  });
});

describe('configuration', () => {
  it('uses the documented defaults', async () => {
    await activateExtension();
    const config = vscode.workspace.getConfiguration('copilotPixelCompanion');
    assert.strictEqual(config.get('character'), 'byte');
    assert.strictEqual(config.get('environment'), 'cozyDesk');
    assert.strictEqual(config.get('animationsEnabled'), true);
    assert.strictEqual(config.get('animationSpeed'), 'normal');
    assert.strictEqual(config.get('characterSize'), 'medium');
    assert.strictEqual(config.get('reducedMotion'), false);
    assert.strictEqual(config.get('activityTimeoutSeconds'), 30);
    assert.strictEqual(config.get('persistActivityHistory'), false);
    assert.strictEqual(config.get('maxActivityHistory'), 20);
  });

  it('applies a configuration change to the running extension', async () => {
    await activateExtension();
    const config = vscode.workspace.getConfiguration('copilotPixelCompanion');
    const previous = config.get<boolean>('showStatusBar');
    await config.update('showStatusBar', !previous, vscode.ConfigurationTarget.Global);
    assert.strictEqual(config.get('showStatusBar'), !previous);
    await config.update('showStatusBar', previous, vscode.ConfigurationTarget.Global);
  });
});

describe('commands', () => {
  it('runs the manual state command', async () => {
    await activateExtension();
    await vscode.commands.executeCommand(
      'copilotPixelCompanion.setManualState',
      'thinking'
    );
  });

  it('runs the clear history command', async () => {
    await activateExtension();
    await vscode.commands.executeCommand('copilotPixelCompanion.clearActivityHistory');
  });

  it('runs the animation toggle command', async () => {
    await activateExtension();
    await vscode.commands.executeCommand('copilotPixelCompanion.setAnimationEnabled');
  });
});

describe('packaged assets', () => {
  it('ships a manifest and sprites for every character', async () => {
    const extension = await activateExtension();
    const root = extension.extensionUri.fsPath;
    for (const character of ['byte', 'pixel', 'bugsy']) {
      const manifestPath = path.join(
        root,
        'media',
        'sprites',
        character,
        'manifest.json'
      );
      assert.ok(fs.existsSync(manifestPath), `missing manifest for ${character}`);
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      assert.strictEqual(manifest.frameWidth, 32);
      for (const state of [
        'idle',
        'think',
        'type',
        'code',
        'review',
        'success',
        'error',
        'sleep',
      ]) {
        assert.ok(manifest.states[state], `${character} is missing the ${state} state`);
        const sprite = path.join(
          root,
          'media',
          'sprites',
          character,
          manifest.states[state].file
        );
        assert.ok(fs.existsSync(sprite), `missing sprite ${sprite}`);
      }
    }
  });

  it('ships every environment backdrop', async () => {
    const extension = await activateExtension();
    const root = extension.extensionUri.fsPath;
    for (const environment of ['cozyDesk', 'nightStudio', 'pixelGarden']) {
      const file = path.join(root, 'media', 'environments', `${environment}.png`);
      assert.ok(fs.existsSync(file), `missing environment ${environment}`);
    }
  });

  it('ships the bundled webview script and stylesheet', async () => {
    const extension = await activateExtension();
    const root = extension.extensionUri.fsPath;
    assert.ok(fs.existsSync(path.join(root, 'webview', 'dist', 'main.js')));
    assert.ok(fs.existsSync(path.join(root, 'webview', 'dist', 'main.css')));
  });
});
