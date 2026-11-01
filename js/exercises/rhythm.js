/**
 * Modello ritmico (ADR 0005, asse "Come"): trasforma una sequenza di note in eventi in battiti.
 * Lavora internamente in tick interi (TPB per battito) per evitare errori di arrotondamento
 * con terzine, quintine e sestine. Modulo puro.
 */
(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;

  /** Tick per battito: divisibile per 2, 3, 4, 5, 6, 8, 16. */
  const TPB = 960;
  const toTicks = (beats) => Math.round(beats * TPB);

  /**
   * @param notes  [{k, group}] dal generatore melodico
   * @param pool   [{k, midi, degree}]
   * @param opts   { cells: [{dur, rest?}], swing (0..1), accent: 'group'|'beat'|n,
   *                 accentOffset, pickup, repeat, meter }
   * @returns { events, lengthBeats, pickupBeats }
   *   events: [{i, beat, dur, ndur, k|null, midi, degree, accent, group, rest}]
   */
  function rhythm(notes, pool, opts = {}) {
    const cells = (opts.cells && opts.cells.length ? opts.cells : [{ dur: 0.5 }])
      .map((c) => ({ ticks: toTicks(c.dur), rest: !!c.rest }));
    const repeat = Math.max(1, opts.repeat | 0 || 1);
    const meter = Math.max(1, opts.meter | 0 || 4);
    const swing = Math.max(0, Math.min(1, Number(opts.swing) || 0));
    const accentOffset = Math.max(0, opts.accentOffset | 0);
    const pickup = Math.max(0, opts.pickup | 0);

    // Ripetizione delle note (pennata): stessa altezza, stesso gruppo.
    const seq = [];
    for (const n of notes) for (let r = 0; r < repeat; r++) seq.push(n);

    // Accento "sul gruppo" senza gruppi reali (motivo di una nota) → accento sul battito.
    let accent = opts.accent ?? 'group';
    if (accent === 'group') {
      const sizes = new Map();
      for (const n of seq) sizes.set(n.group, (sizes.get(n.group) || 0) + 1);
      if ([...sizes.values()].every((s) => s <= repeat)) accent = 'beat';
    }

    const events = [];
    let t = 0;
    let c = 0;
    let ni = 0;
    let posInGroup = 0;
    let prevGroup = null;
    while (ni < seq.length) {
      const cell = cells[c % cells.length];
      c++;
      if (cell.rest) {
        events.push({ ticks: t, len: cell.ticks, rest: true });
        t += cell.ticks;
        continue;
      }
      const n = seq[ni];
      if (n.group !== prevGroup) { posInGroup = 0; prevGroup = n.group; } else posInGroup++;
      let acc;
      if (accent === 'group') acc = posInGroup === accentOffset % groupSize(seq, ni, posInGroup);
      else if (accent === 'beat') acc = mod(t - toTicks(accentOffset * cell.ticks / TPB), TPB) === 0;
      else if (Number(accent) > 0) acc = mod(ni - accentOffset, Number(accent)) === 0;
      else acc = false;
      events.push({ ticks: t, len: cell.ticks, rest: false, note: n, accent: acc });
      t += cell.ticks;
      ni++;
    }

    // Levare: le prime `pickup` note (e le pause tra loro) cadono prima del battito 0.
    let shift = 0;
    if (pickup > 0) {
      let seen = 0;
      for (const e of events) {
        if (!e.rest) seen++;
        if (seen > pickup) break;
        shift = e.ticks + e.len;
        if (seen === pickup) break;
      }
      for (const e of events) e.ticks -= shift;
    }

    // Swing sugli ottavi: l'ottavo in battere si allunga, quello in levare si accorcia.
    if (swing > 0) {
      const delta = Math.round(swing * TPB / 6);
      for (const e of events) {
        if (e.len !== TPB / 2) continue;
        const pos = mod(e.ticks, TPB);
        if (pos === 0) { e.slen = e.len + delta; } else if (pos === TPB / 2) { e.sticks = e.ticks + delta; e.slen = e.len - delta; }
      }
    }

    // Lunghezza in battute intere dal battito 0; spazio in coda per il levare del giro dopo.
    const end = events.length ? Math.max(...events.map((e) => e.ticks + e.len)) : 0;
    const barTicks = meter * TPB;
    let length = Math.max(barTicks, Math.ceil(end / barTicks) * barTicks);
    if (shift > 0 && end > length - shift) length += barTicks;

    const out = events.map((e, i) => {
      const beat = (e.sticks ?? e.ticks) / TPB;
      const dur = (e.slen ?? e.len) / TPB;
      const ndur = e.len / TPB;
      if (e.rest) return { i, beat, dur, ndur, k: null, midi: null, degree: null, accent: false, group: null, rest: true };
      const p = pool[e.note.k];
      return {
        i, beat, dur, ndur, k: e.note.k, midi: p.midi, degree: p.degree,
        accent: e.accent, group: e.note.group, rest: false, segment: e.note.segment,
      };
    });
    return { events: out, lengthBeats: length / TPB, pickupBeats: shift / TPB };
  }

  function mod(a, n) { return ((a % n) + n) % n; }

  /** Lunghezza del gruppo melodico che contiene la nota seq[ni]. */
  function groupSize(seq, ni, posInGroup) {
    const g = seq[ni].group;
    let j = ni - posInGroup;
    let size = 0;
    while (j < seq.length && seq[j].group === g) { size++; j++; }
    return Math.max(1, size);
  }

  const Rhythm = { TPB, rhythm };

  if (isNode) module.exports = Rhythm;
  else root.Rhythm = Rhythm;
})(globalThis);
