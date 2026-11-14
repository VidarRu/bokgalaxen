// Den korta listan av genrer som bibliotekarien väljer ur. Genren styr
// stjärnans färg. Libris ger bara ett förslag (se src/libris), valet är
// bibliotekariens.
//
// Färgerna är valda för att synas mot mörk bakgrund och gå att skilja åt.
// Färg är aldrig den enda bäraren av information: genren står också i text
// i kort och i listvyn.

export const GENRES = [
  { id: 'roman', name: 'Roman', color: '#ffd9a0' },
  { id: 'spanning', name: 'Deckare och spänning', color: '#ff6b5a' },
  { id: 'fantastik', name: 'Fantasy och science fiction', color: '#b08cff' },
  { id: 'feelgood', name: 'Feelgood och romance', color: '#ff8fc7' },
  { id: 'historisk', name: 'Historisk roman', color: '#f5a623' },
  { id: 'biografi', name: 'Biografi och memoar', color: '#4fd6c4' },
  { id: 'fakta', name: 'Fakta', color: '#5aa9ff' },
  { id: 'barn-unga', name: 'Barn och unga', color: '#8be36b' },
  { id: 'lyrik', name: 'Lyrik och dramatik', color: '#a8ecff' },
  { id: 'serier', name: 'Serier', color: '#ffe45c' },
];

export const UNKNOWN_GENRE = { id: 'okand', name: 'Genre saknas', color: '#c8d0e0' };

const byId = new Map(GENRES.map((g) => [g.id, g]));

export function getGenre(id) {
  return byId.get(id) ?? UNKNOWN_GENRE;
}
