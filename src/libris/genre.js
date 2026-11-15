// Föreslår en genre utifrån det Libris vet om boken: genre/form-termer,
// SAB-klassning och målgrupp. Det är bara ett förslag. Bibliotekarien väljer.

const RULES = [
  ['serier', /tecknade serier|serieroman|seriealbum|manga/i],
  ['spanning', /deckare|kriminal|thriller|spänning|polisroman/i],
  ['fantastik', /fantasy|science fiction|skräck|dystopi/i],
  ['feelgood', /feelgood|romance|kärleksroman|romantik/i],
  ['historisk', /historiska romaner|historisk skönlitteratur/i],
  ['biografi', /biografi|memoar|självbiograf/i],
  ['lyrik', /poesi|lyrik|dikter|dramatik|skådespel/i],
];

// genreForms: termer som "Romaner", "Deckare".
// sab: SAB-koder som "Hc.01" eller "uHc".
// audience: målgruppstermer som "Barn" eller "Ungdom".
export function suggestGenre({ genreForms = [], sab = [], audience = [] } = {}) {
  // "Ej skönlitteratur" betyder facklitteratur. Det får inte läsas som
  // skönlitteratur av mönstren nedan.
  const nonFiction = genreForms.some((f) => /^ej skönlitteratur$/i.test(String(f).trim()));
  const forms = genreForms.filter((f) => !/^ej skönlitteratur$/i.test(String(f).trim())).join(' | ');
  const codes = sab.map((c) => String(c));
  const young =
    audience.some((a) => /barn|ungdom|juvenile/i.test(a)) ||
    codes.some((c) => /^u/.test(c) || /,u/.test(c)) ||
    /barn- och ungdomslitteratur|bilderböcker|kapitelböcker|ungdomsböcker/i.test(forms);

  for (const [genre, pattern] of RULES) {
    if (pattern.test(forms)) return young && genre !== 'serier' ? 'barn-unga' : genre;
  }
  if (young) return 'barn-unga';
  if (nonFiction) return codes.some((c) => /^L/.test(c)) ? 'biografi' : 'fakta';
  if (codes.some((c) => /^H[a-zåäö]*\.0?3/.test(c) || /^H[a-zåäö]*\.0?2/.test(c))) return 'lyrik';
  if (codes.some((c) => /^L/.test(c))) return 'biografi';
  if (codes.some((c) => /^H/.test(c)) || /romaner|noveller|skönlitteratur/i.test(forms)) return 'roman';
  if (codes.length) return 'fakta';
  return null;
}
