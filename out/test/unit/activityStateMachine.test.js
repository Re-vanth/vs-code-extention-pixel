"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const activityStateMachine_1 = require("../../src/activity/activityStateMachine");
function event(overrides = {}) {
    return {
        id: 'a1',
        kind: 'chat',
        phase: 'started',
        source: 'copilot-chat',
        confidence: 'direct',
        timestamp: 1000,
        description: 'Copilot chat response',
        state: 'thinking',
        direct: true,
        ...overrides,
    };
}
describe('ActivityStateMachine', () => {
    it('starts idle', () => {
        const machine = new activityStateMachine_1.ActivityStateMachine();
        assert.strictEqual(machine.getState(), 'idle');
    });
    it('enters thinking when a request starts', () => {
        const machine = new activityStateMachine_1.ActivityStateMachine();
        machine.apply(event());
        assert.strictEqual(machine.getState(), 'thinking');
    });
    it('enters coding when the activity is updated', () => {
        const machine = new activityStateMachine_1.ActivityStateMachine();
        machine.apply(event());
        machine.apply(event({ phase: 'updated', state: 'coding' }));
        assert.strictEqual(machine.getState(), 'coding');
    });
    it('shows success on completion and then returns to idle', () => {
        let now = 1000;
        const machine = new activityStateMachine_1.ActivityStateMachine(() => now);
        machine.apply(event());
        machine.apply(event({ phase: 'completed' }));
        assert.strictEqual(machine.getState(), 'success');
        now += 2000;
        assert.strictEqual(machine.getState(), 'idle');
    });
    it('does not fall back to idle while a newer activity is still running', () => {
        let now = 1000;
        const machine = new activityStateMachine_1.ActivityStateMachine(() => now);
        machine.apply(event({ id: 'first' }));
        machine.apply(event({ id: 'second', state: 'coding' }));
        machine.apply(event({ id: 'first', phase: 'completed' }));
        now += 2000;
        assert.strictEqual(machine.getState(), 'coding');
    });
    it('shows an error reaction on failure and recovers', () => {
        let now = 1000;
        const machine = new activityStateMachine_1.ActivityStateMachine(() => now);
        machine.apply(event());
        machine.apply(event({ phase: 'failed' }));
        assert.strictEqual(machine.getState(), 'error');
        now += 3000;
        assert.strictEqual(machine.getState(), 'idle');
    });
    it('ignores a completion for an unknown id', () => {
        const machine = new activityStateMachine_1.ActivityStateMachine();
        machine.apply(event({ id: 'live' }));
        const result = machine.apply(event({ id: 'ghost', phase: 'completed' }));
        assert.strictEqual(result, undefined);
        assert.strictEqual(machine.getState(), 'thinking');
    });
    it('ignores a stale completion that cannot end a newer activity', () => {
        const machine = new activityStateMachine_1.ActivityStateMachine();
        machine.apply(event({ id: 'old' }));
        machine.apply(event({ id: 'old', phase: 'completed' }));
        machine.apply(event({ id: 'new', state: 'coding' }));
        // A duplicate completion for the old id arrives late.
        const result = machine.apply(event({ id: 'old', phase: 'completed' }));
        assert.strictEqual(result, undefined);
        assert.strictEqual(machine.getState(), 'coding');
    });
    it('treats a duplicate start as idempotent', () => {
        const machine = new activityStateMachine_1.ActivityStateMachine();
        machine.apply(event());
        machine.apply(event());
        assert.strictEqual(machine.getActiveActivities().length, 1);
    });
    it('removes an activity on cancel without showing success', () => {
        const machine = new activityStateMachine_1.ActivityStateMachine();
        machine.apply(event());
        machine.apply(event({ phase: 'cancelled' }));
        assert.strictEqual(machine.getState(), 'idle');
        assert.strictEqual(machine.getActiveActivities().length, 0);
    });
    it('prefers a direct activity over an inferred one', () => {
        const machine = new activityStateMachine_1.ActivityStateMachine();
        machine.apply(event({ id: 'editor', confidence: 'inferred', direct: false, state: 'coding' }));
        machine.apply(event({ id: 'copilot', confidence: 'direct', direct: true, state: 'thinking' }));
        assert.strictEqual(machine.getState(), 'thinking');
    });
    it('prefers a direct activity over an inferred one in the same state', () => {
        const machine = new activityStateMachine_1.ActivityStateMachine();
        machine.apply(event({ id: 'editor', confidence: 'inferred', direct: false, state: 'coding' }));
        machine.apply(event({ id: 'copilot', confidence: 'direct', direct: true, state: 'coding' }));
        assert.strictEqual(machine.getPrimaryActivity()?.id, 'copilot');
        assert.strictEqual(machine.getPrimaryActivity()?.direct, true);
    });
    it('prefers a manual activity over a direct one', () => {
        const machine = new activityStateMachine_1.ActivityStateMachine();
        machine.apply(event({ id: 'copilot', confidence: 'direct', direct: true, state: 'coding' }));
        machine.apply(event({
            id: 'manual',
            confidence: 'manual',
            direct: false,
            source: 'manual',
            kind: 'manual',
            state: 'coding',
        }));
        assert.strictEqual(machine.getPrimaryActivity()?.id, 'manual');
    });
    it('keeps the error reaction above other activities', () => {
        const machine = new activityStateMachine_1.ActivityStateMachine();
        machine.apply(event({ id: 'copilot' }));
        machine.apply(event({ id: 'boom', phase: 'started', state: 'error' }));
        machine.apply(event({ id: 'boom', phase: 'failed' }));
        assert.strictEqual(machine.getState(), 'error');
    });
    it('expires only inferred activities', () => {
        const machine = new activityStateMachine_1.ActivityStateMachine();
        machine.apply(event({ id: 'inferred', confidence: 'inferred', direct: false, timestamp: 0 }));
        machine.apply(event({ id: 'direct', confidence: 'direct', timestamp: 0 }));
        const expired = machine.expireStale(1000, 5000);
        assert.strictEqual(expired.length, 1);
        assert.strictEqual(expired[0].id, 'inferred');
        assert.strictEqual(machine.getActiveActivities().length, 1);
    });
    it('resets every tracked activity', () => {
        const machine = new activityStateMachine_1.ActivityStateMachine();
        machine.apply(event());
        machine.reset();
        assert.strictEqual(machine.getState(), 'idle');
        assert.strictEqual(machine.getActiveActivities().length, 0);
    });
    it('reports the primary activity with the highest priority state', () => {
        const machine = new activityStateMachine_1.ActivityStateMachine();
        machine.apply(event({ id: 'a', state: 'reviewing' }));
        machine.apply(event({ id: 'b', state: 'waiting' }));
        const primary = machine.getPrimaryActivity();
        assert.strictEqual(primary?.id, 'b');
    });
    it('handles out-of-order updates for an unknown activity', () => {
        const machine = new activityStateMachine_1.ActivityStateMachine();
        const result = machine.apply(event({ phase: 'updated', id: 'never-started' }));
        assert.strictEqual(result, undefined);
        assert.strictEqual(machine.getState(), 'idle');
    });
    it('exposes every supported state as a valid transition target', () => {
        const states = [
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
        for (const state of states) {
            // A fresh machine per state, because several of these states are
            // overlays and would otherwise mask the next one.
            const machine = new activityStateMachine_1.ActivityStateMachine();
            machine.apply(event({ id: `id-${state}`, state }));
            assert.strictEqual(machine.getState(), state);
        }
    });
    it('keeps the sleeping state when nothing is active', () => {
        const machine = new activityStateMachine_1.ActivityStateMachine();
        machine.apply(event({ id: 's', state: 'sleeping', kind: 'manual', source: 'manual' }));
        assert.strictEqual(machine.getState(), 'sleeping');
    });
    it('returns to idle when the sleeping activity is cancelled', () => {
        const machine = new activityStateMachine_1.ActivityStateMachine();
        machine.apply(event({ id: 's', state: 'sleeping', kind: 'manual', source: 'manual' }));
        machine.apply(event({ id: 's', phase: 'cancelled', kind: 'manual', source: 'manual' }));
        assert.strictEqual(machine.getState(), 'idle');
    });
});
//# sourceMappingURL=activityStateMachine.test.js.map