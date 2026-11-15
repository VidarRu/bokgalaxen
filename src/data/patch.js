// Ändringspaket. När galaxen delas av flera redaktörer skickar webbläsaren
// inte hela galaxen till servern, bara det som har ändrats: böcker,
// kopplingar och taggar som är nya, ändrade eller borttagna.
//
//   diffGalaxies(före, efter)          → ändringspaket
//   authorizePatch(galax, paket, user) → paketet, om användaren får göra det
//   applyPatch(galax, paket)           → ny galax
//
// Samma kod körs i webbläsaren och på servern. Servern bestämmer.

import { normalizeGalaxy, setPositions } from './model.js';

const KINDS = ['books', 'relations', 'tags', 'relationTypes'];
const MOTIVATION_MAX = 400;
const SIGNATURE_MAX = 80;

export class NotAllowed extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotAllowed';
  }
}

function withoutPosition(book) {
  const { position, ...rest } = book;
  return rest;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const bookTagKey = (bt) => `${bt.book}|${bt.tag}`;

// Positioner räknas inte som ändringar. De sparas för sig (applyPositions).
export function diffGalaxies(before, after) {
  const patch = {};
  for (const kind of KINDS) {
    const strip = kind === 'books' ? withoutPosition : (x) => x;
    const old = new Map((before[kind] ?? []).map((x) => [x.id, x]));
    const now = new Map((after[kind] ?? []).map((x) => [x.id, x]));
    const put = [...now.values()].filter((x) => !old.has(x.id) || !same(strip(old.get(x.id)), strip(x)));
    const del = [...old.keys()].filter((id) => !now.has(id));
    if (put.length || del.length) patch[kind] = { put, del };
  }
  const oldTags = new Set((before.bookTags ?? []).map(bookTagKey));
  const newTags = new Set((after.bookTags ?? []).map(bookTagKey));
  const add = (after.bookTags ?? []).filter((bt) => !oldTags.has(bookTagKey(bt)));
  const del = (before.bookTags ?? []).filter((bt) => !newTags.has(bookTagKey(bt)));
  if (add.length || del.length) patch.bookTags = { add, del };
  if ((before.description ?? '') !== (after.description ?? '')) patch.description = after.description ?? '';
  return patch;
}

export function isEmptyPatch(patch) {
  return !patch || Object.keys(patch).length === 0;
}

export function applyPatch(galaxy, patch) {
  const result = { ...galaxy };
  for (const kind of KINDS) {
    const change = patch[kind];
    if (!change) continue;
    const map = new Map((galaxy[kind] ?? []).map((x) => [x.id, x]));
    for (const id of change.del ?? []) map.delete(id);
    for (const item of change.put ?? []) {
      const existing = map.get(item.id);
      // En ändrad bok behåller sin plats i galaxen.
      map.set(item.id, kind === 'books' && existing ? { ...item, position: existing.position ?? item.position ?? null } : item);
    }
    result[kind] = [...map.values()];
  }
  if (patch.bookTags) {
    const removed = new Set((patch.bookTags.del ?? []).map(bookTagKey));
    const kept = (galaxy.bookTags ?? []).filter((bt) => !removed.has(bookTagKey(bt)));
    result.bookTags = [...kept, ...(patch.bookTags.add ?? [])];
  }
  if ('description' in patch) result.description = String(patch.description ?? '');
  return normalizeGalaxy(result);
}

// Kontrollerar att användaren får göra ändringen och fyller i ägare.
// user: { id, isAdmin } eller null. Kastar NotAllowed med ett svenskt
// meddelande. Svar: ett tvättat paket som går att lägga på galaxen.
export function authorizePatch(galaxy, patch, user) {
  if (!user) throw new NotAllowed('Logga in för att ändra i galaxen.');
  const deny = (message) => {
    throw new NotAllowed(message);
  };
  const p = structuredClone(patch ?? {});
  const admin = Boolean(user.isAdmin);
  const books = new Map(galaxy.books.map((b) => [b.id, b]));
  const relations = new Map(galaxy.relations.map((r) => [r.id, r]));
  const tags = new Map(galaxy.tags.map((t) => [t.id, t]));

  for (const b of p.books?.put ?? []) {
    const old = books.get(b.id);
    if (!old) {
      b.addedBy = admin ? b.addedBy ?? user.id : user.id;
      continue;
    }
    b.addedBy = old.addedBy ?? null;
    if (admin) continue;
    if (b.title !== old.title || b.author !== old.author) deny('Titel och författare kommer från Libris och kan inte ändras.');
    if ((b.genre ?? null) !== (old.genre ?? null) && old.addedBy !== user.id) {
      deny('Bara den som lade till boken, eller administratören, kan byta genre.');
    }
  }
  for (const id of p.books?.del ?? []) {
    if (admin) continue;
    const old = books.get(id);
    if (!old) continue;
    if (old.addedBy !== user.id) deny('Bara administratören kan ta bort en bok som någon annan har lagt till.');
    if (galaxy.relations.some((r) => (r.from === id || r.to === id) && r.owner !== user.id)) {
      deny('Boken har boktips från andra redaktörer. Bara administratören kan ta bort den.');
    }
  }

  for (const r of p.relations?.put ?? []) {
    const old = relations.get(r.id);
    if (old) {
      if (!admin && old.owner !== user.id) deny('Du kan bara ändra dina egna boktips.');
      r.owner = old.owner;
    } else {
      r.owner = admin ? r.owner ?? user.id : user.id;
    }
    const motivation = String(r.motivation ?? '').trim();
    const signature = String(r.signature ?? '').trim();
    if (!motivation || !signature) deny('Ett boktips behöver en motivering och en signatur.');
    if (motivation.length > MOTIVATION_MAX) deny(`Motiveringen får vara högst ${MOTIVATION_MAX} tecken.`);
    if (signature.length > SIGNATURE_MAX) deny(`Signaturen får vara högst ${SIGNATURE_MAX} tecken.`);
  }
  for (const id of p.relations?.del ?? []) {
    const old = relations.get(id);
    if (old && !admin && old.owner !== user.id) deny('Du kan bara ta bort dina egna boktips.');
  }

  if (!admin) {
    for (const t of p.tags?.put ?? []) {
      const old = tags.get(t.id);
      if (old && old.name !== t.name) deny('Bara administratören kan byta namn på taggar.');
    }
    for (const id of p.tags?.del ?? []) {
      // En tagg som tas bort från sin sista bok försvinner av sig själv. Det
      // är tillåtet. Att ta bort en tagg från många böcker på en gång är det inte.
      if (galaxy.bookTags.filter((bt) => bt.tag === id).length > 1) deny('Bara administratören kan ta bort en tagg från alla böcker.');
    }
    if (p.relationTypes) deny('Bara administratören kan ändra typerna av kopplingar.');
    if ('description' in p) deny('Bara administratören kan ändra galaxens beskrivning.');
  }
  return p;
}

// Sparar positioner. Utan overwrite får bara böcker som saknar plats en
// (så kan vem som helst bidra med layouten, men ingen flytta runt den).
export function applyPositions(galaxy, positions, { overwrite = false } = {}) {
  const entries = Object.entries(positions ?? {}).filter(([id]) => {
    const book = galaxy.books.find((b) => b.id === id);
    return book && (overwrite || !book.position);
  });
  if (!entries.length) return { galaxy, changed: 0 };
  return { galaxy: setPositions(galaxy, Object.fromEntries(entries)), changed: entries.length };
}
