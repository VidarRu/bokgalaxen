// GET   /api/me   vem som är inloggad ({ user } eller { user: null })
// PATCH /api/me   { signature } ändra sin egen signatur
// POST  /api/me   { current, next } byta sitt eget lösenord

import { getDb } from '../server/db.js';
import { currentUser, requireUser, publicUser, verifyPassword, hashPassword, sessionCookie } from '../server/auth.js';
import { json, readJson, handle, HttpError } from '../server/http.js';
import { passwordProblems, describePasswordProblems } from '../src/data/password.js';

export const GET = handle(async (request) => {
  const db = await getDb();
  return json({ user: publicUser(await currentUser(request, db)) });
});

export const PATCH = handle(async (request) => {
  const db = await getDb();
  const user = await requireUser(request, db);
  const { signature } = await readJson(request);
  const text = String(signature ?? '').trim();
  if (text.length > 80) throw new HttpError(400, 'Signaturen får vara högst 80 tecken.');
  return json({ user: publicUser(await db.updateUser(user.id, { signature: text })) });
});

export const POST = handle(async (request) => {
  const db = await getDb();
  const user = await requireUser(request, db);
  const { current, next } = await readJson(request);
  if (!(await verifyPassword(String(current ?? ''), user.passwordHash))) throw new HttpError(400, 'Det nuvarande lösenordet stämmer inte.');
  const problems = passwordProblems(next);
  if (problems.length) throw new HttpError(400, describePasswordProblems(problems));
  const updated = await db.updateUser(user.id, { passwordHash: await hashPassword(next) });
  return json({ user: publicUser(updated) }, { headers: { 'set-cookie': sessionCookie(updated, request) } });
});
