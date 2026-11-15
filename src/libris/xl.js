// Libris XL: https://libris.kb.se/find.jsonld
// Går att anropa direkt från webbläsaren (CORS är tillåtet). Svaren är stora,
// ungefär 80 kB per träff okomprimerat, så antalet träffar hålls nere.
//
// XL har en verkskoppling (instanceOf.@id) för många böcker, men inte alla.
// Den sparas som en extra ledtråd. Titel och författare är fortfarande det
// som avgör om två utgåvor är samma bok.

import { suggestGenre } from './genre.js';

const ENDPOINT = 'https://libris.kb.se/find.jsonld';

function asList(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function label(node) {
  if (!node || typeof node !== 'object') return typeof node === 'string' ? node : null;
  const value = node.prefLabelByLang?.sv ?? node.prefLabel ?? node.labelByLang?.sv ?? node.label ?? null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function idFromUri(uri) {
  if (!uri) return null;
  return String(uri).replace(/#it$/, '').split('/').pop() || null;
}

function agentName(agent) {
  if (!agent) return null;
  if (agent.givenName || agent.familyName) return [agent.givenName, agent.familyName].filter(Boolean).join(' ');
  return agent.name ?? label(agent);
}

// Gör om en post (utgåva) från XL till en bokkandidat.
export function parseXlItem(item) {
  const work = item.instanceOf ?? {};
  const titleNode = asList(item.hasTitle)[0] ?? asList(work.hasTitle)[0] ?? {};
  const title = titleNode.mainTitle;
  if (!title) return null;

  const contributions = asList(work.contribution);
  const primary = contributions.find((c) => c['@type'] === 'PrimaryContribution') ?? contributions[0];
  const author = agentName(primary?.agent);

  const isbns = asList(item.identifiedBy)
    .filter((i) => i['@type'] === 'ISBN' && i.value)
    .map((i) => String(i.value));

  const years = asList(item.publication)
    .map((p) => Number.parseInt(p.year, 10))
    .filter(Number.isFinite);

  const categories = asList(work.category);
  const genreForms = [...categories.filter((c) => c['@type'] === 'GenreForm'), ...asList(work.genreForm)]
    .map(label)
    .filter(Boolean);
  const contentTypes = categories.filter((c) => c['@type'] === 'ContentType').map(label);
  const sab = asList(work.classification)
    .filter((c) => c['@type'] === 'Classification' && c.code)
    .map((c) => String(c.code));
  const audience = asList(work.intendedAudience).map(label).filter(Boolean);
  const subjects = asList(work.subject).map(label).filter((s) => s && !String(s).startsWith('http'));
  const languages = asList(work.language).map((l) => idFromUri(l?.['@id'] ?? l?.code)).filter(Boolean);
  // En översättning har originalets titel i translationOf. Den behövs för att
  // hitta den svenska utgåvan av en bok som man bara känner till på engelska.
  const originalTitles = asList(work.translationOf)
    .flatMap((t) => asList(t?.hasTitle))
    .map((t) => t?.mainTitle)
    .filter(Boolean)
    .map((t) => String(t).replace(/[\s.]+$/, '').trim());

  return {
    title: String(title).trim(),
    author: author ? String(author).trim() : '',
    year: years.length ? Math.min(...years) : null,
    isbns,
    librisIds: [idFromUri(item['@id'])].filter(Boolean),
    librisWorkIds: [idFromUri(work['@id'])].filter(Boolean),
    subjects: [...new Set(subjects)],
    languages: [...new Set(languages)],
    originalTitles: [...new Set(originalTitles)],
    genreHints: [...new Set(genreForms)],
    suggestedGenre: suggestGenre({ genreForms, sab, audience }),
    cover: null, // Libris har omslagsbilder, men rättigheterna är inte klarlagda. Se PROGRESS.md.
    isText: contentTypes.length === 0 || contentTypes.includes('Text'),
    source: 'xl',
  };
}

// language är en språkkod från id.kb.se, till exempel 'swe'. Då visas bara
// utgåvor på det språket. familyName visar bara utgåvor där någon med det
// efternamnet har medverkat (författare, men också översättare).
export async function searchXl(query, { limit = 12, offset = 0, language, familyName, signal, fetchImpl = fetch } = {}) {
  const params = new URLSearchParams({ q: query, '@type': 'Instance', _limit: String(limit) });
  if (offset) params.set('_offset', String(offset));
  if (language) params.set('instanceOf.language.@id', `https://id.kb.se/language/${language}`);
  if (familyName) params.set('instanceOf.contribution.agent.familyName', familyName);
  const response = await fetchImpl(`${ENDPOINT}?${params}`, {
    signal,
    headers: { Accept: 'application/ld+json' },
  });
  if (!response.ok) throw new Error(`Libris XL svarade ${response.status}`);
  const data = await response.json();
  return asList(data.items)
    .map(parseXlItem)
    .filter((b) => b && b.isText && (b.author || b.isbns.length));
}
