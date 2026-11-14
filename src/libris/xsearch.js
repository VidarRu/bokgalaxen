// Libris Xsearch: https://libris.kb.se/xsearch
// Reserven. Små och snabba svar, men utan ämnesord, genre och verkskoppling.
// KB har sagt att Xsearch ska ersättas av Libris XL:s API:er.

const ENDPOINT = 'https://libris.kb.se/xsearch';

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function asList(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

// "Martinson, Harry, 1904-1978" → "Harry Martinson"
export function flipName(creator) {
  const parts = String(creator ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && !/^\d{4}/.test(p));
  if (parts.length >= 2) return `${parts[1]} ${parts[0]}`;
  return parts[0] ?? '';
}

export function parseXsearchRecord(record) {
  const title = first(record.title);
  if (!title) return null;
  const years = asList(record.date)
    .map((d) => Number.parseInt(String(d).replace(/\D/g, '').slice(0, 4), 10))
    .filter((y) => Number.isFinite(y) && y > 1000);
  return {
    title: String(title).trim(),
    author: flipName(first(record.creator)),
    year: years.length ? Math.min(...years) : null,
    isbns: asList(record.isbn).map(String),
    librisIds: [String(record.identifier ?? '').split('/').pop()].filter(Boolean),
    librisWorkIds: [],
    subjects: [],
    genreHints: [],
    suggestedGenre: null,
    cover: null,
    isText: record.type === 'book' || record.type === 'text',
    source: 'xsearch',
  };
}

export async function searchXsearch(query, { limit = 20, signal, fetchImpl = fetch } = {}) {
  const params = new URLSearchParams({ query, format: 'json', n: String(limit) });
  const response = await fetchImpl(`${ENDPOINT}?${params}`, { signal });
  if (!response.ok) throw new Error(`Libris Xsearch svarade ${response.status}`);
  const data = await response.json();
  return asList(data.xsearch?.list)
    .map(parseXsearchRecord)
    .filter((b) => b && b.isText);
}
