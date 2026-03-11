# CLAUDE.md — APEX

## Project Identity

APEX is a AAA-quality 3D mobile game and gamified career discovery platform for Swiss teenagers (12–16 years). Players create and customize a humanoid robot avatar called MEMO-9, who has crash-landed in the Swiss Alps and must find its way back to civilization. Each of the 8 game levels maps to one or more of the 9 Swiss MEM (Mechanical, Electrical, Metal) apprenticeship careers promoted by Faszination Technik (a joint venture of Swissmem and Swissmechanic).

This is NOT an educational app. It is a real 3D adventure-puzzle game with cinematic environments, emotional storytelling, and AAA mobile visual quality. The educational payload is invisible — embedded in the puzzle mechanics. Reference games for quality bar: Monument Valley (spatial puzzles, aesthetic mastery), Machinarium (robot protagonist, point-and-click logic), Alto's Odyssey (atmospheric 3D journey), Gris (emotional progression through color and environment), The Wild Robot (narrative inspiration — robot lost in nature finding purpose).

---

## Tech Stack

- **Engine:** Unity 6.3 LTS (6000.3.10f1)
- **Render Pipeline:** Universal Render Pipeline (URP) — Forward rendering path for maximum mobile compatibility
- **Language:** C# (.NET Standard 2.1) — all game scripts
- **IDE Integration:** Unity MCP (CoplayDev/unity-mcp) for Claude Code ↔ Unity Editor bidirectional communication
- **Target Platforms:** Primary: iOS + Android (native). Secondary: WebGL (for prototype/demo)
- **Minimum Spec:** iPhone SE 2nd gen / Samsung Galaxy A15 (2023) — must maintain 30 FPS, target 60 FPS
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Realtime) for analytics, leaderboards, profiles
- **Audio:** Unity built-in audio system. OGG Vorbis for music, WAV for short SFX
- **Video:** Unity VideoPlayer component. H.264 MP4 for Knowledge Clips (streamed from CDN in production)
- **Version Control:** Git + GitHub. Unity scenes serialized as text (Force Text mode)
- **CI/CD:** GitHub Actions → Unity Cloud Build for iOS/Android
- **Testing:** Unity Test Framework (NUnit) for unit + integration tests
- **UI:** Unity UI Toolkit for menus/HUD, world-space Canvas for in-game diegetic UI

---

## Unity Project Settings (CRITICAL — SET THESE FIRST)

```
Editor Settings:
  Asset Serialization Mode: Force Text  ← CRITICAL for AI-readable scenes
  Version Control Mode: Visible Meta Files

Player Settings:
  Color Space: Linear  ← NOT Gamma
  Scripting Backend: IL2CPP  ← for release builds (Mono OK for dev)
  API Compatibility Level: .NET Standard 2.1
  Target Architecture: ARM64 (iOS), ARM64 + ARMv7 (Android)

Quality Settings:
  Create 3 quality levels:
    - Low (budget phones): No shadows, no post-processing, render scale 0.75
    - Medium (mid-range): Soft shadows, basic post-processing, render scale 1.0
    - High (flagship): Full shadows, full post-processing, render scale 1.0

URP Asset Settings (per quality level):
  Rendering:
    Renderer: Forward
    Depth Texture: Off (unless needed by shader)
    Opaque Texture: Off
    HDR: Off on Low, On for Medium/High
    MSAA: Off on Low, 2x on Medium, 4x on High
    Render Scale: 0.75 Low, 1.0 Medium/High
  Lighting:
    Main Light: Per Pixel
    Additional Lights: Per Vertex (Low), Per Pixel max 2 (Medium), Per Pixel max 4 (High)
    Cast Shadows: Off on Low, On for Medium/High
    Shadow Resolution: 512 Low, 1024 Medium, 2048 High
    Shadow Distance: 30 Low, 50 Medium, 80 High
    Shadow Cascades: 1 Low, 2 Medium, 4 High
  Post-processing:
    Low: None
    Medium: Color Grading + Vignette
    High: Color Grading + Vignette + Bloom + Ambient Occlusion
```

---

## Architecture Overview

```
Scene Hierarchy (per level):
├── --- MANAGERS (DontDestroyOnLoad, singleton) ---
│   ├── GameManager
│   ├── PlayerDataManager
│   ├── StoryManager
│   ├── AnalyticsManager
│   ├── AudioManager
│   └── UIManager
│
├── --- LEVEL SCENE ---
│   ├── Environment
│   │   ├── Terrain / Ground
│   │   ├── Props_Static (batched)
│   │   ├── Props_Dynamic
│   │   ├── Lighting
│   │   │   ├── Directional Light (main sun/moon)
│   │   │   ├── Light Probes
│   │   │   └── Reflection Probes
│   │   ├── VFX (particles: snow, sparks, mist, fireflies)
│   │   └── Skybox / Atmosphere
│   ├── Characters
│   │   ├── MEMO9 (player-controlled robot)
│   │   │   ├── Model (SkinnedMeshRenderer)
│   │   │   ├── Animator
│   │   │   ├── UpgradeVisuals (child objects toggled per upgrade)
│   │   │   ├── HolographicProjector (world-space UI anchor)
│   │   │   └── InteractionZone (trigger collider)
│   │   └── Dog (AI companion)
│   │       ├── Model
│   │       ├── Animator
│   │       ├── DogAI (NavMeshAgent + behavior tree)
│   │       └── CollarChip (visual indicator)
│   ├── Puzzle
│   │   ├── PuzzleController (level-specific logic)
│   │   ├── InteractableObjects[]
│   │   └── PuzzleFeedback (VFX, audio, camera reactions)
│   ├── Cameras
│   │   ├── MainCamera (Cinemachine Virtual Camera)
│   │   ├── PuzzleCamera (close-up for puzzle interactions)
│   │   └── CinematicCamera (for cutscenes)
│   ├── Triggers
│   │   ├── KnowledgeClipTrigger
│   │   ├── RealWorldMomentTrigger
│   │   ├── LevelExitTrigger
│   │   └── SideQuestTrigger
│   └── UI_WorldSpace
│       ├── HolographicUI (diegetic, projected from MEMO-9)
│       ├── InteractionPrompts
│       └── PuzzleOverlay
```

### Manager Pattern Rules
- All managers inherit from a `SingletonMonoBehaviour<T>` base class.
- Managers live on a persistent `[Managers]` GameObject marked `DontDestroyOnLoad`.
- Managers communicate via C# events (NOT Unity's SendMessage). Use `public static event Action<T>` pattern.
- Each manager has ONE responsibility. If a manager grows beyond 400 lines, it's doing too much — split it.
- Managers expose public methods for commands and raise events for state changes.

```csharp
// Example: PlayerDataManager
public class PlayerDataManager : SingletonMonoBehaviour<PlayerDataManager>
{
    public static event Action<string> OnUpgradeAcquired;
    public static event Action<string, string> OnCosmeticChanged;

    // State
    public PlayerSaveData Data { get; private set; }

    // Commands
    public void AcquireUpgrade(string upgradeId) { ... OnUpgradeAcquired?.Invoke(upgradeId); }
    public void SetCosmetic(string slot, string itemId) { ... OnCosmeticChanged?.Invoke(slot, itemId); }
}
```

---

## Directory Structure

```
Assets/
├── _Project/                          # ALL project files under here (not in root Assets/)
│   ├── Scenes/
│   │   ├── _Boot.unity                # Bootstrap scene — loads managers, then main menu
│   │   ├── MainMenu.unity
│   │   ├── CharacterCreator.unity     # MEMO-9 customization
│   │   ├── IntroCinematic.unity       # Fortnite-style drop video
│   │   ├── Levels/
│   │   │   ├── Level_1_Reboot.unity
│   │   │   ├── Level_2_Friend.unity
│   │   │   ├── Level_3_Crossing.unity
│   │   │   ├── Level_4_Power.unity
│   │   │   ├── Level_5_Precision.unity
│   │   │   ├── Level_6_Line.unity
│   │   │   ├── Level_7_Breakthrough.unity
│   │   │   └── Level_8_Home.unity
│   │   └── Credits.unity
│   │
│   ├── Scripts/
│   │   ├── Managers/
│   │   │   ├── GameManager.cs
│   │   │   ├── PlayerDataManager.cs
│   │   │   ├── StoryManager.cs
│   │   │   ├── AnalyticsManager.cs
│   │   │   ├── AudioManager.cs
│   │   │   └── UIManager.cs
│   │   ├── Core/
│   │   │   ├── SingletonMonoBehaviour.cs
│   │   │   ├── BaseLevelController.cs     # Abstract base for all level logic
│   │   │   ├── BasePuzzleController.cs    # Abstract base for all puzzles
│   │   │   ├── SaveSystem.cs
│   │   │   ├── SceneLoader.cs             # Async scene loading with fade
│   │   │   └── QualityManager.cs          # Auto-detect device tier
│   │   ├── Characters/
│   │   │   ├── Memo9Controller.cs         # Player input → movement
│   │   │   ├── Memo9Animator.cs           # Animation state machine bridge
│   │   │   ├── Memo9Customization.cs      # Visual cosmetics + upgrade display
│   │   │   ├── Memo9Interaction.cs        # Raycast/trigger interaction system
│   │   │   ├── DogAI.cs                   # Companion behavior tree
│   │   │   ├── DogHintSystem.cs           # Timed hint escalation
│   │   │   └── DogAnimator.cs
│   │   ├── Puzzles/
│   │   │   ├── Level1_AssemblyPuzzle.cs
│   │   │   ├── Level2_CircuitPuzzle.cs
│   │   │   ├── Level3_StructurePuzzle.cs
│   │   │   ├── Level4_SequencePuzzle.cs
│   │   │   ├── Level5A_CalibrationPuzzle.cs
│   │   │   ├── Level5B_BlueprintPuzzle.cs
│   │   │   ├── Level6A_DiagnosticPuzzle.cs
│   │   │   ├── Level6B_AssemblyPuzzle.cs
│   │   │   ├── Level7_DialogPuzzle.cs
│   │   │   └── Level8_ExplorationHub.cs
│   │   ├── UI/
│   │   │   ├── ScreenManager.cs           # Screen stack navigation
│   │   │   ├── HolographicUI.cs           # Diegetic UI projected from MEMO-9
│   │   │   ├── DialogSystem.cs            # NPC dialog trees (Level 7+)
│   │   │   ├── KnowledgeClipPlayer.cs     # Fullscreen video + subtitles
│   │   │   ├── RealWorldMoment.cs         # Web URL launch + completion tracking
│   │   │   ├── RadarChart.cs              # Aptitude visualization (9 axes)
│   │   │   └── LeaderboardUI.cs
│   │   ├── Data/
│   │   │   ├── PlayerSaveData.cs          # Serializable save structure
│   │   │   ├── UpgradeDatabase.cs         # ScriptableObject: all 9 upgrades
│   │   │   ├── CosmeticDatabase.cs        # ScriptableObject: skins, decals, colors
│   │   │   ├── LevelDatabase.cs           # ScriptableObject: level metadata
│   │   │   ├── CareerDatabase.cs          # ScriptableObject: 9 career descriptions
│   │   │   └── DialogDatabase.cs          # ScriptableObject: dialog trees
│   │   └── Utils/
│   │       ├── DeviceProfiler.cs          # Detect device tier (low/mid/high)
│   │       ├── AnalyticsEvent.cs          # Event data structure
│   │       └── Extensions.cs             # C# extension methods
│   │
│   ├── Art/
│   │   ├── Models/
│   │   │   ├── MEMO9/
│   │   │   │   ├── memo9_base.fbx         # Base robot model
│   │   │   │   ├── memo9_rig.fbx          # Rigged for animation
│   │   │   │   └── Upgrades/              # Separate meshes per upgrade
│   │   │   │       ├── neural_wiring.fbx
│   │   │   │       ├── precision_hands.fbx
│   │   │   │       ├── 3d_vision_eyes.fbx
│   │   │   │       ├── control_processor.fbx
│   │   │   │       ├── reinforced_chassis.fbx
│   │   │   │       ├── cnc_core.fbx
│   │   │   │       ├── quick_connect_limbs.fbx
│   │   │   │       └── comm_module.fbx
│   │   │   ├── Dog/
│   │   │   │   ├── dog_base.fbx
│   │   │   │   └── dog_rig.fbx
│   │   │   └── Props/                     # Per-level interactable props
│   │   │       ├── Level1/
│   │   │       ├── Level2/
│   │   │       └── ...
│   │   ├── Animations/
│   │   │   ├── MEMO9/
│   │   │   │   ├── memo9_idle.anim
│   │   │   │   ├── memo9_walk.anim
│   │   │   │   ├── memo9_interact.anim
│   │   │   │   ├── memo9_celebrate.anim
│   │   │   │   ├── memo9_sad.anim
│   │   │   │   ├── memo9_upgrade.anim
│   │   │   │   └── memo9_communicate.anim
│   │   │   └── Dog/
│   │   │       ├── dog_idle.anim
│   │   │       ├── dog_follow.anim
│   │   │       ├── dog_sniff.anim
│   │   │       ├── dog_bark.anim
│   │   │       ├── dog_sit.anim
│   │   │       ├── dog_scared.anim
│   │   │       ├── dog_happy.anim
│   │   │       ├── dog_sleep.anim
│   │   │       └── dog_reunion.anim
│   │   ├── Materials/
│   │   │   ├── MEMO9/
│   │   │   │   ├── M_Memo9_Base.mat        # Master material with color property
│   │   │   │   ├── M_Memo9_Eyes.mat         # Emissive cyan eyes
│   │   │   │   ├── M_Memo9_Chestplate.mat   # Stencil text "MEMO-9"
│   │   │   │   └── M_Memo9_Holographic.mat  # For holographic projections
│   │   │   ├── Environment/
│   │   │   │   ├── M_Snow.mat
│   │   │   │   ├── M_Rock.mat
│   │   │   │   ├── M_Metal_Industrial.mat
│   │   │   │   ├── M_Concrete.mat
│   │   │   │   ├── M_Wood.mat
│   │   │   │   └── M_Water.mat
│   │   │   └── Shared/
│   │   │       ├── M_Holographic.mat        # Cyan holographic effect
│   │   │       └── M_Emissive_Cyan.mat
│   │   ├── Textures/
│   │   │   ├── MEMO9/                       # Albedo, Normal, ORM packed
│   │   │   ├── Environment/                 # Per-level texture sets
│   │   │   └── UI/
│   │   ├── Shaders/                         # Shader Graph assets
│   │   │   ├── SG_Holographic.shadergraph   # Cyan holographic projection
│   │   │   ├── SG_Snow.shadergraph          # Procedural snow with sparkle
│   │   │   ├── SG_Water.shadergraph         # Stylized water surface
│   │   │   ├── SG_CircuitTrace.shadergraph  # Animated circuit line
│   │   │   └── SG_EmissivePulse.shadergraph # Pulsing glow for interactive objects
│   │   ├── VFX/                             # VFX Graph assets
│   │   │   ├── VFX_Snow.vfx
│   │   │   ├── VFX_Sparks.vfx
│   │   │   ├── VFX_Fireflies.vfx
│   │   │   ├── VFX_WaterMist.vfx
│   │   │   ├── VFX_HolographicParticles.vfx
│   │   │   └── VFX_UpgradeAcquire.vfx      # Dramatic cyan burst
│   │   └── Skyboxes/
│   │       ├── Sky_Level1_Dawn.mat
│   │       ├── Sky_Level2_Midday.mat
│   │       └── ...
│   │
│   ├── Audio/
│   │   ├── Music/                           # OGG Vorbis, looping
│   │   │   ├── MUS_Level1_Ambient.ogg
│   │   │   ├── MUS_Level1_Solved.ogg
│   │   │   └── ...
│   │   └── SFX/                             # WAV, short
│   │       ├── SFX_ServoWhir.wav
│   │       ├── SFX_ClickConnect.wav
│   │       ├── SFX_CircuitSpark.wav
│   │       ├── SFX_DogBark.wav
│   │       ├── SFX_UpgradeAcquire.wav
│   │       ├── SFX_PuzzleCorrect.wav
│   │       ├── SFX_PuzzleWrong.wav
│   │       └── ...
│   │
│   ├── Video/
│   │   ├── VID_IntroCinematic.mp4           # Fortnite-style drop (30-45 sec)
│   │   ├── VID_KnowledgeClip_01.mp4         # Swiss micro-servo tech
│   │   ├── VID_KnowledgeClip_02.mp4         # Swiss RFID tech
│   │   └── ...
│   │
│   ├── ScriptableObjects/
│   │   ├── Upgrades/                        # One SO per upgrade
│   │   │   ├── SO_Upgrade_ServoMotors.asset
│   │   │   ├── SO_Upgrade_NeuralWiring.asset
│   │   │   └── ...
│   │   ├── Cosmetics/
│   │   │   ├── SO_BodyType_Compact.asset
│   │   │   ├── SO_ColorScheme_MidnightChrome.asset
│   │   │   └── ...
│   │   ├── Levels/
│   │   │   ├── SO_Level_1_Reboot.asset
│   │   │   └── ...
│   │   └── Careers/
│   │       ├── SO_Career_Mechanikpraktiker.asset
│   │       └── ...
│   │
│   ├── Prefabs/
│   │   ├── Characters/
│   │   │   ├── PFB_MEMO9.prefab
│   │   │   └── PFB_Dog.prefab
│   │   ├── UI/
│   │   │   ├── PFB_HolographicPanel.prefab
│   │   │   ├── PFB_DialogBox.prefab
│   │   │   ├── PFB_UpgradePopup.prefab
│   │   │   └── PFB_FadeTransition.prefab
│   │   └── VFX/
│   │       ├── PFB_SnowSystem.prefab
│   │       └── ...
│   │
│   ├── Fonts/
│   │   ├── ApexDisplay.ttf                  # Industrial display (DIN Condensed / Barlow)
│   │   ├── ApexBody.ttf                     # Clean readable body
│   │   └── ApexRobot.ttf                    # Monospace/tech for MEMO-9 text
│   │
│   └── Resources/
│       └── (only if absolutely needed for Resources.Load — prefer Addressables)
│
├── Settings/
│   ├── URP_LowQuality.asset
│   ├── URP_MediumQuality.asset
│   ├── URP_HighQuality.asset
│   ├── URP_Renderer_Forward.asset
│   └── UniversalRenderPipelineGlobalSettings.asset
│
└── Tests/
    ├── EditMode/
    │   ├── Test_PlayerSaveData.cs
    │   ├── Test_UpgradeSystem.cs
    │   └── Test_AnalyticsEvents.cs
    └── PlayMode/
        ├── Test_Level1_Assembly.cs
        ├── Test_Memo9Movement.cs
        └── Test_DogHintTiming.cs
```

---

## C# Coding Conventions

### Style
```csharp
// Namespace: Apex.<Category>
namespace Apex.Managers { }
namespace Apex.Characters { }
namespace Apex.Puzzles { }
namespace Apex.UI { }
namespace Apex.Data { }

// Class naming: PascalCase, descriptive
public class Memo9Controller : MonoBehaviour { }
public class Level3_StructurePuzzle : BasePuzzleController { }

// Fields: private by default, underscore prefix
private float _moveSpeed = 5f;
private bool _isInteracting;
[SerializeField] private Transform _interactionPoint;

// Properties: PascalCase, no underscore
public bool IsMoving { get; private set; }
public int CurrentLevel => GameManager.Instance.CurrentLevel;

// Methods: PascalCase, verb-first
public void StartPuzzle() { }
private void HandleInput() { }
protected virtual void OnPuzzleSolved() { }

// Events: On + PastTense
public static event Action<string> OnUpgradeAcquired;
public static event Action<int, float> OnLevelCompleted;

// Constants: PascalCase (C# convention, NOT SCREAMING_SNAKE)
public const float HintDelaySeconds = 60f;
public const int MaxUpgrades = 9;

// Enums: PascalCase
public enum RobotState { Idle, Walking, Interacting, PuzzleSolving, Celebrating, Communicating }
public enum QualityTier { Low, Medium, High }
```

### Patterns
```csharp
// ALWAYS use SerializeField for inspector fields, NEVER public fields
[SerializeField] private float _moveSpeed = 5f;  // ✅ Correct
public float moveSpeed = 5f;                       // ❌ NEVER

// ALWAYS use TryGetComponent over GetComponent where null is possible
if (hit.collider.TryGetComponent<IInteractable>(out var interactable))
    interactable.Interact(this);

// ALWAYS use async/await for loading operations
private async Task LoadLevelAsync(string sceneName) { }

// ALWAYS use object pooling for frequently instantiated objects (VFX, UI popups)
// Use Unity's built-in ObjectPool<T> class

// ALWAYS use ScriptableObjects for static data (upgrades, cosmetics, careers)
// NEVER hardcode data in MonoBehaviours

// Events: subscribe in OnEnable, unsubscribe in OnDisable
private void OnEnable() => GameManager.OnLevelLoaded += HandleLevelLoaded;
private void OnDisable() => GameManager.OnLevelLoaded -= HandleLevelLoaded;
```

### Comments
- All comments in English.
- XML docs on all public methods: `/// <summary>...</summary>`
- Complex logic gets WHY comments, not WHAT comments.
- `// TODO(phase2):` for future work. `// HACK:` for temporary fixes.
- No commented-out code in commits.

---

## Game Design Rules (IMMUTABLE)

### Core Rules
1. **No Game Over. Ever.** Wrong puzzle attempts show visual failure (bridge collapses, circuit sparks red, safety cutoff triggers) but NEVER reset progress or kick the player out. Immediate retry, always.
2. **MEMO-9 cannot speak to humans until Level 7.** The robot has no communication module until the Kauffrau/Kaufmann upgrade. Before Level 7, humans in the scene are observed but NEVER interacted with via dialog. The robot interacts with machines, systems, digital interfaces, and the dog.
3. **Knowledge Clips contain the key insight.** Every puzzle has a 30-45 second video that reveals the principle needed to solve it. Players who watch solve ~50% faster. Clips are NEVER mandatory. Skipping is always allowed.
4. **The dog is the hint system.** Hint escalation: 30 seconds no progress → dog sniffs toward solution area (subtle). 60 seconds → dog barks at relevant object (obvious). 90 seconds → dog sits at exact interaction point (nearly giving it away). Hints are visual/behavioral ONLY — no text popups.
5. **Progressive difficulty.** Level 1: trivially easy tutorial. Levels 2-3: single-mechanic puzzles. Levels 4-6: combined mechanics, 2 systems interacting. Level 7: dialog/resource management (different cognitive skill). Level 8: open exploration, no traditional puzzle.
6. **Diegetic UI.** No permanent HUD. Information communicated through: MEMO-9's eye emissive color/intensity (state), holographic projections from hands/eyes (blueprints, radar, menus), the dog's behavior (hints, danger), environmental cues (lighting shifts, sounds, particle changes). Exception: screen-space UI only for menus, knowledge clip player, and real-world moments.
7. **Every interaction has satisfying feedback.** Touch/click → sound + visual response within 50ms. Correct action → satisfying "click-lock" sound + cyan glow + subtle camera shake. Wrong action → gentle rejection sound + object shake + brief red flash, never harsh or punishing.
8. **The world is thriving, not broken.** Switzerland in this game is modern, functional, beautiful. Infrastructure works. People are busy. Nature is pristine. The ROBOT is incomplete — the world is amazing. No post-apocalyptic aesthetics.

### Camera System
- Cinemachine-driven. One Virtual Camera per context (exploration, puzzle close-up, cinematic).
- Exploration: 3rd person, slightly elevated, follows MEMO-9 with damping. Player can orbit with touch drag.
- Puzzle: Camera transitions to a fixed optimal viewing angle for the puzzle. Smooth blend (1-2 sec).
- Cinematic: Scripted camera paths for story moments (intro, dog reunion, ending). Use Cinemachine Timeline tracks.
- NEVER let the camera clip through geometry. Use Cinemachine Collider extension.

### Touch Controls
- Movement: Virtual joystick (left thumb) or tap-to-move (pathfinding to tap point).
- Interaction: Tap on highlighted interactive object (glow + pulse when in range).
- Camera: Right thumb drag to orbit. Pinch to zoom (limited range).
- Puzzle: Direct manipulation (drag parts, rotate dials, connect wires) — all single-finger.
- All touch targets: minimum 48dp (use Unity's CanvasScaler with reference resolution 1080x1920).

---

## MEMO-9 Technical Specification

### Model
- Polycount: ~8,000 tris (base body). Each upgrade adds ~500-1,500 tris.
- Fully upgraded: ~20,000 tris maximum.
- Single skinned mesh with blend shapes for eye expressions (blink, narrow, wide).
- Bone count: 35 max (humanoid rig compatible with Unity's Humanoid avatar).
- 2 UV channels: UV1 for albedo/normal, UV2 for lightmap.

### Materials (URP/Lit based)
- M_Memo9_Base: Main body. Metallic workflow. Color tintable via `_BaseColor` property (for customization). Smoothness: 0.6. Metallic: 0.8.
- M_Memo9_Eyes: Emissive. Base color: cyan #00E5FF. Emission intensity animated via script (pulse on idle, bright on interact, dim on sad).
- M_Memo9_Chestplate: Separate material with "MEMO-9" text via texture. Player's custom name rendered below as dynamic text mesh.
- M_Memo9_Holographic: Custom Shader Graph. Additive blending. Animated scan lines. Used for all projected UI.

### Upgrade Visuals
Each upgrade is a separate child GameObject on the MEMO-9 prefab, disabled by default. When acquired, the corresponding GameObject is enabled with a VFX_UpgradeAcquire burst.

```csharp
// In Memo9Customization.cs
public void EnableUpgrade(string upgradeId)
{
    var upgradeTransform = transform.Find($"Upgrades/{upgradeId}");
    if (upgradeTransform != null)
    {
        upgradeTransform.gameObject.SetActive(true);
        VFXManager.PlayAt("UpgradeAcquire", upgradeTransform.position);
        AudioManager.Instance.PlaySFX("SFX_UpgradeAcquire");
    }
}
```

### Animation
- Animator Controller with layers: Base (locomotion), UpperBody (interact, puzzle), Facial (eye blend shapes).
- State machine: Idle → Walk → Interact → PuzzleSolving → Celebrate → Upgrade.
- Transitions: All 0.15s blend time. No abrupt cuts.
- Root motion: OFF. Movement is script-driven via CharacterController or NavMeshAgent.

---

## Dog Companion Technical Specification

### AI Behavior (NavMeshAgent + Custom State Machine)
```csharp
public enum DogState
{
    Idle,           // Sitting near MEMO-9, occasional animations
    Following,      // Trotting alongside, slight offset
    Sniffing,       // Hint stage 1: nose to ground toward solution
    Barking,        // Hint stage 2: facing target, barking
    Sitting,        // Hint stage 3: sitting at solution point
    Scared,         // Near heights/danger: cowering
    Happy,          // Puzzle solved: bouncing, tail wagging
    Sleeping,       // Level 4: curled up near heat source
    Reunion         // Level 8: full sprint toward owner
}
```

### Hint System Timing
```csharp
// DogHintSystem.cs
private const float HintStage1_Seconds = 30f;   // Subtle sniff
private const float HintStage2_Seconds = 60f;   // Obvious bark
private const float HintStage3_Seconds = 90f;   // Nearly giving away

// Timer resets when player interacts with any puzzle element
// Timer pauses when Knowledge Clip is playing
// Timer never activates if puzzle is solved
```

### Model
- Polycount: ~5,000 tris.
- Bone count: 25 max.
- One material, color tintable for variety.
- Collar with emissive chip indicator (red = broken, green = fixed).

---

## Level Environment Specifications

### Lighting Strategy (CRITICAL for AAA quality on mobile)
- **Primary:** 1 Directional Light per level (sun/moon). Baked shadows for static geometry. Real-time shadows ONLY for MEMO-9 and dog (moving characters).
- **Fill:** Light Probes placed on a grid (roughly 2m spacing in playable areas). Reflection Probes at key visual points (metal surfaces, water).
- **Baked GI:** Use Adaptive Probe Volumes (Unity 6) for indirect lighting. Bake at Medium quality for mobile.
- **Emissive:** Interactive objects use emissive materials (pulsing glow) to draw attention. Cyan for MEMO-9's holographics. Amber for industrial status lights.

### Per-Level Environment Notes

**Level 1 — Alpine Peak:**
- Skybox: Dawn gradient (deep blue → pink → gold). Volumetric fog in valleys (shader-based, not Unity fog).
- Terrain: Snow ground plane with tessellation on High quality. Rock outcrops.
- Key props: Broken wooden crate (destructible-looking), scattered robot parts (9 interactive), wreckage debris.
- VFX: Snow particles (light, drifting), wind streaks, breath condensation from MEMO-9's vents.

**Level 2 — Tree Line Forest:**
- Skybox: Clear blue with scattered clouds.
- Vegetation: Stylized spruce/larch trees. GPU instancing for forest density. LODs critical.
- Key props: Wildflower patches, fallen logs, moss-covered rocks, dog's resting spot.
- VFX: Fireflies (particle + point light), sun rays through canopy (god rays via post-processing), dust motes.

**Level 3 — Ravine Construction Site:**
- Skybox: Bright midday, dramatic clouds.
- Terrain: Granite cliff faces (tiling texture + decals for detail). Glacial river far below (animated water shader).
- Key props: Steel beams, cable spools, survey tripods with orange flags, concrete barriers, hard hats on hooks.
- VFX: Wind on flags (cloth simulation or animated), river mist rising, dust from construction.

**Level 4 — Hydroelectric Station:**
- Skybox: Late afternoon, golden.
- Architecture: Brutalist concrete interior. Massive turbine hall. Control room with panels.
- Key props: Francis turbines (large rotating meshes), control panels with gauges, pipes, valves, status lights.
- VFX: Water mist from turbines, electrical arcs (sparks), progressive illumination as power returns.
- Lighting challenge: Interior scene. Use baked lighting with emissive panels + status light point lights.

**Level 5 — Mountain Workshop:**
- Skybox: Visible through windows — alpine valley view.
- Interior: Clean workshop. Pegboard walls with tools. Precision instruments under task lamps.
- Key props: Lathe, milling machine, welding station, workbench with magnification lens, rescue team jackets.
- VFX: Welding sparks, metal shavings, task lamp cone lighting.

**Level 6 — Production Facility:**
- Skybox: Industrial windows, daytime.
- Interior: Modern factory floor. Production line with conveyor belts, robotic arms, quality stations.
- Key props: CNC machines, conveyor systems, digital displays, safety barriers, amber warning lights.
- VFX: Machine movement (animated), production line belt (UV scroll), status light changes.

**Level 7 — Swiss Town:**
- Skybox: Golden hour → sunset transition over the level duration.
- Exterior: Town square with fountain, half-timbered buildings, bakery, vet clinic, church tower.
- Key props: Cobblestones (tiling + decals), flower boxes, bicycles, shop signs, Swiss flags.
- VFX: Warm light from windows, fountain water, birds/swallows, long shadows.

**Level 8 — City:**
- Skybox: Blue hour → night. City lights.
- Exterior: Modern Swiss city rooftop + streets. Mix of glass/steel and historic sandstone.
- Key props: Interactive kiosk, company storefronts with logos, tram lines, park benches.
- VFX: City light twinkle, car headlights (distant), neon reflections on wet streets.

---

## Analytics Events

```csharp
// AnalyticsManager.cs
public enum AnalyticsEventType
{
    SessionStart,
    SessionEnd,
    LevelStarted,
    LevelCompleted,
    PuzzleAttempt,
    PuzzleSolved,
    UpgradeAcquired,
    KnowledgeClipStarted,
    KnowledgeClipCompleted,
    KnowledgeClipSkipped,
    RealWorldMomentCompleted,
    RealWorldMomentSkipped,
    CustomizationChanged,
    SideQuestEntered,
    SideQuestCompleted,
    DogInteraction,
    HintTriggered
}

// Aptitude tracking (per puzzle completion)
[System.Serializable]
public struct AptitudeSignal
{
    public string careerId;       // e.g., "polymechaniker"
    public float accuracy;        // 0.0 - 1.0
    public float speed;           // 0.0 - 1.0 (relative to expected time)
    public int attempts;          // number of tries before success
    public bool usedKnowledgeClip;
    public int hintsUsed;         // 0-3 (dog hint stages triggered)
}
```

---

## Save Data Structure

```csharp
[System.Serializable]
public class PlayerSaveData
{
    public int version = 1;

    // Player
    public string uuid;
    public string displayName;
    public string region;
    public string language = "de";
    public long createdAtUnixMs;

    // Robot
    public string robotName = "MEMO-9";
    public string bodyType = "compact";
    public string colorScheme = "arctic_white";
    public string decalSet = "none";
    public List<string> acquiredUpgrades = new();
    public List<string> unlockedCosmetics = new();

    // Dog
    public string dogName = "";  // empty until chip is repaired
    public string dogOutfit = "none";
    public bool dogChipRepaired = false;

    // Progression
    public int currentLevel = 0;
    public List<int> completedLevels = new();
    public Dictionary<string, string> sideQuestStatus = new();
    public List<int> watchedKnowledgeClips = new();
    public Dictionary<string, bool> realWorldMoments = new();

    // Aptitude (per career)
    public Dictionary<string, AptitudeData> aptitude = new();

    // Engagement
    public float totalPlayTimeSeconds = 0f;
    public int totalSessions = 0;
    public long firstSessionUnixMs;
    public long lastSessionUnixMs;
}

[System.Serializable]
public class AptitudeData
{
    public float bestScore;     // 0.0-1.0
    public float totalTime;     // seconds spent on this career's puzzles
    public int totalAttempts;
    public bool clipWatched;
}
```

---

## Performance Budgets

| Metric | Target | Hard Limit |
|--------|--------|------------|
| FPS (mid-range device) | 60 | Never below 30 |
| FPS (low-end device) | 30 | Never below 24 |
| Triangle count per frame | < 100K | < 200K |
| Draw calls (SetPass) | < 80 | < 150 |
| Texture memory | < 150 MB | < 250 MB |
| Total RAM | < 400 MB | < 600 MB |
| APK size (Android) | < 150 MB | < 250 MB |
| IPA size (iOS) | < 200 MB | < 300 MB |
| Level load time | < 3 sec | < 5 sec |
| Initial app startup | < 4 sec | < 6 sec |
| Knowledge Clip file size | < 15 MB each | < 25 MB each |

### Performance Rules
- Use LOD Groups on ALL environment meshes. L0 = full, L1 = 50%, L2 = 25%.
- Bake lighting for ALL static objects. Only MEMO-9 and dog cast real-time shadows.
- Use GPU instancing for repeated props (trees, rocks, pipes, beams).
- Static batch all non-moving environment objects.
- Use ASTC 6x6 texture compression on both iOS and Android.
- Pack textures: ORM (Occlusion, Roughness, Metallic) in one RGB texture. NEVER separate files.
- Audio: OGG Vorbis for music (quality 5), WAV only for SFX under 1 second.
- Stream Knowledge Clip videos — do NOT bundle in build. Load on demand.
- Profile with Unity Profiler on a REAL mid-range device every sprint. Not just in editor.
- Use Addressables for level-specific assets. Only the current level's assets should be in memory.

---

## Localization

All user-facing text goes through Unity's Localization package. Primary: German (de-CH). Future: French (fr-CH), Italian (it-CH).

```csharp
// NEVER hardcode displayed strings
// ✅ Correct:
_titleText.text = LocalizationSettings.StringDatabase.GetLocalizedString("UI", "LEVEL_1_TITLE");

// ❌ Wrong:
_titleText.text = "Reboot";
```

Use String Tables in Unity Localization. One table per category: UI, Dialog, Upgrades, Careers, Knowledge.

---

## Accessibility

- Minimum touch target: 48dp (9mm physical).
- Color-blind safe: NEVER rely on color alone. Always pair with shape, icon, sound, or animation.
- Subtitles on all Knowledge Clips and all in-game dialog (Level 7+).
- Text sizes: body ≥ 16sp, interactive ≥ 20sp, headers ≥ 24sp at reference resolution.
- All puzzles solvable with one finger. No required pinch, multi-touch, or accelerometer input.
- Audio cues for all important interactions (not just visual).

---

## Unity MCP Integration Notes

The Unity MCP server (CoplayDev/unity-mcp) enables Claude Code to:
- Read the scene hierarchy and component data
- Create/delete GameObjects
- Add/modify components
- Adjust transforms, materials, properties
- Read console output (errors, warnings, logs)
- Run the project in play mode and capture results

### When using Unity MCP through Claude Code:
- ALWAYS verify the scene is saved before running play mode.
- ALWAYS check console output after making changes — Unity's compiler catches errors immediately.
- PREFER creating C# scripts over manual scene manipulation for repeatable/complex setups.
- Use ScriptableObjects for data — Claude can create and populate .asset files via scripts.
- For visual setup (lighting, camera framing, material tweaking): describe what you want, and a human will adjust in the editor. Focus AI effort on code, logic, and systems.

---

## What NOT to Do

- Do NOT use HDRP. This is a mobile game. URP only.
- Do NOT use real-time GI (Global Illumination). Bake everything.
- Do NOT use Unity's old UI system (uGUI Canvas everywhere). Use UI Toolkit for screen-space, world-space Canvas only for diegetic in-game UI.
- Do NOT use MonoBehaviour for data storage. Use ScriptableObjects.
- Do NOT use public fields. Use [SerializeField] private.
- Do NOT use string-based methods (SendMessage, Invoke by string). Use events and direct references.
- Do NOT use Resources folder. Use Addressables for dynamic loading.
- Do NOT use FindObjectOfType at runtime. Cache references or use the singleton pattern.
- Do NOT create Game Over states. All failure is soft and retriable.
- Do NOT use Gamma color space. Linear only.
- Do NOT import uncompressed textures. ASTC 6x6 for all platforms.
- Do NOT add more than 200K triangles to a single frame. Profile on device.
- Do NOT hardcode any user-facing strings. Use Localization package.
- Do NOT make anything feel like school. If it feels educational, redesign it until it feels like a game.

---

## Visual Reference Images (CRITICAL — LOOK AT THESE)

Pre-production concept renders have been generated using Higgsfield Cinema Studio and establish the definitive visual language for APEX. Before making ANY decision about art style, lighting, materials, character proportions, or environment mood, consult these reference images.

Location: `Assets/_Project/Art/References/`

### MEMO-9 Character Reference
- `ref_memo9_character.png` — MEMO-9 standalone, full body. White/light grey matte chassis with visible panel seams. Rounded head with large cyan-glowing optical sensor eyes. "MEMO-9" stencil on chest plate in industrial font. Cyan emissive glow from chest core. Compact, sturdy proportions — roughly 1.2m tall. Approachable and lovable but clearly industrial, not toylike.
- `ref_memo9_with_dog.png` — MEMO-9 and the companion dog together. The dog is a medium-sized golden/brown mixed breed. Shows scale relationship between robot and dog.

### Title Screen / Key Art
- `ref_title_apex.png` — "APEX — Finde deinen Weg." MEMO-9 and dog on Alpine cliff edge, looking out over the journey landscape. Mountains, valleys, distant city. Sunrise. Epic scale, intimate subjects.
- `ref_title_memo9.png` — "MEMO-9 — Finde deinen Weg." Same concept, MEMO-9 branding variant.

### Level References
- `ref_level1_crashsite.png` — Snowy alpine peak. Broken crate. Scattered robot parts. Dawn light. Pink-gold sky.
- `ref_level2_treeline.png` — Dense alpine forest. Filtered golden light. Dog and MEMO-9 first meeting.
- `ref_level3_ravine.png` — Dramatic gorge with construction site. Holographic blueprint projection visible. Steel beams and orange survey flags.
- `ref_level3_knowledge.png` — Knowledge Clip moment: holographic screen showing Swiss tunnel construction (Gotthard reference). "Story Chip Download" UI visible.
- `ref_level4_hydroelectric.png` — Massive hydroelectric station exterior. Brutalist concrete. Reservoir lake. Swiss flag.
- `ref_level4_controlroom.png` — Interior control room with analog gauges and digital displays. MEMO-9 at console, cyan energy flowing.
- `ref_level4_turbinehall.png` — Cathedral-like turbine hall. Massive Francis turbines in a row. Progressive lighting activation.
- `ref_level5_workshop.png` — Mountain rescue workshop interior. Precision tools, task lamps, alpine view through window. Dog in rescue jacket.
- `ref_level5_precision.png` — Close-up of MEMO-9's hands doing precision work under magnification.
- `ref_level6_factory.png` — Modern production facility. Conveyor belts, robotic arms, quality stations. MEMO-9 inside the machinery.
- `ref_level7_town.png` — Swiss town square at golden hour. MEMO-9 talking to a human (communication module active). Dog beside them.
- `ref_level8_city.png` — City rooftop at blue hour. Fully upgraded MEMO-9 overlooking cityscape. Alps visible in distance.

### UI / Gameplay References
- `ref_holographic_ui.png` — MEMO-9 projecting holographic career radar / blueprint overlay. Cyan color, scan-line effect, floating in 3D space.
- `ref_puzzle_circuit.png` — Level 2 circuit puzzle view with grid-based wire placement.
- `ref_puzzle_sequence.png` — Level 4 control panel with numbered stations and dependency indicators.

### Art Direction Rules Derived from References
1. **Color temperature:** Exteriors are warm (golden hour, sunrise/sunset dominance). Interiors are cool (industrial blue-white) with warm accent lights (amber status, task lamps).
2. **MEMO-9's eyes are ALWAYS cyan (#00E5FF).** This is the character's emotional anchor. Eyes glow brighter when engaged, dim when sad, pulse when thinking.
3. **The dog is ALWAYS warm-toned** (golden/brown fur). It's the emotional warmth in contrast to the robot's cool metal.
4. **Holographic UI is ALWAYS cyan** with slight transparency, scan-line animation, and gentle float/wobble. Never solid, never opaque, never any color other than cyan.
5. **Swiss environments are pristine.** Clean infrastructure, well-maintained buildings, impressive engineering. No rust, no decay, no graffiti, no damage (except the initial crash site).
6. **The "MEMO-9" text on the chest plate** is always visible and legible. It's rendered as a texture/decal on the chest material, slightly worn/industrial stencil font.
7. **Scale matters.** MEMO-9 is small compared to the environments. The Swiss Alps, the turbine hall, the factory — these dwarf the robot. This creates the sense of adventure and discovery.
8. **The dog and robot are always in frame together** (except Level 8 after the reunion). Their bond is the emotional core. Scenes should be composed to show them as a pair.

When building scenes in Unity, match these references as closely as possible. The lighting, color grading, atmosphere, and composition in these renders IS the target quality. URP with baked lighting, careful post-processing (color grading, vignette, bloom on High), and stylized PBR materials can achieve this look on mobile.

---

## Document Ecosystem

This CLAUDE.md is the technical production bible. The following companion documents exist:

1. **APEX_Konzept_FaszinationTechnik.docx** — Strategic concept document for Faszination Technik board and stakeholders. Contains narrative, level overview, metrics framework, strategic benefits. Written in German (Switzerland). NOTE: This document still references the earlier "MechQuest" working title in some places and describes a 2D approach — the game is now full 3D as specified in this CLAUDE.md.

2. **APEX_Budget_Umsetzungsplan.docx** — Budget and phasing document. CHF 23,600 Phase 1, CHF 69,600 total. Designed to be forwarded to sponsors. Written in German.

3. **Higgsfield Prompts** — Complete set of image and video generation prompts for all 8 levels, title screen, and intro cinematic. Includes camera specs, animation direction, and genre tags for Higgsfield Cinema Studio.

4. **Visual References** — AI-generated concept renders (see section above). These are the definitive visual target for all game art.

This CLAUDE.md takes precedence over all other documents for technical and game design decisions. If there's a conflict between this file and any other document, this file wins.
