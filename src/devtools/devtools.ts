/**
 * DevTools page script
 * Creates the Astro Inspector panel in Chrome DevTools
 */

chrome.devtools.panels.create(
  "Astro Inspector", // Panel title
  "", // Icon path (empty for now)
  "src/panel/index.html", // Panel HTML page
);
