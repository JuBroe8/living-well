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

function buildSourceResearchPrompt(personName, items) {
  const lines = items.map((e, i) => {
    const text = e.quote || e.anekdote || e.fakt || e.preview || '';
    return `${i + 1}. [${e.kategorie || 'Eintrag'}] "${String(text).slice(0, 300)}"`;
  }).join('\n');
  return `Du bist Recherche-Assistent für ein deutsches Sachbuch über ${personName}.

Für die folgenden bereits im Bestand vorhandenen Einträge fehlt noch eine belastbare Quelle. Nutze die Google-Suche, um für JEDEN einzelnen, nummerierten Eintrag die wahrscheinlichste echte Quelle zu finden (Buch, Interview, Artikel, Archiv):

${lines}

Gib für jeden Eintrag (mit derselben Nummer wie oben) an: die gefundene Quelle (Autor/Publikation) und die echte URL, die dir die Suche dafür geliefert hat. Wenn du für einen Eintrag über die Suche keine belastbare Quelle findest, sag das explizit dazu, anstatt eine zu vermuten. Antworte als lesbare, nummerierte Liste in Klartext, kein JSON. Sprache: Deutsch.`;
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

async function generateWithModelFallback(ai, request) {
  let lastErr;
  for (const model of MODELS) {
    try {
      const result = await generateWithTransientRetry(
        ai,
        { ...request, model },
        model === 'gemini-3.5-flash' ? 1 : 3
      );
      return { result, model };
    } catch (err) {
      lastErr = err;
      const message = err && err.message ? err.message : '';
      const mayFallback = message.includes('429')
        || message.includes('503')
        || message.includes('quota')
        || message.includes('UNAVAILABLE')
        || message.toLowerCase().includes('high demand');
      if (!mayFallback) throw err;
    }
  }
  throw lastErr;
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
            const research = await runGroundedResearch({
              ai, model: MODELS[MODELS.length - 1],
              systemInstruction: `Du recherchierst für ein deutsches Sachbuch über ${person.name}. Finde über die Google-Suche neue, gut belegte Einträge der Kategorie "${kategorie}", die NICHT im bereits vorhandenen Material vorkommen:\n\n${existingList || '(noch nichts vorhanden)'}\n\nGib für jeden Fund den Inhalt, die Quelle und die echte gefundene URL an. Antworte als lesbare Liste in Klartext, kein JSON. Erfinde nichts, was die Suche nicht bestätigt.`,
              contents: `Person: ${person.name} (${person.dates || 'Daten unbekannt'}, ${person.kategorie || ''}). Finde ${expandCount + 2} neue Kandidaten der Kategorie ${kategorie}.`,
              requestStartedAt, operation: 'enhance_expand_research'
            });
            grounding = research.grounding;
            usages.push(research.usage);
            researchNote = `\n\n--- RECHERCHE-ERGEBNISSE (per Google-Suche gefunden) ---\n${research.findingsText}`
              + (research.sourceListText ? `\n\n--- ECHTE, DURCH SUCHE BESTÄTIGTE QUELLEN-URLS (ausschließlich diese für quelle_url verwenden) ---\n${research.sourceListText}` : '');
          } catch (researchErr) {
            console.warn('Grounded expand research failed, falling back to ungrounded structuring:', researchErr.message);
          }
        }

        const existingList = existing.map((e, i) => `${i + 1}. [${e.kategorie}] ${e.text.slice(0, 150)}`).join('\n');
        const contents = `BEREITS VORHANDENES MATERIAL (nicht wiederholen):\n${existingList || '(noch nichts vorhanden)'}`
          + `\n\nPerson: ${JSON.stringify(compactPerson(person))}`
          + researchNote;

        const generated = await generateWithModelFallback(ai, {
          contents,
          config: {
            systemInstruction: buildExpandPrompt(kategorie, expandCount),
            responseMimeType: 'application/json',
            temperature: 0.6
          }
        });
        const { result, model } = generated;
        usages.push(calculateUsage({
          usageMetadata: result.usageMetadata, model, operation: 'enhance_expand',
          durationMs: Date.now() - requestStartedAt
        }));
        const usage = mergeUsage(usages);
        recordUsage(usage);

        let data;
        try {
          data = JSON.parse(result.text);
        } catch (parseErr) {
          return res.status(500).json({ error: 'Ungültiges JSON von Gemini: ' + parseErr.message, _meta: { usage, grounding } });
        }
        if (!Array.isArray(data.entries)) {
          return res.status(500).json({ error: 'Unerwartetes Antwortformat von Gemini', _meta: { usage, grounding } });
        }

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
          const research = await runGroundedResearch({
            ai, model: MODELS[MODELS.length - 1],
            systemInstruction: buildSourceResearchPrompt(person.name, entriesNeedingSources),
            contents: `Recherchiere Quellen für die ${entriesNeedingSources.length} oben genannten Einträge von ${person.name}.`,
            requestStartedAt, operation: 'enhance_research'
          });
          grounding = research.grounding;
          usages.push(research.usage);
          effectiveContext += `\n\nECHTE, DURCH SUCHE GEFUNDENE QUELLEN FÜR EINTRÄGE MIT FEHLENDER QUELLE (Zuordnung über Inhalt, ausschließlich diese URLs verwenden, keine neuen erfinden):\n${research.findingsText}`;
        } catch (researchErr) {
          console.warn('Grounded enhance research failed, falling back to ungrounded curation:', researchErr.message);
        }
      }

      const payload = {
        context: effectiveContext,
        person: compactPerson(person),
        entries: entriesToScore
      };
      const generated = await generateWithModelFallback(ai, {
        contents: JSON.stringify(payload),
        config: {
          systemInstruction: PROMPT,
          responseMimeType: 'application/json',
          temperature: 0.35
        }
      });
      const { result, model } = generated;

      usages.push(calculateUsage({
        usageMetadata: result.usageMetadata, model, operation: 'enhance',
        durationMs: Date.now() - requestStartedAt
      }));
      const usage = mergeUsage(usages);
      recordUsage(usage);

      let data;
      try {
        data = JSON.parse(result.text);
      } catch (parseErr) {
        return res.status(500).json({ error: 'Ungültiges JSON von Gemini: ' + parseErr.message, _meta: { usage } });
      }
      if (!data.person || !Array.isArray(data.entries)) {
        return res.status(500).json({ error: 'Unerwartetes Antwortformat von Gemini', _meta: { usage } });
      }

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
