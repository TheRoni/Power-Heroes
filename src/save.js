// save.js: keeps your progress in the browser (localStorage). If the browser will not allow it (a private window, or
// storage turned off) the game still works: it just forgets when the page closes.
const KEY = 'powerheroes.save';

export function createSave(key = KEY) {
  return {
    // The saved progress, or null if there is none (or it cannot be read).
    load() {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        return data && data.version === 1 && data.xp && Array.isArray(data.unlocked) ? data : null;
      } catch (error) {
        return null;
      }
    },
    store(data) {
      try { localStorage.setItem(key, JSON.stringify(data)); } catch (error) { /* storage may be unavailable: that is fine */ }
    },
    clear() {
      try { localStorage.removeItem(key); } catch (error) { /* fine */ }
    },
    // The hero's name is kept apart from the progress, so "Start over" does not forget it.
    loadName() {
      try { return localStorage.getItem(`${key}.name`); } catch (error) { return null; }
    },
    storeName(name) {
      try { localStorage.setItem(`${key}.name`, name); } catch (error) { /* fine */ }
    },
  };
}
