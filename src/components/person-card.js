import { candidateFor, dossierModel, fitScore, missingLabel, personDashboardModel, personEntries } from '../data/models.js';
import { esc } from '../utils.js';
import { showProfile } from '../state/router.js';

export function mkPCard(p) {
  var dc  = p.status === 'bereit' ? 'dc' : p.status === 'aktiv' ? 'dr' : 'dm';
  var ec  = personEntries(p).length;
  var dm  = personDashboardModel(p);
  var dossier = dossierModel(p), candidate = candidateFor(p), fit = fitScore(candidate);
  var pillItems = [];
  dm.gaps.slice(0, 2).forEach(function(g) { pillItems.push({ cls: 'pill pill-w', text: missingLabel(g) }); });
  (p.tags || []).slice(0, 2).forEach(function(t) { pillItems.push({ cls: 'pill', text: t }); });
  var tagsHtml = pillItems.map(function(item) { return '<span class="' + item.cls + '">' + esc(item.text) + '</span>'; }).join('');
  var c = document.createElement('div'); c.className = 'pc';
  c.setAttribute('role', 'button');
  c.tabIndex = 0;
  c.innerHTML =
    '<div class="pc-top">' +
      (p.image_url ? '<img class="pc-thumb" src="' + esc(p.image_url) + '" alt="" onerror="this.remove()">' : '') +
      '<div style="flex:1;min-width:0">' +
        '<div class="pc-name">' + esc(p.name) + '</div>' +
      '</div>' +
      '<div class="sdot ' + dc + '" title="' + esc(p.status || '') + '"></div>' +
    '</div>' +
    (p.kategorie ? '<div class="pc-role">'  + esc(p.kategorie) + '</div>' : '') +
    (p.dates     ? '<div class="pc-dates">' + esc(p.dates)     + '</div>' : '') +
    '<div class="pc-ec' + (ec > 0 ? ' has' : '') + '">' +
      (ec > 0 ? ec + ' Eintr' + (ec === 1 ? 'ag' : 'äge') : 'Noch kein Material') +
    '</div>' +
    '<div class="dossier-row"><span class="pill ' + (dossier.count >= 6 ? 'pill-s' : 'pill-q') + '">Dossier ' + dossier.count + '/8</span>' + (fit !== null ? '<span class="pill pill-s">Pilot ' + fit + '/12</span>' : '') + '</div>' +
    (tagsHtml ? '<div class="pc-tags">' + tagsHtml + '</div>' : '');
  var open = function() { showProfile(p); };
  c.onclick = open;
  c.onkeydown = function(e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      if (e.key !== 'Enter') e.preventDefault();
      open();
    }
  };
  return c;
}
