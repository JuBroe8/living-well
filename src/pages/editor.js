import { state } from '../state/store.js';
import { patchSupa } from '../data/supabase.js';
import { entryText, entryUnchecked, materialSortForBlock, pagesForBook, personById, personEntries } from '../data/models.js';
import { esc, normalizeUrl, opts } from '../utils.js';
import { BLOCK_TYPE_LABELS, PAGE_H, PAGE_W } from '../config.js';
import { blockContentHtml, newBlock } from './templates.js';
import { imagesForPerson } from '../views/profile.js';

function currentBlock(id) {
  var pg = state.layoutState.page;
  return pg && (pg.blocks || []).find(function(b) { return b.id === id; });
}

export function resetPageSaveQueue() {
  if (state.pageSaveTimer) clearTimeout(state.pageSaveTimer);
  state.pageSaveTimer = null; state.pageSaveInFlight = false; state.pageSavePending = false;
}

export function savePageBlocks() {
  setLayoutSaveStatus('saving');
  if (state.pageSaveTimer) clearTimeout(state.pageSaveTimer);
  state.pageSaveTimer = setTimeout(flushPageSave, 400);
}

function flushPageSave() {
  state.pageSaveTimer = null;
  if (state.pageSaveInFlight) { state.pageSavePending = true; return; }
  var pg = state.layoutState.page; if (!pg) return;
  state.pageSaveInFlight = true;
  patchSupa('book_pages', pg, { blocks: pg.blocks }).then(function(saved) {
    Object.assign(pg, saved || {});
    var idx = state.bookPages.findIndex(function(x) { return x.id === pg.id; });
    if (idx >= 0) state.bookPages[idx] = pg;
    state.pageSaveInFlight = false;
    if (state.pageSavePending) { state.pageSavePending = false; flushPageSave(); }
    else setLayoutSaveStatus('saved');
  }).catch(function(err) {
    state.pageSaveInFlight = false;
    setLayoutSaveStatus('error');
    console.warn('Seite konnte nicht gespeichert werden:', err.message);
    if (state.pageSavePending) { state.pageSavePending = false; flushPageSave(); }
  });
}

export function setLayoutSaveStatus(status) {
  state.layoutState.saveStatus = status;
  var el = document.getElementById('layout-save-state');
  if (!el) return;
  el.className = 'layout-save-state ' + status;
  el.textContent = status === 'saving' ? 'Speichert…' : (status === 'error' ? 'Nicht gespeichert' : 'Gespeichert');
}

export function renderPageEditorView(main) {
  var pg = state.layoutState.page;
  var pages = pagesForBook();
  var pageIndex = pages.findIndex(function(x) { return String(x.id) === String(pg.id); });
  var hasPrev = pageIndex > 0, hasNext = pageIndex > -1 && pageIndex < pages.length - 1;
  var rail = '<aside class="layout-page-rail"><div class="layout-rail-title">Buchseiten</div><div class="layout-rail-list">' +
    pages.map(function(item, index) {
      return '<button class="layout-rail-item' + (String(item.id) === String(pg.id) ? ' on' : '') + '" onclick="openPageEditor(\'' + esc(item.id) + '\')" title="' + esc(item.title || 'Ohne Titel') + '">' +
        '<span class="layout-rail-num">' + (index + 1) + '</span><span class="layout-rail-name">' + esc(item.title || 'Ohne Titel') + '</span></button>';
    }).join('') + '</div></aside>';
  var wrap = document.createElement('div');
  wrap.innerHTML =
    '<div class="layout-toolbar">' +
      '<div class="layout-toolbar-main">' +
        '<button class="mini-btn" onclick="backToPageList()" title="Zur Seitenübersicht">← Übersicht</button>' +
        '<button class="mini-btn" onclick="openAdjacentPage(-1)"' + (hasPrev ? '' : ' disabled') + ' aria-label="Vorherige Seite">‹</button>' +
        '<button class="mini-btn" onclick="openAdjacentPage(1)"' + (hasNext ? '' : ' disabled') + ' aria-label="Nächste Seite">›</button>' +
        '<input id="layout-page-title" class="ai layout-title-input" aria-label="Seitentitel" value="' + esc(pg.title || '') + '" onchange="renamePage(this.value)">' +
        '<span id="layout-save-state" class="layout-save-state ' + state.layoutState.saveStatus + '">' + (state.layoutState.saveStatus === 'saving' ? 'Speichert…' : (state.layoutState.saveStatus === 'error' ? 'Nicht gespeichert' : 'Gespeichert')) + '</span>' +
      '</div>' +
      '<div class="layout-toolbar-tools">' +
        '<button class="mini-btn" onclick="addBlock(\'heading\')">+ Überschrift</button>' +
        '<button class="mini-btn" onclick="addBlock(\'text\')">+ Text</button>' +
        '<button class="mini-btn" onclick="addBlock(\'quote\')">+ Zitat</button>' +
        '<button class="mini-btn" onclick="addBlock(\'image\')">+ Bild</button>' +
        '<button class="mini-btn" onclick="undoLastBlockChange()"' + (state.blockUndoSnapshot ? '' : ' disabled') + '>Rückgängig</button>' +
      '</div>' +
    '</div>' +
    '<div class="layout-editor-wrap">' +
      rail +
      '<div class="page-stage"><div class="page-canvas-scroll"><div class="page-canvas-shell"><div class="page-canvas" id="page-canvas" data-page="' + (pageIndex + 1) + '" style="width:' + PAGE_W + 'px;height:' + PAGE_H + 'px"></div></div></div></div>' +
      '<div class="layout-props" id="layout-props"></div>' +
    '</div>';
  main.innerHTML = '';
  main.appendChild(wrap);

  var canvas = document.getElementById('page-canvas');
  canvas.onpointerdown = function(e) { if (e.target === canvas) deselectBlock(); };
  (pg.blocks || []).forEach(function(block) { canvas.appendChild(mkBlockEl(block)); });
  renderPropsPanel();
}

function mkBlockEl(block) {
  var el = document.createElement('div');
  el.className = 'page-block' + (state.layoutState.selectedBlockId === block.id ? ' selected' : '');
  el.id = 'block-' + block.id;
  el.dataset.label = BLOCK_TYPE_LABELS[block.type] || block.type;
  el.style.left = block.x + 'px'; el.style.top = block.y + 'px';
  el.style.width = block.w + 'px'; el.style.height = block.h + 'px';
  el.style.zIndex = block.z || 1;
  el.style.touchAction = 'none';
  el.innerHTML = blockContentHtml(block);
  var handle = document.createElement('div');
  handle.className = 'block-resize';
  handle.onpointerdown = function(e) { startResizeBlock(e, block.id); };
  el.appendChild(handle);
  el.onpointerdown = function(e) {
    if (e.target === handle) return;
    selectBlock(block.id);
    startDragBlock(e, block.id);
  };
  return el;
}

export function snapshotBlocksForUndo() {
  var pg = state.layoutState.page; if (!pg) return;
  state.blockUndoSnapshot = JSON.parse(JSON.stringify(pg.blocks || []));
}

export function undoLastBlockChange() {
  var pg = state.layoutState.page; if (!pg || !state.blockUndoSnapshot) return;
  pg.blocks = state.blockUndoSnapshot;
  state.blockUndoSnapshot = null;
  state.layoutState.selectedBlockId = null;
  renderPageEditorView(document.getElementById('main'));
  savePageBlocks();
}

function deselectBlock() {
  state.layoutState.selectedBlockId = null;
  document.querySelectorAll('.page-block.selected').forEach(function(el) { el.classList.remove('selected'); });
  renderPropsPanel();
}

function selectBlock(id) {
  state.layoutState.selectedBlockId = id;
  document.querySelectorAll('.page-block').forEach(function(el) { el.classList.toggle('selected', el.id === 'block-' + id); });
  renderPropsPanel();
}

function startDragBlock(e, id) {
  e.preventDefault();
  var block = currentBlock(id); if (!block) return;
  snapshotBlocksForUndo();
  var startX = e.clientX, startY = e.clientY, origX = block.x, origY = block.y, moved = false;
  var el = document.getElementById('block-' + id);
  function onMove(ev) {
    moved = true;
    block.x = Math.round(Math.max(0, Math.min(PAGE_W - block.w, origX + (ev.clientX - startX))) / 4) * 4;
    block.y = Math.round(Math.max(0, Math.min(PAGE_H - block.h, origY + (ev.clientY - startY))) / 4) * 4;
    el.style.left = block.x + 'px'; el.style.top = block.y + 'px';
  }
  function onUp() {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    if (moved) savePageBlocks();
  }
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

function startResizeBlock(e, id) {
  e.preventDefault(); e.stopPropagation();
  var block = currentBlock(id); if (!block) return;
  selectBlock(id);
  snapshotBlocksForUndo();
  var startX = e.clientX, startY = e.clientY, origW = block.w, origH = block.h;
  var el = document.getElementById('block-' + id);
  function onMove(ev) {
    block.w = Math.round(Math.max(40, Math.min(PAGE_W - block.x, origW + (ev.clientX - startX))) / 4) * 4;
    block.h = Math.round(Math.max(24, Math.min(PAGE_H - block.y, origH + (ev.clientY - startY))) / 4) * 4;
    el.style.width = block.w + 'px'; el.style.height = block.h + 'px';
  }
  function onUp() {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    savePageBlocks();
  }
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

export function addBlock(type) {
  var pg = state.layoutState.page; if (!pg) return;
  snapshotBlocksForUndo();
  pg.blocks = pg.blocks || [];
  var block = newBlock(type, pg.blocks.length);
  pg.blocks.push(block);
  state.layoutState.selectedBlockId = block.id;
  renderPageEditorView(document.getElementById('main'));
  savePageBlocks();
}

export function deleteBlock() {
  var pg = state.layoutState.page; if (!pg || !state.layoutState.selectedBlockId) return;
  snapshotBlocksForUndo();
  pg.blocks = (pg.blocks || []).filter(function(b) { return b.id !== state.layoutState.selectedBlockId; });
  state.layoutState.selectedBlockId = null;
  renderPageEditorView(document.getElementById('main'));
  savePageBlocks();
}

export function setBlockContent(value) {
  var block = currentBlock(state.layoutState.selectedBlockId); if (!block) return;
  snapshotBlocksForUndo();
  block.content = value; block.entryId = null;
  savePageBlocks();
}

export function pickEntryForBlock(entryId) {
  var block = currentBlock(state.layoutState.selectedBlockId); if (!block || !entryId) return;
  var x = state.entries.find(function(e) { return String(e.id) === String(entryId); }); if (!x) return;
  snapshotBlocksForUndo();
  block.content = entryText(x) || x.preview || '';
  block.entryId = entryId;
  renderPageEditorView(document.getElementById('main'));
  savePageBlocks();
}

export function setBlockImage(url) {
  var block = currentBlock(state.layoutState.selectedBlockId); if (!block) return;
  snapshotBlocksForUndo();
  block.content = normalizeUrl(url);
  renderPageEditorView(document.getElementById('main'));
  savePageBlocks();
}

export function setBlockStyle(key, value) {
  var block = currentBlock(state.layoutState.selectedBlockId); if (!block) return;
  snapshotBlocksForUndo();
  block.style = block.style || {};
  block.style[key] = value;
  renderPageEditorView(document.getElementById('main'));
  savePageBlocks();
}

function renderPropsPanel() {
  var panel = document.getElementById('layout-props'); if (!panel) return;
  var block = state.layoutState.selectedBlockId ? currentBlock(state.layoutState.selectedBlockId) : null;
  if (!block) {
    var pg = state.layoutState.page;
    var p = pg && pg.person_id ? personById(pg.person_id) : null;
    var blockCount = pg ? (pg.blocks || []).length : 0;
    panel.innerHTML =
      '<div class="layout-props-head"><div><div class="layout-props-kicker">Seite</div><div class="layout-props-title">' + esc(pg && pg.title || 'Ohne Titel') + '</div></div><span class="pill">' + blockCount + ' Element' + (blockCount === 1 ? '' : 'e') + '</span></div>' +
      '<div class="layout-empty-inspector"><strong>' + (blockCount ? 'Element auswählen' : 'Mit einer Vorlage starten') + '</strong>' +
        (blockCount ? 'Klicke auf Text, Bild oder Zitat auf der Seite, um Inhalt und Gestaltung zu bearbeiten.' : 'Eine Vorlage legt nur den ersten Rhythmus fest. Alle Elemente bleiben frei verschiebbar und editierbar.') +
        '<div class="readonly-note" style="margin-top:8px">' + (p ? 'Verknüpft mit ' + esc(p.name) : 'Noch keiner Person zugeordnet') + '</div>' +
      '</div>' +
      '<div class="layout-template-grid">' +
        '<button class="layout-template-btn" onclick="applyPageTemplate(\'editorial\')"><strong>Editoriales Porträt</strong><span>Bild, Einstieg, Haupttext und Zitat</span></button>' +
        '<button class="layout-template-btn" onclick="applyPageTemplate(\'quote\')"><strong>Zitatseite</strong><span>Großer Gedanke, viel Weißraum</span></button>' +
        '<button class="layout-template-btn" onclick="applyPageTemplate(\'essay\')"><strong>Ruhige Textseite</strong><span>Titel und langer Lesetext</span></button>' +
      '</div>' +
      '<div class="actions" style="margin-top:14px;padding-top:14px;border-top:1px solid var(--br)"><button class="mini-btn" onclick="duplicatePage(\'' + esc(pg.id) + '\')">Seite duplizieren</button></div>';
    return;
  }
  var st = block.style || {};
  var html = '<div class="layout-props-head"><div><div class="layout-props-kicker">Element</div><div class="layout-props-title">' + esc(BLOCK_TYPE_LABELS[block.type] || block.type) + '</div></div><span class="pill">Ausgewählt</span></div>';

  if (block.type === 'image') {
    var p = state.layoutState.page.person_id ? personById(state.layoutState.page.person_id) : null;
    var imgs = p ? imagesForPerson(p) : [];
    html += '<div class="add-fld"><label class="add-lbl">Aus Galerie wählen</label>' +
      (imgs.length ? '<div class="layout-image-pick">' + imgs.map(function(img) {
        return '<img src="' + esc(img.url) + '" class="layout-image-pick-item' + (img.url === block.content ? ' selected' : '') + '" onclick="setBlockImage(\'' + esc(img.url) + '\')" onerror="this.style.display=\'none\'">';
      }).join('') + '</div>' : '<div class="readonly-note">Keine Bilder im Profil dieser Person.</div>') +
    '</div>' +
    '<div class="add-fld"><label class="add-lbl">Oder URL</label><input class="ai" value="' + esc(block.content || '') + '" onchange="setBlockImage(this.value)"></div>';
  } else {
    html += '<div class="add-fld"><label class="add-lbl">Inhalt</label><textarea class="ai ai-ta" rows="4" onchange="setBlockContent(this.value)">' + esc(block.content || '') + '</textarea></div>';
    if (state.layoutState.page.person_id) {
      var pEntries = personEntries(personById(state.layoutState.page.person_id)).slice().sort(materialSortForBlock);
      html += '<div class="add-fld"><label class="add-lbl">Aus Eintrag übernehmen</label><select class="ai ai-sel" onchange="pickEntryForBlock(this.value)"><option value="">— frei —</option>' +
        pEntries.map(function(x) {
          var flag = entryUnchecked(x) ? ' · Quelle offen' : '';
          return '<option value="' + esc(x.id) + '"' + (block.entryId === x.id ? ' selected' : '') + '>' + esc((x.kategorie || '') + ': ' + (entryText(x) || x.preview || '').slice(0, 40) + flag) + '</option>';
        }).join('') + '</select></div>';
    }
    html += '<div class="form-grid">' +
      '<div class="add-fld"><label class="add-lbl">Schrift</label><select class="ai ai-sel" onchange="setBlockStyle(\'fontFamily\', this.value)">' + opts(['serif', 'sans'], st.fontFamily || 'sans') + '</select></div>' +
      '<div class="add-fld"><label class="add-lbl">Größe</label><input type="number" class="ai" value="' + (st.fontSize || 14) + '" min="8" max="72" onchange="setBlockStyle(\'fontSize\', Number(this.value))"></div>' +
      '<div class="add-fld"><label class="add-lbl">Ausrichtung</label><select class="ai ai-sel" onchange="setBlockStyle(\'align\', this.value)">' + opts(['left', 'center', 'right'], st.align || 'left') + '</select></div>' +
      '<div class="add-fld"><label class="add-lbl">Farbe</label><input type="color" class="ai" value="' + (st.color || '#141414') + '" onchange="setBlockStyle(\'color\', this.value)"></div>' +
    '</div>' +
    '<div class="actions">' +
      '<label class="checkchip"><input type="checkbox" ' + (st.fontStyle === 'italic' ? 'checked' : '') + ' onchange="setBlockStyle(\'fontStyle\', this.checked ? \'italic\' : \'normal\')"> Kursiv</label>' +
      '<label class="checkchip"><input type="checkbox" ' + (st.fontWeight === '700' ? 'checked' : '') + ' onchange="setBlockStyle(\'fontWeight\', this.checked ? \'700\' : \'400\')"> Fett</label>' +
    '</div>';
  }
  html += '<div class="actions" style="margin-top:14px;padding-top:14px;border-top:1px solid var(--br)"><button class="mini-btn danger" onclick="deleteBlock()">Element löschen</button></div>';
  panel.innerHTML = html;
}
