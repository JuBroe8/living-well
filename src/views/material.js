import { state } from '../state/store.js';
import { entryUnchecked, entryUnlinked, strength } from '../data/models.js';
import { hit } from '../state/router.js';
import { mkEntryCard } from '../components/entry-card.js';

export function rEntries(main, s) {
  var data = state.entries.filter(function(x) {
    if (state.fil.kat  && x.kategorie !== state.fil.kat)  return false;
    if (state.fil.buch && x.buch !== state.fil.buch)       return false;
    if (state.fil.reife && x.buchreife !== state.fil.reife) return false;
    if (state.fil.curEntry === 'strong_entries' && strength(x) < 4) return false;
    if (state.fil.curEntry === 'unchecked_entries' && !entryUnchecked(x)) return false;
    if (state.fil.curEntry === 'unlinked_entries' && !entryUnlinked(x)) return false;
    return hit(x, s);
  });
  document.getElementById('cnt').textContent = data.length + ' Einträge';
  main.innerHTML = '';
  if (!data.length) {
    main.innerHTML = '<div class="empty"><div class="empty-ico">○</div>Keine Einträge gefunden.</div>';
    return;
  }
  data.forEach(function(x) { main.appendChild(mkEntryCard(x, true)); });
}
