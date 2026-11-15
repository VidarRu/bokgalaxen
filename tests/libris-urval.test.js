import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parseXlItem } from '../src/libris/xl.js';
import { searchBooks } from '../src/libris/index.js';
import { createEmptyGalaxy, addBook } from '../src/data/model.js';
import { createLibrisFetch } from '../scripts/libris-urval/fetch.js';
import {
  librisTerm,
  notABook,
  surnameOf,
  sameAuthor,
  existingWork,
  sameWorkHits,
  mergeHits,
  sample,
} from '../scripts/libris-urval/pick.js';

const xl = JSON.parse(readFileSync(new URL('./fixtures/xl-smirnoff.json', import.meta.url)));
const response = (data) => ({ ok: true, status: 200, json: async () => data });

test('Libris-modulen: filter och sortering skickas vidare, och holdings summeras', async () => {
  const urls = [];
  const fetchImpl = async (url) => (urls.push(String(url)), response({ items: xl.items }));
  const { books } = await searchBooks('*', {
    fetchImpl,
    language: 'swe',
    sort: '-reverseLinks.totalItems',
    filters: { 'publication.year': 2018, 'instanceOf.category.@id': librisTerm('saogf', 'Skönlitteratur') },
  });
  const url = new URL(urls[0]);
  assert.equal(url.searchParams.get('_sort'), '-reverseLinks.totalItems');
  assert.equal(url.searchParams.get('publication.year'), '2018');
  // Termens id är procentkodat i Libris, så det kodas en gång till i frågan.
  assert.equal(url.searchParams.get('instanceOf.category.@id'), 'https://id.kb.se/term/saogf/Sk%C3%B6nlitteratur');
  assert.equal(books.length, 1);
  assert.equal(typeof books[0].holdings, 'number');
});

test('Libris-modulen: skip tar bort utgåvor innan de slås ihop', async () => {
  const fetchImpl = async () => response({ items: xl.items });
  const all = await searchBooks('Smirnoff', { fetchImpl, language: 'swe' });
  const none = await searchBooks('Smirnoff', { fetchImpl, language: 'swe', skip: () => true });
  assert.equal(all.books.length, 1);
  assert.equal(none.books.length, 0);
});

test('Libris-modulen: en vanlig sökning ändras inte av de nya valen', async () => {
  const urls = [];
  await searchBooks('Smirnoff', { fetchImpl: async (u) => (urls.push(String(u)), response({ items: [] })) });
  assert.ok(!urls[0].includes('_sort'));
});

test('flaggor: recension, ljudbok och bok om en bok känns igen', () => {
  const base = parseXlItem(xl.items[1]);
  assert.equal(notABook(base), false);
  assert.equal(notABook({ ...base, isReview: true }), true);
  assert.equal(notABook({ ...base, isAudio: true }), true);
  assert.equal(notABook({ ...base, isAboutBook: true }), true);

  const item = structuredClone(xl.items[1]);
  item.hasTitle = [{ mainTitle: 'Recension av: Smirnoff, Karin: Jag for ner till bror' }];
  assert.equal(parseXlItem(item).isReview, true);

  const about = structuredClone(xl.items[1]);
  about.instanceOf.subject = [...(about.instanceOf.subject ?? []), { '@type': 'Work', hasTitle: [{ mainTitle: 'Aniara' }] }];
  assert.equal(parseXlItem(about).isAboutBook, true);
});

test('efternamn och författare', () => {
  assert.equal(surnameOf('Karin Smirnoff'), 'smirnoff');
  assert.equal(surnameOf('Smirnoff, Karin'), 'smirnoff');
  assert.ok(sameAuthor('Steve Sem-Sandberg', 'Sem-Sandberg, Steve, 1958-'));
  assert.ok(!sameAuthor('Steve Sem-Sandberg', 'Steve Berg'));
  assert.ok(sameAuthor('Karin Smirnoff', 'Smirnoff, Karin, 1964-'));
  assert.ok(!sameAuthor('Karin Smirnoff', 'Karin Boye'));
});

test('dubblett: samma verk, och samma verk under originaltiteln', () => {
  let galaxy = createEmptyGalaxy();
  galaxy = addBook(galaxy, { title: 'The Hobbit', author: 'J.R.R. Tolkien', isbns: ['9780261102217'] }).galaxy;
  galaxy = addBook(galaxy, { title: 'Aniara', author: 'Harry Martinson', isbns: [] }).galaxy;

  assert.ok(existingWork(galaxy, { title: 'Aniara : en revy om människan', author: 'Martinson, Harry', isbns: [] }));
  assert.ok(existingWork(galaxy, { title: 'Hobbiten', author: 'J.R.R. Tolkien', isbns: [], originalTitles: ['The Hobbit'] }));
  assert.equal(existingWork(galaxy, { title: 'Sagan om ringen', author: 'J.R.R. Tolkien', isbns: [], originalTitles: ['The Fellowship of the Ring'] }), null);
});

test('utgåvor av samma verk slås ihop med alla ISBN, Libris-id och det tidigaste året', () => {
  const candidate = { title: 'Mio, min Mio', author: 'Astrid Lindgren', isbns: ['1'], librisIds: ['a'], librisWorkIds: [], subjects: [], originalTitles: [], year: 2020, holdings: 191, editions: 1, suggestedGenre: 'barn-unga' };
  const older = { ...candidate, isbns: ['2'], librisIds: ['b'], year: 1954, holdings: 80, editions: 2 };
  const other = { ...candidate, title: 'Ronja Rövardotter', isbns: ['3'] };
  const hits = sameWorkHits([older, other], candidate);
  assert.deepEqual(hits, [older]);
  const merged = mergeHits(candidate, hits);
  assert.equal(merged.year, 1954);
  assert.deepEqual(merged.isbns, ['1', '2']);
  assert.deepEqual(merged.librisIds, ['a', 'b']);
  assert.equal(merged.holdings, 191);
});

test('stickprovet är detsamma varje gång', () => {
  const list = Array.from({ length: 100 }, (_, i) => i);
  assert.deepEqual(sample(list, 5, 7), sample(list, 5, 7));
  assert.equal(new Set(sample(list, 20, 7)).size, 20);
});

test('hämtningen sparar svar i cachen och frågar inte om', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'libris-urval-'));
  try {
    const realFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => (calls++, { ok: true, status: 200, json: async () => ({ hej: 1 }) });
    try {
      const politeFetch = createLibrisFetch({ cacheDir: dir, pauseMs: 0 });
      const a = await (await politeFetch('https://libris.kb.se/x')).json();
      const b = await (await politeFetch('https://libris.kb.se/x')).json();
      assert.deepEqual(a, { hej: 1 });
      assert.deepEqual(b, { hej: 1 });
      assert.equal(calls, 1);
      assert.deepEqual({ live: politeFetch.stats.live, cached: politeFetch.stats.cached }, { live: 1, cached: 1 });
    } finally {
      globalThis.fetch = realFetch;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('hämtningen går ett anrop i taget och provar igen vid 429', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'libris-urval-'));
  try {
    const realFetch = globalThis.fetch;
    let active = 0;
    let maxActive = 0;
    let first = true;
    globalThis.fetch = async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      if (first) return (first = false), { ok: false, status: 429, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({}) };
    };
    try {
      const politeFetch = createLibrisFetch({ cacheDir: dir, pauseMs: 0 });
      const realSetTimeout = globalThis.setTimeout;
      // Korta ner väntan vid omförsök så att testet går fort.
      globalThis.setTimeout = (fn, ms, ...rest) => realSetTimeout(fn, ms > 1000 ? 1 : ms, ...rest);
      try {
        await Promise.all([politeFetch('https://libris.kb.se/a'), politeFetch('https://libris.kb.se/b'), politeFetch('https://libris.kb.se/c')]);
      } finally {
        globalThis.setTimeout = realSetTimeout;
      }
      assert.equal(maxActive, 1);
      assert.equal(politeFetch.stats.retries, 1);
    } finally {
      globalThis.fetch = realFetch;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
