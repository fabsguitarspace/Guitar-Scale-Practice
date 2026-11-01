// Layout della tablatura (ADR 0009).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/theory.js');
const G = require('../js/guitar.js');
const Pool = require('../js/exercises/pool.js');
const Presets = require('../js/exercises/presets.js');
const L = require('../js/tab/layout.js');

const ctx = (() => {
  const scale = T.catalog()[0];
  return Pool.context(T.semitones(scale), 0, G.threeNpsPatterns(scale, 0));
})();
const build = (id, extra = {}) => Presets.build(ctx, { ...Presets.presetDefaults(id), scope: { kind: 'pattern', index: 0 }, extension: 1, ...extra });
const lay = (r, width) => L.layout(r.events, { width, pickupBeats: r.pickupBeats, lengthBeats: r.lengthBeats, meter: 4 });

test('figure: travature e gironi irregolari', () => {
  assert.equal(L.beamsFor(0.5), 1);
  assert.equal(L.beamsFor(1 / 3), 1);
  assert.equal(L.beamsFor(0.25), 2);
  assert.equal(L.beamsFor(1 / 6), 2);
  assert.equal(L.beamsFor(1), 0);
  assert.equal(L.tupletOf([1 / 3, 1 / 3, 1 / 3]), 3);
  assert.equal(L.tupletOf([0.2, 0.2, 0.2, 0.2, 0.2]), 5);
  assert.equal(L.tupletOf(Array(6).fill(1 / 6)), 6);
  assert.equal(L.tupletOf([0.25, 0.25, 0.25, 0.25]), 0);
  assert.equal(L.tupletOf([0.5, 0.25, 0.25]), 0);
});

test('battute, a capo e posizioni crescenti', () => {
  const r = build('lin-updown', { rhythmId: 'sixteenths', extension: 2 });
  const wide = lay(r, 1200);
  const narrow = lay(r, 360);
  const bars = (l) => l.systems.reduce((a, s) => a + s.bars.length, 0);
  assert.equal(bars(wide), r.lengthBeats / 4);
  assert.equal(bars(narrow), bars(wide));
  assert.ok(narrow.systems.length > wide.systems.length);
  for (const sys of narrow.systems) {
    assert.ok(sys.width <= 360 + 1e-6);
    const xs = sys.bars.flatMap((b) => b.items.map((it) => it.x));
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i] > xs[i - 1]);
  }
});

test('sedicesimi: una travatura primaria e secondarie per battito', () => {
  const r = build('lin-up', { rhythmId: 'sixteenths' });
  const g = lay(r, 1200).systems[0].bars[0].groups[0];
  assert.ok(g.x1 < g.x2);
  assert.equal(g.secondary.length, 3);
  assert.equal(g.tuplet, 0);
});

test('galoppo: secondaria solo sui sedicesimi; terzine con il 3', () => {
  const r = build('lin-up', { rhythmId: 'gallop' });
  const g = lay(r, 1200).systems[0].bars[0].groups[0];
  assert.equal(g.secondary.length, 1);
  const t = build('lin-up', { rhythmId: 'triplets' });
  assert.equal(lay(t, 1200).systems[0].bars[0].groups[0].tuplet, 3);
});

test('levare: anacrusi come prima battuta', () => {
  const r = build('rit-pickup');
  const l = lay(r, 1200);
  const first = l.systems[0].bars[0];
  assert.equal(first.anacrusis, true);
  assert.equal(first.items.length, 1);
  // Anche su una riga stretta l'anacrusi non resta da sola.
  const narrow = lay(build('rit-pickup', { rhythmId: 'triplets' }), 300);
  assert.ok(narrow.systems[0].bars.length >= 2);
  assert.ok(narrow.systems[0].width <= 300 + 1e-6);
});

test('tab ASCII: 6 righe allineate e accenti', () => {
  const r = build('lin-up', { rhythmId: 'eighths' });
  const txt = L.toAscii(r.events, { meter: 4, lengthBeats: r.lengthBeats });
  const lines = txt.split('\n');
  assert.equal(lines.length, 7);
  assert.ok(lines[0].includes('>'));
  const strings = lines.slice(1);
  assert.deepEqual(strings.map((l) => l[0]), ['e', 'B', 'G', 'D', 'A', 'E']);
  assert.equal(new Set(strings.map((l) => l.length)).size, 1);
  assert.ok(lines[6].includes('-8-'));
});
