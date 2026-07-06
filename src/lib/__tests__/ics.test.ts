import { describe, expect, it } from "vitest";
import { buildIcsContent } from "@/lib/ics";

describe("buildIcsContent", () => {
  const base = {
    id: "abc-123",
    serviceName: "Corte y peinado",
    date: "2026-07-07",
    time: "11:00",
    durationMinutes: 60,
    businessName: "Peluquería La Prueba",
    businessPhone: "600000000",
    businessAddress: "Calle Mayor 1, Alicante",
    clientName: "Lucía",
  };

  it("produce un VCALENDAR válido con inicio y fin correctos", () => {
    const ics = buildIcsContent(base);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("DTSTART:20260707T110000");
    expect(ics).toContain("DTEND:20260707T120000");
    expect(ics).toContain("UID:abc-123@autoflow-ai");
    // RFC 5545: líneas separadas por CRLF
    expect(ics).toContain("\r\n");
  });

  it("el fin cruza de día si la duración lo requiere", () => {
    const ics = buildIcsContent({ ...base, time: "23:30", durationMinutes: 60 });
    expect(ics).toContain("DTSTART:20260707T233000");
    expect(ics).toContain("DTEND:20260708T003000");
  });

  it("escapa comas y saltos de línea del texto", () => {
    const ics = buildIcsContent({
      ...base,
      businessAddress: "Calle Mayor 1, 2ºB; Alicante",
    });
    expect(ics).toContain("LOCATION:Calle Mayor 1\\, 2ºB\\; Alicante");
  });

  it("sin duración asume 60 minutos", () => {
    const ics = buildIcsContent({ ...base, durationMinutes: null });
    expect(ics).toContain("DTEND:20260707T120000");
  });
});
