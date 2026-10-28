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
exports.Logger = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Small logger that writes to a VS Code output channel.
 *
 * Repeated identical messages are collapsed so a failing optional
 * integration cannot flood the log.
 */
class Logger {
    channel;
    seen = new Set();
    constructor(name) {
        this.channel = vscode.window.createOutputChannel(name);
    }
    info(message) {
        this.channel.appendLine(`[info] ${message}`);
    }
    warn(message) {
        this.channel.appendLine(`[warn] ${message}`);
    }
    /** Logs an error once per distinct message. */
    error(message, error) {
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
    show() {
        this.channel.show(true);
    }
    dispose() {
        this.channel.dispose();
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map