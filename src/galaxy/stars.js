// Stjärnorna. Alla böcker ritas i ett enda anrop till grafikkortet, som
// fyrkanter vända mot kameran med glöden uträknad i en shader. Det håller
// galaxen snabb även med många hundra böcker.

import * as THREE from 'three';

const VERTEX = /* glsl */ `
  attribute vec3 aCenter;
  attribute vec3 aColor;
  attribute float aRadius;
  attribute float aLit;     // 0 = dämpad, 1 = tänd
  attribute float aRing;    // 1 = boken har den valda taggen
  attribute float aFocus;   // 1 = boken är i centrum
  attribute float aPhase;

  uniform float uTime;
  uniform float uPixelsPerUnit; // skärmpixlar per längdenhet på avståndet 1
  uniform float uMinPixels;
  uniform float uMaxPixels;

  varying vec2 vUv;
  varying vec3 vColor;
  varying float vLit;
  varying float vRing;
  varying float vFocus;
  varying float vPhase;
  varying float vBoost;

  void main() {
    vec4 mv = modelViewMatrix * vec4(aCenter, 1.0);
    float dist = max(0.001, -mv.z);

    // Fyrkanten är större än stjärnans kärna, så att glöden får plats.
    float halfSize = aRadius * (1.0 + 0.7 * aFocus) * (12.0 + 3.0 * aRing + 3.5 * aFocus);

    // Stjärnor långt bort får aldrig bli mindre än några pixlar.
    float pixels = halfSize * uPixelsPerUnit / dist;
    float grow = max(1.0, uMinPixels / pixels);
    // Stjärnor nära kameran växer långsammare, så att de inte fyller bilden.
    float limit = uMaxPixels * (1.0 + 0.5 * aRing + 0.6 * aFocus);
    float shrink = pixels > limit ? (limit + (pixels - limit) * 0.25) / pixels : 1.0;
    halfSize *= grow * shrink;
    vBoost = 1.0 / sqrt(grow);

    mv.xy += position.xy * halfSize;
    gl_Position = projectionMatrix * mv;

    vUv = position.xy;
    vColor = aColor;
    vLit = aLit;
    vRing = aRing;
    vFocus = aFocus;
    vPhase = aPhase;
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;

  uniform float uTime;

  varying vec2 vUv;
  varying vec3 vColor;
  varying float vLit;
  varying float vRing;
  varying float vFocus;
  varying float vPhase;
  varying float vBoost;

  void main() {
    // Skalan gör att kärnan är lika stor oavsett hur stor fyrkanten är.
    float scale = 12.0 + 3.0 * vRing + 3.5 * vFocus;
    vec2 p = vUv * scale / 6.0;
    float d = length(p);

    float twinkle = 1.0 + 0.10 * sin(uTime * (0.7 + fract(vPhase) * 1.3) + vPhase * 6.283);

    float core = exp(-d * d * 260.0);                       // vit het kärna
    float glow = exp(-d * d * 30.0) * 0.62;                 // färgad glöd
    float halo = pow(max(0.0, 1.0 - d), 3.5) * 0.13;        // bred mjuk gloria
    float aura = exp(-d * d * 1.5) * 0.045;                 // svagt sken som färgar täta kluster

    // Fyra tunna strålar, som i ett teleskopfoto.
    vec2 a = abs(p);
    float spikes = exp(-a.y * 90.0) * exp(-a.x * 4.2) + exp(-a.x * 90.0) * exp(-a.y * 4.2);
    spikes *= 0.22;

    vec3 color = vColor * (glow + halo + aura + spikes) * twinkle + mix(vColor, vec3(1.0), 0.72) * core * 1.15;

    // Dämpade stjärnor finns kvar som svaga punkter.
    float brightness = mix(0.06, 1.0, vLit);
    color *= brightness * vBoost;

    // Tänd tagg: en lugnt pulserande ring runt stjärnan.
    if (vRing > 0.01) {
      float r = 0.86 + 0.04 * sin(uTime * 1.6 + vPhase * 6.283);
      float ring = exp(-pow((d - r) * 34.0, 2.0)) + exp(-pow((d - r) * 9.0, 2.0)) * 0.18;
      color += mix(vColor, vec3(1.0), 0.35) * ring * 0.5 * vRing;
    }

    // Boken i centrum: två ringar som vandrar utåt.
    if (vFocus > 0.01) {
      for (int i = 0; i < 2; i++) {
        float t = fract(uTime * 0.22 + float(i) * 0.5);
        float r = 0.35 + t * 1.15;
        float ring = exp(-pow((d - r) * 30.0, 2.0)) * (1.0 - t) * (1.0 - t);
        color += mix(vColor, vec3(1.0), 0.5) * ring * 0.55 * vFocus;
      }
    }

    // Mjuk kant så att fyrkanten aldrig syns.
    float edge = smoothstep(scale / 6.0, scale / 6.0 * 0.82, max(a.x, a.y));
    gl_FragColor = vec4(color * edge, 1.0);
  }
`;

export function createStars() {
  const quad = new THREE.PlaneGeometry(2, 2);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = quad.index;
  geometry.setAttribute('position', quad.getAttribute('position'));

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uPixelsPerUnit: { value: 800 },
      uMinPixels: { value: 15 },
      uMaxPixels: { value: 230 },
    },
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  mesh.raycast = () => {}; // klick sköts av osynliga klot, se galaxy.js

  let capacity = 0;
  let attrs = {};

  function allocate(count) {
    capacity = Math.max(64, Math.ceil(count * 1.5));
    const make = (name, size) => {
      const attribute = new THREE.InstancedBufferAttribute(new Float32Array(capacity * size), size);
      attribute.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute(name, attribute);
      return attribute;
    };
    attrs = {
      center: make('aCenter', 3),
      color: make('aColor', 3),
      radius: make('aRadius', 1),
      lit: make('aLit', 1),
      ring: make('aRing', 1),
      focus: make('aFocus', 1),
      phase: make('aPhase', 1),
    };
  }

  const tmpColor = new THREE.Color();

  return {
    mesh,

    // Körs när galaxens innehåll ändras. nodes: [{ color, radius, phase }]
    setNodes(nodes) {
      if (nodes.length > capacity) allocate(nodes.length);
      geometry.instanceCount = nodes.length;
      nodes.forEach((node, i) => {
        tmpColor.set(node.color);
        attrs.color.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
        attrs.radius.setX(i, node.radius);
        attrs.phase.setX(i, node.phase);
      });
      if (!nodes.length) return; // tom galax, till exempel i byggläget innan första boken
      attrs.color.needsUpdate = true;
      attrs.radius.needsUpdate = true;
      attrs.phase.needsUpdate = true;
    },

    // Körs varje bildruta. nodes: [{ x, y, z, lit, ring, focus }]
    update(nodes, time, pixelsPerUnit) {
      if (!nodes.length) return;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        attrs.center.setXYZ(i, n.x || 0, n.y || 0, n.z || 0);
        attrs.lit.setX(i, n.lit);
        attrs.ring.setX(i, n.ring);
        attrs.focus.setX(i, n.focus);
      }
      attrs.center.needsUpdate = true;
      attrs.lit.needsUpdate = true;
      attrs.ring.needsUpdate = true;
      attrs.focus.needsUpdate = true;
      material.uniforms.uTime.value = time;
      material.uniforms.uPixelsPerUnit.value = pixelsPerUnit;
    },

    dispose() {
      geometry.dispose();
      material.dispose();
      quad.dispose();
    },
  };
}
