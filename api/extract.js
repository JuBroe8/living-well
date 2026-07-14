const { GoogleGenAI } = require('@google/genai');
const { calculateUsage, recordUsage } = require('./ai-usage');

// The frequent name-to-dossier workflow uses the free-tier model with the
// highest daily allowance.
const MODEL = 'gemini-3.1-flash-lite';
const SEARCH_GROUNDING_ENABLED = process.env.GEMINI_ENABLE_SEARCH_GROUNDING === 'true';

const BASE_PROMPT = `Du bist Forschungsassistent für ein deutsches Sachbuch mit dem Arbeitstitel "Living Well".

Das Buch porträtiert historische und zeitgenössische Persönlichkeiten, die auf ihre Art vorbildlich oder faszinierend gelebt haben — nicht unbedingt moralisch vorbildlich, sondern charakterstark, konsequent, mit einer klaren Haltung zur Welt. Die Leser sollen durch konkrete Geschichten und Zitate inspiriert werden, ihr eigenes Leben bewusster zu gestalten.

Interessante Personen für dieses Buch sind u.a.:
- Stoische Philosophen (Marc Aurel, Epiktet, Seneca) und andere Weisheitslehrer
- Künstler und Schriftsteller mit extremer Disziplin oder ungewöhnlichem Lebensstil (Kafka, Hemingway, O'Keeffe)
- Sportler mit philosophischer Tiefe (Ali, Federer, Senna)
- Unternehmer oder Visionäre, die gegen Konventionen lebten (Jobs, Tesla, Patagonia-Gründer)
- Wissenschaftler mit ungewöhnlicher Lebensführung (Feynman, Curie, Darwin)
- Außenseiter und Rebellen, die trotzdem Bleibendes hinterließen

Besonders wertvoll sind:
- Konkrete, erzählbare Anekdoten mit Ort, Zeit, Dialog — keine abstrakten Beschreibungen
- Überraschende oder wenig bekannte Fakten
- Zitate, die direkt als Kapitelauftakt oder Impuls verwendbar sind
- Beobachtungen zu Gewohnheiten, Ritualen, Stil (Morgenroutinen, Arbeitsweise, Umgang mit Scheitern)

Du gibst IMMER nur valides JSON zurück — keine Erklärungen, keine Markdown-Blöcke, kein Text davor oder danach.

Format:
{
  "person": {
    "name": "Vollständiger Name",
    "kategorie": "z.B. Philosoph, Künstler, Wissenschaftler, Sportler, Unternehmer, Schriftsteller",
    "dates": "z.B. 55–135 n.Chr. oder 1929–heute",
    "status": "kandidat",
    "tags": ["tag1", "tag2", "tag3"],
    "note": "Biografie in 4-6 Sätzen: wer sie waren, was sie auszeichnet, wie sie lebten — prägnant, lesbar, keine Wikipedia-Prosa",
    "lebensprinzip": "Ein prägnanter Satz: Welche Antwort auf das gute Leben verkörpert diese Person?",
    "buchthese": "Warum gehört diese Person in dieses Buch? 1-2 kuratorische Sätze.",
    "archetyp": "Kurzer Archetyp, z.B. Der Stoiker, Die Stilistin, Der Besessene, Die Unbeugsame",
    "spannung": "Der produktive Widerspruch oder innere Konflikt, der die Person interessant macht",
    "visuelles_motiv": "Konkretes Bildmotiv für ein Coffee-Table-Book, z.B. Schreibtisch, Atelier, Ring, Garten",
    "format_eignung": ["doppelseite", "kurzprofil"],
    "kurationsnotiz": "Knapp: Was müsste man prüfen, vertiefen oder später entscheiden?"
  },
  "entries": [
    {
      "kategorie": "Anekdote",
      "buch": "hintergrund",
      "anekdote": "Konkrete, erzählerische Anekdote — spezifisch, mit Kontext, überraschend",
      "preview": "Erste 100–120 Zeichen der Anekdote",
      "quelle": "Quellenangabe oder leer",
      "quelle_url": "URL oder leer",
      "tags": ["tag1", "tag2"],
      "staerke": 4,
      "quellenqualitaet": "sekundaer",
      "buchreife": "brauchbar",
      "themen": ["Disziplin", "Scheitern"],
      "ton": "ruhig, radikal, elegant, widersprüchlich o.ä.",
      "seitenrolle": "haupttext",
      "buchnotiz": "Warum dieser Eintrag für das Buch nützlich ist"
    },
    {
      "kategorie": "Zitat",
      "buch": "direkt",
      "quote": "Authentisches Zitat auf Deutsch (bei Fremdsprache: Original + Übersetzung)",
      "preview": "Erste 100–120 Zeichen",
      "quelle": "Werk oder Kontext",
      "quelle_url": "URL oder leer",
      "tags": ["weisheit"],
      "staerke": 5,
      "quellenqualitaet": "primaer",
      "buchreife": "stark",
      "themen": ["Freiheit"],
      "ton": "konzentriert",
      "seitenrolle": "auftakt",
      "buchnotiz": "Warum das Zitat als Auftakt, Marginalie oder Abschluss funktioniert"
    },
    {
      "kategorie": "Fakt",
      "buch": "hintergrund",
      "fakt": "Präziser, wenig bekannter oder überraschender Fakt",
      "preview": "Erste 100–120 Zeichen",
      "quelle": "",
      "quelle_url": "",
      "tags": ["tag1"],
      "staerke": 3,
      "quellenqualitaet": "unbekannt",
      "buchreife": "roh",
      "themen": ["Arbeit"],
      "ton": "",
      "seitenrolle": "marginalie",
      "buchnotiz": ""
    }
  ]
}

PFLICHTREGELN — ZWINGEND EINHALTEN:

1. IMMER mindestens 2 Anekdoten liefern:
   - Eine Anekdote ist eine konkrete SZENE oder GESCHICHTE — mit Ort, Zeit, handelnden Personen, Verlauf
   - NICHT: "Er war bekannt für seine Disziplin" (das ist ein Fakt)
   - SONDERN: "Als Epiktet einmal von seinem Herrn am Bein gedreht wurde, sagte er ruhig: 'Du wirst es brechen.' Als das Bein tatsächlich brach, fügte er hinzu: 'Habe ich es nicht gesagt?'"
   - Anekdoten haben ein konkretes Ereignis, keine allgemeinen Beschreibungen

2. IMMER mindestens 2 Zitate liefern:
   - Nur wörtliche, authentische Zitate — keine paraphrasierten Aussagen
   - Fremdsprachige Zitate: Original + deutsche Übersetzung
   - NICHT: "Er sprach oft über die Vergänglichkeit des Lebens" (das ist kein Zitat)
   - SONDERN: "Du hast Macht über deinen Geist, nicht über äußere Ereignisse. Erkenne das, und du wirst Stärke finden." (Marc Aurel)

3. Fakten sind ZUSÄTZLICH erlaubt, aber nie als Ersatz für Anekdoten/Zitate

4. Stil-Einträge (Gewohnheiten, Rituale) — PFLICHT wenn bekannte Routinen existieren:
   - Wenn diese Person für bestimmte Gewohnheiten, Rituale, Morgenroutinen, Arbeitspraktiken, Kleidung oder Umgebung bekannt ist: IMMER mindestens einen Stil-Eintrag liefern
   - NICHT: "Er war früh auf und arbeitete morgens" (das ist ein Fakt)
   - SONDERN: "Hemingway stellte seinen Schreibtisch täglich auf dieselbe Höhe ein, schrieb stets im Stehen, und hörte auf, wenn er noch wusste, wie der nächste Satz weiterging — damit er nie vor einem leeren Anfang saß."
   - Stil-Einträge sind oft die buchstärksten Momente: sie machen abstrakte Charaktereigenschaften konkret sichtbar

5. Mindestverteilung bei 4+ Einträgen: 2 Anekdoten + 2 Zitate + 1 Stil (wenn material vorhanden) + Rest frei

Weitere Regeln:
- kategorie: NUR "Anekdote", "Zitat", "Fakt" oder "Stil" (exakt so geschrieben)
- buch: "direkt" = Eintrag könnte fast unverändert ins Buch (staerke ≥ 4 UND buchreife "stark" oder "final"); "hintergrund" = Recherchematerial, braucht noch Arbeit — im Zweifel "hintergrund"
- format_eignung: nur Werte aus ["doppelseite","kurzprofil","kapitelauftakt","randnotiz","zitatseite"]
- quellenqualitaet: nur "unbekannt", "sekundaer", "primaer" oder "geprueft"
- buchreife: nur "roh", "brauchbar", "stark" oder "final"
- seitenrolle: nur "haupttext", "auftakt", "marginalie", "bildunterschrift", "abschluss" oder "unentschieden"
- themen: nur Werte aus ["Arbeit","Disziplin","Freiheit","Stil","Koerper","Tod","Scheitern","Ruhm","Freundschaft","Liebe","Natur","Genuss","Risiko","Alter","Einsamkeit"]
- staerke: Zahl von 1 bis 5; 5 = ikonisch/hoch erzählbar, 1 = schwach/kaum buchreif
- Sprache: immer Deutsch
- preview immer befüllen (erste ~100 Zeichen des Haupttexts)
- tags: 2–4 Schlagwörter auf Deutsch
- Quellen aktiv recherchieren: Für jedes Zitat und jede Anekdote die wahrscheinlichste Primärquelle angeben (Buch, Brief, Rede, Biographie). Format: "Autor, Werktitel, Kapitel/Brief" — z.B. "Seneca, Epistulae Morales, Brief 1" oder "Walter Isaacson, Steve Jobs, Kapitel 11". Wenn eine verifizierbare URL bekannt ist (Wikipedia, Gutenberg, Stanford Encyclopedia), diese in quelle_url eintragen.
- quellenqualitaet entsprechend setzen: "geprueft" bei klarer Primärquelle, "primaer" bei plausibel zuordenbarem Originalwerk, "sekundaer" bei Biographie oder Sekundärliteratur, "unbekannt" nur wenn wirklich keine plausible Quelle existiert.
- Niemals Quellen oder URLs erfinden oder raten — lieber leer lassen als halluzinieren
- lebensprinzip, buchthese, archetyp, spannung und visuelles_motiv sind kuratorische Vorschläge, keine Faktenbehauptungen`;

// Gemini does not reliably combine tools (googleSearch) with
// responseMimeType: 'application/json' in one call — the JSON constraint
// wins and the search tool is silently skipped, so quelle_url ends up being
// reconstructed from training memory rather than a live search. This prompt
// runs as a separate, ungrounded-format research pass so the search tool
// actually fires; its plain-text findings + real source URLs are then fed
// into the normal JSON-structuring call.
const RESEARCH_PROMPT = `Du bist Recherche-Assistent für ein deutsches Sachbuch mit dem Arbeitstitel "Living Well" (Porträts von Menschen, die ihr Leben radikal nach einer eigenen Idee lebten — mit ihrer Inspiration, ihren Widersprüchen und ihrem Preis).

Nutze die Google-Suche, um zur genannten Person konkrete, gut belegte Anekdoten (mit Ort, Zeit, Ablauf), wörtliche Zitate, überraschende Fakten und bekannte Gewohnheiten/Rituale zu finden.

Gib für jeden Fund an:
- den Inhalt möglichst konkret und wörtlich
- die Quelle (Autor, Werk, Publikation, Datum)
- die echte URL, die dir die Suche dafür geliefert hat

Antworte als lesbare Liste in Klartext, kein JSON. Erfinde niemals eine Quelle oder URL — wenn du zu einem Fund über die Suche keine belastbare Quelle findest, sag das explizit dazu, anstatt eine zu vermuten. Sprache: Deutsch.`;

async function fetchUrl(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'de,en;q=0.9'
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;
    const html = await res.text();
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' ')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 10000);
    return text || null;
  } catch {
    return null;
  }
}

function detectUrls(text) {
  return (text.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/g) || []).slice(0, 2);
}

// Grounds the model's idea of a "good source" in citations the redaction has
// already vetted, instead of only the abstract format rules in BASE_PROMPT.
function buildSourceExamplesBlock(examples) {
  if (!Array.isArray(examples) || !examples.length) return '';
  const lines = examples
    .filter((e) => e && typeof e === 'object' && e.quelle)
    .slice(0, 5)
    .map((e, i) => {
      const quelle = String(e.quelle).slice(0, 200);
      const url = e.quelle_url ? String(e.quelle_url).slice(0, 300) : '';
      const quality = e.quellenqualitaet ? String(e.quellenqualitaet).slice(0, 20) : '';
      return `${i + 1}. ${quelle}${url ? ` (${url})` : ''}${quality ? ` — Qualität: ${quality}` : ''}`;
    });
  if (!lines.length) return '';
  return `\n\nBEISPIELE FÜR BEREITS GEPRÜFTE, GUTE QUELLENANGABEN IN UNSEREM BESTAND:\n${lines.join('\n')}\nRichte Recherche und Quellenformat an Art und Präzision dieser Beispiele aus — bevorzuge denselben Quellentyp (Primärwerke, seriöse Biographien, geprüfte Archive), nicht Social Media oder unbelegte Zusammenfassungen.`;
}

function groundingSummary(result) {
  const metadata = result && result.candidates && result.candidates[0] && result.candidates[0].groundingMetadata;
  if (!metadata) return { used: false, sources: [], queries: [] };
  const sources = (metadata.groundingChunks || []).map((chunk) => chunk && chunk.web).filter(Boolean).map((web) => ({
    title: web.title || '',
    url: web.uri || ''
  }));
  return { used: sources.length > 0, sources, queries: metadata.webSearchQueries || [] };
}

function sumField(list, key) {
  let total = 0;
  for (const u of list) {
    if (u[key] === null || u[key] === undefined) return null;
    total += u[key];
  }
  return total;
}

// Combines the research-call and structuring-call usage into a single
// ai_runs row so a grounded extract still shows up as one cost line, not two.
function mergeUsage(usages) {
  const valid = usages.filter(Boolean);
  if (!valid.length) return null;
  if (valid.length === 1) return valid[0];
  return {
    operation: 'extract',
    model: valid[valid.length - 1].model,
    promptTokens: sumField(valid, 'promptTokens'),
    outputTokens: sumField(valid, 'outputTokens'),
    thinkingTokens: sumField(valid, 'thinkingTokens'),
    totalTokens: sumField(valid, 'totalTokens'),
    groundingRequests: valid.reduce((acc, u) => acc + (u.groundingRequests || 0), 0),
    estimatedCostUsd: sumField(valid, 'estimatedCostUsd'),
    estimatedCostEur: sumField(valid, 'estimatedCostEur'),
    durationMs: valid.reduce((acc, u) => acc + (u.durationMs || 0), 0),
    pricing: valid[valid.length - 1].pricing
  };
}

async function generateWithTransientRetry(ai, request) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await ai.models.generateContent(request);
    } catch (err) {
      lastErr = err;
      const message = err && err.message ? err.message : '';
      const transient = message.includes('503')
        || message.includes('UNAVAILABLE')
        || message.toLowerCase().includes('high demand');
      if (!transient || attempt === 2) throw err;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
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

  const { input, context, sourceExamples } = req.body || {};
  if (!input || !input.trim()) return res.status(400).json({ error: 'Input fehlt' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY nicht konfiguriert' });

  // Enrich input with URL content
  const urls = detectUrls(input);
  let enrichedInput = input;

  for (const url of urls) {
    if (url.includes('instagram.com')) {
      enrichedInput += `\n\n[Instagram-Link: ${url} — Caption bitte manuell einfügen]`;
      continue;
    }
    const content = await fetchUrl(url);
    if (content) {
      enrichedInput += `\n\n--- Seiteninhalt von ${url} ---\n${content}`;
    }
  }

  const systemPrompt = BASE_PROMPT
    + buildSourceExamplesBlock(sourceExamples)
    + (context && context.trim() ? `\n\nZUSÄTZLICHER FOKUS FÜR DIESE RECHERCHE:\n${context.trim()}` : '');

  const apiKeys = [apiKey, process.env.GEMINI_API_KEY_2].filter(Boolean);
  let lastErr;

  for (const key of apiKeys) {
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const usages = [];
      let structuringInput = enrichedInput;
      let grounding = { used: false, sources: [], queries: [] };

      if (SEARCH_GROUNDING_ENABLED) {
        try {
          const researchResult = await generateWithTransientRetry(ai, {
            model: MODEL,
            contents: enrichedInput,
            config: { systemInstruction: RESEARCH_PROMPT, tools: [{ googleSearch: {} }], temperature: 0.3 }
          });
          grounding = groundingSummary(researchResult);
          usages.push(calculateUsage({
            usageMetadata: researchResult.usageMetadata,
            model: MODEL,
            operation: 'extract_research',
            durationMs: Date.now() - requestStartedAt,
            groundingRequestCount: grounding.used ? Math.max(1, grounding.queries.length) : 0
          }));
          const sourceList = grounding.sources
            .filter((s) => s.url)
            .map((s, i) => `${i + 1}. ${s.title || s.url} — ${s.url}`)
            .join('\n');
          structuringInput = enrichedInput
            + `\n\n--- RECHERCHE-ERGEBNISSE (per Google-Suche gefunden) ---\n${researchResult.text || ''}`
            + (sourceList
              ? `\n\n--- ECHTE, DURCH SUCHE BESTÄTIGTE QUELLEN-URLS (für quelle_url ausschließlich diese verwenden, keine neuen erfinden) ---\n${sourceList}`
              : '');
        } catch (researchErr) {
          console.warn('Grounded research step failed, falling back to ungrounded structuring:', researchErr.message);
        }
      }

      const result = await generateWithTransientRetry(ai, {
        model: MODEL,
        contents: structuringInput,
        config: { systemInstruction: systemPrompt, responseMimeType: 'application/json', temperature: 0.55 }
      });

      usages.push(calculateUsage({
        usageMetadata: result.usageMetadata,
        model: MODEL,
        operation: 'extract',
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

      if (!data.person || !data.entries) {
        return res.status(500).json({ error: 'Unerwartetes Antwortformat von Gemini', _meta: { usage, grounding } });
      }

      // AI research is a proposal, never a human verification decision.
      data.entries = data.entries.map((entry) => {
        const safe = { ...entry };
        if (safe.quellenqualitaet === 'geprueft') safe.quellenqualitaet = 'primaer';
        if (safe.buchreife === 'final') safe.buchreife = 'stark';
        if (!grounding.used) safe.quellenqualitaet = 'unbekannt';
        return safe;
      });

      data._meta = { ...(data._meta || {}), usage, grounding };
      return res.status(200).json(data);
    } catch (err) {
      lastErr = err;
      const isRateLimit = err.message && (err.message.includes('429') || err.message.includes('quota') || err.message.includes('rate'));
      if (isRateLimit && apiKeys.indexOf(key) < apiKeys.length - 1) {
        console.warn('Rate limit, trying next API key...');
        continue;
      }
      break;
    }
  }

  console.error('Gemini error:', lastErr);
  return res.status(500).json({ error: 'Fehler bei der KI-Analyse: ' + lastErr.message });
};

module.exports.buildSourceExamplesBlock = buildSourceExamplesBlock;
module.exports.mergeUsage = mergeUsage;
