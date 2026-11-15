// Rena hjälpfunktioner för urvalsskriptet. Inga anrop till Libris här, så att
// de går att testa (tests/libris-urval.test.js).

import { findSameWork } from '../../src/data/model.js';
import { workKey, normalizeAuthor } from '../../src/data/normalize.js';
import { titleKey } from '../goodreads/match.js';

export const librisTerm = (scheme, term) => `https://id.kb.se/term/${scheme}/${encodeURIComponent(term)}`;

// Det som aldrig ska bli en stjärna: recensioner, ljudböcker, böcker *om* en
// annan bok. Filmer och annat som inte är text sorterar Libris-modulen bort.
export function notABook(edition) {
  return Boolean(edition.isReview || edition.isAudio || edition.isAboutBook);
}

export function isChildrens(edition) {
  return edition.suggestedGenre === 'barn-unga' || edition.genreHints.some((h) => /barn- och ungdomslitteratur/i.test(h));
}

export function surnameOf(author) {
  const text = String(author ?? '').trim();
  // "Smirnoff, Karin" har efternamnet först, "Karin Smirnoff" sist.
  const last = text.includes(',') ? text.split(',')[0] : text.split(/\s+/).filter(Boolean).pop() ?? '';
  // Ett efternamn med bindestreck ("Sem-Sandberg") söks som det är.
  return normalizeAuthor(last);
}

export function sameAuthor(wantedAuthor, librisAuthor) {
  const want = surnameOf(wantedAuthor).split(' ').filter(Boolean);
  const have = new Set(normalizeAuthor(librisAuthor).split(' '));
  return want.length > 0 && want.every((w) => have.has(w));
}

// Är det här samma verk som en bok som redan finns i galaxen? Först med
// findSameWork (ISBN, Libris-id, verks-id, titel och författare). Sedan också
// på originaltiteln: den svenska "Hobbiten" är samma verk som en engelsk
// "The Hobbit" som redan ligger i galaxen.
export function existingWork(galaxy, candidate) {
  const same = findSameWork(galaxy, candidate);
  if (same) return same;
  for (const original of candidate.originalTitles ?? []) {
    const key = workKey(original, candidate.author);
    const hit = galaxy.books.find((b) => workKey(b.title, b.author) === key);
    if (hit) return hit;
  }
  return null;
}

// Alla utgåvor (grupperade till verk) i ett svar som är samma verk som
// candidate. Används för att få med alla ISBN, Libris-id och det tidigaste året.
export function sameWorkHits(books, candidate) {
  const key = titleKey(candidate.title);
  const ids = new Set(candidate.librisWorkIds ?? []);
  return books.filter(
    (b) =>
      sameAuthor(candidate.author, b.author) &&
      (titleKey(b.title) === key || (b.librisWorkIds ?? []).some((id) => ids.has(id))),
  );
}

// Det genreförslag som flest utgåvor har.
function commonGenre(works) {
  const counts = new Map();
  for (const w of works) if (w.suggestedGenre) counts.set(w.suggestedGenre, (counts.get(w.suggestedGenre) ?? 0) + (w.editions ?? 1));
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export function mergeHits(candidate, hits) {
  const all = (key) => [...new Set([candidate, ...hits].flatMap((h) => h[key] ?? []))];
  const years = [candidate, ...hits].map((h) => h.year).filter(Number.isFinite);
  return {
    ...candidate,
    suggestedGenre: commonGenre([candidate, ...hits]),
    isbns: all('isbns'),
    librisIds: all('librisIds'),
    librisWorkIds: all('librisWorkIds'),
    subjects: all('subjects'),
    originalTitles: all('originalTitles'),
    year: years.length ? Math.min(...years) : candidate.year,
    holdings: Math.max(...[candidate, ...hits].map((h) => h.holdings ?? 0)),
  };
}

// Ett litet slumptal med frö, så att stickprovet i rapporten blir detsamma
// vid varje körning.
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sample(list, n, seed = 1) {
  const random = seededRandom(seed);
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}
