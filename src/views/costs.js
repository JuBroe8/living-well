import { state } from '../state/store.js';
import { GEMINI_GROUNDING_FREE_MONTHLY } from '../config.js';
import { dashMetric } from './dashboard.js';
import { esc, formatDateDE, formatDateTimeDE, formatEuro } from '../utils.js';

export function rKosten(main) {
  main.innerHTML = '';
  var wrap = document.createElement('div');

  var now = new Date();
  var startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  var startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  var oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  function since(d) { return state.aiRuns.filter(function(r) { return r.created_at && new Date(r.created_at) >= d; }); }
  function sumCost(list) { return list.reduce(function(s, r) { return s + Number(r.estimated_cost_eur || 0); }, 0); }
  function sumTokens(list) { return list.reduce(function(s, r) { return s + Number(r.total_tokens || 0); }, 0); }
  function groundingCount(list) { return list.reduce(function(s, r) { return s + Number((r.pricing && r.pricing.groundingRequests) || 0); }, 0); }

  var today = since(startOfToday), week = since(startOfWeek), month = since(startOfMonth), lastHour = since(oneHourAgo);
  var groundedThisMonth = groundingCount(month);
  var groundingPct = Math.min(100, Math.round((groundedThisMonth / GEMINI_GROUNDING_FREE_MONTHLY) * 100));

  var html = '<div class="dash-hero">' +
    '<div class="dash-title">KI-Kosten &amp; Limits</div>' +
    '<div class="dash-copy">Aus den bei jedem KI-Lauf protokollierten Token- und Kostenschätzungen berechnet (' + state.aiRuns.length + ' Läufe insgesamt seit Start). ' +
      'Der KI-Ablauf läuft in zwei Schritten: eine Google-Suche (braucht den bezahlten Schlüssel, kostet echtes Geld) und danach ein reiner Textbaustein ohne Suche, der über einen zweiten, kostenlosen Schlüssel laufen kann. ' +
      'Läuft dieser zweite Schritt über den kostenlosen Schlüssel, zeigt diese Seite dafür 0,00 € — übrig bleibt nur die Such-Gebühr aus Schritt eins, falls eine Suche stattgefunden hat.</div>' +
  '</div>';

  html += '<div class="metric-grid">' +
    dashMetric(formatEuro(sumCost(today)), 'Heute') +
    dashMetric(formatEuro(sumCost(week)), 'Diese Woche') +
    dashMetric(formatEuro(sumCost(month)), 'Diesen Monat') +
    dashMetric(formatEuro(sumCost(state.aiRuns)), 'Insgesamt') +
  '</div>';

  html += '<div class="dash-card" style="margin-bottom:12px">' +
    '<div class="dash-card-hd"><div><div class="dash-card-title">Google-Search-Freikontingent</div>' +
      '<div class="dash-card-note">Grounding ist bei den Gemini-3-Modellen im bezahlten Tier bis 5.000 Suchanfragen pro Kalendermonat kostenlos (gemeinsames Kontingent), danach ca. 0,013 € je Anfrage.</div></div></div>' +
    pipeRow(groundedThisMonth + ' / ' + GEMINI_GROUNDING_FREE_MONTHLY + ' kostenlose Anfragen diesen Monat', groundedThisMonth, GEMINI_GROUNDING_FREE_MONTHLY) +
    '<div class="readonly-note">' + (groundedThisMonth < GEMINI_GROUNDING_FREE_MONTHLY
      ? (GEMINI_GROUNDING_FREE_MONTHLY - groundedThisMonth) + ' kostenlose Suchanfragen diesen Monat noch übrig.'
      : 'Kostenloses Kontingent diesen Monat aufgebraucht — weitere Suchanfragen werden berechnet.') + '</div>' +
  '</div>';

  html += '<div class="dash-card" style="margin-bottom:12px">' +
    '<div class="dash-card-hd"><div><div class="dash-card-title">Auslastung — letzte 60 Minuten</div>' +
      '<div class="dash-card-note">Google veröffentlicht RPM/TPM/RPD nicht als feste Tabelle pro Modell — die genauen Werte hängen von Konto und Tier ab. Live-Stand: <a class="subtle-link" href="https://aistudio.google.com/rate-limit" target="_blank" rel="noopener">AI Studio Rate Limits</a>. Diese Kennzahlen zeigen zumindest, wie stark diese App gerade sendet.</div></div></div>' +
    '<div class="metric-grid">' +
      dashMetric(lastHour.length, 'Anfragen') +
      dashMetric(sumTokens(lastHour).toLocaleString('de-DE'), 'Token') +
    '</div>' +
  '</div>';

  var byModel = {};
  state.aiRuns.forEach(function(r) {
    var k = r.model || 'unbekannt';
    if (!byModel[k]) byModel[k] = { n: 0, tokens: 0, cost: 0 };
    byModel[k].n += 1; byModel[k].tokens += Number(r.total_tokens || 0); byModel[k].cost += Number(r.estimated_cost_eur || 0);
  });
  html += '<div class="sv-sec-hd">Nach Modell</div>';
  html += '<div class="sv-tbl-wrap" style="overflow-x:auto"><table class="sv-tbl"><thead><tr><th>Modell</th><th class="sv-center">Läufe</th><th class="sv-center">Token</th><th class="sv-center">Kosten</th></tr></thead><tbody>' +
    (Object.keys(byModel).length ? Object.keys(byModel).map(function(k) {
      var m = byModel[k];
      return '<tr><td>' + esc(k) + '</td><td class="sv-cell">' + m.n + '</td><td class="sv-cell">' + m.tokens.toLocaleString('de-DE') + '</td><td class="sv-cell">' + formatEuro(m.cost) + '</td></tr>';
    }).join('') : '<tr><td colspan="4" class="readonly-note">Noch keine Daten.</td></tr>') +
  '</tbody></table></div>';

  var byDay = {};
  state.aiRuns.forEach(function(r) {
    if (!r.created_at) return;
    var day = String(r.created_at).slice(0, 10);
    if (!byDay[day]) byDay[day] = { n: 0, tokens: 0, cost: 0, grounding: 0 };
    byDay[day].n += 1; byDay[day].tokens += Number(r.total_tokens || 0); byDay[day].cost += Number(r.estimated_cost_eur || 0);
    byDay[day].grounding += Number((r.pricing && r.pricing.groundingRequests) || 0);
  });
  var days = Object.keys(byDay).sort().reverse().slice(0, 14);
  html += '<div class="sv-sec-hd">Letzte 14 Tage</div>';
  html += '<div class="sv-tbl-wrap" style="overflow-x:auto"><table class="sv-tbl"><thead><tr><th>Datum</th><th class="sv-center">Läufe</th><th class="sv-center">Token</th><th class="sv-center">Suchanfragen</th><th class="sv-center">Kosten</th></tr></thead><tbody>' +
    (days.length ? days.map(function(d) {
      var m = byDay[d];
      return '<tr><td>' + esc(formatDateDE(d)) + '</td><td class="sv-cell">' + m.n + '</td><td class="sv-cell">' + m.tokens.toLocaleString('de-DE') + '</td><td class="sv-cell">' + m.grounding + '</td><td class="sv-cell">' + formatEuro(m.cost) + '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="readonly-note">Noch keine Daten.</td></tr>') +
  '</tbody></table></div>';

  html += '<div class="sv-sec-hd">Letzte Läufe</div>';
  html += '<div class="queue-list">' + (state.aiRuns.length ? state.aiRuns.slice(-25).reverse().map(function(x) {
    var statusPill = x.status === 'failed' ? ' <span class="pill pill-w">Fehlgeschlagen</span>' : '';
    return '<div class="cost-row"><span><strong>' + esc(x.operation || 'KI-Lauf') + '</strong>' + statusPill + '<br>' +
      '<span class="readonly-note">' + esc(x.model || '') + ' · ' + Number(x.total_tokens || 0).toLocaleString('de-DE') + ' Token' + (x.created_at ? ' · ' + esc(formatDateTimeDE(x.created_at)) : '') + '</span></span>' +
      '<span>' + formatEuro(x.estimated_cost_eur || 0) + '</span></div>';
  }).join('') : '<div class="readonly-note">Noch keine KI-Läufe protokolliert.</div>') + '</div>';

  wrap.innerHTML = html;
  main.appendChild(wrap);
}

function pipeRow(labelText, n, total) {
  var pct = total ? Math.round((n / total) * 100) : 0;
  return '<div class="pipe-row">' +
    '<div class="pipe-label">' + esc(labelText) + '</div>' +
    '<div class="pipe-bar"><div class="pipe-fill" style="width:' + pct + '%"></div></div>' +
    '<div class="pipe-n">' + n + '/' + total + '</div>' +
  '</div>';
}
