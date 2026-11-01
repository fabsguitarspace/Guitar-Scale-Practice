# Guitar Scale Practice

App web per studiare le scale alla chitarra, di [Fabrizio's Guitar Space](https://www.youtube.com/@fabsguitarspace).
Solo HTML, CSS e JavaScript: **nessun server**, responsive e mobile-first. Nasce come versione web
di `../interval-master` (app desktop Rust/egui).

## Funzioni

- **Scala casuale** tra 33 scale × 12 toniche: i 7 modi di maggiore, minore melodica, minore
  armonica e maggiore armonica, più 5 scale simmetriche. Note con ortografia corretta, formula,
  struttura T/S, diteggiature a 3 note per corda.
- **Ascolto**: suono di chitarra sintetizzato (Karplus-Strong), pulsante ▶ su ogni diteggiatura.
- **Esercizi** su tre assi combinabili ([catalogo](Docs/esercizi.md)):
  - **Cosa**: lineari, intervalli (dalla 3ª alla 7ª), sequenze (gruppi da 3 a 6, alternati),
    sequenze intervallari (alternate, motivi misti, salti crescenti); direzione; estensione in ottave;
  - **Come**: ottavi, terzine, sedicesimi, quintine, sestine, swing, galoppo, puntato, pause,
    note ripetute; accenti (sul gruppo, sul battito, ogni 2/3/4), spostamento, levare;
  - **Dove**: tastiera intera, corde scelte (una, coppie, terne…), diteggiatura 3NPS, posizione
    di 5 tasti, collegamento delle posizioni; distribuzione bilanciata, orizzontale o verticale.
- **Viste sincronizzate**: tastiera con il percorso e la nota corrente, **tablatura** con ritmo e
  accenti (copia come testo, stampa), elenco dei gradi o delle note.
- **Trasporto**: Play/Stop, BPM, tap tempo, metronomo, battuta d'attacco, loop,
  **trainer di velocità** (+N BPM ogni M giri), volumi separati.
- Impostazioni, scala corrente e cronologia ricordate nel browser.

## Uso

Apri `index.html` nel browser (funziona anche con doppio clic, da `file://`) oppure pubblica la
cartella su un hosting statico (GitHub Pages, Netlify, …).

| Tasto | Azione |
|---|---|
| Invio | nuova scala casuale |
| Spazio | Play/Stop con il pannello Esercizi aperto, altrimenti nuova scala |
| ← → | tempo −5 / +5 BPM |
| Esc | chiude i pannelli laterali |

Su iPhone, se non si sente nulla, controlla la modalità silenziosa (su iOS 17+ l'app chiede
comunque la riproduzione).

## Layout

| Larghezza | Impostazioni | Cronologia | Trasporto | Diteggiature |
|---|---|---|---|---|
| < 640px | drawer | drawer | barra in basso: 🔀 · Play · BPM | 1 colonna |
| ≥ 640px | drawer | drawer | barra in basso (+ Tap) | 2 colonne |
| ≥ 1024px | colonna | drawer | in cima al pannello Esercizi | 2 colonne |
| ≥ 1280px | colonna | colonna | in cima al pannello Esercizi | 2 (3 da 1600px) |

Tema chiaro/scuro automatico, aree sicure iOS, target di tocco ≥ 44px, `prefers-reduced-motion`.

## Struttura

Vedi [Docs/architecture.md](Docs/architecture.md) per il diagramma dei moduli e
[Docs/](Docs/README.md) per ADR, catalogo degli esercizi e piano.

```
index.html  css/style.css
js/theory.js  js/guitar.js  js/fretboard.js  js/practice.js  js/app.js
js/exercises/  pool · melodic · rhythm · fingering · presets
js/audio/      ks · scheduler · engine
js/tab/        layout · render
tests/         *.test.js (node:test, nessuna dipendenza)
```

## Test

```sh
npm test        # oppure: node --test tests/*.test.js
```
