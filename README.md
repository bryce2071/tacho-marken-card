# Tacho mit Marken

Ein Tacho wie die eingebaute Gauge-Karte von Home Assistant (gleiche Form, Farbbereiche, Zeiger) –
zusätzlich mit **Marken** für weitere Werte derselben Einheit: Striche quer über den Bogen oder Dreiecke
außen am Bogen, mit Legende unter dem Namen. Beispiel: „PV-Erzeugung heute“ mit der Tagesprognose als
Strich und dem aktuell erwarteten Tageswert als Dreieck.

*English: Gauge card like Home Assistant's built-in one, with extra markers (lines or triangles) for
further values of the same unit, e.g. a forecast. German user interface.*

## Installation

1. **Einstellungen → Marketplace → Über Link hinzufügen** und
   `https://github.com/bryce2071/tacho-marken-card` eintragen (Typ *Dashboard*), dann **Tacho mit Marken**
   herunterladen. Die Ressource trägt der Marketplace selbst ein.
2. Browser bzw. App einmal neu laden. Danach steht „Tacho mit Marken“ in der Kartenauswahl.

## Beispiel

```yaml
type: custom:tacho-marken-card
entity: sensor.pv_erzeugung_heute
name: PV-Erzeugung heute
min: 0
max: 75
needle: true
segments:
  - from: 0
    color: "#ffcc80"
  - from: 15
    color: "#ffa726"
  - from: 40
    color: "#ef6c00"
marken:
  - entity: sensor.pv_prognose_heute
    name: Prognose
    attribut_stand: stand
  - entity: sensor.pv_heute_erwartet
    name: Aktuell erwartet
    form: dreieck
grid_options:
  columns: 12
  rows: auto
```

## Optionen

| Feld | Bedeutung |
|---|---|
| `entity` | Entität für Zeiger und großen Wert |
| `name` | optional, sonst der Name der Entität |
| `min`, `max` | Skala (Standard 0–100) |
| `needle` | optional, `false` = gefüllter Bogen statt Zeiger |
| `segments` | optional, Farbbereiche wie bei der Gauge-Karte: `from`, `color` |
| `marken` | optional, Liste der Marken; die erste liegt oben |

Je Marke:

| Feld | Bedeutung |
|---|---|
| `entity` | Entität mit dem Wert (gleiche Einheit wie der Tacho) |
| `name` | optional, Name in der Legende |
| `form` | optional, `dreieck` = Dreieck außen am Bogen, sonst Strich |
| `gestrichelt` | optional, `true` = gestrichelter Strich |
| `farbe` | optional, sonst Blau |
| `attribut_stand` | optional, Attribut mit einer Uhrzeit, erscheint als „(Stand 07:30)“ |

## Bearbeiten-Dialog

Alles lässt sich auch im Bearbeiten-Dialog einstellen:

- oben Entität, Name, Minimum, Maximum und Zeiger,
- **Farbbereiche:** je Bereich „ab Wert“ und Farbe (Farbwähler), hinzufügen und entfernen,
- **Marken:** je Marke Entität, Name, Form (Strich oder Dreieck), Farbe, gestrichelt und das Attribut mit
  der Uhrzeit; mit den Pfeilen umsortieren (die erste liegt oben), entfernen, über „Marke hinzufügen“
  eine weitere Entität anhängen.

Beim Hinzufügen schlägt die Kartenauswahl einen Sensor mit Zahlenwert vor.

## Hinweise

- Tipp auf die Karte öffnet die Details der Entität.
- Der große Wert wird so formatiert wie in Home Assistant (Einheit, Nachkommastellen der Entität) und
  passt seine Größe an, damit er den Zeiger nicht berührt.
- Wer die Datei vorher von Hand eingebunden hatte (`/local/tacho-marken-card.js`), entfernt diese
  Ressource (**Einstellungen → Dashboards → ⋮ → Ressourcen**), sonst lädt der Browser die ältere Fassung.

## Lizenz

MIT
