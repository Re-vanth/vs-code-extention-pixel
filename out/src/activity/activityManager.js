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
exports.ActivityManager = void 0;
const vscode = __importStar(require("vscode"));
const activityStateMachine_1 = require("./activityStateMachine");
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
class ActivityManager {
    machine;
    adapters = [];
    subscriptions = [];
    history = [];
    stateEmitter = new vscode.EventEmitter();
    historyEmitter = new vscode.EventEmitter();
    maxHistory = 20;
    timeoutSeconds = 30;
    timeoutTimer;
    /** When false, inferred activity is dropped before it reaches the machine. */
    allowInferred = true;
    /** When true, only manual activity is accepted. */
    manualOnly = false;
    /** Local storage used to keep the timeline between sessions. */
    storage;
    persist = false;
    constructor(adapters) {
        this.adapters = adapters;
        this.machine = new activityStateMachine_1.ActivityStateMachine();
    }
    /** Fires for every accepted activity event. */
    onDidChangeActivity = this.stateEmitter.event;
    /** Fires whenever the timeline changes. */
    onDidChangeHistory = this.historyEmitter.event;
    /** Starts every adapter and wires their events into the state machine. */
    activate() {
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
    getState() {
        return this.machine.getState();
    }
    /** The activity currently driving the character. */
    getPrimaryActivity() {
        return this.machine.getPrimaryActivity();
    }
    /** All live activities. */
    getActiveActivities() {
        return this.machine.getActiveActivities();
    }
    /** The bounded timeline, newest first. */
    getHistory() {
        return [...this.history].reverse();
    }
    /** Availability of every adapter, for the diagnostics view. */
    getAdapterAvailability() {
        return this.adapters.map((adapter) => ({
            id: adapter.id,
            name: adapter.name,
            available: adapter.isAvailable(),
            reason: adapter.getUnavailableReason?.(),
        }));
    }
    /** Clears the timeline. */
    clearHistory() {
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
    async setPersistence(enabled, storage) {
        this.storage = storage;
        this.persist = enabled;
        if (!enabled) {
            await this.storage?.update(HISTORY_KEY, []);
            return;
        }
        const stored = this.storage?.get(HISTORY_KEY, []);
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
    applySettings(maxHistory, timeoutSeconds) {
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
    setDetectionMode(allowInferred, manualOnly) {
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
    handleEvent(event) {
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
    accepts(event) {
        if (this.manualOnly) {
            return event.confidence === 'manual';
        }
        if (!this.allowInferred && event.confidence === 'inferred') {
            return false;
        }
        return true;
    }
    toHistoryEntry(event) {
        return {
            id: `${event.id}:${event.phase}:${event.timestamp}`,
            timestamp: event.timestamp,
            label: event.description,
            source: event.source,
            confidence: event.confidence,
            direct: event.direct,
        };
    }
    pushHistory(entry) {
        this.history.push(entry);
        while (this.history.length > this.maxHistory) {
            this.history.shift();
        }
        this.historyEmitter.fire();
        if (this.persist && this.storage) {
            void this.storage.update(HISTORY_KEY, [...this.history]);
        }
    }
    dispose() {
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
exports.ActivityManager = ActivityManager;
//# sourceMappingURL=activityManager.js.map