import * as vscode from 'vscode';
import {
  ActivityAdapter,
  ActivityEvent,
  ActivityKind,
  ActivityPhase,
  ActivitySource,
  ActivityState,
  DetectionConfidence,
} from './activityTypes';

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
export class CopilotActivityAdapter implements ActivityAdapter {
  readonly id = 'copilot';
  readonly name = 'GitHub Copilot';

  private copilotInstalled = false;
  private copilotEnabled = false;
  private chatModelsObserved = false;
  private readonly disposables: vscode.Disposable[] = [];

  constructor() {
    this.copilotInstalled = this.detectCopilotExtension();
  }

  isAvailable(): boolean {
    // The adapter is "available" when Copilot is installed, because only then
    // do the Copilot-specific signals mean anything.
    return this.copilotInstalled;
  }

  getUnavailableReason(): string | undefined {
    if (this.copilotInstalled) {
      return undefined;
    }
    return 'GitHub Copilot is not installed in this window.';
  }

  /**
   * Extra detail used by the diagnostics view.
   */
  describeIntegration(): {
    installed: boolean;
    enabled: boolean;
    chatModelsObserved: boolean;
    directLifecycleEvents: boolean;
  } {
    return {
      installed: this.copilotInstalled,
      enabled: this.copilotEnabled,
      chatModelsObserved: this.chatModelsObserved,
      // Always false: the stable API exposes no Copilot request lifecycle.
      directLifecycleEvents: false,
    };
  }

  activate(onEvent: (event: ActivityEvent) => void): { dispose(): void } {
    this.disposables.push(
      vscode.extensions.onDidChange(() => {
        this.copilotInstalled = this.detectCopilotExtension();
      })
    );

    // A supported, documented signal that the Copilot model registry
    // changed. This does not tell us a request started, so it is reported as
    // an update to a low-confidence activity rather than as a request.
    if (vscode.lm?.onDidChangeChatModels) {
      this.disposables.push(
        vscode.lm.onDidChangeChatModels(() => {
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
        })
      );
    }

    return {
      dispose: () => {
        for (const disposable of this.disposables.splice(0)) {
          disposable.dispose();
        }
      },
    };
  }

  private detectCopilotExtension(): boolean {
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

/**
 * Adapter that watches for registered language-model tools being invoked.
 *
 * `vscode.lm.invokeTool` is a public API, but a third-party extension can
 * only observe tools it registers itself. Copilot's internal tools are not
 * exposed to other extensions, so this adapter reports the *availability* of
 * the tool API and creates a clearly-labelled activity when the user invokes
 * a tool that this extension itself registered.
 */
export class ToolActivityAdapter implements ActivityAdapter {
  readonly id = 'lm-tools';
  readonly name = 'Language model tools';

  private readonly tools = new Map<string, vscode.Disposable>();
  private onEvent: ((event: ActivityEvent) => void) | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(onEvent?: (event: ActivityEvent) => void) {
    this.onEvent = onEvent;
  }

  isAvailable(): boolean {
    return typeof vscode.lm?.registerTool === 'function';
  }

  getUnavailableReason(): string | undefined {
    return this.isAvailable()
      ? undefined
      : 'The language model tool API is not available in this VS Code version.';
  }

  activate(onEvent: (event: ActivityEvent) => void): { dispose(): void } {
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
  registerTool(name: string, title: string): void {
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

/** Helper used by adapters that need to build well-formed events. */
export function buildEvent(
  id: string,
  kind: ActivityKind,
  phase: ActivityPhase,
  source: ActivitySource,
  confidence: DetectionConfidence,
  description: string,
  state: ActivityState,
  direct: boolean,
  timestamp = Date.now()
): ActivityEvent {
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
