/* The ONE place for the version and the score-sheet address.
   api: the Apps Script web app address (ends in /exec). Empty = scores stay on the device.
   When you change `version`, change V in sw.js to match. */
window.CONFIG = { version: "3", api: "https://script.google.com/macros/s/AKfycbw2b5GT-bvSXrceAkro5dw1XKZA5y7rJ2I5e31KMUW7fEyJHwvdOsXhRDgDC8lK7ixTXQ/exec" };
(function () {
  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var p = new URLSearchParams(location.search);
  if (local) window.CONFIG.api = p.get('api') || '';              // on this Mac: tests only, never the real score sheet
  window.CONFIG.local = local;
  window.CONFIG.seed = local && p.get('seed') ? +p.get('seed') : 0;
  window.CONFIG.fast = local && p.get('fast') === '1';           // tests: skip the opening animation
})();
