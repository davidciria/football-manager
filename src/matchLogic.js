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
      { id: "gk", role: "POR", x: 50, y: 90 },
      { id: "d1", role: "DEF", x: 28, y: 70 }, { id: "d2", role: "DEF", x: 72, y: 70 },
      { id: "m1", role: "MED", x: 18, y: 45 }, { id: "m2", role: "MED", x: 50, y: 45 }, { id: "m3", role: "MED", x: 82, y: 45 },
      { id: "f1", role: "DEL", x: 50, y: 17 },
    ],
  },
  "1-3-2-1": {
    label: "1-3-2-1",
    slots: [
      { id: "gk", role: "POR", x: 50, y: 90 },
      { id: "d1", role: "DEF", x: 18, y: 70 }, { id: "d2", role: "DEF", x: 50, y: 70 }, { id: "d3", role: "DEF", x: 82, y: 70 },
      { id: "m1", role: "MED", x: 30, y: 45 }, { id: "m2", role: "MED", x: 70, y: 45 },
      { id: "f1", role: "DEL", x: 50, y: 17 },
    ],
  },
  "1-4-1-1": {
    label: "1-4-1-1",
    slots: [
      { id: "gk", role: "POR", x: 50, y: 90 },
      { id: "d1", role: "DEF", x: 13, y: 70 }, { id: "d2", role: "DEF", x: 38, y: 70 }, { id: "d3", role: "DEF", x: 62, y: 70 }, { id: "d4", role: "DEF", x: 87, y: 70 },
      { id: "m1", role: "MED", x: 50, y: 45 },
      { id: "f1", role: "DEL", x: 50, y: 17 },
    ],
  },
  "1-2-2-2": {
    label: "1-2-2-2",
    slots: [
      { id: "gk", role: "POR", x: 50, y: 90 },
      { id: "d1", role: "DEF", x: 28, y: 70 }, { id: "d2", role: "DEF", x: 72, y: 70 },
      { id: "m1", role: "MED", x: 28, y: 45 }, { id: "m2", role: "MED", x: 72, y: 45 },
      { id: "f1", role: "DEL", x: 28, y: 17 }, { id: "f2", role: "DEL", x: 72, y: 17 },
    ],
  },
  "1-3-1-2": {
    label: "1-3-1-2",
    slots: [
      { id: "gk", role: "POR", x: 50, y: 90 },
      { id: "d1", role: "DEF", x: 18, y: 70 }, { id: "d2", role: "DEF", x: 50, y: 70 }, { id: "d3", role: "DEF", x: 82, y: 70 },
      { id: "m1", role: "MED", x: 50, y: 45 },
      { id: "f1", role: "DEL", x: 30, y: 17 }, { id: "f2", role: "DEL", x: 70, y: 17 },
    ],
  },
  "1-2-1-3": {
    label: "1-2-1-3",
    slots: [
      { id: "gk", role: "POR", x: 50, y: 90 },
      { id: "d1", role: "DEF", x: 28, y: 70 }, { id: "d2", role: "DEF", x: 72, y: 70 },
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
export function logCard(match, playerId, type, minute) {
  const events = [...(match.events || [])];
  let intervals = { ...(match.intervals || {}) };
  const lineup = { ...(match.lineup || {}) };
  const slotId = slotOfPlayer(match, playerId);
  let needsSub = false;
  let subSlotId = null;

  if (type === "amarilla") {
    const prev = yellowCount(match, playerId);
    events.push({ id: nid("ev"), minute, type: "amarilla", playerId });
    if (prev >= 1) {
      events.push({ id: nid("ev"), minute, type: "azul", playerId, reason: "doble_amarilla" });
      intervals = closeOpenInterval(intervals, playerId, minute);
      if (slotId) delete lineup[slotId];
      needsSub = true;
      subSlotId = slotId;
    }
  } else if (type === "roja") {
    events.push({ id: nid("ev"), minute, type: "roja", playerId });
    intervals = closeOpenInterval(intervals, playerId, minute);
    if (slotId) delete lineup[slotId];
  } else if (type === "azul") {
    events.push({ id: nid("ev"), minute, type: "azul", playerId });
    intervals = closeOpenInterval(intervals, playerId, minute);
    if (slotId) delete lineup[slotId];
    needsSub = true;
    subSlotId = slotId;
  }

  return { match: { ...match, events, intervals, lineup }, needsSub, subSlotId };
}

/* Sustitución: sale outId (o nadie) y entra inId en el slot. */
export function applySubstitution(match, { slotId, outId, inId, minute, role }) {
  let intervals = { ...(match.intervals || {}) };
  if (outId) intervals = closeOpenInterval(intervals, outId, minute);
  intervals = { ...intervals, [inId]: [...(intervals[inId] || []), { start: minute, end: null, role }] };
  const lineup = { ...(match.lineup || {}), [slotId]: inId };
  const events = [
    ...(match.events || []),
    { id: nid("ev"), minute, type: "cambio", playerOutId: outId || null, playerInId: inId, slotId },
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
export function changeFormation(match, formationKey, minute) {
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
    { id: nid("ev"), minute, type: "formacion", formation: formationKey },
  ];
  return { ...match, formation: formationKey, lineup: result, intervals, events };
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
      const last = intervals[intervals.length - 1];
      const since = last && last.end == null ? last.start : minute;
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

/* Minuto "global" mostrado/registrado (1-based en juego). La 2ª parte parte del
   fin real de la 1ª parte (sin contar el descanso). */
export function currentMinute(match, now) {
  const { h1, h2 } = halfElapsedSeconds(match, now);
  const halfMin = match.halfMinutes || 25;
  const base = firstHalfBase(match);
  if (match.phase === "h1") return Math.floor(Math.min(h1, halfMin * 60) / 60) + 1;
  if (match.phase === "descanso") return base;
  if (match.phase === "h2" || match.phase === "finalizado") return base + Math.floor(Math.min(h2, halfMin * 60) / 60) + 1;
  return 0;
}

/* Reloj mostrado. La 2ª parte arranca en halfMin:00 (el descuento de la 1ª
   parte no se arrastra); el descuento se indica aparte con "+N'". */
export function timerDisplay(match, now) {
  const { h1, h2 } = halfElapsedSeconds(match, now);
  const halfMin = match.halfMinutes || 25;
  const halfSec = halfMin * 60;
  if (match.phase === "h1") {
    const over = h1 > halfSec;
    const shown = over ? h1 - halfSec : h1;
    return { main: `${pad2(Math.floor(shown / 60) + (over ? halfMin : 0))}:${pad2(shown % 60)}`, added: over ? `+${Math.floor((h1 - halfSec) / 60) + 1}'` : null };
  }
  if (match.phase === "descanso") return { main: `${pad2(halfMin)}:00`, added: null };
  if (match.phase === "h2" || match.phase === "finalizado") {
    const over = h2 > halfSec;
    const shown = over ? h2 - halfSec : h2;
    return { main: `${pad2(halfMin + Math.floor(shown / 60) + (over ? halfMin : 0))}:${pad2(shown % 60)}`, added: over ? `+${Math.floor((h2 - halfSec) / 60) + 1}'` : null };
  }
  return { main: "00:00", added: null };
}

/* Minuto EFECTIVO 1..(2*halfMin), sin contar los minutos de descuento.
   Si una parte se pasó de halfMin, se capa a halfMin (esos extra no cuentan
   para los minutos jugados). Se usa para atribuir tiempos a jugadores.
   En el descanso devuelve el minuto REAL al que se llegó en la 1ª parte
   (no halfMin), para no inflar los minutos jugados. */
export function effectiveMinute(match, now) {
  const { h1, h2 } = halfElapsedSeconds(match, now);
  const halfMin = match.halfMinutes || 25;
  const base = firstHalfBase(match);
  if (match.phase === "h1") return Math.floor(Math.min(h1, halfMin * 60) / 60);
  if (match.phase === "descanso") return base;
  if (match.phase === "h2" || match.phase === "finalizado") {
    return base + Math.floor(Math.min(h2, halfMin * 60) / 60);
  }
  return 0;
}

/* Duración efectiva de un tramo [start,end] recortada a las partes del partido
   (1ª: 0..h1Base, 2ª: h1Base..h1Base+halfMin) y al minuto final efectivo `cap`.
   Excluye el descanso y los minutos de descuento. */
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
   Si la 1ª parte se jugó completa, es halfMin; si se cortó antes, el minuto real.
   En partidos antiguos sin h1Seconds registrado se asume la parte completa. */
export function firstHalfBase(match) {
  const halfMin = match.halfMinutes || 25;
  const h1 = match.h1Seconds;
  if (!h1) {
    // Sin dato de 1ª parte: en un partido ya finalizado asumimos media completa;
    // en juego (descanso/2ª parte) si es 0 significa que no se jugó nada.
    return match.phase === "finalizado" ? halfMin : 0;
  }
  return Math.min(Math.floor(h1 / 60), halfMin);
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

