# Living Well — Umsetzung: Workflow, Struktur und UI-Polish

Stand: 15. Juli 2026

## Auftrag

Die bestehende Anwendung soll einfacher, zielgerichteter und gestalterisch ruhiger werden. Die visuelle Grundsprache bleibt erhalten: warme neutrale Flächen, schwarze Navigation, Serifenschrift für redaktionelle Akzente und zurückhaltende Statusfarben.

Der Schwerpunkt liegt auf:

- einem durchgängigen redaktionellen Workflow,
- weniger gleichwertigen Navigationspunkten und Aktionen,
- klaren nächsten Aufgaben,
- einer übersichtlicheren Personenansicht,
- einer engeren Verbindung von Pilotband und Seitenwerkstatt,
- einer vorsichtigen technischen Modularisierung.

## Ausdrücklich nicht Teil dieses Auftrags

- Login oder Authentifizierung
- Änderungen an den bestehenden anonymen Supabase-Rechten
- Rate-Limits oder andere Sicherheitsmaßnahmen
- vollständiger Framework-Wechsel
- grundlegendes visuelles Rebranding

Die Anwendung soll weiterhin ohne Anmeldung auf Mobilgerät und Laptop nutzbar sein.

## Leitprinzip

Der sichtbare Produktfluss lautet überall:

`Name erfassen → Recherche prüfen → Dossier vervollständigen → Pilot-Fit bewerten → Shortlist → Im Pilot → Seite gestalten`

Jede Ansicht soll beantworten:

1. Wo befindet sich dieses Objekt im Prozess?
2. Was fehlt noch?
3. Was ist die eine sinnvollste nächste Aktion?

## Technische Ausgangslage

- Das Frontend befindet sich überwiegend in `index.html`.
- Die Anwendung nutzt Vanilla JavaScript und direktes Supabase-REST.
- Der Personenpool, die Einträge, die Bandkandidaten und die Seiten werden beim Start vollständig geladen.
- `book_candidates.stage = pool` enthält den Großteil der Kandidaten.
- Das aktuelle Pilotboard rendert nur `pruefen`, `shortlist`, `selected` und `parked`.
- Der Seiteneditor speichert eine komplette Seite als JSONB-Blockliste.

Bestehende Daten dürfen nicht gelöscht oder automatisch neu klassifiziert werden.

---

## Phase 1 — Pilotband als funktionierenden Workflow herstellen

### Problem

Das Pilotband meldet viele Personen „im Workflow“, zeigt aber leere Spalten, weil Kandidaten im Status `pool` nicht im Board erscheinen.

### Umsetzung

1. Oberhalb des Boards eine Sektion **„Als Nächstes prüfen“** ergänzen.
2. Dort Kandidaten mit `stage = pool` anzeigen.
3. Standardmäßig maximal 12 Kandidaten laden; weitere über „Mehr anzeigen“.
4. Sortierung der Prüfliste:
   - Dossier mit mindestens 5/8 zuerst,
   - danach Anzahl vorhandener Einträge,
   - danach Name.
5. Jede Karte zeigt nur:
   - Name,
   - Kategorie,
   - Dossierstand,
   - Anzahl Einträge,
   - fehlende Hauptpunkte,
   - Aktion **„Fit bewerten“**.
6. „Fit bewerten“ öffnet das Personenprofil und klappt das Fit-Panel direkt auf.
7. Die Kennzahl **„Im Workflow“** darf nicht unsichtbare Pool-Kandidaten und sichtbare Boardkarten vermischen. Neue Kennzahlen:
   - Noch zu prüfen
   - Bewertet
   - Shortlist
   - Im Pilot
8. Für leere Boardspalten hilfreiche Texte einsetzen, beispielsweise:
   - „Bewertete Personen können hier auf die Shortlist gesetzt werden.“
   - „Noch niemand ausgewählt. Beginne oben mit der Prüfung.“

### Akzeptanzkriterien

- Die aktuell im Pool liegenden Kandidaten sind auf der Pilotseite erreichbar.
- Von der Pilotseite gelangt man mit einem Klick zur Fit-Bewertung.
- Keine Kennzahl behauptet einen sichtbaren Workflow, der darunter leer ist.
- Das bestehende Vier-Spalten-Board bleibt für bewertete Kandidaten erhalten.

---

## Phase 2 — Arbeitsplatz auf nächste Aufgaben reduzieren

### Ziel

Der Arbeitsplatz wird zur operativen Startseite und nicht zur Zusammenfassung aller Daten.

### Umsetzung

1. Die große Einführung verkürzen.
2. Primäre Aktionen beibehalten:
   - **+ Name erfassen**
   - **Nächste Aufgabe starten**
3. Eine gemeinsame, priorisierte Aufgabenliste erzeugen.
4. Empfohlene Priorität:
   - Recherchevorschläge warten auf Prüfung,
   - fehlgeschlagene Rechercheläufe,
   - Kandidaten mit viel Material, aber unvollständigem Dossier,
   - Kandidaten mit vollständigem Dossier, aber ohne Fit,
   - Shortlist-Kandidaten ohne Seite.
5. Jeder Eintrag zeigt eine einzige Hauptaktion:
   - Vorschlag prüfen
   - Dossier öffnen
   - Fit bewerten
   - Seite gestalten
6. Leere Sektionen nicht als große leere Karten darstellen. Stattdessen kompakte Erfolgsmeldung oder Abschnitt ausblenden.
7. Den englischen Begriff **„Enhance“** vollständig aus der Benutzeroberfläche entfernen.

### Akzeptanzkriterien

- Der Arbeitsplatz zeigt innerhalb des ersten Bildschirms mindestens eine konkrete nächste Aufgabe oder einen klaren „Alles erledigt“-Zustand.
- Es gibt keine große leere rechte Dashboardhälfte.
- Eine Aufgabe führt direkt zur passenden Ansicht und zum passenden geöffneten Arbeitsbereich.

---

## Phase 3 — Hauptnavigation entschlacken

### Neue Hauptnavigation

Desktop:

1. Heute
2. Personen
3. Pilotband
4. Seiten
5. Mehr
6. + Name

Unter **Mehr**:

- Material
- Orte
- KI-Kosten

Mobile Bottom Navigation:

1. Heute
2. Personen
3. Pilot
4. Seiten
5. + Name

Material, Orte und KI-Kosten sind mobil über „Mehr“ innerhalb von Heute oder über ein kompaktes Menü erreichbar.

### Benennungen

- Arbeitsplatz → Heute
- Personenpool → Personen
- Recherche → Material
- Kosten → KI-Kosten
- Quick Capture → Schnellerfassung oder ganz entfernen
- Gemini-Kuration → KI-Vorschläge
- Mehr recherchieren → Recherche ergänzen

### Akzeptanzkriterien

- Die Hauptnavigation enthält höchstens fünf Arbeitsbereiche plus „+ Name“.
- Sekundäre Verwaltungsansichten konkurrieren nicht mit dem Kernworkflow.
- Der aktive Bereich bleibt auf Desktop und Mobile eindeutig erkennbar.

---

## Phase 4 — Personenpool arbeitsorientiert machen

### Sortierung

Eine sichtbare Sortierauswahl ergänzen:

- Nächste Aufgabe
- Zuletzt bearbeitet
- Dossier am weitesten
- Meiste Einträge
- Name A–Z

Standard: **Nächste Aufgabe**.

### Filter vereinfachen

Die aktuelle dreizeilige Filterstruktur reduzieren:

- **Arbeitsstand:** Alle, Ohne Material, Dossier offen, Dossier bereit, Fit offen
- **Format:** optional aufklappbar
- Weitere Filter unter „Filter“ bündeln

Auf Mobile dürfen Chips horizontal scrollen, benötigen aber am rechten Rand einen sichtbaren Verlauf oder eine andere Scroll-Andeutung.

### Karten reduzieren

Eine Personenkarte zeigt:

- Name und Kategorie
- Dossier x/8
- Anzahl Materialeinträge
- maximal zwei fehlende Punkte
- vorhandenen Pilot-Fit

Freie Tags nur nachrangig und maximal zwei anzeigen. Fehlende Werte ausdrücklich als „Fehlt: These“ statt nur als rote Pille „These“ kennzeichnen.

### Rendering

- Zunächst maximal 30 Karten rendern.
- Danach „Weitere Personen anzeigen“.
- Suche und Filter müssen weiterhin über den gesamten geladenen Bestand arbeiten.

### Akzeptanzkriterien

- Die Standardansicht priorisiert bearbeitbare Personen statt Erstellungsreihenfolge.
- Auf Mobile sind keine Filterbezeichnungen unverständlich abgeschnitten.
- Bei 122 Personen werden nicht sofort 122 vollständige Karten in den DOM geschrieben.

---

## Phase 5 — Personenprofil gliedern

### Neue Profilstruktur

Oberhalb der Inhalte eine lokale Profilnavigation einführen:

1. **Übersicht**
2. **Material**
3. **Bilder & Gestaltung**
4. **Details**

### Übersicht

Enthält:

- Name, Rolle, Daten
- Dossierstand und konkrete fehlende Punkte
- Pilot-Fit beziehungsweise „Fit bewerten“
- Lebensprinzip
- Buchthese
- Spannung/Widerspruch
- eine kontextabhängige Hauptaktion

### Material

Enthält:

- Kategorienfilter
- Anekdoten, Zitate, Fakten und Stil
- Quellenstatus
- „Recherche ergänzen“
- KI-Vorschläge als sekundäre Aktion

Metadaten auf geschlossenen Karten reduzieren. Stärke, Reife, Quellenqualität und Tags erst in der geöffneten Karte vollständig zeigen.

### Bilder & Gestaltung

Enthält:

- Galerie
- Titelbildauswahl
- Upload/URL
- vorhandene Buchseiten der Person
- Aktion „Neue Seite gestalten“

### Details

Enthält:

- Biografie
- Archetyp
- visuelles Motiv
- Formateignung
- Kurationsnotiz
- Profil bearbeiten

### Navigation und Zustand

- Beim Öffnen eines Profils immer nach oben scrollen.
- Der Zurückweg soll die vorherige Suche, Sortierung und Scrollposition des Personenpools erhalten.
- „Fit bewerten“ aus dem Pilotband öffnet direkt die Übersicht mit ausgeklapptem Fit-Panel.

### Akzeptanzkriterien

- Die Profilübersicht passt bei normalem Desktop möglichst in ein bis zwei Bildschirmhöhen.
- Bilder stehen nicht mehr vor der redaktionellen Kernaussage.
- Pro Profilbereich gibt es höchstens eine visuell dominante Hauptaktion.

---

## Phase 6 — Seitenwerkstatt mit dem Pilotband verbinden

### Einstieg

1. Im Personenprofil und auf Pilotkarten eine Aktion **„Seite gestalten“** ergänzen.
2. Im Personenauswahlfeld zuerst Gruppen anzeigen:
   - Im Pilot
   - Shortlist
   - Weitere Personen
3. Standardmäßig nicht „Zuordnung offen“, wenn die Werkstatt aus einem Profil heraus geöffnet wurde.

### Seitenübersicht

- Seiten nach `page_order` anzeigen.
- Titel, Person, Elementanzahl und Bearbeitungsstand zeigen.
- Leere Fläche bei wenigen Seiten reduzieren; Karten nicht unnötig klein lassen.
- Löschen als sekundäre Aktion oder Menüpunkt gestalten.

### Editor

- Bestehende Toolbar und Vorlagen beibehalten.
- Auf Mobile einen Modus **„An Ansicht anpassen“** ergänzen.
- Alternativ klar zwischen „Vorschau“ und „Bearbeiten“ trennen.
- Eigenschaftenbereich nach Auswahl eines Elements automatisch sichtbar machen.
- Einen einfachen Rückgängig-Schritt pro Sitzung oder mindestens „Letzte Änderung zurücksetzen“ ergänzen.
- Mehrfaches paralleles Speichern derselben Seite vermeiden: Saves entprellen oder nacheinander abarbeiten.

### Materialauswahl

Material der verknüpften Person vorsortieren:

1. `buchreife = final`
2. `buchreife = stark`
3. hohe `staerke`
4. passende `seitenrolle`

Offene Quellen sichtbar markieren, aber die Nutzung nicht blockieren.

### Akzeptanzkriterien

- Eine Shortlist- oder Pilotperson kann mit höchstens zwei Aktionen in eine neue Seite überführt werden.
- Die Person ist dabei bereits vorausgewählt.
- Der mobile Editor zeigt entweder die ganze Seite oder kennzeichnet den horizontalen Arbeitsbereich eindeutig.
- Schnelle Änderungen erzeugen keinen älteren Speicherstand nach einem neueren.

---

## Phase 7 — Technische Modularisierung

Diese Phase erst nach den sichtbaren Workflow-Verbesserungen durchführen. Kein Framework-Wechsel erforderlich.

### Zielstruktur

```text
src/
  app.js
  config.js
  state/
    store.js
    router.js
  data/
    supabase.js
    models.js
  views/
    dashboard.js
    persons.js
    profile.js
    pilot.js
    material.js
    places.js
    costs.js
    pages.js
  components/
    filters.js
    person-card.js
    entry-card.js
    empty-state.js
  pages/
    editor.js
    templates.js
  styles/
    tokens.css
    base.css
    components.css
    responsive.css
```

Vite kann als kleiner Build-Schritt genutzt werden. Wenn kein Build-Schritt gewünscht ist, dieselbe Struktur mit nativen ES-Modulen verwenden.

### Regeln

- Keine neuen globalen Funktionen.
- Inline-`onclick` schrittweise durch `addEventListener` ersetzen.
- Datenzugriff ausschließlich über `data/supabase.js`.
- Views erhalten Daten und Aktionen als Parameter statt auf alle globalen Arrays zuzugreifen.
- Bestehende Escape- und URL-Normalisierung weiterverwenden.
- `entries.person_id` als primäre Zuordnung verwenden; `entries.person` nur als Legacy-Fallback lesen.
- Keine Datenmigration erzwingen, solange alte Einträge noch ohne `person_id` existieren.

### Tests ergänzen

Mindestens folgende Frontendlogik testen:

- Sortierung „Nächste Aufgabe“
- Kandidaten im Status `pool` erscheinen in der Pilot-Prüfliste
- Pilotkennzahlen entsprechen den sichtbaren Statusgruppen
- Profil-CTA wird aus dem nächsten fehlenden Schritt abgeleitet
- Material für Seiten wird korrekt priorisiert
- Seiten-Saves werden in der richtigen Reihenfolge verarbeitet

Die bestehenden API-Tests müssen weiterhin vollständig bestehen.

---

## Einheitliche Zustands- und Aktionslogik

Eine zentrale Funktion `nextActionForPerson(person)` einführen. Sie sollte ungefähr folgende Priorität abbilden:

```text
kein Material
  → Recherche starten

Recherchevorschlag in review
  → Vorschlag prüfen

Dossier unvollständig
  → Dossier vervollständigen

Dossier ausreichend, Fit fehlt
  → Fit bewerten

Fit vorhanden, stage = pruefen
  → Auswahl entscheiden

stage = shortlist, keine Seite
  → Seite gestalten

stage = selected
  → Pilotprofil ausarbeiten
```

Diese Logik soll Dashboard, Personenkarten und Profilhauptaktion speisen. Keine Ansicht soll dieselben Regeln separat neu erfinden.

## Designregeln

- Bestehende Farb- und Typografietokens behalten.
- Pro Karte maximal eine Primäraktion.
- Leere Zustände erklären den nächsten Schritt.
- Interne Technikbegriffe nicht als Hauptsprache der Oberfläche verwenden.
- Kennzahlen müssen zu den darunter sichtbaren Objekten passen.
- Sekundäre Metadaten erst bei Bedarf zeigen.
- Rot nur für echte Fehler oder blockierende Lücken verwenden.
- Grün nur für bestätigte beziehungsweise abgeschlossene Zustände verwenden.
- Kleine graue Großbuchstaben sparsam einsetzen; aktuell wirken zu viele Bereiche gleich wichtig.
- Mobile Touch-Ziele mindestens 40 × 40 Pixel.

## Nicht regressieren

Folgende bestehende Funktionen müssen erhalten bleiben:

- Name nur merken
- Name merken und recherchieren
- vorhandene Person erkennen
- Recherchevorschläge vor dem Speichern prüfen
- einzelne Materialeinträge bearbeiten und kuratieren
- Pilot-Fit mit sechs Kriterien speichern
- Seiten anlegen, duplizieren und löschen
- Blöcke verschieben, skalieren und gestalten
- Personenbilder hochladen und als Titelbild markieren
- KI-Nutzung und Kosten protokollieren
- mobile Schnellerfassung über `?capture=1`

## Definition of Done

Die Umsetzung ist fertig, wenn:

1. der Pilotband trotz vieler `pool`-Kandidaten nicht mehr leer wirkt,
2. der Arbeitsplatz eine priorisierte nächste Aufgabe zeigt,
3. die Hauptnavigation auf den Kernworkflow reduziert ist,
4. der Personenpool sinnvoll sortiert und schrittweise gerendert wird,
5. Profile klar in Übersicht, Material, Bilder und Details gegliedert sind,
6. Seiten direkt aus Shortlist, Pilotband oder Profil erstellt werden können,
7. Desktop und 390-Pixel-Mobile ohne unverständliche abgeschnittene Steuerung funktionieren,
8. die bestehenden API-Tests bestehen und neue Workflowtests ergänzt wurden,
9. keine bestehenden Daten automatisch gelöscht oder neu bewertet wurden,
10. Login und Sicherheitsarchitektur unverändert geblieben sind.

## Empfohlene Commit-Reihenfolge

1. `Improve pilot candidate intake workflow`
2. `Turn dashboard into prioritized work queue`
3. `Simplify primary navigation`
4. `Improve person sorting and filters`
5. `Restructure person profile sections`
6. `Connect pilot candidates to page workshop`
7. `Split frontend into focused modules`
8. `Add frontend workflow tests`

Jeder Commit soll für sich lauffähig und auf Desktop sowie 390-Pixel-Mobile geprüft sein.
