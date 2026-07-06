import { describe, expect, it } from "vitest";
import { generarHuecos, horarioDelDia } from "@/lib/slots";

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
