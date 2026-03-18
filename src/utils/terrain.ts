import * as THREE from 'three';

// Attempt to approximate Perlin noise with a simple seeded noise
// For production, use a proper noise library — this is good enough for terrain
function hash(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) & 0x7fffffff;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function grad(ix: number, iy: number, x: number, y: number): number {
  const h = hash(ix, iy) & 3;
  const dx = x - ix;
  const dy = y - iy;
  switch (h) {
    case 0: return dx + dy;
    case 1: return -dx + dy;
    case 2: return dx - dy;
    default: return -dx - dy;
  }
}

export function perlin2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = smoothstep(fx);
  const sy = smoothstep(fy);

  const n00 = grad(ix, iy, x, y);
  const n10 = grad(ix + 1, iy, x, y);
  const n01 = grad(ix, iy + 1, x, y);
  const n11 = grad(ix + 1, iy + 1, x, y);

  return lerp(lerp(n00, n10, sx), lerp(n01, n11, sx), sy) * 0.5 + 0.5;
}

export interface TerrainConfig {
  sizeX: number;
  sizeZ: number;
  maxHeight: number;
  segments: number;
  playerNZ: number;      // normalized Z of player (0.25 = southern quarter)
  playHalfX: number;     // half-width of flat zone (meters)
  playHalfZ: number;     // half-depth of flat zone (meters)
  blendDist: number;     // blend distance (meters)
}

export const LEVEL1_TERRAIN: TerrainConfig = {
  sizeX: 600,
  sizeZ: 800,
  maxHeight: 250,
  segments: 128,
  playerNZ: 0.25,
  playHalfX: 80,
  playHalfZ: 60,
  blendDist: 80,
};

export function generateTerrainGeometry(config: TerrainConfig): THREE.PlaneGeometry {
  const { sizeX, sizeZ, maxHeight, segments } = config;
  const CX = 0.5;
  const CZ = config.playerNZ;
  const safeHW = config.playHalfX / sizeX;
  const safeHD = config.playHalfZ / sizeZ;
  const blend = config.blendDist / Math.max(sizeX, sizeZ);

  const geo = new THREE.PlaneGeometry(sizeX, sizeZ, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    // PlaneGeometry after rotateX(-PI/2): x stays, z = original y, y = 0
    const px = pos.getX(i);
    const pz = pos.getZ(i);

    // Normalize to 0..1
    const nx = (px + sizeX / 2) / sizeX;
    const nz = (pz + sizeZ / 2) / sizeZ;

    // South of play area: flat
    if (nz < CZ - safeHD) {
      pos.setY(i, 0);
      continue;
    }

    // Flat play-area mask
    const dEW = Math.max(0, Math.abs(nx - CX) - safeHW) / blend;
    const dN = Math.max(0, (nz - CZ) - safeHD) / blend;
    const dist = Math.max(dEW, dN);
    const mask = smoothstep(Math.min(dist, 1));

    if (mask < 0.001) {
      pos.setY(i, 0);
      continue;
    }

    // X warp
    const wx = perlin2D(nx * 2 + 5.3, nz * 2 + 1.7) * 0.04;
    const snx = Math.max(0, Math.min(1, nx + wx));

    // North mountains (3 ridge bands)
    const tN = Math.max(0, Math.min(1, (nz - CZ - safeHD) / (1 - CZ - safeHD)));
    const northV = Math.max(0, Math.min(1,
      perlin2D(snx * 3.5 + 1, 0) * 0.5 + 0.55 +
      perlin2D(snx * 7 + 4, 0) * 0.20 - 0.10
    ));
    const r1 = Math.max(0, 1 - Math.abs(tN - 0.15) / 0.10) * 0.55;
    const r2 = Math.max(0, 1 - Math.abs(tN - 0.40) / 0.15) * 0.80;
    const r3 = Math.max(0, 1 - Math.abs(tN - 0.75) / 0.18) * 1.00;
    const nH = Math.max(r1, r2, r3) * northV;

    // E/W flanking ridges (fade south of play area)
    const ewFade = smoothstep(Math.max(0, Math.min(1, (nz - CZ) / 0.15)));
    const ewDist = Math.abs(nx - CX);
    const ewBase = Math.max(0, Math.min(1, (ewDist - safeHW) / (0.5 - safeHW)));
    const ewBase2 = ewBase * ewBase;
    const westV = Math.max(0, Math.min(1, perlin2D(nz * 3 + 2, 0) * 0.6 + 0.45));
    const eastV = Math.max(0, Math.min(1, perlin2D(nz * 3 + 9, 0) * 0.6 + 0.45));
    const ewH = ewBase2 * (nx < CX ? westV : eastV) * 0.75 * ewFade;

    // Detail noise
    const detail = (perlin2D(snx * 18 + 1, nz * 18 + 2) - 0.5) * 0.04;

    const height = Math.max(0, Math.min(1, (Math.max(nH, ewH) + detail) * mask));
    pos.setY(i, height * maxHeight);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Create a height-based terrain material blending snow, rock, and pebbles.
 * Uses vertex colors to encode the blend (simpler than custom shaders for now).
 */
export function createTerrainMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.95, 0.95, 0.98), // snow white base
    roughness: 0.85,
    metalness: 0.0,
    flatShading: false,
    vertexColors: true,
  });
}

/**
 * Apply height-based vertex colors to terrain geometry.
 * Low = white (snow), mid = grey (rock), high = white again (snow caps).
 */
export function paintTerrainVertexColors(geo: THREE.PlaneGeometry, maxHeight: number): void {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const snowColor = new THREE.Color(0.95, 0.95, 0.98);
  const rockColor = new THREE.Color(0.45, 0.42, 0.40);
  const pebblesColor = new THREE.Color(0.65, 0.62, 0.58);

  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i) / maxHeight;

    let color: THREE.Color;
    if (h < 0.02) {
      // Flat: mostly snow
      color = snowColor.clone().lerp(pebblesColor, 0.1);
    } else if (h < 0.15) {
      // Slopes: snow → rock gradient
      const t = h / 0.15;
      color = snowColor.clone().lerp(rockColor, t * 0.7);
    } else if (h < 0.5) {
      // Mid peaks: rock
      color = rockColor.clone();
    } else {
      // High peaks: rock → snow caps
      const t = Math.min(1, (h - 0.5) * 3);
      color = rockColor.clone().lerp(snowColor, t * 0.8);
    }

    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}
