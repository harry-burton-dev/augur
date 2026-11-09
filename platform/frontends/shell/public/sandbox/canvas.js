/*
 * The page every app's canvas opens in (contract 3, spec 6.11). The shell frames it with a sandbox that
 * leaves it scripts and nothing else, so its origin is opaque, and serves it with a policy that lets it load
 * scripts from the shell's origin and reach nothing. The shell then posts it the app's canvas script and the
 * port the app holds the other end of; the script finds that port as `augurCanvas` and loads after it.
 */
(function () {
  'use strict';
  function take(e) {
    var data = e.data;
    if (e.source !== window.parent || !data || data.augur !== 'canvas' || typeof data.entry !== 'string' || !e.ports || !e.ports[0]) return;
    // Only the app's own script, on the shell's origin: never an address.
    if (data.entry.charAt(0) !== '/' || data.entry.charAt(1) === '/' || data.entry.indexOf('\\') !== -1) return;
    window.removeEventListener('message', take);
    Object.defineProperty(window, 'augurCanvas', { value: e.ports[0], enumerable: true });
    var script = document.createElement('script');
    script.src = data.entry;
    document.head.appendChild(script);
  }
  window.addEventListener('message', take);
})();
