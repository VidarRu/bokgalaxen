// Inloggning: lösenord och sessionskaka. Bara Nodes inbyggda kryptering.
//
// Lösenord sparas aldrig, bara en hash (scrypt med ett eget salt per
// lösenord). Den som är inloggad har en kaka med användarens id, ett
// utgångsdatum och en signatur gjord med SESSION_SECRET. Byts lösenordet
// slutar gamla kakor att gälla.

import { scrypt, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
import { promisify } from 'node:util';

import { HttpError } from './http.js';

const scryptAsync = promisify(scrypt);
const COOKIE = 'bokgalaxen_session';
const SESSION_DAYS = 30;
const KEYLEN = 32;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('base64url');
  const hash = await scryptAsync(String(password), salt, KEYLEN);
  return `scrypt$${salt}$${hash.toString('base64url')}`;
}

export async function verifyPassword(password, stored) {
  const [kind, salt, expected] = String(stored ?? '').split('$');
  if (kind !== 'scrypt' || !salt || !expected) return false;
  const hash = await scryptAsync(String(password), salt, KEYLEN);
  const want = Buffer.from(expected, 'base64url');
  return want.length === hash.length && timingSafeEqual(want, hash);
}

function secret() {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 16) return value;
  if (process.env.BOKGALAXEN_DEV === '1') return 'bara-for-lokal-utveckling-inte-hemlig';
  throw new HttpError(500, 'Servern saknar SESSION_SECRET. Se docs/VERCEL.md.');
}

const sign = (text) => createHmac('sha256', secret()).update(text).digest('base64url');

// Kakan pekar ut användaren och en bit av lösenordshashen, så att ett nytt
// lösenord loggar ut alla gamla inloggningar.
function passwordMark(user) {
  return String(user.passwordHash).slice(-10);
}

export function sessionCookie(user, request) {
  const payload = Buffer.from(JSON.stringify({ u: user.id, p: passwordMark(user), e: Date.now() + SESSION_DAYS * 864e5 })).toString('base64url');
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${payload}.${sign(payload)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function readCookie(request) {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE) return rest.join('=');
  }
  return null;
}

// Svar: användaren som är inloggad, eller null.
export async function currentUser(request, db) {
  const raw = readCookie(request);
  if (!raw) return null;
  const [payload, signature] = raw.split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch {
    return null;
  }
  if (!data?.u || !(data.e > Date.now())) return null;
  const user = await db.getUserById(data.u);
  if (!user || passwordMark(user) !== data.p) return null;
  return user;
}

export async function requireUser(request, db) {
  const user = await currentUser(request, db);
  if (!user) throw new HttpError(401, 'Du är inte inloggad, eller så har inloggningen gått ut. Logga in igen.');
  return user;
}

export async function requireAdmin(request, db) {
  const user = await requireUser(request, db);
  if (!user.isAdmin) throw new HttpError(403, 'Bara administratören kan göra det.');
  return user;
}

// Det som webbläsaren får veta om en användare.
export function publicUser(user) {
  return user ? { id: user.id, username: user.username, isAdmin: Boolean(user.isAdmin), signature: user.signature ?? '' } : null;
}
