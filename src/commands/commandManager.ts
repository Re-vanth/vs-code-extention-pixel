import * as vscode from 'vscode';
import { ActivityState } from '../activity/activityTypes';
import { ActivityManager } from '../activity/activityManager';
import { ManualActivityAdapter } from '../activity/manualActivityAdapter';
import { CharacterRegistry } from '../character/characterRegistry';
import { CompanionConfig, ConfigurationManager } from '../configuration/configurationManager';
import { Logger } from '../utilities/logger';
import { CompanionViewProvider } from '../views/companionViewProvider';

const MANUAL_STATES: ActivityState[] = [
  'idle',
  'thinking',
  'typing',
  'coding',
  'reviewing',
  'waiting',
  'success',
  'error',
  'paused',
  'sleeping',
];

/**
 * Registers and implements every command the extension contributes.
 *
 * Each command has a real behaviour; there are no placeholder entries.
 */
export class CommandManager implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly configuration: ConfigurationManager,
    private readonly activityManager: ActivityManager,
    private readonly manualAdapter: ManualActivityAdapter,
    private readonly characters: CharacterRegistry,
    private readonly viewProvider: CompanionViewProvider,
    private readonly logger: Logger
  ) {}

  register(): void {
    const register = (id: string, handler: (...args: unknown[]) => unknown) => {
      this.disposables.push(
        vscode.commands.registerCommand(id, async (...args: unknown[]) => {
          try {
            await handler(...args);
          } catch (error) {
            this.logger.error(`Command ${id} failed.`, error);
            void vscode.window.showErrorMessage(
              'Copilot Pixel Companion: the command could not be completed.'
            );
          }
        })
      );
    };

    register('copilotPixelCompanion.show', () => this.viewProvider.reveal());
    register('copilotPixelCompanion.hide', () => this.hideCompanion());
    register('copilotPixelCompanion.toggle', () => this.toggleCompanion());
    register('copilotPixelCompanion.setCharacter', () => this.setCharacter());
    register('copilotPixelCompanion.setEnvironment', () => this.setEnvironment());
    register('copilotPixelCompanion.setAnimationEnabled', () =>
      this.setAnimationEnabled()
    );
    register('copilotPixelCompanion.setManualState', (state?: unknown) =>
      this.setManualState(state)
    );
    register('copilotPixelCompanion.clearActivityHistory', () => {
      this.activityManager.clearHistory();
    });
    register('copilotPixelCompanion.resetSettings', () => this.resetSettings());
    register('copilotPixelCompanion.showDiagnostics', () =>
      this.showDiagnostics()
    );
  }

  private async hideCompanion(): Promise<void> {
    await vscode.commands.executeCommand('workbench.action.closeSidebar');
  }

  private async toggleCompanion(): Promise<void> {
    const container = (await vscode.commands.executeCommand(
      'workbench.view.extension.copilotPixelCompanion'
    )) as { visible?: boolean } | undefined;
    if (container?.visible) {
      await vscode.commands.executeCommand('workbench.action.closeSidebar');
    } else {
      this.viewProvider.reveal();
    }
  }

  private async setCharacter(): Promise<void> {
    const available = this.characters.list();
    if (available.length === 0) {
      void vscode.window.showWarningMessage(
        'Copilot Pixel Companion: no characters were found in the media folder.'
      );
      return;
    }
    const picked = await vscode.window.showQuickPick(
      available.map((character) => ({
        label: character.displayName,
        description: character.personality,
        detail: `Character id: ${character.id}`,
        id: character.id,
      })),
      { placeHolder: 'Choose a companion character' }
    );
    if (picked) {
      await this.configuration.update('character', picked.id);
    }
  }

  private async setEnvironment(): Promise<void> {
    const environments = [
      { id: 'cozyDesk', label: 'Cozy Desk' },
      { id: 'nightStudio', label: 'Night Studio' },
      { id: 'pixelGarden', label: 'Pixel Garden' },
    ];
    const picked = await vscode.window.showQuickPick(environments, {
      placeHolder: 'Choose an environment',
    });
    if (picked) {
      await this.configuration.update('environment', picked.id);
    }
  }

  private async setAnimationEnabled(): Promise<void> {
    const current = this.configuration.config.animationsEnabled;
    await this.configuration.update('animationsEnabled', !current);
  }

  private async setManualState(state?: unknown): Promise<void> {
    let target: ActivityState | undefined;
    if (typeof state === 'string' && (MANUAL_STATES as string[]).includes(state)) {
      target = state as ActivityState;
    } else {
      const picked = await vscode.window.showQuickPick(
        MANUAL_STATES.map((value) => ({
          label: value,
          description: this.describeState(value),
          id: value,
        })),
        { placeHolder: 'Choose a manual character state' }
      );
      target = picked?.id;
    }

    if (!target) {
      return;
    }

    // Manual control implies manual mode; turn it on so the user is not
    // fighting the automatic detection.
    if (!this.configuration.config.manualMode) {
      await this.configuration.update('manualMode', true);
    }
    this.manualAdapter.setState(target);
  }

  private describeState(state: ActivityState): string {
    switch (state) {
      case 'idle':
        return 'Relaxed, occasional blinking';
      case 'thinking':
        return 'Looking upward with thought bubbles';
      case 'typing':
        return 'Typing on a miniature keyboard';
      case 'coding':
        return 'Working at a miniature computer';
      case 'reviewing':
        return 'Inspecting a code document';
      case 'success':
        return 'Short celebration';
      case 'error':
        return 'Gentle concerned reaction';
      case 'waiting':
        return 'Waiting for a reply';
      case 'paused':
        return 'Sitting down, minimal movement';
      case 'sleeping':
        return 'Closed eyes with floating Z particles';
      default:
        return '';
    }
  }

  private async resetSettings(): Promise<void> {
    const confirmation = await vscode.window.showWarningMessage(
      'Reset every Copilot Pixel Companion setting to its default?',
      { modal: true },
      'Reset'
    );
    if (confirmation === 'Reset') {
      await this.configuration.reset();
      void vscode.window.showInformationMessage(
        'Copilot Pixel Companion settings were reset.'
      );
    }
  }

  private async showDiagnostics(): Promise<void> {
    const adapters = this.activityManager.getAdapterAvailability();
    const lines: string[] = ['Copilot Pixel Companion diagnostics', ''];
    for (const adapter of adapters) {
      lines.push(
        `${adapter.available ? '[available]' : '[unavailable]'} ${adapter.name}` +
          (adapter.reason ? ` - ${adapter.reason}` : '')
      );
    }
    lines.push('');
    lines.push(
      'No prompts, responses, source code or workspace paths are collected or transmitted.'
    );

    this.logger.info(lines.join('\n'));
    this.logger.show();

    await vscode.commands.executeCommand(
      'workbench.action.openSettings',
      'copilotPixelCompanion'
    );
  }

  /** Applies the current configuration to the status bar and view. */
  syncConfiguration(config: CompanionConfig): void {
    this.activityManager.applySettings(
      config.maxActivityHistory,
      config.activityTimeoutSeconds
    );
    this.activityManager.setDetectionMode(
      config.showInferredActivity,
      config.manualMode
    );
  }

  dispose(): void {
    for (const disposable of this.disposables.splice(0)) {
      disposable.dispose();
    }
  }
}
