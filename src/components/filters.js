import { state } from '../state/store.js';
import { LABEL } from '../config.js';
import { chips, render, toggleFilterPanel } from '../state/router.js';

export function mkCollapsibleGroup(el, grp, label, vals) {
  var group = document.createElement('div'); group.className = 'chip-group';
  var toggleBtn = document.createElement('button'); toggleBtn.className = 'chip-toggle';
  var activeVal = state.fil[grp];
  toggleBtn.textContent = label + (activeVal ? ': ' + (LABEL[activeVal] || activeVal) : '') + (state.filterPanelsOpen[grp] ? ' ▴' : ' ▾');
  toggleBtn.onclick = function() { toggleFilterPanel(grp); };
  group.appendChild(toggleBtn);
  if (state.filterPanelsOpen[grp]) {
    var row = document.createElement('div'); row.className = 'chip-row';
    vals.forEach(function(v) {
      var b = document.createElement('button'); b.className = 'chip';
      if ((!state.fil[grp] && v === 'Alle') || state.fil[grp] === v) b.className += ' on';
      b.textContent = LABEL[v] || v;
      b.onclick = function() { state.fil[grp] = v === 'Alle' ? null : v; chips(); render(); };
      row.appendChild(b);
    });
    group.appendChild(row);
  }
  el.appendChild(group);
}

export function mkMoreFiltersGroup(el) {
  var group = document.createElement('div'); group.className = 'chip-group';
  var toggleBtn = document.createElement('button'); toggleBtn.className = 'chip-toggle';
  var activeCount = (state.fil.status ? 1 : 0) + (state.fil.cur ? 1 : 0);
  toggleBtn.textContent = 'Filter' + (activeCount ? ' (' + activeCount + ')' : '') + (state.filterPanelsOpen.more ? ' ▴' : ' ▾');
  toggleBtn.onclick = function() { toggleFilterPanel('more'); };
  group.appendChild(toggleBtn);
  if (state.filterPanelsOpen.more) {
    mkGroup(group, 'status', 'Status', ['Alle', 'aktiv', 'kandidat', 'bereit']);
    mkGroup(group, 'cur', 'Material-Filter', ['Alle', 'fehlende_these', 'starke_personen', 'ungepruefte_quellen', 'formatbereit', 'buchreif']);
  }
  el.appendChild(group);
}

export function mkGroup(el, grp, label, vals) {
  var labels = { direkt: 'Direkt', hintergrund: 'Hintergrund', aktiv: 'Aktiv', kandidat: 'Kandidat', bereit: 'Bereit' };
  var group = document.createElement('div'); group.className = 'chip-group';
  var lbl = document.createElement('div'); lbl.className = 'chip-group-lbl'; lbl.textContent = label;
  group.appendChild(lbl);
  var row = document.createElement('div'); row.className = 'chip-row';
  vals.forEach(function(v) {
    var b = document.createElement('button'); b.className = 'chip';
    if ((!state.fil[grp] && v === 'Alle') || state.fil[grp] === v) b.className += ' on';
    b.textContent = labels[v] || LABEL[v] || v;
    b.onclick = function() { state.fil[grp] = v === 'Alle' ? null : v; chips(); render(); };
    row.appendChild(b);
  });
  group.appendChild(row);
  el.appendChild(group);
}
