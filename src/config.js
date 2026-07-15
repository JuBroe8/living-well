import { entryUnchecked } from './data/models.js';

export var SB = 'https://beglfjfqzczhjxzsgxgc.supabase.co';

export var SK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlZ2xmamZxemN6aGp4enNneGdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNzQzMTksImV4cCI6MjA5Mjk1MDMxOX0.63T9b1GvvwJ64vkA7r0rBmm7jYVxWjj_thLFW3iDG-Y';

export var KAT_ICON  = { Anekdote: '◈', Zitat: '"', Fakt: '·', Stil: '◉' };

export var KAT_CI    = { Anekdote: 'ci-A', Zitat: 'ci-Z', Fakt: 'ci-F', Stil: 'ci-S' };

export var KAT_ORDER = ['Anekdote', 'Zitat', 'Fakt', 'Stil'];

export var FORMAT_EIGNUNG = ['doppelseite', 'kurzprofil', 'kapitelauftakt', 'randnotiz', 'zitatseite'];

export var QUELLENQUALITAET = ['unbekannt', 'sekundaer', 'primaer', 'geprueft'];

export var BUCHREIFE = ['roh', 'brauchbar', 'stark', 'final'];

export var SEITENROLLE = ['haupttext', 'auftakt', 'marginalie', 'bildunterschrift', 'abschluss', 'unentschieden'];

export var THEMA_LIST = ['Arbeit', 'Disziplin', 'Freiheit', 'Stil', 'Koerper', 'Tod', 'Scheitern', 'Ruhm', 'Freundschaft', 'Liebe', 'Natur', 'Genuss', 'Risiko', 'Alter', 'Einsamkeit'];

export var PILOT_THESIS = 'Living Well porträtiert Menschen, die ihr Leben radikal nach einer eigenen Idee formten – und zeigt an konkreten Szenen, was daran inspirierend, widersprüchlich und teuer war.';

export var CANDIDATE_STAGES = ['pruefen', 'shortlist', 'selected', 'parked'];

export var CANDIDATE_EDIT_STAGES = ['pool'].concat(CANDIDATE_STAGES);

export var STAGE_LABELS = { pool:'Pool', pruefen:'Prüfen', shortlist:'Shortlist', selected:'Im Pilot', parked:'Parken' };

export var FIT_FIELDS = [
  ['thesis_fit', 'Eigene, radikale Lebensidee'],
  ['scene_potential', 'Szenische Ergiebigkeit'],
  ['tension_depth', 'Widerspruch und Preis'],
  ['resonance_value', 'Heutige Resonanz und Inspiration'],
  ['visual_potential', 'Visuelles Potenzial'],
  ['ensemble_value', 'Eigenständiger Ensemblebeitrag']
];

export var LABEL = {
  doppelseite: 'Doppelseite',
  kurzprofil: 'Kurzprofil',
  kapitelauftakt: 'Kapitelauftakt',
  randnotiz: 'Randnotiz',
  zitatseite: 'Zitatseite',
  unbekannt: 'Unbekannt',
  sekundaer: 'Sekundär',
  primaer: 'Primär',
  geprueft: 'Geprüft',
  roh: 'Roh',
  brauchbar: 'Brauchbar',
  stark: 'Stark',
  final: 'Final',
  haupttext: 'Haupttext',
  auftakt: 'Auftakt',
  marginalie: 'Marginalie',
  bildunterschrift: 'Bildunterschrift',
  abschluss: 'Abschluss',
  unentschieden: 'Unentschieden',
  Koerper: 'Körper',
  fehlende_these: 'Fehlende These',
  starke_personen: 'Starke Personen',
  ungepruefte_quellen: 'Ungeprüfte Quellen',
  formatbereit: 'Format',
  buchreif: 'Buchreif',
  ohne_material: 'Ohne Material',
  dossier_offen: 'Dossier offen',
  dossier_bereit: 'Dossier bereit',
  fit_offen: 'Fit offen',
  strong_entries: 'Stark',
  unchecked_entries: 'Ungeprüft',
  unlinked_entries: 'Zuordnung offen',
  manual: 'Menschlich bestätigt',
  ai: 'KI-Vorschlag',
  hybrid: 'KI + menschlich geprüft',
  import: 'Importiert',
  pool: 'Pool',
  pruefen: 'Prüfen',
  shortlist: 'Shortlist',
  selected: 'Im Pilot',
  parked: 'Parken'
};

export var BLOCK_FONTS = { serif: "Georgia, 'Times New Roman', serif", sans: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif" };

export var PAGE_W = 480;

export var PAGE_H = 678;

export var TAG_THEME_RULES = {
  Arbeit: ['arbeit','werk','beruf','job','routine','schreibtisch','karriere','bankbeamter','atelier'],
  Disziplin: ['disziplin','training','routine','boxring','polo','fitness','morgens','ausdauer','kontrolle'],
  Freiheit: ['freiheit','unabhaengig','unabhängig','rebell','playboy','reisen','abenteuer','gegen konventionen'],
  Stil: ['stil','mode','eleganz','cool','kleidung','film','italien','paris','cinema','cavett','sophia','dolce vita','jermyn'],
  Koerper: ['körper','koerper','sport','boxen','tennis','polo','rennen','racing','physisch','wetsuit'],
  Tod: ['tod','sterben','bois','grab','letzte','vergaenglichkeit','vergänglichkeit'],
  Scheitern: ['scheitern','reue','fall','verfall','wunde','fehler','dunkle seite','tragik'],
  Ruhm: ['ruhm','star','weltstar','hollywood','fame','berühmt','beruehmt','film','publicity'],
  Freundschaft: ['freund','freundschaft','netzwerk','cassini','taki','mentor','tueroeffner','türöffner'],
  Liebe: ['liebe','frauen','ehe','lover','latin lover','doris','faye','hutton','romanze','verfuehrung','verführung'],
  Natur: ['natur','garten','meer','berg','wüste','wueste','wald'],
  Genuss: ['genuss','wein','essen','restaurant','calvados','nacht','tour d','dolce vita','cafe','café'],
  Risiko: ['risiko','ferrari','krieg','trujillo','rennsport','unfall','jagd','wette','gefährlich','gefaehrlich'],
  Alter: ['alter','spät','spaet','letzte jahre','altwerden'],
  Einsamkeit: ['einsamkeit','allein','isolation','exil','verloren']
};

export var MORE_VIEWS = ['entries', 'places', 'kosten'];

export var PROFILE_TABS = [['overview', 'Übersicht'], ['material', 'Material'], ['gallery', 'Bilder & Gestaltung'], ['details', 'Details']];

export var ENHANCE_FILTERS = {
  null: {
    label: 'Alle Einträge',
    filter: null,
    context: 'Bitte vorhandene Einträge kuratorisch bewerten. Keine bestehenden Texte umschreiben; nur Vorschläge für Kuration, Themen, Quellenqualität, Buchreife und Seitenrolle.'
  },
  Anekdote: {
    label: 'Anekdoten',
    filter: function(x) { return x.kategorie === 'Anekdote'; },
    context: 'Fokus auf Anekdoten: Stärke und Erzählbarkeit bewerten. Sind die Szenen konkret, überraschend, mit Ort und Zeit? Buchreife, Ton und Seitenrolle (haupttext/auftakt) vorschlagen. Starke Anekdoten bekommen staerke 4–5.'
  },
  Zitat: {
    label: 'Zitate',
    filter: function(x) { return x.kategorie === 'Zitat'; },
    context: 'Fokus auf Zitate: Quellenqualität kritisch prüfen — sind diese Zitate wirklich belegt und authentisch? Buchreife und Seitenrolle (auftakt/marginalie/zitatseite) vorschlagen. Bei zweifelhafter Zuschreibung buchreife auf "brauchbar" oder "roh" setzen, quellenqualitaet nicht überschätzen.'
  },
  Fakt: {
    label: 'Fakten',
    filter: function(x) { return x.kategorie === 'Fakt'; },
    context: 'Fokus auf Fakten: Welche sind buchrelevant als Randnotiz oder Hintergrundinfo, welche nur Recherchematerial? Stärke, Buchreife und Seitenrolle (marginalie/bildunterschrift) vorschlagen.'
  },
  Stil: {
    label: 'Stil-Einträge',
    filter: function(x) { return x.kategorie === 'Stil'; },
    context: 'Fokus auf Stil-Einträge: Gewohnheiten und Rituale — wie buchfähig sind sie als konkrete, sinnliche Szene? Ton und Seitenrolle bewerten. Starke Stil-Einträge machen abstrakte Charaktereigenschaften greifbar sichtbar.'
  },
  quellen: {
    label: 'Quellen prüfen',
    filter: entryUnchecked,
    context: 'Fokus auf Quellenqualität: Alle Einträge mit unbekannter oder ungeprüfter Quelle kritisch bewerten. Quellenqualität auf "sekundaer", "primaer" oder "geprueft" setzen wenn möglich — "geprueft" nur bei eindeutiger Primärquelle. Nicht verifizierbare Einträge bei "unbekannt" belassen und buchreife entsprechend anpassen.'
  }
};

export var IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export var PERSON_SORT_RANK = { review: 0, dossier: 1, fit: 2, page: 3, decide: 4, pilot: 5, research: 6, done: 7 };

export var PILOT_COLUMN_EMPTY = {
  pruefen: 'Bewertete Personen erscheinen hier zur Entscheidung.',
  shortlist: 'Bewertete Personen können hier auf die Shortlist gesetzt werden.',
  selected: 'Noch niemand ausgewählt. Beginne oben mit der Prüfung.',
  parked: 'Zurückgestellte Kandidaten landen hier.'
};

export var GEMINI_GROUNDING_FREE_MONTHLY = 5000;

export var BLOCK_TYPE_LABELS = { text: 'Textfeld', quote: 'Zitat', heading: 'Überschrift', image: 'Bild' };

export var THUMB_SCALE = 178 / PAGE_W;
