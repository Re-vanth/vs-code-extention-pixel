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
const messages_1 = require("../../src/protocol/messages");
describe('message validation', () => {
    it('accepts a request for the initial state', () => {
        const result = (0, messages_1.validateWebviewMessage)({ type: 'requestInitialState' });
        assert.deepStrictEqual(result, { type: 'requestInitialState' });
    });
    it('accepts a valid manual state', () => {
        const result = (0, messages_1.validateWebviewMessage)({ type: 'setManualState', state: 'thinking' });
        assert.deepStrictEqual(result, { type: 'setManualState', state: 'thinking' });
    });
    it('rejects an unknown manual state', () => {
        assert.strictEqual((0, messages_1.validateWebviewMessage)({ type: 'setManualState', state: 'evil' }), undefined);
    });
    it('rejects a missing manual state', () => {
        assert.strictEqual((0, messages_1.validateWebviewMessage)({ type: 'setManualState' }), undefined);
    });
    it('accepts a character id', () => {
        const result = (0, messages_1.validateWebviewMessage)({ type: 'setCharacter', characterId: 'byte' });
        assert.deepStrictEqual(result, { type: 'setCharacter', characterId: 'byte' });
    });
    it('rejects an empty character id', () => {
        assert.strictEqual((0, messages_1.validateWebviewMessage)({ type: 'setCharacter', characterId: '' }), undefined);
    });
    it('rejects a non-string character id', () => {
        assert.strictEqual((0, messages_1.validateWebviewMessage)({ type: 'setCharacter', characterId: 42 }), undefined);
    });
    it('accepts an environment id', () => {
        const result = (0, messages_1.validateWebviewMessage)({
            type: 'setEnvironment',
            environmentId: 'cozyDesk',
        });
        assert.deepStrictEqual(result, { type: 'setEnvironment', environmentId: 'cozyDesk' });
    });
    it('accepts a boolean animations flag', () => {
        const result = (0, messages_1.validateWebviewMessage)({
            type: 'setAnimationsEnabled',
            enabled: false,
        });
        assert.deepStrictEqual(result, { type: 'setAnimationsEnabled', enabled: false });
    });
    it('rejects a non-boolean animations flag', () => {
        assert.strictEqual((0, messages_1.validateWebviewMessage)({ type: 'setAnimationsEnabled', enabled: 'yes' }), undefined);
    });
    it('accepts clearHistory', () => {
        assert.deepStrictEqual((0, messages_1.validateWebviewMessage)({ type: 'clearHistory' }), {
            type: 'clearHistory',
        });
    });
    it('accepts openSettings with and without a setting id', () => {
        assert.deepStrictEqual((0, messages_1.validateWebviewMessage)({ type: 'openSettings' }), {
            type: 'openSettings',
            settingId: undefined,
        });
        assert.deepStrictEqual((0, messages_1.validateWebviewMessage)({ type: 'openSettings', settingId: 'character' }), { type: 'openSettings', settingId: 'character' });
    });
    it('truncates a long error report', () => {
        const result = (0, messages_1.validateWebviewMessage)({
            type: 'reportError',
            message: 'x'.repeat(2000),
        });
        assert.strictEqual(result?.type, 'reportError');
        assert.strictEqual(result.message.length, 500);
    });
    it('rejects unknown message types', () => {
        assert.strictEqual((0, messages_1.validateWebviewMessage)({ type: 'doSomethingElse' }), undefined);
    });
    it('rejects non-object messages', () => {
        assert.strictEqual((0, messages_1.validateWebviewMessage)('hello'), undefined);
        assert.strictEqual((0, messages_1.validateWebviewMessage)(null), undefined);
        assert.strictEqual((0, messages_1.validateWebviewMessage)(undefined), undefined);
        assert.strictEqual((0, messages_1.validateWebviewMessage)(42), undefined);
    });
    it('rejects a message with no type', () => {
        assert.strictEqual((0, messages_1.validateWebviewMessage)({ foo: 'bar' }), undefined);
    });
});
//# sourceMappingURL=messages.test.js.map