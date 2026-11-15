// Små hjälpfunktioner för serverfunktionerna i api/. De använder webbens
// vanliga Request och Response, som Vercel stöder direkt.

import { NotAllowed } from '../src/data/patch.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

// Ändringar måste skickas som JSON. Det stoppar formulär från andra webbplatser
// (de kan inte skicka JSON utan att webbläsaren först frågar oss).
export async function readJson(request) {
  if (!String(request.headers.get('content-type') ?? '').includes('application/json')) {
    throw new HttpError(415, 'Skicka uppgifterna som JSON.');
  }
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, 'Uppgifterna gick inte att läsa.');
  }
}

// Gör om fel till svar med ett svenskt meddelande.
export function handle(fn) {
  return async (request) => {
    try {
      return await fn(request);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, { status: error.status });
      if (error instanceof NotAllowed) return json({ error: error.message }, { status: 403 });
      console.error(error);
      return json({ error: 'Något gick fel på servern. Försök igen om en stund.' }, { status: 500 });
    }
  };
}
