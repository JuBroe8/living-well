import { state } from '../state/store.js';
import { arr, cleanChoice, esc, hasText, label, normText, normalizeStrength, normalizeUrl, unique } from '../utils.js';
import { BUCHREIFE, FIT_FIELDS, FORMAT_EIGNUNG, PERSON_SORT_RANK, QUELLENQUALITAET, SEITENROLLE, TAG_THEME_RULES, THEMA_LIST } from '../config.js';

export function normalizeData() {
  state.persons = (state.persons || []).map(function(p) {
    p.tags = arr(p.tags);
    p.format_eignung = arr(p.format_eignung);
    return p;
  });
  state.entries = (state.entries || []).map(function(x) {
    x.tags = arr(x.tags);
    x.themen = arr(x.themen);
    if (x.staerke !== undefined && x.staerke !== null && x.staerke !== '') x.staerke = Number(x.staerke);
    return x;
  });
  state.places = state.places || [];
  state.books = state.books || [];
  state.bookCandidates = state.bookCandidates || [];
  state.researchJobs = state.researchJobs || [];
  state.aiRuns = state.aiRuns || [];
}

export function entryForEnhance(x) {
  return {
    id: x.id,
    person: x.person,
    kategorie: x.kategorie || '',
    buch: x.buch || '',
    tags: arr(x.tags),
    preview: x.preview || '',
    quote: x.quote || '',
    anekdote: x.anekdote || '',
    fakt: x.fakt || '',
    buchnotiz: x.buchnotiz || '',
    quelle: x.quelle || '',
    quelle_url: x.quelle_url || '',
    staerke: x.staerke || null,
    quellenqualitaet: x.quellenqualitaet || '',
    buchreife: x.buchreife || '',
    themen: arr(x.themen),
    ton: x.ton || '',
    seitenrolle: x.seitenrolle || ''
  };
}

export function normalizeEnhanceData(data) {
  data = data || {};
  var person = normalizePersonSuggestion(data.person || {});
  person.tags = arr((data.person || {}).tags);
  var byId = {};
  personEntries(state.profilePerson || {}).forEach(function(x) { if (x.id) byId[x.id] = x; });
  var eSugs = arr(data.entries).map(function(e) {
    e = e || {};
    return {
      id: e.id || '',
      staerke: normalizeStrength(e.staerke),
      quellenqualitaet: cleanChoice(e.quellenqualitaet, QUELLENQUALITAET, ''),
      buchreife: cleanChoice(e.buchreife, BUCHREIFE, ''),
      themen: arr(e.themen).filter(function(t) { return THEMA_LIST.indexOf(t) >= 0; }),
      ton: e.ton || '',
      seitenrolle: cleanChoice(e.seitenrolle, SEITENROLLE, ''),
      buchnotiz: e.buchnotiz || '',
      quelle: e.quelle || '',
      quelle_url: e.quelle_url || '',
      tags: arr(e.tags),
      _entry: byId[e.id] || null
    };
  }).filter(function(e) { return e.id && e._entry; });
  return {
    person: person,
    entries: eSugs,
    tag_mapping: arr(data.tag_mapping)
  };
}

export function hasSuggestion(value, type) {
  if (type === 'array') return arr(value).length > 0;
  if (value === null || value === undefined) return false;
  return String(value).trim() !== '';
}

export function displayValue(value, type) {
  if (type === 'array') return arr(value).map(label).join(', ');
  return value === null || value === undefined ? '' : String(value);
}

export function fieldEmpty(value, key, type) {
  if (type === 'array') return arr(value).length === 0;
  if (key === 'staerke') return strength({ staerke: value }) < 1;
  if (key === 'quellenqualitaet') return !value || value === 'unbekannt';
  if (key === 'buchreife') return !value || value === 'roh';
  if (key === 'seitenrolle') return !value || value === 'unentschieden';
  if (key === 'quelle' || key === 'quelle_url') return !hasText(value);
  return !hasText(value);
}

export function normalizeSingleEntrySuggestion(e) {
  e = e || {};
  return {
    staerke: normalizeStrength(e.staerke),
    quellenqualitaet: cleanChoice(e.quellenqualitaet, QUELLENQUALITAET, ''),
    buchreife: cleanChoice(e.buchreife, BUCHREIFE, ''),
    themen: arr(e.themen).filter(function(t) { return THEMA_LIST.indexOf(t) >= 0; }),
    ton: e.ton || '',
    seitenrolle: cleanChoice(e.seitenrolle, SEITENROLLE, ''),
    buchnotiz: e.buchnotiz || '',
    quelle: e.quelle || '',
    quelle_url: e.quelle_url || '',
    tags: arr(e.tags)
  };
}

export function strength(x) {
  var n = Number(x && x.staerke);
  return isNaN(n) ? 0 : n;
}

export function entryUnchecked(x) {
  return !x.quellenqualitaet || x.quellenqualitaet === 'unbekannt';
}

export function entryText(x) {
  if (x.kategorie === 'Zitat') return x.quote || x.anekdote || x.fakt || '';
  if (x.kategorie === 'Fakt') return x.fakt || x.anekdote || x.quote || '';
  return x.anekdote || x.quote || x.fakt || x.text || '';
}

export function entryMetaPills(x) {
  var bits = '';
  if (entryUnchecked(x)) bits += '<span class="pill pill-w">Quelle offen</span>';
  if (entryUnlinked(x)) bits += '<span class="pill pill-w">Zuordnung offen</span>';
  return bits;
}

export function entryUnlinked(x) {
  return state.tableAvailability.books === true && !x.person_id;
}

export function entryCurationHtml(x) {
  var hasCur = strength(x) || x.quellenqualitaet || x.buchreife || arr(x.themen).length || x.ton || x.seitenrolle;
  if (!hasCur) return '';
  return '<div class="entry-curation">' +
    '<div><div class="lbl">Stärke</div><div class="val">' + (strength(x) || '—') + '</div></div>' +
    '<div><div class="lbl">Buchreife</div><div class="val">' + esc(label(x.buchreife || 'roh')) + '</div></div>' +
    '<div><div class="lbl">Quelle</div><div class="val">' + esc(label(x.quellenqualitaet || 'unbekannt')) + '</div></div>' +
    '<div><div class="lbl">Seitenrolle</div><div class="val">' + esc(label(x.seitenrolle || 'unentschieden')) + '</div></div>' +
    (x.ton ? '<div><div class="lbl">Ton</div><div class="val">' + esc(x.ton) + '</div></div>' : '') +
    (arr(x.themen).length ? '<div class="full"><div class="lbl">Themen</div><div class="ce-meta">' + arr(x.themen).map(function(t) { return '<span class="pill">' + esc(label(t)) + '</span>'; }).join('') + '</div></div>' : '') +
  '</div>';
}

export function personEntries(p) {
  return state.entries.filter(function(x) {
    if (x.person_id && p.id) return String(x.person_id) === String(p.id);
    return x.person === p.name;
  });
}

export function findPersonByName(name) {
  var n = String(name || '').toLowerCase().trim();
  if (!n) return null;
  return state.persons.find(function(p) { return String(p.name || '').toLowerCase().trim() === n; }) || null;
}

export function normalizePersonSuggestion(p) {
  p = p || {};
  return {
    name: p.name || '',
    kategorie: p.kategorie || '',
    dates: p.dates || '',
    status: p.status || 'kandidat',
    tags: arr(p.tags),
    note: p.note || '',
    lebensprinzip: p.lebensprinzip || '',
    buchthese: p.buchthese || '',
    archetyp: p.archetyp || '',
    spannung: p.spannung || '',
    visuelles_motiv: p.visuelles_motiv || '',
    format_eignung: arr(p.format_eignung).filter(function(t) { return FORMAT_EIGNUNG.indexOf(t) >= 0; }),
    kurationsnotiz: p.kurationsnotiz || ''
  };
}

export function mergePersonSuggestion(existing, incoming) {
  var p = normalizePersonSuggestion(existing);
  p.name = existing.name || incoming.name || '';
  ['kategorie','dates','status','note','lebensprinzip','buchthese','archetyp','spannung','visuelles_motiv','kurationsnotiz'].forEach(function(k) {
    if (!hasText(p[k]) && hasText(incoming[k])) p[k] = incoming[k];
  });
  p.tags = unique(arr(existing.tags).concat(arr(incoming.tags)));
  p.format_eignung = unique(arr(existing.format_eignung).concat(arr(incoming.format_eignung)));
  return p;
}

function personReadiness(p) {
  var pe = personEntries(p);
  var hasA = pe.some(function(x) { return x.kategorie === 'Anekdote'; });
  var hasZ = pe.some(function(x) { return x.kategorie === 'Zitat'; });
  var hasStrong = pe.some(function(x) { return strength(x) >= 4; });
  var unchecked = pe.some(entryUnchecked);
  return {
    hasA: hasA,
    hasZ: hasZ,
    hasStrong: hasStrong,
    hasPrinciple: hasText(p.lebensprinzip),
    hasThesis: hasText(p.buchthese),
    hasVisual: hasText(p.visuelles_motiv),
    hasFormat: arr(p.format_eignung).length > 0,
    sourceOk: pe.length > 0 && !unchecked,
    ready: hasText(p.lebensprinzip) && hasText(p.buchthese) && hasA && hasZ && hasStrong
  };
}

export function personMatchesCuration(p, key) {
  var r = personReadiness(p);
  if (key === 'fehlende_these') return !r.hasThesis;
  if (key === 'starke_personen') return r.hasStrong;
  if (key === 'ungepruefte_quellen') return !r.sourceOk;
  if (key === 'formatbereit') return r.hasFormat;
  if (key === 'buchreif') return r.ready;
  return true;
}

export function personPayload(p, includeName) {
  var obj = {
    kategorie: p.kategorie || '',
    dates: p.dates || '',
    status: p.status || 'kandidat',
    tags: arr(p.tags),
    note: p.note || '',
    lebensprinzip: p.lebensprinzip || '',
    buchthese: p.buchthese || '',
    archetyp: p.archetyp || '',
    spannung: p.spannung || '',
    visuelles_motiv: p.visuelles_motiv || '',
    format_eignung: arr(p.format_eignung),
    kurationsnotiz: p.kurationsnotiz || '',
    image_url: normalizeUrl(p.image_url) || null
  };
  if (includeName) obj.name = p.name || '';
  return obj;
}

export function entryPayload(e) {
  var kat = e.kategorie || 'Anekdote';
  var text = e.text || '';
  var obj = {
    person: e.person,
    kategorie: kat,
    buch: e.buch || 'hintergrund',
    quelle: e.quelle || null,
    quelle_url: normalizeUrl(e.quelle_url) || null,
    tags: arr(e.tags),
    preview: text.slice(0, 120),
    staerke: e.staerke ? Number(e.staerke) : null,
    quellenqualitaet: e.quellenqualitaet || 'unbekannt',
    buchreife: e.buchreife || 'roh',
    themen: arr(e.themen),
    ton: e.ton || '',
    seitenrolle: e.seitenrolle || 'unentschieden',
    buchnotiz: e.buchnotiz || '',
    quote: null,
    anekdote: null,
    fakt: null
  };
  if (state.tableAvailability.books === true) obj.person_id = e.person_id || null;
  if (kat === 'Zitat') obj.quote = text;
  else if (kat === 'Fakt') obj.fakt = text;
  else obj.anekdote = text;
  return obj;
}

export function formatBio(note) {
  if (!note) return '';

  // Protect abbreviations that contain ". " but aren't sentence ends
  var abbrs = ['St','Dr','Mr','Mrs','Prof','Nr','Jr','Sr','vs','ca','Abb','evtl','bzw','sog','u.a','z.B'];
  var protectedText = note;
  abbrs.forEach(function(a) {
    // Replace "Abbr. " with placeholder
    var re = new RegExp(a + '\\.( )', 'g');
    protectedText = protectedText.replace(re, a + '\x02$1');
  });
  // Also protect ordinal numbers: "5. Juli", "17. März" etc.
  protectedText = protectedText.replace(/(\d)\. ([A-Za-züäöÜÄÖ])/g, '$1\x02 $2');

  // Split at true sentence boundaries:
  // lowercase/digit/closing-paren + ". " + uppercase
  protectedText = protectedText.replace(/([a-züäöß\d\)])\. ([A-ZÜÄÖ"])/g, '$1.\x01$2');

  var parts = protectedText.split('\x01');

  // Restore protected abbreviations
  var sentences = parts.map(function(s) {
    return s.replace(/\x02/g, '.').trim();
  }).filter(Boolean);

  if (sentences.length <= 1) {
    return '<div class="bio-kicker">' + esc(note) + '</div>';
  }

  // First sentence → kicker
  var html = '<div class="bio-kicker">' + esc(sentences[0]) + '</div><div class="bio-body">';

  // Remaining → group 3 per paragraph
  var rest = sentences.slice(1);
  for (var i = 0; i < rest.length; i += 3) {
    html += '<p>' + rest.slice(i, i + 3).map(function(s) { return esc(s); }).join(' ') + '</p>';
  }

  html += '</div>';
  return html;
}

export function activeBook() {
  return state.books.find(function(b) { return b.status === 'active' || b.status === 'pilot'; }) || state.books[0] || null;
}

export function personById(id) {
  return state.persons.find(function(p) { return String(p.id) === String(id); }) || null;
}

export function candidateFor(p) {
  var book = activeBook();
  if (!book || !p) return null;
  return state.bookCandidates.find(function(c) {
    return String(c.book_id) === String(book.id) && String(c.person_id) === String(p.id);
  }) || null;
}

export function fitScore(c) {
  if (!c || !FIT_FIELDS.every(function(f) { return c[f[0]] !== null && c[f[0]] !== undefined; })) return null;
  return FIT_FIELDS.reduce(function(sum, f) { return sum + Number(c[f[0]] || 0); }, 0);
}

export function fitLabel(score) {
  if (score >= 10) return 'Kernkandidat';
  if (score >= 7) return 'Starker Fit';
  if (score >= 4) return 'Noch offen';
  return 'Parken prüfen';
}

export function dossierModel(p) {
  var pe = personEntries(p);
  var scenes = pe.filter(function(x) { return x.kategorie === 'Anekdote'; }).length;
  var reliableQuote = pe.some(function(x) {
    return x.kategorie === 'Zitat' && hasText(x.quelle) && ['primaer','geprueft'].indexOf(x.quellenqualitaet) >= 0;
  });
  var checks = [
    ['Buchthese', hasText(p.buchthese)],
    ['Lebensprinzip', hasText(p.lebensprinzip)],
    ['Widerspruch / Preis', hasText(p.spannung)],
    ['Zwei konkrete Szenen', scenes >= 2],
    ['Belastbares Zitat', reliableQuote],
    ['Quellen geprüft', pe.length > 0 && pe.every(function(x) { return !entryUnchecked(x); })],
    ['Visuelles Motiv', hasText(p.visuelles_motiv)],
    ['Redaktionelles Fazit', hasText(p.kurationsnotiz)]
  ];
  return { checks: checks, count: checks.filter(function(x) { return x[1]; }).length };
}

export function personHasPage(p) {
  return state.bookPages.some(function(pg) { return String(pg.person_id) === String(p.id); });
}

function openReviewJobFor(p) {
  return state.researchJobs.find(function(j) { return String(j.person_id) === String(p.id) && j.status === 'review'; }) || null;
}

export function nextActionForPerson(p) {
  var pe = personEntries(p);
  if (!pe.length) return { key: 'research', label: 'Recherche starten' };
  var job = openReviewJobFor(p);
  if (job) return { key: 'review', label: 'Vorschlag prüfen', jobId: job.id };
  var d = dossierModel(p);
  if (d.count < 6) return { key: 'dossier', label: 'Dossier vervollständigen' };
  var c = candidateFor(p), fit = fitScore(c);
  if (fit === null) return { key: 'fit', label: 'Fit bewerten' };
  if (c && c.stage === 'pruefen') return { key: 'decide', label: 'Auswahl entscheiden' };
  if (c && c.stage === 'shortlist' && !personHasPage(p)) return { key: 'page', label: 'Seite gestalten' };
  if (c && c.stage === 'selected') return { key: 'pilot', label: 'Pilotprofil ausarbeiten' };
  return { key: 'done', label: 'Nichts offen' };
}

export function missingLabel(gap) { return 'Fehlt: ' + gap; }

function personNextRank(p) {
  var r = PERSON_SORT_RANK[nextActionForPerson(p).key];
  return r === undefined ? 8 : r;
}

function personLastActivity(p) {
  var latest = p.created_at ? new Date(p.created_at).getTime() : 0;
  personEntries(p).forEach(function(x) {
    if (!x.created_at) return;
    var t = new Date(x.created_at).getTime();
    if (t > latest) latest = t;
  });
  return latest;
}

export function materialSortForBlock(a, b) {
  var reifeRank = { final: 0, stark: 1, brauchbar: 2, roh: 3 };
  var ra = reifeRank[a.buchreife] !== undefined ? reifeRank[a.buchreife] : 4;
  var rb = reifeRank[b.buchreife] !== undefined ? reifeRank[b.buchreife] : 4;
  if (ra !== rb) return ra - rb;
  var sa = strength(a), sb = strength(b);
  if (sa !== sb) return sb - sa;
  var pa = a.seitenrolle && a.seitenrolle !== 'unentschieden' ? 0 : 1;
  var pb = b.seitenrolle && b.seitenrolle !== 'unentschieden' ? 0 : 1;
  return pa - pb;
}

export function personSortComparator(sortKey) {
  return function(a, b) {
    if (sortKey === 'name') return String(a.name).localeCompare(String(b.name), 'de');
    if (sortKey === 'entries') return personEntries(b).length - personEntries(a).length;
    if (sortKey === 'dossier') return dossierModel(b).count - dossierModel(a).count;
    if (sortKey === 'updated') return personLastActivity(b) - personLastActivity(a);
    var ra = personNextRank(a), rb = personNextRank(b);
    return ra !== rb ? ra - rb : String(a.name).localeCompare(String(b.name), 'de');
  };
}

export function openSourceCount() {
  return state.entries.filter(entryUnchecked).length;
}

export function bestSourceExamples() {
  return state.entries
    .filter(function(e) { return (e.quellenqualitaet === 'geprueft' || e.quellenqualitaet === 'primaer') && hasText(e.quelle); })
    .sort(function(a, b) {
      var rank = { geprueft: 1, primaer: 0 };
      return (rank[b.quellenqualitaet] - rank[a.quellenqualitaet]) || ((b.staerke || 0) - (a.staerke || 0));
    })
    .slice(0, 5)
    .map(function(e) {
      return { quelle: e.quelle, quelle_url: e.quelle_url || '', quellenqualitaet: e.quellenqualitaet };
    });
}

export function pilotIntakeSort(a, b) {
  var da = dossierModel(a.person), db = dossierModel(b.person);
  var ra = da.count >= 5 ? 1 : 0, rb = db.count >= 5 ? 1 : 0;
  if (ra !== rb) return rb - ra;
  if (a.entryCount !== b.entryCount) return b.entryCount - a.entryCount;
  return String(a.person.name).localeCompare(String(b.person.name), 'de');
}

export function candidateUntouched(c) {
  return FIT_FIELDS.every(function(f) { return c[f[0]] === null || c[f[0]] === undefined; })
    && !hasText(c.rationale)
    && (!c.stage || c.stage === 'pool');
}

export function personDashboardModel(p) {
  var pe = personEntries(p);
  var c = { A:0, Z:0, F:0, S:0, total:pe.length, direct:0, strong:0, unchecked:0, notes:0 };
  pe.forEach(function(x) {
    if (x.kategorie === 'Anekdote') c.A++;
    else if (x.kategorie === 'Zitat') c.Z++;
    else if (x.kategorie === 'Fakt') c.F++;
    else if (x.kategorie === 'Stil') c.S++;
    if (x.buch === 'direkt') c.direct++;
    if (strength(x) >= 4) c.strong++;
    if (entryUnchecked(x)) c.unchecked++;
    if (hasText(x.buchnotiz)) c.notes++;
  });
  var r = personReadiness(p);
  var gaps = [];
  if (!r.hasThesis) gaps.push('These');
  if (!r.hasPrinciple) gaps.push('Prinzip');
  if (!r.hasStrong) gaps.push('Stärke');
  if (!r.hasFormat) gaps.push('Format');
  if (!r.sourceOk) gaps.push('Quelle');
  return {
    person: p,
    counts: c,
    readiness: r,
    gaps: gaps
  };
}

function collectTagStats() {
  var map = {};
  function add(tag, personName) {
    tag = String(tag || '').trim();
    if (!tag) return;
    var key = normText(tag);
    if (!map[key]) map[key] = { tag: tag, count: 0, people: {}, theme: themeForTag(tag) };
    map[key].count++;
    if (personName) map[key].people[personName] = true;
  }
  state.persons.forEach(function(p) { arr(p.tags).forEach(function(t) { add(t, p.name); }); });
  state.entries.forEach(function(x) { arr(x.tags).forEach(function(t) { add(t, x.person); }); });
  return Object.keys(map).map(function(k) {
    var x = map[k];
    x.peopleCount = Object.keys(x.people).length;
    return x;
  }).sort(function(a, b) { return (b.count - a.count) || a.tag.localeCompare(b.tag); });
}

export function themeForTag(tag) {
  var n = normText(tag);
  var themes = Object.keys(TAG_THEME_RULES);
  for (var i = 0; i < themes.length; i++) {
    var th = themes[i];
    var rules = TAG_THEME_RULES[th] || [];
    for (var j = 0; j < rules.length; j++) {
      var r = normText(rules[j]);
      if (n.indexOf(r) >= 0 || r.indexOf(n) >= 0) return th;
    }
  }
  return null;
}

export function profileTagThemes(p) {
  var found = {};
  arr(p.tags).forEach(function(t) {
    var th = themeForTag(t);
    if (th) found[th] = true;
  });
  personEntries(p).forEach(function(x) {
    arr(x.tags).forEach(function(t) {
      var th = themeForTag(t);
      if (th) found[th] = true;
    });
  });
  return THEMA_LIST.filter(function(t) { return found[t]; });
}

export function parseFirstYear(dates) {
  if (!dates) return null;
  var s = String(dates);
  var m = s.match(/(\d{3,4})/);
  if (!m) return null;
  var y = parseInt(m[1], 10);
  var low = s.toLowerCase();
  if (low.indexOf('v.chr') >= 0 || low.indexOf(' v.') >= 0 || low.indexOf('bc') >= 0 || low.indexOf('b.c') >= 0) y = -y;
  return y;
}

export function eraForYear(y) {
  if (y === null) return 'Unbekannt';
  if (y < 500)  return 'Antike';
  if (y < 1400) return 'Mittelalter';
  if (y < 1700) return 'Frühe Neuzeit';
  if (y < 1900) return '18./19. Jh.';
  if (y < 2000) return '20. Jh.';
  return 'Gegenwart';
}

export function normalizeExtractEntries(rawEntries) {
  var KAT_NORM = { anekdote:'Anekdote', zitat:'Zitat', fakt:'Fakt', stil:'Stil' };
  return (rawEntries || []).map(function(e) {
    var kat = KAT_NORM[String(e.kategorie || '').trim().toLowerCase()] || 'Anekdote';
    var text = kat === 'Zitat' ? (e.quote || e.anekdote || e.fakt || '') : kat === 'Fakt' ? (e.fakt || e.anekdote || e.quote || '') : (e.anekdote || e.quote || e.fakt || '');
    if (!text) text = e.text || e.preview || '';
    return {
      kategorie:kat, buch:e.buch || 'hintergrund', text:text, quelle:e.quelle || '', quelle_url:e.quelle_url || '',
      tags:Array.isArray(e.tags) ? e.tags : [], staerke:normalizeStrength(e.staerke),
      quellenqualitaet:cleanChoice(e.quellenqualitaet, QUELLENQUALITAET, 'unbekannt'),
      buchreife:cleanChoice(e.buchreife, BUCHREIFE, 'roh'),
      themen:arr(e.themen).filter(function(t){ return THEMA_LIST.indexOf(t) >= 0; }), ton:e.ton || '',
      seitenrolle:cleanChoice(e.seitenrolle, SEITENROLLE, 'unentschieden'), buchnotiz:e.buchnotiz || ''
    };
  });
}

export function pagesForBook() {
  var book = activeBook();
  return state.bookPages.filter(function(pg) { return !book || String(pg.book_id) === String(book.id); })
    .sort(function(a, b) { return (a.page_order || 0) - (b.page_order || 0); });
}
