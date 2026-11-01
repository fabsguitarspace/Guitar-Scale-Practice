/**
 * Assegnazione delle posizioni (ADR 0008, asse "Dove"): sceglie corda e tasto per ogni nota
 * con l'algoritmo di Viterbi. Lo stato è (posizione della nota, posizione della mano): la mano
 * copre una finestra di 4 tasti [w, w+3], estendibile di un tasto con un costo. Spostare la
 * finestra costa; così "restare in posizione" diventa un concetto esplicito. Modulo puro.
 */
(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;
  const Pool = isNode ? require('./pool.js') : root.Pool;

  /** Pesi dei profili di distribuzione. */
  const PROFILES = {
    //            spostamento mano      estens.  salto corda / cambio corda / verso   altezza  vuoto
    balanced:   { shiftFixed: 2,   shiftPerFret: 0.5,  stretch: 1,   skip: 2,   cross: 0.3, dir: 3, height: 0.02, open: 0.5 },
    horizontal: { shiftFixed: 0.3, shiftPerFret: 0.15, stretch: 0.6, skip: 4,   cross: 3,   dir: 3, height: 0.01, open: 0.5 },
    vertical:   { shiftFixed: 6,   shiftPerFret: 1.5,  stretch: 1.5, skip: 0.8, cross: 0,   dir: 2, height: 0.02, open: 0.5 },
  };

  const SPAN = 3;      // finestra base: w … w+3
  const EPS = 1e-9;
  const REPEAT_MOVE = 50; // stessa altezza ripetuta in una posizione diversa

  /** Finestre della mano compatibili con una posizione fretted. */
  function windowsFor(fret) {
    const out = [];
    for (let w = Math.max(1, fret - SPAN - 1); w <= fret; w++) out.push(w);
    return out;
  }

  function stateCost(c, w, wt) {
    let cost = wt.height * (c.fret || w) + (c.fret === 0 ? wt.open : 0);
    if (c.fret > 0 && c.fret > w + SPAN) cost += wt.stretch;
    return cost;
  }

  function transCost(a, b, pitchDelta, wt) {
    let cost = 0;
    if (a.w !== b.w) cost += wt.shiftFixed + Math.abs(b.w - a.w) * wt.shiftPerFret;
    const ds = b.string - a.string;
    cost += Math.max(0, Math.abs(ds) - 1) * wt.skip + Math.abs(ds) * wt.cross;
    if ((pitchDelta > 0 && ds < 0) || (pitchDelta < 0 && ds > 0)) cost += wt.dir;
    if (pitchDelta === 0 && (a.string !== b.string || a.fret !== b.fret)) cost += REPEAT_MOVE;
    return cost;
  }

  /**
   * @param events   eventi del ritmo (le pause vengono ignorate)
   * @param scope    ambito (ADR 0006); con `chain` ogni evento usa il segmento `segment`
   * @param ctx      Pool.context(...)
   * @param profile  balanced | horizontal | vertical
   * @returns copia degli eventi con {string, fret} sulle note; null se una nota non ha posizioni
   */
  function fingering(events, scope, ctx, profile = 'balanced') {
    const wt = PROFILES[profile] || PROFILES.balanced;
    const segScopes = scope.kind === 'chain' ? Pool.chainSegments(scope, ctx) : null;
    const maps = new Map();
    const mapFor = (seg) => {
      const key = segScopes ? (seg ?? 0) : 'all';
      if (!maps.has(key)) maps.set(key, Pool.positionsByMidi(segScopes ? segScopes[key] : scope, ctx));
      return maps.get(key);
    };

    const notes = events.filter((e) => !e.rest);
    const cands = notes.map((e) => mapFor(e.segment).get(e.midi) || []);
    if (cands.some((c) => c.length === 0)) return null;

    const n = notes.length;
    const layers = []; // per nota: [{string, fret, w, cost, back}]
    for (let i = 0; i < n; i++) {
      const prev = layers[i - 1];
      const prevWindows = prev ? [...new Set(prev.map((s) => s.w))] : [1];
      const states = [];
      for (const c of cands[i]) {
        const ws = c.fret === 0 ? prevWindows : windowsFor(c.fret);
        for (const w of ws) states.push({ string: c.string, fret: c.fret, w, cost: 0, back: -1 });
      }
      if (!prev) {
        for (const s of states) s.cost = stateCost(s, s.w, wt);
      } else {
        const dp = notes[i].midi - notes[i - 1].midi;
        for (const s of states) {
          let best = Infinity;
          let arg = 0;
          prev.forEach((a, j) => {
            const v = a.cost + transCost(a, s, dp, wt);
            if (v < best - EPS) { best = v; arg = j; }
          });
          s.cost = best + stateCost(s, s.w, wt);
          s.back = arg;
        }
      }
      layers.push(states);
    }

    const chosen = new Array(n);
    if (n) {
      const last = layers[n - 1];
      let j = 0;
      last.forEach((s, idx) => { if (s.cost < last[j].cost - EPS) j = idx; });
      for (let i = n - 1; i >= 0; i--) {
        chosen[i] = layers[i][j];
        j = layers[i][j].back;
      }
    }

    let ni = 0;
    return events.map((e) => {
      if (e.rest) return { ...e, string: null, fret: null };
      const c = chosen[ni++];
      return { ...e, string: c.string, fret: c.fret };
    });
  }

  const Fingering = { PROFILES, fingering };

  if (isNode) module.exports = Fingering;
  else root.Fingering = Fingering;
})(globalThis);
