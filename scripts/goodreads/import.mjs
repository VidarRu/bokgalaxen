// Gör om en export från Goodreads till en galaxfil med svenska utgåvor.
// Böcker som inte finns på svenska läggs in på engelska, med taggen
// "Engelsk skönlitteratur" (eller "Engelsk facklitteratur").
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
import { findSwedishEdition, findEdition } from './match.js';
import { normalizeAuthor, normalizeIsbn } from '../../src/data/normalize.js';
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

// Finns boken inte på svenska läggs den in på engelska. Titeln tas från
// Goodreads (Libris skriver ofta engelska titlar med liten bokstav), övriga
// uppgifter från en engelsk utgåva i Libris om det finns någon. Annars bara
// från Goodreads.
async function englishEdition(item) {
  const found = await findEdition(item, { fetchImpl: cachedFetch, authorCache, language: 'eng' });
  const fromGoodreads = {
    title: item.title,
    author: item.author,
    year: item.year,
    isbns: item.isbn ? [normalizeIsbn(item.isbn)] : [],
    librisIds: [],
    librisWorkIds: [],
    subjects: [],
    genre: null,
    originalTitles: [],
    editions: 1,
  };
  if (!found.book) return { how: 'engelska, bara Goodreads', book: fromGoodreads, english: true };
  return {
    how: 'engelska, Libris',
    book: { ...found.book, title: item.title, author: item.author, year: item.year ?? found.book.year, originalTitles: [] },
    english: true,
  };
}

const results = [];
let done = 0;
async function worker(queue) {
  for (let item = queue.shift(); item; item = queue.shift()) {
    const fix = corrections[item.goodreadsId];
    let result;
    if (fix?.skip) {
      result = { how: 'hoppas över', book: null };
    } else {
      const retitled = fix && (fix.title || fix.author);
      const input = retitled ? { ...item, title: fix.title ?? item.title, author: fix.author ?? item.author, isbn: fix.isbn ?? '' } : item;
      try {
        result = await findSwedishEdition(input, { fetchImpl: cachedFetch, authorCache });
        if (retitled && result.book) result.how = 'rättelse';
        if (!result.book) result = await englishEdition(item);
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
  'Böcker som inte finns översatta står på engelska. ' +
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

// Engelska böcker som Libris inte har en genre för får samma genre som
// författarens andra böcker i galaxen, eller som andra delar i samma serie.
const englishIds = new Set(results.filter((r) => r.english && r.bookId).map((r) => r.bookId));
const mostCommon = (genres) => {
  const counts = new Map();
  for (const g of genres.filter(Boolean)) counts.set(g, (counts.get(g) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};
const genreBy = { author: 0, series: 0, none: 0 };
for (let pass = 0; pass < 2; pass++) {
  for (const id of englishIds) {
    const book = galaxy.books.find((b) => b.id === id);
    if (book.genre) continue;
    const author = normalizeAuthor(book.author);
    let genre = mostCommon(galaxy.books.filter((b) => b.id !== id && normalizeAuthor(b.author) === author).map((b) => b.genre));
    if (genre) genreBy.author++;
    if (!genre) {
      const names = new Set(results.filter((r) => r.bookId === id).flatMap((r) => r.goodreads.series.map((x) => x.name)));
      const siblings = new Set(results.filter((r) => r.bookId && r.bookId !== id && r.goodreads.series.some((x) => names.has(x.name))).map((r) => r.bookId));
      genre = mostCommon(galaxy.books.filter((b) => siblings.has(b.id)).map((b) => b.genre));
      if (genre) genreBy.series++;
    }
    if (genre) galaxy = { ...galaxy, books: galaxy.books.map((b) => (b.id === id ? { ...b, genre } : b)) };
  }
}

// Libris kallar många engelska fantasy- och sf-böcker bara "Roman". En
// engelsk bok i en serie får därför seriens vanligaste genre.
for (const id of englishIds) {
  const book = galaxy.books.find((b) => b.id === id);
  if (book.genre && book.genre !== 'roman') continue;
  const names = new Set(results.filter((r) => r.bookId === id).flatMap((r) => r.goodreads.series.map((x) => x.name)));
  const siblings = new Set(results.filter((r) => r.bookId && r.bookId !== id && r.goodreads.series.some((x) => names.has(x.name))).map((r) => r.bookId));
  const genre = mostCommon(galaxy.books.filter((b) => siblings.has(b.id)).map((b) => b.genre));
  if (genre && genre !== book.genre) {
    galaxy = { ...galaxy, books: galaxy.books.map((b) => (b.id === id ? { ...b, genre } : b)) };
    genreBy.series++;
  }
}

// Genre rättad för hand i rattelser.json.
for (const r of results) {
  const genre = corrections[r.goodreads.goodreadsId]?.genre;
  if (genre && r.bookId) {
    galaxy = { ...galaxy, books: galaxy.books.map((b) => (b.id === r.bookId ? { ...b, genre } : b)) };
    genreBy.manual = (genreBy.manual ?? 0) + 1;
  }
}
genreBy.none = galaxy.books.filter((b) => englishIds.has(b.id) && !b.genre).length;

// Taggar = genre, och för engelska böcker även språket.
const NONFICTION = new Set(['fakta', 'biografi']);
for (const book of galaxy.books) {
  if (book.genre) galaxy = tagBook(galaxy, book.id, getGenre(book.genre).name).galaxy;
  if (englishIds.has(book.id)) {
    const tag = NONFICTION.has(book.genre) ? 'Engelsk facklitteratur' : 'Engelsk skönlitteratur';
    galaxy = tagBook(galaxy, book.id, tag).galaxy;
  }
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

const english = results.filter((r) => r.english);
const found = results.filter((r) => r.book && !r.english);
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
- Inlagda på engelska (finns inte på svenska): ${english.length}, varav ${english.filter((r) => r.how === 'engelska, Libris').length} med uppgifter från en engelsk utgåva i Libris och ${english.filter((r) => r.how === 'engelska, bara Goodreads').length} bara med uppgifter från Goodreads
- Genre för engelska böcker: från författarens andra böcker ${genreBy.author}, från serien ${genreBy.series}, saknas fortfarande ${genreBy.none}
- Genre rättad för hand: ${genreBy.manual ?? 0}
- Gick inte att lägga in: ${missing.length}
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

## Inlagda på engelska

Hittades inte på svenska, så de står på engelska med taggen "Engelsk skönlitteratur" eller "Engelsk facklitteratur". Finns någon ändå på svenska under ett annat namn? Rättelser läggs i \`scripts/goodreads/rattelser.json\` med Goodreads-id som nyckel, till exempel \`{"123": {"title": "Den svenska titeln"}}\` eller \`{"123": {"skip": true}}\`.

| Titel på Goodreads | Författare | Goodreads-id |
| --- | --- | --- |
${english.map(line).join('\n')}
${missing.length ? `\n## Gick inte att lägga in\n\n| Titel | Författare | Goodreads-id |\n| --- | --- | --- |\n${missing.map(line).join('\n')}\n` : ''}
${skipped.length ? `\n## Hoppades över\n\n| Titel | Författare | Goodreads-id |\n| --- | --- | --- |\n${skipped.map(line).join('\n')}\n` : ''}`;
writeFileSync('docs/goodreads-import.md', report);

console.log(`Klart: ${galaxy.books.length} stjärnor (${english.length} på engelska), ${galaxy.relations.length} kopplingar, ${missing.length} gick inte att lägga in.`);
