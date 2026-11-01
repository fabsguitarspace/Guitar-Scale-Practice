// Esercizi: pool, generatore melodico, ritmo, preset (Docs/esercizi.md, ADR 0005–0006).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/theory.js');
const G = require('../js/guitar.js');
const Pool = require('../js/exercises/pool.js');
const Melodic = require('../js/exercises/melodic.js');
const Rhythm = require('../js/exercises/rhythm.js');
const Presets = require('../js/exercises/presets.js');

const find = (name) => T.catalog().find((s) => s.name === name);
const ctxOf = (scale, pc) => Pool.context(T.semitones(scale), pc, G.threeNpsPatterns(scale, pc));
const seq = (n, opts, count) => Melodic.melodic(n, opts).slice(0, count).map((x) => x.k + 1).join(' ');

test('sequenze di riferimento del catalogo (pool di 15 note)', () => {
  const n = 15;
  assert.equal(seq(n, { motif: [0, 2] }, 8), '1 3 2 4 3 5 4 6');
  assert.equal(seq(n, { motif: [0, 1, 2], shape: 'palindrome' }, 12), '1 2 3 3 2 1 2 3 4 4 3 2');
  assert.equal(seq(n, { motif: [0, 2], shape: 'alternate' }, 8), '1 3 4 2 3 5 6 4');
  assert.equal(seq(n, { motif: Melodic.fromIntervals([2, -1]) }, 9), '1 3 2 2 4 3 3 5 4');
  assert.equal(seq(n, { motif: [0, 1, 3, 6] }, 8), '1 2 4 7 2 3 5 8');
  assert.equal(seq(n, { motif: [0, 2], direction: 'down' }, 6), '15 13 14 12 13 11');
  assert.equal(seq(n, { motif: [0, 3], shape: 'alternate' }, 8), '1 4 5 2 3 6 7 4');
});

test('lineare: up/down specchiati e svolta non ripetuta', () => {
  const up = Melodic.melodic(8, { motif: [0], direction: 'up' }).map((x) => x.k);
  const down = Melodic.melodic(8, { motif: [0], direction: 'down' }).map((x) => x.k);
  assert.deepEqual(down, up.slice().reverse());
  const ud = Melodic.melodic(8, { motif: [0], direction: 'updown' }).map((x) => x.k + 1).join(' ');
  assert.equal(ud, '1 2 3 4 5 6 7 8 7 6 5 4 3 2 1');
  const du = Melodic.melodic(8, { motif: [0], direction: 'downup' }).map((x) => x.k + 1).join(' ');
  assert.equal(du, '8 7 6 5 4 3 2 1 2 3 4 5 6 7 8');
});

test('gruppi: indice di gruppo e motivo che non entra', () => {
  const s = Melodic.melodic(6, { motif: [0, 1, 2, 3] });
  assert.deepEqual(s.map((x) => x.group), [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2]);
  assert.deepEqual(Melodic.melodic(3, { motif: [0, 1, 2, 3] }), []);
});

test('pool: estensione in ottave dalla tonica più grave', () => {
  const ctx = ctxOf(find('Ionica'), 0);
  const p2 = Pool.pitchPool({ kind: 'neck', fretFrom: 0, fretTo: 24 }, ctx, 2);
  assert.equal(p2.length, 15);
  assert.equal(p2[0].midi, 48); // C3
  assert.equal(p2[14].midi, 72);
  assert.ok(p2.every((q) => q.degree >= 0));
  const full = Pool.pitchPool({ kind: 'neck' }, ctx, 'full');
  assert.equal(full[0].midi, 40); // E2: nota della scala più grave, non la tonica
  assert.equal(full[full.length - 1].midi, 88);
});

test('pool: una corda, Do ionica, tasti 0–24', () => {
  const ctx = ctxOf(find('Ionica'), 0);
  const pos = Pool.allowedPositions({ kind: 'strings', strings: [0], fretFrom: 0, fretTo: 24 }, ctx);
  assert.deepEqual(pos.map((q) => q.fret), [0, 1, 3, 5, 7, 8, 10, 12, 13, 15, 17, 19, 20, 22, 24]);
});

test('ritmo: battute intere, accenti, levare, swing, pause, ripetute', () => {
  const pool = Array.from({ length: 8 }, (_, k) => ({ k, midi: 60 + k, degree: k % 7 }));
  const lin = Melodic.melodic(8, { motif: [0] });
  // Ottavi: 8 note = 4 battiti = 1 battuta; accento sul battito.
  let r = Rhythm.rhythm(lin, pool, { cells: [{ dur: 0.5 }] });
  assert.equal(r.lengthBeats, 4);
  assert.deepEqual(r.events.map((e) => e.accent), [true, false, true, false, true, false, true, false]);
  // Terzine: inizi esatti.
  r = Rhythm.rhythm(lin, pool, { cells: [{ dur: 1 / 3 }] });
  assert.ok(Math.abs(r.events[3].beat - 1) < 1e-9);
  // Accento ogni 3 su sedicesimi, spostato di 1.
  r = Rhythm.rhythm(lin, pool, { cells: [{ dur: 0.25 }], accent: 3, accentOffset: 1 });
  assert.deepEqual(r.events.map((e) => (e.accent ? 1 : 0)).join(''), '01001001');
  // Levare di una nota: prima nota a −0,25 e spazio per il levare del giro successivo.
  r = Rhythm.rhythm(lin, pool, { cells: [{ dur: 0.25 }], pickup: 1 });
  assert.equal(r.pickupBeats, 0.25);
  assert.equal(r.events[0].beat, -0.25);
  const end = Math.max(...r.events.map((e) => e.beat + e.dur));
  assert.ok(end <= r.lengthBeats - r.pickupBeats + 1e-9);
  assert.equal(r.lengthBeats % 4, 0);
  // Swing: ottavo in levare spostato di 1/6.
  r = Rhythm.rhythm(lin, pool, { cells: [{ dur: 0.5 }], swing: 1 });
  assert.ok(Math.abs(r.events[1].beat - (0.5 + 1 / 6)) < 1e-9);
  assert.ok(Math.abs(r.events[0].dur - (0.5 + 1 / 6)) < 1e-9);
  assert.equal(r.events[1].ndur, 0.5);
  // Pausa sul quarto sedicesimo.
  r = Rhythm.rhythm(lin, pool, { cells: [{ dur: 0.25 }, { dur: 0.25 }, { dur: 0.25 }, { dur: 0.25, rest: true }] });
  assert.equal(r.events[3].rest, true);
  assert.equal(r.events.filter((e) => !e.rest).length, 8);
  // Ripetute ×2.
  r = Rhythm.rhythm(lin, pool, { cells: [{ dur: 0.25 }], repeat: 2 });
  assert.equal(r.events.length, 16);
  assert.equal(r.events[0].midi, r.events[1].midi);
});

test('ritmo: accento sul gruppo (gruppi di 3)', () => {
  const pool = Array.from({ length: 8 }, (_, k) => ({ k, midi: 60 + k, degree: k % 7 }));
  const r = Rhythm.rhythm(Melodic.melodic(8, { motif: [0, 1, 2] }), pool, { cells: [{ dur: 1 / 3 }] });
  assert.equal(r.events.slice(0, 9).map((e) => (e.accent ? '>' : '.')).join(''), '>..>..>..');
});

test('tutti i preset × tutte le scale × toniche: eventi coerenti (diteggiatura 3NPS)', () => {
  for (const scale of T.catalog()) {
    for (const pc of [0, 4, 10]) {
      const ctx = ctxOf(scale, pc);
      for (const p of Presets.PRESETS) {
        const settings = { ...Presets.presetDefaults(p.id), scope: { kind: 'pattern', index: 0 }, extension: 'full' };
        const r = Presets.build(ctx, settings);
        if (r.error) continue; // motivo troppo lungo per il pool: segnalato all'utente
        const semis = T.semitones(scale);
        for (const e of r.events) {
          if (e.rest) continue;
          assert.ok(e.k >= 0 && e.k < r.pool.length, `${scale.name} ${p.id}`);
          assert.equal((G.TUNING[e.string] + e.fret) % 12, (pc + semis[e.degree]) % 12, `${scale.name} ${p.id}`);
        }
        assert.equal(r.lengthBeats % 4, 0, `${scale.name} ${p.id}`);
      }
    }
  }
});

test('collegamento delle posizioni: segmenti in direzione alternata', () => {
  const ctx = ctxOf(find('Ionica'), 0);
  const r = Presets.build(ctx, { presetId: 'lin-up', direction: 'up', scope: { kind: 'chain' } });
  assert.ok(!r.error);
  const segs = [...new Set(r.events.map((e) => e.segment))];
  assert.equal(segs.length, 7);
  const first = r.events.filter((e) => e.segment === 0).map((e) => e.midi);
  const second = r.events.filter((e) => e.segment === 1).map((e) => e.midi);
  assert.ok(first[first.length - 1] > first[0]);
  assert.ok(second[second.length - 1] < second[0]);
});

test('preset ritmici: levare e accenti impostati dal preset', () => {
  const ctx = ctxOf(find('Ionica'), 0);
  const r = Presets.build(ctx, { ...Presets.presetDefaults('rit-pickup'), scope: { kind: 'pattern', index: 0 } });
  assert.equal(r.pickupBeats, 0.25);
  const s = Presets.build(ctx, { ...Presets.presetDefaults('rit-shift'), scope: { kind: 'pattern', index: 0 } });
  assert.equal(s.events.slice(0, 8).map((e) => (e.accent ? 1 : 0)).join(''), '01000100');
});
