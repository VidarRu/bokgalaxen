// Demogalax: den riktiga galaxen plus slumpade kopplingar.
//
// Används bara för att visa hur galaxen kan se ut när många bibliotekarier
// har kopplat ihop böckerna (adressen ?demo). Böckerna och de riktiga
// kopplingarna är de riktiga. De slumpade kopplingarna har signaturen
// "Demo (slumpad)" och en motivering som säger att de är påhittade.
// Demogalaxen sparas aldrig, varken i webbläsaren eller på servern, och ska
// aldrig läggas i startfilen: allt innehåll i den riktiga galaxen kommer
// från människor.

import { degreeMap } from './model.js';

export const DEMO_SIGNATURE = 'Demo (slumpad)';
export const DEMO_MOTIVATION =
  'Slumpad koppling som visar hur galaxen kan se ut. Ingen bibliotekarie har gjort den, och den sparas inte.';

// Typerna som slumpas. "För den som läser serien" slumpas inte, eftersom den
// påstår något som går att kontrollera.
const SAME_GENRE_TYPES = ['samma-stamning', 'berattarrost', 'nasta-steg'];
const OTHER_GENRE_TYPE = 'samma-tema';

// Liten slumpgenerator med frö, så att demogalaxen blir likadan varje gång.
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

// extra: hur många slumpade kopplingar utöver de som behövs, räknat per bok.
export function createDemoGalaxy(real, { seed = 11, extra = 0.6 } = {}) {
  const rand = mulberry32(seed);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const books = real.books;
  if (books.length < 2) return real;

  const typeIds = new Set(real.relationTypes.map((t) => t.id));
  const sameTypes = SAME_GENRE_TYPES.filter((t) => typeIds.has(t));
  const otherType = typeIds.has(OTHER_GENRE_TYPE) ? OTHER_GENRE_TYPE : sameTypes[0];

  const byGenre = new Map();
  for (const book of books) {
    const genre = book.genre ?? 'okand';
    if (!byGenre.has(genre)) byGenre.set(genre, []);
    byGenre.get(genre).push(book);
  }

  const degree = degreeMap(real);
  const seen = new Set(real.relations.map((r) => [r.from, r.to].sort().join('|')));
  const relations = [];

  function connect(a, b) {
    if (!a || !b || a.id === b.id) return false;
    const key = [a.id, b.id].sort().join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    degree.set(a.id, (degree.get(a.id) ?? 0) + 1);
    degree.set(b.id, (degree.get(b.id) ?? 0) + 1);
    const sameGenre = (a.genre ?? 'okand') === (b.genre ?? 'okand');
    relations.push({
      id: `demo-koppling-${String(relations.length + 1).padStart(4, '0')}`,
      from: a.id,
      to: b.id,
      type: sameGenre ? pick(sameTypes) : otherType,
      motivation: DEMO_MOTIVATION,
      signature: DEMO_SIGNATURE,
      owner: null,
      created: '2026-11-19',
      updated: '2026-11-19',
    });
    return true;
  }

  // Böcker med många kopplingar får lättare fler, så att några stjärnor
  // blir stora, som i en riktig galax.
  function pickPopular(list) {
    let best = pick(list);
    for (let i = 0; i < 2; i++) {
      const other = pick(list);
      if ((degree.get(other.id) ?? 0) > (degree.get(best.id) ?? 0)) best = other;
    }
    return best;
  }

  // Oftast en bok i samma genre, ibland en i en annan.
  function partnerFor(book) {
    const same = byGenre.get(book.genre ?? 'okand');
    const list = same.length > 1 && rand() < 0.82 ? same : books;
    for (let i = 0; i < 8; i++) {
      const other = pickPopular(list);
      if (other.id !== book.id && !seen.has([book.id, other.id].sort().join('|'))) return other;
    }
    return null;
  }

  // 1. Varje bok utan kopplingar får minst en.
  const lonely = books.filter((b) => !degree.get(b.id));
  for (let i = lonely.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [lonely[i], lonely[j]] = [lonely[j], lonely[i]];
  }
  for (const book of lonely) {
    if (degree.get(book.id)) continue; // fick redan en koppling från en annan bok
    let partner = partnerFor(book);
    while (!partner || !connect(book, partner)) partner = pick(books);
  }

  // 2. Fler kopplingar, så att galaxen ser ut som när många har byggt i den.
  const target = Math.round(books.length * extra);
  for (let tries = 0, added = 0; added < target && tries < target * 5; tries++) {
    const book = pick(books);
    if (connect(book, partnerFor(book))) added++;
  }

  return {
    ...real,
    description: 'Demo med slumpade kopplingar. Böckerna är riktiga, kopplingarna med signaturen "Demo (slumpad)" är det inte.',
    // Platserna räknas om, eftersom kopplingarna är andra än i den riktiga galaxen.
    books: books.map((b) => ({ ...b, position: null })),
    relations: [...real.relations, ...relations],
  };
}
