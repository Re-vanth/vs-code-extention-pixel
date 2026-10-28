import * as vscode from 'vscode';
import { ActivityState, STATE_LABELS } from '../activity/activityTypes';
import { ActivityManager } from '../activity/activityManager';

/**
 * The optional status bar item.
 *
 * The item always reflects *observed* activity. It never claims to expose
 * internal Copilot state: the tooltip spells out whether the current state
 * was directly observed or inferred.
 */
export class StatusBarManager implements vscode.Disposable {
  private item: vscode.StatusBarItem | undefined;
  private readonly subscriptions: vscode.Disposable[] = [];

  constructor(
    private readonly activityManager: ActivityManager,
    private readonly getCharacterName: () => string
  ) {
    this.subscriptions.push(
      this.activityManager.onDidChangeActivity(() => this.update())
    );
  }

  /** Creates the status bar item if it does not exist yet. */
  create(): void {
    if (this.item) {
      return;
    }
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.item.name = 'Copilot Pixel Companion';
    this.item.command = 'copilotPixelCompanion.show';
    this.update();
    this.item.show();
  }

  /** Removes the status bar item. */
  dispose(): void {
    for (const subscription of this.subscriptions.splice(0)) {
      subscription.dispose();
    }
    this.item?.dispose();
    this.item = undefined;
  }

  /** Refreshes the item's text, tooltip and icon. */
  update(): void {
    if (!this.item) {
      return;
    }

    const state = this.activityManager.getState();
    const primary = this.activityManager.getPrimaryActivity();
    const name = this.getCharacterName();

    this.item.text = `${this.iconFor(state)} ${name}: ${STATE_LABELS[state]}`;

    const lines = [
      `${name} is ${STATE_LABELS[state].toLowerCase()}.`,
      primary
        ? `Source: ${primary.source}`
        : 'No activity is currently being observed.',
      primary?.direct
        ? 'This state comes from a directly observed Copilot signal.'
        : primary
          ? 'This state is inferred from general editor activity and is not proof of Copilot activity.'
          : 'No Copilot activity signal is available in this VS Code version.',
    ];
    this.item.tooltip = lines.join('\n');
  }

  private iconFor(state: ActivityState): string {
    switch (state) {
      case 'thinking':
      case 'typing':
      case 'coding':
        return '$(sync~spin)';
      case 'success':
        return '$(check)';
      case 'error':
        return '$(warning)';
      case 'waiting':
        return '$(question)';
      case 'paused':
        return '$(debug-pause)';
      case 'sleeping':
        return '$(moon)';
      default:
        return '$(heart)';
    }
  }
}
