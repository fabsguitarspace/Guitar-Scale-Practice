// Sintesi Karplus-Strong (ADR 0003) e scheduler lookahead (ADR 0004).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const KS = require('../js/audio/ks.js');
const Scheduler = require('../js/audio/scheduler.js');

/** Stima della frequenza per autocorrelazione con interpolazione parabolica. */
function estimateF0(data, sr, guessLag) {
  const start = Math.round(0.05 * sr);
  const len = Math.round(0.1 * sr);
  const corr = (lag) => {
    let s = 0;
    for (let i = start; i < start + len; i++) s += data[i] * data[i + lag];
    return s;
  };
  let best = guessLag;
  for (let lag = guessLag - 3; lag <= guessLag + 3; lag++) if (corr(lag) > corr(best)) best = lag;
  const a = corr(best - 1); const b = corr(best); const c = corr(best + 1);
  const shift = (a - c) / (2 * (a - 2 * b + c));
  return sr / (best + shift);
}

const cents = (f, ref) => 1200 * Math.log2(f / ref);

test('Karplus-Strong: intonazione entro ±5 cent da MIDI 40 a 88', () => {
  const sr = 44100;
  for (const midi of [40, 52, 64, 76, 88]) {
    const freq = KS.midiToFreq(midi);
    const { data, rate, f0 } = KS.renderPluck(freq, sr);
    const est = estimateF0(data, sr, Math.round(sr / f0));
    const played = est * rate; // il playbackRate corregge la linea di ritardo intera
    assert.ok(Math.abs(cents(played, freq)) < 5, `MIDI ${midi}: ${cents(played, freq).toFixed(2)} cent`);
  }
});

test('Karplus-Strong: buffer valido, normalizzato e che decade', () => {
  const { data } = KS.renderPluck(110, 44100);
  assert.ok(data.length > 44100);
  let peak = 0;
  for (const v of data) { assert.ok(Number.isFinite(v)); peak = Math.max(peak, Math.abs(v)); }
  assert.ok(peak <= 0.9001);
  const rms = (a, b) => Math.sqrt(data.slice(a, b).reduce((s, v) => s + v * v, 0) / (b - a));
  assert.ok(rms(data.length - 4410, data.length) < rms(0, 4410) / 10);
  assert.equal(data[data.length - 1], 0);
});

/** Clock finto: il tempo avanza a ogni timer. */
function fakeClock() {
  let t = 0;
  const timers = [];
  return {
    now: () => t,
    setTimer: (fn, ms) => { timers.push({ fn, at: t + ms / 1000 }); return timers.length; },
    clearTimer: () => { timers.length = 0; },
    run(until) {
      while (timers.length && t <= until) {
        const next = timers.shift();
        t = next.at;
        next.fn();
      }
    },
  };
}

const ev = (beat, dur = 0.5) => ({ beat, dur, midi: 60, rest: false });

test('scheduler: tempi delle note, count-in e metronomo', () => {
  const clk = fakeClock();
  const notes = [];
  const clicks = [];
  let ended = false;
  const s = Scheduler.create({
    ...clk, startDelay: 0,
    onNote: (e, when) => notes.push(when),
    onClick: (when, down) => clicks.push([when, down]),
    onEnd: () => { ended = true; },
  });
  s.start([ev(0), ev(0.5), ev(1), ev(3.5)], { bpm: 120, countIn: true, metronome: true, lengthBeats: 4 });
  clk.run(10);
  // 120 BPM: 0,5 s per battito; count-in di 4 battiti → prima nota a 2 s.
  assert.deepEqual(notes, [2, 2.25, 2.5, 3.75]);
  assert.equal(clicks.length, 8); // 4 di count-in + 4 della battuta
  assert.deepEqual(clicks[0], [0, true]);
  assert.deepEqual(clicks[4], [2, true]);
  assert.equal(clicks[5][1], false);
  assert.ok(ended);
});

test('scheduler: loop, levare e trainer di velocità', () => {
  const clk = fakeClock();
  const notes = [];
  const tempi = [];
  const s = Scheduler.create({
    ...clk, startDelay: 0,
    onNote: (e, when) => notes.push(+when.toFixed(6)),
    onTempo: (b) => tempi.push(b),
  });
  s.start([ev(-0.5), ev(0), ev(1)], {
    bpm: 60, countIn: false, metronome: false, loop: true, lengthBeats: 4, pickupBeats: 0.5,
    tempoAt: (it) => 60 + it * 60, // 60 → 120 BPM dal secondo giro
  });
  clk.run(9);
  s.stop();
  // Senza count-in: una battuta di attesa per il levare (inizio a −4) → levare a 3,5 s.
  assert.deepEqual(notes.slice(0, 3), [3.5, 4, 5]);
  // Secondo giro a 120 BPM a partire dal levare (battito 3,5 → 7,5 s): poi +0,25 s e +0,75 s.
  assert.deepEqual(notes.slice(3, 6), [7.5, 7.75, 8.25]);
  assert.equal(tempi[0], 120);
});

test('scheduler: cambio di BPM senza salti e coda visiva', () => {
  const clk = fakeClock();
  const notes = [];
  const s = Scheduler.create({ ...clk, startDelay: 0, lookahead: 0.05, onNote: (e, when) => notes.push(when) });
  s.start([ev(0), ev(1), ev(2), ev(3)], { bpm: 60, countIn: false, metronome: false, lengthBeats: 4 });
  clk.run(1.5);
  // Coda visiva: alle 1,2 s l'evento corrente è quello del battito 1.
  assert.equal(s.drainVisual(1.2).ev.beat, 1);
  assert.equal(s.drainVisual(1.3), undefined);
  s.setBpm(120);
  clk.run(10);
  assert.deepEqual(notes.slice(0, 2), [0, 1]);
  // Dopo il cambio a 120 BPM i battiti distano 0,5 s e il battito 2 arriva prima dei 2 s.
  assert.ok(notes[2] > 1.5 && notes[2] < 2);
  assert.ok(Math.abs(notes[3] - notes[2] - 0.5) < 1e-9);
  assert.equal(s.isPlaying(), false);
});
