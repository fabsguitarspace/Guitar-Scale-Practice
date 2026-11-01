/**
 * Generatore melodico (ADR 0005, asse "Cosa"): percorre un pool di altezze secondo un motivo.
 * Modulo puro.
 */
(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;

  /** Converte intervalli con segno ([+2, -1]) in offset dal gradino ([0, 2, 1]). */
  function fromIntervals(intervals) {
    const out = [0];
    for (const d of intervals) out.push(out[out.length - 1] + d);
    return out;
  }

  /**
   * Gruppi ascendenti: su ogni gradino i (passo `step`) il motivo, eventualmente trasformato.
   * shape: forward | alternate (invertito a gradini alterni) | palindrome (motivo + retrogrado).
   */
  function upGroups(n, motif, step, shape) {
    const min = Math.min(...motif);
    const max = Math.max(...motif);
    const groups = [];
    for (let i = -min, g = 0; i + max < n; i += step, g++) {
      let m = motif;
      if (shape === 'alternate' && g % 2 === 1) m = [...motif].reverse();
      else if (shape === 'palindrome') m = [...motif, ...[...motif].reverse()];
      groups.push(m.map((x) => i + x));
    }
    return groups;
  }

  /**
   * Sequenza di indici nel pool: [{k, group}].
   * direction: up | down | updown | downup. In discesa il motivo è specchiato dall'alto.
   * Con motivi di una sola nota la nota di svolta non si ripete.
   */
  function melodic(n, { motif = [0], step = 1, direction = 'up', shape = 'forward' } = {}) {
    if (!n || !motif.length) return [];
    step = Math.max(1, step | 0);
    const up = upGroups(n, motif, step, shape);
    const down = up.map((grp) => grp.map((k) => n - 1 - k));
    let groups;
    if (direction === 'down') groups = down;
    else if (direction === 'updown') groups = up.concat(down);
    else if (direction === 'downup') groups = down.concat(up);
    else groups = up;

    const out = [];
    groups.forEach((grp, g) => grp.forEach((k) => out.push({ k, group: g })));

    if (motif.length === 1 && (direction === 'updown' || direction === 'downup') && up.length > 1) {
      // Rimuove la ripetizione della nota di svolta (es. ... 7 8 8 7 ... → ... 7 8 7 ...).
      out.splice(up.length, 1);
      for (let i = up.length; i < out.length; i++) out[i].group -= 1;
    }
    return out;
  }

  const Melodic = { melodic, fromIntervals };

  if (isNode) module.exports = Melodic;
  else root.Melodic = Melodic;
})(globalThis);
