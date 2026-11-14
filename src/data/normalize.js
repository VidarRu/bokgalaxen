// Normalisering av titel och författare, så att olika utgåvor av samma verk
// känns igen som samma bok. Används av datamodellen, sammanslagningen och
// Libris-modulen.

function clean(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFC')
    .replace(/[‐-―]/g, '-')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// "Jag for ner till bror : roman" och "Jag for ner till bror" är samma verk.
// Undertiteln efter kolon eller tankstreck räknas därför inte med.
export function normalizeTitle(title) {
  const main = String(title ?? '').split(/\s[:–—]\s|\s-\s/)[0];
  return clean(main);
}

// "Martinson, Harry, 1904-1978" och "Harry Martinson" ska ge samma nyckel.
export function normalizeAuthor(author) {
  let text = String(author ?? '');
  if (text.includes(',')) {
    const parts = text.split(',').map((p) => p.trim()).filter((p) => p && !/^\d{4}\s*-/.test(p) && !/^\d{4}$/.test(p));
    if (parts.length >= 2) text = `${parts[1]} ${parts[0]}`;
    else text = parts[0] ?? '';
  }
  return clean(text).split(' ').filter(Boolean).sort().join(' ');
}

export function workKey(title, author) {
  return `${normalizeTitle(title)}|${normalizeAuthor(author)}`;
}

// ISBN jämförs utan bindestreck. ISBN-10 görs om till ISBN-13.
export function normalizeIsbn(isbn) {
  const raw = String(isbn ?? '').toUpperCase().replace(/[^0-9X]/g, '');
  if (raw.length === 13) return raw;
  if (raw.length === 10) {
    const body = `978${raw.slice(0, 9)}`;
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
    return body + ((10 - (sum % 10)) % 10);
  }
  return raw;
}

export function normalizeTagName(name) {
  return clean(name);
}
