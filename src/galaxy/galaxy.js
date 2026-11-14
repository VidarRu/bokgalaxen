// Galaxen: stjärnor, ljusstråk, tända taggar, glöd och kameraflygningar.
//
// 3d-force-graph sköter placeringen (kraftlayouten), kameran och klick.
// Det som syns ritas av våra egna lager: stars.js, links.js, backdrop.js
// och labels.js.
//
// Så används den:
//   const galaxy = createGalaxy(element);
//   galaxy.setGalaxy(data);          // data i samma form som galaxfilen
//   galaxy.focusBook(id);            // flyg till en bok och tänd grannarna
//   galaxy.setTag(tagId);            // tänd en tagg, null släcker
//   galaxy.overview();               // visa hela galaxen
//   galaxy.relayout();               // lägg om hela galaxen från början
//   galaxy.on('focus', (id) => …);   // id eller null
//   galaxy.on('hover', (id) => …);
//   galaxy.on('settled', (positions) => …);  // Map bok-id → { x, y, z }

import ForceGraph3D from '3d-force-graph';
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import { getGenre } from '../data/genres.js';
import { degreeMap, getRelationType } from '../data/model.js';
import { relationColor, starRadius, SPACE_COLOR } from './theme.js';
import { createStars } from './stars.js';
import { createLinks } from './links.js';
import { createBackdrop } from './backdrop.js';
import { createLabels } from './labels.js';

const FLIGHT_MS = 1900;
const IDLE_BEFORE_DRIFT_MS = 14000;

// Ett tal mellan 0 och 1 som alltid blir detsamma för samma id.
function hash01(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

export function createGalaxy(container, { reducedMotion } = {}) {
  const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let motion = reducedMotion === undefined ? !motionQuery?.matches : !reducedMotion;
  if (reducedMotion === undefined) {
    motionQuery?.addEventListener?.('change', (e) => {
      motion = !e.matches;
      controls.autoRotate = false;
    });
  }

  const listeners = { focus: new Set(), hover: new Set(), settled: new Set() };
  const emit = (name, value) => listeners[name].forEach((fn) => fn(value));

  // --- 3d-force-graph ---------------------------------------------------

  const graph = new ForceGraph3D(container, {
    controlType: 'orbit',
    rendererConfig: { antialias: true, powerPreference: 'high-performance' },
  })
    .backgroundColor(SPACE_COLOR)
    .showNavInfo(false)
    .enableNodeDrag(false)
    .linkVisibility(false)
    .nodeLabel(() => '')
    .width(container.clientWidth)
    .height(container.clientHeight);

  // Osynliga klot som fångar muspekare och klick. Själva stjärnan ritas i stars.js.
  const pickGeometry = new THREE.SphereGeometry(1, 10, 8);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });
  graph.nodeThreeObject((node) => {
    const mesh = new THREE.Mesh(pickGeometry, pickMaterial);
    mesh.scale.setScalar(Math.max(node.radius * 2.4, 6));
    return mesh;
  });

  // Krafter. Kopplade böcker dras ihop, alla stöter bort varandra lite, och
  // en svag dragning mot mitten håller ihop galaxen och plattar till den
  // till en skiva. Utan den skulle böcker utan kopplingar driva iväg.
  graph.d3Force('charge').strength(-85).distanceMax(600);
  graph.d3Force('link').distance(34);
  let gravityNodes = [];
  const gravity = (alpha) => {
    for (const n of gravityNodes) {
      n.vx -= n.x * 0.03 * alpha;
      n.vy -= n.y * 0.085 * alpha;
      n.vz -= n.z * 0.03 * alpha;
    }
  };
  gravity.initialize = (nodes) => {
    gravityNodes = nodes;
  };
  graph.d3Force('gravity', gravity);

  const scene = graph.scene();
  const camera = graph.camera();
  const renderer = graph.renderer();
  const controls = graph.controls();
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.9;
  controls.minDistance = 30;
  controls.maxDistance = 6000;
  controls.autoRotateSpeed = 0.22;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  // Glöd. Allt ljust i bilden blöder ut lite, som i ett foto av natthimlen.
  const bloom = new UnrealBloomPass(new THREE.Vector2(container.clientWidth, container.clientHeight), 0.72, 0.65, 0.18);
  graph.postProcessingComposer().addPass(bloom);

  // --- Våra lager -------------------------------------------------------

  const backdrop = createBackdrop();
  const stars = createStars();
  const links = createLinks();
  const labels = createLabels(container);
  scene.add(backdrop.group, links.mesh, stars.mesh);

  // --- Tillstånd --------------------------------------------------------

  let nodes = [];
  let edges = [];
  const nodeById = new Map();
  let neighbours = new Map(); // bok-id → Set med grannarnas id
  let tagMembers = new Map(); // tagg-id → Set med bok-id
  let focusId = null;
  let hoverId = null;
  let tagId = null;
  let lastInteraction = performance.now();
  let flightUntil = 0;
  let introPending = false;
  let disposed = false;

  // Plats som kort och paneler tar av bilden. Galaxens mitt flyttas så att
  // boken i centrum hamnar i den fria ytan.
  const inset = { right: 0, bottom: 0, targetRight: 0, targetBottom: 0 };
  function setInset({ right = 0, bottom = 0 } = {}) {
    inset.targetRight = right;
    inset.targetBottom = bottom;
  }

  function applyTargets() {
    const tagged = tagId ? tagMembers.get(tagId) ?? new Set() : null;
    const near = focusId ? neighbours.get(focusId) ?? new Set() : null;
    for (const n of nodes) {
      n.targetFocus = n.id === focusId ? 1 : 0;
      n.targetRing = tagged?.has(n.id) ? 1 : 0;
      if (focusId) n.targetLit = n.id === focusId || near.has(n.id) ? 1 : 0;
      else if (tagged) n.targetLit = tagged.has(n.id) ? 1 : 0;
      else n.targetLit = 1;
      if (n.id === hoverId) n.targetLit = Math.max(n.targetLit, 0.9);
      n.priority = n.id === focusId ? 3 : n.id === hoverId ? 2 : (focusId && near.has(n.id)) || (tagged && tagged.has(n.id)) ? 1 : 0;
    }
    for (const e of edges) {
      const a = e.fromId;
      const b = e.toId;
      if (focusId) e.targetLit = a === focusId || b === focusId ? 2 : 0;
      else if (tagged) e.targetLit = tagged.has(a) && tagged.has(b) ? 1.4 : 0;
      else e.targetLit = 1;
      if (hoverId && (a === hoverId || b === hoverId)) e.targetLit = Math.max(e.targetLit, 2);
    }
  }

  // --- Innehåll ---------------------------------------------------------

  function setGalaxy(data, { relayout = false } = {}) {
    const degrees = degreeMap(data);
    const hadNodes = nodes.length > 0 && !relayout;
    const nextNodes = [];
    let freeCount = 0;

    neighbours = new Map(data.books.map((b) => [b.id, new Set()]));
    for (const r of data.relations) {
      neighbours.get(r.from)?.add(r.to);
      neighbours.get(r.to)?.add(r.from);
    }
    tagMembers = new Map(data.tags.map((t) => [t.id, new Set()]));
    for (const bt of data.bookTags) tagMembers.get(bt.tag)?.add(bt.book);

    for (const book of data.books) {
      let node = nodeById.get(book.id);
      const isNew = !node;
      if (isNew) node = { id: book.id, lit: 0, ring: 0, focus: 0, targetLit: 1, targetRing: 0, targetFocus: 0, priority: 0 };
      node.title = book.title;
      node.author = book.author;
      node.color = getGenre(book.genre).color;
      node.degree = degrees.get(book.id) ?? 0;
      node.radius = starRadius(node.degree);
      node.phase = hash01(book.id);

      if (relayout) {
        delete node.fx;
        delete node.fy;
        delete node.fz;
        freeCount++;
      } else if (isNew && book.position) {
        // Sparad position: stjärnan hamnar där den låg förra gången.
        Object.assign(node, book.position);
        node.fx = book.position.x;
        node.fy = book.position.y;
        node.fz = book.position.z;
      } else if (isNew) {
        freeCount++;
        if (hadNodes) {
          // En ny bok i en galax som redan ligger: börja nära grannarna.
          const near = [...(neighbours.get(book.id) ?? [])].map((id) => nodeById.get(id)).filter((n) => n && Number.isFinite(n.x));
          const base = near.length
            ? near.reduce((s, n) => ({ x: s.x + n.x / near.length, y: s.y + n.y / near.length, z: s.z + n.z / near.length }), { x: 0, y: 0, z: 0 })
            : { x: (node.phase - 0.5) * 300, y: 0, z: (hash01(book.id + 'z') - 0.5) * 300 };
          node.x = base.x + (hash01(book.id + 'a') - 0.5) * 30;
          node.y = base.y + (hash01(book.id + 'b') - 0.5) * 30;
          node.z = base.z + (hash01(book.id + 'c') - 0.5) * 30;
        }
      }
      nextNodes.push(node);
    }

    // När nya böcker läggs till ligger resten av galaxen still.
    if (hadNodes && freeCount > 0) {
      for (const node of nextNodes) {
        if (nodeById.has(node.id) && Number.isFinite(node.x)) {
          node.fx = node.x;
          node.fy = node.y;
          node.fz = node.z;
        }
      }
    }

    nodeById.clear();
    for (const node of nextNodes) nodeById.set(node.id, node);
    nodes = nextNodes;

    edges = data.relations
      .filter((r) => nodeById.has(r.from) && nodeById.has(r.to))
      .map((r) => ({
        id: r.id,
        source: r.from,
        target: r.to,
        fromId: r.from,
        toId: r.to,
        color: relationColor(r.type),
        directed: Boolean(getRelationType(data, r.type)?.directed),
        phase: hash01(r.id),
        lit: 0,
        targetLit: 1,
      }));

    if (focusId && !nodeById.has(focusId)) focusId = null;
    if (tagId && !tagMembers.has(tagId)) tagId = null;

    stars.setNodes(nodes);
    links.setLinks(edges);
    labels.clear();
    applyTargets();

    const fresh = freeCount === nodes.length; // hela galaxen läggs från början
    if (freeCount === 0) graph.warmupTicks(0).cooldownTicks(0);
    else if (!motion) graph.warmupTicks(fresh ? 320 : 120).cooldownTicks(0);
    else if (fresh) graph.warmupTicks(70).cooldownTicks(260);
    else graph.warmupTicks(0).cooldownTicks(140);
    graph.cooldownTime(20000);

    graph.graphData({ nodes, links: edges });

    if (!hadNodes && nodes.length) introPending = true;
  }

  graph.onEngineStop(() => {
    const positions = new Map();
    for (const n of nodes) {
      if (Number.isFinite(n.x)) positions.set(n.id, { x: Math.round(n.x * 100) / 100, y: Math.round(n.y * 100) / 100, z: Math.round(n.z * 100) / 100 });
    }
    emit('settled', positions);
  });

  // --- Kamera -----------------------------------------------------------

  function fly(position, lookAt, ms = FLIGHT_MS) {
    const duration = motion ? ms : 0;
    controls.autoRotate = false;
    flightUntil = performance.now() + duration + 200;
    graph.cameraPosition(position, lookAt, duration);
  }

  function bounds() {
    const center = new THREE.Vector3();
    let count = 0;
    for (const n of nodes) {
      if (!Number.isFinite(n.x)) continue;
      center.add(new THREE.Vector3(n.x, n.y, n.z));
      count++;
    }
    if (!count) return { center, radius: 120 };
    center.divideScalar(count);
    let radius = 60;
    for (const n of nodes) {
      if (Number.isFinite(n.x)) radius = Math.max(radius, center.distanceTo(new THREE.Vector3(n.x, n.y, n.z)));
    }
    return { center, radius };
  }

  function overviewPosition(scale = 1) {
    const { center, radius } = bounds();
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const aspect = container.clientWidth / Math.max(1, container.clientHeight);
    const fit = radius / Math.sin(Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * aspect)) / 2);
    const direction = new THREE.Vector3(0.28, 0.5, 1).normalize();
    return { position: center.clone().addScaledVector(direction, fit * 0.82 * scale), lookAt: center };
  }

  function overview(ms = FLIGHT_MS) {
    const { position, lookAt } = overviewPosition();
    fly(position, lookAt, ms);
  }

  function flyToNode(node) {
    const target = new THREE.Vector3(node.x, node.y, node.z);
    let reach = 34;
    for (const id of neighbours.get(node.id) ?? []) {
      const n = nodeById.get(id);
      if (n && Number.isFinite(n.x)) reach = Math.max(reach, target.distanceTo(new THREE.Vector3(n.x, n.y, n.z)));
    }
    // På smala skärmar, eller när ett kort täcker en del av bilden, behöver
    // kameran backa för att grannarna ska få plats.
    const freeWidth = Math.max(120, container.clientWidth - inset.targetRight);
    const freeHeight = Math.max(120, container.clientHeight - inset.targetBottom);
    const narrow = Math.max(1, freeHeight / freeWidth) * THREE.MathUtils.clamp(700 / Math.min(freeWidth, freeHeight), 1, 2.2);
    const distance = THREE.MathUtils.clamp((reach * 2.1 + 60) * narrow, 120, 1400);
    const direction = camera.position.clone().sub(target);
    if (direction.lengthSq() < 1) direction.set(0, 0.3, 1);
    direction.normalize();
    fly(target.clone().addScaledVector(direction, distance), target);
  }

  // --- Fokus, tagg och muspekare ----------------------------------------

  function focusBook(id, { fly: shouldFly = true } = {}) {
    const node = id ? nodeById.get(id) : null;
    if (!node) return clearFocus();
    const changed = focusId !== node.id;
    focusId = node.id;
    applyTargets();
    if (changed) emit('focus', focusId); // först, så att sidan hinner säga hur stort kortet är
    if (shouldFly && Number.isFinite(node.x)) flyToNode(node);
  }

  function clearFocus() {
    if (!focusId) return;
    focusId = null;
    applyTargets();
    emit('focus', null);
  }

  function setTag(id) {
    tagId = id && tagMembers.has(id) ? id : null;
    applyTargets();
  }

  graph.onNodeClick((node) => focusBook(node.id));
  graph.onBackgroundClick(() => clearFocus());
  graph.onNodeHover((node) => {
    hoverId = node?.id ?? null;
    applyTargets();
    emit('hover', hoverId);
  });

  const noteInteraction = () => {
    lastInteraction = performance.now();
    controls.autoRotate = false;
  };
  for (const type of ['pointerdown', 'wheel', 'keydown', 'touchstart']) {
    container.addEventListener(type, noteInteraction, { passive: true });
  }

  const resizeObserver = new ResizeObserver(() => {
    graph.width(container.clientWidth).height(container.clientHeight);
  });
  resizeObserver.observe(container);

  // --- Varje bildruta ---------------------------------------------------

  let lastFrame = performance.now();
  let time = 0;

  function frame() {
    if (disposed) return;
    requestAnimationFrame(frame);
    const now = performance.now();
    const delta = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;
    if (motion) time += delta;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;

    // Första gången galaxen visas: börja långt bort och flyg in.
    if (introPending && nodes.some((n) => Number.isFinite(n.x))) {
      introPending = false;
      const far = overviewPosition(2.6);
      graph.cameraPosition(far.position, far.lookAt, 0);
      overview(3200);
    }

    // Mjuka övergångar mellan tänt och dämpat.
    const ease = motion ? 1 - Math.pow(0.0015, delta) : 1;
    for (const n of nodes) {
      n.lit += (n.targetLit - n.lit) * ease;
      n.ring += (n.targetRing - n.ring) * ease;
      n.focus += (n.targetFocus - n.focus) * ease;
      n.__threeObj?.position.set(n.x || 0, n.y || 0, n.z || 0);
    }
    const drawable = [];
    for (const e of edges) {
      e.lit += (e.targetLit - e.lit) * ease;
      if (typeof e.source === 'object' && typeof e.target === 'object') drawable.push(e);
    }

    // Lugn drift runt galaxen när ingen rör den.
    if (motion && now > flightUntil && now - lastInteraction > IDLE_BEFORE_DRIFT_MS) controls.autoRotate = true;

    inset.right += (inset.targetRight - inset.right) * ease;
    inset.bottom += (inset.targetBottom - inset.bottom) * ease;
    if (inset.right > 0.5 || inset.bottom > 0.5) camera.setViewOffset(width, height, inset.right / 2, inset.bottom / 2, width, height);
    else if (camera.view?.enabled) camera.clearViewOffset();

    const pixelsPerUnit = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    const pixelRatio = renderer.getPixelRatio();
    backdrop.update(camera, time, pixelRatio);
    stars.update(nodes, time, pixelsPerUnit);
    if (drawable.length !== edges.length) links.mesh.visible = false;
    else {
      links.mesh.visible = true;
      links.update(drawable, time, { width, height, near: camera.near, motion });
    }
    labels.update(nodes, camera, width, height, pixelsPerUnit);
  }
  requestAnimationFrame(frame);

  return {
    setGalaxy,
    focusBook,
    clearFocus,
    setTag,
    setInset,
    overview,
    relayout(data) {
      nodeById.clear();
      nodes = [];
      setGalaxy(data, { relayout: true });
      introPending = false;
      setTimeout(() => overview(), motion ? 1500 : 0);
    },
    get focusId() {
      return focusId;
    },
    get tagId() {
      return tagId;
    },
    on(name, fn) {
      listeners[name].add(fn);
      return () => listeners[name].delete(fn);
    },
    // För tester och felsökning.
    debug: () => ({ nodes, edges, graph, camera, bloom }),
    dispose() {
      disposed = true;
      resizeObserver.disconnect();
      labels.dispose();
      stars.dispose();
      links.dispose();
      backdrop.dispose();
      graph._destructor();
    },
  };
}
