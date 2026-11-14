// Datamodellen för galaxen. Samma form som JSON-filen i docs/PLAN.md.
// Alla funktioner här är rena: de tar en galax och ger tillbaka en ny,
// utan att röra webbläsaren. Lagringen ligger i store.js.

import { workKey, normalizeIsbn, normalizeTagName } from './normalize.js';

export const FORMAT_VERSION = 1;

// Den fasta listan av kopplingstyper från planen. Varje typ har en riktning.
export const DEFAULT_RELATION_TYPES = [
  { id: 'samma-stamning', name: 'samma stämning', directed: false, reverseName: null },
  { id: 'nasta-steg', name: 'nästa steg', directed: true, reverseName: 'steget före' },
  { id: 'samma-tema', name: 'samma tema, annan genre', directed: false, reverseName: null },
  { id: 'berattarrost', name: 'om du gillade berättarrösten', directed: false, reverseName: null },
  { id: 'serien', name: 'för den som läser serien', directed: true, reverseName: 'läs före den här' },
];

export function newId() {
  return globalThis.crypto.randomUUID();
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function createEmptyGalaxy() {
  return {
    version: FORMAT_VERSION,
    description: '',
    books: [],
    relationTypes: DEFAULT_RELATION_TYPES.map((t) => ({ ...t })),
    tags: [],
    bookTags: [],
    relations: [],
  };
}

function uniq(list) {
  return [...new Set((list ?? []).filter((v) => v !== null && v !== undefined && v !== ''))];
}

function cleanPosition(p) {
  if (!p || ![p.x, p.y, p.z].every((n) => Number.isFinite(n))) return null;
  return { x: p.x, y: p.y, z: p.z };
}

function cleanBook(b) {
  return {
    id: String(b.id ?? newId()),
    librisIds: uniq(b.librisIds).map(String),
    librisWorkIds: uniq(b.librisWorkIds).map(String),
    isbns: uniq((b.isbns ?? []).map(normalizeIsbn)),
    title: String(b.title ?? '').trim(),
    author: String(b.author ?? '').trim(),
    year: Number.isFinite(Number(b.year)) && b.year !== null && b.year !== '' ? Number(b.year) : null,
    genre: b.genre ? String(b.genre) : null,
    subjects: uniq(b.subjects).map(String),
    cover: b.cover ? String(b.cover) : null,
    position: cleanPosition(b.position),
  };
}

// Tar emot vad som helst som liknar en galaxfil och ger tillbaka en hel och
// giltig galax. Trasiga rader tas bort i stället för att stoppa allt.
// Kastar bara fel om filen inte alls är en galax.
export function normalizeGalaxy(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.books)) {
    throw new Error('Filen ser inte ut som en galaxfil från Bokgalaxen.');
  }
  const books = input.books.filter((b) => b && b.title).map(cleanBook);
  const bookIds = new Set(books.map((b) => b.id));

  const relationTypes = (Array.isArray(input.relationTypes) && input.relationTypes.length
    ? input.relationTypes
    : DEFAULT_RELATION_TYPES
  )
    .filter((t) => t && t.id && t.name)
    .map((t) => ({
      id: String(t.id),
      name: String(t.name),
      directed: Boolean(t.directed),
      reverseName: t.directed && t.reverseName ? String(t.reverseName) : null,
    }));
  const typeIds = new Set(relationTypes.map((t) => t.id));

  const tags = (input.tags ?? [])
    .filter((t) => t && t.id && t.name)
    .map((t) => ({ id: String(t.id), name: String(t.name).trim() }));
  const tagIds = new Set(tags.map((t) => t.id));

  const seenBookTags = new Set();
  const bookTags = (input.bookTags ?? []).filter((bt) => {
    if (!bt || !bookIds.has(bt.book) || !tagIds.has(bt.tag)) return false;
    const key = `${bt.book}|${bt.tag}`;
    if (seenBookTags.has(key)) return false;
    seenBookTags.add(key);
    return true;
  }).map((bt) => ({ book: bt.book, tag: bt.tag }));

  const relations = (input.relations ?? [])
    .filter((r) => r && bookIds.has(r.from) && bookIds.has(r.to) && r.from !== r.to && typeIds.has(r.type))
    .map((r) => ({
      id: String(r.id ?? newId()),
      from: r.from,
      to: r.to,
      type: r.type,
      motivation: String(r.motivation ?? '').trim(),
      signature: String(r.signature ?? '').trim(),
      created: String(r.created ?? today()),
      updated: String(r.updated ?? r.created ?? today()),
    }));

  return {
    version: FORMAT_VERSION,
    description: String(input.description ?? ''),
    books,
    relationTypes,
    tags,
    bookTags,
    relations,
  };
}

// --- Böcker -----------------------------------------------------------

// Letar upp en bok i galaxen som är samma verk som kandidaten:
// samma ISBN, samma Libris-id, samma verk i Libris XL, eller samma titel
// och författare.
export function findSameWork(galaxy, candidate) {
  const isbns = new Set((candidate.isbns ?? []).map(normalizeIsbn));
  const librisIds = new Set(candidate.librisIds ?? []);
  const workIds = new Set(candidate.librisWorkIds ?? []);
  const key = workKey(candidate.title, candidate.author);
  return (
    galaxy.books.find(
      (b) =>
        b.isbns.some((i) => isbns.has(i)) ||
        b.librisIds.some((i) => librisIds.has(i)) ||
        (b.librisWorkIds ?? []).some((i) => workIds.has(i)),
    ) ??
    galaxy.books.find((b) => workKey(b.title, b.author) === key) ??
    null
  );
}

// Lägger ihop en ny utgåvas uppgifter med en befintlig bok. Det som redan
// står i boken vinner, tomma fält fylls på.
export function mergeBookFields(existing, incoming) {
  return {
    ...existing,
    librisIds: uniq([...existing.librisIds, ...(incoming.librisIds ?? [])]),
    librisWorkIds: uniq([...(existing.librisWorkIds ?? []), ...(incoming.librisWorkIds ?? [])]),
    isbns: uniq([...existing.isbns, ...(incoming.isbns ?? []).map(normalizeIsbn)]),
    subjects: uniq([...existing.subjects, ...(incoming.subjects ?? [])]),
    year:
      existing.year && incoming.year ? Math.min(existing.year, incoming.year) : existing.year ?? incoming.year ?? null,
    genre: existing.genre ?? incoming.genre ?? null,
    cover: existing.cover ?? incoming.cover ?? null,
    position: existing.position ?? cleanPosition(incoming.position),
  };
}

// Lägger en bok i galaxen. Finns verket redan används den befintliga
// stjärnan, och den nya utgåvans ISBN och Libris-id läggs till den.
// Svar: { galaxy, book, created }.
export function addBook(galaxy, candidate) {
  const existing = findSameWork(galaxy, candidate);
  if (existing) {
    const merged = mergeBookFields(existing, candidate);
    return {
      galaxy: { ...galaxy, books: galaxy.books.map((b) => (b.id === existing.id ? merged : b)) },
      book: merged,
      created: false,
    };
  }
  const book = cleanBook({ ...candidate, id: newId() });
  return { galaxy: { ...galaxy, books: [...galaxy.books, book] }, book, created: true };
}

export function updateBook(galaxy, bookId, changes) {
  return {
    ...galaxy,
    books: galaxy.books.map((b) => (b.id === bookId ? cleanBook({ ...b, ...changes, id: b.id }) : b)),
  };
}

// Tar bort boken och allt som hänger på den.
export function removeBook(galaxy, bookId) {
  return {
    ...galaxy,
    books: galaxy.books.filter((b) => b.id !== bookId),
    relations: galaxy.relations.filter((r) => r.from !== bookId && r.to !== bookId),
    bookTags: galaxy.bookTags.filter((bt) => bt.book !== bookId),
  };
}

// --- Kopplingar -------------------------------------------------------

export function getRelationType(galaxy, typeId) {
  return galaxy.relationTypes.find((t) => t.id === typeId) ?? null;
}

// Nyckel för att hitta dubbletter: från + till + typ. För typer som gäller
// åt båda håll är A–B och B–A samma koppling.
export function relationKey(galaxy, relation) {
  const type = getRelationType(galaxy, relation.type);
  const pair = type && !type.directed ? [relation.from, relation.to].sort() : [relation.from, relation.to];
  return `${pair[0]}|${pair[1]}|${relation.type}`;
}

export function findRelation(galaxy, from, to, type) {
  const key = relationKey(galaxy, { from, to, type });
  return galaxy.relations.find((r) => relationKey(galaxy, r) === key) ?? null;
}

// Svar: { galaxy, relation, created }. Finns samma koppling redan skapas
// ingen dubblett, den befintliga lämnas tillbaka orörd.
export function addRelation(galaxy, { from, to, type, motivation, signature }) {
  if (from === to) throw new Error('En bok kan inte kopplas till sig själv.');
  const ids = new Set(galaxy.books.map((b) => b.id));
  if (!ids.has(from) || !ids.has(to)) throw new Error('Båda böckerna måste finnas i galaxen.');
  if (!getRelationType(galaxy, type)) throw new Error('Okänd typ av koppling.');
  if (!String(motivation ?? '').trim()) throw new Error('Kopplingen behöver en motivering.');
  if (!String(signature ?? '').trim()) throw new Error('Kopplingen behöver en signatur.');

  const existing = findRelation(galaxy, from, to, type);
  if (existing) return { galaxy, relation: existing, created: false };

  const relation = {
    id: newId(),
    from,
    to,
    type,
    motivation: motivation.trim(),
    signature: signature.trim(),
    created: today(),
    updated: today(),
  };
  return { galaxy: { ...galaxy, relations: [...galaxy.relations, relation] }, relation, created: true };
}

export function updateRelation(galaxy, relationId, changes) {
  const allowed = {};
  for (const key of ['type', 'motivation', 'signature']) {
    if (key in changes) allowed[key] = String(changes[key]).trim();
  }
  return {
    ...galaxy,
    relations: galaxy.relations.map((r) => (r.id === relationId ? { ...r, ...allowed, updated: today() } : r)),
  };
}

export function removeRelation(galaxy, relationId) {
  return { ...galaxy, relations: galaxy.relations.filter((r) => r.id !== relationId) };
}

// Alla kopplingar för en bok, sedda från den boken. Riktade typer får sitt
// omvända namn när boken står i "till"-änden.
export function relationsForBook(galaxy, bookId) {
  const books = new Map(galaxy.books.map((b) => [b.id, b]));
  return galaxy.relations
    .filter((r) => r.from === bookId || r.to === bookId)
    .map((r) => {
      const type = getRelationType(galaxy, r.type);
      const outgoing = r.from === bookId;
      return {
        relation: r,
        other: books.get(outgoing ? r.to : r.from),
        type,
        outgoing,
        label: outgoing || !type.directed ? type.name : type.reverseName ?? type.name,
      };
    });
}

export function degreeMap(galaxy) {
  const degree = new Map(galaxy.books.map((b) => [b.id, 0]));
  for (const r of galaxy.relations) {
    degree.set(r.from, (degree.get(r.from) ?? 0) + 1);
    degree.set(r.to, (degree.get(r.to) ?? 0) + 1);
  }
  return degree;
}

// --- Taggar -----------------------------------------------------------

// Sätter en tagg på en bok. Finns taggen inte skapas den. Taggar med samma
// namn (oavsett stora och små bokstäver) är samma tagg.
export function tagBook(galaxy, bookId, tagName) {
  const name = String(tagName ?? '').trim();
  if (!name) throw new Error('Taggen behöver ett namn.');
  if (!galaxy.books.some((b) => b.id === bookId)) throw new Error('Boken finns inte i galaxen.');
  const key = normalizeTagName(name);
  let tag = galaxy.tags.find((t) => normalizeTagName(t.name) === key);
  let tags = galaxy.tags;
  if (!tag) {
    tag = { id: newId(), name };
    tags = [...tags, tag];
  }
  const has = galaxy.bookTags.some((bt) => bt.book === bookId && bt.tag === tag.id);
  return {
    galaxy: { ...galaxy, tags, bookTags: has ? galaxy.bookTags : [...galaxy.bookTags, { book: bookId, tag: tag.id }] },
    tag,
  };
}

// Tar bort taggen från boken. En tagg som inte sitter på någon bok tas bort helt.
export function untagBook(galaxy, bookId, tagId) {
  const bookTags = galaxy.bookTags.filter((bt) => !(bt.book === bookId && bt.tag === tagId));
  const used = new Set(bookTags.map((bt) => bt.tag));
  return { ...galaxy, bookTags, tags: galaxy.tags.filter((t) => used.has(t.id)) };
}

export function booksWithTag(galaxy, tagId) {
  return new Set(galaxy.bookTags.filter((bt) => bt.tag === tagId).map((bt) => bt.book));
}

export function tagsForBook(galaxy, bookId) {
  const ids = new Set(galaxy.bookTags.filter((bt) => bt.book === bookId).map((bt) => bt.tag));
  return galaxy.tags.filter((t) => ids.has(t.id));
}

// --- Positioner -------------------------------------------------------

// positions: Map eller objekt med bok-id → { x, y, z }.
export function setPositions(galaxy, positions) {
  const get = positions instanceof Map ? (id) => positions.get(id) : (id) => positions[id];
  return {
    ...galaxy,
    books: galaxy.books.map((b) => {
      const p = cleanPosition(get(b.id));
      return p ? { ...b, position: p } : b;
    }),
  };
}
