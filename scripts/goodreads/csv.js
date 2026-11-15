// En liten CSV-läsare för Goodreads export. Klarar citattecken, kommatecken
// och radbrytningar inne i fält. Inget extra paket behövs.

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const input = String(text).replace(/^﻿/, '');
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((f) => f !== ''));
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

// Goodreads skriver ISBN som ="9789113073132". Det blir 9789113073132.
function cleanIsbn(value) {
  return String(value ?? '').replace(/[="\s]/g, '');
}

// "Going Postal (Discworld, #33; Moist von Lipwig, #1)" blir titeln
// "Going Postal" och två serier.
export function splitSeries(rawTitle) {
  const match = String(rawTitle).match(/^(.*?)\s*\(([^()]*#[^()]*)\)\s*$/);
  if (!match) return { title: String(rawTitle).trim(), series: [] };
  const series = match[2]
    .split(';')
    .map((part) => part.trim().match(/^(.*?),?\s*#\s*([\d.]+)/))
    .filter(Boolean)
    .map((m) => ({ name: m[1].trim(), number: Number(m[2]) }))
    .filter((s) => s.name && Number.isFinite(s.number));
  return { title: match[1].trim(), series };
}

const RATING_WORDS = { 1: 'en', 2: 'två', 3: 'tre', 4: 'fyra', 5: 'fem' };
export function ratingWord(n) {
  return RATING_WORDS[n] ?? String(n);
}

// Gör om en rad i exporten till det importen behöver.
export function readGoodreadsRow(row) {
  const { title, series } = splitSeries(row.Title);
  const year = Number.parseInt(row['Original Publication Year'] || row['Year Published'], 10);
  return {
    goodreadsId: row['Book Id'],
    rawTitle: row.Title,
    title,
    series,
    author: String(row.Author ?? '').replace(/\s+/g, ' ').replace(/,?\s+(Jr|Sr)\.?$/, '').trim(),
    translatorListed: /translator/i.test(row['Additional Authors'] ?? ''),
    isbn: cleanIsbn(row.ISBN13) || cleanIsbn(row.ISBN),
    rating: Number.parseInt(row['My Rating'], 10) || 0,
    year: Number.isFinite(year) ? year : null,
    shelf: row['Exclusive Shelf'],
    dateRead: row['Date Read'] || row['Date Added'] || '',
  };
}
