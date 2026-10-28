import * as vscode from 'vscode';

/**
 * Small logger that writes to a VS Code output channel.
 *
 * Repeated identical messages are collapsed so a failing optional
 * integration cannot flood the log.
 */
export class Logger implements vscode.Disposable {
  private readonly channel: vscode.OutputChannel;
  private readonly seen = new Set<string>();

  constructor(name: string) {
    this.channel = vscode.window.createOutputChannel(name);
  }

  info(message: string): void {
    this.channel.appendLine(`[info] ${message}`);
  }

  warn(message: string): void {
    this.channel.appendLine(`[warn] ${message}`);
  }

  /** Logs an error once per distinct message. */
  error(message: string, error?: unknown): void {
    const key = `${message}:${error instanceof Error ? error.message : ''}`;
    if (this.seen.has(key)) {
      return;
    }
    this.seen.add(key);
    this.channel.appendLine(`[error] ${message}`);
    if (error instanceof Error && error.stack) {
      this.channel.appendLine(error.stack);
    }
  }

  show(): void {
    this.channel.show(true);
  }

  dispose(): void {
    this.channel.dispose();
  }
}
