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

// Det genreförslag som flest utgåvor har.
function mostCommon(values) {
  const counts = new Map();
  for (const v of values.filter(Boolean)) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
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
    genre: mostCommon(hits.flatMap((h) => Array(h.editions).fill(h.suggestedGenre))),
    originalTitles: all('originalTitles'),
    editions: hits.reduce((n, h) => n + h.editions, 0),
  };
}

export async function findSwedishEdition(goodreads, options = {}) {
  return findEdition(goodreads, { ...options, language: 'swe' });
}

// Samma sökning, men för utgåvor på ett annat språk, till exempel 'eng' för
// böcker som inte finns översatta till svenska.
export async function findEdition(goodreads, { fetchImpl, authorCache = new Map(), language = 'swe' } = {}) {
  const search = (q, opts) => searchBooks(q, { ...opts, fetchImpl });
  const swedish = async (query, _search, limit = 20) => (await search(query, { language, limit })).books;
  const wanted = titleKey(goodreads.title);
  const sameAuthor = (b) => authorMatches(goodreads.author, b.author);

  // 1. ISBN
  if (goodreads.isbn) {
    const byIsbn = (await swedish(goodreads.isbn, search, 5)).filter(sameAuthor);
    if (byIsbn.length) {
      // Hämta övriga utgåvor av samma verk, men bara om titeln i Libris är
      // samma som på Goodreads. Annars kan Libris titel vara för allmän, till
      // exempel "The Sandman" för alla tio volymerna, och då blandas de ihop.
      // För engelska jämförs hela titeln, med undertitel.
      const key = language === 'swe' ? titleKey : (t) => clean(t).replace(/^(the|a|an)\s+/, '');
      const sameTitle = [byIsbn[0].title, ...(byIsbn[0].originalTitles ?? [])].map(key).includes(key(goodreads.title));
      const more = sameTitle
        ? (await swedish(`${surname(goodreads.author)} ${byIsbn[0].title}`, search)).filter(
            (b) => sameAuthor(b) && titleKey(b.title) === titleKey(byIsbn[0].title),
          )
        : [];
      const book = combine([...byIsbn, ...more], goodreads);
      // Med en allmän titel kan Libris ha slagit ihop flera volymer i svaret.
      // Då behålls bara bokens eget ISBN, och inga Libris-id som kan höra till
      // andra volymer.
      if (!sameTitle) Object.assign(book, { isbns: [normalizeIsbn(goodreads.isbn)], librisIds: [], librisWorkIds: [] });
      return { how: 'isbn', book };
    }
  }

  // En engelsk titel med undertitel ("The Sandman: Overture") kan inte
  // jämföras säkert, eftersom Libris ofta bara har huvudtiteln ("The
  // Sandman"). Då räcker bara en träff på ISBN. Utan träff används
  // uppgifterna från Goodreads.
  if (language !== 'swe' && /:/.test(goodreads.title)) return { how: null, book: null };

  // 2. Efternamn och titel
  const direct = (await swedish(`${surname(goodreads.author)} ${goodreads.title.split(':')[0]}`, search)).filter(
    (b) => sameAuthor(b) && titleMatches(b, wanted),
  );
  if (direct.length) return { how: 'titel', book: combine(direct, goodreads) };

  // 3. Allt på svenska där författarens efternamn finns med. Sökordet är
  //    förnamnet, så att andra med samma efternamn sorteras bort.
  const name = `${language}|${goodreads.author}`;
  if (!authorCache.has(name)) {
    const parts = goodreads.author.split(' ').filter(Boolean);
    const familyName = parts[parts.length - 1];
    const pages = [];
    for (let offset = 0; offset < 300; offset += 50) {
      const { books } = await search(parts.length > 1 ? parts[0] : '*', { language, familyName, limit: 50, offset });
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
