// Färger och mått för galaxen. Genrefärgerna ligger i src/data/genres.js.

// Ljusstråkens färg per typ av koppling.
export const RELATION_COLORS = {
  'samma-stamning': '#6fc8ff',
  'nasta-steg': '#ffc24d',
  'samma-tema': '#c39bff',
  berattarrost: '#6ff0b0',
  serien: '#ff8a6b',
};

const FALLBACK_COLORS = ['#9fe0ff', '#ffd98a', '#e0b8ff', '#a8f5cf', '#ffb39f'];

// Typer som en bibliotekarie har skapat själv får en färg ur reservlistan.
export function relationColor(typeId) {
  if (RELATION_COLORS[typeId]) return RELATION_COLORS[typeId];
  let hash = 0;
  for (const ch of String(typeId)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

export const SPACE_COLOR = '#03040b';

// Stjärnans radie i galaxens mått. Växer med antalet kopplingar, men
// långsammare och långsammare så att nav inte tar över hela bilden.
export function starRadius(degree) {
  return 1.5 + 1.0 * Math.sqrt(degree);
}
