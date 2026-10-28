import { ActivityState } from '../activity/activityTypes';

/** A single frame of a sprite-sheet animation. */
export interface AnimationFrame {
  /** Zero-based frame index within the strip. */
  readonly index: number;
  /** How long the frame is shown, in milliseconds. */
  readonly duration: number;
}
/** Metadata describing one animation state of a character. */
export interface AnimationDefinition {
  readonly id: string;
  /** File name of the sprite strip, relative to the character folder. */
  readonly file: string;
  readonly frames: number;
  readonly duration: number;
  readonly loop: boolean;
}

/** A named colour used by the character's own art. */
export interface CharacterPalette {
  readonly [role: string]: string;
}

/**
 * Everything needed to render and animate one character.
 *
 * Characters differ only in their art and timing; the activity engine, the
 * animation engine and the webview are all character-agnostic.
 */
export interface CharacterDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly personality: string;
  /** Pixel dimensions of one frame. */
  readonly frameWidth: number;
  readonly frameHeight: number;
  /** Preferred playback multiplier, before user settings are applied. */
  readonly preferredSpeed: number;
  readonly palette: CharacterPalette;
  /** Animation states the character implements. */
  readonly states: Readonly<Record<string, AnimationDefinition>>;
  /** Optional per-character status line replacements. */
  readonly messages?: Partial<Record<ActivityState, string>>;
}

/** Runtime view of a character, as loaded from the media folder. */
export interface LoadedCharacter extends CharacterDefinition {
  /** Webview-safe URI for each animation strip. */
  readonly assetUris: Readonly<Record<string, string>>;
}
