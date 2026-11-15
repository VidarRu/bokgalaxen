import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createEmptyGalaxy, addBook, addRelation, tagBook, untagBook, removeTag, renameTag, removeBook, updateBook } from '../src/data/model.js';
import { diffGalaxies, applyPatch, authorizePatch, applyPositions, NotAllowed } from '../src/data/patch.js';
import { passwordProblems, usernameProblem, describePasswordProblems } from '../src/data/password.js';

const anna = { id: 'anna', isAdmin: false };
const bo = { id: 'bo', isAdmin: false };
const admin = { id: 'vidar', isAdmin: true };

function start() {
  let g = createEmptyGalaxy();
  const a = addBook(g, { title: 'Aniara', author: 'Harry Martinson' });
  g = a.galaxy;
  const d = addBook(g, { title: 'Doktor Glas', author: 'Hjalmar Söderberg' });
  g = d.galaxy;
  g = { ...g, books: g.books.map((b) => ({ ...b, addedBy: b.id === a.book.id ? 'anna' : null })) };
  const r = addRelation(g, { from: a.book.id, to: d.book.id, type: 'samma-stamning', motivation: 'Ensamhet.', signature: 'Anna', owner: 'anna' });
  return { g: r.galaxy, aniara: a.book.id, glas: d.book.id, rel: r.relation.id };
}

// Gör en ändring som användaren skulle göra i webbläsaren och kör den genom servern.
function viaServer(g, user, change) {
  const patch = diffGalaxies(g, change(g));
  return applyPatch(g, authorizePatch(g, patch, user));
}

test('ändringspaket: diff och apply ger samma galax som ändringen', () => {
  const { g, aniara } = start();
  const after = tagBook(updateBook(g, aniara, { year: 1956 }), aniara, 'Rymden').galaxy;
  const patch = diffGalaxies(g, after);
  assert.deepEqual(Object.keys(patch).sort(), ['bookTags', 'books', 'tags']);
  assert.deepEqual(applyPatch(g, patch), after);
});

test('ändringspaket: positioner räknas inte som ändringar och skrivs inte över', () => {
  const { g, aniara } = start();
  const placed = applyPositions(g, { [aniara]: { x: 1, y: 2, z: 3 } }).galaxy;
  assert.deepEqual(diffGalaxies(g, placed), {});
  const edited = updateBook(g, aniara, { year: 1956 }); // webbläsaren har ingen position
  const result = applyPatch(placed, diffGalaxies(g, edited));
  assert.deepEqual(result.books.find((b) => b.id === aniara).position, { x: 1, y: 2, z: 3 });
});

test('positioner: utan overwrite får bara böcker utan plats en plats', () => {
  const { g, aniara } = start();
  const once = applyPositions(g, { [aniara]: { x: 1, y: 1, z: 1 } }).galaxy;
  const twice = applyPositions(once, { [aniara]: { x: 9, y: 9, z: 9 } });
  assert.equal(twice.changed, 0);
  assert.equal(applyPositions(once, { [aniara]: { x: 9, y: 9, z: 9 } }, { overwrite: true }).changed, 1);
});

test('redaktörer: nya boktips får inloggad redaktör som ägare, oavsett vad webbläsaren skickar', () => {
  const { g, aniara, glas } = start();
  const after = viaServer(g, bo, (x) => addRelation(x, { from: glas, to: aniara, type: 'samma-tema', motivation: 'Död.', signature: 'Bo', owner: 'anna' }).galaxy);
  assert.equal(after.relations.find((r) => r.type === 'samma-tema').owner, 'bo');
});

test('redaktörer: man kan bara ändra och ta bort sina egna boktips', () => {
  const { g, rel } = start();
  const edit = (x) => ({ ...x, relations: x.relations.map((r) => ({ ...r, motivation: 'Ändrad.' })) });
  assert.throws(() => viaServer(g, bo, edit), NotAllowed);
  assert.throws(() => viaServer(g, bo, (x) => ({ ...x, relations: [] })), /egna boktips/);
  assert.equal(viaServer(g, anna, edit).relations[0].motivation, 'Ändrad.');
  assert.equal(viaServer(g, admin, (x) => ({ ...x, relations: [] })).relations.length, 0);
  assert.equal(viaServer(g, anna, (x) => ({ ...x, relations: x.relations.filter((r) => r.id !== rel) })).relations.length, 0);
});

test('redaktörer: ägaren går inte att byta', () => {
  const { g } = start();
  const steal = (x) => ({ ...x, relations: x.relations.map((r) => ({ ...r, owner: 'bo', motivation: 'Min nu.' })) });
  assert.equal(viaServer(g, anna, steal).relations[0].owner, 'anna');
});

test('redaktörer: böcker', () => {
  const { g, aniara, glas } = start();
  // Lägga till en bok går, och den får redaktören som "tillagd av".
  const added = viaServer(g, bo, (x) => addBook(x, { title: 'Kallocain', author: 'Karin Boye' }).galaxy);
  assert.equal(added.books.find((b) => b.title === 'Kallocain').addedBy, 'bo');
  // Genre: bara den som lade till boken.
  assert.throws(() => viaServer(g, bo, (x) => updateBook(x, aniara, { genre: 'lyrik' })), /genre/);
  assert.equal(viaServer(g, anna, (x) => updateBook(x, aniara, { genre: 'lyrik' })).books.find((b) => b.id === aniara).genre, 'lyrik');
  // Ta bort: inte någon annans bok, och inte en bok med andras boktips.
  assert.throws(() => viaServer(g, bo, (x) => removeBook(x, glas)), NotAllowed);
  assert.equal(viaServer(g, anna, (x) => removeBook(x, aniara)).books.length, 1);
  const withBo = viaServer(g, bo, (x) => addRelation(x, { from: glas, to: aniara, type: 'samma-tema', motivation: 'Död.', signature: 'Bo' }).galaxy);
  assert.throws(() => viaServer(withBo, anna, (x) => removeBook(x, aniara)), /andra redaktörer/);
  assert.equal(viaServer(withBo, admin, (x) => removeBook(x, aniara)).books.length, 1);
});

test('redaktörer: taggar sätts och tas bort, men byter inte namn och tas inte bort från alla', () => {
  const { g, aniara, glas } = start();
  let x = viaServer(g, bo, (y) => tagBook(y, aniara, 'Klassiker').galaxy);
  x = viaServer(x, bo, (y) => tagBook(y, glas, 'Klassiker').galaxy);
  const tag = x.tags[0].id;
  assert.equal(x.bookTags.length, 2);
  assert.throws(() => viaServer(x, bo, (y) => renameTag(y, tag, 'Gammalt')), /byta namn/);
  assert.throws(() => viaServer(x, bo, (y) => removeTag(y, tag)), /alla böcker/);
  x = viaServer(x, anna, (y) => untagBook(y, aniara, tag));
  x = viaServer(x, anna, (y) => untagBook(y, glas, tag)); // sista boken: taggen försvinner
  assert.equal(x.tags.length, 0);
  assert.equal(viaServer(viaServer(g, bo, (y) => tagBook(y, aniara, 'A').galaxy), admin, (y) => renameTag(y, y.tags[0].id, 'B')).tags[0].name, 'B');
});

test('utloggad: inga ändringar', () => {
  const { g, aniara } = start();
  assert.throws(() => authorizePatch(g, diffGalaxies(g, updateBook(g, aniara, { year: 1 })), null), /Logga in/);
});

test('lösenord: minst 6 tecken, stor och liten bokstav, siffra och specialtecken', () => {
  assert.deepEqual(passwordProblems('Bok!g4'), []);
  assert.deepEqual(passwordProblems('Åäö!1x'), []);
  assert.equal(passwordProblems('abc').length, 4);
  assert.equal(describePasswordProblems(passwordProblems('Bokgalax1')), 'Lösenordet behöver ett specialtecken, till exempel ! eller #.');
  assert.equal(describePasswordProblems(passwordProblems('bokgalax')), 'Lösenordet behöver en stor bokstav, en siffra och ett specialtecken, till exempel ! eller #.');
  assert.equal(usernameProblem('vidar.k'), '');
  assert.match(usernameProblem('a b'), /bara innehålla/);
  assert.match(usernameProblem('ab'), /minst 3/);
});
