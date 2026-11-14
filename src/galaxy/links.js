// Ljusstråken. Varje koppling är ett smalt band mellan två stjärnor, ritat
// med jämn bredd i skärmpixlar. Alla stråk ritas i ett enda anrop.
//
// Riktningen syns på två sätt, så att den går att läsa även utan rörelse:
//   - riktade kopplingar ljusnar mot boken de leder till, och ljuset vandrar ditåt
//   - kopplingar åt båda håll lyser jämnt, och ljuset möts på mitten

import * as THREE from 'three';

const VERTEX = /* glsl */ `
  attribute vec3 aStart;
  attribute vec3 aEnd;
  attribute vec3 aColor;
  attribute float aLit;       // 0 = dämpat, 1 = tänt, 2 = framhävt
  attribute float aDirected;
  attribute float aPhase;

  uniform vec2 uResolution;
  uniform float uNear;

  varying float vAlong;
  varying float vAcross;
  varying vec3 vColor;
  varying float vLit;
  varying float vDirected;
  varying float vPhase;
  varying float vLength;

  void main() {
    vec4 a = modelViewMatrix * vec4(aStart, 1.0);
    vec4 b = modelViewMatrix * vec4(aEnd, 1.0);
    vLength = distance(aStart, aEnd);

    // Klipp stråket mot kamerans närplan, annars viks det när en ände
    // hamnar bakom kameran.
    float along = position.x;
    float nearZ = -uNear * 1.5;
    if (a.z > nearZ && b.z < nearZ) {
      float t = (nearZ - a.z) / (b.z - a.z);
      a = mix(a, b, t);
      along = mix(t, 1.0, position.x);
    } else if (b.z > nearZ && a.z < nearZ) {
      float t = (nearZ - a.z) / (b.z - a.z);
      b = mix(a, b, t);
      along = position.x * t;
    }

    vec4 ca = projectionMatrix * a;
    vec4 cb = projectionMatrix * b;
    vec2 sa = ca.xy / ca.w * uResolution * 0.5;
    vec2 sb = cb.xy / cb.w * uResolution * 0.5;
    vec2 dir = sb - sa;
    float len = length(dir);
    dir = len > 0.0001 ? dir / len : vec2(1.0, 0.0);
    vec2 normal = vec2(-dir.y, dir.x);

    vec4 clip = mix(ca, cb, position.x);
    float width = mix(3.0, 7.0, clamp(aLit - 1.0, 0.0, 1.0)); // halva bandets bredd i pixlar
    clip.xy += normal * position.y * width / (uResolution * 0.5) * clip.w;

    // Båda ändarna bakom kameran: rita inte alls.
    if (a.z > nearZ && b.z > nearZ) clip = vec4(2.0, 2.0, 2.0, 1.0);

    gl_Position = clip;
    vAlong = along;
    vAcross = position.y;
    vColor = aColor;
    vLit = aLit;
    vDirected = aDirected;
    vPhase = aPhase;
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uMotion; // 0 = besökaren har valt minskad rörelse

  varying float vAlong;
  varying float vAcross;
  varying vec3 vColor;
  varying float vLit;
  varying float vDirected;
  varying float vPhase;
  varying float vLength;

  void main() {
    float across = vAcross * vAcross;
    float beam = exp(-across * 9.0) * 0.55 + exp(-across * 70.0) * 0.9;

    // Stråket tonar in ur stjärnornas glöd i båda ändar.
    float ends = smoothstep(0.0, 0.07, vAlong) * smoothstep(1.0, 0.93, vAlong);

    // Riktade kopplingar ljusnar mot målet.
    float gradient = mix(1.0, 0.35 + 0.9 * vAlong, vDirected);

    // Vandrande ljus. Avståndet mellan pulserna är detsamma i hela galaxen.
    float pulses = max(1.0, floor(vLength / 46.0 + 0.5));
    float speed = 0.16;
    float u = vDirected > 0.5 ? vAlong : 1.0 - abs(vAlong - 0.5) * 2.0;
    float x = fract(u * (vDirected > 0.5 ? pulses : pulses * 0.5) - uTime * speed + vPhase);
    float comet = pow(x, 9.0);
    float pulse = comet * (vDirected > 0.5 ? 1.6 : 0.9) * uMotion;

    float lit = clamp(vLit, 0.0, 1.0);
    float emphasis = clamp(vLit - 1.0, 0.0, 1.0);
    float base = mix(0.03, 0.22, lit) + emphasis * 0.5;

    vec3 color = vColor * beam * ends * gradient * base;
    color += mix(vColor, vec3(1.0), 0.6) * beam * ends * pulse * mix(0.0, 0.5, lit) * (1.0 + emphasis);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createLinks() {
  const geometry = new THREE.InstancedBufferGeometry();
  // x: 0 = start, 1 = slut. y: -1 och 1 = bandets två kanter.
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), 3),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uMotion: { value: 1 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uNear: { value: 0.1 },
    },
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  mesh.raycast = () => {};

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
      start: make('aStart', 3),
      end: make('aEnd', 3),
      color: make('aColor', 3),
      lit: make('aLit', 1),
      directed: make('aDirected', 1),
      phase: make('aPhase', 1),
    };
  }

  const tmpColor = new THREE.Color();

  return {
    mesh,

    // links: [{ color, directed, phase }]
    setLinks(links) {
      if (links.length > capacity) allocate(links.length);
      geometry.instanceCount = links.length;
      links.forEach((link, i) => {
        tmpColor.set(link.color);
        attrs.color.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
        attrs.directed.setX(i, link.directed ? 1 : 0);
        attrs.phase.setX(i, link.phase);
      });
      if (links.length) {
        attrs.color.needsUpdate = true;
        attrs.directed.needsUpdate = true;
        attrs.phase.needsUpdate = true;
      }
    },

    // links: [{ source: {x,y,z}, target: {x,y,z}, lit }]
    update(links, time, { width, height, near, motion }) {
      material.uniforms.uTime.value = time;
      material.uniforms.uMotion.value = motion ? 1 : 0;
      material.uniforms.uResolution.value.set(width, height);
      material.uniforms.uNear.value = near;
      if (!links.length) return;
      for (let i = 0; i < links.length; i++) {
        const { source, target, lit } = links[i];
        attrs.start.setXYZ(i, source.x || 0, source.y || 0, source.z || 0);
        attrs.end.setXYZ(i, target.x || 0, target.y || 0, target.z || 0);
        attrs.lit.setX(i, lit);
      }
      attrs.start.needsUpdate = true;
      attrs.end.needsUpdate = true;
      attrs.lit.needsUpdate = true;
    },

    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
