/**
 * The minimum a sprite sheet must provide to be animated.
 *
 * Keeping this interface free of browser types means the timing logic can
 * be unit tested outside a browser.
 */
export interface AnimationSource {
  readonly frameCount: number;
}

/** A single animation the controller can play. */
export interface Animation {
  readonly id: string;
  readonly source: AnimationSource;
  /**
   * Total length of one loop of the animation, in milliseconds.
   *
   * The sprite manifests store a single duration per state, which is the
   * length of the whole animation rather than the length of one frame, so
   * the per-frame time is derived from the frame count.
   */
  readonly duration: number;
  readonly loop: boolean;
}

/** A frame within an animation. */
export interface AnimationFrame {
  readonly index: number;
  readonly duration: number;
}

/**
 * Controls which frame of which animation is displayed.
 *
 * The controller is deliberately free of any DOM knowledge: it computes the
 * current frame index, and the renderer draws it. That keeps the timing
 * logic unit-testable outside a browser.
 */
export class AnimationController {
  private current: Animation | undefined;
  private elapsed = 0;
  private finished = false;
  private onComplete: (() => void) | undefined;

  constructor(
    private speed: number = 1,
    private reducedMotion: boolean = false
  ) {}

  /** Sets the playback speed multiplier. */
  setSpeed(speed: number): void {
    this.speed = speed > 0 ? speed : 1;
  }

  /** Sets reduced-motion mode. */
  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  /** The animation currently playing. */
  getCurrent(): Animation | undefined {
    return this.current;
  }

  /** True once a non-looping animation has played to its end. */
  hasFinished(): boolean {
    return this.finished;
  }

  /**
   * Starts an animation.
   *
   * @param onComplete called when a non-looping animation ends
   */
  play(animation: Animation, onComplete?: () => void): void {
    const isSame = this.current?.id === animation.id;
    if (!isSame) {
      this.elapsed = 0;
      this.finished = false;
    }
    this.current = animation;
    this.onComplete = onComplete;
    if (!animation.loop) {
      this.finished = false;
    }
  }

  /** Stops the current animation without firing the completion callback. */
  stop(): void {
    this.current = undefined;
    this.elapsed = 0;
    this.finished = false;
    this.onComplete = undefined;
  }

  /**
   * Advances the animation by `deltaMs` and returns the frame to draw.
   *
   * @returns the frame index, or `undefined` when no animation is playing
   */
  update(deltaMs: number): number | undefined {
    const animation = this.current;
    if (!animation) {
      return undefined;
    }

    if (this.reducedMotion) {
      // Reduced motion holds on the first frame rather than animating.
      return 0;
    }

    this.elapsed += deltaMs * this.speed;

    const frames = animation.source.frameCount;
    if (frames <= 0) {
      return undefined;
    }

    const frameDuration = animation.duration / frames;
    const total = animation.duration;

    if (this.elapsed >= total) {
      if (animation.loop) {
        this.elapsed %= total;
      } else {
        this.elapsed = total;
        if (!this.finished) {
          this.finished = true;
          const callback = this.onComplete;
          this.onComplete = undefined;
          callback?.();
        }
        return frames - 1;
      }
    }

    return Math.min(frames - 1, Math.floor(this.elapsed / frameDuration));
  }

  /** The frames of the current animation, used by tests. */
  getFrames(): AnimationFrame[] {
    const animation = this.current;
    if (!animation) {
      return [];
    }
    const frameDuration = animation.duration / animation.source.frameCount;
    return Array.from({ length: animation.source.frameCount }, (_, index) => ({
      index,
      duration: frameDuration,
    }));
  }
}
