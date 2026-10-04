import { describe, it, expect } from "vitest";
import {
  FORMATIONS,
  changeFormation,
  applySubstitution,
  logCard,
  onFieldCount,
  outPlayers,
  playerTimeStats,
  subOrdering,
  initialLineupOf,
  eventsByMinute,
} from "./matchLogic.js";

const SQUAD = Array.from({ length: 12 }, (_, i) => ({
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
    halfMinutes: 25,
    phase: "h1",
    h1Seconds: 10 * 60,
    h2Seconds: 0,
    runningSince: null,
    lineup,
    initialLineup: { ...lineup },
    intervals,
    events: [],
    ...overrides,
  };
}

const playersOf = (match) => Object.values(match.lineup).filter(Boolean);

describe("cambio de formacion - integridad del equipo", () => {
  it("mantiene exactamente 7 jugadores y sin duplicados en todas las formaciones", () => {
    for (const key of Object.keys(FORMATIONS)) {
      const m = changeFormation(makeMatch(), key, 10);
      const on = playersOf(m);
      expect(on.length).toBe(7);
      expect(new Set(on).size).toBe(7); // sin duplicados
      expect(onFieldCount(m)).toBe(7);
    }
  });

  it("conserva exactamente a los mismos jugadores (no pierde ni añade)", () => {
    const before = playersOf(makeMatch()).sort();
    for (const key of Object.keys(FORMATIONS)) {
      const m = changeFormation(makeMatch(), key, 10);
      expect(playersOf(m).sort()).toEqual(before);
    }
  });

  it("coloca cada jugador en un slot valido de la nueva formacion", () => {
    const m = changeFormation(makeMatch(), "1-4-1-1", 10);
    const validSlots = new Set(FORMATIONS["1-4-1-1"].slots.map((s) => s.id));
    Object.keys(m.lineup).forEach((slotId) => expect(validSlots.has(slotId)).toBe(true));
  });

  it("asigna el gk al slot gk", () => {
    const m = changeFormation(makeMatch(), "1-3-2-1", 10);
    expect(m.lineup.gk).toBe("p1");
  });

  it("no genera slots con valor null/undefined", () => {
    const m = changeFormation(makeMatch(), "1-2-2-2", 10);
    Object.values(m.lineup).forEach((v) => expect(v).toBeTruthy());
  });

  it("cambiar a la misma formacion no altera el equipo", () => {
    const m = changeFormation(makeMatch(), "1-2-3-1", 10);
    expect(playersOf(m).sort()).toEqual(playersOf(makeMatch()).sort());
    expect(m.lineup.gk).toBe("p1");
  });
});

describe("cambio de formacion - intervalos y roles", () => {
  it("actualiza el rol de los intervalos de quien cambia de posicion", () => {
    const m = changeFormation(makeMatch(), "1-4-1-1", 25);
    // 1-4-1-1 tiene 4 DEF; algunos MED pasan a DEF.
    const roles = Object.entries(m.lineup).map(([slot, pid]) => {
      const iv = m.intervals[pid];
      return iv[iv.length - 1].role;
    });
    expect(roles.filter((r) => r === "DEF").length).toBe(4);
    expect(roles.filter((r) => r === "MED").length).toBe(1);
    expect(roles.filter((r) => r === "POR").length).toBe(1);
    expect(roles.filter((r) => r === "DEL").length).toBe(1);
  });

  it("cierra el tramo anterior y abre uno nuevo al cambiar de rol", () => {
    const before = makeMatch();
    const roleBefore = {};
    Object.entries(before.lineup).forEach(([slot, pid]) => {
      roleBefore[pid] = FORMATIONS["1-2-3-1"].slots.find((s) => s.id === slot).role;
    });
    const m = changeFormation(before, "1-4-1-1", 25);
    // Buscar un jugador cuyo rol cambió (p.ej. un MED que pasa a DEF)
    const changedPid = Object.entries(m.lineup).find(([slot, pid]) => {
      const newRole = FORMATIONS["1-4-1-1"].slots.find((x) => x.id === slot).role;
      return roleBefore[pid] && roleBefore[pid] !== newRole;
    })[1];
    const iv = m.intervals[changedPid];
    expect(iv.length).toBeGreaterThanOrEqual(2);
    expect(iv[iv.length - 1].end).toBeNull();
    expect(iv[iv.length - 1].start).toBe(25);
  });

  it("quien mantiene su rol no parte el intervalo", () => {
    const m = changeFormation(makeMatch(), "1-3-2-1", 25);
    // p1 es POR en ambas -> un solo tramo
    expect(m.intervals.p1.length).toBe(1);
    expect(m.intervals.p1[0].end).toBeNull();
  });

  it("no deja intervalos abiertos huerfanos (todos los que no estan en el campo se cierran)", () => {
    const m = changeFormation(makeMatch(), "1-2-2-2", 20);
    Object.values(m.intervals).forEach((arr) => {
      arr.forEach((iv) => {
        if (iv.end == null) {
          // el único tramo abierto permitido es el de un jugador en el campo
          expect(Object.values(m.lineup)).toContain(
            Object.keys(m.intervals).find((pid) => m.intervals[pid] === arr)
          );
        }
      });
    });
  });

  it("registra un evento de formacion", () => {
    const m = changeFormation(makeMatch(), "1-3-1-2", 15);
    const ev = m.events.find((e) => e.type === "formacion");
    expect(ev).toBeTruthy();
    expect(ev.formation).toBe("1-3-1-2");
    expect(ev.minute).toBe(15);
  });

  it("no borra los eventos previos", () => {
    const base = applySubstitution(makeMatch(), { slotId: "d1", outId: "p2", inId: "p8", minute: 5, role: "DEF" });
    const m = changeFormation(base, "1-4-1-1", 10);
    expect(m.events.some((e) => e.type === "cambio")).toBe(true);
    expect(m.events.some((e) => e.type === "formacion")).toBe(true);
  });

  it("una formacion invalida no cambia nada", () => {
    const before = makeMatch();
    const m = changeFormation(before, "9-9-9", 10);
    expect(m).toBe(before);
  });
});

describe("cambio de formacion - expulsiones", () => {
  it("con un expulsado (roja) mantiene 6 en el campo y no lo resucita", () => {
    let m = makeMatch();
    m = logCard(m, "p3", "roja", 10).match;
    expect(onFieldCount(m)).toBe(6);
    const before = playersOf(m).sort();
    m = changeFormation(m, "1-2-2-2", 20);
    expect(onFieldCount(m)).toBe(6);
    expect(playersOf(m).sort()).toEqual(before);
    expect(playersOf(m)).not.toContain("p3");
  });

  it("con azul (2 amarillas) mantiene 6 y el expulsado fuera", () => {
    let m = makeMatch();
    m = logCard(m, "p4", "amarilla", 5).match;
    m = logCard(m, "p4", "amarilla", 10).match;
    expect(outPlayers(m).has("p4")).toBe(true);
    const before = playersOf(m).sort();
    m = changeFormation(m, "1-3-2-1", 20);
    expect(onFieldCount(m)).toBe(6);
    expect(playersOf(m).sort()).toEqual(before);
    expect(playersOf(m)).not.toContain("p4");
  });

  it("con dos expulsados mantiene 5 en el campo", () => {
    let m = makeMatch();
    m = logCard(m, "p2", "roja", 8).match;
    m = logCard(m, "p3", "roja", 12).match;
    expect(onFieldCount(m)).toBe(5);
    m = changeFormation(m, "1-4-1-1", 20);
    expect(onFieldCount(m)).toBe(5);
    expect(playersOf(m)).not.toContain("p2");
    expect(playersOf(m)).not.toContain("p3");
  });

  it("la alineacion inicial no cambia tras cambiar formacion", () => {
    let m = makeMatch();
    const before = initialLineupOf(m);
    m = changeFormation(m, "1-4-1-1", 20);
    expect(initialLineupOf(m)).toEqual(before);
  });
});

describe("cambio de formacion - no rompe otras funciones", () => {
  it("tras cambiar formacion se pueden seguir haciendo sustituciones", () => {
    let m = changeFormation(makeMatch(), "1-4-1-1", 10);
    const someSlot = Object.keys(m.lineup)[0];
    const outPid = m.lineup[someSlot];
    m = applySubstitution(m, { slotId: someSlot, outId: outPid, inId: "p9", minute: 15, role: "DEF" });
    expect(m.lineup[someSlot]).toBe("p9");
    expect(m.intervals.p9[m.intervals.p9.length - 1].start).toBe(15);
    expect(onFieldCount(m)).toBe(7);
  });

  it("las tarjetas siguen funcionando tras cambiar formacion", () => {
    let m = changeFormation(makeMatch(), "1-3-2-1", 10);
    const victim = Object.values(m.lineup)[1];
    const res = logCard(m, victim, "roja", 15);
    expect(res.match.events.some((e) => e.type === "roja" && e.playerId === victim)).toBe(true);
    expect(onFieldCount(res.match)).toBe(6);
  });

  it("los tiempos (jugado/banquillo) siguen cuadrando tras cambiar formacion", () => {
    let m = changeFormation(makeMatch(), "1-4-1-1", 10);
    m = { ...m, h1Seconds: 20 * 60 };
    const stats = playerTimeStats(m, SQUAD, 0);
    // Todos los que empezaron juegan los mismos 20 min (nadie salió)
    Object.values(m.lineup).forEach((pid) => {
      expect(stats[pid].played).toBe(20);
      expect(stats[pid].bench).toBe(0);
    });
    // La suma de minutos jugados = 7 jugadores * 20 = 140
    const total = Object.values(m.lineup).reduce((a, pid) => a + stats[pid].played, 0);
    expect(total).toBe(140);
  });

  it("el orden de cambios sigue coherente tras cambiar formacion", () => {
    let m = changeFormation(makeMatch(), "1-4-1-1", 10);
    m = applySubstitution(m, { slotId: Object.keys(m.lineup)[0], outId: Object.values(m.lineup)[0], inId: "p9", minute: 10, role: "DEF" });
    const { field, bench } = subOrdering(m, SQUAD, 20);
    // p9 entró en el 10 -> 10 min en el campo
    expect(field.find((f) => f.player.id === "p9").minutes).toBe(10);
    // p8 nunca jugó -> 20 en el banquillo
    expect(bench.find((b) => b.player.id === "p8").minutes).toBe(20);
  });

  it("encadenar varios cambios de formacion mantiene la coherencia", () => {
    let m = makeMatch();
    m = changeFormation(m, "1-4-1-1", 5);
    m = changeFormation(m, "1-2-1-3", 10);
    m = changeFormation(m, "1-3-2-1", 15);
    m = changeFormation(m, "1-2-3-1", 20);
    expect(onFieldCount(m)).toBe(7);
    expect(new Set(playersOf(m)).size).toBe(7);
    expect(playersOf(m).sort()).toEqual(playersOf(makeMatch()).sort());
    // un único gk, un único tramo abierto por jugador en el campo
    expect(m.lineup.gk).toBe("p1");
  });

  it("no rompe con formacion cambiada tras una sustitucion y una expulsion simultaneas", () => {
    let m = applySubstitution(makeMatch(), { slotId: "f1", outId: "p7", inId: "p8", minute: 6, role: "DEL" });
    m = logCard(m, "p2", "roja", 8).match;
    m = changeFormation(m, "1-2-2-2", 10);
    expect(onFieldCount(m)).toBe(6);
    expect(playersOf(m)).not.toContain("p2");
    expect(playersOf(m)).toContain("p8");
    // sin duplicados
    expect(new Set(playersOf(m)).size).toBe(6);
  });
});

describe("cambio de formacion - escenarios con tiempo", () => {
  function baseAt(min) {
    let m = makeMatch({ h1Seconds: min * 60 });
    return m;
  }

  it("cambiar formacion a mitad de partido conserva minutos jugados", () => {
    const m = baseAt(15);
    const before = playerTimeStats(m, SQUAD, 0);
    const m2 = changeFormation(m, "1-4-1-1", 15);
    const after = playerTimeStats(m2, SQUAD, 0);
    Object.keys(before).forEach((pid) => {
      expect(after[pid].played).toBe(before[pid].played);
    });
  });

  it("cambio de formacion durante el descanso no rompe los tiempos", () => {
    let m = makeMatch({ phase: "descanso", h1Seconds: 20 * 60 });
    m = changeFormation(m, "1-4-1-1", 20);
    const stats = playerTimeStats(m, SQUAD, 0);
    Object.values(m.lineup).forEach((pid) => {
      expect(stats[pid].played).toBe(20);
    });
    expect(onFieldCount(m)).toBe(7);
  });

  it("no deja minutos negativos ni mayores que el tiempo jugado", () => {
    let m = changeFormation(makeMatch({ h1Seconds: 0 }), "1-4-1-1", 0);
    m = { ...m, h1Seconds: 12 * 60 };
    const stats = playerTimeStats(m, SQUAD, 0);
    Object.values(stats).forEach((s) => {
      expect(s.played).toBeGreaterThanOrEqual(0);
      expect(s.bench).toBeGreaterThanOrEqual(0);
      expect(s.onSince).toBeGreaterThanOrEqual(0);
      expect(s.offSince).toBeGreaterThanOrEqual(0);
      expect(s.played + s.bench).toBeLessThanOrEqual(12 + 5); // margen por el +1 de minuto
    });
  });
});

describe("cambio de formacion - UI handlers (logica de negocio)", () => {
  it("aplicar cambio de formacion dos veces seguidas no duplica jugadores", () => {
    let m = makeMatch();
    m = changeFormation(m, "1-3-2-1", 5);
    m = changeFormation(m, "1-2-2-2", 8);
    expect(new Set(playersOf(m)).size).toBe(7);
    // exactamente 2 eventos de formacion
    expect(m.events.filter((e) => e.type === "formacion").length).toBe(2);
  });

  it("el minuto del evento de formacion coincide con el pasado", () => {
    const m = changeFormation(makeMatch(), "1-3-1-2", 33);
    expect(m.events.find((e) => e.type === "formacion").minute).toBe(33);
  });
});

import { swapPlayers } from "./matchLogic.js";

describe("intercambio de posiciones (doMove)", () => {
  it("intercambia dos jugadores entre slots y actualiza roles", () => {
    const m = makeMatch(); // p2 en d1 (DEF), p7 en f1 (DEL)
    const next = swapPlayers(m, "d1", "f1", 10);
    expect(next.lineup.d1).toBe("p7");
    expect(next.lineup.f1).toBe("p2");
    // p7 (era DEL) ahora en d1 -> rol DEF
    const iv7 = next.intervals.p7;
    expect(iv7[iv7.length - 1].role).toBe("DEF");
    // p2 (era DEF) ahora en f1 -> rol DEL
    const iv2 = next.intervals.p2;
    expect(iv2[iv2.length - 1].role).toBe("DEL");
    expect(onFieldCount(next)).toBe(7);
  });

  it("no pierde ninun jugador y no duplica", () => {
    const m = makeMatch();
    const next = swapPlayers(m, "d1", "m2", 10);
    expect(new Set(Object.values(next.lineup)).size).toBe(7);
    expect(Object.values(next.lineup).sort()).toEqual(Object.values(m.lineup).sort());
  });

  it("mover a un slot vacio deja el origen libre", () => {
    const m = makeMatch();
    delete m.lineup.f1; // hueco en delantera
    const next = swapPlayers(m, "d1", "f1", 10);
    expect(next.lineup.f1).toBe("p2");
    expect(next.lineup.d1).toBeUndefined();
    expect(onFieldCount(next)).toBe(6);
  });

  it("no crea nuevo tramo si el rol no cambia", () => {
    const m = makeMatch();
    // mover un MED (m1->p4) a otro MED (m2->p5): mismo rol
    const next = swapPlayers(m, "m1", "m2", 10);
    expect(next.intervals.p4.length).toBe(1); // sin partir
    expect(next.intervals.p5.length).toBe(1);
  });

  it("swap con el mismo slot no hace nada", () => {
    const m = makeMatch();
    expect(swapPlayers(m, "d1", "d1", 10)).toBe(m);
  });

  it("los tiempos siguen cuadrando tras un intercambio", () => {
    let m = swapPlayers(makeMatch({ h1Seconds: 5 * 60 }), "d1", "f1", 5);
    m = { ...m, h1Seconds: 15 * 60 };
    const stats = playerTimeStats(m, SQUAD, 0);
    // Todos empezaron y ninguno salio: 15 min
    Object.values(m.lineup).forEach((pid) => {
      expect(stats[pid].played).toBe(15);
    });
  });
});

describe("onSince no se resetea con cambios de formacion (bug)", () => {
  it("cambiar formacion no pone a 0 los minutos desde el ultimo cambio", () => {
    const m = makeMatch({ h1Seconds: 15 * 60 });
    const before = playerTimeStats(m, SQUAD, 0);
    const m2 = changeFormation(m, "1-4-1-1", 15);
    const after = playerTimeStats(m2, SQUAD, 0);
    // Solo los jugadores que están en el campo (los 7 iniciales)
    Object.values(m.lineup).forEach((pid) => {
      expect(after[pid].onSince).toBe(before[pid].onSince); // no cambia
      expect(after[pid].onSince).toBe(15); // y no es 0
    });
  });

  it("una sustitucion real SI resetea onSince del que entra", () => {
    let m = makeMatch({ h1Seconds: 3 * 60 });
    m = applySubstitution(m, { slotId: "d1", outId: "p2", inId: "p8", minute: 3, role: "DEF" });
    m = { ...m, h1Seconds: 10 * 60 };
    const s = playerTimeStats(m, SQUAD, 0);
    expect(s.p8.onSince).toBe(7); // entro en el 3, ahora 10 -> 7
    expect(s.p2.offSince).toBe(7); // salio en el 3
  });

  it("encadenar cambio de formacion y sustitucion mantiene tiempos coherentes", () => {
    let m = makeMatch({ h1Seconds: 5 * 60 });
    m = changeFormation(m, "1-4-1-1", 5);          // cambia roles, no resetea
    m = applySubstitution(m, { slotId: "gk", outId: "p1", inId: "p8", minute: 8, role: "POR" });
    m = { ...m, h1Seconds: 20 * 60 };
    const s = playerTimeStats(m, SQUAD, 0);
    expect(s.p8.onSince).toBe(12); // entro en el 8, ahora 20
    expect(s.p1.onSince).toBe(0);  // salio
    expect(s.p1.offSince).toBe(12);
  });
});
