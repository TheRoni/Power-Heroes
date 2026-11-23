// offline.js: makes the game work with no internet. The first visit saves every game file on the phone (sw.js, the
// "service worker"), and after that the game loads from the saved copy. It only works on a real web address (not on a
// file, not in the automatic tests' fake address, and not inside the Claude link), so everywhere else this does nothing.
export function registerOffline() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});   // if it cannot, the game simply needs the internet as before
  });
}
