import * as assert from 'assert';
import { Animation, AnimationController } from '../../webview/src/renderer/animationController';

function animation(id: string, frames: number, duration = 400, loop = true): Animation {
  return { id, source: { frameCount: frames }, duration, loop };
}

describe('AnimationController', () => {
  it('returns undefined when nothing is playing', () => {
    const controller = new AnimationController();
    assert.strictEqual(controller.update(16), undefined);
  });

  it('selects the first frame after playing', () => {
    const controller = new AnimationController();
    controller.play(animation('idle', 4));
    assert.strictEqual(controller.update(0), 0);
  });

  it('advances to the next frame as time passes', () => {
    const controller = new AnimationController();
    // Four frames over 400 ms means 100 ms per frame.
    controller.play(animation('idle', 4, 400));
    assert.strictEqual(controller.update(50), 0);
    assert.strictEqual(controller.update(60), 1);
    assert.strictEqual(controller.update(100), 2);
  });

  it('loops back to the first frame', () => {
    const controller = new AnimationController();
    controller.play(animation('idle', 3, 300));
    controller.update(300);
    assert.strictEqual(controller.update(1), 0);
  });

  it('holds the last frame of a non-looping animation', () => {
    const controller = new AnimationController();
    controller.play(animation('success', 4, 400, false));
    controller.update(500);
    assert.strictEqual(controller.update(100), 3);
  });

  it('fires the completion callback once for a non-looping animation', () => {
    let completions = 0;
    const controller = new AnimationController();
    controller.play(animation('success', 2, 200, false), () => {
      completions += 1;
    });
    controller.update(500);
    controller.update(500);
    assert.strictEqual(completions, 1);
  });

  it('does not fire the completion callback for a looping animation', () => {
    let completions = 0;
    const controller = new AnimationController();
    controller.play(animation('idle', 2, 200, true), () => {
      completions += 1;
    });
    controller.update(1000);
    assert.strictEqual(completions, 0);
  });

  it('applies the speed multiplier', () => {
    const controller = new AnimationController(2);
    controller.play(animation('idle', 4, 400));
    controller.update(50);
    assert.strictEqual(controller.update(0), 1);
  });

  it('holds the first frame in reduced-motion mode', () => {
    const controller = new AnimationController(1, true);
    controller.play(animation('idle', 4, 400));
    assert.strictEqual(controller.update(500), 0);
  });

  it('can be paused and resumed', () => {
    const controller = new AnimationController();
    controller.play(animation('idle', 4, 400));
    controller.update(50);
    const paused = controller.update(0);
    assert.strictEqual(paused, 0);

    controller.setSpeed(1);
    assert.strictEqual(controller.update(100), 1);
  });

  it('resets the elapsed time when a different animation is played', () => {
    const controller = new AnimationController();
    controller.play(animation('idle', 4, 400));
    controller.update(250);
    controller.play(animation('typing', 4, 400));
    assert.strictEqual(controller.update(0), 0);
  });

  it('keeps the elapsed time when the same animation is replayed', () => {
    const controller = new AnimationController();
    controller.play(animation('idle', 4, 400));
    controller.update(250);
    controller.play(animation('idle', 4, 400));
    assert.strictEqual(controller.update(0), 2);
  });

  it('stops cleanly and clears the completion callback', () => {
    let completions = 0;
    const controller = new AnimationController();
    controller.play(animation('success', 2, 200, false), () => {
      completions += 1;
    });
    controller.stop();
    controller.update(1000);
    assert.strictEqual(completions, 0);
    assert.strictEqual(controller.getCurrent(), undefined);
  });

  it('reports the frames of the current animation', () => {
    const controller = new AnimationController();
    controller.play(animation('idle', 3, 300));
    assert.strictEqual(controller.getFrames().length, 3);
  });

  it('clamps out-of-range frame indices', () => {
    const controller = new AnimationController();
    controller.play(animation('success', 2, 200, false));
    // A non-looping animation holds its last frame rather than running off
    // the end of the sprite strip.
    assert.strictEqual(controller.update(100000), 1);
  });

  it('keeps the loop phase when a long time passes at once', () => {
    const controller = new AnimationController();
    controller.play(animation('idle', 2, 200));
    // 300 ms is one full loop plus 100 ms, so the second frame is showing.
    assert.strictEqual(controller.update(300), 1);
  });

  it('ignores a non-positive speed', () => {
    const controller = new AnimationController();
    controller.setSpeed(0);
    controller.play(animation('idle', 4, 400));
    controller.update(50);
    assert.strictEqual(controller.update(0), 0);
  });
});
