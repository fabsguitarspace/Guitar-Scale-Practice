/**
 * Pratica (ADR 0007): pannello Esercizi sui tre assi Cosa / Come / Dove, barra di trasporto,
 * viste sincronizzate (tastiera, tablatura, gradi), ascolto rapido delle diteggiature.
 */
(function (root) {
  'use strict';

  const T = root.Theory;
  const { Pool, Presets, Scheduler, AudioEngine, Fretboard, TabLayout, TabRender } = root;

  const STORAGE_KEY = 'gsp:practice:v1';
  const DESKTOP = root.matchMedia('(min-width: 1024px)');
  const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'];
  const BPM_MIN = 30;
  const BPM_MAX = 300;

  const DIRECTIONS = [['up', 'Su'], ['down', 'Giù'], ['updown', 'Su e giù'], ['downup', 'Giù e su']];
  const EXTENSIONS = [['1', '1 ottava'], ['2', '2 ottave'], ['3', '3 ottave'], ['full', 'Tutta']];
  const ACCENTS = [['group', 'Sul gruppo'], ['beat', 'Sul battito'], ['2', 'Ogni 2'], ['3', 'Ogni 3'], ['4', 'Ogni 4']];
  const OFFSETS = [['0', 'Nessuno'], ['1', '+1'], ['2', '+2'], ['3', '+3']];
  const PICKUPS = [['0', 'Nessuno'], ['1', '1 nota'], ['2', '2 note'], ['3', '3 note']];
  const SCOPES = [
    ['neck', 'Tastiera intera'], ['strings', 'Corde'], ['pattern', 'Diteggiatura 3NPS'],
    ['position', 'Posizione (5 tasti)'], ['chain', 'Collegamento posizioni'],
  ];
  const PROFILES = [['balanced', 'Bilanciata'], ['horizontal', 'Orizzontale'], ['vertical', 'Verticale']];
  const label = (list, v) => (list.find(([k]) => k === String(v)) || [null, ''])[1];

  // ------------------------------------------------------------ Impostazioni

  const defaults = () => ({
    ...Presets.DEFAULTS,
    category: 'linear',
    scope: { ...Presets.DEFAULTS.scope },
    bpm: 80,
    metronome: true,
    metroMode: 'all',
    loop: true,
    countIn: true,
    volNotes: 0.8,
    volClick: 0.6,
    trainer: { on: false, step: 5, every: 2, max: 160 },
    views: { neck: true, tab: true, degrees: true },
  });

  let settings = defaults();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      const d = defaults();
      settings = {
        ...d, ...s,
        scope: { ...d.scope, ...(s.scope || {}) },
        trainer: { ...d.trainer, ...(s.trainer || {}) },
        views: { ...d.views, ...(s.views || {}) },
      };
      if (!Presets.PRESETS.some((p) => p.id === settings.presetId)) settings.presetId = d.presetId;
      settings.bpm = clampBpm(settings.bpm);
    } catch (_) { settings = defaults(); }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (_) { /* ignora */ }
  }

  const clampBpm = (b) => Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(Number(b) || 80)));

  // ------------------------------------------------------------ Stato

  let mounted = null;    // { key, scale, notes, patterns, rootPc, labelMode, container }
  let exercise = null;   // risultato di Presets.build (cache)
  let playing = null;    // { mode: 'exercise' | 'pattern', patternIndex }
  let current = null;    // evento evidenziato
  let rafId = 0;
  let wakeLock = null;
  let taps = [];
  const openAxes = new Set(DESKTOP.matches ? ['cosa', 'come', 'dove', 'opzioni'] : []);
  let panelOpen = DESKTOP.matches;
  let resizeObs = null;
  let lastTabWidth = 0;

  const sched = Scheduler.create({
    now: () => AudioEngine.now(),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (id) => clearTimeout(id),
    onNote: (ev, when, dur) => AudioEngine.playNote(ev.midi, when, {
      velocity: ev.accent ? 1 : 0.6, string: ev.string, duration: dur,
    }),
    onClick: (when, downbeat) => AudioEngine.click(when, { downbeat }),
    onEnd: () => stop(),
    onTempo: (bpm) => { settings.bpm = bpm; save(); updateBpm(); },
  });

  // ------------------------------------------------------------ DOM helpers

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

  function select(id, text, options, value, onChange) {
    const s = h('select', { id: 'pr-' + id, 'data-ctl': id });
    for (const [v, l] of options) s.append(h('option', { value: v }, l));
    s.value = String(value);
    s.addEventListener('change', () => onChange(s.value));
    return h('label', { class: 'field', for: 'pr-' + id }, h('span', { class: 'field-label' }, text), s);
  }

  function segmented(id, text, options, value, onChange) {
    return h('div', { class: 'field' },
      h('span', { class: 'field-label', id: 'pr-' + id + '-l' }, text),
      h('div', { class: 'segmented seg-wrap', role: 'radiogroup', 'aria-labelledby': 'pr-' + id + '-l' },
        options.map(([v, l]) => h('button', {
          type: 'button', role: 'radio', 'data-ctl': id + ':' + v,
          'aria-checked': String(String(value) === String(v)),
          onclick: () => onChange(v),
        }, l))));
  }

  function toggle(id, text, checked, onChange) {
    const input = h('input', { type: 'checkbox', 'data-ctl': id });
    input.checked = !!checked;
    input.addEventListener('change', () => onChange(input.checked));
    return h('label', { class: 'check' }, input, h('span', {}, text));
  }

  function chips(id, text, options, isOn, onToggle) {
    return h('div', { class: 'field' },
      h('span', { class: 'field-label' }, text),
      h('div', { class: 'chips' }, options.map(([v, l]) => h('button', {
        type: 'button', class: 'chip', 'data-ctl': id + ':' + v,
        'aria-pressed': String(isOn(v)), onclick: () => onToggle(v),
      }, l))));
  }

  // ------------------------------------------------------------ Esercizio

  function ctx() {
    return Pool.context(T.semitones(mounted.scale), mounted.rootPc, mounted.patterns);
  }

  function getExercise() {
    if (!exercise) {
      const s = { ...settings, scope: { ...settings.scope } };
      if (s.scope.kind === 'pattern') s.scope.index = Math.min(s.scope.index, mounted.patterns.length - 1);
      s.extension = s.extension === 'full' ? 'full' : Number(s.extension);
      s.accent = /^\d+$/.test(String(s.accent)) ? Number(s.accent) : s.accent;
      exercise = Presets.build(ctx(), s);
    }
    return exercise;
  }

  function labelFor(degree) {
    return mounted.labelMode === 'note'
      ? T.noteToString(mounted.notes[degree], true)
      : T.degreeToString(mounted.scale.degrees[degree], true);
  }

  /** Applica una modifica alle impostazioni: salva, ricalcola, ridisegna. */
  function change(fn) {
    fn(settings);
    save();
    exercise = null;
    if (playing) stop();
    renderPanel();
  }

  // ------------------------------------------------------------ Trasporto

  const transport = (() => {
    const play = h('button', { type: 'button', class: 't-play', 'aria-label': 'Avvia esercizio', onclick: () => togglePlay() },
      h('span', { class: 't-icon', 'aria-hidden': 'true' }), h('span', { class: 't-label' }, 'Play'));
    const out = h('output', { class: 't-bpm-val', 'aria-live': 'polite' });
    const bpm = h('div', { class: 't-bpm', role: 'group', 'aria-label': 'Tempo' },
      h('button', { type: 'button', 'aria-label': 'Rallenta di 5 BPM', onclick: () => bumpBpm(-5) }, '−'),
      h('span', { class: 't-bpm-box' }, out, h('small', {}, 'BPM')),
      h('button', { type: 'button', 'aria-label': 'Accelera di 5 BPM', onclick: () => bumpBpm(5) }, '+'));
    const tap = h('button', { type: 'button', class: 't-tap', onclick: () => tapTempo() }, 'Tap');
    const el = h('div', { class: 'transport' }, play, bpm, tap);
    return { el, play, out };
  })();

  function placeTransport() {
    const home = mounted && mounted.container.querySelector('.transport-home');
    const slot = document.getElementById('transport-slot');
    const target = DESKTOP.matches ? home : slot;
    if (target && transport.el.parentNode !== target) target.appendChild(transport.el);
  }

  function updateBpm() {
    transport.out.textContent = settings.bpm;
  }

  function updatePlayButton() {
    const on = !!playing && playing.mode === 'exercise';
    transport.play.classList.toggle('is-on', on);
    transport.play.setAttribute('aria-label', on ? 'Ferma esercizio' : 'Avvia esercizio');
    transport.play.querySelector('.t-label').textContent = on ? 'Stop' : 'Play';
    const ex = mounted && getExercise();
    transport.play.disabled = !ex || !ex.events.length;
    document.querySelectorAll('[data-quick]').forEach((b) => {
      const i = Number(b.dataset.quick);
      const active = !!playing && playing.mode === 'pattern' && playing.patternIndex === i;
      b.classList.toggle('is-on', active);
      b.setAttribute('aria-label', `${active ? 'Ferma' : 'Ascolta'} la diteggiatura ${i + 1}`);
    });
  }

  function bumpBpm(d) {
    setBpm(settings.bpm + d);
  }

  function setBpm(b) {
    settings.bpm = clampBpm(b);
    save();
    updateBpm();
    if (playing) sched.setBpm(settings.bpm);
  }

  function tapTempo() {
    const t = performance.now();
    if (taps.length && t - taps[taps.length - 1] > 2000) taps = [];
    taps.push(t);
    if (taps.length > 5) taps.shift();
    if (taps.length >= 2) {
      const gaps = taps.slice(1).map((x, i) => x - taps[i]);
      setBpm(60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length));
    }
  }

  // ------------------------------------------------------------ Riproduzione

  function togglePlay() {
    if (playing && playing.mode === 'exercise') stop();
    else playExercise();
  }

  function start(ex, mode, extra = {}) {
    if (!AudioEngine.unlock()) {
      showError('Il browser non supporta Web Audio.');
      return;
    }
    stop();
    AudioEngine.setVolumes({ notes: settings.volNotes, click: settings.volClick });
    AudioEngine.prepare(ex.events.map((e) => e.midi));
    const bpm0 = settings.bpm;
    const tr = settings.trainer;
    sched.start(ex.events, {
      bpm: bpm0,
      loop: mode === 'exercise' ? settings.loop : false,
      countIn: mode === 'exercise' ? settings.countIn : false,
      metronome: mode === 'exercise' ? settings.metronome : false,
      metroMode: settings.metroMode,
      meter: 4,
      lengthBeats: ex.lengthBeats,
      pickupBeats: ex.pickupBeats,
      tempoAt: mode === 'exercise' && settings.loop && tr.on
        ? (it) => Math.min(Math.max(bpm0, tr.max), bpm0 + tr.step * Math.floor(it / Math.max(1, tr.every)))
        : null,
    });
    playing = { mode, ...extra };
    requestWakeLock();
    updatePlayButton();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(frame);
  }

  function playExercise() {
    if (!mounted) return;
    const ex = getExercise();
    if (!ex.events.length) return;
    start(ex, 'exercise');
  }

  /** Ascolto rapido di una diteggiatura: lineare su e giù, ottavi, senza metronomo. */
  function quickPlay(index) {
    if (!mounted) return;
    if (playing && playing.mode === 'pattern' && playing.patternIndex === index) { stop(); return; }
    const ex = Presets.build(ctx(), {
      presetId: 'lin-updown', direction: 'updown', extension: 'full', rhythmId: 'eighths',
      accent: 'beat', accentOffset: 0, pickup: 0, scope: { kind: 'pattern', index }, profile: 'balanced',
    });
    if (ex.events.length) start(ex, 'pattern', { patternIndex: index });
  }

  function stop() {
    sched.stop();
    AudioEngine.stopAll();
    cancelAnimationFrame(rafId);
    playing = null;
    highlight(null);
    releaseWakeLock();
    updatePlayButton();
  }

  function frame() {
    if (!sched.isPlaying()) return;
    const ev = sched.drainVisual(AudioEngine.now() - AudioEngine.latency());
    if (ev) highlight(ev.ev);
    rafId = requestAnimationFrame(frame);
  }

  function requestWakeLock() {
    try {
      if (navigator.wakeLock && !wakeLock) {
        navigator.wakeLock.request('screen').then((l) => { wakeLock = l; }).catch(() => {});
      }
    } catch (_) { /* non supportato */ }
  }

  function releaseWakeLock() {
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  }

  // ------------------------------------------------------------ Evidenziazione

  function highlight(ev) {
    document.querySelectorAll('.is-playing').forEach((e) => e.classList.remove('is-playing'));
    current = ev;
    if (!ev || !mounted) return;
    const c = mounted.container;
    const sel = `.dot[data-s="${ev.string}"][data-f="${ev.fret}"]`;
    if (playing && playing.mode === 'pattern') {
      const d = document.querySelector(`figure[data-pattern="${playing.patternIndex}"] ${sel}`);
      if (d) d.classList.add('is-playing');
      return;
    }
    const dot = c.querySelector('.view-neck ' + sel);
    if (dot) { dot.classList.add('is-playing'); followX(c.querySelector('.neck-scroll'), dot); }
    if (settings.scope.kind === 'pattern') {
      const d = document.querySelector(`figure[data-pattern="${settings.scope.index}"] ${sel}`);
      if (d) d.classList.add('is-playing');
    }
    const num = c.querySelector(`.tab-num[data-i="${ev.i}"]`);
    if (num) { num.classList.add('is-playing'); followY(c.querySelector('.tab-scroll'), num.ownerSVGElement); }
    const li = c.querySelector(`.degree-seq [data-i="${ev.i}"]`);
    if (li) { li.classList.add('is-playing'); followY(c.querySelector('.degree-scroll'), li); }
  }

  /** Scorrimento interno del contenitore (mai della pagina) per mostrare l'elemento. */
  function followX(box, el) {
    if (!box || !el) return;
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.left < b.left + 24 || r.right > b.right - 24) {
      box.scrollLeft += r.left - b.left - b.width / 2 + r.width / 2;
    }
  }

  function followY(box, el) {
    if (!box || !el) return;
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.top < b.top || r.bottom > b.bottom) box.scrollTop += r.top - b.top - 8;
  }

  // ------------------------------------------------------------ Pannello

  function axis(id, title, summary, ...content) {
    const d = h('details', { class: 'axis', 'data-axis': id, open: openAxes.has(id) },
      h('summary', {}, h('span', { class: 'axis-title' }, title), h('span', { class: 'axis-sum' }, summary)),
      h('div', { class: 'axis-body' }, ...content));
    // Stato aggiornato in modo sincrono sul clic: l'evento 'toggle' è asincrono e un ridisegno
    // immediato leggerebbe uno stato vecchio.
    d.firstChild.addEventListener('click', () => { if (d.open) openAxes.delete(id); else openAxes.add(id); });
    return d;
  }

  function cosaAxis() {
    const s = settings;
    const p = Presets.preset(s.presetId);
    const presets = Presets.PRESETS.filter((x) => x.category === s.category);
    const symmetric = mounted.scale.degrees.length !== 7;
    return axis('cosa', 'Cosa', `${p.label} · ${label(DIRECTIONS, s.direction)}${s.scope.kind === 'chain' ? '' : ' · ' + label(EXTENSIONS, s.extension)}`,
      select('category', 'Famiglia', Presets.CATEGORIES.map((c) => [c.id, c.label]), s.category, (v) => change((st) => {
        st.category = v;
        Object.assign(st, Presets.presetDefaults(Presets.PRESETS.find((x) => x.category === v).id));
      })),
      select('preset', 'Esercizio', presets.map((x) => [x.id, x.label]), s.presetId, (v) => change((st) => {
        Object.assign(st, Presets.presetDefaults(v));
      })),
      segmented('direction', 'Direzione', DIRECTIONS, s.direction, (v) => change((st) => { st.direction = v; })),
      s.scope.kind !== 'chain' && select('extension', 'Estensione', EXTENSIONS, s.extension, (v) => change((st) => { st.extension = v; })),
      symmetric && s.category !== 'linear' && s.category !== 'rhythmic' &&
        h('p', { class: 'muted small' }, 'Scala simmetrica: gli intervalli sono salti di gradi della scala (terza = 2 gradi).'),
    );
  }

  function comeAxis() {
    const s = settings;
    const r = Presets.rhythmDef(s.rhythmId);
    const sum = [r.label, label(ACCENTS, s.accent)];
    if (Number(s.accentOffset)) sum.push(`spostato ${label(OFFSETS, s.accentOffset)}`);
    if (Number(s.pickup)) sum.push('in levare');
    return axis('come', 'Come', sum.join(' · '),
      select('rhythm', 'Ritmo', Presets.RHYTHMS.map((x) => [x.id, x.label]), s.rhythmId, (v) => change((st) => { st.rhythmId = v; })),
      select('accent', 'Accento', ACCENTS, s.accent, (v) => change((st) => { st.accent = v; })),
      select('offset', 'Spostamento accento', OFFSETS, s.accentOffset, (v) => change((st) => { st.accentOffset = Number(v); })),
      select('pickup', 'Levare', PICKUPS, s.pickup, (v) => change((st) => { st.pickup = Number(v); })),
    );
  }

  function doveAxis() {
    const s = settings;
    const sc = s.scope;
    const n = mounted.patterns.length;
    const frets = Array.from({ length: 25 }, (_, f) => [String(f), String(f)]);
    let detail = label(SCOPES, sc.kind);
    if (sc.kind === 'strings') detail += ' ' + [...sc.strings].sort().reverse().map((x) => STRING_LABELS[x]).join('');
    if (sc.kind === 'pattern') detail += ' ' + (Math.min(sc.index, n - 1) + 1);
    if (sc.kind === 'position') detail += ' al tasto ' + sc.fret;
    const fingeringMatters = sc.kind === 'neck' || sc.kind === 'strings' || sc.kind === 'position';
    if (fingeringMatters) detail += ' · ' + label(PROFILES, s.profile);
    return axis('dove', 'Dove', detail,
      select('scope', 'Ambito', SCOPES, sc.kind, (v) => change((st) => { st.scope.kind = v; })),
      (sc.kind === 'neck' || sc.kind === 'strings') && h('div', { class: 'field-row' },
        select('from', 'Dal tasto', frets, sc.fretFrom, (v) => change((st) => { st.scope.fretFrom = Number(v); })),
        select('to', 'Al tasto', frets, sc.fretTo, (v) => change((st) => { st.scope.fretTo = Number(v); }))),
      sc.kind === 'strings' && chips('strings', 'Corde (tocca quelle adiacenti per coppie e terne)',
        [5, 4, 3, 2, 1, 0].map((x) => [String(x), STRING_LABELS[x]]),
        (v) => sc.strings.includes(Number(v)),
        (v) => change((st) => {
          const x = Number(v);
          const set = new Set(st.scope.strings);
          if (set.has(x)) { if (set.size > 1) set.delete(x); } else set.add(x);
          st.scope.strings = [...set].sort();
        })),
      sc.kind === 'pattern' && chips('pattern', 'Diteggiatura', Array.from({ length: n }, (_, i) => [String(i), String(i + 1)]),
        (v) => Number(v) === Math.min(sc.index, n - 1),
        (v) => change((st) => { st.scope.index = Number(v); })),
      sc.kind === 'position' && select('position', 'Tasto di partenza', frets.slice(0, 21), sc.fret, (v) => change((st) => { st.scope.fret = Number(v); })),
      sc.kind === 'chain' && h('p', { class: 'muted small' }, `L'esercizio si ripete nelle ${n} diteggiature dal basso verso l'alto, una volta in salita e una in discesa.`),
      fingeringMatters && segmented('profile', 'Distribuzione', PROFILES, s.profile, (v) => change((st) => { st.profile = v; })),
      (sc.kind === 'neck' || sc.kind === 'strings') && toggle('open', 'Corde a vuoto', sc.allowOpen !== false, (v) => change((st) => { st.scope.allowOpen = v; })),
    );
  }

  function opzioniAxis() {
    const s = settings;
    const tr = s.trainer;
    const sum = [s.metronome ? 'Metronomo' : 'Senza metronomo', s.loop ? 'loop' : 'una volta'];
    if (tr.on && s.loop) sum.push(`trainer +${tr.step}`);
    const num = (id, text, value, min, max, step, onChange) => {
      const input = h('input', { type: 'number', id: 'pr-' + id, 'data-ctl': id, min, max, step, value, inputmode: 'numeric' });
      input.addEventListener('change', () => onChange(Math.max(min, Math.min(max, Number(input.value) || min))));
      return h('label', { class: 'field', for: 'pr-' + id }, h('span', { class: 'field-label' }, text), input);
    };
    const range = (id, text, value, onChange) => {
      const input = h('input', { type: 'range', id: 'pr-' + id, 'data-ctl': id, min: 0, max: 1, step: 0.05, value });
      input.addEventListener('input', () => onChange(Number(input.value)));
      return h('label', { class: 'field', for: 'pr-' + id }, h('span', { class: 'field-label' }, text), input);
    };
    return axis('opzioni', 'Opzioni', sum.join(' · '),
      h('div', { class: 'toggles' },
        toggle('metronome', 'Metronomo', s.metronome, (v) => change((st) => { st.metronome = v; })),
        toggle('loop', 'Ripeti (loop)', s.loop, (v) => change((st) => { st.loop = v; })),
        toggle('countin', 'Battuta d\'attacco', s.countIn, (v) => change((st) => { st.countIn = v; }))),
      select('metromode', 'Click del metronomo', [['all', 'Tutti i battiti'], ['downbeat', 'Solo il primo battito']], s.metroMode,
        (v) => change((st) => { st.metroMode = v; })),
      h('div', { class: 'field-row' },
        range('volnotes', 'Volume note', s.volNotes, (v) => { settings.volNotes = v; save(); AudioEngine.setVolumes({ notes: v }); }),
        range('volclick', 'Volume metronomo', s.volClick, (v) => { settings.volClick = v; save(); AudioEngine.setVolumes({ click: v }); })),
      toggle('trainer', 'Trainer di velocità (con il loop)', tr.on, (v) => change((st) => { st.trainer.on = v; })),
      tr.on && h('div', { class: 'field-row three' },
        num('tstep', '+BPM', tr.step, 1, 40, 1, (v) => change((st) => { st.trainer.step = v; })),
        num('tevery', 'ogni N giri', tr.every, 1, 16, 1, (v) => change((st) => { st.trainer.every = v; })),
        num('tmax', 'fino a BPM', tr.max, BPM_MIN, BPM_MAX, 5, (v) => change((st) => { st.trainer.max = v; }))),
    );
  }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function showError(msg) {
    const p = mounted && mounted.container.querySelector('.practice-error');
    if (p) { p.textContent = msg; p.hidden = !msg; }
  }

  function viewsBar() {
    const v = settings.views;
    return chips('views', 'Viste', [['neck', 'Tastiera'], ['tab', 'Tablatura'], ['degrees', 'Gradi']],
      (k) => v[k], (k) => change((st) => { st.views[k] = !st.views[k]; }));
  }

  function neckView(ex) {
    const sc = settings.scope;
    const path = new Set(ex.events.filter((e) => !e.rest).map((e) => e.string + ':' + e.fret));
    const used = ex.events.filter((e) => !e.rest).map((e) => e.fret);
    let lo = 0;
    let hi = 24;
    if (sc.kind === 'neck' || sc.kind === 'strings') { lo = Math.min(sc.fretFrom, sc.fretTo); hi = Math.max(sc.fretFrom, sc.fretTo); }
    else if (used.length) { lo = Math.max(0, Math.min(...used) - 1); hi = Math.min(24, Math.max(...used) + 1); }
    const all = Pool.allowedPositions({ kind: 'neck', fretFrom: lo, fretTo: hi }, ctx());
    const labels = mounted.scale.degrees.map((_, d) => labelFor(d));
    const svg = Fretboard.render({ positions: all, minFret: lo, maxFret: hi }, labels,
      'Percorso dell\'esercizio sulla tastiera', { fretFrom: lo, fretTo: hi, cellWidth: 36, path });
    return h('section', { class: 'view view-neck' },
      h('h3', { class: 'view-title' }, 'Tastiera'),
      h('div', { class: 'neck-scroll', tabindex: 0, 'aria-label': 'Tastiera, scorrevole' }, svg));
  }

  function tabView(ex) {
    const box = h('div', { class: 'tab-scroll' });
    const copyBtn = h('button', { type: 'button', class: 'chip-btn', onclick: () => copyTab(copyBtn) }, 'Copia tab');
    const sec = h('section', { class: 'view view-tab' },
      h('div', { class: 'view-head' }, h('h3', { class: 'view-title' }, 'Tablatura'),
        h('div', { class: 'row-buttons' }, copyBtn,
          h('button', { type: 'button', class: 'chip-btn', onclick: () => root.print() }, 'Stampa'))),
      box);
    return sec;
  }

  function drawTab(forcedWidth) {
    if (!mounted) return;
    const box = mounted.container.querySelector('.tab-scroll');
    if (!box) return;
    const ex = getExercise();
    const width = forcedWidth || Math.max(240, Math.floor(box.clientWidth || mounted.container.clientWidth || 340));
    lastTabWidth = width;
    const lay = TabLayout.layout(ex.events, { width, meter: 4, pickupBeats: ex.pickupBeats, lengthBeats: ex.lengthBeats });
    box.replaceChildren(TabRender.render(lay, { width }));
    if (current) highlight(current);
  }

  function copyTab(btn) {
    const ex = getExercise();
    const txt = `${mounted.title}\n\n` + TabLayout.toAscii(ex.events, { meter: 4, pickupBeats: ex.pickupBeats, lengthBeats: ex.lengthBeats });
    const done = () => { btn.textContent = 'Copiata ✓'; setTimeout(() => { btn.textContent = 'Copia tab'; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, () => fallbackCopy(txt, done));
    } else fallbackCopy(txt, done);
  }

  function fallbackCopy(txt, done) {
    const ta = h('textarea', { class: 'visually-hidden' });
    ta.value = txt;
    document.body.append(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (_) { /* niente */ }
    ta.remove();
  }

  function degreesView(ex) {
    let prevGroup = null;
    const items = ex.events.map((e) => {
      if (e.rest) return h('li', { class: 'is-rest', 'data-i': e.i, 'aria-label': 'pausa' }, '–');
      const start = e.group !== prevGroup;
      prevGroup = e.group;
      return h('li', { class: (start ? 'grp-start' : '') + (e.accent ? ' is-accent' : ''), 'data-i': e.i }, labelFor(e.degree));
    });
    return h('section', { class: 'view view-degrees' },
      h('h3', { class: 'view-title' }, mounted.labelMode === 'note' ? 'Note' : 'Gradi'),
      h('div', { class: 'degree-scroll' }, h('ol', { class: 'degree-seq' }, items)));
  }

  function renderPanel() {
    if (!mounted) return;
    const focusedCtl = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-ctl');
    const ex = getExercise();
    const s = settings;
    const p = Presets.preset(s.presetId);
    const summary = `${p.label} · ${Presets.rhythmDef(s.rhythmId).label} · ${label(SCOPES, s.scope.kind)}`;

    const details = h('details', { class: 'card practice', open: panelOpen },
      h('summary', { class: 'practice-summary' },
        h('span', { class: 'practice-title' }, 'Esercizi'),
        h('span', { class: 'practice-sum' }, summary)),
      h('div', { class: 'practice-body' },
        h('div', { class: 'transport-home' }),
        isIOS() && h('p', { class: 'muted small ios-hint' }, 'Se non senti nulla, controlla che l\'iPhone non sia in modalità silenziosa.'),
        cosaAxis(), comeAxis(), doveAxis(), opzioniAxis(),
        h('p', { class: 'practice-error', hidden: !ex.error, role: 'status' }, ex.error || ''),
        ex.truncated && h('p', { class: 'muted small' }, 'L\'ambito non contiene tutta l\'estensione chiesta: uso quella disponibile.'),
        !ex.error && viewsBar(),
        !ex.error && s.views.neck && neckView(ex),
        !ex.error && s.views.tab && tabView(ex),
        !ex.error && s.views.degrees && degreesView(ex),
      ));
    details.firstChild.addEventListener('click', () => { panelOpen = !details.open; });
    details.addEventListener('toggle', () => { if (details.open) requestAnimationFrame(() => drawTab()); });

    mounted.container.replaceChildren(details);
    placeTransport();
    updateBpm();
    updatePlayButton();
    requestAnimationFrame(() => drawTab());
    observeResize();
    if (focusedCtl) {
      const f = mounted.container.querySelector(`[data-ctl="${CSS.escape(focusedCtl)}"]`);
      if (f) f.focus({ preventScroll: true });
    }
    if (current) highlight(current);
  }

  function observeResize() {
    if (!('ResizeObserver' in root)) return;
    if (resizeObs) resizeObs.disconnect();
    resizeObs = new ResizeObserver(() => {
      const box = mounted && mounted.container.querySelector('.tab-scroll');
      if (box && Math.abs(Math.floor(box.clientWidth) - lastTabWidth) > 8) drawTab();
    });
    resizeObs.observe(mounted.container);
  }

  // ------------------------------------------------------------ API

  /**
   * Monta il pannello per la scala corrente. Con la stessa scala (es. cambio etichette Gradi/Note)
   * la riproduzione continua; con una scala diversa si ferma.
   */
  function mount(context) {
    const same = mounted && mounted.key === context.key;
    if (!same) { stop(); exercise = null; }
    mounted = context;
    if (same) exercise = null;
    document.body.classList.add('has-transport');
    renderPanel();
  }

  function unmount() {
    stop();
    mounted = null;
    exercise = null;
    document.body.classList.remove('has-transport');
    if (transport.el.parentNode) transport.el.remove();
  }

  DESKTOP.addEventListener('change', () => { if (mounted) placeTransport(); });
  // Stampa: tab alla larghezza di un A4 (circa 720 px), poi di nuovo a quella dello schermo.
  root.addEventListener('beforeprint', () => drawTab(720));
  root.addEventListener('afterprint', () => drawTab());
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) stop(); });
  load();

  root.Practice = {
    mount, unmount, quickPlay, togglePlay, bumpBpm, stop,
    isActive: () => !!mounted,
    isOpen: () => panelOpen,
    isPlaying: () => !!playing,
  };
})(globalThis);
