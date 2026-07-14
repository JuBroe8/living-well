'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { needsSourceSearch, buildExpandPrompt } = require('./enhance');

test('needsSourceSearch flags entries without a usable quelle_url or with unbekannt quality', () => {
  assert.equal(needsSourceSearch({ quelle_url: '', quellenqualitaet: 'primaer' }), true);
  assert.equal(needsSourceSearch({ quelle_url: '   ', quellenqualitaet: 'primaer' }), true);
  assert.equal(needsSourceSearch({ quelle_url: 'https://x.com', quellenqualitaet: 'unbekannt' }), true);
  assert.equal(needsSourceSearch({ quelle_url: 'https://x.com' }), true);
  assert.equal(needsSourceSearch({ quelle_url: 'https://x.com', quellenqualitaet: 'sekundaer' }), false);
  assert.equal(needsSourceSearch({ quelle_url: 'https://x.com', quellenqualitaet: 'geprueft' }), false);
});

test('buildExpandPrompt embeds the requested kategorie and count', () => {
  const prompt = buildExpandPrompt('Zitat', 3);
  assert.match(prompt, /GENAU 3 NEUE Einträge der Kategorie "Zitat"/);
  assert.match(prompt, /"quote": "der eigentliche Inhalt"/);
  assert.match(prompt, /"kategorie": "Zitat"/);
});

test('buildExpandPrompt uses the right content field per kategorie', () => {
  assert.match(buildExpandPrompt('Anekdote', 2), /"anekdote": "der eigentliche Inhalt"/);
  assert.match(buildExpandPrompt('Fakt', 2), /"fakt": "der eigentliche Inhalt"/);
  assert.match(buildExpandPrompt('Stil', 2), /"anekdote": "der eigentliche Inhalt"/);
});
