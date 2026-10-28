import * as vscode from 'vscode';
import {
  ActivityAdapter,
  ActivityEvent,
  ActivityState,
} from './activityTypes';

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
export class EditorActivityAdapter implements ActivityAdapter {
  readonly id = 'editor';
  readonly name = 'Editor activity (inferred)';

  private readonly disposables: vscode.Disposable[] = [];
  private debounce: NodeJS.Timeout | undefined;
  private editCounter = 0;
  private readonly activityId = 'editor-activity';

  isAvailable(): boolean {
    return true;
  }

  getUnavailableReason(): string | undefined {
    return undefined;
  }

  activate(onEvent: (event: ActivityEvent) => void): { dispose(): void } {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        // Ignore changes the extension itself made - there are none today,
        // but the guard keeps the adapter honest if that changes.
        if (event.document.uri.scheme === 'output') {
          return;
        }
        this.scheduleEditActivity(onEvent);
      })
    );

    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.emit(
          onEvent,
          'Switched to another editor',
          'reviewing',
          'vscode-editor'
        );
      })
    );

    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument(() => {
        this.emit(
          onEvent,
          'File saved',
          'coding',
          'vscode-workspace'
        );
      })
    );

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
  private scheduleEditActivity(onEvent: (event: ActivityEvent) => void): void {
    if (this.debounce) {
      clearTimeout(this.debounce);
    }
    this.debounce = setTimeout(() => {
      this.debounce = undefined;
      this.editCounter += 1;
      this.emit(
        onEvent,
        'Editor content changed',
        'coding',
        'vscode-editor',
        this.editCounter
      );
    }, 700);
  }

  private emit(
    onEvent: (event: ActivityEvent) => void,
    description: string,
    state: ActivityState,
    source: 'vscode-editor' | 'vscode-workspace',
    counter?: number
  ): void {
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
