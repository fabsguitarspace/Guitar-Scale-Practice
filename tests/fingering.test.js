// Assegnazione delle posizioni (ADR 0008).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/theory.js');
const G = require('../js/guitar.js');
const Pool = require('../js/exercises/pool.js');
const Presets = require('../js/exercises/presets.js');

const find = (name) => T.catalog().find((s) => s.name === name);
const ctxOf = (scale, pc) => Pool.context(T.semitones(scale), pc, G.threeNpsPatterns(scale, pc));
const notes = (r) => r.events.filter((e) => !e.rest);

function checkPositions(r, scope, label) {
  for (const e of notes(r)) {
    assert.equal(G.TUNING[e.string] + e.fret, e.midi, label);
    assert.ok(e.fret >= 0 && e.fret <= 24, label);
    if (scope.kind === 'strings') assert.ok(scope.strings.includes(e.string), label);
    if (scope.kind === 'position') assert.ok(e.fret >= scope.fret && e.fret <= scope.fret + 4, label);
  }
}

test('una corda, 1 ottava dalla tonica: tasti attesi', () => {
  const ctx = ctxOf(find('Ionica'), 0);
  const r = Presets.build(ctx, { presetId: 'lin-up', direction: 'up', extension: 1, scope: { kind: 'strings', strings: [0] } });
  assert.deepEqual(notes(r).map((e) => e.fret), [8, 10, 12, 13, 15, 17, 19, 20]);
});

test('diteggiatura 3NPS: le posizioni sono quelle della diteggiatura', () => {
  const scale = find('Dorica');
  const ctx = ctxOf(scale, 2);
  const r = Presets.build(ctx, { presetId: 'lin-up', direction: 'up', extension: 'full', scope: { kind: 'pattern', index: 3 } });
  const pat = ctx.patterns[3].positions.map((q) => `${q.string}:${q.fret}`);
  assert.deepEqual(notes(r).map((e) => `${e.string}:${e.fret}`), pat);
});

test('profili: verticale resta in posizione, orizzontale usa poche corde', () => {
  const ctx = ctxOf(find('Ionica'), 7);
  const base = { presetId: 'lin-up', direction: 'up', extension: 2, scope: { kind: 'neck', allowOpen: false } };
  const v = notes(Presets.build(ctx, { ...base, profile: 'vertical' }));
  const frets = v.map((e) => e.fret);
  assert.ok(Math.max(...frets) - Math.min(...frets) <= 5, `span verticale ${frets}`);
  const h = notes(Presets.build(ctx, { ...base, profile: 'horizontal' }));
  assert.ok(new Set(h.map((e) => e.string)).size <= 3, 'corde orizzontale');
  const hf = h.map((e) => e.fret);
  assert.ok(Math.max(...hf) - Math.min(...hf) >= 10, 'orizzontale percorre il manico');
});

test('determinismo e proprietà su tutte le scale e ambiti', () => {
  const scopes = [
    { kind: 'neck', fretFrom: 0, fretTo: 24 },
    { kind: 'strings', strings: [2, 3], fretFrom: 0, fretTo: 24 },
    { kind: 'strings', strings: [1, 2, 3], fretFrom: 0, fretTo: 24 },
    { kind: 'position', fret: 5 },
  ];
  for (const scale of T.catalog()) {
    const ctx = ctxOf(scale, 9);
    for (const scope of scopes) {
      for (const profile of ['balanced', 'horizontal', 'vertical']) {
        const s = { presetId: 'int-3', direction: 'updown', extension: 2, scope, profile };
        const a = Presets.build(ctx, s);
        if (a.error) continue;
        checkPositions(a, scope, `${scale.name} ${scope.kind} ${profile}`);
        const b = Presets.build(ctx, s);
        assert.deepEqual(notes(a).map((e) => [e.string, e.fret]), notes(b).map((e) => [e.string, e.fret]));
      }
    }
  }
});

test('tastiera intera bilanciata: niente salti oltre 5 tasti tra note vicine (Do, 2 ottave)', () => {
  const ctx = ctxOf(find('Ionica'), 0);
  const r = notes(Presets.build(ctx, { presetId: 'lin-updown', direction: 'updown', extension: 2, scope: { kind: 'neck', allowOpen: false } }));
  for (let i = 1; i < r.length; i++) {
    assert.ok(Math.abs(r[i].fret - r[i - 1].fret) <= 5, `${r[i - 1].fret}→${r[i].fret}`);
  }
});
