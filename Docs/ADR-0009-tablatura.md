# ADR 0009 — Tablatura dell'esercizio in SVG generata dagli eventi

- Stato: Accettato (2026-11-01, `js/tab/layout.js`, `js/tab/render.js`)
- Data: 2026-11-01

## Contesto

Oltre all'evidenziazione sulla tastiera e all'elenco dei gradi, l'esercizio va mostrato come
**tablatura**: si legge in anticipo, mostra ritmo e accenti, si può copiare o stampare.

## Decisione

La tablatura è una **vista degli stessi eventi** che suona lo scheduler
(`{beat, dur, string, fret, accent, rest}`): nessun dato in più, quindi tab e audio coincidono
per costruzione.

Due livelli:

1. **Layout (puro, `js/tab/layout.js`, testabile in Node)**:
   `layout(eventi, {meter, width}) → sistemi[] → battute[] → simboli con x`.
   - spaziatura proporzionale alla durata, con larghezza minima per i numeri a due cifre;
   - stanghette ogni `meter` battiti; con il levare (`beat < 0`) la prima battuta è
     un'**anacrusi** incompleta e la numerazione delle battute parte dalla successiva;
   - accenti spostati (`accentOffset`) resi come `>` sulla nota effettivamente accentata; a capo per battute intere in base alla larghezza
     disponibile (su mobile 1–2 battute per riga, su desktop 4);
   - raggruppamento ritmico per battito: tipo di figura (♪, ♬), travature, numero dei gironi
     irregolari (3, 5, 6), punto, pause;
   - accenti (`>`) sopra il rigo, swing indicato in testa ("Swing ♪♪ = ♪³♪").
2. **Rendering (`js/tab/render.js`)**: SVG con 6 righe (1ª corda in alto, come nei diagrammi),
   numeri dei tasti su sfondo (che copre la riga), gambi e travature sotto il rigo.
   Ogni numero ha `data-i` (indice dell'evento) per l'evidenziazione in tempo reale.

**Sincronizzazione**: lo stesso ciclo rAF che evidenzia la tastiera (ADR 0004) evidenzia il
numero `data-i` corrente e fa scorrere la tab in vista con `scrollIntoView({block: 'nearest'})`.

**Funzioni extra**:
- **Copia come testo**: tab ASCII (`e|--8--10--12--|`) negli appunti, per incollarla ovunque;
- **Stampa**: CSS `@media print` che mostra solo intestazione della scala, gradi e tablatura.

**Responsive**: il layout si ricalcola su `ResizeObserver` del contenitore. Niente scroll
orizzontale: si va a capo per battute.

## Alternative scartate

- **Libreria di notazione (VexFlow, alphaTab)**: resa eccellente, ma 200 KB – 1 MB e una
  dipendenza in contrasto con l'ADR 0001. Inoltre i gironi irregolari in tab sono un
  sottoinsieme gestibile a mano.
- **Solo tab ASCII**: niente ritmo leggibile, niente evidenziazione, resa scarsa su mobile.
- **Pentagramma**: richiesto solo come tab; si potrà aggiungere riusando il layout ritmico.

## Conseguenze

- Il layout ritmico è la parte più delicata: va coperto da test sui ritmi di ADR 0005
  (ottavi, terzine, sedicesimi, quintine, sestine, galoppo, puntato, pause, ripetute).
- Esercizi lunghi su tastiera intera (centinaia di note) producono molte righe: la tab vive in
  un contenitore con altezza massima e scroll verticale interno, che segue la riproduzione.
