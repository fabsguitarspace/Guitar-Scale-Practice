/**
 * Sintesi Karplus-Strong (ADR 0003): una corda pizzicata calcolata in un Float32Array.
 * Modulo puro (niente Web Audio), testabile in Node.
 */
(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;

  const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  /** Generatore pseudo-casuale deterministico (mulberry32), per buffer riproducibili. */
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Tempo di decadimento (−60 dB) in secondi: le note gravi suonano più a lungo. */
  function t60For(freq) {
    return Math.max(0.9, Math.min(4, 4 * Math.sqrt(82.41 / freq)));
  }

  /**
   * @returns { data: Float32Array, rate, f0 }
   *   f0   = frequenza prodotta dalla linea di ritardo intera: y[n] = ½(y[n−N] + y[n−N+1]),
   *          quindi periodo N − 0,5 campioni e f0 = sr / (N − 0,5)
   *   rate = playbackRate da applicare per ottenere esattamente `freq`
   */
  function renderPluck(freq, sampleRate, opts = {}) {
    const brightness = opts.brightness ?? 0.55;
    const N = Math.max(2, Math.floor(sampleRate / freq + 0.5));
    const f0 = sampleRate / (N - 0.5);
    const t60 = t60For(freq);
    const duration = Math.min(opts.duration ?? 2.2, t60 + 0.2);
    const len = Math.max(N * 4, Math.round(duration * sampleRate));
    // Perdita per periodo per arrivare a −60 dB in t60 (il filtro media aggiunge altra perdita sugli acuti).
    const rho = Math.pow(10, -3 / (t60 * f0));

    // Eccitazione: rumore passato in un passa-basso a un polo, senza componente continua.
    const rand = rng(opts.seed ?? Math.round(freq * 1000));
    const buf = new Float32Array(N);
    let prev = 0;
    let mean = 0;
    for (let i = 0; i < N; i++) {
      prev = brightness * (rand() * 2 - 1) + (1 - brightness) * prev;
      buf[i] = prev;
      mean += prev;
    }
    mean /= N;
    for (let i = 0; i < N; i++) buf[i] -= mean;

    const out = new Float32Array(len);
    let idx = 0;
    let peak = 0;
    for (let n = 0; n < len; n++) {
      const cur = buf[idx];
      const next = buf[idx + 1 === N ? 0 : idx + 1];
      out[n] = cur;
      buf[idx] = rho * 0.5 * (cur + next);
      idx = idx + 1 === N ? 0 : idx + 1;
      const a = Math.abs(cur);
      if (a > peak) peak = a;
    }

    // Normalizzazione e dissolvenza finale (50 ms) contro i click.
    const gain = peak > 0 ? 0.9 / peak : 0;
    const fade = Math.min(len, Math.round(0.05 * sampleRate));
    for (let n = 0; n < len; n++) {
      let g = gain;
      const fromEnd = len - n;
      if (fromEnd <= fade) g *= (fromEnd - 1) / fade;
      out[n] *= g;
    }
    return { data: out, rate: freq / f0, f0 };
  }

  const KS = { midiToFreq, renderPluck, t60For };

  if (isNode) module.exports = KS;
  else root.KS = KS;
})(globalThis);
