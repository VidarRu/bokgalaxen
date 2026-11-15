// Den delade galaxen på servern: läsa, ändra och spara platser.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { normalizeGalaxy, createEmptyGalaxy } from '../src/data/model.js';
import { applyPatch, authorizePatch, applyPositions } from '../src/data/patch.js';
import { HttpError } from './http.js';

const RETRIES = 5;

// Första gången fylls databasen från startfilen. Kopplingarna i den har
// ingen ägare, så bara administratören kan ändra dem.
async function startGalaxy() {
  try {
    const text = await readFile(join(process.cwd(), 'public', 'startgalax.json'), 'utf8');
    return normalizeGalaxy(JSON.parse(text));
  } catch {
    return createEmptyGalaxy();
  }
}

export async function loadGalaxy(db) {
  const stored = await db.getGalaxy();
  if (stored) return { galaxy: normalizeGalaxy(stored.doc), version: stored.version };
  const galaxy = await startGalaxy();
  const version = await db.saveGalaxy(galaxy, 0);
  if (version) return { galaxy, version };
  return loadGalaxy(db); // någon annan hann skapa den
}

// Läser den senaste galaxen, gör ändringen och sparar. Hann någon annan
// ändra under tiden görs det om på den nyare galaxen.
async function update(db, change) {
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    const { galaxy, version } = await loadGalaxy(db);
    const next = change(galaxy);
    if (!next) return { version, changed: false };
    const saved = await db.saveGalaxy(next, version);
    if (saved) return { version: saved, changed: true };
  }
  throw new HttpError(409, 'Många ändrar samtidigt just nu. Försök igen.');
}

export function savePatch(db, patch, user) {
  return update(db, (galaxy) => applyPatch(galaxy, authorizePatch(galaxy, patch, user)));
}

// Vem som helst får ge böcker utan plats en plats. Bara administratören får
// flytta böcker som redan har en (Lägg om galaxen).
export function savePositions(db, positions, user, { overwrite = false } = {}) {
  if (overwrite && !user?.isAdmin) throw new HttpError(403, 'Bara administratören kan lägga om hela galaxen.');
  return update(db, (galaxy) => {
    const result = applyPositions(galaxy, positions, { overwrite });
    return result.changed ? result.galaxy : null;
  });
}
