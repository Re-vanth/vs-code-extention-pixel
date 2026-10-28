import * as vscode from 'vscode';
import {
  ActivityAdapter,
  ActivityEvent,
  ActivityState,
  ActivityTimelineEntry,
  ActiveActivity,
  AdapterAvailability,
} from './activityTypes';
import { ActivityStateMachine } from './activityStateMachine';

/**
 * Key used for the optional persisted timeline.
 */
const HISTORY_KEY = 'copilotPixelCompanion.history';

/**
 * Owns the adapters, feeds their events into the state machine and keeps the
 * bounded activity history.
 *
 * The manager is the only place that knows about both the detection layer
 * and the state machine; the character renderer only ever sees the resulting
 * state.
 */
export class ActivityManager implements vscode.Disposable {
  private readonly machine: ActivityStateMachine;
  private readonly adapters: ActivityAdapter[] = [];
  private readonly subscriptions: vscode.Disposable[] = [];
  private readonly history: ActivityTimelineEntry[] = [];
  private readonly stateEmitter = new vscode.EventEmitter<ActivityEvent>();
  private readonly historyEmitter = new vscode.EventEmitter<void>();

  private maxHistory = 20;
  private timeoutSeconds = 30;
  private timeoutTimer: NodeJS.Timeout | undefined;
  /** When false, inferred activity is dropped before it reaches the machine. */
  private allowInferred = true;
  /** When true, only manual activity is accepted. */
  private manualOnly = false;
  /** Local storage used to keep the timeline between sessions. */
  private storage: vscode.Memento | undefined;
  private persist = false;

  constructor(adapters: ActivityAdapter[]) {
    this.adapters = adapters;
    this.machine = new ActivityStateMachine();
  }

  /** Fires for every accepted activity event. */
  onDidChangeActivity: vscode.Event<ActivityEvent> = this.stateEmitter.event;

  /** Fires whenever the timeline changes. */
  onDidChangeHistory: vscode.Event<void> = this.historyEmitter.event;

  /** Starts every adapter and wires their events into the state machine. */
  activate(): void {
    for (const adapter of this.adapters) {
      if (!adapter.isAvailable()) {
        continue;
      }
      const registration = adapter.activate((event) => this.handleEvent(event));
      this.subscriptions.push(registration);
    }

    // A coarse timer is enough to expire stale inferred activity. It runs
    // only while the extension is active and does no filesystem work.
    this.timeoutTimer = setInterval(() => {
      const expired = this.machine.expireStale(this.timeoutSeconds * 1000);
      if (expired.length > 0) {
        for (const activity of expired) {
          this.pushHistory({
            id: `${activity.id}:expired`,
            timestamp: Date.now(),
            label: `${activity.description} (expired)`,
            source: activity.source,
            confidence: activity.confidence,
            direct: activity.direct,
          });
        }
        this.stateEmitter.fire({
          id: 'manager:expired',
          kind: 'edit',
          phase: 'updated',
          source: 'vscode-editor',
          confidence: 'inferred',
          timestamp: Date.now(),
          description: 'Inferred activity expired',
          state: 'idle',
          direct: false,
        });
      }
    }, 5000);
  }

  /** The current character state. */
  getState(): ActivityState {
    return this.machine.getState();
  }

  /** The activity currently driving the character. */
  getPrimaryActivity(): ActiveActivity | undefined {
    return this.machine.getPrimaryActivity();
  }

  /** All live activities. */
  getActiveActivities(): ActiveActivity[] {
    return this.machine.getActiveActivities();
  }

  /** The bounded timeline, newest first. */
  getHistory(): ActivityTimelineEntry[] {
    return [...this.history].reverse();
  }

  /** Availability of every adapter, for the diagnostics view. */
  getAdapterAvailability(): AdapterAvailability[] {
    return this.adapters.map((adapter) => ({
      id: adapter.id,
      name: adapter.name,
      available: adapter.isAvailable(),
      reason: adapter.getUnavailableReason?.(),
    }));
  }

  /** Clears the timeline. */
  clearHistory(): void {
    this.history.length = 0;
    this.historyEmitter.fire();
    void this.storage?.update(HISTORY_KEY, []);
  }

  /**
   * Enables or disables keeping the timeline between sessions.
   *
   * Only sanitized labels, sources, confidence values and timestamps are
   * stored - never prompts, responses, code or paths.
   */
  async setPersistence(enabled: boolean, storage?: vscode.Memento): Promise<void> {
    this.storage = storage;
    this.persist = enabled;

    if (!enabled) {
      await this.storage?.update(HISTORY_KEY, []);
      return;
    }

    const stored = this.storage?.get<ActivityTimelineEntry[]>(HISTORY_KEY, []);
    if (Array.isArray(stored) && stored.length > 0) {
      this.history.length = 0;
      for (const entry of stored) {
        this.history.push(entry);
      }
      while (this.history.length > this.maxHistory) {
        this.history.shift();
      }
      this.historyEmitter.fire();
    }
  }

  /** Applies new limits from the configuration. */
  applySettings(maxHistory: number, timeoutSeconds: number): void {
    this.maxHistory = maxHistory;
    this.timeoutSeconds = timeoutSeconds;
    while (this.history.length > this.maxHistory) {
      this.history.pop();
    }
  }

  /**
   * Turns the inferred-activity and manual-mode settings on or off.
   *
   * Disabling inferred activity also drops the inferred activities that are
   * already live, so the character stops reacting to them immediately.
   */
  setDetectionMode(allowInferred: boolean, manualOnly: boolean): void {
    this.allowInferred = allowInferred;
    this.manualOnly = manualOnly;
    if (!allowInferred) {
      this.machine.dropInferred();
    }
  }

  /**
   * Feeds an event into the state machine.
   *
   * @returns true when the event changed anything
   */
  handleEvent(event: ActivityEvent): boolean {
    if (!this.accepts(event)) {
      return false;
    }

    const before = this.machine.getState();
    const result = this.machine.apply(event);
    if (result === undefined) {
      // Duplicate or inapplicable event - ignored, but still recorded in the
      // timeline so the user can see that something happened.
      this.pushHistory(this.toHistoryEntry(event));
      return false;
    }

    const after = this.machine.getState();
    this.pushHistory(this.toHistoryEntry(event));
    if (before !== after || event.phase === 'started') {
      this.stateEmitter.fire(event);
    }
    return true;
  }

  /** Whether an event is allowed through given the current detection mode. */
  private accepts(event: ActivityEvent): boolean {
    if (this.manualOnly) {
      return event.confidence === 'manual';
    }
    if (!this.allowInferred && event.confidence === 'inferred') {
      return false;
    }
    return true;
  }

  private toHistoryEntry(event: ActivityEvent): ActivityTimelineEntry {
    return {
      id: `${event.id}:${event.phase}:${event.timestamp}`,
      timestamp: event.timestamp,
      label: event.description,
      source: event.source,
      confidence: event.confidence,
      direct: event.direct,
    };
  }

  private pushHistory(entry: ActivityTimelineEntry): void {
    this.history.push(entry);
    while (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    this.historyEmitter.fire();
    if (this.persist && this.storage) {
      void this.storage.update(HISTORY_KEY, [...this.history]);
    }
  }

  dispose(): void {
    if (this.timeoutTimer) {
      clearInterval(this.timeoutTimer);
      this.timeoutTimer = undefined;
    }
    for (const subscription of this.subscriptions.splice(0)) {
      subscription.dispose();
    }
    this.stateEmitter.dispose();
    this.historyEmitter.dispose();
  }
}
