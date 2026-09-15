// Znaki sekcji: nie ikony z biblioteki, tylko małe rysunki danych w tym samym
// języku co wykresy — włosowa kreska, siatka 28×28, dziedziczony kolor.
// Każdy pokazuje mechanizm, o którym mówi wiersz, a nie jego symbol.

const g = (paths: string) =>
  `<svg class="glyph" viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const GLYPHS = {
  // ── Jak działa ──────────────────────────────────────────────────────────
  wprowadzasz: g('<path d="M4 22h20"/><path d="M8 22V12l5-4 5 6 4-3"/><circle cx="8" cy="12" r="1.4"/><circle cx="13" cy="8" r="1.4"/><circle cx="18" cy="14" r="1.4"/>'),
  przelicza:   g('<path d="M5 20V8m6 12V4m6 16v-7m6 7V10"/><path d="M3 24h22"/>'),
  jedno:       g('<rect x="4" y="6" width="9" height="7" rx="1"/><rect x="15" y="6" width="9" height="7" rx="1"/><rect x="4" y="16" width="20" height="6" rx="1"/>'),

  // ── Funkcje ─────────────────────────────────────────────────────────────
  portfele:    g('<rect x="3" y="9" width="8" height="13" rx="1"/><rect x="12" y="5" width="6" height="17" rx="1"/><rect x="19" y="13" width="6" height="9" rx="1"/>'),
  statystyki:  g('<path d="M3 21l6-8 5 4 4-9 7 5"/><path d="M3 24h22"/><circle cx="9" cy="13" r="1.2"/><circle cx="18" cy="8" r="1.2"/>'),
  inflacja:    g('<path d="M3 14h22"/><path d="M4 20l7-3 7 1 7-5"/><path d="M4 9l7 2 7-3 7 1"/>'),
  historia:    g('<path d="M25 7h-6V4"/><path d="M25 7l-5 5-5-3-5 6-6 3"/><path d="M3 24h22"/>'),
  zarobki:     g('<path d="M3 24h22"/><rect x="5" y="14" width="4" height="8"/><rect x="12" y="9" width="4" height="13"/><rect x="19" y="17" width="4" height="5"/><path d="M5 6h18"/>'),
  import:      g('<path d="M14 3v12"/><path d="M10 11l4 4 4-4"/><path d="M4 19v4h20v-4"/><path d="M4 19h20"/>'),
  eksport:     g('<path d="M14 15V3"/><path d="M10 7l4-4 4 4"/><path d="M4 19v4h20v-4"/><path d="M4 19h20"/>'),
  sync:        g('<path d="M6 12a8 8 0 0113.5-4.5"/><path d="M22 16a8 8 0 01-13.5 4.5"/><path d="M20 4v4h-4"/><path d="M8 24v-4h4"/>'),

  // ── Dla polskiego inwestora ─────────────────────────────────────────────
  emerytalne:  g('<rect x="3" y="8" width="9" height="14" rx="1"/><rect x="16" y="8" width="9" height="14" rx="1"/><path d="M12 15h4"/>'),
  obligacje:   g('<rect x="4" y="6" width="20" height="16" rx="1"/><path d="M8 11h8M8 15h12M8 19h6"/>'),
  nbp:         g('<circle cx="14" cy="14" r="10"/><path d="M14 8v12M11 11h5a2 2 0 010 4h-4a2 2 0 000 4h5"/>'),
  gus:         g('<path d="M3 22h22"/><path d="M5 18l5-6 5 3 4-8 4 5"/><path d="M5 22V9"/>'),
  lokaty:      g('<circle cx="14" cy="14" r="9"/><path d="M14 8v6l4 3"/>'),
  waluty:      g('<circle cx="10" cy="14" r="7"/><circle cx="19" cy="14" r="7"/>'),

  // ── Klasy aktywów ───────────────────────────────────────────────────────
  // Świeca giełdowa: korpus i cienie, czyli dokładnie to, czym jest „kurs
  // zamknięcia" z opisu wiersza.
  akcje:       g('<path d="M8 4v5M8 19v5"/><rect x="4.5" y="9" width="7" height="10" rx="0.5"/><path d="M20 6v4M20 20v2"/><rect x="16.5" y="10" width="7" height="10" rx="0.5"/>'),
  // Blok w łańcuchu: sześciokąt z ogniwem, nie logo żadnej monety.
  krypto:      g('<path d="M14 3.5l9 5.2v10.6l-9 5.2-9-5.2V8.7z"/><path d="M11 14h6"/><path d="M11.5 11l-1.6 1.6a2.2 2.2 0 000 3.1L11 17"/><path d="M16.5 11l1.6 1.6a2.2 2.2 0 010 3.1L17 17"/>'),
  // Wpis ręczny: rama z przekątną — obraz, nieruchomość, cokolwiek, co
  // wyceniasz sam, plus znak, że wartość wpisujesz Ty.
  reczne:      g('<rect x="3.5" y="6" width="15" height="15" rx="1"/><path d="M3.5 17l4.5-4.5 4 3.5 3-3"/><path d="M22 5.5v7M25.5 9h-7"/>'),
} as const;

export type GlyphKey = keyof typeof GLYPHS;
