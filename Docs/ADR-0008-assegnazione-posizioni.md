# ADR 0008 — Assegnazione delle posizioni: programmazione dinamica (Viterbi) con vincoli

- Stato: Proposto (rivisto il 2026-11-01: profili orizzontale/verticale, vincoli per segmento)
- Data: 2026-11-01

## Contesto

Con l'ambito "tutta la tastiera" (ADR 0006) ogni altezza ha più posizioni possibili. Serve un
percorso suonabile e naturale: pochi spostamenti della mano, niente salti di corda inutili,
coerente con la direzione della frase. Il catalogo ([esercizi.md](esercizi.md) §6) chiede anche
esecuzioni volutamente **orizzontali** (lungo il manico) e **verticali** (attraverso le posizioni)
e il **collegamento delle posizioni**. Deve essere deterministico e testabile.

## Decisione

`fingering(eventi, ambito, profilo) → eventi + {string, fret}`, funzione pura in `js/exercises/fingering.js`.

- **Candidati**: per ogni altezza, tutte le `(s, f)` con `TUNING[s] + f = midi` che l'ambito
  ammette (corde, tasti `da`–`a`, corde a vuoto sì o no). Al massimo 6 candidati per nota.
  Con l'ambito `chain` (ADR 0006) i vincoli sono **per nota**: ogni nota ammette solo le
  posizioni del proprio segmento.
- **Viterbi**: minimizza la somma dei costi di transizione lungo la sequenza. Complessità
  `O(n · c²)` con c ≤ 6, quindi trascurabile anche per centinaia di note.
- **Costo di transizione** `(s1,f1) → (s2,f2)` (pesi configurabili, valori iniziali da tarare):
  - *estensione*: `max(0, |f2 − f1| − 3) · w_shift`, perché la mano copre circa 4 tasti senza spostarsi;
  - *salto di corda*: `max(0, |s2 − s1| − 1) · w_skip`;
  - *verso*: se l'altezza sale ma la corda scende (o viceversa) `+ w_dir`, così il percorso
    resta "in diagonale" come si suona davvero;
  - *stessa corda, salto ampio*: incluso nell'estensione;
  - *corda a vuoto*: `+ w_open` (preferenza regolabile);
  - *altezza sul manico*: `+ w_height · f` (piccolo, a parità preferisce i tasti bassi).
- **Profili**: insiemi di pesi predefiniti, scelti dall'utente come "Distribuzione":

  | Profilo | `w_shift` | `w_skip` / cambio di corda | Risultato |
  |---|---|---|---|
  | `balanced` (default) | medio | medio | percorso naturale, diagonale |
  | `horizontal` | basso | alto (anche per il semplice cambio di corda) | corse lunghe lungo il manico su poche corde |
  | `vertical` | alto | basso | resta in posizione e la cambia solo quando le note finiscono |

  Per `horizontal` si aggiunge il termine *cambio di corda* `|s2 − s1| · w_cross`, a zero negli
  altri profili.
- **Spareggio deterministico**: corda più grave, poi tasto più basso.
- **Ripetizione della stessa altezza**: resta nella stessa posizione (costo 0).
- Gli ambiti a posizione unica (diteggiatura 3NPS) hanno un candidato per nota: Viterbi
  restituisce banalmente quello. Un solo algoritmo per tutti gli ambiti.

## Alternative scartate

- **Scelta greedy nota per nota**: va in vicoli ciechi (sale troppo presto sul manico e poi deve
  tornare indietro).
- **Modello completo della mano** (stato = dito + posizione della mano): più realistico, ma
  lo spazio degli stati esplode e i pesi diventano difficili da tarare. Si può introdurre dopo
  con la stessa firma.
- **Diteggiature scritte a mano per preset**: non scalano su scale × toniche × ambiti.

## Conseguenze

- Test di proprietà in Node su tutte le scale, toniche, preset e ambiti: ogni posizione suona
  l'altezza giusta e sta dentro l'ambito; nessun salto di più di N tasti senza cambio di
  posizione; risultato identico tra un'esecuzione e l'altra.
- Casi di riferimento da fissare nei test: Do ionica su una corda, 1 ottava dalla tonica (6ª corda, tasti 8, 10, 12, 13, 15, 17, 19, 20),
  Do ionica 2 ottave su tastiera intera (percorso diagonale atteso).
- Casi di riferimento per i profili: Do ionica 2 ottave, `neck`. Con `vertical` la maggior parte
  delle note sta in una finestra di 5 tasti, con `horizontal` su 2–3 corde.
- L'interfaccia espone solo il profilo e "corde a vuoto" sì o no; i pesi numerici restano nel codice.
