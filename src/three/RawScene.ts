import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { generateTerrainGeometry, paintTerrainVertexColors, LEVEL1_TERRAIN } from '../utils/terrain';
import { REPAIR_SPEEDS, LEVEL1_PARTS } from '../types/game';
import { usePlayerStore } from '../stores/usePlayerStore';
import { useUIStore } from '../stores/useUIStore';
import { useInputStore } from '../systems/InputManager';

const INTERACTION_RADIUS = 2.0;

interface CameraConfig {
  height: number;
  distance: number;
  lookOffset: number;
}

const CAMERA_CONFIGS: Record<number, CameraConfig> = {
  0: { height: 1.2, distance: 3.5, lookOffset: 0.6 },
  1: { height: 1.4, distance: 3.5, lookOffset: 0.7 },
  2: { height: 1.8, distance: 4.0, lookOffset: 0.8 },
  3: { height: 2.2, distance: 4.5, lookOffset: 1.0 },
};

const ROCK_DATA: { pos: [number, number, number]; size: number }[] = [
  { pos: [3, 0.15, -2], size: 0.45 },
  { pos: [-4, 0.1, 1], size: 0.55 },
  { pos: [5, 0.2, 3], size: 0.35 },
  { pos: [-6, 0.15, -3], size: 0.6 },
  { pos: [7, 0.1, 8], size: 0.4 },
  { pos: [-3, 0.2, 5], size: 0.5 },
  { pos: [10, 0.15, 10], size: 0.65 },
  { pos: [-9, 0.1, 9], size: 0.3 },
  { pos: [2, 0.2, 12], size: 0.55 },
  { pos: [-5, 0.15, 14], size: 0.45 },
];

const MOUNTAIN_PLACEMENTS: { model: string; pos: [number, number, number]; scale: number; rotY: number }[] = [
  { model: '/models/mountain1.glb', pos: [-180, 0, 100], scale: 80, rotY: 0 },
  { model: '/models/mountain1.glb', pos: [200, 0, 120], scale: 75, rotY: Math.PI * 0.6 },
  { model: '/models/mountain2.glb', pos: [0, 0, 220], scale: 90, rotY: 0 },
  { model: '/models/mountain2.glb', pos: [-220, 0, 200], scale: 70, rotY: Math.PI * 0.3 },
  { model: '/models/mountain1.glb', pos: [250, 0, 220], scale: 85, rotY: Math.PI * 1.2 },
  { model: '/models/mountain2.glb', pos: [150, 0, -80], scale: 60, rotY: Math.PI * 0.8 },
  { model: '/models/mountain1.glb', pos: [-150, 0, -60], scale: 55, rotY: Math.PI * 1.5 },
];

export class GameScene {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  clock: THREE.Clock;

  // Character
  memo9: THREE.Group;
  robotModel: THREE.Group | null = null;

  // Parts: scattered on ground + hidden meshes on robot body
  partGroups: Map<string, THREE.Group> = new Map();
  hiddenLimbMeshes: Map<string, THREE.Mesh[]> = new Map();

  // Limb pivots for procedural animation (joint-based rotation)
  // Arms: single pivot at shoulder
  // Legs: hip pivot + knee pivot (child of hip) for bending
  limbPivots: Map<string, THREE.Group> = new Map();
  kneePivots: Map<string, THREE.Group> = new Map();

  // Camera state
  currentCamConfig: CameraConfig = { ...CAMERA_CONFIGS[0] };
  private cameraAngle = Math.PI;

  // Animation state
  private walkCycle = 0;
  private robotBaseY = 0;
  private targetPoseY = 0;
  private targetPoseRotX = 0;

  private animFrameId = 0;
  private loader = new GLTFLoader();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.setClearColor(new THREE.Color('#E6BFB3'), 1);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#E6BFB3');
    this.scene.fog = new THREE.Fog(new THREE.Color(0.9, 0.75, 0.7), 80, 350);

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(0, 3, -6);

    this.clock = new THREE.Clock();

    this.memo9 = new THREE.Group();
    this.scene.add(this.memo9);

    this.setupLighting();
    this.setupTerrain();
    this.setupGround();
    this.createCrate();
    this.createRocks();

    this.loadRobot();
    this.loadMountains();

    window.addEventListener('resize', this.onResize);
  }

  private loadRobot() {
    this.loader.load('/models/robot.glb', (gltf) => {
      const model = gltf.scene;

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      const targetHeight = 1.8;
      const scaleFactor = targetHeight / size.y;
      model.scale.setScalar(scaleFactor);

      this.robotBaseY = -box.min.y * scaleFactor;
      model.position.set(
        -center.x * scaleFactor,
        this.robotBaseY,
        -center.z * scaleFactor,
      );

      model.rotation.y = Math.PI;

      this.targetPoseY = -this.robotBaseY;
      this.targetPoseRotX = 1.3;

      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      this.robotModel = model;
      this.memo9.add(model);

      // Classify meshes into body regions, create limb pivots, and scatter parts
      this.setupLimbs(model, scaleFactor);
    });
  }

  private setupLimbs(robotModel: THREE.Group, scaleFactor: number) {
    // Collect all meshes with their geometry bounding box centers
    const allMeshes: { mesh: THREE.Mesh; center: THREE.Vector3 }[] = [];
    robotModel.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry.computeBoundingBox();
        const center = mesh.geometry.boundingBox!.getCenter(new THREE.Vector3());
        allMeshes.push({ mesh, center });
      }
    });

    if (allMeshes.length === 0) return;

    // Overall robot bounds
    const fullBox = new THREE.Box3();
    for (const { mesh } of allMeshes) {
      const bb = mesh.geometry.boundingBox!;
      fullBox.expandByPoint(bb.min);
      fullBox.expandByPoint(bb.max);
    }
    const fullCenter = fullBox.getCenter(new THREE.Vector3());
    const fullSize = fullBox.getSize(new THREE.Vector3());

    const midX = fullCenter.x;
    const midY = fullCenter.y;
    const legTopY = midY - fullSize.y * 0.05;
    const armOuterX = fullSize.x * 0.18;

    // Classify into regions (arms + legs as whole regions first)
    const regions: Record<string, THREE.Mesh[]> = {
      right_arm: [],
      left_arm: [],
      left_leg: [],
      right_leg: [],
    };

    for (const { mesh, center } of allMeshes) {
      if (center.x > midX + armOuterX && center.y > midY) {
        regions.right_arm.push(mesh);
      } else if (center.x < midX - armOuterX && center.y > midY) {
        regions.left_arm.push(mesh);
      } else if (center.x < midX && center.y < legTopY) {
        regions.left_leg.push(mesh);
      } else if (center.x >= midX && center.y < legTopY) {
        regions.right_leg.push(mesh);
      }
    }

    // --- Create arm pivots (single pivot at shoulder) ---
    for (const armId of ['left_arm', 'right_arm']) {
      const meshes = regions[armId];
      if (meshes.length === 0) continue;

      const limbBox = new THREE.Box3();
      for (const mesh of meshes) limbBox.union(mesh.geometry.boundingBox!);

      const pivotPoint = new THREE.Vector3(
        armId === 'left_arm' ? limbBox.max.x : limbBox.min.x,
        limbBox.max.y,
        (limbBox.min.z + limbBox.max.z) / 2,
      );

      const pivot = new THREE.Group();
      pivot.position.copy(pivotPoint);

      const parent = meshes[0].parent;
      if (parent) parent.add(pivot);

      for (const mesh of meshes) {
        mesh.removeFromParent();
        mesh.position.sub(pivotPoint);
        pivot.add(mesh);
      }
      this.limbPivots.set(armId, pivot);
    }

    // --- Create leg pivots with knee sub-pivots ---
    for (const legId of ['left_leg', 'right_leg']) {
      const meshes = regions[legId];
      if (meshes.length === 0) continue;

      // Compute full leg bounding box
      const limbBox = new THREE.Box3();
      for (const mesh of meshes) limbBox.union(mesh.geometry.boundingBox!);

      // Split upper/lower at the Y midpoint of the leg
      const kneeSplitY = (limbBox.min.y + limbBox.max.y) / 2;

      const upperMeshes: THREE.Mesh[] = [];
      const lowerMeshes: THREE.Mesh[] = [];
      for (const { mesh, center } of allMeshes) {
        if (!meshes.includes(mesh)) continue;
        if (center.y >= kneeSplitY) {
          upperMeshes.push(mesh);
        } else {
          lowerMeshes.push(mesh);
        }
      }

      // Hip pivot at top of leg
      const hipPoint = new THREE.Vector3(
        (limbBox.min.x + limbBox.max.x) / 2,
        limbBox.max.y,
        (limbBox.min.z + limbBox.max.z) / 2,
      );

      const hipPivot = new THREE.Group();
      hipPivot.position.copy(hipPoint);

      const parent = meshes[0].parent;
      if (parent) parent.add(hipPivot);

      // Reparent upper leg meshes into hip pivot
      for (const mesh of upperMeshes) {
        mesh.removeFromParent();
        mesh.position.sub(hipPoint);
        hipPivot.add(mesh);
      }

      // Knee pivot as child of hip pivot
      const kneePoint = new THREE.Vector3(
        (limbBox.min.x + limbBox.max.x) / 2,
        kneeSplitY,
        (limbBox.min.z + limbBox.max.z) / 2,
      );
      // Knee position relative to hip pivot
      const kneeRelative = kneePoint.clone().sub(hipPoint);

      const kneePivot = new THREE.Group();
      kneePivot.position.copy(kneeRelative);
      hipPivot.add(kneePivot);

      // Reparent lower leg meshes into knee pivot
      for (const mesh of lowerMeshes) {
        mesh.removeFromParent();
        mesh.position.sub(kneePoint);
        kneePivot.add(mesh);
      }

      this.limbPivots.set(legId, hipPivot);
      this.kneePivots.set(legId, kneePivot);
    }

    // --- Hide collectible limb meshes + create scattered ground pieces ---
    for (const part of LEVEL1_PARTS) {
      const meshes = regions[part.id];
      if (!meshes || meshes.length === 0) continue;

      // Hide on robot body
      for (const mesh of meshes) {
        mesh.visible = false;
      }
      this.hiddenLimbMeshes.set(part.id, meshes);

      // Create scattered clone on the ground
      const group = new THREE.Group();
      const partBox = new THREE.Box3();
      for (const mesh of meshes) {
        const clone = mesh.clone();
        clone.visible = true;
        clone.castShadow = true;
        clone.receiveShadow = true;
        group.add(clone);
        const bb = mesh.geometry.boundingBox!;
        partBox.union(bb);
      }

      group.scale.setScalar(scaleFactor);

      const partCenter = partBox.getCenter(new THREE.Vector3());
      group.children.forEach((child) => {
        child.position.sub(partCenter);
      });

      group.position.set(part.position[0], 0.15, part.position[2]);

      if (part.type === 'arm') {
        group.rotation.set(-0.1, 0.4, Math.PI / 2 + 0.2);
      } else {
        group.rotation.set(Math.PI / 2 - 0.1, 0.3, 0.15);
      }

      this.scene.add(group);
      this.partGroups.set(part.id, group);
    }
  }

  private loadMountains() {
    const modelCache = new Map<string, THREE.Group>();

    for (const placement of MOUNTAIN_PLACEMENTS) {
      const cached = modelCache.get(placement.model);
      if (cached) {
        this.placeMountain(cached.clone(), placement);
        continue;
      }

      this.loader.load(placement.model, (gltf) => {
        const model = gltf.scene;
        modelCache.set(placement.model, model);
        this.placeMountain(model.clone(), placement);
      });
    }
  }

  private placeMountain(model: THREE.Group, placement: { pos: [number, number, number]; scale: number; rotY: number }) {
    model.scale.setScalar(placement.scale);
    model.position.set(...placement.pos);
    model.rotation.y = placement.rotY;

    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    this.scene.add(model);
  }

  private setupLighting() {
    const sun = new THREE.DirectionalLight(new THREE.Color(1.0, 0.85, 0.65), 2.0);
    sun.position.set(-50, 25, -30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.far = 100;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    this.scene.add(sun);

    const hemi = new THREE.HemisphereLight(
      new THREE.Color(0.85, 0.65, 0.75),
      new THREE.Color(0.35, 0.35, 0.5),
      0.6,
    );
    this.scene.add(hemi);

    const ambient = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(ambient);
  }

  private setupTerrain() {
    const geo = generateTerrainGeometry(LEVEL1_TERRAIN);
    paintTerrainVertexColors(geo, LEVEL1_TERRAIN.maxHeight);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    const offsetZ = LEVEL1_TERRAIN.sizeZ * (0.5 - LEVEL1_TERRAIN.playerNZ);
    mesh.position.set(0, 0, offsetZ);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  private setupGround() {
    const geo = new THREE.PlaneGeometry(200, 200);
    const mat = new THREE.ShadowMaterial({ opacity: 0.3 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -0.01;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  private createCrate() {
    // Crash crate = repair/recharge station (battery pod)
    const group = new THREE.Group();
    group.position.set(0, 0, 21);

    // Main crate body
    const crateMat = new THREE.MeshStandardMaterial({ color: '#5A4A2A', roughness: 0.7, metalness: 0.3 });
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 1.2), crateMat);
    crate.position.y = 0.7;
    crate.rotation.set(0, 0.15, 0.08);
    crate.castShadow = true;
    group.add(crate);

    // Glowing battery core visible through the top
    const batteryMat = new THREE.MeshStandardMaterial({
      color: '#00FF88',
      emissive: new THREE.Color('#00FF88'),
      emissiveIntensity: 1.5,
      roughness: 0.1,
      metalness: 0.5,
    });
    const battery = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.8, 12), batteryMat);
    battery.position.set(0, 1.5, 0);
    battery.castShadow = true;
    group.add(battery);

    // Energy ring around battery
    const ringMat = new THREE.MeshStandardMaterial({
      color: '#00CC66',
      emissive: new THREE.Color('#00CC66'),
      emissiveIntensity: 0.8,
      roughness: 0.2,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 24), ringMat);
    ring.position.set(0, 1.5, 0);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    this.scene.add(group);
  }

  private createRocks() {
    const mat = new THREE.MeshStandardMaterial({ color: '#6B6B6B', roughness: 0.9 });
    for (const rock of ROCK_DATA) {
      const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(rock.size, 0), mat);
      mesh.position.set(...rock.pos);
      mesh.castShadow = true;
      this.scene.add(mesh);
    }
  }

  // Repair station is now part of the crate (battery pod at 0, 0, 21)

  start() {
    this.animate();
  }

  stop() {
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('resize', this.onResize);
  }

  private animate = () => {
    this.animFrameId = requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();

    this.updateMovement(delta);
    this.updateWalkAnimation(delta);
    this.updateParts(delta);
    this.updateCamera(delta);

    this.renderer.render(this.scene, this.camera);
  };

  private updateMovement(delta: number) {
    const { moveX, moveY, interact } = useInputStore.getState();
    const repairState = usePlayerStore.getState().repairState;
    const speed = REPAIR_SPEEDS[repairState];

    if (Math.abs(moveX) > 0.01 || Math.abs(moveY) > 0.01) {
      const forward = new THREE.Vector3();
      const right = new THREE.Vector3();
      this.camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      right.crossVectors(forward, THREE.Object3D.DEFAULT_UP).normalize();

      const moveDir = new THREE.Vector3();
      moveDir.addScaledVector(forward, moveY);
      moveDir.addScaledVector(right, moveX);
      moveDir.normalize();

      this.memo9.position.addScaledVector(moveDir, speed * delta);
      this.memo9.position.y = 0;

      const targetAngle = Math.atan2(moveDir.x, moveDir.z);
      let diff = targetAngle - this.memo9.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.memo9.rotation.y += diff * Math.min(5 * delta, 1);
      usePlayerStore.getState().setIsMoving(true);
    } else {
      usePlayerStore.getState().setIsMoving(false);
    }

    if (interact) {
      const partsCollected = usePlayerStore.getState().partsCollected;
      for (const part of LEVEL1_PARTS) {
        if (partsCollected.includes(part.id)) continue;
        const partPos = new THREE.Vector3(...part.position);
        if (this.memo9.position.distanceTo(partPos) < INTERACTION_RADIUS) {
          usePlayerStore.getState().collectPart(part.id, part.repairStateGrant);
          const labels: Record<number, string> = { 1: 'crawl', 2: 'hobble', 3: 'walk normally' };
          useUIStore.getState().showMessage(
            `${part.displayName} attached!\nYou can ${labels[part.repairStateGrant] ?? ''} now.`,
          );
          useInputStore.getState().setInteract(false);
          break;
        }
      }
    }
  }

  private updateWalkAnimation(delta: number) {
    if (!this.robotModel) return;

    const isMoving = usePlayerStore.getState().isMoving;
    const repairState = usePlayerStore.getState().repairState;

    // --- Base posture per repair state ---
    // goalY offsets from robotBaseY (standing height). Negative = sink toward ground.
    // The forward tilt (goalRotX) visually lifts the feet, so we must compensate by
    // sinking the model further in low states.
    const h = this.robotBaseY;
    let goalY: number;
    let goalRotX: number;
    if (repairState === 0) {
      goalY = -h;                // origin at ground level, tilted face-down
      goalRotX = 1.3;
    } else if (repairState === 1) {
      goalY = -h * 0.9;         // nearly flat on ground, crawling
      goalRotX = 0.9;
    } else if (repairState === 2) {
      goalY = -h * 0.15;        // slight crouch
      goalRotX = 0.2;
    } else {
      goalY = 0;                 // full standing
      goalRotX = 0;
    }

    const poseLerp = Math.min(5 * delta, 1);
    this.targetPoseY = THREE.MathUtils.lerp(this.targetPoseY, goalY, poseLerp);
    this.targetPoseRotX = THREE.MathUtils.lerp(this.targetPoseRotX, goalRotX, poseLerp);

    // --- Walk cycle ---
    if (isMoving) {
      const cycleSpeed = repairState === 0 ? 2 : repairState === 1 ? 3.5 : repairState === 2 ? 5 : 8;
      this.walkCycle += delta * cycleSpeed;
    } else {
      this.walkCycle += delta * 1.2;
    }
    const t = this.walkCycle;

    // --- Body animation ---
    let animY = 0;
    let animRotX = 0;
    let animRotZ = 0;

    // --- Limb swing angles (hip rotation + knee bend) ---
    let leftHipSwing = 0;
    let rightHipSwing = 0;
    let leftKneeBend = 0;
    let rightKneeBend = 0;
    let leftArmSwing = 0;
    let rightArmSwing = 0;

    if (repairState === 0) {
      if (isMoving) {
        animY = Math.abs(Math.sin(t)) * 0.02;
        animRotX = Math.sin(t * 2) * 0.06;
        animRotZ = Math.sin(t) * 0.12;
      } else {
        animRotZ = Math.sin(t * 0.7) * 0.03;
      }
    } else if (repairState === 1) {
      if (isMoving) {
        animY = Math.abs(Math.sin(t)) * 0.04;
        animRotX = Math.sin(t) * 0.08;
        animRotZ = Math.sin(t * 0.5) * 0.1;
        rightArmSwing = Math.sin(t) * 0.6;
      } else {
        animY = Math.sin(t) * 0.01;
        animRotZ = Math.sin(t * 0.8) * 0.02;
        rightArmSwing = Math.sin(t * 0.5) * 0.1;
      }
    } else if (repairState === 2) {
      if (isMoving) {
        const cycle = Math.sin(t);
        animY = (cycle > 0 ? cycle * 0.06 : cycle * 0.02);
        animRotX = -0.03 + Math.sin(t * 2) * 0.02;
        animRotZ = Math.sin(t) * 0.08;
        // One leg hobbling with knee bend
        leftHipSwing = Math.sin(t) * 0.4;
        leftKneeBend = Math.max(0, -Math.sin(t)) * 0.6; // bend when leg swings back
        rightArmSwing = -Math.sin(t) * 0.3;
        leftArmSwing = Math.sin(t) * 0.2;
      } else {
        animY = Math.sin(t) * 0.01;
        animRotZ = 0.04;
        leftHipSwing = Math.sin(t * 0.5) * 0.05;
      }
    } else {
      // State 3: full humanoid walk with knee bending
      if (isMoving) {
        animY = Math.abs(Math.sin(t)) * 0.05;
        animRotX = -0.03;
        animRotZ = Math.sin(t) * 0.025;

        // Hip swing: alternating forward/back
        leftHipSwing = Math.sin(t) * 0.5;
        rightHipSwing = -Math.sin(t) * 0.5;

        // Knee bend: bends when leg passes under body (mid-swing)
        // Knee only bends backward (positive rotation), never hyperextends
        leftKneeBend = Math.max(0, Math.sin(t - 0.5)) * 0.7;
        rightKneeBend = Math.max(0, Math.sin(t + Math.PI - 0.5)) * 0.7;

        // Arms counter-swing
        leftArmSwing = -Math.sin(t) * 0.35;
        rightArmSwing = Math.sin(t) * 0.35;
      } else {
        animY = Math.sin(t) * 0.01;
        leftHipSwing = Math.sin(t * 0.3) * 0.02;
        rightHipSwing = -Math.sin(t * 0.3) * 0.02;
      }
    }

    // Apply body posture + animation
    this.robotModel.position.y = this.robotBaseY + this.targetPoseY + animY;
    this.robotModel.rotation.x = this.targetPoseRotX + animRotX;
    this.robotModel.rotation.z = THREE.MathUtils.lerp(
      this.robotModel.rotation.z,
      animRotZ,
      8 * delta,
    );

    // Apply limb pivot rotations
    const limbLerp = Math.min(12 * delta, 1);

    // Hip pivots (forward/back swing)
    const leftHip = this.limbPivots.get('left_leg');
    if (leftHip) {
      leftHip.rotation.x = THREE.MathUtils.lerp(leftHip.rotation.x, leftHipSwing, limbLerp);
    }
    const rightHip = this.limbPivots.get('right_leg');
    if (rightHip) {
      rightHip.rotation.x = THREE.MathUtils.lerp(rightHip.rotation.x, rightHipSwing, limbLerp);
    }

    // Knee pivots (bend backward only)
    const leftKnee = this.kneePivots.get('left_leg');
    if (leftKnee) {
      leftKnee.rotation.x = THREE.MathUtils.lerp(leftKnee.rotation.x, leftKneeBend, limbLerp);
    }
    const rightKnee = this.kneePivots.get('right_leg');
    if (rightKnee) {
      rightKnee.rotation.x = THREE.MathUtils.lerp(rightKnee.rotation.x, rightKneeBend, limbLerp);
    }

    // Arm pivots
    const leftArm = this.limbPivots.get('left_arm');
    if (leftArm) {
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, leftArmSwing, limbLerp);
    }
    const rightArm = this.limbPivots.get('right_arm');
    if (rightArm) {
      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, rightArmSwing, limbLerp);
    }
  }

  private updateParts(_delta: number) {
    const collected = usePlayerStore.getState().partsCollected;

    for (const part of LEVEL1_PARTS) {
      const isCollected = collected.includes(part.id);

      const group = this.partGroups.get(part.id);
      if (group) {
        group.visible = !isCollected;
      }

      const limbMeshes = this.hiddenLimbMeshes.get(part.id);
      if (limbMeshes) {
        for (const mesh of limbMeshes) {
          mesh.visible = isCollected;
        }
      }
    }
  }

  private updateCamera(delta: number) {
    const repairState = usePlayerStore.getState().repairState;
    const goal = CAMERA_CONFIGS[repairState];
    const cfg = this.currentCamConfig;
    const t = 2 * delta;

    cfg.height = THREE.MathUtils.lerp(cfg.height, goal.height, t);
    cfg.distance = THREE.MathUtils.lerp(cfg.distance, goal.distance, t);
    cfg.lookOffset = THREE.MathUtils.lerp(cfg.lookOffset, goal.lookOffset, t);

    const targetAngle = this.memo9.rotation.y + Math.PI;
    let camDiff = targetAngle - this.cameraAngle;
    while (camDiff > Math.PI) camDiff -= Math.PI * 2;
    while (camDiff < -Math.PI) camDiff += Math.PI * 2;
    this.cameraAngle += camDiff * Math.min(3 * delta, 1);

    const pos = this.memo9.position;
    const idealX = pos.x + Math.sin(this.cameraAngle) * cfg.distance;
    const idealZ = pos.z + Math.cos(this.cameraAngle) * cfg.distance;
    const ideal = new THREE.Vector3(idealX, pos.y + cfg.height, idealZ);

    this.camera.position.lerp(ideal, 4 * delta);
    this.camera.lookAt(pos.x, pos.y + cfg.lookOffset, pos.z);
  }

  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };
}
