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
const activityManager_1 = require("../../src/activity/activityManager");
/**
 * A configurable adapter used to drive the manager in tests.
 */
class FakeAdapter {
    id;
    name;
    available = true;
    reason;
    sink;
    constructor(id = 'fake', name = 'Fake adapter') {
        this.id = id;
        this.name = name;
    }
    isAvailable() {
        return this.available;
    }
    getUnavailableReason() {
        return this.reason;
    }
    activate(onEvent) {
        this.sink = onEvent;
        return { dispose: () => (this.sink = undefined) };
    }
    emit(event) {
        this.sink?.(event);
    }
}
function makeEvent(overrides = {}) {
    return {
        id: 'a1',
        kind: 'chat',
        phase: 'started',
        source: 'copilot-chat',
        confidence: 'direct',
        timestamp: Date.now(),
        description: 'Copilot chat response',
        state: 'thinking',
        direct: true,
        ...overrides,
    };
}
describe('ActivityManager', () => {
    it('starts with no active activities', () => {
        const adapter = new FakeAdapter();
        const manager = new activityManager_1.ActivityManager([adapter]);
        assert.strictEqual(manager.getState(), 'idle');
        manager.dispose();
    });
    it('applies an event from an adapter', () => {
        const adapter = new FakeAdapter();
        const manager = new activityManager_1.ActivityManager([adapter]);
        manager.activate();
        adapter.emit(makeEvent());
        assert.strictEqual(manager.getState(), 'thinking');
        manager.dispose();
    });
    it('records events in the timeline, newest first', () => {
        const adapter = new FakeAdapter();
        const manager = new activityManager_1.ActivityManager([adapter]);
        manager.activate();
        adapter.emit(makeEvent({ id: 'first', description: 'First' }));
        adapter.emit(makeEvent({ id: 'second', description: 'Second' }));
        const history = manager.getHistory();
        assert.strictEqual(history[0].label, 'Second');
        assert.strictEqual(history.length, 2);
        manager.dispose();
    });
    it('bounds the timeline to the configured maximum', () => {
        const adapter = new FakeAdapter();
        const manager = new activityManager_1.ActivityManager([adapter]);
        manager.applySettings(3, 30);
        manager.activate();
        for (let i = 0; i < 10; i++) {
            adapter.emit(makeEvent({ id: `id-${i}`, description: `Event ${i}` }));
        }
        assert.strictEqual(manager.getHistory().length, 3);
        manager.dispose();
    });
    it('clears the timeline', () => {
        const adapter = new FakeAdapter();
        const manager = new activityManager_1.ActivityManager([adapter]);
        manager.activate();
        adapter.emit(makeEvent());
        manager.clearHistory();
        assert.strictEqual(manager.getHistory().length, 0);
        manager.dispose();
    });
    it('reports adapter availability and reasons', () => {
        const available = new FakeAdapter();
        const unavailable = new FakeAdapter('off', 'Unavailable adapter');
        unavailable.available = false;
        unavailable.reason = 'Not installed';
        const manager = new activityManager_1.ActivityManager([available, unavailable]);
        const status = manager.getAdapterAvailability();
        assert.strictEqual(status.length, 2);
        assert.strictEqual(status[0].available, true);
        assert.strictEqual(status[1].available, false);
        assert.strictEqual(status[1].reason, 'Not installed');
        manager.dispose();
    });
    it('does not activate an unavailable adapter', () => {
        const adapter = new FakeAdapter();
        adapter.available = false;
        const manager = new activityManager_1.ActivityManager([adapter]);
        manager.activate();
        adapter.emit(makeEvent());
        assert.strictEqual(manager.getState(), 'idle');
        manager.dispose();
    });
    it('notifies listeners when the state changes', () => {
        const adapter = new FakeAdapter();
        const manager = new activityManager_1.ActivityManager([adapter]);
        manager.activate();
        let notifications = 0;
        manager.onDidChangeActivity(() => {
            notifications += 1;
        });
        adapter.emit(makeEvent());
        assert.strictEqual(notifications, 1);
        manager.dispose();
    });
    it('does not notify listeners for an ignored event', () => {
        const adapter = new FakeAdapter();
        const manager = new activityManager_1.ActivityManager([adapter]);
        manager.activate();
        let notifications = 0;
        manager.onDidChangeActivity(() => {
            notifications += 1;
        });
        adapter.emit(makeEvent({ id: 'unknown', phase: 'completed' }));
        assert.strictEqual(notifications, 0);
        manager.dispose();
    });
    it('stops receiving events after disposal', () => {
        const adapter = new FakeAdapter();
        const manager = new activityManager_1.ActivityManager([adapter]);
        manager.activate();
        manager.dispose();
        adapter.emit(makeEvent());
        assert.strictEqual(manager.getState(), 'idle');
    });
    it('drops inferred activity when inferred detection is turned off', () => {
        const adapter = new FakeAdapter();
        const manager = new activityManager_1.ActivityManager([adapter]);
        manager.activate();
        manager.setDetectionMode(false, false);
        adapter.emit(makeEvent({ id: 'e1', confidence: 'inferred', direct: false }));
        assert.strictEqual(manager.getState(), 'idle');
        manager.dispose();
    });
    it('keeps direct activity when inferred detection is turned off', () => {
        const adapter = new FakeAdapter();
        const manager = new activityManager_1.ActivityManager([adapter]);
        manager.activate();
        manager.setDetectionMode(false, false);
        adapter.emit(makeEvent({ id: 'd1', confidence: 'direct' }));
        assert.strictEqual(manager.getState(), 'thinking');
        manager.dispose();
    });
    it('accepts only manual activity in manual mode', () => {
        const adapter = new FakeAdapter();
        const manager = new activityManager_1.ActivityManager([adapter]);
        manager.activate();
        manager.setDetectionMode(true, true);
        adapter.emit(makeEvent({ id: 'd1', confidence: 'direct' }));
        assert.strictEqual(manager.getState(), 'idle');
        adapter.emit(makeEvent({
            id: 'm1',
            confidence: 'manual',
            direct: false,
            source: 'manual',
            state: 'coding',
        }));
        assert.strictEqual(manager.getState(), 'coding');
        manager.dispose();
    });
    it('drops live inferred activities when inferred detection is turned off', () => {
        const adapter = new FakeAdapter();
        const manager = new activityManager_1.ActivityManager([adapter]);
        manager.activate();
        adapter.emit(makeEvent({ id: 'e1', confidence: 'inferred', direct: false, state: 'coding' }));
        assert.strictEqual(manager.getState(), 'coding');
        manager.setDetectionMode(false, false);
        assert.strictEqual(manager.getState(), 'idle');
        assert.strictEqual(manager.getActiveActivities().length, 0);
        manager.dispose();
    });
});
//# sourceMappingURL=activityManager.test.js.map