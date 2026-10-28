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
exports.StatusBarManager = void 0;
const vscode = __importStar(require("vscode"));
const activityTypes_1 = require("../activity/activityTypes");
/**
 * The optional status bar item.
 *
 * The item always reflects *observed* activity. It never claims to expose
 * internal Copilot state: the tooltip spells out whether the current state
 * was directly observed or inferred.
 */
class StatusBarManager {
    activityManager;
    getCharacterName;
    item;
    subscriptions = [];
    constructor(activityManager, getCharacterName) {
        this.activityManager = activityManager;
        this.getCharacterName = getCharacterName;
        this.subscriptions.push(this.activityManager.onDidChangeActivity(() => this.update()));
    }
    /** Creates the status bar item if it does not exist yet. */
    create() {
        if (this.item) {
            return;
        }
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.item.name = 'Copilot Pixel Companion';
        this.item.command = 'copilotPixelCompanion.show';
        this.update();
        this.item.show();
    }
    /** Removes the status bar item. */
    dispose() {
        for (const subscription of this.subscriptions.splice(0)) {
            subscription.dispose();
        }
        this.item?.dispose();
        this.item = undefined;
    }
    /** Refreshes the item's text, tooltip and icon. */
    update() {
        if (!this.item) {
            return;
        }
        const state = this.activityManager.getState();
        const primary = this.activityManager.getPrimaryActivity();
        const name = this.getCharacterName();
        this.item.text = `${this.iconFor(state)} ${name}: ${activityTypes_1.STATE_LABELS[state]}`;
        const lines = [
            `${name} is ${activityTypes_1.STATE_LABELS[state].toLowerCase()}.`,
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
    iconFor(state) {
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
exports.StatusBarManager = StatusBarManager;
//# sourceMappingURL=statusBarManager.js.map