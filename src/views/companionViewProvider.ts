import * as vscode from 'vscode';
import {
  ActivityState,
  ActivityTimelineEntry,
  STATE_LABELS,
  STATE_MESSAGES,
} from '../activity/activityTypes';
import { ActivityManager } from '../activity/activityManager';
import { CharacterRegistry } from '../character/characterRegistry';
import { CompanionConfig, ConfigurationManager } from '../configuration/configurationManager';
import { Logger } from '../utilities/logger';
import {
  ActivityChangedPayload,
  CharacterChangedPayload,
  ConfigurationPayload,
  DiagnosticsPayload,
  EnvironmentChangedPayload,
  ExtensionToWebviewMessage,
  InitialStatePayload,
  validateWebviewMessage,
} from '../protocol/messages';

const VIEW_ID = 'copilotPixelCompanion.view';

/** The environments the extension ships with. */
export const ENVIRONMENTS: { id: string; label: string }[] = [
  { id: 'cozyDesk', label: 'Cozy Desk' },
  { id: 'nightStudio', label: 'Night Studio' },
  { id: 'pixelGarden', label: 'Pixel Garden' },
];

/** The states a user can pick manually. */
export const MANUAL_STATES: ActivityState[] = [
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
 * Backs the Activity Bar webview view.
 *
 * The extension host owns all state; the webview only renders what it is
 * told and sends user actions back. The webview never infers activity on
 * its own.
 */
export class CompanionViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private view: vscode.WebviewView | undefined;
  private readonly subscriptions: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly activityManager: ActivityManager,
    private readonly configuration: ConfigurationManager,
    private readonly characters: CharacterRegistry,
    private readonly logger: Logger
  ) {
    this.subscriptions.push(
      this.activityManager.onDidChangeActivity(() => {
        this.postActivityChanged();
      })
    );

    this.subscriptions.push(
      this.activityManager.onDidChangeHistory(() => {
        this.post({
          type: 'historyChanged',
          payload: { entries: this.activityManager.getHistory() },
        });
      })
    );

    this.subscriptions.push(
      this.configuration.onDidChange((config) => {
        this.postConfiguration(config);
        void this.refreshCharacter();
        void this.refreshEnvironment();
      })
    );
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'media'),
        vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist'),
      ],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      (message: unknown) => {
        this.handleMessage(message);
      }
    );

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.postInitialState();
      }
    });

    webviewView.onDidDispose(() => {
      this.view = undefined;
    });
  }

  /** Reveals the companion view, focusing the Activity Bar container. */
  reveal(): void {
    void vscode.commands.executeCommand(
      'workbench.view.extension.copilotPixelCompanion'
    );
    void vscode.commands.executeCommand(`${VIEW_ID}.focus`);
  }

  /** Sends a full state snapshot to the webview. */
  postInitialState(): void {
    const config = this.configuration.config;
    const payload: InitialStatePayload = {
      ...this.buildActivityPayload(),
      characterId: config.character,
      characterName: this.characters.get(config.character)?.displayName ?? 'Companion',
      environmentId: config.environment,
      animationsEnabled: config.animationsEnabled,
      animationSpeed: this.speedMultiplier(config.animationSpeed),
      characterSize: config.characterSize,
      reducedMotion: config.reducedMotion,
      manualMode: config.manualMode,
      showStatusBar: config.showStatusBar,
      showElapsedTime: config.showElapsedTime,
      showTimeline: config.showActivityTimeline,
      showDetails: config.showActivityDetails,
      adapters: this.activityManager.getAdapterAvailability(),
      entries: this.activityManager.getHistory(),
      characters: this.characters.list().map((character) => ({
        id: character.id,
        name: character.displayName,
      })),
      environments: ENVIRONMENTS.map((environment) => ({
        id: environment.id,
        label: environment.label,
      })),
      manualStates: MANUAL_STATES,
    };
    this.post({ type: 'initialState', payload });
  }

  /** Sends the current character manifest to the webview. */
  async refreshCharacter(): Promise<void> {
    const config = this.configuration.config;
    const character = this.characters.get(config.character);
    if (!character || !this.view) {
      return;
    }
    const assets: Record<string, string> = {};
    const timings: Record<string, number> = {};
    const loops: Record<string, boolean> = {};
    for (const [state, definition] of Object.entries(character.states)) {
      const uri = this.view.webview.asWebviewUri(
        vscode.Uri.joinPath(
          this.extensionUri,
          'media',
          'sprites',
          character.id,
          definition.file
        )
      );
      assets[state] = uri.toString();
      timings[state] = definition.duration;
      loops[state] = definition.loop;
    }
    const payload: CharacterChangedPayload = {
      characterId: character.id,
      characterName: character.displayName,
      frameWidth: character.frameWidth,
      frameHeight: character.frameHeight,
      assets,
      timings,
      loops,
    };
    this.post({ type: 'characterChanged', payload });
  }

  /** Sends the current environment backdrop to the webview. */
  async refreshEnvironment(): Promise<void> {
    const config = this.configuration.config;
    if (!this.view) {
      return;
    }
    const uri = this.view.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'environments', `${config.environment}.png`)
    );
    const payload: EnvironmentChangedPayload = {
      environmentId: config.environment,
      uri: uri.toString(),
    };
    this.post({ type: 'environmentChanged', payload });
  }

  /** Sends the diagnostics payload to the webview. */
  postDiagnostics(payload: DiagnosticsPayload): void {
    this.post({ type: 'showDiagnostics', payload });
  }

  private postActivityChanged(): void {
    this.post({ type: 'activityChanged', payload: this.buildActivityPayload() });
  }

  private postConfiguration(config: CompanionConfig): void {
    const payload: ConfigurationPayload = {
      animationsEnabled: config.animationsEnabled,
      animationSpeed: this.speedMultiplier(config.animationSpeed),
      characterSize: config.characterSize,
      reducedMotion: config.reducedMotion,
      manualMode: config.manualMode,
      showStatusBar: config.showStatusBar,
      showElapsedTime: config.showElapsedTime,
      showTimeline: config.showActivityTimeline,
      showDetails: config.showActivityDetails,
    };
    this.post({ type: 'configurationChanged', payload });
  }

  private buildActivityPayload(): ActivityChangedPayload {
    const state = this.activityManager.getState();
    const primary = this.activityManager.getPrimaryActivity();
    const config = this.configuration.config;
    const elapsed = primary ? Date.now() - primary.startedAt : 0;

    const label =
      primary?.description ??
      (state === 'idle' ? 'No activity detected' : STATE_LABELS[state]);

    return {
      state,
      statusText: this.buildStatusText(state),
      activityLabel: label,
      sourceLabel: primary ? this.sourceLabel(primary.source) : 'None',
      elapsedMs: config.showElapsedTime ? elapsed : 0,
      isDirect: primary?.direct ?? false,
      confidence: primary?.confidence ?? 'none',
    };
  }

  private buildStatusText(state: ActivityState): string {
    const name = this.characters.get(this.configuration.config.character)?.displayName ?? 'Byte';
    return `${name} ${STATE_MESSAGES[state]}`;
  }

  private sourceLabel(source: string): string {
    switch (source) {
      case 'copilot-chat':
        return 'Copilot chat';
      case 'copilot-inline':
        return 'Copilot inline';
      case 'copilot-agent':
        return 'Copilot agent';
      case 'copilot-tools':
        return 'Copilot tool';
      case 'vscode-task':
        return 'VS Code task';
      case 'vscode-terminal':
        return 'VS Code terminal';
      case 'vscode-editor':
        return 'Editor (inferred)';
      case 'vscode-workspace':
        return 'Workspace (inferred)';
      case 'manual':
        return 'Manual';
      default:
        return 'None';
    }
  }

  private speedMultiplier(speed: 'slow' | 'normal' | 'fast'): number {
    switch (speed) {
      case 'slow':
        return 0.6;
      case 'fast':
        return 1.6;
      default:
        return 1;
    }
  }

  private post(message: ExtensionToWebviewMessage): void {
    if (!this.view) {
      return;
    }
    void this.view.webview.postMessage(message);
  }

  private handleMessage(message: unknown): void {
    const validated = validateWebviewMessage(message);
    if (!validated) {
      this.logger.warn('Ignored an invalid message from the companion view.');
      return;
    }

    switch (validated.type) {
      case 'requestInitialState':
        this.postInitialState();
        void this.refreshCharacter();
        void this.refreshEnvironment();
        break;
      case 'setManualState':
        void vscode.commands.executeCommand(
          'copilotPixelCompanion.setManualState',
          validated.state
        );
        break;
      case 'setCharacter':
        void this.configuration.update('character', validated.characterId);
        break;
      case 'setEnvironment':
        void this.configuration.update('environment', validated.environmentId);
        break;
      case 'setAnimationsEnabled':
        void this.configuration.update('animationsEnabled', validated.enabled);
        break;
      case 'clearHistory':
        this.activityManager.clearHistory();
        break;
      case 'openSettings':
        void vscode.commands.executeCommand(
          'workbench.action.openSettings',
          validated.settingId
            ? `copilotPixelCompanion.${validated.settingId}`
            : 'copilotPixelCompanion'
        );
        break;
      case 'reportError':
        this.logger.error(`Companion view reported: ${validated.message}`);
        break;
      default:
        break;
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist', 'main.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist', 'main.css')
    );

    // A restrictive CSP: no remote origins, no inline script, no eval.
    const nonce = makeNonce();
    const csp = [
      `default-src 'none'`,
      `img-src ${webview.cspSource} data:`,
      `style-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}'`,
      `font-src ${webview.cspSource}`,
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="${styleUri}" rel="stylesheet">
<title>Copilot Pixel Companion</title>
</head>
<body>
<div id="root"></div>
<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  dispose(): void {
    for (const subscription of this.subscriptions.splice(0)) {
      subscription.dispose();
    }
    this.view = undefined;
  }
}

/** Generates a random nonce for the webview CSP. */
function makeNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

/** Re-exported for tests. */
export type { ActivityTimelineEntry };
