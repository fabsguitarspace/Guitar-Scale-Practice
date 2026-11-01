// Test della logica (porting dei test Rust di interval-master). Esegui: node --test tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/theory.js');
const G = require('../js/guitar.js');

const find = (name) => T.catalog().find((s) => s.name === name);
const spelled = (name, root) => T.spell(find(name), root).map((n) => T.noteToString(n)).join(' ');
const C = T.note(0, 0);

test('dimensione del catalogo', () => {
  assert.equal(T.catalog().length, 4 * 7 + 5);
});

test('formule dei modi', () => {
  assert.equal(T.formula(find('Dorica')), '1 2 b3 4 5 6 b7');
  assert.equal(T.formula(find('Superlocria')), '1 b2 b3 b4 b5 b6 b7');
  assert.equal(T.formula(find('Lidia dominante')), '1 2 3 #4 5 6 b7');
  assert.equal(T.formula(find('Frigia dominante')), '1 b2 3 4 5 b6 b7');
  assert.equal(T.formula(find('Superlocria bb7')), '1 b2 b3 b4 b5 b6 bb7');
  assert.equal(T.formula(find('Lidia aumentata #2')), '1 #2 3 #4 #5 6 7');
  assert.equal(T.formula(find('Dorica b5')), '1 2 b3 4 b5 6 b7');
  assert.equal(T.formula(find('Locria bb7')), '1 b2 b3 4 b5 b6 bb7');
});

test('ortografia', () => {
  assert.equal(spelled('Ionica', C), 'C D E F G A B');
  assert.equal(spelled('Superlocria', C), 'C Db Eb Fb Gb Ab Bb');
  assert.equal(spelled('Minore armonica', T.note(3, 1)), 'F# G# A B C# D E#');
  assert.equal(spelled('Diminuita semitono-tono', C), 'C Db D# E F# G A Bb');
  assert.equal(spelled('Esatonale', T.note(1, -1)), 'Db Eb F G A Cb');
});

test('i passi sommano a un\'ottava', () => {
  for (const s of T.catalog()) {
    const st = T.steps(s);
    assert.equal(st.reduce((a, b) => a + b, 0), 12, s.name);
    assert.ok(st.every((x) => x > 0), s.name);
  }
});

test('nessuna tripla alterazione con la tonica migliore', () => {
  for (const s of T.catalog()) {
    for (let pc = 0; pc < 12; pc++) {
      for (const r of T.bestRoots(s, pc)) {
        assert.ok(T.spell(s, r).every((n) => Math.abs(n.accidental) <= 2), `${s.name} ${T.noteToString(r)}`);
      }
    }
  }
});

test('la tonica migliore preferisce la scrittura leggibile', () => {
  assert.deepEqual(T.bestRoots(find('Ionica'), 1), [T.note(1, -1)]);
});

test('notazione tipografica', () => {
  assert.equal(T.noteToString(T.note(1, -1), true), 'D♭');
  assert.equal(T.noteToString(T.note(3, 2), true), 'F♯♯');
  assert.equal(T.formula(find('Superlocria bb7'), true), '1 ♭2 ♭3 ♭4 ♭5 ♭6 ♭♭7');
  assert.equal(T.prettify('Lidia aumentata #2'), 'Lidia aumentata ♯2');
  assert.equal(T.prettify('Spagnola, Misolidia b9 b13'), 'Spagnola, Misolidia ♭9 ♭13');
  assert.equal(T.prettify('Superlocria bb7'), 'Superlocria ♭♭7');
});

test('Do ionica dalla tonica', () => {
  const p = G.threeNpsPatterns(find('Ionica'), 0)[0];
  assert.deepEqual(p.positions.map((x) => x.fret),
    [8, 10, 12, 8, 10, 12, 9, 10, 12, 9, 10, 12, 10, 12, 13, 10, 12, 13]);
  assert.equal(p.positions[0].degree, 0);
});

test('tutte le diteggiature sono suonabili', () => {
  for (const s of T.catalog()) {
    const semis = T.semitones(s);
    for (let pc = 0; pc < 12; pc++) {
      const pats = G.threeNpsPatterns(s, pc);
      assert.equal(pats.length, s.degrees.length);
      for (const p of pats) {
        assert.equal(p.positions.length, 18);
        assert.ok(p.minFret >= 0, `${s.name} pc${pc}`);
        assert.ok(p.maxFret <= G.MAX_FRET, `${s.name} pc${pc}`);
        const maxSpan = s.degrees.length >= 7 ? 7 : 11;
        assert.ok(p.maxFret - p.minFret <= maxSpan, `${s.name} pc${pc} span`);
        for (const pos of p.positions) {
          const pitch = (G.TUNING[pos.string] + pos.fret) % 12;
          assert.equal(pitch, (pc + semis[pos.degree]) % 12);
        }
      }
    }
  }
});
