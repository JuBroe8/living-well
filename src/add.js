import { state } from './state/store.js';
import { arr, checkGroup, esc, formatEuro, getChecked, opts, splitList } from './utils.js';
import { activeBook, bestSourceExamples, entryPayload, findPersonByName, mergePersonSuggestion, normalizeExtractEntries, normalizePersonSuggestion, personPayload } from './data/models.js';
import { researchProcessHtml } from './views/dashboard.js';
import { BUCHREIFE, FORMAT_EIGNUNG, KAT_CI, KAT_ICON, QUELLENQUALITAET, SEITENROLLE, THEMA_LIST } from './config.js';
import { claimResearchJob, insertSupa, patchSupa } from './data/supabase.js';
import { init, render, showProfile, updateStats } from './state/router.js';

export function rAdd(main) {
  main.innerHTML = '';
  var wrap = document.createElement('div'); wrap.className = 'add-wrap';
  main.appendChild(wrap);

  if (state.addState.phase === 'loading') {
    wrap.innerHTML =
      '<div class="add-loading">' +
        '<div class="add-loading-ico">◌</div>' +
        '<div class="add-loading-txt"><strong>' + esc(state.addState.prefill || 'Der Name') + '</strong> ist bereits im Pool.<br>Die Recherche läuft jetzt…</div>' +
      '</div>';
    return;
  }

  if (state.addState.phase === 'preview') {
    rAddPreview(wrap); return;
  }

  // Input phase
  var card = document.createElement('div'); card.className = 'add-card';
  card.innerHTML =
    '<div class="pilot-kicker">Schnellerfassung</div>' +
    '<h1 class="dash-title" style="margin-bottom:8px">Ein Name reicht.</h1>' +
    '<p class="add-intro">Der Name wird sofort im Personenpool gesichert. Du kannst ihn nur merken oder direkt einen Recherchelauf starten.</p>' +
    '<div class="add-fld">' +
      '<label class="add-lbl" for="add-input">Name</label>' +
      '<input id="add-input" class="ai capture-input" autocomplete="off" inputmode="text" ' +
        'placeholder="z.B. Patti Smith" value="' + esc(state.addState.prefill || '') + '" onkeydown="if(event.key===\'Enter\'){event.preventDefault();captureName(true)}">' +
    '</div>' +
    '<div class="add-fld">' +
      '<label class="add-lbl">Warum interessant? <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px;color:var(--t3)">(optional)</span></label>' +
      '<textarea id="add-context" class="ai ai-ta" rows="2" ' +
        'placeholder="z.B. &quot;Interessiert mich wegen Morgenroutinen und Disziplin&quot; oder &quot;Fokus auf Scheitern und Neuanfang&quot;"></textarea>' +
    '</div>' +
    '<div class="actions"><button class="add-btn" onclick="captureName(true)">Merken &amp; recherchieren</button><button class="add-btn-sec" onclick="captureName(false)">Nur merken</button></div>' +
    '<div class="readonly-note" style="margin-top:12px">Mobiler Direktlink: <a class="subtle-link" href="?capture=1">/?capture=1</a>. Messenger kann später denselben Job-Workflow verwenden.</div>';
  wrap.appendChild(card);
  setTimeout(function(){ var input = document.getElementById('add-input'); if (input) input.focus(); }, 0);
}

function rAddPreview(wrap) {
  var p = state.addState.person;
  var existingPerson = findPersonByName(p.name || '');
  var personExists = !!existingPerson;

  var html = '';

  if (state.addState.usage) {
    var groundedSources = state.addState.grounding && state.addState.grounding.sources ? state.addState.grounding.sources.length : 0;
    html += '<div class="add-notice">Recherche abgeschlossen · ' + Number(state.addState.usage.totalTokens || 0).toLocaleString('de-DE') + ' Token · ca. ' + formatEuro(state.addState.usage.estimatedCostEur || 0) + (groundedSources ? ' · Google Search: ' + groundedSources + ' Quellen' : ' · keine Webquellen geliefert') + '</div>';
    html += researchProcessHtml(state.addState.usage, state.addState.grounding);
  }

  if (personExists) {
    html += '<div class="add-notice">Person <strong>' + esc(p.name) + '</strong> existiert bereits — vorhandene Felder bleiben sichtbar, leere Felder können mit den Vorschlägen ergänzt werden.</div>';
  }

  // Person section
  html += '<div class="add-sec-hd">Person</div>';
  html += '<div class="add-card">';
  html += '<div class="add-row">';
  html +=   '<div class="add-fld" style="flex:2"><label class="add-lbl">Name</label><input id="add-p-name" class="ai" value="' + esc(p.name || '') + '"' + (personExists ? ' readonly' : '') + '></div>';
  html +=   '<div class="add-fld"><label class="add-lbl">Status</label><select id="add-p-status" class="ai ai-sel">';
  ['kandidat','aktiv','bereit'].forEach(function(s) {
    html += '<option value="' + s + '"' + ((p.status || 'kandidat') === s ? ' selected' : '') + '>' + s.charAt(0).toUpperCase() + s.slice(1) + '</option>';
  });
  html +=   '</select></div>';
  html += '</div>';
  html += '<div class="add-row">';
  html +=   '<div class="add-fld"><label class="add-lbl">Kategorie</label><input id="add-p-kat" class="ai" value="' + esc(p.kategorie || '') + '" placeholder="z.B. Philosoph"></div>';
  html +=   '<div class="add-fld"><label class="add-lbl">Daten</label><input id="add-p-dates" class="ai" value="' + esc(p.dates || '') + '" placeholder="z.B. 121–180 n.Chr."></div>';
  html += '</div>';
  html += '<div class="add-fld"><label class="add-lbl">Tags (kommagetrennt)</label><input id="add-p-tags" class="ai" value="' + esc((p.tags || []).join(', ')) + '"></div>';
  html += '<div class="add-fld"><label class="add-lbl">Biografie</label><textarea id="add-p-note" class="ai ai-ta" rows="4">' + esc(p.note || '') + '</textarea></div>';
  html += '<div class="form-grid">';
  html +=   '<div class="add-fld"><label class="add-lbl">Lebensprinzip</label><textarea id="add-p-principle" class="ai ai-ta" rows="3">' + esc(p.lebensprinzip || '') + '</textarea></div>';
  html +=   '<div class="add-fld"><label class="add-lbl">Buchthese</label><textarea id="add-p-thesis" class="ai ai-ta" rows="3">' + esc(p.buchthese || '') + '</textarea></div>';
  html +=   '<div class="add-fld"><label class="add-lbl">Archetyp</label><input id="add-p-arch" class="ai" value="' + esc(p.archetyp || '') + '"></div>';
  html +=   '<div class="add-fld"><label class="add-lbl">Visuelles Motiv</label><input id="add-p-visual" class="ai" value="' + esc(p.visuelles_motiv || '') + '"></div>';
  html += '</div>';
  html += '<div class="add-fld"><label class="add-lbl">Spannung / Widerspruch</label><textarea id="add-p-tension" class="ai ai-ta" rows="3">' + esc(p.spannung || '') + '</textarea></div>';
  html += '<div class="add-fld"><label class="add-lbl">Format-Eignung</label>' + checkGroup('add-p-format', FORMAT_EIGNUNG, arr(p.format_eignung)) + '</div>';
  html += '<div class="add-fld"><label class="add-lbl">Kurationsnotiz</label><textarea id="add-p-cur-note" class="ai ai-ta" rows="2">' + esc(p.kurationsnotiz || '') + '</textarea></div>';
  html += '</div>';

  // Entries section
  html += '<div class="add-sec-hd">Einträge (' + state.addState.entries.length + ')</div>';

  state.addState.entries.forEach(function(e, i) {
    var kat = e.kategorie || 'Anekdote';
    var ciCls = KAT_CI[kat] || 'ci-x';
    var icon  = KAT_ICON[kat] || '·';
    var mainText = e.text || e.anekdote || e.quote || e.fakt || '';
    var mainLabel = kat === 'Zitat' ? 'Zitat' : kat === 'Fakt' ? 'Fakt' : kat === 'Stil' ? 'Stilbeobachtung' : 'Anekdote';

    html += '<div class="add-card">';
    html += '<div class="add-entry-top">';
    html +=   '<div class="ci ' + ciCls + '" style="width:26px;height:26px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">' + icon + '</div>';
    html +=   '<select id="add-e-' + i + '-kat" class="ai ai-sel" onchange="changeEntryKat(' + i + ')" style="width:auto">';
    ['Anekdote','Zitat','Fakt','Stil'].forEach(function(k) {
      html += '<option value="' + k + '"' + (kat === k ? ' selected' : '') + '>' + k + '</option>';
    });
    html +=   '</select>';
    html +=   '<select id="add-e-' + i + '-buch" class="ai ai-sel" style="width:auto">';
    html +=     '<option value="hintergrund"' + ((e.buch || 'hintergrund') === 'hintergrund' ? ' selected' : '') + '>Hintergrund</option>';
    html +=     '<option value="direkt"' + (e.buch === 'direkt' ? ' selected' : '') + '>Direkt</option>';
    html +=   '</select>';
    html +=   '<button class="add-btn-rm" onclick="removeEntry(' + i + ')">× Entfernen</button>';
    html += '</div>';
    html += '<div class="add-fld"><label class="add-lbl">' + mainLabel + '</label><textarea id="add-e-' + i + '-text" class="ai ai-ta" rows="3">' + esc(mainText) + '</textarea></div>';
    html += '<div class="add-row">';
    html +=   '<div class="add-fld"><label class="add-lbl">Quelle</label><input id="add-e-' + i + '-quelle" class="ai" value="' + esc(e.quelle || '') + '" placeholder="optional"></div>';
    html +=   '<div class="add-fld"><label class="add-lbl">Tags (kommagetrennt)</label><input id="add-e-' + i + '-tags" class="ai" value="' + esc((e.tags || []).join(', ')) + '"></div>';
    html += '</div>';
    html += '<div class="add-row">';
    html +=   '<div class="add-fld"><label class="add-lbl">Quelle URL</label><input id="add-e-' + i + '-quelle-url" class="ai" value="' + esc(e.quelle_url || '') + '" placeholder="https://…"></div>';
    html +=   '<div class="add-fld"><label class="add-lbl">Ton</label><input id="add-e-' + i + '-ton" class="ai" value="' + esc(e.ton || '') + '" placeholder="z.B. ruhig, radikal, elegant"></div>';
    html += '</div>';
    html += '<div class="form-grid three">';
    html +=   '<div class="add-fld"><label class="add-lbl">Stärke</label><select id="add-e-' + i + '-staerke" class="ai ai-sel">' + opts(['','1','2','3','4','5'], String(e.staerke || '')) + '</select></div>';
    html +=   '<div class="add-fld"><label class="add-lbl">Quellenqualität</label><select id="add-e-' + i + '-qqual" class="ai ai-sel">' + opts(QUELLENQUALITAET, e.quellenqualitaet || 'unbekannt') + '</select></div>';
    html +=   '<div class="add-fld"><label class="add-lbl">Buchreife</label><select id="add-e-' + i + '-reife" class="ai ai-sel">' + opts(BUCHREIFE, e.buchreife || 'roh') + '</select></div>';
    html += '</div>';
    html += '<div class="add-fld"><label class="add-lbl">Seitenrolle</label><select id="add-e-' + i + '-rolle" class="ai ai-sel">' + opts(SEITENROLLE, e.seitenrolle || 'unentschieden') + '</select></div>';
    html += '<div class="add-fld"><label class="add-lbl">Themen</label>' + checkGroup('add-e-' + i + '-themen', THEMA_LIST, arr(e.themen)) + '</div>';
    html += '<div class="add-fld"><label class="add-lbl">Buchnotiz</label><textarea id="add-e-' + i + '-buchnotiz" class="ai ai-ta" rows="2">' + esc(e.buchnotiz || '') + '</textarea></div>';
    html += '</div>';
  });

  html += '<button class="add-btn-sec" onclick="addEntry()" style="margin-top:4px">+ Eintrag hinzufügen</button>';

  // Footer
  html += '<div class="add-footer">';
  html +=   '<button id="add-save-btn" class="add-btn" onclick="saveData()">Speichern</button>';
  html +=   '<button class="add-btn-sec" onclick="resetAdd()">Zurücksetzen</button>';
  html += '</div>';

  wrap.innerHTML = html;
}

function analyzeInput() { captureName(true); }

export function captureName(runResearch) {
  if (state.captureBusy) return;
  var input = document.getElementById('add-input');
  var name = String(input ? input.value : '').replace(/\s+/g, ' ').trim();
  var ctx = String((document.getElementById('add-context') || {}).value || '').trim();
  if (!name) { if (input) input.focus(); return; }
  state.captureBusy = true;
  document.querySelectorAll('.add-card button').forEach(function(b) { b.disabled = true; });
  var existingPerson = findPersonByName(name);
  var personPromise = existingPerson ? Promise.resolve(existingPerson) : insertSupa('persons', personPayload({ name:name, status:'kandidat' }, true));

  personPromise.then(function(person) {
    if (!existingPerson) state.persons.push(person);
    state.addState.person = person;
    state.addState.prefill = name;
    updateStats();
    if (state.tableAvailability.research_jobs === false) return person;
    var activeJob = state.researchJobs.find(function(j) {
      return String(j.input_name || '').toLowerCase().trim() === name.toLowerCase() && ['captured','queued','running','review'].indexOf(j.status) >= 0;
    });
    var jobPayload = { input_name:name, source:'web_quick', mode:runResearch ? 'extract' : 'remember', status:runResearch ? 'queued' : 'captured', current_step:'intake', context:ctx || null };
    return (activeJob ? patchSupa('research_jobs', activeJob, { mode:jobPayload.mode, status:jobPayload.status, context:jobPayload.context }) : insertSupa('research_jobs', jobPayload))
      .then(function(job) {
        job = job || activeJob;
        if (!activeJob) state.researchJobs.push(job);
        state.addState.job = job;
        return patchSupa('research_jobs', job, { person_id:person.id }).then(function(saved) {
          Object.assign(job, saved || { person_id:person.id });
          return person;
        });
      });
  }).then(function(person) {
    if (!runResearch) {
      showProfile(person);
      return;
    }
    state.addState.phase = 'loading';
    render();
    return runNameResearch(name, ctx, person);
  }).catch(function(err) {
    showCaptureError(name, err, !!state.addState.person);
  }).finally(function() {
    state.captureBusy = false;
  });
}

function runNameResearch(name, ctx, resolvedPerson) {
  var job = state.addState.job;
  var claim = job ? claimResearchJob(job).then(function(saved) {
    if (!saved) { job.status = 'running'; job.updated_at = new Date().toISOString(); var err = new Error('Dieser Recherchejob läuft bereits in einem anderen Fenster.'); err.code = 'JOB_ALREADY_CLAIMED'; throw err; }
    Object.assign(job, saved);
  }) : Promise.resolve();
  return claim.then(function() { return fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: name, context: ctx, sourceExamples: bestSourceExamples() })
  }); })
  .then(function(r) {
    return r.json().then(function(data) {
      if (data._meta && data._meta.usage && !r.ok) persistAiUsage(data._meta.usage, job, resolvedPerson, 'failed', data.error);
      if (!r.ok || data.error) throw new Error(data.error || 'Analyse fehlgeschlagen (HTTP ' + r.status + ')');
      return data;
    });
  })
  .then(function(data) {
    state.addState.usage = data._meta && data._meta.usage ? data._meta.usage : null;
    state.addState.grounding = data._meta && data._meta.grounding ? data._meta.grounding : null;
    if (state.addState.usage) persistAiUsage(state.addState.usage, job, resolvedPerson);
    var incomingPerson = normalizePersonSuggestion(data.person || {});
    state.addState.person = mergePersonSuggestion(resolvedPerson, incomingPerson);
    state.addState.entries = normalizeExtractEntries(data.entries);
    if (job) {
      patchSupa('research_jobs', job, { status:'review', current_step:'review', result_summary:{ entries:state.addState.entries.length, person_name:state.addState.person.name, suggestion:{ person:data.person, entries:data.entries }, meta:data._meta || {} } })
        .then(function(saved){ Object.assign(job, saved || {}); }).catch(function(){});
    }
    state.addState.phase = 'preview';
    render();
  })
  .catch(function(err) {
    if (job && err.code !== 'JOB_ALREADY_CLAIMED') patchSupa('research_jobs', job, { status:'failed', current_step:'research', last_error:String(err.message || err), finished_at:new Date().toISOString() }).catch(function(){});
    showCaptureError(name, err, true);
  });
}

export function persistAiUsage(usage, job, person, status, errorMessage) {
  var book = activeBook();
  var payload = {
    operation: usage.operation || 'extract', provider:'google', model:usage.model || 'gemini-2.5-flash', status:status || 'succeeded',
    prompt_tokens:usage.promptTokens, output_tokens:usage.outputTokens, thinking_tokens:usage.thinkingTokens || 0,
    total_tokens:usage.totalTokens, estimated_cost_usd:usage.estimatedCostUsd, estimated_cost_eur:usage.estimatedCostEur,
    duration_ms:usage.durationMs, pricing:Object.assign({}, usage.pricing || {}, { groundingRequests:usage.groundingRequests || 0 }), research_job_id:job && job.id,
    person_id:person && person.id, book_id:book && book.id, error_message:errorMessage || null
  };
  insertSupa('ai_runs', payload).then(function(saved) { if (saved) state.aiRuns.push(saved); updateStats(); }).catch(function(err) { console.warn('KI-Kosten konnten nicht gespeichert werden:', err.message); });
}

export function showCaptureError(name, err, wasSaved) {
  state.addState.phase = 'input'; state.addState.prefill = name;
  render();
  setTimeout(function() {
    var w = document.querySelector('.add-wrap');
    if (!w) return;
    var errEl = document.createElement('div');
    errEl.style.cssText = 'margin-top:12px;padding:11px 14px;background:#fdf0ee;border:1px solid #e0b0aa;border-radius:6px;font-size:12px;color:#8f2e22';
    errEl.textContent = (wasSaved ? 'Name ist gespeichert. Recherche fehlgeschlagen: ' : 'Speichern fehlgeschlagen: ') + err.message;
    w.querySelector('.add-card').appendChild(errEl);
  }, 30);
}

function collectFormData() {
  if (state.addState.phase !== 'preview') return;
  var g = function(id) { var el = document.getElementById(id); return el ? el.value : ''; };

  state.addState.person = {
    name: g('add-p-name'),
    kategorie: g('add-p-kat'),
    dates: g('add-p-dates'),
    status: g('add-p-status'),
    tags: splitList(g('add-p-tags')),
    note: g('add-p-note'),
    lebensprinzip: g('add-p-principle'),
    buchthese: g('add-p-thesis'),
    archetyp: g('add-p-arch'),
    spannung: g('add-p-tension'),
    visuelles_motiv: g('add-p-visual'),
    format_eignung: getChecked('add-p-format'),
    kurationsnotiz: g('add-p-cur-note')
  };

  state.addState.entries = state.addState.entries.map(function(e, i) {
    return {
      kategorie: g('add-e-' + i + '-kat'),
      buch: g('add-e-' + i + '-buch'),
      text: g('add-e-' + i + '-text'),
      quelle: g('add-e-' + i + '-quelle'),
      quelle_url: g('add-e-' + i + '-quelle-url'),
      tags: splitList(g('add-e-' + i + '-tags')),
      staerke: g('add-e-' + i + '-staerke'),
      quellenqualitaet: g('add-e-' + i + '-qqual'),
      buchreife: g('add-e-' + i + '-reife'),
      themen: getChecked('add-e-' + i + '-themen'),
      ton: g('add-e-' + i + '-ton'),
      seitenrolle: g('add-e-' + i + '-rolle'),
      buchnotiz: g('add-e-' + i + '-buchnotiz')
    };
  });
}

export function changeEntryKat(i) {
  collectFormData();
  state.addState.entries[i].kategorie = document.getElementById('add-e-' + i + '-kat').value;
  render();
}

export function removeEntry(i) {
  collectFormData();
  state.addState.entries.splice(i, 1);
  render();
}

export function addEntry() {
  collectFormData();
  state.addState.entries.push({ kategorie: 'Anekdote', buch: 'hintergrund', text: '', quelle: '', quelle_url: '', tags: [], staerke: '', quellenqualitaet: 'unbekannt', buchreife: 'roh', themen: [], ton: '', seitenrolle: 'unentschieden', buchnotiz: '' });
  render();
}

export function resetAdd() {
  state.addState = { phase: 'input', person: null, entries: [], prefill: '', job: null, usage: null, mode: 'capture' };
  render();
}

export function saveData() {
  collectFormData();
  var p = state.addState.person;
  if (!p || !p.name || !p.name.trim()) { alert('Name darf nicht leer sein.'); return; }

  var btn = document.getElementById('add-save-btn');
  btn.disabled = true; btn.textContent = 'Speichert…';

  var existingPerson = findPersonByName(p.name);

  var personPromise = existingPerson
    ? patchSupa('persons', existingPerson, personPayload(p, false)).then(function(saved) {
        Object.assign(existingPerson, saved || p);
        return existingPerson;
      })
    : insertSupa('persons', personPayload(p, true));

  personPromise.then(function(r) {
    var resolvedPerson = existingPerson || r || p;
    var entryObjects = state.addState.entries.filter(function(e) { return e.text && e.text.trim(); }).map(function(e) {
      e.person = resolvedPerson.name || p.name;
      e.person_id = resolvedPerson.id || null;
      return entryPayload(e);
    });

    if (!entryObjects.length) return Promise.resolve({ ok: true });

    return insertSupa('entries', entryObjects);
  }).then(function(r) {
    if (state.addState.job) patchSupa('research_jobs', state.addState.job, { status:'done', current_step:'done', finished_at:new Date().toISOString() }).catch(function(){});
    state.addState = { phase: 'input', person: null, entries: [], prefill: '', job: null, usage: null, mode: 'capture' };
    init();
  }).catch(function(err) {
    btn.disabled = false; btn.textContent = 'Speichern';
    alert('Fehler beim Speichern: ' + err.message);
  });
}
