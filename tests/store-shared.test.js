// Lagringen i den delade galaxen, med en låtsasserver.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createStore } from '../src/data/store.js';
import { createEmptyGalaxy, addBook, addRelation } from '../src/data/model.js';
import { applyPatch, authorizePatch, NotAllowed } from '../src/data/patch.js';

function fakeServer(user) {
  let a = addBook(createEmptyGalaxy(), { title: 'Aniara', author: 'Harry Martinson' });
  let b = addBook(a.galaxy, { title: 'Doktor Glas', author: 'Hjalmar Söderberg' });
  const server = {
    galaxy: addRelation(b.galaxy, { from: a.book.id, to: b.book.id, type: 'samma-stamning', motivation: 'Ensamhet.', signature: 'Vidar', owner: 'vidar' }).galaxy,
    version: 1,
    patches: [],
    positions: [],
  };
  const remote = {
    loadGalaxy: async () => ({ galaxy: structuredClone(server.galaxy), version: server.version }),
    me: async () => ({ user }),
    savePatch: async (patch) => {
      server.patches.push(patch);
      server.galaxy = applyPatch(server.galaxy, authorizePatch(server.galaxy, patch, user));
      return { version: ++server.version, changed: true };
    },
    savePositions: async (positions) => {
      server.positions.push(positions);
      return { version: ++server.version, changed: true };
    },
  };
  return { server, remote, ids: { aniara: a.book.id, glas: b.book.id } };
}

test('delad galax: ändringen syns direkt, skickas till servern och får ägare', async () => {
  const anna = { id: 'anna', username: 'anna', isAdmin: false };
  const { server, remote, ids } = fakeServer(anna);
  const store = createStore({ remote, storage: null });
  await store.load();
  assert.equal(store.shared, true);
  assert.equal(store.user.username, 'anna');
  store.update((g) => addRelation(g, { from: ids.glas, to: ids.aniara, type: 'samma-tema', motivation: 'Död.', signature: 'Anna' }).galaxy, 'kopplade');
  assert.equal(store.galaxy.relations.length, 2, 'syns direkt');
  await store.flush();
  assert.equal(server.galaxy.relations.find((r) => r.type === 'samma-tema').owner, 'anna');
  assert.equal(store.dirty, false, 'ingen påminnelse om export i den delade galaxen');
  // Ångra skickar en ändring som tar bort kopplingen igen.
  assert.equal(store.undo(), 'kopplade');
  await store.flush();
  assert.equal(server.galaxy.relations.length, 1);
});

test('delad galax: en ändring som inte är tillåten stoppas direkt med en förklaring', async () => {
  const { server, remote } = fakeServer({ id: 'anna', isAdmin: false });
  const store = createStore({ remote, storage: null });
  await store.load();
  assert.throws(() => store.update((g) => ({ ...g, relations: [] })), NotAllowed);
  assert.equal(store.galaxy.relations.length, 1);
  assert.equal(server.patches.length, 0);
});

test('delad galax: bara platser som servern saknar skickas', async () => {
  const { server, remote, ids } = fakeServer({ id: 'anna', isAdmin: false });
  const store = createStore({ remote, storage: null });
  await store.load();
  store.savePositions({ [ids.aniara]: { x: 1, y: 2, z: 3 }, [ids.glas]: { x: 4, y: 5, z: 6 } });
  store.savePositions({ [ids.aniara]: { x: 9, y: 9, z: 9 } });
  await store.flush();
  assert.equal(server.positions.length, 1);
  assert.equal(Object.keys(server.positions[0]).length, 2);
});

test('utan server används webbläsarens lagring som förut', async () => {
  const remote = { loadGalaxy: async () => { throw Object.assign(new Error('ingen server'), { noServer: true }); }, me: async () => ({ user: null }) };
  const store = createStore({ remote, storage: null, fetchImpl: async () => ({ ok: false }) });
  await store.load();
  assert.equal(store.shared, false);
  store.update((g) => addBook(g, { title: 'Ny', author: 'Någon' }).galaxy);
  assert.equal(store.dirty, true);
});
