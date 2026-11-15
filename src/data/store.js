// Lagringen av galaxen. Två lägen:
//
// Delad galax (servern finns, till exempel på Vercel): galaxen hämtas från
// /api/galaxy. Varje ändring i byggläget visas direkt och skickas sedan som
// ett ändringspaket (src/data/patch.js) till servern, som kontrollerar att
// redaktören får göra den. Går det inte hämtas galaxen på nytt.
//
// Bara webbläsaren (ingen server, till exempel `vite preview` eller en
// statisk sida): galaxen sparas i webbläsarens lagring (localStorage), med
// export och import av galaxfilen som förut. Lagringen kan raderas utan
// förvarning, så sidan påminner om att exportera.

import { normalizeGalaxy, createEmptyGalaxy, setPositions } from './model.js';
import { mergeGalaxies } from './merge.js';
import { diffGalaxies, authorizePatch, isEmptyPatch } from './patch.js';

const STORAGE_KEY = 'bokgalaxen.galax.v1';
const UNDO_STEPS = 30;
const START_FILE = `${import.meta.env?.BASE_URL ?? '/'}startgalax.json`;

export function createStore({ storage = globalThis.localStorage, fetchImpl = globalThis.fetch?.bind(globalThis), remote = null } = {}) {
  let galaxy = createEmptyGalaxy();
  let dirty = false; // true = det finns ändringar som inte är exporterade (bara webbläsaren)
  let source = 'tom'; // 'servern' | 'webbläsaren' | 'startfilen' | 'tom'
  let shared = false; // true = delad galax via servern
  let user = null; // inloggad redaktör: { id, username, isAdmin, signature }
  let version = 0;
  let unplaced = new Set(); // böcker som saknar plats på servern
  let sending = Promise.resolve();
  const listeners = new Set();
  // Ångra: tidigare galaxer, senaste sist. Finns bara i minnet, inte i lagringen.
  let history = [];

  function notify(change, extra = {}) {
    for (const fn of listeners) fn({ galaxy, dirty, source, change, ...extra });
  }

  function persist() {
    if (shared) return true;
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify({ galaxy, dirty }));
      return true;
    } catch {
      return false; // lagringen är full eller avstängd, galaxen finns kvar i minnet
    }
  }

  async function loadStartFile() {
    const response = await fetchImpl(START_FILE);
    if (!response.ok) throw new Error('Startfilen kunde inte hämtas.');
    return normalizeGalaxy(await response.json());
  }

  // --- Delad galax ------------------------------------------------------

  function takeServerGalaxy(serverGalaxy, serverVersion) {
    const local = new Map(galaxy.books.filter((b) => b.position).map((b) => [b.id, b.position]));
    const incoming = normalizeGalaxy(serverGalaxy);
    unplaced = new Set(incoming.books.filter((b) => !b.position).map((b) => b.id));
    // Böcker som servern inte har någon plats för behåller sin plats här.
    galaxy = setPositions(incoming, new Map([...local].filter(([id]) => unplaced.has(id))));
    version = serverVersion;
  }

  async function refresh() {
    const { galaxy: serverGalaxy, version: serverVersion } = await remote.loadGalaxy();
    takeServerGalaxy(serverGalaxy, serverVersion);
    notify('sync');
  }

  function fail(error) {
    if (error.status === 401) {
      user = null;
      history = [];
      notify('user');
    }
    notify('error', { message: `Ändringen sparades inte. ${error.message}` });
    return refresh().catch(() => {});
  }

  // Skickar ändringspaket i tur och ordning.
  function send(patch) {
    sending = sending.then(async () => {
      try {
        const result = await remote.savePatch(patch);
        if (result.changed && result.version !== version + 1) await refresh(); // någon annan har också ändrat
        else version = result.version;
      } catch (error) {
        await fail(error);
      }
    });
    return sending;
  }

  // Byter galaxen mot next, kontrollerar att redaktören får och skickar ändringen.
  function commit(next) {
    const patch = diffGalaxies(galaxy, next);
    if (isEmptyPatch(patch)) return false;
    authorizePatch(galaxy, patch, user); // kastar ett fel med förklaring direkt, servern kontrollerar igen
    galaxy = next;
    send(patch);
    return true;
  }

  // Nya kopplingar och böcker får den inloggade som ägare.
  function stamp(before, next) {
    if (!user) return next;
    const oldRelations = new Set(before.relations.map((r) => r.id));
    const oldBooks = new Set(before.books.map((b) => b.id));
    return {
      ...next,
      relations: next.relations.map((r) => (oldRelations.has(r.id) || r.owner ? r : { ...r, owner: user.id })),
      books: next.books.map((b) => (oldBooks.has(b.id) || b.addedBy ? b : { ...b, addedBy: user.id })),
    };
  }

  return {
    get galaxy() {
      return galaxy;
    },
    get dirty() {
      return dirty;
    },
    get source() {
      return source;
    },
    // true när galaxen delas via servern och redaktörer loggar in.
    get shared() {
      return shared;
    },
    get user() {
      return user;
    },
    // Vad "Ångra" skulle ångra, till exempel "kopplade ihop Aniara – Doktor Glas". null = inget att ångra.
    get undoLabel() {
      return history.at(-1)?.label ?? null;
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    // Läser galaxen: från servern om den finns, annars från webbläsaren,
    // annars från startfilen i repot.
    async load() {
      if (remote) {
        try {
          const [{ galaxy: serverGalaxy, version: serverVersion }, me] = await Promise.all([remote.loadGalaxy(), remote.me()]);
          shared = true;
          source = 'servern';
          user = me.user;
          dirty = false;
          history = [];
          takeServerGalaxy(serverGalaxy, serverVersion);
          notify('load');
          return galaxy;
        } catch {
          // ingen server: fortsätt med webbläsarens lagring
        }
      }
      try {
        const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
        if (saved?.galaxy) {
          galaxy = normalizeGalaxy(saved.galaxy);
          dirty = Boolean(saved.dirty);
          source = 'webbläsaren';
          history = [];
          notify('load');
          return galaxy;
        }
      } catch {
        // trasig lagring: fortsätt till startfilen
      }
      try {
        galaxy = await loadStartFile();
        source = 'startfilen';
      } catch {
        galaxy = createEmptyGalaxy();
        source = 'tom';
      }
      dirty = false;
      history = [];
      notify('load');
      return galaxy;
    },

    // --- Inloggning (bara delad galax) ----------------------------------

    async login(username, password) {
      const result = await remote.login(username, password);
      user = result.user;
      history = [];
      notify('user');
      return user;
    },

    async logout() {
      await remote.logout().catch(() => {});
      user = null;
      history = [];
      notify('user');
    },

    async setSignature(signature) {
      const result = await remote.setSignature(signature);
      user = result.user;
      return user;
    },

    async changePassword(current, next) {
      const result = await remote.changePassword(current, next);
      user = result.user;
      return user;
    },

    // --- Ändringar ------------------------------------------------------

    // En ändring som redaktören har gjort. update är en funktion som tar
    // galaxen och ger tillbaka en ny (se model.js). label beskriver
    // ändringen för knappen Ångra. Kastar ett fel om ändringen inte är tillåten.
    update(update, label = 'en ändring') {
      const before = galaxy;
      const next = normalizeGalaxy(update(galaxy));
      if (shared) {
        if (!commit(stamp(before, next))) return galaxy;
      } else {
        galaxy = next;
        dirty = true;
        persist();
      }
      history = [...history, { galaxy: before, label }].slice(-UNDO_STEPS);
      notify('edit');
      return galaxy;
    },

    // Går tillbaka ett steg. Stjärnornas nuvarande positioner behålls, så
    // att galaxen inte hoppar. Svar: det som ångrades, eller null.
    undo() {
      const step = history.at(-1);
      if (!step) return null;
      const positions = new Map(galaxy.books.filter((b) => b.position).map((b) => [b.id, b.position]));
      const target = setPositions(step.galaxy, positions);
      if (shared) {
        try {
          commit(target);
        } catch (error) {
          history = history.slice(0, -1);
          notify('error', { message: error.message });
          return null;
        }
      } else {
        galaxy = target;
        dirty = true;
        persist();
      }
      history = history.slice(0, -1);
      notify('undo');
      return step.label;
    },

    // Positionerna sparas när layouten har lagt sig. Det räknas inte som en
    // ändring som behöver exporteras. I den delade galaxen skickas platser
    // för böcker som servern saknar plats för. overwrite (bara
    // administratören) skickar alla, efter "Lägg om galaxen".
    savePositions(positions, { overwrite = false } = {}) {
      galaxy = setPositions(galaxy, positions);
      persist();
      notify('positions');
      if (!shared) return;
      const entries = Object.entries(positions instanceof Map ? Object.fromEntries(positions) : positions);
      const wanted = overwrite && user?.isAdmin ? entries : entries.filter(([id]) => unplaced.has(id));
      if (!wanted.length) return;
      for (const [id] of wanted) unplaced.delete(id);
      sending = sending.then(() => remote.savePositions(Object.fromEntries(wanted), overwrite && user?.isAdmin).then(
        (result) => {
          if (result.changed && result.version === version + 1) version = result.version;
        },
        () => {}, // platser är inte viktiga nog att störa någon med
      ));
    },

    exportJson() {
      return JSON.stringify(galaxy, null, 2);
    },

    // Laddar ner galaxfilen och markerar galaxen som exporterad.
    download() {
      const blob = new Blob([this.exportJson()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bokgalaxen-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      this.markExported();
    },

    markExported() {
      dirty = false;
      persist();
      notify('export');
    },

    // Ersätter hela galaxen med innehållet i en fil.
    importReplace(json) {
      const incoming = normalizeGalaxy(typeof json === 'string' ? JSON.parse(json) : json);
      if (shared) {
        this.update(() => incoming, 'ersatte galaxen med en fil');
        history = [];
        return galaxy;
      }
      galaxy = incoming;
      dirty = true;
      source = 'webbläsaren';
      history = [];
      persist();
      notify('import');
      return galaxy;
    },

    // Slår ihop en fil med galaxen som finns. Svarar med en sammanfattning.
    importMerge(json) {
      const incoming = typeof json === 'string' ? JSON.parse(json) : json;
      const { galaxy: merged, summary } = mergeGalaxies(galaxy, incoming);
      if (shared) {
        this.update(() => merged, 'slog ihop galaxen med en fil');
        history = [];
        return summary;
      }
      galaxy = merged;
      dirty = true;
      source = 'webbläsaren';
      history = [];
      persist();
      notify('import');
      return summary;
    },

    // Kastar det som finns i webbläsaren och läser startfilen på nytt.
    async resetToStartFile() {
      storage?.removeItem(STORAGE_KEY);
      try {
        galaxy = await loadStartFile();
        source = 'startfilen';
      } catch {
        galaxy = createEmptyGalaxy();
        source = 'tom';
      }
      dirty = false;
      history = [];
      notify('load');
      return galaxy;
    },

    // Väntar tills alla ändringar har skickats (för testerna).
    flush() {
      return sending;
    },
  };
}

// Varnar när sidan stängs med ändringar som inte är exporterade.
export function warnBeforeLeaving(store) {
  window.addEventListener('beforeunload', (event) => {
    if (store.dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}
