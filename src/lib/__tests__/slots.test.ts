import { describe, expect, it } from "vitest";
import { filtrarHuecosLibres, generarHuecos, horarioDelDia } from "@/lib/slots";

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
