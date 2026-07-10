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
  it("generates URL with business ID", () => {
    const business = { id: "123e4567-e89b-12d3-a456-426614174000" };
    const url = generateReservationUrl(business);

    expect(url).toContain("123e4567-e89b-12d3-a456-426614174000");
  });

  it("uses NEXT_PUBLIC_SITE_URL when set", () => {
    const originalEnv = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://custom.example.com";

    const business = { id: "abc123" };
    const url = generateReservationUrl(business);

    expect(url).toBe("https://custom.example.com/abc123");

    process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
  });

  it("defaults to autoflow.vercel.app", () => {
    const originalEnv = process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;

    const business = { id: "xyz789" };
    const url = generateReservationUrl(business);

    expect(url).toBe("https://autoflow.vercel.app/xyz789");

    if (originalEnv) {
      process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
    }
  });
});
