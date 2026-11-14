// Startpunkten för sidan. Knyter ihop lagringen, galaxen och det lilla
// gränssnitt som finns efter steg 3: bokkort, taggar, förklaring och
// galaxfil-menyn. Byggläget (steg 4), utforskaläget (steg 5) och listvyn
// (steg 6) byggs ovanpå det här.

import { createStore, warnBeforeLeaving } from './data/store.js';
import { createTestGalaxy } from './data/testdata.js';
import { relationsForBook, tagsForBook, degreeMap } from './data/model.js';
import { describeMerge } from './data/merge.js';
import { GENRES, getGenre } from './data/genres.js';
import { createGalaxy } from './galaxy/galaxy.js';
import { relationColor } from './galaxy/theme.js';

const $ = (id) => document.getElementById(id);

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'style') node.style.cssText = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (value !== false && value !== null && value !== undefined) node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
}

const store = createStore();
const galaxy = createGalaxy($('galaxy'));
window.bokgalaxen = { store, galaxy }; // för felsökning i webbläsarens konsol

let data = null; // galaxen som visas just nu
let showingTestData = false;

function say(message) {
  $('status').textContent = message;
  $('status').classList.add('status--visible');
  clearTimeout(say.timer);
  say.timer = setTimeout(() => $('status').classList.remove('status--visible'), 6000);
}

// --- Vad som visas ------------------------------------------------------

function show({ relayout = false } = {}) {
  const params = new URLSearchParams(location.search);
  const testCount = Number.parseInt(params.get('test') ?? '', 10);
  const empty = store.galaxy.books.length === 0;

  showingTestData = Number.isFinite(testCount) || empty;
  data = showingTestData ? createTestGalaxy(Number.isFinite(testCount) ? Math.max(1, Math.min(testCount, 2000)) : 160) : store.galaxy;

  const notice = $('test-notice');
  notice.hidden = !showingTestData;
  notice.textContent = empty
    ? 'Den riktiga galaxen är tom än. Det här är en testgalax med platshållare, inga riktiga böcker eller boktips.'
    : 'Testgalax med platshållare, inga riktiga böcker eller boktips.';

  if (relayout) galaxy.relayout(data);
  else galaxy.setGalaxy(data);
  renderTags();
  renderCard(galaxy.focusId);
}

// --- Taggar -------------------------------------------------------------

function renderTags() {
  const chips = $('tag-chips');
  chips.replaceChildren();
  $('tags').hidden = data.tags.length === 0;
  const counts = new Map();
  for (const bt of data.bookTags) counts.set(bt.tag, (counts.get(bt.tag) ?? 0) + 1);
  for (const tag of [...data.tags].sort((a, b) => a.name.localeCompare(b.name, 'sv'))) {
    const active = galaxy.tagId === tag.id;
    chips.append(
      el('button', {
        type: 'button',
        class: `chip${active ? ' chip--active' : ''}`,
        'aria-pressed': String(active),
        onclick: () => {
          galaxy.clearFocus();
          galaxy.setTag(active ? null : tag.id);
          renderTags();
          if (!active) {
            galaxy.overview();
            say(`Taggen ${tag.name} är tänd. ${counts.get(tag.id) ?? 0} böcker lyser.`);
          }
        },
      }, [el('span', { text: tag.name }), el('span', { class: 'chip__count', text: String(counts.get(tag.id) ?? 0) })]),
    );
  }
}

// --- Förklaringen -------------------------------------------------------

function renderLegend() {
  $('legend-genres').replaceChildren(
    ...GENRES.map((g) => el('li', {}, [el('span', { class: 'dot', style: `--c:${g.color}` }), g.name])),
  );
}

function renderLegendRelations() {
  $('legend-relations').replaceChildren(
    ...data.relationTypes.map((t) =>
      el('li', {}, [
        el('span', { class: 'streak', style: `--c:${relationColor(t.id)}` }),
        t.directed ? `${t.name} (har riktning)` : t.name,
      ]),
    ),
  );
}

// --- Bokkortet ----------------------------------------------------------

// Ett genererat omslag med titel och författare. Riktiga omslag används
// inte förrän det är klart att de får visas.
function cover(book, small = false) {
  const genre = getGenre(book.genre);
  return el('div', { class: `cover${small ? ' cover--small' : ''}`, style: `--c:${genre.color}`, 'aria-hidden': 'true' }, [
    el('span', { class: 'cover__title', text: book.title }),
    small ? null : el('span', { class: 'cover__author', text: book.author }),
  ]);
}

function renderCard(bookId) {
  const card = $('card');
  const book = bookId ? data.books.find((b) => b.id === bookId) : null;
  if (!book) {
    card.hidden = true;
    card.replaceChildren();
    return;
  }
  const genre = getGenre(book.genre);
  const relations = relationsForBook(data, book.id);
  const tags = tagsForBook(data, book.id);

  const list = relations.map(({ relation, other, type, label }) =>
    el('li', { class: 'tip' }, [
      el('p', { class: 'tip__type' }, [el('span', { class: 'streak', style: `--c:${relationColor(type.id)}` }), label]),
      el('button', { type: 'button', class: 'tip__book', onclick: () => galaxy.focusBook(other.id) }, [
        cover(other, true),
        el('span', {}, [
          el('span', { class: 'tip__title', text: other.title }),
          el('span', { class: 'tip__author', text: other.author }),
        ]),
      ]),
      el('blockquote', { class: 'tip__motivation', text: relation.motivation }),
      el('p', { class: 'tip__signature', text: relation.signature }),
    ]),
  );

  card.replaceChildren(
    el('button', { type: 'button', class: 'card__close', 'aria-label': 'Stäng kortet och visa hela galaxen', text: '×', onclick: () => { galaxy.clearFocus(); galaxy.overview(); } }),
    el('div', { class: 'card__head' }, [
      cover(book),
      el('div', {}, [
        el('h2', { class: 'card__title', text: book.title, tabindex: '-1', id: 'card-title' }),
        el('p', { class: 'card__author', text: [book.author, book.year].filter(Boolean).join(' · ') }),
        el('p', { class: 'card__genre' }, [el('span', { class: 'dot', style: `--c:${genre.color}` }), genre.name]),
        tags.length ? el('p', { class: 'card__tags' }, tags.map((t) => el('span', { class: 'tagmark', text: t.name }))) : null,
      ]),
    ]),
    el('h3', { class: 'card__section', text: relations.length ? `Bibliotekariernas kopplingar (${relations.length})` : 'Inga kopplingar än' }),
    relations.length
      ? el('ul', { class: 'tips' }, list)
      : el('p', { class: 'card__empty', text: 'Ingen bibliotekarie har kopplat den här boken till någon annan än. Dess plats i galaxen betyder därför ingenting.' }),
  );
  card.hidden = false;
  card.scrollTop = 0;
}

function updateInset() {
  const card = $('card');
  if (card.hidden) return galaxy.setInset();
  const box = card.getBoundingClientRect();
  if (window.innerWidth > 760) galaxy.setInset({ right: window.innerWidth - box.left });
  else galaxy.setInset({ bottom: window.innerHeight - box.top });
}
window.addEventListener('resize', updateInset);

galaxy.on('focus', (id) => {
  renderCard(id);
  document.body.classList.toggle('has-focus', Boolean(id));
  updateInset();
  if (id) {
    const book = data.books.find((b) => b.id === id);
    const count = degreeMap(data).get(id) ?? 0;
    say(`${book.title} av ${book.author}. ${count} kopplingar.`);
  }
});

galaxy.on('settled', (positions) => {
  // Testgalaxen sparas aldrig.
  if (!showingTestData) store.savePositions(positions);
});

// --- Verktyg ------------------------------------------------------------

$('overview-button').addEventListener('click', () => {
  galaxy.clearFocus();
  galaxy.overview();
});

const fileButton = $('file-button');
const fileMenu = $('file-menu');
function toggleMenu(open = fileMenu.hidden) {
  fileMenu.hidden = !open;
  fileButton.setAttribute('aria-expanded', String(open));
}
fileButton.addEventListener('click', () => toggleMenu());
document.addEventListener('click', (event) => {
  if (!event.target.closest('.menu')) toggleMenu(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!fileMenu.hidden) {
    toggleMenu(false);
    fileButton.focus();
  } else if (galaxy.focusId) {
    galaxy.clearFocus();
  } else if (galaxy.tagId) {
    galaxy.setTag(null);
    renderTags();
  }
});

function exportGalaxy() {
  toggleMenu(false);
  store.download();
  say('Galaxen är exporterad som en fil.');
}
$('export-button').addEventListener('click', exportGalaxy);
$('reminder-export').addEventListener('click', exportGalaxy);

let importMode = 'merge';
function pickFile(mode) {
  importMode = mode;
  toggleMenu(false);
  $('file-input').value = '';
  $('file-input').click();
}
$('merge-button').addEventListener('click', () => pickFile('merge'));
$('replace-button').addEventListener('click', () => {
  if (store.galaxy.books.length === 0 || confirm('Galaxen i den här webbläsaren ersätts av filen. Vill du fortsätta?')) pickFile('replace');
});
$('file-input').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    if (importMode === 'merge') say(describeMerge(store.importMerge(text)));
    else {
      store.importReplace(text);
      say(`Galaxen är ersatt. Den har nu ${store.galaxy.books.length} böcker.`);
    }
  } catch (error) {
    say(error instanceof SyntaxError ? 'Filen gick inte att läsa. Är det en galaxfil från Bokgalaxen?' : error.message);
  }
});

$('relayout-button').addEventListener('click', () => {
  toggleMenu(false);
  show({ relayout: true });
  say('Galaxen läggs om från början.');
});

$('reset-button').addEventListener('click', async () => {
  toggleMenu(false);
  if (store.dirty && !confirm('Ändringar som inte är exporterade försvinner. Vill du börja om från startfilen?')) return;
  await store.resetToStartFile();
  say('Galaxen är återställd från startfilen.');
});

// --- Start --------------------------------------------------------------

store.subscribe(({ dirty, change }) => {
  $('reminder').hidden = !dirty;
  if (change === 'positions') return; // bara sparade positioner, inget nytt att rita
  if (change === 'export') return;
  if (data) {
    show();
    renderLegendRelations();
  }
});
warnBeforeLeaving(store);

await store.load();
$('reminder').hidden = !store.dirty;
renderLegend();
show();
renderLegendRelations();
