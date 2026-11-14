// Små hjälpfunktioner för att bygga gränssnittet utan ramverk.

import { getGenre } from '../data/genres.js';

// el('button', { class: 'x', onclick: fn, text: 'Hej' }, [barn]) → element.
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'style') node.style.cssText = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (value === true) node.setAttribute(key, '');
    else if (value !== false && value !== null && value !== undefined) node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) if (child !== null && child !== undefined && child !== false) node.append(child);
  return node;
}

// Ett genererat omslag med titel och författare. Riktiga omslag används
// inte förrän det är klart att de får visas.
export function cover(book, small = false) {
  const genre = getGenre(book.genre);
  return el('div', { class: `cover${small ? ' cover--small' : ''}`, style: `--c:${genre.color}`, 'aria-hidden': 'true' }, [
    el('span', { class: 'cover__title', text: book.title }),
    small ? null : el('span', { class: 'cover__author', text: book.author }),
  ]);
}
