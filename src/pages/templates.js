import { esc } from '../utils.js';
import { BLOCK_FONTS, PAGE_H, PAGE_W, THUMB_SCALE } from '../config.js';
import { state } from '../state/store.js';
import { renderPageEditorView, savePageBlocks, snapshotBlocksForUndo } from './editor.js';
import { entryText, materialSortForBlock, personById, personEntries } from '../data/models.js';
import { imagesForPerson } from '../views/profile.js';

export function newBlock(type, idx) {
  var offset = ((idx || 0) % 5) * 16;
  return {
    id: 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type: type,
    x: 30 + offset, y: 30 + offset,
    w: type === 'image' ? 200 : 260,
    h: type === 'image' ? 200 : (type === 'heading' ? 56 : 110),
    z: (idx || 0) + 1,
    content: type === 'heading' ? 'Überschrift' : (type === 'quote' ? 'Zitattext…' : (type === 'text' ? 'Text…' : '')),
    entryId: null,
    style: {
      fontFamily: (type === 'quote' || type === 'heading') ? 'serif' : 'sans',
      fontSize: type === 'heading' ? 26 : (type === 'quote' ? 16 : 12),
      align: 'left', color: '#141414',
      fontStyle: type === 'quote' ? 'italic' : 'normal',
      fontWeight: type === 'heading' ? '700' : '400'
    }
  };
}

export function blockContentHtml(block) {
  var st = block.style || {};
  if (block.type === 'image') {
    return block.content
      ? '<img src="' + esc(block.content) + '" alt="" style="width:100%;height:100%;object-fit:cover" onerror="this.style.opacity=\'.2\'">'
      : '<div class="block-image-empty">Bild wählen →</div>';
  }
  var styleStr = 'font-family:' + (BLOCK_FONTS[st.fontFamily] || BLOCK_FONTS.sans) + ';font-size:' + (st.fontSize || 14) +
    'px;text-align:' + (st.align || 'left') + ';color:' + (st.color || '#141414') + ';font-style:' + (st.fontStyle || 'normal') +
    ';font-weight:' + (st.fontWeight || '400') + ';line-height:1.4;white-space:pre-wrap;overflow-wrap:break-word';
  var mark = block.type === 'quote' ? '<div class="block-quote-mark">"</div>' : '';
  return mark + '<div style="' + styleStr + '">' + esc(block.content || '') + '</div>';
}

export function pageThumbHtml(pg) {
  var blocks = (pg.blocks || []).map(function(b) {
    return '<div style="position:absolute;left:' + b.x + 'px;top:' + b.y + 'px;width:' + b.w + 'px;height:' + b.h + 'px;overflow:hidden">' + blockContentHtml(b) + '</div>';
  }).join('');
  return '<div class="layout-thumb-inner" style="position:absolute;left:0;top:0;width:' + PAGE_W + 'px;height:' + PAGE_H + 'px;transform:scale(' + THUMB_SCALE + ');transform-origin:top left;background:#fff">' + blocks + '</div>';
}

export function applyPageTemplate(kind) {
  var pg = state.layoutState.page; if (!pg) return;
  if ((pg.blocks || []).length && !confirm('Die aktuelle Gestaltung durch diese Vorlage ersetzen?')) return;
  snapshotBlocksForUndo();
  var p = pg.person_id ? personById(pg.person_id) : null;
  var pEntries = p ? personEntries(p).slice().sort(materialSortForBlock) : [];
  var quoteEntry = pEntries.find(function(x) { return x.kategorie === 'Zitat'; });
  var bodyEntry = pEntries.find(function(x) { return x.kategorie !== 'Zitat'; }) || pEntries[0];
  var images = p ? imagesForPerson(p) : [];
  var title = p ? p.name : (pg.title || 'Titel der Seite');
  var body = bodyEntry ? (entryText(bodyEntry) || bodyEntry.preview || '') : 'Hier beginnt der redaktionelle Text. Wähle rechts ein Element und verbinde es mit vorhandenem Material.';
  var quote = quoteEntry ? (entryText(quoteEntry) || quoteEntry.preview || '') : 'Ein starkes Zitat setzt den Ton der Seite.';
  var image = images.length ? images[0].url : '';
  var blocks = [];

  function templateBlock(type, values, style) {
    var block = newBlock(type, blocks.length);
    Object.assign(block, values || {});
    block.style = Object.assign(block.style || {}, style || {});
    blocks.push(block);
  }

  if (kind === 'editorial') {
    templateBlock('heading', { x:32, y:34, w:416, h:66, content:title }, { fontSize:32, fontWeight:'400' });
    templateBlock('image', { x:32, y:124, w:194, h:280, content:image });
    templateBlock('text', { x:250, y:124, w:198, h:280, content:body, entryId:bodyEntry && bodyEntry.id }, { fontSize:12, fontFamily:'serif' });
    templateBlock('quote', { x:32, y:452, w:416, h:150, content:quote, entryId:quoteEntry && quoteEntry.id }, { fontSize:18, fontFamily:'serif' });
  } else if (kind === 'quote') {
    templateBlock('heading', { x:50, y:58, w:380, h:52, content:title }, { fontSize:15, fontFamily:'sans', fontWeight:'700', align:'center' });
    templateBlock('quote', { x:52, y:184, w:376, h:290, content:quote, entryId:quoteEntry && quoteEntry.id }, { fontSize:27, fontFamily:'serif', align:'center' });
    templateBlock('text', { x:100, y:540, w:280, h:55, content:'Living Well · Pilotband' }, { fontSize:9, align:'center', color:'#8a8a8a' });
  } else {
    templateBlock('heading', { x:40, y:54, w:400, h:75, content:title }, { fontSize:34, fontWeight:'400' });
    templateBlock('text', { x:40, y:170, w:400, h:360, content:body, entryId:bodyEntry && bodyEntry.id }, { fontSize:14, fontFamily:'serif' });
  }
  pg.blocks = blocks;
  state.layoutState.selectedBlockId = null;
  renderPageEditorView(document.getElementById('main'));
  savePageBlocks();
}
