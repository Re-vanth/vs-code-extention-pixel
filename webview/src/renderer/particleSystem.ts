/**
 * Lightweight particle system for decorative effects.
 *
 * Particles are purely cosmetic: they never carry information that is not
 * also present in the status text.
 */

export type ParticleKind = 'sparkle' | 'confetti' | 'code' | 'thought' | 'zzz';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  kind: ParticleKind;
  color: string;
  glyph?: string;
}

const PALETTE = ['#A78BFA', '#67E8F9', '#86EFAC', '#FDE68A', '#E5E7EB'];

export class ParticleSystem {
  private readonly particles: Particle[] = [];
  private enabled = true;
  private reducedMotion = false;

  constructor(private readonly maxParticles = 160) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.particles.length = 0;
    }
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    if (reduced) {
      this.particles.length = 0;
    }
  }

  get count(): number {
    return this.particles.length;
  }

  /** Emits a burst of particles for the given animation state. */
  emit(kind: ParticleKind, originX: number, originY: number, intensity = 1): void {
    if (!this.enabled || this.reducedMotion) {
      return;
    }

    const counts: Record<ParticleKind, number> = {
      sparkle: 3,
      confetti: 12,
      code: 4,
      thought: 2,
      zzz: 1,
    };
    const total = Math.round(counts[kind] * intensity);

    for (let i = 0; i < total; i++) {
      if (this.particles.length >= this.maxParticles) {
        break;
      }
      const angle = Math.random() * Math.PI * 2;
      const speed = kind === 'confetti' ? 0.9 + Math.random() * 1.4 : 0.3 + Math.random() * 0.7;

      this.particles.push({
        x: originX + (Math.random() - 0.5) * 14,
        y: originY + (Math.random() - 0.5) * 8,
        vx: Math.cos(angle) * speed,
        vy: kind === 'zzz' ? -0.5 - Math.random() * 0.4 : Math.sin(angle) * speed - 0.3,
        life: 0,
        maxLife: kind === 'confetti' ? 70 + Math.random() * 50 : 45 + Math.random() * 40,
        size: kind === 'confetti' ? 3 : 2,
        kind,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        glyph:
          kind === 'code'
            ? ['{}', '<>', '01', '()', ';'][Math.floor(Math.random() * 5)]
            : kind === 'thought'
              ? '?'
              : kind === 'zzz'
                ? 'Z'
                : undefined,
      });
    }
  }

  /** Advances and draws every live particle. */
  update(deltaMs: number, context: CanvasRenderingContext2D): void {
    if (!this.enabled || this.reducedMotion) {
      return;
    }

    const step = deltaMs / 16.67;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.life += step;

      if (particle.life >= particle.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      particle.x += particle.vx * step;
      particle.y += particle.vy * step;

      if (particle.kind === 'zzz') {
        particle.x += Math.sin(particle.life / 8) * 0.4 * step;
      } else if (particle.kind === 'confetti') {
        particle.vy += 0.05 * step;
        particle.vx += Math.sin(particle.life / 6) * 0.03 * step;
      } else if (particle.kind === 'thought') {
        particle.vy = -0.25;
      } else {
        particle.vy += 0.012 * step;
      }

      this.drawParticle(particle, context);
    }
  }

  /** Removes every particle. */
  clear(): void {
    this.particles.length = 0;
  }

  private drawParticle(particle: Particle, context: CanvasRenderingContext2D): void {
    const progress = particle.life / particle.maxLife;
    const alpha = Math.max(0, 1 - progress);

    context.globalAlpha = alpha;

    if (particle.glyph) {
      context.fillStyle = particle.color;
      context.font = '8px monospace';
      context.textAlign = 'center';
      context.fillText(particle.glyph, particle.x, particle.y);
    } else {
      context.fillStyle = particle.color;
      context.fillRect(
        Math.round(particle.x),
        Math.round(particle.y),
        particle.size,
        particle.size
      );
    }

    context.globalAlpha = 1;
  }
}
