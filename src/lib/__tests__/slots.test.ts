import { describe, expect, it } from "vitest";
import {
  filtrarHuecosLibres,
  generarHuecos,
  horarioDelDia,
  huecosLibresEquipo,
  sinHuecosPasados,
} from "@/lib/slots";

describe("sinHuecosPasados", () => {
  const huecos = ["09:00", "11:00", "13:00", "15:00", "17:00"];

  it("si no es hoy, no filtra nada", () => {
    expect(sinHuecosPasados(huecos, false, "17:30")).toEqual(huecos);
  });

  it("si es hoy, quita las horas ya pasadas", () => {
    expect(sinHuecosPasados(huecos, true, "12:00")).toEqual([
      "13:00",
      "15:00",
      "17:00",
    ]);
  });

  it("la hora exacta actual tampoco se ofrece", () => {
    expect(sinHuecosPasados(huecos, true, "13:00")).toEqual([
      "15:00",
      "17:00",
    ]);
  });

  it("si ya pasaron todas, no queda ninguna", () => {
    expect(sinHuecosPasados(huecos, true, "20:00")).toEqual([]);
  });
});

describe("generarHuecos", () => {
  it("genera huecos de 60 min de 9 a 19 (el último empieza a las 18)", () => {
    const huecos = generarHuecos("09:00", "19:00", 60);
    expect(huecos).toHaveLength(10);
    expect(huecos[0]).toBe("09:00");
    expect(huecos.at(-1)).toBe("18:00");
  });

  it("con 90 min avanza de 90 en 90 y el último hueco cabe entero", () => {
    const huecos = generarHuecos("09:00", "19:00", 90);
    expect(huecos).toEqual([
      "09:00",
      "10:30",
      "12:00",
      "13:30",
      "15:00",
      "16:30",
    ]);
  });

  it("no genera huecos que se salgan del cierre", () => {
    const huecos = generarHuecos("18:00", "19:00", 90);
    expect(huecos).toHaveLength(0);
  });

  it("soporta medias horas de apertura", () => {
    const huecos = generarHuecos("09:30", "11:30", 30);
    expect(huecos).toEqual(["09:30", "10:00", "10:30", "11:00"]);
  });
});

describe("filtrarHuecosLibres", () => {
  it("una cita larga bloquea todos los huecos que caen dentro de ella", () => {
    // Cita de 120 min a las 10:00 (ocupa 10:00-12:00). Huecos de 25 min.
    const candidatos = generarHuecos("09:00", "13:00", 25);
    const libres = filtrarHuecosLibres(candidatos, 25, [
      { time: "10:00", duration: 120 },
    ]);
    // 09:50+25=10:15 pisa la cita; 10:15/10:40/11:05/11:30/11:55 caen dentro
    expect(libres).toEqual(["09:00", "09:25", "12:20"]);
  });

  it("un hueco largo que envolvería una cita corta también se bloquea", () => {
    // Cita de 25 min a las 10:30. Servicio de 120 min: el hueco de 10:00
    // terminaría a las 12:00 pasando por encima de la cita.
    const libres = filtrarHuecosLibres(["08:00", "10:00", "12:00"], 120, [
      { time: "10:30", duration: 25 },
    ]);
    expect(libres).toEqual(["08:00", "12:00"]);
  });

  it("una cita contigua no bloquea (termina justo cuando empieza el hueco)", () => {
    const libres = filtrarHuecosLibres(["12:00"], 30, [
      { time: "10:00", duration: 120 },
    ]);
    expect(libres).toEqual(["12:00"]);
  });

  it("coincidencia exacta se bloquea (comportamiento anterior conservado)", () => {
    const libres = filtrarHuecosLibres(["10:00", "11:00"], 60, [
      { time: "10:00", duration: 60 },
    ]);
    expect(libres).toEqual(["11:00"]);
  });

  it("sin duración usa 60 min por defecto", () => {
    const libres = filtrarHuecosLibres(["10:30"], 30, [
      { time: "10:00", duration: 0 },
    ]);
    expect(libres).toEqual([]);
  });
});

describe("huecosLibresEquipo", () => {
  const nueveAonce = { open: true, start: "09:00", end: "11:00" };

  it("un hueco se ofrece si al menos un trabajador está libre", () => {
    const libres = huecosLibresEquipo(
      [
        { id: "ana", hours: nueveAonce },
        { id: "bea", hours: nueveAonce },
      ],
      60,
      [{ time: "09:00", duration: 60, staff_id: "ana" }]
    );
    // Ana ocupada a las 09:00 pero Bea libre → el hueco sigue ofreciéndose
    expect(libres).toEqual(["09:00", "10:00"]);
  });

  it("si todos están ocupados a esa hora, el hueco desaparece", () => {
    const libres = huecosLibresEquipo(
      [
        { id: "ana", hours: nueveAonce },
        { id: "bea", hours: nueveAonce },
      ],
      60,
      [
        { time: "09:00", duration: 60, staff_id: "ana" },
        { time: "09:00", duration: 60, staff_id: "bea" },
      ]
    );
    expect(libres).toEqual(["10:00"]);
  });

  it("una cita sin trabajador asignado bloquea a todo el equipo", () => {
    const libres = huecosLibresEquipo(
      [
        { id: "ana", hours: nueveAonce },
        { id: "bea", hours: nueveAonce },
      ],
      60,
      [{ time: "09:00", duration: 60, staff_id: null }]
    );
    expect(libres).toEqual(["10:00"]);
  });

  it("cada trabajador aporta los huecos de SU horario (unión ordenada)", () => {
    const libres = huecosLibresEquipo(
      [
        { id: "ana", hours: { open: true, start: "09:00", end: "11:00" } },
        { id: "bea", hours: { open: true, start: "16:00", end: "18:00" } },
      ],
      60,
      []
    );
    expect(libres).toEqual(["09:00", "10:00", "16:00", "17:00"]);
  });

  it("un trabajador que no trabaja ese día no aporta huecos", () => {
    const libres = huecosLibresEquipo(
      [
        { id: "ana", hours: { open: false } },
        { id: "bea", hours: nueveAonce },
      ],
      60,
      [{ time: "09:00", duration: 60, staff_id: "bea" }]
    );
    // Ana cerrada, y Bea ocupada a las 09:00
    expect(libres).toEqual(["10:00"]);
  });

  it("con lista de un solo trabajador filtra solo sus citas", () => {
    const libres = huecosLibresEquipo(
      [{ id: "ana", hours: nueveAonce }],
      60,
      [
        { time: "09:00", duration: 60, staff_id: "bea" }, // de otra → no molesta
        { time: "10:00", duration: 60, staff_id: "ana" },
      ]
    );
    expect(libres).toEqual(["09:00"]);
  });

  it("sin equipo no hay huecos (lista vacía)", () => {
    expect(huecosLibresEquipo([], 60, [])).toEqual([]);
  });
});

describe("horarioDelDia", () => {
  it("sin configurar: lunes a sábado abierto 9-19", () => {
    // 2026-07-06 es lunes
    expect(horarioDelDia("2026-07-06", null)).toEqual({
      open: true,
      start: "09:00",
      end: "19:00",
    });
  });

  it("sin configurar: domingo cerrado", () => {
    expect(horarioDelDia("2026-07-05", null).open).toBe(false);
  });

  it("con configuración: usa el horario del negocio", () => {
    const wh = { lunes: { open: true, start: "10:00", end: "14:00" } };
    expect(horarioDelDia("2026-07-06", wh)).toEqual({
      open: true,
      start: "10:00",
      end: "14:00",
    });
  });

  it("con configuración: un día no listado se considera cerrado", () => {
    const wh = { lunes: { open: true, start: "10:00", end: "14:00" } };
    expect(horarioDelDia("2026-07-07", wh).open).toBe(false); // martes
  });
});
