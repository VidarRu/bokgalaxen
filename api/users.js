// Redaktörer. Bara administratören.
//
// GET    /api/users                                     alla konton
// POST   /api/users  { username, password, isAdmin }    nytt konto
// PATCH  /api/users  { id, password?, isAdmin? }        nytt lösenord eller roll
// DELETE /api/users  { id }                             ta bort ett konto
//
// Boktips från ett borttaget konto finns kvar i galaxen. Därefter kan bara
// administratören ändra dem.

import { getDb } from '../server/db.js';
import { requireAdmin, publicUser, hashPassword } from '../server/auth.js';
import { json, readJson, handle, HttpError } from '../server/http.js';
import { passwordProblems, describePasswordProblems, normalizeUsername, usernameProblem } from '../src/data/password.js';
import { newId } from '../src/data/model.js';

function checkPassword(password) {
  const problems = passwordProblems(password);
  if (problems.length) throw new HttpError(400, describePasswordProblems(problems));
}

const listing = (user) => ({ ...publicUser(user), created: user.created ?? null });

export const GET = handle(async (request) => {
  const db = await getDb();
  await requireAdmin(request, db);
  return json({ users: (await db.listUsers()).map(listing) });
});

export const POST = handle(async (request) => {
  const db = await getDb();
  await requireAdmin(request, db);
  const body = await readJson(request);
  const problem = usernameProblem(body.username);
  if (problem) throw new HttpError(400, problem);
  checkPassword(body.password);
  const username = normalizeUsername(body.username);
  const user = await db.createUser({ id: newId(), username, passwordHash: await hashPassword(body.password), isAdmin: Boolean(body.isAdmin), signature: '' });
  if (!user) throw new HttpError(409, `Användarnamnet ${username} finns redan.`);
  return json({ user: listing(user) }, { status: 201 });
});

export const PATCH = handle(async (request) => {
  const db = await getDb();
  const admin = await requireAdmin(request, db);
  const body = await readJson(request);
  const target = await db.getUserById(String(body.id ?? ''));
  if (!target) throw new HttpError(404, 'Kontot finns inte.');
  const changes = {};
  if (body.password !== undefined) {
    checkPassword(body.password);
    changes.passwordHash = await hashPassword(body.password);
    changes.failedLogins = 0;
    changes.lockedUntil = 0;
  }
  if (body.isAdmin !== undefined) {
    if (target.id === admin.id && !body.isAdmin) throw new HttpError(400, 'Du kan inte ta bort din egen administratörsroll.');
    changes.isAdmin = Boolean(body.isAdmin);
  }
  return json({ user: listing(await db.updateUser(target.id, changes)) });
});

export const DELETE = handle(async (request) => {
  const db = await getDb();
  const admin = await requireAdmin(request, db);
  const { id } = await readJson(request);
  if (id === admin.id) throw new HttpError(400, 'Du kan inte ta bort ditt eget konto.');
  await db.deleteUser(String(id ?? ''));
  return json({ ok: true });
});
