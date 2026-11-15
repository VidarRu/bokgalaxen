// Letar upp den svenska utgåvan av en bok från Goodreads. Alla anrop går
// genom Libris-modulen (src/libris), med språkfiltret 'swe'.
//
// Ordning:
//   1. Har boken ett ISBN och är den utgåvan svensk, används den.
//   2. Sökning på författarens efternamn och titeln, bara svenska utgåvor.
//      Träff om titeln eller originaltiteln stämmer.
//   3. Alla svenska utgåvor av författaren, och samma jämförelse.
// Utgåvor av samma verk slås ihop till en bok.

import { searchBooks } from '../../src/libris/index.js';
import { normalizeIsbn } from '../../src/data/normalize.js';

function clean(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' och ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Jämför titlar utan undertitel, skiljetecken och inledande artikel.
export function titleKey(title) {
  const main = String(title ?? '').split(/\s*[:;]\s|\s[–—-]\s|\s*\/\s*/)[0];
  return clean(main)
    .replace(/^(the|a|an|le|la|les|der|die|das|el|il)\s+/, '')
    .replace(/\boch\b/g, 'and');
}

function surname(author) {
  const parts = clean(author).split(' ').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

function authorMatches(goodreadsAuthor, librisAuthor) {
  const want = surname(goodreadsAuthor);
  if (!want) return false;
  return clean(librisAuthor).split(' ').includes(want);
}

function titleMatches(book, wanted) {
  const keys = [book.title, ...(book.originalTitles ?? [])].map(titleKey).filter(Boolean);
  return keys.includes(wanted);
}

// Flera träffar kan vara samma verk (till exempel "Ensam på Mars" och en
// utgåva som behöll titeln "The Martian"). De slås ihop. Titeln tas från den
// träff som har flest utgåvor, och helst en titel som inte bara är originalet.
//
// En samlingsvolym på svenska (till exempel "Krönikorna om Thomas Covenant",
// med tre romaner i en bok) har flera originaltitlar. Finns boken också som
// egen volym används den, annars samlingsvolymen. Då blir flera böcker från
// Goodreads en och samma stjärna.
function isOmnibus(hit) {
  return new Set((hit.originalTitles ?? []).map(titleKey)).size > 1;
}

function combine(allHits, goodreads) {
  const single = allHits.filter((h) => !isOmnibus(h));
  const hits = single.length ? single : allHits;
  const english = titleKey(goodreads.title);
  const ranked = [...hits].sort((a, b) => {
    const aSwedish = titleKey(a.title) !== english || !(a.originalTitles ?? []).length ? 1 : 0;
    const bSwedish = titleKey(b.title) !== english || !(b.originalTitles ?? []).length ? 1 : 0;
    return bSwedish - aSwedish || b.editions - a.editions || (a.year ?? 9999) - (b.year ?? 9999);
  });
  const main = ranked[0];
  const all = (key) => [...new Set(hits.flatMap((h) => h[key] ?? []))];
  return {
    title: main.title.replace(/[\s;:/,.]+$/, ''),
    author: main.author || goodreads.author,
    year: goodreads.year ?? Math.min(...hits.map((h) => h.year ?? 9999)),
    isbns: all('isbns').map(normalizeIsbn),
    librisIds: all('librisIds'),
    librisWorkIds: all('librisWorkIds'),
    subjects: all('subjects'),
    genre: hits.map((h) => h.suggestedGenre).find(Boolean) ?? null,
    originalTitles: all('originalTitles'),
    editions: hits.reduce((n, h) => n + h.editions, 0),
  };
}

async function swedish(query, search, limit = 20) {
  const { books } = await search(query, { language: 'swe', limit });
  return books;
}

export async function findSwedishEdition(goodreads, { fetchImpl, authorCache = new Map() } = {}) {
  const search = (q, opts) => searchBooks(q, { ...opts, fetchImpl });
  const wanted = titleKey(goodreads.title);
  const sameAuthor = (b) => authorMatches(goodreads.author, b.author);

  // 1. ISBN
  if (goodreads.isbn) {
    const byIsbn = (await swedish(goodreads.isbn, search, 5)).filter(sameAuthor);
    if (byIsbn.length) {
      // Hämta övriga svenska utgåvor av samma verk.
      const more = (await swedish(`${surname(goodreads.author)} ${byIsbn[0].title}`, search)).filter(
        (b) => sameAuthor(b) && titleKey(b.title) === titleKey(byIsbn[0].title),
      );
      return { how: 'isbn', book: combine([...byIsbn, ...more], goodreads) };
    }
  }

  // 2. Efternamn och titel
  const direct = (await swedish(`${surname(goodreads.author)} ${goodreads.title.split(':')[0]}`, search)).filter(
    (b) => sameAuthor(b) && titleMatches(b, wanted),
  );
  if (direct.length) return { how: 'titel', book: combine(direct, goodreads) };

  // 3. Allt på svenska där författarens efternamn finns med. Sökordet är
  //    förnamnet, så att andra med samma efternamn sorteras bort.
  const name = goodreads.author;
  if (!authorCache.has(name)) {
    const parts = name.split(' ').filter(Boolean);
    const familyName = parts[parts.length - 1];
    const pages = [];
    for (let offset = 0; offset < 300; offset += 50) {
      const { books } = await search(parts.length > 1 ? parts[0] : '*', { language: 'swe', familyName, limit: 50, offset });
      pages.push(...books);
      if (!books.length) break;
    }
    authorCache.set(name, pages);
  }
  const byAuthor = authorCache.get(name).filter((b) => sameAuthor(b) && titleMatches(b, wanted));
  if (byAuthor.length) return { how: 'författare', book: combine(byAuthor, goodreads) };

  // 4. Osäker träff: samma författare och minst två gemensamma ord i titeln,
  //    till exempel "The Count of Monte Cristo" och "Greven av Monte-Cristo".
  //    Märks som osäker i rapporten.
  const words = (t) => new Set(titleKey(t).split(' ').filter((w) => w.length >= 4));
  const want = words(goodreads.title);
  const loose = authorCache
    .get(name)
    .filter((b) => sameAuthor(b))
    .filter((b) =>
      [b.title, ...(b.originalTitles ?? [])].some((t) => {
        const have = words(t);
        const shared = [...want].filter((w) => have.has(w)).length;
        return shared >= 2 && shared >= Math.min(want.size, have.size) * 0.6;
      }),
    );
  if (loose.length) return { how: 'osäker', book: combine(loose, goodreads) };

  return { how: null, book: null };
}
