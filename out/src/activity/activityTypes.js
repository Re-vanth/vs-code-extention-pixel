"use strict";
/**
 * Normalized activity vocabulary shared by every activity adapter.
 *
 * Adapters observe different VS Code surfaces and translate them into this
 * one vocabulary. Nothing below the adapter layer knows how detection works.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATE_MESSAGES = exports.STATE_LABELS = exports.MANUAL_CONFIDENCE_BONUS = exports.DIRECT_CONFIDENCE_BONUS = exports.ACTIVITY_PRIORITY = void 0;
exports.activityScore = activityScore;
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
exports.ACTIVITY_PRIORITY = {
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
exports.DIRECT_CONFIDENCE_BONUS = 5;
/** A small bonus applied to activities the user asked for. */
exports.MANUAL_CONFIDENCE_BONUS = 15;
/**
 * Scores an activity for the priority comparison.
 *
 * @param state the character state the activity maps to
 * @param confidence how the activity was detected
 */
function activityScore(state, confidence) {
    let score = exports.ACTIVITY_PRIORITY[state];
    if (confidence === 'direct') {
        score += exports.DIRECT_CONFIDENCE_BONUS;
    }
    else if (confidence === 'manual') {
        score += exports.MANUAL_CONFIDENCE_BONUS;
    }
    return score;
}
/** Human-readable labels for each state. */
exports.STATE_LABELS = {
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
exports.STATE_MESSAGES = {
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
//# sourceMappingURL=activityTypes.js.map