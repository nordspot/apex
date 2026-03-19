import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ─────────────────────────────────────────────────────────────
// Procedural texture generators (no external assets needed)
// ─────────────────────────────────────────────────────────────

function generateNoiseTexture(size = 256): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  // Simple seeded hash for deterministic noise
  const hash = (x: number, y: number) => {
    let h = x * 374761393 + y * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) & 0xff);
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // Multi-octave noise for organic feel
      const n1 = hash(x, y);
      const n2 = hash(x * 2 + 37, y * 2 + 91);
      const n3 = hash(x * 4 + 173, y * 4 + 251);
      const val = Math.floor(n1 * 0.5 + n2 * 0.3 + n3 * 0.2);
      data[i] = data[i + 1] = data[i + 2] = val;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function generateBrushTexture(size = 256): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  // Pure noise-based brush: no sine waves, no visible pattern
  // Uses multi-scale hash noise smoothed by local averaging
  const hash = (x: number, y: number, seed: number) => {
    let h = (x + seed * 17) * 374761393 + (y + seed * 31) * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) & 0xff) / 255;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // Multi-octave noise at different scales for organic feel
      const n1 = hash(x, y, 0);
      const n2 = hash(Math.floor(x / 2), Math.floor(y / 2), 1);
      const n3 = hash(Math.floor(x / 4), Math.floor(y / 4), 2);
      // Blend: fine detail + medium + coarse
      const val = Math.floor((n1 * 0.4 + n2 * 0.35 + n3 * 0.25) * 255);
      data[i] = data[i + 1] = data[i + 2] = val;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function generatePaperTexture(size = 256): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  // Fine grain paper texture — higher frequency, more subtle
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // Multi-scale grain
      let h1 = (x * 12345 + y * 67890 + 111) ^ 0xDEADBEEF;
      h1 = ((h1 >> 16) ^ h1) * 0x45d9f3b;
      h1 = ((h1 >> 16) ^ h1) & 0xff;
      let h2 = ((x * 2 + 7) * 98765 + (y * 2 + 13) * 43210) ^ 0xCAFEBABE;
      h2 = ((h2 >> 16) ^ h2) * 0x45d9f3b;
      h2 = ((h2 >> 16) ^ h2) & 0xff;
      const val = Math.floor(h1 * 0.6 + h2 * 0.4);
      data[i] = data[i + 1] = data[i + 2] = val;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

// ─────────────────────────────────────────────────────────────
// GLSL Shaders
// ─────────────────────────────────────────────────────────────

const fullscreenVert = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Pass 1: Kuwahara filter — the hero painterly effect
// Simplified isotropic version optimized for mobile (no structure tensor needed)
const kuwaharaFrag = /* glsl */`
uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform int uKernelSize;

varying vec2 vUv;

void main() {
  vec2 texel = 1.0 / resolution;
  int radius = uKernelSize;

  // Sample 4 quadrants around the pixel
  // For each quadrant: compute mean and variance
  // Use the quadrant with lowest variance (most uniform region)
  vec3 bestMean = vec3(0.0);
  float bestVar = 1e10;

  for (int q = 0; q < 4; q++) {
    // Quadrant offsets
    vec2 qDir;
    if (q == 0) qDir = vec2(1.0, 1.0);
    else if (q == 1) qDir = vec2(-1.0, 1.0);
    else if (q == 2) qDir = vec2(-1.0, -1.0);
    else qDir = vec2(1.0, -1.0);

    vec3 colorSum = vec3(0.0);
    vec3 colorSqSum = vec3(0.0);
    float count = 0.0;

    for (int dy = 0; dy <= 8; dy++) {
      if (dy > radius) break;
      for (int dx = 0; dx <= 8; dx++) {
        if (dx > radius) break;
        vec2 offset = vec2(float(dx), float(dy)) * qDir * texel;
        vec3 c = texture2D(tDiffuse, vUv + offset).rgb;
        colorSum += c;
        colorSqSum += c * c;
        count += 1.0;
      }
    }

    vec3 mean = colorSum / count;
    vec3 variance = (colorSqSum / count) - mean * mean;
    float v = dot(variance, vec3(0.299, 0.587, 0.114));

    if (v < bestVar) {
      bestVar = v;
      bestMean = mean;
    }
  }

  gl_FragColor = vec4(bestMean, 1.0);
}
`;

// Pass 2: Edge detection + wobble + brush overlay + color grading (combined)
const edgeBrushFrag = /* glsl */`
uniform sampler2D tDiffuse;
uniform sampler2D tNoise;
uniform sampler2D tBrush;
uniform sampler2D tPaper;
uniform vec2 resolution;
uniform float edgeThickness;
uniform float edgeWobble;
uniform float brushStrength;
uniform float paperStrength;

varying vec2 vUv;

// Luminance helper
float luma(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec2 texel = edgeThickness / resolution;
  vec4 color = texture2D(tDiffuse, vUv);

  // ── Edge detection (color-based, no depth buffer needed) ──
  // Wobble sample positions with noise
  vec2 noiseUV = vUv * 5.0;
  vec2 noiseOffset = (texture2D(tNoise, noiseUV).rg - 0.5) * edgeWobble / resolution;
  vec2 sampleUV = vUv + noiseOffset;

  vec3 c  = texture2D(tDiffuse, sampleUV).rgb;
  vec3 cL = texture2D(tDiffuse, sampleUV + vec2(-texel.x, 0.0)).rgb;
  vec3 cR = texture2D(tDiffuse, sampleUV + vec2( texel.x, 0.0)).rgb;
  vec3 cU = texture2D(tDiffuse, sampleUV + vec2(0.0,  texel.y)).rgb;
  vec3 cD = texture2D(tDiffuse, sampleUV + vec2(0.0, -texel.y)).rgb;

  // Diagonal samples for better edge detection
  vec3 cTL = texture2D(tDiffuse, sampleUV + vec2(-texel.x,  texel.y)).rgb;
  vec3 cTR = texture2D(tDiffuse, sampleUV + vec2( texel.x,  texel.y)).rgb;
  vec3 cBL = texture2D(tDiffuse, sampleUV + vec2(-texel.x, -texel.y)).rgb;
  vec3 cBR = texture2D(tDiffuse, sampleUV + vec2( texel.x, -texel.y)).rgb;

  // Sobel-like luminance edge
  float lumC  = luma(c);
  float lumL  = luma(cL);
  float lumR  = luma(cR);
  float lumU  = luma(cU);
  float lumD  = luma(cD);
  float lumTL = luma(cTL);
  float lumTR = luma(cTR);
  float lumBL = luma(cBL);
  float lumBR = luma(cBR);

  float gx = -lumTL - 2.0*lumL - lumBL + lumTR + 2.0*lumR + lumBR;
  float gy = -lumTL - 2.0*lumU - lumTR + lumBL + 2.0*lumD + lumBR;
  float edge = sqrt(gx * gx + gy * gy);

  // Soft painterly edge (darken, not black line)
  edge = smoothstep(0.04, 0.18, edge);
  vec3 edgeColor = color.rgb * 0.45; // darken edge regions
  color.rgb = mix(color.rgb, edgeColor, edge * 0.55);

  // ── Brush stroke overlay ──
  vec2 brushUV = gl_FragCoord.xy / 512.0; // large tile = less visible repeat
  float brush = texture2D(tBrush, brushUV).r;

  // Paper grain at different frequency
  vec2 paperUV = gl_FragCoord.xy / 384.0;
  float paper = texture2D(tPaper, paperUV).r;

  float luminance = luma(color.rgb);

  // Brush affects mid-tones most
  float midtoneMask = 1.0 - abs(luminance - 0.5) * 2.0;
  float brushEffect = (brush - 0.5) * brushStrength * midtoneMask;
  float paperEffect = (paper - 0.5) * paperStrength;

  color.rgb += brushEffect + paperEffect;

  // ── Color grading: warm highlights, cool shadows ──
  // Push highlights warm (golden)
  color.r += luminance * 0.025;
  color.g += luminance * 0.01;
  // Push shadows cool (blue-purple)
  color.b += (1.0 - luminance) * 0.035;
  color.r -= (1.0 - luminance) * 0.015;

  // Slight saturation boost in mid-tones (painterly vibrancy)
  vec3 grey = vec3(luminance);
  color.rgb = mix(grey, color.rgb, 1.08 + midtoneMask * 0.06);

  gl_FragColor = color;
}
`;

// ─────────────────────────────────────────────────────────────
// Pipeline class
// ─────────────────────────────────────────────────────────────

export class PainterlyPipeline {
  composer: EffectComposer;
  private kuwaharaPass: ShaderPass;
  private edgeBrushPass: ShaderPass;
  private noiseTex: THREE.DataTexture;
  private brushTex: THREE.DataTexture;
  private paperTex: THREE.DataTexture;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) {
    const size = renderer.getSize(new THREE.Vector2());

    // Generate procedural textures
    this.noiseTex = generateNoiseTexture(256);
    this.brushTex = generateBrushTexture(256);
    this.paperTex = generatePaperTexture(256);

    // Composer at slightly reduced resolution for perf + painterly softness
    this.composer = new EffectComposer(renderer);

    // Pass 0: Render scene
    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // Pass 1: Kuwahara filter (the hero painterly effect)
    this.kuwaharaPass = new ShaderPass({
      name: 'KuwaharaShader',
      uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector2(size.x, size.y) },
        uKernelSize: { value: 5 }, // 4-6 mobile, 8-12 desktop
      },
      vertexShader: fullscreenVert,
      fragmentShader: kuwaharaFrag,
    });
    this.composer.addPass(this.kuwaharaPass);

    // Pass 2: Edge wobble + brush overlay + color grading (combined into one pass)
    this.edgeBrushPass = new ShaderPass({
      name: 'EdgeBrushShader',
      uniforms: {
        tDiffuse: { value: null },
        tNoise: { value: this.noiseTex },
        tBrush: { value: this.brushTex },
        tPaper: { value: this.paperTex },
        resolution: { value: new THREE.Vector2(size.x, size.y) },
        edgeThickness: { value: 1.5 },
        edgeWobble: { value: 2.0 },
        brushStrength: { value: 0.03 },
        paperStrength: { value: 0.015 },
      },
      vertexShader: fullscreenVert,
      fragmentShader: edgeBrushFrag,
    });
    this.composer.addPass(this.edgeBrushPass);

    // Final output pass (tone mapping + color space)
    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  /** Call instead of renderer.render() */
  render() {
    this.composer.render();
  }

  /** Call on window resize */
  setSize(width: number, height: number) {
    this.composer.setSize(width, height);
    const res = new THREE.Vector2(width, height);
    this.kuwaharaPass.uniforms.resolution.value = res;
    this.edgeBrushPass.uniforms.resolution.value = res;
  }

  /** Adjust quality for device capability */
  setQuality(level: 'low' | 'medium' | 'high') {
    const kernelSize = level === 'low' ? 3 : level === 'medium' ? 5 : 8;
    this.kuwaharaPass.uniforms.uKernelSize.value = kernelSize;

    const edgeThickness = level === 'low' ? 1.2 : level === 'medium' ? 1.8 : 2.5;
    this.edgeBrushPass.uniforms.edgeThickness.value = edgeThickness;
  }

  /** Toggle painterly effect on/off (useful for perf testing) */
  setEnabled(enabled: boolean) {
    this.kuwaharaPass.enabled = enabled;
    this.edgeBrushPass.enabled = enabled;
  }

  dispose() {
    this.noiseTex.dispose();
    this.brushTex.dispose();
    this.paperTex.dispose();
    this.composer.dispose();
  }
}
