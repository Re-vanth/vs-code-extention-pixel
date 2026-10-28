import {
  ActivityAdapter,
  ActivityEvent,
  ActivityState,
} from './activityTypes';

/**
 * Adapter driven entirely by the user.
 *
 * Manual mode exists so the companion is useful when no reliable activity
 * signal is available - including when GitHub Copilot is not installed at
 * all. It is also the only way to exercise every character state on demand.
 */
export class ManualActivityAdapter implements ActivityAdapter {
  readonly id = 'manual';
  readonly name = 'Manual control';

  private currentState: ActivityState = 'idle';
  private emitter: ((event: ActivityEvent) => void) | undefined;

  isAvailable(): boolean {
    return true;
  }

  getUnavailableReason(): string | undefined {
    return undefined;
  }

  activate(onEvent: (event: ActivityEvent) => void): { dispose(): void } {
    this.emitter = onEvent;
    return {
      dispose: () => {
        this.emitter = undefined;
      },
    };
  }

  /** Sets the character state explicitly. */
  setState(state: ActivityState): void {
    this.currentState = state;
    this.emitter?.({
      id: `manual:${state}`,
      kind: 'manual',
      phase: 'started',
      source: 'manual',
      confidence: 'manual',
      timestamp: Date.now(),
      description: `Manual: ${state}`,
      state,
      direct: false,
    });
  }

  getState(): ActivityState {
    return this.currentState;
  }
}
