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
exports.ConfigurationManager = exports.CONFIG_SECTION = void 0;
const vscode = __importStar(require("vscode"));
/** The extension's configuration section. */
exports.CONFIG_SECTION = 'copilotPixelCompanion';
const SPEEDS = ['slow', 'normal', 'fast'];
const SIZES = ['small', 'medium', 'large'];
/**
 * Reads and validates the extension's settings.
 *
 * Every value is validated against the same constraints declared in
 * package.json, so an out-of-range or unknown value falls back to the
 * documented default instead of propagating into the renderer.
 */
class ConfigurationManager {
    emitter = new vscode.EventEmitter();
    cached;
    subscription;
    constructor() {
        this.cached = this.read();
        this.subscription = vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration(exports.CONFIG_SECTION)) {
                this.cached = this.read();
                this.emitter.fire(this.cached);
            }
        });
    }
    get config() {
        return this.cached;
    }
    /** Fires whenever any companion setting changes. */
    onDidChange = this.emitter.event;
    /** Reads the current configuration, applying defaults and validation. */
    read() {
        const config = vscode.workspace.getConfiguration(exports.CONFIG_SECTION);
        return {
            enabled: config.get('enabled', true),
            character: config.get('character', 'byte'),
            environment: config.get('environment', 'cozyDesk'),
            animationsEnabled: config.get('animationsEnabled', true),
            animationSpeed: this.oneOf(config.get('animationSpeed'), SPEEDS, 'normal'),
            characterSize: this.oneOf(config.get('characterSize'), SIZES, 'medium'),
            reducedMotion: config.get('reducedMotion', false),
            showStatusBar: config.get('showStatusBar', true),
            showElapsedTime: config.get('showElapsedTime', true),
            showActivityTimeline: config.get('showActivityTimeline', true),
            showInferredActivity: config.get('showInferredActivity', true),
            manualMode: config.get('manualMode', false),
            activityTimeoutSeconds: this.bounded(config.get('activityTimeoutSeconds'), 5, 600, 30),
            persistActivityHistory: config.get('persistActivityHistory', false),
            showActivityDetails: config.get('showActivityDetails', true),
            maxActivityHistory: this.bounded(config.get('maxActivityHistory'), 5, 100, 20),
        };
    }
    /** Writes a single setting, scoped to the workspace when one is open. */
    async update(key, value) {
        const config = vscode.workspace.getConfiguration(exports.CONFIG_SECTION);
        const target = vscode.workspace.workspaceFolders?.length
            ? vscode.ConfigurationTarget.Workspace
            : vscode.ConfigurationTarget.Global;
        await config.update(key, value, target);
    }
    /** Restores every setting to its packaged default. */
    async reset() {
        const config = vscode.workspace.getConfiguration(exports.CONFIG_SECTION);
        const target = vscode.workspace.workspaceFolders?.length
            ? vscode.ConfigurationTarget.Workspace
            : vscode.ConfigurationTarget.Global;
        const keys = [
            'enabled',
            'character',
            'environment',
            'animationsEnabled',
            'animationSpeed',
            'characterSize',
            'reducedMotion',
            'showStatusBar',
            'showElapsedTime',
            'showActivityTimeline',
            'showInferredActivity',
            'manualMode',
            'activityTimeoutSeconds',
            'persistActivityHistory',
            'showActivityDetails',
            'maxActivityHistory',
        ];
        for (const key of keys) {
            const entry = config.inspect(key);
            await config.update(key, entry?.defaultValue, target);
        }
    }
    dispose() {
        this.subscription.dispose();
        this.emitter.dispose();
    }
    oneOf(value, allowed, fallback) {
        return value && allowed.includes(value) ? value : fallback;
    }
    bounded(value, min, max, fallback) {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            return fallback;
        }
        return Math.min(max, Math.max(min, Math.round(value)));
    }
}
exports.ConfigurationManager = ConfigurationManager;
//# sourceMappingURL=configurationManager.js.map