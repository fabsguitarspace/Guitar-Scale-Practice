# Documentazione

- [architecture.md](architecture.md): architettura attuale e architettura di arrivo.
- [esercizi.md](esercizi.md): catalogo degli esercizi e corrispondenza con i parametri del modello.
- [plans/0001-audio-ed-esercizi.md](plans/0001-audio-ed-esercizi.md): piano per ascolto, esercizi su tutta la tastiera e tablatura.

## ADR (Architecture Decision Records)

| # | Titolo | Stato |
|---|---|---|
| [0001](ADR-0001-app-statica-senza-server.md) | Applicazione statica, senza server e senza build | Accettato |
| [0002](ADR-0002-script-classici-namespace-globali.md) | Script classici con namespace globali | Accettato |
| [0003](ADR-0003-sintesi-karplus-strong.md) | Suono: Karplus-Strong pre-renderizzato in AudioBuffer | Proposto |
| [0004](ADR-0004-scheduler-lookahead.md) | Temporizzazione: scheduler lookahead sul clock audio | Proposto |
| [0005](ADR-0005-modello-esercizi.md) | Esercizi: melodia × ritmo (Cosa × Come), funzioni pure | Proposto |
| [0006](ADR-0006-ambito-esercizi.md) | Ambito (Dove): altezze prima, posizioni poi; corde, posizioni collegate | Proposto |
| [0007](ADR-0007-ui-pratica-mobile.md) | UI della pratica: pannello, tastiera intera, tablatura, trasporto | Proposto |
| [0008](ADR-0008-assegnazione-posizioni.md) | Assegnazione delle posizioni: Viterbi con vincoli e profili | Proposto |
| [0009](ADR-0009-tablatura.md) | Tablatura dell'esercizio in SVG generata dagli eventi | Proposto |

Formato: contesto, decisione, alternative scartate, conseguenze.
Un ADR accettato non si modifica: se la decisione cambia se ne scrive uno nuovo che lo sostituisce.
Gli ADR "Proposti" si possono rivedere finché non vengono accettati (di norma a fine implementazione).
