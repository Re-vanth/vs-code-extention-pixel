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
exports.CompanionViewProvider = exports.MANUAL_STATES = exports.ENVIRONMENTS = void 0;
const vscode = __importStar(require("vscode"));
const activityTypes_1 = require("../activity/activityTypes");
const messages_1 = require("../protocol/messages");
const VIEW_ID = 'copilotPixelCompanion.view';
/** The environments the extension ships with. */
exports.ENVIRONMENTS = [
    { id: 'cozyDesk', label: 'Cozy Desk' },
    { id: 'nightStudio', label: 'Night Studio' },
    { id: 'pixelGarden', label: 'Pixel Garden' },
];
/** The states a user can pick manually. */
exports.MANUAL_STATES = [
    'idle',
    'thinking',
    'typing',
    'coding',
    'reviewing',
    'waiting',
    'success',
    'error',
    'paused',
    'sleeping',
];
/**
 * Backs the Activity Bar webview view.
 *
 * The extension host owns all state; the webview only renders what it is
 * told and sends user actions back. The webview never infers activity on
 * its own.
 */
class CompanionViewProvider {
    extensionUri;
    activityManager;
    configuration;
    characters;
    logger;
    view;
    subscriptions = [];
    constructor(extensionUri, activityManager, configuration, characters, logger) {
        this.extensionUri = extensionUri;
        this.activityManager = activityManager;
        this.configuration = configuration;
        this.characters = characters;
        this.logger = logger;
        this.subscriptions.push(this.activityManager.onDidChangeActivity(() => {
            this.postActivityChanged();
        }));
        this.subscriptions.push(this.activityManager.onDidChangeHistory(() => {
            this.post({
                type: 'historyChanged',
                payload: { entries: this.activityManager.getHistory() },
            });
        }));
        this.subscriptions.push(this.configuration.onDidChange((config) => {
            this.postConfiguration(config);
            void this.refreshCharacter();
            void this.refreshEnvironment();
        }));
    }
    resolveWebviewView(webviewView) {
        this.view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.extensionUri, 'media'),
                vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist'),
            ],
        };
        webviewView.webview.html = this.getHtml(webviewView.webview);
        webviewView.webview.onDidReceiveMessage((message) => {
            this.handleMessage(message);
        });
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this.postInitialState();
            }
        });
        webviewView.onDidDispose(() => {
            this.view = undefined;
        });
    }
    /** Reveals the companion view, focusing the Activity Bar container. */
    reveal() {
        void vscode.commands.executeCommand('workbench.view.extension.copilotPixelCompanion');
        void vscode.commands.executeCommand(`${VIEW_ID}.focus`);
    }
    /** Sends a full state snapshot to the webview. */
    postInitialState() {
        const config = this.configuration.config;
        const payload = {
            ...this.buildActivityPayload(),
            characterId: config.character,
            characterName: this.characters.get(config.character)?.displayName ?? 'Companion',
            environmentId: config.environment,
            animationsEnabled: config.animationsEnabled,
            animationSpeed: this.speedMultiplier(config.animationSpeed),
            characterSize: config.characterSize,
            reducedMotion: config.reducedMotion,
            manualMode: config.manualMode,
            showStatusBar: config.showStatusBar,
            showElapsedTime: config.showElapsedTime,
            showTimeline: config.showActivityTimeline,
            showDetails: config.showActivityDetails,
            adapters: this.activityManager.getAdapterAvailability(),
            entries: this.activityManager.getHistory(),
            characters: this.characters.list().map((character) => ({
                id: character.id,
                name: character.displayName,
            })),
            environments: exports.ENVIRONMENTS.map((environment) => ({
                id: environment.id,
                label: environment.label,
            })),
            manualStates: exports.MANUAL_STATES,
        };
        this.post({ type: 'initialState', payload });
    }
    /** Sends the current character manifest to the webview. */
    async refreshCharacter() {
        const config = this.configuration.config;
        const character = this.characters.get(config.character);
        if (!character || !this.view) {
            return;
        }
        const assets = {};
        const timings = {};
        const loops = {};
        for (const [state, definition] of Object.entries(character.states)) {
            const uri = this.view.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'sprites', character.id, definition.file));
            assets[state] = uri.toString();
            timings[state] = definition.duration;
            loops[state] = definition.loop;
        }
        const payload = {
            characterId: character.id,
            characterName: character.displayName,
            frameWidth: character.frameWidth,
            frameHeight: character.frameHeight,
            assets,
            timings,
            loops,
        };
        this.post({ type: 'characterChanged', payload });
    }
    /** Sends the current environment backdrop to the webview. */
    async refreshEnvironment() {
        const config = this.configuration.config;
        if (!this.view) {
            return;
        }
        const uri = this.view.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'environments', `${config.environment}.png`));
        const payload = {
            environmentId: config.environment,
            uri: uri.toString(),
        };
        this.post({ type: 'environmentChanged', payload });
    }
    /** Sends the diagnostics payload to the webview. */
    postDiagnostics(payload) {
        this.post({ type: 'showDiagnostics', payload });
    }
    postActivityChanged() {
        this.post({ type: 'activityChanged', payload: this.buildActivityPayload() });
    }
    postConfiguration(config) {
        const payload = {
            animationsEnabled: config.animationsEnabled,
            animationSpeed: this.speedMultiplier(config.animationSpeed),
            characterSize: config.characterSize,
            reducedMotion: config.reducedMotion,
            manualMode: config.manualMode,
            showStatusBar: config.showStatusBar,
            showElapsedTime: config.showElapsedTime,
            showTimeline: config.showActivityTimeline,
            showDetails: config.showActivityDetails,
        };
        this.post({ type: 'configurationChanged', payload });
    }
    buildActivityPayload() {
        const state = this.activityManager.getState();
        const primary = this.activityManager.getPrimaryActivity();
        const config = this.configuration.config;
        const elapsed = primary ? Date.now() - primary.startedAt : 0;
        const label = primary?.description ??
            (state === 'idle' ? 'No activity detected' : activityTypes_1.STATE_LABELS[state]);
        return {
            state,
            statusText: this.buildStatusText(state),
            activityLabel: label,
            sourceLabel: primary ? this.sourceLabel(primary.source) : 'None',
            elapsedMs: config.showElapsedTime ? elapsed : 0,
            isDirect: primary?.direct ?? false,
            confidence: primary?.confidence ?? 'none',
        };
    }
    buildStatusText(state) {
        const name = this.characters.get(this.configuration.config.character)?.displayName ?? 'Byte';
        return `${name} ${activityTypes_1.STATE_MESSAGES[state]}`;
    }
    sourceLabel(source) {
        switch (source) {
            case 'copilot-chat':
                return 'Copilot chat';
            case 'copilot-inline':
                return 'Copilot inline';
            case 'copilot-agent':
                return 'Copilot agent';
            case 'copilot-tools':
                return 'Copilot tool';
            case 'vscode-task':
                return 'VS Code task';
            case 'vscode-terminal':
                return 'VS Code terminal';
            case 'vscode-editor':
                return 'Editor (inferred)';
            case 'vscode-workspace':
                return 'Workspace (inferred)';
            case 'manual':
                return 'Manual';
            default:
                return 'None';
        }
    }
    speedMultiplier(speed) {
        switch (speed) {
            case 'slow':
                return 0.6;
            case 'fast':
                return 1.6;
            default:
                return 1;
        }
    }
    post(message) {
        if (!this.view) {
            return;
        }
        void this.view.webview.postMessage(message);
    }
    handleMessage(message) {
        const validated = (0, messages_1.validateWebviewMessage)(message);
        if (!validated) {
            this.logger.warn('Ignored an invalid message from the companion view.');
            return;
        }
        switch (validated.type) {
            case 'requestInitialState':
                this.postInitialState();
                void this.refreshCharacter();
                void this.refreshEnvironment();
                break;
            case 'setManualState':
                void vscode.commands.executeCommand('copilotPixelCompanion.setManualState', validated.state);
                break;
            case 'setCharacter':
                void this.configuration.update('character', validated.characterId);
                break;
            case 'setEnvironment':
                void this.configuration.update('environment', validated.environmentId);
                break;
            case 'setAnimationsEnabled':
                void this.configuration.update('animationsEnabled', validated.enabled);
                break;
            case 'clearHistory':
                this.activityManager.clearHistory();
                break;
            case 'openSettings':
                void vscode.commands.executeCommand('workbench.action.openSettings', validated.settingId
                    ? `copilotPixelCompanion.${validated.settingId}`
                    : 'copilotPixelCompanion');
                break;
            case 'reportError':
                this.logger.error(`Companion view reported: ${validated.message}`);
                break;
            default:
                break;
        }
    }
    getHtml(webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist', 'main.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist', 'main.css'));
        // A restrictive CSP: no remote origins, no inline script, no eval.
        const nonce = makeNonce();
        const csp = [
            `default-src 'none'`,
            `img-src ${webview.cspSource} data:`,
            `style-src ${webview.cspSource}`,
            `script-src 'nonce-${nonce}'`,
            `font-src ${webview.cspSource}`,
        ].join('; ');
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="${styleUri}" rel="stylesheet">
<title>Copilot Pixel Companion</title>
</head>
<body>
<div id="root"></div>
<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
    dispose() {
        for (const subscription of this.subscriptions.splice(0)) {
            subscription.dispose();
        }
        this.view = undefined;
    }
}
exports.CompanionViewProvider = CompanionViewProvider;
/** Generates a random nonce for the webview CSP. */
function makeNonce() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let text = '';
    for (let i = 0; i < 32; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
}
//# sourceMappingURL=companionViewProvider.js.map