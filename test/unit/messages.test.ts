import * as assert from 'assert';
import { validateWebviewMessage } from '../../src/protocol/messages';

describe('message validation', () => {
  it('accepts a request for the initial state', () => {
    const result = validateWebviewMessage({ type: 'requestInitialState' });
    assert.deepStrictEqual(result, { type: 'requestInitialState' });
  });

  it('accepts a valid manual state', () => {
    const result = validateWebviewMessage({ type: 'setManualState', state: 'thinking' });
    assert.deepStrictEqual(result, { type: 'setManualState', state: 'thinking' });
  });

  it('rejects an unknown manual state', () => {
    assert.strictEqual(
      validateWebviewMessage({ type: 'setManualState', state: 'evil' }),
      undefined
    );
  });

  it('rejects a missing manual state', () => {
    assert.strictEqual(validateWebviewMessage({ type: 'setManualState' }), undefined);
  });

  it('accepts a character id', () => {
    const result = validateWebviewMessage({ type: 'setCharacter', characterId: 'byte' });
    assert.deepStrictEqual(result, { type: 'setCharacter', characterId: 'byte' });
  });

  it('rejects an empty character id', () => {
    assert.strictEqual(
      validateWebviewMessage({ type: 'setCharacter', characterId: '' }),
      undefined
    );
  });

  it('rejects a non-string character id', () => {
    assert.strictEqual(
      validateWebviewMessage({ type: 'setCharacter', characterId: 42 }),
      undefined
    );
  });

  it('accepts an environment id', () => {
    const result = validateWebviewMessage({
      type: 'setEnvironment',
      environmentId: 'cozyDesk',
    });
    assert.deepStrictEqual(result, { type: 'setEnvironment', environmentId: 'cozyDesk' });
  });

  it('accepts a boolean animations flag', () => {
    const result = validateWebviewMessage({
      type: 'setAnimationsEnabled',
      enabled: false,
    });
    assert.deepStrictEqual(result, { type: 'setAnimationsEnabled', enabled: false });
  });

  it('rejects a non-boolean animations flag', () => {
    assert.strictEqual(
      validateWebviewMessage({ type: 'setAnimationsEnabled', enabled: 'yes' }),
      undefined
    );
  });

  it('accepts clearHistory', () => {
    assert.deepStrictEqual(validateWebviewMessage({ type: 'clearHistory' }), {
      type: 'clearHistory',
    });
  });

  it('accepts openSettings with and without a setting id', () => {
    assert.deepStrictEqual(validateWebviewMessage({ type: 'openSettings' }), {
      type: 'openSettings',
      settingId: undefined,
    });
    assert.deepStrictEqual(
      validateWebviewMessage({ type: 'openSettings', settingId: 'character' }),
      { type: 'openSettings', settingId: 'character' }
    );
  });

  it('truncates a long error report', () => {
    const result = validateWebviewMessage({
      type: 'reportError',
      message: 'x'.repeat(2000),
    });
    assert.strictEqual(result?.type, 'reportError');
    assert.strictEqual((result as { message: string }).message.length, 500);
  });

  it('rejects unknown message types', () => {
    assert.strictEqual(validateWebviewMessage({ type: 'doSomethingElse' }), undefined);
  });

  it('rejects non-object messages', () => {
    assert.strictEqual(validateWebviewMessage('hello'), undefined);
    assert.strictEqual(validateWebviewMessage(null), undefined);
    assert.strictEqual(validateWebviewMessage(undefined), undefined);
    assert.strictEqual(validateWebviewMessage(42), undefined);
  });

  it('rejects a message with no type', () => {
    assert.strictEqual(validateWebviewMessage({ foo: 'bar' }), undefined);
  });
});
