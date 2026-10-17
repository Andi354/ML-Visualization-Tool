# Agent-Hilfe

Was der Agent im ML Visualization Tool kann und was nicht. Der Agent liest diese Datei über das Werkzeug `help`
(ohne Thema das Inhaltsverzeichnis, mit Thema den Abschnitt). Sie gehört zum Code: Ändert sich, was der Agent kann
oder darf, wird sie im selben Commit angepasst. Ein Test vergleicht die Werkzeug-Tabelle, die Modus-Tabelle, die
Marken und die Datensätze der eigenen Widgets mit dem Code.

## faehigkeiten · Fähigkeiten und Grenzen

**Der Agent kann:**
- Läufe suchen (`find_runs`: Text, Issue, Datum, Zustand, Lauf-Merkmal, Grid-Achse) und lesen (`read_run`: beste Gruppen je Metrik oder die Konfiguration eines Laufs).
- Navigieren: Läufe als Tab öffnen, fokussieren und schließen, in Läufe zwischen Liste und Issues wechseln, die Analyse in einer Ansicht öffnen.
- In einem Lauf-Tab Filter und Sortierung der Tabelle einstellen.
- Das Board der Analyse bearbeiten: Widgets hinzufügen, entfernen, einstellen, verschieben und in der Breite ändern; Vorlagen anwenden und speichern.
- Eigene Widgets entwerfen (als Entwurf im Board, den der Nutzer behält oder verwirft) und einen offenen Entwurf behalten.
- Widgets des Boards als Bilder im Deliverable-Ordner des Projekts speichern.
- Projektdateien lesen (`Read`, `Glob`, `Grep`), zum Beispiel die Konfiguration oder eine `description.yaml` eines Laufs.

**Der Agent kann nicht:**
- Läufe starten, stoppen oder löschen, Konfigurationen oder andere Projektdateien ändern. Schreiben kann er nur über `save_deliverable` (Bilder in den Deliverable-Ordner) und über die Werkzeuge für Vorlagen und eigene Widgets.
- Gespeicherte Vorlagen oder eigene Widgets löschen.
- Spalten der Tabelle, das Detail-Panel oder den Bild-Export einstellen.
- Beschreibungen von Läufen schreiben (sie werden nur gelesen).
- Mit Sprache arbeiten (der Mikrofon-Knopf ist noch ohne Funktion).
- Ohne den geöffneten Tab im Browser arbeiten: Alles außer den Nachschlage-Werkzeugen (`find_runs`, `read_run`, `list_widgets`, `list_templates`, `choose_run`, `help`) ist ein Befehl an den offenen Tab.

**Regeln:**
- Zahlen und Namen nie raten, mit `find_runs` und `read_run` nachsehen.
- Bei mehreren passenden Läufen mit `choose_run` zurückfragen.
- Was der Nutzer gerade sieht, steht in der Zeile `[Ansicht: …]` vor seiner Nachricht, genauer in `get_view`.
- Wird eine Aktion abgelehnt, ohne sie weitermachen.

## werkzeuge · Alle Werkzeuge

Art `lesen` schlägt nur nach, `Ansicht` ändert, was der Nutzer sieht, `ändern` ändert die Analyse oder schreibt Dateien.

| Werkzeug | Art | Wofür |
|---|---|---|
| `help` | lesen | diese Hilfe |
| `find_runs` | lesen | Läufe suchen |
| `read_run` | lesen | Ergebnisse oder Konfiguration eines Laufs |
| `list_widgets` | lesen | Widgets (Katalog und eigene) einer Analyse-Ansicht |
| `list_templates` | lesen | gespeicherte Vorlagen |
| `choose_run` | lesen | den Nutzer einen von mehreren Läufen wählen lassen |
| `get_view` | lesen | der ganze aktuelle Zustand der Ansicht |
| `open_run` | Ansicht | Lauf als Tab öffnen |
| `focus_tab` | Ansicht | Tab fokussieren |
| `close_tab` | Ansicht | Tab schließen |
| `show_runs` | Ansicht | Läufe: Liste oder Issues |
| `open_analysis` | Ansicht | Analyse öffnen (one, two, project) |
| `set_run_view` | Ansicht | Filter und Sortierung in einem Lauf-Tab |
| `apply_template` | Ansicht | Vorlage auf das Board anwenden |
| `draft_widget` | Ansicht | Entwurf eines eigenen Widgets zeigen |
| `add_widget` | ändern | Widget hinzufügen |
| `remove_widget` | ändern | Widget entfernen |
| `configure_widget` | ändern | Einstellungen eines Widgets ändern |
| `move_widget` | ändern | Widget verschieben |
| `resize_widget` | ändern | Breite eines Widgets setzen |
| `save_template` | ändern | Board als Vorlage speichern |
| `keep_draft` | ändern | offenen Entwurf als eigenes Widget behalten |
| `save_deliverable` | ändern | Widgets als Bilder im Deliverable-Ordner speichern |

## ansichten · Bereiche und Ansichten des Tools

- **Läufe:** alle Läufe des Projekts, als Liste oder nach Issue gruppiert (`show_runs`). Ein Lauf mit Beschreibung zeigt eine Kurzzeile.
- **Lauf-Tab:** ein Lauf (`open_run`) mit Dimensionen links (Achsen, Wiederholungen, Kanäle), der Beschreibung, dem Überblick und der Gruppentabelle. `set_run_view` setzt Filter (Dimension → Liste gewählter Werte, leere Liste entfernt den Filter) und die Sortierung (`metric`, `stat`, `dir`).
- **Analyse:** ein Board aus Widgets in drei Ansichten (`open_analysis`, `scope`): `one` (Ein Lauf), `two` (Zwei Läufe, A gegen B) und `project` (Projektverlauf über alle Läufe). Jede Ansicht hat ihr eigenes Board.
- **Lauf-Merkmal:** ein Wert der Konfiguration, der Läufe unterscheidet (zum Beispiel `pred_len`); `find_runs` filtert danach mit `feature`.
- Läufe nennt man mit der Ordner-ID oder einem eindeutigen Teil davon.

## widgets · Widgets, Board und Vorlagen

- Welche Widgets es gibt, steht nicht hier: `list_widgets` mit der Ansicht (`scope`) liefert Katalog und eigene Widgets mit Schlüsseln, Einstellungen und Breite. Einstellungen sind Texte.
- Widgets auf dem Board nennt man mit der ID oder dem Typ aus `get_view`.
- Breite: `half` (halbe Zeile) oder `full` (volle Zeile). `move_widget` verschiebt um Schritte nach oben oder unten.
- Eine **Vorlage** ist ein Board ohne Läufe (Widgets, Einstellungen, Breite) für eine der drei Ansichten. „Standard“ ist eingebaut und lässt sich nicht überschreiben oder löschen. `save_template` mit einem vorhandenen Namen überschreibt.
- `save_deliverable` schreibt ein Bild je Widget in einen Ordner `<Datum> <Titel>` im Deliverable-Ordner des Projekts.

## eigene-widgets · Eigene Widgets

Ein eigenes Widget ist eine Beschreibung, kein Code. Das Tool prüft und zeichnet sie.

- **Felder:** `name`, `question`, `scope` (`one`, `two`, `project`), `width` (`half`, `full`), `params` (Name, Label, Optionen, Standard), `data` (`source`, `filter`) und `spec` (Vega-Lite ohne Daten).
- **Datensätze (`data.source`):** `cells` (eine Zeile je Kombination der Achsen), `channels` (je Kombination und Kanal), `curves` (je Kombination, Epoche und Verlust), `predictions` (je Kombination, Kanal und Datum), `runs` (eine Zeile je Lauf). Die Werte sind über die Wiederholungen gemittelt; in `two` trägt jede Zeile `run` = A oder B.
- **`filter`:** eine Zuordnung Spalte → Wert (oder Liste von Werten), die das Tool anwendet, kein Vega-Ausdruck. Mehr als 20 000 Zeilen je Datensatz werden abgelehnt, dann mit `filter` einschränken.
- **Parameter:** Werte in `filter` und Texte in `spec` können mit `{{param.<name>}}` auf einen Parameter verweisen.
- **Marken:** nur `bar`, `line`, `point`, `area`, `rect`, `text` und `tick`.
- **Verboten in `spec`:** `data`, `datasets`, `config` und Farben, Füllungen und Linienfarben. Farben und Schrift setzt das Tool selbst.
- **Ablauf:** `draft_widget` zeigt den Entwurf im Board, der Nutzer sieht ihn an, `keep_draft` behält ihn. Ein Name, der schon existiert, wird überschrieben. Eine ungültige Beschreibung kommt mit deutschen Fehlern zurück: korrigieren und erneut zeigen.

## modi · Modi und Bestätigungen

Der Modus gilt je Projekt, der Nutzer stellt ihn im Agent-Fenster ein. Er steht in der Zeile `[Ansicht: …, Modus: …]`.

| Modus | lesen | Ansicht | ändern |
|---|---|---|---|
| Direkt | sofort | sofort | sofort |
| Gemischt | sofort | sofort | fragt |
| Bestätigen | sofort | fragt | fragt |

- „fragt“ heißt: Der Nutzer sieht eine Karte mit Ausführen (oder Speichern) und Ablehnen. Das Werkzeug wartet auf den Klick.
- Wird abgelehnt, kommt das als Ergebnis zurück: ohne die Aktion weitermachen.
- Eine neue Nachricht des Nutzers lehnt eine offene Karte ab.

## rueckgaengig · Rückgängig und Wiederholen

- Jede Aktion steht als Zeile im Chat, mit Rückgängig und Wiederholen.
- Beides lebt nur im Browser-Tab, solange er offen ist. Nach einem Neuladen bleiben die Zeilen ohne Knopf.
- Das Speichern von Bildern nimmt Rückgängig nur für Dateien zurück, die seitdem unverändert sind.
- Der Agent selbst hat kein Werkzeug zum Rückgängigmachen; das ist ein Knopf des Nutzers.
