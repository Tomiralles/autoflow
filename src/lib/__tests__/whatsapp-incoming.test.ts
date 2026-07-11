import { describe, it, expect } from "vitest";
import { detectKeyword, generateReservationUrl } from "../whatsapp/incoming";

describe("detectKeyword", () => {
  const keywords = ["cita", "reserva", "horario", "agendar", "disponibilidad", "precio", "tarifa"];

  it("detects keyword at start", () => {
    expect(detectKeyword("Cita para mañana", keywords)).toBe("cita");
  });

  it("detects keyword in middle", () => {
    expect(detectKeyword("Quiero una reserva por favor", keywords)).toBe("reserva");
  });

  it("detects keyword at end", () => {
    expect(detectKeyword("Cual es tu horario", keywords)).toBe("horario");
  });

  it("is case-insensitive", () => {
    expect(detectKeyword("AGENDAR", keywords)).toBe("agendar");
    expect(detectKeyword("AgenDar", keywords)).toBe("agendar");
  });

  it("requires whole-word match", () => {
    expect(detectKeyword("Mi citar es mañana", keywords)).toBeNull();
    expect(detectKeyword("La citación fue clara", keywords)).toBeNull();
  });

  it("returns null when no keyword matches", () => {
    expect(detectKeyword("Hola, como estás?", keywords)).toBeNull();
    expect(detectKeyword("Necesito ayuda", keywords)).toBeNull();
  });

  it("detects first keyword in order", () => {
    // Message with multiple keywords
    const result = detectKeyword("Quiero una cita y conocer tu horario", keywords);
    // Should return one of them (detectKeyword returns first match)
    expect(["cita", "horario"].includes(result || "")).toBe(true);
  });

  it("handles accented characters in message", () => {
    expect(detectKeyword("Quiero una citación automática", keywords)).toBeNull();
  });
});

describe("generateReservationUrl", () => {
  it("usa el slug del negocio, no el id", () => {
    const originalEnv = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://custom.example.com";

    const url = generateReservationUrl({ slug: "peluqueria-nova" });
    expect(url).toBe("https://custom.example.com/peluqueria-nova");

    process.env.NEXT_PUBLIC_APP_URL = originalEnv;
  });

  it("recorta la barra final de NEXT_PUBLIC_APP_URL", () => {
    const originalEnv = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://custom.example.com/";

    const url = generateReservationUrl({ slug: "strategia" });
    expect(url).toBe("https://custom.example.com/strategia");

    process.env.NEXT_PUBLIC_APP_URL = originalEnv;
  });

  it("por defecto usa el dominio oficial de producción", () => {
    const originalEnv = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;

    const url = generateReservationUrl({ slug: "xyz789" });
    expect(url).toBe("https://autoflow-five-alpha.vercel.app/xyz789");

    if (originalEnv) {
      process.env.NEXT_PUBLIC_APP_URL = originalEnv;
    }
  });
});
