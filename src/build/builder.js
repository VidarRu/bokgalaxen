// Byggläget. Ett formulär där bibliotekarien söker fram böcker i Libris,
// lägger dem i galaxen, kopplar ihop dem med en motivering och sätter taggar.
// Galaxen visar resultatet, men man behöver aldrig peka ut en stjärna med musen.
//
// Panelen har några vyer:
//   start      sök efter en bok att lägga till eller arbeta med, ändra taggar
//   ny-bok     en träff från Libris som inte finns i galaxen: välj genre
//   bok        en bok i galaxen: genre, taggar, kopplingar
//   koppla     sök fram den andra boken i en koppling
//   koppling   typ, riktning, motivering och signatur (ny eller ändrad)
//   konto      signatur och lösenord för den inloggade
//   redaktorer administratören skapar och tar bort konton
//
// När galaxen delas via servern (store.shared) måste man logga in. En
// redaktör ser och ändrar bara sina egna boktips. Administratören ser allt.
//
// Alla ändringar går genom store.update(), så att de sparas, kan ångras och
// ritas om i galaxen.

import { searchBooks } from '../libris/index.js';
import {
  addBook,
  updateBook,
  removeBook,
  addRelation,
  updateRelation,
  removeRelation,
  relationsForBook,
  getRelationType,
  findSameWork,
  findBooks,
  tagBook,
  untagBook,
  renameTag,
  removeTag,
  tagsForBook,
} from '../data/model.js';
import { GENRES, getGenre } from '../data/genres.js';
import { relationColor } from '../galaxy/theme.js';
import { el, cover } from '../ui/dom.js';
import { remoteApi } from '../data/remote.js';
import { passwordProblems, describePasswordProblems, PASSWORD_MIN } from '../data/password.js';
import { redaktorMailto } from '../config.js';

const SIGNATURE_KEY = 'bokgalaxen.signatur';
const MOTIVATION_MAX = 400;

// Hjälptext till typerna i den fasta listan. Typer som bibliotekarier
// skapar själva senare får ingen hjälptext, bara sitt namn.
const TYPE_HELP = {
  'samma-stamning': 'Böckerna ger samma känsla, oavsett genre.',
  'nasta-steg': 'Den andra boken är lite svårare eller går djupare.',
  'samma-tema': 'Samma ämne eller fråga, men en annan sorts bok.',
  berattarrost: 'Rösten som berättar påminner om varandra.',
  serien: 'Böckerna hör till samma serie och läses i ordning.',
};

function rememberedSignature() {
  try {
    return localStorage.getItem(SIGNATURE_KEY) ?? '';
  } catch {
    return '';
  }
}

function rememberSignature(value) {
  try {
    localStorage.setItem(SIGNATURE_KEY, value);
  } catch {
    // lagringen är avstängd, då får signaturen skrivas varje gång
  }
}

function byline(book) {
  return [book.author, book.year].filter(Boolean).join(' · ');
}

export function createBuilder({ root, store, galaxy, say, onExport }) {
  let view = { name: 'start' };
  let search = { query: '', local: [], libris: [], state: 'idle', error: '', source: null };
  let searchController = null;
  let lastRendered = null;

  const g = () => store.galaxy;
  const bookById = (id) => g().books.find((b) => b.id === id) ?? null;

  // Vem får göra vad. Utan delad galax (bara webbläsaren) får man allt.
  const shared = () => store.shared;
  const me = () => store.user;
  const isAdmin = () => !shared() || Boolean(me()?.isAdmin);
  const ownsRelation = (r) => isAdmin() || r.owner === me()?.id;
  const canSetGenre = (book) => isAdmin() || book.addedBy === me()?.id;
  const canRemoveBook = (book) =>
    isAdmin() || (book.addedBy === me()?.id && g().relations.every((r) => (r.from !== book.id && r.to !== book.id) || r.owner === me()?.id));

  // --- Ändringar --------------------------------------------------------

  function change(label, fn) {
    try {
      store.update(fn, label);
      return true;
    } catch (error) {
      say(error.message);
      return false;
    }
  }

  // Lägger en träff från Libris i galaxen, eller ger tillbaka boken som redan
  // finns. Nya utgåvor av en bok som finns läggs till den befintliga stjärnan.
  function placeHit(hit, genre) {
    const existing = findSameWork(g(), hit);
    if (existing) {
      const knownIds = new Set([...existing.isbns, ...existing.librisIds]);
      const brings = [...hit.isbns, ...hit.librisIds].some((id) => !knownIds.has(id));
      if (brings) change(`lade till nya utgåvor av ${existing.title}`, (galax) => addBook(galax, hit).galaxy);
      return { book: bookById(existing.id), created: false };
    }
    let book = null;
    const ok = change(`lade till boken ${hit.title}`, (galax) => {
      const result = addBook(galax, { ...hit, genre: genre || null });
      book = result.book;
      return result.galaxy;
    });
    return ok ? { book, created: true } : null;
  }

  // Galaxen behöver en stund på sig att ge en ny stjärna en plats.
  function flyTo(bookId, { soon = false } = {}) {
    if (soon) setTimeout(() => galaxy.focusBook(bookId), 450);
    else galaxy.focusBook(bookId);
  }

  // --- Vyer -------------------------------------------------------------

  function go(next, { focus = true } = {}) {
    view = next;
    render({ focus });
  }

  function openBook(bookId, { fly = true } = {}) {
    if (view.name === 'bok' && view.bookId === bookId) return;
    go({ name: 'bok', bookId });
    if (fly) flyTo(bookId);
  }

  function heading(text) {
    return el('h3', { class: 'builder__heading', tabindex: '-1', text });
  }

  function backButton(text, onclick) {
    return el('button', { type: 'button', class: 'link-button builder__back', onclick }, [el('span', { 'aria-hidden': 'true', text: '← ' }), text]);
  }

  // --- Sökningen --------------------------------------------------------

  async function runSearch(query) {
    searchController?.abort();
    const q = query.trim();
    search = { query: q, local: findBooks(g(), q), libris: [], state: q ? 'loading' : 'idle', error: '', source: null };
    render({ focus: false });
    if (!q) return;
    const controller = new AbortController();
    searchController = controller;
    try {
      const { books, source } = await searchBooks(q, { signal: controller.signal });
      if (controller.signal.aborted) return;
      search = { ...search, libris: books, state: 'done', source };
    } catch (error) {
      if (controller.signal.aborted) return;
      search = { ...search, state: 'error', error: error.message };
    }
    render({ focus: false });
    const region = root.querySelector('.results__status');
    if (region) region.textContent = statusText();
  }

  function statusText() {
    if (search.state === 'loading') return 'Söker i Libris …';
    if (search.state === 'error') return search.error;
    if (search.state !== 'done') return '';
    const n = search.libris.length;
    const reserve = search.source === 'xsearch' ? ' Libris XL svarade inte, så träffarna kommer från reserven Xsearch och saknar ämnesord.' : '';
    return n ? `${n} träffar i Libris.${reserve}` : `Inga träffar i Libris på ”${search.query}”. Prova med författarens efternamn eller ISBN.`;
  }

  // purpose: 'start' (välj en bok att arbeta med) eller 'koppla' (den andra boken).
  function searchSection({ purpose, fromId = null }) {
    const input = el('input', {
      type: 'search',
      id: 'builder-query',
      class: 'field__input',
      autocomplete: 'off',
      value: search.query,
      'aria-describedby': 'builder-query-hint',
    });
    const form = el('form', {
      class: 'search',
      role: 'search',
      onsubmit: (event) => {
        event.preventDefault();
        runSearch(input.value);
      },
    }, [
      el('label', { class: 'field__label', for: 'builder-query', text: 'Titel, författare eller ISBN' }),
      el('div', { class: 'search__row' }, [input, el('button', { type: 'submit', class: 'button button--primary', text: 'Sök' })]),
      el('p', { class: 'field__hint', id: 'builder-query-hint', text: 'Söker både bland böckerna i galaxen och i Libris.' }),
    ]);

    const choose = (book) => {
      if (purpose === 'koppla') {
        if (book.id === fromId) return say('En bok kan inte kopplas till sig själv. Välj en annan bok.');
        go({ name: 'koppling', fromId, toId: book.id });
      } else openBook(book.id);
    };

    const local = search.local.filter((b) => b.id !== fromId);
    const results = el('div', { class: 'results' }, [
      local.length
        ? el('section', { class: 'results__group', 'aria-labelledby': 'results-local' }, [
            el('h4', { class: 'results__title', id: 'results-local', text: 'Finns i galaxen' }),
            el('ul', { class: 'results__list' }, local.map((book) =>
              el('li', {}, [
                el('button', { type: 'button', class: 'hit', onclick: () => choose(book) }, [
                  cover(book, true),
                  el('span', { class: 'hit__text' }, [
                    el('span', { class: 'hit__title', text: book.title }),
                    el('span', { class: 'hit__meta', text: byline(book) }),
                  ]),
                ]),
              ]),
            )),
          ])
        : null,
      search.query
        ? el('section', { class: 'results__group', 'aria-labelledby': 'results-libris' }, [
            el('h4', { class: 'results__title', id: 'results-libris', text: 'Från Libris' }),
            el('p', { class: `results__status${search.state === 'error' ? ' results__status--error' : ''}`, role: 'status', text: statusText() }),
            search.libris.length
              ? el('ul', { class: 'results__list' }, search.libris.map((hit) => librisHit(hit, { purpose, fromId, choose })))
              : null,
          ])
        : null,
    ]);
    return el('div', {}, [form, results]);
  }

  function librisHit(hit, { purpose, fromId, choose }) {
    const existing = findSameWork(g(), hit);
    const meta = [hit.author, hit.year, hit.editions > 1 ? `${hit.editions} utgåvor` : null].filter(Boolean).join(' · ');
    return el('li', {}, [
      el('button', {
        type: 'button',
        class: 'hit',
        onclick: () => {
          if (existing) {
            const placed = placeHit(hit);
            if (placed) choose(placed.book);
          } else go({ name: 'ny-bok', hit, purpose, fromId });
        },
      }, [
        el('span', { class: 'hit__text' }, [
          el('span', { class: 'hit__title', text: hit.title }),
          el('span', { class: 'hit__meta', text: meta || 'Författare saknas' }),
          existing ? el('span', { class: 'hit__badge', text: existing.id === fromId ? 'Det är boken du kopplar från' : 'Finns redan i galaxen' }) : null,
        ]),
      ]),
    ]);
  }

  // --- Vy: start --------------------------------------------------------

  function startView() {
    const books = g().books.length;
    return [
      heading('Lägg till eller välj en bok'),
      el('p', { class: 'builder__lead', text: books ? `Galaxen har ${books} ${books === 1 ? 'bok' : 'böcker'}. Sök fram en bok för att lägga till den, koppla ihop den med en annan eller sätta taggar.` : 'Galaxen är tom. Sök fram den första boken.' }),
      searchSection({ purpose: 'start' }),
      tagAdmin(),
    ];
  }

  function tagAdmin() {
    const tags = [...g().tags].sort((a, b) => a.name.localeCompare(b.name, 'sv'));
    if (!tags.length || !isAdmin()) return null;
    const counts = new Map();
    for (const bt of g().bookTags) counts.set(bt.tag, (counts.get(bt.tag) ?? 0) + 1);
    return el('details', { class: 'builder__more' }, [
      el('summary', { text: `Alla taggar i galaxen (${tags.length})` }),
      el('ul', { class: 'tag-admin' }, tags.map((tag) => {
        const input = el('input', { class: 'field__input field__input--small', value: tag.name, 'aria-label': `Nytt namn på taggen ${tag.name}` });
        return el('li', {}, [
          el('form', {
            class: 'tag-admin__row',
            onsubmit: (event) => {
              event.preventDefault();
              const name = input.value.trim();
              if (name === tag.name) return;
              if (change(`bytte namn på taggen ${tag.name}`, (galax) => renameTag(galax, tag.id, name))) say(`Taggen heter nu ${name}.`);
            },
          }, [
            input,
            el('span', { class: 'tag-admin__count', text: `${counts.get(tag.id) ?? 0} böcker` }),
            el('button', { type: 'submit', class: 'button button--small', text: 'Byt namn' }),
            el('button', {
              type: 'button',
              class: 'button button--small button--danger',
              'aria-label': `Ta bort taggen ${tag.name} från alla böcker`,
              text: 'Ta bort',
              onclick: () => {
                if (change(`tog bort taggen ${tag.name} från alla böcker`, (galax) => removeTag(galax, tag.id))) say(`Taggen ${tag.name} är borttagen från alla böcker. Du kan ångra.`);
              },
            }),
          ]),
        ]);
      })),
    ]);
  }

  // --- Vy: ny bok från Libris ------------------------------------------

  function genreSelect(id, selected) {
    return el('select', { id, class: 'field__input' }, [
      el('option', { value: '', text: 'Genre saknas', selected: !selected }),
      ...GENRES.map((genre) => el('option', { value: genre.id, text: genre.name, selected: genre.id === selected })),
    ]);
  }

  function newBookView() {
    const { hit, purpose, fromId } = view;
    const suggested = hit.suggestedGenre ? getGenre(hit.suggestedGenre).name : null;
    const select = genreSelect('new-genre', hit.suggestedGenre);
    const from = fromId ? bookById(fromId) : null;
    return [
      backButton('Tillbaka till träffarna', () => go(purpose === 'koppla' ? { name: 'koppla', fromId } : { name: 'start' })),
      heading('Lägg boken i galaxen'),
      el('div', { class: 'builder__book' }, [
        cover({ ...hit, genre: hit.suggestedGenre }),
        el('div', {}, [
          el('p', { class: 'builder__title', text: hit.title }),
          el('p', { class: 'builder__meta', text: byline(hit) || 'Författare saknas' }),
          hit.editions > 1 ? el('p', { class: 'builder__meta', text: `${hit.editions} utgåvor i Libris blir en stjärna.` }) : null,
          hit.genreHints?.length ? el('p', { class: 'builder__meta', text: `Libris: ${hit.genreHints.slice(0, 4).join(', ')}` }) : null,
        ]),
      ]),
      el('form', {
        class: 'builder__form',
        onsubmit: (event) => {
          event.preventDefault();
          const placed = placeHit(hit, select.value);
          if (!placed) return;
          say(`${placed.book.title} är en ny stjärna i galaxen.`);
          if (purpose === 'koppla') go({ name: 'koppling', fromId, toId: placed.book.id });
          else {
            go({ name: 'bok', bookId: placed.book.id });
            flyTo(placed.book.id, { soon: true });
          }
        },
      }, [
        el('div', { class: 'field' }, [
          el('label', { class: 'field__label', for: 'new-genre', text: 'Genre (styr stjärnans färg)' }),
          select,
          el('p', { class: 'field__hint', text: suggested ? `Libris föreslår ${suggested}. Du väljer.` : 'Libris har inget förslag. Du väljer.' }),
        ]),
        el('div', { class: 'builder__actions' }, [
          el('button', { type: 'submit', class: 'button button--primary', text: from ? 'Lägg i galaxen och koppla' : 'Lägg i galaxen' }),
        ]),
      ]),
    ];
  }

  // --- Vy: en bok i galaxen --------------------------------------------

  function bookView() {
    const book = bookById(view.bookId);
    if (!book) {
      view = { name: 'start' };
      return startView();
    }
    // En redaktör ser bara sina egna boktips här. Alla syns i utforskaläget.
    const all = relationsForBook(g(), book.id);
    const relations = all.filter(({ relation }) => ownsRelation(relation));
    const othersCount = all.length - relations.length;
    const own = shared() && !isAdmin();
    const tags = tagsForBook(g(), book.id);
    const select = genreSelect('book-genre', book.genre);
    const genreLocked = !canSetGenre(book);
    if (genreLocked) {
      select.disabled = true;
      select.setAttribute('aria-describedby', 'book-genre-hint');
    }
    select.addEventListener('change', () => {
      const name = getGenre(select.value || null).name;
      if (change(`ändrade genren för ${book.title}`, (galax) => updateBook(galax, book.id, { genre: select.value || null }))) say(`Genren för ${book.title} är nu ${name}.`);
    });

    const tagInput = el('input', { id: 'tag-input', class: 'field__input', list: 'tag-suggestions', autocomplete: 'off', maxlength: '60' });
    const tagForm = el('form', {
      class: 'search__row',
      onsubmit: (event) => {
        event.preventDefault();
        const name = tagInput.value.trim();
        if (!name) return say('Skriv namnet på taggen först.');
        if (change(`satte taggen ${name} på ${book.title}`, (galax) => tagBook(galax, book.id, name).galaxy)) {
          say(`${book.title} har fått taggen ${name}.`);
          root.querySelector('#tag-input')?.focus();
        }
      },
    }, [tagInput, el('button', { type: 'submit', class: 'button', text: 'Sätt tagg' })]);
    const others = g().tags.filter((t) => !tags.some((own) => own.id === t.id));

    return [
      backButton('Tillbaka till sökningen', () => go({ name: 'start' })),
      el('div', { class: 'builder__book' }, [
        cover(book),
        el('div', {}, [
          el('h3', { class: 'builder__heading builder__heading--book', tabindex: '-1', text: book.title }),
          el('p', { class: 'builder__meta', text: byline(book) }),
          el('p', { class: 'builder__meta', text: `${book.isbns.length} ISBN och ${book.librisIds.length} Libris-poster hör till stjärnan.` }),
        ]),
      ]),

      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'book-genre', text: 'Genre (styr stjärnans färg)' }),
        select,
        genreLocked ? el('p', { class: 'field__hint', id: 'book-genre-hint', text: 'Bara den som lade till boken, eller administratören, kan byta genre.' }) : null,
      ]),

      el('section', { class: 'builder__section', 'aria-labelledby': 'book-relations' }, [
        el('h4', {
          class: 'builder__subheading',
          id: 'book-relations',
          text: own
            ? relations.length ? `Dina boktips (${relations.length})` : 'Du har inga boktips för boken än'
            : relations.length ? `Kopplingar (${relations.length})` : 'Inga kopplingar än',
        }),
        own && othersCount
          ? el('p', { class: 'builder__meta', text: `Boken har ${othersCount === 1 ? 'ett boktips' : `${othersCount} boktips`} från andra redaktörer. De syns i utforskaläget.` })
          : null,
        relations.length
          ? el('ul', { class: 'edit-list' }, relations.map(({ relation, other, type, label }) =>
              el('li', { class: 'edit-item' }, [
                el('p', { class: 'tip__type' }, [el('span', { class: 'streak', style: `--c:${relationColor(type.id)}` }), label]),
                el('p', { class: 'edit-item__title', text: other.title }),
                el('p', { class: 'edit-item__motivation', text: relation.motivation }),
                el('p', { class: 'tip__signature', text: relation.signature }),
                el('div', { class: 'edit-item__actions' }, [
                  el('button', { type: 'button', class: 'button button--small', 'aria-label': `Ändra kopplingen till ${other.title}`, text: 'Ändra', onclick: () => go({ name: 'koppling', relationId: relation.id, returnTo: book.id }) }),
                  el('button', {
                    type: 'button',
                    class: 'button button--small button--danger',
                    'aria-label': `Ta bort kopplingen till ${other.title}`,
                    text: 'Ta bort',
                    onclick: () => {
                      if (change(`tog bort kopplingen ${book.title} – ${other.title}`, (galax) => removeRelation(galax, relation.id))) {
                        say(`Kopplingen till ${other.title} är borttagen. Du kan ångra.`);
                        root.querySelector('.builder__heading')?.focus();
                      }
                    },
                  }),
                ]),
              ]),
            ))
          : own
            ? null
            : el('p', { class: 'builder__meta', text: 'Utan kopplingar betyder bokens plats i galaxen ingenting.' }),
        el('button', { type: 'button', class: 'button button--primary builder__wide', text: 'Koppla ihop med en annan bok', onclick: () => {
          search = { query: '', local: [], libris: [], state: 'idle', error: '', source: null };
          go({ name: 'koppla', fromId: book.id });
        } }),
      ]),

      el('section', { class: 'builder__section', 'aria-labelledby': 'book-tags' }, [
        el('h4', { class: 'builder__subheading', id: 'book-tags', text: 'Taggar' }),
        tags.length
          ? el('ul', { class: 'tag-list' }, tags.map((tag) =>
              el('li', { class: 'tag-pill' }, [
                el('span', { text: tag.name }),
                el('button', {
                  type: 'button',
                  class: 'tag-pill__remove',
                  'aria-label': `Ta bort taggen ${tag.name} från boken`,
                  text: '×',
                  onclick: () => {
                    if (change(`tog bort taggen ${tag.name} från ${book.title}`, (galax) => untagBook(galax, book.id, tag.id))) {
                      say(`Taggen ${tag.name} är borttagen från ${book.title}.`);
                      root.querySelector('#tag-input')?.focus();
                    }
                  },
                }),
              ]),
            ))
          : el('p', { class: 'builder__meta', text: 'Boken har inga taggar.' }),
        el('label', { class: 'field__label', for: 'tag-input', text: 'Ny tagg' }),
        tagForm,
        el('datalist', { id: 'tag-suggestions' }, others.map((t) => el('option', { value: t.name }))),
        el('p', { class: 'field__hint', text: 'Skriv en ny tagg eller välj en som redan finns.' }),
      ]),

      !canRemoveBook(book) ? null : el('div', { class: 'builder__danger' }, [
        el('button', {
          type: 'button',
          class: 'button button--danger',
          text: 'Ta bort boken ur galaxen',
          onclick: () => {
            const n = relations.length;
            const what = n ? ` och ${n === 1 ? 'dess koppling' : `dess ${n} kopplingar`}` : '';
            if (!confirm(`${book.title}${what} tas bort ur galaxen. Du kan ångra efteråt. Vill du fortsätta?`)) return;
            if (change(`tog bort boken ${book.title}`, (galax) => removeBook(galax, book.id))) {
              say(`${book.title} är borttagen ur galaxen. Du kan ångra.`);
              galaxy.clearFocus();
              go({ name: 'start' });
            }
          },
        }),
      ]),
    ];
  }

  // --- Vy: välj den andra boken ----------------------------------------

  function pickView() {
    const from = bookById(view.fromId);
    if (!from) {
      view = { name: 'start' };
      return startView();
    }
    return [
      backButton(`Tillbaka till ${from.title}`, () => go({ name: 'bok', bookId: from.id })),
      heading(`Koppla ihop ${from.title} med …`),
      el('p', { class: 'builder__lead', text: 'Sök fram den andra boken. Finns den inte i galaxen läggs den till.' }),
      searchSection({ purpose: 'koppla', fromId: from.id }),
    ];
  }

  // --- Vy: kopplingsformuläret -----------------------------------------

  function relationView() {
    const existing = view.relationId ? g().relations.find((r) => r.id === view.relationId) : null;
    if ((view.relationId && !existing) || (existing && !ownsRelation(existing))) {
      view = { name: 'start' };
      return startView();
    }
    // Formulärets tillstånd lever i view, så att det finns kvar om galaxen ritas om.
    view.fromId ??= existing?.from;
    view.toId ??= existing?.to;
    view.type ??= existing?.type ?? g().relationTypes[0]?.id;
    view.motivation ??= existing?.motivation ?? '';
    view.signature ??= existing?.signature ?? (me()?.signature || rememberedSignature());
    view.returnTo ??= view.fromId; // boken man kom från, även om riktningen byts
    const from = bookById(view.fromId);
    const to = bookById(view.toId);
    if (!from || !to) {
      view = { name: 'start' };
      return startView();
    }
    const type = getRelationType(g(), view.type);
    const returnTo = view.returnTo;

    const errors = el('div', { class: 'form-error', id: 'relation-error', role: 'alert' });
    const showError = (message, field) => {
      errors.replaceChildren(el('p', { text: message }));
      field?.setAttribute('aria-invalid', 'true');
      field?.focus();
    };

    const direction = type?.directed
      ? el('div', { class: 'direction' }, [
          el('p', { class: 'direction__text' }, [
            'Riktning: från ', el('strong', { text: from.title }), ' till ', el('strong', { text: to.title }), '. ',
            `Sett från ${to.title} heter kopplingen ”${type.reverseName ?? type.name}”.`,
          ]),
          el('button', {
            type: 'button',
            class: 'button button--small',
            text: 'Byt håll',
            onclick: () => {
              [view.fromId, view.toId] = [view.toId, view.fromId];
              render({ focus: false });
              root.querySelector('.direction button')?.focus();
              say(`Nu går kopplingen från ${bookById(view.fromId).title} till ${bookById(view.toId).title}.`);
            },
          }),
        ])
      : el('p', { class: 'direction direction__text', text: 'Den här typen gäller åt båda håll.' });

    const typeField = el('fieldset', { class: 'field types' }, [
      el('legend', { class: 'field__label', text: 'Typ av koppling' }),
      ...g().relationTypes.map((t) => {
        const id = `type-${t.id}`;
        const help = TYPE_HELP[t.id];
        return el('div', { class: 'type' }, [
          el('input', {
            type: 'radio',
            name: 'relation-type',
            id,
            value: t.id,
            checked: t.id === view.type,
            'aria-describedby': help ? `${id}-help` : null,
            onchange: () => {
              view.type = t.id;
              render({ focus: false });
              root.querySelector(`#${id}`)?.focus();
            },
          }),
          el('label', { for: id, class: 'type__label' }, [
            el('span', { class: 'streak', style: `--c:${relationColor(t.id)}` }),
            el('span', { text: t.directed ? `${t.name} (har riktning)` : t.name }),
          ]),
          help ? el('p', { class: 'type__help', id: `${id}-help`, text: help }) : null,
        ]);
      }),
    ]);

    const motivation = el('textarea', {
      id: 'motivation',
      class: 'field__input',
      rows: '3',
      maxlength: String(MOTIVATION_MAX),
      required: true,
      'aria-describedby': 'motivation-hint relation-error',
      oninput: (event) => {
        view.motivation = event.target.value;
        event.target.removeAttribute('aria-invalid');
        counter.textContent = `${event.target.value.length} av ${MOTIVATION_MAX} tecken`;
      },
    });
    motivation.value = view.motivation;
    const counter = el('span', { class: 'field__count', 'aria-hidden': 'true', text: `${view.motivation.length} av ${MOTIVATION_MAX} tecken` });

    const signature = el('input', {
      id: 'signature',
      class: 'field__input',
      autocomplete: 'off',
      maxlength: '80',
      required: true,
      value: view.signature,
      'aria-describedby': 'signature-hint relation-error',
      oninput: (event) => {
        view.signature = event.target.value;
        event.target.removeAttribute('aria-invalid');
      },
    });

    const form = el('form', {
      class: 'builder__form',
      novalidate: true,
      onsubmit: (event) => {
        event.preventDefault();
        const text = view.motivation.trim();
        const sign = view.signature.trim();
        if (!text) return showError('Skriv en motivering: varför ska den som har läst den ena boken läsa den andra?', motivation);
        if (!sign) return showError('Skriv din signatur: förnamn och bibliotek.', signature);
        rememberSignature(sign);
        // Första gången sparas signaturen på kontot, så att den följer med.
        if (shared() && me() && !me().signature) store.setSignature(sign).catch(() => {});
        const pair = `${from.title} – ${to.title}`;
        if (existing) {
          try {
            store.update((galax) => updateRelation(galax, existing.id, { from: from.id, to: to.id, type: view.type, motivation: text, signature: sign }), `ändrade kopplingen ${pair}`);
          } catch (error) {
            return showError(error.message);
          }
          say(`Kopplingen ${pair} är ändrad.`);
        } else {
          let created = true;
          try {
            const result = addRelation(g(), { from: from.id, to: to.id, type: view.type, motivation: text, signature: sign });
            created = result.created;
            if (created) store.update(() => result.galaxy, `kopplade ihop ${pair}`);
          } catch (error) {
            return showError(error.message);
          }
          if (!created) return showError('Det finns redan en koppling av den typen mellan böckerna. Välj en annan typ, eller ändra den som finns från bokens sida.');
          say(`Ett nytt ljusstråk: ${pair}.`);
        }
        go({ name: 'bok', bookId: returnTo });
        flyTo(returnTo, { soon: true });
      },
    }, [
      typeField,
      direction,
      el('div', { class: 'field' }, [
        el('div', { class: 'field__top' }, [el('label', { class: 'field__label', for: 'motivation', text: 'Motivering' }), counter]),
        motivation,
        el('p', { class: 'field__hint', id: 'motivation-hint', text: 'En eller två meningar till den som har läst den ena boken. Varför ska hen läsa den andra?' }),
      ]),
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'signature', text: 'Signatur' }),
        signature,
        el('p', { class: 'field__hint', id: 'signature-hint', text: shared()
          ? 'Förnamn och bibliotek, till exempel ”Vidar, Västerviks bibliotek”. Signaturen syns för alla som ser galaxen. Den sparas på ditt konto.'
          : 'Förnamn och bibliotek, till exempel ”Vidar, Västerviks bibliotek”. Signaturen syns för alla som ser galaxen. Den här webbläsaren minns den åt dig.' }),
      ]),
      errors,
      el('div', { class: 'builder__actions' }, [
        el('button', { type: 'submit', class: 'button button--primary', text: existing ? 'Spara ändringen' : 'Tänd stråket' }),
        el('button', { type: 'button', class: 'button', text: 'Avbryt', onclick: () => go({ name: 'bok', bookId: returnTo }) }),
      ]),
    ]);

    return [
      backButton(existing ? 'Tillbaka till boken' : 'Tillbaka till sökningen', () => go(existing ? { name: 'bok', bookId: returnTo } : { name: 'koppla', fromId: returnTo })),
      heading(existing ? 'Ändra kopplingen' : 'Ny koppling'),
      el('div', { class: 'pair' }, [
        el('div', { class: 'pair__book' }, [cover(from, true), el('span', { text: from.title })]),
        el('span', { class: 'pair__arrow', 'aria-hidden': 'true', text: type?.directed ? '→' : '↔' }),
        el('div', { class: 'pair__book' }, [cover(to, true), el('span', { text: to.title })]),
      ]),
      form,
    ];
  }

  // --- Lösenordsfält ----------------------------------------------------

  function rulesText(value) {
    if (!value) return `Minst ${PASSWORD_MIN} tecken, med stor och liten bokstav, en siffra och ett specialtecken.`;
    const problems = passwordProblems(value);
    return problems.length ? describePasswordProblems(problems) : 'Lösenordet uppfyller kraven.';
  }

  function passwordField(id, label, { autocomplete = 'new-password', rules = true } = {}) {
    const input = el('input', {
      type: 'password',
      id,
      class: 'field__input',
      autocomplete,
      required: true,
      'aria-describedby': rules ? `${id}-rules` : null,
    });
    const hint = rules ? el('p', { class: 'field__hint', id: `${id}-rules`, text: rulesText('') }) : null;
    if (hint) input.addEventListener('input', () => { hint.textContent = rulesText(input.value); });
    return { input, node: el('div', { class: 'field' }, [el('label', { class: 'field__label', for: id, text: label }), input, hint]) };
  }

  function errorBox(id) {
    const box = el('div', { class: 'form-error', id, role: 'alert' });
    box.show = (message, field) => {
      box.replaceChildren(el('p', { text: message }));
      field?.setAttribute('aria-invalid', 'true');
      field?.focus();
    };
    box.clear = () => box.replaceChildren();
    return box;
  }

  // Kör en knapp medan servern svarar: knappen går inte att trycka två gånger.
  async function busy(button, text, run) {
    const before = button.textContent;
    button.disabled = true;
    button.textContent = text;
    try {
      return await run();
    } finally {
      button.disabled = false;
      button.textContent = before;
    }
  }

  // --- Vy: logga in -----------------------------------------------------

  function loginView() {
    const username = el('input', { id: 'login-user', class: 'field__input', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', required: true });
    const password = passwordField('login-pass', 'Lösenord', { autocomplete: 'current-password', rules: false });
    const errors = errorBox('login-error');
    const submit = el('button', { type: 'submit', class: 'button button--primary', text: 'Logga in' });
    const form = el('form', {
      class: 'builder__form',
      novalidate: true,
      onsubmit: async (event) => {
        event.preventDefault();
        errors.clear();
        if (!username.value.trim()) return errors.show('Skriv ditt användarnamn.', username);
        if (!password.input.value) return errors.show('Skriv ditt lösenord.', password.input);
        try {
          await busy(submit, 'Loggar in …', () => store.login(username.value, password.input.value));
        } catch (error) {
          password.input.value = '';
          return errors.show(error.message, password.input);
        }
        say(`Du är inloggad som ${me().username}.`);
        go({ name: galaxy.focusId ? 'bok' : 'start', bookId: galaxy.focusId });
      },
    }, [
      el('div', { class: 'field' }, [el('label', { class: 'field__label', for: 'login-user', text: 'Användarnamn' }), username]),
      password.node,
      errors,
      el('div', { class: 'builder__actions' }, [submit]),
    ]);
    return [
      heading('Logga in för att bygga'),
      el('p', { class: 'builder__lead', text: 'Byggläget är för redaktörer, bibliotekarier som skriver boktips. Här lägger du till och ändrar dina egna boktips. Allas boktips syns i utforskaläget.' }),
      form,
      el('section', { class: 'builder__section', 'aria-labelledby': 'become-editor' }, [
        el('h4', { class: 'builder__subheading', id: 'become-editor', text: 'Vill du bli redaktör?' }),
        el('p', { class: 'builder__meta', text: 'Skicka en förfrågan med e-post. Du får ett användarnamn och ett lösenord tillbaka.' }),
        el('a', { class: 'button', href: redaktorMailto(), text: 'Begär att bli redaktör' }),
      ]),
    ];
  }

  // --- Vy: ditt konto ---------------------------------------------------

  function accountView() {
    const signature = el('input', { id: 'account-signature', class: 'field__input', maxlength: '80', value: me().signature ?? '', 'aria-describedby': 'account-signature-hint' });
    const signErrors = errorBox('account-signature-error');
    const signSubmit = el('button', { type: 'submit', class: 'button', text: 'Spara signaturen' });
    const signForm = el('form', {
      class: 'builder__form',
      onsubmit: async (event) => {
        event.preventDefault();
        signErrors.clear();
        try {
          await busy(signSubmit, 'Sparar …', () => store.setSignature(signature.value));
          say('Signaturen är sparad. Den fylls i när du skriver nya boktips.');
        } catch (error) {
          signErrors.show(error.message, signature);
        }
      },
    }, [
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'account-signature', text: 'Signatur' }),
        signature,
        el('p', { class: 'field__hint', id: 'account-signature-hint', text: 'Förnamn och bibliotek, till exempel ”Vidar, Västerviks bibliotek”. Boktips som du redan har skrivit ändras inte.' }),
      ]),
      signErrors,
      el('div', { class: 'builder__actions' }, [signSubmit]),
    ]);

    const current = passwordField('account-current', 'Nuvarande lösenord', { autocomplete: 'current-password', rules: false });
    const next = passwordField('account-new', 'Nytt lösenord');
    const pwErrors = errorBox('account-password-error');
    const pwSubmit = el('button', { type: 'submit', class: 'button', text: 'Byt lösenord' });
    const pwForm = el('form', {
      class: 'builder__form',
      novalidate: true,
      onsubmit: async (event) => {
        event.preventDefault();
        pwErrors.clear();
        if (!current.input.value) return pwErrors.show('Skriv ditt nuvarande lösenord.', current.input);
        const problems = passwordProblems(next.input.value);
        if (problems.length) return pwErrors.show(describePasswordProblems(problems), next.input);
        try {
          await busy(pwSubmit, 'Byter …', () => store.changePassword(current.input.value, next.input.value));
        } catch (error) {
          return pwErrors.show(error.message, current.input);
        }
        current.input.value = '';
        next.input.value = '';
        say('Lösenordet är bytt. Du är utloggad på andra datorer.');
      },
    }, [current.node, next.node, pwErrors, el('div', { class: 'builder__actions' }, [pwSubmit])]);

    return [
      backButton('Tillbaka', () => go({ name: 'start' })),
      heading('Ditt konto'),
      el('p', { class: 'builder__lead', text: `Du är inloggad som ${me().username}${me().isAdmin ? ', administratör' : ''}.` }),
      el('section', { class: 'builder__section', 'aria-labelledby': 'account-sign' }, [el('h4', { class: 'builder__subheading', id: 'account-sign', text: 'Signatur' }), signForm]),
      el('section', { class: 'builder__section', 'aria-labelledby': 'account-pw' }, [el('h4', { class: 'builder__subheading', id: 'account-pw', text: 'Lösenord' }), pwForm]),
    ];
  }

  // --- Vy: redaktörer (bara administratören) --------------------------

  function loadUsers() {
    view.loading = true;
    remoteApi.listUsers().then(
      ({ users }) => {
        if (view.name !== 'redaktorer') return;
        Object.assign(view, { users, loading: false, error: '' });
        render({ focus: false });
      },
      (error) => {
        if (view.name !== 'redaktorer') return;
        Object.assign(view, { loading: false, error: error.message });
        render({ focus: false });
      },
    );
  }

  function userItem(user) {
    const self = user.id === me().id;
    const resetting = view.resetFor === user.id;
    const reset = resetting ? passwordField(`reset-${user.id}`, `Nytt lösenord för ${user.username}`) : null;
    const resetErrors = errorBox(`reset-error-${user.id}`);
    const resetSubmit = el('button', { type: 'submit', class: 'button button--small button--primary', text: 'Spara lösenordet' });
    return el('li', { class: 'edit-item' }, [
      el('p', { class: 'edit-item__title', text: user.username }),
      el('p', { class: 'builder__meta', text: [user.isAdmin ? 'Administratör' : 'Redaktör', user.signature ? `signerar ”${user.signature}”` : null, self ? 'det är du' : null].filter(Boolean).join(' · ') }),
      resetting
        ? el('form', {
            class: 'builder__form',
            novalidate: true,
            onsubmit: async (event) => {
              event.preventDefault();
              const problems = passwordProblems(reset.input.value);
              if (problems.length) return resetErrors.show(describePasswordProblems(problems), reset.input);
              try {
                await busy(resetSubmit, 'Sparar …', () => remoteApi.updateUser({ id: user.id, password: reset.input.value }));
              } catch (error) {
                return resetErrors.show(error.message, reset.input);
              }
              view.resetFor = null;
              render({ focus: false });
              say(`${user.username} har fått ett nytt lösenord. Skicka det till redaktören.`);
            },
          }, [
            reset.node,
            resetErrors,
            el('div', { class: 'edit-item__actions' }, [
              resetSubmit,
              el('button', { type: 'button', class: 'button button--small', text: 'Avbryt', onclick: () => { view.resetFor = null; render({ focus: false }); } }),
            ]),
          ])
        : el('div', { class: 'edit-item__actions' }, [
            el('button', {
              type: 'button',
              class: 'button button--small',
              'aria-label': `Nytt lösenord för ${user.username}`,
              text: 'Nytt lösenord',
              onclick: () => {
                view.resetFor = user.id;
                render({ focus: false });
                root.querySelector(`#reset-${CSS.escape(user.id)}`)?.focus();
              },
            }),
            self ? null : el('button', {
              type: 'button',
              class: 'button button--small button--danger',
              'aria-label': `Ta bort kontot ${user.username}`,
              text: 'Ta bort',
              onclick: async () => {
                if (!confirm(`Kontot ${user.username} tas bort. Boktipsen som ${user.username} har skrivit finns kvar, men bara du kan ändra dem. Vill du fortsätta?`)) return;
                try {
                  await remoteApi.deleteUser(user.id);
                } catch (error) {
                  return say(error.message);
                }
                view.users = view.users.filter((u) => u.id !== user.id);
                render({ focus: false });
                root.querySelector('.builder__heading')?.focus();
                say(`Kontot ${user.username} är borttaget.`);
              },
            }),
          ]),
    ]);
  }

  function editorsView() {
    if (!me()?.isAdmin) {
      view = { name: 'start' };
      return startView();
    }
    if (!view.users && !view.loading && !view.error) loadUsers();

    const username = el('input', { id: 'new-user', class: 'field__input', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', required: true, 'aria-describedby': 'new-user-hint' });
    const password = passwordField('new-user-pass', 'Lösenord');
    const admin = el('input', { type: 'checkbox', id: 'new-user-admin' });
    const errors = errorBox('new-user-error');
    const submit = el('button', { type: 'submit', class: 'button button--primary', text: 'Skapa kontot' });
    const form = el('form', {
      class: 'builder__form',
      novalidate: true,
      onsubmit: async (event) => {
        event.preventDefault();
        errors.clear();
        if (!username.value.trim()) return errors.show('Skriv ett användarnamn.', username);
        const problems = passwordProblems(password.input.value);
        if (problems.length) return errors.show(describePasswordProblems(problems), password.input);
        let created;
        try {
          created = await busy(submit, 'Skapar …', () => remoteApi.createUser({ username: username.value, password: password.input.value, isAdmin: admin.checked }));
        } catch (error) {
          return errors.show(error.message, username);
        }
        view.users = [...(view.users ?? []), created.user].sort((a, b) => a.username.localeCompare(b.username, 'sv'));
        render({ focus: false });
        root.querySelector('#new-user')?.focus();
        say(`Kontot ${created.user.username} är skapat. Skicka användarnamnet och lösenordet till redaktören.`);
      },
    }, [
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'new-user', text: 'Användarnamn' }),
        username,
        el('p', { class: 'field__hint', id: 'new-user-hint', text: 'Bokstäver, siffror, punkt och bindestreck, till exempel anna.svensson.' }),
      ]),
      password.node,
      el('div', { class: 'field field--check' }, [admin, el('label', { for: 'new-user-admin', text: 'Administratör (kan se och ändra allt, och skapa konton)' })]),
      errors,
      el('div', { class: 'builder__actions' }, [submit]),
    ]);

    return [
      backButton('Tillbaka', () => go({ name: 'start' })),
      heading('Redaktörer'),
      el('p', { class: 'builder__lead', text: 'Skapa ett konto när någon har bett om att bli redaktör. Lösenordet visas inte igen, så skicka det till redaktören direkt.' }),
      el('section', { class: 'builder__section', 'aria-labelledby': 'users-new' }, [el('h4', { class: 'builder__subheading', id: 'users-new', text: 'Nytt konto' }), form]),
      el('section', { class: 'builder__section', 'aria-labelledby': 'users-list' }, [
        el('h4', { class: 'builder__subheading', id: 'users-list', text: view.users ? `Konton (${view.users.length})` : 'Konton' }),
        view.error ? el('p', { class: 'results__status results__status--error', text: view.error }) : null,
        !view.users && !view.error ? el('p', { class: 'builder__meta', role: 'status', text: 'Hämtar kontona …' }) : null,
        view.users ? el('ul', { class: 'edit-list' }, view.users.map(userItem)) : null,
      ]),
    ];
  }

  // --- Ritning ----------------------------------------------------------

  function render({ focus = true } = {}) {
    if (root.hidden) return;
    const views = { start: startView, 'ny-bok': newBookView, bok: bookView, koppla: pickView, koppling: relationView, konto: accountView, redaktorer: editorsView };
    const loggedOut = shared() && !me();
    const content = loggedOut ? loginView() : (views[view.name] ?? startView)();
    const label = store.undoLabel;
    const top = el('div', { class: 'builder__top' }, [
      el('h2', { class: 'builder__mode', text: 'Byggläget' }),
      loggedOut ? null : el('button', {
        type: 'button',
        class: 'button button--small',
        disabled: !label,
        'aria-describedby': label ? 'builder-last' : null,
        text: 'Ångra',
        onclick: undo,
      }),
    ]);
    const account = shared() && me()
      ? el('div', { class: 'builder__account' }, [
          el('p', { class: 'builder__meta', text: `Inloggad som ${me().username}${me().isAdmin ? ' (administratör)' : ''}` }),
          el('div', { class: 'builder__account-actions' }, [
            el('button', { type: 'button', class: 'link-button', text: 'Ditt konto', onclick: () => go({ name: 'konto' }) }),
            me().isAdmin ? el('button', { type: 'button', class: 'link-button', text: 'Redaktörer', onclick: () => go({ name: 'redaktorer' }) }) : null,
            el('button', {
              type: 'button',
              class: 'link-button',
              text: 'Logga ut',
              onclick: async () => {
                await store.logout();
                say('Du är utloggad.');
                go({ name: 'start' });
              },
            }),
          ]),
        ])
      : null;
    const viewKey = `${loggedOut ? 'login' : view.name}|${view.bookId ?? view.fromId ?? view.relationId ?? ''}`;
    const scroll = root.scrollTop;
    const reminder = store.dirty && !shared()
      ? el('div', { class: 'builder__reminder' }, [
          el('p', { text: 'Ändringarna finns bara i den här webbläsaren.' }),
          el('button', { type: 'button', class: 'button button--small button--primary', text: 'Exportera', onclick: onExport }),
        ])
      : null;
    const last = label && !loggedOut ? el('p', { class: 'builder__undo', id: 'builder-last', text: `Senaste ändringen: ${label}.` }) : null;
    root.replaceChildren(...[top, account, reminder, last, ...[].concat(content)].filter(Boolean));
    if (focus) {
      root.scrollTop = 0;
      root.querySelector('.builder__heading')?.focus();
    } else if (viewKey === lastRendered) root.scrollTop = scroll;
    lastRendered = viewKey;
  }

  function undo() {
    const label = store.undo();
    say(label ? `Ångrat: ${label}.` : 'Det finns inget att ångra.');
    // Böcker eller kopplingar som vyn visade kan vara borta nu.
    render({ focus: false });
    const button = root.querySelector('.builder__top button');
    if (button && !button.disabled) button.focus();
    else root.querySelector('.builder__heading')?.focus();
  }

  return {
    show() {
      root.hidden = false;
      if (galaxy.focusId) view = { name: 'bok', bookId: galaxy.focusId };
      render();
    },
    hide() {
      searchController?.abort();
      root.hidden = true;
    },
    // Galaxen har ändrats (efter store.update eller ångra): rita om utan att flytta fokus.
    refresh() {
      render({ focus: false });
    },
    // En stjärna har klickats i galaxen.
    openBook(bookId) {
      if (bookId && bookById(bookId)) openBook(bookId, { fly: false });
    },
    undo,
  };
}
