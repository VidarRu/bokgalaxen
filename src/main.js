// Startpunkten för sidan. Knyter ihop lagringen, galaxen, bokkortet, taggar,
// förklaringen, galaxfil-menyn och byggläget (src/build/builder.js).
// Utforskaläget (steg 5) och listvyn (steg 6) byggs ovanpå det här.

import { createStore, warnBeforeLeaving } from './data/store.js';
import { remoteApi } from './data/remote.js';
import { createTestGalaxy } from './data/testdata.js';
import { createDemoGalaxy } from './data/demodata.js';
import { relationsForBook, tagsForBook, degreeMap } from './data/model.js';
import { describeMerge } from './data/merge.js';
import { GENRES, getGenre } from './data/genres.js';
import { createGalaxy } from './galaxy/galaxy.js';
import { relationColor } from './galaxy/theme.js';
import { createBuilder } from './build/builder.js';
import { el, cover } from './ui/dom.js';

const $ = (id) => document.getElementById(id);

// Finns serverfunktionerna (Vercel, eller `npm run dev`) delas galaxen och
// redaktörer loggar in. Annars sparas den i webbläsaren som förut.
const store = createStore({ remote: remoteApi });
const galaxy = createGalaxy($('galaxy'));
window.bokgalaxen = { store, galaxy }; // för felsökning i webbläsarens konsol

let data = null; // galaxen som visas just nu
let showingTestData = false;
let mode = 'utforska'; // 'utforska' | 'bygga'
const testParam = Number.parseInt(new URLSearchParams(location.search).get('test') ?? '', 10);
// ?demo visar den riktiga galaxen med slumpade kopplingar (src/data/demodata.js).
const demoParam = new URLSearchParams(location.search).has('demo');
let demoCache = { source: null, galaxy: null };

function demoGalaxy() {
  if (demoCache.source !== store.galaxy) demoCache = { source: store.galaxy, galaxy: createDemoGalaxy(store.galaxy) };
  return demoCache.galaxy;
}

function say(message) {
  $('status').textContent = message;
  $('status').classList.add('status--visible');
  clearTimeout(say.timer);
  say.timer = setTimeout(() => $('status').classList.remove('status--visible'), 6000);
}

// --- Vad som visas ------------------------------------------------------

function show({ relayout = false } = {}) {
  const testCount = testParam;
  const empty = store.galaxy.books.length === 0;

  // I byggläget visas alltid den riktiga galaxen, även när den är tom.
  const showingDemo = demoParam && !Number.isFinite(testCount) && store.galaxy.books.length > 1;
  showingTestData = showingDemo || Number.isFinite(testCount) || (empty && mode === 'utforska');
  if (showingDemo) data = demoGalaxy();
  else data = showingTestData ? createTestGalaxy(Number.isFinite(testCount) ? Math.max(1, Math.min(testCount, 2000)) : 160) : store.galaxy;

  const notice = $('test-notice');
  notice.hidden = !showingTestData;
  notice.textContent = showingDemo
    ? 'Demo: böckerna är riktiga, men många av kopplingarna är slumpade för att visa hur galaxen kan se ut. De har signaturen "Demo (slumpad)" och sparas inte.'
    : empty
      ? 'Den riktiga galaxen är tom än. Det här är en testgalax med platshållare, inga riktiga böcker eller boktips.'
      : 'Testgalax med platshållare, inga riktiga böcker eller boktips.';

  if (relayout) galaxy.relayout(data);
  else galaxy.setGalaxy(data);
  renderTags();
  if (mode === 'utforska') renderCard(galaxy.focusId);
  else builder.refresh();
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
  const card = mode === 'bygga' ? $('builder') : $('card');
  if (card.hidden) return galaxy.setInset();
  const box = card.getBoundingClientRect();
  if (window.innerWidth > 760) galaxy.setInset({ right: window.innerWidth - box.left });
  else galaxy.setInset({ bottom: window.innerHeight - box.top });
}
window.addEventListener('resize', updateInset);

galaxy.on('focus', (id) => {
  if (mode === 'bygga') {
    builder.openBook(id);
    return;
  }
  renderCard(id);
  document.body.classList.toggle('has-focus', Boolean(id));
  updateInset();
  if (id) {
    const book = data.books.find((b) => b.id === id);
    const count = degreeMap(data).get(id) ?? 0;
    say(`${book.title} av ${book.author}. ${count} kopplingar.`);
  }
});

let relayoutRequested = false;
galaxy.on('settled', (positions) => {
  // Testgalaxen och demon sparas aldrig.
  if (!showingTestData) store.savePositions(positions, { overwrite: relayoutRequested });
  relayoutRequested = false;
});

// --- Byggläget -----------------------------------------------------------

const builder = createBuilder({ root: $('builder'), store, galaxy, say, onExport: () => exportGalaxy() });

function setMode(next, { announce = true } = {}) {
  if (next === 'bygga' && Number.isFinite(testParam)) {
    say('Byggläget fungerar inte i testgalaxen. Ta bort ?test ur adressen.');
    return;
  }
  if (next === 'bygga' && demoParam) {
    say('Byggläget fungerar inte i demon. Ta bort ?demo ur adressen.');
    return;
  }
  if (next === mode) return;
  mode = next;
  document.body.classList.toggle('mode-build', mode === 'bygga');
  for (const button of document.querySelectorAll('[data-mode]')) {
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  }
  history.replaceState(null, '', mode === 'bygga' ? '#bygga' : location.pathname + location.search);
  if (mode === 'bygga') {
    $('card').hidden = true;
    document.body.classList.remove('has-focus');
    builder.show();
  } else {
    builder.hide();
  }
  show();
  updateInset();
  if (announce) say(mode === 'bygga' ? 'Byggläget. Sök fram en bok i formuläret.' : 'Utforskaläget.');
}

for (const button of document.querySelectorAll('[data-mode]')) {
  button.addEventListener('click', () => setMode(button.dataset.mode));
}

// Ctrl+Z (Cmd+Z på Mac) ångrar i byggläget, utom när man skriver i ett fält.
document.addEventListener('keydown', (event) => {
  if (mode !== 'bygga' || event.key.toLowerCase() !== 'z' || !(event.ctrlKey || event.metaKey) || event.shiftKey) return;
  if (event.target.closest('input, textarea, select')) return;
  event.preventDefault();
  builder.undo();
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
  const question = store.shared
    ? 'Hela den delade galaxen ersätts av filen, för alla redaktörer. Vill du fortsätta?'
    : 'Galaxen i den här webbläsaren ersätts av filen. Vill du fortsätta?';
  if (store.galaxy.books.length === 0 || confirm(question)) pickFile('replace');
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
  relayoutRequested = true;
  show({ relayout: true });
  say('Galaxen läggs om från början.');
});

$('reset-button').addEventListener('click', async () => {
  toggleMenu(false);
  if (store.dirty && !confirm('Ändringar som inte är exporterade försvinner. Vill du börja om från startfilen?')) return;
  await store.resetToStartFile();
  say('Galaxen är återställd från startfilen.');
});

// I den delade galaxen kan bara administratören importera filer, och det
// finns ingen startfil att börja om från.
function updateFileMenu() {
  const admin = !store.shared || Boolean(store.user?.isAdmin);
  $('merge-button').hidden = !admin;
  $('replace-button').hidden = !admin;
  $('reset-button').hidden = store.shared;
}

// --- Start --------------------------------------------------------------

store.subscribe(({ dirty, change, message }) => {
  $('reminder').hidden = !dirty || store.shared;
  if (change === 'positions') return; // bara sparade positioner, inget nytt att rita
  if (change === 'error') {
    say(message);
    return;
  }
  if (change === 'user') {
    updateFileMenu();
    if (mode === 'bygga') builder.refresh();
    return;
  }
  if (change === 'export') {
    if (mode === 'bygga') builder.refresh();
    return;
  }
  if (data) {
    show();
    renderLegendRelations();
  }
  if (mode === 'bygga') updateInset();
});
warnBeforeLeaving(store);

await store.load();
$('reminder').hidden = !store.dirty || store.shared;
updateFileMenu();
renderLegend();
if (location.hash === '#bygga') setMode('bygga', { announce: false });
else show();
renderLegendRelations();
