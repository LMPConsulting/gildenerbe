// Kleine SVG-Zeichen, alle auf einem 32er-Raster und in currentColor, damit sie
// die Farbe ihres Knopfs oder ihrer Seltenheit übernehmen.

const symSvg = (inhalt, klasse = 'sym') =>
  `<svg class="${klasse}" viewBox="0 0 32 32" aria-hidden="true">${inhalt}</svg>`;

const LINIE = 'fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';
const FLAECHE = 'fill="currentColor"';

export const SYM = {
  haufen: symSvg(`<path d="M3 26 Q7 12 16 8 Q25 12 29 26 Z" ${FLAECHE}/><path d="M11 20l2-4M17 18l1-5M21 21l2-4" stroke="#1c1712" stroke-width="1.6" stroke-linecap="round"/>`),
  halle: symSvg(`<path d="M3 27V13l7 4v-4l7 4v-4l7 4V6h5v21Z" ${FLAECHE}/>`),
  forschung: symSvg(`<circle cx="7" cy="16" r="3.5" ${FLAECHE}/><circle cx="24" cy="7" r="3.5" ${FLAECHE}/><circle cx="24" cy="25" r="3.5" ${FLAECHE}/><path d="M10 16h5M15 7v18M15 7h6M15 25h6" ${LINIE}/>`),
  funde: symSvg(`<path d="M4 12h24v14H4z" ${LINIE}/><path d="M4 12l3-6h18l3 6M13 17h6" ${LINIE}/>`),
  menue: symSvg(`<path d="M6 9h20M6 16h20M6 23h20" ${LINIE}/>`),
  nadel: symSvg(`<path d="M6 26 L25 7" ${LINIE}/><ellipse cx="25.5" cy="6.5" rx="2.2" ry="3.4" transform="rotate(45 25.5 6.5)" ${LINIE} stroke-width="1.6"/>`),
  geld: symSvg(`<circle cx="16" cy="16" r="11" ${LINIE}/><path d="M20 11.5c-1-1.2-2.4-1.7-4-1.7-2.2 0-3.8 1.2-3.8 3s1.6 2.4 3.8 2.9 4 1.2 4 3.1-1.8 3.2-4 3.2c-1.7 0-3.2-.6-4.2-1.8M16 7.5v17" ${LINIE} stroke-width="2"/>`),
  tasche: symSvg(`<path d="M6 12h20l-2 15H8Z" ${LINIE}/><path d="M11 12a5 5 0 0 1 10 0" ${LINIE}/>`),
  sauger: symSvg(`<path d="M5 25h9l3-8" ${LINIE}/><rect x="16" y="5" width="11" height="13" rx="3" ${LINIE}/><path d="M3 25h4" ${LINIE}/>`),
  drohne: symSvg(`<path d="M9 16h14M12 16v4h8v-4" ${LINIE}/><path d="M4 11h8M20 11h8M8 11v5M24 11v5" ${LINIE}/>`),
  ankauf: symSvg(`<path d="M5 27V9l11-5 11 5v18Z" ${LINIE}/><path d="M11 27v-9h10v9" ${LINIE}/>`),
  detektor: symSvg(`<path d="M8 26L20 8" ${LINIE}/><ellipse cx="7" cy="26" rx="5" ry="2.5" ${LINIE}/><path d="M20 8h5" ${LINIE}/>`),
  ausschuss: symSvg(`<path d="M7 10h18l-2 17H9Z" ${LINIE}/><path d="M5 10h22M13 6h6" ${LINIE}/>`),
  pfeil: symSvg(`<path d="M12 7l9 9-9 9" ${LINIE}/>`),
  zu: symSvg(`<path d="M8 8l16 16M24 8L8 24" ${LINIE}/>`),
  ton: symSvg(`<path d="M5 12h5l7-6v20l-7-6H5Z" ${LINIE}/><path d="M21 11c2 2.5 2 7.5 0 10M25 8c4 4.5 4 11.5 0 16" ${LINIE}/>`),
  tonAus: symSvg(`<path d="M5 12h5l7-6v20l-7-6H5Z" ${LINIE}/><path d="M22 12l7 8M29 12l-7 8" ${LINIE}/>`),
  haken: symSvg(`<path d="M6 17l6 6 14-14" ${LINIE}/>`),
  schloss: symSvg(`<rect x="7" y="14" width="18" height="13" rx="2" ${LINIE}/><path d="M11 14v-4a5 5 0 0 1 10 0v4" ${LINIE}/>`),
  blitz: symSvg(`<path d="M18 3L7 18h8l-2 11 11-15h-8Z" ${FLAECHE}/>`),
  lupe: symSvg(`<circle cx="13" cy="13" r="8" ${LINIE}/><path d="M19 19l8 8" ${LINIE}/>`),
};

/** Ein Zeichen je Maschine. */
export const MASCHINEN_SYM = {
  arm: symSvg(`<path d="M6 27h10M11 27v-6l8-8 5 3" ${LINIE}/><circle cx="11" cy="21" r="2" ${FLAECHE}/><path d="M24 16l3-2M24 16l1 4" ${LINIE}/>`),
  bagger: symSvg(`<path d="M3 24h14v-6h-9v-5h5" ${LINIE}/><path d="M17 20l6-10 5 6-3 3" ${LINIE}/><circle cx="7" cy="27" r="2" ${FLAECHE}/><circle cx="14" cy="27" r="2" ${FLAECHE}/>`),
  scanner: symSvg(`<path d="M5 27V7h22v20" ${LINIE}/><path d="M9 17h14" stroke="currentColor" stroke-width="2" stroke-dasharray="2 2"/>`),
  sortierer: symSvg(`<path d="M4 9h24l-9 9v8l-6 3V18Z" ${LINIE}/>`),
  sichter: symSvg(`<circle cx="13" cy="13" r="8" ${LINIE}/><path d="M19 19l8 8M9 17l8-8" ${LINIE}/>`),
  generator: symSvg(`<rect x="4" y="9" width="24" height="16" rx="3" ${LINIE}/><path d="M17 11l-5 7h5l-2 5" ${LINIE}/>`),
  kessel: symSvg(`<path d="M8 27V13a8 8 0 0 1 16 0v14Z" ${LINIE}/><path d="M12 5c1 2-1 3 0 5M18 4c1 2-1 3 0 5" ${LINIE}/>`),
  wind: symSvg(`<path d="M16 16v12M16 16L10 5M16 16l11 3M16 16L7 24" ${LINIE}/>`),
  solar: symSvg(`<path d="M4 24l4-14h16l4 14Z" ${LINIE}/><path d="M6 17h20M13 10l-2 14M19 10l2 14" ${LINIE} stroke-width="1.6"/>`),
  biogas: symSvg(`<ellipse cx="16" cy="12" rx="10" ry="5" ${LINIE}/><path d="M6 12v12c0 3 20 3 20 0V12" ${LINIE}/>`),
  fusion: symSvg(`<circle cx="16" cy="16" r="4" ${FLAECHE}/><ellipse cx="16" cy="16" rx="12" ry="5" ${LINIE}/><ellipse cx="16" cy="16" rx="12" ry="5" transform="rotate(60 16 16)" ${LINIE}/><ellipse cx="16" cy="16" rx="12" ry="5" transform="rotate(120 16 16)" ${LINIE}/>`),
  presse: symSvg(`<rect x="7" y="14" width="18" height="12" rx="2" ${LINIE}/><path d="M16 4v8M11 12h10" ${LINIE}/><path d="M10 19h12M10 23h12" ${LINIE} stroke-width="1.4"/>`),
  muehle: symSvg(`<circle cx="16" cy="14" r="8" ${LINIE}/><path d="M16 6v16M8 14h16" ${LINIE}/><path d="M9 27h14" ${LINIE}/>`),
  pulper: symSvg(`<path d="M6 10h20l-3 17H9Z" ${LINIE}/><path d="M16 4v14M11 16c3 3 7-3 10 0" ${LINIE}/>`),
  wickler: symSvg(`<circle cx="16" cy="17" r="9" ${LINIE}/><path d="M7 14c6 3 12 3 18 0M7 20c6 3 12 3 18 0" ${LINIE} stroke-width="1.6"/>`),
  papier: symSvg(`<path d="M8 4h12l5 5v19H8Z" ${LINIE}/><path d="M12 14h9M12 19h9M12 24h6" ${LINIE} stroke-width="1.6"/>`),
  ziegel: symSvg(`<path d="M3 13h26v14H3z" ${LINIE}/><path d="M3 20h26M11 13v7M21 13v7M16 20v7" ${LINIE} stroke-width="1.6"/>`),
};

/** Fundstücke, grob wiedererkennbar in 32 Pixeln. */
export const FUND_SYM = {
  knopf: symSvg(`<circle cx="16" cy="16" r="10" ${LINIE}/><circle cx="13" cy="13" r="1.6" ${FLAECHE}/><circle cx="19" cy="13" r="1.6" ${FLAECHE}/><circle cx="13" cy="19" r="1.6" ${FLAECHE}/><circle cx="19" cy="19" r="1.6" ${FLAECHE}/>`),
  kronkorken: symSvg(`<path d="M16 5l2.5 2.5 3.4-.9.9 3.4 3.4.9-.9 3.4L28 16l-2.5 2.5.9 3.4-3.4.9-.9 3.4-3.4-.9L16 27l-2.5-2.5-3.4.9-.9-3.4-3.4-.9.9-3.4L4 16l2.5-2.5-.9-3.4 3.4-.9.9-3.4 3.4.9Z" ${LINIE} stroke-width="1.8"/>`),
  murmel: symSvg(`<circle cx="16" cy="16" r="10" ${LINIE}/><path d="M10 18c4-6 8 2 12-4" ${LINIE}/>`),
  nagel: symSvg(`<path d="M8 6h10M13 6v12c0 4 6 4 6 8" ${LINIE}/>`),
  feder: symSvg(`<path d="M7 27C9 16 16 7 26 5c-2 10-9 17-19 22Z" ${LINIE}/><path d="M7 27l12-13" ${LINIE}/>`),
  muenze: symSvg(`<circle cx="16" cy="16" r="10" ${LINIE}/><circle cx="16" cy="16" r="6" ${LINIE} stroke-width="1.6"/>`),
  hufeisen: symSvg(`<path d="M9 26V15a7 7 0 0 1 14 0v11" ${LINIE} stroke-width="4"/>`),
  schluessel: symSvg(`<circle cx="9" cy="16" r="5" ${LINIE}/><path d="M14 16h14M23 16v4M27 16v3" ${LINIE}/>`),
  fingerhut: symSvg(`<path d="M9 26V14a7 7 0 0 1 14 0v12Z" ${LINIE}/><path d="M12 15h1M16 15h1M20 15h1M12 19h1M16 19h1M20 19h1" ${LINIE}/>`),
  loeffel: symSvg(`<ellipse cx="20" cy="10" rx="5" ry="6" transform="rotate(35 20 10)" ${LINIE}/><path d="M17 15L7 27" ${LINIE}/>`),
  brille: symSvg(`<circle cx="9" cy="17" r="5" ${LINIE}/><circle cx="23" cy="17" r="5" ${LINIE}/><path d="M14 17h4M4 15l-1-3M28 15l1-3" ${LINIE}/>`),
  taschenuhr: symSvg(`<circle cx="16" cy="18" r="9" ${LINIE}/><path d="M16 18v-5M16 18l3 2M16 5v4M13 5h6" ${LINIE}/>`),
  ring: symSvg(`<circle cx="16" cy="19" r="8" ${LINIE} stroke-width="3"/><path d="M12 8l4-4 4 4-4 3Z" ${FLAECHE}/>`),
  messer: symSvg(`<path d="M5 22l12-12 9 1-11 11Z" ${LINIE}/><path d="M5 22l-1 4 4-1" ${LINIE}/>`),
  medaille: symSvg(`<circle cx="16" cy="20" r="7" ${LINIE}/><path d="M11 4l5 9 5-9" ${LINIE}/>`),
  goldzahn: symSvg(`<path d="M9 7c3-2 5 0 7 0s4-2 7 0c2 3 0 8-1 13-1 4-3 5-4 1l-2-5-2 5c-1 4-3 3-4-1-1-5-3-10-1-13Z" ${LINIE}/>`),
  goldmuenze: symSvg(`<circle cx="16" cy="16" r="10" ${FLAECHE}/><path d="M16 10v12M12 13h8M12 19h8" stroke="#1c1712" stroke-width="2" stroke-linecap="round"/>`),
  amulett: symSvg(`<path d="M8 4l8 8 8-8" ${LINIE}/><path d="M16 12l7 8-7 8-7-8Z" ${LINIE}/><circle cx="16" cy="20" r="2" ${FLAECHE}/>`),
  ehering: symSvg(`<circle cx="16" cy="16" r="9" ${LINIE} stroke-width="4"/>`),
  ei: symSvg(`<path d="M16 4c6 0 10 10 10 15a10 10 0 0 1-20 0C6 14 10 4 16 4Z" ${FLAECHE}/>`),
};
