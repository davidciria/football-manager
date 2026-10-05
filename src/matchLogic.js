/* ============================================================================
   Lógica pura de partido (fútbol 7).
   Funciones sin efectos secundarios, fáciles de testear.
============================================================================ */

export const ROLE_LABEL = { POR: "Portero", DEF: "Defensa", MED: "Centrocampista", DEL: "Delantero" };
export const ROLE_SHORT = { POR: "POR", DEF: "DEF", MED: "MED", DEL: "DEL" };

export const FORMATIONS = {
  "1-2-3-1": {
    label: "1-2-3-1",
    slots: [
      { id: "gk", role: "POR", x: 50, y: 88 },
      { id: "d1", role: "DEF", x: 28, y: 66 }, { id: "d2", role: "DEF", x: 72, y: 66 },
      { id: "m1", role: "MED", x: 18, y: 45 }, { id: "m2", role: "MED", x: 50, y: 45 }, { id: "m3", role: "MED", x: 82, y: 45 },
      { id: "f1", role: "DEL", x: 50, y: 17 },
    ],
  },
  "1-3-2-1": {
    label: "1-3-2-1",
    slots: [
      { id: "gk", role: "POR", x: 50, y: 88 },
      { id: "d1", role: "DEF", x: 18, y: 66 }, { id: "d2", role: "DEF", x: 50, y: 66 }, { id: "d3", role: "DEF", x: 82, y: 66 },
      { id: "m1", role: "MED", x: 30, y: 45 }, { id: "m2", role: "MED", x: 70, y: 45 },
      { id: "f1", role: "DEL", x: 50, y: 17 },
    ],
  },
  "1-4-1-1": {
    label: "1-4-1-1",
    slots: [
      { id: "gk", role: "POR", x: 50, y: 88 },
      { id: "d1", role: "DEF", x: 13, y: 66 }, { id: "d2", role: "DEF", x: 38, y: 66 }, { id: "d3", role: "DEF", x: 62, y: 66 }, { id: "d4", role: "DEF", x: 87, y: 66 },
      { id: "m1", role: "MED", x: 50, y: 45 },
      { id: "f1", role: "DEL", x: 50, y: 17 },
    ],
  },
  "1-2-2-2": {
    label: "1-2-2-2",
    slots: [
      { id: "gk", role: "POR", x: 50, y: 88 },
      { id: "d1", role: "DEF", x: 28, y: 66 }, { id: "d2", role: "DEF", x: 72, y: 66 },
      { id: "m1", role: "MED", x: 28, y: 45 }, { id: "m2", role: "MED", x: 72, y: 45 },
      { id: "f1", role: "DEL", x: 28, y: 17 }, { id: "f2", role: "DEL", x: 72, y: 17 },
    ],
  },
  "1-3-1-2": {
    label: "1-3-1-2",
    slots: [
      { id: "gk", role: "POR", x: 50, y: 88 },
      { id: "d1", role: "DEF", x: 18, y: 66 }, { id: "d2", role: "DEF", x: 50, y: 66 }, { id: "d3", role: "DEF", x: 82, y: 66 },
      { id: "m1", role: "MED", x: 50, y: 45 },
      { id: "f1", role: "DEL", x: 30, y: 17 }, { id: "f2", role: "DEL", x: 70, y: 17 },
    ],
  },
  "1-2-1-3": {
    label: "1-2-1-3",
    slots: [
      { id: "gk", role: "POR", x: 50, y: 88 },
      { id: "d1", role: "DEF", x: 28, y: 66 }, { id: "d2", role: "DEF", x: 72, y: 66 },
      { id: "m1", role: "MED", x: 50, y: 45 },
      { id: "f1", role: "DEL", x: 18, y: 17 }, { id: "f2", role: "DEL", x: 50, y: 17 }, { id: "f3", role: "DEL", x: 82, y: 17 },
    ],
  },
};

let _idCounter = 0;
function nid(prefix) {
  _idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${_idCounter}`;
}

/* Campos de minuto de un evento. `minute` es el minuto REAL (el que usan los
   intervalos y las estadísticas); `displayMinute` es el minuto del reloj de
   partido que se muestra al usuario (la 2ª parte arranca en el minuto de la
   parte). Solo se añade `displayMinute` cuando difiere/es informado. */
function evMinuteFields(minute, displayMinute) {
  return displayMinute == null || displayMinute === minute ? { minute } : { minute, displayMinute };
}

/* Slot que ocupa un jugador (o null). */
export function slotOfPlayer(match, pid) {
  const entry = Object.entries(match.lineup || {}).find(([, v]) => v === pid);
  return entry ? entry[0] : null;
}

/* Cierra el tramo abierto de un jugador en el minuto dado. */
export function closeOpenInterval(intervals, pid, minute) {
  const arr = [...(intervals[pid] || [])];
  if (arr.length && arr[arr.length - 1].end == null) {
    arr[arr.length - 1] = { ...arr[arr.length - 1], end: minute };
  }
  return { ...intervals, [pid]: arr };
}

/* Jugadores que ya no pueden volver a entrar (roja o azul). */
export function outPlayers(match) {
  const out = new Set();
  for (const e of match.events || []) {
    if ((e.type === "roja" || e.type === "azul") && e.playerId) out.add(e.playerId);
  }
  return out;
}

export function yellowCount(match, pid) {
  return (match.events || []).filter((e) => e.type === "amarilla" && e.playerId === pid).length;
}

export function redCount(match) {
  return (match.events || []).filter((e) => e.type === "roja").length;
}

export function onFieldCount(match) {
  return Object.values(match.lineup || {}).filter(Boolean).length;
}

/* ¿Se puede meter a alguien en una posición vacía?
   No si el hueco es por una expulsión (jugamos con uno menos). */
export function canFillEmptySlot(match, formation) {
  const allowed = (formation?.slots?.length || 0) - redCount(match);
  return onFieldCount(match) < allowed;
}

/* Alineación inicial real (guardada, o reconstruida desde los intervalos). */
export function initialLineupOf(match) {
  if (match.initialLineup) return match.initialLineup;
  const formation = FORMATIONS[match.formation];
  if (!formation) return match.lineup || {};
  const byRole = {};
  Object.entries(match.intervals || {}).forEach(([pid, arr]) => {
    const first = (arr || []).find((iv) => iv.start === 0);
    if (first && first.role) (byRole[first.role] = byRole[first.role] || []).push(pid);
  });
  const result = {};
  formation.slots.forEach((s) => {
    const list = byRole[s.role];
    if (list && list.length) result[s.id] = list.shift();
  });
  return result;
}

/* ---------------------------------------------------------------------------
   Tarjetas:
   - amarilla: si es la 2ª del jugador -> tarjeta azul (no juega más, puede
     entrar un compañero en su lugar).
   - roja: expulsado, no juega más y NO se puede sustituir (jugamos con uno menos).
   - azul directa: como la 2ª amarilla (sustitución obligatoria).
   Devuelve { match, needsSub, subSlotId }.
--------------------------------------------------------------------------- */
export function logCard(match, playerId, type, minute, eventMinute) {
  const events = [...(match.events || [])];
  let intervals = { ...(match.intervals || {}) };
  const lineup = { ...(match.lineup || {}) };
  const slotId = slotOfPlayer(match, playerId);
  const stamp = evMinuteFields(minute, eventMinute);
  let needsSub = false;
  let subSlotId = null;

  if (type === "amarilla") {
    const prev = yellowCount(match, playerId);
    events.push({ id: nid("ev"), ...stamp, type: "amarilla", playerId });
    if (prev >= 1) {
      events.push({ id: nid("ev"), ...stamp, type: "azul", playerId, reason: "doble_amarilla" });
      intervals = closeOpenInterval(intervals, playerId, minute);
      if (slotId) delete lineup[slotId];
      needsSub = true;
      subSlotId = slotId;
    }
  } else if (type === "roja") {
    events.push({ id: nid("ev"), ...stamp, type: "roja", playerId });
    intervals = closeOpenInterval(intervals, playerId, minute);
    if (slotId) delete lineup[slotId];
  } else if (type === "azul") {
    events.push({ id: nid("ev"), ...stamp, type: "azul", playerId });
    intervals = closeOpenInterval(intervals, playerId, minute);
    if (slotId) delete lineup[slotId];
    needsSub = true;
    subSlotId = slotId;
  }

  return { match: { ...match, events, intervals, lineup }, needsSub, subSlotId };
}

/* Sustitución: sale outId (o nadie) y entra inId en el slot. */
export function applySubstitution(match, { slotId, outId, inId, minute, role, eventMinute }) {
  let intervals = { ...(match.intervals || {}) };
  if (outId) intervals = closeOpenInterval(intervals, outId, minute);
  intervals = { ...intervals, [inId]: [...(intervals[inId] || []), { start: minute, end: null, role }] };
  const lineup = { ...(match.lineup || {}), [slotId]: inId };
  const events = [
    ...(match.events || []),
    { id: nid("ev"), ...evMinuteFields(minute, eventMinute), type: "cambio", playerOutId: outId || null, playerInId: inId, slotId },
  ];
  return { ...match, lineup, intervals, events };
}

/* Intercambia los ocupantes de dos slots (puede haber un slot vacío).
   Si un slot está vacío, el jugador del otro se mueve allí y el origen queda
   libre. Actualiza los intervalos (rol) de quienes cambian de posición. */
export function swapPlayers(match, slotA, slotB, minute) {
  const formation = FORMATIONS[match.formation];
  const roleA = formation?.slots.find((s) => s.id === slotA)?.role;
  const roleB = formation?.slots.find((s) => s.id === slotB)?.role;
  const lineup = { ...(match.lineup || {}) };
  const a = lineup[slotA];
  const b = lineup[slotB];
  if (a === b) return match; // mismo slot o ambos vacíos
  let intervals = { ...(match.intervals || {}) };
  const closeAndReopen = (pid, newRole) => {
    intervals = closeOpenInterval(intervals, pid, minute);
    intervals = { ...intervals, [pid]: [...(intervals[pid] || []), { start: minute, end: null, role: newRole }] };
  };
  // a se va a slotB -> su nuevo rol es roleB; b se va a slotA -> roleA.
  const roleOf = (pid) => {
    const slot = Object.keys(lineup).find((k) => lineup[k] === pid);
    return formation?.slots.find((s) => s.id === slot)?.role;
  };
  if (a && roleOf(a) !== roleB) closeAndReopen(a, roleB);
  if (b && roleOf(b) !== roleA) closeAndReopen(b, roleA);
  if (b) lineup[slotA] = b; else delete lineup[slotA];
  if (a) lineup[slotB] = a; else delete lineup[slotB];
  return { ...match, lineup, intervals };
}

/* Cambio de formación en vivo: reubica a los mismos jugadores en los nuevos
   slots por rol y actualiza sus intervalos si cambian de rol. */
export function changeFormation(match, formationKey, minute, eventMinute) {
  const newFormation = FORMATIONS[formationKey];
  if (!newFormation) return match;
  const oldFormation = FORMATIONS[match.formation];
  const onField = Object.entries(match.lineup || {}).map(([slotId, pid]) => ({
    pid,
    role: oldFormation?.slots.find((s) => s.id === slotId)?.role || "MED",
  }));
  const oldRoleByPid = Object.fromEntries(onField.map((p) => [p.pid, p.role]));
  const remaining = [...onField];
  const result = {};

  for (const s of newFormation.slots) {
    const idx = remaining.findIndex((p) => p.role === s.role);
    if (idx !== -1) {
      result[s.id] = remaining[idx].pid;
      remaining.splice(idx, 1);
    }
  }
  for (const s of newFormation.slots) {
    if (result[s.id]) continue;
    if (remaining.length) result[s.id] = remaining.shift().pid;
  }

  let intervals = { ...(match.intervals || {}) };
  for (const s of newFormation.slots) {
    const pid = result[s.id];
    if (!pid) continue;
    if (oldRoleByPid[pid] !== s.role) {
      intervals = closeOpenInterval(intervals, pid, minute);
      intervals = { ...intervals, [pid]: [...(intervals[pid] || []), { start: minute, end: null, role: s.role }] };
    }
  }
  for (const p of remaining) intervals = closeOpenInterval(intervals, p.pid, minute);

  const events = [
    ...(match.events || []),
    { id: nid("ev"), ...evMinuteFields(minute, eventMinute), type: "formacion", formation: formationKey },
  ];
  return { ...match, formation: formationKey, lineup: result, intervals, events };
}

/* Formato de nota: { id, minute, text }. `minute` puede ser null cuando la
   nota no está ligada a un momento concreto del partido. */

/* Minuto al inicio de una línea de notas antiguas: "12'", "12’" o "min 12". */
const LEGACY_MINUTE_RE = /^(\d{1,3})\s*(?:['’]|min(?:uto)?\.?)\s*[-:–]?\s*(.+)$/i;

/* Tabla CP850 (DOS Latin-1) para los bytes 0x80-0xFF. Se usa para reparar
   texto UTF-8 que fue leído por error como CP850 (mojibake), p. ej. "├│" -> "ó"
   o "ÔÇÖ" -> "’". */
const CP850_HIGH = [
  0x00C7, 0x00FC, 0x00E9, 0x00E2, 0x00E4, 0x00E0, 0x00E5, 0x00E7, 0x00EA, 0x00EB, 0x00E8, 0x00EF, 0x00EE, 0x00EC, 0x00C4, 0x00C5,
  0x00C9, 0x00E6, 0x00C6, 0x00F4, 0x00F6, 0x00F2, 0x00FB, 0x00F9, 0x00FF, 0x00D6, 0x00DC, 0x00F8, 0x00A3, 0x00D8, 0x00D7, 0x0192,
  0x00E1, 0x00ED, 0x00F3, 0x00FA, 0x00F1, 0x00D1, 0x00AA, 0x00BA, 0x00BF, 0x00AE, 0x00AC, 0x00BD, 0x00BC, 0x00A1, 0x00AB, 0x00BB,
  0x2591, 0x2592, 0x2593, 0x2502, 0x2524, 0x00C1, 0x00C2, 0x00C0, 0x00A9, 0x2563, 0x2551, 0x2557, 0x255D, 0x00A2, 0x00A5, 0x2510,
  0x2514, 0x2534, 0x252C, 0x251C, 0x2500, 0x253C, 0x00E3, 0x00C3, 0x255A, 0x2554, 0x2569, 0x2566, 0x2560, 0x2550, 0x256C, 0x00A4,
  0x00F0, 0x00D0, 0x00CA, 0x00CB, 0x00C8, 0x0131, 0x00CD, 0x00CE, 0x00CF, 0x2518, 0x250C, 0x2588, 0x2584, 0x00A6, 0x00CC, 0x2580,
  0x00D3, 0x00DF, 0x00D4, 0x00D2, 0x00F5, 0x00D5, 0x00B5, 0x00FE, 0x00DE, 0x00DA, 0x00DB, 0x00D9, 0x00FD, 0x00DD, 0x00AF, 0x00B4,
  0x00AD, 0x00B1, 0x2017, 0x00BE, 0x00B6, 0x00A7, 0x00F7, 0x00B8, 0x00B0, 0x00A8, 0x00B7, 0x00B9, 0x00B3, 0x00B2, 0x25A0, 0x00A0,
];
const CP850_REV = new Map(CP850_HIGH.map((cp, i) => [cp, 0x80 + i]));

/* Repara mojibake UTF-8->CP850. Solo convierte una racha de caracteres CP850
   si el resultado formado por sus bytes es UTF-8 válido; en caso contrario
   mantiene el texto original (eran caracteres legítimos). */
export function repairMojibake(str) {
  const s = String(str);
  let out = "";
  let chars = [];
  let bytes = [];
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const flush = () => {
    if (!chars.length) return;
    try {
      out += decoder.decode(new Uint8Array(bytes));
    } catch {
      out += chars.join("");
    }
    chars = [];
    bytes = [];
  };
  for (const ch of s) {
    const b = CP850_REV.get(ch.codePointAt(0));
    if (b != null) { chars.push(ch); bytes.push(b); }
    else { flush(); out += ch; }
  }
  flush();
  return out;
}

/* Convierte el texto libre del formato antiguo (match.notes) en una lista de
   notas con minuto. Cada línea se trata como una nota; si empieza por un
   minuto reconocible se asocia a él. */
function parseLegacyNotes(str) {
  return String(str || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, i) => {
      const m = line.match(LEGACY_MINUTE_RE);
      return {
        id: `legacy_${i}`,
        minute: m ? Math.min(120, parseInt(m[1], 10)) : null,
        text: repairMojibake((m ? m[2] : line).trim()),
      };
    });
}

/* Notas del partido normalizadas.
   Formato nuevo: match.notesLog = [{ id, minute, text }].
   Formato antiguo: match.notes = string -> se parsea a la misma lista. */
export function normalizeNotes(match) {
  if (Array.isArray(match.notesLog)) {
    return match.notesLog
      .filter((n) => n && typeof n.text === "string")
      .map((n) => ({ id: n.id, minute: n.minute ?? null, text: repairMojibake(n.text) }));
  }
  if (match.notes && String(match.notes).trim()) {
    return parseLegacyNotes(match.notes);
  }
  return [];
}

/* Crea una entrada de nota (con minuto opcional). Devuelve null si está vacía. */
export function newNote({ text, minute }) {
  const clean = repairMojibake(String(text || "")).trim();
  if (!clean) return null;
  return {
    id: "note_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    minute: minute == null || minute === "" ? null : minute,
    text: clean,
  };
}

/* Añade una nota (con minuto opcional) devolviendo el match actualizado. */
export function addNote(match, { text, minute }) {
  const entry = newNote({ text, minute });
  if (!entry) return match;
  const notesLog = [...(Array.isArray(match.notesLog) ? match.notesLog : normalizeNotes(match)), entry];
  return { ...match, notesLog };
}

/* Borra una nota por id. */
export function removeNote(match, id) {
  const notesLog = (Array.isArray(match.notesLog) ? match.notesLog : normalizeNotes(match)).filter((n) => n.id !== id);
  return { ...match, notesLog };
}

/* Notas ordenadas por minuto; las que no tienen minuto van al final,
   conservando el orden de inserción. */
export function notesByMinute(notes) {
  return (notes || [])
    .map((n, i) => ({ n, i }))
    .sort((a, b) => {
      const am = a.n.minute == null ? Infinity : a.n.minute;
      const bm = b.n.minute == null ? Infinity : b.n.minute;
      return am - bm || a.i - b.i;
    })
    .map(({ n }) => n);
}

/* Migra un partido al formato nuevo de notas: convierte `notes` (string
   antiguo) en notesLog y elimina el campo antiguo. Devuelve el mismo objeto
   si no hay nada que migrar. */
export function migrateMatchNotes(match) {
  if (!match || typeof match !== "object") return match;
  if (Array.isArray(match.notesLog)) {
    if (!("notes" in match)) return match;
    const { notes, ...rest } = match;
    return rest;
  }
  if (match.notes == null) return match;
  const { notes, ...rest } = match;
  const legacy = String(notes || "").trim();
  return legacy ? { ...rest, notesLog: parseLegacyNotes(legacy) } : rest;
}

/* Migra la lista completa de partidos ya disputados. */
export function migrateHistory(history) {
  if (!Array.isArray(history)) return history;
  let changed = false;
  const next = history.map((m) => {
    const migrated = migrateMatchNotes(m);
    if (migrated !== m) changed = true;
    return migrated;
  });
  return changed ? next : history;
}

/* Eventos de un partido ordenados por minuto (estable: conserva el orden de
   inserción cuando el minuto coincide). */
export function eventsByMinute(events) {
  return (events || [])
    .map((ev, i) => ({ ev, i }))
    .sort((a, b) => a.ev.minute - b.ev.minute || a.i - b.i)
    .map((x) => x.ev);
}

/* Estadísticas de tarjetas por jugador a partir de los eventos. */
export function cardTotals(events) {
  const map = {};
  for (const ev of events || []) {
    if (!ev.playerId) continue;
    if (!map[ev.playerId]) map[ev.playerId] = { amarillas: 0, rojas: 0, azules: 0 };
    if (ev.type === "amarilla") map[ev.playerId].amarillas += 1;
    else if (ev.type === "roja") map[ev.playerId].rojas += 1;
    else if (ev.type === "azul") map[ev.playerId].azules += 1;
  }
  for (const pid of Object.keys(map)) {
    const t = map[pid];
    t.sanciones = t.amarillas + t.rojas + t.azules;
  }
  return map;
}

/* Minuto en que arrancó la racha continua en el campo que termina en el último
   tramo (abierto) del jugador. Los cambios de ROL/posición parten el intervalo
   (end de uno == start del siguiente) pero NO son un cambio de jugador: se unen. */
function openFieldSpellStart(intervals) {
  if (!intervals.length) return 0;
  const last = intervals[intervals.length - 1];
  if (last.end != null) return last.end;
  let start = last.start;
  for (let i = intervals.length - 2; i >= 0; i--) {
    const prev = intervals[i];
    if (prev.end != null && prev.end === start) start = prev.start;
    else break;
  }
  return start;
}

/* Orden de cambios: quién lleva más tiempo en el campo y quién más en el banquillo.
   - field: ordenado por más tiempo continuo en el campo (primero el que más).
   - bench: ordenado por más tiempo esperando en el banquillo (primero el que más). */
export function subOrdering(match, squad, minute) {
  const onField = new Set(Object.values(match.lineup || {}));
  const out = outPlayers(match);
  const field = [];
  const bench = [];
  for (const p of squad) {
    const intervals = (match.intervals && match.intervals[p.id]) || [];
    if (onField.has(p.id)) {
      const since = openFieldSpellStart(intervals);
      field.push({ player: p, since, minutes: Math.max(0, minute - since) });
    } else if (!out.has(p.id)) {
      const last = intervals[intervals.length - 1];
      const since = last && last.end != null ? last.end : 0;
      bench.push({ player: p, since, minutes: Math.max(0, minute - since) });
    }
  }
  field.sort((a, b) => a.since - b.since);
  bench.sort((a, b) => a.since - b.since);
  return { field, bench };
}

/* Minuto en que un jugador fue expulsado (roja o azul), o null. */
export function ejectionMinute(match, pid) {
  const evs = (match.events || []).filter(
    (e) => (e.type === "roja" || e.type === "azul") && e.playerId === pid
  );
  if (!evs.length) return null;
  return Math.min(...evs.map((e) => e.minute));
}

/* Cierre de un partido: sella todos los intervalos abiertos.
   - Los expulsados (roja/azul) se cierran en el minuto exacto de su tarjeta,
     de modo que no cuentan minutos posteriores a la expulsión.
   - El resto se cierra en el minuto final.
   También garantiza que un expulsado no quede en el lineup final. */
export function finalizeIntervals(match, finalMinute) {
  const intervals = { ...(match.intervals || {}) };
  const ejectionCache = {};
  Object.keys(intervals).forEach((pid) => {
    let ej = ejectionCache[pid];
    if (ej === undefined) {
      ej = ejectionMinute(match, pid);
      ejectionCache[pid] = ej;
    }
    intervals[pid] = (intervals[pid] || []).map((iv) => {
      if (iv.end != null) return iv;
      const end = ej != null && ej < finalMinute ? ej : finalMinute;
      return { ...iv, end };
    });
  });
  const out = outPlayers(match);
  const lineup = { ...(match.lineup || {}) };
  Object.keys(lineup).forEach((slotId) => {
    if (lineup[slotId] && out.has(lineup[slotId])) delete lineup[slotId];
  });
  return { ...match, intervals, lineup };
}

/* ---------------------------------------------------------------------------
   Temporizador (puro, testeable).
--------------------------------------------------------------------------- */
function pad2(n) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

/* Segundos transcurridos en cada parte, incluyendo el tramo en curso. */
export function halfElapsedSeconds(match, now) {
  const h1 = (match.h1Seconds || 0) + (match.phase === "h1" && match.runningSince ? (now - match.runningSince) / 1000 : 0);
  const h2 = (match.h2Seconds || 0) + (match.phase === "h2" && match.runningSince ? (now - match.runningSince) / 1000 : 0);
  return { h1, h2 };
}

/* Minuto "de partido" mostrado/registrado (1-based en juego). Es un reloj de
   fútbol: la 2ª parte arranca SIEMPRE en el minuto de la parte (p. ej. 25 en
   fútbol 7), sin importar lo que duró realmente la 1ª. Este minuto es solo para
   mostrar/registrar eventos; los tiempos REALES de cada jugador los calcula
   `effectiveMinute`. */
export function currentMinute(match, now) {
  const halfMin = match.halfMinutes || 25;
  const { h1, h2 } = halfElapsedSeconds(match, now);
  if (match.phase === "h1") return Math.floor(h1 / 60) + 1;
  if (match.phase === "descanso") return halfMin;
  if (match.phase === "h2" || match.phase === "finalizado") return halfMin + Math.floor(h2 / 60) + 1;
  return 0;
}

/* Reloj mostrado. Es un reloj de partido: la 2ª parte arranca en el minuto de
   la parte (25:00) sea cual sea la duración real de la 1ª, y el descuento se
   indica aparte con "+N'". Los minutos REALES de cada jugador los lleva
   `effectiveMinute`, no este reloj. */
export function timerDisplay(match, now) {
  const { h1, h2 } = halfElapsedSeconds(match, now);
  const halfMin = match.halfMinutes || 25;
  const halfSec = halfMin * 60;
  const fmt = (totalSec) => `${pad2(Math.floor(totalSec / 60))}:${pad2(totalSec % 60)}`;
  if (match.phase === "h1") {
    const over = h1 > halfSec;
    return { main: fmt(h1), added: over ? `+${Math.floor((h1 - halfSec) / 60) + 1}'` : null };
  }
  if (match.phase === "descanso") return { main: fmt(halfSec), added: null };
  if (match.phase === "h2" || match.phase === "finalizado") {
    const over = h2 > halfSec;
    return { main: fmt(halfSec + h2), added: over ? `+${Math.floor((h2 - halfSec) / 60) + 1}'` : null };
  }
  return { main: "00:00", added: null };
}

/* Minuto EFECTIVO (real) usado para atribuir tiempos a jugadores. Incluye el
   tiempo de descuento y arranca la 2ª parte en el fin REAL de la 1ª. En el
   descanso devuelve el minuto real al que se llegó en la 1ª parte. */
export function effectiveMinute(match, now) {
  const { h1, h2 } = halfElapsedSeconds(match, now);
  const base = firstHalfBase(match);
  if (match.phase === "h1") return Math.floor(h1 / 60);
  if (match.phase === "descanso") return base;
  if (match.phase === "h2" || match.phase === "finalizado") {
    return base + Math.floor(h2 / 60);
  }
  return 0;
}

/* Duración de un tramo [start,end] recortada al minuto final efectivo `cap`
   (real, sin descanso). El descanso no está en los minutos globales, por lo que
   el reparto por partes solo sirve para respetar la frontera de la 1ª parte. */
export function clippedDuration(start, end, halfMin, cap, h1Base) {
  const half = halfMin || 25;
  const base = h1Base == null ? half : h1Base;
  const clampedEnd = Math.min(end, cap);
  if (clampedEnd <= start) return 0;
  let total = 0;
  // Parte 1: 0..base
  const s1 = Math.min(start, base);
  const e1 = Math.min(clampedEnd, base);
  if (e1 > s1) total += e1 - s1;
  // Parte 2: base..base+half
  const s2 = Math.max(start, base);
  if (clampedEnd > s2) total += clampedEnd - s2;
  return total;
}

/* Minuto efectivo en que terminó la 1ª parte (base desde la que arranca la 2ª).
   Es el minuto REAL jugado (sin capar a halfMin): si la 1ª parte duró 30 min,
   la 2ª arranca en el 30. En partidos antiguos sin h1Seconds registrado se
   asume la parte completa si ya finalizó. */
export function firstHalfBase(match) {
  const halfMin = match.halfMinutes || 25;
  const h1 = match.h1Seconds;
  if (!h1) {
    // Sin dato de 1ª parte: en un partido ya finalizado asumimos media completa;
    // en juego (descanso/2ª parte) si es 0 significa que no se jugó nada.
    return match.phase === "finalizado" ? halfMin : 0;
  }
  return Math.floor(h1 / 60);
}

/* Tiempo por jugador con el minuto EFECTIVO (sin descuento y sin descanso):
   - played:    minutos TOTALES en el campo.
   - bench:     minutos TOTALES en el banquillo (fuera del campo).
   - onSince:   minutos en el campo DESDE el último cambio (0 si está fuera).
   - offSince:  minutos en el banquillo DESDE el último cambio (0 si está en el campo).
   - onField:   si está en el campo ahora.
   - ejected:   si fue expulsado (no puede jugar). */
export function playerTimeStats(match, squad, now) {
  const eff = effectiveMinute(match, now);
  const halfMin = match.halfMinutes || 25;
  const h1Base = firstHalfBase(match);
  const ejected = outPlayers(match);
  const onField = new Set(Object.values(match.lineup || {}));

  const result = {};
  for (const p of squad) {
    const intervals = (match.intervals && match.intervals[p.id]) || [];
    let played = 0;
    for (const iv of intervals) {
      const end = iv.end == null ? eff : iv.end;
      played += clippedDuration(iv.start, end, halfMin, eff, h1Base);
    }
    const isOn = onField.has(p.id);
    const isEjected = ejected.has(p.id);

    // "Desde el último cambio [de jugador]": tiempo continuo en el campo (o en
    // el banquillo) sin haber salido/entrado. Los cambios de ROL/posición
    // parten el intervalo pero NO cuentan como un cambio de jugador, así que
    // unimos tramos contiguos (end de uno == start del siguiente).
    let onSince = 0;
    let offSince = 0;
    const last = intervals[intervals.length - 1];
    if (isOn && last && last.end == null) {
      // Racha continua en el campo que termina en el tramo abierto.
      let spellStart = last.start;
      for (let i = intervals.length - 2; i >= 0; i--) {
        const prev = intervals[i];
        if (prev.end != null && prev.end === spellStart) spellStart = prev.start;
        else break;
      }
      onSince = Math.max(0, eff - Math.min(spellStart, eff));
    } else if (last && last.end != null) {
      // Racha continua que terminó cuando salió por última vez.
      let spellEnd = last.end;
      let spellStart = last.start;
      for (let i = intervals.length - 2; i >= 0; i--) {
        const prev = intervals[i];
        if (prev.end != null && prev.end === spellStart) { spellStart = prev.start; }
        else break;
      }
      // Desde que salió (spellEnd), no desde que empezó la racha.
      offSince = Math.max(0, eff - Math.min(spellEnd, eff));
    } else if (!last) {
      offSince = eff; // nunca ha jugado
    }
    // Limitar al tiempo total correspondiente.
    onSince = Math.min(onSince, played);
    offSince = Math.min(offSince, Math.max(0, eff - played));

    result[p.id] = {
      played,
      bench: Math.max(0, eff - played),
      onSince,
      offSince,
      onField: isOn,
      ejected: isEjected,
    };
  }
  return result;
}

/* Formatea minutos como "M'" o "M:SS" simplificado. */
export function fmtMin(n) {
  const m = Math.max(0, Math.floor(n || 0));
  return `${m}'`;
}

