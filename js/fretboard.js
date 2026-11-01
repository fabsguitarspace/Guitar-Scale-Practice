/**
 * Disegno dei diagrammi di diteggiatura in SVG (porting di draw_pattern in app.rs).
 * Corde orizzontali (1ª in alto, come nelle tablature), tasti verticali,
 * pallini con grado o nome della nota; tonica evidenziata.
 */
(function (root) {
  'use strict';

  const { STRING_NAMES } = root.Guitar;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Coordinate nel viewBox: l'SVG si adatta poi alla larghezza disponibile.
  const BASE_W = 340;
  const H = 178;
  const LEFT = 20;   // spazio per i nomi delle corde
  const TOP = 14;
  const BOTTOM = 32; // spazio per i numeri dei tasti (sotto i pallini della 6ª corda)
  const RIGHT = 6;

  function el(name, attrs, text) {
    const e = document.createElementNS(SVG_NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }

  /**
   * @param pattern  risultato di Guitar.threeNpsPatterns
   * @param labels   etichetta per ogni indice di grado (gradi o note)
   * @param title    testo accessibile
   * @param opts     { fretFrom, fretTo: intervallo forzato (tastiera intera);
   *                   cellWidth: larghezza fissa del tasto in px (SVG non ridimensionato);
   *                   path: Set di "corda:tasto" del percorso, gli altri pallini sono attenuati }
   */
  function render(pattern, labels, title, opts = {}) {
    const lo = opts.fretFrom ?? pattern.minFret;
    const hi = opts.fretTo ?? pattern.maxFret;
    const hasOpen = lo === 0;
    const first = Math.max(lo, 1);
    const last = Math.max(hi, first);
    const cells = last - first + 1;

    const openW = hasOpen ? 22 : 0;
    const x0 = LEFT + openW; // prima linea di tasto (capotasto se first === 1)
    const W = opts.cellWidth ? x0 + cells * opts.cellWidth + RIGHT : BASE_W;
    const cw = (W - RIGHT - x0) / cells;
    const sp = (H - BOTTOM - TOP) / 5;
    const stringY = (s) => TOP + (5 - s) * sp;
    const fretX = (f) => (f === 0 ? x0 - openW / 2 : x0 + (f - first) * cw + cw / 2);

    const svg = el('svg', {
      viewBox: `0 0 ${W} ${H}`,
      ...(opts.cellWidth ? { width: W, height: H } : {}),
      class: 'fretboard',
      role: 'img',
      'aria-label': title,
    });
    svg.appendChild(el('title', {}, title));

    // Segni di tastiera (inlay) tra 3ª e 4ª corda.
    const inlays = el('g', { class: 'fb-inlays' });
    for (let f = first; f <= last; f++) {
      const m = f % 12;
      const yMid = (stringY(2) + stringY(3)) / 2;
      if (m === 0) {
        inlays.appendChild(el('circle', { cx: fretX(f), cy: (stringY(1) + stringY(2)) / 2, r: 3.2 }));
        inlays.appendChild(el('circle', { cx: fretX(f), cy: (stringY(3) + stringY(4)) / 2, r: 3.2 }));
      } else if ([3, 5, 7, 9].includes(m)) {
        inlays.appendChild(el('circle', { cx: fretX(f), cy: yMid, r: 3.2 }));
      }
    }
    svg.appendChild(inlays);

    // Tasti.
    const frets = el('g', { class: 'fb-frets' });
    for (let j = 0; j <= cells; j++) {
      const x = x0 + j * cw;
      const nut = j === 0 && first === 1;
      frets.appendChild(el('line', {
        x1: x, x2: x, y1: stringY(5), y2: stringY(0),
        class: nut ? 'fb-nut' : '',
      }));
    }
    svg.appendChild(frets);

    // Corde e nomi.
    const strings = el('g', { class: 'fb-strings' });
    const names = el('g', { class: 'fb-string-names' });
    STRING_NAMES.forEach((name, s) => {
      const y = stringY(s);
      strings.appendChild(el('line', {
        x1: x0 - openW, x2: x0 + cells * cw, y1: y, y2: y,
        // Corde gravi leggermente più spesse.
        'stroke-width': (0.8 + (5 - s) * 0.22).toFixed(2),
      }));
      names.appendChild(el('text', { x: 4, y, 'dominant-baseline': 'central' }, name));
    });
    svg.appendChild(strings);
    svg.appendChild(names);

    // Numeri dei tasti.
    const nums = el('g', { class: 'fb-fret-nums' });
    for (let f = first; f <= last; f++) {
      const marker = [0, 3, 5, 7, 9].includes(f % 12) || f === 15;
      nums.appendChild(el('text', {
        x: fretX(f), y: H - 4, 'text-anchor': 'middle', class: marker ? 'is-marker' : '',
      }, String(f)));
    }
    if (hasOpen) {
      nums.appendChild(el('text', { x: fretX(0), y: H - 4, 'text-anchor': 'middle' }, '0'));
    }
    svg.appendChild(nums);

    // Pallini.
    const r = Math.min(Math.min(cw, sp) * 0.45, 12);
    const dots = el('g', { class: 'fb-dots' });
    for (const p of pattern.positions) {
      const cx = fretX(p.fret);
      const cy = stringY(p.string);
      const key = p.string + ':' + p.fret;
      let cls = p.degree === 0 ? 'dot is-root' : 'dot';
      if (opts.path && !opts.path.has(key)) cls += ' is-off';
      const g = el('g', { class: cls, 'data-s': p.string, 'data-f': p.fret });
      g.appendChild(el('circle', { cx, cy, r }));
      const text = labels[p.degree];
      g.appendChild(el('text', {
        x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': text.length > 2 ? r * 0.8 : r * 1.0,
      }, text));
      dots.appendChild(g);
    }
    svg.appendChild(dots);

    return svg;
  }

  root.Fretboard = { render };
})(globalThis);
