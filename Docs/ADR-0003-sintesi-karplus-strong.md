# ADR 0003 — Suono: Karplus-Strong pre-renderizzato in AudioBuffer

- Stato: Proposto (suono sintetizzato confermato dall'utente il 2026-11-01)
- Data: 2026-11-01

## Contesto

Per ascoltare scale ed esercizi serve un suono che ricordi una chitarra, intonato con precisione
su tutta l'estensione usata (MIDI 40, E2 a vuoto, fino a MIDI 88, 24° tasto della 1ª corda),
senza file audio (ADR 0001) e reattivo anche a 200+ BPM in sedicesimi.

## Decisione

Si sintetizza ogni nota con l'algoritmo **Karplus-Strong** (corda pizzicata), calcolato in
JavaScript **una sola volta per altezza** dentro un `AudioBuffer` mono (circa 2 s), in modo
*lazy*, cioè solo quando la nota serve, e tenuto in cache per numero MIDI. Ogni nota suonata
crea un `AudioBufferSourceNode` → `GainNode` (inviluppo e accento) → bus master.

Dettagli:

- **Intonazione**: il ritardo intero `N = floor(sr / f)` più il filtro media (+0,5 campioni)
  produce `f0 = sr / (N + 0,5)`. L'errore si corregge con `playbackRate = f / f0`, che evita
  i filtri allpass frazionari (senza correzione, a 1319 Hz l'errore sarebbe circa 24 cent).
- **Timbro**: rumore iniziale passato in un passa-basso, con brillantezza che cresce con la
  velocity; decadimento per altezza (le note acute si spengono prima).
- **Smorzamento per corda**: una nuova nota sulla stessa corda chiude la precedente con un
  rilascio di circa 10 ms, come su una chitarra vera. Si può fare perché ogni evento porta `string`.
- **Click del metronomo**: oscillatore breve (circa 30 ms) a 1500 Hz sul primo battito della
  battuta e a 1000 Hz sugli altri, su un bus separato con volume proprio.
- **Memoria**: circa 350 KB per nota a 44,1 kHz in float32. Una diteggiatura usa al massimo
  18 altezze distinte (circa 6 MB); con l'ambito "tutta la tastiera" (ADR 0006) si arriva
  all'intera estensione, circa 17 MB: accettabile. Se servisse, la durata del buffer si riduce
  per le note acute, che decadono comunque prima.

## Alternative scartate

- **Campioni registrati** (MP3/OGG): suono migliore, ma da `file://` non si caricano con
  `fetch`; inserirli in base64 aggiunge MB e pone problemi di licenza.
- **Oscillatore + filtro** (sintesi sottrattiva): banale da scrivere, ma suona "synth" e non chitarra.
- **Karplus-Strong in `AudioWorklet`**: suono in tempo reale e senza cache, ma
  `addModule` da `file://` non funziona (servirebbe un Blob URL), è più complesso e Safari è
  meno stabile. Il pre-rendering costa circa 1–2 ms per nota, quindi non serve.

## Conseguenze

- Il generatore del buffer è una funzione pura `(freq, sampleRate, opzioni) → Float32Array`,
  testabile in Node (lunghezza, assenza di NaN, ampiezza ≤ 1, decadimento).
- Se in futuro si vogliono campioni reali, si sostituisce solo `engine.js`: l'interfaccia
  `playNote(midi, time, {velocity, string, duration})` resta la stessa.
