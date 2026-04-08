/**
 * Generate hand-crafted animation JSON files for the Kimodo pivot system.
 * These replace the synthetic fallback with carefully tuned motion curves
 * that are expressive and visually distinct from the procedural code in RawScene.ts.
 *
 * Key differences from procedural:
 * - Eased timing (cubic/expo) instead of pure sine
 * - More secondary motion (body follow-through, delayed reactions)
 * - Asymmetric patterns (not just mirrored sine)
 * - Distinct character for each repair state
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '../../public/animations/kimodo');
const FPS = 30;

// --- Math helpers ---
function ease(t) { return t * t * (3 - 2 * t); } // smoothstep
function easeIn(t) { return t * t; }
function easeOut(t) { return 1 - (1 - t) * (1 - t); }
function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
function lerp(a, b, t) { return a + (b - a) * t; }
function sin(x) { return Math.sin(x); }
function cos(x) { return Math.cos(x); }
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

function generateAnimation(name, duration, loop, prompt, generator) {
  const numFrames = Math.round(duration * FPS);
  const times = [];
  const pivots = {
    left_arm_shoulder: [],
    left_arm_elbow: [],
    right_arm_shoulder: [],
    right_arm_elbow: [],
    left_leg_hip: [],
    left_leg_knee: [],
    right_leg_hip: [],
    right_leg_knee: [],
  };
  const bodyTiltX = [];
  const rootTranslation = [];

  for (let i = 0; i < numFrames; i++) {
    const t = i / FPS;
    const phase = (i / numFrames); // 0..1 normalized
    times.push(parseFloat(t.toFixed(6)));

    const frame = generator(t, phase, duration);

    bodyTiltX.push(parseFloat((frame.bodyTiltX || 0).toFixed(6)));
    rootTranslation.push([
      parseFloat((frame.rootX || 0).toFixed(6)),
      parseFloat((frame.rootY || 0).toFixed(6)),
      parseFloat((frame.rootZ || 0).toFixed(6)),
    ]);

    for (const key of Object.keys(pivots)) {
      pivots[key].push(parseFloat((frame[key] || 0).toFixed(6)));
    }
  }

  // Convert to the format KimodoAnimator expects
  const pivotData = {};
  for (const [key, angles] of Object.entries(pivots)) {
    pivotData[key] = { joint: key, axis: 'x', angles };
  }

  return {
    fps: FPS,
    duration,
    num_frames: numFrames,
    times,
    root_translation: rootTranslation,
    pivots: pivotData,
    body_tilt_x: bodyTiltX,
    name,
    loop,
    prompt,
  };
}

// =====================================================================
// STATE 0: BROKEN — Face down, only left arm
// =====================================================================

const fallen_idle = generateAnimation('fallen_idle', 4.0, true,
  'Robot lying face down, broken, breathing weakly',
  (t) => {
    // Slow, labored breathing. Occasional twitch.
    const breathe = sin(t * 1.2) * 0.5 + sin(t * 0.7) * 0.3;
    const twitch = sin(t * 7.3) * Math.max(0, sin(t * 0.4) - 0.85) * 3;

    return {
      bodyTiltX: breathe * 0.03 + twitch * 0.02,
      rootY: breathe * 0.008,
      // Left arm draped forward, occasional finger-curl twitch
      left_arm_shoulder: 0.2 + sin(t * 0.5) * 0.1 + twitch * 0.15,
      left_arm_elbow: 0.15 + sin(t * 0.6) * 0.05,
      // Right arm missing - values ignored but set to 0
      right_arm_shoulder: 0,
      right_arm_elbow: 0,
      // Legs missing
      left_leg_hip: 0,
      left_leg_knee: 0,
      right_leg_hip: 0,
      right_leg_knee: 0,
    };
  }
);

const one_arm_crawl = generateAnimation('one_arm_crawl', 2.2, true,
  'One-arm army crawl, desperate dragging motion',
  (t) => {
    // Asymmetric crawl cycle: REACH (fast) → DIG IN → PULL (slow, powerful) → RESET
    const cycleT = (t % 2.2) / 2.2; // 0..1 per cycle

    // Phase breakdown: reach=0-0.3, dig=0.3-0.4, pull=0.4-0.85, reset=0.85-1.0
    let shoulder, elbow, bodyTilt, bodyY, bodyRoll;

    if (cycleT < 0.3) {
      // REACH: arm extends forward fast
      const p = easeOut(cycleT / 0.3);
      shoulder = lerp(-1.2, 0.7, p);  // swing from pulled-back to forward
      elbow = lerp(0.9, 0.1, p);      // straighten out
      bodyTilt = lerp(0.08, -0.12, p); // body lifts slightly
      bodyY = lerp(0.06, -0.02, p);    // up during reach
      bodyRoll = lerp(0.15, -0.08, p); // roll toward reaching side
    } else if (cycleT < 0.4) {
      // DIG IN: hand plants, brief pause
      const p = (cycleT - 0.3) / 0.1;
      shoulder = lerp(0.7, 0.5, p);
      elbow = lerp(0.1, 0.3, p);  // slight bend as weight loads
      bodyTilt = -0.12;
      bodyY = -0.02;
      bodyRoll = -0.08 + p * 0.05;
    } else if (cycleT < 0.85) {
      // PULL: slow, powerful drag — the money move
      const p = easeIn((cycleT - 0.4) / 0.45);
      shoulder = lerp(0.5, -1.5, p);   // arm pulls way back
      elbow = lerp(0.3, 1.1, p);       // deep bend, really digging
      bodyTilt = lerp(-0.12, 0.15, p);  // body lurches forward
      bodyY = lerp(-0.02, 0.1, p);      // body drags forward
      bodyRoll = lerp(-0.03, 0.22, p);  // twist with effort
    } else {
      // RESET: quick return
      const p = easeInOut((cycleT - 0.85) / 0.15);
      shoulder = lerp(-1.5, -1.2, p);
      elbow = lerp(1.1, 0.9, p);
      bodyTilt = lerp(0.15, 0.08, p);
      bodyY = lerp(0.1, 0.06, p);
      bodyRoll = lerp(0.22, 0.15, p);
    }

    return {
      bodyTiltX: bodyTilt,
      rootY: bodyY,
      left_arm_shoulder: shoulder,
      left_arm_elbow: elbow,
      right_arm_shoulder: 0,
      right_arm_elbow: 0,
      left_leg_hip: sin(t * 1.5) * 0.05,  // slight drag
      left_leg_knee: 0,
      right_leg_hip: 0,
      right_leg_knee: 0,
    };
  }
);

// =====================================================================
// STATE 1: CRAWLING — Both arms, no legs
// =====================================================================

const crawl_idle = generateAnimation('crawl_idle', 3.5, true,
  'Propped up on both arms, looking around alertly',
  (t) => {
    // Propped up, weight shifting between arms, looking around
    const sway = sin(t * 0.8);
    const look = sin(t * 0.5) * 0.7 + sin(t * 1.3) * 0.3; // head sweep

    return {
      bodyTiltX: -0.05 + sin(t * 0.6) * 0.04,
      rootY: sin(t * 0.7) * 0.01,
      // Arms propping body up, weight shifting
      left_arm_shoulder: 0.25 + sway * 0.12,
      left_arm_elbow: 0.2 - sway * 0.08,
      right_arm_shoulder: 0.25 - sway * 0.12,
      right_arm_elbow: 0.2 + sway * 0.08,
      left_leg_hip: 0,
      left_leg_knee: 0,
      right_leg_hip: 0,
      right_leg_knee: 0,
    };
  }
);

const belly_crawl = generateAnimation('belly_crawl', 1.8, true,
  'Two-arm alternating crawl, determined',
  (t) => {
    // Alternating arm crawl with body twist
    const cycle = (t % 1.8) / 1.8;
    const phase = cycle * Math.PI * 2;

    // Right arm leads, left follows (offset by half cycle)
    const rightPhase = phase;
    const leftPhase = phase + Math.PI;

    // Each arm: reach forward → plant → pull back
    function armCurve(p) {
      const norm = ((p % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2);
      if (norm < 0.35) {
        // Reach
        const t2 = easeOut(norm / 0.35);
        return { shoulder: lerp(-1.0, 0.6, t2), elbow: lerp(0.8, 0.1, t2) };
      } else if (norm < 0.65) {
        // Pull
        const t2 = easeIn((norm - 0.35) / 0.3);
        return { shoulder: lerp(0.6, -1.2, t2), elbow: lerp(0.1, 0.9, t2) };
      } else {
        // Reset/glide
        const t2 = easeInOut((norm - 0.65) / 0.35);
        return { shoulder: lerp(-1.2, -1.0, t2), elbow: lerp(0.9, 0.8, t2) };
      }
    }

    const right = armCurve(rightPhase);
    const left = armCurve(leftPhase);

    // Body rolls toward pulling arm
    const roll = sin(phase) * 0.2;
    // Body bobs with each pull
    const bob = Math.abs(sin(phase)) * 0.07;

    return {
      bodyTiltX: -0.06 + sin(phase * 2) * 0.05,
      rootY: bob,
      left_arm_shoulder: left.shoulder,
      left_arm_elbow: left.elbow,
      right_arm_shoulder: right.shoulder,
      right_arm_elbow: right.elbow,
      left_leg_hip: sin(phase + 0.5) * 0.04, // subtle drag
      left_leg_knee: 0,
      right_leg_hip: sin(phase + 0.5 + Math.PI) * 0.04,
      right_leg_knee: 0,
    };
  }
);

// =====================================================================
// STATE 2: HOBBLING — Both arms + left leg, missing right
// =====================================================================

const hobble_idle = generateAnimation('hobble_idle', 3.0, true,
  'Standing on one leg, arms out for balance, swaying',
  (t) => {
    // Balancing on left leg, right side dips, arms compensate
    const sway = sin(t * 0.9) * 0.7 + sin(t * 2.1) * 0.3; // irregular sway
    const balance = sin(t * 1.4); // faster balance corrections

    return {
      bodyTiltX: sin(t * 0.5) * 0.03,
      rootY: sin(t * 0.6) * 0.015 - 0.005,
      // Arms held out for balance
      right_arm_shoulder: -0.3 + sway * 0.15 + balance * 0.08,
      right_arm_elbow: -0.25 - Math.abs(sway) * 0.1,
      left_arm_shoulder: -0.2 - sway * 0.12,
      left_arm_elbow: -0.2 + Math.abs(sway) * 0.08,
      // Left leg: planted, micro-adjustments
      left_leg_hip: sway * 0.04,
      left_leg_knee: -0.05 - Math.abs(balance) * 0.03,
      // Right leg: missing (0)
      right_leg_hip: 0,
      right_leg_knee: 0,
    };
  }
);

const hobble_walk = generateAnimation('hobble_walk', 1.4, true,
  'Pronounced limp, hopping on one leg with arm windmill',
  (t) => {
    // Hop cycle on left leg — very asymmetric
    const cycle = (t % 1.4) / 1.4;
    const phase = cycle * Math.PI * 2;

    // Hop phases: load(0-0.3) → push(0.3-0.5) → air(0.5-0.7) → land(0.7-1.0)
    let hipAngle, kneeAngle, bodyY, bodyRoll, bodyPitch;
    let rShoulder, lShoulder, rElbow, lElbow;

    if (cycle < 0.3) {
      // LOAD: leg bends, body drops
      const p = easeIn(cycle / 0.3);
      hipAngle = lerp(0.1, 0.35, p);
      kneeAngle = lerp(-0.15, -0.7, p);
      bodyY = lerp(0, -0.08, p);
      bodyRoll = lerp(0.03, 0.12, p);  // lean toward missing leg
      bodyPitch = lerp(0, 0.06, p);    // lean forward
      rShoulder = lerp(-0.2, -0.5, p);
      lShoulder = lerp(-0.15, 0.3, p);
      rElbow = lerp(-0.2, -0.35, p);
      lElbow = lerp(-0.15, -0.1, p);
    } else if (cycle < 0.5) {
      // PUSH: explosive extension
      const p = easeOut((cycle - 0.3) / 0.2);
      hipAngle = lerp(0.35, -0.2, p);
      kneeAngle = lerp(-0.7, -0.1, p);
      bodyY = lerp(-0.08, 0.06, p);
      bodyRoll = lerp(0.12, 0.02, p);
      bodyPitch = lerp(0.06, -0.04, p);
      rShoulder = lerp(-0.5, 0.3, p);   // arms swing up
      lShoulder = lerp(0.3, -0.4, p);
      rElbow = lerp(-0.35, -0.15, p);
      lElbow = lerp(-0.1, -0.3, p);
    } else if (cycle < 0.7) {
      // AIR: brief float
      const p = (cycle - 0.5) / 0.2;
      hipAngle = lerp(-0.2, 0.15, easeInOut(p));
      kneeAngle = lerp(-0.1, -0.3, easeInOut(p));
      bodyY = lerp(0.06, 0.02, p);
      bodyRoll = 0.02 + sin(p * Math.PI) * 0.03;
      bodyPitch = -0.04 + p * 0.02;
      rShoulder = lerp(0.3, 0.1, p);
      lShoulder = lerp(-0.4, -0.2, p);
      rElbow = -0.15;
      lElbow = -0.3 + p * 0.1;
    } else {
      // LAND: impact absorption
      const p = easeIn((cycle - 0.7) / 0.3);
      hipAngle = lerp(0.15, 0.1, p);
      kneeAngle = lerp(-0.3, -0.15, easeOut(p));
      bodyY = lerp(0.02, 0, p);
      bodyRoll = lerp(0.05, 0.03, p);
      bodyPitch = lerp(-0.02, 0, p);
      rShoulder = lerp(0.1, -0.2, p);
      lShoulder = lerp(-0.2, -0.15, p);
      rElbow = lerp(-0.15, -0.2, p);
      lElbow = lerp(-0.2, -0.15, p);
    }

    return {
      bodyTiltX: bodyPitch,
      rootY: bodyY,
      left_arm_shoulder: lShoulder,
      left_arm_elbow: lElbow,
      right_arm_shoulder: rShoulder,
      right_arm_elbow: rElbow,
      left_leg_hip: hipAngle,
      left_leg_knee: kneeAngle,
      right_leg_hip: 0,
      right_leg_knee: 0,
    };
  }
);

// =====================================================================
// STATE 3: WALKING — Fully repaired
// =====================================================================

const standard_idle = generateAnimation('standard_idle', 4.0, true,
  'Natural standing idle with weight shifts and breathing',
  (t) => {
    // Natural idle: weight shift, breathing, looking around
    const breathe = sin(t * 1.0);
    const weightShift = sin(t * 0.4);
    const microShift = sin(t * 2.3) * 0.3; // subtle fidget

    return {
      bodyTiltX: breathe * 0.015 + microShift * 0.005,
      rootY: breathe * 0.008,
      // Arms hang naturally with slight sway
      left_arm_shoulder: 0.02 + weightShift * 0.03 + microShift * 0.01,
      left_arm_elbow: -0.1 + sin(t * 0.6) * 0.03,
      right_arm_shoulder: -0.02 - weightShift * 0.025,
      right_arm_elbow: -0.1 - sin(t * 0.7) * 0.025,
      // Legs: subtle weight shift
      left_leg_hip: weightShift * 0.02,
      left_leg_knee: -0.03 - Math.abs(weightShift) * 0.02,
      right_leg_hip: -weightShift * 0.02,
      right_leg_knee: -0.03 + Math.abs(weightShift) * 0.015,
    };
  }
);

const walking = generateAnimation('walking', 1.6, true,
  'Confident bipedal walk with arm counter-swing',
  (t) => {
    // Professional walk cycle with proper gait phases
    const cycle = (t % 1.6) / 1.6;
    const phase = cycle * Math.PI * 2;

    // Legs: asymmetric stride with proper contact/swing phases
    // Contact → Midstance → Toe-off → Swing
    const leftHip = sin(phase) * 0.45;
    const rightHip = sin(phase + Math.PI) * 0.45;

    // Knee: bends during swing phase (when hip goes forward)
    const leftSwing = clamp(sin(phase - 0.4), 0, 1);
    const rightSwing = clamp(sin(phase + Math.PI - 0.4), 0, 1);
    const leftContact = clamp(sin(phase + 0.8), 0, 1) * 0.15;
    const rightContact = clamp(sin(phase + Math.PI + 0.8), 0, 1) * 0.15;
    const leftKnee = -(leftSwing * 0.65 + leftContact);
    const rightKnee = -(rightSwing * 0.65 + rightContact);

    // Arms: counter-swing with slight delay, elbows bend on backswing
    const armPhase = phase + 0.15; // slight delay
    const leftShoulder = -sin(armPhase) * 0.35;
    const rightShoulder = sin(armPhase) * 0.35;
    const leftArmBack = clamp(sin(armPhase), 0, 1);
    const rightArmBack = clamp(-sin(armPhase), 0, 1);
    const leftElbow = -0.12 - leftArmBack * 0.22;
    const rightElbow = -0.12 - rightArmBack * 0.22;

    // Body: vertical bounce at double frequency, lateral sway
    const bounce = Math.abs(sin(phase)) * 0.04;
    const lateralSway = sin(phase) * 0.025;
    const forwardLean = -0.04 + sin(phase * 2) * 0.01;

    return {
      bodyTiltX: forwardLean,
      rootY: bounce,
      left_arm_shoulder: leftShoulder,
      left_arm_elbow: leftElbow,
      right_arm_shoulder: rightShoulder,
      right_arm_elbow: rightElbow,
      left_leg_hip: leftHip,
      left_leg_knee: leftKnee,
      right_leg_hip: rightHip,
      right_leg_knee: rightKnee,
    };
  }
);

const happy_walk = generateAnimation('happy_walk', 1.4, true,
  'Bouncy happy walk, recovered and confident',
  (t) => {
    const cycle = (t % 1.4) / 1.4;
    const phase = cycle * Math.PI * 2;

    // Bouncier, wider stride
    const leftHip = sin(phase) * 0.5;
    const rightHip = sin(phase + Math.PI) * 0.5;
    const leftSwing = clamp(sin(phase - 0.3), 0, 1);
    const rightSwing = clamp(sin(phase + Math.PI - 0.3), 0, 1);
    const leftKnee = -(leftSwing * 0.7);
    const rightKnee = -(rightSwing * 0.7);

    // Exuberant arm swing
    const leftShoulder = -sin(phase + 0.1) * 0.45;
    const rightShoulder = sin(phase + 0.1) * 0.45;
    const leftElbow = -0.08 - clamp(sin(phase + 0.1), 0, 1) * 0.25;
    const rightElbow = -0.08 - clamp(-sin(phase + 0.1), 0, 1) * 0.25;

    // Extra bounce
    const bounce = Math.abs(sin(phase)) * 0.06;

    return {
      bodyTiltX: -0.05 + sin(phase * 2) * 0.015,
      rootY: bounce,
      left_arm_shoulder: leftShoulder,
      left_arm_elbow: leftElbow,
      right_arm_shoulder: rightShoulder,
      right_arm_elbow: rightElbow,
      left_leg_hip: leftHip,
      left_leg_knee: leftKnee,
      right_leg_hip: rightHip,
      right_leg_knee: rightKnee,
    };
  }
);

// =====================================================================
// SPECIAL ANIMATIONS
// =====================================================================

const picking_up = generateAnimation('picking_up', 2.0, false,
  'Bending down to pick something up',
  (t) => {
    const phase = clamp(t / 2.0, 0, 1);

    let bend, armReach, kneeB;
    if (phase < 0.4) {
      // Bend down
      const p = easeInOut(phase / 0.4);
      bend = p * 0.6;
      armReach = p * 0.8;
      kneeB = -p * 0.5;
    } else if (phase < 0.6) {
      // Hold at bottom
      bend = 0.6;
      armReach = 0.8;
      kneeB = -0.5;
    } else {
      // Rise back up
      const p = easeInOut((phase - 0.6) / 0.4);
      bend = 0.6 * (1 - p);
      armReach = 0.8 * (1 - p);
      kneeB = -0.5 * (1 - p);
    }

    return {
      bodyTiltX: bend,
      rootY: -bend * 0.15,
      left_arm_shoulder: armReach * 0.5,
      left_arm_elbow: armReach * 0.3,
      right_arm_shoulder: armReach * 0.5,
      right_arm_elbow: armReach * 0.3,
      left_leg_hip: bend * 0.3,
      left_leg_knee: kneeB,
      right_leg_hip: bend * 0.3,
      right_leg_knee: kneeB,
    };
  }
);

const celebrate = generateAnimation('celebrate', 3.0, false,
  'Victory celebration with fist pump',
  (t) => {
    const phase = clamp(t / 3.0, 0, 1);

    // Wind up → big fist pump → bounce celebration
    let rShoulder, rElbow, lShoulder, lElbow, bodyY, bodyTilt;

    if (phase < 0.2) {
      // Wind up: crouch slightly
      const p = easeIn(phase / 0.2);
      rShoulder = lerp(0, 0.3, p);
      rElbow = lerp(-0.1, -0.8, p);
      lShoulder = lerp(0, 0.2, p);
      lElbow = lerp(-0.1, -0.5, p);
      bodyY = -p * 0.05;
      bodyTilt = p * 0.08;
    } else if (phase < 0.4) {
      // FIST PUMP: arm shoots up
      const p = easeOut((phase - 0.2) / 0.2);
      rShoulder = lerp(0.3, -2.5, p);  // way up overhead
      rElbow = lerp(-0.8, -0.3, p);
      lShoulder = lerp(0.2, -0.8, p);
      lElbow = lerp(-0.5, -0.6, p);
      bodyY = lerp(-0.05, 0.1, p);
      bodyTilt = lerp(0.08, -0.15, p);  // lean back triumphantly
    } else {
      // Bouncy celebration
      const celebT = (phase - 0.4) / 0.6;
      const bounce = sin(celebT * Math.PI * 6) * (1 - celebT) * 0.08;
      rShoulder = -2.5 + sin(celebT * Math.PI * 3) * 0.3;
      rElbow = -0.3;
      lShoulder = -0.8 + sin(celebT * Math.PI * 3 + 1) * 0.2;
      lElbow = -0.6;
      bodyY = 0.1 + bounce;
      bodyTilt = -0.15 + sin(celebT * Math.PI * 4) * 0.05;
    }

    // Legs: slight bounce
    const legBounce = phase > 0.4 ? sin((phase - 0.4) / 0.6 * Math.PI * 6) * 0.1 * (1 - (phase - 0.4) / 0.6) : 0;

    return {
      bodyTiltX: bodyTilt,
      rootY: bodyY,
      left_arm_shoulder: lShoulder,
      left_arm_elbow: lElbow,
      right_arm_shoulder: rShoulder,
      right_arm_elbow: rElbow,
      left_leg_hip: legBounce,
      left_leg_knee: -Math.abs(legBounce) * 0.5,
      right_leg_hip: -legBounce,
      right_leg_knee: -Math.abs(legBounce) * 0.5,
    };
  }
);

// =====================================================================
// WRITE ALL FILES
// =====================================================================

const animations = {
  fallen_idle,
  one_arm_crawl,
  crawl_idle,
  belly_crawl,
  hobble_idle,
  hobble_walk,
  standard_idle,
  walking,
  happy_walk,
  picking_up,
  celebrate,
};

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Write each animation
for (const [name, data] of Object.entries(animations)) {
  const filePath = path.join(OUTPUT_DIR, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`  ${name}.json (${data.num_frames} frames, ${data.duration}s)`);
}

// Write manifest — KimodoAnimator expects Record<string, {...}> keyed by name
const manifest = {
  version: 1,
  mode: 'pivot',
  animations: {},
};

for (const [name, data] of Object.entries(animations)) {
  manifest.animations[name] = {
    file: `${name}.json`,
    loop: data.loop,
    duration: data.duration,
    prompt: data.prompt,
  };
}

fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\nManifest written with ${Object.keys(animations).length} animations`);
console.log('Done!');
