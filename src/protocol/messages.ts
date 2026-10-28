import {
  ActivityState,
  ActivityTimelineEntry,
  AdapterAvailability,
} from '../activity/activityTypes';

/**
 * Typed message protocol between the extension host and the webview.
 *
 * Every message is validated on receipt. Unknown message types are ignored
 * rather than trusted.
 */

/** Messages sent from the extension host to the webview. */
export type ExtensionToWebviewMessage =
  | { type: 'initialState'; payload: InitialStatePayload }
  | { type: 'activityChanged'; payload: ActivityChangedPayload }
  | { type: 'configurationChanged'; payload: ConfigurationPayload }
  | { type: 'characterChanged'; payload: CharacterChangedPayload }
  | { type: 'environmentChanged'; payload: EnvironmentChangedPayload }
  | { type: 'manualStateChanged'; payload: { state: ActivityState } }
  | { type: 'historyChanged'; payload: { entries: ActivityTimelineEntry[] } }
  | { type: 'clearHistory'; payload: Record<string, never> }
  | { type: 'showDiagnostics'; payload: DiagnosticsPayload };

/** Messages sent from the webview to the extension host. */
export type WebviewToExtensionMessage =
  | { type: 'requestInitialState' }
  | { type: 'setManualState'; state: ActivityState }
  | { type: 'setCharacter'; characterId: string }
  | { type: 'setEnvironment'; environmentId: string }
  | { type: 'setAnimationsEnabled'; enabled: boolean }
  | { type: 'clearHistory' }
  | { type: 'openSettings'; settingId?: string }
  | { type: 'reportError'; message: string };

export interface InitialStatePayload {
  readonly state: ActivityState;
  readonly statusText: string;
  readonly activityLabel: string;
  readonly sourceLabel: string;
  readonly elapsedMs: number;
  readonly isDirect: boolean;
  readonly confidence: string;
  readonly characterId: string;
  readonly characterName: string;
  readonly environmentId: string;
  readonly animationsEnabled: boolean;
  readonly animationSpeed: number;
  readonly characterSize: string;
  readonly reducedMotion: boolean;
  readonly manualMode: boolean;
  readonly showStatusBar: boolean;
  readonly showElapsedTime: boolean;
  readonly showTimeline: boolean;
  readonly showDetails: boolean;
  readonly adapters: AdapterAvailability[];
  readonly entries: ActivityTimelineEntry[];
  /** Every character the user can pick from. */
  readonly characters: { id: string; name: string }[];
  /** Every environment the user can pick from. */
  readonly environments: { id: string; label: string }[];
  /** The states the user can select manually. */
  readonly manualStates: string[];
}

export interface ActivityChangedPayload {
  readonly state: ActivityState;
  readonly statusText: string;
  readonly activityLabel: string;
  readonly sourceLabel: string;
  readonly elapsedMs: number;
  readonly isDirect: boolean;
  readonly confidence: string;
}

export interface ConfigurationPayload {
  readonly animationsEnabled: boolean;
  readonly animationSpeed: number;
  readonly characterSize: string;
  readonly reducedMotion: boolean;
  readonly manualMode: boolean;
  readonly showStatusBar: boolean;
  readonly showElapsedTime: boolean;
  readonly showTimeline: boolean;
  readonly showDetails: boolean;
}

export interface CharacterChangedPayload {
  readonly characterId: string;
  readonly characterName: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  /** Webview URI for each animation strip, keyed by state name. */
  readonly assets: Record<string, string>;
  /** Loop length in milliseconds for each animation, keyed by state name. */
  readonly timings: Record<string, number>;
  /** Whether each animation repeats, keyed by state name. */
  readonly loops: Record<string, boolean>;
}

export interface EnvironmentChangedPayload {
  readonly environmentId: string;
  readonly uri: string;
}

export interface DiagnosticsPayload {
  readonly adapters: AdapterAvailability[];
  readonly copilotInstalled: boolean;
  readonly chatModelsObserved: boolean;
  readonly directLifecycleEvents: boolean;
  readonly notes: string[];
}

const ACTIVITY_STATES: ActivityState[] = [
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
  'unknown',
];

/**
 * Validates a message received from the webview.
 *
 * @returns the validated message, or `undefined` when the payload is not
 * acceptable. Callers must treat `undefined` as "ignore".
 */
export function validateWebviewMessage(
  message: unknown
): WebviewToExtensionMessage | undefined {
  if (!message || typeof message !== 'object') {
    return undefined;
  }
  const candidate = message as Record<string, unknown>;
  switch (candidate.type) {
    case 'requestInitialState':
      return { type: 'requestInitialState' };
    case 'setManualState':
      if (
        typeof candidate.state === 'string' &&
        (ACTIVITY_STATES as string[]).includes(candidate.state)
      ) {
        return { type: 'setManualState', state: candidate.state as ActivityState };
      }
      return undefined;
    case 'setCharacter':
      if (typeof candidate.characterId === 'string' && candidate.characterId.length > 0) {
        return { type: 'setCharacter', characterId: candidate.characterId };
      }
      return undefined;
    case 'setEnvironment':
      if (
        typeof candidate.environmentId === 'string' &&
        candidate.environmentId.length > 0
      ) {
        return { type: 'setEnvironment', environmentId: candidate.environmentId };
      }
      return undefined;
    case 'setAnimationsEnabled':
      if (typeof candidate.enabled === 'boolean') {
        return { type: 'setAnimationsEnabled', enabled: candidate.enabled };
      }
      return undefined;
    case 'clearHistory':
      return { type: 'clearHistory' };
    case 'openSettings':
      return {
        type: 'openSettings',
        settingId:
          typeof candidate.settingId === 'string' ? candidate.settingId : undefined,
      };
    case 'reportError':
      if (typeof candidate.message === 'string') {
        return {
          type: 'reportError',
          message: candidate.message.slice(0, 500),
        };
      }
      return undefined;
    default:
      return undefined;
  }
}

/** Exposed so the webview can validate state names it receives. */
export const VALID_ACTIVITY_STATES = ACTIVITY_STATES;
