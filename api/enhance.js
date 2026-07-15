const { GoogleGenAI } = require('@google/genai');
const { calculateUsage, recordUsage } = require('./ai-usage');
const { generateWithTransientRetry, runGroundedResearch, mergeUsage } = require('./grounded-research');

const MODELS = ['gemini-3.5-flash', 'gemini-3.1-flash-lite'];
const SEARCH_GROUNDING_ENABLED = process.env.GEMINI_ENABLE_SEARCH_GROUNDING === 'true';
const EXPAND_KATEGORIEN = ['Anekdote', 'Zitat', 'Fakt', 'Stil'];

const PROMPT = `Du bist kuratorischer Redakteur für ein deutsches Sachbuch/Coffee-Table-Book mit dem Arbeitstitel "Living Well".

Die Datenbank enthält bereits Personen und einzelne Einträge. Deine Aufgabe ist NICHT, neue Einträge zu erfinden oder vorhandene Texte umzuschreiben. Deine Aufgabe ist, vorhandenes Material kuratorisch zu bewerten und Vorschläge zu machen, die ein Mensch später einzeln bestätigen kann.

Antworte IMMER nur mit validem JSON. Kein Markdown, keine Erklärung.

Erlaubte Werte:
- format_eignung: ["doppelseite","kurzprofil","kapitelauftakt","randnotiz","zitatseite"]
- quellenqualitaet: ["unbekannt","sekundaer","primaer","geprueft"]
- buchreife: ["roh","brauchbar","stark","final"]
- seitenrolle: ["haupttext","auftakt","marginalie","bildunterschrift","abschluss","unentschieden"]
- themen: ["Arbeit","Disziplin","Freiheit","Stil","Koerper","Tod","Scheitern","Ruhm","Freundschaft","Liebe","Natur","Genuss","Risiko","Alter","Einsamkeit"]
- staerke: Zahl 1 bis 5; 5 = ikonisch, erzählerisch stark, fast direkt buchfähig

JSON-Format:
{
  "person": {
    "lebensprinzip": "prägnanter Satz",
    "buchthese": "1-2 kuratorische Sätze",
    "archetyp": "kurzer Archetyp",
    "spannung": "produktiver Widerspruch",
    "visuelles_motiv": "konkretes Bildmotiv",
    "format_eignung": ["doppelseite"],
    "kurationsnotiz": "was als nächstes zu prüfen oder zu entscheiden ist",
    "tags": ["maximal", "5", "sinnvolle", "tags"]
  },
  "entries": [
    {
      "id": "id des vorhandenen Eintrags",
      "staerke": 4,
      "quellenqualitaet": "sekundaer",
      "buchreife": "stark",
      "themen": ["Stil", "Ruhm"],
      "ton": "selbstironisch, leicht, weltgewandt",
      "seitenrolle": "haupttext",
      "buchnotiz": "knappe Begründung, wie der Eintrag im Buch funktionieren könnte",
      "quelle": "z.B. Seneca, Epistulae Morales, Brief 1 — oder leer lassen",
      "quelle_url": "verifizierbare URL oder leer"
    }
  ],
  "tag_mapping": [
    {
      "tag": "vorhandener Tag",
      "thema": "Stil",
      "begruendung": "kurz"
    }
  ]
}

Regeln:
1. Gib für jeden gelieferten Eintrag genau ein Objekt mit derselben id zurück.
2. Bewerte nur auf Basis des vorhandenen Materials — niemals neue Texte erfinden.
3. quelle/quelle_url: Wenn dir unten im Kontext bereits recherchierte, echte Quellen mit URL für bestimmte Einträge genannt werden, ordne sie dem passenden Eintrag zu. Erfinde niemals selbst eine neue URL. Ohne eine dir genannte echte Quelle: quelle_url leer lassen, quelle nur befüllen wenn du eine bekannte, plausible Zuordnung (Buch/Werk) nennen kannst — sonst leer lassen.
4. quellenqualitaet korrekt setzen:
   - "geprueft": klar zugeordnete Primärquelle (das Originalwerk) vorhanden
   - "primaer": Zitat oder Anekdote direkt aus dem Werk der Person, Quelle plausibel aber nicht 100% verifiziert
   - "sekundaer": aus Biographie, Sekundärliteratur oder gut belegten Sammlungen
   - "unbekannt": keine plausible Quelle identifizierbar — ehrlich bleiben
5. Bei zweifelhaften oder nur behaupteten Zitaten: buchreife nicht "final"; quellenqualitaet nicht "geprueft".
6. tags sind freie Schlagwörter; themen sind die kuratorischen Hauptmotive. Nutze tag_mapping, um bestehende Tags auf Themen abzubilden.
7. Sprache immer Deutsch.`;

// Gemini does not reliably combine tools (googleSearch) with structured JSON
// output in one call, so a dedicated source-search only runs for entries
// that actually lack a usable citation — keeps most enhance calls cheap and
// ungrounded (pure editorial judgment on existing text) while still getting
// real search results where they matter.
function needsSourceSearch(entry) {
  const url = entry && entry.quelle_url ? String(entry.quelle_url).trim() : '';
  return !url || entry.quellenqualitaet === 'unbekannt' || !entry.quellenqualitaet;
}

// Both research-prompt builders below return {systemInstruction, contents}
// instead of one big system string. Live testing showed the model skipping
// the googleSearch tool entirely (grounding.used stayed false with no
// error) when the whole task — including a long "already have this"
// listing — sat in systemInstruction and the actual user turn (contents)
// was a short, vague instruction. extract.js's RESEARCH_PROMPT, which
// reliably triggers real search, keeps systemInstruction to role+mandate
// and puts the concrete, information-dense task in contents — mirroring
// that split here instead of guessing why the SDK/model treats the two
// differently.
const SEARCH_MANDATE = 'Nutze für diese Aufgabe zwingend die Google-Suche, bevor du antwortest — verlasse dich nicht auf dein Gedächtnis oder auf Vermutungen. Wenn die Suche zu einem Punkt nichts Verlässliches liefert, sag das explizit, statt etwas zu erfinden. Antworte als lesbare Liste in Klartext, kein JSON. Sprache: Deutsch.';

function buildSourceResearchPrompt(personName, items) {
  const lines = items.map((e, i) => {
    const text = e.quote || e.anekdote || e.fakt || e.preview || '';
    return `${i + 1}. [${e.kategorie || 'Eintrag'}] "${String(text).slice(0, 300)}"`;
  }).join('\n');
  return {
    systemInstruction: `Du bist Recherche-Assistent für ein deutsches Sachbuch. ${SEARCH_MANDATE}`,
    contents: `Finde für ${personName} zu jedem der folgenden bereits im Bestand vorhandenen, aber noch unbelegten Einträge über die Google-Suche die wahrscheinlichste echte Quelle (Buch, Interview, Artikel, Archiv) und die passende URL:\n\n${lines}\n\nGib für jeden Eintrag (mit derselben Nummer wie oben) die gefundene Quelle und die echte, von der Suche gelieferte URL an.`
  };
}

function buildExpandResearchPrompt(personName, kategorie, count, existingList) {
  return {
    systemInstruction: `Du bist Recherche-Assistent für ein deutsches Sachbuch über Menschen, die ihr Leben radikal nach einer eigenen Idee lebten. ${SEARCH_MANDATE}`,
    contents: `Finde über die Google-Suche ${count} neue, gut belegte Einträge der Kategorie "${kategorie}" zu ${personName} — mit Inhalt, Quelle und der echten, von der Suche gelieferten URL. Folgendes Material ist bereits vorhanden, wiederhole es nicht, auch nicht umformuliert:\n\n${existingList || '(noch nichts vorhanden)'}`
  };
}

function buildExpandPrompt(kategorie, count) {
  const kategorieHinweise = {
    Anekdote: 'Eine konkrete SZENE oder GESCHICHTE — mit Ort, Zeit, handelnden Personen, Verlauf. Keine allgemeine Beschreibung wie "war bekannt für...".',
    Zitat: 'Nur wörtliche, authentische Zitate — keine paraphrasierten Aussagen. Bei Fremdsprache: Original + deutsche Übersetzung.',
    Fakt: 'Ein präziser, wenig bekannter oder überraschender Fakt — kein bloßer Lebenslaufeintrag.',
    Stil: 'Eine konkrete Gewohnheit, ein Ritual oder eine Umgebung, die eine Charaktereigenschaft sichtbar macht — keine allgemeine Beschreibung.'
  };
  return `Du bist Recherche-Redakteur für ein deutsches Sachbuch/Coffee-Table-Book mit dem Arbeitstitel "Living Well" (Porträts von Menschen, die ihr Leben radikal nach einer eigenen Idee lebten).

Du sollst für eine bereits im Bestand vorhandene Person GENAU ${count} NEUE Einträge der Kategorie "${kategorie}" finden — recherchiere aktiv über die Google-Suche nach Material, das unten in "BEREITS VORHANDENES MATERIAL" noch NICHT vorkommt. Keine Wiederholung von bereits vorhandenen Anekdoten/Zitaten/Fakten, auch nicht umformuliert.

${kategorieHinweise[kategorie] || ''}

Antworte NUR mit validem JSON, kein Markdown, keine Erklärung:
{
  "entries": [
    {
      "kategorie": "${kategorie}",
      "buch": "direkt" | "hintergrund",
      ${kategorie === 'Zitat' ? '"quote"' : kategorie === 'Fakt' ? '"fakt"' : '"anekdote"'}: "der eigentliche Inhalt",
      "preview": "erste 100–120 Zeichen des Inhalts",
      "quelle": "Quellenangabe oder leer",
      "quelle_url": "echte, per Suche gefundene URL oder leer — niemals erfinden",
      "tags": ["tag1", "tag2"],
      "staerke": 1,
      "quellenqualitaet": "unbekannt" | "sekundaer" | "primaer" | "geprueft",
      "buchreife": "roh" | "brauchbar" | "stark" | "final",
      "themen": ["Arbeit","Disziplin","Freiheit","Stil","Koerper","Tod","Scheitern","Ruhm","Freundschaft","Liebe","Natur","Genuss","Risiko","Alter","Einsamkeit"],
      "ton": "z.B. ruhig, radikal, elegant, widersprüchlich",
      "seitenrolle": "haupttext" | "auftakt" | "marginalie" | "bildunterschrift" | "abschluss" | "unentschieden",
      "buchnotiz": "warum dieser Eintrag für das Buch nützlich ist"
    }
  ]
}

Regeln: Niemals Quellen oder URLs erfinden — lieber leer lassen als halluzinieren. quellenqualitaet "geprueft" nur bei klar zugeordneter Primärquelle. Sprache: immer Deutsch.`;
}

function compactEntry(entry) {
  const text = entry.quote || entry.anekdote || entry.fakt || entry.preview || '';
  return {
    id: entry.id,
    kategorie: entry.kategorie || '',
    buch: entry.buch || '',
    preview: entry.preview || '',
    text: String(text).slice(0, 1400),
    quelle: entry.quelle || '',
    quelle_url: entry.quelle_url || '',
    tags: Array.isArray(entry.tags) ? entry.tags.slice(0, 12) : [],
    staerke: entry.staerke || null,
    quellenqualitaet: entry.quellenqualitaet || '',
    buchreife: entry.buchreife || '',
    themen: Array.isArray(entry.themen) ? entry.themen : [],
    ton: entry.ton || '',
    seitenrolle: entry.seitenrolle || '',
    buchnotiz: entry.buchnotiz || ''
  };
}

function compactPerson(person) {
  return {
    id: person.id,
    name: person.name || '',
    dates: person.dates || '',
    status: person.status || '',
    kategorie: person.kategorie || '',
    tags: Array.isArray(person.tags) ? person.tags.slice(0, 20) : [],
    note: String(person.note || '').slice(0, 2500),
    lebensprinzip: person.lebensprinzip || '',
    buchthese: person.buchthese || '',
    archetyp: person.archetyp || '',
    spannung: person.spannung || '',
    visuelles_motiv: person.visuelles_motiv || '',
    format_eignung: Array.isArray(person.format_eignung) ? person.format_eignung : [],
    kurationsnotiz: person.kurationsnotiz || ''
  };
}

// parseAndValidate(result) must return the parsed data or throw. A parse/
// shape failure is treated as retryable too — gemini-3.5-flash occasionally
// returns truncated or malformed JSON, and the whole point of keeping
// gemini-3.1-flash-lite as a second model is to recover from exactly that,
// not just from HTTP-level rate limits.
async function generateWithModelFallback(ai, request, parseAndValidate) {
  let lastErr;
  for (const model of MODELS) {
    try {
      const result = await generateWithTransientRetry(
        ai,
        { ...request, model },
        model === 'gemini-3.5-flash' ? 1 : 3
      );
      const data = parseAndValidate(result);
      return { result, model, data };
    } catch (err) {
      lastErr = err;
      const message = err && err.message ? err.message : '';
      const mayFallback = err.isParseError
        || message.includes('429')
        || message.includes('503')
        || message.includes('quota')
        || message.includes('UNAVAILABLE')
        || message.toLowerCase().includes('high demand');
      if (!mayFallback) throw err;
    }
  }
  throw lastErr;
}

// Grounding needs a Tier 1 (billed) project, so GEMINI_API_KEY stays
// reserved for research calls. Both structuring calls below are plain JSON
// generation with no tools, so they can run on a separate, free-tier
// project's key if one is configured — falling back to the paid key (and
// its own model fallback) on any failure.
async function generateStructured(freeApiKey, paidAi, request, parseAndValidate) {
  if (freeApiKey) {
    try {
      const r = await generateWithModelFallback(new GoogleGenAI({ apiKey: freeApiKey }), request, parseAndValidate);
      return { ...r, usedFreeKey: true };
    } catch (freeErr) {
      console.warn('Free-tier structuring call failed, falling back to paid key:', freeErr.message);
    }
  }
  const r = await generateWithModelFallback(paidAi, request, parseAndValidate);
  return { ...r, usedFreeKey: false };
}

function parseJsonOrThrow(result, validate) {
  let data;
  try {
    data = JSON.parse(result.text);
  } catch (parseErr) {
    const err = new Error('Ungültiges JSON von Gemini: ' + parseErr.message);
    err.isParseError = true;
    throw err;
  }
  if (!validate(data)) {
    const err = new Error('Unerwartetes Antwortformat von Gemini');
    err.isParseError = true;
    throw err;
  }
  return data;
}

module.exports = async function handler(req, res) {
  const requestStartedAt = Date.now();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { person, entries, context, mode, kategorie, count } = req.body || {};
  if (!person || !person.name) return res.status(400).json({ error: 'Person fehlt' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY nicht konfiguriert' });
  const freeApiKey = process.env.GEMINI_API_KEY_FREE;

  const isExpand = mode === 'expand';
  if (isExpand && EXPAND_KATEGORIEN.indexOf(kategorie) < 0) {
    return res.status(400).json({ error: 'Ungültige oder fehlende Kategorie für expand' });
  }
  const expandCount = Math.max(1, Math.min(4, Number(count) || 2));

  const apiKeys = [apiKey, process.env.GEMINI_API_KEY_2].filter(Boolean);
  let lastErr;

  for (const key of apiKeys) {
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const usages = [];
      let grounding = { used: false, sources: [], queries: [] };

      if (isExpand) {
        const existing = (entries || []).slice(0, 60).map(compactEntry);
        let researchNote = '';
        if (SEARCH_GROUNDING_ENABLED) {
          try {
            const existingList = existing.map((e, i) => `${i + 1}. [${e.kategorie}] ${e.text.slice(0, 150)}`).join('\n');
            const expandPrompt = buildExpandResearchPrompt(person.name, kategorie, expandCount + 2, existingList);
            const research = await runGroundedResearch({
              ai, model: MODELS[MODELS.length - 1],
              systemInstruction: expandPrompt.systemInstruction,
              contents: expandPrompt.contents,
              requestStartedAt, operation: 'enhance_expand_research'
            });
            grounding = research.grounding;
            usages.push(research.usage);
            researchNote = `\n\n--- RECHERCHE-ERGEBNISSE (per Google-Suche gefunden) ---\n${research.findingsText}`
              + (research.sourceListText ? `\n\n--- ECHTE, DURCH SUCHE BESTÄTIGTE QUELLEN-URLS (ausschließlich diese für quelle_url verwenden) ---\n${research.sourceListText}` : '');
          } catch (researchErr) {
            console.warn('Grounded expand research failed, falling back to ungrounded structuring:', researchErr.message); grounding.error = researchErr.message;
          }
        }

        const existingList = existing.map((e, i) => `${i + 1}. [${e.kategorie}] ${e.text.slice(0, 150)}`).join('\n');
        const contents = `BEREITS VORHANDENES MATERIAL (nicht wiederholen):\n${existingList || '(noch nichts vorhanden)'}`
          + `\n\nPerson: ${JSON.stringify(compactPerson(person))}`
          + researchNote;

        const generated = await generateStructured(freeApiKey, ai, {
          contents,
          config: {
            systemInstruction: buildExpandPrompt(kategorie, expandCount),
            responseMimeType: 'application/json',
            temperature: 0.6
          }
        }, (result) => parseJsonOrThrow(result, (d) => Array.isArray(d.entries)));
        const { result, model, data, usedFreeKey } = generated;
        const structuringUsage = calculateUsage({
          usageMetadata: result.usageMetadata, model, operation: 'enhance_expand',
          durationMs: Date.now() - requestStartedAt
        });
        if (usedFreeKey) { structuringUsage.estimatedCostUsd = 0; structuringUsage.estimatedCostEur = 0; }
        usages.push(structuringUsage);
        const usage = mergeUsage(usages);
        recordUsage(usage);

        data.entries = data.entries.slice(0, expandCount).map((entry) => {
          const safe = { ...entry, kategorie };
          if (safe.quellenqualitaet === 'geprueft') safe.quellenqualitaet = 'primaer';
          if (safe.buchreife === 'final') safe.buchreife = 'stark';
          if (!grounding.used) safe.quellenqualitaet = 'unbekannt';
          return safe;
        });
        data._meta = { ...(data._meta || {}), usage, grounding };
        return res.status(200).json(data);
      }

      // curate mode (default): score/tag existing entries; only spend a
      // grounded search on entries that actually lack a usable source.
      const entriesToScore = (entries || []).slice(0, 35).map(compactEntry);
      const entriesNeedingSources = entriesToScore.filter(needsSourceSearch);
      let effectiveContext = context || '';

      if (SEARCH_GROUNDING_ENABLED && entriesNeedingSources.length) {
        try {
          const sourcePrompt = buildSourceResearchPrompt(person.name, entriesNeedingSources);
          const research = await runGroundedResearch({
            ai, model: MODELS[MODELS.length - 1],
            systemInstruction: sourcePrompt.systemInstruction,
            contents: sourcePrompt.contents,
            requestStartedAt, operation: 'enhance_research'
          });
          grounding = research.grounding;
          usages.push(research.usage);
          effectiveContext += `\n\nECHTE, DURCH SUCHE GEFUNDENE QUELLEN FÜR EINTRÄGE MIT FEHLENDER QUELLE (Zuordnung über Inhalt, ausschließlich diese URLs verwenden, keine neuen erfinden):\n${research.findingsText}`;
        } catch (researchErr) {
          console.warn('Grounded enhance research failed, falling back to ungrounded curation:', researchErr.message); grounding.error = researchErr.message;
        }
      }

      const payload = {
        context: effectiveContext,
        person: compactPerson(person),
        entries: entriesToScore
      };
      const generated = await generateStructured(freeApiKey, ai, {
        contents: JSON.stringify(payload),
        config: {
          systemInstruction: PROMPT,
          responseMimeType: 'application/json',
          temperature: 0.35
        }
      }, (result) => parseJsonOrThrow(result, (d) => d.person && Array.isArray(d.entries)));
      const { result, model, data, usedFreeKey } = generated;

      const structuringUsage = calculateUsage({
        usageMetadata: result.usageMetadata, model, operation: 'enhance',
        durationMs: Date.now() - requestStartedAt
      });
      if (usedFreeKey) { structuringUsage.estimatedCostUsd = 0; structuringUsage.estimatedCostEur = 0; }
      usages.push(structuringUsage);
      const usage = mergeUsage(usages);
      recordUsage(usage);

      // AI research is a proposal, never a human verification decision.
      data.entries = data.entries.map((entry) => {
        const safe = { ...entry };
        if (safe.quellenqualitaet === 'geprueft') safe.quellenqualitaet = 'primaer';
        if (safe.buchreife === 'final') safe.buchreife = 'stark';
        if (!grounding.used && needsSourceSearch(entriesToScore.find((e) => e.id === safe.id) || {})) safe.quellenqualitaet = 'unbekannt';
        return safe;
      });

      data._meta = { ...(data._meta || {}), usage, grounding };
      return res.status(200).json(data);
    } catch (err) {
      lastErr = err;
      const msg = err && err.message ? err.message : '';
      const isRateLimit = msg.includes('429') || msg.includes('quota') || msg.includes('rate');
      if (isRateLimit && apiKeys.indexOf(key) < apiKeys.length - 1) continue;
      break;
    }
  }

  console.error('Gemini enhance error:', lastErr);
  return res.status(500).json({ error: 'Fehler bei der KI-Kuration: ' + (lastErr && lastErr.message ? lastErr.message : 'unbekannt') });
};

module.exports.needsSourceSearch = needsSourceSearch;
module.exports.buildExpandPrompt = buildExpandPrompt;
module.exports.buildSourceResearchPrompt = buildSourceResearchPrompt;
module.exports.buildExpandResearchPrompt = buildExpandResearchPrompt;
