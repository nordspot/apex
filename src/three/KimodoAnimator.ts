/**
 * KimodoAnimator — plays Kimodo-generated pivot animations on MEMO-9.
 *
 * Loads JSON keyframe files produced by the Kimodo pipeline (tools/kimodo/convert.py --mode pivot).
 * Each animation contains per-frame rotation angles for shoulder/elbow/hip/knee pivots,
 * plus body tilt and root translation.
 *
 * Usage in RawScene.ts:
 *   this.animator = new KimodoAnimator();
 *   await this.animator.loadManifest('/animations/kimodo/manifest.json');
 *   this.animator.play('belly_crawl', { loop: true, crossfade: 0.2 });
 *   // In update loop:
 *   const pose = this.animator.sample(delta);
 *   // Apply pose.pivots to mesh pivots
 */

import * as THREE from 'three';

// ── Types ────────────────────────────────────────────────────────────────

interface PivotTrack {
  soma_joint: string;
  pivot_name: string;   // 'left_arm', 'right_arm', 'left_leg', 'right_leg'
  pivot_type: string;   // 'shoulder', 'elbow', 'hip', 'knee'
  angles: number[];     // Per-frame rotation angle (radians)
}

interface KimodoAnimation {
  name: string;
  fps: number;
  duration: number;
  num_frames: number;
  times: number[];
  root_translation: number[][];  // [frame][xyz]
  pivots: Record<string, PivotTrack>;
  body_tilt_x: number[];
  loop: boolean;
  prompt: string;
}

interface AnimationManifest {
  version: number;
  mode: string;
  animations: Record<string, {
    file: string;
    loop: boolean;
    duration: number;
    prompt: string;
  }>;
}

/** Output pose from sampling an animation at a given time. */
export interface KimodoPose {
  /** Pivot rotation angles in radians. Key = "left_arm_shoulder", "right_leg_knee", etc. */
  pivots: Record<string, number>;
  /** Overall body forward tilt (sum of spine chain) */
  bodyTiltX: number;
  /** Root translation delta from animation start */
  rootTranslation: THREE.Vector3;
  /** Whether the animation has finished (non-looping only) */
  finished: boolean;
}

// ── Animator ─────────────────────────────────────────────────────────────

export class KimodoAnimator {
  private animations: Map<string, KimodoAnimation> = new Map();
  private manifest: AnimationManifest | null = null;
  private basePath = '';

  // Playback state
  private current: string | null = null;
  private currentTime = 0;
  private currentLoop = false;
  private playing = false;

  // Crossfade state
  private previous: string | null = null;
  private previousTime = 0;
  private crossfadeDuration = 0;
  private crossfadeElapsed = 0;
  private crossfading = false;

  // ── Loading ──

  async loadManifest(url: string): Promise<void> {
    this.basePath = url.substring(0, url.lastIndexOf('/') + 1);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to load manifest: ${resp.status}`);
    this.manifest = await resp.json();
    console.log(`[Kimodo] Loaded manifest: ${Object.keys(this.manifest!.animations).length} animations`);
  }

  async loadAnimation(name: string): Promise<KimodoAnimation> {
    // Already loaded?
    const cached = this.animations.get(name);
    if (cached) return cached;

    // Find in manifest
    const entry = this.manifest?.animations[name];
    if (!entry) throw new Error(`[Kimodo] Animation "${name}" not in manifest`);

    const url = this.basePath + entry.file;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`[Kimodo] Failed to load ${url}: ${resp.status}`);

    const data: KimodoAnimation = await resp.json();
    data.loop = entry.loop;
    this.animations.set(name, data);
    console.log(`[Kimodo] Loaded "${name}": ${data.num_frames} frames, ${data.duration.toFixed(1)}s`);
    return data;
  }

  async preloadAll(): Promise<void> {
    if (!this.manifest) return;
    const promises = Object.keys(this.manifest.animations).map(name =>
      this.loadAnimation(name).catch(e => console.warn(`[Kimodo] Preload failed: ${name}`, e))
    );
    await Promise.all(promises);
  }

  // ── Playback control ──

  async play(name: string, options: { loop?: boolean; crossfade?: number } = {}): Promise<void> {
    if (this.current === name && this.playing) return; // Already playing

    // Try synchronous path first (animation already cached from preloadAll)
    const cached = this.animations.get(name);
    const anim = cached ?? await this.loadAnimation(name);
    const crossfade = options.crossfade ?? 0.2;
    const loop = options.loop ?? anim.loop;

    // Start crossfade from current animation
    if (this.current && this.playing && crossfade > 0) {
      this.previous = this.current;
      this.previousTime = this.currentTime;
      this.crossfadeDuration = crossfade;
      this.crossfadeElapsed = 0;
      this.crossfading = true;
    } else {
      this.crossfading = false;
    }

    this.current = name;
    this.currentTime = 0;
    this.currentLoop = loop;
    this.playing = true;
  }

  stop(): void {
    this.playing = false;
    this.crossfading = false;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get currentAnimation(): string | null {
    return this.current;
  }

  // ── Sampling ──

  /**
   * Advance time and sample the current animation pose.
   * Call once per frame in the update loop.
   */
  sample(delta: number): KimodoPose {
    const emptyPose: KimodoPose = {
      pivots: {},
      bodyTiltX: 0,
      rootTranslation: new THREE.Vector3(),
      finished: false,
    };

    if (!this.playing || !this.current) return emptyPose;

    const anim = this.animations.get(this.current);
    if (!anim) return emptyPose;

    // Advance time
    this.currentTime += delta;

    // Handle loop / finish
    let finished = false;
    if (this.currentTime >= anim.duration) {
      if (this.currentLoop) {
        this.currentTime %= anim.duration;
      } else {
        this.currentTime = anim.duration;
        finished = true;
      }
    }

    // Sample current animation
    const pose = this.sampleAt(anim, this.currentTime);
    pose.finished = finished;

    // Crossfade blending
    if (this.crossfading && this.previous) {
      const prevAnim = this.animations.get(this.previous);
      if (prevAnim) {
        this.crossfadeElapsed += delta;
        const t = Math.min(this.crossfadeElapsed / this.crossfadeDuration, 1);

        if (t >= 1) {
          // Crossfade complete
          this.crossfading = false;
          this.previous = null;
        } else {
          // Blend previous pose with current pose
          this.previousTime += delta;
          if (this.previousTime > prevAnim.duration) {
            this.previousTime %= prevAnim.duration;
          }
          const prevPose = this.sampleAt(prevAnim, this.previousTime);
          this.blendPoses(pose, prevPose, t);
        }
      }
    }

    if (finished) {
      this.playing = false;
    }

    return pose;
  }

  private sampleAt(anim: KimodoAnimation, time: number): KimodoPose {
    const { fps, num_frames } = anim;

    // Calculate frame index and interpolation factor
    const frameFloat = time * fps;
    const frame0 = Math.min(Math.floor(frameFloat), num_frames - 1);
    const frame1 = Math.min(frame0 + 1, num_frames - 1);
    const frac = frameFloat - frame0;

    const pose: KimodoPose = {
      pivots: {},
      bodyTiltX: 0,
      rootTranslation: new THREE.Vector3(),
      finished: false,
    };

    // Interpolate pivot angles
    for (const [key, track] of Object.entries(anim.pivots)) {
      const a0 = track.angles[frame0];
      const a1 = track.angles[frame1];
      pose.pivots[key] = a0 + (a1 - a0) * frac;
    }

    // Interpolate body tilt
    if (anim.body_tilt_x) {
      const t0 = anim.body_tilt_x[frame0];
      const t1 = anim.body_tilt_x[frame1];
      pose.bodyTiltX = t0 + (t1 - t0) * frac;
    }

    // Interpolate root translation
    if (anim.root_translation) {
      const r0 = anim.root_translation[frame0];
      const r1 = anim.root_translation[frame1];
      pose.rootTranslation.set(
        r0[0] + (r1[0] - r0[0]) * frac,
        r0[1] + (r1[1] - r0[1]) * frac,
        r0[2] + (r1[2] - r0[2]) * frac,
      );
    }

    return pose;
  }

  private blendPoses(current: KimodoPose, previous: KimodoPose, t: number): void {
    // t = 0 → fully previous, t = 1 → fully current
    for (const key of Object.keys(current.pivots)) {
      const prev = previous.pivots[key] ?? 0;
      current.pivots[key] = prev + (current.pivots[key] - prev) * t;
    }
    current.bodyTiltX = (previous.bodyTiltX ?? 0) + (current.bodyTiltX - (previous.bodyTiltX ?? 0)) * t;
    current.rootTranslation.lerp(previous.rootTranslation, 1 - t);
  }

  // ── Available animations ──

  getAvailableAnimations(): string[] {
    if (!this.manifest) return [];
    return Object.keys(this.manifest.animations);
  }

  isLoaded(name: string): boolean {
    return this.animations.has(name);
  }
}
