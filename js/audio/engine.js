/**
 * Motore audio (ADR 0003): AudioContext, voci Karplus-Strong in cache, click del metronomo.
 * Si attiva solo dentro un gesto dell'utente (unlock), come richiedono i browser mobili.
 */
(function (root) {
  'use strict';

  const KS = root.KS;
  let ctx = null;
  let master = null;
  let noteBus = null;
  let clickBus = null;
  const cache = new Map(); // midi → {buffer, rate}
  const active = new Set();
  const voices = new Map(); // corda → voce in corso (smorzamento per corda)
  let volumes = { notes: 0.8, click: 0.6 };

  function supported() {
    return !!(root.AudioContext || root.webkitAudioContext);
  }

  /** Crea o riprende l'AudioContext. Va chiamata nel gestore di un tap o click. */
  function unlock() {
    if (!supported()) return false;
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      ctx = new AC({ latencyHint: 'interactive' });
      // iOS 17+: riproduzione anche con il tasto silenzioso attivo.
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (_) { /* ignora */ }
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.ratio.value = 4;
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(comp).connect(ctx.destination);
      const body = ctx.createBiquadFilter(); // ammorbidisce gli acuti del rumore iniziale
      body.type = 'lowpass';
      body.frequency.value = 5200;
      body.Q.value = 0.5;
      noteBus = ctx.createGain();
      noteBus.connect(body).connect(master);
      clickBus = ctx.createGain();
      clickBus.connect(master);
      setVolumes(volumes);
      // Buffer silenzioso: sblocca l'audio su Safari meno recenti.
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      src.connect(ctx.destination);
      src.start(0);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function voiceFor(midi) {
    let v = cache.get(midi);
    if (!v) {
      const { data, rate } = KS.renderPluck(KS.midiToFreq(midi), ctx.sampleRate);
      const buffer = ctx.createBuffer(1, data.length, ctx.sampleRate);
      buffer.getChannelData(0).set(data);
      v = { buffer, rate };
      cache.set(midi, v);
    }
    return v;
  }

  /** Pre-calcola i buffer delle altezze di un esercizio (evita lavoro durante la riproduzione). */
  function prepare(midis) {
    if (!ctx) return;
    for (const m of new Set(midis)) if (m != null) voiceFor(m);
  }

  /**
   * @param when     tempo AudioContext di inizio
   * @param opts     { velocity 0..1, string (per lo smorzamento), duration in secondi }
   */
  function playNote(midi, when, opts = {}) {
    if (!ctx) return;
    const { buffer, rate } = voiceFor(midi);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    const vel = opts.velocity ?? 0.8;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vel, when + 0.002);
    // Rilascio a fine nota con una coda breve (legato naturale).
    const dur = Math.max(0.08, opts.duration ?? 1);
    g.gain.setTargetAtTime(0, when + dur, 0.035);
    src.connect(g).connect(noteBus);
    src.start(when);
    src.stop(when + Math.min(buffer.duration, dur + 0.4));
    const voice = { src, g, when };
    active.add(voice);
    src.onended = () => { active.delete(voice); src.disconnect(); g.disconnect(); };
    // Smorzamento per corda: la nuova nota chiude la precedente sulla stessa corda.
    if (opts.string != null) {
      const prev = voices.get(opts.string);
      if (prev && prev.when < when) {
        try {
          prev.g.gain.cancelScheduledValues(when);
          prev.g.gain.setTargetAtTime(0, when, 0.008);
        } catch (_) { /* nota già terminata */ }
      }
      voices.set(opts.string, voice);
    }
  }

  function click(when, opts = {}) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = opts.downbeat ? 1500 : 1000;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(opts.downbeat ? 0.9 : 0.55, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.035);
    osc.connect(g).connect(clickBus);
    osc.start(when);
    osc.stop(when + 0.05);
    osc.onended = () => { osc.disconnect(); g.disconnect(); };
  }

  function stopAll() {
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const v of active) {
      try {
        v.g.gain.cancelScheduledValues(t);
        v.g.gain.setTargetAtTime(0, t, 0.01);
        v.src.stop(t + 0.08);
      } catch (_) { /* già fermata */ }
    }
    voices.clear();
  }

  function setVolumes(v) {
    volumes = { ...volumes, ...v };
    if (noteBus) noteBus.gain.value = volumes.notes;
    if (clickBus) clickBus.gain.value = volumes.click;
  }

  const now = () => (ctx ? ctx.currentTime : 0);
  const latency = () => (ctx ? (ctx.outputLatency || ctx.baseLatency || 0) : 0);

  root.AudioEngine = { supported, unlock, prepare, playNote, click, stopAll, setVolumes, now, latency, get ready() { return !!ctx; } };
})(globalThis);
