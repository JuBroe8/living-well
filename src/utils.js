import { LABEL } from './config.js';

export function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function label(v) { return LABEL[v] || v; }

export function hasText(v) { return !!String(v || '').trim(); }

export function normalizeUrl(u) {
  var s = String(u || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+([/?#].*)?$/i.test(s)) return 'https://' + s;
  return s;
}

export function arr(v) {
  if (Array.isArray(v)) return v.filter(function(x) { return x !== null && x !== undefined && String(x).trim() !== ''; });
  if (!v) return [];
  if (typeof v === 'string') {
    var s = v.trim();
    if (!s) return [];
    if (s.charAt(0) === '[') {
      try { return arr(JSON.parse(s)); } catch(e) {}
    }
    return s.split(',').map(function(x) { return x.trim(); }).filter(Boolean);
  }
  return [];
}

export function splitList(s) { return arr(s); }

export function unique(xs) {
  var seen = {};
  return arr(xs).filter(function(x) {
    var key = String(x).toLowerCase();
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

export function val(id) {
  var el = document.getElementById(id);
  return el ? el.value : '';
}

export function opts(values, current) {
  return values.map(function(v) {
    var selected = String(current || '') === String(v) ? ' selected' : '';
    var text = v === '' ? '—' : label(v);
    return '<option value="' + esc(v) + '"' + selected + '>' + esc(text) + '</option>';
  }).join('');
}

export function checkGroup(name, values, selected) {
  selected = arr(selected);
  return '<div class="checkgrid">' + values.map(function(v) {
    var checked = selected.indexOf(v) >= 0 ? ' checked' : '';
    return '<label class="checkchip"><input type="checkbox" name="' + esc(name) + '" value="' + esc(v) + '"' + checked + '> ' + esc(label(v)) + '</label>';
  }).join('') + '</div>';
}

export function getChecked(name) {
  return Array.prototype.slice.call(document.querySelectorAll('input[name="' + name + '"]:checked')).map(function(x) { return x.value; });
}

export function getCheckedIn(root, name) {
  return Array.prototype.slice.call(root.querySelectorAll('input[name="' + name + '"]:checked')).map(function(x) { return x.value; });
}

export function curationItem(title, value, full, emphasis, alwaysFull) {
  var cls = full || alwaysFull ? ' full' : '';
  var valCls = emphasis ? 'curation-val em' : 'curation-val';
  var text = hasText(value) ? '<div class="' + valCls + '">' + esc(value) + '</div>' : '<div class="curation-empty">Noch offen</div>';
  return '<div class="curation-item' + cls + '"><div class="lbl">' + esc(title) + '</div>' + text + '</div>';
}

export function cleanChoice(v, allowed, fallback) {
  return allowed.indexOf(v) >= 0 ? v : fallback;
}

export function normalizeStrength(v) {
  var n = Number(v);
  return n >= 1 && n <= 5 ? n : '';
}

export function formatEuro(n) {
  return Number(n || 0).toLocaleString('de-DE', { style:'currency', currency:'EUR', minimumFractionDigits: n < 1 ? 3 : 2, maximumFractionDigits: n < 1 ? 3 : 2 });
}

export function formatDateDE(isoDay) {
  var d = new Date(isoDay + 'T00:00:00');
  return d.toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' });
}

export function formatDateTimeDE(iso) {
  var d = new Date(iso);
  return d.toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit' }) + ' ' + d.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' });
}

export function normText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}
