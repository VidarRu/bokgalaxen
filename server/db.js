// Databasen. På Vercel är det Neon Postgres (miljövariabeln DATABASE_URL,
// som Neon-kopplingen i Vercel sätter). Utan den, till exempel vid lokal
// utveckling och i testerna, sparas allt i en JSON-fil i mappen .data/.
//
// Två tabeller:
//   users   redaktörerna: användarnamn, lösenordshash, admin, signatur
//   galaxy  hela galaxen som ett JSON-dokument, med ett versionsnummer.
//           Versionen gör att två samtidiga ändringar inte skriver över
//           varandra: den som kommer sist läser om och försöker igen.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

let instance = null;

export async function getDb() {
  if (instance) return instance;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  instance = url ? await neonDb(url) : fileDb(process.env.BOKGALAXEN_DATA_DIR || '.data');
  return instance;
}

// För testerna.
export function setDb(db) {
  instance = db;
}

function fromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    isAdmin: row.is_admin,
    signature: row.signature ?? '',
    failedLogins: row.failed_logins ?? 0,
    lockedUntil: row.locked_until ? new Date(row.locked_until).getTime() : 0,
    created: row.created ? new Date(row.created).toISOString() : null,
  };
}

async function neonDb(url) {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(url);
  let ready = null;
  const schema = () =>
    (ready ??= (async () => {
      await sql`CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY,
        username text UNIQUE NOT NULL,
        password_hash text NOT NULL,
        is_admin boolean NOT NULL DEFAULT false,
        signature text NOT NULL DEFAULT '',
        failed_logins integer NOT NULL DEFAULT 0,
        locked_until timestamptz,
        created timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS galaxy (
        id integer PRIMARY KEY,
        doc jsonb NOT NULL,
        version integer NOT NULL
      )`;
    })());

  return {
    async getGalaxy() {
      await schema();
      const rows = await sql`SELECT doc, version FROM galaxy WHERE id = 1`;
      return rows[0] ? { doc: rows[0].doc, version: rows[0].version } : null;
    },
    // Svar: den nya versionen, eller null om någon annan hann före.
    async saveGalaxy(doc, expectedVersion) {
      await schema();
      if (expectedVersion === 0) {
        const rows = await sql`INSERT INTO galaxy (id, doc, version) VALUES (1, ${JSON.stringify(doc)}::jsonb, 1) ON CONFLICT (id) DO NOTHING RETURNING version`;
        return rows[0]?.version ?? null;
      }
      const rows = await sql`UPDATE galaxy SET doc = ${JSON.stringify(doc)}::jsonb, version = version + 1 WHERE id = 1 AND version = ${expectedVersion} RETURNING version`;
      return rows[0]?.version ?? null;
    },
    async countUsers() {
      await schema();
      return Number((await sql`SELECT count(*)::int AS n FROM users`)[0].n);
    },
    async listUsers() {
      await schema();
      return (await sql`SELECT * FROM users ORDER BY username`).map(fromRow);
    },
    async getUserById(id) {
      await schema();
      return fromRow((await sql`SELECT * FROM users WHERE id = ${id}`)[0]);
    },
    async getUserByName(username) {
      await schema();
      return fromRow((await sql`SELECT * FROM users WHERE username = ${username}`)[0]);
    },
    async createUser(u) {
      await schema();
      const rows = await sql`INSERT INTO users (id, username, password_hash, is_admin, signature)
        VALUES (${u.id}, ${u.username}, ${u.passwordHash}, ${Boolean(u.isAdmin)}, ${u.signature ?? ''})
        ON CONFLICT (username) DO NOTHING RETURNING *`;
      return fromRow(rows[0]);
    },
    async updateUser(id, f) {
      await schema();
      const cur = await this.getUserById(id);
      if (!cur) return null;
      const n = { ...cur, ...f };
      const rows = await sql`UPDATE users SET password_hash = ${n.passwordHash}, is_admin = ${Boolean(n.isAdmin)},
        signature = ${n.signature ?? ''}, failed_logins = ${n.failedLogins ?? 0},
        locked_until = ${n.lockedUntil ? new Date(n.lockedUntil).toISOString() : null}
        WHERE id = ${id} RETURNING *`;
      return fromRow(rows[0]);
    },
    async deleteUser(id) {
      await schema();
      await sql`DELETE FROM users WHERE id = ${id}`;
    },
  };
}

// Samma sak i en fil. Bara för lokal utveckling och tester: tål inte flera
// servrar samtidigt.
export function fileDb(dir) {
  const file = join(dir, 'bokgalaxen-db.json');
  let queue = Promise.resolve();
  const read = async () => {
    try {
      return JSON.parse(await readFile(file, 'utf8'));
    } catch {
      return { users: [], galaxy: null };
    }
  };
  const write = async (data) => {
    await mkdir(dir, { recursive: true });
    await writeFile(file, JSON.stringify(data));
  };
  // Alla ändringar körs i tur och ordning.
  const change = (fn) => (queue = queue.then(async () => {
    const data = await read();
    const result = await fn(data);
    await write(data);
    return result;
  }));

  return {
    async getGalaxy() {
      return (await read()).galaxy;
    },
    saveGalaxy(doc, expectedVersion) {
      return change((data) => {
        const current = data.galaxy?.version ?? 0;
        if (current !== expectedVersion) return null;
        data.galaxy = { doc, version: current + 1 };
        return current + 1;
      });
    },
    async countUsers() {
      return (await read()).users.length;
    },
    async listUsers() {
      return (await read()).users.sort((a, b) => a.username.localeCompare(b.username));
    },
    async getUserById(id) {
      return (await read()).users.find((u) => u.id === id) ?? null;
    },
    async getUserByName(username) {
      return (await read()).users.find((u) => u.username === username) ?? null;
    },
    createUser(u) {
      return change((data) => {
        if (data.users.some((x) => x.username === u.username)) return null;
        const user = { failedLogins: 0, lockedUntil: 0, signature: '', created: new Date().toISOString(), ...u };
        data.users.push(user);
        return user;
      });
    },
    updateUser(id, f) {
      return change((data) => {
        const user = data.users.find((u) => u.id === id);
        if (!user) return null;
        Object.assign(user, f);
        return user;
      });
    },
    deleteUser(id) {
      return change((data) => {
        data.users = data.users.filter((u) => u.id !== id);
      });
    },
  };
}
