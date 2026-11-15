// Fyller galaxen med fler svenska böcker från Libris, som lösa stjärnor utan
// kopplingar och utan motiveringar. Ingenting här är påhittat: allt kommer
// från Libris, och urvalet bygger på hur många bibliotek som har boken.
//
//   node scripts/libris-urval/urval.mjs [--max=400]
//
// Skriver:
//   docs/libris-urval.json   en galaxfil som läggs in med Galaxfil → Slå ihop med en fil
//   docs/libris-urval.md     siffror och ett stickprov på 20 böcker
//   .libris-urval/           svar från Libris, packade (ligger inte i Git)
//
// public/startgalax.json läses bara, för att hoppa över böcker som redan finns.
//
// Tre urval, i den här ordningen (se also scripts/libris-urval/augustpris.json):
//   1. Augustpris-nominerade, ur en lista som är skriven för hand
//   2. Svensk skönlitteratur 2015–2025: för varje år och genre de böcker som
//      flest bibliotek har
//   3. Barn- och ungdomsböcker 2010–2025, på samma sätt
//
// Alla anrop går genom src/libris (searchBooks, språkfilter 'swe'), ett i
// taget med paus emellan, och svaren sparas i en cache.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

import { searchBooks } from '../../src/libris/index.js';
import { createEmptyGalaxy, addBook, tagBook } from '../../src/data/model.js';
import { normalizeAuthor } from '../../src/data/normalize.js';
import { getGenre } from '../../src/data/genres.js';
import { titleKey } from '../goodreads/match.js';
import { createLibrisFetch } from './fetch.js';
import {
  librisTerm,
  notABook,
  isChildrens,
  surnameOf,
  sameAuthor,
  existingWork,
  sameWorkHits,
  mergeHits,
  sample,
} from './pick.js';

const maxArg = process.argv.find((a) => a.startsWith('--max='));
const MAX_NEW = maxArg ? Number(maxArg.slice(6)) : 400;

// Hur många böcker per år och genre. Gör man om siffrorna här får man ett
// annat urval. Specialgenrerna kommer före "Romaner", som annars tar allt.
const FICTION = {
  name: 'Svensk skönlitteratur',
  from: 2015,
  to: 2025,
  groups: [
    { name: 'Deckare', scheme: 'saogf', term: 'Deckare', per: 3 },
    { name: 'Fantasy', scheme: 'saogf', term: 'Fantasy', per: 1 },
    { name: 'Science fiction', scheme: 'saogf', term: 'Science fiction', per: 1 },
    { name: 'Noveller', scheme: 'saogf', term: 'Noveller', per: 1 },
    { name: 'Lyrik', scheme: 'saogf', term: 'Poesi', per: 2 },
    { name: 'Feelgood', scheme: 'saogf', term: 'Feelgood', per: 2 },
    { name: 'Romaner', scheme: 'saogf', term: 'Romaner', per: 7 },
  ],
};
const CHILDREN = {
  name: 'Barn- och ungdomsböcker',
  from: 2010,
  to: 2025,
  groups: [
    { name: 'Ungdomsböcker', scheme: 'barngf', term: 'Ungdomsböcker', per: 3 },
    { name: 'Kapitelböcker', scheme: 'barngf', term: 'Kapitelböcker', per: 3 },
    { name: 'Bilderböcker', scheme: 'barngf', term: 'Bilderböcker', per: 3 },
    { name: 'Faktaböcker', scheme: 'barngf', term: 'Faktaböcker', per: 2 },
  ],
};
const PAGE = 30; // utgåvor per anrop
const MAX_PAGES = 3; // sidor per år och genre innan vi ger upp
const MAX_PER_AUTHOR = 2; // så att en serie inte tar över
const SOURCES = { augustpris: 'Augustpris-nominerade', skonlitteratur: FICTION.name, barn: CHILDREN.name };

const fetchImpl = createLibrisFetch({ cacheDir: '.libris-urval', log: (m) => console.log(`  ${m}`) });

// Ett anrop till Libris-modulen, med några nya försök om Libris inte svarar.
async function search(query, options) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await searchBooks(query, { fetchImpl, language: 'swe', skip: notABook, ...options });
    } catch (error) {
      if (attempt >= 3) throw error;
      console.log(`  ${error.message} Väntar och provar igen.`);
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }
}

const start = JSON.parse(readFileSync('public/startgalax.json', 'utf8'));
console.log(`Galaxen har ${start.books.length} böcker. Hoppar över dubbletter av dem.`);

const picks = []; // { book, source, group, selectionYear }
let chosen = createEmptyGalaxy(); // bara för att hitta dubbletter under körningen
const authorCount = new Map();
const rejected = new Map();
const reject = (reason) => rejected.set(reason, (rejected.get(reason) ?? 0) + 1);

// Hämtar alla svenska utgåvor av verket (tidigaste först), så att boken får
// alla ISBN och Libris-id som hittas, och så att året blir det första.
async function enrich(candidate) {
  const query = `${surnameOf(candidate.author)} ${candidate.title.split(/\s[:–—-]\s/)[0]}`;
  const { books } = await search(query, { limit: 25, sort: 'publication.year' });
  const hits = sameWorkHits(books, candidate);
  return mergeHits(candidate, hits);
}

// Prövar en kandidat. Svar: true om den blev en stjärna.
async function tryAdd(candidate, { source, group, selectionYear, window, capAuthor = true }) {
  if (!candidate.author) return reject('saknar författare'), false;
  if (existingWork(start, candidate)) return reject('finns redan i galaxen'), false;
  if (existingWork(chosen, candidate)) return reject('redan valt i ett annat urval'), false;
  const authorKey = normalizeAuthor(candidate.author);
  if (capAuthor && (authorCount.get(authorKey) ?? 0) >= MAX_PER_AUTHOR) return reject(`fler än ${MAX_PER_AUTHOR} böcker av samma författare`), false;

  const book = await enrich(candidate);
  // Nyutgåvor av gamla böcker hör inte hemma i ett urval av nyare böcker.
  if (window && book.year && book.year < window.from) return reject('nyutgåva av en äldre bok'), false;
  if (existingWork(start, book)) return reject('finns redan i galaxen'), false;
  if (existingWork(chosen, book)) return reject('redan valt i ett annat urval'), false;

  chosen = addBook(chosen, { ...book, genre: book.suggestedGenre, cover: null }).galaxy;
  authorCount.set(authorKey, (authorCount.get(authorKey) ?? 0) + 1);
  picks.push({ book, source, group, selectionYear });
  return true;
}

// --- 1. Augustpris ------------------------------------------------------

const august = JSON.parse(readFileSync('scripts/libris-urval/augustpris.json', 'utf8'));
const augustMissing = [];
console.log(`\n1. Augustpris-nominerade: ${august.entries.length} titlar i listan`);
for (const entry of august.entries) {
  const query = `${surnameOf(entry.author)} ${entry.title}`;
  const { books } = await search(query, { limit: 25, sort: 'publication.year' });
  const hits = books
    .filter((b) => sameAuthor(entry.author, b.author) && titleKey(b.title) === titleKey(entry.title))
    .sort((a, b) => b.holdings - a.holdings);
  if (!hits.length) {
    augustMissing.push(entry);
    continue;
  }
  const book = mergeHits(hits[0], hits.slice(1));
  // Böcker i listan räknas inte mot gränsen per författare, och inte mot något årsfönster.
  if (existingWork(start, book)) reject('finns redan i galaxen');
  else if (existingWork(chosen, book)) reject('redan valt i ett annat urval');
  else {
    chosen = addBook(chosen, { ...book, genre: book.suggestedGenre, cover: null }).galaxy;
    const key = normalizeAuthor(book.author);
    authorCount.set(key, (authorCount.get(key) ?? 0) + 1);
    picks.push({ book, source: 'augustpris', group: { skon: 'Skönlitteratur', fack: 'Fackbok', barn: 'Barn och unga' }[entry.category], selectionYear: entry.year });
  }
}
console.log(`   ${picks.length} nya, ${augustMissing.length} hittades inte på svenska i Libris`);

// --- 2 och 3. Skönlitteratur och barn och unga --------------------------

async function runSelection(selection, source) {
  console.log(`\n${selection.name} ${selection.from}–${selection.to}`);
  for (let year = selection.from; year <= selection.to; year++) {
    const before = picks.length;
    for (const group of selection.groups) {
      let got = 0;
      for (let page = 0; page < MAX_PAGES && got < group.per; page++) {
        const { books } = await search('*', {
          limit: PAGE,
          offset: page * PAGE,
          sort: '-reverseLinks.totalItems',
          filters: { 'publication.year': year, 'instanceOf.category.@id': librisTerm(group.scheme, group.term) },
          // Vuxenböckerna ska inte innehålla barnböcker, som också är "Skönlitteratur".
          skip: source === 'skonlitteratur' ? (e) => notABook(e) || isChildrens(e) : notABook,
        });
        books.sort((a, b) => b.holdings - a.holdings);
        for (const candidate of books) {
          if (got >= group.per) break;
          const ok = await tryAdd(candidate, {
            source,
            group: group.name,
            selectionYear: year,
            window: { from: selection.from },
          });
          if (ok) got++;
        }
      }
    }
    console.log(`  ${year}: ${picks.length - before} nya (hittills ${picks.length}, ${fetchImpl.stats.live} anrop till Libris)`);
  }
}
await runSelection(FICTION, 'skonlitteratur');
await runSelection(CHILDREN, 'barn');

// --- Gräns och galaxfil -------------------------------------------------

// Blir det fler än MAX_NEW tas de minst spridda böckerna ur skönlitteratur och
// barn bort. Augustpris-böckerna behålls.
let trimmed = 0;
if (picks.length > MAX_NEW) {
  const removable = picks.filter((p) => p.source !== 'augustpris').sort((a, b) => a.book.holdings - b.book.holdings);
  const drop = new Set(removable.slice(0, picks.length - MAX_NEW));
  trimmed = drop.size;
  for (let i = picks.length - 1; i >= 0; i--) if (drop.has(picks[i])) picks.splice(i, 1);
}

let galaxy = createEmptyGalaxy();
galaxy.description =
  'Urval från Libris: svenska böcker som lösa stjärnor, utan kopplingar. ' +
  'Augustpris-nominerade, svensk skönlitteratur 2015–2025 och barn- och ungdomsböcker 2010–2025, ' +
  'ur dem som flest bibliotek har. Taggarna är genrer enligt Libris förslag.';
for (const { book } of picks) {
  const { originalTitles, holdings, suggestedGenre, editions, ...candidate } = book;
  const added = addBook(galaxy, { ...candidate, genre: suggestedGenre, cover: null });
  galaxy = added.galaxy;
  if (suggestedGenre) galaxy = tagBook(galaxy, added.book.id, getGenre(suggestedGenre).name).galaxy;
}
// Ett sista varv mot startgalaxen, med de uppgifter som nu finns.
const clash = galaxy.books.filter((b) => existingWork(start, b));
if (clash.length) throw new Error(`${clash.length} böcker finns redan i startgalaxen, till exempel ${clash[0].title}.`);
if (galaxy.relations.length) throw new Error('Urvalet ska inte ha några kopplingar.');

writeFileSync('docs/libris-urval.json', `${JSON.stringify(galaxy, null, 1)}\n`);

// --- Rapporten ----------------------------------------------------------

const count = (list, key) => {
  const m = new Map();
  for (const x of list) m.set(key(x), (m.get(key(x)) ?? 0) + 1);
  return m;
};
const table = (m, sorter = (a, b) => b[1] - a[1]) => [...m].sort(sorter).map(([k, n]) => `| ${k} | ${n} |`).join('\n');
const bySource = count(picks, (p) => SOURCES[p.source]);
const byGenre = count(galaxy.books, (b) => (b.genre ? getGenre(b.genre).name : 'Genre saknas'));
const byYear = count(galaxy.books, (b) => b.year ?? 'okänt');
const withoutIsbn = galaxy.books.filter((b) => !b.isbns.length).length;
const isbnTotal = galaxy.books.reduce((n, b) => n + b.isbns.length, 0);
const idTotal = galaxy.books.reduce((n, b) => n + b.librisIds.length, 0);
const sourceOf = new Map(picks.map((p) => [`${p.book.title}|${p.book.author}`, p]));
const cell = (text) => String(text ?? '').replace(/\|/g, '/');
const sampleRows = sample(galaxy.books, 20, 2026)
  .map((b) => {
    const p = sourceOf.get(`${b.title}|${b.author}`);
    return `| ${cell(b.title)} | ${cell(b.author)} | ${b.year ?? ''} | ${b.genre ? getGenre(b.genre).name : 'saknas'} | ${p ? SOURCES[p.source] : ''} | ${b.isbns.length} | ${b.librisIds.length} |`;
  })
  .join('\n');

const report = `# Urval från Libris

Skapad av \`scripts/libris-urval/urval.mjs\` ${new Date().toISOString().slice(0, 10)}. Kör skriptet igen för att göra om den. Filen \`docs/libris-urval.json\` läggs in med **Galaxfil → Slå ihop med en fil**. \`public/startgalax.json\` är inte ändrad.

## Siffror

- Nya stjärnor: **${galaxy.books.length}** (galaxen har ${start.books.length}, så det blir ${start.books.length + galaxy.books.length} efter sammanslagningen)
- Kopplingar och motiveringar: 0
- ISBN: ${isbnTotal} (${withoutIsbn} böcker saknar ISBN i de utgåvor som hittades). Libris-id: ${idTotal}
- Böcker utan genreförslag från Libris: ${galaxy.books.filter((b) => !b.genre).length}
- Borttagna för att gränsen på ${MAX_NEW} nåddes: ${trimmed}
- Anrop till Libris: ${fetchImpl.stats.live} nya, ${fetchImpl.stats.cached} från cachen, ${fetchImpl.stats.retries} omförsök

| Urval | Böcker |
| --- | --- |
${table(bySource)}

| Genre (Libris förslag, också taggen) | Böcker |
| --- | --- |
${table(byGenre)}

| Första utgivningsår | Böcker |
| --- | --- |
${table(byYear, (a, b) => String(a[0]).localeCompare(String(b[0])))}

## Så är urvalet gjort

- **Skönlitteratur och barn och unga:** för varje år och genre (se \`urval.mjs\`) de svenska utgåvor som flest bibliotek har enligt Libris, med högst ${MAX_PER_AUTHOR} böcker per författare. Det är ett mått på spridning, inte på kvalitet. Översättningar till svenska ingår.
- **Augustpris:** böckerna står i \`scripts/libris-urval/augustpris.json\`. **Listan är ofullständig** (${august.entries.length} titlar, ${august.entries.length - augustMissing.length} funna i Libris). Libris har inget fält för priset, och sidorna på SVT, Sveriges Radio och Wikipedia gick inte att läsa när listan skrevs. Titlarna är de som webbsökning och minne var överens om. Skriptet kontrollerar bara att boken finns på svenska i Libris, inte att nomineringen stämmer. **Granska listan mot augustpriset.se och fyll på**, och kör sedan skriptet igen.
- **Hoppade över:** recensioner, ljudböcker, filmer, böcker *om* en annan bok (Libris-modulens flaggor \`isReview\`, \`isAudio\`, \`isAboutBook\`), böcker utan författare, nyutgåvor av böcker som kom före urvalets första år, och dubbletter.
- **Dubbletter** av böcker som redan finns i \`public/startgalax.json\` avgörs med \`findSameWork\`, och dessutom på originaltiteln, så att en svensk utgåva av en bok som ligger där på engelska inte blir en ny stjärna.
- **Ett verk, inte en utgåva:** varje bok har alla ISBN och Libris-id från de utgåvor som hittades (de 25 äldsta svenska utgåvorna av verket). Året är den första svenska utgåvan i Libris, inte nödvändigtvis originalets.
- **Genre** är Libris förslag. Det kan vara fel, till exempel kan en vuxenbok som Libris också märker "ungdom" hamna under Barn och unga. Bibliotekarien kan ändra genren i byggläget.

Avvisade kandidater:

| Orsak | Antal |
| --- | --- |
${table(rejected)}

## Stickprov på 20 böcker

| Titel | Författare | År | Genre | Urval | ISBN | Libris-id |
| --- | --- | --- | --- | --- | --- | --- |
${sampleRows}

## Augustpris-titlar som inte hittades på svenska i Libris

${augustMissing.length ? `Kontrollera stavningen i \`augustpris.json\`.\n\n| År | Författare | Titel |\n| --- | --- | --- |\n${augustMissing.map((e) => `| ${e.year} | ${e.author} | ${e.title} |`).join('\n')}` : 'Alla hittades.'}
`;
writeFileSync('docs/libris-urval.md', report);

console.log(`\nKlart: ${galaxy.books.length} nya böcker (${[...bySource].map(([k, n]) => `${k} ${n}`).join(', ')}).`);
console.log(`Libris: ${fetchImpl.stats.live} anrop, ${fetchImpl.stats.cached} från cachen.`);
console.log('Skrev docs/libris-urval.json och docs/libris-urval.md');
