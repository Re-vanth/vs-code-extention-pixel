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
exports.CommandManager = void 0;
const vscode = __importStar(require("vscode"));
const MANUAL_STATES = [
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
 * Registers and implements every command the extension contributes.
 *
 * Each command has a real behaviour; there are no placeholder entries.
 */
class CommandManager {
    configuration;
    activityManager;
    manualAdapter;
    characters;
    viewProvider;
    logger;
    disposables = [];
    constructor(configuration, activityManager, manualAdapter, characters, viewProvider, logger) {
        this.configuration = configuration;
        this.activityManager = activityManager;
        this.manualAdapter = manualAdapter;
        this.characters = characters;
        this.viewProvider = viewProvider;
        this.logger = logger;
    }
    register() {
        const register = (id, handler) => {
            this.disposables.push(vscode.commands.registerCommand(id, async (...args) => {
                try {
                    await handler(...args);
                }
                catch (error) {
                    this.logger.error(`Command ${id} failed.`, error);
                    void vscode.window.showErrorMessage('Copilot Pixel Companion: the command could not be completed.');
                }
            }));
        };
        register('copilotPixelCompanion.show', () => this.viewProvider.reveal());
        register('copilotPixelCompanion.hide', () => this.hideCompanion());
        register('copilotPixelCompanion.toggle', () => this.toggleCompanion());
        register('copilotPixelCompanion.setCharacter', () => this.setCharacter());
        register('copilotPixelCompanion.setEnvironment', () => this.setEnvironment());
        register('copilotPixelCompanion.setAnimationEnabled', () => this.setAnimationEnabled());
        register('copilotPixelCompanion.setManualState', (state) => this.setManualState(state));
        register('copilotPixelCompanion.clearActivityHistory', () => {
            this.activityManager.clearHistory();
        });
        register('copilotPixelCompanion.resetSettings', () => this.resetSettings());
        register('copilotPixelCompanion.showDiagnostics', () => this.showDiagnostics());
    }
    async hideCompanion() {
        await vscode.commands.executeCommand('workbench.action.closeSidebar');
    }
    async toggleCompanion() {
        const container = (await vscode.commands.executeCommand('workbench.view.extension.copilotPixelCompanion'));
        if (container?.visible) {
            await vscode.commands.executeCommand('workbench.action.closeSidebar');
        }
        else {
            this.viewProvider.reveal();
        }
    }
    async setCharacter() {
        const available = this.characters.list();
        if (available.length === 0) {
            void vscode.window.showWarningMessage('Copilot Pixel Companion: no characters were found in the media folder.');
            return;
        }
        const picked = await vscode.window.showQuickPick(available.map((character) => ({
            label: character.displayName,
            description: character.personality,
            detail: `Character id: ${character.id}`,
            id: character.id,
        })), { placeHolder: 'Choose a companion character' });
        if (picked) {
            await this.configuration.update('character', picked.id);
        }
    }
    async setEnvironment() {
        const environments = [
            { id: 'cozyDesk', label: 'Cozy Desk' },
            { id: 'nightStudio', label: 'Night Studio' },
            { id: 'pixelGarden', label: 'Pixel Garden' },
        ];
        const picked = await vscode.window.showQuickPick(environments, {
            placeHolder: 'Choose an environment',
        });
        if (picked) {
            await this.configuration.update('environment', picked.id);
        }
    }
    async setAnimationEnabled() {
        const current = this.configuration.config.animationsEnabled;
        await this.configuration.update('animationsEnabled', !current);
    }
    async setManualState(state) {
        let target;
        if (typeof state === 'string' && MANUAL_STATES.includes(state)) {
            target = state;
        }
        else {
            const picked = await vscode.window.showQuickPick(MANUAL_STATES.map((value) => ({
                label: value,
                description: this.describeState(value),
                id: value,
            })), { placeHolder: 'Choose a manual character state' });
            target = picked?.id;
        }
        if (!target) {
            return;
        }
        // Manual control implies manual mode; turn it on so the user is not
        // fighting the automatic detection.
        if (!this.configuration.config.manualMode) {
            await this.configuration.update('manualMode', true);
        }
        this.manualAdapter.setState(target);
    }
    describeState(state) {
        switch (state) {
            case 'idle':
                return 'Relaxed, occasional blinking';
            case 'thinking':
                return 'Looking upward with thought bubbles';
            case 'typing':
                return 'Typing on a miniature keyboard';
            case 'coding':
                return 'Working at a miniature computer';
            case 'reviewing':
                return 'Inspecting a code document';
            case 'success':
                return 'Short celebration';
            case 'error':
                return 'Gentle concerned reaction';
            case 'waiting':
                return 'Waiting for a reply';
            case 'paused':
                return 'Sitting down, minimal movement';
            case 'sleeping':
                return 'Closed eyes with floating Z particles';
            default:
                return '';
        }
    }
    async resetSettings() {
        const confirmation = await vscode.window.showWarningMessage('Reset every Copilot Pixel Companion setting to its default?', { modal: true }, 'Reset');
        if (confirmation === 'Reset') {
            await this.configuration.reset();
            void vscode.window.showInformationMessage('Copilot Pixel Companion settings were reset.');
        }
    }
    async showDiagnostics() {
        const adapters = this.activityManager.getAdapterAvailability();
        const lines = ['Copilot Pixel Companion diagnostics', ''];
        for (const adapter of adapters) {
            lines.push(`${adapter.available ? '[available]' : '[unavailable]'} ${adapter.name}` +
                (adapter.reason ? ` - ${adapter.reason}` : ''));
        }
        lines.push('');
        lines.push('No prompts, responses, source code or workspace paths are collected or transmitted.');
        this.logger.info(lines.join('\n'));
        this.logger.show();
        await vscode.commands.executeCommand('workbench.action.openSettings', 'copilotPixelCompanion');
    }
    /** Applies the current configuration to the status bar and view. */
    syncConfiguration(config) {
        this.activityManager.applySettings(config.maxActivityHistory, config.activityTimeoutSeconds);
        this.activityManager.setDetectionMode(config.showInferredActivity, config.manualMode);
    }
    dispose() {
        for (const disposable of this.disposables.splice(0)) {
            disposable.dispose();
        }
    }
}
exports.CommandManager = CommandManager;
//# sourceMappingURL=commandManager.js.map