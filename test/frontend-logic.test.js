// Loads index.html's inline <script> content into a vm context (it's a
// non-module, global-var script — vm.createContext makes those top-level
// `var`s land on the context object, so functions like nextActionForPerson
// become directly callable/assertable without a build step or jsdom).
// DOM/network calls are stubbed to no-ops; these tests only exercise the
// pure data-derivation logic listed in docs/ux-workflow-implementation.md's
// "Tests ergänzen" section, not rendering.
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert');

function stubEl() {
  return {
    style: {},
    value: '',
    textContent: '',
    innerHTML: '',
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {},
    getAttribute() { return null; },
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
}

function loadApp() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .join('\n')
    .replace(/\ninit\(\);\s*$/, '\n'); // don't auto-fetch from Supabase in tests

  const fetchCalls = [];
  const sandbox = {
    console,
    fetch(url, opts) {
      fetchCalls.push({ url, opts });
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(opts && opts.body ? JSON.parse(opts.body) : {})),
      });
    },
    alert() {},
    confirm() { return true; },
    URLSearchParams,
    setTimeout,
    clearTimeout,
    document: {
      getElementById() { return stubEl(); },
      querySelectorAll() { return []; },
      querySelector() { return null; },
      createElement() { return stubEl(); },
      addEventListener() {},
    },
  };
  sandbox.window = { location: { search: '' }, scrollTo() {}, addEventListener() {}, document: sandbox.document };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  sandbox.__fetchCalls = fetchCalls;
  return sandbox;
}

function seed(app, { persons = [], entries = [], bookCandidates = [], bookPages = [], researchJobs = [], books = [] } = {}) {
  app.persons = persons;
  app.entries = entries;
  app.bookCandidates = bookCandidates;
  app.bookPages = bookPages;
  app.researchJobs = researchJobs;
  app.books = books;
  app.tableAvailability = { books: true, book_candidates: true, research_jobs: true, book_pages: true };
}

function mkPerson(id, name, overrides) {
  return Object.assign({ id, name, tags: [], format_eignung: [] }, overrides || {});
}

test('nextActionForPerson: no material -> Recherche starten', () => {
  const app = loadApp();
  seed(app, { persons: [mkPerson('p1', 'Ohne Material')] });
  const a = app.nextActionForPerson(app.persons[0]);
  assert.strictEqual(a.key, 'research');
});

test('nextActionForPerson: open review job takes priority over dossier state', () => {
  const app = loadApp();
  const p = mkPerson('p1', 'Mit Review');
  seed(app, {
    persons: [p],
    entries: [{ id: 'e1', person_id: 'p1', kategorie: 'Anekdote' }],
    researchJobs: [{ id: 'j1', person_id: 'p1', status: 'review' }],
  });
  const a = app.nextActionForPerson(p);
  assert.strictEqual(a.key, 'review');
  assert.strictEqual(a.jobId, 'j1');
});

test('nextActionForPerson: material but thin dossier -> dossier vervollständigen', () => {
  const app = loadApp();
  const p = mkPerson('p1', 'Dünnes Dossier');
  seed(app, { persons: [p], entries: [{ id: 'e1', person_id: 'p1', kategorie: 'Anekdote' }] });
  const a = app.nextActionForPerson(p);
  assert.strictEqual(a.key, 'dossier');
});

test('nextActionForPerson: full dossier, no fit -> fit bewerten', () => {
  const app = loadApp();
  const p = mkPerson('p1', 'Volles Dossier', {
    buchthese: 'x', lebensprinzip: 'x', spannung: 'x', visuelles_motiv: 'x', kurationsnotiz: 'x',
  });
  const entries = [
    { id: 'e1', person_id: 'p1', kategorie: 'Anekdote', quellenqualitaet: 'geprueft' },
    { id: 'e2', person_id: 'p1', kategorie: 'Anekdote', quellenqualitaet: 'geprueft' },
    { id: 'e3', person_id: 'p1', kategorie: 'Zitat', quelle: 'Buch X', quellenqualitaet: 'primaer' },
  ];
  seed(app, { persons: [p], entries });
  const d = app.dossierModel(p);
  assert.ok(d.count >= 6, 'dossier should be complete enough to move past the dossier step');
  const a = app.nextActionForPerson(p);
  assert.strictEqual(a.key, 'fit');
});

test('nextActionForPerson: shortlist without a page -> Seite gestalten', () => {
  const app = loadApp();
  const p = mkPerson('p1', 'Shortlist ohne Seite', {
    buchthese: 'x', lebensprinzip: 'x', spannung: 'x', visuelles_motiv: 'x', kurationsnotiz: 'x',
  });
  const entries = [
    { id: 'e1', person_id: 'p1', kategorie: 'Anekdote', quellenqualitaet: 'geprueft' },
    { id: 'e2', person_id: 'p1', kategorie: 'Anekdote', quellenqualitaet: 'geprueft' },
    { id: 'e3', person_id: 'p1', kategorie: 'Zitat', quelle: 'Buch X', quellenqualitaet: 'primaer' },
  ];
  const book = { id: 'b1' };
  const candidate = {
    id: 'c1', book_id: 'b1', person_id: 'p1', stage: 'shortlist',
    thesis_fit: 2, scene_potential: 2, tension_depth: 2, resonance_value: 2, visual_potential: 2, ensemble_value: 2,
  };
  seed(app, { persons: [p], entries, books: [book], bookCandidates: [candidate], bookPages: [] });
  const a = app.nextActionForPerson(p);
  assert.strictEqual(a.key, 'page');
});

test('nextActionForPerson: shortlist WITH a page already -> falls through to pilot/done, not page again', () => {
  const app = loadApp();
  const p = mkPerson('p1', 'Shortlist mit Seite', {
    buchthese: 'x', lebensprinzip: 'x', spannung: 'x', visuelles_motiv: 'x', kurationsnotiz: 'x',
  });
  const entries = [
    { id: 'e1', person_id: 'p1', kategorie: 'Anekdote', quellenqualitaet: 'geprueft' },
    { id: 'e2', person_id: 'p1', kategorie: 'Anekdote', quellenqualitaet: 'geprueft' },
    { id: 'e3', person_id: 'p1', kategorie: 'Zitat', quelle: 'Buch X', quellenqualitaet: 'primaer' },
  ];
  const book = { id: 'b1' };
  const candidate = {
    id: 'c1', book_id: 'b1', person_id: 'p1', stage: 'shortlist',
    thesis_fit: 2, scene_potential: 2, tension_depth: 2, resonance_value: 2, visual_potential: 2, ensemble_value: 2,
  };
  const page = { id: 'pg1', person_id: 'p1', blocks: [] };
  seed(app, { persons: [p], entries, books: [book], bookCandidates: [candidate], bookPages: [page] });
  const a = app.nextActionForPerson(p);
  assert.notStrictEqual(a.key, 'page');
});

test('personSortComparator("next") ranks review/dossier/fit/page ahead of research/done', () => {
  const app = loadApp();
  const noMaterial = mkPerson('p1', 'A - kein Material');
  const thinDossier = mkPerson('p2', 'B - dünnes Dossier');
  seed(app, {
    persons: [noMaterial, thinDossier],
    entries: [{ id: 'e1', person_id: 'p2', kategorie: 'Anekdote' }],
  });
  const sorted = app.persons.slice().sort(app.personSortComparator('next'));
  assert.strictEqual(sorted[0].id, 'p2', 'a person with an actionable dossier gap should rank above one with no material at all');
});

test('personSortComparator("name") is alphabetical (locale-aware)', () => {
  const app = loadApp();
  seed(app, { persons: [mkPerson('p1', 'Zebra'), mkPerson('p2', 'Ärmel'), mkPerson('p3', 'Anton')] });
  const sorted = app.persons.slice().sort(app.personSortComparator('name')).map((p) => p.name);
  assert.deepStrictEqual(sorted, ['Anton', 'Ärmel', 'Zebra']);
});

test('materialSortForBlock: buchreife final beats stark beats an unrated entry', () => {
  const app = loadApp();
  const roh = { id: 'e1', buchreife: 'roh', staerke: 1 };
  const stark = { id: 'e2', buchreife: 'stark', staerke: 1 };
  const final = { id: 'e3', buchreife: 'final', staerke: 1 };
  const sorted = [roh, stark, final].sort(app.materialSortForBlock).map((e) => e.id);
  assert.deepStrictEqual(sorted, ['e3', 'e2', 'e1']);
});

test('materialSortForBlock: within the same buchreife, higher Stärke sorts first', () => {
  const app = loadApp();
  const weak = { id: 'e1', buchreife: 'stark', staerke: 1 };
  const strong = { id: 'e2', buchreife: 'stark', staerke: 4 };
  const sorted = [weak, strong].sort(app.materialSortForBlock).map((e) => e.id);
  assert.deepStrictEqual(sorted, ['e2', 'e1']);
});

test('pilot queue: pool-stage candidates are never lost, board stages are mutually exclusive', () => {
  const app = loadApp();
  const p1 = mkPerson('p1', 'Pool Person');
  const p2 = mkPerson('p2', 'Board Person');
  const book = { id: 'b1' };
  const poolCandidate = { id: 'c1', book_id: 'b1', person_id: 'p1', stage: 'pool' };
  const boardCandidate = { id: 'c2', book_id: 'b1', person_id: 'p2', stage: 'shortlist' };
  seed(app, { persons: [p1, p2], books: [book], bookCandidates: [poolCandidate, boardCandidate] });

  const all = app.bookCandidates.filter((c) => String(c.book_id) === 'b1');
  const pool = all.filter((c) => !c.stage || c.stage === 'pool');
  const board = all.filter((c) => app.CANDIDATE_STAGES.indexOf(c.stage) >= 0);
  assert.strictEqual(pool.length + board.length, all.length, 'every candidate must be counted in exactly one of pool/board');
  assert.strictEqual(pool.length, 1);
  assert.strictEqual(board.length, 1);
});

test('savePageBlocks: rapid successive calls are debounced into a single PATCH, not one per call', async () => {
  const app = loadApp();
  const page = { id: 'pg1', blocks: [{ id: 'b1', x: 0 }] };
  app.layoutState = { page };

  app.savePageBlocks();
  app.savePageBlocks();
  app.savePageBlocks();

  assert.strictEqual(app.__fetchCalls.length, 0, 'debounce window has not elapsed yet');
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.strictEqual(app.__fetchCalls.length, 1, 'three rapid calls should coalesce into one request');
});

test('savePageBlocks: a save triggered while one is in flight waits instead of running concurrently', async () => {
  const app = loadApp();
  const page = { id: 'pg1', blocks: [{ id: 'b1', x: 0 }] };
  app.layoutState = { page };

  let resolveFirst;
  const firstResponse = new Promise((resolve) => { resolveFirst = resolve; });
  let callCount = 0;
  app.fetch = (url, opts) => {
    callCount += 1;
    if (callCount === 1) return firstResponse;
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('{}') });
  };

  app.savePageBlocks();
  await new Promise((resolve) => setTimeout(resolve, 450)); // let the debounce fire the first request
  assert.strictEqual(callCount, 1);

  app.savePageBlocks(); // queued while the first is still in flight
  await new Promise((resolve) => setTimeout(resolve, 450));
  assert.strictEqual(callCount, 1, 'second save must not fire while the first is still in flight');

  resolveFirst({ ok: true, status: 200, text: () => Promise.resolve('{}') });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.strictEqual(callCount, 2, 'the pending save should flush once the in-flight one resolves');
});
