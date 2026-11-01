# Catalogo degli esercizi

- Stato: Proposto
- Data: 2026-11-01
- Riferimenti: [ADR 0005](ADR-0005-modello-esercizi.md) (melodia × ritmo),
  [ADR 0006](ADR-0006-ambito-esercizi.md) (ambito ed estensione),
  [ADR 0008](ADR-0008-assegnazione-posizioni.md) (distribuzione sulla tastiera)

## Tre assi indipendenti

Le sei famiglie di esercizi richieste si riducono a **tre scelte indipendenti**, che l'utente
combina liberamente:

| Asse | Domanda | Famiglie del catalogo | Modulo |
|---|---|---|---|
| **Cosa** | quali note e in che ordine | 1 Lineari · 2 Intervalli · 3 Sequenze · 4 Sequenze intervallari | `melodic.js` + estensione in `pool.js` |
| **Come** | con che ritmo e accenti | 5 Ritmici | `rhythm.js` |
| **Dove** | su quali corde e posizioni | 6 Distribuzione sulla tastiera | ambito in `pool.js` + profilo in `fingering.js` |

Esempio: *terze alternate* (Cosa) × *terzine con accento ogni 2* (Come) × *coppie di corde 3–4* (Dove).

Convenzioni degli esempi: Do ionica, gradi numerati sul pool (8 = tonica all'ottava, 9 = 2ª
all'ottava…). Gli intervalli sono **salti di gradi della scala** e valgono per qualunque scala,
anche quelle simmetriche a 6 o 8 note.

## Parametri del modello

### Cosa: `melodic(pool, {motif, step, direction, shape})` + estensione

| Parametro | Valori | Significato |
|---|---|---|
| `motif` | offset, es. `[0,2]` | note emesse a ogni gradino, relative al gradino |
| `step` | intero ≥ 1 (default 1) | di quanto avanza il gradino |
| `direction` | `up` · `down` · `updown` · `downup` | verso della frase; in discesa il motivo è specchiato |
| `shape` | `forward` · `alternate` · `palindrome` | `alternate`: motivo invertito a gradini alterni; `palindrome`: motivo seguito dal suo retrogrado |
| `extension` | `1` · `2` · `3` ottave · `full` | in `pool.js`: dalla tonica più grave dell'ambito, ottava finale inclusa; `full` = tutte le note della scala dell'ambito |

`shape` sostituisce il booleano `alternate` della prima versione dell'ADR 0005.

### Come: `rhythm(indici, pool, {...})`

| Parametro | Valori | Significato |
|---|---|---|
| `cells` | ciclo di `{dur, rest?}` | suddivisione o cella ritmica |
| `swing` | 0 … ⅓ | ritardo dell'ottavo in levare |
| `accentEvery` | 0 · 2 · 3 · 4 · `motif` | accento ogni *g* note; `motif` = sulla prima nota di ogni gruppo melodico (default) |
| `accentOffset` | 0 … g−1 | sposta l'accento dentro il gruppo (accento sulla 2ª nota, sulla 3ª…) |
| `pickup` | 0 … suddivisioni | **levare**: numero di note che precedono il primo battito |
| `repeat` | 1 · 2 · 4 | ripetizione di ogni nota |
| `meter` | battiti per battuta (4) | per completare l'ultima battuta e per le stanghette della tab |

### Dove: ambito + profilo di diteggiatura

| Ambito (`scope.kind`) | Parametri | Note ammesse |
|---|---|---|
| `neck` | tasti `da`–`a` | tutte le corde |
| `strings` | insieme di 1–6 corde, tasti `da`–`a` | solo le corde scelte: singola, coppia, terna… |
| `pattern` | diteggiatura 3NPS *n* | le sue 18 posizioni |
| `position` | tasto di partenza *x* | finestra `x`…`x+4` su tutte le corde |
| `chain` | sequenza di diteggiature o finestre | l'esercizio si ripete in ogni posizione, collegate (vedi 6.5) |

| Profilo (`fingering.profile`) | Effetto sui pesi di Viterbi | Risultato |
|---|---|---|
| `balanced` (default) | pesi base | percorso naturale e diagonale |
| `horizontal` | spostamenti della mano economici, cambi di corda costosi | si sale **lungo il manico**, poche corde |
| `vertical` | spostamenti costosi, cambi di corda economici | si resta **in posizione** e ci si sposta solo quando le note finiscono |

## Catalogo → parametri

### 1. Esecuzione lineare

| Esercizio | Parametri | Esempio |
|---|---|---|
| 1.1 Ascendente | `motif [0]`, `up` | 1 2 3 4 5 6 7 8 |
| 1.2 Discendente | `motif [0]`, `down` | 8 7 6 5 4 3 2 1 |
| 1.3 Ascendente e discendente | `motif [0]`, `updown` | 1 2 … 8 … 2 1 (svolta non ripetuta) |
| 1.4 Su una o due ottave | `extension 1` · `2` | 2 ottave: 1 … 15 |
| 1.5 Tutta l'estensione | `extension full`, ambito `neck` 0–24 | da E2 (nota della scala più grave) al tasto 24 |

### 2. Esecuzione per intervalli

Intervalli paralleli: `motif [0, k]`, `step 1`, `shape forward`.

| Esercizio | `k` | Esempio |
|---|---|---|
| 2.1 Terze | 2 | 1-3, 2-4, 3-5, 4-6 … |
| 2.2 Quarte | 3 | 1-4, 2-5, 3-6, 4-7 … |
| 2.3 Quinte | 4 | 1-5, 2-6, 3-7 … |
| 2.4 Seste | 5 | 1-6, 2-7, 3-8 … |
| 2.5 Settime | 6 | 1-7, 2-8, 3-9 … |

In discesa (`down`) gli intervalli sono specchiati dall'alto: 15-13, 14-12, …
L'accento di default cade sulla prima nota di ogni coppia (`accentEvery: motif`).

### 3. Sequenze melodiche

| Esercizio | Parametri | Esempio |
|---|---|---|
| 3.1 Gruppi di 3 | `motif [0,1,2]` | 123 234 345 456 … |
| 3.2 Gruppi di 4 | `motif [0,1,2,3]` | 1234 2345 3456 … |
| 3.3 Gruppi di 5 | `motif [0..4]` | 12345 23456 34567 … |
| 3.4 Gruppi di 6 | `motif [0..5]` | 123456 234567 … |
| 3.5 Alternate asc/disc | `motif [0,1,2]`, `shape palindrome` | 123 321 234 432 345 543 … |

`palindrome` vale per qualunque gruppo (1234 4321 2345 5432 …).

### 4. Sequenze intervallari alternate

| Esercizio | Parametri | Esempio |
|---|---|---|
| 4.1 Terze asc e disc | `motif [0,2]`, `shape alternate` | 1-3, 4-2, 3-5, 6-4 … |
| 4.1b variante | `motif [0,2]`, `shape palindrome` | 1-3-3-1, 2-4-4-2 … |
| 4.2 Quarte asc e disc | `motif [0,3]`, `alternate` | 1-4, 5-2, 3-6, 7-4 … |
| 4.3 Quinte asc e disc | `motif [0,4]`, `alternate` | 1-5, 6-2, 3-7, 8-4 … |
| 4.4 Alternanza di intervalli asc e disc | `motif [0,2,1]` (su di 3ª, giù di 2ª); `[0,3,1]` (su di 4ª, giù di 3ª); `[0,4,1]` (su di 5ª, giù di 4ª) | 1 3 2 · 2 4 3 · 3 5 4 … |
| 4.5 Salti intervallari progressivi | *salti crescenti*: `motif [0,1,3,6]` (2ª, 3ª, 4ª); variante lunga `[0,1,3,6,10]` (fino alla 5ª) | 1 2 4 7 · 2 3 5 8 · 3 4 6 9 … |

**Interpretazioni confermate dall'utente (2026-11-01)**:
- **4.4**: eseguita come "1-3-2-4" coinciderebbe nota per nota con le terze parallele (2.1),
  quindi è un **motivo misto**: un intervallo ascendente seguito da uno discendente di ampiezza
  diversa. Nei preset il motivo si scrive come intervalli con segno (`[+2, −1]`), che
  `presets.js` converte in offset.
- **4.5**: **salti crescenti** (2ª, 3ª, 4ª, …) dalla nota del gradino. È stata scartata la lettura
  "a ventaglio" (1-2, 1-3, 1-4 …).

### 5. Esercizi ritmici

| Esercizio | Parametri | Note |
|---|---|---|
| 5.1 Quartine di sedicesimi | `cells [{dur:¼}]` | 4 note per battito |
| 5.2 Terzine di ottavi | `cells [{dur:⅓}]` | 3 per battito; con gruppi di 4 nasce il 4 contro 3 |
| 5.3 Sestine | `cells [{dur:⅙}]` | 6 per battito |
| 5.4 Ottavi swing | `cells [{dur:½}]`, `swing ⅓` | in tab indicazione "Swing" in testa |
| 5.5 Accenti ogni 2, 3, 4 | `accentEvery 2·3·4` | indipendenti dalla suddivisione: accento ogni 3 su sedicesimi = 3 contro 4 |
| 5.6 Spostamento degli accenti | `accentOffset 1…g−1` | es. sedicesimi, accento sulla 2ª di ogni quartina; preset "accento che scorre" = `accentOffset` +1 a ogni ripetizione del loop (fase 6) |
| 5.7 Inizio sul levare | `pickup n` | le prime *n* note cadono prima del battito 1 (anacrusi); vedi sotto |

**Levare (`pickup`)**: gli eventi sono spostati di `−n · dur` battiti. In riproduzione le note
in levare si sovrappongono alla coda del count-in (ADR 0004); senza count-in si aggiunge una
battuta di attesa. Nel loop la durata resta a battute intere: il levare della ripetizione
successiva occupa le pause finali dell'ultima battuta e, se lo spazio non basta, si aggiunge una
battuta. In tablatura la prima battuta è incompleta (ADR 0009).

### 6. Distribuzione sulla tastiera

| Esercizio | Ambito / profilo | Note |
|---|---|---|
| 6.1 Singola corda | `strings [s]` | scala orizzontale su una corda |
| 6.2 Coppie di corde | `strings [s, s+1]` | con `balanced` alterna le due corde, con `horizontal` fa corse lunghe su ciascuna |
| 6.3 Tre corde | `strings [s, s+1, s+2]` | |
| 6.4 Tutte le corde | `neck` | |
| 6.5 Collegamento delle posizioni | `chain` di diteggiature 3NPS 1→2→…→n | l'esercizio scelto si esegue in ogni posizione con direzione alternata (su nella 1, giù nella 2, …), così la fine di un segmento è vicina all'inizio del successivo; un `fingering` unico garantisce il passaggio di posizione più breve |
| 6.6 Orizzontale lungo il manico | `neck` o `strings`, profilo `horizontal` | |
| 6.7 Verticale attraverso le posizioni | `neck`, profilo `vertical` | si esaurisce la posizione e poi si sale alla successiva |

## Combinazioni e default

- Ogni preset di "Cosa" ha un ritmo e un accento di default sensati (intervalli in ottavi con
  accento sulla coppia, gruppi di 3 in terzine, gruppi di 4 in sedicesimi), modificabili.
- Le combinazioni con poche note (es. gruppi di 6 su una corda con estensione di 1 ottava)
  producono sequenze brevi; se il motivo non entra nel pool, l'interfaccia lo segnala invece di
  produrre un esercizio vuoto.
- Default proposti: Cosa = lineare `updown`, 2 ottave; Come = ottavi, accento sul battito;
  Dove = tastiera intera, profilo `balanced`.

## Test di riferimento (da implementare in fase 2–3)

Le sequenze di esempio di questo documento diventano test: per Do ionica con pool di 15 note
(2 ottave) il generatore deve produrre esattamente:

| Preset | Inizio della sequenza attesa |
|---|---|
| 2.1 Terze | `1 3 2 4 3 5 4 6` |
| 3.5 Gruppi di 3 palindromi | `1 2 3 3 2 1 2 3 4 4 3 2` |
| 4.1 Terze alternate | `1 3 4 2 3 5 6 4` |
| 4.4 Su di 3ª, giù di 2ª | `1 3 2 2 4 3 3 5 4` |
| 4.5 Salti crescenti | `1 2 4 7 2 3 5 8` |
| 2.1 Terze, `down` | `15 13 14 12 13 11` |

Verificati con un prototipo del generatore il 2026-11-01.
