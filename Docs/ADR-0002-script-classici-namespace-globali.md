# ADR 0002 — Script classici con namespace globali

- Stato: Accettato
- Data: 2026-11-01

## Contesto

Chrome blocca gli ES module caricati da `file://` (CORS). La logica deve però poter essere
testata anche in Node.

## Decisione

Ogni file è un'IIFE che pubblica un solo oggetto su `globalThis` (`Theory`, `Guitar`,
`Fretboard`, …). I moduli puri si esportano anche con `module.exports` quando sono caricati da
Node e ricevono le dipendenze con `require` in Node e da `globalThis` nel browser.
L'ordine dei `<script>` in `index.html` definisce le dipendenze.

Regola per i moduli nuovi: **un modulo puro non tocca `document`, `window` né `AudioContext`**,
così resta caricabile da Node.

## Alternative scartate

- **ES module**: non funzionano da `file://` in Chrome.
- **Un unico file JS**: niente test separati, file ingestibile al crescere delle funzioni.

## Conseguenze

- Le dipendenze sono implicite (ordine dei tag). Va tenuto aggiornato il diagramma in
  [architecture.md](architecture.md).
- Se un giorno si introduce una build (ADR 0001 sostituito), si passa agli ES module.
