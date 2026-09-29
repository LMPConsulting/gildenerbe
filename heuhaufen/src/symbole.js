// Kleine SVG-Zeichen, alle auf einem 32er-Raster und in currentColor, damit sie
// die Farbe ihres Knopfs oder ihrer Gruppe übernehmen.

const symSvg = (inhalt, klasse = 'sym') =>
  `<svg class="${klasse}" viewBox="0 0 32 32" aria-hidden="true">${inhalt}</svg>`;

const LINIE = 'fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';
const FLAECHE = 'fill="currentColor"';

export const SYM = {
  haufen: symSvg(`<path d="M3 26 Q7 12 16 8 Q25 12 29 26 Z" ${FLAECHE}/><path d="M11 20l2-4M17 18l1-5M21 21l2-4" stroke="#1a1510" stroke-width="1.6" stroke-linecap="round"/>`),
  halle: symSvg(`<path d="M3 27V13l7 4v-4l7 4v-4l7 4V6h5v21Z" ${FLAECHE}/>`),
  forschung: symSvg(`<circle cx="7" cy="16" r="3.5" ${FLAECHE}/><circle cx="24" cy="7" r="3.5" ${FLAECHE}/><circle cx="24" cy="25" r="3.5" ${FLAECHE}/><path d="M10 16h5M15 7v18M15 7h6M15 25h6" ${LINIE}/>`),
  nadeln: symSvg(`<path d="M5 27 L24 8" ${LINIE}/><ellipse cx="25" cy="7" rx="2.2" ry="3.4" transform="rotate(45 25 7)" ${LINIE} stroke-width="1.6"/><path d="M12 27 L27 12" ${LINIE} stroke-width="1.6" opacity="0.55"/>`),
  menue: symSvg(`<path d="M6 9h20M6 16h20M6 23h20" ${LINIE}/>`),
  nadel: symSvg(`<path d="M6 26 L25 7" ${LINIE}/><ellipse cx="25.5" cy="6.5" rx="2.2" ry="3.4" transform="rotate(45 25.5 6.5)" ${LINIE} stroke-width="1.6"/>`),
  geld: symSvg(`<circle cx="16" cy="16" r="11" ${LINIE}/><path d="M20 11.5c-1-1.2-2.4-1.7-4-1.7-2.2 0-3.8 1.2-3.8 3s1.6 2.4 3.8 2.9 4 1.2 4 3.1-1.8 3.2-4 3.2c-1.7 0-3.2-.6-4.2-1.8M16 7.5v17" ${LINIE} stroke-width="2"/>`),
  tasche: symSvg(`<path d="M7 11h18l-2 15H9Z" ${LINIE}/><path d="M9 11c0-4 14-4 14 0" ${LINIE}/>`),
  ausdauer: symSvg(`<path d="M16 27s-10-6-10-13a5.5 5.5 0 0 1 10-3 5.5 5.5 0 0 1 10 3c0 7-10 13-10 13Z" ${LINIE}/>`),
  drohne: symSvg(`<path d="M9 16h14M12 16v4h8v-4" ${LINIE}/><path d="M4 11h8M20 11h8M8 11v5M24 11v5" ${LINIE}/>`),
  ankauf: symSvg(`<path d="M5 27V12h22v15" ${LINIE}/><path d="M3 12h26l-3-6H6Z" ${LINIE}/><path d="M12 27v-8h8v8" ${LINIE}/>`),
  laster: symSvg(`<path d="M3 9h15v13H3zM18 13h6l4 5v4H18z" ${LINIE}/><circle cx="8" cy="24" r="2.5" ${FLAECHE}/><circle cx="23" cy="24" r="2.5" ${FLAECHE}/>`),
  ladung: symSvg(`<path d="M3 26 Q8 14 16 11 Q24 14 29 26 Z" ${LINIE}/><path d="M16 3v6M13 6l3 3 3-3" ${LINIE}/>`),
  mission: symSvg(`<path d="M7 4h14l4 4v20H7Z" ${LINIE}/><path d="M11 13l3 3 6-6M11 21h10" ${LINIE}/>`),
  radar: symSvg(`<path d="M6 24a14 14 0 0 1 20 0M10 20a8 8 0 0 1 12 0" ${LINIE}/><circle cx="16" cy="24" r="2.5" ${FLAECHE}/>`),
  pfeil: symSvg(`<path d="M12 7l9 9-9 9" ${LINIE}/>`),
  zu: symSvg(`<path d="M8 8l16 16M24 8L8 24" ${LINIE}/>`),
  haken: symSvg(`<path d="M6 17l6 6 14-14" ${LINIE}/>`),
  schloss: symSvg(`<rect x="7" y="14" width="18" height="13" rx="2" ${LINIE}/><path d="M11 14v-4a5 5 0 0 1 10 0v4" ${LINIE}/>`),
  lupe: symSvg(`<circle cx="13" cy="13" r="8" ${LINIE}/><path d="M19 19l8 8" ${LINIE}/>`),
  zoomAus: symSvg(`<circle cx="13" cy="13" r="8" ${LINIE}/><path d="M19 19l8 8M9 13h8" ${LINIE}/>`),
  zoomEin: symSvg(`<circle cx="13" cy="13" r="8" ${LINIE}/><path d="M19 19l8 8M9 13h8M13 9v8" ${LINIE}/>`),
};

/** Die Werkzeugleiste. */
export const WERKZEUG_SYM = {
  spaten: symSvg(`<path d="M16 3v14" ${LINIE}/><path d="M12 3h8" ${LINIE}/><path d="M11 17h10l-1 8-4 4-4-4Z" ${FLAECHE}/>`),
  heugabel: symSvg(`<path d="M16 29V14" ${LINIE}/><path d="M9 3v7a7 7 0 0 0 14 0V3M16 3v11" ${LINIE}/>`),
  sandschaufel: symSvg(`<path d="M16 3v12" stroke="#e8c547" stroke-width="3" stroke-linecap="round"/><path d="M9 15h14l-2 9a5 5 0 0 1-10 0Z" fill="#e8c547"/>`),
  besen: symSvg(`<path d="M22 3L14 17" ${LINIE}/><path d="M9 15l10 5-4 9-11-5Z" ${FLAECHE}/>`),
  sauger: symSvg(`<rect x="16" y="6" width="11" height="14" rx="3" ${LINIE}/><path d="M16 14c-6 0-9 3-9 8v5h6" ${LINIE}/><circle cx="19" cy="24" r="2.5" ${FLAECHE}/><circle cx="25" cy="24" r="2.5" ${FLAECHE}/>`),
  detektor: symSvg(`<path d="M9 26L21 7" ${LINIE}/><ellipse cx="8" cy="26" rx="6" ry="2.8" ${LINIE}/><path d="M21 7h5" ${LINIE}/><circle cx="24" cy="12" r="2" ${FLAECHE}/>`),
};

/** Ein Zeichen je Maschine. */
export const MASCHINEN_SYM = {
  rechen: symSvg(`<rect x="3" y="12" width="12" height="9" rx="1.5" ${LINIE}/><path d="M15 16h8M23 10v12M27 10v12" ${LINIE}/>`),
  arm: symSvg(`<path d="M6 27h10M11 27v-6l8-8 5 3" ${LINIE}/><circle cx="11" cy="21" r="2" ${FLAECHE}/><path d="M24 16l3-2M24 16l1 4" ${LINIE}/>`),
  rohrwerfer: symSvg(`<path d="M4 24l10-10" ${LINIE} stroke-width="4"/><path d="M17 11c3-3 7-4 11-3" ${LINIE} stroke-dasharray="2 3"/><circle cx="6" cy="25" r="3" ${FLAECHE}/>`),
  scanner: symSvg(`<path d="M5 27V7h22v20" ${LINIE}/><path d="M9 17h14" stroke="currentColor" stroke-width="2" stroke-dasharray="2 2"/>`),
  radar: symSvg(`<path d="M6 24a14 14 0 0 1 20 0M10 20a8 8 0 0 1 12 0" ${LINIE}/><circle cx="16" cy="24" r="2.5" ${FLAECHE}/>`),
  generator: symSvg(`<rect x="4" y="11" width="22" height="15" rx="2" ${LINIE}/><path d="M22 11V5M17 13l-4 6h5l-2 5" ${LINIE}/>`),
  dampf: symSvg(`<path d="M8 27V13a8 8 0 0 1 16 0v14Z" ${LINIE}/><path d="M12 5c1 2-1 3 0 5M18 4c1 2-1 3 0 5" ${LINIE}/>`),
  brunnen: symSvg(`<path d="M8 27h16M11 27V15h10v12" ${LINIE}/><path d="M6 12l20-5" ${LINIE}/><path d="M16 18c-2 3-2 5 0 5s2-2 0-5Z" ${FLAECHE}/>`),
  silo: symSvg(`<path d="M9 27V10a7 5 0 0 1 14 0v17Z" ${LINIE}/><circle cx="16" cy="21" r="3" ${FLAECHE}/>`),
  presse: symSvg(`<rect x="7" y="14" width="18" height="12" rx="2" ${LINIE}/><path d="M16 4v8M11 12h10" ${LINIE}/><path d="M10 19h12M10 23h12" ${LINIE} stroke-width="1.4"/>`),
  pellet: symSvg(`<circle cx="16" cy="14" r="8" ${LINIE}/><circle cx="16" cy="14" r="2" ${FLAECHE}/><path d="M9 27h14" ${LINIE}/>`),
  pulper: symSvg(`<path d="M6 10h20l-3 17H9Z" ${LINIE}/><path d="M16 4v14M11 16c3 3 7-3 10 0" ${LINIE}/>`),
  wickler: symSvg(`<circle cx="16" cy="17" r="9" ${LINIE}/><path d="M7 14c6 3 12 3 18 0M7 20c6 3 12 3 18 0" ${LINIE} stroke-width="1.6"/>`),
  papier: symSvg(`<path d="M8 4h12l5 5v19H8Z" ${LINIE}/><path d="M12 14h9M12 19h9M12 24h6" ${LINIE} stroke-width="1.6"/>`),
  brikett: symSvg(`<path d="M3 13h26v14H3z" ${LINIE}/><path d="M3 20h26M11 13v7M21 13v7M16 20v7" ${LINIE} stroke-width="1.6"/>`),
};
