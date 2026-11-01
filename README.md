# Guitar Scale Practice — Interval Master (web)

Versione web statica di [`../interval-master`](../interval-master) (app desktop Rust/egui):
solo HTML, CSS e JavaScript, **nessun server side**, responsive e mobile-first.

Estrae una scala casuale tra 33 scale × 12 toniche:

- i 7 modi della **scala maggiore**, della **minore melodica**, della **minore armonica** e della **maggiore armonica**
- le **scale simmetriche**: esatonale, diminuita semitono-tono, diminuita tono-semitono, aumentata, aumentata inversa

Per ogni scala mostra note (una lettera per grado, tonica con il minor numero di alterazioni),
formula a gradi, struttura T/S e tutte le **diteggiature a 3 note per corda** in accordatura
standard (una per ogni grado di partenza sulla 6ª corda), con etichette a gradi o a note.

## Uso

Apri `index.html` direttamente nel browser (doppio clic, funziona anche da `file://`)
oppure pubblica la cartella su un qualsiasi hosting statico (GitHub Pages, Netlify, …).

- **Scala casuale** (o barra spaziatrice / Invio) estrae una nuova scala.
- **Impostazioni**: famiglie incluse, tonica casuale o fissa, evita ripetizioni,
  *Esercizio: nascondi le note* (mostra solo il nome finché non si preme "Mostra soluzione").
- **Cronologia**: ultime 12 estrazioni, cliccabili.
- Impostazioni, scala corrente e cronologia vengono ricordate nel browser (`localStorage`).

## Layout

| Larghezza | Impostazioni | Cronologia | Pulsante | Diteggiature |
|---|---|---|---|---|
| < 640px (mobile) | drawer da sinistra | drawer da destra | fisso in basso | 1 colonna |
| ≥ 640px (tablet) | drawer | drawer | fisso in basso | 2 colonne |
| ≥ 1024px | colonna fissa | drawer | in cima al contenuto | 2 colonne |
| ≥ 1280px | colonna fissa | colonna fissa | in cima al contenuto | 2 colonne (3 da 1600px) |

Tema chiaro/scuro automatico (`prefers-color-scheme`), aree sicure iOS (`safe-area-inset`),
target di tocco ≥ 44px, `prefers-reduced-motion` rispettato.

## Struttura

- `index.html` — markup della pagina.
- `css/style.css` — stili mobile-first, token colore per tema chiaro/scuro.
- `js/theory.js` — modello teorico (porting di `theory.rs`): note, gradi, catalogo scale, spelling enarmonico.
- `js/guitar.js` — diteggiature 3NPS (porting di `guitar.rs`).
- `js/fretboard.js` — disegno dei diagrammi in SVG.
- `js/app.js` — stato, estrazione, rendering, drawer, scorciatoie, persistenza.
- `tests/run.test.js` — test della logica (porting dei test Rust).

Gli script sono classici (non ES module) per funzionare anche aprendo il file in locale;
`theory.js` e `guitar.js` si esportano con `module.exports` quando caricati da Node.

## Test

```sh
npm test        # oppure: node --test tests/run.test.js
```
