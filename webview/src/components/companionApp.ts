import { Animation, AnimationController } from '../renderer/animationController';
import { ParticleSystem } from '../renderer/particleSystem';
import { SpriteRenderer, SpriteSheet } from '../renderer/spriteRenderer';

/** Mirrors the extension-side activity states. */
export type ActivityState =
  | 'idle'
  | 'thinking'
  | 'typing'
  | 'coding'
  | 'reviewing'
  | 'waiting'
  | 'success'
  | 'error'
  | 'paused'
  | 'sleeping'
  | 'unknown';

export interface CharacterAssets {
  characterId: string;
  characterName: string;
  frameWidth: number;
  frameHeight: number;
  assets: Record<string, string>;
  /** Loop length in milliseconds for each animation, keyed by state name. */
  timings: Record<string, number>;
  /** Whether each animation repeats, keyed by state name. */
  loops: Record<string, boolean>;
}

export interface ActivityPayload {
  state: ActivityState;
  statusText: string;
  activityLabel: string;
  sourceLabel: string;
  elapsedMs: number;
  isDirect: boolean;
  confidence: string;
}

export interface ConfigurationPayload {
  animationsEnabled: boolean;
  animationSpeed: number;
  characterSize: string;
  reducedMotion: boolean;
  manualMode: boolean;
  showStatusBar: boolean;
  showElapsedTime: boolean;
  showTimeline: boolean;
  showDetails: boolean;
}

export interface TimelineEntry {
  id: string;
  timestamp: number;
  label: string;
  source: string;
  confidence: string;
  direct: boolean;
}

export interface AdapterInfo {
  id: string;
  name: string;
  available: boolean;
  reason?: string;
}

/** The VS Code webview API, declared locally so the webview stays standalone. */
interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const CHARACTER_SIZE_PX: Record<string, number> = {
  small: 72,
  medium: 104,
  large: 144,
};

/**
 * The companion webview application.
 *
 * It renders the character, the status line, the timeline and the controls.
 * It never infers activity on its own: every state it shows comes from the
 * extension host.
 */
export class CompanionApp {
  private readonly vscode: VsCodeApi;
  private spriteRenderer!: SpriteRenderer;
  private readonly animation = new AnimationController();
  private readonly particles = new ParticleSystem();

  private readonly root: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private context!: CanvasRenderingContext2D;

  private sheets = new Map<string, SpriteSheet>();
  private timings: Record<string, number> = {};
  private loops: Record<string, boolean> = {};
  private activity: ActivityPayload | undefined;
  private config: ConfigurationPayload | undefined;
  private entries: TimelineEntry[] = [];
  private adapters: AdapterInfo[] = [];

  private running = false;
  private lastFrameTime = 0;
  private rafId: number | undefined;
  private elapsedTimer: number | undefined;
  private lastParticleState: ActivityState | undefined;
  private diagnosticsOpen = false;

  constructor(root: HTMLElement) {
    this.root = root;
    this.vscode = acquireVsCodeApi();
  }

  /** Builds the DOM and starts listening for extension messages. */
  initialize(): void {
    this.root.innerHTML = this.template();
    this.canvas = this.root.querySelector('#cpc-canvas') as HTMLCanvasElement;
    this.context = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    this.spriteRenderer = new SpriteRenderer(this.context);

    this.bindControls();
    this.bindMessages();

    window.addEventListener('message', (event: MessageEvent) => {
      this.handleMessage(event.data);
    });

    this.vscode.postMessage({ type: 'requestInitialState' });
  }

  private template(): string {
    return `
<div class="cpc">
  <header class="cpc-header">
    <span class="cpc-logo" aria-hidden="true"></span>
    <span class="cpc-name" id="cpc-name">Companion</span>
    <span class="cpc-badge" id="cpc-badge" title="Activity detection mode">…</span>
  </header>

  <div class="cpc-stage">
    <canvas id="cpc-canvas" width="160" height="160"
            role="img" aria-label="Animated pixel art companion"></canvas>
  </div>

  <p class="cpc-status" id="cpc-status" aria-live="polite">Byte is taking a break.</p>

  <div class="cpc-meta" id="cpc-meta">
    <span class="cpc-meta-item" id="cpc-activity">No activity detected</span>
    <span class="cpc-meta-item" id="cpc-elapsed" hidden></span>
    <span class="cpc-meta-item cpc-confidence" id="cpc-confidence" hidden></span>
  </div>

  <section class="cpc-timeline" id="cpc-timeline-section" hidden>
    <div class="cpc-timeline-head">
      <span>Recent activity</span>
      <button type="button" class="cpc-link" id="cpc-clear">Clear</button>
    </div>
    <ul class="cpc-timeline-list" id="cpc-timeline"></ul>
  </section>

  <section class="cpc-controls">
    <label class="cpc-field">
      <span>Character</span>
      <select id="cpc-character" aria-label="Companion character"></select>
    </label>
    <label class="cpc-field">
      <span>Scene</span>
      <select id="cpc-environment" aria-label="Environment"></select>
    </label>
    <label class="cpc-field">
      <span>State</span>
      <select id="cpc-state" aria-label="Manual character state"></select>
    </label>
    <div class="cpc-buttons">
      <button type="button" id="cpc-animations" class="cpc-toggle" aria-pressed="true">
        Animations on
      </button>
      <button type="button" id="cpc-settings" class="cpc-toggle">Settings</button>
      <button type="button" id="cpc-diagnostics" class="cpc-toggle" aria-expanded="false">
        Detection info
      </button>
    </div>
    <div class="cpc-diagnostics" id="cpc-diagnostics" hidden></div>
  </section>
</div>`;
  }

  private bindControls(): void {
    const byId = <T extends HTMLElement>(id: string) =>
      this.root.querySelector(id) as T;

    byId<HTMLSelectElement>('#cpc-character').addEventListener('change', (event) => {
      const value = (event.target as HTMLSelectElement).value;
      this.vscode.postMessage({ type: 'setCharacter', characterId: value });
    });

    byId<HTMLSelectElement>('#cpc-environment').addEventListener('change', (event) => {
      const value = (event.target as HTMLSelectElement).value;
      this.vscode.postMessage({ type: 'setEnvironment', environmentId: value });
    });

    byId<HTMLSelectElement>('#cpc-state').addEventListener('change', (event) => {
      const value = (event.target as HTMLSelectElement).value;
      this.vscode.postMessage({ type: 'setManualState', state: value });
    });

    byId<HTMLButtonElement>('#cpc-animations').addEventListener('click', () => {
      const enabled = !this.config?.animationsEnabled;
      this.vscode.postMessage({ type: 'setAnimationsEnabled', enabled });
    });

    byId<HTMLButtonElement>('#cpc-clear').addEventListener('click', () => {
      this.vscode.postMessage({ type: 'clearHistory' });
    });

    byId<HTMLButtonElement>('#cpc-settings').addEventListener('click', () => {
      this.vscode.postMessage({ type: 'openSettings' });
    });

    const diagnosticsButton = byId<HTMLButtonElement>('#cpc-diagnostics');
    const diagnosticsPanel = byId<HTMLDivElement>('#cpc-diagnostics');
    diagnosticsButton.addEventListener('click', () => {
      this.diagnosticsOpen = !this.diagnosticsOpen;
      diagnosticsPanel.hidden = !this.diagnosticsOpen;
      diagnosticsButton.setAttribute('aria-expanded', String(this.diagnosticsOpen));
      if (this.diagnosticsOpen) {
        this.renderDiagnostics();
      }
    });
  }

  private bindMessages(): void {
    // Messages are delivered through the `message` listener registered in
    // `initialize`; this method exists for symmetry with the rest of the app.
  }

  private handleMessage(data: unknown): void {
    if (!data || typeof data !== 'object') {
      return;
    }
    const message = data as Record<string, unknown>;
    switch (message.type) {
      case 'initialState':
        this.applyInitialState(message.payload as Record<string, unknown>);
        break;
      case 'activityChanged':
        this.applyActivity(message.payload as ActivityPayload);
        break;
      case 'configurationChanged':
        this.applyConfiguration(message.payload as ConfigurationPayload);
        break;
      case 'characterChanged':
        void this.applyCharacter(message.payload as CharacterAssets);
        break;
      case 'environmentChanged':
        this.applyEnvironment(message.payload as { environmentId: string; uri: string });
        break;
      case 'historyChanged':
        this.entries = (message.payload as { entries: TimelineEntry[] }).entries ?? [];
        this.renderTimeline();
        break;
      case 'clearHistory':
        this.entries = [];
        this.renderTimeline();
        break;
      case 'manualStateChanged':
        this.applyActivity({
          ...(this.activity as ActivityPayload),
          state: (message.payload as { state: ActivityState }).state,
        });
        break;
      case 'showDiagnostics':
        this.renderDiagnosticsPayload(message.payload as Record<string, unknown>);
        break;
      default:
        break;
    }
  }

  private applyInitialState(payload: Record<string, unknown>): void {
    const config = {
      animationsEnabled: payload.animationsEnabled as boolean,
      animationSpeed: payload.animationSpeed as number,
      characterSize: payload.characterSize as string,
      reducedMotion: payload.reducedMotion as boolean,
      manualMode: payload.manualMode as boolean,
      showStatusBar: payload.showStatusBar as boolean,
      showElapsedTime: payload.showElapsedTime as boolean,
      showTimeline: payload.showActivityTimeline as boolean,
      showDetails: payload.showActivityDetails as boolean,
    };
    this.applyConfiguration(config);
    this.applyActivity(payload as unknown as ActivityPayload);
    this.adapters = (payload.adapters as AdapterInfo[]) ?? [];
    this.entries = (payload.entries as TimelineEntry[]) ?? [];

    const nameEl = this.root.querySelector('#cpc-name') as HTMLElement;
    nameEl.textContent = (payload.characterName as string) ?? 'Companion';

    this.populateSelect(
      '#cpc-character',
      ((payload.characters as { id: string; name: string }[]) ?? []).map(
        (character) => ({ value: character.id, label: character.name })
      )
    );
    this.populateSelect(
      '#cpc-environment',
      ((payload.environments as { id: string; label: string }[]) ?? []).map(
        (environment) => ({ value: environment.id, label: environment.label })
      )
    );
    this.populateSelect(
      '#cpc-state',
      ((payload.manualStates as string[]) ?? []).map((state) => ({
        value: state,
        label: state,
      }))
    );

    const characterSelect = this.root.querySelector(
      '#cpc-character'
    ) as HTMLSelectElement;
    characterSelect.value = payload.characterId as string;

    const environmentSelect = this.root.querySelector(
      '#cpc-environment'
    ) as HTMLSelectElement;
    environmentSelect.value = payload.environmentId as string;

    this.renderTimeline();
    this.renderDiagnostics();
    this.updateBadge();
  }

  private applyActivity(payload: ActivityPayload): void {
    this.activity = payload;

    const statusEl = this.root.querySelector('#cpc-status') as HTMLElement;
    statusEl.textContent = payload.statusText;

    const activityEl = this.root.querySelector('#cpc-activity') as HTMLElement;
    activityEl.textContent = payload.activityLabel;

    const elapsedEl = this.root.querySelector('#cpc-elapsed') as HTMLElement;
    const showElapsed = this.config?.showElapsedTime ?? true;
    elapsedEl.hidden = !showElapsed || payload.elapsedMs <= 0;

    const confidenceEl = this.root.querySelector('#cpc-confidence') as HTMLElement;
    const showDetails = this.config?.showDetails ?? true;
    confidenceEl.hidden = !showDetails || !payload.confidence || payload.confidence === 'none';
    confidenceEl.textContent = payload.isDirect
      ? 'directly observed'
      : payload.confidence === 'manual'
        ? 'manual'
        : 'inferred';
    confidenceEl.classList.toggle('cpc-direct', payload.isDirect);

    this.updateElapsed(payload.elapsedMs);
    this.updateBadge();
    void this.playState(payload.state);
  }

  private applyConfiguration(payload: ConfigurationPayload): void {
    this.config = payload;
    this.animation.setSpeed(payload.animationSpeed);
    this.animation.setReducedMotion(payload.reducedMotion);
    this.particles.setReducedMotion(payload.reducedMotion);

    const size = CHARACTER_SIZE_PX[payload.characterSize] ?? CHARACTER_SIZE_PX.medium;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;

    const toggle = this.root.querySelector('#cpc-animations') as HTMLButtonElement;
    toggle.setAttribute('aria-pressed', String(payload.animationsEnabled));
    toggle.textContent = payload.animationsEnabled ? 'Animations on' : 'Animations off';

    const timelineSection = this.root.querySelector(
      '#cpc-timeline-section'
    ) as HTMLElement;
    timelineSection.hidden = !payload.showTimeline;

    if (!payload.animationsEnabled) {
      this.animation.stop();
      this.stop();
    } else if (this.activity) {
      void this.playState(this.activity.state);
    }

    if (payload.showElapsedTime && this.activity) {
      this.updateElapsed(this.activity.elapsedMs);
    }
  }

  private async applyCharacter(payload: CharacterAssets): Promise<void> {
    const nameEl = this.root.querySelector('#cpc-name') as HTMLElement;
    nameEl.textContent = payload.characterName;

    const sheets = new Map<string, SpriteSheet>();
    for (const [state, uri] of Object.entries(payload.assets)) {
      const sheet = await this.spriteRenderer.load(
        uri,
        payload.frameWidth,
        payload.frameHeight
      );
      if (sheet) {
        sheets.set(state, sheet);
      }
    }
    this.sheets = sheets;
    this.timings = payload.timings ?? {};
    this.loops = payload.loops ?? {};

    if (this.activity) {
      await this.playState(this.activity.state);
    }
  }

  private applyEnvironment(payload: { environmentId: string; uri: string }): void {
    const select = this.root.querySelector('#cpc-environment') as HTMLSelectElement;
    select.value = payload.environmentId;

    this.root.style.setProperty('--cpc-environment', `url("${payload.uri}")`);
    this.root.classList.add('cpc-has-environment');
  }

  /** Chooses the animation for a state and starts the render loop if needed. */
  private async playState(state: ActivityState): Promise<void> {
    const sheet = this.sheets.get(state) ?? this.sheets.get('idle');
    if (!sheet) {
      return;
    }

    const animationsEnabled = this.config?.animationsEnabled ?? true;

    const animation: Animation = {
      id: state,
      source: sheet,
      // The manifest stores the length of a whole loop; the controller
      // derives the per-frame time from the frame count.
      duration: this.timings[state] ?? 1000,
      loop: this.loops[state] ?? state !== 'success',
    };

    this.animation.play(animation, () => {
      // The success overlay ends: fall back to whatever is really going on.
      this.vscode.postMessage({ type: 'requestInitialState' });
    });

    if (animationsEnabled) {
      this.start();
    } else {
      this.drawOnce();
    }

    if (state !== this.lastParticleState) {
      this.lastParticleState = state;
      this.emitParticles(state);
    }
  }

  private emitParticles(state: ActivityState): void {
    const size = this.canvas.clientWidth || 104;
    const centerX = size / 2;
    const centerY = size / 2;

    switch (state) {
      case 'success':
        this.particles.emit('confetti', centerX, centerY, 1);
        this.particles.emit('sparkle', centerX, centerY, 1);
        break;
      case 'thinking':
        this.particles.emit('thought', centerX + 10, centerY - 18, 1);
        break;
      case 'typing':
        this.particles.emit('code', centerX, centerY + 18, 1);
        break;
      case 'coding':
        this.particles.emit('code', centerX, centerY + 18, 1.4);
        break;
      case 'error':
        this.particles.emit('sparkle', centerX, centerY - 20, 0.6);
        break;
      case 'sleeping':
        this.particles.emit('zzz', centerX + 12, centerY - 10, 1);
        break;
      default:
        break;
    }
  }

  private start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.lastFrameTime = performance.now();
    const loop = (time: number) => {
      if (!this.running) {
        return;
      }
      const delta = Math.min(64, time - this.lastFrameTime);
      this.lastFrameTime = time;
      this.render(delta);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);

    this.elapsedTimer = window.setInterval(() => {
      if (this.activity && this.config?.showElapsedTime) {
        this.activity = {
          ...this.activity,
          elapsedMs: this.activity.elapsedMs + 1000,
        };
        this.updateElapsed(this.activity.elapsedMs);
      }
    }, 1000);
  }

  private stop(): void {
    this.running = false;
    if (this.rafId !== undefined) {
      cancelAnimationFrame(this.rafId);
      this.rafId = undefined;
    }
    if (this.elapsedTimer !== undefined) {
      clearInterval(this.elapsedTimer);
      this.elapsedTimer = undefined;
    }
  }

  private render(deltaMs: number): void {
    const frame = this.animation.update(deltaMs);
    const sheet = this.sheets.get(this.activity?.state ?? 'idle') ?? this.sheets.get('idle');
    if (!sheet) {
      return;
    }

    const size = this.canvas.width;
    this.context.clearRect(0, 0, size, size);
    if (frame !== undefined) {
      this.spriteRenderer.drawFrame(sheet, frame, 0, 0, size);
    }
    this.particles.update(deltaMs, this.context);
  }

  private drawOnce(): void {
    const sheet = this.sheets.get(this.activity?.state ?? 'idle') ?? this.sheets.get('idle');
    if (!sheet) {
      return;
    }
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.spriteRenderer.drawFrame(sheet, 0, 0, this.canvas.width, this.canvas.width);
  }

  private updateElapsed(elapsedMs: number): void {
    const elapsedEl = this.root.querySelector('#cpc-elapsed') as HTMLElement;
    if (elapsedEl.hidden) {
      return;
    }
    const seconds = Math.floor(elapsedMs / 1000);
    elapsedEl.textContent = `Working for ${seconds}s`;
  }

  private updateBadge(): void {
    const badge = this.root.querySelector('#cpc-badge') as HTMLElement;
    const manual = this.config?.manualMode ?? false;
    const direct = this.activity?.isDirect ?? false;

    badge.textContent = manual ? 'manual' : direct ? 'observed' : 'inferred';
    badge.title = manual
      ? 'The character state is being set by hand.'
      : direct
        ? 'This state comes from a directly observed Copilot signal.'
        : 'This state is inferred from general editor activity. It is not proof of Copilot activity.';
    badge.classList.toggle('cpc-badge-direct', direct);
    badge.classList.toggle('cpc-badge-manual', manual);
  }

  private renderTimeline(): void {
    const list = this.root.querySelector('#cpc-timeline') as HTMLElement;
    list.innerHTML = '';

    if (this.entries.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'cpc-timeline-empty';
      empty.textContent = 'No activity observed yet.';
      list.appendChild(empty);
      return;
    }

    for (const entry of this.entries.slice(0, 20)) {
      const item = document.createElement('li');
      item.className = 'cpc-timeline-item';

      const time = document.createElement('span');
      time.className = 'cpc-timeline-time';
      time.textContent = new Date(entry.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      const label = document.createElement('span');
      label.className = 'cpc-timeline-label';
      label.textContent = entry.label;

      const marker = document.createElement('span');
      marker.className = `cpc-timeline-marker ${entry.direct ? 'is-direct' : 'is-inferred'}`;
      marker.title = entry.direct
        ? 'Directly observed'
        : 'Inferred from general activity';
      marker.textContent = entry.direct ? '●' : '○';

      item.append(time, label, marker);
      list.appendChild(item);
    }
  }

  private renderDiagnostics(): void {
    const panel = this.root.querySelector('#cpc-diagnostics') as HTMLElement;
    if (!this.adapters.length) {
      panel.textContent = 'Detection information is not available yet.';
      return;
    }
    this.renderDiagnosticsPayload({
      adapters: this.adapters,
      copilotInstalled: this.adapters.some((a) => a.id === 'copilot' && a.available),
      chatModelsObserved: false,
      directLifecycleEvents: false,
      notes: [],
    });
  }

  private renderDiagnosticsPayload(payload: Record<string, unknown>): void {
    const panel = this.root.querySelector('#cpc-diagnostics') as HTMLElement;
    panel.innerHTML = '';

    const adapters = (payload.adapters as AdapterInfo[]) ?? [];
    for (const adapter of adapters) {
      const row = document.createElement('div');
      row.className = 'cpc-diag-row';

      const dot = document.createElement('span');
      dot.className = `cpc-diag-dot ${adapter.available ? 'is-on' : 'is-off'}`;

      const name = document.createElement('span');
      name.className = 'cpc-diag-name';
      name.textContent = adapter.name;

      row.append(dot, name);
      if (!adapter.available && adapter.reason) {
        const reason = document.createElement('span');
        reason.className = 'cpc-diag-reason';
        reason.textContent = adapter.reason;
        row.appendChild(reason);
      }
      panel.appendChild(row);
    }

    const note = document.createElement('p');
    note.className = 'cpc-diag-note';
    note.textContent =
      'The VS Code API does not expose Copilot request lifecycle events, so no genuine completion or progress signal is available. The companion never reports an invented progress percentage.';
    panel.appendChild(note);
  }

  private populateSelect(selector: string, options: { value: string; label: string }[]): void {
    const select = this.root.querySelector(selector) as HTMLSelectElement;
    select.innerHTML = '';
    for (const option of options) {
      const element = document.createElement('option');
      element.value = option.value;
      element.textContent = option.label;
      select.appendChild(element);
    }
  }

  /** Exposed so the extension can drive the state selector. */
  setManualStateOptions(states: string[]): void {
    const select = this.root.querySelector('#cpc-state') as HTMLSelectElement;
    select.innerHTML = '';
    for (const state of states) {
      const element = document.createElement('option');
      element.value = state;
      element.textContent = state;
      select.appendChild(element);
    }
  }
}
