# ADR 0004 — Temporizzazione: scheduler lookahead sul clock audio

- Stato: Proposto (rivisto il 2026-11-01: levare)
- Data: 2026-11-01

## Contesto

Gli esercizi ritmici richiedono una temporizzazione stabile (metronomo, sedicesimi, gruppi
irregolari). `setTimeout`/`setInterval` hanno un jitter di decine di ms e nelle schede in
background vengono rallentati fino a 1 s.

## Decisione

Scheduler *lookahead* (lo schema "A tale of two clocks"):

- un timer ogni ~25 ms programma con `start(when)` tutti gli eventi che cadono nei prossimi
  ~100 ms secondo `audioContext.currentTime`;
- gli eventi arrivano in **battiti** (vedi ADR 0005); la conversione in secondi usa un'ancora
  `{time, beat, bpm}`. Un cambio di BPM durante la riproduzione crea una nuova ancora sul battito
  corrente, quindi niente salti;
- **loop**: alla fine della sequenza la si ripete con un offset in battiti; **count-in**: una
  battuta di soli click prima della prima nota; **metronomo**: click generati dallo scheduler
  su ogni battito, non inclusi negli eventi dell'esercizio;
- **levare** (`pickup`, ADR 0005): gli eventi con `beat < 0` si programmano dentro l'ultima
  battuta del count-in; senza count-in lo scheduler anticipa l'ancora di una battuta di silenzio.
  La lunghezza del loop è in battute intere misurate dal battito 0: le note in levare della
  ripetizione successiva cadono nelle pause finali dell'ultima battuta e `build()` aggiunge una
  battuta se lo spazio non basta. Così non si sovrappongono mai alle ultime note suonate.

**Sincronizzazione visiva**: per ogni nota programmata lo scheduler mette `{time, pattern, k}`
in una coda. Un ciclo `requestAnimationFrame` evidenzia la nota quando
`currentTime >= time - outputLatency`. Il DOM non condiziona mai il tempo audio.

**Testabilità**: lo scheduler riceve per iniezione `now()`, `setTimer`, `clearTimer` e
`schedule(event, when)`. In Node si testa con un clock finto (ordine, tempi, loop, cambio BPM),
senza `AudioContext`.

**Ciclo di vita** (vincoli dei browser mobili):

- `AudioContext` si crea o si riprende (`resume()`) solo dentro il gesto dell'utente (tap su Play);
- `visibilitychange` → hidden: la riproduzione si ferma. In background i timer verrebbero
  rallentati e il risultato sarebbe peggiore del silenzio;
- iOS: il tasto silenzioso zittisce Web Audio. Mitigazione: `navigator.audioSession.type = 'playback'`
  dove è supportato (Safari 17+), altrimenti un avviso nell'interfaccia;
- durante la pratica si chiede lo **Screen Wake Lock**, se disponibile, perché lo schermo non si spenga.

## Alternative scartate

- **`setTimeout` per ogni nota**: jitter udibile già agli ottavi a 120 BPM.
- **Pre-programmare l'intera sequenza in una volta**: niente cambio di BPM o stop puliti, migliaia
  di nodi in coda nei loop lunghi.
- **Libreria (Tone.js)**: risolve tutto, ma è una dipendenza da circa 300 KB in contrasto con l'ADR 0001.

## Conseguenze

- Lo stop è immediato: si fermano le voci attive con un rilascio breve e si svuota la coda visiva.
- Latenza percepita su mobile: si compensa solo la parte visiva (`outputLatency`/`baseLatency`).
