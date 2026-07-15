import { bestSourceExamples, dossierModel, eraForYear, findPersonByName, mergePersonSuggestion, nextActionForPerson, normalizeExtractEntries, normalizePersonSuggestion, parseFirstYear, personById, personEntries } from '../data/models.js';
import { moreResearch, openPageWorkshopForPerson } from './profile.js';
import { goTab, render, showProfile, showProfileByName } from '../state/router.js';
import { state } from '../state/store.js';
import { claimResearchJob, patchSupa } from '../data/supabase.js';
import { fitBewertenForPerson } from './pilot.js';
import { arr, esc, formatEuro, label, normalizeUrl } from '../utils.js';
import { persistAiUsage } from '../add.js';
import { THEMA_LIST } from '../config.js';

function runNextAction(p) {
  var a = nextActionForPerson(p);
  if (a.key === 'review' && a.jobId) { openResearchJob(a.jobId); return; }
  if (a.key === 'page') { openPageWorkshopForPerson(p); return; }
  showProfile(p);
  if (a.key === 'fit') setTimeout(function() { state.fitPanelExpanded = true; render(); }, 0);
  else if (a.key === 'research') setTimeout(moreResearch, 0);
}

function personQueueSub(p, key) {
  var d = dossierModel(p);
  if (key === 'dossier') return personEntries(p).length + ' Eintr' + (personEntries(p).length === 1 ? 'ag' : 'äge') + ' · Dossier ' + d.count + '/8';
  if (key === 'fit') return 'Dossier ' + d.count + '/8 · noch nicht bewertet';
  if (key === 'page') return 'Auf der Shortlist · noch keine Seite gestaltet';
  return '';
}

function buildWorkQueue() {
  var queue = [], seen = {};
  state.researchJobs.filter(function(j) { return j.status === 'failed'; }).slice(-20).forEach(function(j) {
    var p = personById(j.person_id) || findPersonByName(j.input_name);
    var name = p ? p.name : (j.input_name || j.raw_input || 'Unbekannt');
    if (seen[name]) return;
    seen[name] = true;
    queue.push({ type: 'failed', name: name, person: p, job: j, label: 'Erneut versuchen', sub: j.last_error ? String(j.last_error) : 'Recherchelauf fehlgeschlagen' });
  });
  state.researchJobs.filter(function(j) { return j.status === 'review'; }).forEach(function(j) {
    var p = personById(j.person_id) || findPersonByName(j.input_name);
    var name = p ? p.name : (j.input_name || j.raw_input || 'Unbekannt');
    if (seen[name]) return;
    seen[name] = true;
    queue.push({ type: 'review', name: name, person: p, job: j, label: 'Vorschlag prüfen', sub: 'Rechercheergebnis wartet auf Prüfung' });
  });
  var order = { dossier: 0, fit: 1, page: 2 };
  var personItems = [];
  state.persons.forEach(function(p) {
    if (seen[p.name]) return;
    var a = nextActionForPerson(p);
    if (order[a.key] === undefined) return;
    personItems.push({ type: a.key, name: p.name, person: p, label: a.label, sub: personQueueSub(p, a.key), rank: order[a.key] });
  });
  personItems.sort(function(x, y) { return x.rank - y.rank; });
  personItems.forEach(function(it) { seen[it.name] = true; queue.push(it); });
  return queue;
}

function retryFailedJob(job) {
  patchSupa('research_jobs', job, { status: 'queued', last_error: null }).then(function(saved) {
    Object.assign(job, saved || {});
    render();
    setTimeout(resumeQueuedResearch, 50);
  }).catch(function(err) { alert('Erneuter Versuch fehlgeschlagen: ' + err.message); });
}

function runQueueAction(item) {
  if (item.type === 'failed') { if (item.person) showProfile(item.person); retryFailedJob(item.job); return; }
  if (item.type === 'review') { openResearchJob(item.job.id); return; }
  if (!item.person) return;
  if (item.type === 'dossier') { showProfile(item.person); return; }
  if (item.type === 'fit') { fitBewertenForPerson(item.person); return; }
  if (item.type === 'page') { openPageWorkshopForPerson(item.person); return; }
}

function workQueueHtml(queue, limit) {
  if (!queue.length) return '<div class="readonly-note">Alles erledigt — aktuell wartet keine Aufgabe.</div>';
  var shown = queue.slice(0, limit);
  var rows = shown.map(function(item, i) {
    return '<div class="queue-row">' +
      '<div>' +
        '<div class="queue-name">' + esc(item.name) + '</div>' +
        '<div class="queue-meta">' + esc(item.sub || '') + '</div>' +
      '</div>' +
      '<div class="actions"><button class="mini-btn primary" data-queue-action="' + i + '">' + esc(item.label) + '</button></div>' +
    '</div>';
  }).join('');
  var more = queue.length > shown.length ? '<div class="actions" style="margin-top:10px"><button class="mini-btn" id="dash-queue-more">Mehr anzeigen (' + (queue.length - shown.length) + ')</button></div>' : '';
  return '<div class="queue-list">' + rows + '</div>' + more;
}

export function rStatus(main) {
  main.innerHTML = '';
  state.dashboardQueue = buildWorkQueue();
  var totalCost = state.aiRuns.reduce(function(sum, x) { return sum + Number(x.estimated_cost_eur || 0); }, 0);
  var inFlightJobs = state.researchJobs.filter(function(j) { return ['captured', 'queued', 'running'].indexOf(j.status) >= 0; });

  var wrap = document.createElement('div');
  wrap.innerHTML =
    '<div class="dash-hero">' +
      '<div class="dash-title">Heute</div>' +
      '<div class="dash-copy">Eine priorisierte Aufgabe nach der anderen: Vorschläge prüfen, Dossiers vervollständigen, Fit bewerten, Seiten gestalten.</div>' +
      '<div class="actions" style="margin-top:14px">' +
        '<button class="mini-btn primary" onclick="openCapture()">+ Namen erfassen</button>' +
        (state.dashboardQueue.length ? '<button class="mini-btn" id="dash-next-action">Nächste Aufgabe starten</button>' : '<button class="mini-btn" onclick="goTab(\'pilot\')">Pilotband öffnen</button>') +
      '</div>' +
    '</div>' +
    '<div class="metric-grid">' +
      dashMetric(state.dashboardQueue.length, 'Offene Aufgaben') +
      dashMetric(inFlightJobs.length, 'Recherche läuft') +
      dashMetric(formatEuro(totalCost), 'KI-Kosten erfasst') +
    '</div>' +
    '<div class="dash-card" style="margin-bottom:16px">' +
      '<div class="dash-card-hd"><div><div class="dash-card-title">Nächste Aufgaben</div><div class="dash-card-note">Nach Priorität sortiert — oben zuerst erledigen.</div></div></div>' +
      workQueueHtml(state.dashboardQueue, state.dashboardQueueLimit) +
    '</div>' +
    (inFlightJobs.length ? '<div class="dash-card" style="margin-bottom:16px">' +
      '<div class="dash-card-hd"><div><div class="dash-card-title">Recherche läuft gerade</div><div class="dash-card-note">Name bleibt gespeichert, auch wenn die Anreicherung scheitert.</div></div></div>' +
      researchJobsHtml(inFlightJobs) +
    '</div>' : '') +
    '<div class="dash-card">' +
      '<div class="dash-card-hd"><div><div class="dash-card-title">KI-Kosten &amp; Limits</div><div class="dash-card-note">Tagesbudget, Google-Search-Freikontingent und Lauf-Historie.</div></div><button class="mini-btn" onclick="goTab(\'kosten\')">Öffnen</button></div>' +
      '<div class="readonly-note">' + formatEuro(totalCost) + ' insgesamt erfasst · zuletzt: ' + (state.aiRuns.length ? esc(state.aiRuns[state.aiRuns.length - 1].operation || '') : '—') + '</div>' +
    '</div>';

  main.appendChild(wrap);
  bindDashboardActions(wrap);
  wrap.querySelectorAll('[data-queue-action]').forEach(function(el) {
    el.onclick = function() { var item = state.dashboardQueue[Number(el.getAttribute('data-queue-action'))]; if (item) runQueueAction(item); };
  });
  var nextBtn = wrap.querySelector('#dash-next-action');
  if (nextBtn) nextBtn.onclick = function() { if (state.dashboardQueue[0]) runQueueAction(state.dashboardQueue[0]); };
  var moreBtn = wrap.querySelector('#dash-queue-more');
  if (moreBtn) moreBtn.onclick = function() { state.dashboardQueueLimit += 10; render(); };
}

export function researchProcessHtml(usage, grounding) {
  if (!usage) return '';
  var rows = [];
  rows.push('<div class="research-log-row"><span class="research-log-lbl">Modell</span><span>' + esc(usage.model || '—') + '</span></div>');
  rows.push('<div class="research-log-row"><span class="research-log-lbl">Token / Kosten</span><span>' + Number(usage.totalTokens || 0).toLocaleString('de-DE') + ' Token · ' + formatEuro(usage.estimatedCostEur || 0) + '</span></div>');

  if (grounding && grounding.used) {
    var queries = arr(grounding.queries), sources = arr(grounding.sources);
    rows.push('<div class="research-log-row"><span class="research-log-lbl">Google-Suche</span><span>Genutzt · ' + queries.length + ' Anfrage' + (queries.length === 1 ? '' : 'n') + ' · ' + sources.length + ' Quelle' + (sources.length === 1 ? '' : 'n') + ' gefunden</span></div>');
    if (queries.length) {
      rows.push('<div class="research-log-row"><span class="research-log-lbl">Suchbegriffe</span><span>' + queries.map(function(q) { return '„' + esc(q) + '"'; }).join(', ') + '</span></div>');
    }
    if (sources.length) {
      rows.push('<div class="research-log-row"><span class="research-log-lbl">Quellen</span><div class="research-log-sources">' +
        sources.map(function(s) {
          var url = normalizeUrl(s.url);
          return url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(s.title || url) + '</a>' : esc(s.title || 'ohne URL');
        }).join('') +
      '</div></div>');
    }
  } else {
    var reason = grounding && grounding.error ? 'Fehlgeschlagen (' + grounding.error + ')' : 'Nicht ausgelöst';
    rows.push('<div class="research-log-row"><span class="research-log-lbl">Google-Suche</span><span class="research-log-warn">' + esc(reason) + ' — Vorschläge stammen aus Trainingswissen. quellenqualitaet wurde deshalb auf „unbekannt" begrenzt, auch wenn eine Quelle genannt ist.</span></div>');
  }

  return '<details class="research-log"><summary>Recherche-Protokoll</summary>' +
    '<div class="research-log-body">' + rows.join('') + '</div>' +
    '<div class="research-log-criteria"><strong>Wie Quellenqualität bewertet wird:</strong> „primär" = plausibel zuordenbares Originalwerk; „sekundär" = Biografie/Sekundärliteratur; „unbekannt" = keine belastbare Quelle gefunden. „geprüft" vergibt die KI nie automatisch — das bleibt eine menschliche Entscheidung.</div>' +
  '</details>';
}

function researchJobsHtml(jobs) {
  if (!jobs.length) return '<div class="readonly-note">Keine offenen Jobs.</div>';
  return '<div class="queue-list">' + jobs.slice(-8).reverse().map(function(j) {
    var p = personById(j.person_id);
    var action = j.status === 'review' && j.result_summary && j.result_summary.suggestion
      ? '<button class="mini-btn" onclick="openResearchJob(\'' + esc(j.id) + '\')">Prüfen</button>'
      : '<span class="pill pill-q">' + esc(j.status) + '</span>';
    return '<div class="cost-row"><span><strong>' + esc(p ? p.name : (j.input_name || j.raw_input || 'Unbekannt')) + '</strong><br><span class="readonly-note">' + esc(j.mode || 'extract') + '</span></span>' + action + '</div>';
  }).join('') + '</div>';
}

export function openResearchJob(id) {
  var job = state.researchJobs.find(function(j){ return String(j.id) === String(id); });
  var suggestion = job && job.result_summary && job.result_summary.suggestion;
  if (!job || !suggestion) return;
  var person = personById(job.person_id) || findPersonByName(job.input_name);
  if (!person) return;
  state.addState = {
    phase:'preview', person:mergePersonSuggestion(person, normalizePersonSuggestion(suggestion.person || {})),
    entries:normalizeExtractEntries(suggestion.entries), prefill:job.input_name || person.name, job:job,
    usage:job.result_summary.meta && job.result_summary.meta.usage,
    grounding:job.result_summary.meta && job.result_summary.meta.grounding,
    mode:'capture'
  };
  goTab('add');
}

export function resumeQueuedResearch() {
  if (state.queueResumeBusy || state.tableAvailability.research_jobs !== true) return;
  var now = Date.now();
  var job = state.researchJobs.find(function(j) {
    if (j.mode !== 'extract') return false;
    if (j.status === 'queued') return true;
    return j.status === 'running' && now - new Date(j.updated_at || j.created_at || 0).getTime() > 120000;
  });
  if (!job) return;
  var person = personById(job.person_id) || findPersonByName(job.input_name);
  if (!person) return;
  state.queueResumeBusy = true;
  claimResearchJob(job)
    .then(function(saved) {
      if (!saved) { var err = new Error('Job wurde bereits übernommen'); err.code = 'JOB_ALREADY_CLAIMED'; throw err; }
      Object.assign(job, saved);
      return fetch('/api/extract', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ input:job.input_name, context:job.context || '', sourceExamples:bestSourceExamples() }) });
    })
    .then(function(r) { return r.json().then(function(data) {
      if (data._meta && data._meta.usage) persistAiUsage(data._meta.usage, job, person, r.ok ? 'succeeded' : 'failed', data.error);
      if (!r.ok || data.error) throw new Error(data.error || 'Recherche fehlgeschlagen');
      return data;
    }); })
    .then(function(data) {
      return patchSupa('research_jobs', job, {
        status:'review', current_step:'review',
        result_summary:{ entries:(data.entries || []).length, person_name:(data.person || {}).name || person.name, suggestion:{person:data.person, entries:data.entries}, meta:data._meta || {} }
      }).then(function(saved){ Object.assign(job, saved || {}); });
    })
    .catch(function(err) {
      if (err.code === 'JOB_ALREADY_CLAIMED') { job.status = 'running'; job.updated_at = new Date().toISOString(); }
      else patchSupa('research_jobs', job, { status:'failed', current_step:'research', last_error:String(err.message || err), finished_at:new Date().toISOString() }).then(function(saved){ Object.assign(job, saved || {}); }).catch(function(){});
    })
    .finally(function() { state.queueResumeBusy = false; if (state.view === 'status') render(); setTimeout(resumeQueuedResearch, 50); });
}

export function dashMetric(n, l) {
  return '<div class="metric"><div class="metric-n">' + n + '</div><div class="metric-l">' + esc(l) + '</div></div>';
}

export function bindDashboardActions(root) {
  root.querySelectorAll('[data-open-person]').forEach(function(el) {
    el.onclick = function(e) {
      e.stopPropagation();
      showProfileByName(el.getAttribute('data-open-person'));
    };
  });
}

function tagMappingHtml(stats) {
  var mapped = stats.filter(function(x){ return x.theme; }).slice(0, 18);
  var unmapped = stats.filter(function(x){ return !x.theme; }).slice(0, 12);
  var html = '<div class="tag-cloud">';
  mapped.forEach(function(x) {
    html += '<span class="tag-map"><strong>' + esc(x.tag) + '</strong> → ' + esc(label(x.theme)) + ' · ' + x.count + '</span>';
  });
  html += '</div>';
  if (unmapped.length) {
    html += '<div class="dash-card-note" style="margin:14px 0 8px">Noch ohne Motiv-Zuordnung</div><div class="tag-cloud">';
    unmapped.forEach(function(x) {
      html += '<span class="tag-map unmapped"><strong>' + esc(x.tag) + '</strong> · ' + x.count + '</span>';
    });
    html += '</div>';
  }
  return html;
}

function themenHeatmapHtml() {
  var counts = {};
  THEMA_LIST.forEach(function(t) { counts[t] = { entries: 0, people: {} }; });
  state.entries.forEach(function(x) {
    arr(x.themen).forEach(function(t) {
      if (counts[t]) {
        counts[t].entries++;
        if (x.person) counts[t].people[x.person] = true;
      }
    });
  });
  var maxN = Math.max(1, Math.max.apply(null, THEMA_LIST.map(function(t) { return counts[t].entries; })));
  var sorted = THEMA_LIST.slice().sort(function(a, b) { return counts[b].entries - counts[a].entries; });

  var html = '<div class="heat-grid">';
  sorted.forEach(function(t) {
    var c = counts[t];
    var pct = Math.round((c.entries / maxN) * 100);
    var fillCls = c.entries === 0 ? 'pipe-fill-zero' : c.entries >= Math.ceil(maxN * .5) ? 'pipe-fill-strong' : 'pipe-fill-ok';
    var pCount = Object.keys(c.people).length;
    html += '<div class="pipe-row">' +
      '<div class="pipe-label">' + esc(label(t)) + '</div>' +
      '<div class="pipe-bar"><div class="' + fillCls + '" style="width:' + (c.entries ? Math.max(pct, 4) : 0) + '%"></div></div>' +
      '<div class="pipe-n">' + c.entries + (pCount ? '<span style="color:var(--br2)"> / ' + pCount + 'P</span>' : '') + '</div>' +
    '</div>';
  });
  html += '</div>';
  return html;
}

function zeitstrahlHtml() {
  var ERA_ORDER = ['Antike', 'Mittelalter', 'Frühe Neuzeit', '18./19. Jh.', '20. Jh.', 'Gegenwart', 'Unbekannt'];
  var counts = {};
  ERA_ORDER.forEach(function(e) { counts[e] = []; });
  state.persons.forEach(function(p) {
    var era = eraForYear(parseFirstYear(p.dates));
    counts[era].push(p.name);
  });
  var maxN = Math.max(1, Math.max.apply(null, ERA_ORDER.map(function(e) { return counts[e].length; })));

  var html = '';
  ERA_ORDER.forEach(function(era) {
    var list = counts[era];
    if (era === 'Unbekannt' && !list.length) return;
    var pct = Math.round((list.length / maxN) * 100);
    var fillCls = list.length === 0 ? 'pipe-fill-zero' : list.length >= Math.ceil(maxN * .5) ? 'pipe-fill-strong' : 'pipe-fill-ok';
    html += '<div class="pipe-row">' +
      '<div class="pipe-label">' + esc(era) + '</div>' +
      '<div class="pipe-bar"><div class="' + fillCls + '" style="width:' + (list.length ? Math.max(pct, 4) : 0) + '%"></div></div>' +
      '<div class="pipe-n" title="' + esc(list.join(', ')) + '">' + list.length + '</div>' +
    '</div>';
  });
  return html;
}

function svCell(n, required) {
  var cls = n > 0 ? 'sv-has' : (required ? 'sv-warn' : 'sv-miss');
  return '<td class="sv-cell"><span class="sv-n ' + cls + '">' + (n > 0 ? n : '—') + '</span></td>';
}

function svMark(ok, required) {
  var cls = ok ? 'sv-has' : (required ? 'sv-warn' : 'sv-miss');
  return '<td class="sv-cell"><span class="sv-n ' + cls + '">' + (ok ? '✓' : '—') + '</span></td>';
}
