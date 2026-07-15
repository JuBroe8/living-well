import { state } from '../state/store.js';
import { renderPageEditorView, resetPageSaveQueue, setLayoutSaveStatus } from '../pages/editor.js';
import { activeBook, pagesForBook, personById } from '../data/models.js';
import { personOptionsGrouped } from './persons.js';
import { esc } from '../utils.js';
import { pageThumbHtml } from '../pages/templates.js';
import { insertSupa, matchQuery, parseSupaErr, patchSupa, supaHeaders } from '../data/supabase.js';
import { render } from '../state/router.js';
import { SB } from '../config.js';

export function rLayout(main) {
  main.innerHTML = '';
  if (state.tableAvailability.book_pages === false) {
    main.innerHTML = '<div class="empty"><div class="empty-ico">○</div>Layout-Editor ist vorbereitet. Bitte zuerst die neue Datenbankmigration anwenden.</div>';
    return;
  }
  if (state.layoutState.view === 'editor' && state.layoutState.page) { renderPageEditorView(main); return; }
  renderLayoutList(main);
}

function renderLayoutList(main) {
  var pages = pagesForBook();
  var elements = pages.reduce(function(total, pg) { return total + (pg.blocks || []).length; }, 0);
  var linked = pages.filter(function(pg) { return !!pg.person_id; }).length;
  var html = '<section class="layout-overview-head">' +
    '<div class="layout-overview-copy">' +
      '<div class="layout-overview-title">Seitenwerkstatt</div>' +
      '<div class="layout-overview-sub">Buchseiten entwickeln, Material aus den Dossiers einsetzen und Bild, Text und Rhythmus zu einer gemeinsamen Sprache bringen.</div>' +
    '</div>' +
    '<div class="layout-overview-actions">' +
      '<select id="layout-new-person" class="ai ai-sel" aria-label="Person für neue Seite">' + personOptionsGrouped(state.layoutPresetPersonId) + '</select>' +
      '<button class="mini-btn primary" onclick="createNewPage()">+ Neue Seite</button>' +
    '</div>' +
  '</section>' +
  '<div class="layout-summary">' +
    '<div class="layout-summary-item"><strong>' + pages.length + '</strong> Seiten</div>' +
    '<div class="layout-summary-item"><strong>' + elements + '</strong> Elemente</div>' +
    '<div class="layout-summary-item"><strong>' + linked + '</strong> Personen verknüpft</div>' +
  '</div>';

  if (!pages.length) {
    html += '<div class="empty"><div class="empty-ico">▤</div>Noch keine Seiten angelegt.<div class="readonly-note" style="margin-top:6px">Wähle oben optional eine Person und beginne mit einer leeren Seite.</div></div>';
  } else {
    html += '<div class="layout-page-grid">' + pages.map(function(pg, index) {
      var p = pg.person_id ? personById(pg.person_id) : null;
      var blockCount = (pg.blocks || []).length;
      return '<article class="layout-page-card">' +
        '<button class="layout-card-open" onclick="openPageEditor(\'' + esc(pg.id) + '\')" aria-label="Seite ' + (index + 1) + ': ' + esc(pg.title || 'Ohne Titel') + ' öffnen">' +
          '<div class="layout-page-thumb"><span class="layout-page-number">' + (index + 1) + '</span>' + pageThumbHtml(pg) + '</div>' +
          '<div class="layout-page-meta">' +
            '<div class="layout-page-title">' + esc(pg.title || 'Ohne Titel') + '</div>' +
            '<div class="readonly-note">' + (p ? esc(p.name) : 'Zuordnung offen') + ' · ' + blockCount + ' Element' + (blockCount === 1 ? '' : 'e') + '</div>' +
          '</div>' +
        '</button>' +
        '<div class="layout-card-foot"><span class="layout-card-hint">Seite bearbeiten</span><button class="mini-btn danger" onclick="deletePage(\'' + esc(pg.id) + '\')">Löschen</button></div>' +
      '</article>';
    }).join('') + '</div>';
  }
  main.innerHTML = html;
}

export function createNewPage() {
  var book = activeBook();
  var personSelect = document.getElementById('layout-new-person');
  var personId = personSelect ? personSelect.value : '';
  var p = personId ? personById(personId) : null;
  var order = pagesForBook().length;
  insertSupa('book_pages', {
    book_id: book ? book.id : null, person_id: personId || null,
    title: p ? p.name : 'Neue Seite', page_order: order, blocks: []
  }).then(function(saved) {
    state.bookPages.push(saved);
    state.layoutPresetPersonId = null;
    openPageEditor(saved.id);
  }).catch(function(err) { alert('Seite konnte nicht angelegt werden: ' + err.message); });
}

export function openPageEditor(id) {
  var pg = state.bookPages.find(function(x) { return String(x.id) === String(id); });
  if (!pg) return;
  pg.blocks = Array.isArray(pg.blocks) ? pg.blocks : [];
  resetPageSaveQueue();
  state.blockUndoSnapshot = null;
  state.layoutState.view = 'editor'; state.layoutState.page = pg; state.layoutState.selectedBlockId = null; state.layoutState.saveStatus = 'saved';
  window.scrollTo(0, 0);
  render();
}

export function backToPageList() {
  state.layoutState.view = 'list'; state.layoutState.page = null; state.layoutState.selectedBlockId = null;
  window.scrollTo(0, 0);
  render();
}

export function renamePage(title) {
  var pg = state.layoutState.page; if (!pg) return;
  pg.title = title;
  setLayoutSaveStatus('saving');
  patchSupa('book_pages', pg, { title: title }).then(function(saved) {
    Object.assign(pg, saved || {}); setLayoutSaveStatus('saved');
  }).catch(function(err) { setLayoutSaveStatus('error'); console.warn('Titel konnte nicht gespeichert werden:', err.message); });
}

export function duplicatePage(id) {
  var source = state.bookPages.find(function(x) { return String(x.id) === String(id); });
  if (!source) return;
  var copiedBlocks = JSON.parse(JSON.stringify(source.blocks || [])).map(function(block) {
    block.id = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    return block;
  });
  insertSupa('book_pages', {
    book_id: source.book_id || null, person_id: source.person_id || null,
    title: (source.title || 'Neue Seite') + ' – Kopie', page_order: pagesForBook().length, blocks: copiedBlocks
  }).then(function(saved) {
    state.bookPages.push(saved); openPageEditor(saved.id);
  }).catch(function(err) { alert('Seite konnte nicht dupliziert werden: ' + err.message); });
}

export function deletePage(id) {
  if (!confirm('Diese Seite wirklich löschen?')) return;
  var pg = state.bookPages.find(function(x) { return String(x.id) === String(id); });
  if (!pg) return;
  fetch(SB + '/rest/v1/book_pages?' + matchQuery('book_pages', pg), { method: 'DELETE', headers: supaHeaders('return=minimal') }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error(parseSupaErr(t)); });
    state.bookPages = state.bookPages.filter(function(x) { return x.id !== pg.id; });
    render();
  }).catch(function(err) { alert('Seite konnte nicht gelöscht werden: ' + err.message); });
}

export function openAdjacentPage(direction) {
  var pages = pagesForBook(), pg = state.layoutState.page;
  var index = pages.findIndex(function(x) { return pg && String(x.id) === String(pg.id); });
  var next = pages[index + direction];
  if (next) openPageEditor(next.id);
}
