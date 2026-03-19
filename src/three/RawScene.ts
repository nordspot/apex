import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { generateTerrainGeometry, paintTerrainVertexColors, LEVEL1_TERRAIN } from '../utils/terrain';
import { REPAIR_SPEEDS, LEVEL1_PARTS } from '../types/game';
import { usePlayerStore } from '../stores/usePlayerStore';
import { useUIStore } from '../stores/useUIStore';
import { useInputStore } from '../systems/InputManager';
import { PainterlyPipeline } from './PainterlyPipeline';

const INTERACTION_RADIUS = 2.5;
const CRATE_POS = new THREE.Vector3(0, 0, 21);

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
  private targetPoseRotZ = 0;
  private prevRepairState = 0;
  private stateTransitionT = 1; // 0..1 transition progress

  // Snow deformation mesh (high-density ground plane for footprints/drag marks)
  private snowMesh: THREE.Mesh | null = null;
  private snowBaseY: Float32Array | null = null; // original Y values
  private snowGeo: THREE.PlaneGeometry | null = null;
  private readonly SNOW_SIZE = 60;     // meters, covers play area
  private readonly SNOW_SEGS = 200;    // vertex density for deformation

  // Painterly post-processing pipeline
  private painterly: PainterlyPipeline | null = null;

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

    // Painterly post-processing (Wild Robot style)
    this.painterly = new PainterlyPipeline(this.renderer, this.scene, this.camera);
    // Auto-detect quality based on device
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    this.painterly.setQuality(isMobile ? 'low' : 'medium');

    window.addEventListener('resize', this.onResize);

    // Subscribe to game phase changes for reset
    let prevPhase = useUIStore.getState().gamePhase;
    this.unsubPhase = useUIStore.subscribe((state) => {
      if (state.gamePhase !== prevPhase) {
        prevPhase = state.gamePhase;
        if (state.gamePhase === 'start') this.resetGame();
      }
    });
  }

  private unsubPhase: (() => void) | null = null;

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

  // Elbow pivots (child of shoulder pivot, like knee is child of hip)
  elbowPivots: Map<string, THREE.Group> = new Map();

  private setupLimbs(robotModel: THREE.Group, _scaleFactor: number) {
    // Use MODEL-LOCAL coordinates from geometry bounds for reliable classification.
    // The GLB model has: Y range ~[-3, +3], X center ~0, arms at |X|>0.5, legs at Y<-1
    // Model -X = robot's left arm (becomes world +X after PI rotation)
    // Model +X = robot's right arm (becomes world -X after PI rotation)
    // But for LEVEL1_PARTS ids: right_arm/left_leg/right_leg refer to the ROBOT's perspective

    robotModel.updateMatrixWorld(true);

    // Get each mesh's LOCAL center from its geometry bounding box (unaffected by transforms)
    const allMeshes: { mesh: THREE.Mesh; localCenter: THREE.Vector3; localBox: THREE.Box3 }[] = [];
    robotModel.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry.computeBoundingBox();
        const localBox = mesh.geometry.boundingBox!.clone();
        const localCenter = localBox.getCenter(new THREE.Vector3());
        allMeshes.push({ mesh, localCenter, localBox });
      }
    });

    if (allMeshes.length === 0) return;

    // Log ALL meshes for debugging
    console.log(`[APEX] Robot meshes (model-local coords):`);
    for (const { mesh, localCenter, localBox } of allMeshes) {
      const sz = localBox.getSize(new THREE.Vector3());
      console.log(`  "${mesh.name}" center=(${localCenter.x.toFixed(3)}, ${localCenter.y.toFixed(3)}, ${localCenter.z.toFixed(3)}) size=(${sz.x.toFixed(3)}, ${sz.y.toFixed(3)}, ${sz.z.toFixed(3)})`);
    }

    // --- Remove antenna/sphere: meshes with center Y > 1.9 in model-local space ---
    // Catches: mesh[11] Y=2.008, mesh[14] Y=2.035, mesh[47] Y=3.017, mesh[92] Y=2.625
    const antennaMinY = 1.9;
    const meshesToRemove: THREE.Mesh[] = [];
    for (const { mesh, localCenter } of allMeshes) {
      if (localCenter.y > antennaMinY) {
        console.log(`  [REMOVE] antenna: "${mesh.name}" (localY=${localCenter.y.toFixed(3)})`);
        meshesToRemove.push(mesh);
      }
    }
    for (const mesh of meshesToRemove) {
      mesh.removeFromParent();
      const idx = allMeshes.findIndex(m => m.mesh === mesh);
      if (idx >= 0) allMeshes.splice(idx, 1);
    }

    // --- Classification in model-local coordinates ---
    // Robot model faces -Z. Standard convention: model -X = character's LEFT, model +X = character's RIGHT.
    // After model.rotation.y = PI, the character faces +Z (toward camera).
    // LEVEL1_PARTS ids use character perspective: 'right_arm', 'left_leg', 'right_leg'
    //
    // From GLB analysis (113 meshes):
    //   Arms: |X| > 0.45, Y > -0.6 (includes hands that dip to Y≈-0.57)
    //   Legs: Y < 0.0 AND |X| > 0.15 AND NOT arm (arms take priority)
    //   Antenna: Y > 2.0
    //   Body: everything else (torso, head, shoulder connectors)
    const ARM_MIN_X = 0.43;  // arms at |X| >= 0.43 (hands at 0.432+)
    const ARM_MIN_Y = -0.6;  // hands dip to Y≈-0.57
    const HIP_Y = 0.0;       // everything below Y=0 with X offset = leg
    const LEG_MIN_X = 0.15;  // exclude centered torso (mesh[15] at |X|=0.026)

    const regions: Record<string, THREE.Mesh[]> = {
      right_arm: [], left_arm: [], left_leg: [], right_leg: [],
    };

    for (const { mesh, localCenter } of allMeshes) {
      const absX = Math.abs(localCenter.x);

      if (absX > ARM_MIN_X && localCenter.y > ARM_MIN_Y) {
        // Arm: far from center horizontally (arms checked FIRST, before legs)
        // Model -X = character's LEFT, Model +X = character's RIGHT
        if (localCenter.x < 0) {
          regions.left_arm.push(mesh);
        } else {
          regions.right_arm.push(mesh);
        }
      } else if (localCenter.y < HIP_Y && absX > LEG_MIN_X) {
        // Leg: below hip line and offset from center
        if (localCenter.x < 0) {
          regions.left_leg.push(mesh);
        } else {
          regions.right_leg.push(mesh);
        }
      }
    }

    console.log(`[APEX] Classification: LA=${regions.left_arm.length} RA=${regions.right_arm.length} LL=${regions.left_leg.length} RL=${regions.right_leg.length} body=${allMeshes.length - Object.values(regions).flat().length} total=${allMeshes.length}`);
    for (const [region, meshes] of Object.entries(regions)) {
      for (const m of meshes) {
        m.geometry.computeBoundingBox();
        const c = m.geometry.boundingBox!.getCenter(new THREE.Vector3());
        console.log(`  ${region}: "${m.name}" local=(${c.x.toFixed(3)}, ${c.y.toFixed(3)}, ${c.z.toFixed(3)})`);
      }
    }

    // --- Create limb pivots using world-space positions + attach() ---
    for (const armId of ['left_arm', 'right_arm']) {
      const meshes = regions[armId];
      if (meshes.length === 0) continue;

      // World-space bounding box for this arm
      const limbBox = new THREE.Box3();
      for (const m of meshes) limbBox.expandByObject(m);
      const limbSize = limbBox.getSize(new THREE.Vector3());

      // Shoulder = top of arm, toward body center
      const shoulderWorld = new THREE.Vector3(
        armId === 'left_arm'
          ? limbBox.min.x   // left arm: inner edge is min X (toward center)
          : limbBox.max.x,  // right arm: inner edge is max X (toward center)
        limbBox.max.y - limbSize.y * 0.05,
        (limbBox.min.z + limbBox.max.z) / 2,
      );

      // Elbow at Y midpoint
      const elbowSplitY = (limbBox.min.y + limbBox.max.y) / 2;
      const elbowWorld = new THREE.Vector3(
        (limbBox.min.x + limbBox.max.x) / 2,
        elbowSplitY,
        (limbBox.min.z + limbBox.max.z) / 2,
      );

      const upperMeshes: THREE.Mesh[] = [];
      const lowerMeshes: THREE.Mesh[] = [];
      for (const { mesh: m } of allMeshes) {
        if (!meshes.includes(m)) continue;
        // Use world-space Y for upper/lower split
        const wBox = new THREE.Box3().setFromObject(m);
        const wCenter = wBox.getCenter(new THREE.Vector3());
        if (wCenter.y >= elbowSplitY) upperMeshes.push(m);
        else lowerMeshes.push(m);
      }

      // Create shoulder pivot in model-local space
      const shoulderLocal = shoulderWorld.clone();
      robotModel.worldToLocal(shoulderLocal);
      const shoulderPivot = new THREE.Group();
      shoulderPivot.name = `pivot_${armId}_shoulder`;
      shoulderPivot.position.copy(shoulderLocal);
      robotModel.add(shoulderPivot);
      robotModel.updateMatrixWorld(true);

      // Attach upper arm meshes (preserves their world position)
      for (const mesh of upperMeshes) {
        shoulderPivot.attach(mesh);
      }

      // Elbow pivot as child of shoulder
      const elbowLocal = elbowWorld.clone();
      robotModel.worldToLocal(elbowLocal);
      const elbowRelative = elbowLocal.clone().sub(shoulderLocal);
      const elbowPivot = new THREE.Group();
      elbowPivot.name = `pivot_${armId}_elbow`;
      elbowPivot.position.copy(elbowRelative);
      shoulderPivot.add(elbowPivot);
      shoulderPivot.updateMatrixWorld(true);

      // Attach lower arm meshes
      for (const mesh of lowerMeshes) {
        elbowPivot.attach(mesh);
      }

      this.limbPivots.set(armId, shoulderPivot);
      this.elbowPivots.set(armId, elbowPivot);
    }

    // --- Create leg pivots with knee sub-pivots ---
    for (const legId of ['left_leg', 'right_leg']) {
      const meshes = regions[legId];
      if (meshes.length === 0) continue;

      const limbBox = new THREE.Box3();
      for (const m of meshes) limbBox.expandByObject(m);

      const kneeSplitY = (limbBox.min.y + limbBox.max.y) / 2;

      const hipWorld = new THREE.Vector3(
        (limbBox.min.x + limbBox.max.x) / 2,
        limbBox.max.y,
        (limbBox.min.z + limbBox.max.z) / 2,
      );

      const kneeWorld = new THREE.Vector3(
        (limbBox.min.x + limbBox.max.x) / 2,
        kneeSplitY,
        (limbBox.min.z + limbBox.max.z) / 2,
      );

      const upperMeshes: THREE.Mesh[] = [];
      const lowerMeshes: THREE.Mesh[] = [];
      for (const { mesh: m } of allMeshes) {
        if (!meshes.includes(m)) continue;
        const wBox = new THREE.Box3().setFromObject(m);
        const wCenter = wBox.getCenter(new THREE.Vector3());
        if (wCenter.y >= kneeSplitY) upperMeshes.push(m);
        else lowerMeshes.push(m);
      }

      const hipLocal = hipWorld.clone();
      robotModel.worldToLocal(hipLocal);
      const hipPivot = new THREE.Group();
      hipPivot.name = `pivot_${legId}_hip`;
      hipPivot.position.copy(hipLocal);
      robotModel.add(hipPivot);
      robotModel.updateMatrixWorld(true);

      for (const mesh of upperMeshes) {
        hipPivot.attach(mesh);
      }

      const kneeLocal = kneeWorld.clone();
      robotModel.worldToLocal(kneeLocal);
      const kneeRelative = kneeLocal.clone().sub(hipLocal);
      const kneePivot = new THREE.Group();
      kneePivot.name = `pivot_${legId}_knee`;
      kneePivot.position.copy(kneeRelative);
      hipPivot.add(kneePivot);
      hipPivot.updateMatrixWorld(true);

      for (const mesh of lowerMeshes) {
        kneePivot.attach(mesh);
      }

      this.limbPivots.set(legId, hipPivot);
      this.kneePivots.set(legId, kneePivot);
    }

    // --- Hide collectible limbs + create scattered ground pieces ---
    for (const part of LEVEL1_PARTS) {
      const meshes = regions[part.id];
      if (!meshes || meshes.length === 0) continue;

      // Hide on robot body (in their pivots)
      for (const mesh of meshes) {
        mesh.visible = false;
      }
      this.hiddenLimbMeshes.set(part.id, meshes);

      // Create scattered clone on the ground
      // Clone each mesh and bake its world transform into the geometry,
      // then center the group so all pieces stay connected
      const group = new THREE.Group();

      for (const mesh of meshes) {
        const clone = mesh.clone();
        clone.visible = true;
        clone.castShadow = true;
        clone.receiveShadow = true;
        // Bake the mesh's full world matrix into the geometry
        // This flattens position/rotation/scale into vertex data
        const worldMatrix = new THREE.Matrix4();
        mesh.updateWorldMatrix(true, false);
        worldMatrix.copy(mesh.matrixWorld);
        clone.geometry = mesh.geometry.clone();
        clone.geometry.applyMatrix4(worldMatrix);
        // Reset clone transform since geometry now has world coords baked in
        clone.position.set(0, 0, 0);
        clone.quaternion.identity();
        clone.scale.set(1, 1, 1);
        group.add(clone);
      }

      // Now center the group: compute bounding box and shift all geometries
      const groupBox = new THREE.Box3();
      for (const child of group.children) {
        groupBox.expandByObject(child);
      }
      const groupCenter = groupBox.getCenter(new THREE.Vector3());
      for (const child of group.children) {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).geometry.translate(-groupCenter.x, -groupCenter.y, -groupCenter.z);
        }
      }

      if (part.type === 'arm') {
        // Arm lying on its side in the snow
        group.rotation.set(Math.PI / 2, 0.3, 0.1);
        group.position.set(part.position[0], 0.05, part.position[2]);
      } else {
        // Leg lying flat on snow
        group.rotation.set(Math.PI / 2, 0.2, 0.1);
        group.position.set(part.position[0], 0.05, part.position[2]);
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
    // Shadow-only plane underneath everything
    const shadowGeo = new THREE.PlaneGeometry(200, 200);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.3 });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -0.02;
    shadowMesh.receiveShadow = true;
    this.scene.add(shadowMesh);

    // High-density deformable snow surface for footprints/drag marks
    const snowGeo = new THREE.PlaneGeometry(this.SNOW_SIZE, this.SNOW_SIZE, this.SNOW_SEGS, this.SNOW_SEGS);
    snowGeo.rotateX(-Math.PI / 2);

    const snowMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.93, 0.93, 0.96),
      roughness: 0.9,
      metalness: 0,
      vertexColors: true,
    });
    const snowMesh = new THREE.Mesh(snowGeo, snowMat);
    snowMesh.position.set(0, 0.001, 10); // centered on play area, slightly above terrain
    snowMesh.receiveShadow = true;
    this.scene.add(snowMesh);

    // Store base Y values for deformation reference
    const posAttr = snowGeo.attributes.position;
    const baseY = new Float32Array(posAttr.count);
    for (let i = 0; i < posAttr.count; i++) {
      baseY[i] = posAttr.getY(i);
    }

    // Initialize vertex colors (white snow)
    const colors = new Float32Array(posAttr.count * 3);
    for (let i = 0; i < posAttr.count; i++) {
      colors[i * 3] = 0.93;
      colors[i * 3 + 1] = 0.93;
      colors[i * 3 + 2] = 0.96;
    }
    snowGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.snowMesh = snowMesh;
    this.snowGeo = snowGeo;
    this.snowBaseY = baseY;
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
    if (this.painterly) this.painterly.dispose();
    if (this.unsubPhase) this.unsubPhase();
  }

  /** Reset game state: move MEMO-9 to origin, re-hide limbs, show scattered parts */
  private resetGame() {
    // Reset MEMO-9 position
    this.memo9.position.set(0, 0, 0);
    this.memo9.rotation.set(0, 0, 0);

    // Reset animation/pose state
    this.walkCycle = 0;
    this.targetPoseY = -this.robotBaseY;
    this.targetPoseRotX = 1.3;
    this.targetPoseRotZ = 0;
    this.prevRepairState = 0;
    this.stateTransitionT = 1;
    this.cameraAngle = Math.PI;
    this.currentCamConfig = { ...CAMERA_CONFIGS[0] };

    // Re-hide collected limbs on robot body
    for (const [, meshes] of this.hiddenLimbMeshes) {
      for (const mesh of meshes) {
        mesh.visible = false;
      }
    }

    // Show scattered ground parts again
    for (const [, group] of this.partGroups) {
      group.visible = true;
    }

    // Reset limb pivot rotations
    for (const [, pivot] of this.limbPivots) {
      pivot.rotation.set(0, 0, 0);
    }
    for (const [, pivot] of this.elbowPivots) {
      pivot.rotation.set(0, 0, 0);
    }
    for (const [, pivot] of this.kneePivots) {
      pivot.rotation.set(0, 0, 0);
    }

    // Reset robot model pose
    if (this.robotModel) {
      this.robotModel.position.y = this.robotBaseY;
      this.robotModel.rotation.x = 0;
      this.robotModel.rotation.z = 0;
    }

    // Reset snow deformation
    if (this.snowGeo && this.snowBaseY) {
      const posAttr = this.snowGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        posAttr.setY(i, this.snowBaseY[i]);
      }
      posAttr.needsUpdate = true;
      // Reset vertex colors
      const colorAttr = this.snowGeo.attributes.color;
      if (colorAttr) {
        for (let i = 0; i < colorAttr.count; i++) {
          colorAttr.setXYZ(i, 1, 1, 1);
        }
        colorAttr.needsUpdate = true;
      }
    }
  }

  private animate = () => {
    this.animFrameId = requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();

    this.updateMovement(delta);
    this.updateWalkAnimation(delta);
    this.updateParts(delta);
    this.updateCamera(delta);

    if (this.painterly) {
      this.painterly.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  };

  private updateMovement(delta: number) {
    if (useUIStore.getState().gamePhase !== 'playing') return;

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

      // For crawl states (0, 1): sync movement to arm PULL phase
      // MEMO only moves when arm is pulling body forward, not during reach
      let effectiveSpeed = speed;
      const t = this.walkCycle;
      if (repairState === 0) {
        // State 0: one-arm crawl, cycle = sin(t * 0.9)
        // Pull phase = when cycle < 0 (arm pulling back = body moves forward)
        const cycle = Math.sin(t * 0.9);
        const pullForce = Math.max(0, -cycle); // 0 during reach, 0→1 during pull
        effectiveSpeed = speed * pullForce * 2.5; // amplify since it's only half the cycle
      } else if (repairState === 1) {
        // State 1: two-arm crawl, alternating — always one arm pulling
        const cycle = Math.sin(t * 1.1);
        // Either arm is pulling at any time: use abs but with a bump pattern
        const pullForce = Math.abs(cycle);
        // Add lurching: faster at peak pull, slower between
        effectiveSpeed = speed * (0.3 + pullForce * 1.8);
      }

      this.memo9.position.addScaledVector(moveDir, effectiveSpeed * delta);
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

    // --- Proximity prompts ---
    const partsCollected = usePlayerStore.getState().partsCollected;
    let prompt: string | null = null;

    // Check nearby parts
    for (const part of LEVEL1_PARTS) {
      if (partsCollected.includes(part.id)) continue;
      const partPos = new THREE.Vector3(...part.position);
      if (this.memo9.position.distanceTo(partPos) < INTERACTION_RADIUS) {
        prompt = `[E] ${part.promptKey}`;
        break;
      }
    }

    // Check crate/repair station
    const allCollected = partsCollected.length >= LEVEL1_PARTS.length;
    const nearCrate = this.memo9.position.distanceTo(CRATE_POS) < INTERACTION_RADIUS;
    if (nearCrate && allCollected) {
      prompt = '[E] Recharge';
    } else if (nearCrate && !allCollected) {
      prompt = `Find all parts first (${partsCollected.length}/${LEVEL1_PARTS.length})`;
    }

    useUIStore.getState().setInteractionPrompt(prompt);

    // --- Interact action ---
    if (interact) {
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

      // Crate recharge interaction
      if (nearCrate && allCollected) {
        useUIStore.getState().stopTimer();
        useUIStore.getState().setGamePhase('complete');
        useInputStore.getState().setInteract(false);
      }
    }
  }

  private updateWalkAnimation(delta: number) {
    if (!this.robotModel) return;

    const isMoving = usePlayerStore.getState().isMoving;
    const repairState = usePlayerStore.getState().repairState;

    // Detect state transitions
    if (repairState !== this.prevRepairState) {
      this.prevRepairState = repairState;
      this.stateTransitionT = 0;
    }
    this.stateTransitionT = Math.min(this.stateTransitionT + delta * 0.8, 1);

    const h = this.robotBaseY; // standing height

    // ========== BASE POSTURE PER STATE ==========
    let goalY: number, goalRotX: number, goalRotZ: number;
    if (repairState === 0) {
      goalY = -h;           goalRotX = 1.45;  goalRotZ = 0;
    } else if (repairState === 1) {
      goalY = -h * 0.88;    goalRotX = 1.0;   goalRotZ = 0;
    } else if (repairState === 2) {
      goalY = -h * 0.12;    goalRotX = 0.15;  goalRotZ = 0.06;
    } else {
      goalY = 0;             goalRotX = 0;     goalRotZ = 0;
    }

    const poseLerp = Math.min(3 * delta, 1);
    this.targetPoseY = THREE.MathUtils.lerp(this.targetPoseY, goalY, poseLerp);
    this.targetPoseRotX = THREE.MathUtils.lerp(this.targetPoseRotX, goalRotX, poseLerp);
    this.targetPoseRotZ = THREE.MathUtils.lerp(this.targetPoseRotZ, goalRotZ, poseLerp);

    // ========== WALK CYCLE ==========
    const cycleSpeed = isMoving
      ? (repairState === 0 ? 1.8 : repairState === 1 ? 2.8 : repairState === 2 ? 4.5 : 7)
      : 0.8;
    this.walkCycle += delta * cycleSpeed;
    const t = this.walkCycle;

    // ========== ANIMATION OUTPUTS ==========
    let animY = 0, animRotX = 0, animRotZ = 0;
    let leftHip = 0, rightHip = 0;
    let leftKnee = 0, rightKnee = 0;
    let leftShoulder = 0, rightShoulder = 0;
    let leftElbow = 0, rightElbow = 0;

    // Easing helper: softens harsh sine peaks
    const ease = (x: number) => x * x * (3 - 2 * Math.abs(x)) * Math.sign(x);

    // ========== STATE 0: BROKEN — face down, left arm only ==========
    if (repairState === 0) {
      if (isMoving) {
        // Desperate one-arm army crawl — arm reaches FAR forward over head,
        // plants into snow, then DRAGS body forward.
        // Body is tilted at rotX≈1.45 (nearly face-down), so shoulder must
        // swing huge angles to visually reach "in front" on the ground.
        const cycle = Math.sin(t * 0.9);
        const reach = Math.max(0, -cycle);  // 0→1 during forward reach
        const pull = Math.max(0, cycle);    // 0→1 during backward pull

        // Shoulder: asymmetric — reaches WAY forward (over head), pulls to hip
        // Positive rotation.x = arm forward, negative = arm backward
        // With body at ~1.45 rad face-down, need large values to reach past head
        leftShoulder = reach * 2.4 - pull * 0.8;

        // Elbow: fully extended during reach (straight arm), bends hard on pull
        leftElbow = reach * 0.15 - pull * 1.2 - 0.1;

        // Body heaves forward with each pull
        animY = pull * 0.08 - 0.03;
        // Body lifts slightly during reach (gathering), drops on pull (effort)
        animRotX = -reach * 0.2 + pull * 0.15;
        // Body twists toward arm with effort
        animRotZ = cycle * 0.22 + Math.sin(t * 0.5) * 0.04;

        // Body drag friction shimmy
        animY += Math.sin(t * 2.5) * 0.01;
      } else {
        // Idle: collapsed, arm stretched forward weakly
        const breathe = Math.sin(t * 0.4);
        animY = breathe * 0.012;
        animRotZ = Math.sin(t * 0.3) * 0.04;
        // Arm resting extended forward
        leftShoulder = 0.8 + Math.sin(t * 0.25) * 0.12;
        leftElbow = -0.2 + Math.sin(t * 0.35) * 0.06;
      }
    }

    // ========== STATE 1: TWO ARM CRAWL (right_arm collected) ==========
    else if (repairState === 1) {
      if (isMoving) {
        // Two-arm belly crawl — alternating arms reach far forward over head
        // then plant and drag the body forward
        const cycle = Math.sin(t * 1.1);

        // Each arm: negative = reaching forward (over head), positive = pulling back
        const rightReach = Math.max(0, -cycle);  // right reaches when cycle < 0
        const rightPull = Math.max(0, cycle);     // right pulls when cycle > 0
        const leftReach = Math.max(0, cycle);     // left reaches when cycle > 0
        const leftPull = Math.max(0, -cycle);     // left pulls when cycle < 0

        // Shoulders: big asymmetric swing — far forward over head, pull to hip
        // Positive rotation.x = arm forward, negative = arm backward
        rightShoulder = rightReach * 2.2 - rightPull * 0.7;
        leftShoulder = leftReach * 2.2 - leftPull * 0.7;

        // Elbows: extend straight during reach, bend hard during pull
        rightElbow = rightReach * 0.15 - rightPull * 1.0 - 0.1;
        leftElbow = leftReach * 0.15 - leftPull * 1.0 - 0.1;

        // Body lurches forward with each pull
        const eitherPull = Math.abs(cycle);
        animY = eitherPull * 0.06 - 0.02;

        // Lateral rock: body rolls toward pulling arm
        animRotZ = cycle * 0.18;

        // Body pumps forward/back with effort
        animRotX = -Math.abs(cycle) * 0.08 + 0.04;

        // Drag shimmy
        animY += Math.sin(t * 2.3) * 0.01;
      } else {
        // Idle: propped on both arms extended forward
        animY = Math.sin(t * 0.5) * 0.008;
        animRotZ = Math.sin(t * 0.45) * 0.03;
        rightShoulder = 0.6 + Math.sin(t * 0.3) * 0.08;
        leftShoulder = 0.6 + Math.sin(t * 0.3 + 0.8) * 0.08;
        rightElbow = -0.2;
        leftElbow = -0.2;
      }
    }

    // ========== STATE 2: HOBBLING (both arms + left_leg) ==========
    else if (repairState === 2) {
      if (isMoving) {
        // Asymmetric hop/hobble: left leg does all work, missing right leg
        const stride = Math.sin(t);
        const strideAbs = Math.abs(stride);

        // Left leg: full stride with proper knee bend
        leftHip = stride * 0.5;
        // Knee bends during forward swing, straightens during back
        leftKnee = -Math.max(0, Math.sin(t - 0.5)) * 0.75;

        // Body dips when weight transfers to missing-leg side
        const dip = Math.max(0, stride);       // dip when left leg is forward (no right to catch)
        const support = Math.max(0, -stride);  // lift when left leg is back (body supported)
        animY = -dip * 0.07 + support * 0.025;

        // Pronounced lateral lean toward missing leg
        animRotZ = stride * 0.1 + 0.05;

        // Forward tilt with head bob
        animRotX = -0.04 + Math.sin(t * 2) * 0.015;

        // Arms for balance: wide swing
        rightShoulder = -stride * 0.35;
        leftShoulder = stride * 0.2;
        // Elbows slightly bent for natural look
        rightElbow = -0.2 - strideAbs * 0.1;
        leftElbow = -0.15 - strideAbs * 0.08;

        // Uneven timing: hobble has a hitch
        animY += Math.sin(t * 3) * 0.008;
      } else {
        // Idle: balancing on one leg
        animY = Math.sin(t * 0.35) * 0.012;
        animRotZ = 0.04 + Math.sin(t * 0.4) * 0.025;
        leftHip = Math.sin(t * 0.25) * 0.03;
        rightShoulder = Math.sin(t * 0.35) * 0.04;
        rightElbow = -0.2;
        leftElbow = -0.15;
      }
    }

    // ========== STATE 3: FULL WALK — proper bipedal gait ==========
    else {
      if (isMoving) {
        // Professional walk cycle:
        // Contact → Loading → Mid-stance → Terminal → Pre-swing → Swing

        // Hip swing with slight easing
        leftHip = ease(Math.sin(t)) * 0.4;
        rightHip = ease(-Math.sin(t)) * 0.4;

        // Knee bend: peak during swing phase, slight cushion at contact
        const lSwing = Math.max(0, Math.sin(t - 0.3));
        const rSwing = Math.max(0, Math.sin(t + Math.PI - 0.3));
        const lContact = Math.max(0, Math.sin(t + 0.6)) * 0.12;
        const rContact = Math.max(0, Math.sin(t + Math.PI + 0.6)) * 0.12;
        leftKnee = -(lSwing * 0.6 + lContact);
        rightKnee = -(rSwing * 0.6 + rContact);

        // Vertical bounce: up at mid-stance of each leg
        animY = Math.abs(Math.sin(t)) * 0.035;

        // Lateral weight shift over planted foot
        animRotZ = Math.sin(t) * 0.025;

        // Slight forward lean
        animRotX = -0.035 + Math.sin(t * 2) * 0.008;

        // Arms counter-swing with slight phase delay
        const armT = t + 0.12;
        leftShoulder = -ease(Math.sin(armT)) * 0.3;
        rightShoulder = ease(Math.sin(armT)) * 0.3;

        // Natural elbow bend: more bent during back-swing
        const lArmBack = Math.max(0, Math.sin(armT));
        const rArmBack = Math.max(0, -Math.sin(armT));
        leftElbow = -0.12 - lArmBack * 0.2;
        rightElbow = -0.12 - rArmBack * 0.2;
      } else {
        // Idle: weight shift, breathing, natural arm hang
        const breathe = Math.sin(t * 0.5);
        animY = breathe * 0.006;
        animRotZ = Math.sin(t * 0.3) * 0.01;

        leftHip = Math.sin(t * 0.2) * 0.015;
        rightHip = -Math.sin(t * 0.2) * 0.015;

        // Arms hang naturally with slight sway
        leftShoulder = Math.sin(t * 0.25) * 0.02;
        rightShoulder = -Math.sin(t * 0.25) * 0.02;
        leftElbow = -0.08 + Math.sin(t * 0.3) * 0.02;
        rightElbow = -0.08 - Math.sin(t * 0.3) * 0.02;
      }
    }

    // ========== APPLY TO MODEL ==========
    this.robotModel.position.y = this.robotBaseY + this.targetPoseY + animY;
    this.robotModel.rotation.x = this.targetPoseRotX + animRotX;

    const targetZ = this.targetPoseRotZ + animRotZ;
    this.robotModel.rotation.z = THREE.MathUtils.lerp(
      this.robotModel.rotation.z,
      targetZ,
      Math.min(8 * delta, 1),
    );

    // ========== APPLY LIMB ROTATIONS ==========
    const limbLerp = Math.min(14 * delta, 1);

    const leftHipPivot = this.limbPivots.get('left_leg');
    if (leftHipPivot) leftHipPivot.rotation.x = THREE.MathUtils.lerp(leftHipPivot.rotation.x, leftHip, limbLerp);

    const rightHipPivot = this.limbPivots.get('right_leg');
    if (rightHipPivot) rightHipPivot.rotation.x = THREE.MathUtils.lerp(rightHipPivot.rotation.x, rightHip, limbLerp);

    const leftKneePivot = this.kneePivots.get('left_leg');
    if (leftKneePivot) leftKneePivot.rotation.x = THREE.MathUtils.lerp(leftKneePivot.rotation.x, leftKnee, limbLerp);

    const rightKneePivot = this.kneePivots.get('right_leg');
    if (rightKneePivot) rightKneePivot.rotation.x = THREE.MathUtils.lerp(rightKneePivot.rotation.x, rightKnee, limbLerp);

    // Shoulder + elbow pivots
    const leftShoulderPivot = this.limbPivots.get('left_arm');
    if (leftShoulderPivot) leftShoulderPivot.rotation.x = THREE.MathUtils.lerp(leftShoulderPivot.rotation.x, leftShoulder, limbLerp);

    const rightShoulderPivot = this.limbPivots.get('right_arm');
    if (rightShoulderPivot) rightShoulderPivot.rotation.x = THREE.MathUtils.lerp(rightShoulderPivot.rotation.x, rightShoulder, limbLerp);

    const leftElbowPivot = this.elbowPivots.get('left_arm');
    if (leftElbowPivot) leftElbowPivot.rotation.x = THREE.MathUtils.lerp(leftElbowPivot.rotation.x, leftElbow, limbLerp);

    const rightElbowPivot = this.elbowPivots.get('right_arm');
    if (rightElbowPivot) rightElbowPivot.rotation.x = THREE.MathUtils.lerp(rightElbowPivot.rotation.x, rightElbow, limbLerp);

    // ========== SNOW DEFORMATION ==========
    this.deformSnow(isMoving, repairState);
  }

  private deformSnow(isMoving: boolean, repairState: number) {
    if (!this.snowGeo || !this.snowBaseY || !this.snowMesh || !isMoving) return;

    const pos = this.memo9.position;
    const angle = this.memo9.rotation.y;
    const snowPos = this.snowMesh.position;
    const posAttr = this.snowGeo.attributes.position;
    const halfSize = this.SNOW_SIZE / 2;
    const step = this.SNOW_SIZE / this.SNOW_SEGS;

    // Contact parameters per state — depths large enough to be clearly visible
    let radius: number, depth: number, widthScale: number;
    if (repairState === 0) {
      radius = 1.4;  depth = 0.12;  widthScale = 1.8; // wide body drag
    } else if (repairState === 1) {
      radius = 1.0;  depth = 0.10;  widthScale = 1.5; // body drag
    } else if (repairState === 2) {
      radius = 0.35; depth = 0.08;  widthScale = 1.0; // single foot hop
    } else {
      radius = 0.25; depth = 0.06;  widthScale = 1.0; // footprints
    }

    // Robot position in snow-local space
    const localX = pos.x - snowPos.x;
    const localZ = pos.z - snowPos.z;

    // Only deform vertices within range (optimize by checking bounding box first)
    const scanRange = radius + 0.5;
    const minI = Math.max(0, Math.floor(((localX - scanRange) + halfSize) / step));
    const maxI = Math.min(this.SNOW_SEGS, Math.ceil(((localX + scanRange) + halfSize) / step));
    const minJ = Math.max(0, Math.floor(((localZ - scanRange) + halfSize) / step));
    const maxJ = Math.min(this.SNOW_SEGS, Math.ceil(((localZ + scanRange) + halfSize) / step));

    let modified = false;

    for (let j = minJ; j <= maxJ; j++) {
      for (let i = minI; i <= maxI; i++) {
        const idx = j * (this.SNOW_SEGS + 1) + i;
        const vx = posAttr.getX(idx);
        const vz = posAttr.getZ(idx);

        // Distance from vertex to contact point, with directional width scaling
        const dx = vx - localX;
        const dz = vz - localZ;

        // Rotate into contact-aligned space for elliptical contact
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const alignedX = dx * cosA + dz * sinA;
        const alignedZ = (-dx * sinA + dz * cosA) * widthScale;

        const dist = Math.sqrt(alignedX * alignedX + alignedZ * alignedZ);

        if (dist < radius) {
          // Smooth falloff using cosine curve
          const factor = 0.5 * (1 + Math.cos(Math.PI * dist / radius));
          const currentY = posAttr.getY(idx);
          const targetY = this.snowBaseY[idx] - depth * factor;

          // Only push down, never up (snow stays deformed)
          if (targetY < currentY) {
            posAttr.setY(idx, targetY);
            modified = true;
          }
        }
      }
    }

    // State 2: additional drag mark from missing leg side
    if (repairState === 2) {
      const dragOffX = localX + Math.cos(angle) * 0.2;
      const dragOffZ = localZ - Math.sin(angle) * 0.2;
      const dragRadius = 0.15;
      const dragDepth = 0.015;
      const dMinI = Math.max(0, Math.floor(((dragOffX - dragRadius) + halfSize) / step));
      const dMaxI = Math.min(this.SNOW_SEGS, Math.ceil(((dragOffX + dragRadius) + halfSize) / step));
      const dMinJ = Math.max(0, Math.floor(((dragOffZ - dragRadius) + halfSize) / step));
      const dMaxJ = Math.min(this.SNOW_SEGS, Math.ceil(((dragOffZ + dragRadius) + halfSize) / step));

      for (let j = dMinJ; j <= dMaxJ; j++) {
        for (let i = dMinI; i <= dMaxI; i++) {
          const idx = j * (this.SNOW_SEGS + 1) + i;
          const vx = posAttr.getX(idx);
          const vz = posAttr.getZ(idx);
          const dist = Math.sqrt((vx - dragOffX) ** 2 + (vz - dragOffZ) ** 2);
          if (dist < dragRadius) {
            const factor = 0.5 * (1 + Math.cos(Math.PI * dist / dragRadius));
            const currentY = posAttr.getY(idx);
            const targetY = this.snowBaseY[idx] - dragDepth * factor;
            if (targetY < currentY) {
              posAttr.setY(idx, targetY);
              modified = true;
            }
          }
        }
      }
    }

    // State 3: dual footprints offset to each side
    if (repairState === 3) {
      const perpX = Math.cos(angle);
      const perpZ = -Math.sin(angle);
      for (const side of [-1, 1]) {
        const fx = localX + perpX * 0.15 * side;
        const fz = localZ + perpZ * 0.15 * side;
        const fRadius = 0.12;
        const fMinI = Math.max(0, Math.floor(((fx - fRadius) + halfSize) / step));
        const fMaxI = Math.min(this.SNOW_SEGS, Math.ceil(((fx + fRadius) + halfSize) / step));
        const fMinJ = Math.max(0, Math.floor(((fz - fRadius) + halfSize) / step));
        const fMaxJ = Math.min(this.SNOW_SEGS, Math.ceil(((fz + fRadius) + halfSize) / step));

        for (let j = fMinJ; j <= fMaxJ; j++) {
          for (let i = fMinI; i <= fMaxI; i++) {
            const idx = j * (this.SNOW_SEGS + 1) + i;
            const vx = posAttr.getX(idx);
            const vz = posAttr.getZ(idx);
            const dist = Math.sqrt((vx - fx) ** 2 + (vz - fz) ** 2);
            if (dist < fRadius) {
              const factor = 0.5 * (1 + Math.cos(Math.PI * dist / fRadius));
              const currentY = posAttr.getY(idx);
              const targetY = this.snowBaseY[idx] - 0.015 * factor;
              if (targetY < currentY) {
                posAttr.setY(idx, targetY);
                modified = true;
              }
            }
          }
        }
      }
    }

    if (modified) {
      posAttr.needsUpdate = true;
      this.snowGeo.computeVertexNormals();

      // Darken vertex colors where snow is deformed (track marks)
      const colorAttr = this.snowGeo.attributes.color;
      if (colorAttr) {
        for (let i = 0; i < posAttr.count; i++) {
          const currentY = posAttr.getY(i);
          const baseYVal = this.snowBaseY[i];
          const deformAmount = Math.max(0, baseYVal - currentY);
          if (deformAmount > 0.005) {
            // Darken proportionally: deeper = darker (grey/brown)
            const darken = Math.min(deformAmount * 6, 0.35);
            colorAttr.setXYZ(i,
              0.93 - darken * 0.7,  // less red (grey tint)
              0.93 - darken * 0.6,
              0.96 - darken * 0.5,
            );
          }
        }
        (colorAttr as THREE.BufferAttribute).needsUpdate = true;
      }
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
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.painterly) this.painterly.setSize(w, h);
  };
}
