import { state } from '../state/store.js';
import { arr, esc } from '../utils.js';
import { activeBook, candidateFor, dossierModel, fitScore, personEntries, personMatchesCuration, personSortComparator } from '../data/models.js';
import { hit, render } from '../state/router.js';
import { mkPCard } from '../components/person-card.js';

export function rPersons(main, s) {
  var data = state.persons.filter(function(p) {
    if (state.fil.status && p.status !== state.fil.status) return false;
    if (state.fil.format && arr(p.format_eignung).indexOf(state.fil.format) < 0) return false;
    if (state.fil.cur && !personMatchesCuration(p, state.fil.cur)) return false;
    if (state.fil.arbeitsstand) {
      var pe = personEntries(p);
      if (state.fil.arbeitsstand === 'ohne_material' && pe.length > 0) return false;
      if (state.fil.arbeitsstand === 'dossier_offen' && !(pe.length > 0 && dossierModel(p).count < 6)) return false;
      if (state.fil.arbeitsstand === 'dossier_bereit' && dossierModel(p).count < 6) return false;
      if (state.fil.arbeitsstand === 'fit_offen' && fitScore(candidateFor(p)) !== null) return false;
    }
    return hit(p, s);
  });
  data.sort(personSortComparator(state.personSort));
  document.getElementById('cnt').textContent = data.length + ' Personen';
  main.innerHTML = '';
  if (!data.length) {
    main.innerHTML = '<div class="empty"><div class="empty-ico">○</div>Keine Personen gefunden.</div>';
    return;
  }
  var shown = data.slice(0, state.personRenderLimit);
  var grid = document.createElement('div'); grid.className = 'pgrid';
  shown.forEach(function(p) { grid.appendChild(mkPCard(p)); });
  main.appendChild(grid);
  if (data.length > shown.length) {
    var moreWrap = document.createElement('div'); moreWrap.className = 'actions'; moreWrap.style.cssText = 'justify-content:center;margin-top:18px';
    var moreBtn = document.createElement('button'); moreBtn.className = 'mini-btn'; moreBtn.textContent = 'Weitere Personen anzeigen (' + (data.length - shown.length) + ')';
    moreBtn.onclick = function() { state.personRenderLimit += 30; render(); };
    moreWrap.appendChild(moreBtn);
    main.appendChild(moreWrap);
  }
}

export function personOptions(current) {
  var html = '<option value="">— Zuordnung offen —</option>';
  return html + state.persons.slice().sort(function(a,b){ return String(a.name).localeCompare(String(b.name), 'de'); }).map(function(p) {
    return '<option value="' + esc(p.id) + '"' + (String(current || '') === String(p.id) ? ' selected' : '') + '>' + esc(p.name) + '</option>';
  }).join('');
}

export function personOptionsGrouped(current) {
  var book = activeBook();
  var pilotIds = {}, shortlistIds = {};
  if (book) {
    state.bookCandidates.filter(function(c) { return String(c.book_id) === String(book.id); }).forEach(function(c) {
      if (c.stage === 'selected') pilotIds[c.person_id] = true;
      else if (c.stage === 'shortlist') shortlistIds[c.person_id] = true;
    });
  }
  var pilotList = [], shortlistList = [], restList = [];
  state.persons.forEach(function(p) {
    if (pilotIds[p.id]) pilotList.push(p);
    else if (shortlistIds[p.id]) shortlistList.push(p);
    else restList.push(p);
  });
  function byName(a, b) { return String(a.name).localeCompare(String(b.name), 'de'); }
  [pilotList, shortlistList, restList].forEach(function(l) { l.sort(byName); });
  function optionsFor(list) {
    return list.map(function(p) {
      return '<option value="' + esc(p.id) + '"' + (String(current || '') === String(p.id) ? ' selected' : '') + '>' + esc(p.name) + '</option>';
    }).join('');
  }
  var html = '<option value="">— Zuordnung offen —</option>';
  if (pilotList.length) html += '<optgroup label="Im Pilot">' + optionsFor(pilotList) + '</optgroup>';
  if (shortlistList.length) html += '<optgroup label="Shortlist">' + optionsFor(shortlistList) + '</optgroup>';
  html += '<optgroup label="Weitere Personen">' + optionsFor(restList) + '</optgroup>';
  return html;
}
