// Hämtning från Libris för urvalsskriptet. Samma tanke som cachedFetch i
// scripts/goodreads/import.mjs, men snällare mot Libris:
//
//   - ett anrop i taget, med paus emellan (PAUSE_MS)
//   - svaren sparas packade på disk, så att en ny körning inte frågar om
//     samma sak (ett svar med 25 utgåvor är flera MB, packat cirka en tiondel)
//   - vid fel (429, 5xx, nätverket) väntas det längre och det provas igen
//
// Det här är bara en fetch som skickas in till src/libris. Alla anrop går
// alltså fortfarande genom Libris-modulen.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

export const PAUSE_MS = 1000;
const MAX_TRIES = 5;

export function createLibrisFetch({ cacheDir = '.libris-urval', pauseMs = PAUSE_MS, log = () => {} } = {}) {
  const dir = join(cacheDir, 'libris');
  mkdirSync(dir, { recursive: true });
  const stats = { cached: 0, live: 0, retries: 0 };

  // Alla anrop ställs i en enda kö, så att inga två går samtidigt.
  let queue = Promise.resolve();
  let lastCall = 0;

  const run = async (url, init) => {
    const file = join(dir, `${createHash('sha1').update(String(url)).digest('hex')}.json.gz`);
    if (existsSync(file)) {
      stats.cached++;
      const data = JSON.parse(gunzipSync(readFileSync(file)).toString('utf8'));
      return { ok: true, status: 200, json: async () => data };
    }
    for (let attempt = 1; ; attempt++) {
      const wait = lastCall + pauseMs - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      try {
        const response = await fetch(url, init);
        lastCall = Date.now();
        if (response.ok) {
          const data = await response.json();
          writeFileSync(file, gzipSync(JSON.stringify(data)));
          stats.live++;
          return { ok: true, status: 200, json: async () => data };
        }
        // Fel som går över: vänta och försök igen. Andra fel lämnas vidare.
        if (response.status !== 429 && response.status < 500) return response;
        if (attempt >= MAX_TRIES) return response;
        log(`Libris svarade ${response.status}, väntar och provar igen (${attempt}/${MAX_TRIES})`);
      } catch (error) {
        lastCall = Date.now();
        if (attempt >= MAX_TRIES || init?.signal?.aborted) throw error;
        log(`Anropet misslyckades (${error.message}), väntar och provar igen (${attempt}/${MAX_TRIES})`);
      }
      stats.retries++;
      await new Promise((r) => setTimeout(r, 4000 * attempt));
    }
  };

  const politeFetch = (url, init) => {
    const result = queue.then(() => run(url, init));
    queue = result.catch(() => {});
    return result;
  };
  politeFetch.stats = stats;
  return politeFetch;
}
