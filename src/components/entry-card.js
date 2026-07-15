import { BUCHREIFE, KAT_CI, KAT_ICON, QUELLENQUALITAET, SEITENROLLE, THEMA_LIST } from '../config.js';
import { arr, checkGroup, esc, getCheckedIn, opts, splitList } from '../utils.js';
import { entryCurationHtml, entryMetaPills, entryPayload, entryText, personById } from '../data/models.js';
import { state } from '../state/store.js';
import { render, showProfile } from '../state/router.js';
import { renderSingleEntryEnhance } from '../views/enhance.js';
import { personOptions } from '../views/persons.js';
import { patchSupa } from '../data/supabase.js';

export function mkEntryCard(x, showPerson) {
  var kat    = x.kategorie || 'Sonstige';
  var ciCls  = KAT_CI[kat]   || 'ci-x';
  var icon   = KAT_ICON[kat] || '·';
  var bbCls  = x.buch === 'direkt' ? 'bb-d' : 'bb-h';
  var bbLbl  = x.buch === 'direkt' ? 'Direkt' : 'Hintergrund';
  var prev   = x.preview || x.quote || x.anekdote || x.fakt || '';
  var tags   = (x.tags || []).map(function(t) { return '<span class="pill pill-tag">' + esc(t) + '</span>'; }).join('');
  var meta   = entryMetaPills(x);
  var status = '<span class="buch-badge ' + bbCls + '">' + bbLbl + '</span>' + meta;

  var d = document.createElement('div'); d.className = 'card';
  d.innerHTML =
    '<div class="ch">' +
      '<div class="ci ' + ciCls + '">' + icon + '</div>' +
      '<div class="cl">' +
        (showPerson && x.person
          ? '<div class="ce-person" data-person="' + esc(x.person) + '">' + esc(x.person) + '</div>'
          : '') +
        (prev ? '<div class="ce-prev">' + esc(prev) + '</div>' : '') +
        '<div class="ce-meta">' + status + '</div>' +
      '</div>' +
      '<div class="carr">▾</div>' +
    '</div>' +
    '<div class="cd"><div class="cd-in">' +
      (x.quote    ? '<div><div class="lbl">Zitat</div><div class="qt">'       + esc(x.quote)    + '</div></div>' : '') +
      (x.anekdote ? '<div><div class="lbl">Anekdote</div><div class="val">'   + esc(x.anekdote) + '</div></div>' : '') +
      (x.fakt     ? '<div><div class="lbl">Fakt</div><div class="val-fakt">'  + esc(x.fakt)     + '</div></div>' : '') +
      entryCurationHtml(x) +
      (tags ? '<div class="ce-meta" style="margin-top:8px">' + tags + '</div>' : '') +
      (x.buchnotiz? '<div class="buchnotiz-block"><div class="buchnotiz-lbl">Buchrelevanz</div><div class="buchnotiz-text">' + esc(x.buchnotiz) + '</div></div>' : '') +
      (x.quelle || x.quelle_url ? '<div class="src">Quelle: ' + esc(x.quelle || '') + (x.quelle_url ? ' · <a href="' + esc(x.quelle_url) + '" target="_blank" rel="noopener">Link</a>' : '') + '</div>' : '') +
      '<div class="actions"><button class="mini-btn primary entry-enhance-btn">KI-Vorschlag</button><button class="mini-btn entry-edit-btn">Bearbeiten</button></div>' +
    '</div></div>';

  d.querySelector('.ch').onclick = function(e) {
    if (e.target.dataset && e.target.dataset.person) {
      var pp = state.persons.find(function(p) { return p.name === e.target.dataset.person; });
      if (pp) showProfile(pp);
      return;
    }
    d.classList.toggle('open');
  };
  d.querySelector('.entry-edit-btn').onclick = function(e) {
    e.stopPropagation();
    d.classList.add('open');
    renderEntryEdit(d, x);
  };
  d.querySelector('.entry-enhance-btn').onclick = function(e) {
    e.stopPropagation();
    d.classList.add('open');
    renderSingleEntryEnhance(d, x);
  };
  return d;
}

function renderEntryEdit(card, x) {
  var root = card.querySelector('.cd-in');
  root.innerHTML = entryEditHtml(x);
  root.querySelector('.entry-cancel').onclick = function() { render(); };
  root.querySelector('.entry-save').onclick = function() { saveEntryEdit(root, x); };
}

function entryEditHtml(x) {
  return '<div class="entry-edit">' +
    (state.tableAvailability.books === true ? '<div class="add-fld"><label class="add-lbl">Person-Zuordnung</label><select name="person_id" class="ai ai-sel">' + personOptions(x.person_id) + '</select></div>' : '') +
    '<div class="form-grid three">' +
      '<div class="add-fld"><label class="add-lbl">Kategorie</label><select name="kategorie" class="ai ai-sel">' + opts(['Anekdote','Zitat','Fakt','Stil'], x.kategorie || 'Anekdote') + '</select></div>' +
      '<div class="add-fld"><label class="add-lbl">Buch</label><select name="buch" class="ai ai-sel">' + opts(['hintergrund','direkt'], x.buch || 'hintergrund') + '</select></div>' +
      '<div class="add-fld"><label class="add-lbl">Stärke</label><select name="staerke" class="ai ai-sel">' + opts(['','1','2','3','4','5'], String(x.staerke || '')) + '</select></div>' +
    '</div>' +
    '<div class="add-fld"><label class="add-lbl">Text</label><textarea name="text" class="ai ai-ta" rows="4">' + esc(entryText(x)) + '</textarea></div>' +
    '<div class="form-grid">' +
      '<div class="add-fld"><label class="add-lbl">Quelle</label><input name="quelle" class="ai" value="' + esc(x.quelle || '') + '"></div>' +
      '<div class="add-fld"><label class="add-lbl">Quelle URL</label><input name="quelle_url" class="ai" value="' + esc(x.quelle_url || '') + '"></div>' +
      '<div class="add-fld"><label class="add-lbl">Quellenqualität</label><select name="quellenqualitaet" class="ai ai-sel">' + opts(QUELLENQUALITAET, x.quellenqualitaet || 'unbekannt') + '</select></div>' +
      '<div class="add-fld"><label class="add-lbl">Buchreife</label><select name="buchreife" class="ai ai-sel">' + opts(BUCHREIFE, x.buchreife || 'roh') + '</select></div>' +
      '<div class="add-fld"><label class="add-lbl">Seitenrolle</label><select name="seitenrolle" class="ai ai-sel">' + opts(SEITENROLLE, x.seitenrolle || 'unentschieden') + '</select></div>' +
      '<div class="add-fld"><label class="add-lbl">Ton</label><input name="ton" class="ai" value="' + esc(x.ton || '') + '"></div>' +
    '</div>' +
    '<div class="add-fld"><label class="add-lbl">Themen</label>' + checkGroup('entry-themen', THEMA_LIST, arr(x.themen)) + '</div>' +
    '<div class="add-fld"><label class="add-lbl">Tags</label><input name="tags" class="ai" value="' + esc(arr(x.tags).join(', ')) + '"></div>' +
    '<div class="add-fld"><label class="add-lbl">Buchnotiz</label><textarea name="buchnotiz" class="ai ai-ta" rows="3">' + esc(x.buchnotiz || '') + '</textarea></div>' +
    '<div class="entry-edit-actions">' +
      '<button class="mini-btn primary entry-save">Speichern</button>' +
      '<button class="mini-btn entry-cancel">Abbrechen</button>' +
      '<span class="save-msg"></span>' +
    '</div>' +
  '</div>';
}

function saveEntryEdit(root, x) {
  var btn = root.querySelector('.entry-save');
  btn.disabled = true; btn.textContent = 'Speichert…';
  var data = {
    person: x.person,
    person_id: x.person_id || null,
    kategorie: root.querySelector('[name="kategorie"]').value,
    buch: root.querySelector('[name="buch"]').value,
    text: root.querySelector('[name="text"]').value,
    quelle: root.querySelector('[name="quelle"]').value,
    quelle_url: root.querySelector('[name="quelle_url"]').value,
    tags: splitList(root.querySelector('[name="tags"]').value),
    staerke: root.querySelector('[name="staerke"]').value,
    quellenqualitaet: root.querySelector('[name="quellenqualitaet"]').value,
    buchreife: root.querySelector('[name="buchreife"]').value,
    themen: getCheckedIn(root, 'entry-themen'),
    ton: root.querySelector('[name="ton"]').value,
    seitenrolle: root.querySelector('[name="seitenrolle"]').value,
    buchnotiz: root.querySelector('[name="buchnotiz"]').value
  };
  var personSelect = root.querySelector('[name="person_id"]');
  if (personSelect) {
    data.person_id = personSelect.value || null;
    var mappedPerson = personById(data.person_id);
    if (mappedPerson) data.person = mappedPerson.name;
  }
  var payload = entryPayload(data);
  patchSupa('entries', x, payload).then(function(saved) {
    Object.assign(x, saved || payload);
    render();
  }).catch(function(err) {
    btn.disabled = false; btn.textContent = 'Speichern';
    root.querySelector('.save-msg').textContent = 'Fehler: ' + err.message;
  });
}
