// Boktitlar som svävar vid stjärnorna. De ritas som vanlig text ovanpå
// galaxen, så att de är skarpa i alla storlekar. Bara de viktigaste
// stjärnorna får en titel, och titlar som skulle krocka hoppas över.

import * as THREE from 'three';

const MAX_LABELS = 26;
const MAX_QUIET_LABELS = 12; // titlar som visas utan att något är valt

export function createLabels(container) {
  const layer = document.createElement('div');
  layer.className = 'star-labels';
  layer.setAttribute('aria-hidden', 'true'); // samma innehåll finns i kort och listvy
  container.append(layer);

  const pool = [];
  const byNode = new Map();
  const projected = new THREE.Vector3();

  function acquire(node) {
    let el = byNode.get(node.id);
    if (el) return el;
    el = pool.pop() ?? document.createElement('div');
    el.className = 'star-label';
    el.innerHTML = '';
    const title = document.createElement('span');
    title.className = 'star-label__title';
    title.textContent = node.title;
    el.append(title);
    if (node.author) {
      const author = document.createElement('span');
      author.className = 'star-label__author';
      author.textContent = node.author;
      el.append(author);
    }
    el.style.opacity = '0';
    layer.append(el);
    byNode.set(node.id, el);
    return el;
  }

  function release(id) {
    const el = byNode.get(id);
    if (!el) return;
    byNode.delete(id);
    el.style.opacity = '0';
    setTimeout(() => {
      if (el.parentNode && ![...byNode.values()].includes(el)) {
        el.remove();
        pool.push(el);
      }
    }, 260);
  }

  let chosen = [];
  let frame = 0;

  return {
    // nodes: [{ id, title, author, x, y, z, radius, lit, priority }]
    // priority: 3 = i centrum, 2 = under muspekaren, 1 = granne eller tänd, 0 = övriga
    update(nodes, camera, width, height, pixelsPerUnit) {
      frame++;
      const candidates = [];
      for (const node of nodes) {
        projected.set(node.x || 0, node.y || 0, node.z || 0).project(camera);
        if (projected.z > 1 || projected.z < -1) continue;
        const sx = (projected.x * 0.5 + 0.5) * width;
        const sy = (-projected.y * 0.5 + 0.5) * height;
        if (sx < -40 || sx > width + 40 || sy < -20 || sy > height + 20) continue;
        const dist = camera.position.distanceTo(projected.set(node.x || 0, node.y || 0, node.z || 0));
        const pixelRadius = (node.radius * pixelsPerUnit) / Math.max(dist, 1);
        if (node.priority === 0 && (node.lit < 0.5 || pixelRadius < 3.4)) continue;
        candidates.push({ node, sx, sy, pixelRadius, score: node.priority * 1000 + pixelRadius });
      }

      // Urvalet görs om några gånger i sekunden, positionerna varje bildruta.
      if (frame % 8 === 1 || !chosen.length) {
        candidates.sort((a, b) => b.score - a.score);
        const boxes = [];
        const next = [];
        for (const c of candidates) {
          if (next.length >= MAX_LABELS) break;
          if (c.node.priority === 0 && next.length >= MAX_QUIET_LABELS) break;
          const big = c.node.priority >= 2;
          const w = Math.min(240, (c.node.title.length * (big ? 8.6 : 7.2)) + 16);
          const h = big && c.node.author ? 42 : 22;
          const box = { x: c.sx - w / 2, y: c.sy + c.pixelRadius * 1.6 + 6, w, h };
          const collides = boxes.some(
            (o) => box.x < o.x + o.w && box.x + box.w > o.x && box.y < o.y + o.h && box.y + box.h > o.y,
          );
          if (collides && c.node.priority < 2) continue;
          boxes.push(box);
          next.push(c.node.id);
        }
        const nextSet = new Set(next);
        for (const id of [...byNode.keys()]) if (!nextSet.has(id)) release(id);
        chosen = next;
      }

      const visible = new Map(candidates.map((c) => [c.node.id, c]));
      for (const id of chosen) {
        const c = visible.get(id);
        if (!c) {
          release(id);
          continue;
        }
        const el = acquire(c.node);
        el.classList.toggle('star-label--focus', c.node.priority === 3);
        el.classList.toggle('star-label--strong', c.node.priority >= 1);
        el.style.transform = `translate(-50%, 0) translate(${c.sx.toFixed(1)}px, ${(c.sy + c.pixelRadius * 1.6 + 6).toFixed(1)}px)`;
        el.style.opacity = c.node.priority >= 1 ? '1' : String(Math.min(0.9, 0.6 + c.pixelRadius / 20));
      }
    },

    clear() {
      for (const id of [...byNode.keys()]) release(id);
      chosen = [];
    },

    dispose() {
      layer.remove();
    },
  };
}
