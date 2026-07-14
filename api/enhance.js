const { GoogleGenAI } = require('@google/genai');
const { calculateUsage, recordUsage } = require('./ai-usage');

const MODELS = ['gemini-3.5-flash', 'gemini-3.1-flash-lite'];

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
3. Quellen aktiv recherchieren:
   - quelle (Textfeld): Wenn du ein Zitat oder eine Anekdote einer bekannten Primärquelle zuordnen kannst (Buch, Brief, Rede, Biographie), gib diese an. Format: "Autor, Werktitel, Kapitel/Brief/Seite". Beispiele: "Seneca, Epistulae Morales, Brief 1", "Marcus Aurelius, Selbstbetrachtungen, Buch IV", "Robert A. Caro, The Power Broker, Kapitel 12".
   - quelle_url: Nur befüllen, wenn eine verifizierbare, öffentlich zugängliche URL bekannt ist (Wikipedia, Gutenberg, Stanford Encyclopedia of Philosophy, offizielle Biographie-Seiten). Niemals URLs erfinden oder raten.
   - Wenn die Quelle gut bekannt ist aber keine URL existiert: quelle befüllen, quelle_url leer lassen.
4. quellenqualitaet korrekt setzen:
   - "geprueft": klar zugeordnete Primärquelle (das Originalwerk) vorhanden
   - "primaer": Zitat oder Anekdote direkt aus dem Werk der Person, Quelle plausibel aber nicht 100% verifiziert
   - "sekundaer": aus Biographie, Sekundärliteratur oder gut belegten Sammlungen
   - "unbekannt": keine plausible Quelle identifizierbar — ehrlich bleiben
5. Bei zweifelhaften oder nur behaupteten Zitaten: buchreife nicht "final"; quellenqualitaet nicht "geprueft".
6. tags sind freie Schlagwörter; themen sind die kuratorischen Hauptmotive. Nutze tag_mapping, um bestehende Tags auf Themen abzubilden.
7. Sprache immer Deutsch.`;

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

async function generateWithTransientRetry(ai, request, maxAttempts = 3) {
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await ai.models.generateContent(request);
    } catch (err) {
      lastErr = err;
      const message = err && err.message ? err.message : '';
      const transient = message.includes('503')
        || message.includes('UNAVAILABLE')
        || message.toLowerCase().includes('high demand');
      if (!transient || attempt === maxAttempts - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastErr;
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

  const { person, entries, context } = req.body || {};
  if (!person || !person.name) return res.status(400).json({ error: 'Person fehlt' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY nicht konfiguriert' });

  const payload = {
    context: context || '',
    person: compactPerson(person),
    entries: (entries || []).slice(0, 35).map(compactEntry)
  };

  const apiKeys = [apiKey, process.env.GEMINI_API_KEY_2].filter(Boolean);
  let lastErr;

  for (const key of apiKeys) {
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const generated = await generateWithModelFallback(ai, {
        contents: JSON.stringify(payload),
        config: {
          systemInstruction: PROMPT,
          responseMimeType: 'application/json',
          temperature: 0.35
        }
      });
      const { result, model } = generated;

      const usage = calculateUsage({
        usageMetadata: result.usageMetadata,
        model,
        operation: 'enhance',
        durationMs: Date.now() - requestStartedAt
      });
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

      data._meta = { ...(data._meta || {}), usage };
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
