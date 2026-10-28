"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALID_ACTIVITY_STATES = void 0;
exports.validateWebviewMessage = validateWebviewMessage;
const ACTIVITY_STATES = [
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
function validateWebviewMessage(message) {
    if (!message || typeof message !== 'object') {
        return undefined;
    }
    const candidate = message;
    switch (candidate.type) {
        case 'requestInitialState':
            return { type: 'requestInitialState' };
        case 'setManualState':
            if (typeof candidate.state === 'string' &&
                ACTIVITY_STATES.includes(candidate.state)) {
                return { type: 'setManualState', state: candidate.state };
            }
            return undefined;
        case 'setCharacter':
            if (typeof candidate.characterId === 'string' && candidate.characterId.length > 0) {
                return { type: 'setCharacter', characterId: candidate.characterId };
            }
            return undefined;
        case 'setEnvironment':
            if (typeof candidate.environmentId === 'string' &&
                candidate.environmentId.length > 0) {
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
                settingId: typeof candidate.settingId === 'string' ? candidate.settingId : undefined,
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
exports.VALID_ACTIVITY_STATES = ACTIVITY_STATES;
//# sourceMappingURL=messages.js.map