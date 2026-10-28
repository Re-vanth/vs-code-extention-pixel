import * as fs from 'fs';
import * as path from 'path';
import { ActivityState } from '../activity/activityTypes';
import { AnimationDefinition, CharacterDefinition } from './characterTypes';

/**
 * Discovers the characters bundled with the extension.
 *
 * Characters are declared by the presence of a `manifest.json` under
 * `media/sprites/<id>/`, so adding a character means dropping in a folder -
 * no code changes are required.
 */

interface SpriteManifest {
  id: string;
  name: string;
  personality: string;
  frameWidth: number;
  frameHeight: number;
  states: Record<
    string,
    { file: string; frames: number; duration: number; loop: boolean }
  >;
}

export class CharacterRegistry {
  private readonly characters = new Map<string, CharacterDefinition>();

  constructor(private readonly spritesRoot: string) {}

  /**
   * Loads every character found under the sprites root.
   *
   * @returns the ids that were loaded, in discovery order
   */
  load(): string[] {
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
        const manifest = JSON.parse(raw) as SpriteManifest;
        this.characters.set(manifest.id, this.toDefinition(manifest));
      } catch {
        // A malformed manifest must not stop the extension from loading.
      }
    }

    return [...this.characters.keys()];
  }

  get(id: string): CharacterDefinition | undefined {
    return this.characters.get(id);
  }

  has(id: string): boolean {
    return this.characters.has(id);
  }

  list(): CharacterDefinition[] {
    return [...this.characters.values()];
  }

  get defaultId(): string {
    return this.characters.has('byte') ? 'byte' : [...this.characters.keys()][0] ?? '';
  }

  private toDefinition(manifest: SpriteManifest): CharacterDefinition {
    const states: Record<string, AnimationDefinition> = {};
    for (const [id, state] of Object.entries(manifest.states)) {
      states[id] = {
        id: id as ActivityState,
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
