import { IMAGE_MAX_BYTES, SB, SK } from '../config.js';
import { state } from '../state/store.js';

export function supa(t) {
  return fetch(SB + '/rest/v1/' + t + '?select=*&order=created_at.asc', {
    headers: { 'apikey': SK, 'Authorization': 'Bearer ' + SK }
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error(parseSupaErr(t) || 'Fehler beim Laden von ' + t); });
    return r.json();
  });
}

export function supaOptional(t) {
  return supa(t).then(function(data) {
    state.tableAvailability[t] = true;
    return data;
  }).catch(function(err) {
    state.tableAvailability[t] = false;
    console.warn('Optionale Tabelle nicht verfügbar:', t, err.message);
    return [];
  });
}

export function supaHeaders(prefer) {
  return {
    'apikey': SK,
    'Authorization': 'Bearer ' + SK,
    'Content-Type': 'application/json',
    'Prefer': prefer || 'return=representation'
  };
}

export function parseSupaErr(t) {
  try { var j = JSON.parse(t); return j.message || j.details || t; } catch(e) { return t; }
}

function handleSupa(r) {
  if (!r.ok) return r.text().then(function(t) { throw new Error(parseSupaErr(t) || 'Supabase-Fehler'); });
  if (r.status === 204) return null;
  return r.text().then(function(t) {
    if (!t) return null;
    try { var data = JSON.parse(t); return Array.isArray(data) ? data[0] : data; } catch(e) { return null; }
  });
}

export function matchQuery(table, item) {
  if (item && item.id) return 'id=eq.' + encodeURIComponent(item.id);
  if (table === 'persons' && item && item.name) return 'name=eq.' + encodeURIComponent(item.name);
  if (table === 'entries' && item && item.created_at) return 'created_at=eq.' + encodeURIComponent(item.created_at);
  if (table === 'entries' && item && item.person && item.preview) {
    return 'person=eq.' + encodeURIComponent(item.person) + '&preview=eq.' + encodeURIComponent(item.preview);
  }
  throw new Error('Kein stabiler Schlüssel für Update gefunden. Bitte die Datenbankmigration mit id-Spalten anwenden.');
}

export function patchSupa(table, item, payload) {
  return fetch(SB + '/rest/v1/' + table + '?' + matchQuery(table, item), {
    method: 'PATCH',
    headers: supaHeaders('return=representation'),
    body: JSON.stringify(payload)
  }).then(handleSupa);
}

export function insertSupa(table, payload) {
  return fetch(SB + '/rest/v1/' + table, {
    method: 'POST',
    headers: supaHeaders('return=representation'),
    body: JSON.stringify(payload)
  }).then(handleSupa);
}

export function uploadPersonImage(file) {
  if (!file) return Promise.reject(new Error('Keine Datei ausgewählt.'));
  if (!/^image\//.test(file.type)) return Promise.reject(new Error('Nur Bilddateien sind erlaubt.'));
  if (file.size > IMAGE_MAX_BYTES) return Promise.reject(new Error('Datei zu groß (max. 8 MB).'));
  var ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  var path = 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
  return fetch(SB + '/storage/v1/object/person-images/' + path, {
    method: 'POST',
    headers: { 'apikey': SK, 'Authorization': 'Bearer ' + SK, 'Content-Type': file.type },
    body: file
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error(parseSupaErr(t)); });
    return SB + '/storage/v1/object/public/person-images/' + path;
  });
}

export function claimResearchJob(job) {
  return fetch(SB + '/rest/v1/rpc/claim_research_job', {
    method:'POST', headers:supaHeaders('return=representation'),
    body:JSON.stringify({ p_job_id:job && job.id ? job.id : null })
  }).then(handleSupa);
}
