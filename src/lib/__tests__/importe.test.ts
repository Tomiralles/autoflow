import { describe, expect, it } from "vitest";
import { parsearImporte } from "@/lib/importe";

describe("parsearImporte", () => {
  it("acepta enteros y decimales con punto", () => {
    expect(parsearImporte("25")).toBe(25);
    expect(parsearImporte("12.50")).toBe(12.5);
  });

  it("acepta la coma decimal española", () => {
    expect(parsearImporte("12,50")).toBe(12.5);
    expect(parsearImporte("0,99")).toBe(0.99);
  });

  it("ignora espacios alrededor", () => {
    expect(parsearImporte("  30 ")).toBe(30);
  });

  it("redondea a 2 decimales", () => {
    expect(parsearImporte("10.999")).toBe(11);
    expect(parsearImporte("10.994")).toBe(10.99);
  });

  it("vacío devuelve null", () => {
    expect(parsearImporte("")).toBeNull();
    expect(parsearImporte("   ")).toBeNull();
  });

  it("texto no numérico devuelve null", () => {
    expect(parsearImporte("gratis")).toBeNull();
    expect(parsearImporte("12,50€")).toBeNull();
  });

  it("cero y negativos devuelven null", () => {
    expect(parsearImporte("0")).toBeNull();
    expect(parsearImporte("-5")).toBeNull();
  });
});
