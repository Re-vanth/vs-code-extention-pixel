"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityStateMachine = void 0;
const activityTypes_1 = require("./activityTypes");
/**
 * Deterministic state machine that turns a stream of activity events into a
 * single character state.
 *
 * Design rules:
 *   - Events are correlated by `id`. A completion for an unknown id is
 *     ignored rather than being allowed to end an unrelated activity.
 *   - A stale completion (an id that already finished) can never terminate a
 *     newer activity, because ids are unique per operation.
 *   - Duplicate events are idempotent.
 *   - `success` is an overlay, not a resting state: it is applied for a
 *     bounded time and then the machine falls back to whatever activity is
 *     still live.
 *   - `error` is also an overlay: it does not permanently lock the character.
 */
class ActivityStateMachine {
    now;
    activities = new Map();
    overlay;
    lastEventAt = 0;
    constructor(now = () => Date.now()) {
        this.now = now;
    }
    /** The state the character should currently be in. */
    getState() {
        if (this.overlay && this.overlay.until <= this.now()) {
            this.overlay = undefined;
        }
        if (this.overlay) {
            return this.overlay.state;
        }
        return this.deriveState();
    }
    /** Timestamp of the most recent accepted event. */
    getLastEventAt() {
        return this.lastEventAt;
    }
    /** All currently live activities. */
    getActiveActivities() {
        return [...this.activities.values()];
    }
    /** The live activity that currently drives the character, if any. */
    getPrimaryActivity() {
        let best;
        for (const activity of this.activities.values()) {
            if (!best) {
                best = activity;
                continue;
            }
            const score = (0, activityTypes_1.activityScore)(activity.state, activity.confidence) -
                (0, activityTypes_1.activityScore)(best.state, best.confidence);
            if (score > 0) {
                best = activity;
            }
            else if (score === 0 && activity.startedAt > best.startedAt) {
                best = activity;
            }
        }
        return best;
    }
    /**
     * Applies an event.
     *
     * @returns the resulting state, or `undefined` when the event was a
     * duplicate or was not applicable.
     */
    apply(event) {
        this.lastEventAt = Math.max(this.lastEventAt, event.timestamp);
        switch (event.phase) {
            case 'started':
                return this.onStarted(event);
            case 'updated':
                return this.onUpdated(event);
            case 'completed':
                return this.onCompleted(event);
            case 'failed':
                return this.onFailed(event);
            case 'cancelled':
                return this.onCancelled(event);
            case 'unknown':
                return this.onUpdated(event);
            default:
                return undefined;
        }
    }
    onStarted(event) {
        const existing = this.activities.get(event.id);
        if (existing) {
            // Duplicate start: refresh the description but keep the original start
            // time so elapsed time stays meaningful.
            this.activities.set(event.id, { ...existing, description: event.description });
            return this.getState();
        }
        this.activities.set(event.id, {
            id: event.id,
            kind: event.kind,
            source: event.source,
            confidence: event.confidence,
            state: event.state,
            startedAt: event.timestamp,
            description: event.description,
            direct: event.direct,
        });
        // A fresh activity takes the character back: a success or error reaction
        // for an earlier operation must not mask work that is starting now.
        if (event.state !== 'error' && this.overlay) {
            this.overlay = undefined;
        }
        return this.getState();
    }
    onUpdated(event) {
        const existing = this.activities.get(event.id);
        if (!existing) {
            return undefined;
        }
        this.activities.set(event.id, {
            ...existing,
            state: event.state,
            description: event.description,
        });
        return this.getState();
    }
    onCompleted(event) {
        const existing = this.activities.get(event.id);
        if (!existing) {
            // Unknown or already-finished id: nothing to close. Crucially this
            // cannot end a newer activity.
            return undefined;
        }
        this.activities.delete(event.id);
        this.showOverlay('success');
        return this.getState();
    }
    onFailed(event) {
        const existing = this.activities.get(event.id);
        if (!existing) {
            return undefined;
        }
        this.activities.delete(event.id);
        this.showOverlay('error');
        return this.getState();
    }
    onCancelled(event) {
        const existed = this.activities.delete(event.id);
        if (!existed) {
            return undefined;
        }
        return this.getState();
    }
    /**
     * Shows a temporary overlay.
     *
     * @param duration how long the overlay lasts in milliseconds
     */
    showOverlay(state, at = this.now(), duration = state === 'success' ? 1600 : 2600) {
        this.overlay = { state, until: at + duration };
    }
    /** Clears every tracked activity and overlay. */
    reset() {
        this.activities.clear();
        this.overlay = undefined;
    }
    /**
     * Removes every inferred activity.
     *
     * Used when the user turns inferred activity off: the character should
     * stop reacting to generic editor signals immediately, not when the
     * existing ones happen to expire.
     */
    dropInferred() {
        const dropped = [];
        for (const [id, activity] of this.activities) {
            if (activity.confidence === 'inferred') {
                dropped.push(activity);
                this.activities.delete(id);
            }
        }
        return dropped;
    }
    /**
     * Removes activities that started longer than `maxAgeMs` ago.
     *
     * This only expires *inferred* activity. A directly observed operation is
     * left alone until it reports its own completion, because a timeout is
     * never evidence that a task finished.
     */
    expireStale(maxAgeMs, at = this.now()) {
        const expired = [];
        for (const [id, activity] of this.activities) {
            if (activity.confidence === 'inferred' && at - activity.startedAt > maxAgeMs) {
                expired.push(activity);
                this.activities.delete(id);
            }
        }
        return expired;
    }
    deriveState() {
        const primary = this.getPrimaryActivity();
        if (!primary) {
            return 'idle';
        }
        return primary.state;
    }
}
exports.ActivityStateMachine = ActivityStateMachine;
//# sourceMappingURL=activityStateMachine.js.map