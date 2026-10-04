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
