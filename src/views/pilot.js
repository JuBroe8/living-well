import { render, showProfile, updateStats } from '../state/router.js';
import { state } from '../state/store.js';
import { activeBook, candidateFor, candidateUntouched, dossierModel, fitLabel, fitScore, missingLabel, personById, personDashboardModel, personEntries, personHasPage, pilotIntakeSort } from '../data/models.js';
import { esc, opts, val } from '../utils.js';
import { CANDIDATE_EDIT_STAGES, CANDIDATE_STAGES, FIT_FIELDS, PILOT_COLUMN_EMPTY, PILOT_THESIS, STAGE_LABELS } from '../config.js';
import { bindDashboardActions, dashMetric } from './dashboard.js';
import { openPageWorkshopForPerson } from './profile.js';
import { insertSupa, patchSupa } from '../data/supabase.js';

export function fitBewertenForPerson(p) {
  showProfile(p);
  setTimeout(function() { state.fitPanelExpanded = true; render(); }, 0);
}

export function rPilot(main) {
  main.innerHTML = '';
  var book = activeBook();
  if (!book) {
    main.innerHTML = '<div class="empty"><div class="empty-ico">○</div>Die Pilotband-Struktur ist vorbereitet. Bitte zuerst die neue Datenbankmigration anwenden.</div>';
    return;
  }
  var candidates = state.bookCandidates.filter(function(c) { return String(c.book_id) === String(book.id); });
  var poolCandidates = candidates.filter(function(c) { return !c.stage || c.stage === 'pool'; })
    .map(function(c) { var p = personById(c.person_id); return p ? { c: c, person: p, entryCount: personEntries(p).length } : null; })
    .filter(Boolean)
    .sort(pilotIntakeSort);
  var evaluated = candidates.filter(function(c) { return fitScore(c) !== null; }).length;
  var selected = candidates.filter(function(c) { return c.stage === 'selected'; }).length;
  var shortlist = candidates.filter(function(c) { return c.stage === 'shortlist'; }).length;
  var wrap = document.createElement('div');
  var html = '<section class="pilot-hero">' +
    '<div class="pilot-kicker">Pilotband · ' + esc(book.working_title || book.title || 'Living Well') + '</div>' +
    '<h1 class="pilot-title">Ein breiter erster Band, eine präzise Frage.</h1>' +
    '<p class="pilot-thesis">„' + esc(book.thesis || PILOT_THESIS) + '“</p>' +
    '<p class="pilot-note">Der Personenpool bleibt offen. Hier wird nur entschieden, wer für diesen Band trägt.</p>' +
  '</section>' +
  '<div class="metric-grid">' + dashMetric(poolCandidates.length, 'Noch zu prüfen') + dashMetric(evaluated, 'Bewertet') + dashMetric(shortlist, 'Shortlist') + dashMetric(selected, 'Im Pilot') + '</div>';

  if (poolCandidates.length) {
    var shown = poolCandidates.slice(0, state.pilotQueueLimit);
    html += '<section class="dash-card" style="margin-bottom:16px">' +
      '<div class="dash-card-hd"><div><div class="dash-card-title">Als Nächstes prüfen</div><div class="dash-card-note">' + poolCandidates.length + ' Personen warten auf eine erste Fit-Bewertung.</div></div></div>' +
      '<div class="queue-list">' + shown.map(function(item) {
        var p = item.person, d = dossierModel(p), gaps = personDashboardModel(p).gaps;
        return '<div class="queue-row">' +
          '<div>' +
            '<div class="queue-name" data-open-person="' + esc(p.name) + '">' + esc(p.name) + '</div>' +
            '<div class="queue-meta">' + esc(p.kategorie || 'noch ohne Kategorie') + ' · ' + item.entryCount + ' Eintr' + (item.entryCount === 1 ? 'ag' : 'äge') +
              (gaps.length ? ' · ' + gaps.slice(0, 2).map(missingLabel).join(', ') : '') + '</div>' +
            '<div class="dossier-row"><span class="pill ' + (d.count >= 6 ? 'pill-s' : 'pill-q') + '">Dossier ' + d.count + '/8</span></div>' +
          '</div>' +
          '<div class="actions"><button class="mini-btn primary" data-fit-person="' + esc(p.id) + '">Fit bewerten</button></div>' +
        '</div>';
      }).join('') + '</div>' +
      (poolCandidates.length > shown.length ? '<div class="actions" style="margin-top:10px"><button class="mini-btn" id="pilot-queue-more">Mehr anzeigen (' + (poolCandidates.length - shown.length) + ')</button></div>' : '') +
    '</section>';
  }

  html += '<div class="pilot-board">';
  CANDIDATE_STAGES.forEach(function(stage) {
    var list = candidates.filter(function(c) { return c.stage === stage; }).sort(function(a,b) { return fitScore(b) - fitScore(a); });
    html += '<section class="pilot-col"><div class="pilot-col-hd"><span>' + esc(STAGE_LABELS[stage]) + '</span><span>' + list.length + '</span></div>';
    if (!list.length) html += '<div class="readonly-note">' + esc(PILOT_COLUMN_EMPTY[stage] || 'Noch leer') + '</div>';
    list.forEach(function(c) {
      var p = personById(c.person_id); if (!p) return;
      var score = fitScore(c), dossier = dossierModel(p);
      var showPageAction = stage === 'shortlist' && !personHasPage(p);
      html += '<div class="candidate-card">' +
        '<div data-pilot-person="' + esc(p.id) + '" style="cursor:pointer">' +
          '<div class="candidate-name">' + esc(p.name) + '</div>' +
          '<div class="candidate-meta">Dossier ' + dossier.count + '/8 · ' + esc(p.kategorie || 'noch ohne Kategorie') + '</div>' +
          '<span class="fit-pill ' + (score >= 7 ? 'strong' : '') + '">' + (score === null ? 'Noch unbewertet' : score + '/12 · ' + fitLabel(score)) + '</span>' +
        '</div>' +
        (showPageAction ? '<div class="actions" style="margin-top:8px"><button class="mini-btn" data-page-person="' + esc(p.id) + '">Seite gestalten</button></div>' : '') +
      '</div>';
    });
    html += '</section>';
  });
  html += '</div>';
  wrap.innerHTML = html;
  wrap.querySelectorAll('[data-pilot-person]').forEach(function(el) {
    el.onclick = function() { var p = personById(el.getAttribute('data-pilot-person')); if (p) showProfile(p); };
  });
  wrap.querySelectorAll('[data-page-person]').forEach(function(el) {
    el.onclick = function(e) { e.stopPropagation(); var p = personById(el.getAttribute('data-page-person')); if (p) openPageWorkshopForPerson(p); };
  });
  wrap.querySelectorAll('[data-fit-person]').forEach(function(el) {
    el.onclick = function(e) { e.stopPropagation(); var p = personById(el.getAttribute('data-fit-person')); if (p) fitBewertenForPerson(p); };
  });
  bindDashboardActions(wrap);
  var moreBtn = wrap.querySelector('#pilot-queue-more');
  if (moreBtn) moreBtn.onclick = function() { state.pilotQueueLimit += 12; render(); };
  main.appendChild(wrap);
}

export function renderFitPanel(p) {
  var book = activeBook(), c = candidateFor(p), panel = document.createElement('section');
  panel.className = 'fit-panel';
  if (!book) {
    panel.innerHTML = '<div class="dash-card-title">Pilotband-Passung</div><div class="readonly-note">Datenbankmigration noch nicht angewendet.</div>';
    return panel;
  }
  if (!c) {
    panel.innerHTML = '<div class="fit-head"><div><div class="dash-card-title">Pilotband-Passung</div><div class="dash-card-note">Die Person bleibt im Pool, bis sie für den Pilotband geprüft wird.</div></div><button class="mini-btn primary" onclick="addToPilot()">Für Pilot prüfen</button></div>';
    return panel;
  }
  var d = dossierModel(p);
  if (candidateUntouched(c) && !state.fitPanelExpanded) {
    panel.innerHTML = '<div class="fit-head"><div><div class="dash-card-title">Passung für den Pilotband</div><div class="dash-card-note">Noch nicht bewertet · Dossier ' + d.count + '/8</div></div><button class="mini-btn primary" onclick="expandFitPanel()">Jetzt bewerten</button></div>';
    return panel;
  }
  var score = fitScore(c);
  var fields = FIT_FIELDS.map(function(f) {
    var current = c[f[0]] === null || c[f[0]] === undefined ? '' : String(c[f[0]]);
    return '<div class="fit-field"><label for="fit-' + f[0] + '">' + esc(f[1]) + '</label><select id="fit-' + f[0] + '">' + opts(['','0','1','2'], current) + '</select></div>';
  }).join('');
  panel.innerHTML = '<div class="fit-head"><div><div class="dash-card-title">Passung für den Pilotband</div><div class="dash-card-note">Bandbezogener Fit – getrennt vom Recherchefortschritt.</div></div><div class="fit-score">' + (score === null ? 'offen' : score + '/12') + '</div></div>' +
    '<div class="fit-grid">' + fields + '</div>' +
    '<div class="form-grid" style="margin-top:10px"><div class="add-fld"><label class="add-lbl">Auswahlstatus</label><select id="fit-stage" class="ai ai-sel">' + opts(CANDIDATE_EDIT_STAGES, c.stage || 'pool') + '</select></div>' +
    '<div class="add-fld"><label class="add-lbl">Bewertung</label><select id="fit-origin" class="ai ai-sel">' + opts(['manual','ai','hybrid','import'], c.review_origin || 'manual') + '</select></div></div>' +
    '<div class="add-fld"><label class="add-lbl">Begründung</label><textarea id="fit-rationale" class="ai ai-ta" rows="2">' + esc(c.rationale || '') + '</textarea></div>' +
    '<div class="actions"><button id="fit-save" class="mini-btn primary" onclick="savePilotFit()">Fit speichern</button><span class="save-msg">Dossier ' + d.count + '/8</span></div>' +
    '<div class="dossier-row">' + d.checks.map(function(x) { return '<span class="dossier-check ' + (x[1] ? '' : 'miss') + '">' + (x[1] ? '✓ ' : '○ ') + esc(x[0]) + '</span>'; }).join('') + '</div>';
  return panel;
}

export function addToPilot() {
  var book = activeBook(), p = state.profilePerson;
  if (!book || !p) return;
  insertSupa('book_candidates', { book_id: book.id, person_id: p.id, stage: 'pruefen', review_origin: 'manual' }).then(function(saved) {
    state.bookCandidates.push(saved);
    render();
  }).catch(function(err) { alert('Pilot-Zuordnung fehlgeschlagen: ' + err.message); });
}

export function savePilotFit() {
  var c = candidateFor(state.profilePerson); if (!c) return;
  var payload = { stage: val('fit-stage'), review_origin: val('fit-origin'), rationale: val('fit-rationale') };
  FIT_FIELDS.forEach(function(f) { var raw = val('fit-' + f[0]); payload[f[0]] = raw === '' ? null : Number(raw); });
  var btn = document.getElementById('fit-save'); btn.disabled = true; btn.textContent = 'Speichert…';
  patchSupa('book_candidates', c, payload).then(function(saved) {
    Object.assign(c, saved || payload); updateStats(); render();
  }).catch(function(err) { btn.disabled = false; btn.textContent = 'Fit speichern'; alert('Fit konnte nicht gespeichert werden: ' + err.message); });
}
