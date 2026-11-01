# Piano 0001 — Ascolto, esercizi su tutta la tastiera e tablatura

- Stato: Proposto (rivisto il 2026-11-01 con le scelte dell'utente e il catalogo degli esercizi)
- Data: 2026-11-01
- Decisioni: ADR [0003](../ADR-0003-sintesi-karplus-strong.md), [0004](../ADR-0004-scheduler-lookahead.md),
  [0005](../ADR-0005-modello-esercizi.md), [0006](../ADR-0006-ambito-esercizi.md),
  [0007](../ADR-0007-ui-pratica-mobile.md), [0008](../ADR-0008-assegnazione-posizioni.md),
  [0009](../ADR-0009-tablatura.md); catalogo: [esercizi.md](../esercizi.md)

## Obiettivo

1. Ascoltare scale ed esercizi con un **suono di chitarra sintetizzato**.
2. Le sei famiglie di esercizi del [catalogo](../esercizi.md): **lineari**, **per intervalli**,
   **sequenze melodiche**, **sequenze intervallari alternate**, **ritmici** e **distribuzione
   sulla tastiera**, ridotte a tre assi combinabili (Cosa × Come × Dove), con metronomo, BPM,
   loop, count-in e levare.
3. Tre viste sincronizzate: **evidenziazione sulla tastiera**, **elenco dei gradi**, **tablatura**.

Vincoli invariati: pagina statica che funziona da `file://`, mobile-first, nessuna dipendenza.

## Decisioni dell'utente (2026-11-01)

| Domanda | Scelta | Effetto |
|---|---|---|
| Ambito | esercizi su tutta la tastiera | ADR 0006 rivisto (altezze → posizioni), nuovo ADR 0008 |
| Suono | sintetizzato | ADR 0003 confermato |
| Notazione | tastiera + gradi + **tablatura** | nuovo ADR 0009 |
| Esercizi | catalogo in 6 famiglie | [esercizi.md](../esercizi.md); ADR 0005, 0006, 0008 rivisti (`shape`, accenti spostati, levare, insiemi di corde, collegamento posizioni, profili) |

## Flusso dei dati

```
scala, tonica ─► pitchPool(ambito) ─► melodic(preset) ─► rhythm(ritmo) ─► fingering(ambito) ─► eventi
                                                                                                │
                      ┌──────────────────────────┬───────────────────────┬───────────────────────┤
                      ▼                          ▼                       ▼                       ▼
                 scheduler + engine         neck / fretboard         tab layout+render       elenco gradi
                 (audio, clock unico)       (data-k)                 (data-i)                (data-i)
                      └───────────── coda visiva (rAF) evidenzia l'evento corrente ──────────────┘
```

## Nuovi file

| File | Tipo | Contenuto |
|---|---|---|
| `js/exercises/pool.js` | puro | `pitchPool(scala, tonica, ambito)`, `candidates(midi, ambito)` |
| `js/exercises/melodic.js` | puro | `melodic(pool, opts)` |
| `js/exercises/rhythm.js` | puro | `rhythm(indici, pool, opts)` → eventi in battiti |
| `js/exercises/fingering.js` | puro | Viterbi: `fingering(eventi, ambito, pesi)` |
| `js/exercises/presets.js` | puro | `PRESETS`, `RHYTHMS`, `build(scala, tonica, settings)` (intera pipeline) |
| `js/tab/layout.js` | puro | layout ritmico e a capo; `toAscii(eventi)` |
| `js/tab/render.js` | browser | SVG della tablatura |
| `js/audio/ks.js` | puro | `renderPluck(freq, sampleRate, opts) → Float32Array` |
| `js/audio/engine.js` | browser | `AudioContext`, unlock, cache, `playNote`, `click`, `stopAll` |
| `js/audio/scheduler.js` | puro, clock iniettato | lookahead, BPM, loop, count-in, metronomo, coda visiva |
| `js/neck.js` | browser | diagramma della tastiera intera |
| `js/practice.js` | browser | pannello Esercizi, viste, trasporto, wake lock |
| `tests/exercises.test.js`, `tests/fingering.test.js`, `tests/tab.test.js`, `tests/audio.test.js` | test | |

File modificati: `index.html`, `js/fretboard.js` (`data-k`, `is-playing`), `js/app.js`
(`data-pattern`, `Practice.mount`, cessione della bottom bar, persistenza), `css/style.css`
(pannello, viste, trasporto, `@media print`), `README.md`, `package.json` (`node --test tests/`
su tutti i file).

## API dei moduli

```js
// Ambito (ADR 0006)
{ kind: 'neck',     fretFrom: 0, fretTo: 24, allowOpen: true }
{ kind: 'strings',  strings: [2, 3], fretFrom: 0, fretTo: 24 }   // 0 = 6ª corda
{ kind: 'pattern',  index: 0 }
{ kind: 'position', fret: 5 }               // finestra fret..fret+4
{ kind: 'chain',    segments: [{ kind: 'pattern', index: 0 }, { kind: 'pattern', index: 1 }, …] }
// Estensione: 1 | 2 | 3 | 'full'      Profilo: 'balanced' | 'horizontal' | 'vertical'

Exercises.pitchPool(scale, root, scope, extension)   // [{k, midi, degree}] ascendente
Exercises.melodic(pool, { motif, step, direction, shape })   // shape: forward|alternate|palindrome
Exercises.rhythm(ks, pool, { cells, swing, accentEvery, accentOffset, pickup, repeat, meter })
                                            // [{i, beat, dur, k|null, midi, degree, accent, group}]
Exercises.fingering(events, scope, profile) // stessi eventi + {string, fret}
Exercises.build(scale, root, settings)      // pipeline completa → { pool, events, lengthBeats }

Tab.layout(events, { meter, width })        // sistemi → battute → simboli con x
Tab.toAscii(events, { meter })              // stringa
Tab.render(layout, labels) → SVGElement     // numeri con data-i

AudioEngine.unlock() / playNote(midi, when, { velocity, string, duration }) / click(when, { downbeat })
AudioEngine.stopAll() / now() / latency()

Scheduler.create({ now, setTimer, clearTimer, onNote, onClick, onEnd })
  .start(events, { bpm, loop, countIn, metronome, meter, lengthBeats })
  .setBpm(bpm) .stop() .isPlaying() .drainVisual(time)
```

Esempi di riferimento da fissare nei test:
- Do ionica, diteggiatura 1, "Terze, salendo" → 16 coppie = 32 note → in ottavi 16 battiti = 4 battute.
- Do ionica, ambito "una corda" 6ª, tasti 0–24, lineare ascendente → tasti 0, 1, 3, 5, 7, 8, 10, 12, 13, 15, 17, 19, 20, 22, 24
  (15 note, da E2 a E4: senza estensione in ottave il pool parte dalla nota della scala più grave
  della finestra, non dalla tonica).
- Do ionica, tastiera intera, 2 ottave da C3 (MIDI 48), lineare `updown` → percorso senza
  salti oltre 4 tasti senza cambio di posizione e identico a ogni esecuzione.

## Fasi

Ogni fase è rilasciabile da sola e chiude con i test verdi e il README aggiornato.

### Fase 1: motore audio e ascolto rapido
- `ks.js`, `engine.js`, `scheduler.js`; ▶ su ogni card di diteggiatura (lineare `updown`, ottavi);
  `data-k` e `is-playing` nei diagrammi; stop su nuova estrazione e `visibilitychange`.
- **Accettazione**: MIDI 40 e 88 intonati entro ±5 cent; niente artefatti a 200 BPM in
  sedicesimi su iPhone Safari e Chrome Android; evidenziazione in sincrono a orecchio.

### Fase 2: modello degli esercizi
- `pool.js`, `melodic.js`, `rhythm.js`, `presets.js` (ADR 0005, 0006). Per ora l'ambito
  `pattern` passa da `fingering` con un candidato per nota, quindi senza Viterbi reale.
- Preset: **tutte le voci delle famiglie 1–5** di [esercizi.md](../esercizi.md) (lineari ed
  estensione, intervalli dalla 3ª alla 7ª, gruppi da 3 a 6 e palindromi, sequenze intervallari
  alternate, ritmi con accenti, spostamento e levare). Altri preset utili (triadi, arpeggi di
  settima, galoppo, puntato, ripetute) si aggiungono come semplici voci del catalogo.
- 4.4 (motivo misto) e 4.5 (salti crescenti) sono confermate: vedi il catalogo.
- **Test**: le sequenze di riferimento di [esercizi.md](../esercizi.md); 33 scale × 12 toniche ×
  preset × ambiti: indici dentro il pool, specchio up/down, nessuna ripetizione della nota di
  svolta, durata multipla di `meter` (levare compreso), accenti e spostamenti attesi.

### Fase 3: tastiera intera
- `fingering.js` (Viterbi, ADR 0008) con ambiti `neck`, `strings`, `position`, `chain` e
  profili `balanced` / `horizontal` / `vertical` (famiglia 6 del catalogo).
- `neck.js`: diagramma 0–24 con note della scala attenuate, percorso, nota corrente; scroll
  orizzontale interno su mobile con inseguimento della nota.
- **Test**: posizione ↔ altezza corretta, dentro l'ambito, determinismo, nessun salto oltre la
  soglia senza cambio di posizione, casi di riferimento sopra. Verifica manuale con un
  chitarrista sui percorsi di 5–6 scale (taratura dei pesi).

### Fase 4: interfaccia della pratica
- `practice.js`: pannello sui tre assi Cosa / Come / Dove (ADR 0007), barra di trasporto
  (mobile in basso, desktop in cima al pannello), elenco dei gradi sincronizzato, scorciatoie,
  persistenza, Screen Wake Lock, avviso del tasto silenzioso su iOS.
- **Accettazione**: controlli raggiungibili con il pollice a 375px; nessuno scroll orizzontale
  della pagina; target ≥ 44px; navigabile da tastiera; screenshot a 375, 800 e 1440px in tema
  chiaro e scuro.

### Fase 5: tablatura
- `tab/layout.js` (spaziatura proporzionale, stanghette, a capo per battute, figure, travature,
  gironi irregolari, accenti, pause), `tab/render.js`, evidenziazione `data-i` con scorrimento,
  "Copia tab" (ASCII), `@media print`.
- **Test**: layout su tutti i ritmi della fase 2 (numero di battute, posizione delle stanghette,
  travature per battito, numero dei gironi irregolari); `toAscii` con allineamento delle 6 righe.
- **Accettazione**: tab leggibile a 375px (1–2 battute per riga) e a 1440px (4 per riga),
  stampa su A4 senza tagli.

### Fase 6: rifiniture (opzionale)
- Speed trainer (+N BPM ogni M ripetizioni), tap tempo, volumi separati, metronomo solo sui
  battiti forti, preferenza corde a vuoto.

## Rischi

| Rischio | Mitigazione |
|---|---|
| Percorsi Viterbi poco naturali | pesi isolati e tarati su casi reali; casi di riferimento nei test; modello della mano più ricco sostituibile (ADR 0008) |
| Layout ritmico della tab complesso | livello di layout puro e coperto da test; prima i numeri con stanghette, poi gambi e travature |
| Tastiera intera illeggibile su mobile | scroll orizzontale interno con inseguimento, larghezza minima per tasto (ADR 0007) |
| iOS zittisce Web Audio con il tasto silenzioso | `navigator.audioSession.type = 'playback'`, avviso nell'interfaccia |
| Timer rallentati in background | stop su `visibilitychange` |
| Esercizi lunghi su tastiera intera (centinaia di note) | tab con altezza massima e scroll interno; estensione in ottave selezionabile |
| `app.js` cresce troppo | la pratica vive in `practice.js`; `app.js` espone solo il contesto |

## Domande aperte

Nessuna bloccante. Default proposti, modificabili in fase di sviluppo:
- ambito iniziale: **tastiera intera, 2 ottave dalla tonica più grave**, che è più breve e
  pratico della scala intera su 0–24;
- corde a vuoto: ammesse;
- tempo: 4/4, 80 BPM, count-in attivo, metronomo attivo.
