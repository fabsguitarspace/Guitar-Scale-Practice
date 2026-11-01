/**
 * Modello teorico: note, gradi, scale e relativa ortografia (spelling enarmonico).
 * Porting di interval-master/src/theory.rs.
 *
 * Script classico (niente ES module) così la pagina funziona anche aperta
 * direttamente da file://. In Node viene esportato con module.exports.
 */
(function (root) {
  'use strict';

  /** Nomi delle lettere a partire da C. */
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  /** Classe di altezza delle note naturali. */
  const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
  /** Semitoni dei gradi della scala maggiore: riferimento per le alterazioni dei gradi. */
  const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];

  const mod = (a, n) => ((a % n) + n) % n;

  // ---------------------------------------------------------------- Note

  /** Una nota con nome: lettera (0 = C … 6 = B) + alterazione (-2..2). */
  function note(letter, accidental) {
    return { letter, accidental };
  }

  function pitchClass(n) {
    return mod(LETTER_PC[n.letter] + n.accidental, 12);
  }

  function noteEquals(a, b) {
    return a.letter === b.letter && a.accidental === b.accidental;
  }

  /** Alterazione in ASCII (b, bb, #, x) o tipografica (♭, ♭♭, ♯, ♯♯). */
  function accidentalString(acc, pretty) {
    if (acc === 0) return '';
    if (pretty) {
      // Doppie alterazioni come ♭♭ / ♯♯: i glifi 𝄫 𝄪 mancano in molti font.
      return (acc < 0 ? '♭' : '♯').repeat(Math.abs(acc));
    }
    if (acc === 2) return 'x';
    return (acc < 0 ? 'b' : '#').repeat(Math.abs(acc));
  }

  function noteToString(n, pretty = false) {
    return LETTERS[n.letter] + accidentalString(n.accidental, pretty);
  }

  // ---------------------------------------------------------------- Gradi

  /** Grado di scala, es. b3, #4, bb7. number 1..7. */
  function degree(number, alteration) {
    return { number, alteration };
  }

  function degreeSemitones(d) {
    return MAJOR_STEPS[d.number - 1] + d.alteration;
  }

  /** Interpreta stringhe come "1", "b3", "#4", "bb7". */
  function parseDegree(s) {
    const m = /^([b#]*)(\d)$/.exec(s);
    if (!m) throw new Error('grado non valido: ' + s);
    let alteration = 0;
    for (const c of m[1]) alteration += c === 'b' ? -1 : 1;
    return degree(Number(m[2]), alteration);
  }

  function degreeToString(d, pretty = false) {
    const a = d.alteration;
    let prefix = '';
    if (a !== 0) prefix = (a < 0 ? (pretty ? '♭' : 'b') : (pretty ? '♯' : '#')).repeat(Math.abs(a));
    return prefix + d.number;
  }

  // ---------------------------------------------------------------- Famiglie

  const FAMILIES = [
    { id: 'major', label: 'Modi della scala maggiore', parent: 'scala maggiore' },
    { id: 'melodic', label: 'Modi della minore melodica', parent: 'minore melodica' },
    { id: 'harmonicMinor', label: 'Modi della minore armonica', parent: 'minore armonica' },
    { id: 'harmonicMajor', label: 'Modi della maggiore armonica', parent: 'maggiore armonica' },
    { id: 'symmetric', label: 'Scale simmetriche', parent: 'scale simmetriche' },
  ];

  function family(id) {
    return FAMILIES.find((f) => f.id === id);
  }

  // ---------------------------------------------------------------- Scale

  /** Semitoni dalla tonica per ogni grado. */
  function semitones(scale) {
    return scale.degrees.map(degreeSemitones);
  }

  /** Distanze tra gradi consecutivi, ottava compresa. */
  function steps(scale) {
    const s = semitones(scale).concat(12);
    const out = [];
    for (let i = 1; i < s.length; i++) out.push(s[i] - s[i - 1]);
    return out;
  }

  /** Formula a gradi, es. "1 2 b3 4 5 6 b7". */
  function formula(scale, pretty = false) {
    return scale.degrees.map((d) => degreeToString(d, pretty)).join(' ');
  }

  /** Struttura a toni/semitoni, es. "T S T T T S T". */
  function stepPattern(scale) {
    return steps(scale)
      .map((s) => (s === 1 ? 'S' : s === 2 ? 'T' : s === 3 ? '1½' : s + 's'))
      .join(' ');
  }

  /** Scrive le note della scala dalla tonica data, una lettera diversa per grado. */
  function spell(scale, rootNote) {
    const rootPc = pitchClass(rootNote);
    return scale.degrees.map((d) => {
      const letter = (rootNote.letter + d.number - 1) % 7;
      const target = mod(rootPc + degreeSemitones(d), 12);
      const natural = LETTER_PC[letter];
      const accidental = mod(target - natural + 6, 12) - 6;
      return note(letter, accidental);
    });
  }

  /** Costo di lettura: alterazioni totali, forte penalità per le doppie. */
  function spellingCost(notes) {
    return notes.reduce((sum, n) => {
      const a = Math.abs(n.accidental);
      return sum + (a >= 2 ? a * 10 : a);
    }, 0);
  }

  /** Nomi possibili della tonica per una classe di altezza. */
  function rootCandidates(pc) {
    pc = mod(pc, 12);
    const l = LETTER_PC.indexOf(pc);
    if (l >= 0) return [note(l, 0)];
    const sharp = LETTER_PC.indexOf(pc - 1);
    const flat = LETTER_PC.indexOf((pc + 1) % 12);
    return [note(sharp, 1), note(flat, -1)];
  }

  /** Nomi della tonica che producono la scrittura più leggibile (tutti, se in parità). */
  function bestRoots(scale, pc) {
    const candidates = rootCandidates(pc);
    const costs = candidates.map((r) => spellingCost(spell(scale, r)));
    const min = Math.min(...costs);
    return candidates.filter((_, i) => costs[i] === min);
  }

  /** Costruisce i 7 modi di una scala madre eptatonica. */
  function modesOf(familyId, parent, names) {
    return names.map(([name, aka], i) => {
      const degrees = [];
      for (let j = 0; j < 7; j++) {
        const semis = mod(parent[(i + j) % 7] - parent[i], 12);
        degrees.push(degree(j + 1, semis - MAJOR_STEPS[j]));
      }
      return { name, aka, family: familyId, mode: i + 1, degrees };
    });
  }

  function symmetric(name, aka, f) {
    return { name, aka, family: 'symmetric', mode: null, degrees: f.split(/\s+/).map(parseDegree) };
  }

  /** Catalogo completo delle scale disponibili (33). */
  function catalog() {
    return [
      ...modesOf('major', [0, 2, 4, 5, 7, 9, 11], [
        ['Ionica', 'Maggiore naturale'],
        ['Dorica', ''],
        ['Frigia', ''],
        ['Lidia', ''],
        ['Misolidia', 'Dominante'],
        ['Eolia', 'Minore naturale'],
        ['Locria', ''],
      ]),
      ...modesOf('melodic', [0, 2, 3, 5, 7, 9, 11], [
        ['Minore melodica', 'Minore jazz, Ionica b3'],
        ['Dorica b2', 'Frigia #6'],
        ['Lidia aumentata', 'Lidia #5'],
        ['Lidia dominante', 'Lidia b7, Acustica'],
        ['Misolidia b6', 'Eolia dominante'],
        ['Locria #2', 'Semidiminuita, Eolia b5'],
        ['Superlocria', 'Alterata'],
      ]),
      ...modesOf('harmonicMinor', [0, 2, 3, 5, 7, 8, 11], [
        ['Minore armonica', 'Eolia #7'],
        ['Locria #6', ''],
        ['Ionica #5', 'Ionica aumentata'],
        ['Dorica #4', 'Rumena'],
        ['Frigia dominante', 'Spagnola, Misolidia b9 b13'],
        ['Lidia #2', ''],
        ['Superlocria bb7', 'Ultralocria'],
      ]),
      ...modesOf('harmonicMajor', [0, 2, 4, 5, 7, 8, 11], [
        ['Maggiore armonica', 'Ionica b6'],
        ['Dorica b5', 'Locria #2 #6'],
        ['Frigia b4', 'Alterata #5'],
        ['Lidia b3', 'Minore melodica #4'],
        ['Misolidia b2', ''],
        ['Lidia aumentata #2', ''],
        ['Locria bb7', ''],
      ]),
      symmetric('Esatonale', 'Toni interi', '1 2 3 #4 #5 b7'),
      symmetric('Diminuita semitono-tono', 'Ottatonica S-T, Dominante diminuita', '1 b2 #2 3 #4 5 6 b7'),
      symmetric('Diminuita tono-semitono', 'Ottatonica T-S', '1 2 b3 4 b5 b6 6 7'),
      symmetric('Aumentata', 'Esatonica 1½-S', '1 #2 3 5 #5 7'),
      symmetric('Aumentata inversa', 'Esatonica S-1½', '1 b2 3 4 #5 6'),
    ];
  }

  /** Sostituisce b/# nei nomi testuali (es. "Dorica b2") con ♭/♯. */
  function prettify(text) {
    return text.replace(/(^|[\s(])(bb|b|#)(?=\d)/g, (_, pre, acc) =>
      pre + (acc === 'bb' ? '♭♭' : acc === 'b' ? '♭' : '♯'));
  }

  const Theory = {
    LETTERS, LETTER_PC, FAMILIES,
    note, pitchClass, noteEquals, noteToString,
    degree, degreeSemitones, parseDegree, degreeToString,
    family, semitones, steps, formula, stepPattern,
    spell, spellingCost, rootCandidates, bestRoots, catalog, prettify,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Theory;
  else root.Theory = Theory;
})(typeof globalThis !== 'undefined' ? globalThis : this);
