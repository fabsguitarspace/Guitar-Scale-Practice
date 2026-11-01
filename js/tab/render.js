/**
 * Disegno della tablatura in SVG a partire dal layout (ADR 0009).
 * Un SVG per riga (sistema); ogni numero ha data-i per l'evidenziazione in tempo reale.
 */
(function (root) {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const GAP = 11;            // distanza tra le righe
  const TOP = 34;            // spazio per numeri di battuta, accenti e indicazioni
  const STAFF = GAP * 5;
  const STEM_TOP = 6;        // distanza del gambo dal rigo
  const STEM_LEN = 22;
  const H = TOP + STAFF + STEM_TOP + STEM_LEN + 18;

  function el(name, attrs, text) {
    const e = document.createElementNS(SVG_NS, name);
    for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }

  const yOf = (string) => TOP + (5 - string) * GAP;

  /** Pausa stilizzata (ottavo / sedicesimo) centrata in x. */
  function restGlyph(x, beams) {
    const g = el('g', { class: 'tab-rest' });
    const y = TOP + STAFF / 2;
    g.appendChild(el('path', { d: `M${x + 3} ${y - 8} L${x - 2} ${y + 8}` }));
    for (let b = 0; b < Math.max(1, beams); b++) {
      g.appendChild(el('circle', { cx: x - 1 + b * 2.5, cy: y - 7 + b * 5, r: 2 }));
    }
    return g;
  }

  /**
   * @param lay  risultato di TabLayout.layout
   * @param opts { width }
   * @returns DocumentFragment con un SVG per sistema
   */
  function render(lay, opts = {}) {
    const frag = document.createDocumentFragment();
    const width = opts.width || 600;
    const stemY1 = TOP + STAFF + STEM_TOP;
    const stemY2 = stemY1 + STEM_LEN;

    lay.systems.forEach((sys, si) => {
      const svg = el('svg', {
        class: 'tab-system', viewBox: `0 0 ${width} ${H}`, width, height: H,
        role: 'img', 'aria-label': `Tablatura, riga ${si + 1}`,
      });
      const endX = sys.bars.length ? sys.bars[sys.bars.length - 1].x + sys.bars[sys.bars.length - 1].w : width;
      const startX = sys.bars.length ? sys.bars[0].x : 0;

      // Righe e "TAB".
      const lines = el('g', { class: 'tab-lines' });
      for (let s = 0; s < 6; s++) lines.appendChild(el('line', { x1: 4, x2: endX, y1: yOf(s), y2: yOf(s) }));
      svg.appendChild(lines);
      const clef = el('g', { class: 'tab-clef' });
      ['T', 'A', 'B'].forEach((c, k) => clef.appendChild(el('text', { x: 10, y: TOP + 12 + k * 16, 'text-anchor': 'middle' }, c)));
      svg.appendChild(clef);
      if (si === 0 && lay.swing) {
        svg.appendChild(el('text', { class: 'tab-note', x: endX, y: 10, 'text-anchor': 'end' }, 'Swing ♪♪ = ♪³♪'));
      }

      for (const bar of sys.bars) {
        // Stanghetta finale della battuta e numero della battuta.
        svg.appendChild(el('line', { class: 'tab-bar', x1: bar.x + bar.w, x2: bar.x + bar.w, y1: yOf(5), y2: yOf(0) }));
        if (bar.x === startX) svg.appendChild(el('line', { class: 'tab-bar', x1: bar.x, x2: bar.x, y1: yOf(5), y2: yOf(0) }));
        if (!bar.anacrusis) {
          svg.appendChild(el('text', { class: 'tab-barnum', x: bar.x + 3, y: 10 }, String(bar.index + (lay.systems[0].bars[0].anacrusis ? 0 : 1))));
        }

        // Gambi e numeri.
        const stems = el('g', { class: 'tab-stems' });
        for (const it of bar.items) {
          if (it.rest) { svg.appendChild(restGlyph(it.x, it.beams)); continue; }
          stems.appendChild(el('line', { x1: it.x, x2: it.x, y1: stemY1, y2: stemY2 }));
          if (it.dot) stems.appendChild(el('circle', { class: 'tab-dot', cx: it.x + 5, cy: stemY2 - 3, r: 1.6 }));
        }
        svg.appendChild(stems);

        // Travature, cediglie, gironi irregolari.
        const beams = el('g', { class: 'tab-beams' });
        for (const g of bar.groups) {
          if (g.x1 != null) beams.appendChild(el('rect', { x: g.x1, y: stemY2 - 3, width: g.x2 - g.x1, height: 3 }));
          for (const [a, b] of g.secondary) beams.appendChild(el('rect', { x: a, y: stemY2 - 8, width: b - a, height: 3 }));
          for (const f of g.flags) {
            for (let k = 0; k < f.count; k++) {
              beams.appendChild(el('path', { class: 'tab-flag', d: `M${f.x} ${stemY2 - k * 5} q 6 -2 7 -8` }));
            }
          }
          if (g.tuplet) beams.appendChild(el('text', { class: 'tab-tuplet', x: g.tx, y: stemY2 + 13, 'text-anchor': 'middle' }, String(g.tuplet)));
        }
        svg.appendChild(beams);

        // Numeri dei tasti (sopra le righe, con sfondo) e accenti.
        for (const it of bar.items) {
          if (it.rest) continue;
          const txt = String(it.fret);
          const g = el('g', { class: 'tab-num', 'data-i': it.i });
          const w = txt.length > 1 ? 14 : 8;
          g.appendChild(el('rect', { x: it.x - w / 2 - 1, y: yOf(it.string) - 6.5, width: w + 2, height: 13, rx: 3 }));
          g.appendChild(el('text', { x: it.x, y: yOf(it.string), 'text-anchor': 'middle', 'dominant-baseline': 'central' }, txt));
          svg.appendChild(g);
          if (it.accent) svg.appendChild(el('text', { class: 'tab-accent', x: it.x, y: TOP - 13, 'text-anchor': 'middle' }, '>'));
        }
      }
      frag.appendChild(svg);
    });
    return frag;
  }

  root.TabRender = { render, HEIGHT: H };
})(globalThis);
