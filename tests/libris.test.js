import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseXlItem } from '../src/libris/xl.js';
import { parseXsearchRecord } from '../src/libris/xsearch.js';
import { groupEditions, searchBooks } from '../src/libris/index.js';
import { suggestGenre } from '../src/libris/genre.js';

// Riktiga svar från Libris, sparade 2026-11-14 och nedbantade.
const xl = JSON.parse(readFileSync(new URL('./fixtures/xl-smirnoff.json', import.meta.url)));
const xsearch = JSON.parse(readFileSync(new URL('./fixtures/xsearch-aniara.json', import.meta.url)));
const response = (data, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => data });

test('XL: en post blir en bokkandidat med verk, ISBN, ämnesord och genreförslag', () => {
  const book = parseXlItem(xl.items[1]);
  assert.equal(book.title, 'Jag for ner till bror');
  assert.equal(book.author, 'Karin Smirnoff');
  assert.equal(book.year, 2018);
  assert.deepEqual(book.isbns, ['9789177950981']);
  assert.deepEqual(book.librisWorkIds, ['6pzc3mwr4g4kw562']);
  assert.ok(book.subjects.includes('Syskonrelationer'));
  assert.ok(book.genreHints.includes('Romaner'));
  assert.equal(book.suggestedGenre, 'roman');
  assert.equal(book.cover, null);
});

test('utgåvor av samma verk slås ihop till en träff', () => {
  const books = groupEditions(xl.items.map(parseXlItem));
  assert.equal(books.length, 1, 'även talboken utan verkskoppling hamnar rätt, via titel och författare');
  assert.equal(books[0].editions, 4);
  assert.equal(books[0].isbns.length, 4);
});

test('Xsearch: namn vänds och utgåvor slås ihop', () => {
  const editions = xsearch.xsearch.list.map(parseXsearchRecord);
  assert.equal(editions[0].author, 'Harry Martinson');
  assert.equal(editions[1].year, 1974);
  const books = groupEditions(editions);
  assert.equal(books.length, 1);
  assert.equal(books[0].year, 1963);
});

test('sökningen går över till Xsearch när XL inte svarar', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return url.includes('find.jsonld') ? response({}, false) : response(xsearch);
  };
  const result = await searchBooks('Aniara', { fetchImpl });
  assert.equal(result.source, 'xsearch');
  assert.equal(result.books[0].title, 'Aniara : en revy om människan i tid och rum');
  assert.equal(calls.length, 2);

  const xlResult = await searchBooks('Smirnoff', { fetchImpl: async () => response(xl) });
  assert.equal(xlResult.source, 'xl');
  await assert.rejects(searchBooks('x', { fetchImpl: async () => response({}, false) }), /Libris svarar inte/);
});

test('genreförslag', () => {
  assert.equal(suggestGenre({ genreForms: ['Deckare'], sab: ['Hc.01'] }), 'spanning');
  assert.equal(suggestGenre({ genreForms: ['Fantasy'], sab: ['uHc'] }), 'barn-unga');
  assert.equal(suggestGenre({ sab: ['Hc.03'] }), 'lyrik');
  assert.equal(suggestGenre({ sab: ['Lz Martinson, Harry'] }), 'biografi');
  assert.equal(suggestGenre({ sab: ['Qb'] }), 'fakta');
  assert.equal(suggestGenre({}), null);
});
