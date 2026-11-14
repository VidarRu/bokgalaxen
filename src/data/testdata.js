// Testgalax med platshållare.
//
// Används bara för att utveckla och prestandatesta galaxen medan den riktiga
// startfilen är tom. Här finns inga riktiga böcker, inga riktiga boktips och
// inga påhittade motiveringar som ser ut att komma från en bibliotekarie.
// Testgalaxen sparas aldrig och ska aldrig läggas i startfilen: allt innehåll
// i den riktiga galaxen kommer från människor.

import { DEFAULT_RELATION_TYPES } from './model.js';
import { GENRES } from './genres.js';

// Liten slumpgenerator med frö, så att testgalaxen blir likadan varje gång.
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

export const TEST_SIGNATURE = 'Testdata';
export const TEST_MOTIVATION = 'Platshållare. Här kommer en bibliotekaries motivering att stå.';

export function createTestGalaxy(bookCount = 160, seed = 7) {
  const rand = mulberry32(seed);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const id = (prefix, n) => `test-${prefix}-${String(n).padStart(4, '0')}`;

  const clusterCount = Math.max(3, Math.round(bookCount / 22));
  const clusters = Array.from({ length: clusterCount }, (_, i) => ({
    genre: GENRES[i % GENRES.length].id,
    members: [],
  }));

  const books = [];
  for (let i = 0; i < bookCount; i++) {
    // Var tolfte bok står utan kopplingar, som i en riktig galax under uppbyggnad.
    const lonely = i > 10 && rand() < 0.08;
    const cluster = clusters[Math.floor(rand() * rand() * clusterCount)];
    const book = {
      id: id('bok', i + 1),
      librisIds: [],
      librisWorkIds: [],
      isbns: [],
      title: `Testbok ${i + 1}`,
      author: 'Platshållare',
      year: 1950 + Math.floor(rand() * 76),
      genre: rand() < 0.8 ? cluster.genre : pick(GENRES).id,
      subjects: [],
      cover: null,
      position: null,
    };
    books.push(book);
    if (!lonely) cluster.members.push(book.id);
  }

  const relations = [];
  const seen = new Set();
  const degree = new Map();
  function connect(a, b) {
    if (!a || !b || a === b) return;
    const type = pick(DEFAULT_RELATION_TYPES);
    const key = [a, b].sort().join('|');
    if (seen.has(key)) return;
    seen.add(key);
    degree.set(a, (degree.get(a) ?? 0) + 1);
    degree.set(b, (degree.get(b) ?? 0) + 1);
    relations.push({
      id: id('koppling', relations.length + 1),
      from: a,
      to: b,
      type: type.id,
      motivation: TEST_MOTIVATION,
      signature: TEST_SIGNATURE,
      created: '2026-11-14',
      updated: '2026-11-14',
    });
  }
  // Böcker som redan har många kopplingar får lättare fler, så att några
  // stjärnor blir stora.
  function pickPopular(members) {
    let best = pick(members);
    for (let i = 0; i < 2; i++) {
      const other = pick(members);
      if ((degree.get(other) ?? 0) > (degree.get(best) ?? 0)) best = other;
    }
    return best;
  }

  for (const cluster of clusters) {
    const m = cluster.members;
    for (let i = 1; i < m.length; i++) connect(m[i], pickPopular(m.slice(0, i)));
    const extra = Math.round(m.length * 0.45);
    for (let i = 0; i < extra; i++) connect(pick(m), pickPopular(m));
  }
  // Några få broar mellan klustren.
  const filled = clusters.filter((c) => c.members.length);
  for (let i = 0; i < filled.length; i++) {
    const next = filled[(i + 1) % filled.length];
    connect(pick(filled[i].members), pick(next.members));
    if (rand() < 0.5) connect(pickPopular(filled[i].members), pick(pick(filled).members));
  }

  const tags = Array.from({ length: 6 }, (_, i) => ({ id: id('tagg', i + 1), name: `Testtagg ${i + 1}` }));
  const bookTags = [];
  for (const tag of tags) {
    const count = 6 + Math.floor(rand() * Math.max(4, bookCount / 12));
    const chosen = new Set();
    for (let i = 0; i < count; i++) chosen.add(pick(books).id);
    for (const book of chosen) bookTags.push({ book, tag: tag.id });
  }

  return {
    version: 1,
    description: 'Testgalax med platshållare. Inga riktiga böcker eller boktips.',
    books,
    relationTypes: DEFAULT_RELATION_TYPES.map((t) => ({ ...t })),
    tags,
    bookTags,
    relations,
  };
}
