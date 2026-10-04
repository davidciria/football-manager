import { describe, it, expect } from "vitest";
import { eventsByMinute, cardTotals, logCard, halfElapsedSeconds, currentMinute, timerDisplay, effectiveMinute, playerTimeStats } from "./matchLogic.js";

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

describe("temporizador", () => {
  const MS = 1000;

  it("cuenta hacia delante mientras corre (1ª parte)", () => {
    const m = { phase: "h1", halfMinutes: 25, h1Seconds: 0, h2Seconds: 0, runningSince: 1000 };
    expect(timerDisplay(m, 1000 + 10 * MS).main).toBe("00:10");
    expect(currentMinute(m, 1000 + 10 * MS)).toBe(1);
  });

  it("al pausar congela el tiempo y al reanudar NO retrocede", () => {
    // Corre 10s y se pausa (h1Seconds pasa a 10, runningSince null)
    const paused = { phase: "h1", halfMinutes: 25, h1Seconds: 10, h2Seconds: 0, runningSince: null };
    expect(timerDisplay(paused, 999999).main).toBe("00:10");
    // Reanuda 5s despues del momento en que se mostraba el reloj
    const resumed = { ...paused, runningSince: 5000 };
    // justo al reanudar, sigue en 00:10 (no baja)
    expect(timerDisplay(resumed, 5000).main).toBe("00:10");
    // 3s despues del reanudado -> 00:13
    expect(timerDisplay(resumed, 5000 + 3 * MS).main).toBe("00:13");
  });

  it("la 2ª parte arranca en 25:00 aunque la 1ª tuviera descuento", () => {
    const m = { phase: "h2", halfMinutes: 25, h1Seconds: 27.5 * 60, h2Seconds: 0, runningSince: 1000 };
    expect(timerDisplay(m, 1000).main).toBe("25:00");
    expect(timerDisplay(m, 1000 + 30 * MS).main).toBe("25:30");
    expect(currentMinute(m, 1000 + 30 * MS)).toBe(26);
  });

  it("muestra el descuento con +N' al pasarse de la parte", () => {
    const m = { phase: "h1", halfMinutes: 25, h1Seconds: 26 * 60 + 20, h2Seconds: 0, runningSince: null };
    const t = timerDisplay(m, 0);
    expect(t.main).toBe("26:20");
    expect(t.added).toBe("+2'");
  });
});

describe("minuto efectivo (sin descuento)", () => {
  it("capa la 1a parte a halfMin aunque se juegue mas", () => {
    const m = { phase: "h1", halfMinutes: 25, h1Seconds: 27 * 60, h2Seconds: 0, runningSince: null };
    expect(effectiveMinute(m, 0)).toBe(25); // 27 reales -> 25 efectivos
  });
  it("la 2a parte arranca desde el fin real de la 1a y capa igual", () => {
    const m = { phase: "h2", halfMinutes: 25, h1Seconds: 25 * 60, h2Seconds: 27 * 60, runningSince: null };
    expect(effectiveMinute(m, 0)).toBe(50); // 25 + 25 capados
  });
  it("si la 1a parte se corto antes, la 2a arranca desde ahi (sin hueco de descanso)", () => {
    const m = { phase: "h2", halfMinutes: 25, h1Seconds: 8 * 60, h2Seconds: 5 * 60, runningSince: null };
    expect(effectiveMinute(m, 0)).toBe(13); // 8 + 5
  });
  it("durante la 1a parte cuenta los minutos reales hasta el limite", () => {
    const m = { phase: "h1", halfMinutes: 25, h1Seconds: 10 * 60, h2Seconds: 0, runningSince: null };
    expect(effectiveMinute(m, 0)).toBe(10);
  });
});

describe("tiempos por jugador (jugado, banquillo, desde el ultimo cambio)", () => {
  function make(overrides = {}) {
    return {
      formation: "1-2-3-1",
      halfMinutes: 25,
      phase: "h1",
      h1Seconds: 20 * 60,
      h2Seconds: 0,
      runningSince: null,
      lineup: { gk: "p1", d1: "p8", d2: "p3", m1: "p4", m2: "p5", m3: "p6", f1: "p7" },
      intervals: {
        p1: [{ start: 0, end: null, role: "POR" }],
        p2: [{ start: 0, end: 10, role: "DEF" }],        // salio en el 10
        p8: [{ start: 10, end: null, role: "DEF" }],     // entro en el 10
      },
      events: [],
      ...overrides,
    };
  }
  const squad = [
    { id: "p1", name: "Portero", number: 1 },
    { id: "p2", name: "Salio", number: 2 },
    { id: "p8", name: "Entro", number: 8 },
    { id: "p9", name: "Nunca", number: 9 },
  ];

  it("calcula las 4 metricas por jugador", () => {
    const m = make();
    const s = playerTimeStats(m, squad, 0);
    expect(s.p1.played).toBe(20); // desde el 0
    expect(s.p1.bench).toBe(0);
    expect(s.p1.onSince).toBe(20); // en el campo desde el 0
    expect(s.p1.offSince).toBe(0);
    expect(s.p2.played).toBe(10); // 0-10
    expect(s.p2.bench).toBe(10);
    expect(s.p2.onSince).toBe(0); // fuera
    expect(s.p2.offSince).toBe(10); // salio en el 10 -> 10 en banquillo
    expect(s.p8.played).toBe(10); // 10-20
    expect(s.p8.bench).toBe(10);
    expect(s.p8.onSince).toBe(10); // entro en el 10
    expect(s.p8.offSince).toBe(0);
    expect(s.p9.played).toBe(0);
    expect(s.p9.bench).toBe(20);
    expect(s.p9.onSince).toBe(0);
    expect(s.p9.offSince).toBe(20); // nunca ha jugado
  });

  it("no cuenta el tiempo de descuento en los minutos", () => {
    const m = make({ h1Seconds: 28 * 60 }); // 28 reales, halfMin 25
    const s = playerTimeStats(m, squad, 0);
    expect(s.p1.played).toBe(25); // capado a 25
    expect(s.p9.bench).toBe(25);
  });

  it("al ir a descanso pronto, no marca 25 minutos (bug reportado)", () => {
    const m = make({ phase: "descanso", h1Seconds: 30, h2Seconds: 0 });
    const s = playerTimeStats(m, squad, 0);
    expect(s.p1.played).toBe(0); // 0:30 jugados -> 0', NO 25'
    expect(s.p9.bench).toBe(0);
  });

  it("durante el descanso no suma minutos a nadie", () => {
    const m = make({ phase: "descanso", h1Seconds: 25 * 60 });
    const s = playerTimeStats(m, squad, 0);
    expect(s.p1.played).toBe(25); // se queda congelado en 25
    expect(s.p9.bench).toBe(25);
    // En 2a parte, el reloj arranca de nuevo en halfMin: no se arrastra el descanso.
    const m2 = make({ phase: "h2", h1Seconds: 25 * 60, h2Seconds: 0, runningSince: null });
    const s2 = playerTimeStats(m2, squad, 0);
    expect(s2.p1.played).toBe(25); // sigue 25 al empezar la 2a parte
  });
});
