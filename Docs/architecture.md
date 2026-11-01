# Architettura

## Stato attuale (v0.1)

Pagina statica (vedi [ADR 0001](ADR-0001-app-statica-senza-server.md)) con quattro script
classici caricati in ordine (vedi [ADR 0002](ADR-0002-script-classici-namespace-globali.md)):

```
theory.js  ──►  guitar.js  ──►  fretboard.js  ──►  app.js
(Theory)        (Guitar)        (Fretboard)        (IIFE, stato UI)
 puro, Node      puro, Node      DOM/SVG            DOM, localStorage
```

| Modulo | Responsabilità | Testato in Node |
|---|---|---|
| `theory.js` | note, gradi, catalogo 33 scale, spelling enarmonico, formattazione ♭/♯ | sì |
| `guitar.js` | 3NPS: 18 posizioni `{string, fret, degree}` per ogni grado di partenza | sì |
| `fretboard.js` | SVG di una diteggiatura | no |
| `app.js` | stato, estrazione casuale, rendering, drawer, scorciatoie, persistenza | no |

Flusso: `pickRandom()` → `state.current = {scale, root}` → `renderResult()` ricostruisce
l'intero `#result` (intestazione + una `<figure>` per diteggiatura) con `replaceChildren`.

## Architettura di arrivo (audio, esercizi su tastiera intera, tablatura)

```
                ┌──────────────────────── puro, testabile in Node ────────────────────────┐
theory.js ─► guitar.js ─► exercises/pool.js ─► melodic.js ─► rhythm.js ─► fingering.js ─► presets.js (build)
                                                                                              │ eventi
                    ┌──────────────────────────────┬──────────────────────┬──────────────────┤
                    ▼                              ▼                      ▼                  ▼
   audio/scheduler.js ─► audio/engine.js     neck.js / fretboard.js   tab/layout.js ─► tab/render.js
   (clock unico, coda visiva)  (ks.js)       (data-k)                 (data-i)
                    └────────────── rAF: evidenzia l'evento corrente in tutte le viste ─────────┘
                                              practice.js (pannello, viste, trasporto)
                                                    ▲
                                       app.js ──────┘  Practice.mount(context) dopo renderResult
```

Principi:

1. **Logica pura separata da DOM e audio.** Pool, melodia, ritmo, posizioni e layout della tab
   sono funzioni deterministiche testate in Node ([ADR 0005](ADR-0005-modello-esercizi.md)).
2. **Altezze prima, posizioni poi.** Gli esercizi si generano su altezze; corda e tasto si
   scelgono alla fine secondo l'ambito ([ADR 0006](ADR-0006-ambito-esercizi.md),
   [ADR 0008](ADR-0008-assegnazione-posizioni.md)).
3. **Il DOM si può ricostruire in qualunque momento.** Lo scheduler non tiene riferimenti a nodi
   DOM: l'evidenziazione cerca `data-k`/`data-i` a ogni frame.
4. **Un solo clock**: quello di `AudioContext` ([ADR 0004](ADR-0004-scheduler-lookahead.md)).
   Tastiera, gradi e tablatura seguono l'audio.
5. **Una sola sorgente per audio e notazione**: la tab è una vista degli stessi eventi che
   vengono suonati ([ADR 0009](ADR-0009-tablatura.md)).
6. **Rimane una pagina statica senza build** ([ADR 0001](ADR-0001-app-statica-senza-server.md)).

Ordine di caricamento previsto:

```html
<script src="js/theory.js"></script>
<script src="js/guitar.js"></script>
<script src="js/exercises/pool.js"></script>
<script src="js/exercises/melodic.js"></script>
<script src="js/exercises/rhythm.js"></script>
<script src="js/exercises/fingering.js"></script>
<script src="js/exercises/presets.js"></script>
<script src="js/tab/layout.js"></script>
<script src="js/tab/render.js"></script>
<script src="js/audio/ks.js"></script>
<script src="js/audio/engine.js"></script>
<script src="js/audio/scheduler.js"></script>
<script src="js/fretboard.js"></script>
<script src="js/neck.js"></script>
<script src="js/practice.js"></script>
<script src="js/app.js"></script>
```
