import { dossierModel, entryUnchecked, formatBio, nextActionForPerson, personEntries, personPayload, profileTagThemes } from '../data/models.js';
import { openResearchJob } from './dashboard.js';
import { state } from '../state/store.js';
import { goTab, render, setProfileTab, updateStats } from '../state/router.js';
import { arr, checkGroup, curationItem, esc, getChecked, label, normalizeUrl, opts, splitList, val } from '../utils.js';
import { FORMAT_EIGNUNG, KAT_ICON, KAT_ORDER, PROFILE_TABS, SB } from '../config.js';
import { renderFitPanel } from './pilot.js';
import { enhanceFilterBar, renderEnhancePanel } from './enhance.js';
import { mkEntryCard } from '../components/entry-card.js';
import { openPageEditor } from './pages.js';
import { insertSupa, matchQuery, parseSupaErr, patchSupa, supaHeaders, uploadPersonImage } from '../data/supabase.js';

function profileMainAction(p) {
  var a = nextActionForPerson(p);
  if (a.key === 'review' && a.jobId) return { label: a.label, run: function() { openResearchJob(a.jobId); } };
  if (a.key === 'research') return { label: 'Recherche starten', run: function() { state.profileTab = 'material'; render(); moreResearch(); } };
  if (a.key === 'dossier') return { label: 'Material ergänzen', run: function() { state.profileTab = 'material'; render(); } };
  if (a.key === 'fit') return { label: 'Fit bewerten', run: function() { state.fitPanelExpanded = true; render(); } };
  if (a.key === 'decide') return { label: 'Auswahl entscheiden', run: function() { goTab('pilot'); } };
  if (a.key === 'page') return { label: 'Seite gestalten', run: function() { openPageWorkshopForPerson(p); } };
  if (a.key === 'pilot') return { label: 'Details ausarbeiten', run: function() { state.profileTab = 'details'; render(); } };
  return null;
}

export function rProfile(main) {
  var p = state.profilePerson;
  if (!p) { main.innerHTML = ''; return; }
  if (state.profileEdit) { rProfileEdit(main, p); return; }

  var pEntries = personEntries(p);
  var sbClass = p.status === 'bereit' ? 'sb-bereit' : p.status === 'aktiv' ? 'sb-aktiv' : 'sb-kandidat';
  var sbLabel = p.status === 'bereit' ? 'Bereit' : p.status === 'aktiv' ? 'Aktiv' : 'Kandidat';
  var tags = (p.tags || []).map(function(t) { return '<span class="profile-tag">' + esc(t) + '</span>'; }).join('');

  main.innerHTML = '';

  var hd = document.createElement('div'); hd.className = 'profile-hd';
  hd.innerHTML =
    '<div class="profile-hd-top">' +
      (p.image_url ? '<img class="profile-portrait" src="' + esc(p.image_url) + '" alt="" onerror="this.remove()">' : '') +
      '<div>' +
        '<div class="profile-name">' + esc(p.name) + '</div>' +
        (p.dates ? '<div class="profile-dates-line">' + esc(p.dates) + '</div>' : '') +
        '<div class="profile-meta">' +
          (p.kategorie ? '<span class="profile-role">' + esc(p.kategorie) + '</span>' : '') +
          (p.kategorie ? '<span style="color:var(--br2)">·</span>' : '') +
          '<span class="status-badge ' + sbClass + '">' + sbLabel + '</span>' +
        '</div>' +
      '</div>' +
    '</div>' +
    (tags ? '<hr class="profile-divider"><div class="profile-tags">' + tags + '</div>' : '');
  main.appendChild(hd);

  var nav = document.createElement('div'); nav.className = 'profile-subnav';
  nav.innerHTML = PROFILE_TABS.map(function(t) {
    return '<button class="profile-subnav-btn' + (state.profileTab === t[0] ? ' on' : '') + '" data-profile-tab="' + t[0] + '">' + esc(t[1]) + '</button>';
  }).join('');
  nav.querySelectorAll('[data-profile-tab]').forEach(function(btn) {
    btn.onclick = function() { setProfileTab(btn.getAttribute('data-profile-tab')); };
  });
  main.appendChild(nav);

  if (state.profileTab === 'material') renderProfileMaterial(main, p, pEntries);
  else if (state.profileTab === 'gallery') renderProfileGallery(main, p);
  else if (state.profileTab === 'details') renderProfileDetails(main, p);
  else renderProfileOverview(main, p, pEntries);
}

function renderProfileOverview(main, p, pEntries) {
  var d = dossierModel(p);
  var dossierCard = document.createElement('div'); dossierCard.className = 'dash-card';
  var action = profileMainAction(p);
  dossierCard.innerHTML =
    '<div class="dash-card-hd"><div><div class="dash-card-title">Dossierstand</div><div class="dash-card-note">' + d.count + '/8 Pflichtpunkte erfüllt.</div></div>' +
    (action ? '<button class="mini-btn primary" id="profile-main-action">' + esc(action.label) + '</button>' : '') +
    '</div>' +
    '<div class="dossier-row">' + d.checks.map(function(x) { return '<span class="dossier-check ' + (x[1] ? '' : 'miss') + '">' + (x[1] ? '✓ ' : '○ ') + esc(x[0]) + '</span>'; }).join('') + '</div>';
  main.appendChild(dossierCard);
  var actionBtn = dossierCard.querySelector('#profile-main-action');
  if (actionBtn && action) actionBtn.onclick = action.run;

  main.appendChild(renderFitPanel(p));

  var cur = document.createElement('div'); cur.className = 'profile-curation';
  cur.innerHTML =
    '<div class="profile-bio-lbl">Kuration</div>' +
    '<div class="curation-grid">' +
      curationItem('Lebensprinzip', p.lebensprinzip, true, true) +
      curationItem('Buchthese', p.buchthese, true) +
      curationItem('Spannung', p.spannung, false) +
    '</div>';
  main.appendChild(cur);
}

function renderProfileMaterial(main, p, pEntries) {
  var byKat = {};
  pEntries.forEach(function(x) {
    var k = x.kategorie || 'Sonstige';
    if (!byKat[k]) byKat[k] = [];
    byKat[k].push(x);
  });
  var openSources = pEntries.filter(entryUnchecked).length;

  var actionsRow = document.createElement('div'); actionsRow.className = 'dash-card';
  actionsRow.innerHTML =
    '<div class="dash-card-hd"><div><div class="dash-card-title">Material</div><div class="dash-card-note">' +
      pEntries.length + ' Eintr' + (pEntries.length === 1 ? 'ag' : 'äge') +
      (openSources ? ' · ' + openSources + ' Quelle' + (openSources === 1 ? '' : 'n') + ' ungeprüft' : ' · alle Quellen geprüft') +
      '</div></div>' +
      '<div class="actions"><button class="mini-btn primary" onclick="moreResearch()">Recherche ergänzen</button></div>' +
    '</div>' +
    enhanceFilterBar(p, pEntries);
  main.appendChild(actionsRow);

  if (state.enhanceState.personName === p.name && state.enhanceState.phase !== 'idle') {
    main.appendChild(renderEnhancePanel(p));
  }

  if (pEntries.length === 0) {
    var none = document.createElement('div'); none.className = 'no-entries';
    none.textContent = '— Einträge werden hier erscheinen sobald sie hinzugefügt werden —';
    main.appendChild(none);
    return;
  }

  var katFilter = document.createElement('div'); katFilter.className = 'chip-row'; katFilter.style.margin = '14px 0';
  katFilter.innerHTML = ['Alle'].concat(KAT_ORDER).map(function(k) {
    var active = (k === 'Alle' && !state.profileEntryFilter) || state.profileEntryFilter === k;
    return '<button class="chip' + (active ? ' on' : '') + '" data-kat-filter="' + esc(k) + '">' + esc(k) + '</button>';
  }).join('');
  katFilter.querySelectorAll('[data-kat-filter]').forEach(function(btn) {
    btn.onclick = function() { state.profileEntryFilter = btn.getAttribute('data-kat-filter') === 'Alle' ? null : btn.getAttribute('data-kat-filter'); render(); };
  });
  main.appendChild(katFilter);

  var orderedKats = KAT_ORDER.filter(function(k) { return byKat[k]; })
    .concat(Object.keys(byKat).filter(function(k) { return KAT_ORDER.indexOf(k) < 0; }))
    .filter(function(k) { return !state.profileEntryFilter || k === state.profileEntryFilter; });

  if (!orderedKats.length) {
    var noneKat = document.createElement('div'); noneKat.className = 'no-entries';
    noneKat.textContent = '— Keine Einträge in dieser Kategorie —';
    main.appendChild(noneKat);
    return;
  }

  orderedKats.forEach(function(kat) {
    var list = byKat[kat];
    var sec = document.createElement('div'); sec.className = 'prof-section';
    sec.innerHTML =
      '<div class="prof-sec-hd">' +
        '<span class="prof-sec-ic">' + (KAT_ICON[kat] || '·') + '</span>' +
        '<span class="prof-sec-name">' + esc(kat) + '</span>' +
        '<span class="prof-sec-cnt">' + list.length + ' Eintr' + (list.length === 1 ? 'ag' : 'äge') + '</span>' +
      '</div>';
    list.forEach(function(x) { sec.appendChild(mkEntryCard(x, false)); });
    main.appendChild(sec);
  });
}

function renderProfileGallery(main, p) {
  var gallery = document.createElement('div'); gallery.className = 'profile-bio';
  gallery.innerHTML = galleryHtml(p);
  main.appendChild(gallery);

  var pages = state.bookPages.filter(function(pg) { return String(pg.person_id) === String(p.id); });
  var pagesCard = document.createElement('div'); pagesCard.className = 'dash-card';
  pagesCard.innerHTML =
    '<div class="dash-card-hd"><div><div class="dash-card-title">Buchseiten</div><div class="dash-card-note">' + pages.length + ' Seite' + (pages.length === 1 ? '' : 'n') + ' für diese Person.</div></div>' +
    '<button class="mini-btn primary" id="profile-new-page">Neue Seite gestalten</button></div>' +
    (pages.length ? '<div class="queue-list">' + pages.map(function(pg) {
      return '<div class="queue-row"><div class="queue-name" data-open-page="' + esc(pg.id) + '">' + esc(pg.title || 'Ohne Titel') + '</div><div class="actions"><button class="mini-btn" data-open-page="' + esc(pg.id) + '">Öffnen</button></div></div>';
    }).join('') + '</div>' : '<div class="readonly-note">Noch keine Seite für diese Person.</div>');
  main.appendChild(pagesCard);
  pagesCard.querySelector('#profile-new-page').onclick = function() { openPageWorkshopForPerson(p); };
  pagesCard.querySelectorAll('[data-open-page]').forEach(function(el) {
    el.onclick = function() { openPageEditor(el.getAttribute('data-open-page')); goTab('layout'); };
  });
}

function renderProfileDetails(main, p) {
  if (p.note) {
    var bio = document.createElement('div'); bio.className = 'profile-bio';
    bio.innerHTML =
      '<div class="profile-bio-lbl">Biographie</div>' +
      '<div class="profile-bio-text">' + formatBio(p.note) + '</div>';
    main.appendChild(bio);
  }

  var cur = document.createElement('div'); cur.className = 'profile-curation';
  cur.innerHTML =
    '<div class="profile-bio-lbl">Details</div>' +
    '<div class="curation-grid">' +
      curationItem('Archetyp', p.archetyp, false) +
      curationItem('Visuelles Motiv', p.visuelles_motiv, false) +
      curationItem('Format-Eignung', arr(p.format_eignung).map(label).join(', '), false) +
      curationItem('Motive aus Tags', profileTagThemes(p).map(label).join(', '), false) +
      curationItem('Notiz', p.kurationsnotiz, false, false, true) +
    '</div>' +
    '<div class="actions" style="margin-top:14px"><button class="mini-btn primary" onclick="editProfile()">Profil bearbeiten</button></div>';
  main.appendChild(cur);
}

function rProfileEdit(main, p) {
  main.innerHTML = '';
  var box = document.createElement('div'); box.className = 'profile-edit';
  box.innerHTML =
    '<div class="profile-bio-lbl">Profil bearbeiten</div>' +
    '<div class="form-grid">' +
      '<div class="add-fld"><label class="add-lbl">Name</label><input id="edit-p-name" class="ai" value="' + esc(p.name || '') + '" readonly><div class="readonly-note">Namen werden in V1 nicht umbenannt.</div></div>' +
      '<div class="add-fld"><label class="add-lbl">Status</label><select id="edit-p-status" class="ai ai-sel">' + opts(['kandidat','aktiv','bereit'], p.status || 'kandidat') + '</select></div>' +
      '<div class="add-fld"><label class="add-lbl">Kategorie</label><input id="edit-p-kat" class="ai" value="' + esc(p.kategorie || '') + '"></div>' +
      '<div class="add-fld"><label class="add-lbl">Daten</label><input id="edit-p-dates" class="ai" value="' + esc(p.dates || '') + '"></div>' +
    '</div>' +
    '<div class="add-fld"><label class="add-lbl">Tags</label><input id="edit-p-tags" class="ai" value="' + esc(arr(p.tags).join(', ')) + '"></div>' +
    '<div class="add-fld"><label class="add-lbl">Biografie</label><textarea id="edit-p-note" class="ai ai-ta" rows="5">' + esc(p.note || '') + '</textarea></div>' +
    '<div class="form-grid">' +
      '<div class="add-fld"><label class="add-lbl">Lebensprinzip</label><textarea id="edit-p-principle" class="ai ai-ta" rows="3">' + esc(p.lebensprinzip || '') + '</textarea></div>' +
      '<div class="add-fld"><label class="add-lbl">Buchthese</label><textarea id="edit-p-thesis" class="ai ai-ta" rows="3">' + esc(p.buchthese || '') + '</textarea></div>' +
      '<div class="add-fld"><label class="add-lbl">Archetyp</label><input id="edit-p-arch" class="ai" value="' + esc(p.archetyp || '') + '"></div>' +
      '<div class="add-fld"><label class="add-lbl">Visuelles Motiv</label><input id="edit-p-visual" class="ai" value="' + esc(p.visuelles_motiv || '') + '"></div>' +
    '</div>' +
    '<div class="add-fld"><label class="add-lbl">Spannung / Widerspruch</label><textarea id="edit-p-tension" class="ai ai-ta" rows="3">' + esc(p.spannung || '') + '</textarea></div>' +
    '<div class="add-fld"><label class="add-lbl">Format-Eignung</label>' + checkGroup('edit-p-format', FORMAT_EIGNUNG, arr(p.format_eignung)) + '</div>' +
    '<div class="add-fld"><label class="add-lbl">Kurationsnotiz</label><textarea id="edit-p-cur-note" class="ai ai-ta" rows="3">' + esc(p.kurationsnotiz || '') + '</textarea></div>' +
    '<div class="add-footer">' +
      '<button id="edit-p-save" class="add-btn" onclick="saveProfileEdit()">Speichern</button>' +
      '<button class="add-btn-sec" onclick="cancelProfileEdit()">Abbrechen</button>' +
    '</div>';
  main.appendChild(box);
}

export function imagesForPerson(p) {
  return state.personImages.filter(function(img) { return String(img.person_id) === String(p.id); })
    .sort(function(a, b) { return new Date(a.created_at || 0) - new Date(b.created_at || 0); });
}

function coverImageUrl(p) {
  var imgs = imagesForPerson(p);
  var cover = imgs.find(function(i) { return i.is_cover; });
  return (cover || imgs[0] || {}).url || p.image_url || '';
}

function galleryHtml(p) {
  var imgs = imagesForPerson(p);
  var grid = imgs.map(function(img) {
    return '<div class="gallery-item' + (img.is_cover ? ' is-cover' : '') + '" data-image-id="' + esc(img.id) + '">' +
      '<img src="' + esc(img.url) + '" alt="" onerror="this.style.opacity=\'.25\'">' +
      '<div class="gallery-item-actions">' +
        (img.is_cover ? '<span class="gallery-cover-badge">Titelbild</span>' : '<button class="gallery-btn" onclick="setCoverImage(\'' + esc(img.id) + '\')">Als Titelbild</button>') +
        '<button class="gallery-btn gallery-btn-rm" onclick="removePersonImage(\'' + esc(img.id) + '\')" title="Entfernen" aria-label="Entfernen">✕</button>' +
      '</div>' +
    '</div>';
  }).join('');
  return '<div class="profile-gallery">' +
    '<div class="profile-bio-lbl">Bilder' + (imgs.length ? ' (' + imgs.length + ')' : '') + '</div>' +
    (grid ? '<div class="gallery-grid">' + grid + '</div>' : '<div class="readonly-note">Noch keine Bilder — per Datei oder Link hinzufügen.</div>') +
    '<div class="gallery-add-row">' +
      '<input id="gallery-add-url" class="ai" placeholder="https://… Bild-URL einfügen und Enter drücken" onkeydown="if(event.key===\'Enter\'){event.preventDefault();addPersonImageFromUrl()}">' +
      '<button class="mini-btn" onclick="addPersonImageFromUrl()">Hinzufügen</button>' +
      '<label class="mini-btn" style="cursor:pointer">Datei hochladen<input type="file" accept="image/*" style="display:none" onchange="addPersonImageFromFile(this)"></label>' +
      '<span class="save-msg" id="gallery-msg"></span>' +
    '</div>' +
  '</div>';
}

function syncCoverCache(p, url) {
  return patchSupa('persons', p, { image_url: url || null }).then(function(saved) {
    Object.assign(p, saved || { image_url: url || null });
  });
}

function addPersonImageRecord(p, url, makeItCover) {
  return insertSupa('person_images', { person_id: p.id, url: url, is_cover: !!makeItCover }).then(function(saved) {
    state.personImages.push(saved);
    if (makeItCover) return syncCoverCache(p, url);
  });
}

export function addPersonImageFromUrl() {
  var p = state.profilePerson; if (!p) return;
  var input = document.getElementById('gallery-add-url');
  var url = normalizeUrl(input ? input.value : '');
  var msg = document.getElementById('gallery-msg');
  if (!url) { if (msg) msg.textContent = 'Keine gültige URL.'; return; }
  var isFirst = imagesForPerson(p).length === 0;
  addPersonImageRecord(p, url, isFirst).then(function() {
    if (input) input.value = '';
    render();
  }).catch(function(err) {
    if (msg) msg.textContent = 'Fehler: ' + err.message;
  });
}

export function addPersonImageFromFile(inputEl) {
  var p = state.profilePerson; if (!p) return;
  var file = inputEl.files && inputEl.files[0];
  if (!file) return;
  var msg = document.getElementById('gallery-msg');
  if (msg) msg.textContent = 'Lädt hoch…';
  var isFirst = imagesForPerson(p).length === 0;
  uploadPersonImage(file).then(function(url) {
    return addPersonImageRecord(p, url, isFirst);
  }).then(function() {
    render();
  }).catch(function(err) {
    if (msg) msg.textContent = 'Fehler: ' + err.message;
  });
}

export function setCoverImage(imageId) {
  var p = state.profilePerson; if (!p) return;
  var imgs = imagesForPerson(p);
  var target = imgs.find(function(i) { return String(i.id) === String(imageId); });
  if (!target) return;
  Promise.all(imgs.filter(function(i) { return i.is_cover && i.id !== target.id; })
    .map(function(i) { return patchSupa('person_images', i, { is_cover: false }).then(function(saved) { Object.assign(i, saved || { is_cover: false }); }); }))
    .then(function() { return patchSupa('person_images', target, { is_cover: true }); })
    .then(function(saved) { Object.assign(target, saved || { is_cover: true }); return syncCoverCache(p, target.url); })
    .then(render)
    .catch(function(err) { alert('Titelbild konnte nicht gesetzt werden: ' + err.message); });
}

export function removePersonImage(imageId) {
  var p = state.profilePerson; if (!p) return;
  var imgs = imagesForPerson(p);
  var target = imgs.find(function(i) { return String(i.id) === String(imageId); });
  if (!target) return;
  fetch(SB + '/rest/v1/person_images?' + matchQuery('person_images', target), {
    method: 'DELETE', headers: supaHeaders('return=minimal')
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error(parseSupaErr(t)); });
    state.personImages = state.personImages.filter(function(i) { return i.id !== target.id; });
    if (target.is_cover) {
      var remaining = imagesForPerson(p);
      var next = remaining[0];
      if (next) return setCoverImage(next.id);
      return syncCoverCache(p, '').then(render);
    }
    render();
  }).catch(function(err) { alert('Bild konnte nicht entfernt werden: ' + err.message); });
}

export function editProfile() { state.profileEdit = true; render(); }

export function cancelProfileEdit() { state.profileEdit = false; render(); }

export function moreResearch() {
  var p = state.profilePerson;
  if (!p) return;
  state.addState = { phase: 'input', person: null, entries: [], prefill: p.name, job: null, usage: null, mode: 'capture' };
  goTab('add');
}

export function saveProfileEdit() {
  var p = state.profilePerson;
  if (!p) return;
  var btn = document.getElementById('edit-p-save');
  btn.disabled = true; btn.textContent = 'Speichert…';
  var data = {
    name: p.name,
    kategorie: val('edit-p-kat'),
    dates: val('edit-p-dates'),
    status: val('edit-p-status') || 'kandidat',
    tags: splitList(val('edit-p-tags')),
    note: val('edit-p-note'),
    lebensprinzip: val('edit-p-principle'),
    buchthese: val('edit-p-thesis'),
    archetyp: val('edit-p-arch'),
    spannung: val('edit-p-tension'),
    visuelles_motiv: val('edit-p-visual'),
    format_eignung: getChecked('edit-p-format'),
    kurationsnotiz: val('edit-p-cur-note'),
    image_url: p.image_url || '' // managed by the gallery, not this form
  };
  patchSupa('persons', p, personPayload(data, false)).then(function(saved) {
    Object.assign(p, saved || data);
    state.profilePerson = p;
    state.profileEdit = false;
    updateStats();
    render();
  }).catch(function(err) {
    btn.disabled = false; btn.textContent = 'Speichern';
    alert('Fehler beim Speichern: ' + err.message);
  });
}

export function openPageWorkshopForPerson(p) {
  state.layoutPresetPersonId = p.id;
  goTab('layout');
}
