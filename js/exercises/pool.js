/**
 * Ambito degli esercizi (ADR 0006): posizioni ammesse e pool di altezze.
 * Modulo puro: niente DOM, caricabile da Node.
 */
(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;
  const Guitar = isNode ? require('../guitar.js') : root.Guitar;
  const { TUNING, MAX_FRET } = Guitar;

  const mod = (a, n) => ((a % n) + n) % n;

  /**
   * Contesto della scala: semitoni dei gradi, classe di altezza della tonica e diteggiature 3NPS.
   */
  function context(semis, rootPc, patterns) {
    return { semis, rootPc, patterns: patterns || [] };
  }

  /** Indice di grado di una nota MIDI nella scala, oppure -1. */
  function degreeOf(midi, ctx) {
    return ctx.semis.indexOf(mod(midi - ctx.rootPc, 12));
  }

  const clampFret = (f) => Math.max(0, Math.min(MAX_FRET, f | 0));

  /**
   * Posizioni (corda, tasto) della scala che l'ambito ammette.
   * scope.kind: neck | strings | pattern | position | chain
   */
  function allowedPositions(scope, ctx) {
    if (scope.kind === 'pattern') {
      const p = ctx.patterns[scope.index] || ctx.patterns[0];
      if (!p) return [];
      return p.positions.map((q) => ({
        string: q.string, fret: q.fret, midi: TUNING[q.string] + q.fret, degree: q.degree,
      }));
    }
    if (scope.kind === 'chain') {
      const seen = new Map();
      for (const seg of chainSegments(scope, ctx)) {
        for (const q of allowedPositions(seg, ctx)) seen.set(q.string + ':' + q.fret, q);
      }
      return [...seen.values()];
    }
    let strings = [0, 1, 2, 3, 4, 5];
    let from = 0;
    let to = MAX_FRET;
    if (scope.kind === 'neck' || scope.kind === 'strings') {
      from = clampFret(scope.fretFrom ?? 0);
      to = clampFret(scope.fretTo ?? MAX_FRET);
      if (scope.kind === 'strings' && Array.isArray(scope.strings) && scope.strings.length) {
        strings = [...new Set(scope.strings)].filter((s) => s >= 0 && s < 6).sort();
      }
    } else if (scope.kind === 'position') {
      from = clampFret(scope.fret ?? 0);
      to = Math.min(MAX_FRET, from + 4);
    }
    if (from > to) [from, to] = [to, from];
    const allowOpen = scope.allowOpen !== false;
    const out = [];
    for (const s of strings) {
      for (let f = from; f <= to; f++) {
        if (f === 0 && !allowOpen && scope.kind !== 'position') continue;
        const midi = TUNING[s] + f;
        const degree = degreeOf(midi, ctx);
        if (degree >= 0) out.push({ string: s, fret: f, midi, degree });
      }
    }
    return out;
  }

  /** Segmenti di una catena: di default tutte le diteggiature 3NPS, dal basso verso l'alto. */
  function chainSegments(scope, ctx) {
    if (Array.isArray(scope.segments) && scope.segments.length) return scope.segments;
    return ctx.patterns
      .map((p, index) => ({ index, min: p.minFret }))
      .sort((a, b) => a.min - b.min || a.index - b.index)
      .map(({ index }) => ({ kind: 'pattern', index }));
  }

  /** Mappa midi → posizioni ammesse, ordinate per corda e poi per tasto. */
  function positionsByMidi(scope, ctx) {
    const map = new Map();
    for (const q of allowedPositions(scope, ctx)) {
      if (!map.has(q.midi)) map.set(q.midi, []);
      map.get(q.midi).push({ string: q.string, fret: q.fret });
    }
    for (const list of map.values()) list.sort((a, b) => a.string - b.string || a.fret - b.fret);
    return map;
  }

  /**
   * Pool di altezze in ordine crescente: [{k, midi, degree}].
   * extension: 1 | 2 | 3 (ottave dalla tonica più grave, ottava finale inclusa) | 'full'.
   * Restituisce anche `truncated` se l'estensione chiesta non entra nell'ambito.
   */
  function pitchPool(scope, ctx, extension = 'full') {
    const midis = [...new Set(allowedPositions(scope, ctx).map((q) => q.midi))].sort((a, b) => a - b);
    let list = midis;
    let truncated = false;
    if (extension !== 'full') {
      const lowRoot = midis.find((m) => degreeOf(m, ctx) === 0);
      if (lowRoot != null) {
        const top = lowRoot + 12 * Number(extension);
        list = midis.filter((m) => m >= lowRoot && m <= top);
        truncated = midis[midis.length - 1] < top;
      }
    }
    const pool = list.map((midi, k) => ({ k, midi, degree: degreeOf(midi, ctx) }));
    pool.truncated = truncated;
    return pool;
  }

  const Pool = { context, degreeOf, allowedPositions, chainSegments, positionsByMidi, pitchPool };

  if (isNode) module.exports = Pool;
  else root.Pool = Pool;
})(globalThis);
