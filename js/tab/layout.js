/**
 * Layout della tablatura (ADR 0009): battute, a capo, posizioni orizzontali, figure ritmiche,
 * travature, gironi irregolari. Modulo puro: produce solo numeri, il disegno è in render.js.
 */
(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;
  const EPS = 1e-6;
  const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];

  const near = (a, b) => Math.abs(a - b) < EPS;

  /** Numero di travature della figura (dalla durata nominale in battiti). */
  function beamsFor(ndur) {
    if (ndur >= 1 - EPS) return 0;
    if (near(ndur, 0.75) || near(ndur, 0.5) || near(ndur, 1 / 3)) return 1;
    if (ndur >= 1 / 6 - EPS) return 2; // 1/4, 1/5, 1/6
    return 3;
  }

  /** Girone irregolare di un gruppo di durate nello stesso battito (3, 5, 6) oppure 0. */
  function tupletOf(durs) {
    for (const n of [3, 5, 6]) {
      const ok = durs.every((d) => near(Math.round(d * n), d * n)) &&
        durs.some((d) => !near(Math.round(d * 4), d * 4));
      if (ok) return n;
    }
    return 0;
  }

  /**
   * @param events  eventi con {i, beat, dur, ndur, string, fret, accent, rest}
   * @param opts    { meter, width, pickupBeats, lengthBeats, minSpacing, leftPad }
   */
  function layout(events, opts = {}) {
    const meter = opts.meter || 4;
    const width = Math.max(160, opts.width || 600);
    const pickup = opts.pickupBeats || 0;
    const left = opts.leftPad ?? 26;
    const minSpacing = opts.minSpacing ?? 22;
    const padL = 12;
    const padR = 8;
    const length = opts.lengthBeats ?? Math.ceil(Math.max(0, ...events.map((e) => e.beat + e.dur)) / meter) * meter;

    // Battute: eventuale anacrusi [−pickup, 0), poi battute intere.
    const bars = [];
    if (pickup > EPS) bars.push({ start: -pickup, end: 0, anacrusis: true });
    for (let b = 0; b < length - EPS; b += meter) bars.push({ start: b, end: b + meter, anacrusis: false });
    for (const bar of bars) bar.items = [];
    for (const e of events) {
      const bar = bars.find((x) => e.beat >= x.start - EPS && e.beat < x.end - EPS) || bars[bars.length - 1];
      if (bar) bar.items.push(e);
    }

    const minDur = Math.min(1, ...events.map((e) => e.ndur ?? e.dur));
    const pxPerBeat = Math.max(46, Math.min(170, minSpacing / minDur));
    for (const bar of bars) bar.natural = (bar.end - bar.start) * pxPerBeat + padL + padR;

    // A capo per battute intere; una battuta più larga della riga viene compressa.
    const avail = width - left - 4;
    const systems = [];
    let cur = [];
    let used = 0;
    for (const bar of bars) {
      // L'anacrusi resta sempre sulla riga della battuta che la segue (eventualmente compressa).
      const onlyPickup = cur.length === 1 && cur[0].anacrusis;
      if (cur.length && !onlyPickup && used + bar.natural > avail) { systems.push(cur); cur = []; used = 0; }
      cur.push(bar);
      used += bar.natural;
    }
    if (cur.length) systems.push(cur);

    const out = systems.map((sysBars, si) => {
      const natural = sysBars.reduce((a, b) => a + b.natural, 0);
      const isLast = si === systems.length - 1;
      const scale = natural > avail || !isLast || natural > avail * 0.7 ? avail / natural : 1;
      let x = left;
      const laidBars = sysBars.map((bar, bi) => {
        const w = bar.natural * scale;
        const inner = w - (padL + padR) * Math.min(1, scale);
        const startX = x + padL * Math.min(1, scale);
        const beatW = inner / (bar.end - bar.start);
        const items = bar.items.map((e) => ({
          i: e.i,
          x: startX + (e.beat - bar.start) * beatW,
          beat: e.beat,
          ndur: e.ndur ?? e.dur,
          string: e.string,
          fret: e.fret,
          accent: !!e.accent,
          rest: !!e.rest,
          beams: beamsFor(e.ndur ?? e.dur),
          dot: near(e.ndur ?? e.dur, 0.75),
        }));
        const groups = beamGroups(items);
        const laid = { index: bars.indexOf(bar), x, w, start: bar.start, end: bar.end, anacrusis: bar.anacrusis, items, groups, spacing: beatW * minDur };
        x += w;
        return laid;
      });
      return { bars: laidBars, width: x };
    });

    return { systems: out, pxPerBeat, meter, swing: events.some((e) => !e.rest && !near(e.dur, e.ndur ?? e.dur)) };
  }

  /** Raggruppa per battito: travature primarie e secondarie, cediglie, gironi. */
  function beamGroups(items) {
    const byBeat = new Map();
    for (const it of items) {
      const b = Math.floor(it.beat + EPS);
      if (!byBeat.has(b)) byBeat.set(b, []);
      byBeat.get(b).push(it);
    }
    const groups = [];
    for (const [beat, its] of byBeat) {
      const notes = its.filter((it) => !it.rest && it.beams > 0);
      const g = { beat, tuplet: tupletOf(its.map((it) => it.ndur)), x1: null, x2: null, secondary: [], flags: [] };
      const xs = its.map((it) => it.x);
      g.tx = (Math.min(...xs) + Math.max(...xs)) / 2;
      if (notes.length >= 2) {
        g.x1 = notes[0].x;
        g.x2 = notes[notes.length - 1].x;
        // Secondarie tra note consecutive con 2+ travature; mozziconi per le isolate.
        for (let k = 0; k < notes.length; k++) {
          if (notes[k].beams < 2) continue;
          const nextOk = k + 1 < notes.length && notes[k + 1].beams >= 2;
          const prevOk = k > 0 && notes[k - 1].beams >= 2;
          if (nextOk) g.secondary.push([notes[k].x, notes[k + 1].x]);
          else if (!prevOk) g.secondary.push(k + 1 < notes.length ? [notes[k].x, notes[k].x + 7] : [notes[k].x - 7, notes[k].x]);
        }
      } else if (notes.length === 1) {
        g.flags.push({ x: notes[0].x, count: notes[0].beams });
      }
      groups.push(g);
    }
    return groups;
  }

  /** Tablatura in testo (6 righe, 1ª corda in alto) con accenti e stanghette. */
  function toAscii(events, opts = {}) {
    const meter = opts.meter || 4;
    const pickup = opts.pickupBeats || 0;
    const length = opts.lengthBeats ?? meter;
    const cols = [];
    const barAt = new Set();
    for (let b = 0; b < length - EPS; b += meter) barAt.add(Math.round(b * 1000));
    let lastBar = null;
    const sorted = events.slice().sort((a, b) => a.beat - b.beat);
    cols.push({ bar: true });
    for (const e of sorted) {
      const barStart = e.beat < -EPS ? -pickup : Math.floor((e.beat + EPS) / meter) * meter;
      if (lastBar !== null && barStart !== lastBar) cols.push({ bar: true });
      lastBar = barStart;
      cols.push({ e });
    }
    cols.push({ bar: true });
    const lines = [5, 4, 3, 2, 1, 0].map(() => '');
    let acc = ' ';
    for (const c of cols) {
      if (c.bar) {
        for (let s = 0; s < 6; s++) lines[s] += '|';
        acc += ' ';
        continue;
      }
      const e = c.e;
      const txt = e.rest ? '' : String(e.fret);
      const w = 3;
      for (let r = 0; r < 6; r++) {
        const s = 5 - r;
        const cell = !e.rest && e.string === s ? txt : '';
        lines[r] += '-' + cell + '-'.repeat(w - 1 - cell.length);
      }
      acc += (e.accent ? ' > ' : '   ').slice(0, w);
    }
    const names = [5, 4, 3, 2, 1, 0].map((s) => STRING_NAMES[s]);
    return [acc.trimEnd(), ...lines.map((l, r) => names[r] + l)].filter((l, i) => i > 0 || l.trim()).join('\n');
  }

  const TabLayout = { layout, toAscii, beamsFor, tupletOf };

  if (isNode) module.exports = TabLayout;
  else root.TabLayout = TabLayout;
})(globalThis);
