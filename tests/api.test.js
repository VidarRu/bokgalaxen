// Serverfunktionerna, med en fil som databas i en tillfällig mapp.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.BOKGALAXEN_DEV = '1';
process.env.ADMIN_USERNAME = 'Vidar';
process.env.ADMIN_PASSWORD = 'Start!1a';

const { setDb, fileDb } = await import('../server/db.js');
setDb(fileDb(mkdtempSync(join(tmpdir(), 'bokgalaxen-'))));
const login = await import('../api/login.js');
const me = await import('../api/me.js');
const users = await import('../api/users.js');
const galaxyApi = await import('../api/galaxy.js');
const { diffGalaxies } = await import('../src/data/patch.js');
const { addBook, addRelation } = await import('../src/data/model.js');

const URL_BASE = 'https://bokgalaxen.test';
function req(path, method = 'GET', body, cookie) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  return new Request(`${URL_BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function call(fn, ...args) {
  const response = await fn(req(...args));
  return { status: response.status, body: await response.json(), cookie: (response.headers.get('set-cookie') ?? '').split(';')[0] };
}

let adminCookie = '';
let annaCookie = '';
let annaId = '';

test('första inloggningen med ADMIN_USERNAME och ADMIN_PASSWORD skapar administratören', async () => {
  assert.equal((await call(login.POST, '/api/login', 'POST', { username: 'vidar', password: 'fel' })).status, 401);
  const ok = await call(login.POST, '/api/login', 'POST', { username: 'Vidar', password: 'Start!1a' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.isAdmin, true);
  assert.match(ok.cookie, /^bokgalaxen_session=/);
  adminCookie = ok.cookie;
  assert.equal((await call(me.GET, '/api/me', 'GET', undefined, adminCookie)).body.user.username, 'vidar');
  assert.equal((await call(me.GET, '/api/me')).body.user, null);
});

test('administratören skapar redaktörer, med lösenordsreglerna', async () => {
  const weak = await call(users.POST, '/api/users', 'POST', { username: 'anna', password: 'anna' }, adminCookie);
  assert.equal(weak.status, 400);
  assert.match(weak.body.error, /Lösenordet behöver/);
  const created = await call(users.POST, '/api/users', 'POST', { username: 'Anna', password: 'Bok!g4lax' }, adminCookie);
  assert.equal(created.status, 201);
  annaId = created.body.user.id;
  assert.equal((await call(users.POST, '/api/users', 'POST', { username: 'anna', password: 'Bok!g4lax' }, adminCookie)).status, 409);
  annaCookie = (await call(login.POST, '/api/login', 'POST', { username: 'anna', password: 'Bok!g4lax' })).cookie;
  assert.equal((await call(users.GET, '/api/users', 'GET', undefined, annaCookie)).status, 403);
  assert.equal((await call(users.GET, '/api/users', 'GET', undefined, adminCookie)).body.users.length, 2);
});

test('galaxen: alla kan läsa, bara inloggade ändra, och boktipset får rätt ägare', async () => {
  const { body } = await call(galaxyApi.GET, '/api/galaxy');
  assert.ok(body.galaxy.books.length > 100, 'startfilen läses in första gången');
  const g = body.galaxy;
  const a = addBook(g, { title: 'Testbok A', author: 'Test Testsson' });
  const b = addBook(a.galaxy, { title: 'Testbok B', author: 'Test Testsson' });
  const after = addRelation(b.galaxy, { from: a.book.id, to: b.book.id, type: 'samma-stamning', motivation: 'Prov.', signature: 'Anna' }).galaxy;
  const patch = diffGalaxies(g, after);
  assert.equal((await call(galaxyApi.POST, '/api/galaxy', 'POST', { patch })).status, 401);
  const saved = await call(galaxyApi.POST, '/api/galaxy', 'POST', { patch }, annaCookie);
  assert.equal(saved.status, 200);
  assert.equal(saved.body.version, body.version + 1);
  const now = (await call(galaxyApi.GET, '/api/galaxy')).body.galaxy;
  assert.equal(now.relations.find((r) => r.motivation === 'Prov.').owner, annaId);
  // Anna kan inte ändra ett importerat boktips (utan ägare).
  const imported = now.relations.find((r) => !r.owner);
  const edit = { relations: { put: [{ ...imported, motivation: 'Ändrad.' }], del: [] } };
  const denied = await call(galaxyApi.POST, '/api/galaxy', 'POST', { patch: edit }, annaCookie);
  assert.equal(denied.status, 403);
  assert.equal((await call(galaxyApi.POST, '/api/galaxy', 'POST', { patch: edit }, adminCookie)).status, 200);
});

test('ändringar måste skickas som JSON', async () => {
  const response = await galaxyApi.POST(new Request(`${URL_BASE}/api/galaxy`, { method: 'POST', headers: { cookie: annaCookie }, body: 'patch=x' }));
  assert.equal(response.status, 415);
});

test('byta lösenord loggar ut gamla inloggningar', async () => {
  const changed = await call(me.POST, '/api/me', 'POST', { current: 'Bok!g4lax', next: 'Ny#bok7' }, annaCookie);
  assert.equal(changed.status, 200);
  assert.equal((await call(me.GET, '/api/me', 'GET', undefined, annaCookie)).body.user, null);
  assert.equal((await call(me.GET, '/api/me', 'GET', undefined, changed.cookie)).body.user.username, 'anna');
});

test('en förfalskad kaka godtas inte', async () => {
  const [name, value] = adminCookie.split('=');
  const [payload] = value.split('.');
  assert.equal((await call(me.GET, '/api/me', 'GET', undefined, `${name}=${payload}.fejk`)).body.user, null);
});

test('för många felaktiga försök låser kontot en stund', async () => {
  for (let i = 0; i < 8; i++) await call(login.POST, '/api/login', 'POST', { username: 'anna', password: 'fel' });
  const locked = await call(login.POST, '/api/login', 'POST', { username: 'anna', password: 'Ny#bok7' });
  assert.equal(locked.status, 429);
});
