// Den enda vägen till Libris. Resten av koden anropar bara searchBooks().
// Libris XL provas först, Xsearch är reserven. Vill man byta källa, eller
// lägga en serverfunktion emellan, görs det här och ingen annanstans.

import { searchXl } from './xl.js';
import { searchXsearch } from './xsearch.js';
import { workKey, normalizeIsbn } from '../data/normalize.js';

const TIMEOUT_MS = 12000;

// Libris svarar med utgåvor. Här slås utgåvor av samma verk ihop till en
// träff: samma verk i XL, eller samma titel och författare.
export function groupEditions(editions) {
  const groups = [];
  for (const edition of editions) {
    const key = workKey(edition.title, edition.author);
    const group = groups.find(
      (g) => g.key === key || g.book.librisWorkIds.some((id) => edition.librisWorkIds.includes(id)),
    );
    if (!group) {
      groups.push({
        key,
        book: {
          ...edition,
          isbns: [...new Set(edition.isbns.map(normalizeIsbn))],
          editions: 1,
        },
      });
      continue;
    }
    const b = group.book;
    b.isbns = [...new Set([...b.isbns, ...edition.isbns.map(normalizeIsbn)])];
    b.librisIds = [...new Set([...b.librisIds, ...edition.librisIds])];
    b.librisWorkIds = [...new Set([...b.librisWorkIds, ...edition.librisWorkIds])];
    b.subjects = [...new Set([...b.subjects, ...edition.subjects])];
    b.languages = [...new Set([...(b.languages ?? []), ...(edition.languages ?? [])])];
    b.originalTitles = [...new Set([...(b.originalTitles ?? []), ...(edition.originalTitles ?? [])])];
    b.genreHints = [...new Set([...b.genreHints, ...edition.genreHints])];
    b.suggestedGenre = b.suggestedGenre ?? edition.suggestedGenre;
    b.year = b.year && edition.year ? Math.min(b.year, edition.year) : b.year ?? edition.year;
    b.author = b.author || edition.author;
    b.editions += 1;
  }
  return groups.map((g) => g.book);
}

async function withTimeout(run, signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

// Söker på titel, författare eller ISBN.
// Svar: { books, source }. Varje bok har title, author, year, isbns,
// librisIds, librisWorkIds, subjects, genreHints, suggestedGenre, cover
// och editions (antal utgåvor som slogs ihop).
// Kastar fel om varken XL eller Xsearch svarar.
//
// Med language (till exempel 'swe') visas bara utgåvor på det språket, och
// med familyName bara utgåvor där någon med det efternamnet medverkar. Det
// klarar bara XL, så då provas inte Xsearch. limit och offset styr hur många
// utgåvor som hämtas och varifrån, för den som behöver bläddra.
export async function searchBooks(query, { signal, fetchImpl, language, familyName, limit, offset } = {}) {
  const q = String(query ?? '').trim();
  if (!q) return { books: [], source: null };
  const options = fetchImpl ? { fetchImpl } : {};
  const xlOptions = { ...options, language, familyName, ...(limit ? { limit } : {}), ...(offset ? { offset } : {}) };

  try {
    const editions = await withTimeout((s) => searchXl(q, { ...xlOptions, signal: s }), signal);
    return { books: groupEditions(editions), source: 'xl' };
  } catch (error) {
    if (signal?.aborted) throw error;
    if (language || familyName) throw new Error('Libris XL svarar inte just nu. Försök igen om en stund.');
  }
  try {
    const editions = await withTimeout((s) => searchXsearch(q, { ...options, signal: s }), signal);
    return { books: groupEditions(editions), source: 'xsearch' };
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Libris svarar inte just nu. Försök igen om en stund.');
  }
}
