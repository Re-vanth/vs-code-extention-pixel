'use strict';

/**
 * A minimal stand-in for the `vscode` module.
 *
 * The unit tests exercise logic that must run outside a VS Code host. Only
 * the small slice of the API those modules touch is implemented here.
 */

class Disposable {
  constructor(fn) {
    this._fn = fn;
  }
  dispose() {
    if (this._fn) {
      this._fn();
      this._fn = undefined;
    }
  }
  static from(...items) {
    return new Disposable(() => items.forEach((item) => item.dispose?.()));
  }
}

class EventEmitter {
  constructor() {
    this._listeners = [];
  }
  get event() {
    return (listener) => {
      this._listeners.push(listener);
      return new Disposable(() => {
        this._listeners = this._listeners.filter((item) => item !== listener);
      });
    };
  }
  fire(value) {
    for (const listener of [...this._listeners]) {
      listener(value);
    }
  }
  dispose() {
    this._listeners = [];
  }
}

const state = {
  configuration: {},
  configurationValues: new Map(),
};

const workspace = {
  getConfiguration(section) {
    return {
      get(key, fallback) {
        const full = `${section}.${key}`;
        if (state.configurationValues.has(full)) {
          return state.configurationValues.get(full);
        }
        return fallback;
      },
      update(key, value) {
        state.configurationValues.set(`${section}.${key}`, value);
        return Promise.resolve();
      },
      inspect(key) {
        return { defaultValue: state.configuration[`${section}.${key}`] };
      },
      onDidChangeConfiguration(listener) {
        return new Disposable(() => {});
      },
    };
  },
  workspaceFolders: undefined,
  onDidChangeTextDocument() {
    return new Disposable(() => {});
  },
  onDidSaveTextDocument() {
    return new Disposable(() => {});
  },
};

const window = {
  createOutputChannel() {
    return {
      appendLine() {},
      show() {},
      dispose() {},
    };
  },
  showWarningMessage() {
    return Promise.resolve(undefined);
  },
  showInformationMessage() {
    return Promise.resolve(undefined);
  },
  showErrorMessage() {
    return Promise.resolve(undefined);
  },
  showQuickPick() {
    return Promise.resolve(undefined);
  },
  createStatusBarItem() {
    return {
      text: '',
      tooltip: '',
      command: '',
      name: '',
      show() {},
      hide() {},
      dispose() {},
    };
  },
  onDidChangeActiveTextEditor() {
    return new Disposable(() => {});
  },
  registerWebviewViewProvider() {
    return new Disposable(() => {});
  },
};

module.exports = {
  Disposable,
  EventEmitter,
  workspace,
  window,
  ConfigurationTarget: { Global: 1, Workspace: 2 },
  StatusBarAlignment: { Left: 1, Right: 2 },
  extensions: {
    getExtension: () => undefined,
    onDidChange: () => new Disposable(() => {}),
  },
  lm: {},
  chat: {},
  commands: {
    registerCommand: () => new Disposable(() => {}),
    executeCommand: () => Promise.resolve(undefined),
  },
  Uri: {
    joinPath: () => ({ fsPath: '' }),
  },
  __state: state,
};
