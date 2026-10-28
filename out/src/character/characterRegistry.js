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
exports.CharacterRegistry = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class CharacterRegistry {
    spritesRoot;
    characters = new Map();
    constructor(spritesRoot) {
        this.spritesRoot = spritesRoot;
    }
    /**
     * Loads every character found under the sprites root.
     *
     * @returns the ids that were loaded, in discovery order
     */
    load() {
        this.characters.clear();
        if (!fs.existsSync(this.spritesRoot)) {
            return [];
        }
        for (const entry of fs.readdirSync(this.spritesRoot, { withFileTypes: true })) {
            if (!entry.isDirectory()) {
                continue;
            }
            const manifestPath = path.join(this.spritesRoot, entry.name, 'manifest.json');
            if (!fs.existsSync(manifestPath)) {
                continue;
            }
            try {
                const raw = fs.readFileSync(manifestPath, 'utf8');
                const manifest = JSON.parse(raw);
                this.characters.set(manifest.id, this.toDefinition(manifest));
            }
            catch {
                // A malformed manifest must not stop the extension from loading.
            }
        }
        return [...this.characters.keys()];
    }
    get(id) {
        return this.characters.get(id);
    }
    has(id) {
        return this.characters.has(id);
    }
    list() {
        return [...this.characters.values()];
    }
    get defaultId() {
        return this.characters.has('byte') ? 'byte' : [...this.characters.keys()][0] ?? '';
    }
    toDefinition(manifest) {
        const states = {};
        for (const [id, state] of Object.entries(manifest.states)) {
            states[id] = {
                id: id,
                file: state.file,
                frames: state.frames,
                duration: state.duration,
                loop: state.loop,
            };
        }
        return {
            id: manifest.id,
            displayName: manifest.name,
            personality: manifest.personality,
            frameWidth: manifest.frameWidth,
            frameHeight: manifest.frameHeight,
            preferredSpeed: 1,
            palette: {},
            states,
        };
    }
}
exports.CharacterRegistry = CharacterRegistry;
//# sourceMappingURL=characterRegistry.js.map