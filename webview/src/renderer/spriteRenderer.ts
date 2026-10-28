/**
 * Sprite renderer.
 *
 * Draws a single frame of a horizontal sprite strip onto a canvas using
 * nearest-neighbour sampling, so pixel art stays crisp at every scale.
 */

export interface SpriteSheet {
  readonly uri: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frameCount: number;
  readonly image: HTMLImageElement;
}

export class SpriteRenderer {
  private readonly cache = new Map<string, SpriteSheet>();

  constructor(private readonly context: CanvasRenderingContext2D) {}

  /**
   * Loads a sprite strip.
   *
   * @returns the sheet, or `undefined` when the image could not be loaded.
   */
  async load(uri: string, frameWidth: number, frameHeight: number): Promise<SpriteSheet | undefined> {
    const key = `${uri}`;
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const image = new Image();
    const loaded = await new Promise<boolean>((resolve) => {
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = uri;
    });

    if (!loaded) {
      return undefined;
    }

    const frameCount = Math.max(
      1,
      Math.floor(image.naturalWidth / Math.max(1, frameWidth))
    );

    const sheet: SpriteSheet = {
      uri: key,
      frameWidth,
      frameHeight,
      frameCount,
      image,
    };
    this.cache.set(key, sheet);
    return sheet;
  }

  /** Draws one frame of a sheet at the given destination rectangle. */
  drawFrame(sheet: SpriteSheet, frameIndex: number, x: number, y: number, size: number): void {
    const frame = Math.max(0, Math.min(sheet.frameCount - 1, frameIndex));
    const sx = frame * sheet.frameWidth;
    const sy = 0;
    const sw = sheet.frameWidth;
    const sh = sheet.frameHeight;

    this.context.imageSmoothingEnabled = false;
    this.context.clearRect(x, y, size, size);
    this.context.drawImage(sheet.image, sx, sy, sw, sh, x, y, size, size);
  }

  /** Releases every cached image. */
  dispose(): void {
    this.cache.clear();
  }
}
