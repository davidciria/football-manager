import { describe, it, expect } from "vitest";
import { eventsByMinute, cardTotals, logCard } from "./matchLogic.js";

function base() {
  return {
    formation: "1-2-3-1",
    lineup: { gk: "p1", d1: "p2", d2: "p3", m1: "p4", m2: "p5", m3: "p6", f1: "p7" },
    initialLineup: {},
    intervals: { p2: [{ start: 0, end: null, role: "DEF" }] },
    events: [],
  };
}

describe("orden de la cronología", () => {
  it("ordena por minuto aunque el array esté desordenado", () => {
    const events = [
      { id: "a", minute: 38, type: "azul", playerId: "p8" },
      { id: "b", minute: 20, type: "roja", playerId: "p2" },
      { id: "c", minute: 3, type: "cambio" },
      { id: "d", minute: 38, type: "amarilla", playerId: "p8" },
    ];
    const ordered = eventsByMinute(events).map((e) => e.id);
    expect(ordered).toEqual(["c", "b", "a", "d"]);
  });

  it("es estable con el mismo minuto", () => {
    const events = [
      { id: "x", minute: 38 },
      { id: "y", minute: 38 },
      { id: "z", minute: 38 },
    ];
    expect(eventsByMinute(events).map((e) => e.id)).toEqual(["x", "y", "z"]);
  });

  it("una tarjeta azul añadida al final no aparece al final si es de un minuto anterior", () => {
    const events = [
      { id: "g", minute: 46, type: "cambio" },
      { id: "azul", minute: 38, type: "azul", playerId: "p8" },
    ];
    const ordered = eventsByMinute(events);
    expect(ordered[0].id).toBe("azul");
  });
});

describe("métricas de tarjetas", () => {
  it("cuenta amarillas, rojas y azules por jugador", () => {
    const events = [
      { type: "amarilla", playerId: "p8" },
      { type: "amarilla", playerId: "p8" },
      { type: "azul", playerId: "p8" },
      { type: "roja", playerId: "p2" },
      { type: "gol", playerId: "p2" },
    ];
    const t = cardTotals(events);
    expect(t.p8).toMatchObject({ amarillas: 2, azules: 1, rojas: 0, sanciones: 3 });
    expect(t.p2).toMatchObject({ amarillas: 0, azules: 0, rojas: 1, sanciones: 1 });
  });

  it("una 2ª amarilla genera azul y suma ambas en sanciones", () => {
    let m = base();
    m = logCard(m, "p2", "amarilla", 10).match;
    m = logCard(m, "p2", "amarilla", 20).match;
    const t = cardTotals(m.events);
    expect(t.p2.amarillas).toBe(2);
    expect(t.p2.azules).toBe(1);
    expect(t.p2.sanciones).toBe(3);
  });
});
