# Living Well — Projekt-Audit

Stand: 14. Juli 2026

## Kurzurteil

Die Grundidee trägt: Nicht „erfolgreiche Menschen“ sind das Thema, sondern Menschen, die ihr Leben konsequent nach einer eigenen Idee formten. Das ist eigenständig genug für eine Buchmarke und offen genug für mehrere spätere Bände.

Das bisher größte Problem war nicht die Menge des Materials, sondern die Vermischung von drei Fragen:

1. Ist eine Person grundsätzlich interessant?
2. Passt sie in diesen konkreten Band?
3. Ist ihr Dossier schon belastbar genug?

Diese Fragen brauchen getrennte Daten und getrennte Anzeigen. Ein einziger Prozentwert erzeugt sonst Scheingenauigkeit.

## Inhalt und Idee

### Was stark ist

- Der Bestand ist breit genug, um wirklich kuratieren zu können, statt ein frühes Inhaltsverzeichnis nur noch zu befüllen.
- Konkrete Szenen, Rituale, Zitate und Widersprüche sind eine gute redaktionelle Einheit für ein visuell gedachtes Sachbuch.
- Die Mischung aus Inspiration und Preis verhindert reine Heldenverehrung.
- Die Idee kann später als Reihe funktionieren, ohne dass heute schon eine Reihenarchitektur festgelegt werden muss.

### Was noch geschärft werden muss

- „Living Well“ darf nicht als allgemeine Sammlung interessanter Biografien wirken. Jede Figur braucht eine erkennbare Antwort auf die Frage: Welche eigene Lebensidee wurde hier tatsächlich gelebt?
- „Radikal“ sollte nicht nur exzentrisch oder extrem bedeuten, sondern eine sichtbare Konsequenz zwischen Idee, Alltag und Entscheidung.
- Der „Preis“ ist unverzichtbar. Ohne Widerspruch, Ausschluss oder Kosten wird ein Profil schnell motivationale Oberfläche.
- Die Auswahl muss als Ensemble funktionieren. Zwölf einzeln starke, aber ähnlich gelagerte Männer aus Kunst und Unternehmertum ergeben noch keinen starken Band.

## Empfohlene Buchstruktur

Der Start ist ein epochen- und bereichsübergreifender Pilotband mit der Leitthese:

> Living Well porträtiert Menschen, die ihr Leben radikal nach einer eigenen Idee formten – und zeigt an konkreten Szenen, was daran inspirierend, widersprüchlich und teuer war.

Der Pilot testet Form, Ton, Bildsprache und Zielgruppe. Erst danach sollte entschieden werden, ob weitere Bände nach Thema, Zeit, Richtung oder Spannung organisiert werden.

## Datenaudit des Bestands

Momentaufnahme vor der Strukturmigration:

- 119 Personen
- 106 Einträge
- 22 Orte
- Nur 33 Personen waren über den bisherigen Namens-String eindeutig mit Einträgen verbunden.
- 86 Personen hatten kein zugeordnetes Material.
- 28 Einträge beziehungsweise 23 Namensgruppen waren verwaist oder nicht eindeutig zuordenbar.
- 84 Einträge waren zugleich roh und mit unbekannter Quellenqualität markiert.
- 73 als „direkt“ markierte Einträge hatten trotzdem unbekannte Quellenqualität.
- Es gab nur drei Quellen-URLs; alle drei waren technisch unvollständig.
- 37 Quellenangaben verwiesen lediglich auf Instagram, 17 auf Wikipedia.
- Fünf als „final“ markierte Einträge waren nicht geprüft.

### Konsequenz

Der bestehende Bestand ist wertvolles Rohmaterial, aber noch keine belastbare Buchauswahl. Insbesondere `direkt`, `final` und der alte globale Reife-Score dürfen nicht als verlässliche redaktionelle Aussage behandelt werden.

## Neues Strukturprinzip

### Personenpool

Der Pool bleibt absichtlich breit. Eine Person kann hier schnell nur mit Namen erfasst werden. Fehlendes Material oder fehlender Pilot-Fit löscht sie nicht aus dem langfristigen Bestand.

### Bandkandidaten

Die Passung gehört in die Beziehung zwischen Person und Band. Für den Pilot werden sechs Kriterien mit jeweils 0–2 Punkten bewertet:

1. Eigene, radikale Lebensidee
2. Szenische Ergiebigkeit
3. Produktiver Widerspruch und Preis
4. Heutige Resonanz und Inspiration
5. Visuelles und formatliches Potenzial
6. Eigenständiger Beitrag zum Ensemble

### Dossier

Der Recherchefortschritt wird separat über acht überprüfbare Punkte gezeigt: These, Prinzip, Widerspruch, zwei Szenen, belastbares Zitat, geprüfte Quellen, visuelles Motiv und redaktionelles Fazit.

## UX-Audit

### Vorherige Probleme

- Navigation und Dashboard bildeten Tabellen und Materialtypen ab, aber nicht den eigentlichen redaktionellen Arbeitsfluss.
- Der globale Prozentwert konnte trotz offener Quellen 100 Prozent anzeigen.
- Auf 390 Pixel breiten Geräten entstand horizontales Seiten-Overflow.
- Die schnelle mobile Erfassung war mit dem vollständigen KI-Formular gekoppelt; ein Name war bei einem Abbruch noch nicht sicher gespeichert.
- Einige klickbare Navigationselemente waren semantisch keine Buttons.

### Ziel-Workflow

1. Name erfassen
2. Sofort im Pool speichern
3. Optional Recherchejob starten
4. KI-Vorschläge prüfen
5. Material übernehmen
6. Pilot-Fit menschlich bewerten
7. Shortlist und Ensemble kuratieren

Die Hauptnavigation folgt deshalb künftig `Arbeitsplatz → Pilotband → Personenpool → Recherche`, ergänzt um einen permanenten mobilen `+ Name`-Einstieg.

## Technik und Betrieb

- `entries.person` als Textbeziehung wird durch `entries.person_id` ergänzt und per normalisiertem Namen zurückgefüllt.
- `books` und `book_candidates` trennen den langfristigen Bestand von konkreten Bänden.
- `research_jobs` hält Quick-Capture und spätere Messenger-Eingänge in einem gemeinsamen Workflow.
- `ai_runs` protokolliert Modell, Token, Dauer und geschätzte Kosten pro Lauf.
- Die Namensrecherche nutzt Gemini 3.5 Flash mit Google-Search-Grounding und speichert die gelieferten Quellenmetadaten. KI-Ergebnisse werden höchstens als `primaer`/`stark`, niemals automatisch als menschlich `geprueft`/`final` übernommen.
- Die Kostenschätzung enthält Token und konservative Search-Grenzkosten. Freikontingente können die reale Rechnung senken; Preise und EUR-Kurs lassen sich über `GEMINI_INPUT_PRICE_USD_PER_1M`, `GEMINI_OUTPUT_PRICE_USD_PER_1M`, `GEMINI_SEARCH_PRICE_USD_PER_REQUEST` und `GEMINI_USD_TO_EUR_RATE` überschreiben.
- Die Anwendung bleibt wie gewünscht ohne Login. Anonyme Rechte werden trotzdem auf notwendige Spalten und `SELECT/INSERT/UPDATE` begrenzt; Löschen wird nicht freigegeben.

Der Supabase-Sicherheitsberater meldet deshalb weiterhin die bewusst offenen `INSERT`-/`UPDATE`-Policies für `persons` und `entries`. Das ist kein Schutzversprechen: Ohne Login oder gemeinsames Schreibgeheimnis kann jeder mit der öffentlichen Projektkonfiguration erlaubte Felder verändern. Die Migration reduziert den möglichen Schaden durch Spaltenrechte und fehlende Löschrechte, beseitigt dieses Grundrisiko aber nicht.

## Prioritäten

1. Pilot-Fit für 20–30 plausible Personen bewerten.
2. Daraus eine Shortlist von etwa 15 und ein Ensemble von 10–12 Kernfiguren bilden.
3. Für diese Auswahl zuerst Quellenlücken und zweite Szenen schließen.
4. Zwei bis drei Musterprofile wirklich schreiben und gestalten.
5. Erst anhand dieser Prototypen über engere Folgebände entscheiden.
