import { state } from '../state/store.js';
import { BUCHREIFE, ENHANCE_FILTERS, FORMAT_EIGNUNG, KAT_ICON, KAT_ORDER, QUELLENQUALITAET, SEITENROLLE, THEMA_LIST } from '../config.js';
import { displayValue, entryForEnhance, entryText, entryUnchecked, fieldEmpty, findPersonByName, hasSuggestion, normalizeData, normalizeEnhanceData, normalizeExtractEntries, normalizeSingleEntrySuggestion, personEntries, themeForTag } from '../data/models.js';
import { goTab, render, updateStats } from '../state/router.js';
import { persistAiUsage, showCaptureError } from '../add.js';
import { arr, cleanChoice, esc, hasText, label, normalizeStrength, normalizeUrl, opts, splitList, unique } from '../utils.js';
import { patchSupa } from '../data/supabase.js';

export function startEnhance(filterKey) {
  filterKey = filterKey || null;
  var p = state.profilePerson;
  if (!p) return;

  var cfg = ENHANCE_FILTERS[filterKey] || ENHANCE_FILTERS[null];
  var allEntries = personEntries(p);
  var filteredEntries = cfg.filter ? allEntries.filter(cfg.filter) : allEntries;
  if (!filteredEntries.length) return;

  state.enhanceState = { phase: 'loading', personName: p.name, data: null, error: '', filterKey: filterKey, filterLabel: cfg.label };
  render();

  fetch('/api/enhance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      person: p,
      entries: filteredEntries.map(entryForEnhance),
      context: cfg.context
    })
  })
  .then(function(r) {
    return r.json().then(function(data) {
      if (data._meta && data._meta.usage && !r.ok) persistAiUsage(data._meta.usage, null, p, 'failed', data.error);
      if (!r.ok || data.error) throw new Error(data.error || 'KI-Kuration fehlgeschlagen');
      return data;
    });
  })
  .then(function(data) {
    if (data._meta && data._meta.usage) persistAiUsage(data._meta.usage, null, p);
    state.enhanceState = { phase: 'review', personName: p.name, data: normalizeEnhanceData(data), error: '', filterKey: filterKey, filterLabel: cfg.label };
    render();
  })
  .catch(function(err) {
    state.enhanceState = { phase: 'error', personName: p.name, data: null, error: err.message, filterKey: filterKey, filterLabel: cfg.label };
    render();
  });
}

export function cancelEnhance() {
  state.enhanceState = { phase: 'idle', personName: '', data: null, error: '' };
  render();
}

export function startExpand(kategorie, count) {
  var p = state.profilePerson;
  if (!p) return;
  state.addState = { phase: 'loading', person: p, entries: [], prefill: p.name, job: null, usage: null, grounding: null, mode: 'expand' };
  goTab('add');

  fetch('/api/enhance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ person: p, entries: personEntries(p).map(entryForEnhance), mode: 'expand', kategorie: kategorie, count: count || 2 })
  })
  .then(function(r) {
    return r.json().then(function(data) {
      if (data._meta && data._meta.usage) persistAiUsage(data._meta.usage, null, p, r.ok ? 'succeeded' : 'failed', data.error);
      if (!r.ok || data.error) throw new Error(data.error || 'Erweitern fehlgeschlagen');
      return data;
    });
  })
  .then(function(data) {
    state.addState = {
      phase: 'preview', person: p,
      entries: normalizeExtractEntries(data.entries),
      prefill: p.name, job: null,
      usage: data._meta && data._meta.usage,
      grounding: data._meta && data._meta.grounding,
      mode: 'expand'
    };
    render();
  })
  .catch(function(err) {
    showCaptureError(p.name, err, true);
  });
}

export function renderEnhancePanel(p) {
  var box = document.createElement('div');
  box.className = 'enhance-panel';

  var filterLbl = state.enhanceState.filterLabel ? ' · ' + state.enhanceState.filterLabel : '';

  if (state.enhanceState.phase === 'loading') {
    box.innerHTML =
      '<div class="enhance-hd">' +
        '<div><div class="enhance-title">KI-Vorschläge' + esc(filterLbl) + '</div><div class="enhance-sub">Analysiert Profil, Einträge und Tags. Es wird noch nichts gespeichert.</div></div>' +
        '<button class="mini-btn" onclick="cancelEnhance()">Schließen</button>' +
      '</div>' +
      '<div class="enhance-loading">Vorschläge werden erzeugt…</div>';
    return box;
  }

  if (state.enhanceState.phase === 'error') {
    var retryKey = state.enhanceState.filterKey ? '\'' + state.enhanceState.filterKey + '\'' : '';
    box.innerHTML =
      '<div class="enhance-hd">' +
        '<div><div class="enhance-title">KI-Vorschläge' + esc(filterLbl) + '</div><div class="enhance-sub">Fehler: ' + esc(state.enhanceState.error) + '</div></div>' +
        '<div class="actions"><button class="mini-btn primary" onclick="startEnhance(' + retryKey + ')">Erneut versuchen</button><button class="mini-btn" onclick="cancelEnhance()">Schließen</button></div>' +
      '</div>';
    return box;
  }

  if (state.enhanceState.phase === 'saved') {
    box.innerHTML =
      '<div class="enhance-hd">' +
        '<div><div class="enhance-title">KI-Vorschläge' + esc(filterLbl) + '</div><div class="enhance-sub">Ausgewählte Vorschläge wurden gespeichert.</div></div>' +
        '<button class="mini-btn" onclick="cancelEnhance()">Schließen</button>' +
      '</div>';
    return box;
  }

  var data = state.enhanceState.data || {};
  var personSug = data.person || {};
  var html =
    '<div class="enhance-hd">' +
      '<div><div class="enhance-title">Vorschläge prüfen</div><div class="enhance-sub">Häkchen bedeutet: beim Speichern übernehmen. Leere Felder sind vorausgewählt, bestehende Inhalte bleiben erst einmal geschützt. Tags/Themen werden ergänzt, nicht ersetzt; bei Text wird der Vorschlag angehängt — beides direkt im Feld editierbar.</div></div>' +
      '<button class="mini-btn" onclick="cancelEnhance()">Schließen</button>' +
    '</div>';

  html += '<div class="add-sec-hd">Profil</div><div class="review-grid">';
  profileReviewFields().forEach(function(f) {
    html += reviewRow('p', f, p[f.key], personSug[f.key]);
  });
  html += '</div>';

  if (arr(data.tag_mapping).length) {
    html += '<div class="add-sec-hd">Tag-Mapping</div><div class="tag-cloud">';
    arr(data.tag_mapping).slice(0, 18).forEach(function(m) {
      html += '<span class="tag-map"><strong>' + esc(m.tag || '') + '</strong> → ' + esc(label(m.thema || '')) + '</span>';
    });
    html += '</div>';
  }

  html += '<div class="add-sec-hd">Einträge</div><div class="review-grid">';
  if (!data.entries || !data.entries.length) {
    html += '<div class="readonly-note">Keine Eintragsvorschläge erhalten.</div>';
  } else {
    data.entries.forEach(function(sug, i) {
      html += entryReviewBlock(sug._entry, sug, i);
    });
  }
  html += '</div>';

  html +=
    '<div class="review-actions">' +
      '<button id="enhance-apply" class="mini-btn primary" onclick="applyEnhanceSuggestions()">Ausgewählte übernehmen</button>' +
      '<button class="mini-btn" onclick="cancelEnhance()">Abbrechen</button>' +
      '<span class="save-msg" id="enhance-msg"></span>' +
    '</div>';

  box.innerHTML = html;
  return box;
}

export function enhanceFilterBar(p, pEntries) {
  if (!pEntries || !pEntries.length) return '';
  var active = state.enhanceState.personName === p.name && state.enhanceState.phase !== 'idle' && state.enhanceState.phase !== 'saved'
    ? state.enhanceState.filterKey
    : '__none__';

  function chip(key, labelText, count, warn) {
    var isActive = (active === key || (key === null && active === '__none__' && state.enhanceState.personName !== p.name)) ? '' : '';
    var activeClass = (state.enhanceState.personName === p.name && state.enhanceState.filterKey === key && state.enhanceState.phase !== 'idle' && state.enhanceState.phase !== 'saved') ? ' active' : '';
    var warnStyle = warn ? ' style="color:var(--am)"' : '';
    var keyArg = key === null ? '' : "'" + key + "'";
    return '<button class="mini-btn' + activeClass + '"' + warnStyle + ' onclick="startEnhance(' + keyArg + ')">' +
      esc(labelText) + (count !== null ? ' <span style="opacity:.55;font-weight:400">(' + count + ')</span>' : '') +
    '</button>';
  }

  var cats = KAT_ORDER.filter(function(k) { return pEntries.some(function(x) { return x.kategorie === k; }); });
  var unchecked = pEntries.filter(entryUnchecked).length;

  var html = '<div class="enhance-filter-bar">' +
    '<span class="enhance-filter-lbl">Gemini</span>' +
    chip(null, 'Alle', pEntries.length, false);

  cats.forEach(function(k) {
    var cnt = pEntries.filter(function(x) { return x.kategorie === k; }).length;
    html += chip(k, KAT_ICON[k] + ' ' + k, cnt, false);
  });

  if (unchecked) {
    html += chip('quellen', '⚑ Quellen prüfen', unchecked, true);
  }

  html += '</div>';

  html += '<div class="enhance-filter-bar">' +
    '<span class="enhance-filter-lbl">Erweitern</span>' +
    KAT_ORDER.map(function(k) {
      return '<button class="mini-btn" onclick="startExpand(\'' + k + '\',2)">+2 ' + KAT_ICON[k] + ' ' + esc(k) + '</button>';
    }).join('') +
  '</div>';

  return html;
}

function profileReviewFields() {
  return [
    { key:'lebensprinzip', label:'Lebensprinzip', type:'textarea' },
    { key:'buchthese', label:'Buchthese', type:'textarea' },
    { key:'archetyp', label:'Archetyp', type:'text' },
    { key:'spannung', label:'Spannung', type:'textarea' },
    { key:'visuelles_motiv', label:'Visuelles Motiv', type:'text' },
    { key:'format_eignung', label:'Format-Eignung', type:'array', allowed:FORMAT_EIGNUNG },
    { key:'tags', label:'Tags ergänzen', type:'array' },
    { key:'kurationsnotiz', label:'Kurationsnotiz', type:'textarea' }
  ];
}

function entryReviewFields() {
  return [
    { key:'staerke', label:'Stärke', type:'select', options:['','1','2','3','4','5'] },
    { key:'quellenqualitaet', label:'Quellenqualität', type:'select', options:[''].concat(QUELLENQUALITAET) },
    { key:'buchreife', label:'Buchreife', type:'select', options:[''].concat(BUCHREIFE) },
    { key:'themen', label:'Themen', type:'array', allowed:THEMA_LIST },
    { key:'seitenrolle', label:'Seitenrolle', type:'select', options:[''].concat(SEITENROLLE) },
    { key:'ton', label:'Ton', type:'text' },
    { key:'quelle', label:'Quelle (Werk/Biographie)', type:'text' },
    { key:'quelle_url', label:'Quelle URL', type:'text' },
    { key:'tags', label:'Tags ergänzen', type:'array' },
    { key:'buchnotiz', label:'Buchnotiz', type:'textarea' }
  ];
}

function reviewRow(scope, f, current, suggestion) {
  var id = 'enh-' + scope + '-' + f.key;
  var has = hasSuggestion(suggestion, f.type);
  var checked = has && fieldEmpty(current, f.key, f.type) ? ' checked' : '';
  var disabled = has ? '' : ' disabled';
  return '<div class="review-row">' +
    '<input type="checkbox" id="' + id + '-use"' + checked + disabled + '>' +
    '<div class="review-label">' + esc(f.label) + '</div>' +
    '<div>' +
      '<div class="review-current">Aktuell: ' + esc(displayValue(current, f.type) || '—') + '</div>' +
      inputForSuggestion(id, f, suggestion, !has, current) +
    '</div>' +
  '</div>';
}

function entryReviewBlock(entry, sug, i) {
  var title = (entry.kategorie || 'Eintrag') + ' · ' + (entry.buch === 'direkt' ? 'Direkt' : 'Hintergrund');
  var html =
    '<div class="review-entry" data-entry-id="' + esc(entry.id || '') + '">' +
      '<div class="review-entry-top">' +
        '<div><div class="review-entry-title">' + esc(title) + '</div><div class="review-entry-prev">' + esc(entryText(entry) || entry.preview || '') + '</div></div>' +
        '<span class="pill pill-q">' + esc((i + 1) + '/' + (state.enhanceState.data.entries || []).length) + '</span>' +
      '</div>' +
      '<div class="review-fields">';
  entryReviewFields().forEach(function(f) {
    var current = entry[f.key];
    var suggestion = sug[f.key];
    if (!hasSuggestion(suggestion, f.type)) return;
    var id = 'enh-e-' + i + '-' + f.key;
    var checked = fieldEmpty(current, f.key, f.type) ? ' checked' : '';
    html += '<div class="review-field">' +
      '<label><input type="checkbox" id="' + id + '-use"' + checked + '> ' + esc(f.label) + '</label>' +
      '<div class="review-current">Aktuell: ' + esc(displayValue(current, f.type) || '—') + '</div>' +
      inputForSuggestion(id, f, suggestion, false, current) +
    '</div>';
  });
  html += '</div></div>';
  return html;
}

function inputForSuggestion(id, f, value, disabled, current) {
  var dis = disabled ? ' disabled' : '';
  if (f.type === 'array') {
    var merged = current ? unique(arr(current).concat(arr(value))) : arr(value);
    return '<input id="' + id + '" class="ai" value="' + esc(displayValue(merged, f.type)) + '"' + dis + '>';
  }
  if (f.type === 'textarea') {
    var prefill = value || '';
    if (hasText(current) && String(current).trim() !== String(value || '').trim()) {
      prefill = current + '\n\n— KI-Ergänzung —\n' + value;
    }
    return '<textarea id="' + id + '" class="ai ai-ta" rows="3"' + dis + '>' + esc(prefill) + '</textarea>';
  }
  if (f.type === 'select') return '<select id="' + id + '" class="ai ai-sel"' + dis + '>' + opts(f.options || [], String(value || '')) + '</select>';
  return '<input id="' + id + '" class="ai" value="' + esc(displayValue(value, f.type)) + '"' + dis + '>';
}

function valueFromControl(id, f) {
  var el = document.getElementById(id);
  var raw = el ? el.value : '';
  if (f.type === 'array') {
    var values = splitList(raw);
    if (f.allowed) values = values.filter(function(v) { return f.allowed.indexOf(v) >= 0 || f.allowed.map(label).indexOf(v) >= 0; }).map(function(v) {
      var idx = f.allowed.map(label).indexOf(v);
      return idx >= 0 ? f.allowed[idx] : v;
    });
    return unique(values);
  }
  if (f.key === 'staerke') return normalizeStrength(raw) || null;
  if (f.key === 'quellenqualitaet') return cleanChoice(raw, QUELLENQUALITAET, 'unbekannt');
  if (f.key === 'buchreife') return cleanChoice(raw, BUCHREIFE, 'roh');
  if (f.key === 'seitenrolle') return cleanChoice(raw, SEITENROLLE, 'unentschieden');
  if (f.key === 'quelle_url') return normalizeUrl(raw);
  return raw;
}

export function applyEnhanceSuggestions() {
  var p = state.profilePerson;
  if (!p || !state.enhanceState.data) return;
  var btn = document.getElementById('enhance-apply');
  var msg = document.getElementById('enhance-msg');
  if (btn) { btn.disabled = true; btn.textContent = 'Speichert…'; }
  if (msg) msg.textContent = '';

  var jobs = [];
  var pPayload = {};

  profileReviewFields().forEach(function(f) {
    var id = 'enh-p-' + f.key;
    var use = document.getElementById(id + '-use');
    if (!use || !use.checked || use.disabled) return;
    // Box already shows the merged/combined value (see inputForSuggestion) —
    // it's the source of truth, so no extra merge with the old value here.
    pPayload[f.key] = valueFromControl(id, f);
  });

  if (Object.keys(pPayload).length) {
    jobs.push(patchSupa('persons', p, pPayload).then(function(saved) {
      Object.assign(p, saved || pPayload);
      state.profilePerson = p;
    }));
  }

  (state.enhanceState.data.entries || []).forEach(function(sug, i) {
    var entry = sug._entry;
    if (!entry) return;
    var payload = {};
    entryReviewFields().forEach(function(f) {
      var id = 'enh-e-' + i + '-' + f.key;
      var use = document.getElementById(id + '-use');
      if (!use || !use.checked) return;
      // Box already shows the merged/combined value (see inputForSuggestion).
      payload[f.key] = valueFromControl(id, f);
    });
    if (Object.keys(payload).length) {
      // Auto-map tags → themen, based on whichever tag set will actually be saved.
      var finalTags = arr(payload.tags !== undefined ? payload.tags : entry.tags);
      var autoThemen = finalTags.map(themeForTag).filter(Boolean);
      if (autoThemen.length) {
        payload.themen = unique(arr(payload.themen !== undefined ? payload.themen : entry.themen).concat(autoThemen));
      }
      jobs.push(patchSupa('entries', entry, payload).then(function(saved) {
        Object.assign(entry, saved || payload);
      }));
    }
  });

  if (!jobs.length) {
    if (btn) { btn.disabled = false; btn.textContent = 'Ausgewählte übernehmen'; }
    if (msg) msg.textContent = 'Keine Felder ausgewählt.';
    return;
  }

  Promise.all(jobs).then(function() {
    normalizeData();
    updateStats();
    state.enhanceState = { phase: 'saved', personName: p.name, data: null, error: '' };
    render();
  }).catch(function(err) {
    if (btn) { btn.disabled = false; btn.textContent = 'Ausgewählte übernehmen'; }
    if (msg) msg.textContent = 'Fehler: ' + err.message;
  });
}

export function renderSingleEntryEnhance(card, x) {
  var root = card.querySelector('.cd-in');
  root.innerHTML =
    '<div class="enhance-panel" style="margin-bottom:0">' +
      '<div class="enhance-hd">' +
        '<div><div class="enhance-title">KI-Vorschlag für diesen Eintrag</div><div class="enhance-sub">Gemini bewertet nur diesen vorhandenen Eintrag. Gespeichert wird erst nach Auswahl.</div></div>' +
        '<button class="mini-btn entry-cancel">Zurück</button>' +
      '</div>' +
      '<div class="enhance-loading">Vorschlag wird erzeugt…</div>' +
    '</div>';
  root.querySelector('.entry-cancel').onclick = function() { render(); };

  fetch('/api/enhance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      person: findPersonByName(x.person) || { name: x.person },
      entries: [entryForEnhance(x)],
      context: 'Nur diesen einen Eintrag kuratorisch bewerten. Keine Profilfelder nötig, keine neuen Einträge.'
    })
  })
  .then(function(r) {
    return r.json().then(function(data) {
      if (data._meta && data._meta.usage && !r.ok) persistAiUsage(data._meta.usage, null, findPersonByName(x.person), 'failed', data.error);
      if (!r.ok || data.error) throw new Error(data.error || 'KI-Kuration fehlgeschlagen');
      return data;
    });
  })
  .then(function(data) {
    if (data._meta && data._meta.usage) persistAiUsage(data._meta.usage, null, findPersonByName(x.person));
    var sug = normalizeSingleEntrySuggestion((data.entries || [])[0] || {});
    root.innerHTML = singleEntryEnhanceHtml(x, sug);
    root.querySelector('.single-enhance-save').onclick = function() { saveSingleEntryEnhance(root, x); };
    root.querySelectorAll('.single-enhance-cancel').forEach(function(b) { b.onclick = function() { render(); }; });
  })
  .catch(function(err) {
    root.innerHTML =
      '<div class="enhance-panel" style="margin-bottom:0">' +
        '<div class="enhance-hd">' +
          '<div><div class="enhance-title">KI-Vorschlag</div><div class="enhance-sub">Fehler: ' + esc(err.message) + '</div></div>' +
          '<button class="mini-btn single-enhance-cancel">Zurück</button>' +
        '</div>' +
      '</div>';
    root.querySelector('.single-enhance-cancel').onclick = function() { render(); };
  });
}

function singleEntryEnhanceHtml(x, sug) {
  var prefix = 'enh-single-' + String(x.id || 'entry').replace(/[^a-zA-Z0-9_-]/g, '');
  var html =
    '<div class="enhance-panel" style="margin-bottom:0">' +
      '<div class="enhance-hd">' +
        '<div><div class="enhance-title">Vorschlag prüfen</div><div class="enhance-sub">Häkchen setzen, Werte bei Bedarf ändern, dann übernehmen. Tags/Themen werden ergänzt, Text wird angehängt — beides direkt im Feld editierbar.</div></div>' +
        '<button class="mini-btn single-enhance-cancel">Zurück</button>' +
      '</div>' +
      '<div class="review-entry-prev">' + esc(entryText(x) || x.preview || '') + '</div>' +
      '<div class="review-fields" style="margin-top:12px">';
  var shown = 0;
  entryReviewFields().forEach(function(f) {
    var suggestion = sug[f.key];
    if (!hasSuggestion(suggestion, f.type)) return;
    shown++;
    var id = prefix + '-' + f.key;
    var checked = fieldEmpty(x[f.key], f.key, f.type) ? ' checked' : '';
    html += '<div class="review-field">' +
      '<label><input type="checkbox" id="' + id + '-use"' + checked + '> ' + esc(f.label) + '</label>' +
      '<div class="review-current">Aktuell: ' + esc(displayValue(x[f.key], f.type) || '—') + '</div>' +
      inputForSuggestion(id, f, suggestion, false, x[f.key]) +
    '</div>';
  });
  if (!shown) html += '<div class="readonly-note">Gemini hat keine nutzbaren Felder vorgeschlagen.</div>';
  html += '</div>' +
    '<div class="entry-edit-actions">' +
      '<button class="mini-btn primary single-enhance-save" data-prefix="' + esc(prefix) + '">Ausgewählte übernehmen</button>' +
      '<button class="mini-btn single-enhance-cancel">Abbrechen</button>' +
      '<span class="save-msg"></span>' +
    '</div>' +
  '</div>';
  return html;
}

function saveSingleEntryEnhance(root, x) {
  var btn = root.querySelector('.single-enhance-save');
  var msg = root.querySelector('.save-msg');
  var prefix = btn.getAttribute('data-prefix');
  var payload = {};
  entryReviewFields().forEach(function(f) {
    var id = prefix + '-' + f.key;
    var use = document.getElementById(id + '-use');
    if (!use || !use.checked) return;
    // The box already shows the merged (existing ∪ suggested) value for
    // list fields and the combined text for prose fields — it's the
    // source of truth, including any trims the user made, so no extra
    // merge-with-old happens here (that would silently undo those edits).
    payload[f.key] = valueFromControl(id, f);
  });
  if (!Object.keys(payload).length) {
    if (msg) msg.textContent = 'Keine Felder ausgewählt.';
    return;
  }
  // Auto-map tags → themen, based on whichever tag set will actually be saved.
  var finalTags = arr(payload.tags !== undefined ? payload.tags : x.tags);
  var autoThemen = finalTags.map(themeForTag).filter(Boolean);
  if (autoThemen.length) {
    payload.themen = unique(arr(payload.themen !== undefined ? payload.themen : x.themen).concat(autoThemen));
  }
  btn.disabled = true; btn.textContent = 'Speichert…';
  patchSupa('entries', x, payload).then(function(saved) {
    Object.assign(x, saved || payload);
    normalizeData();
    render();
  }).catch(function(err) {
    btn.disabled = false; btn.textContent = 'Ausgewählte übernehmen';
    if (msg) msg.textContent = 'Fehler: ' + err.message;
  });
}
