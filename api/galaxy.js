// GET  /api/galaxy   hela galaxen, för alla besökare
// POST /api/galaxy   { patch } en ändring från byggläget (inloggad)
//                    { positions, overwrite } platser för stjärnorna

import { getDb } from '../server/db.js';
import { currentUser } from '../server/auth.js';
import { json, readJson, handle, HttpError } from '../server/http.js';
import { loadGalaxy, savePatch, savePositions } from '../server/galaxy.js';

export const GET = handle(async () => {
  const db = await getDb();
  return json(await loadGalaxy(db));
});

export const POST = handle(async (request) => {
  const db = await getDb();
  const body = await readJson(request);
  const user = await currentUser(request, db);
  if (body.positions) {
    return json(await savePositions(db, body.positions, user, { overwrite: Boolean(body.overwrite) }));
  }
  if (!body.patch) throw new HttpError(400, 'Ändringen saknas.');
  if (!user) throw new HttpError(401, 'Du är inte inloggad, eller så har inloggningen gått ut. Logga in igen.');
  return json(await savePatch(db, body.patch, user));
});
