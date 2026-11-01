# ADR 0006 — Ambito degli esercizi: altezze prima, posizioni poi (tutta la tastiera)

- Stato: Proposto (rivisto il 2026-11-01: tutta la tastiera; poi insiemi di corde, collegamento delle posizioni, estensione)
- Data: 2026-11-01

## Contesto

Gli esercizi devono coprire **tutta la tastiera** e le richieste di distribuzione del catalogo
([esercizi.md](esercizi.md) §6): singola corda, coppie, terne, tutte le corde, collegamento delle
posizioni, esecuzione orizzontale e verticale. Sulla tastiera intera la stessa altezza si trova
in più punti (fino a 4–5), quindi una sequenza di note non determina da sola dove suonarle.

## Decisione

Due passaggi distinti:

```
pitchPool(scala, tonica, ambito, estensione) ─► melodic() ─► rhythm() ─► fingering(ambito, profilo) ─► eventi con {string, fret}
        altezze (MIDI)                          indici       battiti      posizioni
```

1. **Pool di altezze**: le note della scala in ordine crescente (MIDI + indice di grado) che
   l'ambito permette di suonare, ristrette all'**estensione**. Melodia e ritmo (ADR 0005)
   lavorano solo su questo pool.
2. **Assegnazione delle posizioni** (ADR 0008): per ogni nota si sceglie `{string, fret}` tra le
   posizioni ammesse, secondo il **profilo** (`balanced`, `horizontal`, `vertical`).

### Ambiti

| `kind` | Parametri | Posizioni ammesse |
|---|---|---|
| `neck` (default) | tasti `da`–`a` (0–24) | tutte le corde |
| `strings` | insieme di 1–6 corde, tasti `da`–`a` | solo le corde scelte (singola, coppia, terna, …) |
| `pattern` | diteggiatura 3NPS *n* | solo le sue 18 posizioni (una per altezza) |
| `position` | tasto *x* | finestra `x`…`x+4` |
| `chain` | elenco di diteggiature o finestre | vedi sotto |

### Estensione

`1` | `2` | `3` ottave dalla **tonica più grave** suonabile nell'ambito (ottava finale inclusa),
oppure `full` (tutte le note della scala dell'ambito, a partire dalla nota più grave, che può non
essere la tonica). Se l'estensione chiesta non entra nell'ambito si usa quella massima possibile e
l'interfaccia lo indica.

### Collegamento delle posizioni (`chain`)

L'esercizio si costruisce **per segmenti**: per ogni posizione della catena si calcola il pool di
quella posizione, si genera la melodia con direzione alternata (su nel segmento 1, giù nel 2, …)
e si concatenano gli indici in un'unica sequenza di altezze. `fingering()` riceve poi l'intera
sequenza con i vincoli di posizione di ciascun segmento, così ogni passaggio di posizione è il più
breve possibile. Ritmo e accenti si applicano all'intera sequenza.

## Alternative scartate

- **Concatenare rigidamente le diteggiature 3NPS** come unico modello di tastiera intera: non
  gestisce corde singole, coppie o finestre.
- **Pool di posizioni** (prima versione di questo ADR): sulla tastiera intera la stessa altezza
  comparirebbe più volte e "salire di una terza" diventerebbe ambiguo.
- **Corda singola come caso speciale** (`kind: 'string'`): sostituita da `strings` con un insieme,
  che copre anche coppie e terne senza codice in più.

## Conseguenze

- Il caso 3NPS è un ambito qualsiasi: stesso flusso e stessi test.
- I preset melodici e ritmici restano indipendenti dall'ambito.
- Serve un diagramma della tastiera intera (ADR 0007) oltre ai diagrammi delle diteggiature.
- Su ambiti stretti (una corda, 1 ottava) alcuni motivi lunghi non entrano: `build()` restituisce
  un esercizio vuoto con un motivo leggibile e l'interfaccia lo mostra.
