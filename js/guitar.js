/**
 * Diteggiature a 3 note per corda (3NPS) per chitarra in accordatura standard.
 * Porting di interval-master/src/guitar.rs.
 */
(function (root) {
  'use strict';

  const Theory = typeof module !== 'undefined' && module.exports ? require('./theory.js') : root.Theory;

  /** Altezze MIDI delle corde a vuoto, dalla 6ª (E grave) alla 1ª (e acuto). */
  const TUNING = [40, 45, 50, 55, 59, 64];
  const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
  /** Tasto più alto ammesso prima di riportare la diteggiatura un'ottava sotto. */
  const MAX_FRET = 24;

  const mod = (a, n) => ((a % n) + n) % n;

  /**
   * Tutte le diteggiature 3NPS della scala: una per ogni grado di partenza sulla 6ª corda.
   * Ogni posizione: { string (0 = 6ª … 5 = 1ª), fret, degree (indice, 0 = tonica) }.
   */
  function threeNpsPatterns(scale, rootPc) {
    const semis = Theory.semitones(scale);
    const n = semis.length;
    const patterns = [];
    for (let start = 0; start < n; start++) {
      // Primo tasto (0..11) della 6ª corda che suona il grado di partenza.
      const firstPc = mod(rootPc + semis[start], 12);
      const base = TUNING[0] + mod(firstPc - TUNING[0], 12);

      const positions = [];
      for (let k = 0; k < 18; k++) {
        const idx = start + k;
        const deg = idx % n;
        const octave = Math.floor(idx / n);
        const midi = base + semis[deg] - semis[start] + 12 * octave;
        const string = Math.floor(k / 3);
        positions.push({ string, fret: midi - TUNING[string], degree: deg });
      }

      // Sotto il capotasto: un'ottava sopra; oltre la tastiera: un'ottava sotto.
      const frets = positions.map((p) => p.fret);
      const min = Math.min(...frets);
      const max = Math.max(...frets);
      const shift = min < 0 ? 12 : max > MAX_FRET && min >= 12 ? -12 : 0;
      for (const p of positions) p.fret += shift;

      patterns.push({
        startDegree: start,
        positions,
        minFret: min + shift,
        maxFret: max + shift,
      });
    }
    return patterns;
  }

  const Guitar = { TUNING, STRING_NAMES, MAX_FRET, threeNpsPatterns };

  if (typeof module !== 'undefined' && module.exports) module.exports = Guitar;
  else root.Guitar = Guitar;
})(typeof globalThis !== 'undefined' ? globalThis : this);
