import * as vscode from 'vscode';

/** The extension's configuration section. */
export const CONFIG_SECTION = 'copilotPixelCompanion';

export type AnimationSpeed = 'slow' | 'normal' | 'fast';
export type CharacterSize = 'small' | 'medium' | 'large';

export interface CompanionConfig {
  readonly enabled: boolean;
  readonly character: string;
  readonly environment: string;
  readonly animationsEnabled: boolean;
  readonly animationSpeed: AnimationSpeed;
  readonly characterSize: CharacterSize;
  readonly reducedMotion: boolean;
  readonly showStatusBar: boolean;
  readonly showElapsedTime: boolean;
  readonly showActivityTimeline: boolean;
  readonly showInferredActivity: boolean;
  readonly manualMode: boolean;
  readonly activityTimeoutSeconds: number;
  readonly persistActivityHistory: boolean;
  readonly showActivityDetails: boolean;
  readonly maxActivityHistory: number;
}

const SPEEDS: AnimationSpeed[] = ['slow', 'normal', 'fast'];
const SIZES: CharacterSize[] = ['small', 'medium', 'large'];

/**
 * Reads and validates the extension's settings.
 *
 * Every value is validated against the same constraints declared in
 * package.json, so an out-of-range or unknown value falls back to the
 * documented default instead of propagating into the renderer.
 */
export class ConfigurationManager implements vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<CompanionConfig>();
  private cached: CompanionConfig;
  private readonly subscription: vscode.Disposable;

  constructor() {
    this.cached = this.read();
    this.subscription = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(CONFIG_SECTION)) {
        this.cached = this.read();
        this.emitter.fire(this.cached);
      }
    });
  }

  get config(): CompanionConfig {
    return this.cached;
  }

  /** Fires whenever any companion setting changes. */
  onDidChange: vscode.Event<CompanionConfig> = this.emitter.event;

  /** Reads the current configuration, applying defaults and validation. */
  read(): CompanionConfig {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    return {
      enabled: config.get<boolean>('enabled', true),
      character: config.get<string>('character', 'byte'),
      environment: config.get<string>('environment', 'cozyDesk'),
      animationsEnabled: config.get<boolean>('animationsEnabled', true),
      animationSpeed: this.oneOf(config.get<string>('animationSpeed'), SPEEDS, 'normal'),
      characterSize: this.oneOf(config.get<string>('characterSize'), SIZES, 'medium'),
      reducedMotion: config.get<boolean>('reducedMotion', false),
      showStatusBar: config.get<boolean>('showStatusBar', true),
      showElapsedTime: config.get<boolean>('showElapsedTime', true),
      showActivityTimeline: config.get<boolean>('showActivityTimeline', true),
      showInferredActivity: config.get<boolean>('showInferredActivity', true),
      manualMode: config.get<boolean>('manualMode', false),
      activityTimeoutSeconds: this.bounded(
        config.get<number>('activityTimeoutSeconds'),
        5,
        600,
        30
      ),
      persistActivityHistory: config.get<boolean>('persistActivityHistory', false),
      showActivityDetails: config.get<boolean>('showActivityDetails', true),
      maxActivityHistory: this.bounded(
        config.get<number>('maxActivityHistory'),
        5,
        100,
        20
      ),
    };
  }

  /** Writes a single setting, scoped to the workspace when one is open. */
  async update(key: string, value: unknown): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const target = vscode.workspace.workspaceFolders?.length
      ? vscode.ConfigurationTarget.Workspace
      : vscode.ConfigurationTarget.Global;
    await config.update(key, value, target);
  }

  /** Restores every setting to its packaged default. */
  async reset(): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const target = vscode.workspace.workspaceFolders?.length
      ? vscode.ConfigurationTarget.Workspace
      : vscode.ConfigurationTarget.Global;
    const keys: string[] = [
      'enabled',
      'character',
      'environment',
      'animationsEnabled',
      'animationSpeed',
      'characterSize',
      'reducedMotion',
      'showStatusBar',
      'showElapsedTime',
      'showActivityTimeline',
      'showInferredActivity',
      'manualMode',
      'activityTimeoutSeconds',
      'persistActivityHistory',
      'showActivityDetails',
      'maxActivityHistory',
    ];
    for (const key of keys) {
      const entry = config.inspect(key);
      await config.update(key, entry?.defaultValue, target);
    }
  }

  dispose(): void {
    this.subscription.dispose();
    this.emitter.dispose();
  }

  private oneOf<T extends string>(
    value: string | undefined,
    allowed: T[],
    fallback: T
  ): T {
    return value && (allowed as string[]).includes(value) ? (value as T) : fallback;
  }

  private bounded(
    value: number | undefined,
    min: number,
    max: number,
    fallback: number
  ): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, Math.round(value)));
  }
}
