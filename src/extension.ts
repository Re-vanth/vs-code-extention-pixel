import * as vscode from 'vscode';
import { ActivityManager } from './activity/activityManager';
import { CopilotActivityAdapter, ToolActivityAdapter } from './activity/copilotActivityAdapter';
import { EditorActivityAdapter } from './activity/editorActivityAdapter';
import { ManualActivityAdapter } from './activity/manualActivityAdapter';
import { CharacterRegistry } from './character/characterRegistry';
import { CommandManager } from './commands/commandManager';
import { ConfigurationManager } from './configuration/configurationManager';
import { Logger } from './utilities/logger';
import { CompanionViewProvider } from './views/companionViewProvider';
import { StatusBarManager } from './views/statusBarManager';

let statusBar: StatusBarManager | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const logger = new Logger('Copilot Pixel Companion');
  context.subscriptions.push(logger);

  try {
    const configuration = new ConfigurationManager();
    context.subscriptions.push(configuration);

    const characters = new CharacterRegistry(
      vscode.Uri.joinPath(context.extensionUri, 'media', 'sprites').fsPath
    );
    const loaded = characters.load();
    logger.info(`Loaded ${loaded.length} character(s): ${loaded.join(', ')}`);

    const manualAdapter = new ManualActivityAdapter();
    const copilotAdapter = new CopilotActivityAdapter();
    const toolAdapter = new ToolActivityAdapter();
    const editorAdapter = new EditorActivityAdapter();

    const activityManager = new ActivityManager([
      copilotAdapter,
      toolAdapter,
      editorAdapter,
      manualAdapter,
    ]);
    context.subscriptions.push(activityManager);

    const viewProvider = new CompanionViewProvider(
      context.extensionUri,
      activityManager,
      configuration,
      characters,
      logger
    );
    context.subscriptions.push(viewProvider);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        'copilotPixelCompanion.view',
        viewProvider
      )
    );

    statusBar = new StatusBarManager(activityManager, () =>
      characters.get(configuration.config.character)?.displayName ?? 'Byte'
    );
    context.subscriptions.push(statusBar);

    const commandManager = new CommandManager(
      configuration,
      activityManager,
      manualAdapter,
      characters,
      viewProvider,
      logger
    );
    commandManager.register();
    context.subscriptions.push(commandManager);

    activityManager.activate();
    commandManager.syncConfiguration(configuration.config);

    // A tool registered by this extension is a genuinely Copilot-driven
    // signal, because the language model invokes it.
    toolAdapter.registerTool('copilotPixelCompanion.ping', 'Companion ping');

    const applyConfig = (config: typeof configuration.config) => {
      commandManager.syncConfiguration(config);
      void activityManager.setPersistence(
        config.persistActivityHistory,
        context.globalState
      );
      if (config.showStatusBar) {
        statusBar?.create();
        statusBar?.update();
      } else {
        statusBar?.dispose();
      }
    };
    applyConfig(configuration.config);
    context.subscriptions.push(configuration.onDidChange(applyConfig));

    logger.info('Copilot Pixel Companion activated.');
    logger.info(
      `Copilot integration: ${copilotAdapter.describeIntegration().installed ? 'installed' : 'not installed'}. ` +
        'Direct Copilot request lifecycle events are not exposed by the VS Code API.'
    );
  } catch (error) {
    logger.error('Failed to activate Copilot Pixel Companion.', error);
    void vscode.window.showErrorMessage(
      'Copilot Pixel Companion failed to activate. See the "Copilot Pixel Companion" output channel for details.'
    );
  }
}

export function deactivate(): void {
  statusBar?.dispose();
  statusBar = undefined;
}
