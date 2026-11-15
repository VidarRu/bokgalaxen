// POST /api/logout

import { clearCookie } from '../server/auth.js';
import { json, handle } from '../server/http.js';

export const POST = handle(async () => json({ ok: true }, { headers: { 'set-cookie': clearCookie() } }));
