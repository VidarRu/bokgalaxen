// Inställningar för sidan.

// Länken "Bli redaktör" öppnar ett mejl till den här adressen. Den syns för
// alla som tittar i länken.
export const REDAKTOR_EMAIL = 'vidar.kjerstadius@gmail.com';

export function redaktorMailto() {
  const subject = 'Jag vill bli redaktör i Bokgalaxen';
  const body = [
    'Hej!',
    '',
    'Jag vill gärna skriva boktips i Bokgalaxen.',
    '',
    'Namn:',
    'Bibliotek:',
    'Önskat användarnamn:',
    '',
    'Hälsningar',
  ].join('\n');
  return `mailto:${REDAKTOR_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
