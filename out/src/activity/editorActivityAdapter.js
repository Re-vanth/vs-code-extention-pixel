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
exports.EditorActivityAdapter = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Adapter for generic editor and workspace activity.
 *
 * IMPORTANT - these are *inferred* signals, not proof that Copilot did
 * anything. A document change might be the developer typing; a task might be
 * a build started by hand. Every event this adapter emits is therefore marked
 * `confidence: 'inferred'` and `direct: false`, and the UI labels it as
 * inferred so the user is never told Copilot is working when all we know is
 * that *something* changed in the editor.
 */
class EditorActivityAdapter {
    id = 'editor';
    name = 'Editor activity (inferred)';
    disposables = [];
    debounce;
    editCounter = 0;
    activityId = 'editor-activity';
    isAvailable() {
        return true;
    }
    getUnavailableReason() {
        return undefined;
    }
    activate(onEvent) {
        this.disposables.push(vscode.workspace.onDidChangeTextDocument((event) => {
            // Ignore changes the extension itself made - there are none today,
            // but the guard keeps the adapter honest if that changes.
            if (event.document.uri.scheme === 'output') {
                return;
            }
            this.scheduleEditActivity(onEvent);
        }));
        this.disposables.push(vscode.window.onDidChangeActiveTextEditor(() => {
            this.emit(onEvent, 'Switched to another editor', 'reviewing', 'vscode-editor');
        }));
        this.disposables.push(vscode.workspace.onDidSaveTextDocument(() => {
            this.emit(onEvent, 'File saved', 'coding', 'vscode-workspace');
        }));
        return {
            dispose: () => {
                for (const disposable of this.disposables.splice(0)) {
                    disposable.dispose();
                }
                if (this.debounce) {
                    clearTimeout(this.debounce);
                    this.debounce = undefined;
                }
            },
        };
    }
    /**
     * Coalesces rapid document edits into a single activity so a burst of
     * keystrokes does not spam the timeline.
     */
    scheduleEditActivity(onEvent) {
        if (this.debounce) {
            clearTimeout(this.debounce);
        }
        this.debounce = setTimeout(() => {
            this.debounce = undefined;
            this.editCounter += 1;
            this.emit(onEvent, 'Editor content changed', 'coding', 'vscode-editor', this.editCounter);
        }, 700);
    }
    emit(onEvent, description, state, source, counter) {
        onEvent({
            id: counter === undefined ? this.activityId : `${this.activityId}:${counter}`,
            kind: 'edit',
            phase: counter === undefined ? 'started' : 'started',
            source,
            confidence: 'inferred',
            timestamp: Date.now(),
            description,
            state,
            direct: false,
        });
    }
}
exports.EditorActivityAdapter = EditorActivityAdapter;
//# sourceMappingURL=editorActivityAdapter.js.map