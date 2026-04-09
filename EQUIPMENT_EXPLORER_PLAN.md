# Equipment Explorer

## Ziel

Neues Web-Modul fuer kaufbare Ausruestung in Freelancer-Mods.

Anzeigen soll das Modul ausschliesslich Items, die an Basen kaufbar sind, inklusive:

- Waffen
- Schilde
- Schubduesen
- Minen
- Raketen
- Gegenmassnahmen-Werfer
- Scanner
- Traktorstrahl
- Armor
- Nanobots
- Shield Batteries

Der Nutzer soll sehen koennen:

- welches Item wo verkauft wird
- zu welchem Preis es verkauft wird
- in welchem System und auf welcher Basis es verfuegbar ist
- welche Fraktion die Basis kontrolliert

Zusaetzlich soll der Universe Viewer auf Basis-Klick ein separates Verkaufsfenster fuer diese Basis oeffnen koennen.

## Bestehende Basis im Projekt

Die bestehende Architektur passt gut zu dem Vorhaben:

- Mod-Navigation ist bereits global ueber `assets/js/nav.js` geloest.
- Module wie Trade Routes, Ship Explorer, Universe Viewer und Rep Planner arbeiten bereits als eigenstaendige Vollseiten.
- Der Universe Viewer baut heute schon Basis-Indizes fuer Commodities und Ships auf und zeigt diese im Info-Panel an.
- Die Freelancer-Datenbasis kennt bereits die relevanten Dateien:
  - `equipment/goods.ini` fuer Basispreise
  - `equipment/market_misc.ini` fuer kaufbare Ausruestung je Basis
  - diverse `equipment/*.ini` fuer Item-Definitionen, Namen und Stats

Das heisst: Der Equipment Explorer sollte als eigenstaendiges Modul gebaut werden, aber mit derselben Datenlogik und denselben Mod-Hashes wie die anderen Seiten.

## Datenmodell

### Neue Exportdatei

Empfehlung: neue Exportdatei pro Mod.

- Zielpfad: `data/equipment/<mod>.json`
- Export-Script: neues `tools/export_equipment_data.py`

Warum getrennt von Trade Routes und Universe:

- Trade-Routes-Daten sind fachlich auf Commodities und Ships zugeschnitten.
- Universe-Daten sollen visuell und geografisch kompakt bleiben.
- Equipment-Daten wachsen schnell stark an, besonders bei Discovery.

### Datenquellen

Primar benoetigt:

- `EXE/freelancer.ini`
  - um Goods-, Equipment- und Markets-Dateien sauber zu finden
- `DATA/EQUIPMENT/goods.ini`
  - Preis der Goods-Eintraege
- `DATA/EQUIPMENT/market_misc.ini`
  - welche Ausruestung auf welcher Basis verkauft wird
- `DATA/EQUIPMENT/*.ini`
  - Item-Definitionen, Namen, Klasse, Munition, Mount-Typen, Stats
- Universe- und Rep-Exports als Referenz fuer:
  - Systemname
  - Basisname
  - Fraktion der Basis

### Nur kaufbare Items

Es sollen nur Items exportiert werden, die wirklich im Markt einer Basis auftauchen.

Nicht anzeigen:

- reine NPC- oder Loadout-only-Items
- Items ohne Markt-Eintrag
- interne Hilfsobjekte wie `infinite_power`
- Munition nur dann separat, wenn sie als kaufbares Marktobjekt verkauft wird

### Vorgeschlagenes JSON-Schema

```json
{
  "mod": "discovery",
  "generatedAt": "2026-04-09T12:00:00Z",
  "summary": {
    "items": 0,
    "offers": 0,
    "bases": 0,
    "systems": 0
  },
  "items": {
    "ge_s_scanner_02": {
      "nick": "ge_s_scanner_02",
      "name": "Deep Scanner",
      "category": "scanner",
      "subcategory": "scanner",
      "price": 5000,
      "volume": 1,
      "munitionNick": "",
      "classInfo": {
        "hpType": "HpScanner",
        "itemClass": "internal"
      },
      "stats": {
        "range": 0,
        "shieldRegen": 0,
        "hullDamage": 0,
        "energyDamage": 0,
        "refire": 0
      },
      "offers": [
        {
          "base": "li01_01_base",
          "baseName": "Planet Manhattan",
          "system": "LI01",
          "systemName": "New York",
          "faction": "li_n_grp",
          "factionName": "Liberty Navy",
          "price": 5000
        }
      ]
    }
  },
  "bases": {
    "li01_01_base": {
      "offers": ["ge_s_scanner_02", "ge_s_tractor_01"]
    }
  }
}
```

### Kategorien

Die UI-Kategorien sollten fest und stabil sein:

- `weapon`
- `shield`
- `thruster`
- `mine`
- `missile`
- `countermeasure`
- `scanner`
- `tractor`
- `armor`
- `nanobot`
- `battery`

Optional intern noch `subcategory`, damit spaeter feiner gefiltert werden kann:

- Gun vs Turret
- Cruise Disruptor vs Torpedo vs Missile
- Light/Heavy Scanner
- Shield Class

## Seitenaufbau

## 1. Kopfbereich

Analog zu den anderen Modulen:

- Titel: `Equipment Explorer`
- kurzer Untertitel: kaufbare Ausruestung durchsuchen
- Mod-Auswahl ueber die bestehende obere Subnav

Direkt darunter eine kompakte Stats-Zeile:

- Anzahl kaufbarer Items
- Anzahl Verkaufsorte
- Anzahl Basen mit Equipment-Angebot

## 2. Filterleiste

Die Filter muessen oben stehen und immer sichtbar sein.

Empfohlene Reihenfolge:

1. Volltextsuche
2. Kategorie
3. System
4. Basis
5. Fraktion
6. Nur exakte Basispreise / Preisbereich
7. Sortierung

Volltextsuche soll durchsuchen:

- Itemname
- Nickname
- Systemname
- Basisname
- Fraktionsname

Wichtige Filter:

- Kategorie: Waffen, Schilde, Schubduesen, Minen, Raketen, Gegenmassnahmen, Scanner, Traktor, Armor, Nanobots, Batteries
- System: Dropdown
- Base: Dropdown oder Suchfeld mit Autocomplete
- Fraktion: Dropdown
- Preisbereich: Min/Max
- Nur verkaufbar auf aktuell gefilterten Basen

Sortieroptionen:

- Name A-Z
- Preis aufsteigend
- Preis absteigend
- System A-Z
- Basis A-Z
- Fraktion A-Z
- Anzahl Verkaufsorte

## 3. Hauptlayout

Empfehlung: Drei-Spalten-Logik, aber responsive.

Desktop:

- links: optionale Facetten / Schnellfilter
- mitte: Ergebnisliste
- rechts: Detailpanel fuer gewaehltes Item

Mobil:

- Filter oben einklappbar
- Ergebnisse darunter
- Detailansicht als Overlay oder unter der Tabelle

### Ergebnisliste

Default-Ansicht: zeilenorientierte Offer-Liste, nicht nur Item-Liste.

Warum:

- Der Kernnutzen ist `wo gibt es welches Item fuer welchen Preis`.
- Der Nutzer sucht haeufig eine Kaufstelle, nicht nur eine Item-Definition.

Spaltenvorschlag:

- Item
- Kategorie
- Preis
- Basis
- System
- Fraktion
- Verfuegbarkeit / Anzahl Basen

Jede Zeile soll klickbar sein.

### Detailpanel

Beim Klick auf eine Zeile oder ein Item:

- grosser Itemname
- Kategorie und Subkategorie
- Basispreis
- evtl. relevante Stats
- alle Verkaufsorte als sortierte Liste
- Schnellaktionen:
  - `Im Universum anzeigen`
  - `Weitere Items auf dieser Basis`

## 4. Alternative Sichten

Das Modul sollte zwei Tabs haben.

### Tab A: `Nach Item`

Eine aggregierte Sicht pro Item.

Beispiel:

- Deep Scanner
- Preis: 5.000
- verkauft auf 12 Basen

Beim Aufklappen oder Klick erscheinen die Verkaufsorte.

### Tab B: `Nach Basis`

Eine Basis-zentrierte Sicht.

Beispiel:

- Planet Manhattan
- System: New York
- Fraktion: Liberty Police
- verkauft: 24 Items

Beim Klick erscheinen alle dort kaufbaren Items mit Preis.

Diese Sicht ist wichtig fuer Spieler, die wissen wollen, `was kriege ich komplett auf dieser Base`.

## Universe-Viewer-Integration

## Zielverhalten

Wenn der Nutzer im Universe Viewer auf eine Basis klickt, soll zusaetzlich zu Commodities und Ships ein eigener Equipment-Bereich erscheinen.

Empfehlung fuer Phase 1:

- bestehendes rechtes Info-Panel erweitern
- neuer Abschnitt: `Equipment`
- zunaechst Top-N Liste oder kategorisierte Liste
- Button `Alles auf dieser Basis anzeigen`

Empfehlung fuer Phase 2:

- separates Overlay oder Drawer fuer Basis-Inventar
- Inhalte:
  - Commodities
  - Ships
  - Equipment
- Equipment nach Kategorien gruppiert

### Bestehender technischer Anker

Universe Viewer hat bereits:

- `baseCommodityIndex`
- `baseShipIndex`
- `renderBaseTradeSections(baseNick)`

Sinnvolle Erweiterung:

- `baseEquipmentIndex`
- neue Funktion `renderBaseEquipmentSection(baseNick)`
- spaeter moeglich: `openBaseMarketOverlay(baseNick)`

## Sinnvolle Nutzerfluesse

## Flow 1: Item finden

- Nutzer oeffnet Equipment Explorer
- waehlt Mod
- filtert Kategorie `Scanner`
- sucht nach `Deep`
- sieht sofort alle Basen, Preise und Fraktionen

## Flow 2: Basis auswerten

- Nutzer oeffnet Universe Viewer
- klickt auf Basis
- Equipment-Panel zeigt alles, was dort verkauft wird
- Klick auf `Equipment Explorer` oeffnet die Seite direkt mit Base-Filter gesetzt

## Flow 3: Einkaufsroute vorbereiten

- Nutzer filtert nach System oder Fraktion
- schaut, welche Ausruestung in einem Gebiet verfuegbar ist
- springt anschliessend in Universe Viewer oder Trade Routes

## Technischer Umsetzungsplan

## Phase 1: Export

Neues Script `tools/export_equipment_data.py`.

Aufgaben:

- `freelancer.ini` lesen
- `goods.ini`, Equipment-Dateien und `market_misc.ini` einsammeln
- kaufbare Items aus `market_misc.ini` extrahieren
- Item-Metadaten aus Equipment-Sections ableiten
- Namen ueber DLL-Resolver aufloesen
- Basis-, System- und Fraktionsinfos anreichern
- Output nach `data/equipment/<mod>.json`

## Phase 2: Neues Modul

Neue Seite:

- `docs/equipment-explorer.html`

Optional neues Script:

- `assets/js/equipment-explorer.js`

Aufgaben:

- Mod laden
- Daten laden
- Indizes aufbauen
- Filterlogik bauen
- Resultate rendern
- Detailpanel rendern

## Phase 3: Universe Viewer Integration

Aufgaben:

- Equipment-JSON parallel zum Universe-JSON laden
- `baseEquipmentIndex` aufbauen
- Basis-Info-Panel um Equipment erweitern
- optional Deep-Link zum Equipment Explorer mit gesetzten Query-Parametern

## Phase 4: Qualitaet und Performance

Wichtig besonders fuer Discovery:

- vorberechnete Indizes im Browser
- keine Volltext-Neuberechnung pro Tastenanschlag ohne Debounce
- Ergebnisliste paginieren oder virtualisieren, falls notwendig
- Basis- und Systemfilter aus vorhandenen Daten vorab aggregieren

## Offene Detailentscheidungen

Vor der Implementierung noch festziehen:

- Soll Armor als separates kaufbares Item oder als Schiffspaket-Komponente behandelt werden?
- Soll Munition separat sichtbar sein oder nur der Werfer?
- Soll das Universe-Viewer-Fenster direkt alles zeigen oder nur einen kompakten Ausschnitt mit `Mehr anzeigen`?
- Welche Item-Stats sind pro Kategorie wirklich wertvoll genug fuer die Detailansicht?

## Empfohlener Minimalumfang fuer den ersten Build

Wenn du schnell zu einem nutzbaren Ergebnis kommen willst:

1. Export fuer kaufbare Equipment-Offers bauen
2. `docs/equipment-explorer.html` mit einer guten Offer-Tabelle bauen
3. Filter fuer Suche, Kategorie, System, Basis, Fraktion
4. Detailpanel mit allen Verkaufsorten
5. Universe Viewer um Equipment-Abschnitt pro Basis erweitern

Das ist klein genug fuer einen ersten sauberen Wurf und gross genug, dass das Modul sofort echten Nutzen hat.