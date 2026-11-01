# ADR 0005 — Esercizi: generatore melodico × modello ritmico, funzioni pure

- Stato: Accettato (2026-11-01, `js/exercises/melodic.js`, `rhythm.js`, `presets.js`)
- Data: 2026-11-01

## Contesto

Gli esercizi richiesti (lineari, per intervalli, sequenze melodiche, sequenze intervallari
alternate, ritmici, distribuzione sulla tastiera; vedi [esercizi.md](esercizi.md)) sono in gran
parte varianti dello stesso meccanismo: percorrere le note della scala secondo uno schema e
suonarle con un certo ritmo. Scrivere un motore per famiglia duplicherebbe logica e test.

## Decisione

Un esercizio è la composizione di **tre assi indipendenti**: *Cosa* (melodia), *Come* (ritmo),
*Dove* (ambito e diteggiatura, ADR 0006 e 0008). Questo ADR riguarda i primi due, entrambi
funzioni pure:

```
pitchPool (altezze ordinate) ──melodic(motivo)──► indici ──rhythm(modello)──► eventi in battiti
```

Il pool è un elenco di **altezze** (MIDI + indice di grado) e non contiene posizioni sulla
chitarra: la scelta di corda e tasto avviene dopo, con `fingering()` (ADR 0006 e 0008).

### 1. Generatore melodico: `melodic(pool, {motif, step, direction, shape})`

Su ogni "gradino" `i` (avanzando di `step`) emette `pool[i + m]` per ogni `m` del motivo,
finché il motivo resta dentro il pool.

- `motif`: offset relativi al gradino, anche non monotoni o ripetuti (`[0,2,1]`,
  `[0,1,0,2,0,3]`). I preset possono scriverlo come intervalli con segno (`[+2, −1]`), che
  vengono convertiti in offset.
- `direction`: `up` | `down` | `updown` | `downup`. In discesa il motivo è specchiato
  dall'alto (`pool[last − i − m]`); in `updown` la nota di svolta non si ripete se il motivo è di
  una sola nota (con motivi più lunghi si ripete il gruppo intero, così i gruppi restano regolari).
- `shape`:
  - `forward`: motivo invariato (terze 1-3, 2-4, …);
  - `alternate`: motivo invertito a gradini alterni (1-3, 4-2, 3-5, 6-4 …);
  - `palindrome`: motivo seguito dal suo retrogrado (123 321 234 432 …).

Gli **intervalli sono salti di gradi della scala**, non semitoni ("terze" = `[0,2]`), quindi
valgono per tutte le scale del catalogo, anche quelle simmetriche a 6 o 8 note.

L'estensione (1, 2 o 3 ottave dalla tonica più grave, oppure tutta) si applica al pool in
`pool.js` (ADR 0006), non qui.

### 2. Modello ritmico: `rhythm(indici, pool, {...})`

- `cells`: ciclo di celle `{dur (battiti), rest?}` applicato in sequenza alle note:
  ottavi `[½]`, terzine `[⅓]`, sedicesimi `[¼]`, quintine `[⅕]`, sestine `[⅙]`; celle composte
  come galoppo `[½, ¼, ¼]`, puntato `[¾, ¼]`, pausa `[¼, ¼, ¼, {¼, rest}]`.
- `swing`: intensità 0–1; con 1 l'ottavo in levare è spostato di ⅙ di battito (feel di terzina).
- `accent`: `'group'` (default: prima nota di ogni gruppo melodico; se i gruppi sono di una sola
  nota diventa `'beat'`) | `'beat'` (sul battito) | *g* (ogni *g* note, indipendente dal battito:
  ogni 3 su sedicesimi = 3 contro 4).
- `accentOffset`: sposta l'accento dentro il gruppo (0 … g−1), o di N suddivisioni con `'beat'`.
- `pickup`: numero di note in **levare**. Gli eventi sono traslati di `−pickup · dur` battiti e
  la prima battuta risulta incompleta (anacrusi). La gestione di count-in e loop è nell'ADR 0004,
  la resa in tab nell'ADR 0009.
- `repeat`: ogni nota ripetuta *r* volte (pennata alternata).
- `meter`: battiti per battuta (default 4). La sequenza si completa con pause fino a fine
  battuta, così il loop resta in tempo.

Il calcolo interno è in tick interi (960 per battito), così terzine, quintine e sestine non
accumulano errori. Uscita: `[{i, beat, dur, ndur, k | null, midi, degree, accent, group}]` (`ndur` = durata nominale, prima dello swing), con `k` indice nel pool,
`null` per le pause e `group` indice del gruppo melodico. `beat` può essere negativo per il levare.
`fingering()` aggiunge poi `{string, fret}` a ogni nota (ADR 0008).

### 3. Preset

`presets.js` contiene l'elenco `{id, category, label, melodic, rhythm?}` che traduce
[esercizi.md](esercizi.md). Ogni preset melodico ha un ritmo di default modificabile; la categoria
**Ritmici** contiene preset in cui il ritmo è il protagonista. Un nuovo esercizio è di norma solo
un nuovo preset.

## Alternative scartate

- **Un generatore per famiglia**: codice e test duplicati, combinazioni (sequenze × ritmi ×
  ambiti) da gestire una per una.
- **Esercizi scritti a mano come elenchi di note**: non dipendono dalla scala e non scalano su
  33 scale × 12 toniche × ambiti.
- **`alternate` booleano** (prima versione): non esprime il palindromo (123 321), richiesto
  dal catalogo.

## Conseguenze

- Tutto è testabile in Node: lunghezze attese, motivo dentro il pool, simmetria up/down, somma
  delle durate multipla di `meter` (levare compreso), accenti nelle posizioni attese, e le
  sequenze di riferimento di [esercizi.md](esercizi.md).
- Esercizi che non rientrano nello schema richiederanno un generatore aggiuntivo con la stessa
  firma `pool → indici`.
