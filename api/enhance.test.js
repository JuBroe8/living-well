'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { needsSourceSearch, buildExpandPrompt, buildSourceResearchPrompt, buildExpandResearchPrompt } = require('./enhance');

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

test('buildSourceResearchPrompt puts the concrete task in contents, mandate in systemInstruction', () => {
  const p = buildSourceResearchPrompt('Marcello Mastroianni', [
    { kategorie: 'Zitat', quote: 'Real magnetism is found not in speed...' }
  ]);
  assert.match(p.systemInstruction, /zwingend die Google-Suche/);
  assert.match(p.contents, /Marcello Mastroianni/);
  assert.match(p.contents, /1\. \[Zitat\] "Real magnetism/);
});

test('buildExpandResearchPrompt embeds kategorie, count, person and existing material in contents', () => {
  const p = buildExpandResearchPrompt('Diana Vreeland', 'Stil', 4, '1. [Anekdote] schon vorhanden');
  assert.match(p.systemInstruction, /zwingend die Google-Suche/);
  assert.match(p.contents, /4 neue, gut belegte Einträge der Kategorie "Stil" zu Diana Vreeland/);
  assert.match(p.contents, /1\. \[Anekdote\] schon vorhanden/);
});

test('buildExpandResearchPrompt falls back to a placeholder when nothing exists yet', () => {
  const p = buildExpandResearchPrompt('Neue Person', 'Anekdote', 2, '');
  assert.match(p.contents, /\(noch nichts vorhanden\)/);
});
