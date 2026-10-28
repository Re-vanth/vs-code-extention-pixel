"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManualActivityAdapter = void 0;
/**
 * Adapter driven entirely by the user.
 *
 * Manual mode exists so the companion is useful when no reliable activity
 * signal is available - including when GitHub Copilot is not installed at
 * all. It is also the only way to exercise every character state on demand.
 */
class ManualActivityAdapter {
    id = 'manual';
    name = 'Manual control';
    currentState = 'idle';
    emitter;
    isAvailable() {
        return true;
    }
    getUnavailableReason() {
        return undefined;
    }
    activate(onEvent) {
        this.emitter = onEvent;
        return {
            dispose: () => {
                this.emitter = undefined;
            },
        };
    }
    /** Sets the character state explicitly. */
    setState(state) {
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
    getState() {
        return this.currentState;
    }
}
exports.ManualActivityAdapter = ManualActivityAdapter;
//# sourceMappingURL=manualActivityAdapter.js.map