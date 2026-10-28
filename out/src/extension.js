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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const activityManager_1 = require("./activity/activityManager");
const copilotActivityAdapter_1 = require("./activity/copilotActivityAdapter");
const editorActivityAdapter_1 = require("./activity/editorActivityAdapter");
const manualActivityAdapter_1 = require("./activity/manualActivityAdapter");
const characterRegistry_1 = require("./character/characterRegistry");
const commandManager_1 = require("./commands/commandManager");
const configurationManager_1 = require("./configuration/configurationManager");
const logger_1 = require("./utilities/logger");
const companionViewProvider_1 = require("./views/companionViewProvider");
const statusBarManager_1 = require("./views/statusBarManager");
let statusBar;
async function activate(context) {
    const logger = new logger_1.Logger('Copilot Pixel Companion');
    context.subscriptions.push(logger);
    try {
        const configuration = new configurationManager_1.ConfigurationManager();
        context.subscriptions.push(configuration);
        const characters = new characterRegistry_1.CharacterRegistry(vscode.Uri.joinPath(context.extensionUri, 'media', 'sprites').fsPath);
        const loaded = characters.load();
        logger.info(`Loaded ${loaded.length} character(s): ${loaded.join(', ')}`);
        const manualAdapter = new manualActivityAdapter_1.ManualActivityAdapter();
        const copilotAdapter = new copilotActivityAdapter_1.CopilotActivityAdapter();
        const toolAdapter = new copilotActivityAdapter_1.ToolActivityAdapter();
        const editorAdapter = new editorActivityAdapter_1.EditorActivityAdapter();
        const activityManager = new activityManager_1.ActivityManager([
            copilotAdapter,
            toolAdapter,
            editorAdapter,
            manualAdapter,
        ]);
        context.subscriptions.push(activityManager);
        const viewProvider = new companionViewProvider_1.CompanionViewProvider(context.extensionUri, activityManager, configuration, characters, logger);
        context.subscriptions.push(viewProvider);
        context.subscriptions.push(vscode.window.registerWebviewViewProvider('copilotPixelCompanion.view', viewProvider));
        statusBar = new statusBarManager_1.StatusBarManager(activityManager, () => characters.get(configuration.config.character)?.displayName ?? 'Byte');
        context.subscriptions.push(statusBar);
        const commandManager = new commandManager_1.CommandManager(configuration, activityManager, manualAdapter, characters, viewProvider, logger);
        commandManager.register();
        context.subscriptions.push(commandManager);
        activityManager.activate();
        commandManager.syncConfiguration(configuration.config);
        // A tool registered by this extension is a genuinely Copilot-driven
        // signal, because the language model invokes it.
        toolAdapter.registerTool('copilotPixelCompanion.ping', 'Companion ping');
        const applyConfig = (config) => {
            commandManager.syncConfiguration(config);
            void activityManager.setPersistence(config.persistActivityHistory, context.globalState);
            if (config.showStatusBar) {
                statusBar?.create();
                statusBar?.update();
            }
            else {
                statusBar?.dispose();
            }
        };
        applyConfig(configuration.config);
        context.subscriptions.push(configuration.onDidChange(applyConfig));
        logger.info('Copilot Pixel Companion activated.');
        logger.info(`Copilot integration: ${copilotAdapter.describeIntegration().installed ? 'installed' : 'not installed'}. ` +
            'Direct Copilot request lifecycle events are not exposed by the VS Code API.');
    }
    catch (error) {
        logger.error('Failed to activate Copilot Pixel Companion.', error);
        void vscode.window.showErrorMessage('Copilot Pixel Companion failed to activate. See the "Copilot Pixel Companion" output channel for details.');
    }
}
function deactivate() {
    statusBar?.dispose();
    statusBar = undefined;
}
//# sourceMappingURL=extension.js.map