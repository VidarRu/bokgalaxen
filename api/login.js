// POST /api/login  { username, password }
//
// Det första kontot: finns inga användare alls, och stämmer namn och
// lösenord med miljövariablerna ADMIN_USERNAME och ADMIN_PASSWORD, skapas
// administratören vid första inloggningen.

import { getDb } from '../server/db.js';
import { hashPassword, verifyPassword, sessionCookie, publicUser } from '../server/auth.js';
import { json, readJson, handle } from '../server/http.js';
import { normalizeUsername } from '../src/data/password.js';
import { newId } from '../src/data/model.js';

const MAX_FAILS = 8;
const LOCK_MINUTES = 15;
const WRONG = 'Fel användarnamn eller lösenord.';

async function bootstrapAdmin(db, username, password) {
  const wanted = normalizeUsername(process.env.ADMIN_USERNAME);
  if (!wanted || !process.env.ADMIN_PASSWORD) return null;
  if (username !== wanted || password !== process.env.ADMIN_PASSWORD) return null;
  if ((await db.countUsers()) > 0) return null;
  return db.createUser({ id: newId(), username, passwordHash: await hashPassword(password), isAdmin: true, signature: '' });
}

export const POST = handle(async (request) => {
  const db = await getDb();
  const body = await readJson(request);
  const username = normalizeUsername(body.username);
  const password = String(body.password ?? '');
  if (!username || !password) return json({ error: 'Skriv användarnamn och lösenord.' }, { status: 400 });

  let user = (await db.getUserByName(username)) ?? (await bootstrapAdmin(db, username, password));
  if (!user) {
    await hashPassword(password); // ta lika lång tid som ett riktigt försök
    return json({ error: WRONG }, { status: 401 });
  }
  if (user.lockedUntil > Date.now()) {
    return json({ error: `För många felaktiga försök. Vänta ${LOCK_MINUTES} minuter och försök igen.` }, { status: 429 });
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    const fails = (user.failedLogins ?? 0) + 1;
    await db.updateUser(user.id, { failedLogins: fails >= MAX_FAILS ? 0 : fails, lockedUntil: fails >= MAX_FAILS ? Date.now() + LOCK_MINUTES * 60000 : 0 });
    return json({ error: WRONG }, { status: 401 });
  }
  if (user.failedLogins || user.lockedUntil) user = await db.updateUser(user.id, { failedLogins: 0, lockedUntil: 0 });
  return json({ user: publicUser(user) }, { headers: { 'set-cookie': sessionCookie(user, request) } });
});
