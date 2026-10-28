"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnimationController = void 0;
/**
 * Controls which frame of which animation is displayed.
 *
 * The controller is deliberately free of any DOM knowledge: it computes the
 * current frame index, and the renderer draws it. That keeps the timing
 * logic unit-testable outside a browser.
 */
class AnimationController {
    speed;
    reducedMotion;
    current;
    elapsed = 0;
    finished = false;
    onComplete;
    constructor(speed = 1, reducedMotion = false) {
        this.speed = speed;
        this.reducedMotion = reducedMotion;
    }
    /** Sets the playback speed multiplier. */
    setSpeed(speed) {
        this.speed = speed > 0 ? speed : 1;
    }
    /** Sets reduced-motion mode. */
    setReducedMotion(reduced) {
        this.reducedMotion = reduced;
    }
    /** The animation currently playing. */
    getCurrent() {
        return this.current;
    }
    /** True once a non-looping animation has played to its end. */
    hasFinished() {
        return this.finished;
    }
    /**
     * Starts an animation.
     *
     * @param onComplete called when a non-looping animation ends
     */
    play(animation, onComplete) {
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
    stop() {
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
    update(deltaMs) {
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
            }
            else {
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
    getFrames() {
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
exports.AnimationController = AnimationController;
//# sourceMappingURL=animationController.js.map