/**
 * Catalogo degli esercizi (Docs/esercizi.md) e pipeline completa:
 * pool → melodia → ritmo → posizioni. Modulo puro.
 */
(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;
  const Pool = isNode ? require('./pool.js') : root.Pool;
  const Melodic = isNode ? require('./melodic.js') : root.Melodic;
  const Rhythm = isNode ? require('./rhythm.js') : root.Rhythm;
  const Fingering = isNode ? require('./fingering.js') : root.Fingering;

  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const iv = Melodic.fromIntervals;

  const CATEGORIES = [
    { id: 'linear', label: 'Lineari' },
    { id: 'intervals', label: 'Intervalli' },
    { id: 'sequences', label: 'Sequenze' },
    { id: 'intervalSeq', label: 'Sequenze intervallari' },
    { id: 'rhythmic', label: 'Ritmici' },
  ];

  /** Celle ritmiche (asse "Come"). */
  const RHYTHMS = [
    { id: 'quarters', label: 'Semiminime', cells: [{ dur: 1 }] },
    { id: 'eighths', label: 'Ottavi', cells: [{ dur: 1 / 2 }] },
    { id: 'swing', label: 'Ottavi swing', cells: [{ dur: 1 / 2 }], swing: 1 },
    { id: 'triplets', label: 'Terzine di ottavi', cells: [{ dur: 1 / 3 }] },
    { id: 'sixteenths', label: 'Quartine di sedicesimi', cells: [{ dur: 1 / 4 }] },
    { id: 'quintuplets', label: 'Quintine', cells: [{ dur: 1 / 5 }] },
    { id: 'sextuplets', label: 'Sestine', cells: [{ dur: 1 / 6 }] },
    { id: 'gallop', label: 'Galoppo (♪ ♬)', cells: [{ dur: 1 / 2 }, { dur: 1 / 4 }, { dur: 1 / 4 }] },
    { id: 'revgallop', label: 'Galoppo inverso (♬ ♪)', cells: [{ dur: 1 / 4 }, { dur: 1 / 4 }, { dur: 1 / 2 }] },
    { id: 'dotted', label: 'Puntato (♪. ♬)', cells: [{ dur: 3 / 4 }, { dur: 1 / 4 }] },
    { id: 'rest4', label: 'Sedicesimi con pausa sul 4°', cells: [{ dur: 1 / 4 }, { dur: 1 / 4 }, { dur: 1 / 4 }, { dur: 1 / 4, rest: true }] },
    { id: 'repeat2', label: 'Sedicesimi, note ripetute ×2', cells: [{ dur: 1 / 4 }], repeat: 2 },
    { id: 'repeat4', label: 'Sedicesimi, note ripetute ×4', cells: [{ dur: 1 / 4 }], repeat: 4 },
  ];

  const P = (id, category, label, melodic, extra = {}) => ({ id, category, label, melodic, ...extra });

  /** Preset (asse "Cosa"; i ritmici impostano anche l'asse "Come"). */
  const PRESETS = [
    // 1. Lineari
    P('lin-up', 'linear', 'Ascendente', { motif: [0] }, { direction: 'up' }),
    P('lin-down', 'linear', 'Discendente', { motif: [0] }, { direction: 'down' }),
    P('lin-updown', 'linear', 'Ascendente e discendente', { motif: [0] }, { direction: 'updown' }),
    P('lin-downup', 'linear', 'Discendente e ascendente', { motif: [0] }, { direction: 'downup' }),
    // 2. Intervalli paralleli
    P('int-3', 'intervals', 'Terze (1-3, 2-4 …)', { motif: [0, 2] }),
    P('int-4', 'intervals', 'Quarte (1-4, 2-5 …)', { motif: [0, 3] }),
    P('int-5', 'intervals', 'Quinte (1-5, 2-6 …)', { motif: [0, 4] }),
    P('int-6', 'intervals', 'Seste (1-6, 2-7 …)', { motif: [0, 5] }),
    P('int-7', 'intervals', 'Settime (1-7, 2-8 …)', { motif: [0, 6] }),
    // 3. Sequenze
    P('seq-3', 'sequences', 'Gruppi di 3 (123 234 …)', { motif: range(3) }, { rhythm: 'triplets' }),
    P('seq-4', 'sequences', 'Gruppi di 4 (1234 2345 …)', { motif: range(4) }, { rhythm: 'sixteenths' }),
    P('seq-5', 'sequences', 'Gruppi di 5 (12345 …)', { motif: range(5) }, { rhythm: 'quintuplets' }),
    P('seq-6', 'sequences', 'Gruppi di 6 (123456 …)', { motif: range(6) }, { rhythm: 'sextuplets' }),
    P('seq-3p', 'sequences', 'Gruppi di 3 alternati (123 321 …)', { motif: range(3), shape: 'palindrome' }, { rhythm: 'triplets' }),
    P('seq-4p', 'sequences', 'Gruppi di 4 alternati (1234 4321 …)', { motif: range(4), shape: 'palindrome' }, { rhythm: 'sixteenths' }),
    // 4. Sequenze intervallari alternate
    P('alt-3', 'intervalSeq', 'Terze alternate (1-3, 4-2 …)', { motif: [0, 2], shape: 'alternate' }),
    P('alt-3p', 'intervalSeq', 'Terze andata e ritorno (1-3-3-1 …)', { motif: [0, 2], shape: 'palindrome' }, { rhythm: 'sixteenths' }),
    P('alt-4', 'intervalSeq', 'Quarte alternate (1-4, 5-2 …)', { motif: [0, 3], shape: 'alternate' }),
    P('alt-5', 'intervalSeq', 'Quinte alternate (1-5, 6-2 …)', { motif: [0, 4], shape: 'alternate' }),
    P('mix-32', 'intervalSeq', 'Su di 3ª, giù di 2ª (1 3 2 …)', { motif: iv([2, -1]) }, { rhythm: 'triplets' }),
    P('mix-43', 'intervalSeq', 'Su di 4ª, giù di 3ª (1 4 2 …)', { motif: iv([3, -2]) }, { rhythm: 'triplets' }),
    P('mix-54', 'intervalSeq', 'Su di 5ª, giù di 4ª (1 5 2 …)', { motif: iv([4, -3]) }, { rhythm: 'triplets' }),
    P('prog-4', 'intervalSeq', 'Salti crescenti (1 2 4 7 …)', { motif: [0, 1, 3, 6] }, { rhythm: 'sixteenths' }),
    P('prog-5', 'intervalSeq', 'Salti crescenti fino alla 5ª (1 2 4 7 11 …)', { motif: [0, 1, 3, 6, 10] }, { rhythm: 'quintuplets' }),
    // 5. Ritmici (impostano anche ritmo e accenti)
    P('rit-16', 'rhythmic', 'Quartine di sedicesimi', { motif: [0] }, { direction: 'updown', rhythm: 'sixteenths', accent: 'beat' }),
    P('rit-3', 'rhythmic', 'Terzine di ottavi', { motif: [0] }, { direction: 'updown', rhythm: 'triplets', accent: 'beat' }),
    P('rit-6', 'rhythmic', 'Sestine', { motif: [0] }, { direction: 'updown', rhythm: 'sextuplets', accent: 'beat' }),
    P('rit-swing', 'rhythmic', 'Ottavi swing', { motif: [0] }, { direction: 'updown', rhythm: 'swing', accent: 'beat' }),
    P('rit-acc3', 'rhythmic', 'Accento ogni 3 su sedicesimi (3 contro 4)', { motif: [0] }, { direction: 'updown', rhythm: 'sixteenths', accent: 3 }),
    P('rit-acc2', 'rhythmic', 'Accento ogni 2 su terzine', { motif: [0] }, { direction: 'updown', rhythm: 'triplets', accent: 2 }),
    P('rit-shift', 'rhythmic', 'Accento spostato sulla 2ª sedicesima', { motif: [0] }, { direction: 'updown', rhythm: 'sixteenths', accent: 4, accentOffset: 1 }),
    P('rit-pickup', 'rhythmic', 'Gruppi di 4 in levare', { motif: range(4) }, { rhythm: 'sixteenths', accent: 'group', pickup: 1 }),
    P('rit-gallop', 'rhythmic', 'Galoppo', { motif: [0] }, { direction: 'updown', rhythm: 'gallop', accent: 'beat' }),
  ];

  const DEFAULTS = {
    presetId: 'lin-updown',
    direction: 'updown',
    extension: 2,
    rhythmId: 'eighths',
    accent: 'group',
    accentOffset: 0,
    pickup: 0,
    meter: 4,
    scope: { kind: 'neck', fretFrom: 0, fretTo: 24, strings: [0], index: 0, fret: 5, allowOpen: true },
    profile: 'balanced',
  };

  const preset = (id) => PRESETS.find((p) => p.id === id) || PRESETS[0];
  const rhythmDef = (id) => RHYTHMS.find((r) => r.id === id) || RHYTHMS[1];

  /** Impostazioni che un preset applica quando viene scelto. */
  function presetDefaults(id) {
    const p = preset(id);
    const out = { presetId: p.id, direction: p.direction || 'updown', rhythmId: p.rhythm || 'eighths' };
    out.accent = p.accent ?? 'group';
    out.accentOffset = p.accentOffset ?? 0;
    out.pickup = p.pickup ?? 0;
    return out;
  }

  /**
   * Pipeline completa.
   * @param ctx       Pool.context(semis, rootPc, patterns)
   * @param settings  vedi DEFAULTS
   * @returns { pool, events, lengthBeats, pickupBeats, error? }
   */
  function build(ctx, settings) {
    const s = { ...DEFAULTS, ...settings, scope: { ...DEFAULTS.scope, ...(settings && settings.scope) } };
    const p = preset(s.presetId);
    const r = rhythmDef(s.rhythmId);
    const mel = { ...p.melodic };

    let pool;
    let notes;
    if (s.scope.kind === 'chain') {
      // Collegamento delle posizioni: un segmento per diteggiatura, direzione alternata.
      const segs = Pool.chainSegments(s.scope, ctx);
      const byMidi = new Map();
      notes = [];
      let groupBase = 0;
      segs.forEach((seg, si) => {
        const sp = Pool.pitchPool(seg, ctx, 'full');
        let dir = s.direction;
        if (dir === 'updown' || dir === 'downup') dir = (si % 2 === 0) === (dir === 'updown') ? 'up' : 'down';
        else if (si % 2 === 1) dir = dir === 'up' ? 'down' : 'up';
        const seq = Melodic.melodic(sp.length, { ...mel, direction: dir });
        let maxG = -1;
        for (const n of seq) {
          const midi = sp[n.k].midi;
          if (!byMidi.has(midi)) byMidi.set(midi, { midi, degree: sp[n.k].degree });
          notes.push({ midi, group: groupBase + n.group, segment: si });
          maxG = Math.max(maxG, n.group);
        }
        groupBase += maxG + 1;
      });
      pool = [...byMidi.values()].sort((a, b) => a.midi - b.midi).map((q, k) => ({ k, ...q }));
      const kOf = new Map(pool.map((q) => [q.midi, q.k]));
      notes = notes.map((n) => ({ k: kOf.get(n.midi), group: n.group, segment: n.segment }));
    } else {
      pool = Pool.pitchPool(s.scope, ctx, s.extension);
      notes = Melodic.melodic(pool.length, { ...mel, direction: s.direction });
    }

    if (!notes.length) {
      return { pool, events: [], lengthBeats: 0, pickupBeats: 0, error: 'Il motivo non entra nelle note disponibili: allarga l\'ambito o l\'estensione.' };
    }

    const rh = Rhythm.rhythm(notes, pool, {
      cells: r.cells,
      swing: r.swing || 0,
      repeat: r.repeat || 1,
      accent: s.accent,
      accentOffset: s.accentOffset,
      pickup: s.pickup,
      meter: s.meter,
    });
    const events = Fingering.fingering(rh.events, s.scope, ctx, s.profile);
    if (!events) {
      return { pool, events: [], lengthBeats: 0, pickupBeats: 0, error: 'Alcune note non hanno una posizione nell\'ambito scelto.' };
    }
    return { pool, events, lengthBeats: rh.lengthBeats, pickupBeats: rh.pickupBeats, truncated: !!pool.truncated };
  }

  const Presets = { CATEGORIES, RHYTHMS, PRESETS, DEFAULTS, preset, rhythmDef, presetDefaults, build };

  if (isNode) module.exports = Presets;
  else root.Presets = Presets;
})(globalThis);
