// Lagring i webbläsaren, med export och import av galaxfilen.
//
// Galaxen sparas i webbläsarens lagring (localStorage). Den kan raderas utan
// förvarning, så sidan håller reda på om det finns ändringar som inte är
// exporterade och påminner om det. Inga uppgifter om besökaren sparas, bara
// galaxen.

import { normalizeGalaxy, createEmptyGalaxy, setPositions } from './model.js';
import { mergeGalaxies } from './merge.js';

const STORAGE_KEY = 'bokgalaxen.galax.v1';
const START_FILE = `${import.meta.env?.BASE_URL ?? '/'}startgalax.json`;

export function createStore({ storage = globalThis.localStorage, fetchImpl = globalThis.fetch?.bind(globalThis) } = {}) {
  let galaxy = createEmptyGalaxy();
  let dirty = false; // true = det finns ändringar som inte är exporterade
  let source = 'tom'; // 'webbläsaren' | 'startfilen' | 'tom'
  const listeners = new Set();

  function notify(change) {
    for (const fn of listeners) fn({ galaxy, dirty, source, change });
  }

  function persist() {
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

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    // Läser galaxen: först från webbläsaren, annars från startfilen i repot.
    async load() {
      try {
        const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
        if (saved?.galaxy) {
          galaxy = normalizeGalaxy(saved.galaxy);
          dirty = Boolean(saved.dirty);
          source = 'webbläsaren';
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
      notify('load');
      return galaxy;
    },

    // En ändring som bibliotekarien har gjort. Markerar galaxen som inte exporterad.
    // update är en funktion som tar galaxen och ger tillbaka en ny (se model.js).
    update(update) {
      galaxy = normalizeGalaxy(update(galaxy));
      dirty = true;
      persist();
      notify('edit');
      return galaxy;
    },

    // Positionerna sparas när layouten har lagt sig. Det räknas inte som en
    // ändring som behöver exporteras, annars skulle varje besökare få en påminnelse.
    savePositions(positions) {
      galaxy = setPositions(galaxy, positions);
      persist();
      notify('positions');
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
      galaxy = normalizeGalaxy(typeof json === 'string' ? JSON.parse(json) : json);
      dirty = true;
      source = 'webbläsaren';
      persist();
      notify('import');
      return galaxy;
    },

    // Slår ihop en fil med galaxen som finns. Svarar med en sammanfattning.
    importMerge(json) {
      const incoming = typeof json === 'string' ? JSON.parse(json) : json;
      const { galaxy: merged, summary } = mergeGalaxies(galaxy, incoming);
      galaxy = merged;
      dirty = true;
      source = 'webbläsaren';
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
      notify('load');
      return galaxy;
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
