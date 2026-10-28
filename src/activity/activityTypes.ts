/**
 * Normalized activity vocabulary shared by every activity adapter.
 *
 * Adapters observe different VS Code surfaces and translate them into this
 * one vocabulary. Nothing below the adapter layer knows how detection works.
 */

/** The character states the companion can be in. */
export type ActivityState =
  | 'idle'
  | 'thinking'
  | 'typing'
  | 'coding'
  | 'reviewing'
  | 'waiting'
  | 'success'
  | 'error'
  | 'paused'
  | 'sleeping'
  | 'unknown';

/**
 * How an activity was detected.
 *
 * - `direct`  - an official VS Code API reported the operation explicitly.
 * - `inferred` - derived from a generic signal (a document edit, a task
 *   starting) that is consistent with AI activity but does not prove it.
 * - `manual` - the user asked for it.
 */
export type DetectionConfidence = 'direct' | 'inferred' | 'manual';

/** Which surface produced the signal. */
export type ActivitySource =
  | 'copilot-chat'
  | 'copilot-inline'
  | 'copilot-agent'
  | 'copilot-tools'
  | 'vscode-task'
  | 'vscode-terminal'
  | 'vscode-editor'
  | 'vscode-workspace'
  | 'manual';

/** Lifecycle phase of a normalized activity. */
export type ActivityPhase =
  | 'started'
  | 'updated'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'unknown';

/** What kind of work an activity represents. */
export type ActivityKind =
  | 'chat'
  | 'inline-completion'
  | 'agent'
  | 'tool'
  | 'task'
  | 'edit'
  | 'review'
  | 'manual';

/**
 * A single normalized activity event.
 *
 * `description` is always a short, human-readable label. It never contains
 * prompt text, response text, source code, file paths or workspace paths.
 */
export interface ActivityEvent {
  /** Stable identifier used to correlate start/complete pairs. */
  readonly id: string;
  readonly kind: ActivityKind;
  readonly phase: ActivityPhase;
  readonly source: ActivitySource;
  readonly confidence: DetectionConfidence;
  /** Epoch milliseconds when the event was produced. */
  readonly timestamp: number;
  /** Short sanitized label, e.g. "Copilot chat response". */
  readonly description: string;
  /** State the character should adopt while this activity is live. */
  readonly state: ActivityState;
  /** True when the signal came from an API that names Copilot explicitly. */
  readonly direct: boolean;
}

/** A tracked, currently-running activity. */
export interface ActiveActivity {
  readonly id: string;
  readonly kind: ActivityKind;
  readonly source: ActivitySource;
  readonly confidence: DetectionConfidence;
  readonly state: ActivityState;
  readonly startedAt: number;
  readonly description: string;
  readonly direct: boolean;
}

/** One entry in the user-visible activity timeline. */
export interface ActivityTimelineEntry {
  readonly id: string;
  readonly timestamp: number;
  readonly label: string;
  readonly source: ActivitySource;
  readonly confidence: DetectionConfidence;
  readonly direct: boolean;
}

/** Availability of the various integrations the extension can use. */
export interface AdapterAvailability {
  readonly id: string;
  readonly name: string;
  readonly available: boolean;
  /** Why the adapter is unavailable, when it is. */
  readonly reason?: string;
}

/**
 * An adapter turns a VS Code signal into normalized activity events.
 *
 * Adapters are intentionally ignorant of the character and of the webview.
 */
export interface ActivityAdapter {
  readonly id: string;
  readonly name: string;
  /** Whether this adapter can currently produce events. */
  isAvailable(): boolean;
  /** Human-readable explanation of why the adapter is unavailable. */
  getUnavailableReason?(): string | undefined;
  /** Starts observing. Returns a disposable that stops observing. */
  activate(onEvent: (event: ActivityEvent) => void): { dispose(): void };
}

/**
 * The order in which concurrent activities are reduced to a single
 * character state. Higher priority wins.
 *
 * 1. An error reaction is always shown first.
 * 2. A directly observed Copilot operation beats generic activity.
 * 3. Waiting for the user beats reviewing.
 * 4. Reviewing beats generic editor activity.
 * 5. Generic editor activity beats idle.
 */
export const ACTIVITY_PRIORITY: Readonly<Record<ActivityState, number>> = {
  error: 100,
  thinking: 90,
  coding: 90,
  typing: 85,
  waiting: 70,
  reviewing: 60,
  success: 50,
  sleeping: 30,
  paused: 25,
  idle: 10,
  unknown: 20,
};

/**
 * A small bonus applied to directly observed activities.
 *
 * Two activities can map to the same state - a directly observed Copilot
 * request and an inferred editor edit can both be "coding". The bonus makes
 * the direct one win, so the character never shows a generic reaction while a
 * Copilot-attributable operation is running.
 */
export const DIRECT_CONFIDENCE_BONUS = 5;

/** A small bonus applied to activities the user asked for. */
export const MANUAL_CONFIDENCE_BONUS = 15;

/**
 * Scores an activity for the priority comparison.
 *
 * @param state the character state the activity maps to
 * @param confidence how the activity was detected
 */
export function activityScore(
  state: ActivityState,
  confidence: DetectionConfidence
): number {
  let score = ACTIVITY_PRIORITY[state];
  if (confidence === 'direct') {
    score += DIRECT_CONFIDENCE_BONUS;
  } else if (confidence === 'manual') {
    score += MANUAL_CONFIDENCE_BONUS;
  }
  return score;
}


/** Human-readable labels for each state. */
export const STATE_LABELS: Readonly<Record<ActivityState, string>> = {
  idle: 'Idle',
  thinking: 'Thinking',
  typing: 'Typing',
  coding: 'Coding',
  reviewing: 'Reviewing',
  waiting: 'Waiting',
  success: 'Success',
  error: 'Needs attention',
  paused: 'Paused',
  sleeping: 'Sleeping',
  unknown: 'Unknown',
};

/** Short messages shown under the character. */
export const STATE_MESSAGES: Readonly<Record<ActivityState, string>> = {
  idle: 'is taking a break.',
  thinking: 'is thinking...',
  typing: 'is typing.',
  coding: 'is busy coding.',
  reviewing: 'is checking things out.',
  waiting: 'is waiting for a reply.',
  success: 'Nice! Task completed.',
  error: 'Something needs attention.',
  paused: 'is taking a pause.',
  sleeping: 'is dozing off.',
  unknown: 'is waiting for activity information.',
};
