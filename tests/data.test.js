import { test } from 'node:test';
import assert from 'node:assert/strict';

import { workKey, normalizeIsbn, normalizeAuthor } from '../src/data/normalize.js';
import {
  createEmptyGalaxy,
  normalizeGalaxy,
  addBook,
  addRelation,
  removeBook,
  relationsForBook,
  tagBook,
  untagBook,
  degreeMap,
  setPositions,
  updateRelation,
  renameTag,
  removeTag,
  findBooks,
} from '../src/data/model.js';
import { mergeGalaxies } from '../src/data/merge.js';
import { createStore } from '../src/data/store.js';
import { createTestGalaxy } from '../src/data/testdata.js';

const rel = (from, to, type = 'samma-stamning') => ({ from, to, type, motivation: 'Test.', signature: 'Test, Testbiblioteket' });

test('utgåvor av samma verk får samma nyckel', () => {
  assert.equal(workKey('Jag for ner till bror : roman', 'Karin Smirnoff'), workKey('Jag for ner till bror', 'Smirnoff, Karin, 1964-'));
  assert.equal(normalizeAuthor('Martinson, Harry, 1904-1978'), normalizeAuthor('Harry Martinson'));
  assert.notEqual(workKey('Aniara', 'Harry Martinson'), workKey('Aniara', 'Knut Larsson'));
});

test('ISBN-10 görs om till ISBN-13', () => {
  assert.equal(normalizeIsbn('91-0-039872-1'), '9789100398729');
  assert.equal(normalizeIsbn('978-91-7795-098-1'), '9789177950981');
});

test('en ny utgåva av en bok som finns läggs till samma stjärna', () => {
  let g = createEmptyGalaxy();
  const a = addBook(g, { title: 'Aniara', author: 'Harry Martinson', isbns: ['9100398721'], librisIds: ['7144552'] });
  assert.equal(a.created, true);
  const b = addBook(a.galaxy, { title: 'Aniara : en revy om människan i tid och rum', author: 'Martinson, Harry, 1904-1978', isbns: ['9789100802981'], librisIds: ['m3301510k8jbjh4h'], year: 2023 });
  assert.equal(b.created, false);
  assert.equal(b.galaxy.books.length, 1);
  assert.deepEqual(b.book.isbns, ['9789100398729', '9789100802981']);
  assert.deepEqual(b.book.librisIds, ['7144552', 'm3301510k8jbjh4h']);
  assert.match(b.book.id, /^[0-9a-f-]{36}$/);
});

test('kopplingar: dubbletter, riktning och omvänt namn', () => {
  let g = createEmptyGalaxy();
  const a = addBook(g, { title: 'A', author: 'X' });
  const b = addBook(a.galaxy, { title: 'B', author: 'Y' });
  g = b.galaxy;
  const first = addRelation(g, rel(a.book.id, b.book.id));
  const again = addRelation(first.galaxy, rel(b.book.id, a.book.id));
  assert.equal(again.created, false, 'A–B och B–A är samma koppling när typen gäller åt båda håll');

  const step = addRelation(first.galaxy, rel(a.book.id, b.book.id, 'nasta-steg'));
  const back = addRelation(step.galaxy, rel(b.book.id, a.book.id, 'nasta-steg'));
  assert.equal(back.created, true, 'riktade kopplingar åt olika håll är olika kopplingar');

  const seenFromB = relationsForBook(step.galaxy, b.book.id).find((r) => r.type.id === 'nasta-steg');
  assert.equal(seenFromB.label, 'steget före');
  assert.equal(degreeMap(step.galaxy).get(a.book.id), 2);

  assert.throws(() => addRelation(g, { ...rel(a.book.id, b.book.id), motivation: ' ' }), /motivering/);
  assert.throws(() => addRelation(g, rel(a.book.id, a.book.id)), /sig själv/);

  const removed = removeBook(step.galaxy, a.book.id);
  assert.equal(removed.relations.length, 0);
});

test('taggar: samma namn är samma tagg, oanvända taggar försvinner', () => {
  let g = createEmptyGalaxy();
  const a = addBook(g, { title: 'A', author: 'X' });
  const b = addBook(a.galaxy, { title: 'B', author: 'Y' });
  const t1 = tagBook(b.galaxy, a.book.id, 'Feelgood i skärgården');
  const t2 = tagBook(t1.galaxy, b.book.id, 'feelgood i skärgården');
  assert.equal(t2.galaxy.tags.length, 1);
  assert.equal(t2.galaxy.bookTags.length, 2);
  const u = untagBook(untagBook(t2.galaxy, a.book.id, t1.tag.id), b.book.id, t1.tag.id);
  assert.equal(u.tags.length, 0);
});

test('normalizeGalaxy rensar trasiga rader', () => {
  const g = normalizeGalaxy({
    books: [{ id: 'a', title: 'A', author: 'X', position: { x: 1, y: 2, z: 'fel' } }, { id: 'b' }],
    relations: [{ from: 'a', to: 'saknas', type: 'samma-stamning' }],
    bookTags: [{ book: 'a', tag: 'saknas' }],
  });
  assert.equal(g.books.length, 1);
  assert.equal(g.books[0].position, null);
  assert.equal(g.relations.length, 0);
  assert.equal(g.bookTags.length, 0);
  assert.equal(g.relationTypes.length, 5);
  assert.throws(() => normalizeGalaxy({ hej: 1 }), /galaxfil/);
});

test('sammanslagning tar bort dubbletter av böcker, kopplingar och taggar', () => {
  // Två bibliotekarier har byggt var för sig, med egna id för samma böcker.
  function build(titles, motivation, updated) {
    let g = createEmptyGalaxy();
    const ids = [];
    for (const [title, author] of titles) {
      const r = addBook(g, { title, author });
      g = r.galaxy;
      ids.push(r.book.id);
    }
    const r = addRelation(g, { ...rel(ids[0], ids[1]), motivation });
    g = r.galaxy;
    g.relations[0].updated = updated;
    g = tagBook(g, ids[0], 'Norrland').galaxy;
    return { g, ids };
  }
  const one = build([['Jag for ner till bror', 'Karin Smirnoff'], ['Aniara', 'Harry Martinson']], 'Äldre text.', '2026-01-01');
  const two = build([['Aniara', 'Martinson, Harry'], ['Jag for ner till bror : roman', 'Karin Smirnoff'], ['Ny bok', 'Någon']], 'Nyare text.', '2026-06-01');
  two.g = addRelation(two.g, rel(two.ids[0], two.ids[2], 'nasta-steg')).galaxy;

  const { galaxy, summary } = mergeGalaxies(one.g, two.g);
  assert.equal(galaxy.books.length, 3);
  assert.equal(galaxy.relations.length, 2);
  assert.equal(galaxy.tags.length, 1);
  assert.equal(galaxy.bookTags.length, 2, 'taggen sitter på två olika böcker');
  assert.deepEqual([summary.booksAdded, summary.booksMerged, summary.relationsAdded, summary.relationsMerged], [1, 2, 1, 1]);
  const shared = galaxy.relations.find((r) => r.type === 'samma-stamning');
  assert.equal(shared.motivation, 'Nyare text.', 'den senast ändrade motiveringen behålls');
  assert.equal(shared.id, one.g.relations[0].id);
  const ids = new Set(galaxy.books.map((b) => b.id));
  assert.ok(galaxy.relations.every((r) => ids.has(r.from) && ids.has(r.to)));

  // Att slå ihop samma fil en gång till ändrar ingenting.
  const again = mergeGalaxies(galaxy, two.g);
  assert.deepEqual(again.galaxy, galaxy);
});

test('lagringen: sparar, minns osparade ändringar och läser startfilen', async () => {
  const data = new Map();
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
  const startFile = createEmptyGalaxy();
  startFile.books.push({ id: 's1', title: 'Startbok', author: 'Någon' });
  const fetchImpl = async () => ({ ok: true, json: async () => startFile });

  const store = createStore({ storage, fetchImpl });
  await store.load();
  assert.equal(store.source, 'startfilen');
  assert.equal(store.dirty, false);

  store.savePositions({ s1: { x: 1, y: 2, z: 3 } });
  assert.equal(store.dirty, false, 'sparade positioner kräver ingen export');
  store.update((g) => addBook(g, { title: 'Ny', author: 'Bibliotekarie' }).galaxy);
  assert.equal(store.dirty, true);

  const second = createStore({ storage, fetchImpl });
  await second.load();
  assert.equal(second.source, 'webbläsaren');
  assert.equal(second.dirty, true);
  assert.equal(second.galaxy.books.length, 2);
  assert.deepEqual(second.galaxy.books[0].position, { x: 1, y: 2, z: 3 });

  second.markExported();
  assert.equal(second.dirty, false);
  const summary = second.importMerge(JSON.stringify(startFile));
  assert.equal(summary.booksAdded, 0);
  assert.deepEqual(setPositions(second.galaxy, new Map()).books, second.galaxy.books);
});

test('testgalaxen är giltig, likadan varje gång och tydligt märkt', () => {
  const a = createTestGalaxy(200);
  assert.deepEqual(a, createTestGalaxy(200));
  const n = normalizeGalaxy(a);
  assert.equal(n.books.length, 200);
  assert.equal(n.relations.length, a.relations.length);
  assert.ok(a.relations.every((r) => r.signature === 'Testdata'));
  assert.ok(a.books.every((b) => b.title.startsWith('Testbok')));
});

test('ändra en koppling: typ, riktning och dubbletter', () => {
  let g = createEmptyGalaxy();
  const a = addBook(g, { title: 'A', author: 'X' });
  const b = addBook(a.galaxy, { title: 'B', author: 'Y' });
  g = b.galaxy;
  const first = addRelation(g, rel(a.book.id, b.book.id, 'nasta-steg'));
  const second = addRelation(first.galaxy, rel(a.book.id, b.book.id, 'samma-stamning'));
  g = second.galaxy;

  const turned = updateRelation(g, first.relation.id, { from: b.book.id, to: a.book.id, motivation: 'Ny text.' });
  const r = turned.relations.find((x) => x.id === first.relation.id);
  assert.deepEqual([r.from, r.to, r.motivation], [b.book.id, a.book.id, 'Ny text.']);

  assert.throws(() => updateRelation(g, first.relation.id, { type: 'samma-stamning' }), /finns redan/);
  assert.throws(() => updateRelation(g, first.relation.id, { motivation: '' }), /motivering/);
  assert.throws(() => updateRelation(g, first.relation.id, { to: 'någon-annan' }), /riktningen/);
});

test('taggar: byta namn slår ihop med en tagg som redan finns, ta bort tar bort överallt', () => {
  let g = createEmptyGalaxy();
  const a = addBook(g, { title: 'A', author: 'X' });
  const b = addBook(a.galaxy, { title: 'B', author: 'Y' });
  const t1 = tagBook(b.galaxy, a.book.id, 'Norrland');
  const t2 = tagBook(t1.galaxy, a.book.id, 'Norrlandsskildring');
  const t3 = tagBook(t2.galaxy, b.book.id, 'Norrlandsskildring');
  const renamed = renameTag(t3.galaxy, t2.tag.id, 'norrland');
  assert.equal(renamed.tags.length, 1);
  assert.equal(renamed.bookTags.length, 2, 'A hade båda taggarna, men får bara en');
  assert.equal(renameTag(t1.galaxy, t1.tag.id, 'Norr').tags[0].name, 'Norr');
  const removed = removeTag(t3.galaxy, t2.tag.id);
  assert.equal(removed.bookTags.length, 1);
});

test('sökning bland böckerna i galaxen', () => {
  let g = createEmptyGalaxy();
  for (const [title, author, isbns] of [['Aniara', 'Harry Martinson', ['9789100398729']], ['Vägen ut', 'Harry Söderberg'], ['Doktor Glas', 'Hjalmar Söderberg']]) {
    g = addBook(g, { title, author, isbns }).galaxy;
  }
  assert.deepEqual(findBooks(g, 'söderberg').map((b) => b.title), ['Doktor Glas', 'Vägen ut']);
  assert.deepEqual(findBooks(g, 'harry ani').map((b) => b.title), ['Aniara']);
  assert.deepEqual(findBooks(g, '91-0-039872-1').map((b) => b.title), ['Aniara']);
  assert.deepEqual(findBooks(g, '  '), []);
});

test('ångra: går tillbaka ett steg i taget och behåller positionerna', async () => {
  const data = new Map();
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
  const store = createStore({ storage, fetchImpl: async () => ({ ok: false }) });
  await store.load();
  assert.equal(store.undoLabel, null);
  let id;
  store.update((g) => {
    const r = addBook(g, { title: 'A', author: 'X' });
    id = r.book.id;
    return r.galaxy;
  }, 'boken A');
  store.update((g) => tagBook(g, id, 'Tagg').galaxy, 'taggen Tagg');
  store.savePositions({ [id]: { x: 5, y: 6, z: 7 } });
  assert.equal(store.undoLabel, 'taggen Tagg');

  assert.equal(store.undo(), 'taggen Tagg');
  assert.equal(store.galaxy.tags.length, 0);
  assert.deepEqual(store.galaxy.books[0].position, { x: 5, y: 6, z: 7 });
  assert.equal(store.undo(), 'boken A');
  assert.equal(store.galaxy.books.length, 0);
  assert.equal(store.undo(), null);
  assert.equal(store.dirty, true);
});
