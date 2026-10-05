import { describe, it, expect } from "vitest";
import {
  FORMATIONS,
  logCard,
  applySubstitution,
  changeFormation,
  subOrdering,
  initialLineupOf,
  outPlayers,
  canFillEmptySlot,
  onFieldCount,
  redCount,
  yellowCount,
  finalizeIntervals,
  eventsByMinute,
  cardTotals,
  normalizeNotes,
  newNote,
  addNote,
  removeNote,
  notesByMinute,
  migrateMatchNotes,
  migrateHistory,
  repairMojibake,
} from "./matchLogic.js";

const SQUAD = Array.from({ length: 10 }, (_, i) => ({
  id: `p${i + 1}`,
  name: `Jugador ${i + 1}`,
  number: i + 1,
}));

function makeMatch(overrides = {}) {
  const lineup = { gk: "p1", d1: "p2", d2: "p3", m1: "p4", m2: "p5", m3: "p6", f1: "p7" };
  const intervals = {};
  Object.entries(lineup).forEach(([slotId, pid]) => {
    const role = FORMATIONS["1-2-3-1"].slots.find((s) => s.id === slotId).role;
    intervals[pid] = [{ start: 0, end: null, role }];
  });
  return {
    id: "m1",
    formation: "1-2-3-1",
    lineup,
    initialLineup: { ...lineup },
    intervals,
    events: [],
    ...overrides,
  };
}

describe("tarjetas", () => {
  it("la primera amarilla no expulsa", () => {
    const { match, needsSub } = logCard(makeMatch(), "p2", "amarilla", 10);
    expect(needsSub).toBe(false);
    expect(match.lineup.d1).toBe("p2");
    expect(yellowCount(match, "p2")).toBe(1);
    expect(outPlayers(match).has("p2")).toBe(false);
  });

  it("la segunda amarilla genera azul y obliga a sustituir", () => {
    let m = makeMatch();
    m = logCard(m, "p2", "amarilla", 10).match;
    const res = logCard(m, "p2", "amarilla", 20);
    expect(res.needsSub).toBe(true);
    expect(res.subSlotId).toBe("d1");
    expect(res.match.lineup.d1).toBeUndefined();
    expect(outPlayers(res.match).has("p2")).toBe(true);
    const iv = res.match.intervals.p2;
    expect(iv[iv.length - 1].end).toBe(20);
    expect(res.match.events.some((e) => e.type === "azul" && e.reason === "doble_amarilla")).toBe(true);
  });

  it("la roja expulsa sin sustitución (jugamos con uno menos)", () => {
    const { match, needsSub } = logCard(makeMatch(), "p3", "roja", 15);
    expect(needsSub).toBe(false);
    expect(match.lineup.d2).toBeUndefined();
    expect(onFieldCount(match)).toBe(6);
    expect(redCount(match)).toBe(1);
    expect(canFillEmptySlot(match, FORMATIONS["1-2-3-1"])).toBe(false);
  });

  it("la azul directa obliga a sustituir", () => {
    const res = logCard(makeMatch(), "p4", "azul", 12);
    expect(res.needsSub).toBe(true);
    expect(res.subSlotId).toBe("m1");
    expect(res.match.lineup.m1).toBeUndefined();
    expect(outPlayers(res.match).has("p4")).toBe(true);
  });
});

describe("huecos en el campo", () => {
  it("un hueco normal se puede rellenar", () => {
    const m = makeMatch();
    delete m.lineup.f1;
    expect(onFieldCount(m)).toBe(6);
    expect(canFillEmptySlot(m, FORMATIONS["1-2-3-1"])).toBe(true);
  });

  it("tras una expulsión no se puede rellenar", () => {
    const m = logCard(makeMatch(), "p3", "roja", 15).match;
    expect(canFillEmptySlot(m, FORMATIONS["1-2-3-1"])).toBe(false);
  });
});

describe("sustituciones", () => {
  it("mete al que entra y cierra el tramo del que sale", () => {
    const next = applySubstitution(makeMatch(), { slotId: "d1", outId: "p2", inId: "p8", minute: 30, role: "DEF" });
    expect(next.lineup.d1).toBe("p8");
    const outIv = next.intervals.p2;
    expect(outIv[outIv.length - 1].end).toBe(30);
    expect(next.intervals.p8[0]).toEqual({ start: 30, end: null, role: "DEF" });
    expect(next.events.some((e) => e.type === "cambio" && e.playerInId === "p8" && e.playerOutId === "p2")).toBe(true);
  });

  it("sustitución forzada por tarjeta (outId ya estaba fuera)", () => {
    const carded = logCard(makeMatch(), "p4", "azul", 12).match;
    const next = applySubstitution(carded, { slotId: "m1", outId: "p4", inId: "p9", minute: 12, role: "MED" });
    expect(next.lineup.m1).toBe("p9");
    expect(onFieldCount(next)).toBe(7);
    expect(next.events.some((e) => e.type === "cambio" && e.playerOutId === "p4")).toBe(true);
  });
});

describe("cambio de formación en vivo", () => {
  it("reubica a todos los jugadores y mantiene 7 en el campo", () => {
    const next = changeFormation(makeMatch(), "1-4-1-1", 25);
    expect(next.formation).toBe("1-4-1-1");
    expect(onFieldCount(next)).toBe(7);
    expect(new Set(Object.values(next.lineup)).size).toBe(7);
    expect(next.lineup.gk).toBe("p1");
    expect(next.events.some((e) => e.type === "formacion" && e.formation === "1-4-1-1")).toBe(true);
  });

  it("actualiza el rol de los intervalos de quien cambia de posición", () => {
    const next = changeFormation(makeMatch(), "1-4-1-1", 25);
    // En 1-4-1-1 hay más DEF y menos MED; alguien de MED pasa a DEF.
    const rolesNow = Object.values(next.lineup).map((pid) => {
      const iv = next.intervals[pid];
      return iv[iv.length - 1].role;
    });
    const defCount = rolesNow.filter((r) => r === "DEF").length;
    expect(defCount).toBe(4);
    expect(rolesNow.filter((r) => r === "MED").length).toBe(1);
  });
});

describe("orden de cambios", () => {
  it("banquillo ordenado por más tiempo esperando y campo por más tiempo jugando", () => {
    let m = makeMatch();
    m = applySubstitution(m, { slotId: "d1", outId: "p2", inId: "p8", minute: 10, role: "DEF" });
    const { field, bench } = subOrdering(m, SQUAD, 40);

    // p9 y p10 nunca jugaron: llevan todo el partido esperando.
    expect(bench[0].minutes).toBe(40);
    expect(["p9", "p10"]).toContain(bench[0].player.id);
    // p2 salió en el 10 -> 30' esperando.
    expect(bench.find((b) => b.player.id === "p2").minutes).toBe(30);
    // En el campo, el que más tiempo lleva es el portero (desde el 0).
    expect(field[0].since).toBe(0);
    expect(field[field.length - 1].player.id).toBe("p8");
  });

  it("un cambio de rol (formación) no falsea el orden del campo", () => {
    let m = makeMatch();
    m = changeFormation(m, "1-4-1-1", 10); // parte intervalos de quien cambia de rol
    const { field } = subOrdering(m, SQUAD, 20);
    // Todos los que siguen en el campo llevan desde el 0: el cambio de rol no cuenta.
    field.forEach((f) => expect(f.since).toBe(0));
    expect(field).toHaveLength(7);
  });

  it("banquillo ordenado por más tiempo esperando (primero el que más)", () => {
    let m = makeMatch();
    m = applySubstitution(m, { slotId: "d1", outId: "p2", inId: "p8", minute: 5, role: "DEF" });
    m = applySubstitution(m, { slotId: "f1", outId: "p7", inId: "p9", minute: 15, role: "DEL" });
    const { bench } = subOrdering(m, SQUAD, 20);
    const ids = bench.map((b) => b.player.id);
    expect(ids.indexOf("p2")).toBeLessThan(ids.indexOf("p7"));
    expect(bench.find((b) => b.player.id === "p2").minutes).toBe(15);
    expect(bench.find((b) => b.player.id === "p7").minutes).toBe(5);
  });
});

describe("minuto de evento vs minuto real", () => {
  it("guarda displayMinute (reloj) separado del minute real (intervalos)", () => {
    let m = makeMatch();
    m = applySubstitution(m, { slotId: "d1", outId: "p2", inId: "p8", minute: 22, role: "DEF", eventMinute: 25 });
    // El intervalo usa el minuto real (22); el evento muestra el del reloj (25).
    expect(m.intervals.p2[m.intervals.p2.length - 1].end).toBe(22);
    expect(m.intervals.p8[m.intervals.p8.length - 1].start).toBe(22);
    const ev = m.events.find((e) => e.type === "cambio");
    expect(ev.minute).toBe(22);
    expect(ev.displayMinute).toBe(25);
  });

  it("sin eventMinute no añade displayMinute", () => {
    const m = applySubstitution(makeMatch(), { slotId: "d1", outId: "p2", inId: "p8", minute: 10, role: "DEF" });
    const ev = m.events.find((e) => e.type === "cambio");
    expect(ev.displayMinute).toBeUndefined();
  });
});

describe("alineación inicial", () => {
  it("se guarda y no cambia tras las sustituciones", () => {
    let m = makeMatch();
    m = applySubstitution(m, { slotId: "d1", outId: "p2", inId: "p8", minute: 10, role: "DEF" });
    const il = initialLineupOf(m);
    expect(il.d1).toBe("p2");
    expect(Object.values(il)).not.toContain("p8");
  });

  it("se reconstruye desde los intervalos en partidos antiguos", () => {
    const m = makeMatch();
    delete m.initialLineup;
    const il = initialLineupOf(m);
    expect(il.gk).toBe("p1");
    expect(Object.values(il).sort()).toEqual(["p1", "p2", "p3", "p4", "p5", "p6", "p7"]);
  });
});

describe("casos límite", () => {
  it("tras una expulsión, cambiar de formación mantiene 6 en el campo", () => {
    let m = logCard(makeMatch(), "p3", "roja", 15).match;
    m = changeFormation(m, "1-3-2-1", 20);
    expect(onFieldCount(m)).toBe(6);
    expect(canFillEmptySlot(m, FORMATIONS["1-3-2-1"])).toBe(false);
  });

  it("tras una tarjeta azul el hueco sí se puede rellenar", () => {
    const m = logCard(makeMatch(), "p4", "azul", 12).match;
    expect(onFieldCount(m)).toBe(6);
    expect(canFillEmptySlot(m, FORMATIONS["1-2-3-1"])).toBe(true);
  });

  it("el banquillo no incluye a los expulsados", () => {
    const m = logCard(makeMatch(), "p3", "roja", 15).match;
    const { bench } = subOrdering(m, SQUAD, 20);
    expect(bench.some((b) => b.player.id === "p3")).toBe(false);
  });
});

describe("finalización del partido", () => {
  it("cierra el intervalo del expulsado en el minuto de la tarjeta", () => {
    const m = logCard(makeMatch(), "p2", "roja", 20).match;
    const fin = finalizeIntervals(m, 62);
    const arr = fin.intervals.p2;
    expect(arr[arr.length - 1].end).toBe(20);
  });

  it("el expulsado por azul también se cierra en su minuto", () => {
    let m = makeMatch();
    m = logCard(m, "p4", "amarilla", 10).match;
    m = logCard(m, "p4", "amarilla", 38).match;
    const fin = finalizeIntervals(m, 62);
    const arr = fin.intervals.p4;
    expect(arr[arr.length - 1].end).toBe(38);
  });

  it("no cuenta minutos posteriores a la expulsión", () => {
    const m = logCard(makeMatch(), "p2", "roja", 20).match;
    const fin = finalizeIntervals(m, 60);
    const total = fin.intervals.p2.reduce((a, iv) => a + (iv.end - iv.start), 0);
    expect(total).toBe(20);
  });

  it("los no expulsados se cierran en el minuto final", () => {
    const m = makeMatch();
    const fin = finalizeIntervals(m, 62);
    expect(fin.intervals.p1[fin.intervals.p1.length - 1].end).toBe(62);
  });

  it("garantiza que ningún expulsado quede en el lineup", () => {
    let m = makeMatch();
    m = logCard(m, "p3", "roja", 15).match;
    // Forzamos su vuelta al campo (dato corrupto) para comprobar la limpieza.
    m = { ...m, lineup: { ...m.lineup, d2: "p3" } };
    const fin = finalizeIntervals(m, 60);
    expect(Object.values(fin.lineup)).not.toContain("p3");
  });
});

describe("notas del partido", () => {
  it("normaliza el formato nuevo conservando minuto y texto", () => {
    const m = { notesLog: [{ id: "n1", minute: 12, text: "Presión alta" }, { id: "n2", minute: null, text: "Mejorar salida" }] };
    expect(normalizeNotes(m)).toEqual([
      { id: "n1", minute: 12, text: "Presión alta" },
      { id: "n2", minute: null, text: "Mejorar salida" },
    ]);
  });

  it("adapta el formato antiguo (string) a la lista con minuto", () => {
    const m = { notes: "12' Presión alta\nA mejorar la salida" };
    const notes = normalizeNotes(m);
    expect(notes).toHaveLength(2);
    expect(notes[0]).toMatchObject({ minute: 12, text: "Presión alta" });
    expect(notes[1]).toMatchObject({ minute: null, text: "A mejorar la salida" });
  });

  it("newNote descarta notas vacías y conserva el minuto", () => {
    expect(newNote({ text: "   ", minute: 5 })).toBeNull();
    expect(newNote({ text: "  Buen ritmo  ", minute: 5 })).toMatchObject({ minute: 5, text: "Buen ritmo" });
    expect(newNote({ text: "Sin minuto", minute: "" })).toMatchObject({ minute: null });
  });

  it("añade y borra notas sobre el match", () => {
    let m = { id: "m1" };
    m = addNote(m, { text: "Primera", minute: 3 });
    m = addNote(m, { text: "Segunda", minute: 40 });
    expect(normalizeNotes(m)).toHaveLength(2);
    m = removeNote(m, m.notesLog[0].id);
    expect(normalizeNotes(m)).toEqual([{ id: m.notesLog[0].id, minute: 40, text: "Segunda" }]);
  });

  it("ordena por minuto y deja las sin minuto al final", () => {
    const notes = [
      { id: "a", minute: null, text: "sin" },
      { id: "b", minute: 40, text: "cuarenta" },
      { id: "c", minute: 5, text: "cinco" },
    ];
    expect(notesByMinute(notes).map((n) => n.id)).toEqual(["c", "b", "a"]);
  });

  it("migra un partido antiguo y elimina el campo notes", () => {
    const old = { id: "m1", opponent: "Rival", notes: "10' Gol de cabeza\nBuen partido" };
    const migrated = migrateMatchNotes(old);
    expect(migrated).not.toBe(old);
    expect("notes" in migrated).toBe(false);
    expect(migrated.notesLog).toHaveLength(2);
    expect(migrated.notesLog[0]).toMatchObject({ minute: 10, text: "Gol de cabeza" });
  });

  it("no toca partidos ya migrados o sin notas", () => {
    const already = { id: "m1", notesLog: [{ id: "n", minute: 1, text: "x" }] };
    expect(migrateMatchNotes(already)).toBe(already);
    const empty = { id: "m2" };
    expect(migrateMatchNotes(empty)).toBe(empty);
  });

  it("migrateHistory solo devuelve una nueva lista si algo cambió", () => {
    const oldHistory = [{ id: "m1", notes: "5' prueba" }];
    const migrated = migrateHistory(oldHistory);
    expect(migrated).not.toBe(oldHistory);
    expect(Array.isArray(migrated[0].notesLog)).toBe(true);
    const cleanHistory = [{ id: "m2", notesLog: [] }];
    expect(migrateHistory(cleanHistory)).toBe(cleanHistory);
  });
});

describe("reparación de codificación (mojibake UTF-8 leído como CP850)", () => {
  it("repara la 'ó' corrompida a '├│'", () => {
    expect(repairMojibake("Concentraci\u251C\u2502")).toBe("Concentració");
  });

  it("repara el apóstrofo tipográfico corrupto a 'ÔÇÖ'", () => {
    expect(repairMojibake("d\u00D4\u00C7\u00D6espais")).toBe("d’espais");
  });

  it("no toca texto correcto con acentos", () => {
    expect(repairMojibake("Concentració d’espais")).toBe("Concentració d’espais");
  });

  it("no toca otros caracteres especiales legítimos (•)", () => {
    expect(repairMojibake("• Saques de banda")).toBe("• Saques de banda");
  });

  it("se aplica al normalizar notas nuevas y antiguas", () => {
    expect(normalizeNotes({ notesLog: [{ id: "n", minute: 3, text: "Ocupaci\u251C\u2502" }] })[0].text).toBe("Ocupació");
    expect(normalizeNotes({ notes: "Concentraci\u251C\u2502" })[0].text).toBe("Concentració");
    expect(newNote({ text: "d\u00D4\u00C7\u00D6espais", minute: 5 }).text).toBe("d’espais");
  });
});




