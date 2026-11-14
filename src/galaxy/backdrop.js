// Bakgrunden: avlägsna stjärnor och ett svagt dis. Det här är dekor och
// betyder ingenting. Bakgrundsstjärnorna är små, bleka och går inte att
// klicka på, så att de inte förväxlas med böcker.

import * as THREE from 'three';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STAR_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aTint;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vTint;
  varying float vAlpha;
  void main() {
    vTint = aTint;
    vAlpha = 0.55 + 0.45 * sin(uTime * (0.3 + fract(aPhase * 7.0)) + aPhase * 6.283);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio;
  }
`;

const STAR_FRAGMENT = /* glsl */ `
  precision mediump float;
  varying vec3 vTint;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = exp(-d * d * 5.0);
    gl_FragColor = vec4(vTint * a * vAlpha, 1.0);
  }
`;

const HAZE_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Ett mjukt brus över himlen, starkast i ett band som påminner om Vintergatan.
const HAZE_FRAGMENT = /* glsl */ `
  precision mediump float;
  varying vec3 vDir;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.03 + 11.7;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 d = normalize(vDir);
    // Bandets plan lutar lite mot galaxens skiva.
    float band = exp(-pow(dot(d, normalize(vec3(0.18, 1.0, 0.32))) * 2.6, 2.0));
    float n = fbm(d * 2.4);
    float wisps = fbm(d * 6.0 + n * 2.0);
    float cloud = smoothstep(0.38, 0.95, n * 0.65 + wisps * 0.5) * (0.25 + 0.75 * band);

    vec3 deep = vec3(0.020, 0.030, 0.085);
    vec3 teal = vec3(0.030, 0.095, 0.130);
    vec3 violet = vec3(0.095, 0.045, 0.150);
    vec3 color = mix(teal, violet, smoothstep(0.3, 0.7, fbm(d * 1.3 + 4.0)));
    color = deep * (0.18 + 0.4 * band) + color * cloud * 0.5;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createBackdrop({ starCount = 5200, radius = 20000 } = {}) {
  const group = new THREE.Group();
  group.renderOrder = -10;
  const rand = mulberry32(1956); // samma himmel varje gång

  // Dis
  const haze = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.05, 32, 20),
    new THREE.ShaderMaterial({
      vertexShader: HAZE_VERTEX,
      fragmentShader: HAZE_FRAGMENT,
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
    }),
  );
  haze.renderOrder = -11;
  haze.frustumCulled = false;
  haze.raycast = () => {};
  group.add(haze);

  // Avlägsna stjärnor, tätare längs bandet.
  const positions = new Float32Array(starCount * 3);
  const sizes = new Float32Array(starCount);
  const phases = new Float32Array(starCount);
  const tints = new Float32Array(starCount * 3);
  const bandNormal = new THREE.Vector3(0.18, 1.0, 0.32).normalize();
  const v = new THREE.Vector3();
  const palette = [
    [0.75, 0.82, 1.0],
    [1.0, 0.96, 0.9],
    [1.0, 0.86, 0.72],
    [0.85, 0.9, 1.0],
  ];
  for (let i = 0; i < starCount; i++) {
    for (let attempt = 0; attempt < 6; attempt++) {
      v.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
      if (v.lengthSq() > 1 || v.lengthSq() < 0.01) continue;
      v.normalize();
      // Behåll oftare punkter nära bandet.
      const closeness = Math.exp(-Math.pow(v.dot(bandNormal) * 3.2, 2));
      if (rand() < 0.3 + 0.7 * closeness) break;
    }
    v.normalize().multiplyScalar(radius);
    positions.set([v.x, v.y, v.z], i * 3);
    const bright = Math.pow(rand(), 5);
    sizes[i] = 1.1 + bright * 2.6;
    phases[i] = rand();
    const tint = palette[Math.floor(rand() * palette.length)];
    const level = 0.22 + bright * 0.5;
    tints.set([tint[0] * level, tint[1] * level, tint[2] * level], i * 3);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  starGeometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  starGeometry.setAttribute('aTint', new THREE.BufferAttribute(tints, 3));
  const starMaterial = new THREE.ShaderMaterial({
    vertexShader: STAR_VERTEX,
    fragmentShader: STAR_FRAGMENT,
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  stars.frustumCulled = false;
  stars.renderOrder = -10;
  stars.raycast = () => {};
  group.add(stars);

  return {
    group,
    // Bakgrunden följer kameran, så att den alltid ligger oändligt långt bort.
    update(camera, time, pixelRatio) {
      group.position.copy(camera.position);
      starMaterial.uniforms.uTime.value = time;
      starMaterial.uniforms.uPixelRatio.value = pixelRatio;
    },
    dispose() {
      haze.geometry.dispose();
      haze.material.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
    },
  };
}
