# CLAUDE.md — APEX (Web 3D Rebuild)

## WHAT IS THIS PROJECT

APEX is a AAA-quality 3D mobile puzzle-adventure game built as a Progressive Web App. Players guide MEMO-9, a humanoid delivery robot who crash-landed in the Swiss Alps, back to civilization. Each of 8 levels maps to a Swiss MEM (Mechanical, Electrical, Metal) apprenticeship career.

This is NOT an educational app. It is a real 3D game with cinematic environments, emotional storytelling, and satisfying puzzle mechanics. The educational payload is invisible — embedded in gameplay.

**Quality bar references:** Monument Valley, Machinarium, Alto's Odyssey, Gris, The Wild Robot.

---

## TECH STACK

```
Runtime:
  React 18+ with TypeScript (strict mode)
  React Three Fiber (R3F) — React renderer for Three.js
  Three.js r160+ — 3D rendering
  @react-three/drei — R3F helpers (OrbitControls, Environment, Text, etc.)
  @react-three/rapier — Physics (Rapier WASM)
  @react-three/postprocessing — Bloom, vignette, color grading
  zustand — State management (game state, player state, UI state)
  Howler.js — Audio (music, SFX, spatial audio)

Build:
  Vite — Bundler
  TypeScript — Strict mode, no any
  ESLint + Prettier

Deployment:
  PWA (service worker, manifest, offline capable)
  Cloudflare Pages (hosting)
  Portrait orientation: 1080x1920 reference resolution

Future:
  Supabase — Backend (auth, analytics, leaderboards)
  Capacitor — Native iOS/Android wrapper (Phase 3)
```

---

## PROJECT STRUCTURE

```
apex/
├── public/
│   ├── models/
│   │   ├── memo9/
│   │   │   ├── memo9.glb              # Main robot model (GLB, Mixamo humanoid rig)
│   │   │   └── animations/
│   │   │       ├── fallen-idle.glb
│   │   │       ├── situp-to-idle.glb
│   │   │       ├── zombie-crawl.glb
│   │   │       ├── injured-walk.glb
│   │   │       ├── standard-idle.glb
│   │   │       ├── walking.glb
│   │   │       ├── happy-walk.glb
│   │   │       ├── picking-up.glb
│   │   │       └── sitting.glb
│   │   ├── dog/
│   │   │   └── dog.glb
│   │   └── props/
│   │       ├── crate.glb
│   │       ├── planks.glb
│   │       ├── rocks/                  # 3-5 rock variants
│   │       └── trees/                  # 2-3 alpine tree variants
│   ├── textures/
│   │   ├── terrain/
│   │   │   ├── snow_albedo.jpg
│   │   │   ├── snow_normal.jpg
│   │   │   ├── rock_albedo.jpg
│   │   │   ├── rock_normal.jpg
│   │   │   └── pebbles_albedo.jpg
│   │   ├── skybox/
│   │   │   └── sunset_hdr.hdr         # HDRI for environment lighting
│   │   └── ui/
│   ├── audio/
│   │   ├── music/
│   │   │   ├── level1_ambient.ogg
│   │   │   └── level1_solved.ogg
│   │   └── sfx/
│   │       ├── servo_whir.wav
│   │       ├── click_connect.wav
│   │       ├── part_collect.wav
│   │       ├── footstep_snow.wav
│   │       └── wind_ambient.wav
│   ├── video/
│   │   ├── intro_cinematic.mp4
│   │   └── knowledge_clips/
│   ├── manifest.json
│   └── sw.js                           # Service worker
│
├── src/
│   ├── main.tsx                        # Entry point
│   ├── App.tsx                         # Root: Canvas + UI overlay
│   │
│   ├── stores/                         # Zustand state management
│   │   ├── useGameStore.ts             # Game state: currentLevel, phase
│   │   ├── usePlayerStore.ts           # MEMO-9: repairState, upgrades, cosmetics, name
│   │   ├── useStoryStore.ts            # Narrative flags, dialog history
│   │   ├── useAudioStore.ts            # Music/SFX state
│   │   ├── useUIStore.ts               # HUD visibility, modals, prompts
│   │   └── useAnalyticsStore.ts        # Engagement tracking, aptitude signals
│   │
│   ├── components/                     # React components (non-3D)
│   │   ├── HUD/
│   │   │   ├── HUD.tsx                 # Main HUD overlay (HTML over Canvas)
│   │   │   ├── RepairCounter.tsx       # "REPAIR 0/3" glass panel
│   │   │   ├── MessagePanel.tsx        # Center messages ("Arm attached!")
│   │   │   ├── InteractionPrompt.tsx   # "E - Attach Arm"
│   │   │   ├── VirtualJoystick.tsx     # Touch joystick (left thumb)
│   │   │   └── InteractButton.tsx      # Touch interact button (right thumb)
│   │   ├── Screens/
│   │   │   ├── MainMenu.tsx
│   │   │   ├── CharacterCreator.tsx
│   │   │   ├── KnowledgeClipPlayer.tsx
│   │   │   ├── RealWorldMoment.tsx
│   │   │   ├── ProfileScreen.tsx
│   │   │   └── PauseMenu.tsx
│   │   └── shared/
│   │       ├── GlassPanel.tsx          # Reusable frosted glass UI component
│   │       ├── FadeTransition.tsx
│   │       └── RadarChart.tsx          # Aptitude visualization (SVG)
│   │
│   ├── three/                          # R3F 3D components
│   │   ├── scenes/
│   │   │   ├── Level1Scene.tsx         # Level 1 root: terrain + objects + lighting
│   │   │   ├── Level2Scene.tsx
│   │   │   └── ...
│   │   ├── characters/
│   │   │   ├── Memo9.tsx               # MEMO-9: model, animations, state-driven behavior
│   │   │   ├── Memo9Controller.ts      # Movement logic (camera-relative, speed per state)
│   │   │   ├── Memo9Animator.ts        # Animation state machine
│   │   │   ├── BodyPartManager.ts      # Bone hiding + repair state transitions
│   │   │   └── Dog.tsx                 # Future: companion AI
│   │   ├── environment/
│   │   │   ├── ProceduralTerrain.tsx   # Heightmap-generated terrain mesh
│   │   │   ├── TerrainPainter.ts       # Height-based texture blending
│   │   │   ├── Mountains.tsx           # Ridge generation algorithm
│   │   │   ├── SnowParticles.tsx       # Drifting snow VFX
│   │   │   ├── Skybox.tsx              # HDRI environment
│   │   │   └── Fog.tsx                 # Linear fog component
│   │   ├── props/
│   │   │   ├── CrashCrate.tsx          # Broken shipping crate
│   │   │   ├── PuzzlePart.tsx          # Collectible body part (bob + spin + glow)
│   │   │   ├── RepairStation.tsx       # End-of-level goal
│   │   │   ├── Rocks.tsx               # Instanced rock clusters
│   │   │   └── Trees.tsx               # Instanced alpine trees
│   │   ├── camera/
│   │   │   └── FollowCamera.tsx        # Third-person camera with state adaptation
│   │   ├── lighting/
│   │   │   └── SunsetLighting.tsx      # Directional + ambient + fog preset
│   │   ├── interaction/
│   │   │   ├── InteractionSystem.tsx   # Proximity detection + highlight
│   │   │   └── InteractableObject.tsx  # Base component for interactable items
│   │   └── vfx/
│   │       ├── HolographicUI.tsx       # Cyan holographic projections (world-space)
│   │       ├── UpgradeEffect.tsx       # Cyan burst on part collection
│   │       └── GlowMaterial.tsx        # Pulsing emissive material for interactables
│   │
│   ├── systems/                        # Game logic (not React components)
│   │   ├── InputManager.ts             # Keyboard + gamepad + touch unification
│   │   ├── SaveSystem.ts               # IndexedDB save/load
│   │   ├── AudioManager.ts             # Howler.js wrapper
│   │   ├── AnalyticsManager.ts         # Event tracking
│   │   └── LevelManager.ts            # Level transitions, loading
│   │
│   ├── data/                           # Static game data
│   │   ├── upgrades.ts                 # 9 upgrade definitions
│   │   ├── cosmetics.ts               # Skins, decals, color schemes
│   │   ├── levels.ts                   # Level metadata
│   │   ├── careers.ts                  # 9 career descriptions
│   │   └── dialogs.ts                  # Dialog trees (Level 7+)
│   │
│   ├── hooks/                          # Custom React hooks
│   │   ├── useKeyboard.ts
│   │   ├── useGamepad.ts
│   │   ├── useTouch.ts
│   │   ├── useInteraction.ts           # Proximity + raycast logic
│   │   ├── useAnimationMixer.ts        # Animation playback control
│   │   └── useFrame.ts                 # Re-export from R3F for consistency
│   │
│   ├── utils/
│   │   ├── terrain.ts                  # Heightmap generation algorithms
│   │   ├── math.ts                     # Lerp, clamp, remap utilities
│   │   └── constants.ts               # Global constants
│   │
│   └── types/
│       ├── game.ts                     # Game state types
│       ├── player.ts                   # Player/robot types
│       ├── interaction.ts              # IInteractable interface
│       └── analytics.ts               # Analytics event types
│
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
└── CLAUDE.md                           # THIS FILE
```

---

## ARCHITECTURE PATTERNS

### State Management (Zustand)

All game state lives in Zustand stores. React components and R3F components read from stores. Game logic writes to stores. No prop drilling. No context providers for game state.

```typescript
// stores/usePlayerStore.ts
interface PlayerState {
  // Repair progression
  repairState: 0 | 1 | 2 | 3;  // 0=Broken, 1=Crawling, 2=Hobbling, 3=Walking
  partsCollected: string[];      // ['right_arm', 'left_leg', 'right_leg']
  
  // Robot customization
  robotName: string;             // Personal name (default: "MEMO-9")
  bodyType: 'compact' | 'slim' | 'broad';
  colorScheme: string;
  decalSet: string;
  
  // Upgrades (career modules, later levels)
  acquiredUpgrades: string[];
  
  // Actions
  collectPart: (partId: string) => void;
  setRepairState: (state: 0 | 1 | 2 | 3) => void;
  acquireUpgrade: (upgradeId: string) => void;
}
```

### Component Communication

```
Zustand Store ←→ React Components (HUD, Screens)
      ↕
R3F Components (3D scene, characters, props)
      ↕
Game Systems (InputManager, AudioManager)
```

- 3D components read state via `usePlayerStore()` hooks inside R3F
- 3D components write state via store actions: `usePlayerStore.getState().collectPart('right_arm')`
- HUD components react to store changes automatically (Zustand subscription)
- Audio reacts to store changes: `usePlayerStore.subscribe(state => state.repairState, playUpgradeSound)`

### No Classes, No OOP

This is a React project. Use functional components, hooks, and Zustand stores. No class-based architecture. No MonoBehaviour pattern. No singletons. If you need shared logic, use custom hooks or plain functions.

---

## MEMO-9 CHARACTER (LEVEL 1)

### Model
- Source: Mixamo X Bot (or similar humanoid GLB)
- Export as GLB with embedded textures
- Humanoid skeleton with standard bone names
- Materials: M_Memo9_Base (white/arctic), M_Memo9_Eyes (emissive cyan)

### Bone Hiding for Missing Limbs
At game start, MEMO-9 is missing parts. Hide limbs by setting bone scale to zero:

```typescript
// In Memo9.tsx, after loading model
const hideBonesForState = (skeleton: THREE.Skeleton, repairState: number) => {
  const bonesToHide: Record<string, number> = {
    'mixamorigRightArm': 0,      // Hidden until repairState >= 1
    'mixamorigLeftUpLeg': 1,     // Hidden until repairState >= 2
    'mixamorigRightUpLeg': 2,    // Hidden until repairState >= 3
  };
  
  Object.entries(bonesToHide).forEach(([boneName, minState]) => {
    const bone = skeleton.getBoneByName(boneName);
    if (bone) {
      const visible = repairState > minState; // Note: > not >=, because state 0 = broken
      // Actually: arm shows at state 1, left leg at state 2, right leg at state 3
      bone.scale.setScalar(visible ? 1 : 0);
    }
  });
};
```

**Correction from Unity prototype:** Scale the UPPER bone of each chain to (0,0,0). This collapses the entire child chain (upper arm → forearm → hand, upper leg → lower leg → foot). Do NOT try to hide individual bones.

### Progressive Repair States

| State | repairState | Trigger | Speed | Animation | Camera Height | Camera Distance |
|-------|-------------|---------|-------|-----------|---------------|-----------------|
| Broken | 0 | Game start | 0.25 m/s | Fallen Idle / drag | 3 | 6 |
| Crawling | 1 | Collect Right Arm | 0.6 m/s | Zombie Crawl | 3 | 6 |
| Hobbling | 2 | Collect Left Leg | 1.2 m/s | Injured Walk | 5 | 8 |
| Walking | 3 | Collect Right Leg | 3.0 m/s | Walking | 8 | 10 |

### Movement (Camera-Relative)

**CRITICAL: Movement must be camera-relative.** When the player pushes "up" on the joystick, MEMO-9 moves in the direction the camera is facing, not world-forward.

```typescript
// Camera-relative movement calculation
const cameraForward = new THREE.Vector3();
const cameraRight = new THREE.Vector3();
camera.getWorldDirection(cameraForward);
cameraForward.y = 0;
cameraForward.normalize();
cameraRight.crossVectors(cameraForward, THREE.Object3D.DEFAULT_UP).normalize();

const moveDirection = new THREE.Vector3();
moveDirection.addScaledVector(cameraForward, input.y); // forward/back
moveDirection.addScaledVector(cameraRight, input.x);   // left/right
moveDirection.normalize();

// Apply speed based on repair state
const speed = [0.25, 0.6, 1.2, 3.0][repairState];
position.addScaledVector(moveDirection, speed * delta);

// Rotate MEMO-9 to face movement direction (smooth)
if (moveDirection.length() > 0.01) {
  const targetRotation = Math.atan2(moveDirection.x, moveDirection.z);
  mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, targetRotation, 5 * delta);
}
```

### Animator State Machine

Implement as a simple state machine in `Memo9Animator.ts`. Use Three.js AnimationMixer with crossfade.

```typescript
type AnimState = 'fallen_idle' | 'situp' | 'crawl_idle' | 'crawl_move' 
  | 'hobble_idle' | 'hobble_move' | 'idle' | 'walk' | 'interact' | 'celebrate';

// Transitions:
// fallen_idle → (collect arm) → situp → crawl_idle
// crawl_idle ↔ crawl_move (isMoving)
// crawl_idle → (collect leg) → hobble_idle
// hobble_idle ↔ hobble_move (isMoving)  
// hobble_idle → (collect leg) → idle
// idle ↔ walk (isMoving)
// any → interact → back to idle variant
// idle → celebrate (level complete)

// Crossfade duration: 0.2s for locomotion transitions, 0.0s for trigger transitions (situp, interact)
```

### CharacterController Shape Adaptation

Since we use Rapier physics (not Unity CharacterController), implement as a CapsuleCollider that resizes per state:

| State | Center Y | Height | Radius |
|-------|----------|--------|--------|
| Broken/Crawling | 0.3 | 0.6 | 0.4 |
| Hobbling | 0.8 | 1.6 | 0.4 |
| Walking | 1.0 | 2.0 | 0.4 |

---

## INTERACTION SYSTEM

### Proximity Detection

Every frame, check distance from MEMO-9 to all interactable objects. When within 2m, highlight the object and show interaction prompt.

```typescript
// In useInteraction.ts hook
const INTERACTION_RADIUS = 2.0;

// Find nearest interactable within radius
const nearest = interactables
  .filter(obj => obj.position.distanceTo(playerPos) < INTERACTION_RADIUS)
  .sort((a, b) => a.position.distanceTo(playerPos) - b.position.distanceTo(playerPos))[0];

// Highlight nearest, de-highlight others
// Show prompt in HUD when nearest exists
// On interact input (E / Space / touch button): call nearest.interact()
```

### PuzzlePart (Collectible Body Part)

```typescript
// Visual: Gold metallic material, emissive glow
// Animation: Bob up/down (0.15m amplitude, 1.5s period) + spin (45 deg/s Y-axis)
// Collision: Sphere trigger, radius 0.45m
// On interact: 
//   1. Play collect SFX
//   2. Play cyan burst VFX at part position
//   3. Hide part mesh
//   4. Call usePlayerStore.getState().collectPart(partId)
//   5. Show message in HUD ("Arm attached! You can crawl now.")
//   6. Trigger repair state transition in Memo9
```

Part positions (Level 1):

| Part | ID | Position | Distance from start |
|------|----|----------|-------------------|
| Right Arm | right_arm | (1.5, 0.5, -0.5) | 2m (very close, tutorial) |
| Left Leg | left_leg | (-8, 0.5, 7) | 11m (medium) |
| Right Leg | right_leg | (12, 0.5, 15) | 19m (far, requires exploration) |

---

## LEVEL 1 ENVIRONMENT

### Terrain Generation (Procedural)

Generate terrain mesh from heightmap in code. Do NOT use a pre-made terrain asset.

```typescript
// Terrain parameters
const TERRAIN_SIZE_X = 600;  // meters East-West
const TERRAIN_SIZE_Z = 800;  // meters North-South
const TERRAIN_HEIGHT = 250;  // max height
const SEGMENTS = 256;        // heightmap resolution

// MEMO-9 starts at southern quarter
const PLAYER_NZ = 0.25;     // normalized Z position (0=south, 1=north)

// Play area: flat zone
const PLAY_HALF_X = 80;     // ±80m East-West (160m total)
const PLAY_HALF_Z = 60;     // ±60m North-South (120m total)
const BLEND_DISTANCE = 80;  // smooth transition from flat to mountains

// Mountain ridges (NORTH side, behind camera)
const RIDGES = [
  { nz: 0.15, height: 0.55, width: 0.08, name: 'foothills' },   // 137m
  { nz: 0.40, height: 0.80, width: 0.06, name: 'mid_wall' },    // 200m
  { nz: 0.75, height: 1.00, width: 0.04, name: 'peaks' },       // 250m
];

// Ridge profile: LINEAR triangular (NOT Gaussian — looks more natural)
// Perlin noise variation along ridges for organic feel
// East/West flanks: convex profile (base^2), fade out south of play area
// South: stays at 0 (open vista into fog)
```

**Key lesson from Unity:** Use a flat invisible physics ground plane at Y=0 for the play area. The visual terrain mesh can have subtle undulation, but physics collision should be flat where the player walks. Terrain colliders are unreliable.

### Terrain Texturing (Height-Based Blending)

In the terrain shader/material, blend textures based on height:

```
Height < 0.02 (flat play area): 80% snow, 12% rock, 8% pebbles
Height 0.02 - 0.15 (slopes): Gradient from snow to rock
Height > 0.15 (peaks): Rock dominant, snow returns on highest points
```

Implement as a custom ShaderMaterial with 3 texture inputs + height-based mix.

### Lighting (Sunset Recipe)

```typescript
// Directional light (sun)
position: spherical(12° elevation, ~210° azimuth)  // low sun, warm
color: new THREE.Color(1.0, 0.85, 0.65)            // warm golden
intensity: 2.0
castShadow: true (on MEMO-9 only for performance)

// Ambient (hemisphere light)
skyColor: new THREE.Color(0.85, 0.65, 0.75)        // pink sky
groundColor: new THREE.Color(0.35, 0.35, 0.50)     // cool shadow

// Fog
type: linear
color: new THREE.Color(0.90, 0.75, 0.70)           // warm haze
near: 80
far: 350

// Environment map: warm sunset HDRI for reflections on MEMO-9's metallic body
```

**Key lesson from Unity:** Fog + sunset lighting creates 80% of the atmosphere cheaply. Pink ambient + warm directional + linear fog = cinematic mountain scene.

### Scene Objects

| Object | Type | Position | Notes |
|--------|------|----------|-------|
| MEMO-9 | Character | (0, 0, 0) | Starts lying broken |
| CrashCrate | Prop | (-2.5, 0, -1) | Tilted 15° yaw, 8° roll, scale 1.5x, "MEMO-9" label |
| Part_RightArm | PuzzlePart | (1.5, 0.5, -0.5) | Gold, bobbing, spinning |
| Part_LeftLeg | PuzzlePart | (-8, 0.5, 7) | Gold, bobbing, spinning |
| Part_RightLeg | PuzzlePart | (12, 0.5, 15) | Gold, bobbing, spinning |
| RepairStation | Goal | (0, 0, 21) | End trigger — holographic repair bay |
| Planks x4 | Debris | scattered near crate | Flat on ground, decorative |
| Rocks x15 | Environment | 8-25m radius | Instanced, 3-5 variants |
| Trees | Environment | at mountain bases N/E/W | Instanced, sparse alpine |

---

## CAMERA SYSTEM

Third-person follow camera with repair-state adaptation.

```typescript
// FollowCamera.tsx
interface CameraConfig {
  height: number;
  distance: number;
  lookOffset: number;  // Y offset for look-at point
  dampingPosition: number;  // seconds
  dampingYaw: number;       // seconds (idle)
  dampingYawMoving: number; // seconds (moving — faster)
  yawDeadzone: number;      // degrees before camera starts rotating
}

const CAMERA_CONFIGS: Record<number, CameraConfig> = {
  0: { height: 3, distance: 6, lookOffset: 0.3, dampingPosition: 0.25, dampingYaw: 1.2, dampingYawMoving: 0.6, yawDeadzone: 15 },
  1: { height: 3, distance: 6, lookOffset: 0.3, dampingPosition: 0.25, dampingYaw: 1.2, dampingYawMoving: 0.6, yawDeadzone: 15 },
  2: { height: 5, distance: 8, lookOffset: 0.8, dampingPosition: 0.25, dampingYaw: 1.2, dampingYawMoving: 0.6, yawDeadzone: 15 },
  3: { height: 8, distance: 10, lookOffset: 1.5, dampingPosition: 0.25, dampingYaw: 1.2, dampingYawMoving: 0.6, yawDeadzone: 15 },
};

// Camera behavior:
// 1. Position: smoothly follows MEMO-9 at height + distance behind
// 2. Yaw: LAZY following with deadzone — only rotates when player turns >15°
//    - Faster tracking when moving (0.6s) vs idle (1.2s)
// 3. Look-at: MEMO-9 position + lookOffset Y
// 4. On state change: smooth interpolation to new config (1.5s)
// 5. NEVER clip through terrain — raycast from target to camera, pull in if occluded
```

---

## HUD (HTML Overlay, NOT 3D)

The HUD is standard React components rendered as an HTML overlay on top of the R3F Canvas. This is the correct pattern in R3F — UI lives in the DOM, 3D lives in the Canvas.

### Glass UI Style

```css
/* Glass panel base */
.glass-panel {
  background: rgba(5, 20, 51, 0.72);
  border: 1px solid rgba(77, 194, 255, 0.70);
  border-radius: 12px;
  backdrop-filter: blur(10px);
  box-shadow: 
    0 0 15px rgba(0, 150, 255, 0.15),
    inset 0 1px 0 rgba(204, 242, 255, 0.16);
}

/* Color tokens */
:root {
  --glass-dark: rgba(5, 20, 51, 0.72);
  --glass-mid: rgba(13, 56, 122, 0.58);
  --glass-rim: rgba(77, 194, 255, 0.70);
  --glass-sheen: rgba(204, 242, 255, 0.16);
  --knob-color: rgba(209, 245, 255, 0.90);
  --btn-normal: rgba(10, 102, 204, 0.68);
  --btn-pressed: rgba(51, 209, 255, 0.90);
  --accent-gold: rgba(255, 209, 56, 1.00);
  --accent-cyan: rgba(0, 229, 255, 1.00);
  --text-primary: rgba(255, 255, 255, 0.95);
  --text-secondary: rgba(180, 210, 235, 0.80);
}
```

### Layout (Portrait 1080x1920)

```
┌──────────────────────────────┐
│                  [REPAIR 0/3]│  ← top-right glass panel
│                              │
│                              │
│                              │
│      [Message Panel]         │  ← center, hidden by default
│                              │
│                              │
│                              │
│     [Interaction Prompt]     │  ← above controls, context-sensitive
│┌────────────────────────────┐│
││  (Joystick)    (E Button)  ││  ← bottom bar, frosted glass
│└────────────────────────────┘│
└──────────────────────────────┘
```

### Virtual Joystick (Touch)

```typescript
// VirtualJoystick.tsx
// - Outer circle: 120px diameter, glass style
// - Inner knob: 48px diameter, bright cyan
// - Touch area: 200px (larger than visual for easy grab)
// - Dead zone: 10% of radius
// - Output: { x: -1..1, y: -1..1 } normalized
// - Position: bottom-left, 80px from edges
// - Only visible on touch devices (hide on desktop)
```

### Interact Button (Touch)

```typescript
// InteractButton.tsx
// - 64px diameter circle, glass style
// - "E" label centered
// - Position: bottom-right, 80px from edges
// - Glows cyan when interactable in range
// - Disabled appearance when nothing in range
// - Only visible on touch devices
```

---

## GAME DESIGN RULES (IMMUTABLE)

1. **No Game Over. Ever.** Failure = visual feedback + immediate retry. No progress lost.
2. **MEMO-9 cannot speak to humans until Level 7.** No communication module until Kauffrau/Kaufmann upgrade.
3. **Knowledge Clips contain the puzzle key.** 30-45 sec videos. Optional but helpful. Never mandatory.
4. **The dog is the hint system** (from Level 2+). Subtle → obvious → nearly-giving-away over 30/60/90 seconds.
5. **Progressive difficulty.** Level 1 = tutorial. Levels 2-3 = single mechanic. Levels 4-6 = combined. Level 7 = dialog. Level 8 = exploration.
6. **Diegetic UI where possible.** Holographic projections from MEMO-9's hands/eyes for in-world information. Screen-space HUD only for controls and essential status.
7. **Every interaction has satisfying feedback.** Sound + visual within 50ms. Correct = cyan glow + click. Wrong = gentle shake + soft rejection sound.
8. **Swiss environments are pristine.** No decay, no ruins, no post-apocalyptic. The world is modern and impressive. The robot is incomplete, not the world.

---

## GAMEPLAY FLOW (LEVEL 1)

```
1. Scene loads. MEMO-9 lies broken on snow. Missing right arm + both legs.
2. Camera: low and close (crawl settings). Atmospheric: sunset, snow particles, wind audio.
3. Player sees: shipping crate labeled "MEMO-9", debris, golden arm part glowing 1.5m away.
4. HUD shows "REPAIR 0/3" (top-right glass panel).
5. Player drags slowly (0.25 m/s) toward arm. Interaction prompt appears at 2m range.
6. Player presses E / taps interact button.
7. → Gold part vanishes with cyan burst VFX
   → Arm bone scales to (1,1,1) on skeleton  
   → SitUp animation plays
   → Message: "Arm attached! You can crawl now."
   → HUD updates to "REPAIR 1/3"
   → Locomotion transitions to Zombie Crawl
8. Camera stays low. Speed: 0.6 m/s. Player crawls to explore.
9. Find left leg at (-8, 0.5, 7). Collect same way.
   → Message: "Leg attached! You can hobble now."
   → Camera rises to hobble height.
   → HUD: "REPAIR 2/3"
10. Find right leg at (12, 0.5, 15). Requires crossing the plateau.
    → Message: "Fully repaired! You can walk normally."
    → Camera at full height. Speed: 3.0 m/s.
    → HUD: "REPAIR 3/3"
11. Player walks to RepairStation (0, 0, 21).
    → Holographic repair bay activates.
    → Victory walk animation.
    → Level complete transition.
```

---

## PERFORMANCE TARGETS

| Metric | Target | Hard Limit |
|--------|--------|------------|
| FPS (mid-range phone) | 60 | Never below 30 |
| FPS (low-end phone) | 30 | Never below 20 |
| Triangle count | < 50K | < 100K |
| Draw calls | < 30 | < 60 |
| JS bundle size | < 500 KB (gzipped) | < 1 MB |
| Total initial load | < 5 MB | < 10 MB |
| Texture memory | < 64 MB | < 128 MB |
| GLB model files | < 2 MB each | < 5 MB each |

### Performance Rules
- Use THREE.InstancedMesh for repeated objects (rocks, trees, debris)
- Use LOD (drei's `<Detailed>`) for complex meshes
- Limit shadow-casting to MEMO-9 only (one shadow map)
- Use simple materials (MeshStandardMaterial) not custom ShaderMaterial unless needed
- Texture max: 1024x1024 for environment, 512x512 for props
- Use compressed textures (KTX2 with basis compression) via drei's useKTX2
- Audio: decode on first interaction (mobile autoplay policy)
- Lazy-load level assets — only current level in memory
- Use `useFrame` with conditional logic — skip expensive calculations when nothing changes
- Profile on a REAL mid-range phone (Samsung Galaxy A-series, iPhone SE)

---

## VISUAL REFERENCE IMAGES

Located in `public/references/` — these are Higgsfield Cinema Studio renders that define the visual target.

### Art Direction Rules (from reference renders)
1. MEMO-9's eyes: ALWAYS cyan (#00E5FF). Brighter when engaged, dim when sad, pulse when thinking.
2. The dog: ALWAYS warm-toned (golden/brown fur). Emotional warmth vs robot's cool metal.
3. Holographic UI: ALWAYS cyan, semi-transparent, scan-line animation, gentle float wobble.
4. Swiss environments: Pristine. Clean infrastructure, impressive engineering. No decay.
5. "MEMO-9" stencil on chest plate: always visible and legible.
6. Scale: MEMO-9 is SMALL compared to environments. Mountains, turbines, factories dwarf the robot.
7. Robot + dog always in frame together (their bond is the emotional core).
8. Color temperature: Exteriors warm (golden hour). Interiors cool (industrial) with warm accents (amber).

---

## R3F / THREE.JS SPECIFIC PATTERNS

### Scene Setup

```tsx
// App.tsx
<Canvas
  shadows
  dpr={[1, 2]}
  camera={{ fov: 50, near: 0.1, far: 500 }}
  gl={{ 
    antialias: true, 
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.2,
    outputColorSpace: THREE.SRGBColorSpace 
  }}
>
  <Suspense fallback={<LoadingScreen />}>
    <CurrentLevel />
  </Suspense>
  <FollowCamera />
  <EffectComposer>
    <Bloom luminanceThreshold={0.9} intensity={0.3} />
    <Vignette offset={0.3} darkness={0.5} />
  </EffectComposer>
</Canvas>

{/* HUD rendered OUTSIDE Canvas, as HTML overlay */}
<HUD />
```

### Model Loading

```tsx
// Use drei's useGLTF for all models
import { useGLTF, useAnimations } from '@react-three/drei';

function Memo9() {
  const { scene, animations } = useGLTF('/models/memo9/memo9.glb');
  const { actions, mixer } = useAnimations(animations, scene);
  // ...
}

// ALWAYS preload models
useGLTF.preload('/models/memo9/memo9.glb');
```

### Animation Crossfading

```tsx
// Crossfade between animations
const crossfadeTo = (actionName: string, duration = 0.2) => {
  const newAction = actions[actionName];
  if (!newAction || newAction === currentAction) return;
  
  newAction.reset().fadeIn(duration).play();
  currentAction?.fadeOut(duration);
  currentAction = newAction;
};
```

### Instanced Objects

```tsx
// For rocks, trees, debris — use InstancedMesh
import { Instances, Instance } from '@react-three/drei';

function Rocks() {
  return (
    <Instances limit={50} range={50}>
      <boxGeometry args={[1, 1, 1]} />  {/* or loaded GLB */}
      <meshStandardMaterial color="grey" roughness={0.9} />
      {ROCK_POSITIONS.map((pos, i) => (
        <Instance key={i} position={pos} rotation={randomRotation()} scale={randomScale()} />
      ))}
    </Instances>
  );
}
```

---

## SAVE DATA STRUCTURE

```typescript
interface SaveData {
  version: 1;
  player: {
    uuid: string;
    displayName: string;
    region: string;
    language: 'de' | 'fr' | 'it';
    createdAt: number;  // unix ms
  };
  robot: {
    personalName: string;
    bodyType: string;
    colorScheme: string;
    decalSet: string;
    acquiredUpgrades: string[];
    unlockedCosmetics: string[];
  };
  dog: {
    name: string;
    outfit: string;
    chipRepaired: boolean;
  };
  progression: {
    currentLevel: number;
    completedLevels: number[];
    sideQuests: Record<string, string>;
    watchedClips: number[];
    realWorldMoments: Record<string, boolean>;
  };
  aptitude: Record<string, {
    bestScore: number;
    totalTime: number;
    totalAttempts: number;
    clipWatched: boolean;
  }>;
  engagement: {
    totalPlayTime: number;
    totalSessions: number;
    firstSession: number;
    lastSession: number;
  };
}
```

Save to IndexedDB via idb-keyval. Auto-save after every significant action.

---

## WHAT NOT TO DO

- Do NOT use class components. Functional components + hooks only.
- Do NOT use Redux or Context API for game state. Zustand only.
- Do NOT put UI inside the R3F Canvas (except world-space holographic elements). HUD is HTML.
- Do NOT use `document.addEventListener` for input. Use React event handlers or custom hooks.
- Do NOT load all levels at once. Lazy-load per level.
- Do NOT use uncompressed textures. Compress everything.
- Do NOT use `any` type in TypeScript. Strict mode, explicit types everywhere.
- Do NOT create Game Over states. All failure is soft and retriable.
- Do NOT hardcode strings. Prepare for i18n from day one (use a simple key-value map).
- Do NOT make it feel like school. If it feels educational, redesign it until it feels like a game.
- Do NOT use OrbitControls for the game camera. Build a custom FollowCamera. OrbitControls is for debug only.
- Do NOT put game logic in React component render functions. Use `useFrame` for per-frame logic, Zustand subscriptions for event-driven logic.
- Do NOT use React state (useState) for rapidly changing values like position/rotation. Use refs + useFrame.
