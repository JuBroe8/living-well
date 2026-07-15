import { state } from '../state/store.js';
import { hit } from '../state/router.js';
import { esc } from '../utils.js';

export function rPlaces(main, s) {
  var data = state.places.filter(function(p) { return hit(p, s); });
  document.getElementById('cnt').textContent = data.length + ' Orte';
  main.innerHTML = '';
  if (!data.length) {
    main.innerHTML = '<div class="empty"><div class="empty-ico">○</div>Keine Orte gefunden.</div>';
    return;
  }
  var wrap = document.createElement('div'); wrap.className = 'places-wrap';
  var tbl  = document.createElement('table'); tbl.className = 'ptbl';
  tbl.innerHTML = '<thead><tr><th>Name</th><th>Ort / Region</th><th>Notiz</th></tr></thead>';
  var tb = document.createElement('tbody');
  data.forEach(function(p) {
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + esc(p.name) + '</td>' +
      '<td>' + esc(p.location || '—') + '</td>' +
      '<td>' + esc(p.note || '') + '</td>';
    tb.appendChild(tr);
  });
  tbl.appendChild(tb); wrap.appendChild(tbl); main.appendChild(wrap);
}
