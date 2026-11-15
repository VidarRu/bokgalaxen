// Gör om en export från Goodreads till en galaxfil med svenska utgåvor.
//
//   node scripts/goodreads/import.mjs <goodreads_library_export.csv>
//
// Skriver:
//   public/startgalax.json        galaxen
//   docs/goodreads-import.md      vad som hittades, och vad som inte gick
//   .goodreads/                   svar från Libris, så att en ny körning går fort
//                                 (ligger inte i Git)
//
// Kopplingarna är inte påhittade. De bygger på två saker som Vidar själv har
// angett på Goodreads:
//   - betyget: böcker med samma betyg (3–5 stjärnor) och samma genre kopplas
//     i en ring, så att varje bok får två grannar
//   - serien: del 1 → del 2 → del 3, typen "för den som läser serien"
// Alla får signaturen "Vidar (Goodreads)", så att de är lätta att hitta och
// ta bort senare. Taggarna är bokens genre.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { parseCsv, readGoodreadsRow, ratingWord } from './csv.js';
import { findSwedishEdition } from './match.js';
import { createEmptyGalaxy, addBook, addRelation, tagBook } from '../../src/data/model.js';
import { getGenre } from '../../src/data/genres.js';

const SIGNATURE = 'Vidar (Goodreads)';
const RATED_TYPE = { id: 'samma-betyg', name: 'samma betyg på Goodreads', directed: false, reverseName: null };
const RATINGS_WITH_LINKS = [5, 4, 3];

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Ange sökvägen till exportfilen från Goodreads.');
  process.exit(1);
}
const cacheDir = '.goodreads';
mkdirSync(join(cacheDir, 'libris'), { recursive: true });

// Samma fetch som vanligt, men svaren sparas på disk.
async function cachedFetch(url, init) {
  const file = join(cacheDir, 'libris', `${createHash('sha1').update(String(url)).digest('hex')}.json`);
  if (existsSync(file)) {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    return { ok: true, status: 200, json: async () => data };
  }
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, init);
      if (!response.ok) return response;
      const data = await response.json();
      writeFileSync(file, JSON.stringify(data));
      return { ok: true, status: 200, json: async () => data };
    } catch (error) {
      if (attempt >= 3 || init?.signal?.aborted) throw error;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

// Rättelser för hand: { "<Goodreads Book Id>": { "query": "...", "title": "..." } }
// eller { "<id>": { "skip": true } }. Se docs/goodreads-import.md.
const correctionsPath = 'scripts/goodreads/rattelser.json';
const { _om, ...corrections } = existsSync(correctionsPath) ? JSON.parse(readFileSync(correctionsPath, 'utf8')) : {};

const rows = parseCsv(readFileSync(csvPath, 'utf8')).map(readGoodreadsRow);
console.log(`${rows.length} böcker i exporten.`);

const authorCache = new Map();
const results = [];
let done = 0;
async function worker(queue) {
  for (let item = queue.shift(); item; item = queue.shift()) {
    const fix = corrections[item.goodreadsId];
    let result;
    if (fix?.skip) {
      result = { how: 'hoppas över', book: null };
    } else {
      const input = fix ? { ...item, title: fix.title ?? item.title, author: fix.author ?? item.author, isbn: fix.isbn ?? '' } : item;
      try {
        result = await findSwedishEdition(input, { fetchImpl: cachedFetch, authorCache });
        if (fix && result.book) result.how = 'rättelse';
      } catch (error) {
        result = { how: null, book: null, error: error.message };
      }
    }
    results.push({ goodreads: item, ...result });
    done++;
    if (done % 25 === 0) console.log(`  ${done} av ${rows.length}`);
  }
}
const queue = [...rows];
await Promise.all([worker(queue), worker(queue), worker(queue)]);
results.sort((a, b) => rows.indexOf(a.goodreads) - rows.indexOf(b.goodreads));
const failed = results.filter((r) => r.error);
if (failed.length) {
  console.error(`${failed.length} böcker fick inget svar från Libris, till exempel: ${failed[0].error}`);
  console.error('Kör skriptet igen. Svar som redan har kommit sparas och hämtas inte igen.');
}

// --- Galaxen -----------------------------------------------------------

let galaxy = createEmptyGalaxy();
galaxy.description =
  'Demo. Böckerna kommer från Vidars läsning på Goodreads, med svenska utgåvor från Libris. ' +
  'Kopplingarna bygger på Vidars egna betyg och på bokserier. Taggarna är genrer.';
galaxy.relationTypes.push({ ...RATED_TYPE });

const bookFor = new Map(); // goodreadsId → bok-id
for (const r of results) {
  if (!r.book) continue;
  const { originalTitles, editions, ...candidate } = r.book;
  const added = addBook(galaxy, candidate);
  galaxy = added.galaxy;
  bookFor.set(r.goodreads.goodreadsId, added.book.id);
  r.bookId = added.book.id;
  r.duplicate = !added.created;
}

// Taggar = genre
for (const book of galaxy.books) {
  if (book.genre) galaxy = tagBook(galaxy, book.id, getGenre(book.genre).name).galaxy;
}

// Betyg: ring per betyg och genre, i den ordning böckerna lästes.
const seen = new Set();
const unique = results.filter((r) => r.bookId && !seen.has(r.bookId) && seen.add(r.bookId));
const bookById = new Map(galaxy.books.map((b) => [b.id, b]));
for (const rating of RATINGS_WITH_LINKS) {
  const groups = new Map();
  for (const r of unique.filter((x) => x.goodreads.rating === rating)) {
    const genre = bookById.get(r.bookId).genre ?? 'okand';
    if (!groups.has(genre)) groups.set(genre, []);
    groups.get(genre).push(r);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.goodreads.dateRead.localeCompare(b.goodreads.dateRead));
    const pairs = group.length === 2 ? [[0, 1]] : group.length > 2 ? group.map((_, i) => [i, (i + 1) % group.length]) : [];
    for (const [i, j] of pairs) {
      galaxy = addRelation(galaxy, {
        from: group[i].bookId,
        to: group[j].bookId,
        type: RATED_TYPE.id,
        motivation: `Vidar gav båda böckerna ${ratingWord(rating)} stjärnor på Goodreads.`,
        signature: SIGNATURE,
      }).galaxy;
    }
  }
}

// Serier: del för del, i nummerordning. Bara hela nummer (inte novell #0.5).
const series = new Map();
for (const r of unique) {
  for (const s of r.goodreads.series) {
    if (!Number.isInteger(s.number)) continue;
    if (!series.has(s.name)) series.set(s.name, []);
    series.get(s.name).push({ number: s.number, bookId: r.bookId });
  }
}
for (const [name, parts] of series) {
  parts.sort((a, b) => a.number - b.number);
  for (let i = 1; i < parts.length; i++) {
    const [a, b] = [parts[i - 1], parts[i]];
    if (a.bookId === b.bookId) continue;
    const gap = b.number - a.number === 1 ? 'nästa del' : 'nästa del som finns i galaxen';
    galaxy = addRelation(galaxy, {
      from: a.bookId,
      to: b.bookId,
      type: 'serien',
      motivation: `Del ${a.number} och ${b.number} i serien ${name}. Den här är ${gap}.`,
      signature: SIGNATURE,
    }).galaxy;
  }
}

writeFileSync('public/startgalax.json', `${JSON.stringify(galaxy, null, 1)}\n`);

// --- Rapporten ---------------------------------------------------------

const found = results.filter((r) => r.book);
const missing = results.filter((r) => !r.book && r.how !== 'hoppas över');
const skipped = results.filter((r) => r.how === 'hoppas över');
const translated = found.filter((r) => r.book.originalTitles.length && r.how !== 'isbn' && r.how !== 'osäker');
const unsure = found.filter((r) => r.how === 'osäker');
const count = (how) => found.filter((r) => r.how === how).length;
const genreCount = new Map();
for (const b of galaxy.books) genreCount.set(getGenre(b.genre).name, (genreCount.get(getGenre(b.genre).name) ?? 0) + 1);
const rel = (type) => galaxy.relations.filter((r) => r.type === type).length;
const line = (r) => `| ${r.goodreads.rawTitle.replace(/\|/g, '/')} | ${r.goodreads.author} | ${r.goodreads.goodreadsId} |`;

const report = `# Import från Goodreads

Skapad av \`scripts/goodreads/import.mjs\` ${new Date().toISOString().slice(0, 10)}. Kör skriptet igen för att göra om den.

## Siffror

- Böcker i exporten: ${rows.length}
- Hittade på svenska i Libris: ${found.length} (via ISBN ${count('isbn')}, via titel ${count('titel')}, bland författarens svenska böcker ${count('författare')}, osäkra ${count('osäker')}, via rättelse ${count('rättelse')})
- Samma verk två gånger i exporten (blev en stjärna): ${found.filter((r) => r.duplicate).length}
- Stjärnor i galaxen: ${galaxy.books.length}
- Saknas på svenska, eller gick inte att hitta: ${missing.length}
- Hoppades över med flit: ${skipped.length}

Kopplingar: ${galaxy.relations.length} (samma betyg ${rel(RATED_TYPE.id)}, serier ${rel('serien')}). Betygen 1 och 2 ger inga kopplingar, eftersom galaxen tipsar om böcker.

Genrer (från Libris förslag):

${[...genreCount].sort((a, b) => b[1] - a[1]).map(([g, n]) => `- ${g}: ${n}`).join('\n')}

## Osäkra träffar, titta på dem först

Samma författare och liknande titel, men inte samma. Är något fel, lägg en rättelse i \`scripts/goodreads/rattelser.json\`.

| Goodreads | Svensk titel | Författare | Goodreads-id |
| --- | --- | --- | --- |
${unsure.map((r) => `| ${r.goodreads.title} | ${r.book.title} | ${r.book.author} | ${r.goodreads.goodreadsId} |`).join('\n')}

## Översatta titlar att titta på

Engelsk titel på Goodreads, svensk titel från Libris. Är något fel, lägg en rättelse i \`scripts/goodreads/rattelser.json\`.

| Goodreads | Svensk titel | Författare |
| --- | --- | --- |
${translated.map((r) => `| ${r.goodreads.title} | ${r.book.title} | ${r.book.author} |`).join('\n')}

## Hittades inte på svenska

Antingen finns boken inte översatt, eller så heter den något helt annat på svenska. Rättelser läggs i \`scripts/goodreads/rattelser.json\` med Goodreads-id som nyckel, till exempel \`{"123": {"title": "Den svenska titeln"}}\` eller \`{"123": {"skip": true}}\`.

| Titel på Goodreads | Författare | Goodreads-id |
| --- | --- | --- |
${missing.map(line).join('\n')}
${skipped.length ? `\n## Hoppades över\n\n| Titel | Författare | Goodreads-id |\n| --- | --- | --- |\n${skipped.map(line).join('\n')}\n` : ''}`;
writeFileSync('docs/goodreads-import.md', report);

console.log(`Klart: ${galaxy.books.length} stjärnor, ${galaxy.relations.length} kopplingar, ${missing.length} hittades inte.`);
