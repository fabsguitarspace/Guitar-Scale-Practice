/**
 * Interfaccia: stato, estrazione casuale, rendering e persistenza locale.
 * Porting di interval-master/src/app.rs.
 */
(function () {
  'use strict';

  const T = window.Theory;
  const G = window.Guitar;
  const F = window.Fretboard;

  const PITCH_LABELS = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'];
  const HISTORY_LEN = 12;
  const STORAGE_KEY = 'interval-master:v1';
  const DESKTOP = window.matchMedia('(min-width: 1024px)');
  const WIDE = window.matchMedia('(min-width: 1280px)');

  const scales = T.catalog();

  // ------------------------------------------------------------ Stato

  /** Una scala estratta: indice nel catalogo + tonica scritta. */
  const state = {
    enabled: new Set(T.FAMILIES.map((f) => f.id)),
    fixedRoot: null, // null = casuale, altrimenti classe di altezza
    avoidRepeats: true,
    quizMode: false,
    revealed: false,
    dotLabel: 'degree', // 'degree' | 'note'
    current: null,
    history: [],
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      const validPick = (p) => p && Number.isInteger(p.scale) && scales[p.scale] && p.root &&
        Number.isInteger(p.root.letter) && Number.isInteger(p.root.accidental);
      if (Array.isArray(s.enabled)) state.enabled = new Set(s.enabled.filter((id) => T.family(id)));
      if (s.fixedRoot === null || (Number.isInteger(s.fixedRoot) && s.fixedRoot >= 0 && s.fixedRoot < 12)) state.fixedRoot = s.fixedRoot;
      if (typeof s.avoidRepeats === 'boolean') state.avoidRepeats = s.avoidRepeats;
      if (typeof s.quizMode === 'boolean') state.quizMode = s.quizMode;
      if (s.dotLabel === 'degree' || s.dotLabel === 'note') state.dotLabel = s.dotLabel;
      if (validPick(s.current)) state.current = s.current;
      if (Array.isArray(s.history)) state.history = s.history.filter(validPick).slice(0, HISTORY_LEN);
    } catch (_) { /* storage non disponibile o dati corrotti: si parte puliti */ }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        enabled: [...state.enabled],
        fixedRoot: state.fixedRoot,
        avoidRepeats: state.avoidRepeats,
        quizMode: state.quizMode,
        dotLabel: state.dotLabel,
        current: state.current,
        history: state.history,
      }));
    } catch (_) { /* ignora */ }
  }

  // ------------------------------------------------------------ Logica

  const randInt = (n) => Math.floor(Math.random() * n);
  const samePick = (a, b) => !!a && !!b && a.scale === b.scale && T.noteEquals(a.root, b.root);

  function pool() {
    return scales.map((_, i) => i).filter((i) => state.enabled.has(scales[i].family));
  }

  function draw(p) {
    const scale = p[randInt(p.length)];
    const pc = state.fixedRoot ?? randInt(12);
    const roots = T.bestRoots(scales[scale], pc);
    return { scale, root: roots[randInt(roots.length)] };
  }

  function pickRandom() {
    const p = pool();
    if (!p.length) return;
    // Qualche tentativo per evitare di ripetere la stessa estrazione.
    let pick = draw(p);
    if (state.avoidRepeats) {
      for (let i = 0; i < 20 && samePick(pick, state.current); i++) pick = draw(p);
    }
    if (state.current) {
      state.history.unshift(state.current);
      state.history.length = Math.min(state.history.length, HISTORY_LEN);
    }
    state.current = pick;
    state.revealed = false;
    save();
    renderResult();
    renderHistory();
  }

  function showFromHistory(i) {
    const [p] = state.history.splice(i, 1);
    if (state.current) state.history.unshift(state.current);
    state.current = p;
    state.revealed = false;
    save();
    renderResult();
    renderHistory();
  }

  const titleOf = (p) => `${T.noteToString(p.root, true)} ${T.prettify(scales[p.scale].name)}`;

  // ------------------------------------------------------------ DOM helpers

  const $ = (sel) => document.querySelector(sel);

  function h(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      e.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return e;
  }

  // ------------------------------------------------------------ Impostazioni

  function renderSettings() {
    const fam = $('#families');
    fam.replaceChildren(...T.FAMILIES.map((f) => {
      const count = scales.filter((s) => s.family === f.id).length;
      const input = h('input', { type: 'checkbox', value: f.id });
      input.checked = state.enabled.has(f.id);
      input.addEventListener('change', () => {
        if (input.checked) state.enabled.add(f.id); else state.enabled.delete(f.id);
        onSettingsChanged();
      });
      return h('label', { class: 'check check-family' }, input, h('span', {}, f.label, h('em', { class: 'count' }, count)));
    }));

    const sel = $('#root-select');
    if (!sel.options.length) {
      sel.append(h('option', { value: '' }, 'Casuale'));
      PITCH_LABELS.forEach((l, pc) => sel.append(h('option', { value: pc }, l)));
      sel.addEventListener('change', () => {
        state.fixedRoot = sel.value === '' ? null : Number(sel.value);
        onSettingsChanged();
      });
    }
    sel.value = state.fixedRoot == null ? '' : String(state.fixedRoot);

    $('#avoid-repeats').checked = state.avoidRepeats;
    $('#quiz-mode').checked = state.quizMode;
    updatePool();
  }

  function updatePool() {
    const n = pool().length;
    $('#pool-count').textContent = `Scale nel pool: ${n}`;
    $('#draw').disabled = n === 0;
    $('#empty-pool').hidden = n !== 0;
  }

  function onSettingsChanged() {
    save();
    updatePool();
  }

  // ------------------------------------------------------------ Risultato

  function renderResult() {
    const out = $('#result');
    const p = state.current;
    if (!p) {
      out.replaceChildren($('#tpl-empty').content.cloneNode(true));
      return;
    }
    const scale = scales[p.scale];
    const notes = T.spell(scale, p.root);
    const origin = scale.mode
      ? `Modo ${scale.mode} della ${T.family(scale.family).parent}`
      : 'Scala simmetrica';

    const head = h('section', { class: 'card scale-head' },
      h('p', { class: 'eyebrow' }, origin),
      h('h2', { class: 'scale-title' }, titleOf(p)),
      scale.aka && h('p', { class: 'aka' }, 'detta anche: ', T.prettify(scale.aka)),
    );

    if (state.quizMode && !state.revealed) {
      head.append(h('div', { class: 'quiz' },
        h('p', { class: 'muted' }, 'Prova a ricostruire note e formula, poi controlla.'),
        h('button', {
          type: 'button', class: 'secondary-btn',
          onclick: () => { state.revealed = true; renderResult(); },
        }, 'Mostra soluzione'),
      ));
      out.replaceChildren(head);
      return;
    }

    head.append(
      h('ol', { class: 'notes', 'aria-label': 'Note della scala' },
        notes.map((n, i) => h('li', { class: i === 0 ? 'is-root' : '' },
          h('span', { class: 'note-name' }, T.noteToString(n, true)),
          h('span', { class: 'note-degree' }, T.degreeToString(scale.degrees[i], true)),
        )),
      ),
      h('dl', { class: 'details' },
        h('div', {}, h('dt', {}, 'Formula'), h('dd', {}, T.formula(scale, true))),
        h('div', {}, h('dt', {}, 'Struttura'), h('dd', {}, T.stepPattern(scale))),
        h('div', {}, h('dt', {}, 'Note'), h('dd', {}, notes.length)),
      ),
    );

    const labels = state.dotLabel === 'degree'
      ? scale.degrees.map((d) => T.degreeToString(d, true))
      : notes.map((n) => T.noteToString(n, true));

    const patterns = G.threeNpsPatterns(scale, T.pitchClass(p.root));
    const grid = h('div', { class: 'patterns' },
      patterns.map((pat, i) => {
        const start = pat.startDegree;
        const caption = `Diteggiatura ${i + 1}`;
        const meta = `dal grado ${T.degreeToString(scale.degrees[start], true)} (${T.noteToString(notes[start], true)}) · tasti ${pat.minFret}–${pat.maxFret}`;
        return h('figure', { class: 'card pattern' },
          h('figcaption', {}, h('strong', {}, caption), h('span', {}, meta)),
          F.render(pat, labels, `${caption}, ${meta}`),
        );
      }),
    );

    const segmented = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Etichette dei pallini' },
      [['degree', 'Gradi'], ['note', 'Note']].map(([v, l]) => h('button', {
        type: 'button', role: 'radio',
        'aria-checked': String(state.dotLabel === v),
        onclick: () => { state.dotLabel = v; save(); renderResult(); },
      }, l)),
    );

    const fingerings = h('section', { class: 'fingerings' },
      h('div', { class: 'section-head' },
        h('h2', {}, 'Diteggiature 3 note per corda'),
        segmented,
      ),
      h('p', { class: 'muted small' },
        'Accordatura standard (EADGBE). Una diteggiatura per ogni grado di partenza sulla 6ª corda; tonica in arancione.'),
      grid,
    );

    out.replaceChildren(head, fingerings);
  }

  // ------------------------------------------------------------ Cronologia

  function renderHistory() {
    const list = $('#history-list');
    list.replaceChildren(...state.history.map((p, i) => h('li', {},
      h('button', {
        type: 'button', class: 'history-item', title: 'Mostra di nuovo',
        onclick: () => { showFromHistory(i); closePanels(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
      }, titleOf(p)),
    )));
    $('#history-empty').hidden = state.history.length > 0;
  }

  // ------------------------------------------------------------ Pannelli (drawer su mobile)

  const panels = { settings: $('#settings'), history: $('#history') };
  const openers = { settings: $('#open-settings'), history: $('#open-history') };
  let lastFocus = null;

  /** I pannelli sono drawer quando non c'è spazio per mostrarli come colonne. */
  function isDrawer(name) {
    return name === 'settings' ? !DESKTOP.matches : !WIDE.matches;
  }

  function openPanel(name) {
    closePanels(false);
    lastFocus = document.activeElement;
    panels[name].classList.add('is-open');
    panels[name].removeAttribute('inert');
    openers[name].setAttribute('aria-expanded', 'true');
    $('#backdrop').hidden = false;
    document.body.classList.add('has-drawer');
    const focusable = panels[name].querySelector('button, input, select');
    if (focusable) focusable.focus({ preventScroll: true });
  }

  function closePanels(restoreFocus = true) {
    let wasOpen = false;
    for (const [name, panel] of Object.entries(panels)) {
      if (panel.classList.contains('is-open')) wasOpen = true;
      panel.classList.remove('is-open');
      openers[name].setAttribute('aria-expanded', 'false');
    }
    $('#backdrop').hidden = true;
    document.body.classList.remove('has-drawer');
    syncInert();
    if (wasOpen && restoreFocus && lastFocus) lastFocus.focus({ preventScroll: true });
  }

  /** I drawer chiusi non devono ricevere il focus da tastiera. */
  function syncInert() {
    for (const [name, panel] of Object.entries(panels)) {
      if (isDrawer(name) && !panel.classList.contains('is-open')) panel.setAttribute('inert', '');
      else panel.removeAttribute('inert');
    }
  }

  // ------------------------------------------------------------ Eventi

  function bind() {
    $('#draw').addEventListener('click', pickRandom);
    $('#all-families').addEventListener('click', () => {
      state.enabled = new Set(T.FAMILIES.map((f) => f.id));
      renderSettings(); save();
    });
    $('#no-families').addEventListener('click', () => {
      state.enabled.clear();
      renderSettings(); save();
    });
    $('#avoid-repeats').addEventListener('change', (e) => { state.avoidRepeats = e.target.checked; save(); });
    $('#quiz-mode').addEventListener('change', (e) => {
      state.quizMode = e.target.checked;
      state.revealed = false;
      save();
      renderResult();
    });

    openers.settings.addEventListener('click', () => openPanel('settings'));
    openers.history.addEventListener('click', () => openPanel('history'));
    $('#backdrop').addEventListener('click', () => closePanels());
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closePanels()));

    const onBreakpoint = () => closePanels(false);
    DESKTOP.addEventListener('change', onBreakpoint);
    WIDE.addEventListener('change', onBreakpoint);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closePanels(); return; }
      if (e.key !== ' ' && e.key !== 'Enter') return;
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      if (document.body.classList.contains('has-drawer')) return;
      // Come in egui: niente scorciatoia mentre un controllo usa la tastiera.
      const t = e.target;
      if (t.closest && t.closest('input, select, textarea, button, a, [contenteditable]')) return;
      e.preventDefault();
      pickRandom();
    });
  }

  load();
  renderSettings();
  renderResult();
  renderHistory();
  syncInert();
  bind();
})();
