# Architettura

Guitar Scale Practice è una pagina statica senza build ([ADR 0001](ADR-0001-app-statica-senza-server.md)):
script classici caricati in ordine, ognuno pubblica un oggetto globale
([ADR 0002](ADR-0002-script-classici-namespace-globali.md)). I moduli puri si caricano anche
da Node per i test.

## Moduli

```
                 ┌────────────────────────── puri, testati in Node ──────────────────────────┐
theory.js ─► guitar.js ─► exercises/pool.js ─► melodic.js ─► rhythm.js ─► fingering.js ─► presets.js
(Theory)     (Guitar)     (Pool)               (Melodic)     (Rhythm)     (Fingering)     (Presets.build)
                                                                                               │ eventi
                    ┌──────────────────────────────┬──────────────────────┬────────────────────┤
                    ▼                              ▼                      ▼                    ▼
   audio/scheduler.js ─► audio/engine.js     fretboard.js           tab/layout.js ─► tab/render.js
   (Scheduler, puro)     (AudioEngine)        (Fretboard: card e     (TabLayout, puro)  (TabRender)
                         audio/ks.js (KS)      tastiera intera)
                    └──────────── rAF: evidenzia l'evento corrente in tutte le viste ────────────┘
                                         practice.js (Practice: pannello, viste, trasporto)
                                                    ▲
                                       app.js ──────┘  Practice.mount(context) dopo renderResult
```

| Modulo | Responsabilità | Node |
|---|---|---|
| `theory.js` | note, gradi, catalogo 33 scale, spelling enarmonico, ♭/♯ | sì |
| `guitar.js` | diteggiature 3NPS (18 posizioni per grado di partenza) | sì |
| `exercises/pool.js` | ambiti, posizioni ammesse, pool di altezze con estensione | sì |
| `exercises/melodic.js` | motivo × passo × direzione × forma → indici | sì |
| `exercises/rhythm.js` | celle, swing, accenti, levare, ripetute → eventi in battiti (tick interi) | sì |
| `exercises/fingering.js` | Viterbi con finestra della mano e profili → corda e tasto | sì |
| `exercises/presets.js` | catalogo ([esercizi.md](esercizi.md)) e pipeline `build()` | sì |
| `audio/ks.js` | buffer Karplus-Strong + correzione di intonazione | sì |
| `audio/scheduler.js` | lookahead, loop, count-in, metronomo, trainer, coda visiva | sì (clock finto) |
| `audio/engine.js` | AudioContext, cache delle voci, smorzamento per corda, click | no |
| `tab/layout.js` | battute, a capo, travature, gironi, anacrusi; tab ASCII | sì |
| `tab/render.js` | SVG della tablatura | no |
| `fretboard.js` | SVG delle diteggiature e della tastiera intera (`fretFrom/To`, `cellWidth`, `path`) | no |
| `practice.js` | pannello Cosa/Come/Dove/Opzioni, trasporto, viste, wake lock, stampa | no |
| `app.js` | estrazione casuale, rendering della scala, drawer, scorciatoie | no |

## Principi

1. **Logica pura separata da DOM e audio** ([ADR 0005](ADR-0005-modello-esercizi.md)).
2. **Altezze prima, posizioni poi**: gli esercizi si generano su altezze; corda e tasto si scelgono
   alla fine secondo l'ambito ([ADR 0006](ADR-0006-ambito-esercizi.md),
   [ADR 0008](ADR-0008-assegnazione-posizioni.md)).
3. **Il DOM si può ricostruire in qualunque momento**: lo scheduler non tiene riferimenti a nodi
   DOM; l'evidenziazione cerca `data-s`/`data-f` (pallini) e `data-i` (tab, gradi) a ogni frame.
   Cambiare le etichette Gradi/Note durante la riproduzione non la interrompe.
4. **Un solo clock**: quello di `AudioContext` ([ADR 0004](ADR-0004-scheduler-lookahead.md)).
5. **Una sola sorgente per audio e notazione**: la tab è una vista degli eventi suonati
   ([ADR 0009](ADR-0009-tablatura.md)).

## Persistenza

| Chiave `localStorage` | Contenuto |
|---|---|
| `interval-master:v1` | famiglie, tonica, opzioni, scala corrente, cronologia (chiave storica) |
| `gsp:practice:v1` | impostazioni della pratica: assi, BPM, metronomo, loop, trainer, volumi, viste |

## Ordine di caricamento

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
<script src="js/practice.js"></script>
<script src="js/app.js"></script>
```
