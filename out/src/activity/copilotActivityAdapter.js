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
exports.ToolActivityAdapter = exports.CopilotActivityAdapter = void 0;
exports.buildEvent = buildEvent;
const vscode = __importStar(require("vscode"));
/**
 * Adapter for GitHub Copilot activity.
 *
 * IMPORTANT - what is actually observable:
 *
 * The stable VS Code extension API does **not** expose chat request or chat
 * response lifecycle events. There is no `onDidSubmitChatRequest`, no
 * `onDidChangeChatSession` and no Copilot-specific progress API in the
 * published `vscode` typings (verified against @types/vscode 1.85 and the
 * newest 1.140 release). Extensions are therefore unable to observe when
 * Copilot starts streaming a response, and are equally unable to observe a
 * genuine completion signal.
 *
 * What *is* observable through supported APIs:
 *
 *   1. The chat model registry changing (`vscode.chat.onDidChangeChatModels`),
 *      which happens when Copilot registers or switches the models it
 *      offers. This is a genuine, publicly documented signal that Copilot
 *      is installed and active in the window.
 *   2. Copilot's presence as an installed extension, which lets the UI say
 *      precisely which integration mode is active.
 *
 * Everything this adapter reports is therefore marked `direct: true` only
 * when it comes from an API that explicitly names Copilot. Generic editor
 * signals are handled by a separate adapter and are marked as inferred, so
 * the UI can always distinguish "Copilot told us" from "we guessed".
 */
class CopilotActivityAdapter {
    id = 'copilot';
    name = 'GitHub Copilot';
    copilotInstalled = false;
    copilotEnabled = false;
    chatModelsObserved = false;
    disposables = [];
    constructor() {
        this.copilotInstalled = this.detectCopilotExtension();
    }
    isAvailable() {
        // The adapter is "available" when Copilot is installed, because only then
        // do the Copilot-specific signals mean anything.
        return this.copilotInstalled;
    }
    getUnavailableReason() {
        if (this.copilotInstalled) {
            return undefined;
        }
        return 'GitHub Copilot is not installed in this window.';
    }
    /**
     * Extra detail used by the diagnostics view.
     */
    describeIntegration() {
        return {
            installed: this.copilotInstalled,
            enabled: this.copilotEnabled,
            chatModelsObserved: this.chatModelsObserved,
            // Always false: the stable API exposes no Copilot request lifecycle.
            directLifecycleEvents: false,
        };
    }
    activate(onEvent) {
        this.disposables.push(vscode.extensions.onDidChange(() => {
            this.copilotInstalled = this.detectCopilotExtension();
        }));
        // A supported, documented signal that the Copilot model registry
        // changed. This does not tell us a request started, so it is reported as
        // an update to a low-confidence activity rather than as a request.
        if (vscode.lm?.onDidChangeChatModels) {
            this.disposables.push(vscode.lm.onDidChangeChatModels(() => {
                this.chatModelsObserved = true;
                this.copilotEnabled = true;
                onEvent({
                    id: 'copilot-models',
                    kind: 'chat',
                    phase: 'updated',
                    source: 'copilot-chat',
                    confidence: 'direct',
                    timestamp: Date.now(),
                    description: 'Copilot model list changed',
                    state: 'thinking',
                    direct: true,
                });
            }));
        }
        return {
            dispose: () => {
                for (const disposable of this.disposables.splice(0)) {
                    disposable.dispose();
                }
            },
        };
    }
    detectCopilotExtension() {
        const candidates = [
            'github.copilot',
            'github.copilot-chat',
            'github.copilot-chat-ui',
        ];
        for (const id of candidates) {
            const extension = vscode.extensions.getExtension(id);
            if (extension) {
                return true;
            }
        }
        return false;
    }
}
exports.CopilotActivityAdapter = CopilotActivityAdapter;
/**
 * Adapter that watches for registered language-model tools being invoked.
 *
 * `vscode.lm.invokeTool` is a public API, but a third-party extension can
 * only observe tools it registers itself. Copilot's internal tools are not
 * exposed to other extensions, so this adapter reports the *availability* of
 * the tool API and creates a clearly-labelled activity when the user invokes
 * a tool that this extension itself registered.
 */
class ToolActivityAdapter {
    id = 'lm-tools';
    name = 'Language model tools';
    tools = new Map();
    onEvent;
    disposables = [];
    constructor(onEvent) {
        this.onEvent = onEvent;
    }
    isAvailable() {
        return typeof vscode.lm?.registerTool === 'function';
    }
    getUnavailableReason() {
        return this.isAvailable()
            ? undefined
            : 'The language model tool API is not available in this VS Code version.';
    }
    activate(onEvent) {
        this.onEvent = onEvent;
        return {
            dispose: () => {
                for (const disposable of this.disposables.splice(0)) {
                    disposable.dispose();
                }
                for (const disposable of this.tools.values()) {
                    disposable.dispose();
                }
                this.tools.clear();
            },
        };
    }
    /**
     * Registers a tool that reports its own execution as activity.
     *
     * This is the one way an extension can produce a genuinely
     * Copilot-attributable signal: the tool is invoked *by* the language
     * model, and VS Code routes that invocation to us.
     */
    registerTool(name, title) {
        if (!this.isAvailable() || this.tools.has(name)) {
            return;
        }
        const disposable = vscode.lm.registerTool(name, {
            prepareInvocation: () => ({
                invocationMessage: `Running ${title}`,
            }),
            invoke: () => {
                const id = `tool:${name}:${Date.now()}`;
                this.onEvent?.({
                    id,
                    kind: 'tool',
                    phase: 'started',
                    source: 'copilot-tools',
                    confidence: 'direct',
                    timestamp: Date.now(),
                    description: `Tool: ${title}`,
                    state: 'coding',
                    direct: true,
                });
                this.onEvent?.({
                    id,
                    kind: 'tool',
                    phase: 'completed',
                    source: 'copilot-tools',
                    confidence: 'direct',
                    timestamp: Date.now(),
                    description: `Tool: ${title}`,
                    state: 'coding',
                    direct: true,
                });
                return { content: [] };
            },
        });
        this.tools.set(name, disposable);
    }
}
exports.ToolActivityAdapter = ToolActivityAdapter;
/** Helper used by adapters that need to build well-formed events. */
function buildEvent(id, kind, phase, source, confidence, description, state, direct, timestamp = Date.now()) {
    return {
        id,
        kind,
        phase,
        source,
        confidence,
        description,
        state,
        direct,
        timestamp,
    };
}
//# sourceMappingURL=copilotActivityAdapter.js.map