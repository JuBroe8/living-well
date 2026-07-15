import { state } from './store.js';
import { supa, supaOptional } from '../data/supabase.js';
import { activeBook, findPersonByName, normalizeData, openSourceCount } from '../data/models.js';
import { rStatus, resumeQueuedResearch } from '../views/dashboard.js';
import { BUCHREIFE, FORMAT_EIGNUNG, MORE_VIEWS } from '../config.js';
import { mkCollapsibleGroup, mkGroup, mkMoreFiltersGroup } from '../components/filters.js';
import { rProfile } from '../views/profile.js';
import { rPersons } from '../views/persons.js';
import { rEntries } from '../views/material.js';
import { rAdd } from '../add.js';
import { rPilot } from '../views/pilot.js';
import { rKosten } from '../views/costs.js';
import { rLayout } from '../views/pages.js';
import { rPlaces } from '../views/places.js';

export function setPersonSort(v) { state.personSort = v; state.personRenderLimit = 30; render(); }

export function init() {
  var requestedView = new URLSearchParams(window.location.search).get('capture') === '1' ? 'add' : state.view;
  Promise.all([
    supa('persons'), supa('entries'), supa('places'),
    supaOptional('books'), supaOptional('book_candidates'),
    supaOptional('research_jobs'), supaOptional('ai_runs'), supaOptional('person_images'), supaOptional('book_pages')
  ]).then(function(r) {
    state.persons = r[0]; state.entries = r[1]; state.places = r[2]; state.books = r[3];
    state.bookCandidates = r[4]; state.researchJobs = r[5]; state.aiRuns = r[6]; state.personImages = r[7]; state.bookPages = r[8];
    normalizeData();
    updateStats();
    goTab(requestedView || 'status');
    setTimeout(resumeQueuedResearch, 100);
  }).catch(function() {
    document.getElementById('main').innerHTML =
      '<div class="empty"><div class="empty-ico">⚠</div>Fehler beim Laden der Daten.</div>';
  });
}

export function updateStats() {
  var pilot = activeBook();
  var selected = pilot ? state.bookCandidates.filter(function(x) { return x.book_id === pilot.id && x.stage === 'selected'; }).length : 0;
  document.getElementById('hstats').innerHTML =
    stat(state.persons.length, 'Im Pool') +
    stat(selected, 'Im Pilot') +
    stat(state.entries.length, 'Material') +
    stat(openSourceCount(), 'Quellen offen');
}

function stat(n, l) {
  return '<div class="hstat"><div class="hstat-n">' + n + '</div><div class="hstat-l">' + l + '</div></div>';
}

export function goTab(t) {
  state.view = t; state.profilePerson = null; state.profileEdit = false; state.fil = {};
  document.querySelectorAll('.tab').forEach(function(x) {
    x.classList.toggle('on', x.dataset.tab === t);
  });
  document.getElementById('more-tab').classList.toggle('on', MORE_VIEWS.indexOf(t) >= 0);
  closeMoreMenu();
  if (t !== 'layout') state.layoutPresetPersonId = null;
  if (t === 'pilot') state.pilotQueueLimit = 12;
  if (t === 'status') state.dashboardQueueLimit = 10;
  if (t === 'persons') { state.personSort = 'next'; state.personRenderLimit = 30; }
  document.getElementById('back-btn').classList.remove('vis');
  document.getElementById('tab-sep').style.display = 'none';
  document.getElementById('bar').style.display = (t === 'add' || t === 'status' || t === 'pilot' || t === 'kosten' || t === 'layout') ? 'none' : '';
  state.layoutState.view = 'list'; state.layoutState.page = null; state.layoutState.selectedBlockId = null;
  document.getElementById('srch').value = '';
  window.scrollTo(0, 0);
  chips(); render();
}

export function toggleMoreMenu(e) {
  e.stopPropagation();
  var menu = document.getElementById('more-menu');
  var willOpen = !menu.classList.contains('open');
  if (willOpen) {
    var r = document.getElementById('more-tab').getBoundingClientRect();
    menu.style.top = r.bottom + 4 + 'px';
    menu.style.left = r.left + 'px';
  }
  menu.classList.toggle('open', willOpen);
  document.getElementById('more-tab').setAttribute('aria-expanded', String(willOpen));
}

export function closeMoreMenu() {
  document.getElementById('more-menu').classList.remove('open');
  document.getElementById('more-tab').setAttribute('aria-expanded', 'false');
}

export function openCapture() {
  state.addState = { phase: 'input', person: null, entries: [], prefill: '', job: null, usage: null, mode: 'capture' };
  goTab('add');
}

export function showProfile(p) {
  if (state.view === 'persons') {
    state.personsSearchBeforeProfile = document.getElementById('srch').value;
    state.personsScrollBeforeProfile = window.scrollY;
  }
  state.view = 'profile'; state.profilePerson = p; state.profileEdit = false; state.fitPanelExpanded = false;
  state.profileTab = 'overview'; state.profileEntryFilter = null;
  document.querySelectorAll('.tab').forEach(function(x) {
    x.classList.toggle('on', x.dataset.tab === 'persons');
  });
  document.getElementById('more-tab').classList.remove('on');
  document.getElementById('back-btn').classList.add('vis');
  document.getElementById('tab-sep').style.display = 'block';
  document.getElementById('bar').style.display = 'none';
  window.scrollTo(0, 0);
  render();
}

export function backToPersons() {
  state.view = 'persons'; state.profilePerson = null; state.profileEdit = false; state.fitPanelExpanded = false;
  document.querySelectorAll('.tab').forEach(function(x) {
    x.classList.toggle('on', x.dataset.tab === 'persons');
  });
  document.getElementById('back-btn').classList.remove('vis');
  document.getElementById('tab-sep').style.display = 'none';
  document.getElementById('bar').style.display = '';
  document.getElementById('srch').value = state.personsSearchBeforeProfile || '';
  chips(); render();
  window.scrollTo(0, state.personsScrollBeforeProfile || 0);
}

export function toggleFilterPanel(key) { state.filterPanelsOpen[key] = !state.filterPanelsOpen[key]; chips(); }

export function chips() {
  var el = document.getElementById('chips'); el.innerHTML = '';
  document.getElementById('person-sort').style.display = state.view === 'persons' ? '' : 'none';
  if (state.view === 'persons') {
    document.getElementById('person-sort').value = state.personSort;
    mkGroup(el, 'arbeitsstand', 'Arbeitsstand', ['Alle', 'ohne_material', 'dossier_offen', 'dossier_bereit', 'fit_offen']);
    mkCollapsibleGroup(el, 'format', 'Format', ['Alle'].concat(FORMAT_EIGNUNG));
    mkMoreFiltersGroup(el);
  }
  if (state.view === 'entries') {
    mkGroup(el, 'kat', 'Kategorie', ['Alle', 'Anekdote', 'Zitat', 'Fakt', 'Stil']);
    mkGroup(el, 'buch', 'Buch-Status', ['Alle', 'direkt', 'hintergrund']);
    mkGroup(el, 'curEntry', 'Qualität', ['Alle', 'strong_entries', 'unchecked_entries', 'unlinked_entries']);
    mkGroup(el, 'reife', 'Buchreife', ['Alle'].concat(BUCHREIFE));
  }
}

function q() { return (document.getElementById('srch').value || '').toLowerCase(); }

export function hit(obj, s) {
  if (!s) return true;
  return Object.values(obj).some(function(v) {
    return v && (Array.isArray(v) ? v.join(' ') : String(v)).toLowerCase().indexOf(s) > -1;
  });
}

export function render() {
  var main = document.getElementById('main'), s = q();
  if (state.view === 'profile')       rProfile(main);
  else if (state.view === 'persons')  rPersons(main, s);
  else if (state.view === 'entries')  rEntries(main, s);
  else if (state.view === 'add')      rAdd(main);
  else if (state.view === 'status')   rStatus(main);
  else if (state.view === 'pilot')    rPilot(main);
  else if (state.view === 'kosten')   rKosten(main);
  else if (state.view === 'layout')   rLayout(main);
  else                          rPlaces(main, s);
}

export function setProfileTab(t) { state.profileTab = t; render(); }

export function showProfileByName(name) {
  var p = findPersonByName(name);
  if (p) showProfile(p);
}

export function expandFitPanel() { state.fitPanelExpanded = true; render(); }
