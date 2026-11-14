// Sammanslagning av två galaxfiler, till exempel startfilen och en kollegas
// export. Dubbletter tas bort:
//   - böcker med samma titel och författare (eller samma ISBN/Libris-id) blir en bok
//   - kopplingar med samma från + till + typ blir en koppling
//   - taggar med samma namn blir en tagg
// Basfilen vinner när båda har uppgifter, utom för en dubblerad koppling där
// den senast ändrade motiveringen behålls.

import { normalizeGalaxy, findSameWork, mergeBookFields, relationKey } from './model.js';
import { normalizeTagName } from './normalize.js';

export function mergeGalaxies(baseInput, incomingInput) {
  const base = normalizeGalaxy(baseInput);
  const incoming = normalizeGalaxy(incomingInput);
  const summary = {
    booksAdded: 0,
    booksMerged: 0,
    relationsAdded: 0,
    relationsMerged: 0,
    tagsAdded: 0,
    relationTypesAdded: 0,
  };

  let result = { ...base, books: [...base.books] };

  // Böcker. bookIdMap översätter id i den inkommande filen till id i resultatet.
  const bookIdMap = new Map();
  for (const book of incoming.books) {
    const sameId = result.books.find((b) => b.id === book.id);
    const existing = sameId ?? findSameWork(result, book);
    if (existing) {
      const merged = mergeBookFields(existing, book);
      result.books = result.books.map((b) => (b.id === existing.id ? merged : b));
      bookIdMap.set(book.id, existing.id);
      summary.booksMerged++;
    } else {
      result.books.push(book);
      bookIdMap.set(book.id, book.id);
      summary.booksAdded++;
    }
  }

  // Kopplingstyper: slås ihop på id.
  const relationTypes = [...base.relationTypes];
  for (const type of incoming.relationTypes) {
    if (!relationTypes.some((t) => t.id === type.id)) {
      relationTypes.push(type);
      summary.relationTypesAdded++;
    }
  }
  result.relationTypes = relationTypes;

  // Taggar: slås ihop på namn.
  const tags = [...base.tags];
  const tagIdMap = new Map();
  for (const tag of incoming.tags) {
    const key = normalizeTagName(tag.name);
    const existing = tags.find((t) => t.id === tag.id || normalizeTagName(t.name) === key);
    if (existing) {
      tagIdMap.set(tag.id, existing.id);
    } else {
      tags.push(tag);
      tagIdMap.set(tag.id, tag.id);
      summary.tagsAdded++;
    }
  }
  result.tags = tags;

  const bookTags = [...base.bookTags];
  const seenBookTags = new Set(bookTags.map((bt) => `${bt.book}|${bt.tag}`));
  for (const bt of incoming.bookTags) {
    const mapped = { book: bookIdMap.get(bt.book), tag: tagIdMap.get(bt.tag) };
    const key = `${mapped.book}|${mapped.tag}`;
    if (mapped.book && mapped.tag && !seenBookTags.has(key)) {
      seenBookTags.add(key);
      bookTags.push(mapped);
    }
  }
  result.bookTags = bookTags;

  // Kopplingar: samma från + till + typ blir en koppling.
  const relations = [...base.relations];
  const byKey = new Map(relations.map((r, i) => [relationKey(result, r), i]));
  for (const rel of incoming.relations) {
    const mapped = { ...rel, from: bookIdMap.get(rel.from), to: bookIdMap.get(rel.to) };
    if (!mapped.from || !mapped.to || mapped.from === mapped.to) continue;
    const key = relationKey(result, mapped);
    if (byKey.has(key)) {
      const index = byKey.get(key);
      const existing = relations[index];
      if (existing.id !== mapped.id || mapped.updated > existing.updated) {
        summary.relationsMerged++;
      }
      if (mapped.updated > existing.updated) {
        relations[index] = { ...mapped, id: existing.id, created: existing.created };
      }
    } else {
      if (relations.some((r) => r.id === mapped.id)) continue;
      byKey.set(key, relations.length);
      relations.push(mapped);
      summary.relationsAdded++;
    }
  }
  result.relations = relations;

  return { galaxy: normalizeGalaxy(result), summary };
}

// En mening på svenska om vad sammanslagningen gjorde.
export function describeMerge(summary) {
  const parts = [
    `${summary.booksAdded} nya böcker`,
    `${summary.relationsAdded} nya kopplingar`,
    `${summary.tagsAdded} nya taggar`,
  ];
  const dupes = summary.booksMerged + summary.relationsMerged;
  return `Sammanslagningen lade till ${parts.join(', ')}. ${dupes} dubbletter slogs ihop.`;
}
