# ADR 0007 — UI della pratica: pannello Esercizi, tastiera intera, tablatura, trasporto

- Stato: Accettato (2026-11-01, `js/practice.js`)
- Data: 2026-11-01

## Contesto

L'app è mobile-first: su telefono la barra in basso ospita il pulsante "Scala casuale".
Le nuove funzioni aggiungono controlli (ambito, esercizio, ritmo, BPM, metronomo, loop), tre
viste dell'esercizio (tastiera, gradi, tablatura) e un'azione frequente (Play/Stop) che deve
stare a portata di pollice.

## Decisione

1. **Ascolto rapido**: ogni card di diteggiatura ha un pulsante ▶ che suona la diteggiatura in
   salita e discesa (preset lineare, ottavi, BPM corrente).
2. **Pannello "Esercizi"**: una card tra l'intestazione della scala e le diteggiature, chiusa per
   default su mobile (`<details>`) e aperta su desktop. È organizzato sui **tre assi** del
   [catalogo](esercizi.md), ciascuno in un gruppo richiudibile con un riepilogo di una riga
   (es. "Cosa: Terze alternate · 2 ottave"):
   - **Cosa**: famiglia (Lineari · Intervalli · Sequenze · Sequenze intervallari) → preset;
     direzione (su, giù, su e giù, giù e su); estensione (1, 2, 3 ottave, tutta);
   - **Come**: suddivisione o cella ritmica; swing; accento (sul gruppo, ogni 2, 3 o 4, spostamento);
     levare (0 … n note); preset della famiglia Ritmici che impostano tutto insieme;
   - **Dove**: ambito (Tastiera intera · Corde [scelta multipla 1–6] · Diteggiatura 1…n ·
     Posizione · Collegamento posizioni) con i suoi campi (tasti da–a, tasto di posizione);
     distribuzione (Bilanciata · Orizzontale · Verticale); corde a vuoto sì o no;
   - in fondo: metronomo, loop, count-in.
   La selezione delle corde è una fila di 6 chip (`e B G D A E`) a selezione multipla: le
   coppie e le terne si ottengono toccando corde adiacenti.
3. **Viste dell'esercizio**, sotto i controlli e in sincronia con la riproduzione:
   - **Tastiera**: con l'ambito tastiera intera, un diagramma 0–24 che mostra tutte le note
     della scala attenuate, il percorso dell'esercizio a piena intensità e la nota corrente
     evidenziata. Su mobile 25 tasti non entrano in 343px: il diagramma sta in un contenitore
     con **scroll orizzontale interno** (la pagina non scorre mai in orizzontale), con
     larghezza minima ~30px per tasto, e segue automaticamente la nota suonata. Su desktop entra
     intero. Con l'ambito diteggiatura si evidenzia direttamente la card della diteggiatura.
   - **Gradi**: l'elenco testuale della sequenza (es. `1 3 · 2 4 · 3 5 …`) con la nota corrente marcata.
   - **Tablatura** (ADR 0009): SVG con ritmo e accenti, a capo per battute; azioni "Copia tab"
     e "Stampa".
   Su mobile le tre viste sono impilate (tastiera → tab → gradi); un toggle permette di
   nascondere quelle che non servono.
4. **Barra di trasporto**: su mobile la barra in basso diventa
   `[ 🔀 ]  [ − 120 BPM + ]  [ ▶ Play ]`. "Scala casuale" passa a pulsante icona e Play diventa
   l'azione principale. Su desktop la stessa barra compare in cima al pannello Esercizi.
5. **Tastiera**: Spazio passa a Play/Stop quando il pannello Esercizi è aperto; Invio continua a
   estrarre una nuova scala; ←/→ cambiano il BPM di 5.
6. **Estrarre una nuova scala o cambiare l'ambito ferma la riproduzione.** Cambiare le etichette
   Gradi/Note no (principio 3 in [architecture.md](architecture.md)).

```
Mobile (375px)                          Desktop (≥1024px)
┌───────────────────────────┐           ┌────────┬──────────────────────────────────┬──────┐
│ ☰   Interval Master    ⟲ │           │ Impost.│ [Scala casuale]                  │Crono.│
├───────────────────────────┤           │        │ ┌ C Dorica ───────────────────┐  │      │
│ ┌ C Dorica ─────────────┐ │           │        │ └─────────────────────────────┘  │      │
│ └───────────────────────┘ │           │        │ ┌ Esercizi ────────────────────┐ │      │
│ ▾ Esercizi                │           │        │ │ ▶ −120+ ♩metr ⟳loop          │ │      │
│  Cosa ▸ Terze alt.·2 ott. │           │        │ │ Cosa ▸ │ Come ▸ │ Dove ▸     │ │      │
│  Come ▸ ♪♪ · acc. ogni 2  │           │        │ │ ┌ tastiera 0–24 ──────────┐  │ │      │
│  Dove ▸ Tastiera · Bilan. │           │        │ │ │ ●─●──◉──●               │  │ │      │
│  ┌ tastiera ◄──scroll──►┐ │           │        │ │ └─────────────────────────┘  │ │      │
│  │ ●─●──◉──●            │ │           │        │ │ ┌ tab (4 battute/riga) ───┐  │ │      │
│  └──────────────────────┘ │           │        │ │ └─────────────────────────┘  │ │      │
│  ┌ tab (1–2 battute) ───┐ │           │        │ │ 1 3 · 2 4 · 3 5 …           │ │      │
│  │ e|--8-10--12--       │ │           │        │ └──────────────────────────────┘ │      │
│  └──────────────────────┘ │           │        │ ┌ Dit.1 ▶ ┐ ┌ Dit.2 ▶ ┐          │      │
├───────────────────────────┤           └────────┴──────────────────────────────────┴──────┘
│ [🔀]  [− 120 +]  [▶ Play] │
└───────────────────────────┘
```

## Alternative scartate

- **Una vista "Pratica" separata (tab)**: richiede un secondo stato di navigazione e allontana le
  diteggiature dall'esercizio.
- **Controlli in un drawer**: Play/BPM devono restare visibili mentre si suona.
- **Tastiera intera rimpicciolita fino a entrare a 343px**: circa 13px per tasto, pallini
  illeggibili e impossibili da toccare.

## Conseguenze

- `app.js` delega a `practice.js` (`Practice.mount({scale, root, notes, patterns, container})`) e
  cede la barra in basso tramite un'API minima.
- Il diagramma della tastiera intera riusa `Fretboard.render` con le opzioni `fretFrom/fretTo`,
  `cellWidth` (SVG a larghezza fissa dentro il contenitore scorrevole) e `path` (pallini fuori
  percorso attenuati); non serve un `neck.js` separato.
- Le impostazioni della pratica (ambito, preset, ritmo, BPM, metronomo, loop, trainer, volumi,
  viste) si salvano in una chiave `localStorage` propria (`gsp:practice:v1`), separata da quella
  dell'estrazione: i due moduli restano indipendenti.
