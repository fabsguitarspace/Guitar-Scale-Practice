# ADR 0001 — Applicazione statica, senza server e senza build

- Stato: Accettato
- Data: 2026-11-01

## Contesto

La versione web di Interval Master deve funzionare senza server: si apre con un doppio clic
su `index.html` oppure si pubblica su un hosting statico (GitHub Pages).

## Decisione

Solo HTML, CSS e JavaScript scritti a mano: niente bundler, transpiler, framework né
dipendenze a runtime. Si usano le API del browser (SVG, `localStorage`, `matchMedia`, Web Audio).
L'unico strumento di sviluppo è Node, per i test (`node:test`, senza dipendenze npm).

## Alternative scartate

- **Framework + build** (React/Vite, Svelte): componenti più comodi, ma serve un passaggio di
  build e il sorgente non si apre più direttamente. Il volume di UI non lo giustifica.
- **Rust → WebAssembly** riusando il crate originale: si riusa codice, ma servono toolchain e
  build e la pagina non funziona da `file://` (il `.wasm` si carica con `fetch`).

## Conseguenze

- Ogni funzione nuova deve funzionare anche da `file://`: niente `fetch` di file locali,
  niente ES module, niente `AudioWorklet.addModule` da URL (vedi ADR 0002 e 0003).
- Si scrive un po' più di codice DOM a mano (helper `h()` in `app.js`).
